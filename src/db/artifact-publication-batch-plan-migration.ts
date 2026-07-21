import type postgres from "postgres";

import {
  ArtifactPublicationBatchIdentityItemSchema,
} from "../product-compiler/artifact-publication-batch-identity.js";
import {
  ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1,
  computeArtifactStoreBatchPlanIdentityHashV1,
} from "../product-compiler/artifact-publication-batch-plan-binding.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v26-artifact-publication-batch-plan:BEGIN
const PLAN_TABLE = "artifact_publication_batch_plans";
const PLAN_ITEM_TABLE = "artifact_publication_batch_plan_items";

type ArtifactPublicationBatchPlanMigrationErrorFactory = (
  message: string,
  cause?: unknown,
) => Error;

let migrationErrorFactory: ArtifactPublicationBatchPlanMigrationErrorFactory | undefined;

export function configureArtifactPublicationBatchPlanMigrationErrorFactory(
  factory: ArtifactPublicationBatchPlanMigrationErrorFactory,
): void {
  if (migrationErrorFactory && migrationErrorFactory !== factory) {
    throw new Error("ARTIFACT_PUBLICATION_BATCH_PLAN_MIGRATION_ERROR_FACTORY_ALREADY_BOUND");
  }
  migrationErrorFactory = factory;
}

function migrationError(message: string, cause?: unknown): Error {
  if (!migrationErrorFactory) {
    throw new Error("ARTIFACT_PUBLICATION_BATCH_PLAN_MIGRATION_ERROR_FACTORY_UNBOUND");
  }
  return migrationErrorFactory(message, cause);
}

const PLAN_COMPLETENESS_BODY_SQL = `
  DECLARE
    expected_count INTEGER;
    plan_count INTEGER;
    observed_schema TEXT;
    batch_created_at TIMESTAMPTZ;
    plan_created_at TIMESTAMPTZ;
    actual_count INTEGER;
    minimum_ordinal INTEGER;
    maximum_ordinal INTEGER;
    minimum_tier INTEGER;
    maximum_tier INTEGER;
    distinct_tier_count INTEGER;
  BEGIN
    SELECT b.artifact_count, p.item_count, p.plan_schema,
           b.created_at, p.created_at
      INTO expected_count, plan_count, observed_schema,
           batch_created_at, plan_created_at
      FROM public.artifact_publication_batches b
      LEFT JOIN public.artifact_publication_batch_plans p
        ON p.batch_reservation_id = b.batch_reservation_id
     WHERE b.batch_reservation_id = NEW.batch_reservation_id;
    IF expected_count IS NULL THEN
      RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_BATCH_MISSING'
        USING ERRCODE = '23514';
    END IF;
    IF plan_count IS NULL THEN
      RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_MISSING'
        USING ERRCODE = '23514';
    END IF;
    IF observed_schema IS DISTINCT FROM '${ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1}'
       OR plan_count IS DISTINCT FROM expected_count
       OR plan_created_at IS DISTINCT FROM batch_created_at THEN
      RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_HEADER_MISMATCH'
        USING ERRCODE = '23514';
    END IF;

    SELECT COUNT(*)::integer, MIN(ordinal), MAX(ordinal),
           MIN(durability_tier), MAX(durability_tier),
           COUNT(DISTINCT durability_tier)::integer
      INTO actual_count, minimum_ordinal, maximum_ordinal,
           minimum_tier, maximum_tier, distinct_tier_count
      FROM public.artifact_publication_batch_plan_items
     WHERE batch_reservation_id = NEW.batch_reservation_id;
    IF actual_count IS DISTINCT FROM expected_count
       OR minimum_ordinal IS DISTINCT FROM 0
       OR maximum_ordinal IS DISTINCT FROM expected_count - 1 THEN
      RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_INCOMPLETE'
        USING ERRCODE = '23514';
    END IF;
    IF minimum_tier IS DISTINCT FROM 0
       OR maximum_tier IS NULL
       OR maximum_tier > 8
       OR distinct_tier_count IS DISTINCT FROM maximum_tier + 1 THEN
      RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_TIER_MISMATCH'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      (SELECT artifact_hash
         FROM public.artifact_publication_batch_items
        WHERE batch_reservation_id = NEW.batch_reservation_id
       EXCEPT
       SELECT artifact_hash
         FROM public.artifact_publication_batch_plan_items
        WHERE batch_reservation_id = NEW.batch_reservation_id)
      UNION ALL
      (SELECT artifact_hash
         FROM public.artifact_publication_batch_plan_items
        WHERE batch_reservation_id = NEW.batch_reservation_id
       EXCEPT
       SELECT artifact_hash
         FROM public.artifact_publication_batch_items
        WHERE batch_reservation_id = NEW.batch_reservation_id)
    ) THEN
      RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_MEMBERSHIP_MISMATCH'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM public.artifact_publication_batch_plan_items i
       WHERE i.batch_reservation_id = NEW.batch_reservation_id
         AND i.created_at IS DISTINCT FROM plan_created_at
    ) THEN
      RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_TIME_MISMATCH'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM (
          SELECT ordinal,
                 row_number() OVER (
                   ORDER BY durability_tier, artifact_hash COLLATE "C"
                 ) - 1 AS expected_ordinal
            FROM public.artifact_publication_batch_plan_items
           WHERE batch_reservation_id = NEW.batch_reservation_id
        ) ordered_items
       WHERE ordinal IS DISTINCT FROM expected_ordinal
    ) THEN
      RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_ORDER_MISMATCH'
        USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
  END;
`;

