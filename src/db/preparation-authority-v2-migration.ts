import type postgres from "postgres";

import {
  V3_PREPARATION_CLAIM_AUTHORITY_V2_MAX_CANONICAL_BYTES,
  V3PreparationClaimAuthorityV2Schema,
} from "../execution/v3-preparation-claim-authority-v2.js";
import { ContractSpineMigrationError } from "./contract-spine-migrations.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const AUTHORITY_TABLE = "v3_preparation_authorities_v2";
const CLAIM_TABLE = "v3_preparation_authority_claims_v2";
const ATTEMPT_TABLE = "v3_preparation_authority_attempts_v2";

// JSONB text includes separators which canonical JSON omits. Leave a bounded
// envelope margin while the application contract remains capped at 4 MiB.
export const V3_PREPARATION_AUTHORITY_V2_DATABASE_MAX_BYTES =
  V3_PREPARATION_CLAIM_AUTHORITY_V2_MAX_CANONICAL_BYTES + (512 * 1024);

const AUTHORITY_IMMUTABILITY_BODY_SQL = `
  BEGIN
    IF TG_OP = 'TRUNCATE' THEN
      IF EXISTS (SELECT 1 FROM public.v3_preparation_authorities_v2 LIMIT 1) THEN
        RAISE EXCEPTION 'V3_PREPARATION_AUTHORITY_V2_IMMUTABLE'
          USING ERRCODE = '23514';
      END IF;
      RETURN NULL;
    END IF;
    IF TG_OP <> 'INSERT' THEN
      RAISE EXCEPTION 'V3_PREPARATION_AUTHORITY_V2_IMMUTABLE'
        USING ERRCODE = '23514';
    END IF;
    NEW.created_at := clock_timestamp();
    RETURN NEW;
  END;
`;

const CLAIM_BINDING_BODY_SQL = `
  DECLARE
    authority_row RECORD;
    claim_row RECORD;
  BEGIN
    IF TG_OP = 'TRUNCATE' THEN
      IF EXISTS (SELECT 1 FROM public.v3_preparation_authority_claims_v2 LIMIT 1) THEN
        RAISE EXCEPTION 'V3_PREPARATION_AUTHORITY_CLAIM_V2_IMMUTABLE'
          USING ERRCODE = '23514';
      END IF;
      RETURN NULL;
    END IF;
    IF TG_OP <> 'INSERT' THEN
      RAISE EXCEPTION 'V3_PREPARATION_AUTHORITY_CLAIM_V2_IMMUTABLE'
        USING ERRCODE = '23514';
    END IF;

    SELECT run_id, step_id, story_id
      INTO authority_row
      FROM public.v3_preparation_authorities_v2
     WHERE authority_hash = NEW.authority_hash
     FOR KEY SHARE;
    SELECT run_id, step_id, COALESCE(story_id, '') AS story_id, outcome
      INTO claim_row
      FROM public.claim_log
     WHERE id = NEW.claim_id
     FOR UPDATE;
    IF NOT FOUND
       OR authority_row.run_id IS DISTINCT FROM claim_row.run_id
       OR authority_row.step_id IS DISTINCT FROM claim_row.step_id
       OR authority_row.story_id IS DISTINCT FROM claim_row.story_id
       OR claim_row.outcome IS NOT NULL THEN
      RAISE EXCEPTION 'V3_PREPARATION_AUTHORITY_CLAIM_V2_IDENTITY_MISMATCH'
        USING ERRCODE = '23514';
    END IF;
    NEW.claimed_at := clock_timestamp();
    RETURN NEW;
  END;
`;

const BOUND_CLAIM_IDENTITY_BODY_SQL = `
  BEGIN
    IF EXISTS (
      SELECT 1
        FROM public.v3_preparation_authority_claims_v2 binding
       WHERE binding.claim_id = OLD.id
    ) THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'V3_PREPARATION_BOUND_CLAIM_V2_IMMUTABLE'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.run_id IS DISTINCT FROM OLD.run_id
         OR NEW.step_id IS DISTINCT FROM OLD.step_id
         OR NEW.story_id IS DISTINCT FROM OLD.story_id
         OR NEW.agent_id IS DISTINCT FROM OLD.agent_id
         OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
        RAISE EXCEPTION 'V3_PREPARATION_BOUND_CLAIM_V2_IDENTITY_IMMUTABLE'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END;
`;

const ATTEMPT_BINDING_BODY_SQL = `
  DECLARE
    authority_row RECORD;
    claim_row RECORD;
    live_claim_row RECORD;
    attempt_row RECORD;
  BEGIN
    IF TG_OP = 'TRUNCATE' THEN
      IF EXISTS (SELECT 1 FROM public.v3_preparation_authority_attempts_v2 LIMIT 1) THEN
        RAISE EXCEPTION 'V3_PREPARATION_AUTHORITY_ATTEMPT_V2_IMMUTABLE'
          USING ERRCODE = '23514';
      END IF;
      RETURN NULL;
    END IF;
    IF TG_OP <> 'INSERT' THEN
      RAISE EXCEPTION 'V3_PREPARATION_AUTHORITY_ATTEMPT_V2_IMMUTABLE'
        USING ERRCODE = '23514';
    END IF;

    SELECT run_id, step_id, story_id, packet_hash, compilation_report_hash,
           base_source_sha, base_source_tree_hash
      INTO authority_row
      FROM public.v3_preparation_authorities_v2
     WHERE authority_hash = NEW.authority_hash
     FOR KEY SHARE;
    SELECT claim_id
      INTO claim_row
      FROM public.v3_preparation_authority_claims_v2
     WHERE authority_hash = NEW.authority_hash
       AND claim_id = NEW.claim_id
     FOR KEY SHARE;
    SELECT claim_id, run_id, step_id, story_id, packet_hash,
           compilation_report_hash, slice_hash, source_before_sha,
           source_before_tree_hash, attempt_class, role, disposition,
           recovery_case_revision_id, recovery_dispatch_id, agent_id
      INTO attempt_row
      FROM public.execution_attempts
     WHERE attempt_id = NEW.attempt_id
       AND claim_id = NEW.claim_id
     FOR UPDATE;
    SELECT outcome, agent_id
      INTO live_claim_row
      FROM public.claim_log
     WHERE id = NEW.claim_id
     FOR UPDATE;
    IF NOT FOUND
       OR claim_row.claim_id IS DISTINCT FROM NEW.claim_id
       OR live_claim_row.outcome IS NOT NULL
       OR attempt_row.run_id IS DISTINCT FROM authority_row.run_id
       OR attempt_row.step_id IS DISTINCT FROM authority_row.step_id
       OR attempt_row.story_id IS DISTINCT FROM authority_row.story_id
       OR attempt_row.packet_hash IS DISTINCT FROM authority_row.packet_hash
       OR attempt_row.compilation_report_hash IS DISTINCT FROM authority_row.compilation_report_hash
       OR attempt_row.slice_hash IS DISTINCT FROM NEW.slice_hash
       OR attempt_row.source_before_sha IS DISTINCT FROM authority_row.base_source_sha
       OR attempt_row.source_before_tree_hash IS DISTINCT FROM authority_row.base_source_tree_hash
       OR attempt_row.attempt_class IS DISTINCT FROM 'product_implementation'
       OR attempt_row.role IS DISTINCT FROM 'developer'
       OR attempt_row.agent_id IS DISTINCT FROM live_claim_row.agent_id
       OR attempt_row.disposition NOT IN ('claimed', 'running')
       OR attempt_row.recovery_case_revision_id IS NOT NULL
       OR attempt_row.recovery_dispatch_id IS NOT NULL THEN
      RAISE EXCEPTION 'V3_PREPARATION_AUTHORITY_ATTEMPT_V2_IDENTITY_MISMATCH'
        USING ERRCODE = '23514';
    END IF;
    NEW.reserved_at := clock_timestamp();
    RETURN NEW;
  END;
`;

