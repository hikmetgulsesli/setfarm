import type postgres from "postgres";

import { computeContractSpineMigrationChecksumV1 } from "./contract-spine-migration-checksum.js";
import { CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS } from "./contract-spine-migration-digests.generated.js";
import { assertContractSpineSemanticMigrationSourceIntegrityWhenAvailable } from "./contract-spine-migration-source-integrity.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1,
  operationalFailureCauseAuthoritySqlPredicateV1,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV1,
} from "../execution/operational-failure-cause-authority-v1.js";
import {
  V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1,
} from "../recovery/v3-downstream-terminal-cause-v1.js";
import {
  computeRecoveryDispatchDedupeKey,
  computeRecoveryFindingDispatchDedupeKey,
} from "../recovery/recovery-case.js";
import {
  RecoveryRevisionDispatchV1Schema,
  computeRevisionDispatchDedupeKey,
  computeRevisionFindingDispatchKey,
  createRecoveryCaseRevisionV1,
  type RecoveryCaseRevisionV1,
  type RecoveryCaseRevisionDraftV1,
} from "../recovery/recovery-delivery.js";
import {
  createRuntimeCompletionPlanV1,
  createSingleEffectCompletionPlanDescriptorV1,
  RuntimeCompletionEffectInputV1Schema,
  RuntimeCompletionPlanV1Schema,
  type RuntimeCompletionPlanV1,
} from "../execution/schemas/runtime-completion-plan-v1.js";
import { ProcessIdentityV1Schema } from "../execution/schemas/process-identity-v1.js";
import {
  createCanonicalOperationalEventV1,
  operationalEventDeliveryId,
  type OperationalEventDeliveryConsumerV1,
} from "../execution/schemas/operational-event-v1.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export const contractSpineMigrationLockKey = 1_397_117_251;

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-error-contract:BEGIN
export type ContractSpineMigrationErrorCode =
  | "MIGRATION_ADOPTION_MISMATCH"
  | "MIGRATION_CHECKSUM_MISMATCH"
  | "MIGRATION_INCOMPLETE"
  | "MIGRATION_LOCK_TIMEOUT"
  | "MIGRATION_RELEASE_INVALID"
  | "MIGRATION_UNKNOWN_VERSION";

export class ContractSpineMigrationError extends Error {
  readonly code: ContractSpineMigrationErrorCode;
  override readonly cause?: unknown;

  constructor(
    code: ContractSpineMigrationErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message);
    this.name = "ContractSpineMigrationError";
    this.code = code;
    this.cause = options.cause;
  }
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-error-contract:END

assertContractSpineSemanticMigrationSourceIntegrityWhenAvailable();

const EXECUTION_ATTEMPTS_TABLE_SQL = `
  CREATE TABLE execution_attempts (
    attempt_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    story_id TEXT NOT NULL DEFAULT '',
    generation INTEGER NOT NULL CHECK (generation > 0),
    fence_token TEXT NOT NULL,
    attempt_class TEXT NOT NULL CHECK (attempt_class IN (
      'product_implementation', 'evidence_only', 'infrastructure_retry', 'supervisor_repair'
    )),
    packet_hash TEXT,
    compilation_report_hash TEXT NOT NULL,
    slice_hash TEXT,
    source_before_sha TEXT NOT NULL,
    source_before_tree_hash TEXT NOT NULL,
    source_after_sha TEXT,
    source_after_tree_hash TEXT,
    finding_set_hash TEXT,
    dedupe_key TEXT,
    role TEXT NOT NULL,
    agent_id TEXT,
    branch TEXT,
    worktree TEXT,
    lease_acquired_at TIMESTAMPTZ NOT NULL,
    lease_expires_at TIMESTAMPTZ NOT NULL,
    heartbeat_at TIMESTAMPTZ NOT NULL,
    disposition TEXT NOT NULL CHECK (disposition IN (
      'claimed', 'running', 'produced_delta', 'already_satisfied', 'no_progress',
      'inconclusive', 'failed', 'verified', 'superseded'
    )),
    output_hash TEXT,
    evidence_refs TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (lease_expires_at >= lease_acquired_at),
    CHECK ((source_after_sha IS NULL) = (source_after_tree_hash IS NULL)),
    CHECK (slice_hash IS NULL OR packet_hash IS NOT NULL),
    CHECK (
      (dedupe_key IS NOT NULL) = (
        attempt_class = 'product_implementation'
        AND packet_hash IS NOT NULL
        AND finding_set_hash IS NOT NULL
      )
    )
  )
`;

const EXECUTION_ATTEMPT_INDEX_SQL = [
  "CREATE UNIQUE INDEX idx_execution_attempts_active_fence ON execution_attempts(run_id, step_id, story_id) WHERE disposition IN ('claimed', 'running')",
  "CREATE UNIQUE INDEX idx_execution_attempts_dedupe ON execution_attempts(dedupe_key) WHERE dedupe_key IS NOT NULL",
  "CREATE INDEX idx_execution_attempts_run_story ON execution_attempts(run_id, story_id, created_at DESC)",
  "CREATE INDEX idx_execution_attempts_lease_expiration ON execution_attempts(lease_expires_at) WHERE disposition IN ('claimed', 'running')",
  "CREATE INDEX idx_execution_attempts_packet_source_finding ON execution_attempts(packet_hash, source_before_sha, finding_set_hash) WHERE packet_hash IS NOT NULL",
] as const;

type MigrationDefinition = Readonly<{
  version: number;
  name: string;
  statements: readonly string[];
  detect(sql: Sql | TransactionSql): Promise<"absent" | "present" | "partial">;
  verify(sql: Sql | TransactionSql): Promise<void>;
}>;

type Migration = MigrationDefinition & (
  | Readonly<{
      implementationDigest: string;
      apply(sql: TransactionSql): Promise<void>;
    }>
  | Readonly<{
      implementationDigest?: never;
      apply?: never;
    }>
);

function checksum(migration: Migration): string {
  return computeContractSpineMigrationChecksumV1(migration);
}

type JournalRow = {
  version: number;
  name: string;
  checksum: string;
  state: string;
};

export type ContractSpineMigrationPlan = Readonly<{
  schema: "setfarm.contract-spine-migration-plan.v1";
  status: "current" | "pending" | "drift";
  migrations: ReadonlyArray<Readonly<{
    version: number;
    name: string;
    checksum: string;
    state:
      | "pending"
      | "adoptable"
      | "applied"
      | "adopted"
      | "checksum_mismatch"
      | "adoption_mismatch"
      | "unexpected";
  }>>;
}>;

export type ContractSpineMigrationApplyResult = Readonly<{
  schema: "setfarm.contract-spine-migration-apply.v1";
  applied: string[];
  adopted: string[];
  alreadyApplied: string[];
}>;

export type RecoveryTerminalLeaseRollbackResult = Readonly<{
  schema: "setfarm.contract-spine-rollback.v1";
  rollbackId: string;
  fromVersion: 20;
  targetVersion: 19;
  targetReleaseSha: string;
  rowsRewritten: number;
  appliedAt: string;
}>;

export type OperationalFailureCauseSealRollbackResult = Readonly<{
  schema: "setfarm.contract-spine-rollback.v1";
  rollbackId: string;
  fromVersion: 21;
  targetVersion: 20;
  targetReleaseSha: string;
  rowsRewritten: 0;
  appliedAt: string;
}>;

export type ProductCompilationAttemptLedgerRollbackResult = Readonly<{
  schema: "setfarm.contract-spine-rollback.v1";
  rollbackId: string;
  fromVersion: 22;
  targetVersion: 21;
  targetReleaseSha: string;
  rowsRewritten: 0;
  appliedAt: string;
}>;

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

async function relationExists(sql: Sql | TransactionSql, relation: string): Promise<boolean> {
  const rows = await sql.unsafe<{ relation: string | null }[]>(
    "SELECT to_regclass($1)::text AS relation",
    [`public.${relation}`],
  );
  return rows[0]?.relation === relation || rows[0]?.relation === `public.${relation}`;
}

const expectedAttemptColumns = new Map<string, Readonly<{
  dataType: string;
  nullable: "YES" | "NO";
}>>([
  ["attempt_id", { dataType: "text", nullable: "NO" }],
  ["run_id", { dataType: "text", nullable: "NO" }],
  ["step_id", { dataType: "text", nullable: "NO" }],
  ["story_id", { dataType: "text", nullable: "NO" }],
  ["generation", { dataType: "integer", nullable: "NO" }],
  ["fence_token", { dataType: "text", nullable: "NO" }],
  ["attempt_class", { dataType: "text", nullable: "NO" }],
  ["packet_hash", { dataType: "text", nullable: "YES" }],
  ["compilation_report_hash", { dataType: "text", nullable: "NO" }],
  ["slice_hash", { dataType: "text", nullable: "YES" }],
  ["source_before_sha", { dataType: "text", nullable: "NO" }],
  ["source_before_tree_hash", { dataType: "text", nullable: "NO" }],
  ["source_after_sha", { dataType: "text", nullable: "YES" }],
  ["source_after_tree_hash", { dataType: "text", nullable: "YES" }],
  ["finding_set_hash", { dataType: "text", nullable: "YES" }],
  ["dedupe_key", { dataType: "text", nullable: "YES" }],
  ["role", { dataType: "text", nullable: "NO" }],
  ["agent_id", { dataType: "text", nullable: "YES" }],
  ["branch", { dataType: "text", nullable: "YES" }],
  ["worktree", { dataType: "text", nullable: "YES" }],
  ["lease_acquired_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["lease_expires_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["heartbeat_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["disposition", { dataType: "text", nullable: "NO" }],
  ["output_hash", { dataType: "text", nullable: "YES" }],
  ["evidence_refs", { dataType: "text", nullable: "NO" }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
]);

const expectedAttemptIndexes = new Map<string, string>([
  ["execution_attempts_pkey", "create unique index execution_attempts_pkey on public.execution_attempts using btree (attempt_id)"],
  ["idx_execution_attempts_active_fence", "create unique index idx_execution_attempts_active_fence on public.execution_attempts using btree (run_id, step_id, story_id) where (disposition = any (array['claimed'::text, 'running'::text]))"],
  ["idx_execution_attempts_dedupe", "create unique index idx_execution_attempts_dedupe on public.execution_attempts using btree (dedupe_key) where (dedupe_key is not null)"],
  ["idx_execution_attempts_lease_expiration", "create index idx_execution_attempts_lease_expiration on public.execution_attempts using btree (lease_expires_at) where (disposition = any (array['claimed'::text, 'running'::text]))"],
  ["idx_execution_attempts_packet_source_finding", "create index idx_execution_attempts_packet_source_finding on public.execution_attempts using btree (packet_hash, source_before_sha, finding_set_hash) where (packet_hash is not null)"],
  ["idx_execution_attempts_run_story", "create index idx_execution_attempts_run_story on public.execution_attempts using btree (run_id, story_id, created_at desc)"],
]);

const requiredConstraintFragments = [
  "primary key (attempt_id)",
  "generation > 0",
  "attempt_class = any",
  "lease_expires_at >= lease_acquired_at",
  "(source_after_sha is null) = (source_after_tree_hash is null)",
  "slice_hash is null or packet_hash is not null",
  "(dedupe_key is not null) =",
  "disposition = any",
] as const;

async function verifyExecutionAttemptsShape(sql: Sql | TransactionSql): Promise<void> {
  const columns = await sql.unsafe<Array<{
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
  }>>(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'execution_attempts'
      ORDER BY ordinal_position`,
  );
  const actualColumns = new Map(columns.map((column) => [column.column_name, column]));
  if (actualColumns.size < expectedAttemptColumns.size) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `execution_attempts column count mismatch: expected ${expectedAttemptColumns.size}, got ${actualColumns.size}`,
    );
  }
  for (const [name, expected] of expectedAttemptColumns) {
    const actual = actualColumns.get(name);
    if (!actual || actual.data_type !== expected.dataType || actual.is_nullable !== expected.nullable) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `execution_attempts column mismatch: ${name}`,
      );
    }
  }

  const indexes = await sql.unsafe<Array<{ indexname: string; indexdef: string }>>(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'execution_attempts'
      ORDER BY indexname`,
  );
  const actualIndexes = new Map(indexes.map((index) => [index.indexname, normalizeSql(index.indexdef)]));
  if (actualIndexes.size < expectedAttemptIndexes.size) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `execution_attempts index count mismatch: expected ${expectedAttemptIndexes.size}, got ${actualIndexes.size}`,
    );
  }
  for (const [name, expected] of expectedAttemptIndexes) {
    if (actualIndexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `execution_attempts index mismatch: ${name}`,
      );
    }
  }

  const constraints = await sql.unsafe<Array<{ definition: string }>>(
    `SELECT pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.execution_attempts'::regclass
      ORDER BY conname`,
  );
  const normalizedConstraints = constraints.map((item) => normalizeSql(item.definition));
  if (normalizedConstraints.length < requiredConstraintFragments.length) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `execution_attempts constraint count mismatch: expected ${requiredConstraintFragments.length}, got ${normalizedConstraints.length}`,
    );
  }
  for (const fragment of requiredConstraintFragments) {
    if (!normalizedConstraints.some((definition) => definition.includes(fragment))) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `execution_attempts constraint mismatch: ${fragment}`,
      );
    }
  }
}

const RUN_PROTOCOL_STATEMENTS = [
  "CREATE SEQUENCE IF NOT EXISTS runs_run_number_seq",
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    run_number INTEGER NOT NULL DEFAULT nextval('runs_run_number_seq'::regclass),
    workflow_id TEXT NOT NULL,
    task TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    context TEXT NOT NULL DEFAULT '{}',
    meta TEXT,
    notify_url TEXT,
    assigned_developer TEXT,
    protocol TEXT NOT NULL DEFAULT 'legacy',
    protocol_version INTEGER NOT NULL DEFAULT 1,
    compiler_release_sha TEXT,
    packet_hash TEXT,
    activation_preflight_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  "ALTER TABLE runs ADD COLUMN IF NOT EXISTS protocol TEXT NOT NULL DEFAULT 'legacy'",
  "ALTER TABLE runs ADD COLUMN IF NOT EXISTS protocol_version INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE runs ADD COLUMN IF NOT EXISTS compiler_release_sha TEXT",
  "ALTER TABLE runs ADD COLUMN IF NOT EXISTS packet_hash TEXT",
  "ALTER TABLE runs ADD COLUMN IF NOT EXISTS activation_preflight_hash TEXT",
  "ALTER TABLE runs ADD CONSTRAINT runs_protocol_mode_check CHECK (protocol IN ('legacy', 'shadow', 'v3'))",
  "ALTER TABLE runs ADD CONSTRAINT runs_protocol_version_check CHECK (protocol_version = 1)",
  "ALTER TABLE runs ADD CONSTRAINT runs_compiler_release_sha_check CHECK (compiler_release_sha IS NULL OR compiler_release_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$')",
  "ALTER TABLE runs ADD CONSTRAINT runs_packet_hash_check CHECK (packet_hash IS NULL OR packet_hash ~ '^[a-f0-9]{64}$')",
  "ALTER TABLE runs ADD CONSTRAINT runs_activation_preflight_hash_check CHECK (activation_preflight_hash IS NULL OR activation_preflight_hash ~ '^[a-f0-9]{64}$')",
  "ALTER TABLE runs ADD CONSTRAINT runs_protocol_release_check CHECK (protocol = 'legacy' OR compiler_release_sha IS NOT NULL)",
  "ALTER TABLE runs ADD CONSTRAINT runs_v3_preflight_check CHECK (protocol <> 'v3' OR activation_preflight_hash IS NOT NULL)",
  `CREATE FUNCTION setfarm_enforce_run_protocol_identity() RETURNS trigger
   LANGUAGE plpgsql AS $$
   BEGIN
     IF OLD.protocol IS DISTINCT FROM NEW.protocol
        OR OLD.protocol_version IS DISTINCT FROM NEW.protocol_version
        OR OLD.compiler_release_sha IS DISTINCT FROM NEW.compiler_release_sha THEN
       RAISE EXCEPTION 'RUN_PROTOCOL_IMMUTABLE' USING ERRCODE = '23514';
     END IF;
     IF OLD.packet_hash IS NOT NULL
        AND OLD.packet_hash IS DISTINCT FROM NEW.packet_hash THEN
       RAISE EXCEPTION 'RUN_PACKET_HASH_IMMUTABLE' USING ERRCODE = '23514';
     END IF;
     IF OLD.activation_preflight_hash IS NOT NULL
        AND OLD.activation_preflight_hash IS DISTINCT FROM NEW.activation_preflight_hash THEN
       RAISE EXCEPTION 'RUN_PREFLIGHT_HASH_IMMUTABLE' USING ERRCODE = '23514';
     END IF;
     RETURN NEW;
   END;
   $$`,
  `CREATE TRIGGER trg_runs_protocol_identity_immutable
   BEFORE UPDATE OF protocol, protocol_version, compiler_release_sha,
                    packet_hash, activation_preflight_hash
   ON runs FOR EACH ROW
   EXECUTE FUNCTION setfarm_enforce_run_protocol_identity()`,
] as const;

const expectedRunProtocolColumns = new Map<string, Readonly<{
  dataType: string;
  nullable: "YES" | "NO";
  defaultFragment?: string;
}>>([
  ["protocol", { dataType: "text", nullable: "NO", defaultFragment: "'legacy'::text" }],
  ["protocol_version", { dataType: "integer", nullable: "NO", defaultFragment: "1" }],
  ["compiler_release_sha", { dataType: "text", nullable: "YES" }],
  ["packet_hash", { dataType: "text", nullable: "YES" }],
  ["activation_preflight_hash", { dataType: "text", nullable: "YES" }],
]);

const expectedRunProtocolConstraints = new Map<string, string>([
  ["runs_protocol_mode_check", "protocol = any"],
  ["runs_protocol_version_check", "protocol_version = 1"],
  ["runs_compiler_release_sha_check", "compiler_release_sha is null or"],
  ["runs_packet_hash_check", "packet_hash is null or"],
  ["runs_activation_preflight_hash_check", "activation_preflight_hash is null or"],
  ["runs_protocol_release_check", "protocol = 'legacy'::text or compiler_release_sha is not null"],
  ["runs_v3_preflight_check", "protocol <> 'v3'::text or activation_preflight_hash is not null"],
]);

const MIGRATION_ATTESTATION_STATEMENTS = [
  "ALTER TABLE setfarm_schema_migrations ADD COLUMN verified_release_sha TEXT",
  "ALTER TABLE setfarm_schema_migrations ADD COLUMN verified_at TIMESTAMPTZ",
  "ALTER TABLE setfarm_schema_migrations ADD CONSTRAINT setfarm_schema_migrations_verified_release_check CHECK (verified_release_sha IS NULL OR verified_release_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$')",
  "ALTER TABLE setfarm_schema_migrations ADD CONSTRAINT setfarm_schema_migrations_verified_pair_check CHECK ((verified_release_sha IS NULL) = (verified_at IS NULL))",
] as const;

async function detectMigrationAttestationShape(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  if (!await relationExists(sql, "setfarm_schema_migrations")) return "absent";
  const rows = await sql.unsafe<Array<{ column_name: string }>>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'setfarm_schema_migrations'
        AND column_name = ANY($1::text[])`,
    [["verified_release_sha", "verified_at"]],
  );
  if (rows.length === 0) return "absent";
  if (rows.length === 2) return "present";
  return "partial";
}

async function verifyMigrationAttestationShape(sql: Sql | TransactionSql): Promise<void> {
  const columns = await sql.unsafe<Array<{
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
  }>>(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'setfarm_schema_migrations'
        AND column_name = ANY($1::text[])`,
    [["verified_release_sha", "verified_at"]],
  );
  const actual = new Map(columns.map((column) => [column.column_name, column]));
  if (
    actual.get("verified_release_sha")?.data_type !== "text"
    || actual.get("verified_release_sha")?.is_nullable !== "YES"
    || actual.get("verified_at")?.data_type !== "timestamp with time zone"
    || actual.get("verified_at")?.is_nullable !== "YES"
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "migration attestation columns do not match the expected shape",
    );
  }
  const constraints = await sql.unsafe<Array<{ conname: string; definition: string }>>(
    `SELECT conname, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.setfarm_schema_migrations'::regclass
        AND conname = ANY($1::text[])`,
    [[
      "setfarm_schema_migrations_verified_release_check",
      "setfarm_schema_migrations_verified_pair_check",
    ]],
  );
  const actualConstraints = new Map(constraints.map((constraint) => [
    constraint.conname,
    normalizeSql(constraint.definition),
  ]));
  if (
    !actualConstraints.get("setfarm_schema_migrations_verified_release_check")?.includes(
      "verified_release_sha is null or verified_release_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'::text",
    )
    || !actualConstraints.get("setfarm_schema_migrations_verified_pair_check")?.includes(
      "(verified_release_sha is null) = (verified_at is null)",
    )
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "migration attestation constraints do not match the expected shape",
    );
  }
}

const COMPILER_PREFLIGHT_IDENTITY_STATEMENTS = [
  "ALTER TABLE runs ADD CONSTRAINT runs_compiler_preflight_check CHECK (protocol = 'legacy' OR activation_preflight_hash IS NOT NULL)",
] as const;

async function detectCompilerPreflightIdentity(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  if (!await relationExists(sql, "runs")) return "absent";
  const rows = await sql.unsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.runs'::regclass
          AND conname = 'runs_compiler_preflight_check'
     ) AS exists`,
  );
  return rows[0]?.exists ? "present" : "absent";
}

async function verifyCompilerPreflightIdentity(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{ definition: string }>>(
    `SELECT pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.runs'::regclass
        AND conname = 'runs_compiler_preflight_check'`,
  );
  if (
    rows.length !== 1
    || !normalizeSql(rows[0]!.definition).includes(
      "protocol = 'legacy'::text or activation_preflight_hash is not null",
    )
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "compiler run preflight identity constraint does not match the expected shape",
    );
  }
}

const CLAIM_ATTEMPT_BINDING_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS claim_log (
    id BIGSERIAL PRIMARY KEY,
    run_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    story_id TEXT,
    agent_id TEXT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome TEXT,
    abandoned_at TIMESTAMPTZ,
    duration_ms INTEGER,
    diagnostic TEXT
  )`,
  "ALTER TABLE execution_attempts ADD COLUMN claim_id BIGINT",
  `WITH exact_claim_refs AS (
     SELECT ea.attempt_id,
            MIN(substring(ref.value FROM '^setfarm://claim-log/([1-9][0-9]*)$')::bigint) AS claim_id,
            COUNT(*)::integer AS ref_count
       FROM execution_attempts ea
       CROSS JOIN LATERAL jsonb_array_elements_text(ea.evidence_refs::jsonb) AS ref(value)
      WHERE ref.value ~ '^setfarm://claim-log/[1-9][0-9]*$'
      GROUP BY ea.attempt_id
     HAVING COUNT(*) = 1
   )
   UPDATE execution_attempts ea
      SET claim_id = refs.claim_id
     FROM exact_claim_refs refs
     JOIN claim_log cl ON cl.id = refs.claim_id
    WHERE ea.attempt_id = refs.attempt_id
      AND ea.run_id = cl.run_id
      AND ea.step_id = cl.step_id
      AND ea.story_id = COALESCE(cl.story_id, '')
      AND (ea.agent_id IS NULL OR ea.agent_id = cl.agent_id)`,
  `ALTER TABLE execution_attempts
     ADD CONSTRAINT execution_attempts_claim_id_fkey
     FOREIGN KEY (claim_id) REFERENCES claim_log(id) ON DELETE SET NULL`,
  "CREATE UNIQUE INDEX idx_execution_attempts_claim_id_unique ON execution_attempts(claim_id) WHERE claim_id IS NOT NULL",
  `DO $$
   BEGIN
     IF EXISTS (
       SELECT 1 FROM claim_log
        WHERE outcome IS NULL AND story_id IS NULL
        GROUP BY run_id, step_id HAVING COUNT(*) > 1
     ) THEN
       RAISE EXCEPTION 'CLAIM_LOG_OPEN_SINGLE_DUPLICATE_REQUIRES_RECOVERY' USING ERRCODE = '23505';
     END IF;
     IF EXISTS (
       SELECT 1 FROM claim_log
        WHERE outcome IS NULL AND story_id IS NOT NULL
        GROUP BY run_id, step_id, story_id HAVING COUNT(*) > 1
     ) THEN
       RAISE EXCEPTION 'CLAIM_LOG_OPEN_STORY_DUPLICATE_REQUIRES_RECOVERY' USING ERRCODE = '23505';
     END IF;
   END
   $$`,
  "DROP INDEX IF EXISTS idx_claim_log_open_single_unique",
  "DROP INDEX IF EXISTS idx_claim_log_open_story_unique",
  "CREATE UNIQUE INDEX idx_claim_log_open_single_unique ON claim_log(run_id, step_id) WHERE outcome IS NULL AND story_id IS NULL",
  "CREATE UNIQUE INDEX idx_claim_log_open_story_unique ON claim_log(run_id, step_id, story_id) WHERE outcome IS NULL AND story_id IS NOT NULL",
] as const;

const EXPECTED_CLAIM_BINDING_INDEXES = new Map<string, string>([
  [
    "idx_execution_attempts_claim_id_unique",
    "create unique index idx_execution_attempts_claim_id_unique on public.execution_attempts using btree (claim_id) where (claim_id is not null)",
  ],
  [
    "idx_claim_log_open_single_unique",
    "create unique index idx_claim_log_open_single_unique on public.claim_log using btree (run_id, step_id) where ((outcome is null) and (story_id is null))",
  ],
  [
    "idx_claim_log_open_story_unique",
    "create unique index idx_claim_log_open_story_unique on public.claim_log using btree (run_id, step_id, story_id) where ((outcome is null) and (story_id is not null))",
  ],
]);

async function readClaimAttemptBindingFeatures(sql: Sql | TransactionSql): Promise<Readonly<{
  claimColumn: boolean;
  claimForeignKey: boolean;
  indexes: Map<string, string>;
}>> {
  if (!await relationExists(sql, "execution_attempts") || !await relationExists(sql, "claim_log")) {
    return { claimColumn: false, claimForeignKey: false, indexes: new Map() };
  }
  const columns = await sql.unsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'execution_attempts'
          AND column_name = 'claim_id'
          AND data_type = 'bigint'
          AND is_nullable = 'YES'
     ) AS exists`,
  );
  const constraints = await sql.unsafe<Array<{ definition: string }>>(
    `SELECT pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.execution_attempts'::regclass
        AND conname = 'execution_attempts_claim_id_fkey'`,
  );
  const indexes = await sql.unsafe<Array<{ indexname: string; indexdef: string }>>(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])`,
    [[...EXPECTED_CLAIM_BINDING_INDEXES.keys()]],
  );
  return {
    claimColumn: columns[0]?.exists ?? false,
    claimForeignKey: constraints.length === 1
      && normalizeSql(constraints[0]!.definition).includes(
        "foreign key (claim_id) references claim_log(id) on delete set null",
      ),
    indexes: new Map(indexes.map((index) => [index.indexname, normalizeSql(index.indexdef)])),
  };
}

async function detectClaimAttemptBinding(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const features = await readClaimAttemptBindingFeatures(sql);
  const matchingIndexes = [...EXPECTED_CLAIM_BINDING_INDEXES].filter(
    ([name, expected]) => features.indexes.get(name) === expected,
  ).length;
  if (features.claimColumn && features.claimForeignKey && matchingIndexes === EXPECTED_CLAIM_BINDING_INDEXES.size) {
    return "present";
  }
  if (!features.claimColumn && !features.claimForeignKey && matchingIndexes === 0) return "absent";
  return "partial";
}

async function verifyClaimAttemptBinding(sql: Sql | TransactionSql): Promise<void> {
  const features = await readClaimAttemptBindingFeatures(sql);
  if (!features.claimColumn || !features.claimForeignKey) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "execution attempt claim binding column or foreign key is missing",
    );
  }
  for (const [name, expected] of EXPECTED_CLAIM_BINDING_INDEXES) {
    if (features.indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `claim ownership index mismatch: ${name}`,
      );
    }
  }
}

const RUNTIME_OWNERSHIP_STATEMENTS = [
  "CREATE UNIQUE INDEX idx_claim_log_id_run_unique ON claim_log(id, run_id)",
  "CREATE UNIQUE INDEX idx_execution_attempts_attempt_claim_unique ON execution_attempts(attempt_id, claim_id)",
  `CREATE TABLE runtime_sessions (
    session_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    step_db_id TEXT NOT NULL,
    workflow_step_id TEXT NOT NULL,
    story_db_id TEXT,
    story_id TEXT,
    claim_id BIGINT NOT NULL UNIQUE,
    attempt_id TEXT UNIQUE,
    claim_agent_id TEXT NOT NULL,
    runtime_agent_id TEXT NOT NULL,
    runtime_kind TEXT NOT NULL CHECK (runtime_kind IN (
      'local_process', 'openclaw_session', 'external_session'
    )),
    session_key TEXT,
    pid INTEGER,
    process_started_at TIMESTAMPTZ,
    worktree TEXT,
    runtime_path TEXT,
    transcript_path TEXT,
    state TEXT NOT NULL CHECK (state IN (
      'reserved', 'starting', 'running', 'drain_requested',
      'drained', 'released', 'quarantined'
    )),
    owner_instance_id TEXT NOT NULL,
    state_version INTEGER NOT NULL DEFAULT 1 CHECK (state_version > 0),
    started_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ NOT NULL,
    drain_requested_at TIMESTAMPTZ,
    drained_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    diagnostic TEXT,
    drain_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT runtime_sessions_claim_run_fkey
      FOREIGN KEY (claim_id, run_id) REFERENCES claim_log(id, run_id),
    CONSTRAINT runtime_sessions_attempt_claim_fkey
      FOREIGN KEY (attempt_id, claim_id) REFERENCES execution_attempts(attempt_id, claim_id),
    CHECK ((story_id IS NULL) = (story_db_id IS NULL)),
    CHECK (pid IS NULL OR pid > 0),
    CHECK (jsonb_typeof(drain_evidence) = 'object'),
    CHECK (state NOT IN ('drained', 'released') OR drained_at IS NOT NULL),
    CHECK (state <> 'released' OR released_at IS NOT NULL),
    CHECK (state <> 'quarantined' OR NULLIF(diagnostic, '') IS NOT NULL)
  )`,
  "CREATE INDEX idx_runtime_sessions_run_state ON runtime_sessions(run_id, state, created_at)",
  "CREATE INDEX idx_runtime_sessions_owner_state ON runtime_sessions(owner_instance_id, state, updated_at)",
  "CREATE INDEX idx_runtime_sessions_heartbeat ON runtime_sessions(heartbeat_at) WHERE state IN ('starting', 'running', 'drain_requested')",
  `CREATE TABLE run_termination_requests (
    request_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    target_status TEXT NOT NULL CHECK (target_status IN ('cancelled', 'failed')),
    state TEXT NOT NULL CHECK (state IN (
      'requested', 'draining', 'drained', 'terminalized', 'quarantined'
    )),
    requested_by TEXT NOT NULL,
    owner_instance_id TEXT,
    lease_expires_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL,
    drained_at TIMESTAMPTZ,
    terminalized_at TIMESTAMPTZ,
    diagnostic TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(evidence) = 'object'),
    CHECK (state NOT IN ('drained', 'terminalized') OR drained_at IS NOT NULL),
    CHECK (state <> 'terminalized' OR terminalized_at IS NOT NULL),
    CHECK (state <> 'quarantined' OR NULLIF(diagnostic, '') IS NOT NULL)
  )`,
  "CREATE UNIQUE INDEX idx_run_termination_requests_open_unique ON run_termination_requests(run_id) WHERE state <> 'terminalized'",
  "CREATE INDEX idx_run_termination_requests_state_lease ON run_termination_requests(state, lease_expires_at, requested_at)",
] as const;

const RUNTIME_COMPLETION_OWNERSHIP_STATEMENTS = [
  "CREATE UNIQUE INDEX idx_runtime_sessions_session_claim_run_unique ON runtime_sessions(session_id, claim_id, run_id)",
  `CREATE TABLE runtime_completion_requests (
    request_id TEXT PRIMARY KEY,
    runtime_session_id TEXT NOT NULL,
    claim_id BIGINT NOT NULL,
    run_id TEXT NOT NULL,
    step_db_id TEXT NOT NULL,
    workflow_step_id TEXT NOT NULL,
    story_db_id TEXT,
    story_id TEXT,
    attempt_id TEXT,
    claim_envelope JSONB NOT NULL,
    output TEXT NOT NULL,
    output_hash TEXT NOT NULL,
    apply_phase TEXT NOT NULL DEFAULT 'proposed',
    claim_outcome TEXT,
    claim_committed_at TIMESTAMPTZ,
    effects_committed_at TIMESTAMPTZ,
    state TEXT NOT NULL CHECK (state IN (
      'requested', 'draining', 'processing', 'accepted', 'rejected', 'quarantined'
    )),
    requested_by TEXT NOT NULL,
    owner_instance_id TEXT,
    lease_expires_at TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL,
    drained_at TIMESTAMPTZ,
    processing_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    diagnostic TEXT,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT runtime_completion_requests_runtime_owner_fkey
      FOREIGN KEY (runtime_session_id, claim_id, run_id)
      REFERENCES runtime_sessions(session_id, claim_id, run_id),
    CONSTRAINT runtime_completion_requests_story_pair_check
      CHECK ((story_id IS NULL) = (story_db_id IS NULL)),
    CONSTRAINT runtime_completion_requests_output_hash_check
      CHECK (output_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT runtime_completion_requests_envelope_object_check
      CHECK (jsonb_typeof(claim_envelope) = 'object'),
    CONSTRAINT runtime_completion_requests_result_object_check
      CHECK (jsonb_typeof(result) = 'object'),
    CONSTRAINT runtime_completion_requests_output_size_check
      CHECK (octet_length(output) BETWEEN 1 AND 4194304),
    CONSTRAINT runtime_completion_requests_terminal_time_check
      CHECK (
        (state = 'accepted') = (accepted_at IS NOT NULL)
        AND (state = 'rejected') = (rejected_at IS NOT NULL)
      ),
    CONSTRAINT runtime_completion_requests_processing_time_check
      CHECK (state <> 'processing' OR processing_at IS NOT NULL),
    CONSTRAINT runtime_completion_requests_apply_phase_value_check
      CHECK (apply_phase IN (
        'proposed', 'executing', 'owner_committed', 'effects_committed'
      )),
    CONSTRAINT runtime_completion_requests_apply_receipt_check
      CHECK (
        (apply_phase IN ('owner_committed', 'effects_committed')) = (claim_committed_at IS NOT NULL)
        AND (apply_phase = 'effects_committed') = (effects_committed_at IS NOT NULL)
        AND (claim_committed_at IS NULL) = (claim_outcome IS NULL)
        AND (state <> 'accepted' OR apply_phase = 'effects_committed')
      ),
    CONSTRAINT runtime_completion_requests_quarantine_check
      CHECK (state <> 'quarantined' OR NULLIF(diagnostic, '') IS NOT NULL)
  )`,
  "CREATE UNIQUE INDEX idx_runtime_completion_requests_session_unique ON runtime_completion_requests(runtime_session_id)",
  "CREATE UNIQUE INDEX idx_runtime_completion_requests_claim_unique ON runtime_completion_requests(claim_id)",
  "CREATE INDEX idx_runtime_completion_requests_state_lease ON runtime_completion_requests(state, lease_expires_at, requested_at)",
] as const;

const RUNTIME_COMPLETION_EFFECT_LEDGER_STATEMENTS = [
  `ALTER TABLE runtime_sessions
     ADD COLUMN process_group_id INTEGER,
     ADD COLUMN process_identity JSONB NOT NULL DEFAULT '{}'::jsonb,
     ADD CONSTRAINT runtime_sessions_process_group_check
       CHECK (process_group_id IS NULL OR process_group_id > 0),
     ADD CONSTRAINT runtime_sessions_process_identity_object_check
       CHECK (jsonb_typeof(process_identity) = 'object')`,
  "-- SETFARM_SEMANTIC_PROCESS_IDENTITY_BACKFILL_V1",
  `ALTER TABLE runtime_sessions
     ADD CONSTRAINT runtime_sessions_process_identity_binding_check
       CHECK (
         (
           pid IS NULL
           AND process_group_id IS NULL
           AND process_identity = '{}'::jsonb
         )
         OR
         (
           pid IS NOT NULL
           AND process_identity ->> 'schema' = 'setfarm.process-identity.v1'
           AND process_identity ->> 'pid' = pid::text
           AND NULLIF(process_identity ->> 'processStartedAt', '') IS NOT NULL
           AND process_identity ->> 'source' IN ('observed_os', 'tracked_child', 'legacy-backfill')
           AND (
             (process_group_id IS NULL AND process_identity ->> 'processGroupId' IS NULL)
             OR process_identity ->> 'processGroupId' = process_group_id::text
           )
         )
       )`,
  `ALTER TABLE runtime_completion_requests
     ADD COLUMN completion_plan JSONB,
     ADD COLUMN completion_plan_hash TEXT,
     ADD COLUMN prepared_at TIMESTAMPTZ,
     ADD COLUMN owner_attempt_count INTEGER NOT NULL DEFAULT 0,
     ADD CONSTRAINT runtime_completion_requests_owner_attempt_count_check
       CHECK (owner_attempt_count BETWEEN 0 AND 3)`,
  "-- SETFARM_SEMANTIC_RUNTIME_COMPLETION_PLAN_BACKFILL_V1",
  `ALTER TABLE runtime_completion_requests
     ADD CONSTRAINT runtime_completion_requests_plan_pair_check
       CHECK ((completion_plan IS NULL) = (completion_plan_hash IS NULL)
         AND (completion_plan IS NULL) = (prepared_at IS NULL)),
     ADD CONSTRAINT runtime_completion_requests_plan_object_check
       CHECK (completion_plan IS NULL OR jsonb_typeof(completion_plan) = 'object'),
     ADD CONSTRAINT runtime_completion_requests_plan_hash_check
       CHECK (completion_plan_hash IS NULL OR completion_plan_hash ~ '^[a-f0-9]{64}$'),
     ADD CONSTRAINT runtime_completion_requests_owner_plan_check
       CHECK (apply_phase NOT IN ('owner_committed', 'effects_committed') OR completion_plan IS NOT NULL)`,
  `CREATE TABLE runtime_completion_effects (
    request_id TEXT NOT NULL REFERENCES runtime_completion_requests(request_id) ON DELETE CASCADE,
    effect_key TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    effect_type TEXT NOT NULL,
    input_hash TEXT NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
    payload JSONB NOT NULL,
    mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    state TEXT NOT NULL CHECK (state IN (
      'pending', 'leased', 'applied', 'reconciled', 'quarantined'
    )),
    owner_instance_id TEXT,
    lease_token TEXT,
    lease_expires_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    applied_at TIMESTAMPTZ,
    reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (request_id, effect_key),
    UNIQUE (request_id, ordinal),
    CHECK (jsonb_typeof(payload) = 'object'),
    CHECK (jsonb_typeof(result) = 'object'),
    CHECK (jsonb_typeof(evidence) = 'object'),
    CHECK ((state = 'leased') = (lease_token IS NOT NULL)),
    CHECK ((state = 'leased') = (lease_expires_at IS NOT NULL)),
    CHECK (state <> 'applied' OR applied_at IS NOT NULL),
    CHECK (state <> 'reconciled' OR reconciled_at IS NOT NULL),
    CHECK (state <> 'quarantined' OR NULLIF(result->>'diagnostic', '') IS NOT NULL)
  )`,
  "-- SETFARM_SEMANTIC_RUNTIME_COMPLETION_EFFECT_BACKFILL_V1",
  "CREATE INDEX idx_runtime_completion_effects_claimable ON runtime_completion_effects(state, lease_expires_at, request_id, ordinal)",
  "CREATE INDEX idx_runtime_completion_effects_request_state ON runtime_completion_effects(request_id, state, ordinal)",
  `CREATE TABLE operational_outbox (
    outbox_id TEXT PRIMARY KEY,
    request_id TEXT REFERENCES runtime_completion_requests(request_id) ON DELETE SET NULL,
    event_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending', 'leased', 'published', 'quarantined')),
    owner_instance_id TEXT,
    lease_token TEXT,
    lease_expires_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    published_at TIMESTAMPTZ,
    diagnostic TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(payload) = 'object'),
    CHECK ((state = 'leased') = (lease_token IS NOT NULL)),
    CHECK ((state = 'leased') = (lease_expires_at IS NOT NULL)),
    CHECK (state <> 'published' OR published_at IS NOT NULL),
    CHECK (state <> 'quarantined' OR NULLIF(diagnostic, '') IS NOT NULL)
  )`,
  "CREATE INDEX idx_operational_outbox_claimable ON operational_outbox(state, lease_expires_at, created_at)",
  "CREATE INDEX idx_operational_outbox_aggregate ON operational_outbox(aggregate_type, aggregate_id, created_at)",
] as const;

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v8-semantic-apply:BEGIN
const PROCESS_IDENTITY_BACKFILL_MARKER = "-- SETFARM_SEMANTIC_PROCESS_IDENTITY_BACKFILL_V1";
const COMPLETION_PLAN_BACKFILL_MARKER = "-- SETFARM_SEMANTIC_RUNTIME_COMPLETION_PLAN_BACKFILL_V1";
const COMPLETION_EFFECT_BACKFILL_MARKER = "-- SETFARM_SEMANTIC_RUNTIME_COMPLETION_EFFECT_BACKFILL_V1";

function v8MigrationTimestamp(value: Date | string, code: string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", code);
  }
  return parsed;
}

function migrationPositiveInteger(value: string | number, code: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", code);
  }
  return parsed;
}

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-object-helper:BEGIN
function migrationObject(value: unknown, code: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  } catch (cause) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", code, { cause });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", code);
  }
  return parsed as Record<string, unknown>;
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-object-helper:END

function v8SchemaParse<T>(code: string, parse: () => T): T {
  try {
    return parse();
  } catch (cause) {
    if (cause instanceof ContractSpineMigrationError) throw cause;
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", code, { cause });
  }
}

async function backfillSemanticProcessIdentities(sql: TransactionSql): Promise<void> {
  const unverifiableActive = await sql.unsafe<Array<{ session_id: string }>>(
    `SELECT session_id
       FROM runtime_sessions
      WHERE pid IS NOT NULL
        AND process_started_at IS NULL
        AND state IN ('reserved', 'starting', 'running', 'drain_requested')
      ORDER BY session_id
      LIMIT 10`,
  );
  if (unverifiableActive.length > 0) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `v8 cannot prove active legacy process identity: ${unverifiableActive.map((row) => row.session_id).join(",")}`,
    );
  }

  // A terminal legacy row cannot own a process any more. Preserve the old PID
  // as diagnostic evidence instead of fabricating a process start timestamp.
  await sql.unsafe(
    `UPDATE runtime_sessions
        SET diagnostic = CONCAT_WS(
              '; ', NULLIF(diagnostic, ''),
              'MIGRATION_V8_UNVERIFIABLE_TERMINAL_PROCESS_IDENTITY(pid=' || pid::text || ')'
            ),
            pid = NULL,
            process_started_at = NULL,
            process_group_id = NULL,
            process_identity = '{}'::jsonb,
            updated_at = NOW()
      WHERE pid IS NOT NULL
        AND process_started_at IS NULL
        AND state IN ('drained', 'released', 'quarantined')`,
  );
  const verifiable = await sql.unsafe<Array<{
    session_id: string;
    pid: number;
    process_started_at: Date | string;
  }>>(
    `SELECT session_id, pid, process_started_at
       FROM runtime_sessions
      WHERE pid IS NOT NULL
        AND process_started_at IS NOT NULL
        AND process_identity = '{}'::jsonb
      ORDER BY session_id
      FOR UPDATE`,
  );
  for (const row of verifiable) {
    const identity = v8SchemaParse(`v8 process identity invalid: ${row.session_id}`, () => ProcessIdentityV1Schema.parse({
      schema: "setfarm.process-identity.v1",
      pid: row.pid,
      processStartedAt: v8MigrationTimestamp(
        row.process_started_at,
        `v8 process start time invalid: ${row.session_id}`,
      ).toISOString(),
      source: "legacy-backfill",
    }));
    await sql.unsafe(
      `UPDATE runtime_sessions
          SET process_identity = $2::text::jsonb
        WHERE session_id = $1
          AND process_identity = '{}'::jsonb`,
      [row.session_id, JSON.stringify(identity)],
    );
  }
}

type LegacyCompletionPlanRow = Readonly<{
  request_id: string;
  claim_id: string | number;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  output_hash: string;
  prepared_at: Date | string;
}>;

async function backfillSemanticRuntimeCompletionPlans(sql: TransactionSql): Promise<void> {
  const ambiguousOwners = await sql.unsafe<Array<{ request_id: string }>>(
    `SELECT request_id
       FROM runtime_completion_requests
      WHERE apply_phase = 'owner_committed'
      ORDER BY request_id
      LIMIT 20
      FOR UPDATE`,
  );
  if (ambiguousOwners.length > 0) {
    // v7 durably recorded that the claim owner committed, but it did not
    // record which continuation/effects were intended. Guessing an effect here
    // can repeat or invent work. Stop the whole migration atomically; an exact
    // pre-v8 owner must first settle these rows while the legacy code still
    // understands their continuation.
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `v8 cannot prove legacy owner-committed continuation: ${ambiguousOwners.map((row) => row.request_id).join(",")}`,
    );
  }
  const rows = await sql.unsafe<LegacyCompletionPlanRow[]>(
    `SELECT request_id, claim_id::text AS claim_id, run_id, step_db_id,
            workflow_step_id, output_hash,
            COALESCE(claim_committed_at, processing_at, drained_at, requested_at) AS prepared_at
       FROM runtime_completion_requests
      WHERE apply_phase = 'effects_committed'
        AND completion_plan IS NULL
      ORDER BY request_id
      FOR UPDATE`,
  );
  for (const row of rows) {
    const prepared = v8SchemaParse(`v8 completion plan draft invalid: ${row.request_id}`, () => createRuntimeCompletionPlanV1({
      requestId: row.request_id,
      claimId: migrationPositiveInteger(row.claim_id, `v8 completion claim id invalid: ${row.request_id}`),
      runId: row.run_id,
      stepDbId: row.step_db_id,
      workflowStepId: row.workflow_step_id,
      outputHash: row.output_hash,
      descriptor: createSingleEffectCompletionPlanDescriptorV1({
        kind: "legacy_recovery",
        continuation: { type: "legacy_receipt_only" },
        effectType: "legacy.receipt",
        effectPayload: {
          schema: "setfarm.migration-v8-legacy-completion-receipt.v1",
          source: "legacy-effects-committed",
          replayable: false,
        },
      }),
      preparedAt: v8MigrationTimestamp(row.prepared_at, `v8 completion prepared time invalid: ${row.request_id}`),
    }));
    const updated = await sql.unsafe<Array<{ request_id: string }>>(
      `UPDATE runtime_completion_requests
          SET completion_plan = $2::text::jsonb,
              completion_plan_hash = $3,
              prepared_at = $4,
              updated_at = GREATEST(updated_at, $4)
        WHERE request_id = $1
          AND completion_plan IS NULL
        RETURNING request_id`,
      [row.request_id, JSON.stringify(prepared.plan), prepared.planHash, prepared.plan.preparedAt],
    );
    if (updated.length !== 1) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v8 completion plan backfill lost ownership: ${row.request_id}`,
      );
    }
  }
}

type LegacyCompletionEffectRow = Readonly<{
  request_id: string;
  apply_phase: string;
  completion_plan: unknown;
  completion_plan_hash: string;
  prepared_at: Date | string;
  effects_committed_at: Date | string | null;
  result: unknown;
}>;

async function backfillSemanticRuntimeCompletionEffects(sql: TransactionSql): Promise<void> {
  const rows = await sql.unsafe<LegacyCompletionEffectRow[]>(
    `SELECT request_id, apply_phase, completion_plan, completion_plan_hash,
            prepared_at, effects_committed_at, result
       FROM runtime_completion_requests
      WHERE apply_phase = 'effects_committed'
      ORDER BY request_id
      FOR UPDATE`,
  );
  for (const row of rows) {
    const plan = v8SchemaParse(`v8 completion plan invalid: ${row.request_id}`, () =>
      RuntimeCompletionPlanV1Schema.parse(migrationObject(
        row.completion_plan,
        `v8 completion plan must be an object: ${row.request_id}`,
      )));
    if (hashCanonicalJson(plan) !== row.completion_plan_hash) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v8 completion plan hash mismatch: ${row.request_id}`,
      );
    }
    const createdAt = v8MigrationTimestamp(row.prepared_at, `v8 effect prepared time invalid: ${row.request_id}`);
    const committedAt = row.effects_committed_at === null
      ? undefined
      : v8MigrationTimestamp(row.effects_committed_at, `v8 effect committed time invalid: ${row.request_id}`);
    if (!committedAt) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v8 effects committed receipt missing: ${row.request_id}`,
      );
    }
    for (const effect of plan.effects) {
      const input = v8SchemaParse(`v8 completion effect input invalid: ${row.request_id}/${effect.effectKey}`, () => RuntimeCompletionEffectInputV1Schema.parse({
        schema: "setfarm.runtime-completion-effect-input.v1",
        planHash: row.completion_plan_hash,
        plan,
        effect: effect.payload,
      }));
      const state = "applied";
      const result = {
        schema: "setfarm.migration-v8-effect-result.v1",
        source: "legacy-effects-committed-receipt",
        replayable: false,
        legacyResult: migrationObject(row.result, `v8 completion result invalid: ${row.request_id}`),
      };
      const evidence = {
        schema: "setfarm.migration-v8-effect-evidence.v1",
        source: "legacy-receipt-only-backfill",
        legacyApplyPhase: row.apply_phase,
        planHash: row.completion_plan_hash,
      };
      await sql.unsafe(
        `INSERT INTO runtime_completion_effects (
           request_id, effect_key, ordinal, effect_type, input_hash, payload,
           mandatory, state, result, evidence, applied_at, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6::text::jsonb,
           $7, $8, $9::text::jsonb, $10::text::jsonb, $11, $12, $12
         )`,
        [
          row.request_id,
          effect.effectKey,
          effect.ordinal,
          effect.effectType,
          hashCanonicalJson(input),
          JSON.stringify(input),
          effect.mandatory,
          state,
          JSON.stringify(result),
          JSON.stringify(evidence),
          committedAt,
          createdAt,
        ],
      );
    }
  }
}

async function applyRuntimeCompletionEffectLedger(sql: TransactionSql): Promise<void> {
  for (const statement of RUNTIME_COMPLETION_EFFECT_LEDGER_STATEMENTS) {
    if (statement === PROCESS_IDENTITY_BACKFILL_MARKER) {
      await backfillSemanticProcessIdentities(sql);
    } else if (statement === COMPLETION_PLAN_BACKFILL_MARKER) {
      await backfillSemanticRuntimeCompletionPlans(sql);
    } else if (statement === COMPLETION_EFFECT_BACKFILL_MARKER) {
      await backfillSemanticRuntimeCompletionEffects(sql);
    } else {
      await sql.unsafe(statement);
    }
  }
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v8-semantic-apply:END

const PRODUCT_ARTIFACT_INDEX_STATEMENTS = [
  `CREATE TABLE semantic_artifacts (
    artifact_hash TEXT PRIMARY KEY,
    artifact_type TEXT NOT NULL,
    byte_length BIGINT NOT NULL,
    producer_metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT semantic_artifacts_hash_check
      CHECK (artifact_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT semantic_artifacts_type_check
      CHECK (artifact_type ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)+$'),
    CONSTRAINT semantic_artifacts_byte_length_check
      CHECK (byte_length > 0),
    CONSTRAINT semantic_artifacts_producer_object_check
      CHECK (jsonb_typeof(producer_metadata) = 'object'),
    CONSTRAINT semantic_artifacts_producer_keys_check
      CHECK (
        producer_metadata ?& ARRAY['pass', 'codeSha', 'toolVersions']
        AND producer_metadata - ARRAY['pass', 'codeSha', 'model', 'promptHash', 'toolVersions']::text[] = '{}'::jsonb
      ),
    CONSTRAINT semantic_artifacts_producer_values_check
      CHECK (
        jsonb_typeof(producer_metadata->'pass') = 'string'
        AND length(producer_metadata->>'pass') BETWEEN 1 AND 160
        AND jsonb_typeof(producer_metadata->'codeSha') = 'string'
        AND producer_metadata->>'codeSha' ~ '^[a-f0-9]{7,64}$'
        AND jsonb_typeof(producer_metadata->'toolVersions') = 'object'
        AND NOT jsonb_path_exists(
          producer_metadata,
          '$.toolVersions.* ? (@.type() != "string")'
        )
        AND (NOT producer_metadata ? 'model' OR (
          jsonb_typeof(producer_metadata->'model') = 'string'
          AND length(producer_metadata->>'model') BETWEEN 1 AND 200
        ))
        AND (NOT producer_metadata ? 'promptHash' OR (
          jsonb_typeof(producer_metadata->'promptHash') = 'string'
          AND producer_metadata->>'promptHash' ~ '^[a-f0-9]{64}$'
        ))
      )
  )`,
  `CREATE FUNCTION setfarm_forbid_artifact_identity_update() RETURNS trigger
   LANGUAGE plpgsql AS $$
   BEGIN
     RAISE EXCEPTION 'ARTIFACT_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
   END;
   $$`,
  `CREATE TRIGGER trg_semantic_artifacts_immutable
   BEFORE UPDATE OR DELETE ON semantic_artifacts
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE TABLE artifact_capacity (
    capacity_key TEXT PRIMARY KEY DEFAULT 'semantic-artifacts',
    quota_bytes BIGINT NOT NULL DEFAULT 536870912,
    max_payload_bytes BIGINT NOT NULL DEFAULT 4194304,
    total_bytes BIGINT NOT NULL DEFAULT 0,
    reserved_bytes BIGINT NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'bootstrap_required',
    reconciled_at TIMESTAMPTZ,
    diagnostic TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT artifact_capacity_singleton_check
      CHECK (capacity_key = 'semantic-artifacts'),
    CONSTRAINT artifact_capacity_values_check
      CHECK (
        quota_bytes > 0
        AND max_payload_bytes > 0
        AND max_payload_bytes <= quota_bytes
        AND total_bytes >= 0
        AND reserved_bytes >= 0
        AND total_bytes + reserved_bytes <= quota_bytes
      ),
    CONSTRAINT artifact_capacity_state_check
      CHECK (state IN ('bootstrap_required', 'ready', 'quarantined')),
    CONSTRAINT artifact_capacity_reconciled_check
      CHECK ((state = 'bootstrap_required') = (reconciled_at IS NULL)),
    CONSTRAINT artifact_capacity_quarantine_check
      CHECK (state <> 'quarantined' OR NULLIF(diagnostic, '') IS NOT NULL)
  )`,
  `INSERT INTO artifact_capacity (capacity_key)
   VALUES ('semantic-artifacts')`,
  `CREATE TABLE artifact_publication_reservations (
    reservation_id TEXT PRIMARY KEY,
    artifact_hash TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    byte_length BIGINT NOT NULL,
    producer_metadata JSONB NOT NULL,
    state TEXT NOT NULL,
    owner_instance_id TEXT,
    lease_token TEXT,
    lease_expires_at TIMESTAMPTZ,
    diagnostic TEXT,
    published_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT artifact_publication_reservations_hash_check
      CHECK (artifact_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT artifact_publication_reservations_type_check
      CHECK (artifact_type ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)+$'),
    CONSTRAINT artifact_publication_reservations_byte_length_check
      CHECK (byte_length > 0),
    CONSTRAINT artifact_publication_reservations_producer_object_check
      CHECK (jsonb_typeof(producer_metadata) = 'object'),
    CONSTRAINT artifact_publication_reservations_producer_keys_check
      CHECK (
        producer_metadata ?& ARRAY['pass', 'codeSha', 'toolVersions']
        AND producer_metadata - ARRAY['pass', 'codeSha', 'model', 'promptHash', 'toolVersions']::text[] = '{}'::jsonb
      ),
    CONSTRAINT artifact_publication_reservations_producer_values_check
      CHECK (
        jsonb_typeof(producer_metadata->'pass') = 'string'
        AND length(producer_metadata->>'pass') BETWEEN 1 AND 160
        AND jsonb_typeof(producer_metadata->'codeSha') = 'string'
        AND producer_metadata->>'codeSha' ~ '^[a-f0-9]{7,64}$'
        AND jsonb_typeof(producer_metadata->'toolVersions') = 'object'
        AND NOT jsonb_path_exists(
          producer_metadata,
          '$.toolVersions.* ? (@.type() != "string")'
        )
        AND (NOT producer_metadata ? 'model' OR (
          jsonb_typeof(producer_metadata->'model') = 'string'
          AND length(producer_metadata->>'model') BETWEEN 1 AND 200
        ))
        AND (NOT producer_metadata ? 'promptHash' OR (
          jsonb_typeof(producer_metadata->'promptHash') = 'string'
          AND producer_metadata->>'promptHash' ~ '^[a-f0-9]{64}$'
        ))
      ),
    CONSTRAINT artifact_publication_reservations_state_check
      CHECK (state IN ('reserved', 'published', 'released', 'quarantined')),
    CONSTRAINT artifact_publication_reservations_lease_check
      CHECK (
        (state = 'reserved') = (owner_instance_id IS NOT NULL)
        AND (state = 'reserved') = (lease_token IS NOT NULL)
        AND (state = 'reserved') = (lease_expires_at IS NOT NULL)
      ),
    CONSTRAINT artifact_publication_reservations_finalized_check
      CHECK ((state <> 'reserved') = (finalized_at IS NOT NULL)),
    CONSTRAINT artifact_publication_reservations_published_check
      CHECK ((state = 'published') = (published_at IS NOT NULL)),
    CONSTRAINT artifact_publication_reservations_quarantine_check
      CHECK (state <> 'quarantined' OR NULLIF(diagnostic, '') IS NOT NULL)
  )`,
  "CREATE UNIQUE INDEX idx_artifact_publication_reservations_active_hash ON artifact_publication_reservations(artifact_hash) WHERE state = 'reserved'",
  "CREATE INDEX idx_artifact_publication_reservations_expired ON artifact_publication_reservations(lease_expires_at, reservation_id) WHERE state = 'reserved'",
  `CREATE TABLE product_packets (
    run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
    packet_hash TEXT NOT NULL REFERENCES semantic_artifacts(artifact_hash),
    compiler_metadata JSONB NOT NULL,
    sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT product_packets_hash_check
      CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT product_packets_compiler_object_check
      CHECK (jsonb_typeof(compiler_metadata) = 'object'),
    CONSTRAINT product_packets_compiler_keys_check
      CHECK (
        compiler_metadata ?& ARRAY['version', 'codeSha']
        AND compiler_metadata - ARRAY['version', 'codeSha']::text[] = '{}'::jsonb
      ),
    CONSTRAINT product_packets_compiler_values_check
      CHECK (
        jsonb_typeof(compiler_metadata->'version') = 'string'
        AND length(compiler_metadata->>'version') BETWEEN 1 AND 100
        AND jsonb_typeof(compiler_metadata->'codeSha') = 'string'
        AND compiler_metadata->>'codeSha' ~ '^[a-f0-9]{7,64}$'
      )
  )`,
  "CREATE INDEX idx_product_packets_hash ON product_packets(packet_hash, run_id)",
  `CREATE TRIGGER trg_product_packets_immutable
   BEFORE UPDATE ON product_packets
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE TABLE run_artifact_refs (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    ref_key TEXT NOT NULL,
    artifact_hash TEXT NOT NULL REFERENCES semantic_artifacts(artifact_hash),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (run_id, ref_key),
    CONSTRAINT run_artifact_refs_key_check
      CHECK (ref_key ~ '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$'),
    CONSTRAINT run_artifact_refs_hash_check
      CHECK (artifact_hash ~ '^[a-f0-9]{64}$')
  )`,
  "CREATE INDEX idx_run_artifact_refs_hash ON run_artifact_refs(artifact_hash, run_id)",
  `CREATE TRIGGER trg_run_artifact_refs_immutable
   BEFORE UPDATE ON run_artifact_refs
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
] as const;

const FINDING_RECOVERY_LEDGER_STATEMENTS = [
  `CREATE TABLE finding_sets (
    finding_set_hash TEXT PRIMARY KEY,
    finding_set_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    slice_hash TEXT NOT NULL,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    finding_ids JSONB NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT finding_sets_hash_check CHECK (finding_set_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT finding_sets_id_check CHECK (finding_set_id ~ '^FSET_[a-f0-9]{64}$'),
    CONSTRAINT finding_sets_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT finding_sets_slice_hash_check CHECK (slice_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT finding_sets_source_sha_check CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT finding_sets_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT finding_sets_finding_ids_array_check CHECK (jsonb_typeof(finding_ids) = 'array'),
    CONSTRAINT finding_sets_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT finding_sets_payload_identity_check CHECK (
      payload->>'schema' = 'setfarm.finding-set.v1'
      AND payload->>'findingSetHash' = finding_set_hash
      AND payload->>'findingSetId' = finding_set_id
      AND payload->>'runId' = run_id
      AND payload->>'storyId' = story_id
      AND payload->>'packetHash' = packet_hash
      AND payload->>'sliceHash' = slice_hash
      AND payload->'sourceRevision'->>'sha' = source_sha
      AND payload->'sourceRevision'->>'treeHash' = source_tree_hash
    ),
    CONSTRAINT finding_sets_recovery_identity_unique UNIQUE (
      finding_set_hash, run_id, story_id, packet_hash, slice_hash, source_sha, source_tree_hash
    )
  )`,
  "CREATE INDEX idx_finding_sets_run_story_source ON finding_sets(run_id, story_id, source_tree_hash, created_at DESC)",
  `CREATE TABLE findings (
    finding_set_hash TEXT NOT NULL REFERENCES finding_sets(finding_set_hash) ON DELETE RESTRICT,
    finding_id TEXT NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN (
      'compiler', 'build', 'test', 'runtime', 'review', 'security', 'qa'
    )),
    classification TEXT NOT NULL CHECK (classification IN ('structured', 'unstructured_review')),
    invariant_ref TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'satisfied', 'invalid', 'superseded')),
    source_fingerprint TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (finding_set_hash, finding_id),
    CONSTRAINT findings_id_check CHECK (finding_id ~ '^FIND_[a-f0-9]{64}$'),
    CONSTRAINT findings_invariant_ref_check CHECK (invariant_ref ~ '^INV_[A-Z0-9]+(_[A-Z0-9]+)*$'),
    CONSTRAINT findings_source_fingerprint_check CHECK (source_fingerprint ~ '^[a-f0-9]{64}$'),
    CONSTRAINT findings_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT findings_payload_identity_check CHECK (
      payload->>'findingId' = finding_id
      AND payload->>'origin' = origin
      AND payload->>'classification' = classification
      AND payload->>'invariantRef' = invariant_ref
      AND payload->>'status' = status
    )
  )`,
  "CREATE INDEX idx_findings_open_invariant ON findings(invariant_ref, finding_id) WHERE status = 'open'",
  `CREATE TABLE evidence_bundles (
    evidence_bundle_hash TEXT PRIMARY KEY,
    evidence_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    slice_hash TEXT NOT NULL,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    attempt_id TEXT,
    aggregate_verdict TEXT NOT NULL CHECK (aggregate_verdict IN (
      'pass', 'fail', 'inconclusive', 'incomplete'
    )),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT evidence_bundles_hash_check CHECK (evidence_bundle_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT evidence_bundles_id_check CHECK (evidence_id ~ '^EVB_[a-f0-9]{64}$'),
    CONSTRAINT evidence_bundles_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT evidence_bundles_slice_hash_check CHECK (slice_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT evidence_bundles_source_sha_check CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT evidence_bundles_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT evidence_bundles_attempt_id_check CHECK (attempt_id IS NULL OR attempt_id ~ '^ATT_[A-Za-z0-9-]{16,160}$'),
    CONSTRAINT evidence_bundles_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT evidence_bundles_payload_identity_check CHECK (
      payload->>'schema' = 'setfarm.evidence-bundle.v2'
      AND payload->>'evidenceId' = evidence_id
      AND payload->>'runId' = run_id
      AND payload->>'storyId' = story_id
      AND payload->>'packetHash' = packet_hash
      AND payload->>'sliceHash' = slice_hash
      AND payload->'sourceRevision'->>'sha' = source_sha
      AND payload->'sourceRevision'->>'treeHash' = source_tree_hash
      AND COALESCE(payload->>'attemptId', '') = COALESCE(attempt_id, '')
      AND payload->>'aggregateVerdict' = aggregate_verdict
    )
  )`,
  "CREATE INDEX idx_evidence_bundles_run_story_source ON evidence_bundles(run_id, story_id, source_tree_hash, created_at DESC)",
  `CREATE TABLE recovery_cases (
    recovery_case_id TEXT PRIMARY KEY,
    dedupe_key TEXT NOT NULL UNIQUE,
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    finding_set_hash TEXT NOT NULL,
    finding_ids JSONB NOT NULL,
    packet_hash TEXT NOT NULL,
    slice_hash TEXT NOT NULL,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    owner TEXT NOT NULL CHECK (owner IN (
      'implement', 'supervisor', 'compiler', 'infrastructure', 'operator'
    )),
    expected_delta JSONB NOT NULL,
    allowed_paths JSONB NOT NULL,
    evidence_plan JSONB NOT NULL,
    prior_attempt_refs JSONB NOT NULL,
    max_implement INTEGER NOT NULL CHECK (max_implement BETWEEN 0 AND 1),
    max_supervisor_repair INTEGER NOT NULL CHECK (max_supervisor_repair BETWEEN 0 AND 1),
    max_evidence_only INTEGER NOT NULL CHECK (max_evidence_only BETWEEN 0 AND 3),
    used_implement INTEGER NOT NULL DEFAULT 0,
    used_supervisor_repair INTEGER NOT NULL DEFAULT 0,
    used_evidence_only INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN (
      'open', 'repairing', 'evidencing', 'resolved', 'blocked', 'superseded'
    )),
    terminal JSONB,
    decision_refs JSONB NOT NULL,
    state_version INTEGER NOT NULL DEFAULT 1 CHECK (state_version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT recovery_cases_id_check CHECK (recovery_case_id ~ '^RCV_[a-f0-9]{64}$'),
    CONSTRAINT recovery_cases_dedupe_check CHECK (dedupe_key ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_cases_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_cases_slice_hash_check CHECK (slice_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_cases_source_sha_check CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_cases_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_cases_json_shapes_check CHECK (
      jsonb_typeof(finding_ids) = 'array'
      AND jsonb_typeof(expected_delta) = 'object'
      AND jsonb_typeof(allowed_paths) = 'array'
      AND jsonb_typeof(evidence_plan) = 'array'
      AND jsonb_typeof(prior_attempt_refs) = 'array'
      AND jsonb_typeof(decision_refs) = 'array'
      AND (terminal IS NULL OR jsonb_typeof(terminal) = 'object')
    ),
    CONSTRAINT recovery_cases_budget_check CHECK (
      used_implement BETWEEN 0 AND max_implement
      AND used_supervisor_repair BETWEEN 0 AND max_supervisor_repair
      AND used_evidence_only BETWEEN 0 AND max_evidence_only
    ),
    CONSTRAINT recovery_cases_terminal_check CHECK (
      (status IN ('resolved', 'blocked', 'superseded')) = (terminal IS NOT NULL)
    ),
    CONSTRAINT recovery_cases_owner_delta_check CHECK (
      (owner = 'implement' AND expected_delta->>'kind' = 'source_change')
      OR (owner = 'supervisor' AND expected_delta->>'kind' IN (
        'source_change', 'evidence_refresh', 'upstream_recompile'
      ))
      OR (owner = 'compiler' AND expected_delta->>'kind' = 'upstream_recompile')
      OR (owner = 'infrastructure' AND expected_delta->>'kind' = 'evidence_refresh')
      OR (owner = 'operator' AND expected_delta->>'kind' = 'operator_action')
    ),
    CONSTRAINT recovery_cases_terminal_identity_check CHECK (
      terminal IS NULL OR (
        terminal->>'owner' = owner AND terminal->>'outcome' = status
      )
    ),
    CONSTRAINT recovery_cases_finding_identity_fkey FOREIGN KEY (
      finding_set_hash, run_id, story_id, packet_hash, slice_hash, source_sha, source_tree_hash
    ) REFERENCES finding_sets (
      finding_set_hash, run_id, story_id, packet_hash, slice_hash, source_sha, source_tree_hash
    ) ON DELETE RESTRICT,
    CONSTRAINT recovery_cases_dispatch_identity_unique UNIQUE (
      recovery_case_id, finding_set_hash, packet_hash, slice_hash
    )
  )`,
  "CREATE INDEX idx_recovery_cases_active_owner ON recovery_cases(owner, status, updated_at) WHERE status IN ('open', 'repairing', 'evidencing')",
  `CREATE TABLE recovery_dispatches (
    dispatch_id TEXT PRIMARY KEY,
    recovery_case_id TEXT NOT NULL,
    dispatch_class TEXT NOT NULL CHECK (dispatch_class IN (
      'product_implementation', 'supervisor_repair', 'evidence_only'
    )),
    dispatch_dedupe_key TEXT NOT NULL UNIQUE,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    slice_hash TEXT NOT NULL,
    finding_set_hash TEXT NOT NULL,
    finding_ids JSONB NOT NULL,
    evidence_plan JSONB NOT NULL,
    authorized_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT recovery_dispatches_id_check CHECK (dispatch_id ~ '^RDISP_[a-f0-9]{64}$'),
    CONSTRAINT recovery_dispatches_dedupe_check CHECK (dispatch_dedupe_key ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_dispatches_source_sha_check CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_dispatches_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_dispatches_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_dispatches_slice_hash_check CHECK (slice_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_dispatches_json_shapes_check CHECK (
      jsonb_typeof(finding_ids) = 'array' AND jsonb_typeof(evidence_plan) = 'array'
    ),
    CONSTRAINT recovery_dispatches_case_identity_fkey FOREIGN KEY (
      recovery_case_id, finding_set_hash, packet_hash, slice_hash
    ) REFERENCES recovery_cases (
      recovery_case_id, finding_set_hash, packet_hash, slice_hash
    ) ON DELETE RESTRICT
  )`,
  "CREATE INDEX idx_recovery_dispatches_case_created ON recovery_dispatches(recovery_case_id, authorized_at)",
  `CREATE TABLE recovery_dispatch_findings (
    dispatch_id TEXT NOT NULL REFERENCES recovery_dispatches(dispatch_id) ON DELETE RESTRICT,
    finding_id TEXT NOT NULL,
    finding_dispatch_key TEXT NOT NULL UNIQUE,
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    dispatch_class TEXT NOT NULL CHECK (dispatch_class IN (
      'product_implementation', 'supervisor_repair', 'evidence_only'
    )),
    source_tree_hash TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    slice_hash TEXT NOT NULL,
    authorized_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (dispatch_id, finding_id),
    CONSTRAINT recovery_dispatch_findings_finding_id_check CHECK (finding_id ~ '^FIND_[a-f0-9]{64}$'),
    CONSTRAINT recovery_dispatch_findings_key_check CHECK (finding_dispatch_key ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_dispatch_findings_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_dispatch_findings_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_dispatch_findings_slice_hash_check CHECK (slice_hash ~ '^[a-f0-9]{64}$')
  )`,
  "CREATE INDEX idx_recovery_dispatch_findings_lookup ON recovery_dispatch_findings(run_id, story_id, source_tree_hash, finding_id)",
  `CREATE TRIGGER trg_finding_sets_immutable
   BEFORE UPDATE OR DELETE ON finding_sets
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE TRIGGER trg_findings_immutable
   BEFORE UPDATE OR DELETE ON findings
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE TRIGGER trg_evidence_bundles_immutable
   BEFORE UPDATE OR DELETE ON evidence_bundles
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE TRIGGER trg_recovery_dispatches_immutable
   BEFORE UPDATE OR DELETE ON recovery_dispatches
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE TRIGGER trg_recovery_dispatch_findings_immutable
   BEFORE UPDATE OR DELETE ON recovery_dispatch_findings
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
] as const;

const RECOVERY_DELIVERY_LEDGER_PRE_BACKFILL_STATEMENTS = [
  "ALTER TABLE recovery_cases ADD COLUMN current_revision_id TEXT",
  `CREATE TABLE recovery_case_revisions (
    revision_id TEXT PRIMARY KEY,
    recovery_case_id TEXT NOT NULL REFERENCES recovery_cases(recovery_case_id) ON DELETE RESTRICT,
    revision_number INTEGER NOT NULL CHECK (revision_number > 0),
    parent_revision_id TEXT,
    revision_identity_key TEXT NOT NULL UNIQUE,
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    finding_set_hash TEXT NOT NULL,
    finding_ids JSONB NOT NULL,
    packet_hash TEXT NOT NULL,
    contract_slice_hash TEXT NOT NULL,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    owner TEXT NOT NULL CHECK (owner IN (
      'implement', 'supervisor', 'compiler', 'infrastructure', 'operator'
    )),
    expected_delta JSONB NOT NULL,
    allowed_paths JSONB NOT NULL,
    evidence_plan JSONB NOT NULL,
    evidence_plan_artifact_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT recovery_case_revisions_id_check CHECK (revision_id ~ '^RREV_[a-f0-9]{64}$'),
    CONSTRAINT recovery_case_revisions_identity_check CHECK (revision_identity_key ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_case_revisions_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_case_revisions_slice_hash_check CHECK (contract_slice_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_case_revisions_source_sha_check CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_case_revisions_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_case_revisions_plan_hash_check CHECK (
      evidence_plan_artifact_hash IS NULL OR evidence_plan_artifact_hash ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT recovery_case_revisions_json_shapes_check CHECK (
      jsonb_typeof(finding_ids) = 'array'
      AND jsonb_typeof(expected_delta) = 'object'
      AND jsonb_typeof(allowed_paths) = 'array'
      AND jsonb_typeof(evidence_plan) = 'array'
    ),
    CONSTRAINT recovery_case_revisions_number_unique UNIQUE (recovery_case_id, revision_number),
    CONSTRAINT recovery_case_revisions_case_identity_unique UNIQUE (revision_id, recovery_case_id),
    CONSTRAINT recovery_case_revisions_dispatch_identity_unique UNIQUE (
      revision_id, recovery_case_id, finding_set_hash, packet_hash, contract_slice_hash
    ),
    CONSTRAINT recovery_case_revisions_parent_fkey FOREIGN KEY (parent_revision_id, recovery_case_id)
      REFERENCES recovery_case_revisions(revision_id, recovery_case_id) ON DELETE RESTRICT,
    CONSTRAINT recovery_case_revisions_finding_identity_fkey FOREIGN KEY (
      finding_set_hash, run_id, story_id, packet_hash, contract_slice_hash, source_sha, source_tree_hash
    ) REFERENCES finding_sets (
      finding_set_hash, run_id, story_id, packet_hash, slice_hash, source_sha, source_tree_hash
    ) ON DELETE RESTRICT
  )`,
] as const;

const RECOVERY_DELIVERY_LEDGER_POST_BACKFILL_STATEMENTS = [
  `ALTER TABLE recovery_cases
     ADD CONSTRAINT recovery_cases_current_revision_fkey
     FOREIGN KEY (current_revision_id, recovery_case_id)
     REFERENCES recovery_case_revisions(revision_id, recovery_case_id)
     ON DELETE RESTRICT`,
  "CREATE INDEX idx_recovery_case_revisions_case_number ON recovery_case_revisions(recovery_case_id, revision_number DESC)",
  `CREATE TABLE recovery_revision_dispatches (
    dispatch_id TEXT PRIMARY KEY,
    recovery_case_id TEXT NOT NULL,
    revision_id TEXT NOT NULL,
    dispatch_class TEXT NOT NULL CHECK (dispatch_class IN (
      'product_implementation', 'supervisor_repair', 'evidence_only'
    )),
    dispatch_dedupe_key TEXT NOT NULL UNIQUE,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    contract_slice_hash TEXT NOT NULL,
    finding_set_hash TEXT NOT NULL,
    finding_ids JSONB NOT NULL,
    evidence_plan JSONB NOT NULL,
    evidence_plan_artifact_hash TEXT,
    authorized_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT recovery_revision_dispatches_id_check CHECK (dispatch_id ~ '^RDISP_[a-f0-9]{64}$'),
    CONSTRAINT recovery_revision_dispatches_dedupe_check CHECK (dispatch_dedupe_key ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_revision_dispatches_source_sha_check CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_revision_dispatches_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_revision_dispatches_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_revision_dispatches_slice_hash_check CHECK (contract_slice_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_revision_dispatches_plan_hash_check CHECK (
      evidence_plan_artifact_hash IS NULL OR evidence_plan_artifact_hash ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT recovery_revision_dispatches_json_shapes_check CHECK (
      jsonb_typeof(finding_ids) = 'array' AND jsonb_typeof(evidence_plan) = 'array'
    ),
    CONSTRAINT recovery_revision_dispatches_revision_unique UNIQUE (dispatch_id, revision_id),
    CONSTRAINT recovery_revision_dispatches_revision_identity_fkey FOREIGN KEY (
      revision_id, recovery_case_id, finding_set_hash, packet_hash, contract_slice_hash
    ) REFERENCES recovery_case_revisions (
      revision_id, recovery_case_id, finding_set_hash, packet_hash, contract_slice_hash
    ) ON DELETE RESTRICT
  )`,
  "CREATE INDEX idx_recovery_revision_dispatches_case_created ON recovery_revision_dispatches(recovery_case_id, authorized_at)",
  `CREATE TABLE recovery_revision_dispatch_findings (
    dispatch_id TEXT NOT NULL REFERENCES recovery_revision_dispatches(dispatch_id) ON DELETE RESTRICT,
    finding_id TEXT NOT NULL,
    finding_dispatch_key TEXT NOT NULL UNIQUE,
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    dispatch_class TEXT NOT NULL CHECK (dispatch_class IN (
      'product_implementation', 'supervisor_repair', 'evidence_only'
    )),
    source_tree_hash TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    contract_slice_hash TEXT NOT NULL,
    authorized_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (dispatch_id, finding_id),
    CONSTRAINT recovery_revision_dispatch_findings_id_check CHECK (finding_id ~ '^FIND_[a-f0-9]{64}$'),
    CONSTRAINT recovery_revision_dispatch_findings_key_check CHECK (finding_dispatch_key ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_revision_dispatch_findings_source_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT recovery_revision_dispatch_findings_packet_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT recovery_revision_dispatch_findings_slice_check CHECK (contract_slice_hash ~ '^[a-f0-9]{64}$')
  )`,
  "CREATE INDEX idx_recovery_revision_dispatch_findings_lookup ON recovery_revision_dispatch_findings(run_id, story_id, source_tree_hash, finding_id)",
  `CREATE TABLE recovery_dispatch_deliveries (
    dispatch_id TEXT PRIMARY KEY REFERENCES recovery_revision_dispatches(dispatch_id) ON DELETE RESTRICT,
    recovery_case_id TEXT NOT NULL,
    revision_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN (
      'authorized', 'leased', 'attempt_reserved', 'running',
      'succeeded', 'failed', 'blocked', 'superseded'
    )),
    owner_instance_id TEXT,
    lease_token TEXT,
    lease_expires_at TIMESTAMPTZ,
    attempt_id TEXT UNIQUE REFERENCES execution_attempts(attempt_id) ON DELETE RESTRICT,
    claim_id BIGINT,
    execution_slice_hash TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    terminal_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    diagnostic TEXT,
    authorized_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    terminal_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT recovery_dispatch_deliveries_revision_fkey FOREIGN KEY (dispatch_id, revision_id)
      REFERENCES recovery_revision_dispatches(dispatch_id, revision_id) ON DELETE RESTRICT,
    CONSTRAINT recovery_dispatch_deliveries_attempt_claim_check CHECK (
      (attempt_id IS NULL) = (claim_id IS NULL)
    ),
    CONSTRAINT recovery_dispatch_deliveries_slice_hash_check CHECK (
      execution_slice_hash IS NULL OR execution_slice_hash ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT recovery_dispatch_deliveries_lease_check CHECK (
      (state = 'authorized' AND owner_instance_id IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)
      OR (state <> 'authorized' AND owner_instance_id IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    ),
    CONSTRAINT recovery_dispatch_deliveries_attempt_state_check CHECK (
      state NOT IN ('attempt_reserved', 'running', 'succeeded', 'failed') OR attempt_id IS NOT NULL
    ),
    CONSTRAINT recovery_dispatch_deliveries_terminal_check CHECK (
      (state IN ('succeeded', 'failed', 'blocked', 'superseded')) = (terminal_at IS NOT NULL)
    )
  )`,
  "CREATE INDEX idx_recovery_dispatch_deliveries_claimable ON recovery_dispatch_deliveries(state, lease_expires_at, authorized_at)",
  "CREATE UNIQUE INDEX idx_recovery_dispatch_deliveries_story_active ON recovery_dispatch_deliveries(run_id, story_id) WHERE state IN ('authorized', 'leased', 'attempt_reserved', 'running')",
  `CREATE TABLE recovery_dispatch_migration_receipts (
    legacy_dispatch_id TEXT PRIMARY KEY REFERENCES recovery_dispatches(dispatch_id) ON DELETE RESTRICT,
    recovery_case_id TEXT NOT NULL,
    current_revision_id TEXT NOT NULL,
    canonical_dispatch_id TEXT,
    disposition TEXT NOT NULL CHECK (disposition IN (
      'canonical_active', 'canonical_terminal', 'legacy_history_only'
    )),
    reason_code TEXT NOT NULL CHECK (reason_code IN (
      'current_legacy_dispatch', 'historical_safe_dispatch',
      'historical_semantics_not_current'
    )),
    evidence JSONB NOT NULL,
    migrated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT recovery_dispatch_migration_receipts_revision_fkey
      FOREIGN KEY (current_revision_id, recovery_case_id)
      REFERENCES recovery_case_revisions(revision_id, recovery_case_id) ON DELETE RESTRICT,
    CONSTRAINT recovery_dispatch_migration_receipts_dispatch_fkey
      FOREIGN KEY (canonical_dispatch_id, current_revision_id)
      REFERENCES recovery_revision_dispatches(dispatch_id, revision_id) ON DELETE RESTRICT,
    CONSTRAINT recovery_dispatch_migration_receipts_canonical_check CHECK (
      (disposition = 'legacy_history_only') = (canonical_dispatch_id IS NULL)
    ),
    CONSTRAINT recovery_dispatch_migration_receipts_evidence_check CHECK (
      jsonb_typeof(evidence) = 'object'
      AND evidence->>'schema' = 'setfarm.recovery-dispatch-migration-receipt.v1'
      AND evidence->>'legacyDispatchId' = legacy_dispatch_id
      AND evidence->>'currentRevisionId' = current_revision_id
      AND COALESCE(evidence->>'canonicalDispatchId', '') = COALESCE(canonical_dispatch_id, '')
      AND evidence->>'disposition' = disposition
      AND evidence->>'reasonCode' = reason_code
    )
  )`,
  "ALTER TABLE execution_attempts ADD COLUMN recovery_case_revision_id TEXT",
  "ALTER TABLE execution_attempts ADD COLUMN recovery_dispatch_id TEXT",
  `ALTER TABLE execution_attempts
     ADD CONSTRAINT execution_attempts_recovery_pair_check CHECK (
       (recovery_case_revision_id IS NULL) = (recovery_dispatch_id IS NULL)
     )`,
  `ALTER TABLE execution_attempts
     ADD CONSTRAINT execution_attempts_recovery_dispatch_fkey
     FOREIGN KEY (recovery_dispatch_id, recovery_case_revision_id)
     REFERENCES recovery_revision_dispatches(dispatch_id, revision_id)
     ON DELETE RESTRICT`,
  "CREATE UNIQUE INDEX idx_execution_attempts_recovery_dispatch_unique ON execution_attempts(recovery_dispatch_id) WHERE recovery_dispatch_id IS NOT NULL",
  `CREATE TRIGGER trg_recovery_case_revisions_immutable
   BEFORE UPDATE OR DELETE ON recovery_case_revisions
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE TRIGGER trg_recovery_revision_dispatches_immutable
   BEFORE UPDATE OR DELETE ON recovery_revision_dispatches
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE TRIGGER trg_recovery_revision_dispatch_findings_immutable
   BEFORE UPDATE OR DELETE ON recovery_revision_dispatch_findings
   FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
] as const;

const RECOVERY_DELIVERY_LEDGER_STATEMENTS = [
  ...RECOVERY_DELIVERY_LEDGER_PRE_BACKFILL_STATEMENTS,
  ...RECOVERY_DELIVERY_LEDGER_POST_BACKFILL_STATEMENTS,
] as const;

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v11-semantic-apply:BEGIN
type LegacyRecoveryCaseRevisionRow = {
  recovery_case_id: string;
  run_id: string;
  story_id: string;
  finding_set_hash: string;
  finding_ids: unknown;
  packet_hash: string;
  slice_hash: string;
  source_sha: string;
  source_tree_hash: string;
  owner: string;
  expected_delta: unknown;
  allowed_paths: unknown;
  evidence_plan: unknown;
  created_at: Date | string;
};

type LegacyRecoveryDispatchRow = {
  dispatch_id: string;
  recovery_case_id: string;
  dispatch_class: string;
  dispatch_dedupe_key: string;
  source_sha: string;
  source_tree_hash: string;
  packet_hash: string;
  slice_hash: string;
  finding_set_hash: string;
  finding_ids: unknown;
  evidence_plan: unknown;
  authorized_at: Date | string;
};

type LegacyRecoveryDispatchFindingRow = {
  finding_id: string;
  finding_dispatch_key: string;
  run_id: string;
  story_id: string;
  dispatch_class: string;
  source_tree_hash: string;
  packet_hash: string;
  slice_hash: string;
  authorized_at: Date | string;
};

async function backfillSemanticRecoveryRevisions(
  sql: TransactionSql,
): Promise<Map<string, RecoveryCaseRevisionV1>> {
  const rows = await sql.unsafe<LegacyRecoveryCaseRevisionRow[]>(
    `SELECT recovery_case_id, run_id, story_id, finding_set_hash, finding_ids,
            packet_hash, slice_hash, source_sha, source_tree_hash, owner,
            expected_delta, allowed_paths, evidence_plan, created_at
       FROM recovery_cases
      ORDER BY recovery_case_id
      FOR UPDATE`,
  );
  const revisions = new Map<string, RecoveryCaseRevisionV1>();
  for (const row of rows) {
    const revision = createRecoveryCaseRevisionV1({
      recoveryCaseId: row.recovery_case_id,
      revisionNumber: 1,
      runId: row.run_id,
      storyId: row.story_id,
      findingSetHash: row.finding_set_hash,
      findingIds: row.finding_ids,
      packetHash: row.packet_hash,
      contractSliceHash: row.slice_hash,
      sourceRevision: { sha: row.source_sha, treeHash: row.source_tree_hash },
      owner: row.owner,
      expectedDelta: row.expected_delta,
      allowedPaths: row.allowed_paths,
      evidencePlan: row.evidence_plan,
    } as RecoveryCaseRevisionDraftV1, { now: new Date(row.created_at) });
    await sql.unsafe(
      `INSERT INTO recovery_case_revisions (
         revision_id, recovery_case_id, revision_number, parent_revision_id,
         revision_identity_key, run_id, story_id, finding_set_hash, finding_ids,
         packet_hash, contract_slice_hash, source_sha, source_tree_hash,
         owner, expected_delta, allowed_paths, evidence_plan,
         evidence_plan_artifact_hash, created_at
       ) VALUES (
         $1, $2, $3, NULL, $4, $5, $6, $7, $8::text::jsonb,
         $9, $10, $11, $12, $13, $14::text::jsonb, $15::text::jsonb,
         $16::text::jsonb, NULL, $17
       )`,
      [
        revision.revisionId,
        revision.recoveryCaseId,
        revision.revisionNumber,
        revision.revisionIdentityKey,
        revision.runId,
        revision.storyId,
        revision.findingSetHash,
        JSON.stringify(revision.findingIds),
        revision.packetHash,
        revision.contractSliceHash,
        revision.sourceRevision.sha,
        revision.sourceRevision.treeHash,
        revision.owner,
        JSON.stringify(revision.expectedDelta),
        JSON.stringify(revision.allowedPaths),
        JSON.stringify(revision.evidencePlan),
        revision.createdAt,
      ],
    );
    const updated = await sql.unsafe<Array<{ recovery_case_id: string }>>(
      `UPDATE recovery_cases
          SET current_revision_id = $2
        WHERE recovery_case_id = $1
          AND current_revision_id IS NULL
        RETURNING recovery_case_id`,
      [revision.recoveryCaseId, revision.revisionId],
    );
    if (updated.length !== 1) {
      throw new Error(`RECOVERY_V10_REVISION_BACKFILL_CAS_FAILED:${revision.recoveryCaseId}`);
    }
    revisions.set(revision.recoveryCaseId, revision);
  }
  return revisions;
}

function sameMigrationSemanticValue(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

function migrationTimestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("RECOVERY_V10_DISPATCH_TIME_INVALID");
  return parsed.toISOString();
}

function migrationOwnerAllowsDispatch(owner: string, dispatchClass: string): boolean {
  if (dispatchClass === "product_implementation") return owner === "implement";
  if (dispatchClass === "supervisor_repair") return owner === "supervisor";
  return dispatchClass === "evidence_only"
    && (owner === "supervisor" || owner === "infrastructure");
}

function migrationFindingIds(value: unknown, code: string): string[] {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (
    !Array.isArray(parsed)
    || parsed.length === 0
    || parsed.some((item) => typeof item !== "string" || !/^FIND_[a-f0-9]{64}$/.test(item))
    || new Set(parsed).size !== parsed.length
  ) {
    throw new Error(code);
  }
  return [...parsed].sort();
}

function migrationStringArray(value: unknown, code: string): string[] {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (
    !Array.isArray(parsed)
    || parsed.length === 0
    || parsed.some((item) => typeof item !== "string" || item.length === 0)
    || new Set(parsed).size !== parsed.length
  ) {
    throw new Error(code);
  }
  return [...parsed].sort();
}

type PreparedLegacyRecoveryDispatch = Readonly<{
  row: LegacyRecoveryDispatchRow;
  revision: RecoveryCaseRevisionV1;
  dispatchClass: Parameters<typeof computeRevisionDispatchDedupeKey>[0]["dispatchClass"];
  findingIds: string[];
  evidencePlan: string[];
  runId: string;
  storyId: string;
  authorizedAt: string;
  matchesCurrentRevision: boolean;
}>;

async function backfillSemanticRecoveryDispatches(
  sql: TransactionSql,
  revisions: ReadonlyMap<string, RecoveryCaseRevisionV1>,
): Promise<void> {
  const rows = await sql.unsafe<LegacyRecoveryDispatchRow[]>(
    `SELECT dispatch_id, recovery_case_id, dispatch_class, dispatch_dedupe_key,
            source_sha, source_tree_hash, packet_hash, slice_hash,
            finding_set_hash, finding_ids, evidence_plan, authorized_at
       FROM recovery_dispatches
      ORDER BY recovery_case_id, authorized_at, dispatch_id
      FOR SHARE`,
  );
  const preparedRows: PreparedLegacyRecoveryDispatch[] = [];

  for (const row of rows) {
    const revision = revisions.get(row.recovery_case_id);
    if (!revision) {
      throw new Error(`RECOVERY_V10_DISPATCH_CASE_MISSING:${row.recovery_case_id}`);
    }
    if (!["product_implementation", "supervisor_repair", "evidence_only"].includes(row.dispatch_class)) {
      throw new Error(`RECOVERY_V10_DISPATCH_CLASS_UNSAFE:${row.dispatch_id}`);
    }
    const dispatchClass = row.dispatch_class as PreparedLegacyRecoveryDispatch["dispatchClass"];
    const findingIds = migrationFindingIds(
      row.finding_ids,
      `RECOVERY_V10_DISPATCH_FINDING_IDS_UNSAFE:${row.dispatch_id}`,
    );
    const evidencePlan = migrationStringArray(
      row.evidence_plan,
      `RECOVERY_V10_DISPATCH_EVIDENCE_PLAN_UNSAFE:${row.dispatch_id}`,
    );
    const legacyFindingRows = await sql.unsafe<LegacyRecoveryDispatchFindingRow[]>(
      `SELECT finding_id, finding_dispatch_key, run_id, story_id, dispatch_class,
              source_tree_hash, packet_hash, slice_hash, authorized_at
         FROM recovery_dispatch_findings
        WHERE dispatch_id = $1
        ORDER BY finding_id`,
      [row.dispatch_id],
    );
    if (legacyFindingRows.length !== findingIds.length) {
      throw new Error(`RECOVERY_V10_DISPATCH_FINDINGS_UNSAFE:${row.dispatch_id}`);
    }
    const runId = legacyFindingRows[0]?.run_id;
    const storyId = legacyFindingRows[0]?.story_id;
    if (!runId || !storyId) {
      throw new Error(`RECOVERY_V10_DISPATCH_SUBJECT_UNSAFE:${row.dispatch_id}`);
    }
    const legacyDispatchDedupeKey = computeRecoveryDispatchDedupeKey({
      dispatchClass,
      runId,
      storyId,
      findingIds,
      packetHash: row.packet_hash,
      sliceHash: row.slice_hash,
      sourceRevision: { sha: row.source_sha, treeHash: row.source_tree_hash },
      evidencePlan,
    });
    if (
      row.dispatch_dedupe_key !== legacyDispatchDedupeKey
      || row.dispatch_id !== `RDISP_${legacyDispatchDedupeKey}`
    ) {
      throw new Error(`RECOVERY_V10_DISPATCH_IDENTITY_UNSAFE:${row.dispatch_id}`);
    }
    for (const [index, findingId] of findingIds.entries()) {
      const legacyFinding = legacyFindingRows[index];
      const expectedFindingKey = computeRecoveryFindingDispatchDedupeKey({
        dispatchClass,
        runId,
        storyId,
        findingId,
        packetHash: row.packet_hash,
        sliceHash: row.slice_hash,
        sourceTreeHash: row.source_tree_hash,
      });
      if (
        !legacyFinding
        || legacyFinding.finding_id !== findingId
        || legacyFinding.finding_dispatch_key !== expectedFindingKey
        || legacyFinding.run_id !== runId
        || legacyFinding.story_id !== storyId
        || legacyFinding.dispatch_class !== dispatchClass
        || legacyFinding.source_tree_hash !== row.source_tree_hash
        || legacyFinding.packet_hash !== row.packet_hash
        || legacyFinding.slice_hash !== row.slice_hash
        || migrationTimestamp(legacyFinding.authorized_at) !== migrationTimestamp(row.authorized_at)
      ) {
        throw new Error(`RECOVERY_V10_DISPATCH_FINDINGS_UNSAFE:${row.dispatch_id}`);
      }
    }
    const matchesCurrentRevision = (
      runId === revision.runId
      && storyId === revision.storyId
      && row.source_sha === revision.sourceRevision.sha
      && row.source_tree_hash === revision.sourceRevision.treeHash
      && row.packet_hash === revision.packetHash
      && row.slice_hash === revision.contractSliceHash
      && row.finding_set_hash === revision.findingSetHash
      && sameMigrationSemanticValue(findingIds, revision.findingIds)
      && sameMigrationSemanticValue(evidencePlan, revision.evidencePlan)
      && migrationOwnerAllowsDispatch(revision.owner, row.dispatch_class)
    );
    preparedRows.push({
      row,
      revision,
      dispatchClass,
      findingIds,
      evidencePlan,
      runId,
      storyId,
      authorizedAt: migrationTimestamp(row.authorized_at),
      matchesCurrentRevision,
    });
  }

  for (const prepared of preparedRows) {
    const { row, revision, dispatchClass, findingIds, runId, storyId, authorizedAt } = prepared;
    let canonicalDispatchId: string | undefined;
    let disposition: "canonical_terminal" | "legacy_history_only";
    let reasonCode: "historical_safe_dispatch" | "historical_semantics_not_current";
    if (prepared.matchesCurrentRevision) {
    const dispatchDedupeKey = computeRevisionDispatchDedupeKey({
      dispatchClass,
      runId,
      storyId,
      findingIds,
      packetHash: revision.packetHash,
      sourceTreeHash: revision.sourceRevision.treeHash,
      evidencePlan: revision.evidencePlan,
    });
    const dispatch = RecoveryRevisionDispatchV1Schema.parse({
      schema: "setfarm.recovery-revision-dispatch.v1",
      dispatchId: `RDISP_${dispatchDedupeKey}`,
      recoveryCaseId: revision.recoveryCaseId,
      revisionId: revision.revisionId,
      dispatchClass,
      dispatchDedupeKey,
      runId,
      storyId,
      sourceRevision: revision.sourceRevision,
      packetHash: revision.packetHash,
      contractSliceHash: revision.contractSliceHash,
      findingSetHash: revision.findingSetHash,
      findingIds,
      evidencePlan: revision.evidencePlan,
      authorizedAt,
    });
    canonicalDispatchId = dispatch.dispatchId;
    await sql.unsafe(
      `INSERT INTO recovery_revision_dispatches (
         dispatch_id, recovery_case_id, revision_id, dispatch_class, dispatch_dedupe_key,
         source_sha, source_tree_hash, packet_hash, contract_slice_hash, finding_set_hash,
         finding_ids, evidence_plan, evidence_plan_artifact_hash, authorized_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 $11::text::jsonb, $12::text::jsonb, NULL, $13)`,
      [
        dispatch.dispatchId,
        dispatch.recoveryCaseId,
        dispatch.revisionId,
        dispatch.dispatchClass,
        dispatch.dispatchDedupeKey,
        dispatch.sourceRevision.sha,
        dispatch.sourceRevision.treeHash,
        dispatch.packetHash,
        dispatch.contractSliceHash,
        dispatch.findingSetHash,
        JSON.stringify(dispatch.findingIds),
        JSON.stringify(dispatch.evidencePlan),
        dispatch.authorizedAt,
      ],
    );
    for (const findingId of dispatch.findingIds) {
      const findingDispatchKey = computeRevisionFindingDispatchKey({
        dispatchClass: dispatch.dispatchClass,
        runId: dispatch.runId,
        storyId: dispatch.storyId,
        findingId,
        packetHash: dispatch.packetHash,
        sourceTreeHash: dispatch.sourceRevision.treeHash,
      });
      await sql.unsafe(
        `INSERT INTO recovery_revision_dispatch_findings (
           dispatch_id, finding_id, finding_dispatch_key, run_id, story_id,
           dispatch_class, source_tree_hash, packet_hash, contract_slice_hash, authorized_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          dispatch.dispatchId,
          findingId,
          findingDispatchKey,
          dispatch.runId,
          dispatch.storyId,
          dispatch.dispatchClass,
          dispatch.sourceRevision.treeHash,
          dispatch.packetHash,
          dispatch.contractSliceHash,
          dispatch.authorizedAt,
        ],
      );
    }
    // v10 proved dispatch authorization but recorded neither delivery nor
    // consumption. Re-authorizing any legacy row could repeat unchanged-source
    // work after an unobserved successful delivery. Preserve exact compatible
    // semantics as a terminal receipt; only fresh v11 evidence may authorize a
    // new revision and delivery.
    disposition = "canonical_terminal";
    reasonCode = "historical_safe_dispatch";
    const terminalResult = {
      schema: "setfarm.recovery-delivery-migration-terminal.v1",
      outcome: "superseded",
      reasonCode: "legacy_consumption_unprovable",
      legacyDispatchId: row.dispatch_id,
      currentRevisionId: revision.revisionId,
    };
    await sql.unsafe(
      `INSERT INTO recovery_dispatch_deliveries (
         dispatch_id, recovery_case_id, revision_id, run_id, story_id, state,
         owner_instance_id, lease_token, lease_expires_at, attempt_count,
         terminal_result, diagnostic, authorized_at, terminal_at, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, 0, $10::text::jsonb, $11, $12, $13, $12, $12
       )`,
      [
        dispatch.dispatchId,
        dispatch.recoveryCaseId,
        dispatch.revisionId,
        dispatch.runId,
        dispatch.storyId,
        "superseded",
        "migration-v11",
        hashCanonicalJson({ schema: "setfarm.migration-lease.v1", dispatchId: dispatch.dispatchId }),
        dispatch.authorizedAt,
        JSON.stringify(terminalResult),
        "MIGRATION_V11_LEGACY_CONSUMPTION_UNPROVABLE",
        dispatch.authorizedAt,
        dispatch.authorizedAt,
      ],
    );
    } else {
      disposition = "legacy_history_only";
      reasonCode = "historical_semantics_not_current";
    }

    const receipt = {
      schema: "setfarm.recovery-dispatch-migration-receipt.v1",
      legacyDispatchId: row.dispatch_id,
      currentRevisionId: revision.revisionId,
      ...(canonicalDispatchId ? { canonicalDispatchId } : {}),
      disposition,
      reasonCode,
      evidenceRefs: [
        `setfarm://legacy-recovery-dispatch/${row.dispatch_id}`,
        `setfarm://recovery-revision/${revision.revisionId}`,
        ...(canonicalDispatchId ? [`setfarm://recovery-dispatch/${canonicalDispatchId}`] : []),
      ],
    };
    await sql.unsafe(
      `INSERT INTO recovery_dispatch_migration_receipts (
         legacy_dispatch_id, recovery_case_id, current_revision_id,
         canonical_dispatch_id, disposition, reason_code, evidence, migrated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb, CURRENT_TIMESTAMP)`,
      [
        row.dispatch_id,
        row.recovery_case_id,
        revision.revisionId,
        canonicalDispatchId ?? null,
        disposition,
        reasonCode,
        JSON.stringify(receipt),
      ],
    );
  }
}

async function applyRecoveryDeliveryLedger(sql: TransactionSql): Promise<void> {
  for (const statement of RECOVERY_DELIVERY_LEDGER_PRE_BACKFILL_STATEMENTS) {
    await sql.unsafe(statement);
  }
  const revisions = await backfillSemanticRecoveryRevisions(sql);
  for (const statement of RECOVERY_DELIVERY_LEDGER_POST_BACKFILL_STATEMENTS) {
    await sql.unsafe(statement);
  }
  await backfillSemanticRecoveryDispatches(sql, revisions);
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v11-semantic-apply:END

const OPERATIONAL_EVENT_PROJECTION_STATEMENTS = [
  `CREATE TABLE operational_events (
    event_key TEXT PRIMARY KEY,
    outbox_id TEXT NOT NULL UNIQUE REFERENCES operational_outbox(outbox_id) ON DELETE RESTRICT,
    request_id TEXT,
    event_type TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    event_hash TEXT NOT NULL CHECK (event_hash ~ '^[a-f0-9]{64}$'),
    source_created_at TIMESTAMPTZ NOT NULL,
    committed_at TIMESTAMPTZ NOT NULL,
    CHECK (NULLIF(BTRIM(event_key), '') IS NOT NULL),
    CHECK (NULLIF(BTRIM(outbox_id), '') IS NOT NULL),
    CHECK (NULLIF(BTRIM(event_type), '') IS NOT NULL),
    CHECK (NULLIF(BTRIM(aggregate_type), '') IS NOT NULL),
    CHECK (NULLIF(BTRIM(aggregate_id), '') IS NOT NULL),
    CHECK (NULLIF(BTRIM(run_id), '') IS NOT NULL),
    CHECK (jsonb_typeof(payload) = 'object'),
    CHECK (NULLIF(payload->>'schema', '') IS NOT NULL),
    CHECK (source_created_at <= committed_at)
  )`,
  `CREATE FUNCTION setfarm_forbid_operational_event_mutation()
   RETURNS TRIGGER
   LANGUAGE plpgsql
   AS $$
   BEGIN
     RAISE EXCEPTION 'OPERATIONAL_EVENT_IMMUTABLE'
       USING ERRCODE = '23514';
   END;
   $$`,
  `CREATE TRIGGER trg_operational_events_immutable
     BEFORE UPDATE OR DELETE ON operational_events
     FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_operational_event_mutation()`,
  `CREATE TABLE operational_event_deliveries (
    event_key TEXT NOT NULL REFERENCES operational_events(event_key) ON DELETE RESTRICT,
    consumer TEXT NOT NULL CHECK (consumer IN ('jsonl', 'webhook')),
    delivery_id TEXT NOT NULL UNIQUE CHECK (delivery_id ~ '^OED_[a-f0-9]{64}$'),
    input_hash TEXT NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
    idempotency_key TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN (
      'pending', 'leased', 'delivered', 'skipped', 'quarantined'
    )),
    owner_instance_id TEXT,
    lease_token TEXT,
    lease_expires_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
    delivered_at TIMESTAMPTZ,
    diagnostic TEXT,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_key, consumer),
    CHECK (idempotency_key = event_key),
    CHECK (jsonb_typeof(result) = 'object'),
    CHECK ((state = 'leased') = (owner_instance_id IS NOT NULL)),
    CHECK ((state = 'leased') = (lease_token IS NOT NULL)),
    CHECK ((state = 'leased') = (lease_expires_at IS NOT NULL)),
    CHECK ((state IN ('delivered', 'skipped')) = (delivered_at IS NOT NULL)),
    CHECK (state <> 'quarantined' OR NULLIF(diagnostic, '') IS NOT NULL)
  )`,
  "CREATE INDEX idx_operational_event_deliveries_claimable ON operational_event_deliveries(consumer, state, lease_expires_at, created_at, event_key)",
  "CREATE INDEX idx_operational_events_run ON operational_events(run_id, source_created_at, event_key)",
] as const;

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v12-semantic-apply:BEGIN
type LegacyPublishedOutboxRow = Readonly<{
  outbox_id: string;
  request_id: string | null;
  event_key: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  published_at: Date | string;
  created_at: Date | string;
}>;

function operationalMigrationTimestamp(value: Date | string, code: string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", code);
  }
  return parsed.toISOString();
}

async function applyOperationalEventProjection(sql: TransactionSql): Promise<void> {
  for (const statement of OPERATIONAL_EVENT_PROJECTION_STATEMENTS) {
    await sql.unsafe(statement);
  }
  const rows = await sql.unsafe<LegacyPublishedOutboxRow[]>(
    `SELECT outbox_id, request_id, event_key, event_type, aggregate_type,
            aggregate_id, payload, published_at, created_at
       FROM operational_outbox
      WHERE state = 'published'
      ORDER BY created_at, outbox_id
      FOR SHARE`,
  );
  for (const row of rows) {
    const event = createCanonicalOperationalEventV1({
      eventKey: row.event_key,
      outboxId: row.outbox_id,
      requestId: row.request_id,
      eventType: row.event_type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      payload: migrationObject(row.payload, `legacy outbox payload invalid: ${row.event_key}`),
      sourceCreatedAt: operationalMigrationTimestamp(
        row.created_at,
        `legacy outbox source timestamp invalid: ${row.event_key}`,
      ),
      committedAt: operationalMigrationTimestamp(
        row.published_at,
        `legacy outbox publication timestamp invalid: ${row.event_key}`,
      ),
    });
    await sql.unsafe(
      `INSERT INTO operational_events (
         event_key, outbox_id, request_id, event_type, aggregate_type,
         aggregate_id, run_id, payload, event_hash, source_created_at, committed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb, $9, $10, $11)`,
      [
        event.eventKey,
        event.outboxId,
        event.requestId,
        event.eventType,
        event.aggregateType,
        event.aggregateId,
        event.runId,
        JSON.stringify(event.payload),
        event.eventHash,
        event.sourceCreatedAt,
        event.committedAt,
      ],
    );
    for (const consumer of ["jsonl", "webhook"] as const) {
      const legacyWebhook = consumer === "webhook";
      const result = legacyWebhook
        ? {
            schema: "setfarm.operational-delivery-migration-result.v1",
            reason: "legacy_webhook_delivery_state_unknown",
          }
        : {
            schema: "setfarm.operational-delivery-migration-result.v1",
            reason: "jsonl_projection_requires_event_key_reconciliation",
          };
      await sql.unsafe(
        `INSERT INTO operational_event_deliveries (
           event_key, consumer, delivery_id, input_hash, idempotency_key,
           state, attempt_count, diagnostic, result, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $1, $5, $6, $7, $8::text::jsonb, $9, $9)`,
        [
          event.eventKey,
          consumer,
          operationalEventDeliveryId(event.eventKey, consumer),
          event.eventHash,
          legacyWebhook ? "quarantined" : "pending",
          legacyWebhook ? 3 : 0,
          legacyWebhook ? "LEGACY_WEBHOOK_DELIVERY_STATE_UNKNOWN" : null,
          JSON.stringify(result),
          event.committedAt,
        ],
      );
    }
  }
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v12-semantic-apply:END

const ACCEPTED_CANDIDATE_STATEMENTS = [
  "ALTER TABLE runs ADD COLUMN accepted_candidate_hash TEXT",
  "ALTER TABLE product_packets ADD CONSTRAINT product_packets_run_packet_unique UNIQUE (run_id, packet_hash)",
  `CREATE TABLE accepted_candidates (
    candidate_hash TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL UNIQUE,
    run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE RESTRICT,
    packet_hash TEXT NOT NULL,
    story_plan_hash TEXT NOT NULL,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    integration_evidence_hash TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT accepted_candidates_hash_check CHECK (candidate_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidates_id_check CHECK (candidate_id ~ '^ACPT_[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidates_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidates_story_plan_hash_check CHECK (story_plan_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidates_source_sha_check CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT accepted_candidates_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT accepted_candidates_integration_hash_check CHECK (integration_evidence_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidates_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT accepted_candidates_payload_identity_check CHECK (
      payload->>'schema' = 'setfarm.accepted-candidate.v1'
      AND payload->>'candidateHash' = candidate_hash
      AND payload->>'candidateId' = candidate_id
      AND payload->>'runId' = run_id
      AND payload->>'packetHash' = packet_hash
      AND payload->>'storyPlanHash' = story_plan_hash
      AND payload->'sourceRevision'->>'sha' = source_sha
      AND payload->'sourceRevision'->>'treeHash' = source_tree_hash
      AND payload->>'integrationEvidenceHash' = integration_evidence_hash
      AND jsonb_typeof(payload->'storyEvidence') = 'array'
      AND jsonb_array_length(payload->'storyEvidence') > 0
    ),
    CONSTRAINT accepted_candidates_run_packet_fkey
      FOREIGN KEY (run_id, packet_hash) REFERENCES product_packets(run_id, packet_hash) ON DELETE RESTRICT,
    CONSTRAINT accepted_candidates_hash_run_unique UNIQUE (candidate_hash, run_id)
  )`,
  `CREATE TABLE accepted_candidate_story_evidence (
    candidate_hash TEXT NOT NULL REFERENCES accepted_candidates(candidate_hash) ON DELETE RESTRICT,
    story_id TEXT NOT NULL,
    attempt_id TEXT NOT NULL REFERENCES execution_attempts(attempt_id) ON DELETE RESTRICT,
    slice_hash TEXT NOT NULL REFERENCES semantic_artifacts(artifact_hash) ON DELETE RESTRICT,
    evidence_plan_hash TEXT NOT NULL,
    evidence_plan_artifact_hash TEXT NOT NULL REFERENCES semantic_artifacts(artifact_hash) ON DELETE RESTRICT,
    evidence_bundle_hash TEXT NOT NULL REFERENCES evidence_bundles(evidence_bundle_hash) ON DELETE RESTRICT,
    evidence_id TEXT NOT NULL,
    predicate_refs JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (candidate_hash, story_id),
    CONSTRAINT accepted_candidate_story_attempt_unique UNIQUE (candidate_hash, attempt_id),
    CONSTRAINT accepted_candidate_story_bundle_unique UNIQUE (candidate_hash, evidence_bundle_hash),
    CONSTRAINT accepted_candidate_story_slice_hash_check CHECK (slice_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidate_story_plan_hash_check CHECK (evidence_plan_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidate_story_plan_artifact_hash_check CHECK (evidence_plan_artifact_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidate_story_bundle_hash_check CHECK (evidence_bundle_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidate_story_evidence_id_check CHECK (evidence_id ~ '^EVB_[a-f0-9]{64}$'),
    CONSTRAINT accepted_candidate_story_predicates_check CHECK (
      jsonb_typeof(predicate_refs) = 'array' AND jsonb_array_length(predicate_refs) > 0
    )
  )`,
  `ALTER TABLE runs ADD CONSTRAINT runs_accepted_candidate_identity_fkey
     FOREIGN KEY (accepted_candidate_hash, id)
     REFERENCES accepted_candidates(candidate_hash, run_id)
     DEFERRABLE INITIALLY DEFERRED`,
  "CREATE INDEX idx_accepted_candidates_source ON accepted_candidates(run_id, source_tree_hash, candidate_hash)",
  "CREATE INDEX idx_accepted_candidate_story_bundle ON accepted_candidate_story_evidence(evidence_bundle_hash, candidate_hash)",
  `CREATE TRIGGER trg_accepted_candidates_immutable
     BEFORE UPDATE OR DELETE ON accepted_candidates
     FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE TRIGGER trg_accepted_candidate_story_evidence_immutable
     BEFORE UPDATE OR DELETE ON accepted_candidate_story_evidence
     FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
] as const;

const EXPECTED_ACCEPTED_CANDIDATE_COLUMNS = new Map([
  ["candidate_hash", { dataType: "text", nullable: "NO" as const }],
  ["candidate_id", { dataType: "text", nullable: "NO" as const }],
  ["run_id", { dataType: "text", nullable: "NO" as const }],
  ["packet_hash", { dataType: "text", nullable: "NO" as const }],
  ["story_plan_hash", { dataType: "text", nullable: "NO" as const }],
  ["source_sha", { dataType: "text", nullable: "NO" as const }],
  ["source_tree_hash", { dataType: "text", nullable: "NO" as const }],
  ["integration_evidence_hash", { dataType: "text", nullable: "NO" as const }],
  ["payload", { dataType: "jsonb", nullable: "NO" as const }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
]);

const EXPECTED_ACCEPTED_STORY_COLUMNS = new Map([
  ["candidate_hash", { dataType: "text", nullable: "NO" as const }],
  ["story_id", { dataType: "text", nullable: "NO" as const }],
  ["attempt_id", { dataType: "text", nullable: "NO" as const }],
  ["slice_hash", { dataType: "text", nullable: "NO" as const }],
  ["evidence_plan_hash", { dataType: "text", nullable: "NO" as const }],
  ["evidence_plan_artifact_hash", { dataType: "text", nullable: "NO" as const }],
  ["evidence_bundle_hash", { dataType: "text", nullable: "NO" as const }],
  ["evidence_id", { dataType: "text", nullable: "NO" as const }],
  ["predicate_refs", { dataType: "jsonb", nullable: "NO" as const }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
]);

const EXPECTED_ACCEPTED_CANDIDATE_INDEXES = new Map([
  [
    "idx_accepted_candidates_source",
    "create index idx_accepted_candidates_source on public.accepted_candidates using btree (run_id, source_tree_hash, candidate_hash)",
  ],
  [
    "idx_accepted_candidate_story_bundle",
    "create index idx_accepted_candidate_story_bundle on public.accepted_candidate_story_evidence using btree (evidence_bundle_hash, candidate_hash)",
  ],
]);

async function detectAcceptedCandidateLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const runColumns = await readColumns(sql, "runs");
  const candidates = await relationExists(sql, "accepted_candidates");
  const stories = await relationExists(sql, "accepted_candidate_story_evidence");
  const indexes = await readNamedIndexes(sql, [...EXPECTED_ACCEPTED_CANDIDATE_INDEXES.keys()]);
  const hasRunPointer = runColumns.has("accepted_candidate_hash");
  if (!hasRunPointer && !candidates && !stories && indexes.size === 0) return "absent";
  if (hasRunPointer && candidates && stories && indexes.size === EXPECTED_ACCEPTED_CANDIDATE_INDEXES.size) {
    return "present";
  }
  return "partial";
}

async function verifyAcceptedCandidateLedger(sql: Sql | TransactionSql): Promise<void> {
  const runColumns = await readColumns(sql, "runs");
  const runPointer = runColumns.get("accepted_candidate_hash");
  if (!runPointer || runPointer.data_type !== "text" || runPointer.is_nullable !== "YES") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "runs accepted candidate pointer column mismatch",
    );
  }
  await verifyExpectedTableColumns(sql, "accepted_candidates", EXPECTED_ACCEPTED_CANDIDATE_COLUMNS);
  await verifyExpectedTableColumns(sql, "accepted_candidate_story_evidence", EXPECTED_ACCEPTED_STORY_COLUMNS);
  const indexes = await readNamedIndexes(sql, [...EXPECTED_ACCEPTED_CANDIDATE_INDEXES.keys()]);
  for (const [name, expected] of EXPECTED_ACCEPTED_CANDIDATE_INDEXES) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `accepted candidate index mismatch: ${name}`,
      );
    }
  }
  const constraints = await sql.unsafe<Array<{ conname: string; definition: string }>>(
    `SELECT conname, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conname = ANY($1::text[])`,
    [[
      "accepted_candidates_run_packet_fkey",
      "runs_accepted_candidate_identity_fkey",
      "accepted_candidates_payload_identity_check",
      "accepted_candidate_story_predicates_check",
    ]],
  );
  const definitions = new Map(constraints.map((row) => [row.conname, normalizeSql(row.definition)]));
  const fragments = new Map([
    ["accepted_candidates_run_packet_fkey", "foreign key (run_id, packet_hash) references product_packets(run_id, packet_hash)"],
    ["runs_accepted_candidate_identity_fkey", "foreign key (accepted_candidate_hash, id) references accepted_candidates(candidate_hash, run_id)"],
    ["accepted_candidates_payload_identity_check", "'candidatehash'::text) = candidate_hash"],
    ["accepted_candidate_story_predicates_check", "jsonb_array_length(predicate_refs) > 0"],
  ]);
  for (const [name, fragment] of fragments) {
    if (!definitions.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `accepted candidate constraint mismatch: ${name}`,
      );
    }
  }
  const triggers = await sql.unsafe<Array<{ tgname: string; enabled: string }>>(
    `SELECT t.tgname, t.tgenabled AS enabled
       FROM pg_trigger t
      WHERE NOT t.tgisinternal
        AND t.tgname = ANY($1::text[])`,
    [["trg_accepted_candidates_immutable", "trg_accepted_candidate_story_evidence_immutable"]],
  );
  if (triggers.length !== 2 || triggers.some((trigger) => trigger.enabled !== "O")) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "accepted candidate immutability trigger mismatch",
    );
  }
}

const V3_DEPLOY_RECEIPT_STATEMENTS = [
  "ALTER TABLE runs ADD COLUMN deploy_receipt_hash TEXT",
  `ALTER TABLE accepted_candidates
     ADD CONSTRAINT accepted_candidates_deploy_binding_unique
     UNIQUE (candidate_hash, run_id, packet_hash, source_sha, source_tree_hash)`,
  `ALTER TABLE claim_log
     ADD CONSTRAINT claim_log_id_run_workflow_unique
     UNIQUE (id, run_id, step_id)`,
  `CREATE TABLE v3_deploy_receipts (
    receipt_hash TEXT PRIMARY KEY,
    run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE RESTRICT,
    step_db_id TEXT NOT NULL,
    workflow_step_id TEXT NOT NULL,
    claim_id BIGINT NOT NULL UNIQUE,
    candidate_id TEXT NOT NULL,
    candidate_hash TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    product_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    summary TEXT NOT NULL,
    stack_pack_id TEXT NOT NULL,
    stack_pack_version TEXT NOT NULL,
    stack_pack_content_hash TEXT NOT NULL,
    platform TEXT,
    tech_stack TEXT,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    build_artifact_hash TEXT NOT NULL,
    build_manifest_file_count INTEGER NOT NULL,
    build_manifest_total_bytes BIGINT NOT NULL,
    build_manifest_ref TEXT NOT NULL,
    sealed_runtime_ref TEXT NOT NULL,
    service_id TEXT NOT NULL,
    deployment_mode TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    health_url TEXT NOT NULL,
    deploy_url TEXT NOT NULL,
    health_http_status INTEGER NOT NULL,
    health_checked_at TIMESTAMPTZ NOT NULL,
    runtime_owner_pid INTEGER NOT NULL,
    runtime_owner_started_at TIMESTAMPTZ NOT NULL,
    runtime_owner_process_group_id INTEGER NOT NULL,
    terminal_projection_ref TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT v3_deploy_receipts_hash_check CHECK (receipt_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_deploy_receipts_workflow_check CHECK (workflow_step_id = 'deploy'),
    CONSTRAINT v3_deploy_receipts_candidate_id_check CHECK (candidate_id = 'ACPT_' || candidate_hash),
    CONSTRAINT v3_deploy_receipts_candidate_hash_check CHECK (candidate_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_deploy_receipts_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_deploy_receipts_stack_hash_check CHECK (stack_pack_content_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_deploy_receipts_source_sha_check CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT v3_deploy_receipts_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT v3_deploy_receipts_build_artifact_hash_check CHECK (build_artifact_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_deploy_receipts_build_manifest_count_check CHECK (build_manifest_file_count BETWEEN 1 AND 50000),
    CONSTRAINT v3_deploy_receipts_build_manifest_size_check CHECK (build_manifest_total_bytes BETWEEN 0 AND 4294967296),
    CONSTRAINT v3_deploy_receipts_project_id_check CHECK (project_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT v3_deploy_receipts_mode_check CHECK (deployment_mode IN ('local', 'remote')),
    CONSTRAINT v3_deploy_receipts_port_check CHECK (port BETWEEN 1 AND 65535),
    CONSTRAINT v3_deploy_receipts_health_status_check CHECK (health_http_status BETWEEN 200 AND 399),
    CONSTRAINT v3_deploy_receipts_runtime_owner_check CHECK (
      runtime_owner_pid > 0
      AND runtime_owner_process_group_id = runtime_owner_pid
      AND service_id = 'process:' || runtime_owner_pid::text
    ),
    CONSTRAINT v3_deploy_receipts_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT v3_deploy_receipts_payload_identity_check CHECK (
      payload->>'schema' = 'setfarm.v3-deploy-receipt.v1'
      AND payload->>'receiptHash' = receipt_hash
      AND payload->>'runId' = run_id
      AND payload->>'candidateId' = candidate_id
      AND payload->>'candidateHash' = candidate_hash
      AND payload->>'packetHash' = packet_hash
      AND payload->'project'->>'productId' = product_id
      AND payload->'project'->>'projectId' = project_id
      AND payload->'project'->>'displayName' = display_name
      AND payload->'project'->>'summary' = summary
      AND payload->'stack'->>'stackPackId' = stack_pack_id
      AND payload->'stack'->>'stackPackVersion' = stack_pack_version
      AND payload->'stack'->>'stackPackContentHash' = stack_pack_content_hash
      AND payload->'stack'->>'platform' IS NOT DISTINCT FROM platform
      AND payload->'stack'->>'techStack' IS NOT DISTINCT FROM tech_stack
      AND payload->'sourceBefore'->>'sha' = source_sha
      AND payload->'sourceBefore'->>'treeHash' = source_tree_hash
      AND payload->'sourceAfter'->>'sha' = source_sha
      AND payload->'sourceAfter'->>'treeHash' = source_tree_hash
      AND payload->'buildArtifact'->>'artifactHash' = build_artifact_hash
      AND payload->'buildArtifact'->>'evidenceRef' = build_manifest_ref
      AND jsonb_array_length(payload->'buildArtifact'->'files') = build_manifest_file_count
      AND (payload->'buildArtifact'->>'totalBytes')::bigint = build_manifest_total_bytes
      AND payload->'runtime'->>'projectId' = project_id
      AND payload->'runtime'->>'serviceId' = service_id
      AND payload->'runtime'->>'mode' = deployment_mode
      AND payload->'runtime'->>'host' = host
      AND (payload->'runtime'->>'port')::integer = port
      AND payload->'runtime'->>'healthUrl' = health_url
      AND payload->'runtime'->>'deployUrl' = deploy_url
      AND payload->'runtime'->>'buildArtifactHash' = build_artifact_hash
      AND payload->'runtime'->>'buildArtifactEvidenceRef' = build_manifest_ref
      AND payload->'runtime'->>'sealedRuntimeRef' = sealed_runtime_ref
      AND payload->'health'->>'status' = 'pass'
      AND (payload->'health'->>'httpStatus')::integer = health_http_status
      AND (payload->'health'->>'checkedAt')::timestamptz = health_checked_at
      AND payload->'health'->>'buildArtifactHash' = build_artifact_hash
      AND payload->'health'->>'buildArtifactEvidenceRef' = build_manifest_ref
      AND (payload->'health'->'listenerOwnership'->'ownerProcess'->>'pid')::integer = runtime_owner_pid
      AND (payload->'health'->'listenerOwnership'->'ownerProcess'->>'processStartedAt')::timestamptz = runtime_owner_started_at
      AND (payload->'health'->'listenerOwnership'->'ownerProcess'->>'processGroupId')::integer = runtime_owner_process_group_id
      AND payload->'health'->'listenerOwnership'->>'host' = host
      AND (payload->'health'->'listenerOwnership'->>'port')::integer = port
      AND payload->'terminalProjectProjection'->>'owner' = 'mission-control-terminal-projector'
      AND payload->'terminalProjectProjection'->>'state' = 'pending_terminal_projection'
      AND payload->'terminalProjectProjection'->>'runId' = run_id
      AND payload->'terminalProjectProjection'->>'candidateHash' = candidate_hash
      AND payload->'terminalProjectProjection'->>'projectId' = project_id
      AND payload->'terminalProjectProjection'->>'serviceId' = service_id
      AND (payload->'terminalProjectProjection'->>'port')::integer = port
      AND payload->'terminalProjectProjection'->>'healthUrl' = health_url
      AND payload->'terminalProjectProjection'->>'evidenceRef' = terminal_projection_ref
      AND payload->'terminalProjectProjection'->>'buildArtifactHash' = build_artifact_hash
      AND (payload->>'completedAt')::timestamptz = completed_at
    ),
    CONSTRAINT v3_deploy_receipts_claim_run_workflow_fkey
      FOREIGN KEY (claim_id, run_id, workflow_step_id)
      REFERENCES claim_log(id, run_id, step_id) ON DELETE RESTRICT,
    CONSTRAINT v3_deploy_receipts_candidate_source_fkey
      FOREIGN KEY (candidate_hash, run_id, packet_hash, source_sha, source_tree_hash)
      REFERENCES accepted_candidates(candidate_hash, run_id, packet_hash, source_sha, source_tree_hash)
      ON DELETE RESTRICT,
    CONSTRAINT v3_deploy_receipts_run_packet_fkey
      FOREIGN KEY (run_id, packet_hash)
      REFERENCES product_packets(run_id, packet_hash) ON DELETE RESTRICT,
    CONSTRAINT v3_deploy_receipts_hash_run_unique UNIQUE (receipt_hash, run_id)
  )`,
  `ALTER TABLE runs ADD CONSTRAINT runs_deploy_receipt_identity_fkey
     FOREIGN KEY (deploy_receipt_hash, id)
     REFERENCES v3_deploy_receipts(receipt_hash, run_id)
     DEFERRABLE INITIALLY DEFERRED`,
  "CREATE INDEX idx_v3_deploy_receipts_projection ON v3_deploy_receipts(run_id, project_id, service_id, created_at)",
  `CREATE TRIGGER trg_v3_deploy_receipts_immutable
     BEFORE UPDATE OR DELETE ON v3_deploy_receipts
     FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE FUNCTION setfarm_enforce_deploy_receipt_pointer_set_once()
   RETURNS TRIGGER AS $$
   BEGIN
     IF OLD.deploy_receipt_hash IS DISTINCT FROM NEW.deploy_receipt_hash
        AND NOT (OLD.deploy_receipt_hash IS NULL AND NEW.deploy_receipt_hash IS NOT NULL) THEN
       RAISE EXCEPTION 'SETFARM_DEPLOY_RECEIPT_POINTER_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_runs_deploy_receipt_set_once
     BEFORE UPDATE OF deploy_receipt_hash ON runs
     FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_deploy_receipt_pointer_set_once()`,
] as const;

const EXPECTED_V3_DEPLOY_RECEIPT_COLUMNS = new Map([
  ["receipt_hash", { dataType: "text", nullable: "NO" as const }],
  ["run_id", { dataType: "text", nullable: "NO" as const }],
  ["step_db_id", { dataType: "text", nullable: "NO" as const }],
  ["workflow_step_id", { dataType: "text", nullable: "NO" as const }],
  ["claim_id", { dataType: "bigint", nullable: "NO" as const }],
  ["candidate_id", { dataType: "text", nullable: "NO" as const }],
  ["candidate_hash", { dataType: "text", nullable: "NO" as const }],
  ["packet_hash", { dataType: "text", nullable: "NO" as const }],
  ["product_id", { dataType: "text", nullable: "NO" as const }],
  ["project_id", { dataType: "text", nullable: "NO" as const }],
  ["display_name", { dataType: "text", nullable: "NO" as const }],
  ["summary", { dataType: "text", nullable: "NO" as const }],
  ["stack_pack_id", { dataType: "text", nullable: "NO" as const }],
  ["stack_pack_version", { dataType: "text", nullable: "NO" as const }],
  ["stack_pack_content_hash", { dataType: "text", nullable: "NO" as const }],
  ["platform", { dataType: "text", nullable: "YES" as const }],
  ["tech_stack", { dataType: "text", nullable: "YES" as const }],
  ["source_sha", { dataType: "text", nullable: "NO" as const }],
  ["source_tree_hash", { dataType: "text", nullable: "NO" as const }],
  ["build_artifact_hash", { dataType: "text", nullable: "NO" as const }],
  ["build_manifest_file_count", { dataType: "integer", nullable: "NO" as const }],
  ["build_manifest_total_bytes", { dataType: "bigint", nullable: "NO" as const }],
  ["build_manifest_ref", { dataType: "text", nullable: "NO" as const }],
  ["sealed_runtime_ref", { dataType: "text", nullable: "NO" as const }],
  ["service_id", { dataType: "text", nullable: "NO" as const }],
  ["deployment_mode", { dataType: "text", nullable: "NO" as const }],
  ["host", { dataType: "text", nullable: "NO" as const }],
  ["port", { dataType: "integer", nullable: "NO" as const }],
  ["health_url", { dataType: "text", nullable: "NO" as const }],
  ["deploy_url", { dataType: "text", nullable: "NO" as const }],
  ["health_http_status", { dataType: "integer", nullable: "NO" as const }],
  ["health_checked_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
  ["runtime_owner_pid", { dataType: "integer", nullable: "NO" as const }],
  ["runtime_owner_started_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
  ["runtime_owner_process_group_id", { dataType: "integer", nullable: "NO" as const }],
  ["terminal_projection_ref", { dataType: "text", nullable: "NO" as const }],
  ["completed_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
  ["payload", { dataType: "jsonb", nullable: "NO" as const }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
]);

async function detectV3DeployReceiptLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const runColumns = await readColumns(sql, "runs");
  const ledger = await relationExists(sql, "v3_deploy_receipts");
  const indexes = await readNamedIndexes(sql, ["idx_v3_deploy_receipts_projection"]);
  const hasRunPointer = runColumns.has("deploy_receipt_hash");
  if (!hasRunPointer && !ledger && indexes.size === 0) return "absent";
  if (hasRunPointer && ledger && indexes.size === 1) return "present";
  return "partial";
}

async function verifyV3DeployReceiptLedger(sql: Sql | TransactionSql): Promise<void> {
  const runColumns = await readColumns(sql, "runs");
  const runPointer = runColumns.get("deploy_receipt_hash");
  if (!runPointer || runPointer.data_type !== "text" || runPointer.is_nullable !== "YES") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "runs deploy receipt pointer column mismatch",
    );
  }
  await verifyExpectedTableColumns(sql, "v3_deploy_receipts", EXPECTED_V3_DEPLOY_RECEIPT_COLUMNS);
  const indexes = await readNamedIndexes(sql, ["idx_v3_deploy_receipts_projection"]);
  if (indexes.get("idx_v3_deploy_receipts_projection")
    !== "create index idx_v3_deploy_receipts_projection on public.v3_deploy_receipts using btree (run_id, project_id, service_id, created_at)") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "v3 deploy receipt projection index mismatch",
    );
  }
  const constraints = await sql.unsafe<Array<{
    conname: string;
    contype: string;
    condeferrable: boolean;
    condeferred: boolean;
    confdeltype: string;
    definition: string;
  }>>(
    `SELECT conname, contype, condeferrable, condeferred, confdeltype,
            pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conname = ANY($1::text[])`,
    [[
      "accepted_candidates_deploy_binding_unique",
      "claim_log_id_run_workflow_unique",
      "v3_deploy_receipts_pkey",
      "v3_deploy_receipts_run_id_key",
      "v3_deploy_receipts_run_id_fkey",
      "v3_deploy_receipts_claim_id_key",
      "v3_deploy_receipts_hash_check",
      "v3_deploy_receipts_workflow_check",
      "v3_deploy_receipts_candidate_id_check",
      "v3_deploy_receipts_candidate_hash_check",
      "v3_deploy_receipts_packet_hash_check",
      "v3_deploy_receipts_stack_hash_check",
      "v3_deploy_receipts_source_sha_check",
      "v3_deploy_receipts_source_tree_hash_check",
      "v3_deploy_receipts_build_artifact_hash_check",
      "v3_deploy_receipts_build_manifest_count_check",
      "v3_deploy_receipts_build_manifest_size_check",
      "v3_deploy_receipts_project_id_check",
      "v3_deploy_receipts_mode_check",
      "v3_deploy_receipts_port_check",
      "v3_deploy_receipts_health_status_check",
      "v3_deploy_receipts_runtime_owner_check",
      "v3_deploy_receipts_payload_object_check",
      "v3_deploy_receipts_payload_identity_check",
      "v3_deploy_receipts_claim_run_workflow_fkey",
      "v3_deploy_receipts_candidate_source_fkey",
      "v3_deploy_receipts_run_packet_fkey",
      "v3_deploy_receipts_hash_run_unique",
      "runs_deploy_receipt_identity_fkey",
    ]],
  );
  const byName = new Map(constraints.map((row) => [row.conname, row]));
  const definitions = new Map(constraints.map((row) => [row.conname, normalizeSql(row.definition)]));
  const fragments = new Map([
    ["accepted_candidates_deploy_binding_unique", "unique (candidate_hash, run_id, packet_hash, source_sha, source_tree_hash)"],
    ["claim_log_id_run_workflow_unique", "unique (id, run_id, step_id)"],
    ["v3_deploy_receipts_pkey", "primary key (receipt_hash)"],
    ["v3_deploy_receipts_run_id_key", "unique (run_id)"],
    ["v3_deploy_receipts_run_id_fkey", "foreign key (run_id) references runs(id) on delete restrict"],
    ["v3_deploy_receipts_claim_id_key", "unique (claim_id)"],
    ["v3_deploy_receipts_hash_check", "receipt_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_deploy_receipts_workflow_check", "workflow_step_id = 'deploy'::text"],
    ["v3_deploy_receipts_candidate_id_check", "candidate_id = ('acpt_'::text || candidate_hash)"],
    ["v3_deploy_receipts_candidate_hash_check", "candidate_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_deploy_receipts_packet_hash_check", "packet_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_deploy_receipts_stack_hash_check", "stack_pack_content_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_deploy_receipts_source_sha_check", "source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'::text"],
    ["v3_deploy_receipts_source_tree_hash_check", "source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'::text"],
    ["v3_deploy_receipts_build_artifact_hash_check", "build_artifact_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_deploy_receipts_build_manifest_count_check", "build_manifest_file_count >= 1 and build_manifest_file_count <= 50000"],
    ["v3_deploy_receipts_build_manifest_size_check", "build_manifest_total_bytes >= 0"],
    ["v3_deploy_receipts_project_id_check", "project_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text"],
    ["v3_deploy_receipts_mode_check", "deployment_mode = any"],
    ["v3_deploy_receipts_port_check", "port >= 1 and port <= 65535"],
    ["v3_deploy_receipts_health_status_check", "health_http_status >= 200 and health_http_status <= 399"],
    ["v3_deploy_receipts_runtime_owner_check", "runtime_owner_process_group_id = runtime_owner_pid"],
    ["v3_deploy_receipts_payload_object_check", "jsonb_typeof(payload) = 'object'::text"],
    ["v3_deploy_receipts_payload_identity_check", "'receipthash'::text) = receipt_hash"],
    ["v3_deploy_receipts_claim_run_workflow_fkey", "foreign key (claim_id, run_id, workflow_step_id) references claim_log(id, run_id, step_id)"],
    ["v3_deploy_receipts_candidate_source_fkey", "foreign key (candidate_hash, run_id, packet_hash, source_sha, source_tree_hash) references accepted_candidates(candidate_hash, run_id, packet_hash, source_sha, source_tree_hash)"],
    ["v3_deploy_receipts_run_packet_fkey", "foreign key (run_id, packet_hash) references product_packets(run_id, packet_hash)"],
    ["v3_deploy_receipts_hash_run_unique", "unique (receipt_hash, run_id)"],
    ["runs_deploy_receipt_identity_fkey", "foreign key (deploy_receipt_hash, id) references v3_deploy_receipts(receipt_hash, run_id) deferrable initially deferred"],
  ]);
  for (const [name, fragment] of fragments) {
    if (!definitions.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 deploy receipt constraint mismatch: ${name}`,
      );
    }
  }
  if (!definitions.get("v3_deploy_receipts_build_manifest_size_check")?.includes("build_manifest_total_bytes <= '4294967296'::bigint")) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "v3 deploy receipt manifest upper bound mismatch",
    );
  }
  const payloadDefinition = definitions.get("v3_deploy_receipts_payload_identity_check") ?? "";
  for (const fragment of [
    "'artifacthash'::text) = build_artifact_hash",
    "jsonb_array_length",
    "build_manifest_file_count",
    "'buildartifacthash'::text) = build_artifact_hash",
    "'sealedruntimeref'::text) = sealed_runtime_ref",
    "runtime_owner_pid",
    "runtime_owner_process_group_id",
  ]) {
    if (!payloadDefinition.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 deploy receipt payload binding mismatch: ${fragment}`,
      );
    }
  }
  for (const name of [
    "v3_deploy_receipts_run_id_fkey",
    "v3_deploy_receipts_claim_run_workflow_fkey",
    "v3_deploy_receipts_candidate_source_fkey",
    "v3_deploy_receipts_run_packet_fkey",
  ]) {
    const constraint = byName.get(name);
    if (!constraint || constraint.contype !== "f" || constraint.confdeltype !== "r" || constraint.condeferrable) {
      throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", `v3 deploy receipt FK semantics mismatch: ${name}`);
    }
  }
  const pointerConstraint = byName.get("runs_deploy_receipt_identity_fkey");
  if (
    !pointerConstraint
    || pointerConstraint.contype !== "f"
    || !pointerConstraint.condeferrable
    || !pointerConstraint.condeferred
    || pointerConstraint.confdeltype !== "a"
  ) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "runs deploy receipt pointer FK semantics mismatch");
  }
  const triggers = await sql.unsafe<Array<{ tgname: string; enabled: string; definition: string }>>(
    `SELECT t.tgname, t.tgenabled AS enabled, pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t
      WHERE NOT t.tgisinternal
        AND t.tgname = ANY($1::text[])`,
    [["trg_v3_deploy_receipts_immutable", "trg_runs_deploy_receipt_set_once"]],
  );
  const triggerDefinitions = new Map(triggers.map((trigger) => [
    trigger.tgname,
    { enabled: trigger.enabled, definition: normalizeSql(trigger.definition) },
  ]));
  if (
    triggerDefinitions.get("trg_v3_deploy_receipts_immutable")?.enabled !== "O"
    || !triggerDefinitions.get("trg_v3_deploy_receipts_immutable")?.definition.includes(
      "execute function setfarm_forbid_artifact_identity_update()",
    )
    || triggerDefinitions.get("trg_runs_deploy_receipt_set_once")?.enabled !== "O"
    || !triggerDefinitions.get("trg_runs_deploy_receipt_set_once")?.definition.includes(
      "before update of deploy_receipt_hash on runs",
    )
    || !triggerDefinitions.get("trg_runs_deploy_receipt_set_once")?.definition.includes(
      "execute function setfarm_enforce_deploy_receipt_pointer_set_once()",
    )
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "v3 deploy receipt immutability/set-once trigger mismatch",
    );
  }
  const functions = await sql.unsafe<Array<{ definition: string | null }>>(
    `SELECT pg_get_functiondef(to_regprocedure('setfarm_enforce_deploy_receipt_pointer_set_once()')) AS definition`,
  );
  const functionDefinition = normalizeSql(functions[0]?.definition ?? "");
  if (
    !functionDefinition.includes("old.deploy_receipt_hash is distinct from new.deploy_receipt_hash")
    || !functionDefinition.includes("old.deploy_receipt_hash is null and new.deploy_receipt_hash is not null")
    || !functionDefinition.includes("setfarm_deploy_receipt_pointer_immutable")
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "runs deploy receipt set-once function mismatch",
    );
  }
}

const V3_RELEASE_ADMISSION_STATEMENTS = [
  "ALTER TABLE runs ADD COLUMN release_admission_hash TEXT",
  `CREATE TABLE v3_release_admissions (
    admission_hash TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('convergence_canary', 'release_go')),
    release_sha TEXT NOT NULL,
    suite_hash TEXT NOT NULL,
    result_hash TEXT,
    result_ref TEXT,
    gate_hash TEXT,
    gate_ref TEXT,
    expires_at TIMESTAMPTZ,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT v3_release_admissions_hash_check CHECK (admission_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_release_admissions_release_check CHECK (release_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'),
    CONSTRAINT v3_release_admissions_suite_check CHECK (suite_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_release_admissions_result_hash_check CHECK (result_hash IS NULL OR result_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_release_admissions_gate_hash_check CHECK (gate_hash IS NULL OR gate_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_release_admissions_result_pair_check CHECK ((result_hash IS NULL) = (result_ref IS NULL)),
    CONSTRAINT v3_release_admissions_gate_pair_check CHECK ((gate_hash IS NULL) = (gate_ref IS NULL)),
    CONSTRAINT v3_release_admissions_result_ref_check CHECK (
      result_ref IS NULL OR result_ref = 'sha256/' || substring(result_hash, 1, 2) || '/' || result_hash || '.json'
    ),
    CONSTRAINT v3_release_admissions_gate_ref_check CHECK (
      gate_ref IS NULL OR gate_ref = 'sha256/' || substring(gate_hash, 1, 2) || '/' || gate_hash || '.json'
    ),
    CONSTRAINT v3_release_admissions_kind_shape_check CHECK (
      (kind = 'convergence_canary' AND result_hash IS NULL AND gate_hash IS NULL AND expires_at IS NOT NULL)
      OR
      (kind = 'release_go' AND result_hash IS NOT NULL AND gate_hash IS NOT NULL AND expires_at IS NULL)
    ),
    CONSTRAINT v3_release_admissions_canary_window_check CHECK (
      kind = 'release_go'
      OR (expires_at > created_at AND expires_at <= created_at + INTERVAL '9 days')
    ),
    CONSTRAINT v3_release_admissions_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT v3_release_admissions_payload_identity_check CHECK (
      payload->>'schema' = 'setfarm.v3-release-admission.v1'
      AND payload->>'admissionHash' = admission_hash
      AND payload->>'kind' = kind
      AND payload->>'releaseSha' = release_sha
      AND payload->>'suiteHash' = suite_hash
      AND payload->'result'->>'hash' IS NOT DISTINCT FROM result_hash
      AND payload->'result'->>'ref' IS NOT DISTINCT FROM result_ref
      AND payload->'gate'->>'hash' IS NOT DISTINCT FROM gate_hash
      AND payload->'gate'->>'ref' IS NOT DISTINCT FROM gate_ref
      AND payload->>'preflightHash' ~ '^[a-f0-9]{64}$'
      AND payload->>'issuedAt' = to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      AND jsonb_typeof(payload->'slots') = 'array'
      AND ((kind = 'release_go' AND jsonb_array_length(payload->'slots') = 0)
        OR (kind = 'convergence_canary' AND jsonb_array_length(payload->'slots') BETWEEN 1 AND 16))
      AND ((expires_at IS NULL AND payload->'expiresAt' = 'null'::jsonb)
        OR payload->>'expiresAt' = to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    ),
    CONSTRAINT v3_release_admissions_hash_release_unique UNIQUE (admission_hash, release_sha),
    CONSTRAINT v3_release_admissions_hash_kind_unique UNIQUE (admission_hash, kind)
  )`,
  "CREATE UNIQUE INDEX idx_v3_release_admissions_release_go ON v3_release_admissions(release_sha) WHERE kind = 'release_go'",
  "CREATE INDEX idx_v3_release_admissions_canary_expiry ON v3_release_admissions(expires_at, admission_hash) WHERE kind = 'convergence_canary'",
  "ALTER TABLE runs ADD CONSTRAINT runs_id_release_admission_unique UNIQUE (id, release_admission_hash)",
  `ALTER TABLE runs ADD CONSTRAINT runs_release_admission_hash_check
     CHECK (release_admission_hash IS NULL OR release_admission_hash ~ '^[a-f0-9]{64}$')`,
  `ALTER TABLE runs ADD CONSTRAINT runs_v3_release_admission_required_check
     CHECK ((protocol = 'v3') = (release_admission_hash IS NOT NULL))`,
  `ALTER TABLE runs ADD CONSTRAINT runs_release_admission_identity_fkey
     FOREIGN KEY (release_admission_hash, compiler_release_sha)
     REFERENCES v3_release_admissions(admission_hash, release_sha)
     DEFERRABLE INITIALLY DEFERRED`,
  `CREATE TABLE v3_canary_admission_claims (
    slot_hash TEXT PRIMARY KEY,
    admission_hash TEXT NOT NULL,
    admission_kind TEXT NOT NULL DEFAULT 'convergence_canary',
    case_hash TEXT NOT NULL,
    task_hash TEXT NOT NULL,
    repetition INTEGER NOT NULL,
    selector_hash TEXT NOT NULL UNIQUE,
    run_id TEXT UNIQUE,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT v3_canary_claims_slot_hash_check CHECK (slot_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_canary_claims_kind_check CHECK (admission_kind = 'convergence_canary'),
    CONSTRAINT v3_canary_claims_case_hash_check CHECK (case_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_canary_claims_task_hash_check CHECK (task_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_canary_claims_repetition_check CHECK (repetition BETWEEN 1 AND 2),
    CONSTRAINT v3_canary_claims_selector_hash_check CHECK (selector_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_canary_claims_consumption_pair_check CHECK ((run_id IS NULL) = (consumed_at IS NULL)),
    CONSTRAINT v3_canary_claims_exact_slot_unique UNIQUE (admission_hash, case_hash, task_hash, repetition),
    CONSTRAINT v3_canary_claims_admission_fkey
      FOREIGN KEY (admission_hash, admission_kind)
      REFERENCES v3_release_admissions(admission_hash, kind) ON DELETE RESTRICT,
    CONSTRAINT v3_canary_claims_run_fkey
      FOREIGN KEY (run_id, admission_hash)
      REFERENCES runs(id, release_admission_hash)
      DEFERRABLE INITIALLY DEFERRED
  )`,
  "CREATE INDEX idx_v3_canary_claims_unconsumed ON v3_canary_admission_claims(admission_hash, case_hash, task_hash, repetition) WHERE run_id IS NULL",
  `CREATE TRIGGER trg_v3_release_admissions_immutable
     BEFORE UPDATE OR DELETE ON v3_release_admissions
     FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE FUNCTION setfarm_enforce_run_release_admission_set_once()
   RETURNS TRIGGER AS $$
   BEGIN
     IF OLD.release_admission_hash IS DISTINCT FROM NEW.release_admission_hash
        AND NOT (OLD.release_admission_hash IS NULL AND NEW.release_admission_hash IS NOT NULL) THEN
       RAISE EXCEPTION 'SETFARM_RUN_RELEASE_ADMISSION_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_runs_release_admission_set_once
     BEFORE UPDATE OF release_admission_hash ON runs
     FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_run_release_admission_set_once()`,
  `CREATE FUNCTION setfarm_enforce_canary_slot_payload_binding()
   RETURNS TRIGGER AS $$
   DECLARE admission_payload JSONB;
   BEGIN
     SELECT payload INTO admission_payload
       FROM v3_release_admissions
      WHERE admission_hash = NEW.admission_hash
        AND kind = 'convergence_canary';
     IF admission_payload IS NULL OR NOT admission_payload @> jsonb_build_object(
       'slots', jsonb_build_array(jsonb_build_object(
         'slotHash', NEW.slot_hash,
         'caseHash', NEW.case_hash,
         'taskHash', NEW.task_hash,
         'repetition', NEW.repetition,
         'selectorHash', NEW.selector_hash
       ))
     ) THEN
       RAISE EXCEPTION 'SETFARM_CANARY_SLOT_PAYLOAD_MISMATCH' USING ERRCODE = '23514';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_v3_canary_slot_payload_binding
     BEFORE INSERT ON v3_canary_admission_claims
     FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_canary_slot_payload_binding()`,
  `CREATE FUNCTION setfarm_enforce_canary_claim_consumption()
   RETURNS TRIGGER AS $$
   BEGIN
     IF OLD.slot_hash IS DISTINCT FROM NEW.slot_hash
        OR OLD.admission_hash IS DISTINCT FROM NEW.admission_hash
        OR OLD.admission_kind IS DISTINCT FROM NEW.admission_kind
        OR OLD.case_hash IS DISTINCT FROM NEW.case_hash
        OR OLD.task_hash IS DISTINCT FROM NEW.task_hash
        OR OLD.repetition IS DISTINCT FROM NEW.repetition
        OR OLD.selector_hash IS DISTINCT FROM NEW.selector_hash
        OR OLD.created_at IS DISTINCT FROM NEW.created_at
        OR OLD.run_id IS NOT NULL
        OR OLD.consumed_at IS NOT NULL
        OR NEW.run_id IS NULL
        OR NEW.consumed_at IS NULL THEN
       RAISE EXCEPTION 'SETFARM_CANARY_CLAIM_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_v3_canary_claim_consume_once
     BEFORE UPDATE ON v3_canary_admission_claims
     FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_canary_claim_consumption()`,
  `CREATE TRIGGER trg_v3_canary_claim_delete_forbidden
     BEFORE DELETE ON v3_canary_admission_claims
     FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
] as const;

const EXPECTED_V3_RELEASE_ADMISSION_COLUMNS = new Map([
  ["admission_hash", { dataType: "text", nullable: "NO" as const }],
  ["kind", { dataType: "text", nullable: "NO" as const }],
  ["release_sha", { dataType: "text", nullable: "NO" as const }],
  ["suite_hash", { dataType: "text", nullable: "NO" as const }],
  ["result_hash", { dataType: "text", nullable: "YES" as const }],
  ["result_ref", { dataType: "text", nullable: "YES" as const }],
  ["gate_hash", { dataType: "text", nullable: "YES" as const }],
  ["gate_ref", { dataType: "text", nullable: "YES" as const }],
  ["expires_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
  ["payload", { dataType: "jsonb", nullable: "NO" as const }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
]);

const EXPECTED_V3_CANARY_CLAIM_COLUMNS = new Map([
  ["slot_hash", { dataType: "text", nullable: "NO" as const }],
  ["admission_hash", { dataType: "text", nullable: "NO" as const }],
  ["admission_kind", { dataType: "text", nullable: "NO" as const }],
  ["case_hash", { dataType: "text", nullable: "NO" as const }],
  ["task_hash", { dataType: "text", nullable: "NO" as const }],
  ["repetition", { dataType: "integer", nullable: "NO" as const }],
  ["selector_hash", { dataType: "text", nullable: "NO" as const }],
  ["run_id", { dataType: "text", nullable: "YES" as const }],
  ["consumed_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
]);

async function detectV3ReleaseAdmissionLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const runColumns = await readColumns(sql, "runs");
  const admissions = await relationExists(sql, "v3_release_admissions");
  const claims = await relationExists(sql, "v3_canary_admission_claims");
  const indexes = await readNamedIndexes(sql, [
    "idx_v3_release_admissions_release_go",
    "idx_v3_release_admissions_canary_expiry",
    "idx_v3_canary_claims_unconsumed",
  ]);
  const pointer = runColumns.has("release_admission_hash");
  if (!pointer && !admissions && !claims && indexes.size === 0) return "absent";
  if (pointer && admissions && claims && indexes.size === 3) return "present";
  return "partial";
}

async function verifyV3ReleaseAdmissionLedger(sql: Sql | TransactionSql): Promise<void> {
  const runColumns = await readColumns(sql, "runs");
  const pointer = runColumns.get("release_admission_hash");
  if (!pointer || pointer.data_type !== "text" || pointer.is_nullable !== "YES") {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "runs release admission pointer mismatch");
  }
  await verifyExpectedTableColumns(sql, "v3_release_admissions", EXPECTED_V3_RELEASE_ADMISSION_COLUMNS);
  await verifyExpectedTableColumns(sql, "v3_canary_admission_claims", EXPECTED_V3_CANARY_CLAIM_COLUMNS);

  const indexes = await readNamedIndexes(sql, [
    "idx_v3_release_admissions_release_go",
    "idx_v3_release_admissions_canary_expiry",
    "idx_v3_canary_claims_unconsumed",
  ]);
  const expectedIndexes = new Map([
    ["idx_v3_release_admissions_release_go", "create unique index idx_v3_release_admissions_release_go on public.v3_release_admissions using btree (release_sha) where (kind = 'release_go'::text)"],
    ["idx_v3_release_admissions_canary_expiry", "create index idx_v3_release_admissions_canary_expiry on public.v3_release_admissions using btree (expires_at, admission_hash) where (kind = 'convergence_canary'::text)"],
    ["idx_v3_canary_claims_unconsumed", "create index idx_v3_canary_claims_unconsumed on public.v3_canary_admission_claims using btree (admission_hash, case_hash, task_hash, repetition) where (run_id is null)"],
  ]);
  for (const [name, expected] of expectedIndexes) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", `v3 release admission index mismatch: ${name}`);
    }
  }

  const constraintNames = [
    "v3_release_admissions_pkey",
    "v3_release_admissions_kind_check",
    "v3_release_admissions_hash_check",
    "v3_release_admissions_release_check",
    "v3_release_admissions_suite_check",
    "v3_release_admissions_result_hash_check",
    "v3_release_admissions_gate_hash_check",
    "v3_release_admissions_result_pair_check",
    "v3_release_admissions_gate_pair_check",
    "v3_release_admissions_result_ref_check",
    "v3_release_admissions_gate_ref_check",
    "v3_release_admissions_kind_shape_check",
    "v3_release_admissions_canary_window_check",
    "v3_release_admissions_payload_object_check",
    "v3_release_admissions_payload_identity_check",
    "v3_release_admissions_hash_release_unique",
    "v3_release_admissions_hash_kind_unique",
    "runs_id_release_admission_unique",
    "runs_release_admission_hash_check",
    "runs_v3_release_admission_required_check",
    "runs_release_admission_identity_fkey",
    "v3_canary_admission_claims_pkey",
    "v3_canary_admission_claims_selector_hash_key",
    "v3_canary_admission_claims_run_id_key",
    "v3_canary_claims_slot_hash_check",
    "v3_canary_claims_kind_check",
    "v3_canary_claims_case_hash_check",
    "v3_canary_claims_task_hash_check",
    "v3_canary_claims_repetition_check",
    "v3_canary_claims_selector_hash_check",
    "v3_canary_claims_consumption_pair_check",
    "v3_canary_claims_exact_slot_unique",
    "v3_canary_claims_admission_fkey",
    "v3_canary_claims_run_fkey",
  ];
  const constraints = await sql.unsafe<Array<{
    conname: string;
    contype: string;
    condeferrable: boolean;
    condeferred: boolean;
    confdeltype: string;
    definition: string;
  }>>(
    `SELECT conname, contype, condeferrable, condeferred, confdeltype,
            pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conname = ANY($1::text[])`,
    [constraintNames],
  );
  const byName = new Map(constraints.map((row) => [row.conname, row]));
  const definitions = new Map(constraints.map((row) => [row.conname, normalizeSql(row.definition)]));
  const fragments = new Map([
    ["v3_release_admissions_pkey", "primary key (admission_hash)"],
    ["v3_release_admissions_kind_check", "kind = any"],
    ["v3_release_admissions_hash_check", "admission_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_release_admissions_release_check", "release_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'::text"],
    ["v3_release_admissions_suite_check", "suite_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_release_admissions_result_hash_check", "result_hash is null or result_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_release_admissions_gate_hash_check", "gate_hash is null or gate_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_release_admissions_result_pair_check", "(result_hash is null) = (result_ref is null)"],
    ["v3_release_admissions_gate_pair_check", "(gate_hash is null) = (gate_ref is null)"],
    ["v3_release_admissions_result_ref_check", "\"substring\"(result_hash, 1, 2)"],
    ["v3_release_admissions_gate_ref_check", "\"substring\"(gate_hash, 1, 2)"],
    ["v3_release_admissions_kind_shape_check", "kind = 'convergence_canary'::text"],
    ["v3_release_admissions_canary_window_check", "expires_at > created_at and expires_at <= (created_at + '9 days'::interval)"],
    ["v3_release_admissions_payload_object_check", "jsonb_typeof(payload) = 'object'::text"],
    ["v3_release_admissions_payload_identity_check", "'admissionhash'::text) = admission_hash"],
    ["v3_release_admissions_hash_release_unique", "unique (admission_hash, release_sha)"],
    ["v3_release_admissions_hash_kind_unique", "unique (admission_hash, kind)"],
    ["runs_id_release_admission_unique", "unique (id, release_admission_hash)"],
    ["runs_release_admission_hash_check", "release_admission_hash is null or release_admission_hash ~ '^[a-f0-9]{64}$'::text"],
    ["runs_v3_release_admission_required_check", "(protocol = 'v3'::text) = (release_admission_hash is not null)"],
    ["runs_release_admission_identity_fkey", "foreign key (release_admission_hash, compiler_release_sha) references v3_release_admissions(admission_hash, release_sha) deferrable initially deferred"],
    ["v3_canary_admission_claims_pkey", "primary key (slot_hash)"],
    ["v3_canary_admission_claims_selector_hash_key", "unique (selector_hash)"],
    ["v3_canary_admission_claims_run_id_key", "unique (run_id)"],
    ["v3_canary_claims_slot_hash_check", "slot_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_canary_claims_kind_check", "admission_kind = 'convergence_canary'::text"],
    ["v3_canary_claims_case_hash_check", "case_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_canary_claims_task_hash_check", "task_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_canary_claims_repetition_check", "repetition >= 1 and repetition <= 2"],
    ["v3_canary_claims_selector_hash_check", "selector_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_canary_claims_consumption_pair_check", "(run_id is null) = (consumed_at is null)"],
    ["v3_canary_claims_exact_slot_unique", "unique (admission_hash, case_hash, task_hash, repetition)"],
    ["v3_canary_claims_admission_fkey", "foreign key (admission_hash, admission_kind) references v3_release_admissions(admission_hash, kind) on delete restrict"],
    ["v3_canary_claims_run_fkey", "foreign key (run_id, admission_hash) references runs(id, release_admission_hash) deferrable initially deferred"],
  ]);
  for (const [name, fragment] of fragments) {
    if (!definitions.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", `v3 release admission constraint mismatch: ${name}`);
    }
  }
  const semanticConstraintFragments = new Map<string, readonly string[]>([
    ["v3_release_admissions_kind_shape_check", [
      "kind = 'convergence_canary'::text and result_hash is null and gate_hash is null and expires_at is not null",
      "kind = 'release_go'::text and result_hash is not null and gate_hash is not null and expires_at is null",
    ]],
    ["v3_release_admissions_canary_window_check", [
      "kind = 'release_go'::text or expires_at > created_at",
      "expires_at <= (created_at + '9 days'::interval)",
    ]],
    ["v3_release_admissions_payload_identity_check", [
      "(payload ->> 'schema'::text) = 'setfarm.v3-release-admission.v1'::text",
      "(payload ->> 'admissionhash'::text) = admission_hash",
      "(payload ->> 'kind'::text) = kind",
      "(payload ->> 'releasesha'::text) = release_sha",
      "(payload ->> 'suitehash'::text) = suite_hash",
      "(payload -> 'result'::text) ->> 'hash'::text",
      "(payload -> 'result'::text) ->> 'ref'::text",
      "(payload -> 'gate'::text) ->> 'hash'::text",
      "(payload -> 'gate'::text) ->> 'ref'::text",
      "(payload ->> 'preflighthash'::text) ~ '^[a-f0-9]{64}$'::text",
      "(payload ->> 'issuedat'::text) = to_char((created_at at time zone 'utc'::text)",
      "jsonb_typeof(payload -> 'slots'::text) = 'array'::text",
      "jsonb_array_length(payload -> 'slots'::text) = 0",
      "jsonb_array_length(payload -> 'slots'::text) >= 1",
      "jsonb_array_length(payload -> 'slots'::text) <= 16",
      "(payload -> 'expiresat'::text) = 'null'::jsonb",
      "(payload ->> 'expiresat'::text) = to_char((expires_at at time zone 'utc'::text)",
    ]],
  ]);
  for (const [name, requiredFragments] of semanticConstraintFragments) {
    const definition = definitions.get(name) ?? "";
    if (requiredFragments.some((fragment) => !definition.includes(fragment))) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 release admission constraint mismatch: ${name}`,
      );
    }
  }
  for (const name of ["runs_release_admission_identity_fkey", "v3_canary_claims_run_fkey"]) {
    const constraint = byName.get(name);
    if (!constraint || constraint.contype !== "f" || !constraint.condeferrable || !constraint.condeferred) {
      throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", `v3 release admission deferred FK mismatch: ${name}`);
    }
  }
  const admissionForeignKey = byName.get("v3_canary_claims_admission_fkey");
  if (!admissionForeignKey || admissionForeignKey.contype !== "f" || admissionForeignKey.condeferrable || admissionForeignKey.confdeltype !== "r") {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "v3 canary admission FK semantics mismatch");
  }

  const triggers = await sql.unsafe<Array<{ tgname: string; enabled: string; definition: string }>>(
    `SELECT t.tgname, t.tgenabled AS enabled, pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgname = ANY($1::text[])`,
    [[
      "trg_v3_release_admissions_immutable",
      "trg_runs_release_admission_set_once",
      "trg_v3_canary_slot_payload_binding",
      "trg_v3_canary_claim_consume_once",
      "trg_v3_canary_claim_delete_forbidden",
    ]],
  );
  const triggerDefinitions = new Map(triggers.map((trigger) => [
    trigger.tgname,
    { enabled: trigger.enabled, definition: normalizeSql(trigger.definition) },
  ]));
  const expectedTriggerFragments = new Map<string, readonly string[]>([
    ["trg_v3_release_admissions_immutable", [
      "before delete or update on v3_release_admissions",
      "execute function setfarm_forbid_artifact_identity_update()",
    ]],
    ["trg_runs_release_admission_set_once", [
      "before update of release_admission_hash on runs",
      "execute function setfarm_enforce_run_release_admission_set_once()",
    ]],
    ["trg_v3_canary_slot_payload_binding", [
      "before insert on v3_canary_admission_claims",
      "execute function setfarm_enforce_canary_slot_payload_binding()",
    ]],
    ["trg_v3_canary_claim_consume_once", [
      "before update on v3_canary_admission_claims",
      "execute function setfarm_enforce_canary_claim_consumption()",
    ]],
    ["trg_v3_canary_claim_delete_forbidden", [
      "before delete on v3_canary_admission_claims",
      "execute function setfarm_forbid_artifact_identity_update()",
    ]],
  ]);
  for (const [name, requiredFragments] of expectedTriggerFragments) {
    const trigger = triggerDefinitions.get(name);
    if (
      trigger?.enabled !== "O"
      || requiredFragments.some((fragment) => !trigger.definition.includes(fragment))
    ) {
      throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", `v3 release admission trigger mismatch: ${name}`);
    }
  }

  const functions = await sql.unsafe<Array<{ name: string; definition: string | null }>>(
    `SELECT name, pg_get_functiondef(to_regprocedure(name || '()')) AS definition
       FROM unnest($1::text[]) AS name`,
    [[
      "setfarm_enforce_run_release_admission_set_once",
      "setfarm_enforce_canary_slot_payload_binding",
      "setfarm_enforce_canary_claim_consumption",
    ]],
  );
  const functionDefinitions = new Map(functions.map((row) => [row.name, normalizeSql(row.definition ?? "")]));
  const expectedFunctionFragments = new Map<string, readonly string[]>([
    ["setfarm_enforce_run_release_admission_set_once", [
      "old.release_admission_hash is distinct from new.release_admission_hash",
      "old.release_admission_hash is null and new.release_admission_hash is not null",
      "setfarm_run_release_admission_immutable",
    ]],
    ["setfarm_enforce_canary_slot_payload_binding", [
      "select payload into admission_payload from v3_release_admissions",
      "admission_hash = new.admission_hash",
      "kind = 'convergence_canary'",
      "not admission_payload @> jsonb_build_object",
      "'slothash', new.slot_hash",
      "'casehash', new.case_hash",
      "'taskhash', new.task_hash",
      "'repetition', new.repetition",
      "'selectorhash', new.selector_hash",
      "setfarm_canary_slot_payload_mismatch",
    ]],
    ["setfarm_enforce_canary_claim_consumption", [
      "old.slot_hash is distinct from new.slot_hash",
      "old.admission_hash is distinct from new.admission_hash",
      "old.case_hash is distinct from new.case_hash",
      "old.task_hash is distinct from new.task_hash",
      "old.repetition is distinct from new.repetition",
      "old.selector_hash is distinct from new.selector_hash",
      "old.run_id is not null",
      "old.consumed_at is not null",
      "new.run_id is null",
      "new.consumed_at is null",
      "setfarm_canary_claim_immutable",
    ]],
  ]);
  for (const [name, requiredFragments] of expectedFunctionFragments) {
    const definition = functionDefinitions.get(name) ?? "";
    if (requiredFragments.some((fragment) => !definition.includes(fragment))) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 release admission function mismatch: ${name}`,
      );
    }
  }
}

const EXPECTED_RUNTIME_OWNERSHIP_INDEXES = new Map<string, string>([
  [
    "idx_claim_log_id_run_unique",
    "create unique index idx_claim_log_id_run_unique on public.claim_log using btree (id, run_id)",
  ],
  [
    "idx_execution_attempts_attempt_claim_unique",
    "create unique index idx_execution_attempts_attempt_claim_unique on public.execution_attempts using btree (attempt_id, claim_id)",
  ],
  [
    "idx_runtime_sessions_run_state",
    "create index idx_runtime_sessions_run_state on public.runtime_sessions using btree (run_id, state, created_at)",
  ],
  [
    "idx_runtime_sessions_owner_state",
    "create index idx_runtime_sessions_owner_state on public.runtime_sessions using btree (owner_instance_id, state, updated_at)",
  ],
  [
    "idx_runtime_sessions_heartbeat",
    "create index idx_runtime_sessions_heartbeat on public.runtime_sessions using btree (heartbeat_at) where (state = any (array['starting'::text, 'running'::text, 'drain_requested'::text]))",
  ],
  [
    "idx_run_termination_requests_open_unique",
    "create unique index idx_run_termination_requests_open_unique on public.run_termination_requests using btree (run_id) where (state <> 'terminalized'::text)",
  ],
  [
    "idx_run_termination_requests_state_lease",
    "create index idx_run_termination_requests_state_lease on public.run_termination_requests using btree (state, lease_expires_at, requested_at)",
  ],
]);

const EXPECTED_RUNTIME_SESSION_COLUMNS = new Map<string, Readonly<{ dataType: string; nullable: "YES" | "NO" }>>([
  ["session_id", { dataType: "text", nullable: "NO" }],
  ["run_id", { dataType: "text", nullable: "NO" }],
  ["step_db_id", { dataType: "text", nullable: "NO" }],
  ["workflow_step_id", { dataType: "text", nullable: "NO" }],
  ["story_db_id", { dataType: "text", nullable: "YES" }],
  ["story_id", { dataType: "text", nullable: "YES" }],
  ["claim_id", { dataType: "bigint", nullable: "NO" }],
  ["attempt_id", { dataType: "text", nullable: "YES" }],
  ["claim_agent_id", { dataType: "text", nullable: "NO" }],
  ["runtime_agent_id", { dataType: "text", nullable: "NO" }],
  ["runtime_kind", { dataType: "text", nullable: "NO" }],
  ["session_key", { dataType: "text", nullable: "YES" }],
  ["pid", { dataType: "integer", nullable: "YES" }],
  ["process_started_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["worktree", { dataType: "text", nullable: "YES" }],
  ["runtime_path", { dataType: "text", nullable: "YES" }],
  ["transcript_path", { dataType: "text", nullable: "YES" }],
  ["state", { dataType: "text", nullable: "NO" }],
  ["owner_instance_id", { dataType: "text", nullable: "NO" }],
  ["state_version", { dataType: "integer", nullable: "NO" }],
  ["started_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["heartbeat_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["drain_requested_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["drained_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["released_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["diagnostic", { dataType: "text", nullable: "YES" }],
  ["drain_evidence", { dataType: "jsonb", nullable: "NO" }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
]);

const EXPECTED_TERMINATION_COLUMNS = new Map<string, Readonly<{ dataType: string; nullable: "YES" | "NO" }>>([
  ["request_id", { dataType: "text", nullable: "NO" }],
  ["run_id", { dataType: "text", nullable: "NO" }],
  ["target_status", { dataType: "text", nullable: "NO" }],
  ["state", { dataType: "text", nullable: "NO" }],
  ["requested_by", { dataType: "text", nullable: "NO" }],
  ["owner_instance_id", { dataType: "text", nullable: "YES" }],
  ["lease_expires_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["heartbeat_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["requested_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["drained_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["terminalized_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["diagnostic", { dataType: "text", nullable: "NO" }],
  ["evidence", { dataType: "jsonb", nullable: "NO" }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
]);

const EXPECTED_RUNTIME_COMPLETION_COLUMNS = new Map<string, Readonly<{ dataType: string; nullable: "YES" | "NO" }>>([
  ["request_id", { dataType: "text", nullable: "NO" }],
  ["runtime_session_id", { dataType: "text", nullable: "NO" }],
  ["claim_id", { dataType: "bigint", nullable: "NO" }],
  ["run_id", { dataType: "text", nullable: "NO" }],
  ["step_db_id", { dataType: "text", nullable: "NO" }],
  ["workflow_step_id", { dataType: "text", nullable: "NO" }],
  ["story_db_id", { dataType: "text", nullable: "YES" }],
  ["story_id", { dataType: "text", nullable: "YES" }],
  ["attempt_id", { dataType: "text", nullable: "YES" }],
  ["claim_envelope", { dataType: "jsonb", nullable: "NO" }],
  ["output", { dataType: "text", nullable: "NO" }],
  ["output_hash", { dataType: "text", nullable: "NO" }],
  ["apply_phase", { dataType: "text", nullable: "NO" }],
  ["claim_outcome", { dataType: "text", nullable: "YES" }],
  ["claim_committed_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["effects_committed_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["state", { dataType: "text", nullable: "NO" }],
  ["requested_by", { dataType: "text", nullable: "NO" }],
  ["owner_instance_id", { dataType: "text", nullable: "YES" }],
  ["lease_expires_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["requested_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["drained_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["processing_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["accepted_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["rejected_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["diagnostic", { dataType: "text", nullable: "YES" }],
  ["result", { dataType: "jsonb", nullable: "NO" }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
]);

const EXPECTED_RUNTIME_COMPLETION_INDEXES = new Map<string, string>([
  [
    "idx_runtime_sessions_session_claim_run_unique",
    "create unique index idx_runtime_sessions_session_claim_run_unique on public.runtime_sessions using btree (session_id, claim_id, run_id)",
  ],
  [
    "idx_runtime_completion_requests_session_unique",
    "create unique index idx_runtime_completion_requests_session_unique on public.runtime_completion_requests using btree (runtime_session_id)",
  ],
  [
    "idx_runtime_completion_requests_claim_unique",
    "create unique index idx_runtime_completion_requests_claim_unique on public.runtime_completion_requests using btree (claim_id)",
  ],
  [
    "idx_runtime_completion_requests_state_lease",
    "create index idx_runtime_completion_requests_state_lease on public.runtime_completion_requests using btree (state, lease_expires_at, requested_at)",
  ],
]);

const EXPECTED_RUNTIME_COMPLETION_PLAN_COLUMNS = new Map<string, Readonly<{ dataType: string; nullable: "YES" | "NO" }>>([
  ["completion_plan", { dataType: "jsonb", nullable: "YES" }],
  ["completion_plan_hash", { dataType: "text", nullable: "YES" }],
  ["prepared_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["owner_attempt_count", { dataType: "integer", nullable: "NO" }],
]);

const EXPECTED_RUNTIME_PROCESS_IDENTITY_COLUMNS = new Map<string, Readonly<{ dataType: string; nullable: "YES" | "NO" }>>([
  ["process_group_id", { dataType: "integer", nullable: "YES" }],
  ["process_identity", { dataType: "jsonb", nullable: "NO" }],
]);

const EXPECTED_RUNTIME_COMPLETION_EFFECT_COLUMNS = new Map<string, Readonly<{ dataType: string; nullable: "YES" | "NO" }>>([
  ["request_id", { dataType: "text", nullable: "NO" }],
  ["effect_key", { dataType: "text", nullable: "NO" }],
  ["ordinal", { dataType: "integer", nullable: "NO" }],
  ["effect_type", { dataType: "text", nullable: "NO" }],
  ["input_hash", { dataType: "text", nullable: "NO" }],
  ["payload", { dataType: "jsonb", nullable: "NO" }],
  ["mandatory", { dataType: "boolean", nullable: "NO" }],
  ["state", { dataType: "text", nullable: "NO" }],
  ["owner_instance_id", { dataType: "text", nullable: "YES" }],
  ["lease_token", { dataType: "text", nullable: "YES" }],
  ["lease_expires_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["attempt_count", { dataType: "integer", nullable: "NO" }],
  ["result", { dataType: "jsonb", nullable: "NO" }],
  ["evidence", { dataType: "jsonb", nullable: "NO" }],
  ["applied_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["reconciled_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
]);

const EXPECTED_OPERATIONAL_OUTBOX_COLUMNS = new Map<string, Readonly<{ dataType: string; nullable: "YES" | "NO" }>>([
  ["outbox_id", { dataType: "text", nullable: "NO" }],
  ["request_id", { dataType: "text", nullable: "YES" }],
  ["event_key", { dataType: "text", nullable: "NO" }],
  ["event_type", { dataType: "text", nullable: "NO" }],
  ["aggregate_type", { dataType: "text", nullable: "NO" }],
  ["aggregate_id", { dataType: "text", nullable: "NO" }],
  ["payload", { dataType: "jsonb", nullable: "NO" }],
  ["state", { dataType: "text", nullable: "NO" }],
  ["owner_instance_id", { dataType: "text", nullable: "YES" }],
  ["lease_token", { dataType: "text", nullable: "YES" }],
  ["lease_expires_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["attempt_count", { dataType: "integer", nullable: "NO" }],
  ["published_at", { dataType: "timestamp with time zone", nullable: "YES" }],
  ["diagnostic", { dataType: "text", nullable: "YES" }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
]);

const EXPECTED_OPERATIONAL_EVENT_COLUMNS = new Map<string, Map<string, Readonly<{
  dataType: string;
  nullable: "YES" | "NO";
}>>>([
  ["operational_events", new Map([
    ["event_key", { dataType: "text", nullable: "NO" }],
    ["outbox_id", { dataType: "text", nullable: "NO" }],
    ["request_id", { dataType: "text", nullable: "YES" }],
    ["event_type", { dataType: "text", nullable: "NO" }],
    ["aggregate_type", { dataType: "text", nullable: "NO" }],
    ["aggregate_id", { dataType: "text", nullable: "NO" }],
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["payload", { dataType: "jsonb", nullable: "NO" }],
    ["event_hash", { dataType: "text", nullable: "NO" }],
    ["source_created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
    ["committed_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["operational_event_deliveries", new Map([
    ["event_key", { dataType: "text", nullable: "NO" }],
    ["consumer", { dataType: "text", nullable: "NO" }],
    ["delivery_id", { dataType: "text", nullable: "NO" }],
    ["input_hash", { dataType: "text", nullable: "NO" }],
    ["idempotency_key", { dataType: "text", nullable: "NO" }],
    ["state", { dataType: "text", nullable: "NO" }],
    ["owner_instance_id", { dataType: "text", nullable: "YES" }],
    ["lease_token", { dataType: "text", nullable: "YES" }],
    ["lease_expires_at", { dataType: "timestamp with time zone", nullable: "YES" }],
    ["attempt_count", { dataType: "integer", nullable: "NO" }],
    ["delivered_at", { dataType: "timestamp with time zone", nullable: "YES" }],
    ["diagnostic", { dataType: "text", nullable: "YES" }],
    ["result", { dataType: "jsonb", nullable: "NO" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
    ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
]);

const EXPECTED_OPERATIONAL_EVENT_INDEXES = new Map<string, string>([
  [
    "idx_operational_event_deliveries_claimable",
    "create index idx_operational_event_deliveries_claimable on public.operational_event_deliveries using btree (consumer, state, lease_expires_at, created_at, event_key)",
  ],
  [
    "idx_operational_events_run",
    "create index idx_operational_events_run on public.operational_events using btree (run_id, source_created_at, event_key)",
  ],
]);

const EXPECTED_RUNTIME_COMPLETION_EFFECT_INDEXES = new Map<string, string>([
  [
    "idx_runtime_completion_effects_claimable",
    "create index idx_runtime_completion_effects_claimable on public.runtime_completion_effects using btree (state, lease_expires_at, request_id, ordinal)",
  ],
  [
    "idx_runtime_completion_effects_request_state",
    "create index idx_runtime_completion_effects_request_state on public.runtime_completion_effects using btree (request_id, state, ordinal)",
  ],
  [
    "idx_operational_outbox_claimable",
    "create index idx_operational_outbox_claimable on public.operational_outbox using btree (state, lease_expires_at, created_at)",
  ],
  [
    "idx_operational_outbox_aggregate",
    "create index idx_operational_outbox_aggregate on public.operational_outbox using btree (aggregate_type, aggregate_id, created_at)",
  ],
]);

const EXPECTED_ARTIFACT_INDEX_COLUMNS = new Map<string, Map<string, Readonly<{
  dataType: string;
  nullable: "YES" | "NO";
}>>>([
  ["semantic_artifacts", new Map([
    ["artifact_hash", { dataType: "text", nullable: "NO" }],
    ["artifact_type", { dataType: "text", nullable: "NO" }],
    ["byte_length", { dataType: "bigint", nullable: "NO" }],
    ["producer_metadata", { dataType: "jsonb", nullable: "NO" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["artifact_capacity", new Map([
    ["capacity_key", { dataType: "text", nullable: "NO" }],
    ["quota_bytes", { dataType: "bigint", nullable: "NO" }],
    ["max_payload_bytes", { dataType: "bigint", nullable: "NO" }],
    ["total_bytes", { dataType: "bigint", nullable: "NO" }],
    ["reserved_bytes", { dataType: "bigint", nullable: "NO" }],
    ["state", { dataType: "text", nullable: "NO" }],
    ["reconciled_at", { dataType: "timestamp with time zone", nullable: "YES" }],
    ["diagnostic", { dataType: "text", nullable: "YES" }],
    ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["artifact_publication_reservations", new Map([
    ["reservation_id", { dataType: "text", nullable: "NO" }],
    ["artifact_hash", { dataType: "text", nullable: "NO" }],
    ["artifact_type", { dataType: "text", nullable: "NO" }],
    ["byte_length", { dataType: "bigint", nullable: "NO" }],
    ["producer_metadata", { dataType: "jsonb", nullable: "NO" }],
    ["state", { dataType: "text", nullable: "NO" }],
    ["owner_instance_id", { dataType: "text", nullable: "YES" }],
    ["lease_token", { dataType: "text", nullable: "YES" }],
    ["lease_expires_at", { dataType: "timestamp with time zone", nullable: "YES" }],
    ["diagnostic", { dataType: "text", nullable: "YES" }],
    ["published_at", { dataType: "timestamp with time zone", nullable: "YES" }],
    ["finalized_at", { dataType: "timestamp with time zone", nullable: "YES" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
    ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["product_packets", new Map([
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["packet_hash", { dataType: "text", nullable: "NO" }],
    ["compiler_metadata", { dataType: "jsonb", nullable: "NO" }],
    ["sealed_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["run_artifact_refs", new Map([
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["ref_key", { dataType: "text", nullable: "NO" }],
    ["artifact_hash", { dataType: "text", nullable: "NO" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
]);

const EXPECTED_ARTIFACT_INDEX_INDEXES = new Map<string, string>([
  [
    "idx_artifact_publication_reservations_active_hash",
    "create unique index idx_artifact_publication_reservations_active_hash on public.artifact_publication_reservations using btree (artifact_hash) where (state = 'reserved'::text)",
  ],
  [
    "idx_artifact_publication_reservations_expired",
    "create index idx_artifact_publication_reservations_expired on public.artifact_publication_reservations using btree (lease_expires_at, reservation_id) where (state = 'reserved'::text)",
  ],
  [
    "idx_product_packets_hash",
    "create index idx_product_packets_hash on public.product_packets using btree (packet_hash, run_id)",
  ],
  [
    "idx_run_artifact_refs_hash",
    "create index idx_run_artifact_refs_hash on public.run_artifact_refs using btree (artifact_hash, run_id)",
  ],
]);

const EXPECTED_FINDING_RECOVERY_COLUMNS = new Map<string, Map<string, Readonly<{
  dataType: string;
  nullable: "YES" | "NO";
}>>>([
  ["finding_sets", new Map([
    ["finding_set_hash", { dataType: "text", nullable: "NO" }],
    ["finding_set_id", { dataType: "text", nullable: "NO" }],
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["story_id", { dataType: "text", nullable: "NO" }],
    ["packet_hash", { dataType: "text", nullable: "NO" }],
    ["slice_hash", { dataType: "text", nullable: "NO" }],
    ["source_sha", { dataType: "text", nullable: "NO" }],
    ["source_tree_hash", { dataType: "text", nullable: "NO" }],
    ["finding_ids", { dataType: "jsonb", nullable: "NO" }],
    ["payload", { dataType: "jsonb", nullable: "NO" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["findings", new Map([
    ["finding_set_hash", { dataType: "text", nullable: "NO" }],
    ["finding_id", { dataType: "text", nullable: "NO" }],
    ["origin", { dataType: "text", nullable: "NO" }],
    ["classification", { dataType: "text", nullable: "NO" }],
    ["invariant_ref", { dataType: "text", nullable: "NO" }],
    ["status", { dataType: "text", nullable: "NO" }],
    ["source_fingerprint", { dataType: "text", nullable: "NO" }],
    ["payload", { dataType: "jsonb", nullable: "NO" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["evidence_bundles", new Map([
    ["evidence_bundle_hash", { dataType: "text", nullable: "NO" }],
    ["evidence_id", { dataType: "text", nullable: "NO" }],
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["story_id", { dataType: "text", nullable: "NO" }],
    ["packet_hash", { dataType: "text", nullable: "NO" }],
    ["slice_hash", { dataType: "text", nullable: "NO" }],
    ["source_sha", { dataType: "text", nullable: "NO" }],
    ["source_tree_hash", { dataType: "text", nullable: "NO" }],
    ["attempt_id", { dataType: "text", nullable: "YES" }],
    ["aggregate_verdict", { dataType: "text", nullable: "NO" }],
    ["payload", { dataType: "jsonb", nullable: "NO" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["recovery_cases", new Map([
    ["recovery_case_id", { dataType: "text", nullable: "NO" }],
    ["dedupe_key", { dataType: "text", nullable: "NO" }],
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["story_id", { dataType: "text", nullable: "NO" }],
    ["finding_set_hash", { dataType: "text", nullable: "NO" }],
    ["finding_ids", { dataType: "jsonb", nullable: "NO" }],
    ["packet_hash", { dataType: "text", nullable: "NO" }],
    ["slice_hash", { dataType: "text", nullable: "NO" }],
    ["source_sha", { dataType: "text", nullable: "NO" }],
    ["source_tree_hash", { dataType: "text", nullable: "NO" }],
    ["owner", { dataType: "text", nullable: "NO" }],
    ["expected_delta", { dataType: "jsonb", nullable: "NO" }],
    ["allowed_paths", { dataType: "jsonb", nullable: "NO" }],
    ["evidence_plan", { dataType: "jsonb", nullable: "NO" }],
    ["prior_attempt_refs", { dataType: "jsonb", nullable: "NO" }],
    ["max_implement", { dataType: "integer", nullable: "NO" }],
    ["max_supervisor_repair", { dataType: "integer", nullable: "NO" }],
    ["max_evidence_only", { dataType: "integer", nullable: "NO" }],
    ["used_implement", { dataType: "integer", nullable: "NO" }],
    ["used_supervisor_repair", { dataType: "integer", nullable: "NO" }],
    ["used_evidence_only", { dataType: "integer", nullable: "NO" }],
    ["status", { dataType: "text", nullable: "NO" }],
    ["terminal", { dataType: "jsonb", nullable: "YES" }],
    ["decision_refs", { dataType: "jsonb", nullable: "NO" }],
    ["state_version", { dataType: "integer", nullable: "NO" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
    ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["recovery_dispatches", new Map([
    ["dispatch_id", { dataType: "text", nullable: "NO" }],
    ["recovery_case_id", { dataType: "text", nullable: "NO" }],
    ["dispatch_class", { dataType: "text", nullable: "NO" }],
    ["dispatch_dedupe_key", { dataType: "text", nullable: "NO" }],
    ["source_sha", { dataType: "text", nullable: "NO" }],
    ["source_tree_hash", { dataType: "text", nullable: "NO" }],
    ["packet_hash", { dataType: "text", nullable: "NO" }],
    ["slice_hash", { dataType: "text", nullable: "NO" }],
    ["finding_set_hash", { dataType: "text", nullable: "NO" }],
    ["finding_ids", { dataType: "jsonb", nullable: "NO" }],
    ["evidence_plan", { dataType: "jsonb", nullable: "NO" }],
    ["authorized_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["recovery_dispatch_findings", new Map([
    ["dispatch_id", { dataType: "text", nullable: "NO" }],
    ["finding_id", { dataType: "text", nullable: "NO" }],
    ["finding_dispatch_key", { dataType: "text", nullable: "NO" }],
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["story_id", { dataType: "text", nullable: "NO" }],
    ["dispatch_class", { dataType: "text", nullable: "NO" }],
    ["source_tree_hash", { dataType: "text", nullable: "NO" }],
    ["packet_hash", { dataType: "text", nullable: "NO" }],
    ["slice_hash", { dataType: "text", nullable: "NO" }],
    ["authorized_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
]);

const EXPECTED_FINDING_RECOVERY_INDEXES = new Map<string, string>([
  [
    "idx_finding_sets_run_story_source",
    "create index idx_finding_sets_run_story_source on public.finding_sets using btree (run_id, story_id, source_tree_hash, created_at desc)",
  ],
  [
    "idx_findings_open_invariant",
    "create index idx_findings_open_invariant on public.findings using btree (invariant_ref, finding_id) where (status = 'open'::text)",
  ],
  [
    "idx_evidence_bundles_run_story_source",
    "create index idx_evidence_bundles_run_story_source on public.evidence_bundles using btree (run_id, story_id, source_tree_hash, created_at desc)",
  ],
  [
    "idx_recovery_cases_active_owner",
    "create index idx_recovery_cases_active_owner on public.recovery_cases using btree (owner, status, updated_at) where (status = any (array['open'::text, 'repairing'::text, 'evidencing'::text]))",
  ],
  [
    "idx_recovery_dispatches_case_created",
    "create index idx_recovery_dispatches_case_created on public.recovery_dispatches using btree (recovery_case_id, authorized_at)",
  ],
  [
    "idx_recovery_dispatch_findings_lookup",
    "create index idx_recovery_dispatch_findings_lookup on public.recovery_dispatch_findings using btree (run_id, story_id, source_tree_hash, finding_id)",
  ],
]);

const EXPECTED_RECOVERY_DELIVERY_COLUMNS = new Map<string, Map<string, Readonly<{
  dataType: string;
  nullable: "YES" | "NO";
}>>>([
  ["recovery_case_revisions", new Map([
    ["revision_id", { dataType: "text", nullable: "NO" }],
    ["recovery_case_id", { dataType: "text", nullable: "NO" }],
    ["revision_number", { dataType: "integer", nullable: "NO" }],
    ["parent_revision_id", { dataType: "text", nullable: "YES" }],
    ["revision_identity_key", { dataType: "text", nullable: "NO" }],
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["story_id", { dataType: "text", nullable: "NO" }],
    ["finding_set_hash", { dataType: "text", nullable: "NO" }],
    ["finding_ids", { dataType: "jsonb", nullable: "NO" }],
    ["packet_hash", { dataType: "text", nullable: "NO" }],
    ["contract_slice_hash", { dataType: "text", nullable: "NO" }],
    ["source_sha", { dataType: "text", nullable: "NO" }],
    ["source_tree_hash", { dataType: "text", nullable: "NO" }],
    ["owner", { dataType: "text", nullable: "NO" }],
    ["expected_delta", { dataType: "jsonb", nullable: "NO" }],
    ["allowed_paths", { dataType: "jsonb", nullable: "NO" }],
    ["evidence_plan", { dataType: "jsonb", nullable: "NO" }],
    ["evidence_plan_artifact_hash", { dataType: "text", nullable: "YES" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["recovery_revision_dispatches", new Map([
    ["dispatch_id", { dataType: "text", nullable: "NO" }],
    ["recovery_case_id", { dataType: "text", nullable: "NO" }],
    ["revision_id", { dataType: "text", nullable: "NO" }],
    ["dispatch_class", { dataType: "text", nullable: "NO" }],
    ["dispatch_dedupe_key", { dataType: "text", nullable: "NO" }],
    ["source_sha", { dataType: "text", nullable: "NO" }],
    ["source_tree_hash", { dataType: "text", nullable: "NO" }],
    ["packet_hash", { dataType: "text", nullable: "NO" }],
    ["contract_slice_hash", { dataType: "text", nullable: "NO" }],
    ["finding_set_hash", { dataType: "text", nullable: "NO" }],
    ["finding_ids", { dataType: "jsonb", nullable: "NO" }],
    ["evidence_plan", { dataType: "jsonb", nullable: "NO" }],
    ["evidence_plan_artifact_hash", { dataType: "text", nullable: "YES" }],
    ["authorized_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["recovery_revision_dispatch_findings", new Map([
    ["dispatch_id", { dataType: "text", nullable: "NO" }],
    ["finding_id", { dataType: "text", nullable: "NO" }],
    ["finding_dispatch_key", { dataType: "text", nullable: "NO" }],
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["story_id", { dataType: "text", nullable: "NO" }],
    ["dispatch_class", { dataType: "text", nullable: "NO" }],
    ["source_tree_hash", { dataType: "text", nullable: "NO" }],
    ["packet_hash", { dataType: "text", nullable: "NO" }],
    ["contract_slice_hash", { dataType: "text", nullable: "NO" }],
    ["authorized_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["recovery_dispatch_deliveries", new Map([
    ["dispatch_id", { dataType: "text", nullable: "NO" }],
    ["recovery_case_id", { dataType: "text", nullable: "NO" }],
    ["revision_id", { dataType: "text", nullable: "NO" }],
    ["run_id", { dataType: "text", nullable: "NO" }],
    ["story_id", { dataType: "text", nullable: "NO" }],
    ["state", { dataType: "text", nullable: "NO" }],
    ["owner_instance_id", { dataType: "text", nullable: "YES" }],
    ["lease_token", { dataType: "text", nullable: "YES" }],
    ["lease_expires_at", { dataType: "timestamp with time zone", nullable: "YES" }],
    ["attempt_id", { dataType: "text", nullable: "YES" }],
    ["claim_id", { dataType: "bigint", nullable: "YES" }],
    ["execution_slice_hash", { dataType: "text", nullable: "YES" }],
    ["attempt_count", { dataType: "integer", nullable: "NO" }],
    ["terminal_result", { dataType: "jsonb", nullable: "NO" }],
    ["diagnostic", { dataType: "text", nullable: "YES" }],
    ["authorized_at", { dataType: "timestamp with time zone", nullable: "NO" }],
    ["started_at", { dataType: "timestamp with time zone", nullable: "YES" }],
    ["terminal_at", { dataType: "timestamp with time zone", nullable: "YES" }],
    ["created_at", { dataType: "timestamp with time zone", nullable: "NO" }],
    ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
  ["recovery_dispatch_migration_receipts", new Map([
    ["legacy_dispatch_id", { dataType: "text", nullable: "NO" }],
    ["recovery_case_id", { dataType: "text", nullable: "NO" }],
    ["current_revision_id", { dataType: "text", nullable: "NO" }],
    ["canonical_dispatch_id", { dataType: "text", nullable: "YES" }],
    ["disposition", { dataType: "text", nullable: "NO" }],
    ["reason_code", { dataType: "text", nullable: "NO" }],
    ["evidence", { dataType: "jsonb", nullable: "NO" }],
    ["migrated_at", { dataType: "timestamp with time zone", nullable: "NO" }],
  ])],
]);

const EXPECTED_RECOVERY_DELIVERY_INDEXES = new Map<string, string>([
  [
    "idx_recovery_case_revisions_case_number",
    "create index idx_recovery_case_revisions_case_number on public.recovery_case_revisions using btree (recovery_case_id, revision_number desc)",
  ],
  [
    "idx_recovery_revision_dispatches_case_created",
    "create index idx_recovery_revision_dispatches_case_created on public.recovery_revision_dispatches using btree (recovery_case_id, authorized_at)",
  ],
  [
    "idx_recovery_revision_dispatch_findings_lookup",
    "create index idx_recovery_revision_dispatch_findings_lookup on public.recovery_revision_dispatch_findings using btree (run_id, story_id, source_tree_hash, finding_id)",
  ],
  [
    "idx_recovery_dispatch_deliveries_claimable",
    "create index idx_recovery_dispatch_deliveries_claimable on public.recovery_dispatch_deliveries using btree (state, lease_expires_at, authorized_at)",
  ],
  [
    "idx_recovery_dispatch_deliveries_story_active",
    "create unique index idx_recovery_dispatch_deliveries_story_active on public.recovery_dispatch_deliveries using btree (run_id, story_id) where (state = any (array['authorized'::text, 'leased'::text, 'attempt_reserved'::text, 'running'::text]))",
  ],
  [
    "idx_execution_attempts_recovery_dispatch_unique",
    "create unique index idx_execution_attempts_recovery_dispatch_unique on public.execution_attempts using btree (recovery_dispatch_id) where (recovery_dispatch_id is not null)",
  ],
]);

async function readColumns(
  sql: Sql | TransactionSql,
  table: string,
): Promise<Map<string, { data_type: string; is_nullable: "YES" | "NO" }>> {
  const rows = await sql.unsafe<Array<{
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
  }>>(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return new Map(rows.map((row) => [row.column_name, row]));
}

async function readNamedIndexes(
  sql: Sql | TransactionSql,
  names: readonly string[],
): Promise<Map<string, string>> {
  const rows = await sql.unsafe<Array<{ indexname: string; indexdef: string }>>(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [names],
  );
  return new Map(rows.map((row) => [row.indexname, normalizeSql(row.indexdef)]));
}

async function detectRuntimeOwnership(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const runtimeExists = await relationExists(sql, "runtime_sessions");
  const terminationExists = await relationExists(sql, "run_termination_requests");
  const indexes = await readNamedIndexes(sql, [...EXPECTED_RUNTIME_OWNERSHIP_INDEXES.keys()]);
  if (!runtimeExists && !terminationExists && indexes.size === 0) return "absent";
  if (runtimeExists && terminationExists && indexes.size === EXPECTED_RUNTIME_OWNERSHIP_INDEXES.size) {
    return "present";
  }
  return "partial";
}

async function verifyRuntimeOwnership(sql: Sql | TransactionSql): Promise<void> {
  const runtimeColumns = await readColumns(sql, "runtime_sessions");
  const terminationColumns = await readColumns(sql, "run_termination_requests");
  for (const [table, actual, expected] of [
    ["runtime_sessions", runtimeColumns, EXPECTED_RUNTIME_SESSION_COLUMNS],
    ["run_termination_requests", terminationColumns, EXPECTED_TERMINATION_COLUMNS],
  ] as const) {
    if (actual.size < expected.size) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `${table} column count mismatch: expected at least ${expected.size}, got ${actual.size}`,
      );
    }
    for (const [name, shape] of expected) {
      const column = actual.get(name);
      if (!column || column.data_type !== shape.dataType || column.is_nullable !== shape.nullable) {
        throw new ContractSpineMigrationError(
          "MIGRATION_ADOPTION_MISMATCH",
          `${table} column mismatch: ${name}`,
        );
      }
    }
  }
  const indexes = await readNamedIndexes(sql, [...EXPECTED_RUNTIME_OWNERSHIP_INDEXES.keys()]);
  for (const [name, expected] of EXPECTED_RUNTIME_OWNERSHIP_INDEXES) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime ownership index mismatch: ${name}`,
      );
    }
  }
  const constraints = await sql.unsafe<Array<{ conname: string; definition: string }>>(
    `SELECT conname, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid IN (
        'public.runtime_sessions'::regclass,
        'public.run_termination_requests'::regclass
      )`,
  );
  const definitions = new Map(constraints.map((row) => [row.conname, normalizeSql(row.definition)]));
  const expectedFragments = new Map([
    ["runtime_sessions_claim_run_fkey", "foreign key (claim_id, run_id) references claim_log(id, run_id)"],
    ["runtime_sessions_attempt_claim_fkey", "foreign key (attempt_id, claim_id) references execution_attempts(attempt_id, claim_id)"],
    ["runtime_sessions_runtime_kind_check", "runtime_kind = any"],
    ["runtime_sessions_state_check", "state = any"],
    ["run_termination_requests_target_status_check", "target_status = any"],
    ["run_termination_requests_state_check", "state = any"],
  ]);
  for (const [name, fragment] of expectedFragments) {
    if (!definitions.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime ownership constraint mismatch: ${name}`,
      );
    }
  }
}

async function detectRuntimeCompletionOwnership(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const tableExists = await relationExists(sql, "runtime_completion_requests");
  const indexes = await readNamedIndexes(sql, [...EXPECTED_RUNTIME_COMPLETION_INDEXES.keys()]);
  if (!tableExists && indexes.size === 0) return "absent";
  if (tableExists && indexes.size === EXPECTED_RUNTIME_COMPLETION_INDEXES.size) return "present";
  return "partial";
}

async function verifyRuntimeCompletionOwnership(sql: Sql | TransactionSql): Promise<void> {
  const columns = await readColumns(sql, "runtime_completion_requests");
  if (columns.size < EXPECTED_RUNTIME_COMPLETION_COLUMNS.size) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `runtime_completion_requests column count mismatch: expected at least ${EXPECTED_RUNTIME_COMPLETION_COLUMNS.size}, got ${columns.size}`,
    );
  }
  for (const [name, expected] of EXPECTED_RUNTIME_COMPLETION_COLUMNS) {
    const column = columns.get(name);
    if (!column || column.data_type !== expected.dataType || column.is_nullable !== expected.nullable) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime_completion_requests column mismatch: ${name}`,
      );
    }
  }
  const indexes = await readNamedIndexes(sql, [...EXPECTED_RUNTIME_COMPLETION_INDEXES.keys()]);
  for (const [name, expected] of EXPECTED_RUNTIME_COMPLETION_INDEXES) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime completion ownership index mismatch: ${name}`,
      );
    }
  }
  const constraints = await sql.unsafe<Array<{ conname: string; definition: string }>>(
    `SELECT conname, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.runtime_completion_requests'::regclass`,
  );
  const definitions = new Map(constraints.map((row) => [row.conname, normalizeSql(row.definition)]));
  const expectedFragments = new Map([
    ["runtime_completion_requests_runtime_owner_fkey", "foreign key (runtime_session_id, claim_id, run_id) references runtime_sessions(session_id, claim_id, run_id)"],
    ["runtime_completion_requests_story_pair_check", "(story_id is null) = (story_db_id is null)"],
    ["runtime_completion_requests_output_hash_check", "output_hash ~ '^[a-f0-9]{64}$'::text"],
    ["runtime_completion_requests_envelope_object_check", "jsonb_typeof(claim_envelope) = 'object'::text"],
    ["runtime_completion_requests_result_object_check", "jsonb_typeof(result) = 'object'::text"],
    ["runtime_completion_requests_output_size_check", "octet_length(output) >= 1 and octet_length(output) <= 4194304"],
    ["runtime_completion_requests_state_check", "state = any"],
    ["runtime_completion_requests_terminal_time_check", "state = 'accepted'::text) = (accepted_at is not null"],
    ["runtime_completion_requests_processing_time_check", "state <> 'processing'::text or processing_at is not null"],
    ["runtime_completion_requests_apply_phase_value_check", "apply_phase = any"],
    ["runtime_completion_requests_apply_receipt_check", "state <> 'accepted'::text or apply_phase = 'effects_committed'::text"],
    ["runtime_completion_requests_quarantine_check", "state <> 'quarantined'::text or nullif(diagnostic, ''::text) is not null"],
  ]);
  for (const [name, fragment] of expectedFragments) {
    if (!definitions.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime completion ownership constraint mismatch: ${name}`,
      );
    }
  }
}

async function verifyExpectedTableColumns(
  sql: Sql | TransactionSql,
  table: string,
  expected: Map<string, Readonly<{ dataType: string; nullable: "YES" | "NO" }>>,
): Promise<void> {
  const columns = await readColumns(sql, table);
  if (columns.size < expected.size) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `${table} column count mismatch: expected at least ${expected.size}, got ${columns.size}`,
    );
  }
  for (const [name, shape] of expected) {
    const column = columns.get(name);
    if (!column || column.data_type !== shape.dataType || column.is_nullable !== shape.nullable) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `${table} column mismatch: ${name}`,
      );
    }
  }
}

async function detectRuntimeCompletionEffectLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const completionColumns = await readColumns(sql, "runtime_completion_requests");
  const planColumnCount = [...EXPECTED_RUNTIME_COMPLETION_PLAN_COLUMNS.keys()]
    .filter((name) => completionColumns.has(name)).length;
  const effectsExists = await relationExists(sql, "runtime_completion_effects");
  const outboxExists = await relationExists(sql, "operational_outbox");
  const runtimeColumns = await readColumns(sql, "runtime_sessions");
  const processIdentityColumnCount = [...EXPECTED_RUNTIME_PROCESS_IDENTITY_COLUMNS.keys()]
    .filter((name) => runtimeColumns.has(name)).length;
  const indexes = await readNamedIndexes(sql, [...EXPECTED_RUNTIME_COMPLETION_EFFECT_INDEXES.keys()]);
  if (
    planColumnCount === 0
    && processIdentityColumnCount === 0
    && !effectsExists
    && !outboxExists
    && indexes.size === 0
  ) return "absent";
  if (
    planColumnCount === EXPECTED_RUNTIME_COMPLETION_PLAN_COLUMNS.size
    && processIdentityColumnCount === EXPECTED_RUNTIME_PROCESS_IDENTITY_COLUMNS.size
    && effectsExists
    && outboxExists
    && indexes.size === EXPECTED_RUNTIME_COMPLETION_EFFECT_INDEXES.size
  ) return "present";
  return "partial";
}

async function verifyRuntimeCompletionEffectLedger(sql: Sql | TransactionSql): Promise<void> {
  const completionColumns = await readColumns(sql, "runtime_completion_requests");
  for (const [name, expected] of EXPECTED_RUNTIME_COMPLETION_PLAN_COLUMNS) {
    const column = completionColumns.get(name);
    if (!column || column.data_type !== expected.dataType || column.is_nullable !== expected.nullable) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime_completion_requests plan column mismatch: ${name}`,
      );
    }
  }
  const runtimeColumns = await readColumns(sql, "runtime_sessions");
  for (const [name, expected] of EXPECTED_RUNTIME_PROCESS_IDENTITY_COLUMNS) {
    const column = runtimeColumns.get(name);
    if (!column || column.data_type !== expected.dataType || column.is_nullable !== expected.nullable) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime_sessions process identity column mismatch: ${name}`,
      );
    }
  }
  await verifyExpectedTableColumns(sql, "runtime_completion_effects", EXPECTED_RUNTIME_COMPLETION_EFFECT_COLUMNS);
  await verifyExpectedTableColumns(sql, "operational_outbox", EXPECTED_OPERATIONAL_OUTBOX_COLUMNS);

  const indexes = await readNamedIndexes(sql, [...EXPECTED_RUNTIME_COMPLETION_EFFECT_INDEXES.keys()]);
  for (const [name, expected] of EXPECTED_RUNTIME_COMPLETION_EFFECT_INDEXES) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime completion effect index mismatch: ${name}`,
      );
    }
  }

  const completionConstraints = await sql.unsafe<Array<{ conname: string; definition: string }>>(
    `SELECT conname, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.runtime_completion_requests'::regclass`,
  );
  const completionDefinitions = new Map(
    completionConstraints.map((row) => [row.conname, normalizeSql(row.definition)]),
  );
  const expectedCompletionFragments = new Map([
    ["runtime_completion_requests_plan_pair_check", "(completion_plan is null) = (completion_plan_hash is null)"],
    ["runtime_completion_requests_plan_object_check", "completion_plan is null or jsonb_typeof(completion_plan) = 'object'::text"],
    ["runtime_completion_requests_plan_hash_check", "completion_plan_hash ~ '^[a-f0-9]{64}$'::text"],
    ["runtime_completion_requests_owner_plan_check", "apply_phase <> all"],
    ["runtime_completion_requests_owner_attempt_count_check", "owner_attempt_count >= 0 and owner_attempt_count <= 3"],
  ]);
  for (const [name, fragment] of expectedCompletionFragments) {
    if (!completionDefinitions.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime completion plan constraint mismatch: ${name}`,
      );
    }
  }

  const runtimeConstraints = await sql.unsafe<Array<{ conname: string; definition: string }>>(
    `SELECT conname, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.runtime_sessions'::regclass`,
  );
  const runtimeDefinitions = new Map(
    runtimeConstraints.map((row) => [row.conname, normalizeSql(row.definition)]),
  );
  if (!runtimeDefinitions.get("runtime_sessions_process_group_check")?.includes("process_group_id > 0")) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "runtime process group constraint mismatch");
  }
  if (!runtimeDefinitions.get("runtime_sessions_process_identity_object_check")?.includes("jsonb_typeof(process_identity) = 'object'::text")) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "runtime process identity constraint mismatch");
  }
  const identityBinding = runtimeDefinitions.get("runtime_sessions_process_identity_binding_check") ?? "";
  if (
    !identityBinding.includes("process_identity = '{}'::jsonb")
    || !identityBinding.includes("process_identity ->> 'schema'::text")
    || !identityBinding.includes("setfarm.process-identity.v1")
    || !identityBinding.includes("process_identity ->> 'pid'::text")
    || !identityBinding.includes("pid::text")
  ) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "runtime process identity binding mismatch");
  }

  for (const [table, fragments] of [
    ["runtime_completion_effects", [
      "primary key (request_id, effect_key)",
      "unique (request_id, ordinal)",
      "foreign key (request_id) references runtime_completion_requests(request_id) on delete cascade",
      "state = any",
      "jsonb_typeof(payload) = 'object'::text",
      "(state = 'leased'::text) = (lease_token is not null)",
      "state <> 'applied'::text or applied_at is not null",
    ]],
    ["operational_outbox", [
      "primary key (outbox_id)",
      "unique (event_key)",
      "foreign key (request_id) references runtime_completion_requests(request_id) on delete set null",
      "state = any",
      "jsonb_typeof(payload) = 'object'::text",
      "state <> 'published'::text or published_at is not null",
    ]],
  ] as const) {
    const rows = await sql.unsafe<Array<{ definition: string }>>(
      `SELECT pg_get_constraintdef(oid, true) AS definition
         FROM pg_constraint
        WHERE conrelid = $1::regclass`,
      [`public.${table}`],
    );
    const definitions = rows.map((row) => normalizeSql(row.definition));
    for (const fragment of fragments) {
      if (!definitions.some((definition) => definition.includes(fragment))) {
        throw new ContractSpineMigrationError(
          "MIGRATION_ADOPTION_MISMATCH",
          `${table} constraint mismatch: ${fragment}`,
        );
      }
    }
  }

  const processRows = await sql.unsafe<Array<{
    session_id: string;
    pid: number | null;
    process_group_id: number | null;
    process_identity: unknown;
  }>>(
    `SELECT session_id, pid, process_group_id, process_identity
       FROM runtime_sessions
      WHERE process_identity <> '{}'::jsonb
      ORDER BY session_id`,
  );
  for (const row of processRows) {
    const identity = v8SchemaParse(`runtime process identity payload invalid: ${row.session_id}`, () =>
      ProcessIdentityV1Schema.parse(migrationObject(
        row.process_identity,
        `runtime process identity must be an object: ${row.session_id}`,
      )));
    if (
      identity.pid !== row.pid
      || (identity.processGroupId ?? null) !== row.process_group_id
    ) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime process identity does not bind its row: ${row.session_id}`,
      );
    }
  }

  const planRows = await sql.unsafe<Array<{
    request_id: string;
    claim_id: string | number;
    run_id: string;
    step_db_id: string;
    workflow_step_id: string;
    output_hash: string;
    completion_plan: unknown;
    completion_plan_hash: string;
    prepared_at: Date | string;
  }>>(
    `SELECT request_id, claim_id::text AS claim_id, run_id, step_db_id,
            workflow_step_id, output_hash, completion_plan,
            completion_plan_hash, prepared_at
       FROM runtime_completion_requests
      WHERE completion_plan IS NOT NULL
      ORDER BY request_id`,
  );
  const plans = new Map<string, RuntimeCompletionPlanV1>();
  for (const row of planRows) {
    const plan = v8SchemaParse(`runtime completion plan payload invalid: ${row.request_id}`, () =>
      RuntimeCompletionPlanV1Schema.parse(migrationObject(
        row.completion_plan,
        `runtime completion plan must be an object: ${row.request_id}`,
      )));
    if (
      hashCanonicalJson(plan) !== row.completion_plan_hash
      || plan.requestId !== row.request_id
      || plan.claimId !== migrationPositiveInteger(row.claim_id, `runtime completion claim id invalid: ${row.request_id}`)
      || plan.runId !== row.run_id
      || plan.stepDbId !== row.step_db_id
      || plan.workflowStepId !== row.workflow_step_id
      || plan.outputHash !== row.output_hash
      || plan.preparedAt !== v8MigrationTimestamp(
        row.prepared_at,
        `runtime completion prepared time invalid: ${row.request_id}`,
      ).toISOString()
    ) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime completion plan does not bind its owner row: ${row.request_id}`,
      );
    }
    plans.set(row.request_id, plan);
  }

  const effectRows = await sql.unsafe<Array<{
    request_id: string;
    effect_key: string;
    ordinal: number;
    effect_type: string;
    input_hash: string;
    payload: unknown;
    mandatory: boolean;
  }>>(
    `SELECT request_id, effect_key, ordinal, effect_type,
            input_hash, payload, mandatory
       FROM runtime_completion_effects
      ORDER BY request_id, ordinal`,
  );
  const effectCounts = new Map<string, number>();
  for (const row of effectRows) {
    const input = v8SchemaParse(
      `runtime completion effect payload invalid: ${row.request_id}/${row.effect_key}`,
      () => RuntimeCompletionEffectInputV1Schema.parse(migrationObject(
        row.payload,
        `runtime completion effect must be an object: ${row.request_id}/${row.effect_key}`,
      )),
    );
    const plan = plans.get(row.request_id);
    const spec = plan?.effects.find((candidate) => candidate.effectKey === row.effect_key);
    if (
      !plan
      || input.planHash !== hashCanonicalJson(plan)
      || hashCanonicalJson(input) !== row.input_hash
      || hashCanonicalJson(input.plan) !== input.planHash
      || input.plan.requestId !== row.request_id
      || !spec
      || spec.ordinal !== row.ordinal
      || spec.effectType !== row.effect_type
      || spec.mandatory !== row.mandatory
      || hashCanonicalJson(spec.payload) !== hashCanonicalJson(input.effect)
    ) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime completion effect does not bind its canonical plan: ${row.request_id}/${row.effect_key}`,
      );
    }
    effectCounts.set(row.request_id, (effectCounts.get(row.request_id) ?? 0) + 1);
  }
  for (const [requestId, plan] of plans) {
    if ((effectCounts.get(requestId) ?? 0) !== plan.effects.length) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime completion effect manifest is incomplete: ${requestId}`,
      );
    }
  }
}

async function readArtifactIndexFeatureCount(sql: Sql | TransactionSql): Promise<Readonly<{
  relations: number;
  indexes: Map<string, string>;
  triggers: number;
  immutableFunction: boolean;
}>> {
  const relationNames = [...EXPECTED_ARTIFACT_INDEX_COLUMNS.keys()];
  const relationResults = await Promise.all(relationNames.map((name) => relationExists(sql, name)));
  const indexes = await readNamedIndexes(sql, [...EXPECTED_ARTIFACT_INDEX_INDEXES.keys()]);
  const triggerRows = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = ANY($1::text[])`,
    [[
      "trg_semantic_artifacts_immutable",
      "trg_product_packets_immutable",
      "trg_run_artifact_refs_immutable",
    ]],
  );
  const functionRows = await sql.unsafe<Array<{ exists: boolean }>>(
    "SELECT to_regprocedure('setfarm_forbid_artifact_identity_update()') IS NOT NULL AS exists",
  );
  return {
    relations: relationResults.filter(Boolean).length,
    indexes,
    triggers: triggerRows[0]?.count ?? 0,
    immutableFunction: functionRows[0]?.exists ?? false,
  };
}

async function detectProductArtifactIndex(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const features = await readArtifactIndexFeatureCount(sql);
  if (
    features.relations === 0
    && features.indexes.size === 0
    && features.triggers === 0
    && !features.immutableFunction
  ) return "absent";
  if (
    features.relations === EXPECTED_ARTIFACT_INDEX_COLUMNS.size
    && features.indexes.size === EXPECTED_ARTIFACT_INDEX_INDEXES.size
    && features.triggers === 3
    && features.immutableFunction
  ) return "present";
  return "partial";
}

async function verifyProductArtifactIndex(sql: Sql | TransactionSql): Promise<void> {
  for (const [table, expected] of EXPECTED_ARTIFACT_INDEX_COLUMNS) {
    await verifyExpectedTableColumns(sql, table, expected);
  }
  const indexes = await readNamedIndexes(sql, [...EXPECTED_ARTIFACT_INDEX_INDEXES.keys()]);
  for (const [name, expected] of EXPECTED_ARTIFACT_INDEX_INDEXES) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `product artifact index mismatch: ${name}`,
      );
    }
  }

  const expectedConstraintFragments = new Map<string, ReadonlyArray<readonly [string, string]>>([
    ["semantic_artifacts", [
      ["semantic_artifacts_pkey", "primary key (artifact_hash)"],
      ["semantic_artifacts_hash_check", "artifact_hash ~ '^[a-f0-9]{64}$'::text"],
      ["semantic_artifacts_type_check", "artifact_type ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)+$'::text"],
      ["semantic_artifacts_byte_length_check", "byte_length > 0"],
      ["semantic_artifacts_producer_object_check", "jsonb_typeof(producer_metadata) = 'object'::text"],
      ["semantic_artifacts_producer_keys_check", "producer_metadata ?& array['pass'::text, 'codesha'::text, 'toolversions'::text]"],
      ["semantic_artifacts_producer_keys_check", "producer_metadata - array['pass'::text, 'codesha'::text, 'model'::text, 'prompthash'::text, 'toolversions'::text]"],
      ["semantic_artifacts_producer_values_check", "producer_metadata ->> 'codesha'::text"],
      ["semantic_artifacts_producer_values_check", "jsonb_typeof(producer_metadata -> 'toolversions'::text) = 'object'::text"],
      ["semantic_artifacts_producer_values_check", "not jsonb_path_exists(producer_metadata"],
    ]],
    ["artifact_capacity", [
      ["artifact_capacity_pkey", "primary key (capacity_key)"],
      ["artifact_capacity_singleton_check", "capacity_key = 'semantic-artifacts'::text"],
      ["artifact_capacity_values_check", "max_payload_bytes <= quota_bytes"],
      ["artifact_capacity_values_check", "(total_bytes + reserved_bytes) <= quota_bytes"],
      ["artifact_capacity_state_check", "state = any"],
      ["artifact_capacity_reconciled_check", "(state = 'bootstrap_required'::text) = (reconciled_at is null)"],
    ]],
    ["artifact_publication_reservations", [
      ["artifact_publication_reservations_pkey", "primary key (reservation_id)"],
      ["artifact_publication_reservations_hash_check", "artifact_hash ~ '^[a-f0-9]{64}$'::text"],
      ["artifact_publication_reservations_state_check", "state = any"],
      ["artifact_publication_reservations_producer_keys_check", "producer_metadata ?& array['pass'::text, 'codesha'::text, 'toolversions'::text]"],
      ["artifact_publication_reservations_producer_keys_check", "producer_metadata - array['pass'::text, 'codesha'::text, 'model'::text, 'prompthash'::text, 'toolversions'::text]"],
      ["artifact_publication_reservations_producer_values_check", "producer_metadata ->> 'codesha'::text"],
      ["artifact_publication_reservations_producer_values_check", "not jsonb_path_exists(producer_metadata"],
      ["artifact_publication_reservations_lease_check", "(state = 'reserved'::text) = (lease_token is not null)"],
      ["artifact_publication_reservations_finalized_check", "(state <> 'reserved'::text) = (finalized_at is not null)"],
      ["artifact_publication_reservations_published_check", "(state = 'published'::text) = (published_at is not null)"],
    ]],
    ["product_packets", [
      ["product_packets_pkey", "primary key (run_id)"],
      ["product_packets_run_id_fkey", "foreign key (run_id) references runs(id) on delete cascade"],
      ["product_packets_packet_hash_fkey", "foreign key (packet_hash) references semantic_artifacts(artifact_hash)"],
      ["product_packets_compiler_keys_check", "compiler_metadata ?& array['version'::text, 'codesha'::text]"],
      ["product_packets_compiler_keys_check", "compiler_metadata - array['version'::text, 'codesha'::text]"],
      ["product_packets_compiler_values_check", "compiler_metadata ->> 'codesha'::text"],
    ]],
    ["run_artifact_refs", [
      ["run_artifact_refs_pkey", "primary key (run_id, ref_key)"],
      ["run_artifact_refs_run_id_fkey", "foreign key (run_id) references runs(id) on delete cascade"],
      ["run_artifact_refs_artifact_hash_fkey", "foreign key (artifact_hash) references semantic_artifacts(artifact_hash)"],
      ["run_artifact_refs_key_check", "ref_key ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'::text"],
    ]],
  ]);
  for (const [table, expected] of expectedConstraintFragments) {
    const rows = await sql.unsafe<Array<{ conname: string; definition: string }>>(
      `SELECT conname, pg_get_constraintdef(oid, true) AS definition
         FROM pg_constraint
        WHERE conrelid = $1::regclass`,
      [`public.${table}`],
    );
    const actual = new Map(rows.map((row) => [row.conname, normalizeSql(row.definition)]));
    for (const [name, fragment] of expected) {
      if (!actual.get(name)?.includes(fragment)) {
        throw new ContractSpineMigrationError(
          "MIGRATION_ADOPTION_MISMATCH",
          `${table} constraint mismatch: ${name}`,
        );
      }
    }
  }

  const features = await readArtifactIndexFeatureCount(sql);
  if (!features.immutableFunction || features.triggers !== 3) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "product artifact immutability function or triggers are missing",
    );
  }
  const functionRows = await sql.unsafe<Array<{ definition: string }>>(
    `SELECT pg_get_functiondef(
       'setfarm_forbid_artifact_identity_update()'::regprocedure
     ) AS definition`,
  );
  const functionDefinition = normalizeSql(functionRows[0]?.definition ?? "");
  if (
    !functionDefinition.includes("artifact_identity_immutable")
    || !functionDefinition.includes("errcode = '23514'")
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "product artifact immutability function semantics mismatch",
    );
  }
  const triggerRows = await sql.unsafe<Array<{
    tgname: string;
    relation: string;
    definition: string;
  }>>(
    `SELECT tgname, tgrelid::regclass::text AS relation,
            pg_get_triggerdef(oid, true) AS definition
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = ANY($1::text[])`,
    [[
      "trg_semantic_artifacts_immutable",
      "trg_product_packets_immutable",
      "trg_run_artifact_refs_immutable",
    ]],
  );
  const expectedTriggerRelations = new Map([
    ["trg_semantic_artifacts_immutable", "semantic_artifacts"],
    ["trg_product_packets_immutable", "product_packets"],
    ["trg_run_artifact_refs_immutable", "run_artifact_refs"],
  ]);
  if (triggerRows.some((row) =>
    row.relation !== expectedTriggerRelations.get(row.tgname)
    || !normalizeSql(row.definition).includes("setfarm_forbid_artifact_identity_update()"))) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "product artifact immutability trigger target mismatch",
    );
  }
  const capacityRows = await sql.unsafe<Array<{ capacity_key: string }>>(
    "SELECT capacity_key FROM artifact_capacity",
  );
  if (capacityRows.length !== 1 || capacityRows[0]?.capacity_key !== "semantic-artifacts") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "artifact capacity singleton is missing or duplicated",
    );
  }
}

async function detectFindingRecoveryLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const relations = await Promise.all(
    [...EXPECTED_FINDING_RECOVERY_COLUMNS.keys()].map((table) => relationExists(sql, table)),
  );
  const indexes = await readNamedIndexes(sql, [...EXPECTED_FINDING_RECOVERY_INDEXES.keys()]);
  const triggerRows = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = ANY($1::text[])`,
    [[
      "trg_finding_sets_immutable",
      "trg_findings_immutable",
      "trg_evidence_bundles_immutable",
      "trg_recovery_dispatches_immutable",
      "trg_recovery_dispatch_findings_immutable",
    ]],
  );
  const relationCount = relations.filter(Boolean).length;
  const triggerCount = triggerRows[0]?.count ?? 0;
  if (relationCount === 0 && indexes.size === 0 && triggerCount === 0) return "absent";
  if (
    relationCount === EXPECTED_FINDING_RECOVERY_COLUMNS.size
    && indexes.size === EXPECTED_FINDING_RECOVERY_INDEXES.size
    && triggerCount === 5
  ) return "present";
  return "partial";
}

async function verifyFindingRecoveryLedger(sql: Sql | TransactionSql): Promise<void> {
  for (const [table, expected] of EXPECTED_FINDING_RECOVERY_COLUMNS) {
    await verifyExpectedTableColumns(sql, table, expected);
  }
  const indexes = await readNamedIndexes(sql, [...EXPECTED_FINDING_RECOVERY_INDEXES.keys()]);
  for (const [name, expected] of EXPECTED_FINDING_RECOVERY_INDEXES) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `finding/recovery ledger index mismatch: ${name}`,
      );
    }
  }

  const expectedConstraints = new Map<string, ReadonlyArray<string>>([
    ["finding_sets", [
      "primary key (finding_set_hash)",
      "finding_set_hash ~ '^[a-f0-9]{64}$'::text",
      "finding_set_id ~ '^fset_[a-f0-9]{64}$'::text",
      "jsonb_typeof(finding_ids) = 'array'::text",
      "jsonb_typeof(payload) = 'object'::text",
      "payload ->> 'findingsethash'::text",
      "unique (finding_set_hash, run_id, story_id, packet_hash, slice_hash, source_sha, source_tree_hash)",
    ]],
    ["findings", [
      "primary key (finding_set_hash, finding_id)",
      "foreign key (finding_set_hash) references finding_sets(finding_set_hash) on delete restrict",
      "classification = any",
      "origin = any",
      "status = any",
      "finding_id ~ '^find_[a-f0-9]{64}$'::text",
      "payload ->> 'findingid'::text",
    ]],
    ["evidence_bundles", [
      "primary key (evidence_bundle_hash)",
      "aggregate_verdict = any",
      "evidence_id ~ '^evb_[a-f0-9]{64}$'::text",
      "jsonb_typeof(payload) = 'object'::text",
      "payload ->> 'aggregateverdict'::text",
    ]],
    ["recovery_cases", [
      "primary key (recovery_case_id)",
      "unique (dedupe_key)",
      "foreign key (finding_set_hash, run_id, story_id, packet_hash, slice_hash, source_sha, source_tree_hash) references finding_sets(finding_set_hash, run_id, story_id, packet_hash, slice_hash, source_sha, source_tree_hash) on delete restrict",
      "max_implement >= 0 and max_implement <= 1",
      "used_implement >= 0 and used_implement <= max_implement",
      "status = any",
      "owner = any",
      "expected_delta ->> 'kind'::text",
      "(status = any",
      "(terminal is not null)",
      "terminal ->> 'owner'::text",
      "unique (recovery_case_id, finding_set_hash, packet_hash, slice_hash)",
    ]],
    ["recovery_dispatches", [
      "primary key (dispatch_id)",
      "unique (dispatch_dedupe_key)",
      "foreign key (recovery_case_id, finding_set_hash, packet_hash, slice_hash) references recovery_cases(recovery_case_id, finding_set_hash, packet_hash, slice_hash) on delete restrict",
      "dispatch_class = any",
      "dispatch_dedupe_key ~ '^[a-f0-9]{64}$'::text",
    ]],
    ["recovery_dispatch_findings", [
      "primary key (dispatch_id, finding_id)",
      "unique (finding_dispatch_key)",
      "foreign key (dispatch_id) references recovery_dispatches(dispatch_id) on delete restrict",
      "dispatch_class = any",
      "finding_dispatch_key ~ '^[a-f0-9]{64}$'::text",
    ]],
  ]);
  for (const [table, fragments] of expectedConstraints) {
    const rows = await sql.unsafe<Array<{ definition: string }>>(
      `SELECT pg_get_constraintdef(oid, true) AS definition
         FROM pg_constraint
        WHERE conrelid = $1::regclass`,
      [`public.${table}`],
    );
    const definitions = rows.map((row) => normalizeSql(row.definition));
    for (const fragment of fragments) {
      if (!definitions.some((definition) => definition.includes(fragment))) {
        throw new ContractSpineMigrationError(
          "MIGRATION_ADOPTION_MISMATCH",
          `${table} constraint mismatch: ${fragment}`,
        );
      }
    }
  }

  const triggerRows = await sql.unsafe<Array<{
    tgname: string;
    relation: string;
    definition: string;
  }>>(
    `SELECT tgname, tgrelid::regclass::text AS relation,
            pg_get_triggerdef(oid, true) AS definition
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = ANY($1::text[])`,
    [[
      "trg_finding_sets_immutable",
      "trg_findings_immutable",
      "trg_evidence_bundles_immutable",
      "trg_recovery_dispatches_immutable",
      "trg_recovery_dispatch_findings_immutable",
    ]],
  );
  const expectedTriggerRelations = new Map([
    ["trg_finding_sets_immutable", "finding_sets"],
    ["trg_findings_immutable", "findings"],
    ["trg_evidence_bundles_immutable", "evidence_bundles"],
    ["trg_recovery_dispatches_immutable", "recovery_dispatches"],
    ["trg_recovery_dispatch_findings_immutable", "recovery_dispatch_findings"],
  ]);
  if (
    triggerRows.length !== expectedTriggerRelations.size
    || triggerRows.some((row) =>
      row.relation !== expectedTriggerRelations.get(row.tgname)
      || !normalizeSql(row.definition).includes("setfarm_forbid_artifact_identity_update()"))
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "finding/recovery immutable trigger target mismatch",
    );
  }
}

async function detectRecoveryDeliveryLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const relations = await Promise.all(
    [...EXPECTED_RECOVERY_DELIVERY_COLUMNS.keys()].map((table) => relationExists(sql, table)),
  );
  const caseColumns = await readColumns(sql, "recovery_cases");
  const attemptColumns = await readColumns(sql, "execution_attempts");
  const addedColumnCount = [
    caseColumns.has("current_revision_id"),
    attemptColumns.has("recovery_case_revision_id"),
    attemptColumns.has("recovery_dispatch_id"),
  ].filter(Boolean).length;
  const indexes = await readNamedIndexes(sql, [...EXPECTED_RECOVERY_DELIVERY_INDEXES.keys()]);
  const triggerRows = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = ANY($1::text[])`,
    [[
      "trg_recovery_case_revisions_immutable",
      "trg_recovery_revision_dispatches_immutable",
      "trg_recovery_revision_dispatch_findings_immutable",
    ]],
  );
  const relationCount = relations.filter(Boolean).length;
  const triggerCount = triggerRows[0]?.count ?? 0;
  if (relationCount === 0 && addedColumnCount === 0 && indexes.size === 0 && triggerCount === 0) return "absent";
  if (
    relationCount === EXPECTED_RECOVERY_DELIVERY_COLUMNS.size
    && addedColumnCount === 3
    && indexes.size === EXPECTED_RECOVERY_DELIVERY_INDEXES.size
    && triggerCount === 3
  ) return "present";
  return "partial";
}

async function verifyRecoveryDeliveryLedger(sql: Sql | TransactionSql): Promise<void> {
  for (const [table, expected] of EXPECTED_RECOVERY_DELIVERY_COLUMNS) {
    await verifyExpectedTableColumns(sql, table, expected);
  }
  const caseColumns = await readColumns(sql, "recovery_cases");
  if (caseColumns.get("current_revision_id")?.data_type !== "text"
    || caseColumns.get("current_revision_id")?.is_nullable !== "YES") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "recovery_cases current revision column mismatch",
    );
  }
  const attemptColumns = await readColumns(sql, "execution_attempts");
  for (const column of ["recovery_case_revision_id", "recovery_dispatch_id"]) {
    if (attemptColumns.get(column)?.data_type !== "text" || attemptColumns.get(column)?.is_nullable !== "YES") {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `execution_attempts recovery column mismatch: ${column}`,
      );
    }
  }
  const indexes = await readNamedIndexes(sql, [...EXPECTED_RECOVERY_DELIVERY_INDEXES.keys()]);
  for (const [name, expected] of EXPECTED_RECOVERY_DELIVERY_INDEXES) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `recovery delivery index mismatch: ${name}`,
      );
    }
  }
  const expectedConstraintFragments = new Map<string, readonly string[]>([
    ["recovery_case_revisions", [
      "primary key (revision_id)",
      "unique (recovery_case_id, revision_number)",
      "foreign key (parent_revision_id, recovery_case_id) references recovery_case_revisions(revision_id, recovery_case_id) on delete restrict",
      "foreign key (finding_set_hash, run_id, story_id, packet_hash, contract_slice_hash, source_sha, source_tree_hash) references finding_sets(finding_set_hash, run_id, story_id, packet_hash, slice_hash, source_sha, source_tree_hash) on delete restrict",
    ]],
    ["recovery_revision_dispatches", [
      "primary key (dispatch_id)",
      "unique (dispatch_dedupe_key)",
      "foreign key (revision_id, recovery_case_id, finding_set_hash, packet_hash, contract_slice_hash) references recovery_case_revisions(revision_id, recovery_case_id, finding_set_hash, packet_hash, contract_slice_hash) on delete restrict",
    ]],
    ["recovery_revision_dispatch_findings", [
      "primary key (dispatch_id, finding_id)",
      "unique (finding_dispatch_key)",
      "foreign key (dispatch_id) references recovery_revision_dispatches(dispatch_id) on delete restrict",
    ]],
    ["recovery_dispatch_deliveries", [
      "primary key (dispatch_id)",
      "foreign key (dispatch_id, revision_id) references recovery_revision_dispatches(dispatch_id, revision_id) on delete restrict",
      "foreign key (attempt_id) references execution_attempts(attempt_id) on delete restrict",
    ]],
    ["recovery_dispatch_migration_receipts", [
      "primary key (legacy_dispatch_id)",
      "foreign key (legacy_dispatch_id) references recovery_dispatches(dispatch_id) on delete restrict",
      "foreign key (current_revision_id, recovery_case_id) references recovery_case_revisions(revision_id, recovery_case_id) on delete restrict",
      "foreign key (canonical_dispatch_id, current_revision_id) references recovery_revision_dispatches(dispatch_id, revision_id) on delete restrict",
      "(disposition = 'legacy_history_only'::text) = (canonical_dispatch_id is null)",
      "evidence ->> 'legacydispatchid'::text",
    ]],
    ["recovery_cases", [
      "foreign key (current_revision_id, recovery_case_id) references recovery_case_revisions(revision_id, recovery_case_id) on delete restrict",
    ]],
    ["execution_attempts", [
      "foreign key (recovery_dispatch_id, recovery_case_revision_id) references recovery_revision_dispatches(dispatch_id, revision_id) on delete restrict",
      "(recovery_case_revision_id is null) = (recovery_dispatch_id is null)",
    ]],
  ]);
  for (const [table, fragments] of expectedConstraintFragments) {
    const rows = await sql.unsafe<Array<{ definition: string }>>(
      `SELECT pg_get_constraintdef(oid, true) AS definition
         FROM pg_constraint
        WHERE conrelid = $1::regclass`,
      [`public.${table}`],
    );
    const definitions = rows.map((row) => normalizeSql(row.definition));
    for (const fragment of fragments) {
      if (!definitions.some((definition) => definition.includes(fragment))) {
        throw new ContractSpineMigrationError(
          "MIGRATION_ADOPTION_MISMATCH",
          `${table} recovery delivery constraint mismatch: ${fragment}`,
        );
      }
    }
  }
  const receiptRows = await sql.unsafe<Array<{
    legacy_dispatch_id: string;
    current_revision_id: string;
    canonical_dispatch_id: string | null;
    disposition: string;
    reason_code: string;
    evidence: unknown;
  }>>(
    `SELECT legacy_dispatch_id, current_revision_id, canonical_dispatch_id,
            disposition, reason_code, evidence
       FROM recovery_dispatch_migration_receipts
      ORDER BY legacy_dispatch_id`,
  );
  const legacyDispatchCount = await sql.unsafe<Array<{ count: number }>>(
    "SELECT COUNT(*)::integer AS count FROM recovery_dispatches",
  );
  if (receiptRows.length !== (legacyDispatchCount[0]?.count ?? 0)) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "legacy recovery dispatch migration receipts are incomplete",
    );
  }
  for (const row of receiptRows) {
    const evidence = migrationObject(
      row.evidence,
      `recovery dispatch migration receipt evidence invalid: ${row.legacy_dispatch_id}`,
    );
    if (
      evidence.schema !== "setfarm.recovery-dispatch-migration-receipt.v1"
      || evidence.legacyDispatchId !== row.legacy_dispatch_id
      || evidence.currentRevisionId !== row.current_revision_id
      || (evidence.canonicalDispatchId ?? null) !== row.canonical_dispatch_id
      || evidence.disposition !== row.disposition
      || evidence.reasonCode !== row.reason_code
      || !Array.isArray(evidence.evidenceRefs)
    ) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `recovery dispatch migration receipt identity mismatch: ${row.legacy_dispatch_id}`,
      );
    }
  }
  const triggerRows = await sql.unsafe<Array<{ tgname: string; relation: string; definition: string }>>(
    `SELECT tgname, tgrelid::regclass::text AS relation,
            pg_get_triggerdef(oid, true) AS definition
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = ANY($1::text[])`,
    [[
      "trg_recovery_case_revisions_immutable",
      "trg_recovery_revision_dispatches_immutable",
      "trg_recovery_revision_dispatch_findings_immutable",
    ]],
  );
  const expectedTriggers = new Map([
    ["trg_recovery_case_revisions_immutable", "recovery_case_revisions"],
    ["trg_recovery_revision_dispatches_immutable", "recovery_revision_dispatches"],
    ["trg_recovery_revision_dispatch_findings_immutable", "recovery_revision_dispatch_findings"],
  ]);
  if (
    triggerRows.length !== expectedTriggers.size
    || triggerRows.some((row) =>
      row.relation !== expectedTriggers.get(row.tgname)
      || !normalizeSql(row.definition).includes("setfarm_forbid_artifact_identity_update()"))
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "recovery delivery immutable trigger target mismatch",
    );
  }
}

async function detectOperationalEventProjection(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const relations = await Promise.all(
    [...EXPECTED_OPERATIONAL_EVENT_COLUMNS.keys()].map((table) => relationExists(sql, table)),
  );
  const indexes = await readNamedIndexes(sql, [...EXPECTED_OPERATIONAL_EVENT_INDEXES.keys()]);
  const triggerRows = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = 'trg_operational_events_immutable'`,
  );
  const functionRows = await sql.unsafe<Array<{ relation: string | null }>>(
    "SELECT to_regprocedure('public.setfarm_forbid_operational_event_mutation()')::text AS relation",
  );
  const relationCount = relations.filter(Boolean).length;
  const triggerCount = triggerRows[0]?.count ?? 0;
  const functionPresent = Boolean(functionRows[0]?.relation);
  if (relationCount === 0 && indexes.size === 0 && triggerCount === 0 && !functionPresent) return "absent";
  if (
    relationCount === EXPECTED_OPERATIONAL_EVENT_COLUMNS.size
    && indexes.size === EXPECTED_OPERATIONAL_EVENT_INDEXES.size
    && triggerCount === 1
    && functionPresent
  ) return "present";
  return "partial";
}

async function verifyOperationalEventProjection(sql: Sql | TransactionSql): Promise<void> {
  for (const [table, expected] of EXPECTED_OPERATIONAL_EVENT_COLUMNS) {
    await verifyExpectedTableColumns(sql, table, expected);
  }
  const indexes = await readNamedIndexes(sql, [...EXPECTED_OPERATIONAL_EVENT_INDEXES.keys()]);
  for (const [name, expected] of EXPECTED_OPERATIONAL_EVENT_INDEXES) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `operational event projection index mismatch: ${name}`,
      );
    }
  }
  const expectedConstraintFragments = new Map<string, readonly string[]>([
    ["operational_events", [
      "primary key (event_key)",
      "unique (outbox_id)",
      "foreign key (outbox_id) references operational_outbox(outbox_id) on delete restrict",
      "event_hash ~ '^[a-f0-9]{64}$'::text",
      "jsonb_typeof(payload) = 'object'::text",
      "source_created_at <= committed_at",
    ]],
    ["operational_event_deliveries", [
      "primary key (event_key, consumer)",
      "unique (delivery_id)",
      "foreign key (event_key) references operational_events(event_key) on delete restrict",
      "delivery_id ~ '^oed_[a-f0-9]{64}$'::text",
      "idempotency_key = event_key",
      "attempt_count >= 0 and attempt_count <= 3",
      "(state = 'leased'::text) = (owner_instance_id is not null)",
      "(state = any (array['delivered'::text, 'skipped'::text])) = (delivered_at is not null)",
      "jsonb_typeof(result) = 'object'::text",
    ]],
  ]);
  for (const [table, fragments] of expectedConstraintFragments) {
    const rows = await sql.unsafe<Array<{ definition: string }>>(
      `SELECT pg_get_constraintdef(oid, true) AS definition
         FROM pg_constraint
        WHERE conrelid = $1::regclass`,
      [`public.${table}`],
    );
    const definitions = rows.map((row) => normalizeSql(row.definition));
    for (const fragment of fragments) {
      if (!definitions.some((definition) => definition.includes(fragment))) {
        throw new ContractSpineMigrationError(
          "MIGRATION_ADOPTION_MISMATCH",
          `${table} operational event constraint mismatch: ${fragment}`,
        );
      }
    }
  }
  const functionRows = await sql.unsafe<Array<{ definition: string }>>(
    `SELECT pg_get_functiondef(
       'setfarm_forbid_operational_event_mutation()'::regprocedure
     ) AS definition`,
  );
  const functionDefinition = normalizeSql(functionRows[0]?.definition ?? "");
  if (
    !functionDefinition.includes("operational_event_immutable")
    || !functionDefinition.includes("errcode = '23514'")
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "operational event immutability function mismatch",
    );
  }
  const triggerRows = await sql.unsafe<Array<{
    enabled: string;
    relation: string;
    definition: string;
  }>>(
    `SELECT t.tgenabled AS enabled, t.tgrelid::regclass::text AS relation,
            pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t
      WHERE NOT t.tgisinternal
        AND t.tgname = 'trg_operational_events_immutable'`,
  );
  const trigger = triggerRows[0];
  const triggerDefinition = normalizeSql(trigger?.definition ?? "");
  if (
    triggerRows.length !== 1
    || trigger?.enabled !== "O"
    || trigger.relation !== "operational_events"
    || !triggerDefinition.includes("before delete or update")
    || !triggerDefinition.includes("setfarm_forbid_operational_event_mutation()")
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "operational event immutability trigger mismatch",
    );
  }

  const eventRows = await sql.unsafe<Array<{
    event_key: string;
    outbox_id: string;
    request_id: string | null;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    run_id: string;
    payload: unknown;
    event_hash: string;
    source_created_at: Date | string;
    committed_at: Date | string;
    outbox_request_id: string | null;
    outbox_event_type: string;
    outbox_aggregate_type: string;
    outbox_aggregate_id: string;
    outbox_payload: unknown;
    outbox_state: string;
    outbox_created_at: Date | string;
    outbox_published_at: Date | string | null;
  }>>(
    `SELECT event.event_key, event.outbox_id, event.request_id, event.event_type,
            event.aggregate_type, event.aggregate_id, event.run_id, event.payload,
            event.event_hash, event.source_created_at, event.committed_at,
            outbox.request_id AS outbox_request_id,
            outbox.event_type AS outbox_event_type,
            outbox.aggregate_type AS outbox_aggregate_type,
            outbox.aggregate_id AS outbox_aggregate_id,
            outbox.payload AS outbox_payload,
            outbox.state AS outbox_state,
            outbox.created_at AS outbox_created_at,
            outbox.published_at AS outbox_published_at
       FROM operational_events event
       JOIN operational_outbox outbox ON outbox.outbox_id = event.outbox_id
      ORDER BY event.event_key`,
  );
  for (const row of eventRows) {
    let expected;
    try {
      expected = createCanonicalOperationalEventV1({
        eventKey: row.event_key,
        outboxId: row.outbox_id,
        requestId: row.request_id,
        eventType: row.outbox_event_type,
        aggregateType: row.outbox_aggregate_type,
        aggregateId: row.outbox_aggregate_id,
        payload: migrationObject(
          row.outbox_payload,
          `operational event outbox payload invalid: ${row.event_key}`,
        ),
        sourceCreatedAt: operationalMigrationTimestamp(
          row.outbox_created_at,
          `operational event source timestamp invalid: ${row.event_key}`,
        ),
        committedAt: operationalMigrationTimestamp(
          row.committed_at,
          `operational event commit timestamp invalid: ${row.event_key}`,
        ),
      });
    } catch (error) {
      if (error instanceof ContractSpineMigrationError) throw error;
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `operational event schema invalid: ${row.event_key}`,
        { cause: error },
      );
    }
    const storedPayloadHash = hashCanonicalJson(migrationObject(
      row.payload,
      `operational event payload invalid: ${row.event_key}`,
    ));
    if (
      row.outbox_state !== "published"
      || row.outbox_published_at === null
      || operationalMigrationTimestamp(row.outbox_published_at, "outbox publication timestamp invalid")
        !== operationalMigrationTimestamp(row.committed_at, "operational event commit timestamp invalid")
      || (row.outbox_request_id !== null && row.request_id !== row.outbox_request_id)
      || row.event_type !== expected.eventType
      || row.aggregate_type !== expected.aggregateType
      || row.aggregate_id !== expected.aggregateId
      || row.run_id !== expected.runId
      || storedPayloadHash !== hashCanonicalJson(expected.payload)
      || row.event_hash !== expected.eventHash
      || operationalMigrationTimestamp(row.source_created_at, "operational event source timestamp invalid")
        !== expected.sourceCreatedAt
    ) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `operational event identity mismatch: ${row.event_key}`,
      );
    }
  }
  const publicationCounts = await sql.unsafe<Array<{
    published_count: number;
    canonical_count: number;
  }>>(
    `SELECT
       (SELECT COUNT(*)::integer FROM operational_outbox WHERE state = 'published') AS published_count,
       (SELECT COUNT(*)::integer FROM operational_events) AS canonical_count`,
  );
  if (publicationCounts[0]?.published_count !== publicationCounts[0]?.canonical_count) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "published outbox and canonical event counts differ",
    );
  }

  const deliveryRows = await sql.unsafe<Array<{
    event_key: string;
    consumer: string;
    delivery_id: string;
    input_hash: string;
    idempotency_key: string;
    event_hash: string;
  }>>(
    `SELECT delivery.event_key, delivery.consumer, delivery.delivery_id,
            delivery.input_hash, delivery.idempotency_key, event.event_hash
       FROM operational_event_deliveries delivery
       JOIN operational_events event ON event.event_key = delivery.event_key
      ORDER BY delivery.event_key, delivery.consumer`,
  );
  const consumersByEvent = new Map<string, Set<string>>();
  for (const row of deliveryRows) {
    if (row.consumer !== "jsonl" && row.consumer !== "webhook") {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `operational event delivery consumer invalid: ${row.event_key}`,
      );
    }
    const consumer = row.consumer as OperationalEventDeliveryConsumerV1;
    if (
      row.delivery_id !== operationalEventDeliveryId(row.event_key, consumer)
      || row.input_hash !== row.event_hash
      || row.idempotency_key !== row.event_key
    ) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `operational event delivery identity mismatch: ${row.event_key}/${consumer}`,
      );
    }
    const consumers = consumersByEvent.get(row.event_key) ?? new Set<string>();
    consumers.add(consumer);
    consumersByEvent.set(row.event_key, consumers);
  }
  if (
    deliveryRows.length !== eventRows.length * 2
    || eventRows.some((row) => {
      const consumers = consumersByEvent.get(row.event_key);
      return consumers?.size !== 2 || !consumers.has("jsonl") || !consumers.has("webhook");
    })
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "operational event delivery ownership is incomplete",
    );
  }
}

async function detectRunProtocolShape(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  if (!await relationExists(sql, "runs")) return "absent";
  const rows = await sql.unsafe<Array<{ column_name: string }>>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'runs'
        AND column_name = ANY($1::text[])`,
    [[...expectedRunProtocolColumns.keys()]],
  );
  if (rows.length === 0) return "absent";
  if (rows.length === expectedRunProtocolColumns.size) return "present";
  return "partial";
}

async function verifyRunProtocolShape(sql: Sql | TransactionSql): Promise<void> {
  const columns = await sql.unsafe<Array<{
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    column_default: string | null;
  }>>(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'runs'
        AND column_name = ANY($1::text[])`,
    [[...expectedRunProtocolColumns.keys()]],
  );
  const actualColumns = new Map(columns.map((column) => [column.column_name, column]));
  if (actualColumns.size !== expectedRunProtocolColumns.size) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `runs protocol column count mismatch: expected ${expectedRunProtocolColumns.size}, got ${actualColumns.size}`,
    );
  }
  for (const [name, expected] of expectedRunProtocolColumns) {
    const actual = actualColumns.get(name);
    if (
      !actual
      || actual.data_type !== expected.dataType
      || actual.is_nullable !== expected.nullable
      || (expected.defaultFragment !== undefined
        && normalizeSql(actual.column_default ?? "") !== expected.defaultFragment)
    ) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runs protocol column mismatch: ${name}`,
      );
    }
  }

  const constraints = await sql.unsafe<Array<{ conname: string; definition: string }>>(
    `SELECT conname, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.runs'::regclass
        AND conname = ANY($1::text[])`,
    [[...expectedRunProtocolConstraints.keys()]],
  );
  const actualConstraints = new Map(
    constraints.map((constraint) => [constraint.conname, normalizeSql(constraint.definition)]),
  );
  for (const [name, fragment] of expectedRunProtocolConstraints) {
    if (!actualConstraints.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runs protocol constraint mismatch: ${name}`,
      );
    }
  }

  const triggers = await sql.unsafe<Array<{ enabled: string; definition: string }>>(
    `SELECT t.tgenabled AS enabled, pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t
      WHERE t.tgrelid = 'public.runs'::regclass
        AND NOT t.tgisinternal
        AND t.tgname = 'trg_runs_protocol_identity_immutable'`,
  );
  const trigger = triggers[0];
  if (
    triggers.length !== 1
    || trigger?.enabled !== "O"
    || !normalizeSql(trigger.definition).includes("setfarm_enforce_run_protocol_identity()")
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "runs protocol immutability trigger mismatch",
    );
  }
}

const V3_PREPARATION_BLOCK_LEDGER_STATEMENTS = [
  `CREATE TABLE v3_preparation_blocks (
    block_id TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    occurrence INTEGER NOT NULL,
    run_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    phase TEXT NOT NULL,
    error_code TEXT NOT NULL,
    action TEXT NOT NULL,
    dependency_state JSONB NOT NULL,
    detail TEXT NOT NULL,
    evidence_refs JSONB NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolution_fingerprint TEXT,
    CONSTRAINT v3_preparation_blocks_packet_fkey
      FOREIGN KEY (run_id, packet_hash)
      REFERENCES product_packets(run_id, packet_hash) ON DELETE RESTRICT,
    CONSTRAINT v3_preparation_blocks_story_occurrence_key
      UNIQUE (run_id, step_id, story_id, occurrence),
    CONSTRAINT v3_preparation_blocks_id_check
      CHECK (block_id = 'VPB_' || fingerprint || '_' || occurrence::text),
    CONSTRAINT v3_preparation_blocks_occurrence_check
      CHECK (occurrence > 0),
    CONSTRAINT v3_preparation_blocks_fingerprint_check
      CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_preparation_blocks_packet_hash_check
      CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_preparation_blocks_source_sha_check
      CHECK (source_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'),
    CONSTRAINT v3_preparation_blocks_source_tree_hash_check
      CHECK (source_tree_hash ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'),
    CONSTRAINT v3_preparation_blocks_phase_check
      CHECK (phase IN ('eligibility', 'packet', 'source', 'reservation', 'publication')),
    CONSTRAINT v3_preparation_blocks_action_check
      CHECK (action IN ('dependency_wait', 'packet_amendment', 'ownership_wait', 'bounded_infra', 'invariant_failure')),
    CONSTRAINT v3_preparation_blocks_identity_bounds_check
      CHECK (
        length(run_id) BETWEEN 1 AND 500
        AND length(step_id) BETWEEN 1 AND 500
        AND length(story_id) BETWEEN 1 AND 500
        AND length(error_code) BETWEEN 1 AND 500
        AND length(detail) BETWEEN 1 AND 8000
      ),
    CONSTRAINT v3_preparation_blocks_dependency_state_check
      CHECK (
        jsonb_typeof(dependency_state) = 'array'
        AND jsonb_array_length(dependency_state) <= 5000
      ),
    CONSTRAINT v3_preparation_blocks_evidence_refs_check
      CHECK (
        jsonb_typeof(evidence_refs) = 'array'
        AND jsonb_array_length(evidence_refs) <= 1000
        AND NOT jsonb_path_exists(evidence_refs, '$[*] ? (@.type() != "string")')
      ),
    CONSTRAINT v3_preparation_blocks_resolution_pair_check
      CHECK ((resolved_at IS NULL) = (resolution_fingerprint IS NULL)),
    CONSTRAINT v3_preparation_blocks_resolution_hash_check
      CHECK (resolution_fingerprint IS NULL OR resolution_fingerprint ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_preparation_blocks_resolution_delta_check
      CHECK (resolution_fingerprint IS NULL OR resolution_fingerprint <> fingerprint),
    CONSTRAINT v3_preparation_blocks_resolution_time_check
      CHECK (resolved_at IS NULL OR resolved_at >= opened_at)
  )`,
  `CREATE UNIQUE INDEX idx_v3_preparation_blocks_open_story
     ON v3_preparation_blocks(run_id, step_id, story_id)
     WHERE resolved_at IS NULL`,
  `CREATE INDEX idx_v3_preparation_blocks_run_opened
     ON v3_preparation_blocks(run_id, opened_at, block_id)`,
  `CREATE INDEX idx_v3_preparation_blocks_exact_history
     ON v3_preparation_blocks(run_id, step_id, story_id, fingerprint, occurrence)`,
  `CREATE FUNCTION setfarm_enforce_v3_preparation_block_transition()
   RETURNS TRIGGER AS $$
   BEGIN
     IF TG_OP = 'DELETE' THEN
       RAISE EXCEPTION 'SETFARM_V3_PREPARATION_BLOCK_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     IF OLD.block_id IS DISTINCT FROM NEW.block_id
        OR OLD.fingerprint IS DISTINCT FROM NEW.fingerprint
        OR OLD.occurrence IS DISTINCT FROM NEW.occurrence
        OR OLD.run_id IS DISTINCT FROM NEW.run_id
        OR OLD.step_id IS DISTINCT FROM NEW.step_id
        OR OLD.story_id IS DISTINCT FROM NEW.story_id
        OR OLD.packet_hash IS DISTINCT FROM NEW.packet_hash
        OR OLD.source_sha IS DISTINCT FROM NEW.source_sha
        OR OLD.source_tree_hash IS DISTINCT FROM NEW.source_tree_hash
        OR OLD.phase IS DISTINCT FROM NEW.phase
        OR OLD.error_code IS DISTINCT FROM NEW.error_code
        OR OLD.action IS DISTINCT FROM NEW.action
        OR OLD.dependency_state IS DISTINCT FROM NEW.dependency_state
        OR OLD.detail IS DISTINCT FROM NEW.detail
        OR OLD.evidence_refs IS DISTINCT FROM NEW.evidence_refs
        OR OLD.opened_at IS DISTINCT FROM NEW.opened_at
        OR OLD.resolved_at IS NOT NULL
        OR OLD.resolution_fingerprint IS NOT NULL
        OR NEW.resolved_at IS NULL
        OR NEW.resolution_fingerprint IS NULL
        OR NEW.resolution_fingerprint = OLD.fingerprint THEN
       RAISE EXCEPTION 'SETFARM_V3_PREPARATION_BLOCK_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_v3_preparation_blocks_transition
     BEFORE UPDATE OR DELETE ON v3_preparation_blocks
     FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_v3_preparation_block_transition()`,
  `CREATE TABLE v3_preparation_story_state (
    run_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    state_version INTEGER NOT NULL,
    state TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    base_source_sha TEXT NOT NULL,
    base_source_tree_hash TEXT NOT NULL,
    projected_dependency_ids JSONB NOT NULL,
    dependency_attempts JSONB NOT NULL,
    state_fingerprint TEXT NOT NULL,
    claim_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    PRIMARY KEY (run_id, step_id, story_id),
    CONSTRAINT v3_preparation_story_state_packet_fkey
      FOREIGN KEY (run_id, packet_hash)
      REFERENCES product_packets(run_id, packet_hash) ON DELETE RESTRICT,
    CONSTRAINT v3_preparation_story_state_claim_fkey
      FOREIGN KEY (claim_id) REFERENCES claim_log(id) ON DELETE RESTRICT,
    CONSTRAINT v3_preparation_story_state_version_check
      CHECK (state_version > 0),
    CONSTRAINT v3_preparation_story_state_state_check
      CHECK (state IN ('blocked', 'ready', 'claimed')),
    CONSTRAINT v3_preparation_story_state_hash_check
      CHECK (state_fingerprint ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_preparation_story_state_packet_hash_check
      CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_preparation_story_state_source_sha_check
      CHECK (base_source_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'),
    CONSTRAINT v3_preparation_story_state_source_tree_hash_check
      CHECK (base_source_tree_hash ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'),
    CONSTRAINT v3_preparation_story_state_identity_bounds_check
      CHECK (
        length(run_id) BETWEEN 1 AND 500
        AND length(step_id) BETWEEN 1 AND 500
        AND length(story_id) BETWEEN 1 AND 500
      ),
    CONSTRAINT v3_preparation_story_state_projection_check
      CHECK (
        jsonb_typeof(projected_dependency_ids) = 'array'
        AND jsonb_array_length(projected_dependency_ids) <= 5000
        AND NOT jsonb_path_exists(projected_dependency_ids, '$[*] ? (@.type() != "string")')
      ),
    CONSTRAINT v3_preparation_story_state_attempts_check
      CHECK (
        jsonb_typeof(dependency_attempts) = 'array'
        AND jsonb_array_length(dependency_attempts) <= 5000
      ),
    CONSTRAINT v3_preparation_story_state_claim_pair_check
      CHECK ((state = 'claimed') = (claim_id IS NOT NULL AND claimed_at IS NOT NULL)),
    CONSTRAINT v3_preparation_story_state_time_check
      CHECK (updated_at >= created_at AND (claimed_at IS NULL OR claimed_at >= created_at))
  )`,
  `CREATE INDEX idx_v3_preparation_story_state_run
     ON v3_preparation_story_state(run_id, state, updated_at, story_id)`,
  `CREATE UNIQUE INDEX idx_v3_preparation_story_state_claim
     ON v3_preparation_story_state(claim_id)
     WHERE claim_id IS NOT NULL`,
  `CREATE FUNCTION setfarm_enforce_v3_preparation_story_state_transition()
   RETURNS TRIGGER AS $$
   DECLARE
     linked_claim RECORD;
     pending_story_count INTEGER;
   BEGIN
     IF TG_OP = 'DELETE' THEN
       RAISE EXCEPTION 'SETFARM_V3_PREPARATION_STORY_STATE_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     IF OLD.run_id IS DISTINCT FROM NEW.run_id
        OR OLD.step_id IS DISTINCT FROM NEW.step_id
        OR OLD.story_id IS DISTINCT FROM NEW.story_id
        OR OLD.created_at IS DISTINCT FROM NEW.created_at
        OR NEW.updated_at < OLD.updated_at THEN
       RAISE EXCEPTION 'SETFARM_V3_PREPARATION_STORY_STATE_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     IF OLD.state = 'ready' AND NEW.state = 'claimed' THEN
       IF NEW.state_version <> OLD.state_version
          OR NEW.packet_hash IS DISTINCT FROM OLD.packet_hash
          OR NEW.base_source_sha IS DISTINCT FROM OLD.base_source_sha
          OR NEW.base_source_tree_hash IS DISTINCT FROM OLD.base_source_tree_hash
          OR NEW.projected_dependency_ids IS DISTINCT FROM OLD.projected_dependency_ids
          OR NEW.dependency_attempts IS DISTINCT FROM OLD.dependency_attempts
          OR NEW.state_fingerprint IS DISTINCT FROM OLD.state_fingerprint
          OR OLD.claim_id IS NOT NULL
          OR OLD.claimed_at IS NOT NULL
          OR NEW.claim_id IS NULL
          OR NEW.claimed_at IS NULL THEN
         RAISE EXCEPTION 'SETFARM_V3_PREPARATION_STORY_STATE_CLAIM_INVALID' USING ERRCODE = '55000';
       END IF;
       SELECT run_id, step_id, story_id, outcome
         INTO linked_claim
         FROM claim_log WHERE id = NEW.claim_id;
       IF NOT FOUND
          OR linked_claim.run_id IS DISTINCT FROM NEW.run_id
          OR linked_claim.step_id IS DISTINCT FROM NEW.step_id
          OR linked_claim.story_id IS DISTINCT FROM NEW.story_id
          OR linked_claim.outcome IS NOT NULL THEN
         RAISE EXCEPTION 'SETFARM_V3_PREPARATION_STORY_STATE_CLAIM_INVALID' USING ERRCODE = '55000';
       END IF;
       RETURN NEW;
     END IF;
     IF NEW.state_version <> OLD.state_version + 1
        OR NEW.claim_id IS NOT NULL
        OR NEW.claimed_at IS NOT NULL
        OR NEW.state = 'claimed' THEN
       RAISE EXCEPTION 'SETFARM_V3_PREPARATION_STORY_STATE_TRANSITION_INVALID' USING ERRCODE = '55000';
     END IF;
     IF OLD.state = 'claimed' THEN
       SELECT run_id, step_id, story_id, outcome
         INTO linked_claim
         FROM claim_log WHERE id = OLD.claim_id;
       IF NOT FOUND
          OR linked_claim.run_id IS DISTINCT FROM OLD.run_id
          OR linked_claim.step_id IS DISTINCT FROM OLD.step_id
          OR linked_claim.story_id IS DISTINCT FROM OLD.story_id
          OR linked_claim.outcome IS DISTINCT FROM 'infra_retry' THEN
         RAISE EXCEPTION 'SETFARM_V3_PREPARATION_STORY_STATE_REARM_INVALID' USING ERRCODE = '55000';
       END IF;
       SELECT COUNT(*)::integer INTO pending_story_count
         FROM stories
        WHERE run_id = OLD.run_id AND story_id = OLD.story_id AND status = 'pending';
       IF pending_story_count <> 1 THEN
         RAISE EXCEPTION 'SETFARM_V3_PREPARATION_STORY_STATE_REARM_INVALID' USING ERRCODE = '55000';
       END IF;
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_v3_preparation_story_state_transition
     BEFORE UPDATE OR DELETE ON v3_preparation_story_state
     FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_v3_preparation_story_state_transition()`,
] as const;

const EXPECTED_V3_PREPARATION_BLOCK_COLUMNS = new Map([
  ["block_id", { dataType: "text", nullable: "NO" as const }],
  ["fingerprint", { dataType: "text", nullable: "NO" as const }],
  ["occurrence", { dataType: "integer", nullable: "NO" as const }],
  ["run_id", { dataType: "text", nullable: "NO" as const }],
  ["step_id", { dataType: "text", nullable: "NO" as const }],
  ["story_id", { dataType: "text", nullable: "NO" as const }],
  ["packet_hash", { dataType: "text", nullable: "NO" as const }],
  ["source_sha", { dataType: "text", nullable: "NO" as const }],
  ["source_tree_hash", { dataType: "text", nullable: "NO" as const }],
  ["phase", { dataType: "text", nullable: "NO" as const }],
  ["error_code", { dataType: "text", nullable: "NO" as const }],
  ["action", { dataType: "text", nullable: "NO" as const }],
  ["dependency_state", { dataType: "jsonb", nullable: "NO" as const }],
  ["detail", { dataType: "text", nullable: "NO" as const }],
  ["evidence_refs", { dataType: "jsonb", nullable: "NO" as const }],
  ["opened_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
  ["resolved_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
  ["resolution_fingerprint", { dataType: "text", nullable: "YES" as const }],
]);

const EXPECTED_V3_PREPARATION_STORY_STATE_COLUMNS = new Map([
  ["run_id", { dataType: "text", nullable: "NO" as const }],
  ["step_id", { dataType: "text", nullable: "NO" as const }],
  ["story_id", { dataType: "text", nullable: "NO" as const }],
  ["state_version", { dataType: "integer", nullable: "NO" as const }],
  ["state", { dataType: "text", nullable: "NO" as const }],
  ["packet_hash", { dataType: "text", nullable: "NO" as const }],
  ["base_source_sha", { dataType: "text", nullable: "NO" as const }],
  ["base_source_tree_hash", { dataType: "text", nullable: "NO" as const }],
  ["projected_dependency_ids", { dataType: "jsonb", nullable: "NO" as const }],
  ["dependency_attempts", { dataType: "jsonb", nullable: "NO" as const }],
  ["state_fingerprint", { dataType: "text", nullable: "NO" as const }],
  ["claim_id", { dataType: "bigint", nullable: "YES" as const }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
  ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
  ["claimed_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
]);

async function detectV3PreparationBlockLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const blocksTable = await relationExists(sql, "v3_preparation_blocks");
  const stateTable = await relationExists(sql, "v3_preparation_story_state");
  const indexes = await readNamedIndexes(sql, [
    "idx_v3_preparation_blocks_open_story",
    "idx_v3_preparation_blocks_run_opened",
    "idx_v3_preparation_blocks_exact_history",
    "idx_v3_preparation_story_state_run",
    "idx_v3_preparation_story_state_claim",
  ]);
  const functionRows = await sql.unsafe<Array<{ relation: string | null }>>(
    `SELECT to_regprocedure(name)::text AS relation
       FROM unnest(ARRAY[
         'public.setfarm_enforce_v3_preparation_block_transition()',
         'public.setfarm_enforce_v3_preparation_story_state_transition()'
       ]::text[]) AS name`,
  );
  const triggerRows = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count FROM pg_trigger
      WHERE NOT tgisinternal AND tgname IN (
        'trg_v3_preparation_blocks_transition',
        'trg_v3_preparation_story_state_transition'
      )`,
  );
  const functionCount = functionRows.filter((row) => Boolean(row.relation)).length;
  const triggerCount = triggerRows[0]?.count ?? 0;
  if (!blocksTable && !stateTable && indexes.size === 0 && functionCount === 0 && triggerCount === 0) return "absent";
  if (blocksTable && stateTable && indexes.size === 5 && functionCount === 2 && triggerCount === 2) return "present";
  return "partial";
}

async function verifyV3PreparationBlockLedger(sql: Sql | TransactionSql): Promise<void> {
  await verifyExpectedTableColumns(sql, "v3_preparation_blocks", EXPECTED_V3_PREPARATION_BLOCK_COLUMNS);
  await verifyExpectedTableColumns(
    sql,
    "v3_preparation_story_state",
    EXPECTED_V3_PREPARATION_STORY_STATE_COLUMNS,
  );
  const indexes = await readNamedIndexes(sql, [
    "idx_v3_preparation_blocks_open_story",
    "idx_v3_preparation_blocks_run_opened",
    "idx_v3_preparation_blocks_exact_history",
    "idx_v3_preparation_story_state_run",
    "idx_v3_preparation_story_state_claim",
  ]);
  const expectedIndexes = new Map([
    ["idx_v3_preparation_blocks_open_story", "create unique index idx_v3_preparation_blocks_open_story on public.v3_preparation_blocks using btree (run_id, step_id, story_id) where (resolved_at is null)"],
    ["idx_v3_preparation_blocks_run_opened", "create index idx_v3_preparation_blocks_run_opened on public.v3_preparation_blocks using btree (run_id, opened_at, block_id)"],
    ["idx_v3_preparation_blocks_exact_history", "create index idx_v3_preparation_blocks_exact_history on public.v3_preparation_blocks using btree (run_id, step_id, story_id, fingerprint, occurrence)"],
    ["idx_v3_preparation_story_state_run", "create index idx_v3_preparation_story_state_run on public.v3_preparation_story_state using btree (run_id, state, updated_at, story_id)"],
    ["idx_v3_preparation_story_state_claim", "create unique index idx_v3_preparation_story_state_claim on public.v3_preparation_story_state using btree (claim_id) where (claim_id is not null)"],
  ]);
  for (const [name, expected] of expectedIndexes) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", `v3 preparation block index mismatch: ${name}`);
    }
  }
  const constraintNames = [
    "v3_preparation_blocks_pkey",
    "v3_preparation_blocks_story_occurrence_key",
    "v3_preparation_blocks_packet_fkey",
    "v3_preparation_blocks_id_check",
    "v3_preparation_blocks_occurrence_check",
    "v3_preparation_blocks_fingerprint_check",
    "v3_preparation_blocks_packet_hash_check",
    "v3_preparation_blocks_source_sha_check",
    "v3_preparation_blocks_source_tree_hash_check",
    "v3_preparation_blocks_phase_check",
    "v3_preparation_blocks_action_check",
    "v3_preparation_blocks_identity_bounds_check",
    "v3_preparation_blocks_dependency_state_check",
    "v3_preparation_blocks_evidence_refs_check",
    "v3_preparation_blocks_resolution_pair_check",
    "v3_preparation_blocks_resolution_hash_check",
    "v3_preparation_blocks_resolution_delta_check",
    "v3_preparation_blocks_resolution_time_check",
  ];
  const constraints = await sql.unsafe<Array<{
    conname: string;
    contype: string;
    confdeltype: string;
    definition: string;
  }>>(
    `SELECT conname, contype, confdeltype, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint WHERE conname = ANY($1::text[])`,
    [constraintNames],
  );
  const byName = new Map(constraints.map((constraint) => [constraint.conname, constraint]));
  if (byName.size !== constraintNames.length) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "v3 preparation block constraints are incomplete");
  }
  const packetFk = byName.get("v3_preparation_blocks_packet_fkey");
  if (
    packetFk?.contype !== "f"
    || packetFk.confdeltype !== "r"
    || !normalizeSql(packetFk.definition).includes(
      "foreign key (run_id, packet_hash) references product_packets(run_id, packet_hash) on delete restrict",
    )
  ) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "v3 preparation block packet FK mismatch");
  }
  const definitions = new Map(constraints.map((constraint) => [
    constraint.conname,
    normalizeSql(constraint.definition),
  ]));
  const fragments = new Map([
    ["v3_preparation_blocks_pkey", "primary key (block_id)"],
    ["v3_preparation_blocks_story_occurrence_key", "unique (run_id, step_id, story_id, occurrence)"],
    ["v3_preparation_blocks_id_check", "block_id = ((('vpb_'::text || fingerprint) || '_'::text) || occurrence::text)"],
    ["v3_preparation_blocks_occurrence_check", "occurrence > 0"],
    ["v3_preparation_blocks_phase_check", "phase = any"],
    ["v3_preparation_blocks_action_check", "action = any"],
    ["v3_preparation_blocks_dependency_state_check", "jsonb_typeof(dependency_state) = 'array'::text"],
    ["v3_preparation_blocks_evidence_refs_check", "jsonb_typeof(evidence_refs) = 'array'::text"],
    ["v3_preparation_blocks_resolution_pair_check", "(resolved_at is null) = (resolution_fingerprint is null)"],
    ["v3_preparation_blocks_resolution_delta_check", "resolution_fingerprint <> fingerprint"],
    ["v3_preparation_blocks_resolution_time_check", "resolved_at >= opened_at"],
  ]);
  for (const [name, fragment] of fragments) {
    if (!definitions.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 preparation block constraint mismatch: ${name}; expected fragment=${fragment}; actual=${definitions.get(name) ?? "missing"}`,
      );
    }
  }
  const stateConstraintNames = [
    "v3_preparation_story_state_pkey",
    "v3_preparation_story_state_packet_fkey",
    "v3_preparation_story_state_claim_fkey",
    "v3_preparation_story_state_version_check",
    "v3_preparation_story_state_state_check",
    "v3_preparation_story_state_hash_check",
    "v3_preparation_story_state_packet_hash_check",
    "v3_preparation_story_state_source_sha_check",
    "v3_preparation_story_state_source_tree_hash_check",
    "v3_preparation_story_state_identity_bounds_check",
    "v3_preparation_story_state_projection_check",
    "v3_preparation_story_state_attempts_check",
    "v3_preparation_story_state_claim_pair_check",
    "v3_preparation_story_state_time_check",
  ];
  const stateConstraints = await sql.unsafe<Array<{
    conname: string;
    contype: string;
    confdeltype: string;
    definition: string;
  }>>(
    `SELECT conname, contype, confdeltype, pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint WHERE conname = ANY($1::text[])`,
    [stateConstraintNames],
  );
  const stateByName = new Map(stateConstraints.map((constraint) => [constraint.conname, constraint]));
  if (stateByName.size !== stateConstraintNames.length) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "v3 preparation story state constraints are incomplete",
    );
  }
  const statePacketFk = stateByName.get("v3_preparation_story_state_packet_fkey");
  const stateClaimFk = stateByName.get("v3_preparation_story_state_claim_fkey");
  if (
    statePacketFk?.contype !== "f"
    || statePacketFk.confdeltype !== "r"
    || !normalizeSql(statePacketFk.definition).includes(
      "foreign key (run_id, packet_hash) references product_packets(run_id, packet_hash) on delete restrict",
    )
    || stateClaimFk?.contype !== "f"
    || stateClaimFk.confdeltype !== "r"
    || !normalizeSql(stateClaimFk.definition).includes(
      "foreign key (claim_id) references claim_log(id) on delete restrict",
    )
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "v3 preparation story state FK mismatch",
    );
  }
  const stateDefinitions = new Map(stateConstraints.map((constraint) => [
    constraint.conname,
    normalizeSql(constraint.definition),
  ]));
  const stateFragments = new Map([
    ["v3_preparation_story_state_pkey", "primary key (run_id, step_id, story_id)"],
    ["v3_preparation_story_state_version_check", "state_version > 0"],
    ["v3_preparation_story_state_state_check", "state = any"],
    ["v3_preparation_story_state_projection_check", "jsonb_typeof(projected_dependency_ids) = 'array'::text"],
    ["v3_preparation_story_state_attempts_check", "jsonb_typeof(dependency_attempts) = 'array'::text"],
    ["v3_preparation_story_state_claim_pair_check", "(state = 'claimed'::text) = (claim_id is not null and claimed_at is not null)"],
    ["v3_preparation_story_state_time_check", "updated_at >= created_at"],
  ]);
  for (const [name, fragment] of stateFragments) {
    if (!stateDefinitions.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 preparation story state constraint mismatch: ${name}; expected fragment=${fragment}; actual=${stateDefinitions.get(name) ?? "missing"}`,
      );
    }
  }
  const triggers = await sql.unsafe<Array<{ enabled: string; relation: string; definition: string }>>(
    `SELECT t.tgenabled AS enabled, t.tgrelid::regclass::text AS relation,
            pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgname IN (
        'trg_v3_preparation_blocks_transition',
        'trg_v3_preparation_story_state_transition'
      )`,
  );
  const triggerByRelation = new Map(triggers.map((trigger) => [trigger.relation, trigger]));
  const blockTrigger = triggerByRelation.get("v3_preparation_blocks");
  const stateTrigger = triggerByRelation.get("v3_preparation_story_state");
  if (
    triggers.length !== 2
    || blockTrigger?.enabled !== "O"
    || !normalizeSql(blockTrigger.definition).includes("before delete or update on v3_preparation_blocks")
    || !normalizeSql(blockTrigger.definition).includes("setfarm_enforce_v3_preparation_block_transition()")
    || stateTrigger?.enabled !== "O"
    || !normalizeSql(stateTrigger.definition).includes("before delete or update on v3_preparation_story_state")
    || !normalizeSql(stateTrigger.definition).includes("setfarm_enforce_v3_preparation_story_state_transition()")
  ) {
    throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", "v3 preparation transition trigger mismatch");
  }
  const functions = await sql.unsafe<Array<{ definition: string | null }>>(
    "SELECT pg_get_functiondef(to_regprocedure('setfarm_enforce_v3_preparation_block_transition()')) AS definition",
  );
  const functionDefinition = normalizeSql(functions[0]?.definition ?? "");
  for (const fragment of [
    "tg_op = 'delete'",
    "old.block_id is distinct from new.block_id",
    "old.occurrence is distinct from new.occurrence",
    "old.resolved_at is not null",
    "new.resolved_at is null",
    "new.resolution_fingerprint = old.fingerprint",
    "setfarm_v3_preparation_block_immutable",
  ]) {
    if (!functionDefinition.includes(fragment)) {
      throw new ContractSpineMigrationError("MIGRATION_ADOPTION_MISMATCH", `v3 preparation block transition function mismatch: ${fragment}`);
    }
  }
  const stateFunctions = await sql.unsafe<Array<{ definition: string | null }>>(
    "SELECT pg_get_functiondef(to_regprocedure('setfarm_enforce_v3_preparation_story_state_transition()')) AS definition",
  );
  const stateFunctionDefinition = normalizeSql(stateFunctions[0]?.definition ?? "");
  for (const fragment of [
    "tg_op = 'delete'",
    "old.state = 'ready'",
    "new.state = 'claimed'",
    "new.state_version <> old.state_version + 1",
    "linked_claim.outcome is distinct from 'infra_retry'",
    "pending_story_count <> 1",
    "setfarm_v3_preparation_story_state_immutable",
    "setfarm_v3_preparation_story_state_claim_invalid",
    "setfarm_v3_preparation_story_state_rearm_invalid",
  ]) {
    if (!stateFunctionDefinition.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 preparation story state transition function mismatch: ${fragment}`,
      );
    }
  }
}

const V3_GITHUB_REVIEW_RESOLUTION_EVIDENCE_STATEMENTS = [
  `CREATE TABLE github_review_resolution_evidence (
    evidence_hash TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    contract_slice_hash TEXT NOT NULL,
    recovery_case_id TEXT NOT NULL,
    recovery_case_revision_id TEXT NOT NULL,
    recovery_dispatch_id TEXT NOT NULL,
    attempt_id TEXT NOT NULL,
    finding_set_hash TEXT NOT NULL,
    repository_node_id TEXT NOT NULL,
    repository_owner TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    pr_number INTEGER NOT NULL,
    original_head_sha TEXT NOT NULL,
    original_source_tree_hash TEXT NOT NULL,
    observed_head_sha TEXT NOT NULL,
    observed_source_tree_hash TEXT NOT NULL,
    thread_ids JSONB NOT NULL,
    original_artifact_hashes JSONB NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT github_review_resolution_evidence_candidate_unique
      UNIQUE (recovery_case_id, observed_head_sha, observed_source_tree_hash),
    CONSTRAINT github_review_resolution_evidence_hash_check
      CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT github_review_resolution_evidence_packet_hash_check
      CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT github_review_resolution_evidence_slice_hash_check
      CHECK (contract_slice_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT github_review_resolution_evidence_original_source_check
      CHECK (
        original_head_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'
        AND original_source_tree_hash ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'
      ),
    CONSTRAINT github_review_resolution_evidence_observed_source_check
      CHECK (
        observed_head_sha ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'
        AND observed_source_tree_hash ~ '^[a-f0-9]{40}([a-f0-9]{24})?$'
      ),
    CONSTRAINT github_review_resolution_evidence_identity_bounds_check
      CHECK (
        length(run_id) BETWEEN 1 AND 500
        AND length(story_id) BETWEEN 1 AND 500
        AND length(repository_node_id) BETWEEN 1 AND 500
        AND length(repository_owner) BETWEEN 1 AND 500
        AND length(repository_name) BETWEEN 1 AND 500
        AND pr_number > 0
      ),
    CONSTRAINT github_review_resolution_evidence_thread_set_check
      CHECK (
        jsonb_typeof(thread_ids) = 'array'
        AND jsonb_typeof(original_artifact_hashes) = 'array'
        AND jsonb_array_length(thread_ids) BETWEEN 1 AND 100
        AND jsonb_array_length(original_artifact_hashes) = jsonb_array_length(thread_ids)
        AND NOT jsonb_path_exists(thread_ids, '$[*] ? (@.type() != "string")')
        AND NOT jsonb_path_exists(original_artifact_hashes, '$[*] ? (@.type() != "string")')
      ),
    CONSTRAINT github_review_resolution_evidence_payload_check
      CHECK (
        jsonb_typeof(payload) = 'object'
        AND payload->>'schema' = 'setfarm.github-review-resolution-evidence.v1'
        AND payload->>'evidenceHash' = evidence_hash
        AND payload->>'runId' = run_id
        AND payload->>'storyId' = story_id
        AND payload->>'packetHash' = packet_hash
        AND payload->>'contractSliceHash' = contract_slice_hash
        AND payload->>'recoveryCaseId' = recovery_case_id
        AND payload->>'recoveryCaseRevisionId' = recovery_case_revision_id
        AND payload->>'recoveryDispatchId' = recovery_dispatch_id
        AND payload->>'attemptId' = attempt_id
        AND payload->>'findingSetHash' = finding_set_hash
        AND payload->'repository'->>'nodeId' = repository_node_id
        AND payload->'repository'->>'owner' = repository_owner
        AND payload->'repository'->>'name' = repository_name
        AND (payload->>'prNumber')::integer = pr_number
        AND payload->>'originalHeadSha' = original_head_sha
        AND payload->'originalSourceRevision'->>'sha' = original_head_sha
        AND payload->'originalSourceRevision'->>'treeHash' = original_source_tree_hash
        AND payload->>'observedHeadSha' = observed_head_sha
        AND payload->'observedSourceRevision'->>'sha' = observed_head_sha
        AND payload->'observedSourceRevision'->>'treeHash' = observed_source_tree_hash
        AND jsonb_array_length(payload->'threads') = jsonb_array_length(thread_ids)
        AND NOT jsonb_path_exists(
          payload,
          '$.threads[*] ? (@.status != "RESOLVED" && @.status != "OUTDATED")'
        )
      ),
    CONSTRAINT github_review_resolution_evidence_recovery_fkey
      FOREIGN KEY (recovery_case_id, finding_set_hash, packet_hash, contract_slice_hash)
      REFERENCES recovery_cases(recovery_case_id, finding_set_hash, packet_hash, slice_hash)
      ON DELETE RESTRICT,
    CONSTRAINT github_review_resolution_evidence_dispatch_fkey
      FOREIGN KEY (recovery_dispatch_id, recovery_case_revision_id)
      REFERENCES recovery_revision_dispatches(dispatch_id, revision_id)
      ON DELETE RESTRICT,
    CONSTRAINT github_review_resolution_evidence_attempt_fkey
      FOREIGN KEY (attempt_id) REFERENCES execution_attempts(attempt_id) ON DELETE RESTRICT,
    CONSTRAINT github_review_resolution_evidence_finding_fkey
      FOREIGN KEY (
        finding_set_hash, run_id, story_id, packet_hash, contract_slice_hash,
        original_head_sha, original_source_tree_hash
      ) REFERENCES finding_sets (
        finding_set_hash, run_id, story_id, packet_hash, slice_hash,
        source_sha, source_tree_hash
      ) ON DELETE RESTRICT
  )`,
  `CREATE INDEX idx_github_review_resolution_evidence_run_story
     ON github_review_resolution_evidence(run_id, story_id, created_at, evidence_hash)`,
  `CREATE TRIGGER trg_github_review_resolution_evidence_immutable
     BEFORE UPDATE OR DELETE ON github_review_resolution_evidence
     FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  "ALTER TABLE recovery_cases ADD COLUMN github_review_resolution_evidence_hash TEXT",
  `ALTER TABLE recovery_cases
     ADD CONSTRAINT recovery_cases_github_review_resolution_hash_check
     CHECK (
       github_review_resolution_evidence_hash IS NULL
       OR github_review_resolution_evidence_hash ~ '^[a-f0-9]{64}$'
     )`,
  `ALTER TABLE recovery_cases
     ADD CONSTRAINT recovery_cases_github_review_resolution_terminal_check
     CHECK (
       github_review_resolution_evidence_hash IS NULL
       OR (
         status = 'resolved'
         AND terminal->>'outcome' = 'resolved'
         AND terminal->'evidenceBundleHashes' = jsonb_build_array(
           github_review_resolution_evidence_hash
         )
       )
     )`,
  `ALTER TABLE recovery_cases
     ADD CONSTRAINT recovery_cases_github_review_resolution_fkey
     FOREIGN KEY (github_review_resolution_evidence_hash)
     REFERENCES github_review_resolution_evidence(evidence_hash)
     ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED`,
  `CREATE FUNCTION setfarm_enforce_github_review_resolution_pointer_set_once()
   RETURNS TRIGGER AS $$
   BEGIN
     IF OLD.github_review_resolution_evidence_hash IS DISTINCT FROM NEW.github_review_resolution_evidence_hash
        AND NOT (
          OLD.github_review_resolution_evidence_hash IS NULL
          AND NEW.github_review_resolution_evidence_hash IS NOT NULL
        ) THEN
       RAISE EXCEPTION 'SETFARM_GITHUB_REVIEW_RESOLUTION_POINTER_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_recovery_cases_github_review_resolution_set_once
     BEFORE UPDATE OF github_review_resolution_evidence_hash ON recovery_cases
     FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_github_review_resolution_pointer_set_once()`,
] as const;

const EXPECTED_GITHUB_REVIEW_RESOLUTION_EVIDENCE_COLUMNS = new Map([
  ["evidence_hash", { dataType: "text", nullable: "NO" as const }],
  ["run_id", { dataType: "text", nullable: "NO" as const }],
  ["story_id", { dataType: "text", nullable: "NO" as const }],
  ["packet_hash", { dataType: "text", nullable: "NO" as const }],
  ["contract_slice_hash", { dataType: "text", nullable: "NO" as const }],
  ["recovery_case_id", { dataType: "text", nullable: "NO" as const }],
  ["recovery_case_revision_id", { dataType: "text", nullable: "NO" as const }],
  ["recovery_dispatch_id", { dataType: "text", nullable: "NO" as const }],
  ["attempt_id", { dataType: "text", nullable: "NO" as const }],
  ["finding_set_hash", { dataType: "text", nullable: "NO" as const }],
  ["repository_node_id", { dataType: "text", nullable: "NO" as const }],
  ["repository_owner", { dataType: "text", nullable: "NO" as const }],
  ["repository_name", { dataType: "text", nullable: "NO" as const }],
  ["pr_number", { dataType: "integer", nullable: "NO" as const }],
  ["original_head_sha", { dataType: "text", nullable: "NO" as const }],
  ["original_source_tree_hash", { dataType: "text", nullable: "NO" as const }],
  ["observed_head_sha", { dataType: "text", nullable: "NO" as const }],
  ["observed_source_tree_hash", { dataType: "text", nullable: "NO" as const }],
  ["thread_ids", { dataType: "jsonb", nullable: "NO" as const }],
  ["original_artifact_hashes", { dataType: "jsonb", nullable: "NO" as const }],
  ["payload", { dataType: "jsonb", nullable: "NO" as const }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
]);

async function detectGithubReviewResolutionEvidenceLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const table = await relationExists(sql, "github_review_resolution_evidence");
  const columnRows = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'recovery_cases'
        AND column_name = 'github_review_resolution_evidence_hash'`,
  );
  const index = await readNamedIndexes(sql, ["idx_github_review_resolution_evidence_run_story"]);
  const triggerRows = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count FROM pg_trigger
      WHERE NOT tgisinternal AND tgname IN (
        'trg_github_review_resolution_evidence_immutable',
        'trg_recovery_cases_github_review_resolution_set_once'
      )`,
  );
  const functionRows = await sql.unsafe<Array<{ relation: string | null }>>(
    `SELECT to_regprocedure(
       'public.setfarm_enforce_github_review_resolution_pointer_set_once()'
     )::text AS relation`,
  );
  const column = (columnRows[0]?.count ?? 0) === 1;
  const triggerCount = triggerRows[0]?.count ?? 0;
  const fn = Boolean(functionRows[0]?.relation);
  if (!table && !column && index.size === 0 && triggerCount === 0 && !fn) return "absent";
  if (table && column && index.size === 1 && triggerCount === 2 && fn) return "present";
  return "partial";
}

async function verifyGithubReviewResolutionEvidenceLedger(sql: Sql | TransactionSql): Promise<void> {
  await verifyExpectedTableColumns(
    sql,
    "github_review_resolution_evidence",
    EXPECTED_GITHUB_REVIEW_RESOLUTION_EVIDENCE_COLUMNS,
  );
  const pointerColumns = await sql.unsafe<Array<{ data_type: string; is_nullable: string }>>(
    `SELECT data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'recovery_cases'
        AND column_name = 'github_review_resolution_evidence_hash'`,
  );
  if (
    pointerColumns.length !== 1
    || pointerColumns[0]?.data_type !== "text"
    || pointerColumns[0]?.is_nullable !== "YES"
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "GitHub review resolution recovery pointer column mismatch",
    );
  }
  const indexes = await readNamedIndexes(sql, ["idx_github_review_resolution_evidence_run_story"]);
  if (indexes.get("idx_github_review_resolution_evidence_run_story")
      !== "create index idx_github_review_resolution_evidence_run_story on public.github_review_resolution_evidence using btree (run_id, story_id, created_at, evidence_hash)") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "GitHub review resolution evidence index mismatch",
    );
  }
  const constraintNames = [
    "github_review_resolution_evidence_pkey",
    "github_review_resolution_evidence_candidate_unique",
    "github_review_resolution_evidence_recovery_fkey",
    "github_review_resolution_evidence_dispatch_fkey",
    "github_review_resolution_evidence_attempt_fkey",
    "github_review_resolution_evidence_finding_fkey",
    "github_review_resolution_evidence_payload_check",
    "github_review_resolution_evidence_thread_set_check",
    "recovery_cases_github_review_resolution_hash_check",
    "recovery_cases_github_review_resolution_terminal_check",
    "recovery_cases_github_review_resolution_fkey",
  ];
  const constraints = await sql.unsafe<Array<{
    conname: string;
    contype: string;
    confdeltype: string;
    condeferrable: boolean;
    condeferred: boolean;
    definition: string;
  }>>(
    `SELECT conname, contype, confdeltype, condeferrable, condeferred,
            pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint WHERE conname = ANY($1::text[])`,
    [constraintNames],
  );
  const byName = new Map(constraints.map((constraint) => [constraint.conname, constraint]));
  if (byName.size !== constraintNames.length) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "GitHub review resolution evidence constraints are incomplete",
    );
  }
  const fragments = new Map([
    ["github_review_resolution_evidence_pkey", "primary key (evidence_hash)"],
    ["github_review_resolution_evidence_candidate_unique", "unique (recovery_case_id, observed_head_sha, observed_source_tree_hash)"],
    ["github_review_resolution_evidence_payload_check", "setfarm.github-review-resolution-evidence.v1"],
    ["github_review_resolution_evidence_thread_set_check", "jsonb_array_length(thread_ids) >= 1"],
    ["recovery_cases_github_review_resolution_hash_check", "github_review_resolution_evidence_hash ~ '^[a-f0-9]{64}$'::text"],
    ["recovery_cases_github_review_resolution_terminal_check", "jsonb_build_array(github_review_resolution_evidence_hash)"],
  ]);
  for (const [name, fragment] of fragments) {
    if (!normalizeSql(byName.get(name)?.definition ?? "").includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `GitHub review resolution evidence constraint mismatch: ${name}`,
      );
    }
  }
  for (const [name, fragment] of [
    ["github_review_resolution_evidence_recovery_fkey", "foreign key (recovery_case_id, finding_set_hash, packet_hash, contract_slice_hash) references recovery_cases(recovery_case_id, finding_set_hash, packet_hash, slice_hash) on delete restrict"],
    ["github_review_resolution_evidence_dispatch_fkey", "foreign key (recovery_dispatch_id, recovery_case_revision_id) references recovery_revision_dispatches(dispatch_id, revision_id) on delete restrict"],
    ["github_review_resolution_evidence_attempt_fkey", "foreign key (attempt_id) references execution_attempts(attempt_id) on delete restrict"],
    ["github_review_resolution_evidence_finding_fkey", "foreign key (finding_set_hash, run_id, story_id, packet_hash, contract_slice_hash, original_head_sha, original_source_tree_hash) references finding_sets(finding_set_hash, run_id, story_id, packet_hash, slice_hash, source_sha, source_tree_hash) on delete restrict"],
  ] as const) {
    const constraint = byName.get(name);
    if (
      constraint?.contype !== "f"
      || constraint.confdeltype !== "r"
      || !normalizeSql(constraint.definition).includes(fragment)
    ) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `GitHub review resolution evidence FK mismatch: ${name}`,
      );
    }
  }
  const pointerFk = byName.get("recovery_cases_github_review_resolution_fkey");
  if (
    pointerFk?.contype !== "f"
    || pointerFk.confdeltype !== "r"
    || !pointerFk.condeferrable
    || !pointerFk.condeferred
    || !normalizeSql(pointerFk.definition).includes(
      "foreign key (github_review_resolution_evidence_hash) references github_review_resolution_evidence(evidence_hash) on delete restrict deferrable initially deferred",
    )
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "GitHub review resolution recovery pointer FK mismatch",
    );
  }
  const triggers = await sql.unsafe<Array<{ enabled: string; relation: string; definition: string }>>(
    `SELECT t.tgenabled AS enabled, t.tgrelid::regclass::text AS relation,
            pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgname IN (
        'trg_github_review_resolution_evidence_immutable',
        'trg_recovery_cases_github_review_resolution_set_once'
      )`,
  );
  const triggerByRelation = new Map(triggers.map((trigger) => [trigger.relation, trigger]));
  if (
    triggers.length !== 2
    || triggerByRelation.get("github_review_resolution_evidence")?.enabled !== "O"
    || !normalizeSql(triggerByRelation.get("github_review_resolution_evidence")?.definition ?? "")
      .includes("before delete or update on github_review_resolution_evidence")
    || triggerByRelation.get("recovery_cases")?.enabled !== "O"
    || !normalizeSql(triggerByRelation.get("recovery_cases")?.definition ?? "")
      .includes("before update of github_review_resolution_evidence_hash on recovery_cases")
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "GitHub review resolution immutable trigger mismatch",
    );
  }
  const functionRows = await sql.unsafe<Array<{ definition: string | null }>>(
    `SELECT pg_get_functiondef(
       to_regprocedure('setfarm_enforce_github_review_resolution_pointer_set_once()')
     ) AS definition`,
  );
  const functionDefinition = normalizeSql(functionRows[0]?.definition ?? "");
  for (const fragment of [
    "old.github_review_resolution_evidence_hash is distinct from new.github_review_resolution_evidence_hash",
    "old.github_review_resolution_evidence_hash is null",
    "new.github_review_resolution_evidence_hash is not null",
    "setfarm_github_review_resolution_pointer_immutable",
  ]) {
    if (!functionDefinition.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `GitHub review resolution pointer function mismatch: ${fragment}`,
      );
    }
  }
  const rows = await sql.unsafe<Array<{ evidence_hash: string; payload: unknown }>>(
    "SELECT evidence_hash, payload FROM github_review_resolution_evidence ORDER BY evidence_hash",
  );
  for (const row of rows) {
    const payload = migrationObject(row.payload, `GitHub review resolution payload invalid: ${row.evidence_hash}`);
    const { evidenceHash: _evidenceHash, ...withoutHash } = payload;
    if (
      payload.schema !== "setfarm.github-review-resolution-evidence.v1"
      || payload.evidenceHash !== row.evidence_hash
      || hashCanonicalJson(withoutHash) !== row.evidence_hash
    ) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `GitHub review resolution payload hash mismatch: ${row.evidence_hash}`,
      );
    }
  }
}

const V3_PROJECT_TRANSFER_ACK_STATEMENTS = [
  "ALTER TABLE runs ADD COLUMN project_transfer_ack_hash TEXT",
  `ALTER TABLE v3_deploy_receipts
     ADD CONSTRAINT v3_deploy_receipts_transfer_binding_unique
     UNIQUE (receipt_hash, run_id, candidate_hash, packet_hash, source_sha, source_tree_hash)`,
  `CREATE TABLE v3_project_transfer_acks (
    ack_hash TEXT PRIMARY KEY,
    run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE RESTRICT,
    candidate_id TEXT NOT NULL,
    candidate_hash TEXT NOT NULL,
    packet_hash TEXT NOT NULL,
    source_sha TEXT NOT NULL,
    source_tree_hash TEXT NOT NULL,
    deploy_receipt_hash TEXT NOT NULL,
    source_snapshot_hash TEXT NOT NULL,
    project_id TEXT NOT NULL,
    projection_hash TEXT NOT NULL,
    project_record_hash TEXT NOT NULL,
    project_record_ref TEXT NOT NULL,
    persisted_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT v3_project_transfer_acks_hash_check CHECK (ack_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_project_transfer_acks_candidate_id_check CHECK (candidate_id = 'ACPT_' || candidate_hash),
    CONSTRAINT v3_project_transfer_acks_candidate_hash_check CHECK (candidate_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_project_transfer_acks_packet_hash_check CHECK (packet_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_project_transfer_acks_source_sha_check CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT v3_project_transfer_acks_source_tree_hash_check CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    CONSTRAINT v3_project_transfer_acks_receipt_hash_check CHECK (deploy_receipt_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_project_transfer_acks_snapshot_hash_check CHECK (source_snapshot_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_project_transfer_acks_project_id_check CHECK (project_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT v3_project_transfer_acks_projection_hash_check CHECK (projection_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_project_transfer_acks_record_hash_check CHECK (project_record_hash ~ '^[a-f0-9]{64}$'),
    CONSTRAINT v3_project_transfer_acks_record_ref_check CHECK (
      project_record_ref = 'mission-control://projects/' || project_id || '/' || project_record_hash
    ),
    CONSTRAINT v3_project_transfer_acks_payload_check CHECK (
      jsonb_typeof(payload) = 'object'
      AND payload->>'schema' = 'setfarm.v3-project-transfer-ack.v1'
      AND (payload->>'ackVersion')::integer = 1
      AND payload->>'ackHash' = ack_hash
      AND payload->>'runId' = run_id
      AND payload->>'candidateId' = candidate_id
      AND payload->>'candidateHash' = candidate_hash
      AND payload->>'packetHash' = packet_hash
      AND payload->'sourceRevision'->>'sha' = source_sha
      AND payload->'sourceRevision'->>'treeHash' = source_tree_hash
      AND payload->>'deploymentReceiptHash' = deploy_receipt_hash
      AND payload->>'sourceSnapshotHash' = source_snapshot_hash
      AND payload->>'projectId' = project_id
      AND payload->>'projectionHash' = projection_hash
      AND payload->>'projectRecordHash' = project_record_hash
      AND payload->>'projectRecordRef' = project_record_ref
      AND (payload->>'persistedAt')::timestamptz = persisted_at
      AND payload->'projectProjection'->>'id' = project_id
      AND payload->'projectProjection'->>'workflowRunId' = run_id
      AND payload->'projectProjection'->>'acceptedCandidateId' = candidate_id
      AND payload->'projectProjection'->>'acceptedCandidateHash' = candidate_hash
      AND payload->'projectProjection'->>'acceptedPacketHash' = packet_hash
      AND payload->'projectProjection'->>'acceptedSourceSha' = source_sha
      AND payload->'projectProjection'->>'acceptedSourceTreeHash' = source_tree_hash
      AND payload->'projectProjection'->>'deploymentReceiptHash' = deploy_receipt_hash
      AND payload->'projector'->>'service' = 'mission-control'
      AND payload->'projector'->>'protocol' = 'v3'
    ),
    CONSTRAINT v3_project_transfer_acks_candidate_source_fkey
      FOREIGN KEY (candidate_hash, run_id, packet_hash, source_sha, source_tree_hash)
      REFERENCES accepted_candidates(candidate_hash, run_id, packet_hash, source_sha, source_tree_hash)
      ON DELETE RESTRICT,
    CONSTRAINT v3_project_transfer_acks_receipt_source_fkey
      FOREIGN KEY (deploy_receipt_hash, run_id, candidate_hash, packet_hash, source_sha, source_tree_hash)
      REFERENCES v3_deploy_receipts(receipt_hash, run_id, candidate_hash, packet_hash, source_sha, source_tree_hash)
      ON DELETE RESTRICT,
    CONSTRAINT v3_project_transfer_acks_run_packet_fkey
      FOREIGN KEY (run_id, packet_hash)
      REFERENCES product_packets(run_id, packet_hash) ON DELETE RESTRICT,
    CONSTRAINT v3_project_transfer_acks_hash_run_unique UNIQUE (ack_hash, run_id)
  )`,
  `ALTER TABLE runs ADD CONSTRAINT runs_project_transfer_ack_identity_fkey
     FOREIGN KEY (project_transfer_ack_hash, id)
     REFERENCES v3_project_transfer_acks(ack_hash, run_id)
     DEFERRABLE INITIALLY DEFERRED`,
  `CREATE INDEX idx_v3_project_transfer_acks_projection
     ON v3_project_transfer_acks(run_id, project_id, persisted_at, ack_hash)`,
  `CREATE TRIGGER trg_v3_project_transfer_acks_immutable
     BEFORE UPDATE OR DELETE ON v3_project_transfer_acks
     FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
  `CREATE FUNCTION setfarm_enforce_project_transfer_ack_pointer_set_once()
   RETURNS TRIGGER AS $$
   BEGIN
     IF OLD.project_transfer_ack_hash IS DISTINCT FROM NEW.project_transfer_ack_hash
        AND NOT (
          OLD.project_transfer_ack_hash IS NULL
          AND NEW.project_transfer_ack_hash IS NOT NULL
        ) THEN
       RAISE EXCEPTION 'SETFARM_PROJECT_TRANSFER_ACK_POINTER_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER trg_runs_project_transfer_ack_set_once
     BEFORE UPDATE OF project_transfer_ack_hash ON runs
     FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_project_transfer_ack_pointer_set_once()`,
] as const;

const EXPECTED_V3_PROJECT_TRANSFER_ACK_COLUMNS = new Map([
  ["ack_hash", { dataType: "text", nullable: "NO" as const }],
  ["run_id", { dataType: "text", nullable: "NO" as const }],
  ["candidate_id", { dataType: "text", nullable: "NO" as const }],
  ["candidate_hash", { dataType: "text", nullable: "NO" as const }],
  ["packet_hash", { dataType: "text", nullable: "NO" as const }],
  ["source_sha", { dataType: "text", nullable: "NO" as const }],
  ["source_tree_hash", { dataType: "text", nullable: "NO" as const }],
  ["deploy_receipt_hash", { dataType: "text", nullable: "NO" as const }],
  ["source_snapshot_hash", { dataType: "text", nullable: "NO" as const }],
  ["project_id", { dataType: "text", nullable: "NO" as const }],
  ["projection_hash", { dataType: "text", nullable: "NO" as const }],
  ["project_record_hash", { dataType: "text", nullable: "NO" as const }],
  ["project_record_ref", { dataType: "text", nullable: "NO" as const }],
  ["persisted_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
  ["payload", { dataType: "jsonb", nullable: "NO" as const }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
]);

async function detectV3ProjectTransferAckLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const runColumns = await readColumns(sql, "runs");
  const ledger = await relationExists(sql, "v3_project_transfer_acks");
  const indexes = await readNamedIndexes(sql, ["idx_v3_project_transfer_acks_projection"]);
  const hasRunPointer = runColumns.has("project_transfer_ack_hash");
  const functionRows = await sql.unsafe<Array<{ relation: string | null }>>(
    `SELECT to_regprocedure('public.setfarm_enforce_project_transfer_ack_pointer_set_once()')::text AS relation`,
  );
  const fn = Boolean(functionRows[0]?.relation);
  const triggerRows = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count FROM pg_trigger
      WHERE NOT tgisinternal AND tgname IN (
        'trg_v3_project_transfer_acks_immutable',
        'trg_runs_project_transfer_ack_set_once'
      )`,
  );
  const triggers = triggerRows[0]?.count ?? 0;
  if (!hasRunPointer && !ledger && indexes.size === 0 && !fn && triggers === 0) return "absent";
  if (hasRunPointer && ledger && indexes.size === 1 && fn && triggers === 2) return "present";
  return "partial";
}

async function verifyV3ProjectTransferAckLedger(sql: Sql | TransactionSql): Promise<void> {
  const runColumns = await readColumns(sql, "runs");
  const runPointer = runColumns.get("project_transfer_ack_hash");
  if (!runPointer || runPointer.data_type !== "text" || runPointer.is_nullable !== "YES") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "runs project transfer acknowledgement pointer column mismatch",
    );
  }
  await verifyExpectedTableColumns(
    sql,
    "v3_project_transfer_acks",
    EXPECTED_V3_PROJECT_TRANSFER_ACK_COLUMNS,
  );
  const indexes = await readNamedIndexes(sql, ["idx_v3_project_transfer_acks_projection"]);
  if (indexes.get("idx_v3_project_transfer_acks_projection")
    !== "create index idx_v3_project_transfer_acks_projection on public.v3_project_transfer_acks using btree (run_id, project_id, persisted_at, ack_hash)") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "v3 project transfer acknowledgement projection index mismatch",
    );
  }
  const constraintNames = [
    "v3_deploy_receipts_transfer_binding_unique",
    "v3_project_transfer_acks_pkey",
    "v3_project_transfer_acks_run_id_key",
    "v3_project_transfer_acks_run_id_fkey",
    "v3_project_transfer_acks_hash_check",
    "v3_project_transfer_acks_candidate_id_check",
    "v3_project_transfer_acks_candidate_hash_check",
    "v3_project_transfer_acks_packet_hash_check",
    "v3_project_transfer_acks_source_sha_check",
    "v3_project_transfer_acks_source_tree_hash_check",
    "v3_project_transfer_acks_receipt_hash_check",
    "v3_project_transfer_acks_snapshot_hash_check",
    "v3_project_transfer_acks_project_id_check",
    "v3_project_transfer_acks_projection_hash_check",
    "v3_project_transfer_acks_record_hash_check",
    "v3_project_transfer_acks_record_ref_check",
    "v3_project_transfer_acks_payload_check",
    "v3_project_transfer_acks_candidate_source_fkey",
    "v3_project_transfer_acks_receipt_source_fkey",
    "v3_project_transfer_acks_run_packet_fkey",
    "v3_project_transfer_acks_hash_run_unique",
    "runs_project_transfer_ack_identity_fkey",
  ];
  const constraints = await sql.unsafe<Array<{
    conname: string;
    contype: string;
    confdeltype: string;
    condeferrable: boolean;
    condeferred: boolean;
    definition: string;
  }>>(
    `SELECT conname, contype, confdeltype, condeferrable, condeferred,
            pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint WHERE conname = ANY($1::text[])`,
    [constraintNames],
  );
  const byName = new Map(constraints.map((constraint) => [constraint.conname, constraint]));
  if (byName.size !== constraintNames.length) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "v3 project transfer acknowledgement constraints are incomplete",
    );
  }
  const definitions = new Map(constraints.map((row) => [row.conname, normalizeSql(row.definition)]));
  const fragments = new Map([
    ["v3_deploy_receipts_transfer_binding_unique", "unique (receipt_hash, run_id, candidate_hash, packet_hash, source_sha, source_tree_hash)"],
    ["v3_project_transfer_acks_pkey", "primary key (ack_hash)"],
    ["v3_project_transfer_acks_run_id_key", "unique (run_id)"],
    ["v3_project_transfer_acks_hash_check", "ack_hash ~ '^[a-f0-9]{64}$'::text"],
    ["v3_project_transfer_acks_candidate_id_check", "candidate_id = ('acpt_'::text || candidate_hash)"],
    ["v3_project_transfer_acks_record_ref_check", "mission-control://projects/"],
    ["v3_project_transfer_acks_payload_check", "setfarm.v3-project-transfer-ack.v1"],
    ["v3_project_transfer_acks_hash_run_unique", "unique (ack_hash, run_id)"],
  ]);
  for (const [name, fragment] of fragments) {
    if (!definitions.get(name)?.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 project transfer acknowledgement constraint mismatch: ${name}`,
      );
    }
  }
  for (const name of [
    "v3_project_transfer_acks_run_id_fkey",
    "v3_project_transfer_acks_candidate_source_fkey",
    "v3_project_transfer_acks_receipt_source_fkey",
    "v3_project_transfer_acks_run_packet_fkey",
  ]) {
    const constraint = byName.get(name);
    if (!constraint || constraint.contype !== "f" || constraint.confdeltype !== "r" || constraint.condeferrable) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 project transfer acknowledgement FK semantics mismatch: ${name}`,
      );
    }
  }
  const pointer = byName.get("runs_project_transfer_ack_identity_fkey");
  if (!pointer
    || pointer.contype !== "f"
    || !pointer.condeferrable
    || !pointer.condeferred
    || pointer.confdeltype !== "a") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "v3 project transfer acknowledgement pointer FK semantics mismatch",
    );
  }
  const triggers = await sql.unsafe<Array<{ tgname: string; enabled: string; definition: string }>>(
    `SELECT t.tgname, t.tgenabled AS enabled, pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t WHERE NOT t.tgisinternal
        AND t.tgname = ANY($1::text[])`,
    [["trg_v3_project_transfer_acks_immutable", "trg_runs_project_transfer_ack_set_once"]],
  );
  const triggerDefinitions = new Map(triggers.map((trigger) => [
    trigger.tgname,
    { enabled: trigger.enabled, definition: normalizeSql(trigger.definition) },
  ]));
  if (triggerDefinitions.get("trg_v3_project_transfer_acks_immutable")?.enabled !== "O"
    || !triggerDefinitions.get("trg_v3_project_transfer_acks_immutable")?.definition.includes(
      "execute function setfarm_forbid_artifact_identity_update()",
    )
    || triggerDefinitions.get("trg_runs_project_transfer_ack_set_once")?.enabled !== "O"
    || !triggerDefinitions.get("trg_runs_project_transfer_ack_set_once")?.definition.includes(
      "before update of project_transfer_ack_hash on runs",
    )) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "v3 project transfer acknowledgement immutability trigger mismatch",
    );
  }
  const functions = await sql.unsafe<Array<{ definition: string | null }>>(
    `SELECT pg_get_functiondef(
       to_regprocedure('setfarm_enforce_project_transfer_ack_pointer_set_once()')
     ) AS definition`,
  );
  const functionDefinition = normalizeSql(functions[0]?.definition ?? "");
  for (const fragment of [
    "old.project_transfer_ack_hash is distinct from new.project_transfer_ack_hash",
    "old.project_transfer_ack_hash is null",
    "new.project_transfer_ack_hash is not null",
    "setfarm_project_transfer_ack_pointer_immutable",
  ]) {
    if (!functionDefinition.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `v3 project transfer acknowledgement pointer function mismatch: ${fragment}`,
      );
    }
  }
  const rows = await sql.unsafe<Array<{ ack_hash: string; payload: unknown }>>(
    "SELECT ack_hash, payload FROM v3_project_transfer_acks ORDER BY ack_hash",
  );
  for (const row of rows) {
    const payload = migrationObject(row.payload, `Project transfer acknowledgement payload invalid: ${row.ack_hash}`);
    const { ackHash: _ackHash, ...withoutHash } = payload;
    if (payload.schema !== "setfarm.v3-project-transfer-ack.v1"
      || payload.ackHash !== row.ack_hash
      || hashCanonicalJson(withoutHash) !== row.ack_hash) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `Project transfer acknowledgement payload hash mismatch: ${row.ack_hash}`,
      );
    }
  }
}

const RUNTIME_COMPLETION_SUBMISSION_EVIDENCE_STATEMENTS = [
  `ALTER TABLE runtime_completion_requests
     ADD COLUMN source_proposal TEXT,
     ADD COLUMN submission_evidence JSONB,
     ADD CONSTRAINT runtime_completion_requests_submission_evidence_check
       CHECK (
         ((submission_evidence IS NULL) = (source_proposal IS NULL))
         AND (
           submission_evidence IS NULL
           OR (
             jsonb_typeof(submission_evidence) = 'object'
             AND octet_length(source_proposal) BETWEEN 2 AND 524288
           ) IS TRUE
         )
       )`,
  `CREATE FUNCTION setfarm_validate_runtime_completion_submission()
     RETURNS TRIGGER
     LANGUAGE plpgsql
     AS $$
     DECLARE
       native_v3_implementation BOOLEAN;
       parsed_proposal JSONB;
       ignored_item JSONB;
       ignored_path TEXT;
       previous_path TEXT := NULL;
       ignored_path_bytes INTEGER := 0;
     BEGIN
       native_v3_implementation := COALESCE((
         NEW.claim_envelope ->> 'protocol' = 'v3'
         AND NEW.workflow_step_id = 'implement'
       ), FALSE);
       IF native_v3_implementation AND (
         NEW.submission_evidence IS NULL OR NEW.source_proposal IS NULL
       ) THEN
         RAISE EXCEPTION 'RUNTIME_COMPLETION_V3_IMPLEMENTATION_COMPILER_EVIDENCE_REQUIRED'
           USING ERRCODE = '23514';
       END IF;
       IF NOT native_v3_implementation AND (
         NEW.submission_evidence IS NOT NULL OR NEW.source_proposal IS NOT NULL
       ) THEN
         RAISE EXCEPTION 'RUNTIME_COMPLETION_COMPILER_EVIDENCE_NOT_AUTHORIZED'
           USING ERRCODE = '23514';
       END IF;
       IF NEW.submission_evidence IS NULL THEN
         RETURN NEW;
       END IF;
       IF jsonb_typeof(NEW.submission_evidence) IS DISTINCT FROM 'object'
          OR NOT NEW.submission_evidence ?& ARRAY[
            'schema', 'compiler', 'sourceSchema', 'sourceProposalHash',
            'canonicalOutputHash', 'ignoredFieldPaths'
          ]
          OR (NEW.submission_evidence - ARRAY[
            'schema', 'compiler', 'sourceSchema', 'sourceProposalHash',
            'canonicalOutputHash', 'ignoredFieldPaths'
          ]::TEXT[]) <> '{}'::jsonb
          OR NEW.submission_evidence ->> 'schema'
             IS DISTINCT FROM 'setfarm.runtime-completion-submission-evidence.v1'
          OR NEW.submission_evidence ->> 'compiler'
             IS DISTINCT FROM 'setfarm.v3-implementation-output-compilation.v1'
          OR NEW.submission_evidence ->> 'sourceSchema' IS NULL
          OR NEW.submission_evidence ->> 'sourceSchema' NOT IN (
            'setfarm.v3-implementation-agent-proposal.v1',
            'setfarm.v3-implementation-agent-output.v1'
          )
          OR NEW.submission_evidence ->> 'sourceProposalHash' IS NULL
          OR NEW.submission_evidence ->> 'sourceProposalHash' !~ '^[a-f0-9]{64}$'
          OR NEW.submission_evidence ->> 'canonicalOutputHash' IS NULL
          OR NEW.submission_evidence ->> 'canonicalOutputHash' !~ '^[a-f0-9]{64}$'
          OR NEW.submission_evidence ->> 'canonicalOutputHash' IS DISTINCT FROM NEW.output_hash
          OR jsonb_typeof(NEW.submission_evidence -> 'ignoredFieldPaths') IS DISTINCT FROM 'array'
          OR jsonb_array_length(NEW.submission_evidence -> 'ignoredFieldPaths') > 20000
          OR octet_length(NEW.source_proposal) NOT BETWEEN 2 AND 524288
          OR encode(sha256(convert_to(NEW.output, 'UTF8')), 'hex') IS DISTINCT FROM NEW.output_hash
          OR encode(sha256(convert_to(NEW.source_proposal, 'UTF8')), 'hex')
             IS DISTINCT FROM NEW.submission_evidence ->> 'sourceProposalHash'
       THEN
         RAISE EXCEPTION 'RUNTIME_COMPLETION_SUBMISSION_EVIDENCE_INVALID'
           USING ERRCODE = '23514';
       END IF;
       parsed_proposal := NEW.source_proposal::jsonb;
       IF jsonb_typeof(parsed_proposal) IS DISTINCT FROM 'object'
          OR jsonb_typeof(NEW.output::jsonb) IS DISTINCT FROM 'object' THEN
         RAISE EXCEPTION 'RUNTIME_COMPLETION_SUBMISSION_PROPOSAL_JSON_INVALID'
           USING ERRCODE = '23514';
       END IF;
       FOR ignored_item IN
         SELECT value FROM jsonb_array_elements(
           NEW.submission_evidence -> 'ignoredFieldPaths'
         )
       LOOP
         IF jsonb_typeof(ignored_item) IS DISTINCT FROM 'string' THEN
           RAISE EXCEPTION 'RUNTIME_COMPLETION_SUBMISSION_EVIDENCE_PATH_INVALID'
             USING ERRCODE = '23514';
         END IF;
         ignored_path := ignored_item #>> '{}';
         ignored_path_bytes := ignored_path_bytes + octet_length(ignored_path);
         IF octet_length(ignored_path) NOT BETWEEN 1 AND 2000
            OR ignored_path !~ '^/([^~/]|~[01])*(/([^~/]|~[01])*)*$'
            OR (previous_path IS NOT NULL AND ignored_path COLLATE "C" <= previous_path COLLATE "C")
            OR ignored_path_bytes > 131072
         THEN
           RAISE EXCEPTION 'RUNTIME_COMPLETION_SUBMISSION_EVIDENCE_PATH_INVALID'
             USING ERRCODE = '23514';
         END IF;
         previous_path := ignored_path;
       END LOOP;
       RETURN NEW;
     END
     $$`,
  `CREATE FUNCTION setfarm_forbid_runtime_completion_submission_update()
     RETURNS TRIGGER
     LANGUAGE plpgsql
     AS $$
     BEGIN
       IF OLD.submission_evidence IS DISTINCT FROM NEW.submission_evidence
          OR OLD.source_proposal IS DISTINCT FROM NEW.source_proposal
          OR OLD.output IS DISTINCT FROM NEW.output
          OR OLD.output_hash IS DISTINCT FROM NEW.output_hash THEN
         RAISE EXCEPTION 'RUNTIME_COMPLETION_SUBMISSION_EVIDENCE_IMMUTABLE'
           USING ERRCODE = '23514';
       END IF;
       RETURN NEW;
     END
     $$`,
  `CREATE TRIGGER trg_runtime_completion_submission_validate
     BEFORE INSERT OR UPDATE OF
       submission_evidence, source_proposal, output, output_hash, claim_envelope, workflow_step_id
     ON runtime_completion_requests
     FOR EACH ROW EXECUTE FUNCTION setfarm_validate_runtime_completion_submission()`,
  `CREATE TRIGGER trg_runtime_completion_submission_evidence_immutable
     BEFORE UPDATE OF submission_evidence, source_proposal, output, output_hash
     ON runtime_completion_requests
     FOR EACH ROW EXECUTE FUNCTION setfarm_forbid_runtime_completion_submission_update()`,
] as const;

async function detectRuntimeCompletionSubmissionEvidence(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  if (!await relationExists(sql, "runtime_completion_requests")) return "absent";
  const columns = await readColumns(sql, "runtime_completion_requests");
  const hasColumns = columns.has("submission_evidence") && columns.has("source_proposal");
  const relations = await sql.unsafe<Array<{
    validate_trigger_exists: boolean;
    immutable_trigger_exists: boolean;
    validate_function_exists: boolean;
    immutable_function_exists: boolean;
  }>>(
    `SELECT
       EXISTS (
         SELECT 1 FROM pg_trigger
          WHERE tgrelid = to_regclass('public.runtime_completion_requests')
            AND tgname = 'trg_runtime_completion_submission_validate'
            AND NOT tgisinternal
       ) AS validate_trigger_exists,
       EXISTS (
         SELECT 1 FROM pg_trigger
          WHERE tgrelid = to_regclass('public.runtime_completion_requests')
            AND tgname = 'trg_runtime_completion_submission_evidence_immutable'
            AND NOT tgisinternal
       ) AS immutable_trigger_exists,
       to_regprocedure('public.setfarm_validate_runtime_completion_submission()') IS NOT NULL
         AS validate_function_exists,
       to_regprocedure('public.setfarm_forbid_runtime_completion_submission_update()') IS NOT NULL
         AS immutable_function_exists`,
  );
  const states = [
    hasColumns,
    relations[0]?.validate_trigger_exists ?? false,
    relations[0]?.immutable_trigger_exists ?? false,
    relations[0]?.validate_function_exists ?? false,
    relations[0]?.immutable_function_exists ?? false,
  ];
  if (states.every((state) => !state)) return "absent";
  if (states.every(Boolean)) return "present";
  return "partial";
}

async function verifyRuntimeCompletionSubmissionEvidence(
  sql: Sql | TransactionSql,
): Promise<void> {
  const columns = await readColumns(sql, "runtime_completion_requests");
  const evidenceColumn = columns.get("submission_evidence");
  const proposalColumn = columns.get("source_proposal");
  if (
    !evidenceColumn || evidenceColumn.data_type !== "jsonb" || evidenceColumn.is_nullable !== "YES"
    || !proposalColumn || proposalColumn.data_type !== "text" || proposalColumn.is_nullable !== "YES"
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "runtime completion submission evidence column mismatch",
    );
  }
  const constraints = await sql.unsafe<Array<{ definition: string }>>(
    `SELECT pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.runtime_completion_requests'::regclass
        AND conname = 'runtime_completion_requests_submission_evidence_check'`,
  );
  const constraint = normalizeSql(constraints[0]?.definition ?? "");
  for (const fragment of [
    "submission_evidence is null",
    "source_proposal is null",
    "jsonb_typeof(submission_evidence) = 'object'::text",
    "octet_length(source_proposal) >= 2",
    "octet_length(source_proposal) <= 524288",
  ]) {
    if (!constraint.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `runtime completion submission evidence constraint mismatch: ${fragment}`,
      );
    }
  }
  const triggers = await sql.unsafe<Array<{
    name: string;
    enabled: string;
    type_bits: number;
    function_identity: string;
    update_columns: string[];
    definition: string;
  }>>(
    `SELECT t.tgname AS name, t.tgenabled AS enabled,
            t.tgtype::integer AS type_bits,
            t.tgfoid::regprocedure::text AS function_identity,
            ARRAY(
              SELECT a.attname
                FROM unnest(t.tgattr::smallint[]) WITH ORDINALITY AS attribute(attnum, ordinal)
                JOIN pg_attribute a
                  ON a.attrelid = t.tgrelid
                 AND a.attnum = attribute.attnum
               ORDER BY attribute.ordinal
            ) AS update_columns,
            lower(pg_get_triggerdef(t.oid, true)) AS definition
       FROM pg_trigger t
      WHERE t.tgrelid = 'public.runtime_completion_requests'::regclass
        AND t.tgname IN (
          'trg_runtime_completion_submission_validate',
          'trg_runtime_completion_submission_evidence_immutable'
        )
        AND NOT t.tgisinternal`,
  );
  const triggerDefinitions = new Map(triggers.map((trigger) => [trigger.name, trigger]));
  const validationTrigger = triggerDefinitions.get("trg_runtime_completion_submission_validate");
  const immutableTrigger = triggerDefinitions.get("trg_runtime_completion_submission_evidence_immutable");
  const functionName = (value: string | undefined) => value?.replace(/^public\./, "");
  if (validationTrigger?.enabled !== "O"
    || validationTrigger.type_bits !== 23
    || functionName(validationTrigger.function_identity) !== "setfarm_validate_runtime_completion_submission()"
    || JSON.stringify(validationTrigger.update_columns) !== JSON.stringify([
      "submission_evidence",
      "source_proposal",
      "output",
      "output_hash",
      "claim_envelope",
      "workflow_step_id",
    ])
    || immutableTrigger?.enabled !== "O"
    || immutableTrigger.type_bits !== 19
    || functionName(immutableTrigger.function_identity) !== "setfarm_forbid_runtime_completion_submission_update()"
    || JSON.stringify(immutableTrigger.update_columns) !== JSON.stringify([
      "submission_evidence",
      "source_proposal",
      "output",
      "output_hash",
    ])) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "runtime completion submission evidence trigger mismatch",
    );
  }
  const functions = await sql.unsafe<Array<{ name: string; definition: string | null }>>(
    `SELECT name, pg_get_functiondef(to_regprocedure(name || '()')) AS definition
       FROM unnest($1::text[]) AS name`,
    [[
      "setfarm_validate_runtime_completion_submission",
      "setfarm_forbid_runtime_completion_submission_update",
    ]],
  );
  const functionDefinitions = new Map(functions.map((row) => [row.name, normalizeSql(row.definition ?? "")]));
  const validationDefinition = functionDefinitions.get("setfarm_validate_runtime_completion_submission") ?? "";
  const immutableDefinition = functionDefinitions.get("setfarm_forbid_runtime_completion_submission_update") ?? "";
  if (!validationDefinition.includes("runtime_completion_v3_implementation_compiler_evidence_required")
    || !validationDefinition.includes("new.submission_evidence ?& array")
    || !validationDefinition.includes("sha256(convert_to(new.source_proposal, 'utf8'))")
    || !validationDefinition.includes("sha256(convert_to(new.output, 'utf8'))")
    || !validationDefinition.includes("runtime_completion_submission_evidence_path_invalid")
    || !immutableDefinition.includes("old.submission_evidence is distinct from new.submission_evidence")
    || !immutableDefinition.includes("old.source_proposal is distinct from new.source_proposal")
    || !immutableDefinition.includes("old.output is distinct from new.output")
    || !immutableDefinition.includes("runtime_completion_submission_evidence_immutable")) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "runtime completion submission evidence function mismatch",
    );
  }
}

const RECOVERY_TERMINAL_LEASE_STATEMENTS = [
  `ALTER TABLE recovery_dispatch_deliveries
     DROP CONSTRAINT IF EXISTS recovery_dispatch_deliveries_lease_check`,
  `ALTER TABLE recovery_dispatch_deliveries
     ADD CONSTRAINT recovery_dispatch_deliveries_lease_check CHECK (
       (state = 'authorized'
         AND owner_instance_id IS NULL
         AND lease_token IS NULL
         AND lease_expires_at IS NULL)
       OR (state IN ('leased', 'attempt_reserved', 'running')
         AND owner_instance_id IS NOT NULL
         AND lease_token IS NOT NULL
         AND lease_expires_at IS NOT NULL)
       OR (state IN ('succeeded', 'failed', 'blocked', 'superseded')
         AND (
           (owner_instance_id IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)
           OR (owner_instance_id IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
         ))
     )`,
] as const;

async function recoveryDeliveryLeaseConstraint(
  sql: Sql | TransactionSql,
): Promise<Readonly<{ definition: string; expression: string }> | undefined> {
  const rows = await sql.unsafe<Array<{ definition: string; expression: string }>>(
    `SELECT pg_get_constraintdef(oid, true) AS definition,
            pg_get_expr(conbin, conrelid, true) AS expression
       FROM pg_constraint
      WHERE conrelid = to_regclass('public.recovery_dispatch_deliveries')
        AND conname = 'recovery_dispatch_deliveries_lease_check'`,
  );
  return rows[0]?.definition && rows[0]?.expression
    ? Object.freeze({
        definition: normalizeSql(rows[0].definition),
        expression: rows[0].expression,
      })
    : undefined;
}

type RecoveryLeaseConstraintSemantics = "terminal_v2" | "legacy_v1" | "other";

async function recoveryDeliveryLeaseConstraintSemantics(
  sql: Sql | TransactionSql,
  expression: string,
): Promise<RecoveryLeaseConstraintSemantics> {
  const rows = await sql.unsafe<Array<{ state: string; mask: number; allowed: boolean }>>(
    `WITH states(state) AS (
       VALUES
         ('authorized'),
         ('leased'),
         ('attempt_reserved'),
         ('running'),
         ('succeeded'),
         ('failed'),
         ('blocked'),
         ('superseded')
     ), lease_cases AS (
       SELECT state,
              mask,
              CASE WHEN (mask & 4) <> 0 THEN 'owner' END AS owner_instance_id,
              CASE WHEN (mask & 2) <> 0 THEN 'lease-token-123456' END AS lease_token,
              CASE WHEN (mask & 1) <> 0 THEN clock_timestamp() END AS lease_expires_at
         FROM states
         CROSS JOIN generate_series(0, 7) AS mask
     )
     SELECT state, mask, ((${expression}) IS NOT FALSE) AS allowed
       FROM lease_cases
      ORDER BY state, mask`,
  );
  const active = new Set(["leased", "attempt_reserved", "running"]);
  const terminal = new Set(["succeeded", "failed", "blocked", "superseded"]);
  const exact = (version: Exclude<RecoveryLeaseConstraintSemantics, "other">): boolean =>
    rows.length === 64
    && rows.every((row) => {
      const expected = row.state === "authorized"
        ? row.mask === 0
        : active.has(row.state)
          ? row.mask === 7
          : terminal.has(row.state)
            ? version === "terminal_v2"
              ? row.mask === 0 || row.mask === 7
              : row.mask === 7
            : false;
      return row.allowed === expected;
    });
  if (exact("terminal_v2")) return "terminal_v2";
  if (exact("legacy_v1")) return "legacy_v1";
  return "other";
}

async function detectRecoveryTerminalLeaseConstraint(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  if (!await relationExists(sql, "recovery_dispatch_deliveries")) return "absent";
  const constraint = await recoveryDeliveryLeaseConstraint(sql);
  if (!constraint) return "absent";
  const semantics = await recoveryDeliveryLeaseConstraintSemantics(sql, constraint.expression);
  if (semantics === "terminal_v2") return "present";
  if (semantics === "legacy_v1") return "absent";
  return "partial";
}

async function verifyRecoveryTerminalLeaseConstraint(
  sql: Sql | TransactionSql,
): Promise<void> {
  const constraint = await recoveryDeliveryLeaseConstraint(sql);
  const semantics = constraint
    ? await recoveryDeliveryLeaseConstraintSemantics(sql, constraint.expression)
    : "other";
  if (semantics !== "terminal_v2") {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "recovery delivery terminal lease constraint mismatch",
    );
  }
}

const OPERATIONAL_FAILURE_CAUSE_CONSTRAINT =
  "run_termination_requests_operational_failure_cause_check";
const OPERATIONAL_FAILURE_CAUSE_TRIGGER =
  "trg_run_termination_requests_operational_failure_cause_immutable";
const OPERATIONAL_FAILURE_CAUSE_FUNCTION =
  "setfarm_enforce_operational_failure_cause_immutable";
const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_SQL = operationalFailureCauseAuthoritySqlPredicateV1({
  requestedBySql: "requested_by",
  causeSql: "evidence->'operationalFailureCause'",
});
const OPERATIONAL_FAILURE_CAUSE_EVIDENCE_AUTHORITY_SQL =
  operationalFailureCauseEvidenceAuthoritySqlPredicateV1({
    requestedBySql: "requested_by",
    evidenceSql: "evidence",
    causeSql: "evidence->'operationalFailureCause'",
  });

const OPERATIONAL_FAILURE_CAUSE_CONSTRAINT_EXPRESSION = `
       CASE
         WHEN NOT (evidence ? 'operationalFailureCause') THEN TRUE
         WHEN target_status <> 'failed' THEN FALSE
         WHEN jsonb_typeof(evidence->'operationalFailureCause') IS DISTINCT FROM 'object' THEN FALSE
         ELSE
           ((((((evidence->'operationalFailureCause') - 'schema'::text)
             - 'workflowStepId'::text) - 'boundary'::text)
             - 'failureClass'::text) - 'failureCode'::text) = '{}'::jsonb
           AND (evidence->'operationalFailureCause') ?& ARRAY[
             'schema', 'workflowStepId', 'boundary', 'failureClass', 'failureCode'
           ]
           AND jsonb_typeof(evidence->'operationalFailureCause'->'schema') = 'string'
           AND evidence->'operationalFailureCause'->>'schema'
             = 'setfarm.operational-failure-cause.v1'
           AND jsonb_typeof(evidence->'operationalFailureCause'->'workflowStepId') = 'string'
           AND length(evidence->'operationalFailureCause'->>'workflowStepId') BETWEEN 1 AND 100
           AND evidence->'operationalFailureCause'->>'workflowStepId'
             ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
           AND jsonb_typeof(evidence->'operationalFailureCause'->'boundary') = 'string'
           AND length(evidence->'operationalFailureCause'->>'boundary') BETWEEN 1 AND 160
           AND evidence->'operationalFailureCause'->>'boundary'
             ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
           AND jsonb_typeof(evidence->'operationalFailureCause'->'failureClass') = 'string'
           AND evidence->'operationalFailureCause'->>'failureClass' IN (
             'contract_invalid',
             'generated_artifact_invalid',
             'retry_delta_missing',
             'platform_authority_invalid',
             'infrastructure_failure',
             'platform_invariant_failed',
             'recovery_exhausted'
           )
           AND jsonb_typeof(evidence->'operationalFailureCause'->'failureCode') = 'string'
           AND length(evidence->'operationalFailureCause'->>'failureCode') BETWEEN 3 AND 160
           AND evidence->'operationalFailureCause'->>'failureCode'
             ~ '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$'
           AND ${OPERATIONAL_FAILURE_CAUSE_AUTHORITY_SQL}
           AND (${OPERATIONAL_FAILURE_CAUSE_EVIDENCE_AUTHORITY_SQL}) IS TRUE
       END`;

const OPERATIONAL_FAILURE_CAUSE_SEAL_STATEMENTS = [
  `ALTER TABLE run_termination_requests
     ADD CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_CONSTRAINT}
     CHECK (${OPERATIONAL_FAILURE_CAUSE_CONSTRAINT_EXPRESSION})`,
  `CREATE FUNCTION ${OPERATIONAL_FAILURE_CAUSE_FUNCTION}() RETURNS trigger AS $$
   BEGIN
     IF OLD.target_status IS DISTINCT FROM NEW.target_status THEN
       RAISE EXCEPTION 'SETFARM_RUN_TERMINATION_TARGET_STATUS_IMMUTABLE'
         USING ERRCODE = '55000';
     END IF;
     IF OLD.requested_by IS DISTINCT FROM NEW.requested_by THEN
       RAISE EXCEPTION 'SETFARM_RUN_TERMINATION_REQUESTED_BY_IMMUTABLE'
         USING ERRCODE = '55000';
     END IF;
     IF OLD.evidence->'operationalFailureCause'
          IS DISTINCT FROM NEW.evidence->'operationalFailureCause' THEN
       RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_CAUSE_IMMUTABLE'
         USING ERRCODE = '55000';
     END IF;
     IF OLD.requested_by = 'setfarm.product-compiler.deploy-refusal'
          AND OLD.evidence ? 'operationalFailureCause'
          AND (
            OLD.evidence->'schema' IS DISTINCT FROM NEW.evidence->'schema'
            OR OLD.evidence->'authorityCode'
                 IS DISTINCT FROM NEW.evidence->'authorityCode'
          ) THEN
       RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_EVIDENCE_BINDING_IMMUTABLE'
         USING ERRCODE = '55000';
     END IF;
     IF OLD.requested_by = 'setfarm.v3-pre-dispatch'
          AND OLD.evidence ? 'operationalFailureCause'
          AND OLD.evidence->'errorCode' IS DISTINCT FROM NEW.evidence->'errorCode' THEN
       RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_EVIDENCE_BINDING_IMMUTABLE'
         USING ERRCODE = '55000';
     END IF;
     IF OLD.requested_by = 'setfarm-v3-downstream-compiler'
          AND OLD.evidence ? 'operationalFailureCause'
          AND (
            OLD.evidence->'schema' IS DISTINCT FROM NEW.evidence->'schema'
            OR OLD.evidence->'outcome' IS DISTINCT FROM NEW.evidence->'outcome'
            OR OLD.evidence->'terminalReasonCodes'
                 IS DISTINCT FROM NEW.evidence->'terminalReasonCodes'
          ) THEN
       RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_EVIDENCE_BINDING_IMMUTABLE'
         USING ERRCODE = '55000';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `CREATE TRIGGER ${OPERATIONAL_FAILURE_CAUSE_TRIGGER}
     BEFORE UPDATE OF evidence, target_status, requested_by ON run_termination_requests
     FOR EACH ROW EXECUTE FUNCTION ${OPERATIONAL_FAILURE_CAUSE_FUNCTION}()`,
] as const;

async function operationalFailureCauseSealComponents(
  sql: Sql | TransactionSql,
): Promise<Readonly<{
  constraint: Readonly<{ validated: boolean; expression: string }> | undefined;
  trigger: Readonly<{ enabled: string; relation: string; definition: string }> | undefined;
  functionDefinition: string | undefined;
}>> {
  const constraints = await sql.unsafe<Array<{ validated: boolean; expression: string }>>(
    `SELECT convalidated AS validated,
            pg_get_expr(conbin, conrelid, true) AS expression
       FROM pg_constraint
      WHERE conrelid = to_regclass('public.run_termination_requests')
        AND conname = $1`,
    [OPERATIONAL_FAILURE_CAUSE_CONSTRAINT],
  );
  const triggers = await sql.unsafe<Array<{
    enabled: string;
    relation: string;
    definition: string;
  }>>(
    `SELECT t.tgenabled AS enabled,
            t.tgrelid::regclass::text AS relation,
            pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t
      WHERE NOT t.tgisinternal
        AND t.tgname = $1`,
    [OPERATIONAL_FAILURE_CAUSE_TRIGGER],
  );
  const functions = await sql.unsafe<Array<{ definition: string | null }>>(
    `SELECT pg_get_functiondef(
       to_regprocedure('public.${OPERATIONAL_FAILURE_CAUSE_FUNCTION}()')
     ) AS definition`,
  );
  return Object.freeze({
    constraint: constraints[0],
    trigger: triggers[0],
    functionDefinition: functions[0]?.definition ?? undefined,
  });
}

async function canonicalOperationalFailureCauseConstraintExpression(
  sql: Sql | TransactionSql,
): Promise<string | undefined> {
  const inspect = async (connection: Sql | TransactionSql): Promise<string | undefined> => {
    const tableName = "setfarm_operational_failure_cause_constraint_probe";
    const constraintName = "setfarm_operational_failure_cause_constraint_probe_check";
    await connection.unsafe(`DROP TABLE IF EXISTS pg_temp.${tableName}`);
    try {
      await connection.unsafe(
        `CREATE TEMP TABLE ${tableName} (
           requested_by TEXT NOT NULL,
           target_status TEXT NOT NULL,
           evidence JSONB NOT NULL,
           CONSTRAINT ${constraintName}
             CHECK (${OPERATIONAL_FAILURE_CAUSE_CONSTRAINT_EXPRESSION})
         )`,
      );
      const rows = await connection.unsafe<Array<{ expression: string }>>(
        `SELECT pg_get_expr(conbin, conrelid, true) AS expression
           FROM pg_constraint
          WHERE conrelid = to_regclass($1)
            AND conname = $2`,
        [`pg_temp.${tableName}`, constraintName],
      );
      return rows[0]?.expression;
    } finally {
      await connection.unsafe(`DROP TABLE IF EXISTS pg_temp.${tableName}`);
    }
  };
  const rootSql = sql as Sql;
  if (typeof rootSql.begin === "function") {
    return rootSql.begin((transaction) => inspect(transaction)) as unknown as Promise<
      string | undefined
    >;
  }
  return inspect(sql);
}

async function operationalFailureCauseConstraintHasExactSemantics(
  sql: Sql | TransactionSql,
  expression: string,
): Promise<boolean> {
  const canonicalExpression = await canonicalOperationalFailureCauseConstraintExpression(sql);
  if (!canonicalExpression || canonicalExpression !== expression) return false;
  const validCause = {
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: "setup-build",
    boundary: "stitch.converter.generated_tsx",
    failureClass: "generated_artifact_invalid",
    failureCode: "V3_OBSERVABLE_REF_INVALID",
  };
  const causeEvidence = (cause: unknown): Record<string, unknown> => ({
    operationalFailureCause: cause,
  });
  const downstreamEvidence = (
    cause: unknown,
    outcome: "packet_amendment_required" | "bounded_recovery_blocked",
    terminalReasonCodes?: readonly string[],
  ): Record<string, unknown> => ({
    schema: "setfarm.v3-downstream-termination-evidence.v1",
    outcome,
    ...(terminalReasonCodes ? { terminalReasonCodes } : {}),
    operationalFailureCause: cause,
  });
  type VerifierCause = Readonly<{
    schema: "setfarm.operational-failure-cause.v1";
    workflowStepId: string;
    boundary: string;
    failureClass: string;
    failureCode: string;
  }>;
  type VerifierCase = Readonly<{
    label: string;
    requested_by: string;
    target_status: "failed" | "cancelled";
    evidence: Readonly<Record<string, unknown>>;
    expected: boolean;
  }>;
  const evidenceForCause = (
    requestedBy: string,
    cause: VerifierCause,
  ): Readonly<Record<string, unknown>> => {
    if (requestedBy === "setfarm.product-compiler.deploy-refusal") {
      return {
        schema: "setfarm.v3-deploy-authority-termination.v1",
        authorityCode: cause.failureCode,
        operationalFailureCause: cause,
      };
    }
    if (requestedBy === "setfarm.v3-pre-dispatch") {
      return {
        errorCode: cause.failureCode,
        operationalFailureCause: cause,
      };
    }
    if (requestedBy === "setfarm-v3-downstream-compiler") {
      if (cause.failureCode === "V3_DOWNSTREAM_PACKET_AMENDMENT_REQUIRED") {
        return downstreamEvidence(cause, "packet_amendment_required");
      }
      const terminalBinding = V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1.find(
        (candidate) => candidate.failureClass === cause.failureClass
          && candidate.failureCode === cause.failureCode,
      );
      if (!terminalBinding) {
        throw new Error(`OPERATIONAL_FAILURE_CAUSE_VERIFIER_BINDING_MISSING:${cause.failureCode}`);
      }
      return downstreamEvidence(
        cause,
        "bounded_recovery_blocked",
        terminalBinding.reasons,
      );
    }
    return causeEvidence(cause);
  };
  const failureClasses = [
    "contract_invalid",
    "generated_artifact_invalid",
    "retry_delta_missing",
    "platform_authority_invalid",
    "infrastructure_failure",
    "platform_invariant_failed",
    "recovery_exhausted",
  ] as const;
  type AuthorityCoordinate = Readonly<{
    requestedBy: string;
    workflowStepId: string;
    boundary: string;
    failureClass: string;
  }>;
  const coordinateKey = (coordinate: AuthorityCoordinate): string => JSON.stringify([
    coordinate.requestedBy,
    coordinate.workflowStepId,
    coordinate.boundary,
    coordinate.failureClass,
  ]);
  const tupleKey = (coordinate: AuthorityCoordinate, failureCode: string): string =>
    `${coordinateKey(coordinate)}\0${failureCode}`;
  const authorityCoordinates = new Map<string, AuthorityCoordinate>();
  const authorizedTupleKeys = new Set<string>();
  const knownFailureCodes = new Set<string>();
  for (const binding of OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1) {
    for (const workflowStepId of binding.workflowStepIds) {
      const coordinate = {
        requestedBy: binding.requestedBy,
        workflowStepId,
        boundary: binding.boundary,
        failureClass: binding.failureClass,
      };
      authorityCoordinates.set(coordinateKey(coordinate), coordinate);
      for (const failureCode of binding.failureCodes) {
        knownFailureCodes.add(failureCode);
        authorizedTupleKeys.add(tupleKey(coordinate, failureCode));
      }
    }
  }
  const evidenceForAuthorityCoordinate = (
    coordinate: AuthorityCoordinate,
    cause: VerifierCause,
  ): Readonly<Record<string, unknown>> => {
    if (coordinate.requestedBy !== "setfarm-v3-downstream-compiler") {
      return evidenceForCause(coordinate.requestedBy, cause);
    }
    if (cause.failureCode === "V3_DOWNSTREAM_PACKET_AMENDMENT_REQUIRED") {
      return downstreamEvidence(cause, "packet_amendment_required");
    }
    const terminalBinding = V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1.find(
      (candidate) => candidate.failureCode === cause.failureCode,
    );
    return downstreamEvidence(
      cause,
      "bounded_recovery_blocked",
      terminalBinding?.reasons ?? V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1[0]!.reasons,
    );
  };
  const authorityCases: VerifierCase[] = [];
  let authorityTupleIndex = 0;
  for (const [bindingIndex, binding] of OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1.entries()) {
    const representativeCause: VerifierCause = {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: binding.workflowStepIds[0]!,
      boundary: binding.boundary,
      failureClass: binding.failureClass,
      failureCode: binding.failureCodes[0]!,
    };
    const representativeEvidence = evidenceForCause(binding.requestedBy, representativeCause);
    const alternativeClass = failureClasses.find(
      (failureClass) => failureClass !== binding.failureClass,
    )!;
    const representativeMutations: readonly Readonly<{
      label: string;
      requestedBy: string;
      cause: VerifierCause;
    }>[] = [
      {
        label: "requester",
        requestedBy: `${binding.requestedBy}.unauthorized`,
        cause: representativeCause,
      },
      {
        label: "workflow",
        requestedBy: binding.requestedBy,
        cause: { ...representativeCause, workflowStepId: "nonexistent-step" },
      },
      {
        label: "boundary",
        requestedBy: binding.requestedBy,
        cause: { ...representativeCause, boundary: `${binding.boundary}.unauthorized` },
      },
      {
        label: "class",
        requestedBy: binding.requestedBy,
        cause: { ...representativeCause, failureClass: alternativeClass },
      },
    ];
    for (const mutation of representativeMutations) {
      authorityCases.push({
        label: `authority-binding-${bindingIndex}-${mutation.label}-negative`,
        requested_by: mutation.requestedBy,
        target_status: "failed",
        evidence: binding.requestedBy === "setfarm-v3-downstream-compiler"
          ? { ...representativeEvidence, operationalFailureCause: mutation.cause }
          : evidenceForCause(mutation.requestedBy, mutation.cause),
        expected: false,
      });
    }
    for (const workflowStepId of binding.workflowStepIds) {
      for (const failureCode of binding.failureCodes) {
        const cause: VerifierCause = {
          schema: "setfarm.operational-failure-cause.v1",
          workflowStepId,
          boundary: binding.boundary,
          failureClass: binding.failureClass,
          failureCode,
        };
        const evidence = evidenceForCause(binding.requestedBy, cause);
        authorityCases.push({
          label: `authority-tuple-${authorityTupleIndex}-positive`,
          requested_by: binding.requestedBy,
          target_status: "failed",
          evidence,
          expected: true,
        });
        if (binding.requestedBy === "setfarm-v3-downstream-compiler") {
          if (failureCode === "V3_DOWNSTREAM_PACKET_AMENDMENT_REQUIRED") {
            authorityCases.push({
              label: `authority-tuple-${authorityTupleIndex}-negative`,
              requested_by: binding.requestedBy,
              target_status: "failed",
              evidence: downstreamEvidence(
                cause,
                "bounded_recovery_blocked",
                V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1[0]!.reasons,
              ),
              expected: false,
            });
          } else {
            const currentIndex = V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1.findIndex(
              (candidate) => candidate.failureClass === cause.failureClass
                && candidate.failureCode === cause.failureCode,
            );
            for (const [mismatchIndex, mismatchedBinding] of
              V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1.entries()) {
              if (mismatchIndex === currentIndex) continue;
              authorityCases.push({
                label: `authority-tuple-${authorityTupleIndex}-negative-${mismatchIndex}`,
                requested_by: binding.requestedBy,
                target_status: "failed",
                evidence: downstreamEvidence(
                  cause,
                  "bounded_recovery_blocked",
                  mismatchedBinding.reasons,
                ),
                expected: false,
              });
            }
          }
        } else {
          const invalidCause = {
            ...cause,
            failureCode: `${failureCode}_UNAUTHORIZED`,
          };
          authorityCases.push({
            label: `authority-tuple-${authorityTupleIndex}-negative`,
            requested_by: binding.requestedBy,
            target_status: "failed",
            evidence: evidenceForCause(binding.requestedBy, invalidCause),
            expected: false,
          });
        }
        authorityTupleIndex += 1;
      }
    }
  }
  let collisionIndex = 0;
  const sortedKnownFailureCodes = [...knownFailureCodes].sort();
  for (const coordinate of authorityCoordinates.values()) {
    for (const failureCode of sortedKnownFailureCodes) {
      if (authorizedTupleKeys.has(tupleKey(coordinate, failureCode))) continue;
      const cause: VerifierCause = {
        schema: "setfarm.operational-failure-cause.v1",
        workflowStepId: coordinate.workflowStepId,
        boundary: coordinate.boundary,
        failureClass: coordinate.failureClass,
        failureCode,
      };
      authorityCases.push({
        label: `authority-known-code-collision-${collisionIndex}`,
        requested_by: coordinate.requestedBy,
        target_status: "failed",
        evidence: evidenceForAuthorityCoordinate(coordinate, cause),
        expected: false,
      });
      collisionIndex += 1;
    }
  }
  const structuralCases = [
    { label: "absent-failed", requested_by: "untyped.owner", target_status: "failed", evidence: {}, expected: true },
    { label: "absent-cancelled", requested_by: "untyped.owner", target_status: "cancelled", evidence: {}, expected: true },
    { label: "valid-failed", requested_by: "setfarm.step-fail.single", target_status: "failed", evidence: causeEvidence(validCause), expected: true },
    { label: "typed-cancelled", requested_by: "setfarm.step-fail.single", target_status: "cancelled", evidence: causeEvidence(validCause), expected: false },
    { label: "unauthorized-requester", requested_by: "agent-prose-classifier", target_status: "failed", evidence: causeEvidence(validCause), expected: false },
    { label: "unauthorized-code", requested_by: "setfarm.step-fail.single", target_status: "failed", evidence: causeEvidence({ ...validCause, failureCode: "STITCH_GENERATED_TSX_INVALID" }), expected: false },
    {
      label: "deploy-evidence-bound",
      requested_by: "setfarm.product-compiler.deploy-refusal",
      target_status: "failed",
      evidence: {
        schema: "setfarm.v3-deploy-authority-termination.v1",
        authorityCode: "V3_DEPLOY_PACKET_INVALID",
        operationalFailureCause: {
          ...validCause,
          workflowStepId: "deploy",
          boundary: "product_compiler.deploy_authority",
          failureClass: "contract_invalid",
          failureCode: "V3_DEPLOY_PACKET_INVALID",
        },
      },
      expected: true,
    },
    {
      label: "deploy-evidence-mismatch",
      requested_by: "setfarm.product-compiler.deploy-refusal",
      target_status: "failed",
      evidence: {
        schema: "setfarm.v3-deploy-authority-termination.v1",
        authorityCode: "V3_DEPLOY_SOURCE_UNAVAILABLE",
        operationalFailureCause: {
          ...validCause,
          workflowStepId: "deploy",
          boundary: "product_compiler.deploy_authority",
          failureClass: "contract_invalid",
          failureCode: "V3_DEPLOY_PACKET_INVALID",
        },
      },
      expected: false,
    },
    {
      label: "pre-dispatch-normalized-code",
      requested_by: "setfarm.v3-pre-dispatch",
      target_status: "failed",
      evidence: {
        errorCode: "40001",
        operationalFailureCause: {
          ...validCause,
          workflowStepId: "implement",
          boundary: "implementation.pre_dispatch.reservation",
          failureClass: "infrastructure_failure",
          failureCode: "SQLSTATE_40001",
        },
      },
      expected: true,
    },
    {
      label: "pre-dispatch-code-missing",
      requested_by: "setfarm.v3-pre-dispatch",
      target_status: "failed",
      evidence: causeEvidence({
        ...validCause,
        workflowStepId: "implement",
        boundary: "implementation.pre_dispatch.reservation",
        failureClass: "infrastructure_failure",
        failureCode: "SQLSTATE_40001",
      }),
      expected: false,
    },
    {
      label: "pre-dispatch-numeric-code",
      requested_by: "setfarm.v3-pre-dispatch",
      target_status: "failed",
      evidence: {
        errorCode: 40001,
        operationalFailureCause: {
          ...validCause,
          workflowStepId: "implement",
          boundary: "implementation.pre_dispatch.reservation",
          failureClass: "infrastructure_failure",
          failureCode: "SQLSTATE_40001",
        },
      },
      expected: false,
    },
    { label: "null-cause", target_status: "failed", evidence: causeEvidence(null), expected: false },
    { label: "array-cause", target_status: "failed", evidence: causeEvidence([]), expected: false },
    {
      label: "extra-key",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, diagnostic: "volatile" }),
      expected: false,
    },
    {
      label: "missing-key",
      target_status: "failed",
      evidence: causeEvidence({
        schema: validCause.schema,
        workflowStepId: validCause.workflowStepId,
        boundary: validCause.boundary,
        failureClass: validCause.failureClass,
      }),
      expected: false,
    },
    {
      label: "wrong-schema",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, schema: "setfarm.operational-failure-cause.v2" }),
      expected: false,
    },
    {
      label: "workflow-type",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, workflowStepId: 7 }),
      expected: false,
    },
    {
      label: "workflow-grammar",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, workflowStepId: "Setup Build" }),
      expected: false,
    },
    {
      label: "workflow-invented",
      requested_by: "setfarm.v3-stage-input-authority",
      target_status: "failed",
      evidence: causeEvidence({
        ...validCause,
        workflowStepId: "a".repeat(100),
        boundary: "stage_context_assembly",
        failureClass: "contract_invalid",
        failureCode: "V3_STAGE_INPUT_UNRESOLVED",
      }),
      expected: false,
    },
    {
      label: "workflow-stage-canonical",
      requested_by: "setfarm.v3-stage-input-authority",
      target_status: "failed",
      evidence: causeEvidence({
        ...validCause,
        workflowStepId: "verify",
        boundary: "stage_context_assembly",
        failureClass: "contract_invalid",
        failureCode: "V3_STAGE_INPUT_UNRESOLVED",
      }),
      expected: true,
    },
    {
      label: "workflow-too-long",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, workflowStepId: "a".repeat(101) }),
      expected: false,
    },
    {
      label: "boundary-type",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, boundary: false }),
      expected: false,
    },
    {
      label: "boundary-grammar",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, boundary: "stitch/converter" }),
      expected: false,
    },
    {
      label: "boundary-max",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, boundary: "a".repeat(160) }),
      expected: false,
    },
    {
      label: "boundary-too-long",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, boundary: "a".repeat(161) }),
      expected: false,
    },
    {
      label: "class-type",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, failureClass: ["contract_invalid"] }),
      expected: false,
    },
    {
      label: "class-unknown",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, failureClass: "contract_typo" }),
      expected: false,
    },
    {
      label: "class-enum-member",
      requested_by: "setfarm-v3-downstream-compiler",
      target_status: "failed",
      evidence: downstreamEvidence({
        ...validCause,
        workflowStepId: "qa-test",
        boundary: "product_compiler.downstream_recovery",
        failureClass: "recovery_exhausted",
        failureCode: "V3_DOWNSTREAM_RECOVERY_BUDGET_EXHAUSTED",
      }, "bounded_recovery_blocked", ["budget_exhausted"]),
      expected: true,
    },
    {
      label: "downstream-cause-reason-mismatch",
      requested_by: "setfarm-v3-downstream-compiler",
      target_status: "failed",
      evidence: downstreamEvidence({
        ...validCause,
        workflowStepId: "qa-test",
        boundary: "product_compiler.downstream_recovery",
        failureClass: "contract_invalid",
        failureCode: "V3_DOWNSTREAM_SPECIFICATION_INCOMPLETE",
      }, "bounded_recovery_blocked", ["budget_exhausted"]),
      expected: false,
    },
    {
      label: "downstream-schema-missing",
      requested_by: "setfarm-v3-downstream-compiler",
      target_status: "failed",
      evidence: {
        outcome: "bounded_recovery_blocked",
        terminalReasonCodes: ["budget_exhausted"],
        operationalFailureCause: {
          ...validCause,
          workflowStepId: "qa-test",
          boundary: "product_compiler.downstream_recovery",
          failureClass: "recovery_exhausted",
          failureCode: "V3_DOWNSTREAM_RECOVERY_BUDGET_EXHAUSTED",
        },
      },
      expected: false,
    },
    {
      label: "downstream-outcome-missing",
      requested_by: "setfarm-v3-downstream-compiler",
      target_status: "failed",
      evidence: {
        schema: "setfarm.v3-downstream-termination-evidence.v1",
        terminalReasonCodes: ["budget_exhausted"],
        operationalFailureCause: {
          ...validCause,
          workflowStepId: "qa-test",
          boundary: "product_compiler.downstream_recovery",
          failureClass: "recovery_exhausted",
          failureCode: "V3_DOWNSTREAM_RECOVERY_BUDGET_EXHAUSTED",
        },
      },
      expected: false,
    },
    {
      label: "downstream-reasons-missing",
      requested_by: "setfarm-v3-downstream-compiler",
      target_status: "failed",
      evidence: downstreamEvidence({
        ...validCause,
        workflowStepId: "qa-test",
        boundary: "product_compiler.downstream_recovery",
        failureClass: "recovery_exhausted",
        failureCode: "V3_DOWNSTREAM_RECOVERY_BUDGET_EXHAUSTED",
      }, "bounded_recovery_blocked"),
      expected: false,
    },
    {
      label: "downstream-multi-reason",
      requested_by: "setfarm-v3-downstream-compiler",
      target_status: "failed",
      evidence: downstreamEvidence({
        ...validCause,
        workflowStepId: "final-test",
        boundary: "product_compiler.downstream_recovery",
        failureClass: "contract_invalid",
        failureCode: "V3_DOWNSTREAM_TERMINAL_REASON_SET_21",
      }, "bounded_recovery_blocked", ["specification_incomplete", "operator_required"]),
      expected: true,
    },
    {
      label: "downstream-reason-order-drift",
      requested_by: "setfarm-v3-downstream-compiler",
      target_status: "failed",
      evidence: downstreamEvidence({
        ...validCause,
        workflowStepId: "final-test",
        boundary: "product_compiler.downstream_recovery",
        failureClass: "contract_invalid",
        failureCode: "V3_DOWNSTREAM_TERMINAL_REASON_SET_21",
      }, "bounded_recovery_blocked", ["operator_required", "specification_incomplete"]),
      expected: false,
    },
    {
      label: "downstream-packet-amendment",
      requested_by: "setfarm-v3-downstream-compiler",
      target_status: "failed",
      evidence: downstreamEvidence({
        ...validCause,
        workflowStepId: "qa-test",
        boundary: "product_compiler.downstream_recovery",
        failureClass: "contract_invalid",
        failureCode: "V3_DOWNSTREAM_PACKET_AMENDMENT_REQUIRED",
      }, "packet_amendment_required"),
      expected: true,
    },
    {
      label: "code-type",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, failureCode: 1 }),
      expected: false,
    },
    {
      label: "code-grammar",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, failureCode: "INVALID" }),
      expected: false,
    },
    {
      label: "code-min",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, failureCode: "A_B" }),
      expected: false,
    },
    {
      label: "code-max",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, failureCode: `A_${"B".repeat(158)}` }),
      expected: false,
    },
    {
      label: "code-too-long",
      target_status: "failed",
      evidence: causeEvidence({ ...validCause, failureCode: `A_${"B".repeat(159)}` }),
      expected: false,
    },
  ].map((item) => ({
    requested_by: "setfarm.step-fail.single",
    ...item,
  })) as VerifierCase[];
  const cases = [...authorityCases, ...structuralCases];
  const rows = await sql.unsafe<Array<{ label: string; allowed: boolean; expected: boolean }>>(
    `WITH cases AS (
       SELECT label, requested_by, target_status, evidence, expected
         FROM jsonb_to_recordset($1::text::jsonb)
           AS value(label text, requested_by text, target_status text, evidence jsonb, expected boolean)
     )
     SELECT label, ((${expression}) IS NOT FALSE) AS allowed, expected
       FROM cases
      ORDER BY label`,
    [JSON.stringify(cases)],
  );
  return rows.length === cases.length
    && rows.every((row) => row.allowed === row.expected);
}

async function operationalFailureCauseTriggerHasExactSemantics(
  sql: Sql | TransactionSql,
): Promise<boolean> {
  try {
    await sql.unsafe(
      `DO $setfarm_probe$
       DECLARE
         rejected BOOLEAN;
       BEGIN
         DROP TABLE IF EXISTS pg_temp.setfarm_operational_failure_cause_probe;
         CREATE TEMP TABLE setfarm_operational_failure_cause_probe (
           target_status TEXT NOT NULL,
           requested_by TEXT NOT NULL,
           evidence JSONB NOT NULL
         );
         CREATE TRIGGER setfarm_operational_failure_cause_probe_trigger
           BEFORE UPDATE OF evidence, target_status, requested_by
           ON setfarm_operational_failure_cause_probe
           FOR EACH ROW EXECUTE FUNCTION ${OPERATIONAL_FAILURE_CAUSE_FUNCTION}();
         INSERT INTO setfarm_operational_failure_cause_probe
           (target_status, requested_by, evidence)
         VALUES (
           'failed',
           'setfarm.step-fail.single',
           '{"operationalFailureCause":{"schema":"setfarm.operational-failure-cause.v1","workflowStepId":"setup-build","boundary":"stitch.converter.generated_tsx","failureClass":"generated_artifact_invalid","failureCode":"V3_OBSERVABLE_REF_INVALID"}}'::jsonb
         );

         rejected := FALSE;
         BEGIN
           UPDATE setfarm_operational_failure_cause_probe
              SET target_status = 'cancelled';
         EXCEPTION WHEN SQLSTATE '55000' THEN
           IF SQLERRM = 'SETFARM_RUN_TERMINATION_TARGET_STATUS_IMMUTABLE' THEN
             rejected := TRUE;
           ELSE
             RAISE;
           END IF;
         END;
         IF NOT rejected THEN
           RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_CAUSE_TARGET_STATUS_PROBE_FAILED';
         END IF;

         rejected := FALSE;
         BEGIN
           UPDATE setfarm_operational_failure_cause_probe
              SET requested_by = 'agent-prose-classifier';
         EXCEPTION WHEN SQLSTATE '55000' THEN
           IF SQLERRM = 'SETFARM_RUN_TERMINATION_REQUESTED_BY_IMMUTABLE' THEN
             rejected := TRUE;
           ELSE
             RAISE;
           END IF;
         END;
         IF NOT rejected THEN
           RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_CAUSE_REQUESTER_PROBE_FAILED';
         END IF;

         rejected := FALSE;
         BEGIN
           UPDATE setfarm_operational_failure_cause_probe
              SET evidence = jsonb_set(
                evidence,
                '{operationalFailureCause,failureCode}',
                '"V3_OBSERVABLE_SELECTOR_INVALID"'::jsonb
              );
         EXCEPTION WHEN SQLSTATE '55000' THEN
           IF SQLERRM = 'SETFARM_OPERATIONAL_FAILURE_CAUSE_IMMUTABLE' THEN
             rejected := TRUE;
           ELSE
             RAISE;
           END IF;
         END;
         IF NOT rejected THEN
           RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_CAUSE_MUTATION_PROBE_FAILED';
         END IF;

         UPDATE setfarm_operational_failure_cause_probe
            SET evidence = evidence || '{"runtimeSessionCount":0}'::jsonb;
         IF NOT EXISTS (
           SELECT 1
             FROM setfarm_operational_failure_cause_probe
            WHERE evidence->>'runtimeSessionCount' = '0'
         ) THEN
           RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_CAUSE_MERGE_PROBE_FAILED';
         END IF;

         INSERT INTO setfarm_operational_failure_cause_probe
           (target_status, requested_by, evidence)
         VALUES
           (
             'failed',
             'setfarm-v3-downstream-compiler',
             '{"schema":"setfarm.v3-downstream-termination-evidence.v1","outcome":"bounded_recovery_blocked","terminalReasonCodes":["budget_exhausted"],"operationalFailureCause":{"schema":"setfarm.operational-failure-cause.v1","workflowStepId":"qa-test","boundary":"product_compiler.downstream_recovery","failureClass":"recovery_exhausted","failureCode":"V3_DOWNSTREAM_RECOVERY_BUDGET_EXHAUSTED"}}'::jsonb
           ),
           (
             'failed',
             'setfarm.product-compiler.deploy-refusal',
             '{"schema":"setfarm.v3-deploy-authority-termination.v1","authorityCode":"V3_DEPLOY_PACKET_INVALID","operationalFailureCause":{"schema":"setfarm.operational-failure-cause.v1","workflowStepId":"deploy","boundary":"product_compiler.deploy_authority","failureClass":"contract_invalid","failureCode":"V3_DEPLOY_PACKET_INVALID"}}'::jsonb
           ),
           (
             'failed',
             'setfarm.v3-pre-dispatch',
             '{"errorCode":"40001","operationalFailureCause":{"schema":"setfarm.operational-failure-cause.v1","workflowStepId":"implement","boundary":"implementation.pre_dispatch.reservation","failureClass":"infrastructure_failure","failureCode":"SQLSTATE_40001"}}'::jsonb
           );

         rejected := FALSE;
         BEGIN
           UPDATE setfarm_operational_failure_cause_probe
              SET evidence = jsonb_set(evidence, '{terminalReasonCodes}', '["operator_required"]'::jsonb)
            WHERE requested_by = 'setfarm-v3-downstream-compiler';
         EXCEPTION WHEN SQLSTATE '55000' THEN
           IF SQLERRM = 'SETFARM_OPERATIONAL_FAILURE_EVIDENCE_BINDING_IMMUTABLE' THEN
             rejected := TRUE;
           ELSE
             RAISE;
           END IF;
         END;
         IF NOT rejected THEN
           RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_DOWNSTREAM_BINDING_PROBE_FAILED';
         END IF;

         rejected := FALSE;
         BEGIN
           UPDATE setfarm_operational_failure_cause_probe
              SET evidence = jsonb_set(evidence, '{authorityCode}', '"V3_DEPLOY_SOURCE_UNAVAILABLE"'::jsonb)
            WHERE requested_by = 'setfarm.product-compiler.deploy-refusal';
         EXCEPTION WHEN SQLSTATE '55000' THEN
           IF SQLERRM = 'SETFARM_OPERATIONAL_FAILURE_EVIDENCE_BINDING_IMMUTABLE' THEN
             rejected := TRUE;
           ELSE
             RAISE;
           END IF;
         END;
         IF NOT rejected THEN
           RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_DEPLOY_BINDING_PROBE_FAILED';
         END IF;

         rejected := FALSE;
         BEGIN
           UPDATE setfarm_operational_failure_cause_probe
              SET evidence = jsonb_set(evidence, '{errorCode}', '"40P01"'::jsonb)
            WHERE requested_by = 'setfarm.v3-pre-dispatch';
         EXCEPTION WHEN SQLSTATE '55000' THEN
           IF SQLERRM = 'SETFARM_OPERATIONAL_FAILURE_EVIDENCE_BINDING_IMMUTABLE' THEN
             rejected := TRUE;
           ELSE
             RAISE;
           END IF;
         END;
         IF NOT rejected THEN
           RAISE EXCEPTION 'SETFARM_OPERATIONAL_FAILURE_PRE_DISPATCH_BINDING_PROBE_FAILED';
         END IF;
         DROP TABLE setfarm_operational_failure_cause_probe;
       END
       $setfarm_probe$`,
    );
    return true;
  } catch {
    return false;
  }
}

async function detectOperationalFailureCauseSeal(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const components = await operationalFailureCauseSealComponents(sql);
  const presentCount = Number(Boolean(components.constraint))
    + Number(Boolean(components.trigger))
    + Number(Boolean(components.functionDefinition));
  if (presentCount === 0) return "absent";
  return presentCount === 3 ? "present" : "partial";
}

async function verifyOperationalFailureCauseSeal(
  sql: Sql | TransactionSql,
): Promise<void> {
  const components = await operationalFailureCauseSealComponents(sql);
  if (
    !components.constraint?.validated
    || !await operationalFailureCauseConstraintHasExactSemantics(
      sql,
      components.constraint.expression,
    )
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "operational failure cause constraint mismatch",
    );
  }
  const triggerDefinition = normalizeSql(components.trigger?.definition ?? "");
  if (
    components.trigger?.enabled !== "O"
    || components.trigger.relation !== "run_termination_requests"
    || !triggerDefinition.includes(
      "before update of evidence, target_status, requested_by on run_termination_requests",
    )
    || !triggerDefinition.includes(`${OPERATIONAL_FAILURE_CAUSE_FUNCTION}()`)
    || triggerDefinition.includes(" when ")
    || !await operationalFailureCauseTriggerHasExactSemantics(sql)
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "operational failure cause trigger mismatch",
    );
  }
  const functionDefinition = normalizeSql(components.functionDefinition ?? "");
  for (const fragment of [
    "old.target_status is distinct from new.target_status",
    "setfarm_run_termination_target_status_immutable",
    "old.requested_by is distinct from new.requested_by",
    "setfarm_run_termination_requested_by_immutable",
    "old.evidence->'operationalfailurecause'",
    "new.evidence->'operationalfailurecause'",
    "setfarm_operational_failure_cause_immutable",
    "old.requested_by = 'setfarm.product-compiler.deploy-refusal'",
    "old.evidence->'authoritycode'",
    "old.requested_by = 'setfarm.v3-pre-dispatch'",
    "old.evidence->'errorcode'",
    "old.requested_by = 'setfarm-v3-downstream-compiler'",
    "old.evidence->'outcome'",
    "old.evidence->'terminalreasoncodes'",
    "setfarm_operational_failure_evidence_binding_immutable",
  ]) {
    if (!functionDefinition.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `operational failure cause function mismatch: ${fragment}`,
      );
    }
  }
}

const PRODUCT_COMPILATION_ATTEMPT_STATEMENTS = [
  `CREATE TABLE product_compilation_attempts (
    attempt_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE RESTRICT,
    origin_claim_id BIGINT NOT NULL,
    owner_claim_id BIGINT NOT NULL,
    pass_kind TEXT NOT NULL CHECK (pass_kind IN ('design_source_generation')),
    authority_hash TEXT NOT NULL CHECK (authority_hash ~ '^[a-f0-9]{64}$'),
    request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
    ordinal INTEGER NOT NULL CHECK (ordinal IN (1, 2)),
    parent_attempt_id TEXT REFERENCES product_compilation_attempts(attempt_id) ON DELETE RESTRICT,
    parent_failure_artifact_hash TEXT,
    parent_failure_fingerprint TEXT,
    retry_delta_hash TEXT,
    generation INTEGER NOT NULL CHECK (generation > 0),
    fence_token TEXT NOT NULL CHECK (fence_token ~ '^[a-f0-9]{64}$'),
    state TEXT NOT NULL CHECK (state IN ('reserved', 'dispatching', 'sealed', 'quarantined')),
    disposition TEXT CHECK (disposition IN ('accepted', 'rejected', 'infrastructure_failure', 'dispatch_ambiguous')),
    owner_instance_id TEXT,
    lease_token TEXT,
    lease_acquired_at TIMESTAMPTZ,
    lease_expires_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    dispatch_intent_at TIMESTAMPTZ,
    dispatch_started_at TIMESTAMPTZ,
    dispatch_finished_at TIMESTAMPTZ,
    external_operation_id TEXT,
    output_refs JSONB,
    output_seal_hash TEXT,
    failure JSONB,
    failure_artifact_hash TEXT,
    failure_fingerprint TEXT,
    operational_cause_hash TEXT,
    attempt_locator TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT product_compilation_attempt_origin_claim_fkey
      FOREIGN KEY (origin_claim_id) REFERENCES claim_log(id) ON DELETE RESTRICT,
    CONSTRAINT product_compilation_attempt_owner_claim_fkey
      FOREIGN KEY (owner_claim_id) REFERENCES claim_log(id) ON DELETE RESTRICT,
    CONSTRAINT product_compilation_attempt_id_check CHECK (attempt_id ~ '^PCA_[a-f0-9]{64}$'),
    CONSTRAINT product_compilation_attempt_retry_authority_check CHECK (
      (ordinal = 1 AND parent_attempt_id IS NULL AND parent_failure_artifact_hash IS NULL
        AND parent_failure_fingerprint IS NULL AND retry_delta_hash IS NULL)
      OR
      (ordinal = 2 AND parent_attempt_id IS NOT NULL AND parent_failure_artifact_hash ~ '^[a-f0-9]{64}$'
        AND parent_failure_fingerprint ~ '^[a-f0-9]{64}$' AND retry_delta_hash ~ '^[a-f0-9]{64}$')
    ),
    CONSTRAINT product_compilation_attempt_active_lease_check CHECK (
      (state IN ('reserved', 'dispatching')) =
      (owner_instance_id IS NOT NULL AND lease_token IS NOT NULL AND lease_acquired_at IS NOT NULL
        AND lease_expires_at IS NOT NULL AND heartbeat_at IS NOT NULL)
    ),
    CONSTRAINT product_compilation_attempt_lease_order_check CHECK (
      lease_acquired_at IS NULL OR (heartbeat_at >= lease_acquired_at AND lease_expires_at >= heartbeat_at)
    ),
    CONSTRAINT product_compilation_attempt_dispatch_check CHECK (
      (state = 'reserved' AND dispatch_intent_at IS NULL AND dispatch_started_at IS NULL
        AND dispatch_finished_at IS NULL AND external_operation_id IS NULL)
      OR
      (state IN ('dispatching', 'sealed', 'quarantined') AND dispatch_intent_at IS NOT NULL
        AND (dispatch_started_at IS NULL OR dispatch_started_at >= dispatch_intent_at)
        AND (dispatch_finished_at IS NULL OR (dispatch_started_at IS NOT NULL AND dispatch_finished_at >= dispatch_started_at)))
    ),
    CONSTRAINT product_compilation_attempt_terminal_check CHECK (
      (state IN ('reserved', 'dispatching') AND disposition IS NULL AND output_seal_hash IS NULL
        AND output_refs IS NULL AND failure IS NULL AND failure_artifact_hash IS NULL
        AND failure_fingerprint IS NULL AND operational_cause_hash IS NULL)
      OR
      (state = 'sealed' AND disposition = 'accepted' AND output_refs IS NOT NULL
        AND jsonb_typeof(output_refs) = 'object' AND output_seal_hash ~ '^[a-f0-9]{64}$'
        AND failure IS NULL AND failure_artifact_hash IS NULL AND failure_fingerprint IS NULL
        AND operational_cause_hash IS NULL)
      OR
      (state = 'sealed' AND disposition IN ('rejected', 'infrastructure_failure') AND output_refs IS NULL
        AND output_seal_hash ~ '^[a-f0-9]{64}$' AND jsonb_typeof(failure) = 'object'
        AND failure_artifact_hash ~ '^[a-f0-9]{64}$' AND failure_fingerprint ~ '^[a-f0-9]{64}$'
        AND operational_cause_hash ~ '^[a-f0-9]{64}$')
      OR
      (state = 'quarantined' AND disposition = 'dispatch_ambiguous' AND output_refs IS NULL
        AND output_seal_hash ~ '^[a-f0-9]{64}$' AND jsonb_typeof(failure) = 'object'
        AND failure_artifact_hash ~ '^[a-f0-9]{64}$' AND failure_fingerprint ~ '^[a-f0-9]{64}$'
        AND operational_cause_hash ~ '^[a-f0-9]{64}$')
    ),
    CONSTRAINT product_compilation_attempt_locator_check CHECK (
      attempt_locator = '.setfarm/product-compilation-attempts/' || attempt_id
    )
  )`,
  "CREATE UNIQUE INDEX idx_product_compilation_attempt_ordinal ON product_compilation_attempts(run_id, pass_kind, authority_hash, ordinal)",
  "CREATE UNIQUE INDEX idx_product_compilation_attempt_active ON product_compilation_attempts(run_id, pass_kind, authority_hash) WHERE state IN ('reserved', 'dispatching')",
  "CREATE UNIQUE INDEX idx_product_compilation_attempt_accepted ON product_compilation_attempts(run_id, pass_kind, authority_hash) WHERE disposition = 'accepted'",
  "CREATE UNIQUE INDEX idx_product_compilation_attempt_parent ON product_compilation_attempts(parent_attempt_id) WHERE parent_attempt_id IS NOT NULL",
  "CREATE INDEX idx_product_compilation_attempt_lease ON product_compilation_attempts(lease_expires_at) WHERE state IN ('reserved', 'dispatching')",
  "CREATE INDEX idx_product_compilation_attempt_failure ON product_compilation_attempts(failure_fingerprint, authority_hash) WHERE failure_fingerprint IS NOT NULL",
  `CREATE OR REPLACE FUNCTION setfarm_enforce_product_compilation_attempt_transition()
   RETURNS trigger
   LANGUAGE plpgsql
   AS $setfarm$
   BEGIN
     IF TG_OP IN ('INSERT', 'UPDATE') THEN
       PERFORM 1 FROM claim_log WHERE id = NEW.origin_claim_id AND run_id = NEW.run_id;
       IF NOT FOUND THEN
         RAISE EXCEPTION 'SETFARM_PRODUCT_COMPILATION_ORIGIN_CLAIM_MISMATCH' USING ERRCODE = '23503';
       END IF;
       PERFORM 1 FROM claim_log WHERE id = NEW.owner_claim_id AND run_id = NEW.run_id;
       IF NOT FOUND THEN
         RAISE EXCEPTION 'SETFARM_PRODUCT_COMPILATION_OWNER_CLAIM_MISMATCH' USING ERRCODE = '23503';
       END IF;
     END IF;
     IF TG_OP = 'INSERT' THEN
       RETURN NEW;
     END IF;
     IF TG_OP = 'DELETE' THEN
       RAISE EXCEPTION 'SETFARM_PRODUCT_COMPILATION_ATTEMPT_DELETE_FORBIDDEN' USING ERRCODE = '55000';
     END IF;
     IF OLD.state IN ('sealed', 'quarantined') THEN
       RAISE EXCEPTION 'SETFARM_PRODUCT_COMPILATION_ATTEMPT_TERMINAL_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     IF OLD.attempt_id IS DISTINCT FROM NEW.attempt_id
        OR OLD.run_id IS DISTINCT FROM NEW.run_id
        OR OLD.origin_claim_id IS DISTINCT FROM NEW.origin_claim_id
        OR OLD.pass_kind IS DISTINCT FROM NEW.pass_kind
        OR OLD.authority_hash IS DISTINCT FROM NEW.authority_hash
        OR OLD.request_hash IS DISTINCT FROM NEW.request_hash
        OR OLD.ordinal IS DISTINCT FROM NEW.ordinal
        OR OLD.parent_attempt_id IS DISTINCT FROM NEW.parent_attempt_id
        OR OLD.parent_failure_artifact_hash IS DISTINCT FROM NEW.parent_failure_artifact_hash
        OR OLD.parent_failure_fingerprint IS DISTINCT FROM NEW.parent_failure_fingerprint
        OR OLD.retry_delta_hash IS DISTINCT FROM NEW.retry_delta_hash
        OR OLD.generation IS DISTINCT FROM NEW.generation
        OR OLD.fence_token IS DISTINCT FROM NEW.fence_token
        OR OLD.attempt_locator IS DISTINCT FROM NEW.attempt_locator THEN
       RAISE EXCEPTION 'SETFARM_PRODUCT_COMPILATION_ATTEMPT_AUTHORITY_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     IF OLD.dispatch_intent_at IS NOT NULL AND (
       OLD.dispatch_intent_at IS DISTINCT FROM NEW.dispatch_intent_at
       OR OLD.external_operation_id IS DISTINCT FROM NEW.external_operation_id
     ) THEN
       RAISE EXCEPTION 'SETFARM_PRODUCT_COMPILATION_DISPATCH_IDENTITY_IMMUTABLE' USING ERRCODE = '55000';
     END IF;
     IF OLD.state = 'dispatching' AND NEW.state = 'reserved' THEN
       RAISE EXCEPTION 'SETFARM_PRODUCT_COMPILATION_STATE_REGRESSION' USING ERRCODE = '55000';
     END IF;
     RETURN NEW;
   END
   $setfarm$`,
  `CREATE TRIGGER trg_product_compilation_attempt_transition
     BEFORE INSERT OR UPDATE OR DELETE ON product_compilation_attempts
     FOR EACH ROW EXECUTE FUNCTION setfarm_enforce_product_compilation_attempt_transition()`,
] as const;

const EXPECTED_PRODUCT_COMPILATION_ATTEMPT_COLUMNS = new Map([
  ["attempt_id", { dataType: "text", nullable: "NO" as const }],
  ["run_id", { dataType: "text", nullable: "NO" as const }],
  ["origin_claim_id", { dataType: "bigint", nullable: "NO" as const }],
  ["owner_claim_id", { dataType: "bigint", nullable: "NO" as const }],
  ["pass_kind", { dataType: "text", nullable: "NO" as const }],
  ["authority_hash", { dataType: "text", nullable: "NO" as const }],
  ["request_hash", { dataType: "text", nullable: "NO" as const }],
  ["ordinal", { dataType: "integer", nullable: "NO" as const }],
  ["parent_attempt_id", { dataType: "text", nullable: "YES" as const }],
  ["parent_failure_artifact_hash", { dataType: "text", nullable: "YES" as const }],
  ["parent_failure_fingerprint", { dataType: "text", nullable: "YES" as const }],
  ["retry_delta_hash", { dataType: "text", nullable: "YES" as const }],
  ["generation", { dataType: "integer", nullable: "NO" as const }],
  ["fence_token", { dataType: "text", nullable: "NO" as const }],
  ["state", { dataType: "text", nullable: "NO" as const }],
  ["disposition", { dataType: "text", nullable: "YES" as const }],
  ["owner_instance_id", { dataType: "text", nullable: "YES" as const }],
  ["lease_token", { dataType: "text", nullable: "YES" as const }],
  ["lease_acquired_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
  ["lease_expires_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
  ["heartbeat_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
  ["dispatch_intent_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
  ["dispatch_started_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
  ["dispatch_finished_at", { dataType: "timestamp with time zone", nullable: "YES" as const }],
  ["external_operation_id", { dataType: "text", nullable: "YES" as const }],
  ["output_refs", { dataType: "jsonb", nullable: "YES" as const }],
  ["output_seal_hash", { dataType: "text", nullable: "YES" as const }],
  ["failure", { dataType: "jsonb", nullable: "YES" as const }],
  ["failure_artifact_hash", { dataType: "text", nullable: "YES" as const }],
  ["failure_fingerprint", { dataType: "text", nullable: "YES" as const }],
  ["operational_cause_hash", { dataType: "text", nullable: "YES" as const }],
  ["attempt_locator", { dataType: "text", nullable: "NO" as const }],
  ["created_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
  ["updated_at", { dataType: "timestamp with time zone", nullable: "NO" as const }],
]);

const EXPECTED_PRODUCT_COMPILATION_ATTEMPT_INDEXES = new Map([
  ["idx_product_compilation_attempt_ordinal", "create unique index idx_product_compilation_attempt_ordinal on public.product_compilation_attempts using btree (run_id, pass_kind, authority_hash, ordinal)"],
  ["idx_product_compilation_attempt_active", "create unique index idx_product_compilation_attempt_active on public.product_compilation_attempts using btree (run_id, pass_kind, authority_hash) where (state = any (array['reserved'::text, 'dispatching'::text]))"],
  ["idx_product_compilation_attempt_accepted", "create unique index idx_product_compilation_attempt_accepted on public.product_compilation_attempts using btree (run_id, pass_kind, authority_hash) where (disposition = 'accepted'::text)"],
  ["idx_product_compilation_attempt_parent", "create unique index idx_product_compilation_attempt_parent on public.product_compilation_attempts using btree (parent_attempt_id) where (parent_attempt_id is not null)"],
  ["idx_product_compilation_attempt_lease", "create index idx_product_compilation_attempt_lease on public.product_compilation_attempts using btree (lease_expires_at) where (state = any (array['reserved'::text, 'dispatching'::text]))"],
  ["idx_product_compilation_attempt_failure", "create index idx_product_compilation_attempt_failure on public.product_compilation_attempts using btree (failure_fingerprint, authority_hash) where (failure_fingerprint is not null)"],
]);

async function detectProductCompilationAttemptLedger(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const table = await relationExists(sql, "product_compilation_attempts");
  const indexes = await readNamedIndexes(sql, [...EXPECTED_PRODUCT_COMPILATION_ATTEMPT_INDEXES.keys()]);
  const triggers = await sql.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count FROM pg_trigger
      WHERE NOT tgisinternal AND tgname = 'trg_product_compilation_attempt_transition'`,
  );
  const functionPresent = Boolean((await sql.unsafe<Array<{ relation: string | null }>>(
    "SELECT to_regprocedure('setfarm_enforce_product_compilation_attempt_transition()')::text AS relation",
  ))[0]?.relation);
  const presentCount = Number(table) + Number(indexes.size > 0) + Number((triggers[0]?.count ?? 0) > 0) + Number(functionPresent);
  if (presentCount === 0) return "absent";
  return table
    && indexes.size === EXPECTED_PRODUCT_COMPILATION_ATTEMPT_INDEXES.size
    && triggers[0]?.count === 1
    && functionPresent
    ? "present"
    : "partial";
}

async function verifyProductCompilationAttemptLedger(sql: Sql | TransactionSql): Promise<void> {
  await verifyExpectedTableColumns(
    sql,
    "product_compilation_attempts",
    EXPECTED_PRODUCT_COMPILATION_ATTEMPT_COLUMNS,
  );
  const indexes = await readNamedIndexes(sql, [...EXPECTED_PRODUCT_COMPILATION_ATTEMPT_INDEXES.keys()]);
  for (const [name, expected] of EXPECTED_PRODUCT_COMPILATION_ATTEMPT_INDEXES) {
    if (indexes.get(name) !== expected) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `product compilation attempt index mismatch: ${name}`,
      );
    }
  }
  const constraintRows = await sql.unsafe<Array<{ definition: string }>>(
    `SELECT pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.product_compilation_attempts'::regclass`,
  );
  const definitions = constraintRows.map((row) => normalizeSql(row.definition));
  for (const fragment of [
    "foreign key (origin_claim_id) references claim_log(id) on delete restrict",
    "foreign key (owner_claim_id) references claim_log(id) on delete restrict",
    "ordinal = any (array[1, 2])",
    "state = any (array['reserved'::text, 'dispatching'::text, 'sealed'::text, 'quarantined'::text])",
    "attempt_locator = ('.setfarm/product-compilation-attempts/'::text || attempt_id)",
  ]) {
    if (!definitions.some((definition) => definition.includes(fragment))) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `product compilation attempt constraint mismatch: ${fragment}`,
      );
    }
  }
  const triggerRows = await sql.unsafe<Array<{ enabled: string; definition: string }>>(
    `SELECT t.tgenabled AS enabled, pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgname = 'trg_product_compilation_attempt_transition'`,
  );
  const triggerDefinition = normalizeSql(triggerRows[0]?.definition ?? "");
  if (
    triggerRows.length !== 1
    || triggerRows[0]?.enabled !== "O"
    || !triggerDefinition.includes("before insert or delete or update on product_compilation_attempts")
    || !triggerDefinition.includes("setfarm_enforce_product_compilation_attempt_transition()")
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      "product compilation attempt transition trigger mismatch",
    );
  }
  const functionRows = await sql.unsafe<Array<{ definition: string }>>(
    "SELECT pg_get_functiondef('setfarm_enforce_product_compilation_attempt_transition()'::regprocedure) AS definition",
  );
  const functionDefinition = normalizeSql(functionRows[0]?.definition ?? "");
  for (const fragment of [
    "setfarm_product_compilation_attempt_terminal_immutable",
    "setfarm_product_compilation_attempt_authority_immutable",
    "setfarm_product_compilation_dispatch_identity_immutable",
    "setfarm_product_compilation_state_regression",
    "setfarm_product_compilation_origin_claim_mismatch",
    "setfarm_product_compilation_owner_claim_mismatch",
  ]) {
    if (!functionDefinition.includes(fragment)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_ADOPTION_MISMATCH",
        `product compilation attempt transition function mismatch: ${fragment}`,
      );
    }
  }
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "001_execution_attempts",
    statements: [EXECUTION_ATTEMPTS_TABLE_SQL, ...EXECUTION_ATTEMPT_INDEX_SQL],
    detect: async (sql) => await relationExists(sql, "execution_attempts") ? "present" : "absent",
    verify: verifyExecutionAttemptsShape,
  },
  {
    version: 2,
    name: "002_run_protocol_identity",
    statements: RUN_PROTOCOL_STATEMENTS,
    detect: detectRunProtocolShape,
    verify: verifyRunProtocolShape,
  },
  {
    version: 3,
    name: "003_migration_release_attestation",
    statements: MIGRATION_ATTESTATION_STATEMENTS,
    detect: detectMigrationAttestationShape,
    verify: verifyMigrationAttestationShape,
  },
  {
    version: 4,
    name: "004_compiler_preflight_identity",
    statements: COMPILER_PREFLIGHT_IDENTITY_STATEMENTS,
    detect: detectCompilerPreflightIdentity,
    verify: verifyCompilerPreflightIdentity,
  },
  {
    version: 5,
    name: "005_claim_attempt_relational_binding",
    statements: CLAIM_ATTEMPT_BINDING_STATEMENTS,
    detect: detectClaimAttemptBinding,
    verify: verifyClaimAttemptBinding,
  },
  {
    version: 6,
    name: "006_durable_runtime_ownership",
    statements: RUNTIME_OWNERSHIP_STATEMENTS,
    detect: detectRuntimeOwnership,
    verify: verifyRuntimeOwnership,
  },
  {
    version: 7,
    name: "007_manager_owned_completion",
    statements: RUNTIME_COMPLETION_OWNERSHIP_STATEMENTS,
    detect: detectRuntimeCompletionOwnership,
    verify: verifyRuntimeCompletionOwnership,
  },
  {
    version: 8,
    name: "008_runtime_completion_effect_ledger",
    statements: RUNTIME_COMPLETION_EFFECT_LEDGER_STATEMENTS,
    implementationDigest: CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[8],
    apply: applyRuntimeCompletionEffectLedger,
    detect: detectRuntimeCompletionEffectLedger,
    verify: verifyRuntimeCompletionEffectLedger,
  },
  {
    version: 9,
    name: "009_product_artifact_index",
    statements: PRODUCT_ARTIFACT_INDEX_STATEMENTS,
    detect: detectProductArtifactIndex,
    verify: verifyProductArtifactIndex,
  },
  {
    version: 10,
    name: "010_finding_recovery_evidence_ledger",
    statements: FINDING_RECOVERY_LEDGER_STATEMENTS,
    detect: detectFindingRecoveryLedger,
    verify: verifyFindingRecoveryLedger,
  },
  {
    version: 11,
    name: "011_revisioned_recovery_delivery_ledger",
    statements: RECOVERY_DELIVERY_LEDGER_STATEMENTS,
    implementationDigest: CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[11],
    apply: applyRecoveryDeliveryLedger,
    detect: detectRecoveryDeliveryLedger,
    verify: verifyRecoveryDeliveryLedger,
  },
  {
    version: 12,
    name: "012_canonical_operational_event_projection",
    statements: OPERATIONAL_EVENT_PROJECTION_STATEMENTS,
    implementationDigest: CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[12],
    apply: applyOperationalEventProjection,
    detect: detectOperationalEventProjection,
    verify: verifyOperationalEventProjection,
  },
  {
    version: 13,
    name: "013_accepted_candidate_ledger",
    statements: ACCEPTED_CANDIDATE_STATEMENTS,
    detect: detectAcceptedCandidateLedger,
    verify: verifyAcceptedCandidateLedger,
  },
  {
    version: 14,
    name: "014_v3_deploy_receipt_ledger",
    statements: V3_DEPLOY_RECEIPT_STATEMENTS,
    detect: detectV3DeployReceiptLedger,
    verify: verifyV3DeployReceiptLedger,
  },
  {
    version: 15,
    name: "015_v3_release_admission_ledger",
    statements: V3_RELEASE_ADMISSION_STATEMENTS,
    detect: detectV3ReleaseAdmissionLedger,
    verify: verifyV3ReleaseAdmissionLedger,
  },
  {
    version: 16,
    name: "016_v3_preparation_block_ledger",
    statements: V3_PREPARATION_BLOCK_LEDGER_STATEMENTS,
    detect: detectV3PreparationBlockLedger,
    verify: verifyV3PreparationBlockLedger,
  },
  {
    version: 17,
    name: "017_v3_github_review_resolution_evidence",
    statements: V3_GITHUB_REVIEW_RESOLUTION_EVIDENCE_STATEMENTS,
    detect: detectGithubReviewResolutionEvidenceLedger,
    verify: verifyGithubReviewResolutionEvidenceLedger,
  },
  {
    version: 18,
    name: "018_v3_project_transfer_ack_ledger",
    statements: V3_PROJECT_TRANSFER_ACK_STATEMENTS,
    detect: detectV3ProjectTransferAckLedger,
    verify: verifyV3ProjectTransferAckLedger,
  },
  {
    version: 19,
    name: "019_runtime_completion_submission_evidence",
    statements: RUNTIME_COMPLETION_SUBMISSION_EVIDENCE_STATEMENTS,
    detect: detectRuntimeCompletionSubmissionEvidence,
    verify: verifyRuntimeCompletionSubmissionEvidence,
  },
  {
    version: 20,
    name: "020_recovery_terminal_lease_identity",
    statements: RECOVERY_TERMINAL_LEASE_STATEMENTS,
    detect: detectRecoveryTerminalLeaseConstraint,
    verify: verifyRecoveryTerminalLeaseConstraint,
  },
  {
    version: 21,
    name: "021_operational_failure_cause_seal",
    statements: OPERATIONAL_FAILURE_CAUSE_SEAL_STATEMENTS,
    detect: detectOperationalFailureCauseSeal,
    verify: verifyOperationalFailureCauseSeal,
  },
  {
    version: 22,
    name: "022_product_compilation_attempt_ledger",
    statements: PRODUCT_COMPILATION_ATTEMPT_STATEMENTS,
    detect: detectProductCompilationAttemptLedger,
    verify: verifyProductCompilationAttemptLedger,
  },
];

function assertSemanticMigrationDefinitionsAreSourceBound(): void {
  const sourceDigests = new Map<number, string>(
    Object.entries(CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS)
      .map(([version, digest]) => [Number(version), digest]),
  );
  for (const migration of migrations) {
    const expectedDigest = sourceDigests.get(migration.version);
    if (migration.apply && migration.implementationDigest !== expectedDigest) {
      throw new Error(
        `CONTRACT_SPINE_SEMANTIC_MIGRATION_NOT_SOURCE_BOUND:v${migration.version}`,
      );
    }
    if (!migration.apply && expectedDigest !== undefined) {
      throw new Error(
        `CONTRACT_SPINE_SEMANTIC_MIGRATION_APPLY_MISSING:v${migration.version}`,
      );
    }
  }
  for (const version of sourceDigests.keys()) {
    if (!migrations.some((migration) => migration.version === version)) {
      throw new Error(`CONTRACT_SPINE_SEMANTIC_MIGRATION_DEFINITION_MISSING:v${version}`);
    }
  }
}

assertSemanticMigrationDefinitionsAreSourceBound();

export async function readContractSpineMigrationAttestation(
  sql: Sql,
): Promise<Readonly<{
  status: "missing" | "unattested" | "attested";
  versions: number[];
  verifiedReleaseSha: string | null;
}>> {
  if (await detectMigrationAttestationShape(sql) !== "present") {
    return { status: "missing", versions: [], verifiedReleaseSha: null };
  }
  await verifyMigrationAttestationShape(sql);
  const rows = await sql.unsafe<Array<{
    version: number;
    verified_release_sha: string | null;
    verified_at: string | null;
  }>>(
    `SELECT version, verified_release_sha, verified_at
       FROM setfarm_schema_migrations
      ORDER BY version`,
  );
  const versions = rows.map((row) => row.version);
  const releases = new Set(rows.map((row) => row.verified_release_sha).filter(
    (value): value is string => value !== null,
  ));
  const attested = rows.length > 0
    && rows.every((row) => row.verified_release_sha !== null && row.verified_at !== null)
    && releases.size === 1;
  return {
    status: attested ? "attested" : "unattested",
    versions,
    verifiedReleaseSha: attested ? [...releases][0]! : null,
  };
}

async function journalRows(sql: Sql | TransactionSql): Promise<JournalRow[]> {
  if (!await relationExists(sql, "setfarm_schema_migrations")) return [];
  return sql.unsafe<JournalRow[]>(
    "SELECT version, name, checksum, state FROM setfarm_schema_migrations ORDER BY version",
  );
}

export async function planContractSpineMigrations(sql: Sql): Promise<ContractSpineMigrationPlan> {
  const journal = await journalRows(sql);
  const rows = new Map(journal.map((row) => [row.version, row]));
  const knownVersions = new Set(migrations.map((migration) => migration.version));
  const planned: ContractSpineMigrationPlan["migrations"][number][] = [];
  for (const migration of migrations) {
    const expectedChecksum = checksum(migration);
    const row = rows.get(migration.version);
    let state: ContractSpineMigrationPlan["migrations"][number]["state"];
    if (!row) {
      const detected = await migration.detect(sql);
      if (detected === "absent") {
        state = "pending";
      } else if (detected === "partial") {
        state = "adoption_mismatch";
      } else {
        try {
          await migration.verify(sql);
          state = "adoptable";
        } catch (error) {
          if (
            error instanceof ContractSpineMigrationError
            && error.code === "MIGRATION_ADOPTION_MISMATCH"
          ) {
            state = "adoption_mismatch";
          } else {
            throw error;
          }
        }
      }
    } else {
      state = row.name !== migration.name || row.checksum !== expectedChecksum
        ? "checksum_mismatch" as const
        : row.state === "adopted"
          ? "adopted" as const
          : "applied" as const;
    }
    planned.push({
      version: migration.version,
      name: migration.name,
      checksum: expectedChecksum,
      state,
    });
  }
  for (const row of journal) {
    if (knownVersions.has(row.version)) continue;
    planned.push({
      version: row.version,
      name: row.name,
      checksum: row.checksum,
      state: "unexpected",
    });
  }
  planned.sort((left, right) => left.version - right.version);
  const status = planned.some((item) =>
    item.state === "checksum_mismatch"
      || item.state === "adoption_mismatch"
      || item.state === "unexpected")
    ? "drift" as const
    : planned.some((item) => item.state === "pending" || item.state === "adoptable")
      ? "pending" as const
      : "current" as const;
  return {
    schema: "setfarm.contract-spine-migration-plan.v1",
    status,
    migrations: planned,
  };
}

function isLockTimeout(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && error.code === "55P03";
}

export async function applyContractSpineMigrations(
  sql: Sql,
  options: Readonly<{ lockTimeoutMs?: number; statementTimeoutMs?: number; releaseSha?: string }> = {},
): Promise<ContractSpineMigrationApplyResult> {
  if (
    options.releaseSha !== undefined
    && !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(options.releaseSha)
  ) {
    throw new ContractSpineMigrationError(
      "MIGRATION_RELEASE_INVALID",
      "Migration release SHA must be a full lowercase Git object hash",
    );
  }
  const lockTimeoutMs = Math.max(1, Math.min(options.lockTimeoutMs ?? 5_000, 60_000));
  const statementTimeoutMs = Math.max(lockTimeoutMs, Math.min(options.statementTimeoutMs ?? 30_000, 300_000));
  try {
    return await sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT set_config('lock_timeout', $1, true)", [`${lockTimeoutMs}ms`]);
      await transaction.unsafe("SELECT set_config('statement_timeout', $1, true)", [`${statementTimeoutMs}ms`]);
      await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [contractSpineMigrationLockKey]);

      await transaction.unsafe(`
        CREATE TABLE IF NOT EXISTS setfarm_schema_migrations (
          version INTEGER PRIMARY KEY CHECK (version > 0),
          name TEXT NOT NULL UNIQUE,
          checksum TEXT NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
          state TEXT NOT NULL CHECK (state IN ('applied', 'adopted')),
          release_sha TEXT,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const applied: string[] = [];
      const adopted: string[] = [];
      const alreadyApplied: string[] = [];
      const journal = await journalRows(transaction);
      const knownVersions = new Set(migrations.map((migration) => migration.version));
      const unexpected = journal.find((row) => !knownVersions.has(row.version));
      if (unexpected) {
        throw new ContractSpineMigrationError(
          "MIGRATION_UNKNOWN_VERSION",
          `Migration journal contains unknown version ${unexpected.version}`,
        );
      }
      const rows = new Map(journal.map((row) => [row.version, row]));

      for (const migration of migrations) {
        const expectedChecksum = checksum(migration);
        const row = rows.get(migration.version);
        if (row) {
          if (row.name !== migration.name || row.checksum !== expectedChecksum) {
            throw new ContractSpineMigrationError(
              "MIGRATION_CHECKSUM_MISMATCH",
              `Migration ${migration.version} journal checksum or name differs from source`,
            );
          }
          await migration.verify(transaction);
          alreadyApplied.push(migration.name);
          continue;
        }

        const detected = await migration.detect(transaction);
        let state: "applied" | "adopted" = "applied";
        if (detected === "partial") {
          throw new ContractSpineMigrationError(
            "MIGRATION_ADOPTION_MISMATCH",
            `Migration ${migration.version} is partially present`,
          );
        }
        if (detected === "present") {
          await migration.verify(transaction);
          state = "adopted";
          adopted.push(migration.name);
        } else {
          if (migration.apply) {
            await migration.apply(transaction);
          } else {
            for (const statement of migration.statements) {
              await transaction.unsafe(statement);
            }
          }
          await migration.verify(transaction);
          applied.push(migration.name);
        }
        await transaction.unsafe(
          `INSERT INTO setfarm_schema_migrations
             (version, name, checksum, state, release_sha)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            migration.version,
            migration.name,
            expectedChecksum,
            state,
            options.releaseSha ?? null,
          ],
        );
      }

      if (options.releaseSha) {
        await transaction.unsafe(
          `UPDATE setfarm_schema_migrations
              SET verified_release_sha = $1,
                  verified_at = NOW()`,
          [options.releaseSha],
        );
      }

      return {
        schema: "setfarm.contract-spine-migration-apply.v1" as const,
        applied,
        adopted,
        alreadyApplied,
      };
    }) as ContractSpineMigrationApplyResult;
  } catch (error) {
    if (error instanceof ContractSpineMigrationError) throw error;
    if (isLockTimeout(error)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_LOCK_TIMEOUT",
        `Contract spine migration lock was not acquired within ${lockTimeoutMs}ms`,
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * Roll migration 22 back only before it has accepted any compilation attempt.
 * Once evidence exists the ledger is append-only operational truth and must be
 * migrated forward; silently dropping it would recreate the missing-attempt
 * failure mode this migration is designed to remove.
 */
export async function rollbackProductCompilationAttemptLedgerToV21(
  sql: Sql,
  options: Readonly<{
    targetReleaseSha: string;
    lockTimeoutMs?: number;
    statementTimeoutMs?: number;
  }>,
): Promise<ProductCompilationAttemptLedgerRollbackResult> {
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(options.targetReleaseSha)) {
    throw new ContractSpineMigrationError(
      "MIGRATION_RELEASE_INVALID",
      "Rollback target release SHA must be a full lowercase Git object hash",
    );
  }
  const migration = migrations.find((candidate) => candidate.version === 22)!;
  const expectedChecksum = checksum(migration);
  const lockTimeoutMs = Math.max(1, Math.min(options.lockTimeoutMs ?? 5_000, 60_000));
  const statementTimeoutMs = Math.max(
    lockTimeoutMs,
    Math.min(options.statementTimeoutMs ?? 30_000, 300_000),
  );
  try {
    return await sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT set_config('lock_timeout', $1, true)", [`${lockTimeoutMs}ms`]);
      await transaction.unsafe("SELECT set_config('statement_timeout', $1, true)", [`${statementTimeoutMs}ms`]);
      await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [contractSpineMigrationLockKey]);

      const future = await transaction.unsafe<Array<{ version: number }>>(
        "SELECT version FROM setfarm_schema_migrations WHERE version > 22 ORDER BY version LIMIT 1",
      );
      if (future[0]) {
        throw new ContractSpineMigrationError(
          "MIGRATION_UNKNOWN_VERSION",
          `Migration ${future[0].version} must be rolled back before migration 22`,
        );
      }
      const journal = await transaction.unsafe<Array<{
        name: string;
        checksum: string;
        release_sha: string | null;
        applied_at: Date | string;
      }>>(
        `SELECT name, checksum, release_sha, applied_at
           FROM setfarm_schema_migrations
          WHERE version = 22
          FOR UPDATE`,
      );
      if (journal[0]?.name !== migration.name || journal[0]?.checksum !== expectedChecksum) {
        throw new ContractSpineMigrationError(
          "MIGRATION_CHECKSUM_MISMATCH",
          "Migration 22 is absent or differs from the rollback source contract",
        );
      }
      await transaction.unsafe(
        "LOCK TABLE product_compilation_attempts IN ACCESS EXCLUSIVE MODE",
      );
      await verifyProductCompilationAttemptLedger(transaction);
      const counts = await transaction.unsafe<Array<{ count: number }>>(
        "SELECT COUNT(*)::integer AS count FROM product_compilation_attempts",
      );
      if ((counts[0]?.count ?? 0) !== 0) {
        throw new ContractSpineMigrationError(
          "MIGRATION_INCOMPLETE",
          "Migration 22 rollback refuses to erase product-compilation attempt evidence; roll forward instead",
        );
      }
      await transaction.unsafe(
        "DROP TRIGGER trg_product_compilation_attempt_transition ON product_compilation_attempts",
      );
      await transaction.unsafe("DROP FUNCTION setfarm_enforce_product_compilation_attempt_transition()")
      await transaction.unsafe("DROP TABLE product_compilation_attempts");
      for (const retained of migrations.filter((candidate) => candidate.version <= 21)) {
        await retained.verify(transaction);
      }

      await transaction.unsafe(
        `CREATE TABLE IF NOT EXISTS setfarm_schema_migration_rollbacks (
           rollback_id TEXT PRIMARY KEY,
           from_version INTEGER NOT NULL,
           target_version INTEGER NOT NULL,
           target_release_sha TEXT NOT NULL,
           rows_rewritten INTEGER NOT NULL,
           applied_at TIMESTAMPTZ NOT NULL
         )`,
      );
      const appliedAtRows = await transaction.unsafe<Array<{ applied_at: Date | string }>>(
        "SELECT clock_timestamp() AS applied_at",
      );
      const appliedAt = new Date(appliedAtRows[0]!.applied_at);
      const rollbackId = `RBK_${hashCanonicalJson({
        schema: "setfarm.contract-spine-rollback-identity.v1",
        sourceMigration: {
          version: 22,
          name: journal[0]!.name,
          checksum: journal[0]!.checksum,
          releaseSha: journal[0]!.release_sha,
          appliedAt: new Date(journal[0]!.applied_at).toISOString(),
        },
        targetVersion: 21,
        targetReleaseSha: options.targetReleaseSha,
      })}`;
      await transaction.unsafe(
        `INSERT INTO setfarm_schema_migration_rollbacks (
           rollback_id, from_version, target_version, target_release_sha,
           rows_rewritten, applied_at
         ) VALUES ($1, 22, 21, $2, 0, $3)`,
        [rollbackId, options.targetReleaseSha, appliedAt],
      );
      const removed = await transaction.unsafe<Array<{ version: number }>>(
        `DELETE FROM setfarm_schema_migrations
          WHERE version = 22 AND name = $1 AND checksum = $2
          RETURNING version`,
        [migration.name, expectedChecksum],
      );
      if (removed.length !== 1) {
        throw new ContractSpineMigrationError(
          "MIGRATION_CHECKSUM_MISMATCH",
          "Migration 22 journal ownership changed during rollback",
        );
      }
      await transaction.unsafe(
        `UPDATE setfarm_schema_migrations
            SET verified_release_sha = $1, verified_at = $2
          WHERE version <= 21`,
        [options.targetReleaseSha, appliedAt],
      );
      return Object.freeze({
        schema: "setfarm.contract-spine-rollback.v1" as const,
        rollbackId,
        fromVersion: 22 as const,
        targetVersion: 21 as const,
        targetReleaseSha: options.targetReleaseSha,
        rowsRewritten: 0 as const,
        appliedAt: appliedAt.toISOString(),
      });
    }) as ProductCompilationAttemptLedgerRollbackResult;
  } catch (error) {
    if (error instanceof ContractSpineMigrationError) throw error;
    if (isLockTimeout(error)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_LOCK_TIMEOUT",
        `Migration 22 rollback lock was not acquired within ${lockTimeoutMs}ms`,
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * Remove only the v21 database enforcement so a v20 binary can start without
 * seeing an unknown migration journal entry. Existing typed causes remain in
 * evidence: v20 readers already treat evidence as an extensible JSON object.
 * Services must be stopped while this runs; the access-exclusive table lock
 * serializes every evidence/target-status writer for the rollback transaction.
 */
export async function rollbackOperationalFailureCauseSealToV20(
  sql: Sql,
  options: Readonly<{
    targetReleaseSha: string;
    lockTimeoutMs?: number;
    statementTimeoutMs?: number;
  }>,
): Promise<OperationalFailureCauseSealRollbackResult> {
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(options.targetReleaseSha)) {
    throw new ContractSpineMigrationError(
      "MIGRATION_RELEASE_INVALID",
      "Rollback target release SHA must be a full lowercase Git object hash",
    );
  }
  const migration = migrations.find((candidate) => candidate.version === 21)!;
  const expectedChecksum = checksum(migration);
  const lockTimeoutMs = Math.max(1, Math.min(options.lockTimeoutMs ?? 5_000, 60_000));
  const statementTimeoutMs = Math.max(
    lockTimeoutMs,
    Math.min(options.statementTimeoutMs ?? 30_000, 300_000),
  );
  try {
    return await sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT set_config('lock_timeout', $1, true)", [`${lockTimeoutMs}ms`]);
      await transaction.unsafe("SELECT set_config('statement_timeout', $1, true)", [`${statementTimeoutMs}ms`]);
      await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [contractSpineMigrationLockKey]);

      const future = await transaction.unsafe<Array<{ version: number }>>(
        "SELECT version FROM setfarm_schema_migrations WHERE version > 21 ORDER BY version LIMIT 1",
      );
      if (future[0]) {
        throw new ContractSpineMigrationError(
          "MIGRATION_UNKNOWN_VERSION",
          `Migration ${future[0].version} must be rolled back before migration 21`,
        );
      }
      const journal = await transaction.unsafe<Array<{
        name: string;
        checksum: string;
        release_sha: string | null;
        applied_at: Date | string;
      }>>(
        `SELECT name, checksum, release_sha, applied_at
           FROM setfarm_schema_migrations
          WHERE version = 21
          FOR UPDATE`,
      );
      if (
        journal[0]?.name !== migration.name
        || journal[0]?.checksum !== expectedChecksum
      ) {
        throw new ContractSpineMigrationError(
          "MIGRATION_CHECKSUM_MISMATCH",
          "Migration 21 is absent or differs from the rollback source contract",
        );
      }
      const sourceRows = await transaction.unsafe<Array<{
        version: number;
        name: string;
        checksum: string;
      }>>(
        `SELECT version, name, checksum
           FROM setfarm_schema_migrations
          WHERE version <= 21
          ORDER BY version`,
      );
      const sourceByVersion = new Map(sourceRows.map((row) => [row.version, row]));
      for (const expected of migrations.filter((candidate) => candidate.version <= 21)) {
        const actual = sourceByVersion.get(expected.version);
        if (
          actual?.name !== expected.name
          || actual.checksum !== checksum(expected)
        ) {
          throw new ContractSpineMigrationError(
            "MIGRATION_CHECKSUM_MISMATCH",
            `Migration ${expected.version} source chain differs from the rollback contract`,
          );
        }
      }

      await transaction.unsafe(
        "LOCK TABLE run_termination_requests IN ACCESS EXCLUSIVE MODE",
      );
      await verifyOperationalFailureCauseSeal(transaction);
      await transaction.unsafe(
        `DROP TRIGGER ${OPERATIONAL_FAILURE_CAUSE_TRIGGER} ON run_termination_requests`,
      );
      await transaction.unsafe(`DROP FUNCTION ${OPERATIONAL_FAILURE_CAUSE_FUNCTION}()`);
      await transaction.unsafe(
        `ALTER TABLE run_termination_requests
           DROP CONSTRAINT ${OPERATIONAL_FAILURE_CAUSE_CONSTRAINT}`,
      );
      for (const retained of migrations.filter((candidate) => candidate.version <= 20)) {
        await retained.verify(transaction);
      }

      await transaction.unsafe(
        `CREATE TABLE IF NOT EXISTS setfarm_schema_migration_rollbacks (
           rollback_id TEXT PRIMARY KEY,
           from_version INTEGER NOT NULL,
           target_version INTEGER NOT NULL,
           target_release_sha TEXT NOT NULL,
           rows_rewritten INTEGER NOT NULL,
           applied_at TIMESTAMPTZ NOT NULL
         )`,
      );
      const appliedAtRows = await transaction.unsafe<Array<{ applied_at: Date | string }>>(
        "SELECT clock_timestamp() AS applied_at",
      );
      const appliedAt = new Date(appliedAtRows[0]!.applied_at);
      const rollbackId = `RBK_${hashCanonicalJson({
        schema: "setfarm.contract-spine-rollback-identity.v1",
        sourceMigration: {
          version: 21,
          name: journal[0]!.name,
          checksum: journal[0]!.checksum,
          releaseSha: journal[0]!.release_sha,
          appliedAt: new Date(journal[0]!.applied_at).toISOString(),
        },
        targetVersion: 20,
        targetReleaseSha: options.targetReleaseSha,
      })}`;
      await transaction.unsafe(
        `INSERT INTO setfarm_schema_migration_rollbacks (
           rollback_id, from_version, target_version, target_release_sha,
           rows_rewritten, applied_at
         ) VALUES ($1, 21, 20, $2, 0, $3)`,
        [rollbackId, options.targetReleaseSha, appliedAt],
      );
      const removed = await transaction.unsafe<Array<{ version: number }>>(
        `DELETE FROM setfarm_schema_migrations
          WHERE version = 21 AND name = $1 AND checksum = $2
          RETURNING version`,
        [migration.name, expectedChecksum],
      );
      if (removed.length !== 1) {
        throw new ContractSpineMigrationError(
          "MIGRATION_CHECKSUM_MISMATCH",
          "Migration 21 journal ownership changed during rollback",
        );
      }
      await transaction.unsafe(
        `UPDATE setfarm_schema_migrations
            SET verified_release_sha = $1, verified_at = $2
          WHERE version <= 20`,
        [options.targetReleaseSha, appliedAt],
      );
      return Object.freeze({
        schema: "setfarm.contract-spine-rollback.v1" as const,
        rollbackId,
        fromVersion: 21 as const,
        targetVersion: 20 as const,
        targetReleaseSha: options.targetReleaseSha,
        rowsRewritten: 0 as const,
        appliedAt: appliedAt.toISOString(),
      });
    }) as OperationalFailureCauseSealRollbackResult;
  } catch (error) {
    if (error instanceof ContractSpineMigrationError) throw error;
    if (isLockTimeout(error)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_LOCK_TIMEOUT",
        `Migration 21 rollback lock was not acquired within ${lockTimeoutMs}ms`,
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * Prepare the database for a binary rollback from migration 20 to the v19
 * reader contract. Services must be stopped: the table locks and active-owner
 * proof make that operational precondition enforceable instead of advisory.
 *
 * Migration 20 permits terminal delivery rows to clear live lease identity.
 * The v19/V1 reader requires those three columns on every non-authorized row,
 * so this one-shot rollback restores an explicit synthetic historical marker,
 * reinstalls the exact legacy constraint, removes only journal entry 20, and
 * re-attests versions 1-19 to the target binary SHA.
 */
export async function rollbackRecoveryTerminalLeaseIdentityToV19(
  sql: Sql,
  options: Readonly<{
    targetReleaseSha: string;
    lockTimeoutMs?: number;
    statementTimeoutMs?: number;
  }>,
): Promise<RecoveryTerminalLeaseRollbackResult> {
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(options.targetReleaseSha)) {
    throw new ContractSpineMigrationError(
      "MIGRATION_RELEASE_INVALID",
      "Rollback target release SHA must be a full lowercase Git object hash",
    );
  }
  const migration = migrations.find((candidate) => candidate.version === 20)!;
  const expectedChecksum = checksum(migration);
  const lockTimeoutMs = Math.max(1, Math.min(options.lockTimeoutMs ?? 5_000, 60_000));
  const statementTimeoutMs = Math.max(
    lockTimeoutMs,
    Math.min(options.statementTimeoutMs ?? 30_000, 300_000),
  );
  try {
    return await sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT set_config('lock_timeout', $1, true)", [`${lockTimeoutMs}ms`]);
      await transaction.unsafe("SELECT set_config('statement_timeout', $1, true)", [`${statementTimeoutMs}ms`]);
      await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [contractSpineMigrationLockKey]);

      const future = await transaction.unsafe<Array<{ version: number }>>(
        "SELECT version FROM setfarm_schema_migrations WHERE version > 20 ORDER BY version LIMIT 1",
      );
      if (future[0]) {
        throw new ContractSpineMigrationError(
          "MIGRATION_UNKNOWN_VERSION",
          `Migration ${future[0].version} must be rolled back before migration 20`,
        );
      }

      const journal = await transaction.unsafe<Array<{
        name: string;
        checksum: string;
        release_sha: string | null;
        applied_at: Date | string;
      }>>(
        `SELECT name, checksum, release_sha, applied_at
           FROM setfarm_schema_migrations
          WHERE version = 20
          FOR UPDATE`,
      );
      if (
        journal[0]?.name !== migration.name
        || journal[0]?.checksum !== expectedChecksum
      ) {
        throw new ContractSpineMigrationError(
          "MIGRATION_CHECKSUM_MISMATCH",
          "Migration 20 is absent or differs from the rollback source contract",
        );
      }

      await transaction.unsafe(
        "LOCK TABLE runs, runtime_sessions, execution_attempts, claim_log, run_termination_requests IN SHARE MODE",
      );
      await transaction.unsafe(
        "LOCK TABLE recovery_dispatch_deliveries IN ACCESS EXCLUSIVE MODE",
      );
      const active = await transaction.unsafe<Array<{
        active_runs: number;
        active_runtimes: number;
        active_attempts: number;
        active_claims: number;
        active_terminations: number;
        active_deliveries: number;
      }>>(
        `SELECT
           (SELECT COUNT(*)::integer FROM runs
             WHERE status IN ('running', 'resuming', 'cancelling', 'failing')) AS active_runs,
           (SELECT COUNT(*)::integer FROM runtime_sessions
             WHERE state <> 'released') AS active_runtimes,
           (SELECT COUNT(*)::integer FROM execution_attempts
             WHERE disposition IN ('claimed', 'running')) AS active_attempts,
           (SELECT COUNT(*)::integer FROM claim_log
             WHERE outcome IS NULL) AS active_claims,
           (SELECT COUNT(*)::integer FROM run_termination_requests
             WHERE state <> 'terminalized') AS active_terminations,
           (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries
             WHERE state IN ('authorized', 'leased', 'attempt_reserved', 'running')) AS active_deliveries`,
      );
      const owners = active[0]!;
      if (Object.values(owners).some((count) => count > 0)) {
        throw new ContractSpineMigrationError(
          "MIGRATION_INCOMPLETE",
          `Migration 20 rollback requires zero active owners: ${JSON.stringify(owners)}`,
        );
      }
      await verifyRecoveryTerminalLeaseConstraint(transaction);

      const unsupported = await transaction.unsafe<Array<{ dispatch_id: string }>>(
        `SELECT dispatch_id
           FROM recovery_dispatch_deliveries
          WHERE state IN ('succeeded', 'failed', 'blocked', 'superseded')
            AND owner_instance_id IS NULL
            AND lease_token IS NULL
            AND lease_expires_at IS NULL
            AND (
              terminal_at IS NULL
              OR terminal_result->>'schema' IS DISTINCT FROM 'setfarm.run-terminal-recovery-chain.v1'
            )
          ORDER BY dispatch_id
          LIMIT 1`,
      );
      if (unsupported[0]) {
        throw new ContractSpineMigrationError(
          "MIGRATION_ADOPTION_MISMATCH",
          `Terminal delivery ${unsupported[0].dispatch_id} lacks rollback-compatible provenance`,
        );
      }

      const rewritten = await transaction.unsafe<Array<{ dispatch_id: string }>>(
        `UPDATE recovery_dispatch_deliveries
            SET owner_instance_id = 'setfarm-v19-rollback',
                lease_token = 'ROLLBACK_' || substring(md5(dispatch_id), 1, 32),
                lease_expires_at = COALESCE(terminal_at, updated_at)
          WHERE state IN ('succeeded', 'failed', 'blocked', 'superseded')
            AND owner_instance_id IS NULL
            AND lease_token IS NULL
            AND lease_expires_at IS NULL
          RETURNING dispatch_id`,
      );
      await transaction.unsafe(
        "ALTER TABLE recovery_dispatch_deliveries DROP CONSTRAINT recovery_dispatch_deliveries_lease_check",
      );
      await transaction.unsafe(
        `ALTER TABLE recovery_dispatch_deliveries
           ADD CONSTRAINT recovery_dispatch_deliveries_lease_check CHECK (
             (state = 'authorized'
               AND owner_instance_id IS NULL
               AND lease_token IS NULL
               AND lease_expires_at IS NULL)
             OR (state <> 'authorized'
               AND owner_instance_id IS NOT NULL
               AND lease_token IS NOT NULL
               AND lease_expires_at IS NOT NULL)
           )`,
      );
      const legacyConstraint = await recoveryDeliveryLeaseConstraint(transaction);
      if (
        !legacyConstraint
        || await recoveryDeliveryLeaseConstraintSemantics(
          transaction,
          legacyConstraint.expression,
        ) !== "legacy_v1"
      ) {
        throw new ContractSpineMigrationError(
          "MIGRATION_ADOPTION_MISMATCH",
          "Migration 20 rollback did not restore the legacy lease constraint",
        );
      }

      await transaction.unsafe(
        `CREATE TABLE IF NOT EXISTS setfarm_schema_migration_rollbacks (
           rollback_id TEXT PRIMARY KEY,
           from_version INTEGER NOT NULL,
           target_version INTEGER NOT NULL,
           target_release_sha TEXT NOT NULL,
           rows_rewritten INTEGER NOT NULL,
           applied_at TIMESTAMPTZ NOT NULL
         )`,
      );
      const appliedAtRows = await transaction.unsafe<Array<{ applied_at: Date | string }>>(
        "SELECT clock_timestamp() AS applied_at",
      );
      const appliedAt = new Date(appliedAtRows[0]!.applied_at);
      const rollbackId = `RBK_${hashCanonicalJson({
        schema: "setfarm.contract-spine-rollback-identity.v1",
        sourceMigration: {
          version: 20,
          name: journal[0]!.name,
          checksum: journal[0]!.checksum,
          releaseSha: journal[0]!.release_sha,
          appliedAt: new Date(journal[0]!.applied_at).toISOString(),
        },
        targetVersion: 19,
        targetReleaseSha: options.targetReleaseSha,
      })}`;
      await transaction.unsafe(
        `INSERT INTO setfarm_schema_migration_rollbacks (
           rollback_id, from_version, target_version, target_release_sha,
           rows_rewritten, applied_at
         ) VALUES ($1, 20, 19, $2, $3, $4)`,
        [rollbackId, options.targetReleaseSha, rewritten.length, appliedAt],
      );
      const removed = await transaction.unsafe<Array<{ version: number }>>(
        `DELETE FROM setfarm_schema_migrations
          WHERE version = 20 AND name = $1 AND checksum = $2
          RETURNING version`,
        [migration.name, expectedChecksum],
      );
      if (removed.length !== 1) {
        throw new ContractSpineMigrationError(
          "MIGRATION_CHECKSUM_MISMATCH",
          "Migration 20 journal ownership changed during rollback",
        );
      }
      await transaction.unsafe(
        `UPDATE setfarm_schema_migrations
            SET verified_release_sha = $1, verified_at = $2
          WHERE version <= 19`,
        [options.targetReleaseSha, appliedAt],
      );
      return Object.freeze({
        schema: "setfarm.contract-spine-rollback.v1" as const,
        rollbackId,
        fromVersion: 20 as const,
        targetVersion: 19 as const,
        targetReleaseSha: options.targetReleaseSha,
        rowsRewritten: rewritten.length,
        appliedAt: appliedAt.toISOString(),
      });
    }) as RecoveryTerminalLeaseRollbackResult;
  } catch (error) {
    if (error instanceof ContractSpineMigrationError) throw error;
    if (isLockTimeout(error)) {
      throw new ContractSpineMigrationError(
        "MIGRATION_LOCK_TIMEOUT",
        `Migration 20 rollback lock was not acquired within ${lockTimeoutMs}ms`,
        { cause: error },
      );
    }
    throw error;
  }
}

export async function verifyContractSpineMigrations(
  sql: Sql,
): Promise<Readonly<{
  schema: "setfarm.contract-spine-migration-verify.v1";
  status: "verified";
  migrations: ContractSpineMigrationPlan["migrations"];
}>> {
  const plan = await planContractSpineMigrations(sql);
  const unexpected = plan.migrations.find((migration) => migration.state === "unexpected");
  if (unexpected) {
    throw new ContractSpineMigrationError(
      "MIGRATION_UNKNOWN_VERSION",
      `Migration journal contains unknown version ${unexpected.version}`,
    );
  }
  const mismatch = plan.migrations.find((migration) => migration.state === "checksum_mismatch");
  if (mismatch) {
    throw new ContractSpineMigrationError(
      "MIGRATION_CHECKSUM_MISMATCH",
      `Migration ${mismatch.version} journal checksum or name differs from source`,
    );
  }
  const adoptionMismatch = plan.migrations.find((migration) => migration.state === "adoption_mismatch");
  if (adoptionMismatch) {
    throw new ContractSpineMigrationError(
      "MIGRATION_ADOPTION_MISMATCH",
      `Migration ${adoptionMismatch.version} existing relation does not match the expected shape`,
    );
  }
  const pending = plan.migrations.find((migration) =>
    migration.state === "pending" || migration.state === "adoptable");
  if (pending) {
    throw new ContractSpineMigrationError(
      "MIGRATION_INCOMPLETE",
      `Migration ${pending.version} is pending`,
    );
  }
  for (const migration of migrations) await migration.verify(sql);
  return {
    schema: "setfarm.contract-spine-migration-verify.v1",
    status: "verified",
    migrations: plan.migrations,
  };
}
