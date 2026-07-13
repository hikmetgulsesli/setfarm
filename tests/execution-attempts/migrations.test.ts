import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  contractSpineMigrationLockKey,
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
    const first = await applyContractSpineMigrations(database.sql);
    assert.equal(first.applied.length >= 1, true);
    assert.deepEqual(first.adopted, []);

    const verified = await verifyContractSpineMigrations(database.sql);
    assert.equal(verified.status, "verified");
    assert.equal(verified.migrations.every((item) => item.state === "applied"), true);

    const second = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.adopted, []);
    assert.equal(second.alreadyApplied.length, verified.migrations.length);
  });

  it("adopts an exact existing attempt table only after catalog verification", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`DROP TABLE setfarm_schema_migrations`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "pending");
    assert.equal(plan.migrations[0]?.state, "adoptable");
    const adopted = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(adopted.applied, []);
    assert.deepEqual(adopted.adopted, ["001_execution_attempts"]);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
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
    const results = await Promise.all([
      applyContractSpineMigrations(database.sql),
      applyContractSpineMigrations(database.sql),
    ]);
    assert.equal(results.flatMap((result) => result.applied).length, 1);
    assert.equal(results.flatMap((result) => result.alreadyApplied).length, 1);

    const rows = await database.sql<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations
    `;
    assert.equal(rows[0]?.count, 1);
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
