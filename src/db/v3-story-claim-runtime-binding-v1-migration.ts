import type postgres from "postgres";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v29-v3-story-claim-runtime-binding:BEGIN
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE =
  "v3_story_claim_runtime_bindings_v1" as const;
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION =
  "setfarm_guard_v3_story_claim_runtime_binding_v1" as const;
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_ROW_TRIGGER =
  "trg_v3_story_claim_runtime_binding_guard_v1" as const;
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_TRUNCATE_TRIGGER =
  "trg_v3_story_claim_runtime_binding_no_truncate_v1" as const;
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_STEP_IDENTITY_CONSTRAINT =
  "steps_v3_story_claim_runtime_binding_identity_key" as const;
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_STORY_IDENTITY_CONSTRAINT =
  "stories_v3_story_claim_runtime_binding_identity_key" as const;
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_SCOPE_INDEX =
  "idx_v3_story_claim_runtime_bindings_v1_scope" as const;
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE =
  "v3_story_claim_runtime_binding_cutovers_v1" as const;
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_ROW_TRIGGER =
  "trg_v3_story_claim_runtime_binding_cutover_guard_v1" as const;
export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TRUNCATE_TRIGGER =
  "trg_v3_story_claim_runtime_binding_cutover_no_truncate_v1" as const;

const CUTOVER_AUTHORITY_ID = "v1";
const HISTORICAL_OWNER_PAGE_SIZE = 64;
const MAX_HISTORICAL_OWNER_COUNT = 10_000;

export type V3StoryClaimRuntimeBindingMigrationErrorCode =
  | "V3_STORY_CLAIM_RUNTIME_BINDING_PARTIAL"
  | "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID"
  | "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID"
  | "V3_STORY_CLAIM_RUNTIME_BINDING_SQL_FAILED";

export class V3StoryClaimRuntimeBindingMigrationError extends Error {
  readonly code: V3StoryClaimRuntimeBindingMigrationErrorCode;

  constructor(
    code: V3StoryClaimRuntimeBindingMigrationErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "V3StoryClaimRuntimeBindingMigrationError";
    this.code = code;
  }
}

type MigrationErrorFactory = (
  code: V3StoryClaimRuntimeBindingMigrationErrorCode,
  message: string,
  cause?: unknown,
) => Error;

let migrationErrorFactory: MigrationErrorFactory | undefined;

export function configureV3StoryClaimRuntimeBindingMigrationErrorFactory(
  factory: MigrationErrorFactory,
): void {
  if (migrationErrorFactory && migrationErrorFactory !== factory) {
    throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_MIGRATION_ERROR_FACTORY_ALREADY_BOUND");
  }
  migrationErrorFactory = factory;
}

function migrationError(
  code: V3StoryClaimRuntimeBindingMigrationErrorCode,
  message: string,
  cause?: unknown,
): Error {
  return migrationErrorFactory
    ? migrationErrorFactory(code, message, cause)
    : new V3StoryClaimRuntimeBindingMigrationError(
      code,
      message,
      cause === undefined ? {} : { cause },
    );
}

export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION_BODY = `
  DECLARE
    parent_protocol TEXT;
    parent_claim_story_id TEXT;
    parent_claimed_at TIMESTAMPTZ;
    parent_runtime_step_db_id TEXT;
    parent_runtime_workflow_step_id TEXT;
    parent_runtime_story_db_id TEXT;
    parent_runtime_story_id TEXT;
    parent_runtime_created_at TIMESTAMPTZ;
    cutover_maximum_claim_id BIGINT;
    cutover_boundary_at TIMESTAMPTZ;
  BEGIN
    IF TG_OP = 'TRUNCATE' THEN
      RAISE EXCEPTION 'V3_STORY_CLAIM_RUNTIME_BINDING_TRUNCATE_FORBIDDEN'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'V3_STORY_CLAIM_RUNTIME_BINDING_DELETE_FORBIDDEN'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'V3_STORY_CLAIM_RUNTIME_BINDING_UPDATE_FORBIDDEN'
        USING ERRCODE = '23514';
    END IF;

    SELECT run.protocol,
           claim.story_id,
           claim.claimed_at,
           runtime.step_db_id,
           runtime.workflow_step_id,
           runtime.story_db_id,
           runtime.story_id,
           runtime.created_at
      INTO parent_protocol,
           parent_claim_story_id,
           parent_claimed_at,
           parent_runtime_step_db_id,
           parent_runtime_workflow_step_id,
           parent_runtime_story_db_id,
           parent_runtime_story_id,
           parent_runtime_created_at
      FROM public.runs run
      JOIN public.claim_log claim
        ON claim.id = NEW.claim_id
       AND claim.run_id = NEW.run_id
       AND claim.step_id = NEW.workflow_step_id
      JOIN public.runtime_sessions runtime
        ON runtime.session_id = NEW.runtime_session_id
       AND runtime.claim_id = NEW.claim_id
       AND runtime.run_id = NEW.run_id
     WHERE run.id = NEW.run_id
     FOR KEY SHARE OF run, claim, runtime;

    IF NOT FOUND
       OR parent_protocol IS DISTINCT FROM 'v3'
       OR parent_runtime_step_db_id IS DISTINCT FROM NEW.step_db_id
       OR parent_runtime_workflow_step_id IS DISTINCT FROM NEW.workflow_step_id
       OR parent_claimed_at IS DISTINCT FROM NEW.bound_at THEN
      RAISE EXCEPTION 'V3_STORY_CLAIM_RUNTIME_BINDING_PARENT_INVALID'
        USING ERRCODE = '23514';
    END IF;

    SELECT cutover.maximum_pre_cutover_claim_id, cutover.cutover_at
      INTO cutover_maximum_claim_id, cutover_boundary_at
      FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE} cutover
     WHERE cutover.cutover_id = '${CUTOVER_AUTHORITY_ID}'
     FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'V3_STORY_CLAIM_RUNTIME_BINDING_CUTOVER_MISSING'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.claim_id <= cutover_maximum_claim_id
       AND parent_claimed_at <= cutover_boundary_at
       AND parent_runtime_created_at <= cutover_boundary_at THEN
      RAISE EXCEPTION 'V3_STORY_CLAIM_RUNTIME_BINDING_HISTORICAL_OWNER_FORBIDDEN'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.workflow_step_id = 'implement' THEN
      IF NEW.subject_kind IS DISTINCT FROM 'story_member'
         OR parent_claim_story_id IS DISTINCT FROM NEW.story_id
         OR parent_runtime_story_db_id IS DISTINCT FROM NEW.story_db_id
         OR parent_runtime_story_id IS DISTINCT FROM NEW.story_id
         OR NOT EXISTS (
           SELECT 1
             FROM public.stories story
            WHERE story.id = NEW.story_db_id
              AND story.run_id = NEW.run_id
              AND story.story_id = NEW.story_id
              AND story.story_index = NEW.story_index
              AND story.claim_generation = NEW.story_claim_generation
         ) THEN
        RAISE EXCEPTION 'V3_STORY_CLAIM_RUNTIME_BINDING_IMPLEMENT_SUBJECT_INVALID'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.workflow_step_id = 'supervise' THEN
      IF parent_claim_story_id IS NOT NULL
         OR parent_runtime_story_db_id IS NOT NULL
         OR parent_runtime_story_id IS NOT NULL THEN
        RAISE EXCEPTION 'V3_STORY_CLAIM_RUNTIME_BINDING_SUPERVISE_OWNER_INVALID'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.subject_kind = 'story_member'
         AND NOT EXISTS (
           SELECT 1
             FROM public.stories story
            WHERE story.id = NEW.story_db_id
              AND story.run_id = NEW.run_id
              AND story.story_id = NEW.story_id
              AND story.story_index = NEW.story_index
              AND story.claim_generation = NEW.story_claim_generation
              AND story.status = 'done'
         ) THEN
        RAISE EXCEPTION 'V3_STORY_CLAIM_RUNTIME_BINDING_SUPERVISE_STORY_INVALID'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END;
`;

