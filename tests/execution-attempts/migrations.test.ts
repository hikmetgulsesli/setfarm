import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  contractSpineMigrationLockKey,
  readContractSpineMigrationAttestation,
  planContractSpineMigrations,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

describe("contract spine migration journal", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
  });

  it("rejects a live or non-isolated URL before a test connection can open", async () => {
    const guardedDb = await import(`../../src/db-pg.ts?url-guard=${Date.now()}`);
    assert.throws(
      () => guardedDb.pgConfigureIsolatedTestDatabase(
        "postgresql://postgres@localhost:5432/setfarm",
      ),
      /ISOLATED_TEST_DATABASE_URL_REJECTED/,
    );
    assert.throws(
      () => guardedDb.pgConfigureIsolatedTestDatabase(
        "postgresql://postgres@example.com:5432/setfarm_contract_spine_test_1_aaaaaaaaaaaa",
      ),
      /ISOLATED_TEST_DATABASE_URL_REJECTED/,
    );
  });

  it("plans an empty database without mutating it", async () => {
    const before = await database.sql<{ name: string }[]>`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    const plan = await planContractSpineMigrations(database.sql);
    const after = await database.sql<{ name: string }[]>`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    assert.deepEqual(after, before);
    assert.equal(plan.schema, "setfarm.contract-spine-migration-plan.v1");
    assert.equal(plan.status, "pending");
    assert.equal(plan.migrations.length >= 1, true);
    assert.equal(plan.migrations[0]?.state, "pending");
  });

  it("makes ordinary runtime startup verify-only and fail before base DDL", async () => {
    await assert.rejects(
      database.db.pgMigrate(),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );
    const tablesAfterVerify = await database.sql<{ name: string }[]>`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    assert.equal(tablesAfterVerify.length, 0);

    await database.db.pgMigrate({ contractSpineMode: "apply" });
    const tablesAfterApply = await database.sql<{ name: string }[]>`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    assert.ok(tablesAfterApply.some((table) => table.name === "execution_attempts"));
    assert.ok(tablesAfterApply.some((table) => table.name === "setfarm_schema_migrations"));
  });

  it("applies, journals, verifies, and reapplies idempotently", async () => {
    const releaseSha = "c".repeat(40);
    const first = await applyContractSpineMigrations(database.sql, { releaseSha });
    assert.equal(first.applied.length >= 1, true);
    assert.deepEqual(first.adopted, []);

    const verified = await verifyContractSpineMigrations(database.sql);
    assert.equal(verified.status, "verified");
    assert.equal(verified.migrations.every((item) => item.state === "applied"), true);
    const journal = await database.sql<{
      release_sha: string | null;
      verified_release_sha: string | null;
    }[]>`
      SELECT release_sha, verified_release_sha
      FROM setfarm_schema_migrations
      ORDER BY version
    `;
    assert.equal(journal.every((row) => row.release_sha === releaseSha), true);
    assert.equal(journal.every((row) => row.verified_release_sha === releaseSha), true);

    const nextReleaseSha = "d".repeat(40);
    const second = await applyContractSpineMigrations(database.sql, {
      releaseSha: nextReleaseSha,
    });
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.adopted, []);
    assert.equal(second.alreadyApplied.length, verified.migrations.length);
    const attestation = await readContractSpineMigrationAttestation(database.sql);
    assert.deepEqual(attestation, {
      status: "attested",
      versions: verified.migrations.map((item) => item.version),
      verifiedReleaseSha: nextReleaseSha,
    });
    const originalReleases = await database.sql<{ release_sha: string | null }[]>`
      SELECT release_sha FROM setfarm_schema_migrations ORDER BY version
    `;
    assert.equal(originalReleases.every((row) => row.release_sha === releaseSha), true);
  });

  it("adopts an exact existing attempt table only after catalog verification", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`DROP TABLE setfarm_schema_migrations`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "pending");
    assert.equal(plan.migrations[0]?.state, "adoptable");
    const adopted = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(adopted.applied, ["003_migration_release_attestation"]);
    assert.deepEqual(adopted.adopted, [
      "001_execution_attempts",
      "002_run_protocol_identity",
      "004_compiler_preflight_identity",
    ]);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });

  it("backfills existing runs as immutable legacy protocol version one", async () => {
    await database.sql`CREATE SEQUENCE runs_run_number_seq`;
    await database.sql.unsafe(`
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        run_number INTEGER NOT NULL DEFAULT nextval('runs_run_number_seq'::regclass),
        workflow_id TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        context TEXT NOT NULL DEFAULT '{}',
        meta TEXT,
        notify_url TEXT,
        assigned_developer TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await database.sql`
      INSERT INTO runs (id, workflow_id, task)
      VALUES ('legacy-before-protocol', 'feature-dev', 'old run')
    `;

    await applyContractSpineMigrations(database.sql);
    const rows = await database.sql<{
      protocol: string;
      protocol_version: number;
      compiler_release_sha: string | null;
    }[]>`
      SELECT protocol, protocol_version, compiler_release_sha
      FROM runs
      WHERE id = 'legacy-before-protocol'
    `;
    assert.deepEqual({ ...rows[0] }, {
      protocol: "legacy",
      protocol_version: 1,
      compiler_release_sha: null,
    });
    await assert.rejects(
      database.sql`UPDATE runs SET protocol = 'shadow' WHERE id = 'legacy-before-protocol'`,
      /RUN_PROTOCOL_IMMUTABLE/,
    );
  });

  it("rejects a partially installed run protocol identity", async () => {
    await database.sql`CREATE TABLE runs (id TEXT PRIMARY KEY, protocol TEXT NOT NULL DEFAULT 'legacy')`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.find((item) => item.version === 2)?.state, "adoption_mismatch");
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    const journal = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'setfarm_schema_migrations'
    `;
    assert.equal(journal[0]?.count, 0);
  });

  it("rejects a checksum mismatch without repairing journal history", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`
      UPDATE setfarm_schema_migrations
      SET checksum = ${"0".repeat(64)}
      WHERE version = 1
    `;

    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_CHECKSUM_MISMATCH",
    );

    const row = await database.sql<{ checksum: string }[]>`
      SELECT checksum FROM setfarm_schema_migrations WHERE version = 1
    `;
    assert.equal(row[0]?.checksum, "0".repeat(64));
  });

  it("rejects an attestation constraint with the expected name but wrong semantics", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: "c".repeat(40) });
    await database.sql.unsafe(
      "ALTER TABLE setfarm_schema_migrations DROP CONSTRAINT setfarm_schema_migrations_verified_pair_check",
    );
    await database.sql.unsafe(
      "ALTER TABLE setfarm_schema_migrations ADD CONSTRAINT setfarm_schema_migrations_verified_pair_check CHECK (TRUE)",
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects a journal version newer than the running source", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`
      INSERT INTO setfarm_schema_migrations
        (version, name, checksum, state, release_sha)
      VALUES
        (99, '099_future_migration', ${"f".repeat(64)}, 'applied', 'future-release')
    `;

    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.at(-1)?.state, "unexpected");
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_UNKNOWN_VERSION",
    );
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_UNKNOWN_VERSION",
    );
  });

  it("fails closed when a pre-existing table has the wrong shape", async () => {
    await database.sql`CREATE TABLE execution_attempts (attempt_id TEXT PRIMARY KEY)`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations[0]?.state, "adoption_mismatch");
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );

    const journal = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'setfarm_schema_migrations'
    `;
    assert.equal(journal[0]?.count, 0);
  });
  it("serializes concurrent apply and journals one migration", async () => {
    const migrationCount = (await planContractSpineMigrations(database.sql)).migrations.length;
    const results = await Promise.all([
      applyContractSpineMigrations(database.sql),
      applyContractSpineMigrations(database.sql),
    ]);
    assert.equal(results.flatMap((result) => result.applied).length, migrationCount);
    assert.equal(results.flatMap((result) => result.alreadyApplied).length, migrationCount);

    const rows = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations
    `;
    assert.equal(rows[0]?.count, migrationCount);
  });

  it("bounds advisory-lock waiting", async () => {
    const blocker = database.sql.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(${contractSpineMigrationLockKey})`;
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    await assert.rejects(
      applyContractSpineMigrations(database.sql, { lockTimeoutMs: 50 }),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_LOCK_TIMEOUT",
    );
    await blocker;
  });
});