const BOUND_ATTEMPT_IDENTITY_BODY_SQL = `
  BEGIN
    IF EXISTS (
      SELECT 1
        FROM public.v3_preparation_authority_attempts_v2 binding
       WHERE binding.attempt_id = OLD.attempt_id
    ) THEN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'V3_PREPARATION_BOUND_ATTEMPT_V2_IMMUTABLE'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
         OR NEW.claim_id IS DISTINCT FROM OLD.claim_id
         OR NEW.run_id IS DISTINCT FROM OLD.run_id
         OR NEW.step_id IS DISTINCT FROM OLD.step_id
         OR NEW.story_id IS DISTINCT FROM OLD.story_id
         OR NEW.generation IS DISTINCT FROM OLD.generation
         OR NEW.fence_token IS DISTINCT FROM OLD.fence_token
         OR NEW.attempt_class IS DISTINCT FROM OLD.attempt_class
         OR NEW.packet_hash IS DISTINCT FROM OLD.packet_hash
         OR NEW.compilation_report_hash IS DISTINCT FROM OLD.compilation_report_hash
         OR NEW.slice_hash IS DISTINCT FROM OLD.slice_hash
         OR NEW.source_before_sha IS DISTINCT FROM OLD.source_before_sha
         OR NEW.source_before_tree_hash IS DISTINCT FROM OLD.source_before_tree_hash
         OR NEW.finding_set_hash IS DISTINCT FROM OLD.finding_set_hash
         OR NEW.dedupe_key IS DISTINCT FROM OLD.dedupe_key
         OR NEW.recovery_case_revision_id IS DISTINCT FROM OLD.recovery_case_revision_id
         OR NEW.recovery_dispatch_id IS DISTINCT FROM OLD.recovery_dispatch_id
         OR NEW.role IS DISTINCT FROM OLD.role
         OR NEW.agent_id IS DISTINCT FROM OLD.agent_id
         OR NEW.branch IS DISTINCT FROM OLD.branch
         OR NEW.worktree IS DISTINCT FROM OLD.worktree
         OR NEW.lease_acquired_at IS DISTINCT FROM OLD.lease_acquired_at
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'V3_PREPARATION_BOUND_ATTEMPT_V2_IDENTITY_IMMUTABLE'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END;
`;

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v25-preparation-authority-ledger:BEGIN
export const PREPARATION_AUTHORITY_V2_LEDGER_STATEMENTS = [
  `CREATE TABLE ${AUTHORITY_TABLE} (
     authority_hash TEXT COLLATE "C" PRIMARY KEY,
     authority_schema TEXT COLLATE "C" NOT NULL,
     authority_version SMALLINT NOT NULL,
     packet_schema TEXT COLLATE "C" NOT NULL,
     run_id TEXT COLLATE "C" NOT NULL,
     step_id TEXT COLLATE "C" NOT NULL,
     story_id TEXT COLLATE "C" NOT NULL,
     state_version INTEGER NOT NULL,
     packet_hash TEXT COLLATE "C" NOT NULL,
     compilation_report_hash TEXT COLLATE "C" NOT NULL,
     base_source_sha TEXT COLLATE "C" NOT NULL,
     base_source_tree_hash TEXT COLLATE "C" NOT NULL,
     authority_payload JSONB NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT v3_prep_authorities_v2_identity_key
       UNIQUE (run_id, step_id, story_id, state_version),
     CONSTRAINT v3_prep_authorities_v2_packet_fkey
       FOREIGN KEY (run_id, packet_hash)
       REFERENCES product_packets(run_id, packet_hash) ON DELETE RESTRICT,
     CONSTRAINT v3_prep_authorities_v2_schema_check
       CHECK (
         authority_schema = 'setfarm.v3-preparation-claim-authority.v2'
         AND authority_version = 2
         AND packet_schema = 'setfarm.product-build-packet.v3'
       ),
     CONSTRAINT v3_prep_authorities_v2_hash_check
       CHECK (
         authority_hash ~ '^[a-f0-9]{64}$'
         AND packet_hash ~ '^[a-f0-9]{64}$'
         AND compilation_report_hash ~ '^[a-f0-9]{64}$'
       ),
     CONSTRAINT v3_prep_authorities_v2_source_check
       CHECK (
         base_source_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'
         AND base_source_tree_hash ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'
       ),
     CONSTRAINT v3_prep_authorities_v2_identity_check
       CHECK (
         state_version > 0
         AND octet_length(convert_to(run_id, 'UTF8')) BETWEEN 1 AND 500
         AND octet_length(convert_to(step_id, 'UTF8')) BETWEEN 1 AND 500
         AND octet_length(convert_to(story_id, 'UTF8')) BETWEEN 1 AND 500
       ),
     CONSTRAINT v3_prep_authorities_v2_payload_check
       CHECK ((
         jsonb_typeof(authority_payload) = 'object'
         AND authority_payload ?& ARRAY[
           'authorityHash', 'schema', 'authorityVersion', 'packetSchema',
           'stateVersion', 'runId', 'stepId', 'storyId', 'packetHash',
           'compilationReportHash', 'baseRevision', 'projectedDependencyIds',
           'dependencyAttempts'
         ]
         AND authority_payload - ARRAY[
           'authorityHash', 'schema', 'authorityVersion', 'packetSchema',
           'stateVersion', 'runId', 'stepId', 'storyId', 'packetHash',
           'compilationReportHash', 'baseRevision', 'projectedDependencyIds',
           'dependencyAttempts'
         ] = '{}'::jsonb
         AND octet_length(convert_to(authority_payload::text, 'UTF8'))
           <= ${V3_PREPARATION_AUTHORITY_V2_DATABASE_MAX_BYTES}
         AND jsonb_typeof(authority_payload -> 'authorityHash') = 'string'
         AND jsonb_typeof(authority_payload -> 'schema') = 'string'
         AND jsonb_typeof(authority_payload -> 'authorityVersion') = 'number'
         AND jsonb_typeof(authority_payload -> 'packetSchema') = 'string'
         AND jsonb_typeof(authority_payload -> 'stateVersion') = 'number'
         AND jsonb_typeof(authority_payload -> 'runId') = 'string'
         AND jsonb_typeof(authority_payload -> 'stepId') = 'string'
         AND jsonb_typeof(authority_payload -> 'storyId') = 'string'
         AND jsonb_typeof(authority_payload -> 'packetHash') = 'string'
         AND jsonb_typeof(authority_payload -> 'compilationReportHash') = 'string'
         AND jsonb_typeof(authority_payload -> 'baseRevision') = 'object'
         AND authority_payload -> 'baseRevision' ?& ARRAY['sha', 'treeHash']
         AND (authority_payload -> 'baseRevision') - ARRAY['sha', 'treeHash'] = '{}'::jsonb
         AND jsonb_typeof(authority_payload #> '{baseRevision,sha}') = 'string'
         AND jsonb_typeof(authority_payload #> '{baseRevision,treeHash}') = 'string'
         AND authority_payload ->> 'authorityHash' = authority_hash
         AND authority_payload ->> 'schema' = authority_schema
         AND (authority_payload ->> 'authorityVersion')::integer = authority_version
         AND authority_payload ->> 'packetSchema' = packet_schema
         AND authority_payload ->> 'runId' = run_id
         AND authority_payload ->> 'stepId' = step_id
         AND authority_payload ->> 'storyId' = story_id
         AND (authority_payload ->> 'stateVersion')::integer = state_version
         AND authority_payload ->> 'packetHash' = packet_hash
         AND authority_payload ->> 'compilationReportHash' = compilation_report_hash
         AND authority_payload #>> '{baseRevision,sha}' = base_source_sha
         AND authority_payload #>> '{baseRevision,treeHash}' = base_source_tree_hash
         AND jsonb_typeof(authority_payload -> 'projectedDependencyIds') = 'array'
         AND jsonb_typeof(authority_payload -> 'dependencyAttempts') = 'array'
       ) IS TRUE)
   )`,
  `CREATE FUNCTION setfarm_enforce_v3_preparation_authority_v2_immutable()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${AUTHORITY_IMMUTABILITY_BODY_SQL}$$`,
  `CREATE TRIGGER trg_v3_preparation_authorities_v2_immutable
   BEFORE INSERT OR UPDATE OR DELETE ON ${AUTHORITY_TABLE}
   FOR EACH ROW
   EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_v2_immutable()`,
  `CREATE TRIGGER trg_v3_preparation_authorities_v2_no_truncate
   BEFORE TRUNCATE ON ${AUTHORITY_TABLE}
   FOR EACH STATEMENT
   EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_v2_immutable()`,
  `CREATE TABLE ${CLAIM_TABLE} (
     authority_hash TEXT COLLATE "C" PRIMARY KEY,
     claim_id BIGINT NOT NULL,
     claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT v3_prep_authority_claims_v2_claim_key UNIQUE (claim_id),
     CONSTRAINT v3_prep_authority_claims_v2_pair_key UNIQUE (authority_hash, claim_id),
     CONSTRAINT v3_prep_authority_claims_v2_auth_fkey
       FOREIGN KEY (authority_hash) REFERENCES ${AUTHORITY_TABLE}(authority_hash)
       ON DELETE RESTRICT,
     CONSTRAINT v3_prep_authority_claims_v2_claim_fkey
       FOREIGN KEY (claim_id) REFERENCES claim_log(id) ON DELETE RESTRICT
   )`,
  `CREATE FUNCTION setfarm_enforce_v3_preparation_authority_claim_v2()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${CLAIM_BINDING_BODY_SQL}$$`,
  `CREATE TRIGGER trg_v3_preparation_authority_claims_v2_binding
   BEFORE INSERT OR UPDATE OR DELETE ON ${CLAIM_TABLE}
   FOR EACH ROW
   EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_claim_v2()`,
  `CREATE TRIGGER trg_v3_preparation_authority_claims_v2_no_truncate
   BEFORE TRUNCATE ON ${CLAIM_TABLE}
   FOR EACH STATEMENT
   EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_claim_v2()`,
  `CREATE FUNCTION setfarm_enforce_v3_preparation_bound_claim_v2()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${BOUND_CLAIM_IDENTITY_BODY_SQL}$$`,
  `CREATE TRIGGER trg_claim_log_v3_preparation_v2_identity
   BEFORE UPDATE OR DELETE ON claim_log
   FOR EACH ROW
   EXECUTE FUNCTION setfarm_enforce_v3_preparation_bound_claim_v2()`,
  `CREATE TABLE ${ATTEMPT_TABLE} (
     authority_hash TEXT COLLATE "C" PRIMARY KEY,
     claim_id BIGINT NOT NULL,
     attempt_id TEXT COLLATE "C" NOT NULL,
     slice_hash TEXT COLLATE "C" NOT NULL,
     reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT v3_prep_authority_attempts_v2_claim_key UNIQUE (claim_id),
     CONSTRAINT v3_prep_authority_attempts_v2_attempt_key UNIQUE (attempt_id),
     CONSTRAINT v3_prep_authority_attempts_v2_claim_fkey
       FOREIGN KEY (authority_hash, claim_id)
       REFERENCES ${CLAIM_TABLE}(authority_hash, claim_id) ON DELETE RESTRICT,
     CONSTRAINT v3_prep_authority_attempts_v2_attempt_fkey
       FOREIGN KEY (attempt_id, claim_id)
       REFERENCES execution_attempts(attempt_id, claim_id) ON DELETE RESTRICT,
     CONSTRAINT v3_prep_authority_attempts_v2_slice_check
       CHECK (slice_hash ~ '^[a-f0-9]{64}$')
   )`,
  `CREATE FUNCTION setfarm_enforce_v3_preparation_authority_attempt_v2()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${ATTEMPT_BINDING_BODY_SQL}$$`,
  `CREATE TRIGGER trg_v3_preparation_authority_attempts_v2_binding
   BEFORE INSERT OR UPDATE OR DELETE ON ${ATTEMPT_TABLE}
   FOR EACH ROW
   EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_attempt_v2()`,
  `CREATE TRIGGER trg_v3_preparation_authority_attempts_v2_no_truncate
   BEFORE TRUNCATE ON ${ATTEMPT_TABLE}
   FOR EACH STATEMENT
   EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_attempt_v2()`,
  `CREATE FUNCTION setfarm_enforce_v3_preparation_bound_attempt_v2()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${BOUND_ATTEMPT_IDENTITY_BODY_SQL}$$`,
  `CREATE TRIGGER trg_execution_attempts_v3_preparation_v2_identity
   BEFORE UPDATE OR DELETE ON execution_attempts
   FOR EACH ROW
   EXECUTE FUNCTION setfarm_enforce_v3_preparation_bound_attempt_v2()`,
] as const;