export const V3_STORY_CLAIM_RUNTIME_BINDING_V1_STATEMENTS = Object.freeze([
  `CREATE TABLE IF NOT EXISTS public.steps (
     id TEXT PRIMARY KEY,
     run_id TEXT NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
     step_id TEXT NOT NULL,
     agent_id TEXT NOT NULL,
     step_index INTEGER NOT NULL,
     input_template TEXT NOT NULL,
     expects TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'waiting',
     output TEXT,
     retry_count INTEGER NOT NULL DEFAULT 0,
     max_retries INTEGER NOT NULL DEFAULT 2,
     abandoned_count INTEGER NOT NULL DEFAULT 0,
     started_at TIMESTAMPTZ,
     type TEXT NOT NULL DEFAULT 'single',
     loop_config TEXT,
     current_story_id TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS public.stories (
     id TEXT PRIMARY KEY,
     run_id TEXT NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
     story_index INTEGER NOT NULL,
     story_id TEXT NOT NULL,
     title TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     acceptance_criteria TEXT NOT NULL DEFAULT '[]',
     status TEXT NOT NULL DEFAULT 'pending',
     output TEXT,
     retry_count INTEGER NOT NULL DEFAULT 0,
     max_retries INTEGER NOT NULL DEFAULT 2,
     abandoned_count INTEGER NOT NULL DEFAULT 0,
     claimed_by TEXT,
     claimed_at TIMESTAMPTZ,
     claim_generation INTEGER NOT NULL DEFAULT 0,
     started_at TIMESTAMPTZ,
     depends_on TEXT,
     scope_files TEXT,
     shared_files TEXT,
     scope_targets TEXT,
     requested_dependencies TEXT,
     shared_edit_requests TEXT,
     resolved_scope_files TEXT,
     scope_description TEXT,
     file_skeletons TEXT,
     implementation_contract TEXT,
     story_screens TEXT,
     story_branch TEXT,
     pr_url TEXT,
     merge_status TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     quality_failure_fingerprint TEXT
   )`,
  `ALTER TABLE public.steps
     ADD CONSTRAINT ${V3_STORY_CLAIM_RUNTIME_BINDING_V1_STEP_IDENTITY_CONSTRAINT}
     UNIQUE (id, run_id, step_id)`,
  `ALTER TABLE public.stories
     ADD CONSTRAINT ${V3_STORY_CLAIM_RUNTIME_BINDING_V1_STORY_IDENTITY_CONSTRAINT}
     UNIQUE (id, run_id, story_id, story_index)`,
  `CREATE TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE} (
     cutover_id TEXT PRIMARY KEY,
     maximum_pre_cutover_claim_id BIGINT NOT NULL,
     cutover_at TIMESTAMPTZ NOT NULL,
     historical_owner_count BIGINT NOT NULL,
     historical_owner_digest TEXT NOT NULL,
     CONSTRAINT v3_story_claim_runtime_binding_cutovers_v1_identity_check
       CHECK (cutover_id = '${CUTOVER_AUTHORITY_ID}'),
     CONSTRAINT v3_story_claim_runtime_binding_cutovers_v1_claim_id_check
       CHECK (maximum_pre_cutover_claim_id >= 0),
     CONSTRAINT v3_story_claim_runtime_binding_cutovers_v1_owner_count_check
       CHECK (historical_owner_count BETWEEN 0 AND ${MAX_HISTORICAL_OWNER_COUNT}),
     CONSTRAINT v3_story_claim_runtime_binding_cutovers_v1_digest_check
       CHECK (historical_owner_digest ~ '^[a-f0-9]{64}$')
   )`,
  `REVOKE ALL ON TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}
     FROM PUBLIC`,
  `CREATE TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE} (
     claim_id BIGINT PRIMARY KEY,
     runtime_session_id TEXT NOT NULL UNIQUE,
     run_id TEXT NOT NULL,
     step_db_id TEXT NOT NULL,
     workflow_step_id TEXT NOT NULL,
     subject_kind TEXT NOT NULL,
     story_db_id TEXT,
     story_id TEXT,
     story_index INTEGER,
     story_claim_generation INTEGER,
     story_admission_receipt_hash TEXT NOT NULL,
     story_admission_subject_hash TEXT NOT NULL,
     bound_at TIMESTAMPTZ NOT NULL,
     CONSTRAINT v3_story_claim_runtime_bindings_v1_workflow_step_check
       CHECK (workflow_step_id IN ('implement', 'supervise')),
     CONSTRAINT v3_story_claim_runtime_bindings_v1_subject_check
       CHECK (
         (
           subject_kind = 'story_member'
           AND story_db_id IS NOT NULL
           AND story_id IS NOT NULL
           AND story_index IS NOT NULL
           AND story_claim_generation > 0
           AND workflow_step_id IN ('implement', 'supervise')
         )
         OR
         (
           subject_kind = 'final_product'
           AND story_db_id IS NULL
           AND story_id IS NULL
           AND story_index IS NULL
           AND story_claim_generation IS NULL
           AND workflow_step_id = 'supervise'
         )
       ),
     CONSTRAINT v3_story_claim_runtime_bindings_v1_receipt_hash_check
       CHECK (story_admission_receipt_hash ~ '^[a-f0-9]{64}$'),
     CONSTRAINT v3_story_claim_runtime_bindings_v1_subject_hash_check
       CHECK (story_admission_subject_hash ~ '^[a-f0-9]{64}$'),
     CONSTRAINT v3_story_claim_runtime_bindings_v1_run_fkey
       FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE RESTRICT,
     CONSTRAINT v3_story_claim_runtime_bindings_v1_claim_fkey
       FOREIGN KEY (claim_id, run_id, workflow_step_id)
       REFERENCES public.claim_log(id, run_id, step_id) ON DELETE RESTRICT,
     CONSTRAINT v3_story_claim_runtime_bindings_v1_runtime_fkey
       FOREIGN KEY (runtime_session_id, claim_id, run_id)
       REFERENCES public.runtime_sessions(session_id, claim_id, run_id)
       ON DELETE RESTRICT,
     CONSTRAINT v3_story_claim_runtime_bindings_v1_step_fkey
       FOREIGN KEY (step_db_id, run_id, workflow_step_id)
       REFERENCES public.steps(id, run_id, step_id) ON DELETE RESTRICT,
     CONSTRAINT v3_story_claim_runtime_bindings_v1_story_fkey
       FOREIGN KEY (story_db_id, run_id, story_id, story_index)
       REFERENCES public.stories(id, run_id, story_id, story_index)
       ON DELETE RESTRICT
   )`,
  `REVOKE ALL ON TABLE public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
     FROM PUBLIC`,
  `CREATE INDEX ${V3_STORY_CLAIM_RUNTIME_BINDING_V1_SCOPE_INDEX}
     ON public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
       (run_id, workflow_step_id, subject_kind, story_db_id)`,
  `CREATE FUNCTION public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION}()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION_BODY}$$`,
  `REVOKE ALL ON FUNCTION public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION}()
     FROM PUBLIC`,
  `CREATE TRIGGER ${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_ROW_TRIGGER}
     BEFORE UPDATE OR DELETE
     ON public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}
     FOR EACH ROW
     EXECUTE FUNCTION public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION}()`,
  `CREATE TRIGGER ${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TRUNCATE_TRIGGER}
     BEFORE TRUNCATE
     ON public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}
     FOR EACH STATEMENT
     EXECUTE FUNCTION public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION}()`,
  `CREATE TRIGGER ${V3_STORY_CLAIM_RUNTIME_BINDING_V1_ROW_TRIGGER}
     BEFORE INSERT OR UPDATE OR DELETE
     ON public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
     FOR EACH ROW
     EXECUTE FUNCTION public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION}()`,
  `CREATE TRIGGER ${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TRUNCATE_TRIGGER}
     BEFORE TRUNCATE
     ON public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}
     FOR EACH STATEMENT
     EXECUTE FUNCTION public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION}()`,
] as const);

function normalizeSql(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}

type CanonicalBaseColumn = Readonly<{
  type: string;
  nullable: boolean;
  defaultExpression: string | null;
}>;

const canonicalStepColumns = new Map<string, CanonicalBaseColumn>([
  ["id", { type: "text", nullable: false, defaultExpression: null }],
  ["run_id", { type: "text", nullable: false, defaultExpression: null }],
  ["step_id", { type: "text", nullable: false, defaultExpression: null }],
  ["agent_id", { type: "text", nullable: false, defaultExpression: null }],
  ["step_index", { type: "integer", nullable: false, defaultExpression: null }],
  ["input_template", { type: "text", nullable: false, defaultExpression: null }],
  ["expects", { type: "text", nullable: false, defaultExpression: null }],
  ["status", { type: "text", nullable: false, defaultExpression: "'waiting'::text" }],
  ["output", { type: "text", nullable: true, defaultExpression: null }],
  ["retry_count", { type: "integer", nullable: false, defaultExpression: "0" }],
  ["max_retries", { type: "integer", nullable: false, defaultExpression: "2" }],
  ["abandoned_count", { type: "integer", nullable: false, defaultExpression: "0" }],
  ["started_at", { type: "timestamp with time zone", nullable: true, defaultExpression: null }],
  ["type", { type: "text", nullable: false, defaultExpression: "'single'::text" }],
  ["loop_config", { type: "text", nullable: true, defaultExpression: null }],
  ["current_story_id", { type: "text", nullable: true, defaultExpression: null }],
  ["created_at", { type: "timestamp with time zone", nullable: false, defaultExpression: "now()" }],
  ["updated_at", { type: "timestamp with time zone", nullable: false, defaultExpression: "now()" }],
]);

