import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  planContractSpineMigrations,
  rollbackArtifactPublicationBatchLedgerToV22,
  rollbackArtifactStoreAuthorityLedgerToV23,
  rollbackPreparationAuthorityV2LedgerToV24,
  rollbackProductCompilationAttemptLedgerToV21,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

describe("product compilation attempt migration 22", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
  });

  it("installs, verifies, and rolls an unused ledger back to v21", async () => {
    const sourceRelease = "a".repeat(40);
    const targetRelease = "b".repeat(40);
    const applied = await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    assert.equal(applied.applied.includes("022_product_compilation_attempt_ledger"), true);
    const verified = await verifyContractSpineMigrations(database.sql);
    assert.equal(verified.status, "verified");

    await rollbackPreparationAuthorityV2LedgerToV24(database.sql, {
      targetReleaseSha: "f".repeat(40),
    });
    await rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
      targetReleaseSha: "e".repeat(40),
    });
    await rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
      targetReleaseSha: "d".repeat(40),
    });

    const rollback = await rollbackProductCompilationAttemptLedgerToV21(database.sql, {
      targetReleaseSha: targetRelease,
    });
    assert.deepEqual({
      schema: rollback.schema,
      fromVersion: rollback.fromVersion,
      targetVersion: rollback.targetVersion,
      rowsRewritten: rollback.rowsRewritten,
      targetReleaseSha: rollback.targetReleaseSha,
    }, {
      schema: "setfarm.contract-spine-rollback.v1",
      fromVersion: 22,
      targetVersion: 21,
      rowsRewritten: 0,
      targetReleaseSha: targetRelease,
    });
    const relation = await database.sql<Array<{ relation: string | null }>>`
      SELECT to_regclass('public.product_compilation_attempts')::text AS relation
    `;
    assert.equal(relation[0]?.relation, null);
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "pending");
    assert.equal(plan.migrations.find((item) => item.version === 22)?.state, "pending");
  });

  it("refuses rollback after immutable attempt evidence exists", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: "c".repeat(40) });
    await rollbackPreparationAuthorityV2LedgerToV24(database.sql, {
      targetReleaseSha: "f".repeat(40),
    });
    await rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
      targetReleaseSha: "e".repeat(40),
    });
    await rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
      targetReleaseSha: "d".repeat(40),
    });
    await database.sql`
      INSERT INTO runs (id, workflow_id, task, status)
      VALUES ('run-migration-22-evidence', 'feature-dev', 'migration evidence', 'running')
    `;
    const claims = await database.sql<Array<{ id: string }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES ('run-migration-22-evidence', 'design', NULL, 'migration-test')
      RETURNING id::text AS id
    `;
    const claimId = Number(claims[0]!.id);
    const attemptId = `PCA_${"d".repeat(64)}`;
    await database.sql.unsafe(
      `INSERT INTO product_compilation_attempts (
         attempt_id, run_id, origin_claim_id, owner_claim_id, pass_kind,
         authority_hash, request_hash, ordinal, generation, fence_token,
         state, owner_instance_id, lease_token, lease_acquired_at,
         lease_expires_at, heartbeat_at, attempt_locator
       ) VALUES (
         $1, 'run-migration-22-evidence', $2, $2, 'design_source_generation',
         $3, $4, 1, 1, $5,
         'reserved', 'migration-test', $6, NOW(), NOW() + INTERVAL '5 minutes',
         NOW(), $7
       )`,
      [
        attemptId,
        claimId,
        "e".repeat(64),
        "f".repeat(64),
        "1".repeat(64),
        "2".repeat(64),
        `.setfarm/product-compilation-attempts/${attemptId}`,
      ],
    );

    await assert.rejects(
      () => rollbackProductCompilationAttemptLedgerToV21(database.sql, {
        targetReleaseSha: "b".repeat(40),
      }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );
    const journal = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations WHERE version = 22
    `;
    assert.equal(journal[0]?.count, 1);
  });
});