type ExpectedColumn = Readonly<{
  dataType: string;
  nullable: "YES" | "NO";
  defaultValue: string;
  collationSchema: string | null;
  collationName: string | null;
}>;

const cText = (nullable: "YES" | "NO" = "NO"): ExpectedColumn => ({
  dataType: "text",
  nullable,
  defaultValue: "",
  collationSchema: "pg_catalog",
  collationName: "C",
});
const scalar = (
  dataType: string,
  nullable: "YES" | "NO" = "NO",
  defaultValue = "",
): ExpectedColumn => ({
  dataType,
  nullable,
  defaultValue,
  collationSchema: null,
  collationName: null,
});

const EXPECTED_COLUMNS = new Map<string, ReadonlyMap<string, ExpectedColumn>>([
  [AUTHORITY_TABLE, new Map([
    ["authority_hash", cText()],
    ["authority_schema", cText()],
    ["authority_version", scalar("smallint")],
    ["packet_schema", cText()],
    ["run_id", cText()],
    ["step_id", cText()],
    ["story_id", cText()],
    ["state_version", scalar("integer")],
    ["packet_hash", cText()],
    ["compilation_report_hash", cText()],
    ["base_source_sha", cText()],
    ["base_source_tree_hash", cText()],
    ["authority_payload", scalar("jsonb")],
    ["created_at", scalar("timestamp with time zone", "NO", "now()")],
  ])],
  [CLAIM_TABLE, new Map([
    ["authority_hash", cText()],
    ["claim_id", scalar("bigint")],
    ["claimed_at", scalar("timestamp with time zone", "NO", "now()")],
  ])],
  [ATTEMPT_TABLE, new Map([
    ["authority_hash", cText()],
    ["claim_id", scalar("bigint")],
    ["attempt_id", cText()],
    ["slice_hash", cText()],
    ["reserved_at", scalar("timestamp with time zone", "NO", "now()")],
  ])],
]);