const canonicalStoryColumns = new Map<string, CanonicalBaseColumn>([
  ["id", { type: "text", nullable: false, defaultExpression: null }],
  ["run_id", { type: "text", nullable: false, defaultExpression: null }],
  ["story_index", { type: "integer", nullable: false, defaultExpression: null }],
  ["story_id", { type: "text", nullable: false, defaultExpression: null }],
  ["title", { type: "text", nullable: false, defaultExpression: null }],
  ["description", { type: "text", nullable: false, defaultExpression: "''::text" }],
  ["acceptance_criteria", { type: "text", nullable: false, defaultExpression: "'[]'::text" }],
  ["status", { type: "text", nullable: false, defaultExpression: "'pending'::text" }],
  ["output", { type: "text", nullable: true, defaultExpression: null }],
  ["retry_count", { type: "integer", nullable: false, defaultExpression: "0" }],
  ["max_retries", { type: "integer", nullable: false, defaultExpression: "2" }],
  ["abandoned_count", { type: "integer", nullable: false, defaultExpression: "0" }],
  ["claimed_by", { type: "text", nullable: true, defaultExpression: null }],
  ["claimed_at", { type: "timestamp with time zone", nullable: true, defaultExpression: null }],
  ["claim_generation", { type: "integer", nullable: false, defaultExpression: "0" }],
  ["started_at", { type: "timestamp with time zone", nullable: true, defaultExpression: null }],
  ["depends_on", { type: "text", nullable: true, defaultExpression: null }],
  ["scope_files", { type: "text", nullable: true, defaultExpression: null }],
  ["shared_files", { type: "text", nullable: true, defaultExpression: null }],
  ["scope_targets", { type: "text", nullable: true, defaultExpression: null }],
  ["requested_dependencies", { type: "text", nullable: true, defaultExpression: null }],
  ["shared_edit_requests", { type: "text", nullable: true, defaultExpression: null }],
  ["resolved_scope_files", { type: "text", nullable: true, defaultExpression: null }],
  ["scope_description", { type: "text", nullable: true, defaultExpression: null }],
  ["file_skeletons", { type: "text", nullable: true, defaultExpression: null }],
  ["implementation_contract", { type: "text", nullable: true, defaultExpression: null }],
  ["story_screens", { type: "text", nullable: true, defaultExpression: null }],
  ["story_branch", { type: "text", nullable: true, defaultExpression: null }],
  ["pr_url", { type: "text", nullable: true, defaultExpression: null }],
  ["merge_status", { type: "text", nullable: true, defaultExpression: null }],
  ["created_at", { type: "timestamp with time zone", nullable: false, defaultExpression: "now()" }],
  ["updated_at", { type: "timestamp with time zone", nullable: false, defaultExpression: "now()" }],
  ["quality_failure_fingerprint", { type: "text", nullable: true, defaultExpression: null }],
]);

async function canonicalBaseRelationCensus(
  sql: Sql | TransactionSql,
): Promise<Readonly<{ steps: boolean; stories: boolean }>> {
  const rows = await sql.unsafe<Array<{ steps: boolean; stories: boolean }>>(
    `SELECT to_regclass('public.steps') IS NOT NULL AS steps,
            to_regclass('public.stories') IS NOT NULL AS stories`,
  );
  return Object.freeze({
    steps: rows[0]?.steps === true,
    stories: rows[0]?.stories === true,
  });
}

async function verifyCanonicalBaseRelation(
  sql: Sql | TransactionSql,
  relationName: "steps" | "stories",
  expectedColumns: ReadonlyMap<string, CanonicalBaseColumn>,
): Promise<void> {
  const relationRows = await sql.unsafe<Array<{
    owner_exact: boolean;
    acl_exact: boolean;
    column_acl_exact: boolean;
    shape_exact: boolean;
    no_inheritance: boolean;
    no_policies: boolean;
    no_rewrite_rules: boolean;
  }>>(
    `WITH expected_owner AS (
       SELECT COALESCE(
         (
           SELECT journal.relowner
             FROM pg_class journal
             JOIN pg_namespace journal_namespace
               ON journal_namespace.oid = journal.relnamespace
            WHERE journal_namespace.nspname = 'public'
              AND journal.relname = 'setfarm_schema_migrations'
         ),
         (SELECT oid FROM pg_roles WHERE rolname = current_user)
       ) AS oid
     )
     SELECT relation.relowner = expected_owner.oid AS owner_exact,
            NOT EXISTS (
              (
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner)))
                EXCEPT
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(acldefault('r', relation.relowner))
              )
              UNION ALL
              (
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(acldefault('r', relation.relowner))
                EXCEPT
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner)))
              )
            ) AS acl_exact,
            NOT EXISTS (
              SELECT 1 FROM pg_attribute attribute
               WHERE attribute.attrelid = relation.oid
                 AND attribute.attnum > 0
                 AND NOT attribute.attisdropped
                 AND attribute.attacl IS NOT NULL
            ) AS column_acl_exact,
            relation.relkind = 'r'
              AND relation.relpersistence = 'p'
              AND NOT relation.relispartition
              AND NOT relation.relrowsecurity
              AND NOT relation.relforcerowsecurity AS shape_exact,
            NOT EXISTS (
              SELECT 1 FROM pg_inherits inheritance
               WHERE inheritance.inhrelid = relation.oid
                  OR inheritance.inhparent = relation.oid
            ) AS no_inheritance,
            NOT EXISTS (
              SELECT 1 FROM pg_policy policy WHERE policy.polrelid = relation.oid
            ) AS no_policies,
            NOT EXISTS (
              SELECT 1 FROM pg_rewrite rewrite WHERE rewrite.ev_class = relation.oid
            ) AS no_rewrite_rules
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       CROSS JOIN expected_owner
      WHERE namespace.nspname = 'public'
        AND relation.relname = $1`,
    [relationName],
  );
  const relation = relationRows[0];
  if (relationRows.length !== 1
    || !relation?.owner_exact
    || !relation.acl_exact
    || !relation.column_acl_exact
    || !relation.shape_exact
    || !relation.no_inheritance
    || !relation.no_policies
    || !relation.no_rewrite_rules) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      `canonical ${relationName} relation shape, owner, or ACL mismatch`,
    );
  }
  const columns = await sql.unsafe<Array<{
    name: string;
    type: string;
    not_null: boolean;
    default_expression: string | null;
    generated: string;
    identity: string;
  }>>(
    `SELECT attribute.attname AS name,
            format_type(attribute.atttypid, attribute.atttypmod) AS type,
            attribute.attnotnull AS not_null,
            pg_get_expr(default_record.adbin, default_record.adrelid) AS default_expression,
            attribute.attgenerated AS generated,
            attribute.attidentity AS identity
       FROM pg_attribute attribute
       JOIN pg_class relation ON relation.oid = attribute.attrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       LEFT JOIN pg_attrdef default_record
         ON default_record.adrelid = attribute.attrelid
        AND default_record.adnum = attribute.attnum
      WHERE namespace.nspname = 'public'
        AND relation.relname = $1
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY attribute.attnum`,
    [relationName],
  );
  if (columns.length !== expectedColumns.size) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      `canonical ${relationName} column census mismatch`,
    );
  }
  for (const column of columns) {
    const expected = expectedColumns.get(column.name);
    if (!expected
      || column.type !== expected.type
      || column.not_null === expected.nullable
      || normalizeSql(column.default_expression ?? "")
        !== normalizeSql(expected.defaultExpression ?? "")
      || column.generated !== ""
      || column.identity !== "") {
      throw migrationError(
        "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
        `canonical ${relationName} column mismatch: ${column.name}`,
      );
    }
  }
  const constraints = await sql.unsafe<Array<{
    name: string;
    type: string;
    validated: boolean;
    deferrable: boolean;
    deferred: boolean;
    no_inherit: boolean;
    definition: string;
  }>>(
    `SELECT constraint_record.conname AS name,
            constraint_record.contype AS type,
            constraint_record.convalidated AS validated,
            constraint_record.condeferrable AS deferrable,
            constraint_record.condeferred AS deferred,
            constraint_record.connoinherit AS no_inherit,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint constraint_record
      WHERE constraint_record.conrelid = $1::regclass
        AND constraint_record.contype IN ('p', 'f')
      ORDER BY constraint_record.conname`,
    [`public.${relationName}`],
  );
  const expectedConstraints = new Map([
    [`${relationName}_pkey`, `primary key (id)`],
    [
      `${relationName}_run_id_fkey`,
      "foreign key (run_id) references runs(id) on delete cascade",
    ],
  ]);
  if (constraints.length !== expectedConstraints.size
    || constraints.some((constraint) => {
      const expected = expectedConstraints.get(constraint.name);
      return !expected
        || constraint.type !== (constraint.name.endsWith("_pkey") ? "p" : "f")
        || !constraint.validated
        || constraint.deferrable
        || constraint.deferred
        || !constraint.no_inherit
        || normalizeSql(constraint.definition) !== expected;
    })) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      `canonical ${relationName} primary or run foreign-key constraint mismatch`,
    );
  }
}