const PLAN_IMMUTABILITY_BODY_SQL = `
  BEGIN
    RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_IMMUTABLE'
      USING ERRCODE = '23514';
  END;
`;

export const ARTIFACT_PUBLICATION_BATCH_PLAN_STATEMENTS = [
  `DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM public.artifact_publication_batches LIMIT 1) THEN
       RAISE EXCEPTION 'ARTIFACT_PUBLICATION_BATCH_PLAN_ADOPTION_REQUIRES_EMPTY_BATCH_LEDGER'
         USING ERRCODE = '23514';
     END IF;
   END;
   $$`,
  `CREATE TABLE public.artifact_publication_batch_plans (
     batch_reservation_id TEXT NOT NULL,
     plan_schema TEXT NOT NULL,
     plan_identity_hash TEXT NOT NULL,
     item_count INTEGER NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT artifact_publication_batch_plans_pkey
       PRIMARY KEY (batch_reservation_id),
     CONSTRAINT artifact_publication_batch_plans_batch_fkey
       FOREIGN KEY (batch_reservation_id)
       REFERENCES public.artifact_publication_batches(batch_reservation_id)
       ON DELETE RESTRICT,
     CONSTRAINT artifact_publication_batch_plans_schema_check
       CHECK (plan_schema = '${ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1}'),
     CONSTRAINT artifact_publication_batch_plans_hash_check
       CHECK (plan_identity_hash ~ '^[a-f0-9]{64}$'),
     CONSTRAINT artifact_publication_batch_plans_count_check
       CHECK (item_count BETWEEN 1 AND 9)
   )`,
  `CREATE TABLE public.artifact_publication_batch_plan_items (
     batch_reservation_id TEXT NOT NULL,
     ordinal INTEGER NOT NULL,
     artifact_hash TEXT NOT NULL,
     durability_tier INTEGER NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     CONSTRAINT artifact_publication_batch_plan_items_pkey
       PRIMARY KEY (batch_reservation_id, artifact_hash),
     CONSTRAINT artifact_publication_batch_plan_items_ordinal_unique
       UNIQUE (batch_reservation_id, ordinal),
     CONSTRAINT artifact_publication_batch_plan_items_plan_fkey
       FOREIGN KEY (batch_reservation_id)
       REFERENCES public.artifact_publication_batch_plans(batch_reservation_id)
       ON DELETE RESTRICT,
     CONSTRAINT artifact_publication_batch_plan_items_membership_fkey
       FOREIGN KEY (batch_reservation_id, artifact_hash)
       REFERENCES public.artifact_publication_batch_items(batch_reservation_id, artifact_hash)
       ON DELETE RESTRICT,
     CONSTRAINT artifact_publication_batch_plan_items_ordinal_check
       CHECK (ordinal BETWEEN 0 AND 8),
     CONSTRAINT artifact_publication_batch_plan_items_hash_check
       CHECK (artifact_hash ~ '^[a-f0-9]{64}$'),
     CONSTRAINT artifact_publication_batch_plan_items_tier_check
       CHECK (durability_tier BETWEEN 0 AND 8)
   )`,
  `CREATE FUNCTION public.setfarm_validate_artifact_publication_batch_plan()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${PLAN_COMPLETENESS_BODY_SQL}$$`,
  `CREATE FUNCTION public.setfarm_forbid_artifact_publication_batch_plan_mutation()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${PLAN_IMMUTABILITY_BODY_SQL}$$`,
  `CREATE CONSTRAINT TRIGGER trg_artifact_publication_batches_require_plan
     AFTER INSERT ON public.artifact_publication_batches
     DEFERRABLE INITIALLY DEFERRED
     FOR EACH ROW EXECUTE FUNCTION public.setfarm_validate_artifact_publication_batch_plan()`,
  `CREATE CONSTRAINT TRIGGER trg_artifact_publication_batch_plans_complete
     AFTER INSERT ON public.artifact_publication_batch_plans
     DEFERRABLE INITIALLY DEFERRED
     FOR EACH ROW EXECUTE FUNCTION public.setfarm_validate_artifact_publication_batch_plan()`,
  `CREATE CONSTRAINT TRIGGER trg_artifact_publication_batch_plan_items_complete
     AFTER INSERT ON public.artifact_publication_batch_plan_items
     DEFERRABLE INITIALLY DEFERRED
     FOR EACH ROW EXECUTE FUNCTION public.setfarm_validate_artifact_publication_batch_plan()`,
  `CREATE TRIGGER trg_artifact_publication_batch_plans_immutable
     BEFORE UPDATE OR DELETE ON public.artifact_publication_batch_plans
     FOR EACH ROW EXECUTE FUNCTION public.setfarm_forbid_artifact_publication_batch_plan_mutation()`,
  `CREATE TRIGGER trg_artifact_publication_batch_plans_no_truncate
     BEFORE TRUNCATE ON public.artifact_publication_batch_plans
     FOR EACH STATEMENT EXECUTE FUNCTION public.setfarm_forbid_artifact_publication_batch_plan_mutation()`,
  `CREATE TRIGGER trg_artifact_publication_batch_plan_items_immutable
     BEFORE UPDATE OR DELETE ON public.artifact_publication_batch_plan_items
     FOR EACH ROW EXECUTE FUNCTION public.setfarm_forbid_artifact_publication_batch_plan_mutation()`,
  `CREATE TRIGGER trg_artifact_publication_batch_plan_items_no_truncate
     BEFORE TRUNCATE ON public.artifact_publication_batch_plan_items
     FOR EACH STATEMENT EXECUTE FUNCTION public.setfarm_forbid_artifact_publication_batch_plan_mutation()`,
] as const;