function normalizeSql(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*([()[\],])\s*/g, "$1")
    .trim()
    .toLowerCase();
}

async function relationExists(sql: Sql | TransactionSql, relation: string): Promise<boolean> {
  const rows = await sql.unsafe<Array<{ relation: string | null }>>(
    "SELECT to_regclass($1)::text AS relation",
    [`public.${relation}`],
  );
  return rows[0]?.relation === relation || rows[0]?.relation === `public.${relation}`;
}

export async function detectPreparationAuthorityV2Ledger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const relations = await Promise.all(
    [AUTHORITY_TABLE, CLAIM_TABLE, ATTEMPT_TABLE].map((table) => relationExists(sql, table)),
  );
  const functions = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = ANY($1::text[])`,
    [[
      "setfarm_enforce_v3_preparation_authority_v2_immutable",
      "setfarm_enforce_v3_preparation_authority_claim_v2",
      "setfarm_enforce_v3_preparation_bound_claim_v2",
      "setfarm_enforce_v3_preparation_authority_attempt_v2",
      "setfarm_enforce_v3_preparation_bound_attempt_v2",
    ]],
  );
  const triggers = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = ANY($1::text[])`,
    [[
      "trg_v3_preparation_authorities_v2_immutable",
      "trg_v3_preparation_authorities_v2_no_truncate",
      "trg_v3_preparation_authority_claims_v2_binding",
      "trg_v3_preparation_authority_claims_v2_no_truncate",
      "trg_claim_log_v3_preparation_v2_identity",
      "trg_v3_preparation_authority_attempts_v2_binding",
      "trg_v3_preparation_authority_attempts_v2_no_truncate",
      "trg_execution_attempts_v3_preparation_v2_identity",
    ]],
  );
  const presentRelations = relations.filter(Boolean).length;
  const functionCount = functions[0]?.count ?? 0;
  const triggerCount = triggers[0]?.count ?? 0;
  if (presentRelations === 0 && functionCount === 0 && triggerCount === 0) return "absent";
  if (presentRelations === 3 && functionCount === 5 && triggerCount === 8) return "present";
  return "partial";
}

async function verifyRelationTopology(
  sql: Sql | TransactionSql,
  table: string,
): Promise<void> {
  const rows = await sql.unsafe<Array<{
    relkind: string;
    relpersistence: string;
    relispartition: boolean;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
    inheritance_edges: number;
    rules: number;
    policies: number;
  }>>(
    `SELECT c.relkind, c.relpersistence, c.relispartition,
            c.relrowsecurity, c.relforcerowsecurity,
            (SELECT COUNT(*)::integer FROM pg_inherits i
              WHERE i.inhrelid = c.oid OR i.inhparent = c.oid) AS inheritance_edges,
            (SELECT COUNT(*)::integer FROM pg_rewrite r
              WHERE r.ev_class = c.oid) AS rules,
            (SELECT COUNT(*)::integer FROM pg_policy p
              WHERE p.polrelid = c.oid) AS policies
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1`,
    [table],
  );
  const row = rows[0];
  if (
    rows.length !== 1
    || row?.relkind !== "r"
    || row.relpersistence !== "p"
    || row.relispartition
    || row.relrowsecurity
    || row.relforcerowsecurity
    || row.inheritance_edges !== 0
    || row.rules !== 0
    || row.policies !== 0
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `${table} is not one permanent unrewritten authority relation`,
    );
  }
}