async function verifyCanonicalBaseRelationsForV29(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present"> {
  const census = await canonicalBaseRelationCensus(sql);
  if (!census.steps && !census.stories) return "absent";
  if (!census.steps || !census.stories) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_PARTIAL",
      "canonical steps and stories relations must be both absent or both present",
    );
  }
  await verifyCanonicalBaseRelation(sql, "steps", canonicalStepColumns);
  await verifyCanonicalBaseRelation(sql, "stories", canonicalStoryColumns);
  return "present";
}

async function objectCensus(sql: Sql | TransactionSql): Promise<Readonly<{
  relations: number;
  functions: number;
  triggers: number;
  supportingConstraints: number;
}>> {
  const rows = await sql.unsafe<Array<{
    relations: number;
    functions: number;
    triggers: number;
    supporting_constraints: number;
  }>>(
    `SELECT
       (SELECT COUNT(*)::integer
          FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
         WHERE namespace.nspname = 'public'
           AND relation.relname = ANY($1::text[])) AS relations,
       (SELECT COUNT(*)::integer
          FROM pg_proc routine
          JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
         WHERE namespace.nspname = 'public'
           AND routine.proname = $2) AS functions,
       (SELECT COUNT(*)::integer
          FROM pg_trigger trigger
         WHERE NOT trigger.tgisinternal
           AND trigger.tgname = ANY($3::text[])) AS triggers,
       (SELECT COUNT(*)::integer
          FROM pg_constraint constraint_record
         WHERE constraint_record.conname = ANY($4::text[])) AS supporting_constraints`,
    [
      [
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE,
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE,
      ],
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION,
      [
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_ROW_TRIGGER,
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_TRUNCATE_TRIGGER,
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_ROW_TRIGGER,
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TRUNCATE_TRIGGER,
      ],
      [
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_STEP_IDENTITY_CONSTRAINT,
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_STORY_IDENTITY_CONSTRAINT,
      ],
    ],
  );
  return Object.freeze({
    relations: rows[0]?.relations ?? 0,
    functions: rows[0]?.functions ?? 0,
    triggers: rows[0]?.triggers ?? 0,
    supportingConstraints: rows[0]?.supporting_constraints ?? 0,
  });
}

export async function detectV3StoryClaimRuntimeBindingV1(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const census = await objectCensus(sql);
  const total = census.relations + census.functions + census.triggers
    + census.supportingConstraints;
  if (total === 0) return "absent";
  if (census.relations === 2
    && census.functions === 1
    && census.triggers === 4
    && census.supportingConstraints === 2) return "present";
  return "partial";
}

async function verifyRelationShapeAndPrivileges(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    relation_name: string;
    owner_exact: boolean;
    acl_exact: boolean;
    column_acl_exact: boolean;
    relation_shape_exact: boolean;
    no_inheritance: boolean;
    no_row_policies: boolean;
    no_rewrite_rules: boolean;
  }>>(
    `WITH expected_owner AS (
       SELECT COALESCE(
         (
           SELECT journal.relowner
             FROM pg_class journal
             JOIN pg_namespace journal_namespace
               ON journal_namespace.oid = journal.relnamespace
            WHERE journal_namespace.nspname = 'public'
              AND journal.relname = 'setfarm_schema_migrations'
         ),
         (SELECT oid FROM pg_roles WHERE rolname = current_user)
       ) AS oid
     )
     SELECT relation.relname AS relation_name,
            relation.relowner = expected_owner.oid AS owner_exact,
            NOT EXISTS (
              (
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(COALESCE(
                    relation.relacl,
                    acldefault('r', relation.relowner)
                  ))
                EXCEPT
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(acldefault('r', relation.relowner))
              )
              UNION ALL
              (
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(acldefault('r', relation.relowner))
                EXCEPT
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(COALESCE(
                    relation.relacl,
                    acldefault('r', relation.relowner)
                  ))
              )
            ) AS acl_exact,
            NOT EXISTS (
              SELECT 1
                FROM pg_attribute attribute
               WHERE attribute.attrelid = relation.oid
                 AND attribute.attnum > 0
                 AND NOT attribute.attisdropped
                 AND attribute.attacl IS NOT NULL
            ) AS column_acl_exact,
            relation.relkind = 'r'
              AND relation.relpersistence = 'p'
              AND NOT relation.relispartition
              AND NOT relation.relrowsecurity
              AND NOT relation.relforcerowsecurity
              AS relation_shape_exact,
            NOT EXISTS (
              SELECT 1
                FROM pg_inherits inheritance
               WHERE inheritance.inhrelid = relation.oid
                  OR inheritance.inhparent = relation.oid
            ) AS no_inheritance,
            NOT EXISTS (
              SELECT 1 FROM pg_policy policy WHERE policy.polrelid = relation.oid
            ) AS no_row_policies,
            NOT EXISTS (
              SELECT 1 FROM pg_rewrite rewrite WHERE rewrite.ev_class = relation.oid
            ) AS no_rewrite_rules
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       CROSS JOIN expected_owner
      WHERE namespace.nspname = 'public'
        AND relation.relname = ANY($1::text[])
      ORDER BY relation.relname`,
    [[
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE,
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE,
    ]],
  );
  if (rows.length !== 2
    || rows.some((relation) => !relation.owner_exact
      || !relation.acl_exact
      || !relation.column_acl_exact
      || !relation.relation_shape_exact
      || !relation.no_inheritance
      || !relation.no_row_policies
      || !relation.no_rewrite_rules)) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding relation shape, owner, or ACL mismatch",
    );
  }
}

const expectedColumns = new Map<string, Readonly<{
  type: string;
  nullable: boolean;
}>>([
  ["claim_id", { type: "bigint", nullable: false }],
  ["runtime_session_id", { type: "text", nullable: false }],
  ["run_id", { type: "text", nullable: false }],
  ["step_db_id", { type: "text", nullable: false }],
  ["workflow_step_id", { type: "text", nullable: false }],
  ["subject_kind", { type: "text", nullable: false }],
  ["story_db_id", { type: "text", nullable: true }],
  ["story_id", { type: "text", nullable: true }],
  ["story_index", { type: "integer", nullable: true }],
  ["story_claim_generation", { type: "integer", nullable: true }],
  ["story_admission_receipt_hash", { type: "text", nullable: false }],
  ["story_admission_subject_hash", { type: "text", nullable: false }],
  ["bound_at", { type: "timestamp with time zone", nullable: false }],
]);

async function verifyColumns(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    type: string;
    not_null: boolean;
    default_expression: string | null;
    generated: string;
    identity: string;
  }>>(
    `SELECT attribute.attname AS name,
            format_type(attribute.atttypid, attribute.atttypmod) AS type,
            attribute.attnotnull AS not_null,
            pg_get_expr(default_record.adbin, default_record.adrelid) AS default_expression,
            attribute.attgenerated AS generated,
            attribute.attidentity AS identity
       FROM pg_attribute attribute
       JOIN pg_class relation ON relation.oid = attribute.attrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       LEFT JOIN pg_attrdef default_record
         ON default_record.adrelid = attribute.attrelid
        AND default_record.adnum = attribute.attnum
      WHERE namespace.nspname = 'public'
        AND relation.relname = $1
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY attribute.attnum`,
    [V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE],
  );
  if (rows.length !== expectedColumns.size) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding column census mismatch",
    );
  }
  for (const row of rows) {
    const expected = expectedColumns.get(row.name);
    if (!expected
      || row.type !== expected.type
      || row.not_null === expected.nullable
      || row.default_expression !== null
      || row.generated !== ""
      || row.identity !== "") {
      throw migrationError(
        "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
        `v3 story claim/runtime binding column mismatch: ${row.name}`,
      );
    }
  }
}

const expectedCutoverColumns = new Map<string, Readonly<{
  type: string;
  nullable: boolean;
}>>([
  ["cutover_id", { type: "text", nullable: false }],
  ["maximum_pre_cutover_claim_id", { type: "bigint", nullable: false }],
  ["cutover_at", { type: "timestamp with time zone", nullable: false }],
  ["historical_owner_count", { type: "bigint", nullable: false }],
  ["historical_owner_digest", { type: "text", nullable: false }],
]);

async function verifyCutoverColumns(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    type: string;
    not_null: boolean;
    default_expression: string | null;
    generated: string;
    identity: string;
  }>>(
    `SELECT attribute.attname AS name,
            format_type(attribute.atttypid, attribute.atttypmod) AS type,
            attribute.attnotnull AS not_null,
            pg_get_expr(default_record.adbin, default_record.adrelid) AS default_expression,
            attribute.attgenerated AS generated,
            attribute.attidentity AS identity
       FROM pg_attribute attribute
       JOIN pg_class relation ON relation.oid = attribute.attrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       LEFT JOIN pg_attrdef default_record
         ON default_record.adrelid = attribute.attrelid
        AND default_record.adnum = attribute.attnum
      WHERE namespace.nspname = 'public'
        AND relation.relname = $1
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY attribute.attnum`,
    [V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE],
  );
  if (rows.length !== expectedCutoverColumns.size
    || rows.some((row) => {
      const expected = expectedCutoverColumns.get(row.name);
      return !expected
        || row.type !== expected.type
        || row.not_null === expected.nullable
        || row.default_expression !== null
        || row.generated !== ""
        || row.identity !== "";
    })) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding cutover column census mismatch",
    );
  }
}

