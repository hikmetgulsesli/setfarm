import { createHash } from "node:crypto";

import type postgres from "postgres";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export const contractSpineMigrationLockKey = 1_397_117_251;

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

type Migration = Readonly<{
  version: number;
  name: string;
  statements: readonly string[];
  detect(sql: Sql | TransactionSql): Promise<"absent" | "present" | "partial">;
  verify(sql: Sql | TransactionSql): Promise<void>;
}>;

function checksum(migration: Migration): string {
  return createHash("sha256")
    .update(JSON.stringify({
      version: migration.version,
      name: migration.name,
      statements: migration.statements,
    }))
    .digest("hex");
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
  if (actualColumns.size !== expectedAttemptColumns.size) {
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
  if (actualIndexes.size !== expectedAttemptIndexes.size) {
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
  if (normalizedConstraints.length !== requiredConstraintFragments.length) {
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
];

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
          for (const statement of migration.statements) {
            await transaction.unsafe(statement);
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