export async function applyArtifactPublicationBatchPlanLedger(
  sql: TransactionSql,
): Promise<void> {
  // Fence every legacy batch creator across the empty-ledger adoption check.
  // A pre-v26 writer that resumes afterward will hit the new deferred plan
  // requirement and roll its entire reservation transaction back.
  await sql.unsafe(
    `LOCK TABLE public.artifact_publication_batches IN ACCESS EXCLUSIVE MODE`,
  );
  const rows = await sql.unsafe<Array<{ count: number }>>(
    "SELECT COUNT(*)::integer AS count FROM public.artifact_publication_batches",
  );
  if (rows[0]?.count !== 0) {
    throw migrationError(
      "migration 26 adoption requires an empty artifact publication batch ledger",
    );
  }
  for (const statement of ARTIFACT_PUBLICATION_BATCH_PLAN_STATEMENTS) {
    await sql.unsafe(statement);
  }
}

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

export async function detectArtifactPublicationBatchPlanLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const relations = await Promise.all(
    [PLAN_TABLE, PLAN_ITEM_TABLE].map((table) => relationExists(sql, table)),
  );
  const functions = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = ANY($1::text[])`,
    [[
      "setfarm_validate_artifact_publication_batch_plan",
      "setfarm_forbid_artifact_publication_batch_plan_mutation",
    ]],
  );
  const triggers = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = ANY($1::text[])`,
    [[
      "trg_artifact_publication_batches_require_plan",
      "trg_artifact_publication_batch_plans_complete",
      "trg_artifact_publication_batch_plan_items_complete",
      "trg_artifact_publication_batch_plans_immutable",
      "trg_artifact_publication_batch_plans_no_truncate",
      "trg_artifact_publication_batch_plan_items_immutable",
      "trg_artifact_publication_batch_plan_items_no_truncate",
    ]],
  );
  const relationCount = relations.filter(Boolean).length;
  const functionCount = functions[0]?.count ?? 0;
  const triggerCount = triggers[0]?.count ?? 0;
  if (relationCount === 0 && functionCount === 0 && triggerCount === 0) return "absent";
  if (relationCount === 2 && functionCount === 2 && triggerCount === 7) return "present";
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
    throw migrationError(
      `${table} is not one permanent unrewritten batch-plan authority relation`,
    );
  }
}