const expectedConstraints = new Map<string, Readonly<{
  type: "c" | "f" | "p" | "u";
  noInherit: boolean;
  definition: string;
}>>([
  [
    "v3_story_claim_runtime_bindings_v1_pkey",
    { type: "p", noInherit: true, definition: "primary key (claim_id)" },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_runtime_session_id_key",
    { type: "u", noInherit: true, definition: "unique (runtime_session_id)" },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_workflow_step_check",
    {
      type: "c",
      noInherit: false,
      definition: "check (workflow_step_id = any (array['implement'::text, 'supervise'::text]))",
    },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_subject_check",
    {
      type: "c",
      noInherit: false,
      definition: "check (subject_kind = 'story_member'::text and story_db_id is not null and story_id is not null and story_index is not null and story_claim_generation > 0 and (workflow_step_id = any (array['implement'::text, 'supervise'::text])) or subject_kind = 'final_product'::text and story_db_id is null and story_id is null and story_index is null and story_claim_generation is null and workflow_step_id = 'supervise'::text)",
    },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_receipt_hash_check",
    {
      type: "c",
      noInherit: false,
      definition: "check (story_admission_receipt_hash ~ '^[a-f0-9]{64}$'::text)",
    },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_subject_hash_check",
    {
      type: "c",
      noInherit: false,
      definition: "check (story_admission_subject_hash ~ '^[a-f0-9]{64}$'::text)",
    },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_run_fkey",
    {
      type: "f",
      noInherit: true,
      definition: "foreign key (run_id) references runs(id) on delete restrict",
    },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_claim_fkey",
    {
      type: "f",
      noInherit: true,
      definition: "foreign key (claim_id, run_id, workflow_step_id) references claim_log(id, run_id, step_id) on delete restrict",
    },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_runtime_fkey",
    {
      type: "f",
      noInherit: true,
      definition: "foreign key (runtime_session_id, claim_id, run_id) references runtime_sessions(session_id, claim_id, run_id) on delete restrict",
    },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_step_fkey",
    {
      type: "f",
      noInherit: true,
      definition: "foreign key (step_db_id, run_id, workflow_step_id) references steps(id, run_id, step_id) on delete restrict",
    },
  ],
  [
    "v3_story_claim_runtime_bindings_v1_story_fkey",
    {
      type: "f",
      noInherit: true,
      definition: "foreign key (story_db_id, run_id, story_id, story_index) references stories(id, run_id, story_id, story_index) on delete restrict",
    },
  ],
]);

async function verifyConstraintsAndIndexes(sql: Sql | TransactionSql): Promise<void> {
  const constraints = await sql.unsafe<Array<{
    name: string;
    type: string;
    validated: boolean;
    deferrable: boolean;
    deferred: boolean;
    no_inherit: boolean;
    definition: string;
  }>>(
    `SELECT constraint_record.conname AS name,
            constraint_record.contype AS type,
            constraint_record.convalidated AS validated,
            constraint_record.condeferrable AS deferrable,
            constraint_record.condeferred AS deferred,
            constraint_record.connoinherit AS no_inherit,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint constraint_record
      WHERE constraint_record.conrelid = $1::regclass
      ORDER BY constraint_record.conname`,
    [`public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}`],
  );
  if (constraints.length !== expectedConstraints.size) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding constraint census mismatch",
    );
  }
  for (const row of constraints) {
    const expected = expectedConstraints.get(row.name);
    if (!expected
      || row.type !== expected.type
      || !row.validated
      || row.deferrable
      || row.deferred
      || row.no_inherit !== expected.noInherit
      || normalizeSql(row.definition) !== expected.definition) {
      throw migrationError(
        "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
        `v3 story claim/runtime binding constraint mismatch: ${row.name}`,
      );
    }
  }
  const supporting = await sql.unsafe<Array<{
    name: string;
    relation_name: string;
    type: string;
    validated: boolean;
    deferrable: boolean;
    deferred: boolean;
    no_inherit: boolean;
    definition: string;
  }>>(
    `SELECT constraint_record.conname AS name,
            relation.relname AS relation_name,
            constraint_record.contype AS type,
            constraint_record.convalidated AS validated,
            constraint_record.condeferrable AS deferrable,
            constraint_record.condeferred AS deferred,
            constraint_record.connoinherit AS no_inherit,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint constraint_record
       JOIN pg_class relation ON relation.oid = constraint_record.conrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND constraint_record.conname = ANY($1::text[])
      ORDER BY constraint_record.conname`,
    [[
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_STEP_IDENTITY_CONSTRAINT,
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_STORY_IDENTITY_CONSTRAINT,
    ]],
  );
  const expectedSupporting = new Map<string, Readonly<{
    relation: string;
    definition: string;
  }>>([
    [
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_STEP_IDENTITY_CONSTRAINT,
      Object.freeze({ relation: "steps", definition: "unique (id, run_id, step_id)" }),
    ],
    [
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_STORY_IDENTITY_CONSTRAINT,
      Object.freeze({
        relation: "stories",
        definition: "unique (id, run_id, story_id, story_index)",
      }),
    ],
  ]);
  if (supporting.length !== expectedSupporting.size
    || supporting.some((row) => {
      const expected = expectedSupporting.get(row.name);
      return !expected
        || row.relation_name !== expected.relation
        || row.type !== "u"
        || !row.validated
        || row.deferrable
        || row.deferred
        || !row.no_inherit
        || normalizeSql(row.definition) !== expected.definition;
    })) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding supporting identity constraint mismatch",
    );
  }
  const indexes = await sql.unsafe<Array<{ name: string; definition: string }>>(
    `SELECT indexname AS name, indexdef AS definition
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = $1
      ORDER BY indexname`,
    [V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE],
  );
  const expectedIndexes = new Map([
    [
      "v3_story_claim_runtime_bindings_v1_pkey",
      "create unique index v3_story_claim_runtime_bindings_v1_pkey on public.v3_story_claim_runtime_bindings_v1 using btree (claim_id)",
    ],
    [
      "v3_story_claim_runtime_bindings_v1_runtime_session_id_key",
      "create unique index v3_story_claim_runtime_bindings_v1_runtime_session_id_key on public.v3_story_claim_runtime_bindings_v1 using btree (runtime_session_id)",
    ],
    [
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_SCOPE_INDEX,
      "create index idx_v3_story_claim_runtime_bindings_v1_scope on public.v3_story_claim_runtime_bindings_v1 using btree (run_id, workflow_step_id, subject_kind, story_db_id)",
    ],
  ]);
  if (indexes.length !== expectedIndexes.size
    || indexes.some((row) => normalizeSql(row.definition) !== expectedIndexes.get(row.name))) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding index census or definition mismatch",
    );
  }

  const cutoverConstraints = await sql.unsafe<Array<{
    name: string;
    type: string;
    validated: boolean;
    deferrable: boolean;
    deferred: boolean;
    no_inherit: boolean;
    definition: string;
  }>>(
    `SELECT constraint_record.conname AS name,
            constraint_record.contype AS type,
            constraint_record.convalidated AS validated,
            constraint_record.condeferrable AS deferrable,
            constraint_record.condeferred AS deferred,
            constraint_record.connoinherit AS no_inherit,
            pg_get_constraintdef(constraint_record.oid, true) AS definition
       FROM pg_constraint constraint_record
      WHERE constraint_record.conrelid = $1::regclass
      ORDER BY constraint_record.conname`,
    [`public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}`],
  );
  const expectedCutoverConstraints = new Map<string, Readonly<{
    type: "c" | "p";
    noInherit: boolean;
    definition: string;
  }>>([
    [
      "v3_story_claim_runtime_binding_cutovers_v1_pkey",
      { type: "p", noInherit: true, definition: "primary key (cutover_id)" },
    ],
    [
      "v3_story_claim_runtime_binding_cutovers_v1_identity_check",
      { type: "c", noInherit: false, definition: "check (cutover_id = 'v1'::text)" },
    ],
    [
      "v3_story_claim_runtime_binding_cutovers_v1_claim_id_check",
      {
        type: "c",
        noInherit: false,
        definition: "check (maximum_pre_cutover_claim_id >= 0)",
      },
    ],
    [
      "v3_story_claim_runtime_binding_cutovers_v1_owner_count_check",
      {
        type: "c",
        noInherit: false,
        definition: `check (historical_owner_count >= 0 and historical_owner_count <= ${MAX_HISTORICAL_OWNER_COUNT})`,
      },
    ],
    [
      "v3_story_claim_runtime_binding_cutovers_v1_digest_check",
      {
        type: "c",
        noInherit: false,
        definition: "check (historical_owner_digest ~ '^[a-f0-9]{64}$'::text)",
      },
    ],
  ]);
  if (cutoverConstraints.length !== expectedCutoverConstraints.size
    || cutoverConstraints.some((row) => {
      const expected = expectedCutoverConstraints.get(row.name);
      return !expected
        || row.type !== expected.type
        || !row.validated
        || row.deferrable
        || row.deferred
        || row.no_inherit !== expected.noInherit
        || normalizeSql(row.definition) !== expected.definition;
    })) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding cutover constraint census mismatch",
    );
  }
  const cutoverIndexes = await sql.unsafe<Array<{ name: string; definition: string }>>(
    `SELECT indexname AS name, indexdef AS definition
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = $1
      ORDER BY indexname`,
    [V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE],
  );
  if (cutoverIndexes.length !== 1
    || cutoverIndexes[0]?.name !== "v3_story_claim_runtime_binding_cutovers_v1_pkey"
    || normalizeSql(cutoverIndexes[0].definition)
      !== "create unique index v3_story_claim_runtime_binding_cutovers_v1_pkey on public.v3_story_claim_runtime_binding_cutovers_v1 using btree (cutover_id)") {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding cutover index census or definition mismatch",
    );
  }
}