async function verifyColumns(sql: Sql | TransactionSql, table: string): Promise<void> {
  const expected = EXPECTED_COLUMNS.get(table)!;
  const rows = await sql.unsafe<Array<{
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    column_default: string | null;
    collation_schema: string | null;
    collation_name: string | null;
  }>>(
    `SELECT column_name, data_type, is_nullable, column_default,
            collation_schema, collation_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  if (
    rows.length !== expected.size
    || rows.some((row) => {
      const column = expected.get(row.column_name);
      return !column
        || row.data_type !== column.dataType
        || row.is_nullable !== column.nullable
        || normalizeSql(row.column_default ?? "") !== column.defaultValue
        || row.collation_schema !== column.collationSchema
        || row.collation_name !== column.collationName;
    })
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `${table} exact column set/default/collation mismatch`,
    );
  }
}

const EXPECTED_CONSTRAINTS = new Map<string, ReadonlyMap<string, string>>([
  [AUTHORITY_TABLE, new Map([
    ["v3_preparation_authorities_v2_pkey", "PRIMARY KEY (authority_hash)"],
    ["v3_prep_authorities_v2_identity_key", "UNIQUE (run_id, step_id, story_id, state_version)"],
    ["v3_prep_authorities_v2_packet_fkey", "FOREIGN KEY (run_id, packet_hash) REFERENCES product_packets(run_id, packet_hash) ON DELETE RESTRICT"],
    ["v3_prep_authorities_v2_schema_check", "CHECK (authority_schema = 'setfarm.v3-preparation-claim-authority.v2'::text AND authority_version = 2 AND packet_schema = 'setfarm.product-build-packet.v3'::text)"],
    ["v3_prep_authorities_v2_hash_check", "CHECK (authority_hash ~ '^[a-f0-9]{64}$'::text AND packet_hash ~ '^[a-f0-9]{64}$'::text AND compilation_report_hash ~ '^[a-f0-9]{64}$'::text)"],
    ["v3_prep_authorities_v2_source_check", "CHECK (base_source_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'::text AND base_source_tree_hash ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'::text)"],
    ["v3_prep_authorities_v2_identity_check", "CHECK (state_version > 0 AND octet_length(convert_to(run_id, 'UTF8'::name)) >= 1 AND octet_length(convert_to(run_id, 'UTF8'::name)) <= 500 AND octet_length(convert_to(step_id, 'UTF8'::name)) >= 1 AND octet_length(convert_to(step_id, 'UTF8'::name)) <= 500 AND octet_length(convert_to(story_id, 'UTF8'::name)) >= 1 AND octet_length(convert_to(story_id, 'UTF8'::name)) <= 500)"],
    ["v3_prep_authorities_v2_payload_check", `CHECK ((
      jsonb_typeof(authority_payload) = 'object'::text
      AND authority_payload ?& ARRAY[
        'authorityHash'::text, 'schema'::text, 'authorityVersion'::text,
        'packetSchema'::text, 'stateVersion'::text, 'runId'::text,
        'stepId'::text, 'storyId'::text, 'packetHash'::text,
        'compilationReportHash'::text, 'baseRevision'::text,
        'projectedDependencyIds'::text, 'dependencyAttempts'::text
      ]
      AND (authority_payload - ARRAY[
        'authorityHash'::text, 'schema'::text, 'authorityVersion'::text,
        'packetSchema'::text, 'stateVersion'::text, 'runId'::text,
        'stepId'::text, 'storyId'::text, 'packetHash'::text,
        'compilationReportHash'::text, 'baseRevision'::text,
        'projectedDependencyIds'::text, 'dependencyAttempts'::text
      ]) = '{}'::jsonb
      AND octet_length(convert_to(authority_payload::text, 'UTF8'::name))
        <= ${V3_PREPARATION_AUTHORITY_V2_DATABASE_MAX_BYTES}
      AND jsonb_typeof(authority_payload -> 'authorityHash'::text) = 'string'::text
      AND jsonb_typeof(authority_payload -> 'schema'::text) = 'string'::text
      AND jsonb_typeof(authority_payload -> 'authorityVersion'::text) = 'number'::text
      AND jsonb_typeof(authority_payload -> 'packetSchema'::text) = 'string'::text
      AND jsonb_typeof(authority_payload -> 'stateVersion'::text) = 'number'::text
      AND jsonb_typeof(authority_payload -> 'runId'::text) = 'string'::text
      AND jsonb_typeof(authority_payload -> 'stepId'::text) = 'string'::text
      AND jsonb_typeof(authority_payload -> 'storyId'::text) = 'string'::text
      AND jsonb_typeof(authority_payload -> 'packetHash'::text) = 'string'::text
      AND jsonb_typeof(authority_payload -> 'compilationReportHash'::text) = 'string'::text
      AND jsonb_typeof(authority_payload -> 'baseRevision'::text) = 'object'::text
      AND (authority_payload -> 'baseRevision'::text) ?& ARRAY['sha'::text, 'treeHash'::text]
      AND ((authority_payload -> 'baseRevision'::text) - ARRAY['sha'::text, 'treeHash'::text]) = '{}'::jsonb
      AND jsonb_typeof(authority_payload #> '{baseRevision,sha}'::text[]) = 'string'::text
      AND jsonb_typeof(authority_payload #> '{baseRevision,treeHash}'::text[]) = 'string'::text
      AND (authority_payload ->> 'authorityHash'::text) = authority_hash
      AND (authority_payload ->> 'schema'::text) = authority_schema
      AND ((authority_payload ->> 'authorityVersion'::text)::integer) = authority_version
      AND (authority_payload ->> 'packetSchema'::text) = packet_schema
      AND (authority_payload ->> 'runId'::text) = run_id
      AND (authority_payload ->> 'stepId'::text) = step_id
      AND (authority_payload ->> 'storyId'::text) = story_id
      AND ((authority_payload ->> 'stateVersion'::text)::integer) = state_version
      AND (authority_payload ->> 'packetHash'::text) = packet_hash
      AND (authority_payload ->> 'compilationReportHash'::text) = compilation_report_hash
      AND (authority_payload #>> '{baseRevision,sha}'::text[]) = base_source_sha
      AND (authority_payload #>> '{baseRevision,treeHash}'::text[]) = base_source_tree_hash
      AND jsonb_typeof(authority_payload -> 'projectedDependencyIds'::text) = 'array'::text
      AND jsonb_typeof(authority_payload -> 'dependencyAttempts'::text) = 'array'::text
    ) IS TRUE)`],
  ])],
  [CLAIM_TABLE, new Map([
    ["v3_preparation_authority_claims_v2_pkey", "PRIMARY KEY (authority_hash)"],
    ["v3_prep_authority_claims_v2_claim_key", "UNIQUE (claim_id)"],
    ["v3_prep_authority_claims_v2_pair_key", "UNIQUE (authority_hash, claim_id)"],
    ["v3_prep_authority_claims_v2_auth_fkey", "FOREIGN KEY (authority_hash) REFERENCES v3_preparation_authorities_v2(authority_hash) ON DELETE RESTRICT"],
    ["v3_prep_authority_claims_v2_claim_fkey", "FOREIGN KEY (claim_id) REFERENCES claim_log(id) ON DELETE RESTRICT"],
  ])],
  [ATTEMPT_TABLE, new Map([
    ["v3_preparation_authority_attempts_v2_pkey", "PRIMARY KEY (authority_hash)"],
    ["v3_prep_authority_attempts_v2_claim_key", "UNIQUE (claim_id)"],
    ["v3_prep_authority_attempts_v2_attempt_key", "UNIQUE (attempt_id)"],
    ["v3_prep_authority_attempts_v2_claim_fkey", "FOREIGN KEY (authority_hash, claim_id) REFERENCES v3_preparation_authority_claims_v2(authority_hash, claim_id) ON DELETE RESTRICT"],
    ["v3_prep_authority_attempts_v2_attempt_fkey", "FOREIGN KEY (attempt_id, claim_id) REFERENCES execution_attempts(attempt_id, claim_id) ON DELETE RESTRICT"],
    ["v3_prep_authority_attempts_v2_slice_check", "CHECK (slice_hash ~ '^[a-f0-9]{64}$'::text)"],
  ])],
]);

async function verifyConstraints(sql: Sql | TransactionSql, table: string): Promise<void> {
  const expected = EXPECTED_CONSTRAINTS.get(table)!;
  const rows = await sql.unsafe<Array<{
    conname: string;
    definition: string;
    validated: boolean;
    deferrable: boolean;
    initially_deferred: boolean;
  }>>(
    `SELECT conname, pg_get_constraintdef(oid, true) AS definition,
            convalidated AS validated, condeferrable AS deferrable,
            condeferred AS initially_deferred
       FROM pg_constraint
      WHERE conrelid = $1::regclass`,
    [`public.${table}`],
  );
  const byName = new Map(rows.map((row) => [row.conname, row]));
  const mismatch = [...expected].find(([name, definition]) => {
    const row = byName.get(name);
    return !row
      || !row.validated
      || row.deferrable
      || row.initially_deferred
      || normalizeSql(row.definition) !== normalizeSql(definition);
    });
  if (rows.length !== expected.size || mismatch) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `${table} exact constraint authority mismatch: ${mismatch?.[0] ?? "count"}; expected=${
        mismatch ? normalizeSql(mismatch[1]) : expected.size
      }; actual=${
        mismatch ? normalizeSql(byName.get(mismatch[0])?.definition ?? "missing") : rows.length
      }`,
    );
  }
}

const EXPECTED_INDEXES = new Map<string, ReadonlyMap<string, string>>([
  [AUTHORITY_TABLE, new Map([
    ["v3_preparation_authorities_v2_pkey", "CREATE UNIQUE INDEX v3_preparation_authorities_v2_pkey ON public.v3_preparation_authorities_v2 USING btree (authority_hash)"],
    ["v3_prep_authorities_v2_identity_key", "CREATE UNIQUE INDEX v3_prep_authorities_v2_identity_key ON public.v3_preparation_authorities_v2 USING btree (run_id, step_id, story_id, state_version)"],
  ])],
  [CLAIM_TABLE, new Map([
    ["v3_preparation_authority_claims_v2_pkey", "CREATE UNIQUE INDEX v3_preparation_authority_claims_v2_pkey ON public.v3_preparation_authority_claims_v2 USING btree (authority_hash)"],
    ["v3_prep_authority_claims_v2_claim_key", "CREATE UNIQUE INDEX v3_prep_authority_claims_v2_claim_key ON public.v3_preparation_authority_claims_v2 USING btree (claim_id)"],
    ["v3_prep_authority_claims_v2_pair_key", "CREATE UNIQUE INDEX v3_prep_authority_claims_v2_pair_key ON public.v3_preparation_authority_claims_v2 USING btree (authority_hash, claim_id)"],
  ])],
  [ATTEMPT_TABLE, new Map([
    ["v3_preparation_authority_attempts_v2_pkey", "CREATE UNIQUE INDEX v3_preparation_authority_attempts_v2_pkey ON public.v3_preparation_authority_attempts_v2 USING btree (authority_hash)"],
    ["v3_prep_authority_attempts_v2_attempt_key", "CREATE UNIQUE INDEX v3_prep_authority_attempts_v2_attempt_key ON public.v3_preparation_authority_attempts_v2 USING btree (attempt_id)"],
    ["v3_prep_authority_attempts_v2_claim_key", "CREATE UNIQUE INDEX v3_prep_authority_attempts_v2_claim_key ON public.v3_preparation_authority_attempts_v2 USING btree (claim_id)"],
  ])],
]);

async function verifyIndexes(sql: Sql | TransactionSql, table: string): Promise<void> {
  const expected = EXPECTED_INDEXES.get(table)!;
  const rows = await sql.unsafe<Array<{
    name: string;
    definition: string;
    valid: boolean;
    ready: boolean;
    live: boolean;
  }>>(
    `SELECT index_relation.relname AS name,
            pg_get_indexdef(index_relation.oid) AS definition,
            index_row.indisvalid AS valid,
            index_row.indisready AS ready,
            index_row.indislive AS live
       FROM pg_index index_row
       JOIN pg_class table_relation ON table_relation.oid = index_row.indrelid
       JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
       JOIN pg_namespace namespace ON namespace.oid = table_relation.relnamespace
      WHERE namespace.nspname = 'public' AND table_relation.relname = $1
      ORDER BY index_relation.relname`,
    [table],
  );
  const actual = new Map(rows.map((row) => [row.name, row]));
  if (
    actual.size !== expected.size
    || [...expected].some(([name, definition]) => {
      const row = actual.get(name);
      return !row
        || !row.valid
        || !row.ready
        || !row.live
        || normalizeSql(row.definition) !== normalizeSql(definition);
    })
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `${table} exact index set mismatch`,
    );
  }
}

const EXPECTED_FUNCTION_BODIES = new Map([
  ["setfarm_enforce_v3_preparation_authority_v2_immutable", AUTHORITY_IMMUTABILITY_BODY_SQL],
  ["setfarm_enforce_v3_preparation_authority_claim_v2", CLAIM_BINDING_BODY_SQL],
  ["setfarm_enforce_v3_preparation_bound_claim_v2", BOUND_CLAIM_IDENTITY_BODY_SQL],
  ["setfarm_enforce_v3_preparation_authority_attempt_v2", ATTEMPT_BINDING_BODY_SQL],
  ["setfarm_enforce_v3_preparation_bound_attempt_v2", BOUND_ATTEMPT_IDENTITY_BODY_SQL],
]);

async function verifyFunctions(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    body: string;
    language: string;
    volatility: string;
    security_definer: boolean;
    configuration: string[] | null;
    result: string;
    arguments: string;
  }>>(
    `SELECT p.proname AS name, p.prosrc AS body, l.lanname AS language,
            p.provolatile AS volatility, p.prosecdef AS security_definer,
            p.proconfig AS configuration, pg_get_function_result(p.oid) AS result,
            pg_get_function_arguments(p.oid) AS arguments
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
    [[...EXPECTED_FUNCTION_BODIES.keys()]],
  );
  const byName = new Map(rows.map((row) => [row.name, row]));
  if (
    rows.length !== EXPECTED_FUNCTION_BODIES.size
    || [...EXPECTED_FUNCTION_BODIES].some(([name, body]) => {
      const row = byName.get(name);
      return !row
        || normalizeSql(row.body) !== normalizeSql(body)
        || row.language !== "plpgsql"
        || row.volatility !== "v"
        || row.security_definer
        || JSON.stringify(row.configuration) !== JSON.stringify(["search_path=pg_catalog, public"])
        || row.result !== "trigger"
        || row.arguments !== "";
    })
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "preparation authority v2 exact function authority mismatch",
    );
  }
}

const EXPECTED_TRIGGERS = new Map<string, Readonly<{
  relation: string;
  functionIdentity: string;
  definition: string;
}>>([
  ["trg_v3_preparation_authorities_v2_immutable", {
    relation: AUTHORITY_TABLE,
    functionIdentity: "setfarm_enforce_v3_preparation_authority_v2_immutable()",
    definition: "CREATE TRIGGER trg_v3_preparation_authorities_v2_immutable BEFORE INSERT OR DELETE OR UPDATE ON v3_preparation_authorities_v2 FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_v2_immutable()",
  }],
  ["trg_v3_preparation_authorities_v2_no_truncate", {
    relation: AUTHORITY_TABLE,
    functionIdentity: "setfarm_enforce_v3_preparation_authority_v2_immutable()",
    definition: "CREATE TRIGGER trg_v3_preparation_authorities_v2_no_truncate BEFORE TRUNCATE ON v3_preparation_authorities_v2 FOR EACH STATEMENT EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_v2_immutable()",
  }],
  ["trg_v3_preparation_authority_claims_v2_binding", {
    relation: CLAIM_TABLE,
    functionIdentity: "setfarm_enforce_v3_preparation_authority_claim_v2()",
    definition: "CREATE TRIGGER trg_v3_preparation_authority_claims_v2_binding BEFORE INSERT OR DELETE OR UPDATE ON v3_preparation_authority_claims_v2 FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_claim_v2()",
  }],
  ["trg_v3_preparation_authority_claims_v2_no_truncate", {
    relation: CLAIM_TABLE,
    functionIdentity: "setfarm_enforce_v3_preparation_authority_claim_v2()",
    definition: "CREATE TRIGGER trg_v3_preparation_authority_claims_v2_no_truncate BEFORE TRUNCATE ON v3_preparation_authority_claims_v2 FOR EACH STATEMENT EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_claim_v2()",
  }],
  ["trg_claim_log_v3_preparation_v2_identity", {
    relation: "claim_log",
    functionIdentity: "setfarm_enforce_v3_preparation_bound_claim_v2()",
    definition: "CREATE TRIGGER trg_claim_log_v3_preparation_v2_identity BEFORE DELETE OR UPDATE ON claim_log FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_v3_preparation_bound_claim_v2()",
  }],
  ["trg_v3_preparation_authority_attempts_v2_binding", {
    relation: ATTEMPT_TABLE,
    functionIdentity: "setfarm_enforce_v3_preparation_authority_attempt_v2()",
    definition: "CREATE TRIGGER trg_v3_preparation_authority_attempts_v2_binding BEFORE INSERT OR DELETE OR UPDATE ON v3_preparation_authority_attempts_v2 FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_attempt_v2()",
  }],
  ["trg_v3_preparation_authority_attempts_v2_no_truncate", {
    relation: ATTEMPT_TABLE,
    functionIdentity: "setfarm_enforce_v3_preparation_authority_attempt_v2()",
    definition: "CREATE TRIGGER trg_v3_preparation_authority_attempts_v2_no_truncate BEFORE TRUNCATE ON v3_preparation_authority_attempts_v2 FOR EACH STATEMENT EXECUTE FUNCTION setfarm_enforce_v3_preparation_authority_attempt_v2()",
  }],
  ["trg_execution_attempts_v3_preparation_v2_identity", {
    relation: "execution_attempts",
    functionIdentity: "setfarm_enforce_v3_preparation_bound_attempt_v2()",
    definition: "CREATE TRIGGER trg_execution_attempts_v3_preparation_v2_identity BEFORE DELETE OR UPDATE ON execution_attempts FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_v3_preparation_bound_attempt_v2()",
  }],
]);

async function verifyTriggers(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    relation: string;
    enabled: string;
    deferrable: boolean;
    initially_deferred: boolean;
    definition: string;
    function_identity: string;
  }>>(
    `SELECT t.tgname AS name, t.tgrelid::regclass::text AS relation,
            t.tgenabled AS enabled, t.tgdeferrable AS deferrable,
            t.tginitdeferred AS initially_deferred,
            pg_get_triggerdef(t.oid, true) AS definition,
            t.tgfoid::regprocedure::text AS function_identity
       FROM pg_trigger t
      WHERE NOT t.tgisinternal
        AND (
          t.tgrelid = ANY($1::regclass[])
          OR t.tgname = ANY($3::text[])
          OR t.tgfoid IN (
            SELECT p.oid
              FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = ANY($2::text[])
          )
        )`,
    [
      [AUTHORITY_TABLE, CLAIM_TABLE, ATTEMPT_TABLE],
      [...EXPECTED_FUNCTION_BODIES.keys()],
      [
        "trg_claim_log_v3_preparation_v2_identity",
        "trg_execution_attempts_v3_preparation_v2_identity",
      ],
    ],
  );
  const byName = new Map(rows.map((row) => [row.name, row]));
  if (
    rows.length !== EXPECTED_TRIGGERS.size
    || [...EXPECTED_TRIGGERS].some(([name, expected]) => {
      const row = byName.get(name);
      return !row
        || row.relation !== expected.relation
        || row.enabled !== "O"
        || row.deferrable
        || row.initially_deferred
        || row.function_identity !== expected.functionIdentity
        || normalizeSql(row.definition) !== normalizeSql(expected.definition);
    })
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "preparation authority v2 exact trigger authority mismatch",
    );
  }
}

async function verifyRelationalData(sql: Sql | TransactionSql): Promise<void> {
  const mismatches = await sql.unsafe<Array<{
    claim_mismatches: number;
    attempt_mismatches: number;
  }>>(
    `SELECT
       (SELECT COUNT(*)::integer
          FROM ${CLAIM_TABLE} binding
          JOIN ${AUTHORITY_TABLE} authority USING (authority_hash)
          JOIN claim_log claim ON claim.id = binding.claim_id
         WHERE authority.run_id IS DISTINCT FROM claim.run_id
            OR authority.step_id IS DISTINCT FROM claim.step_id
            OR authority.story_id IS DISTINCT FROM COALESCE(claim.story_id, ''))
         AS claim_mismatches,
       (SELECT COUNT(*)::integer
          FROM ${ATTEMPT_TABLE} binding
          JOIN ${AUTHORITY_TABLE} authority USING (authority_hash)
          JOIN execution_attempts attempt
            ON attempt.attempt_id = binding.attempt_id
           AND attempt.claim_id = binding.claim_id
          JOIN claim_log claim ON claim.id = binding.claim_id
         WHERE attempt.run_id IS DISTINCT FROM authority.run_id
            OR attempt.step_id IS DISTINCT FROM authority.step_id
            OR attempt.story_id IS DISTINCT FROM authority.story_id
            OR attempt.packet_hash IS DISTINCT FROM authority.packet_hash
            OR attempt.compilation_report_hash IS DISTINCT FROM authority.compilation_report_hash
            OR attempt.slice_hash IS DISTINCT FROM binding.slice_hash
            OR attempt.source_before_sha IS DISTINCT FROM authority.base_source_sha
            OR attempt.source_before_tree_hash IS DISTINCT FROM authority.base_source_tree_hash
            OR attempt.attempt_class IS DISTINCT FROM 'product_implementation'
            OR attempt.role IS DISTINCT FROM 'developer'
            OR attempt.agent_id IS DISTINCT FROM claim.agent_id
            OR attempt.recovery_case_revision_id IS NOT NULL
            OR attempt.recovery_dispatch_id IS NOT NULL)
         AS attempt_mismatches`,
  );
  if (
    mismatches[0]?.claim_mismatches !== 0
    || mismatches[0]?.attempt_mismatches !== 0
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "preparation authority v2 relational identity mismatch",
    );
  }
}