type ExpectedColumn = Readonly<{
  dataType: string;
  nullable: "YES" | "NO";
  defaultValue: string;
}>;

const EXPECTED_COLUMNS = new Map<string, ReadonlyMap<string, ExpectedColumn>>([
  [PLAN_TABLE, new Map([
    ["batch_reservation_id", { dataType: "text", nullable: "NO", defaultValue: "" }],
    ["plan_schema", { dataType: "text", nullable: "NO", defaultValue: "" }],
    ["plan_identity_hash", { dataType: "text", nullable: "NO", defaultValue: "" }],
    ["item_count", { dataType: "integer", nullable: "NO", defaultValue: "" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO", defaultValue: "now()" }],
  ])],
  [PLAN_ITEM_TABLE, new Map([
    ["batch_reservation_id", { dataType: "text", nullable: "NO", defaultValue: "" }],
    ["ordinal", { dataType: "integer", nullable: "NO", defaultValue: "" }],
    ["artifact_hash", { dataType: "text", nullable: "NO", defaultValue: "" }],
    ["durability_tier", { dataType: "integer", nullable: "NO", defaultValue: "" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO", defaultValue: "now()" }],
  ])],
]);

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
        || row.collation_schema !== null
        || row.collation_name !== null;
    })
  ) {
    throw migrationError(`${table} exact column set/default/collation mismatch`);
  }
}