async function verifyFunction(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    body: string;
    language: string;
    volatility: string;
    security_definer: boolean;
    configuration: string[] | null;
    public_execute: boolean;
    owner_exact: boolean;
    acl_exact: boolean;
    identity_arguments: string;
  }>>(
    `WITH expected_owner AS (
       SELECT COALESCE(
         (
           SELECT journal.relowner
             FROM pg_class journal
             JOIN pg_namespace journal_namespace
               ON journal_namespace.oid = journal.relnamespace
            WHERE journal_namespace.nspname = 'public'
              AND journal.relname = 'setfarm_schema_migrations'
         ),
         (SELECT oid FROM pg_roles WHERE rolname = current_user)
       ) AS oid
     )
     SELECT routine.prosrc AS body,
            language.lanname AS language,
            routine.provolatile AS volatility,
            routine.prosecdef AS security_definer,
            routine.proconfig AS configuration,
            has_function_privilege('public', routine.oid, 'EXECUTE') AS public_execute,
            routine.proowner = expected_owner.oid AS owner_exact,
            pg_get_function_identity_arguments(routine.oid) AS identity_arguments,
            (
              SELECT COUNT(*) = 1
                 AND COALESCE(BOOL_AND(
                   acl.grantor = routine.proowner
                   AND acl.grantee = routine.proowner
                   AND acl.privilege_type = 'EXECUTE'
                   AND NOT acl.is_grantable
                 ), FALSE)
                FROM aclexplode(COALESCE(
                  routine.proacl,
                  acldefault('f', routine.proowner)
                )) acl
            ) AS acl_exact
       FROM pg_proc routine
       JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
       JOIN pg_language language ON language.oid = routine.prolang
       CROSS JOIN expected_owner
      WHERE namespace.nspname = 'public'
        AND routine.proname = $1`,
    [V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION],
  );
  const routine = rows[0];
  if (rows.length !== 1
    || normalizeSql(routine?.body ?? "")
      !== normalizeSql(V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION_BODY)
    || routine?.language !== "plpgsql"
    || routine.volatility !== "v"
    || routine.security_definer
    || JSON.stringify(routine.configuration)
      !== JSON.stringify(["search_path=pg_catalog, public"])
    || routine.public_execute
    || !routine.owner_exact
    || !routine.acl_exact
    || routine.identity_arguments !== "") {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding guard function mismatch",
    );
  }
}

async function verifyTriggers(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    enabled: string;
    type_bits: number;
    function_name: string;
    function_schema: string;
    function_arguments: string;
    relation_name: string;
    deferrable: boolean;
    initially_deferred: boolean;
    has_when_clause: boolean;
  }>>(
    `SELECT trigger.tgname AS name,
            trigger.tgenabled AS enabled,
            trigger.tgtype::integer AS type_bits,
            routine.proname AS function_name,
            routine_namespace.nspname AS function_schema,
            pg_get_function_identity_arguments(routine.oid) AS function_arguments,
            relation.relname AS relation_name,
            trigger.tgdeferrable AS deferrable,
            trigger.tginitdeferred AS initially_deferred,
            trigger.tgqual IS NOT NULL AS has_when_clause
       FROM pg_trigger trigger
       JOIN pg_proc routine ON routine.oid = trigger.tgfoid
       JOIN pg_namespace routine_namespace
         ON routine_namespace.oid = routine.pronamespace
       JOIN pg_class relation ON relation.oid = trigger.tgrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE NOT trigger.tgisinternal
        AND (
          (namespace.nspname = 'public' AND relation.relname = ANY($1::text[]))
          OR trigger.tgname = ANY($2::text[])
          OR (
            routine_namespace.nspname = 'public'
            AND routine.proname = $3
          )
        )
      ORDER BY trigger.tgname`,
    [
      [
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE,
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE,
      ],
      [
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_ROW_TRIGGER,
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_TRUNCATE_TRIGGER,
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_ROW_TRIGGER,
        V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TRUNCATE_TRIGGER,
      ],
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION,
    ],
  );
  const expected = new Map<string, Readonly<{ bits: number; relation: string }>>([
    [
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_ROW_TRIGGER,
      { bits: 31, relation: V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE },
    ],
    [
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_TRUNCATE_TRIGGER,
      { bits: 34, relation: V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE },
    ],
    [
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_ROW_TRIGGER,
      { bits: 27, relation: V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE },
    ],
    [
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TRUNCATE_TRIGGER,
      { bits: 34, relation: V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE },
    ],
  ]);
  if (rows.length !== expected.size
    || rows.some((row) => row.enabled !== "O"
      || row.type_bits !== expected.get(row.name)?.bits
      || row.function_name !== V3_STORY_CLAIM_RUNTIME_BINDING_V1_FUNCTION
      || row.function_schema !== "public"
      || row.function_arguments !== ""
      || row.relation_name !== expected.get(row.name)?.relation
      || row.deferrable
      || row.initially_deferred
      || row.has_when_clause)) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_TOPOLOGY_INVALID",
      "v3 story claim/runtime binding external trigger census or definition mismatch",
    );
  }
}

type CutoverAuthority = Readonly<{
  maximumPreCutoverClaimId: string;
  cutoverAt: string;
  historicalOwnerCount: number;
  historicalOwnerDigest: string;
}>;

type HistoricalOwnerIdentity = Readonly<{
  claimId: string;
  claimClaimedAt: string;
  runId: string;
  workflowStepId: "implement" | "supervise";
  runtimeSessionId: string;
  runtimeCreatedAt: string;
}>;

function historicalOwnerDigest(owners: readonly HistoricalOwnerIdentity[]): string {
  return hashCanonicalJson({
    schema: "setfarm.v3-story-claim-runtime-binding-cutover-owner-census.v1",
    owners,
  });
}

const EXACT_UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u;

async function assertExactScopedOwnerCardinality(
  sql: Sql | TransactionSql,
): Promise<void> {
  const rows = await sql.unsafe<Array<{ invalid_count: string }>>(
    `SELECT COUNT(*)::text AS invalid_count
       FROM public.runs run
       JOIN public.claim_log claim ON claim.run_id = run.id
       LEFT JOIN public.runtime_sessions runtime ON runtime.claim_id = claim.id
      WHERE run.protocol = 'v3'
        AND claim.step_id IN ('implement', 'supervise')
        AND (
          (
            runtime.session_id IS NULL
            AND (
              claim.outcome IS NULL
              OR run.status NOT IN ('completed', 'failed', 'cancelled')
            )
          )
          OR
          (
            runtime.session_id IS NOT NULL
            AND (
              runtime.run_id IS DISTINCT FROM run.id
              OR runtime.workflow_step_id IS DISTINCT FROM claim.step_id
            )
          )
        )`,
  );
  const invalidCount = Number(rows[0]?.invalid_count);
  if (!Number.isSafeInteger(invalidCount) || invalidCount !== 0) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "migration 29 refuses an open or malformed v3 claim/runtime owner",
    );
  }
}