export async function verifyPreparationAuthorityV2Ledger(
  sql: Sql | TransactionSql,
): Promise<void> {
  for (const table of [AUTHORITY_TABLE, CLAIM_TABLE, ATTEMPT_TABLE]) {
    await verifyRelationTopology(sql, table);
    await verifyColumns(sql, table);
    await verifyConstraints(sql, table);
    await verifyIndexes(sql, table);
  }
  await verifyFunctions(sql);
  await verifyTriggers(sql);
  await verifyRelationalData(sql);

  const journalExists = await relationExists(sql, "setfarm_schema_migrations");
  const counts = await sql.unsafe<Array<{ count: number; journaled: boolean }>>(
    journalExists
      ? `SELECT (SELECT COUNT(*)::integer FROM ${AUTHORITY_TABLE}) AS count,
                EXISTS (
                  SELECT 1 FROM setfarm_schema_migrations WHERE version = 25
                ) AS journaled`
      : `SELECT (SELECT COUNT(*)::integer FROM ${AUTHORITY_TABLE}) AS count,
                FALSE AS journaled`,
  );
  if ((counts[0]?.count ?? 0) > 0 && counts[0]?.journaled !== true) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "populated preparation authority v2 ledger requires explicit offline reconciliation",
    );
  }
}

export async function auditPreparationAuthorityV2LedgerData(
  sql: Sql | TransactionSql,
): Promise<void> {
  await verifyPreparationAuthorityV2Ledger(sql);
  const rows = await sql.unsafe<Array<{
    authority_hash: string;
    authority_payload: unknown;
  }>>(
    `SELECT authority_hash, authority_payload
       FROM public.v3_preparation_authorities_v2
      ORDER BY authority_hash`,
  );
  for (const row of rows) {
    let payload = row.authority_payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        throw new ContractSpineMigrationError(
          "MIGRATION_ADOPTION_MISMATCH",
          "preparation authority v2 contains non-JSON canonical payload data",
        );
      }
    }
    const parsed = V3PreparationClaimAuthorityV2Schema.safeParse(payload);
    if (!parsed.success || parsed.data.authorityHash !== row.authority_hash) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        "preparation authority v2 payload does not reproduce its canonical contract and hash",
      );
    }
  }
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v25-preparation-authority-ledger:END