const EXPECTED_CONSTRAINTS = new Map<string, ReadonlyMap<string, string>>([
  [PLAN_TABLE, new Map([
    ["artifact_publication_batch_plans_pkey", "PRIMARY KEY (batch_reservation_id)"],
    ["artifact_publication_batch_plans_batch_fkey", "FOREIGN KEY (batch_reservation_id) REFERENCES artifact_publication_batches(batch_reservation_id) ON DELETE RESTRICT"],
    ["artifact_publication_batch_plans_schema_check", `CHECK (plan_schema = '${ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1}'::text)`],
    ["artifact_publication_batch_plans_hash_check", "CHECK (plan_identity_hash ~ '^[a-f0-9]{64}$'::text)"],
    ["artifact_publication_batch_plans_count_check", "CHECK (item_count >= 1 AND item_count <= 9)"],
  ])],
  [PLAN_ITEM_TABLE, new Map([
    ["artifact_publication_batch_plan_items_pkey", "PRIMARY KEY (batch_reservation_id, artifact_hash)"],
    ["artifact_publication_batch_plan_items_ordinal_unique", "UNIQUE (batch_reservation_id, ordinal)"],
    ["artifact_publication_batch_plan_items_plan_fkey", "FOREIGN KEY (batch_reservation_id) REFERENCES artifact_publication_batch_plans(batch_reservation_id) ON DELETE RESTRICT"],
    ["artifact_publication_batch_plan_items_membership_fkey", "FOREIGN KEY (batch_reservation_id, artifact_hash) REFERENCES artifact_publication_batch_items(batch_reservation_id, artifact_hash) ON DELETE RESTRICT"],
    ["artifact_publication_batch_plan_items_ordinal_check", "CHECK (ordinal >= 0 AND ordinal <= 8)"],
    ["artifact_publication_batch_plan_items_hash_check", "CHECK (artifact_hash ~ '^[a-f0-9]{64}$'::text)"],
    ["artifact_publication_batch_plan_items_tier_check", "CHECK (durability_tier >= 0 AND durability_tier <= 8)"],
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
      WHERE conrelid = $1::regclass
        AND contype <> 't'`,
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
    throw migrationError(
      `${table} exact constraint authority mismatch: ${mismatch?.[0] ?? "count"}; expected=${
        mismatch ? normalizeSql(mismatch[1]) : expected.size
      }; actual=${
        mismatch ? normalizeSql(byName.get(mismatch[0])?.definition ?? "missing") : rows.length
      }`,
    );
  }
}

const EXPECTED_INDEXES = new Map<string, ReadonlyMap<string, string>>([
  [PLAN_TABLE, new Map([
    ["artifact_publication_batch_plans_pkey", "CREATE UNIQUE INDEX artifact_publication_batch_plans_pkey ON public.artifact_publication_batch_plans USING btree (batch_reservation_id)"],
  ])],
  [PLAN_ITEM_TABLE, new Map([
    ["artifact_publication_batch_plan_items_pkey", "CREATE UNIQUE INDEX artifact_publication_batch_plan_items_pkey ON public.artifact_publication_batch_plan_items USING btree (batch_reservation_id, artifact_hash)"],
    ["artifact_publication_batch_plan_items_ordinal_unique", "CREATE UNIQUE INDEX artifact_publication_batch_plan_items_ordinal_unique ON public.artifact_publication_batch_plan_items USING btree (batch_reservation_id, ordinal)"],
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
    throw migrationError(`${table} exact index authority mismatch`);
  }
}

const EXPECTED_FUNCTION_BODIES = new Map([
  ["setfarm_validate_artifact_publication_batch_plan", PLAN_COMPLETENESS_BODY_SQL],
  ["setfarm_forbid_artifact_publication_batch_plan_mutation", PLAN_IMMUTABILITY_BODY_SQL],
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
    throw migrationError("artifact publication batch plan exact function authority mismatch");
  }
}

const EXPECTED_TRIGGERS = new Map<string, Readonly<{
  relation: string;
  functionIdentity: string;
  deferrable: boolean;
  initiallyDeferred: boolean;
  definition: string;
}>>([
  ["trg_artifact_publication_batches_require_plan", {
    relation: "artifact_publication_batches",
    functionIdentity: "setfarm_validate_artifact_publication_batch_plan()",
    deferrable: true,
    initiallyDeferred: true,
    definition: "CREATE CONSTRAINT TRIGGER trg_artifact_publication_batches_require_plan AFTER INSERT ON artifact_publication_batches DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION setfarm_validate_artifact_publication_batch_plan()",
  }],
  ["trg_artifact_publication_batch_plans_complete", {
    relation: PLAN_TABLE,
    functionIdentity: "setfarm_validate_artifact_publication_batch_plan()",
    deferrable: true,
    initiallyDeferred: true,
    definition: "CREATE CONSTRAINT TRIGGER trg_artifact_publication_batch_plans_complete AFTER INSERT ON artifact_publication_batch_plans DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION setfarm_validate_artifact_publication_batch_plan()",
  }],
  ["trg_artifact_publication_batch_plan_items_complete", {
    relation: PLAN_ITEM_TABLE,
    functionIdentity: "setfarm_validate_artifact_publication_batch_plan()",
    deferrable: true,
    initiallyDeferred: true,
    definition: "CREATE CONSTRAINT TRIGGER trg_artifact_publication_batch_plan_items_complete AFTER INSERT ON artifact_publication_batch_plan_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION setfarm_validate_artifact_publication_batch_plan()",
  }],
  ["trg_artifact_publication_batch_plans_immutable", {
    relation: PLAN_TABLE,
    functionIdentity: "setfarm_forbid_artifact_publication_batch_plan_mutation()",
    deferrable: false,
    initiallyDeferred: false,
    definition: "CREATE TRIGGER trg_artifact_publication_batch_plans_immutable BEFORE DELETE OR UPDATE ON artifact_publication_batch_plans FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_publication_batch_plan_mutation()",
  }],
  ["trg_artifact_publication_batch_plans_no_truncate", {
    relation: PLAN_TABLE,
    functionIdentity: "setfarm_forbid_artifact_publication_batch_plan_mutation()",
    deferrable: false,
    initiallyDeferred: false,
    definition: "CREATE TRIGGER trg_artifact_publication_batch_plans_no_truncate BEFORE TRUNCATE ON artifact_publication_batch_plans FOR EACH STATEMENT EXECUTE FUNCTION setfarm_forbid_artifact_publication_batch_plan_mutation()",
  }],
  ["trg_artifact_publication_batch_plan_items_immutable", {
    relation: PLAN_ITEM_TABLE,
    functionIdentity: "setfarm_forbid_artifact_publication_batch_plan_mutation()",
    deferrable: false,
    initiallyDeferred: false,
    definition: "CREATE TRIGGER trg_artifact_publication_batch_plan_items_immutable BEFORE DELETE OR UPDATE ON artifact_publication_batch_plan_items FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_publication_batch_plan_mutation()",
  }],
  ["trg_artifact_publication_batch_plan_items_no_truncate", {
    relation: PLAN_ITEM_TABLE,
    functionIdentity: "setfarm_forbid_artifact_publication_batch_plan_mutation()",
    deferrable: false,
    initiallyDeferred: false,
    definition: "CREATE TRIGGER trg_artifact_publication_batch_plan_items_no_truncate BEFORE TRUNCATE ON artifact_publication_batch_plan_items FOR EACH STATEMENT EXECUTE FUNCTION setfarm_forbid_artifact_publication_batch_plan_mutation()",
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
          OR t.tgname = ANY($2::text[])
          OR t.tgfoid IN (
            SELECT p.oid
              FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = ANY($3::text[])
          )
        )`,
    [
      [PLAN_TABLE, PLAN_ITEM_TABLE],
      [...EXPECTED_TRIGGERS.keys()],
      [...EXPECTED_FUNCTION_BODIES.keys()],
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
        || row.deferrable !== expected.deferrable
        || row.initially_deferred !== expected.initiallyDeferred
        || row.function_identity !== expected.functionIdentity
        || normalizeSql(row.definition) !== normalizeSql(expected.definition);
    })
  ) {
    throw migrationError("artifact publication batch plan exact trigger authority mismatch");
  }
}

async function verifyRelationalData(sql: Sql | TransactionSql): Promise<void> {
  const mismatches = await sql.unsafe<Array<{ batch_reservation_id: string }>>(
    `SELECT b.batch_reservation_id
       FROM public.artifact_publication_batches b
       LEFT JOIN public.artifact_publication_batch_plans p
         ON p.batch_reservation_id = b.batch_reservation_id
       LEFT JOIN public.artifact_publication_batch_plan_items i
         ON i.batch_reservation_id = b.batch_reservation_id
      GROUP BY b.batch_reservation_id, b.artifact_count, b.created_at,
               p.batch_reservation_id, p.item_count, p.plan_schema, p.created_at
     HAVING p.batch_reservation_id IS NULL
         OR p.plan_schema IS DISTINCT FROM $1
         OR p.item_count IS DISTINCT FROM b.artifact_count
         OR p.created_at IS DISTINCT FROM b.created_at
         OR COUNT(i.artifact_hash)::integer IS DISTINCT FROM b.artifact_count
         OR MIN(i.ordinal) IS DISTINCT FROM 0
         OR MAX(i.ordinal) IS DISTINCT FROM b.artifact_count - 1
         OR MIN(i.durability_tier) IS DISTINCT FROM 0
         OR COUNT(DISTINCT i.durability_tier)::integer
              IS DISTINCT FROM MAX(i.durability_tier) + 1
      ORDER BY b.batch_reservation_id
      LIMIT 1`,
    [ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1],
  );
  if (mismatches[0]) {
    throw migrationError(
      `artifact publication batch plan relational mismatch: ${mismatches[0].batch_reservation_id}`,
    );
  }
  const membership = await sql.unsafe<Array<{ batch_reservation_id: string }>>(
    `SELECT batch_reservation_id
       FROM (
         (SELECT batch_reservation_id, artifact_hash
            FROM public.artifact_publication_batch_items
          EXCEPT
          SELECT batch_reservation_id, artifact_hash
            FROM public.artifact_publication_batch_plan_items)
         UNION ALL
         (SELECT batch_reservation_id, artifact_hash
            FROM public.artifact_publication_batch_plan_items
          EXCEPT
          SELECT batch_reservation_id, artifact_hash
            FROM public.artifact_publication_batch_items)
       ) mismatched
      ORDER BY batch_reservation_id
      LIMIT 1`,
  );
  if (membership[0]) {
    throw migrationError(
      `artifact publication batch plan membership mismatch: ${membership[0].batch_reservation_id}`,
    );
  }
  const order = await sql.unsafe<Array<{ batch_reservation_id: string }>>(
    `SELECT batch_reservation_id
       FROM (
         SELECT batch_reservation_id, ordinal,
                row_number() OVER (
                  PARTITION BY batch_reservation_id
                  ORDER BY durability_tier, artifact_hash COLLATE "C"
                ) - 1 AS expected_ordinal
           FROM public.artifact_publication_batch_plan_items
       ) ordered_items
      WHERE ordinal IS DISTINCT FROM expected_ordinal
      ORDER BY batch_reservation_id
      LIMIT 1`,
  );
  if (order[0]) {
    throw migrationError(
      `artifact publication batch plan order mismatch: ${order[0].batch_reservation_id}`,
    );
  }
}

export async function verifyArtifactPublicationBatchPlanLedger(
  sql: Sql | TransactionSql,
  options: Readonly<{ forceDataAudit?: boolean }> = {},
): Promise<void> {
  for (const table of [PLAN_TABLE, PLAN_ITEM_TABLE]) {
    await verifyRelationTopology(sql, table);
    await verifyColumns(sql, table);
    await verifyConstraints(sql, table);
    await verifyIndexes(sql, table);
  }
  await verifyFunctions(sql);
  await verifyTriggers(sql);

  const journalExists = await relationExists(sql, "setfarm_schema_migrations");
  const journal = journalExists
    ? await sql.unsafe<Array<{ journaled: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM public.setfarm_schema_migrations WHERE version = 26
         ) AS journaled`,
      )
    : [];
  const journaled = journal[0]?.journaled === true;
  if (!journaled) {
    const counts = await sql.unsafe<Array<{ batches: number; plans: number }>>(
      `SELECT
         (SELECT COUNT(*)::integer FROM public.artifact_publication_batches) AS batches,
         (SELECT COUNT(*)::integer FROM public.artifact_publication_batch_plans) AS plans`,
    );
    if (counts[0]?.batches !== 0 || counts[0]?.plans !== 0) {
      throw migrationError(
        "populated artifact publication batches have no recoverable migration-26 plan authority",
      );
    }
  }
  if (!journaled || options.forceDataAudit === true) {
    await verifyRelationalData(sql);
  }
}

export async function auditArtifactPublicationBatchPlanLedgerData(
  sql: Sql | TransactionSql,
): Promise<void> {
  await verifyArtifactPublicationBatchPlanLedger(sql, { forceDataAudit: true });
  type AuditPlanRow = Readonly<{
    batch_reservation_id: string;
    plan_identity_hash: string;
    ordinal: number;
    durability_tier: number;
    artifact_hash: string;
    artifact_type: string;
    byte_length: string | number;
    producer_metadata: unknown;
  }>;
  const rows = await sql.unsafe<AuditPlanRow[]>(
    `SELECT p.batch_reservation_id, p.plan_identity_hash,
            pi.ordinal, pi.durability_tier,
            i.artifact_hash, i.artifact_type, i.byte_length, i.producer_metadata
       FROM public.artifact_publication_batch_plans p
       JOIN public.artifact_publication_batch_plan_items pi
         ON pi.batch_reservation_id = p.batch_reservation_id
       JOIN public.artifact_publication_batch_items i
         ON i.batch_reservation_id = pi.batch_reservation_id
        AND i.artifact_hash = pi.artifact_hash
      ORDER BY p.batch_reservation_id, pi.ordinal`,
  );
  const grouped = new Map<string, AuditPlanRow[]>();
  for (const row of rows) {
    const items = grouped.get(row.batch_reservation_id) ?? [];
    items.push(row);
    grouped.set(row.batch_reservation_id, items);
  }
  for (const [batchReservationId, items] of grouped) {
    let actual: string;
    try {
      actual = computeArtifactStoreBatchPlanIdentityHashV1(items.map((item) => ({
        durabilityTier: Number(item.durability_tier),
        identity: ArtifactPublicationBatchIdentityItemSchema.parse({
          hash: item.artifact_hash,
          artifactType: item.artifact_type,
          byteLength: Number(item.byte_length),
          producer: item.producer_metadata,
        }),
      })));
    } catch (cause) {
      throw migrationError(
        `artifact publication batch plan cannot reproduce canonical identity: ${batchReservationId}`,
        cause,
      );
    }
    if (actual !== items[0]?.plan_identity_hash) {
      throw migrationError(
        `artifact publication batch plan identity hash mismatch: ${batchReservationId}`,
      );
    }
  }
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v26-artifact-publication-batch-plan:END