async function readHistoricalOwnerIdentities(
  sql: Sql | TransactionSql,
  boundary: Readonly<{ maximumPreCutoverClaimId: string; cutoverAt: string }>,
): Promise<readonly HistoricalOwnerIdentity[]> {
  await assertExactScopedOwnerCardinality(sql);
  const countRows = await sql.unsafe<Array<{ owner_count: string; invalid_count: string }>>(
    `WITH historical_owners AS (
       SELECT run.id AS run_id,
              run.status AS run_status,
              claim.id AS claim_id,
              claim.step_id AS workflow_step_id,
              claim.outcome AS claim_outcome,
              runtime.session_id AS runtime_session_id,
              runtime.state AS runtime_state,
              runtime.released_at AS runtime_released_at,
              octet_length(convert_to(run.id, 'UTF8')) AS run_id_bytes,
              octet_length(convert_to(runtime.session_id, 'UTF8')) AS runtime_session_id_bytes
         FROM public.runs run
         JOIN public.claim_log claim ON claim.run_id = run.id
         JOIN public.runtime_sessions runtime
           ON runtime.claim_id = claim.id
          AND runtime.run_id = run.id
          AND runtime.workflow_step_id = claim.step_id
        WHERE run.protocol = 'v3'
          AND claim.step_id IN ('implement', 'supervise')
          AND claim.id <= $1::bigint
          AND claim.claimed_at <= $2::timestamptz
          AND runtime.created_at <= $2::timestamptz
     )
     SELECT COUNT(*)::text AS owner_count,
            COUNT(*) FILTER (
              WHERE run_status NOT IN ('completed', 'failed', 'cancelled')
                 OR claim_outcome IS NULL
                 OR runtime_state <> 'released'
                 OR runtime_released_at IS NULL
                 OR run_id_bytes NOT BETWEEN 1 AND 2000
                 OR runtime_session_id_bytes NOT BETWEEN 20 AND 164
                 OR EXISTS (
                   SELECT 1
                     FROM public.runtime_completion_requests completion
                    WHERE completion.claim_id = historical_owners.claim_id
                      AND completion.runtime_session_id =
                            historical_owners.runtime_session_id
                      AND NOT (
                        (
                          completion.state = 'accepted'
                          AND completion.apply_phase = 'effects_committed'
                          AND completion.claim_outcome IS NOT DISTINCT FROM
                                historical_owners.claim_outcome
                          AND completion.claim_committed_at IS NOT NULL
                          AND completion.effects_committed_at IS NOT NULL
                          AND NOT EXISTS (
                            SELECT 1
                             FROM public.runtime_completion_effects effect
                             WHERE effect.request_id = completion.request_id
                               AND effect.mandatory
                               AND effect.state NOT IN ('applied', 'reconciled')
                          )
                        )
                        OR
                        (
                          completion.state IN ('rejected', 'quarantined')
                          AND completion.apply_phase IN ('proposed', 'executing')
                          AND completion.claim_committed_at IS NULL
                          AND completion.effects_committed_at IS NULL
                        )
                      )
                 )
            )::text AS invalid_count
       FROM historical_owners`,
    [boundary.maximumPreCutoverClaimId, boundary.cutoverAt],
  );
  const ownerCount = Number(countRows[0]?.owner_count);
  const invalidCount = Number(countRows[0]?.invalid_count);
  if (!Number.isSafeInteger(ownerCount)
    || ownerCount < 0
    || ownerCount > MAX_HISTORICAL_OWNER_COUNT
    || !Number.isSafeInteger(invalidCount)
    || invalidCount !== 0) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "migration 29 cutover requires bounded fully terminal historical v3 owners",
    );
  }

  const owners: HistoricalOwnerIdentity[] = [];
  let claimCursor = "0";
  let runtimeCursor = "";
  while (owners.length < ownerCount) {
    const rows = await sql.unsafe<Array<{
      claim_id: string;
      claim_claimed_at: string;
      run_id: string;
      workflow_step_id: "implement" | "supervise";
      runtime_session_id: string;
      runtime_created_at: string;
    }>>(
      `SELECT claim.id::text AS claim_id,
              to_char(
                claim.claimed_at AT TIME ZONE 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
              ) AS claim_claimed_at,
              run.id AS run_id,
              claim.step_id AS workflow_step_id,
              runtime.session_id AS runtime_session_id,
              to_char(
                runtime.created_at AT TIME ZONE 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
              ) AS runtime_created_at
         FROM public.runs run
         JOIN public.claim_log claim ON claim.run_id = run.id
         JOIN public.runtime_sessions runtime
           ON runtime.claim_id = claim.id
          AND runtime.run_id = run.id
          AND runtime.workflow_step_id = claim.step_id
        WHERE run.protocol = 'v3'
          AND claim.step_id IN ('implement', 'supervise')
          AND claim.id <= $1::bigint
          AND claim.claimed_at <= $2::timestamptz
          AND runtime.created_at <= $2::timestamptz
          AND (claim.id, runtime.session_id) > ($3::bigint, $4::text)
        ORDER BY claim.id, runtime.session_id
        LIMIT $5`,
      [
        boundary.maximumPreCutoverClaimId,
        boundary.cutoverAt,
        claimCursor,
        runtimeCursor,
        HISTORICAL_OWNER_PAGE_SIZE,
      ],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      if (!EXACT_UTC_TIMESTAMP_PATTERN.test(row.claim_claimed_at)
        || !EXACT_UTC_TIMESTAMP_PATTERN.test(row.runtime_created_at)) {
        throw migrationError(
          "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
          "migration 29 historical owner identity timestamp is invalid",
        );
      }
      owners.push(Object.freeze({
        claimId: row.claim_id,
        claimClaimedAt: row.claim_claimed_at,
        runId: row.run_id,
        workflowStepId: row.workflow_step_id,
        runtimeSessionId: row.runtime_session_id,
        runtimeCreatedAt: row.runtime_created_at,
      }));
    }
    const last = rows[rows.length - 1]!;
    claimCursor = last.claim_id;
    runtimeCursor = last.runtime_session_id;
  }
  if (owners.length !== ownerCount) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "migration 29 historical owner census changed during bounded audit",
    );
  }
  return Object.freeze(owners);
}

async function readCutoverAuthority(
  sql: Sql | TransactionSql,
): Promise<CutoverAuthority> {
  const rows = await sql.unsafe<Array<{
    cutover_id: string;
    maximum_pre_cutover_claim_id: string;
    cutover_at: string;
    historical_owner_count: string;
    historical_owner_digest: string;
  }>>(
    `SELECT cutover_id,
            maximum_pre_cutover_claim_id::text AS maximum_pre_cutover_claim_id,
            to_char(
              cutover_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ) AS cutover_at,
            historical_owner_count::text AS historical_owner_count,
            historical_owner_digest
       FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE}
      ORDER BY cutover_id
      LIMIT 2`,
  );
  const row = rows[0];
  const ownerCount = Number(row?.historical_owner_count);
  const cutoverAt = row?.cutover_at ?? "";
  if (rows.length !== 1
    || row?.cutover_id !== CUTOVER_AUTHORITY_ID
    || !/^(0|[1-9][0-9]*)$/.test(row.maximum_pre_cutover_claim_id)
    || !Number.isSafeInteger(ownerCount)
    || ownerCount < 0
    || ownerCount > MAX_HISTORICAL_OWNER_COUNT
    || !EXACT_UTC_TIMESTAMP_PATTERN.test(cutoverAt)
    || !/^[a-f0-9]{64}$/.test(row.historical_owner_digest)) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "migration 29 cutover authority is missing, ambiguous, or invalid",
    );
  }
  const authority = Object.freeze({
    maximumPreCutoverClaimId: row.maximum_pre_cutover_claim_id,
    cutoverAt,
    historicalOwnerCount: ownerCount,
    historicalOwnerDigest: row.historical_owner_digest,
  });
  const owners = await readHistoricalOwnerIdentities(sql, authority);
  if (owners.length !== authority.historicalOwnerCount
    || historicalOwnerDigest(owners) !== authority.historicalOwnerDigest) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "migration 29 historical owner cutover census changed",
    );
  }
  return authority;
}

export async function auditV3StoryClaimRuntimeBindingV1Data(
  sql: Sql | TransactionSql,
): Promise<Readonly<{ bindingCount: number; requiredOwnerCount: number }>> {
  const cutover = await readCutoverAuthority(sql);
  const rows = await sql.unsafe<Array<{
    binding_count: string;
    required_owner_count: string;
    missing_owner_count: string;
    invalid_binding_count: string;
  }>>(
    `WITH required_owners AS (
       SELECT claim.id AS claim_id,
              runtime.session_id AS runtime_session_id
         FROM public.runs run
         JOIN public.claim_log claim ON claim.run_id = run.id
         JOIN public.runtime_sessions runtime
           ON runtime.claim_id = claim.id
          AND runtime.run_id = run.id
          AND runtime.workflow_step_id = claim.step_id
        WHERE run.protocol = 'v3'
          AND claim.step_id IN ('implement', 'supervise')
          AND NOT (
            claim.id <= $1::bigint
            AND claim.claimed_at <= $2::timestamptz
            AND runtime.created_at <= $2::timestamptz
          )
     ), invalid_bindings AS (
       SELECT binding.claim_id
         FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE} binding
         LEFT JOIN public.runs run ON run.id = binding.run_id
         LEFT JOIN public.claim_log claim
           ON claim.id = binding.claim_id
          AND claim.run_id = binding.run_id
          AND claim.step_id = binding.workflow_step_id
         LEFT JOIN public.runtime_sessions runtime
           ON runtime.session_id = binding.runtime_session_id
          AND runtime.claim_id = binding.claim_id
          AND runtime.run_id = binding.run_id
         LEFT JOIN public.steps step
           ON step.id = binding.step_db_id
          AND step.run_id = binding.run_id
          AND step.step_id = binding.workflow_step_id
        WHERE run.protocol IS DISTINCT FROM 'v3'
           OR claim.id IS NULL
           OR runtime.session_id IS NULL
           OR runtime.step_db_id IS DISTINCT FROM binding.step_db_id
           OR runtime.workflow_step_id IS DISTINCT FROM binding.workflow_step_id
           OR step.id IS NULL
           OR binding.bound_at IS DISTINCT FROM claim.claimed_at
           OR (
             claim.id <= $1::bigint
             AND claim.claimed_at <= $2::timestamptz
             AND runtime.created_at <= $2::timestamptz
           )
           OR (
             binding.workflow_step_id = 'implement'
             AND (
               binding.subject_kind IS DISTINCT FROM 'story_member'
               OR claim.story_id IS DISTINCT FROM binding.story_id
               OR runtime.story_db_id IS DISTINCT FROM binding.story_db_id
               OR runtime.story_id IS DISTINCT FROM binding.story_id
             )
           )
           OR (
             binding.workflow_step_id = 'supervise'
             AND (
               claim.story_id IS NOT NULL
               OR runtime.story_db_id IS NOT NULL
               OR runtime.story_id IS NOT NULL
             )
           )
     )
     SELECT
       (SELECT COUNT(*)::text
          FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE}) AS binding_count,
       (SELECT COUNT(*)::text FROM required_owners) AS required_owner_count,
       (SELECT COUNT(*)::text
          FROM required_owners owner_record
         WHERE NOT EXISTS (
           SELECT 1
             FROM public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE} binding
            WHERE binding.claim_id = owner_record.claim_id
              AND binding.runtime_session_id = owner_record.runtime_session_id
         )) AS missing_owner_count,
       (SELECT COUNT(*)::text FROM invalid_bindings) AS invalid_binding_count`,
    [cutover.maximumPreCutoverClaimId, cutover.cutoverAt],
  );
  const bindingCount = Number(rows[0]?.binding_count);
  const requiredOwnerCount = Number(rows[0]?.required_owner_count);
  const missingOwnerCount = Number(rows[0]?.missing_owner_count);
  const invalidBindingCount = Number(rows[0]?.invalid_binding_count);
  if (![bindingCount, requiredOwnerCount, missingOwnerCount, invalidBindingCount].every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  ) || bindingCount !== requiredOwnerCount
    || missingOwnerCount !== 0
    || invalidBindingCount !== 0) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "v3 story claim/runtime binding census is incomplete, ambiguous, or invalid",
    );
  }
  return Object.freeze({ bindingCount, requiredOwnerCount });
}

export async function verifyV3StoryClaimRuntimeBindingV1(
  sql: Sql | TransactionSql,
  options: Readonly<{ requireEmpty?: boolean }> = {},
): Promise<void> {
  if (await verifyCanonicalBaseRelationsForV29(sql) !== "present") {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_PARTIAL",
      "canonical steps and stories relations are absent from migration 29",
    );
  }
  if (await detectV3StoryClaimRuntimeBindingV1(sql) !== "present") {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_PARTIAL",
      "v3 story claim/runtime binding topology is not fully installed",
    );
  }
  await verifyRelationShapeAndPrivileges(sql);
  await verifyColumns(sql);
  await verifyCutoverColumns(sql);
  await verifyConstraintsAndIndexes(sql);
  await verifyFunction(sql);
  await verifyTriggers(sql);
  const audit = await auditV3StoryClaimRuntimeBindingV1Data(sql);
  if (options.requireEmpty && audit.bindingCount !== 0) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "v3 story claim/runtime binding adoption requires an empty authority relation",
    );
  }
}

async function lockAuthorityTables(sql: TransactionSql): Promise<void> {
  await sql.unsafe(
    `LOCK TABLE public.runs,
                public.claim_log,
                public.runtime_sessions,
                public.runtime_completion_requests,
                public.runtime_completion_effects
       IN ACCESS EXCLUSIVE MODE`,
  );
  const base = await canonicalBaseRelationCensus(sql);
  if (base.steps) {
    await sql.unsafe("LOCK TABLE public.steps IN ACCESS EXCLUSIVE MODE");
  }
  if (base.stories) {
    await sql.unsafe("LOCK TABLE public.stories IN ACCESS EXCLUSIVE MODE");
  }
  if (await detectV3StoryClaimRuntimeBindingV1(sql) !== "absent") {
    const relationNames = [
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE,
      V3_STORY_CLAIM_RUNTIME_BINDING_V1_TABLE,
    ] as const;
    for (const relationName of relationNames) {
      const relationRows = await sql.unsafe<Array<{ relation_name: string | null }>>(
        "SELECT to_regclass($1)::text AS relation_name",
        [`public.${relationName}`],
      );
      if (relationRows[0]?.relation_name) {
        await sql.unsafe(
          `LOCK TABLE public.${relationName}
             IN ACCESS EXCLUSIVE MODE`,
        );
      }
    }
  }
}

async function deriveCutoverAuthority(
  sql: TransactionSql,
): Promise<CutoverAuthority> {
  const boundaryRows = await sql.unsafe<Array<{
    maximum_pre_cutover_claim_id: string;
    cutover_at: string;
  }>>(
    `SELECT COALESCE(MAX(id), 0)::text AS maximum_pre_cutover_claim_id,
            to_char(
              clock_timestamp() AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ) AS cutover_at
       FROM public.claim_log`,
  );
  const boundary = boundaryRows[0];
  const cutoverAt = boundary?.cutover_at ?? "";
  if (!boundary
    || !/^(0|[1-9][0-9]*)$/.test(boundary.maximum_pre_cutover_claim_id)
    || !EXACT_UTC_TIMESTAMP_PATTERN.test(cutoverAt)) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "migration 29 could not derive an exact database cutover boundary",
    );
  }
  const cutoverBoundary = Object.freeze({
    maximumPreCutoverClaimId: boundary.maximum_pre_cutover_claim_id,
    cutoverAt,
  });
  const owners = await readHistoricalOwnerIdentities(sql, cutoverBoundary);
  const totalRows = await sql.unsafe<Array<{ owner_count: string }>>(
    `SELECT COUNT(*)::text AS owner_count
       FROM public.runs run
       JOIN public.claim_log claim ON claim.run_id = run.id
       JOIN public.runtime_sessions runtime
         ON runtime.claim_id = claim.id
        AND runtime.run_id = run.id
        AND runtime.workflow_step_id = claim.step_id
      WHERE run.protocol = 'v3'
        AND claim.step_id IN ('implement', 'supervise')`,
  );
  const totalOwnerCount = Number(totalRows[0]?.owner_count);
  if (!Number.isSafeInteger(totalOwnerCount)
    || totalOwnerCount < 0
    || totalOwnerCount > MAX_HISTORICAL_OWNER_COUNT
    || totalOwnerCount !== owners.length) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "migration 29 refuses an existing v3 owner outside the exact cutover boundary",
    );
  }
  return Object.freeze({
    ...cutoverBoundary,
    historicalOwnerCount: owners.length,
    historicalOwnerDigest: historicalOwnerDigest(owners),
  });
}

export async function applyV3StoryClaimRuntimeBindingV1(
  sql: TransactionSql,
): Promise<"created" | "adopted"> {
  await lockAuthorityTables(sql);
  const baseState = await verifyCanonicalBaseRelationsForV29(sql);
  const state = await detectV3StoryClaimRuntimeBindingV1(sql);
  if (state === "partial") {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_PARTIAL",
      "v3 story claim/runtime binding topology is partially installed",
    );
  }
  if (state === "present") {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_DATA_INVALID",
      "migration 29 refuses unjournaled preinstalled cutover authority",
    );
  }
  const cutover = await deriveCutoverAuthority(sql);
  try {
    for (const statement of V3_STORY_CLAIM_RUNTIME_BINDING_V1_STATEMENTS) {
      await sql.unsafe(statement);
    }
    await sql.unsafe(
      `INSERT INTO public.${V3_STORY_CLAIM_RUNTIME_BINDING_V1_CUTOVER_TABLE} (
         cutover_id, maximum_pre_cutover_claim_id, cutover_at,
         historical_owner_count, historical_owner_digest
       ) VALUES ($1, $2::bigint, $3::timestamptz, $4::bigint, $5)`,
      [
        CUTOVER_AUTHORITY_ID,
        cutover.maximumPreCutoverClaimId,
        cutover.cutoverAt,
        cutover.historicalOwnerCount,
        cutover.historicalOwnerDigest,
      ],
    );
  } catch (cause) {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_SQL_FAILED",
      "v3 story claim/runtime binding installation failed",
      cause,
    );
  }
  if (await verifyCanonicalBaseRelationsForV29(sql) !== "present") {
    throw migrationError(
      "V3_STORY_CLAIM_RUNTIME_BINDING_PARTIAL",
      "migration 29 did not install exact operational base relations",
    );
  }
  await verifyV3StoryClaimRuntimeBindingV1(sql);
  return "created";
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v29-v3-story-claim-runtime-binding:END
