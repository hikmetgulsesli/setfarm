import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  auditArtifactPublicationBatchLedgerData,
  auditCurrentArtifactPublicationAuthorityLedgerData,
  planContractSpineMigrations,
  rollbackArtifactPublicationBatchLedgerToV22,
  rollbackArtifactPublicationBatchPlanLedgerToV25,
  rollbackPlatformReleaseStoreRecordLedgerV3ToV26,
  rollbackRuntimeCompletionManifestAuthorityToV27,
  rollbackV3StoryClaimRuntimeBindingToV28,
  rollbackArtifactStoreAuthorityLedgerToV23,
  rollbackPreparationAuthorityV2LedgerToV24,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import {
  ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
  ArtifactPublicationBatchIdentityItemSchema,
  computeArtifactPublicationBatchChildReservationId,
  computeArtifactPublicationBatchIdentityHash,
} from "../../src/product-compiler/artifact-publication-batch-identity.js";
import {
  createArtifactPublicationBatchPlanBindingV1,
} from "../../src/product-compiler/artifact-publication-batch-plan-binding.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const migrationProducer = Object.freeze({
  pass: "migration-test",
  codeSha: "a".repeat(40),
  toolVersions: Object.freeze({ node: "22" }),
});

async function rollbackEmptyReleaseStoreRecordLedger(
  database: TestDatabase,
): Promise<void> {
  await rollbackV3StoryClaimRuntimeBindingToV28(database.sql, {
    targetReleaseSha: "a".repeat(40),
  });
  await rollbackRuntimeCompletionManifestAuthorityToV27(database.sql, {
    targetReleaseSha: "b".repeat(40),
  });
  await rollbackPlatformReleaseStoreRecordLedgerV3ToV26(database.sql, {
    targetReleaseSha: "c".repeat(40),
  });
}

async function rollbackEmptyAuthorityLedger(database: TestDatabase): Promise<void> {
  await rollbackEmptyReleaseStoreRecordLedger(database);
  await rollbackArtifactPublicationBatchPlanLedgerToV25(database.sql, {
    targetReleaseSha: "d".repeat(40),
  });
  await rollbackPreparationAuthorityV2LedgerToV24(database.sql, {
    targetReleaseSha: "e".repeat(40),
  });
  await rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
    targetReleaseSha: "f".repeat(40),
  });
}

async function insertCompleteReservedBatch(
  database: TestDatabase,
  batchReservationId: string,
  token: string,
  createdAt = new Date(),
  byteLength = 10,
): Promise<Readonly<{ reservationId: string; artifactHash: string }>> {
  const artifactHash = token.repeat(64);
  const artifact = {
    hash: artifactHash,
    artifactType: "setfarm.byte-chunk.v1",
    byteLength,
    producer: migrationProducer,
  };
  const batchIdentityHash = computeArtifactPublicationBatchIdentityHash([artifact]);
  const reservationId = computeArtifactPublicationBatchChildReservationId(
    batchReservationId,
    batchIdentityHash,
    artifactHash,
  );
  const leaseToken = "APB_00000000-0000-4000-8000-000000000001";
  const leaseExpiresAt = new Date(createdAt.getTime() + 60_000);
  const plan = createArtifactPublicationBatchPlanBindingV1([
    Object.freeze({ durabilityTier: 0, identity: artifact }),
  ]);
  await database.sql.begin(async (transaction) => {
    const planRelations = await transaction.unsafe<Array<{ relation: string | null }>>(
      "SELECT to_regclass('public.artifact_publication_batch_plans')::text AS relation",
    );
    await transaction.unsafe(
      `INSERT INTO artifact_publication_reservations (
         reservation_id, artifact_hash, artifact_type, byte_length,
         producer_metadata, state, owner_instance_id, lease_token,
         lease_expires_at, created_at, updated_at
       ) VALUES ($1, $2, 'setfarm.byte-chunk.v1', $3, $4::text::jsonb,
                 'reserved', 'migration-test', $5, $6, $7, $7)`,
      [
        reservationId,
        artifactHash,
        byteLength,
        JSON.stringify(migrationProducer),
        leaseToken,
        leaseExpiresAt,
        createdAt,
      ],
    );
    await transaction.unsafe(
      `UPDATE artifact_capacity
          SET reserved_bytes = reserved_bytes + $2,
              updated_at = $1
        WHERE capacity_key = 'semantic-artifacts'`,
      [createdAt, byteLength],
    );
    await transaction.unsafe(
      `INSERT INTO artifact_publication_batches (
         batch_reservation_id, identity_schema, batch_identity_hash, artifact_count,
         created_by_instance_id, state, owner_instance_id, lease_token,
         lease_expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 1, 'migration-test', 'active',
                 'migration-test', $4, $5, $6, $6)`,
      [
        batchReservationId,
        ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
        batchIdentityHash,
        leaseToken,
        leaseExpiresAt,
        createdAt,
      ],
    );
    await transaction.unsafe(
      `INSERT INTO artifact_publication_batch_items (
         batch_reservation_id, ordinal, artifact_hash, artifact_type,
         byte_length, producer_metadata, reservation_id,
         indexed_artifact_hash, created_at
       ) VALUES ($1, 0, $2, 'setfarm.byte-chunk.v1', $3,
                 $4::text::jsonb, $5, NULL, NOW())`,
      [
        batchReservationId,
        artifactHash,
        byteLength,
        JSON.stringify(migrationProducer),
        reservationId,
      ],
    );
    if (planRelations[0]?.relation) {
      await transaction.unsafe(
        `INSERT INTO artifact_publication_batch_plans (
           batch_reservation_id, plan_schema, plan_identity_hash,
           item_count, created_at
         ) VALUES ($1, $2, $3, 1, $4)`,
        [batchReservationId, plan.schema, plan.planIdentityHash, createdAt],
      );
      await transaction.unsafe(
        `INSERT INTO artifact_publication_batch_plan_items (
           batch_reservation_id, ordinal, artifact_hash,
           durability_tier, created_at
         ) VALUES ($1, 0, $2, 0, $3)`,
        [batchReservationId, artifactHash, createdAt],
      );
    }
  });
  return { reservationId, artifactHash };
}

describe("artifact publication batch migration 23", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
  });

  it("installs, verifies, and rolls an unused immutable batch ledger back to v22", async () => {
    const sourceRelease = "a".repeat(40);
    const targetRelease = "b".repeat(40);
    const applied = await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    assert.equal(applied.applied.includes("023_artifact_publication_batch_ledger"), true);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
    const relations = await database.sql<Array<{ relation: string | null }>>`
      SELECT to_regclass('public.artifact_publication_batches')::text AS relation
      UNION ALL
      SELECT to_regclass('public.artifact_publication_batch_items')::text AS relation
    `;
    assert.deepEqual(relations.map((row) => row.relation).sort(), [
      "artifact_publication_batch_items",
      "artifact_publication_batches",
    ]);

    await rollbackEmptyAuthorityLedger(database);

    const rollback = await rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
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
      fromVersion: 23,
      targetVersion: 22,
      rowsRewritten: 0,
      targetReleaseSha: targetRelease,
    });
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "pending");
    assert.equal(plan.migrations.find((item) => item.version === 22)?.state, "applied");
    assert.equal(plan.migrations.find((item) => item.version === 23)?.state, "pending");
    const reapplied = await applyContractSpineMigrations(database.sql, {
      releaseSha: "c".repeat(40),
    });
    assert.equal(reapplied.applied.includes("023_artifact_publication_batch_ledger"), true);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });

  it("matches the fixed TypeScript and PostgreSQL full-field UTF-8 identity vector", async () => {
    await applyContractSpineMigrations(database.sql);
    const batchReservationId = "golden.batch:unicode-01";
    const items = [
      {
        hash: "a".repeat(64),
        artifactType: "setfarm.byte-chunk.v1",
        byteLength: 1,
        producer: {
          pass: "production",
          codeSha: "b".repeat(40),
          model: "模型",
          promptHash: "c".repeat(64),
          toolVersions: { é: "v:1\n", "😀": "值" },
        },
      },
      {
        hash: "f".repeat(64),
        artifactType: "setfarm.product-spec.v2",
        byteLength: Number.MAX_SAFE_INTEGER,
        producer: {
          pass: "e\u0301",
          codeSha: "d".repeat(40),
          toolVersions: { alpha: "1", β: "2" },
        },
      },
    ].map((item) => ArtifactPublicationBatchIdentityItemSchema.parse(item));
    const batchIdentityHash = computeArtifactPublicationBatchIdentityHash(items);
    assert.equal(batchIdentityHash, "84e58ec72bc63479ab313496a6216aa7a8a5869ca917f3fa8b1d0ce40247a61b");
    const leaseToken = "APB_00000000-0000-4000-8000-000000000002";
    const createdAt = new Date();
    const leaseExpiresAt = new Date(createdAt.getTime() + 60_000);
    const plan = createArtifactPublicationBatchPlanBindingV1(
      items.map((identity) => Object.freeze({ durabilityTier: 0, identity })),
    );
    await database.sql.begin(async (transaction) => {
      await transaction.unsafe(
        `UPDATE artifact_capacity
            SET quota_bytes = $1,
                reserved_bytes = $1,
                updated_at = $2
          WHERE capacity_key = 'semantic-artifacts'`,
        ["9007199254740992", createdAt],
      );
      for (const item of items) {
        await transaction.unsafe(
          `INSERT INTO artifact_publication_reservations (
             reservation_id, artifact_hash, artifact_type, byte_length,
             producer_metadata, state, owner_instance_id, lease_token,
             lease_expires_at, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5::text::jsonb, 'reserved',
                     'golden-owner', $6, $7, $8, $8)`,
          [
            computeArtifactPublicationBatchChildReservationId(
              batchReservationId,
              batchIdentityHash,
              item.hash,
            ),
            item.hash,
            item.artifactType,
            item.byteLength,
            JSON.stringify(item.producer),
            leaseToken,
            leaseExpiresAt,
            createdAt,
          ],
        );
      }
      await transaction.unsafe(
        `INSERT INTO artifact_publication_batches (
           batch_reservation_id, identity_schema, batch_identity_hash,
           artifact_count, created_by_instance_id, state, owner_instance_id,
           lease_token, lease_expires_at, created_at, updated_at
         ) VALUES ($1, $2, $3, 2, 'golden-owner', 'active', 'golden-owner',
                   $4, $5, $6, $6)`,
        [
          batchReservationId,
          ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
          batchIdentityHash,
          leaseToken,
          leaseExpiresAt,
          createdAt,
        ],
      );
      for (const [ordinal, item] of items.entries()) {
        await transaction.unsafe(
          `INSERT INTO artifact_publication_batch_items (
             batch_reservation_id, ordinal, artifact_hash, artifact_type,
             byte_length, producer_metadata, reservation_id, indexed_artifact_hash
           ) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, NULL)`,
          [
            batchReservationId,
            ordinal,
            item.hash,
            item.artifactType,
            item.byteLength,
            JSON.stringify(item.producer),
            computeArtifactPublicationBatchChildReservationId(
              batchReservationId,
              batchIdentityHash,
              item.hash,
            ),
          ],
        );
      }
      await transaction.unsafe(
        `INSERT INTO artifact_publication_batch_plans (
           batch_reservation_id, plan_schema, plan_identity_hash,
           item_count, created_at
         ) VALUES ($1, $2, $3, $4, $5)`,
        [batchReservationId, plan.schema, plan.planIdentityHash, plan.items.length, createdAt],
      );
      for (const [ordinal, item] of plan.items.entries()) {
        await transaction.unsafe(
          `INSERT INTO artifact_publication_batch_plan_items (
             batch_reservation_id, ordinal, artifact_hash,
             durability_tier, created_at
           ) VALUES ($1, $2, $3, $4, $5)`,
          [batchReservationId, ordinal, item.identity.hash, item.durabilityTier, createdAt],
        );
      }
    });
  });

  it("refuses rollback after immutable batch evidence exists", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: "c".repeat(40) });
    await rollbackEmptyAuthorityLedger(database);
    await insertCompleteReservedBatch(database, "batch-migration-evidence", "d");
    await assert.rejects(
      database.sql`
        UPDATE artifact_publication_batches
           SET artifact_count = 2
         WHERE batch_reservation_id = 'batch-migration-evidence'
      `,
      /ARTIFACT_PUBLICATION_BATCH_IDENTITY_IMMUTABLE/,
    );
    await assert.rejects(
      rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
        targetReleaseSha: "b".repeat(40),
      }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );
    const journal = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM setfarm_schema_migrations WHERE version = 23
    `;
    assert.equal(journal[0]?.count, 1);
  });

  it("detects a same-name trigger whose WHEN clause permits identity mutation", async () => {
    await applyContractSpineMigrations(database.sql);
    await insertCompleteReservedBatch(database, "mutable-evidence", "1");
    await database.sql.unsafe(
      "DROP TRIGGER trg_artifact_publication_batches_immutable ON artifact_publication_batches",
    );
    await database.sql.unsafe(
      `CREATE TRIGGER trg_artifact_publication_batches_immutable
         BEFORE UPDATE OR DELETE ON artifact_publication_batches
         FOR EACH ROW WHEN (OLD.batch_reservation_id IS NULL)
         EXECUTE FUNCTION setfarm_forbid_artifact_identity_update()`,
    );
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      DISABLE TRIGGER trg_artifact_publication_batches_complete
    `);
    await database.sql.unsafe(
      `UPDATE artifact_publication_batches
          SET batch_identity_hash = $1
        WHERE batch_reservation_id = 'mutable-evidence'`,
      ["2".repeat(64)],
    );
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      ENABLE TRIGGER trg_artifact_publication_batches_complete
    `);
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("detects a same-name weakened batch item byte-length invariant", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(
      `ALTER TABLE artifact_publication_batch_items
         DROP CONSTRAINT artifact_publication_batch_items_byte_length_check`,
    );
    await database.sql.unsafe(
      `ALTER TABLE artifact_publication_batch_items
         ADD CONSTRAINT artifact_publication_batch_items_byte_length_check
         CHECK (byte_length > 0 OR byte_length IS NOT NULL)`,
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects a deterministic child reservation that is not committed with a batch item", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: "e".repeat(40) });
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO artifact_publication_reservations (
           reservation_id, artifact_hash, artifact_type, byte_length,
           producer_metadata, state, owner_instance_id, lease_token,
           lease_expires_at, created_at, updated_at
         ) VALUES ($1, $2, 'setfarm.byte-chunk.v1', 10, $3::text::jsonb,
                   'reserved', 'migration-test', 'lease-test', NOW() + INTERVAL '1 minute',
                   NOW(), NOW())`,
        [
          `APRB_${"f".repeat(64)}`,
          "1".repeat(64),
          JSON.stringify(migrationProducer),
        ],
      ),
      /ARTIFACT_PUBLICATION_BATCH_CHILD_ORPHANED/,
    );
  });

  it("treats quoted identity-domain casing as semantic verifier input", async () => {
    await applyContractSpineMigrations(database.sql);
    const rows = await database.sql<Array<{ definition: string }>>`
      SELECT pg_get_functiondef(
        'public.setfarm_validate_artifact_publication_batch_completeness()'::regprocedure
      ) AS definition
    `;
    const definition = rows[0]!.definition;
    const mutated = definition.replace(
      "'setfarm.artifact-publication-batch-item.v1'",
      "'SETFARM.ARTIFACT-PUBLICATION-BATCH-ITEM.V1'",
    );
    assert.notEqual(mutated, definition);
    await database.sql.unsafe(mutated);
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects a same-name no-op batch immutability function", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(`
      CREATE OR REPLACE FUNCTION public.setfarm_forbid_artifact_publication_batch_identity_update()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path TO pg_catalog, public
      AS $$
      BEGIN
        RETURN NEW;
      END;
      $$
    `);
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects a same-name no-op batch lifecycle transition function", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(`
      CREATE OR REPLACE FUNCTION public.setfarm_enforce_artifact_publication_batch_transition()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path TO pg_catalog, public
      AS $$
      BEGIN
        RETURN NEW;
      END;
      $$
    `);
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects ownership rotation before the aggregate lease expires", async () => {
    await applyContractSpineMigrations(database.sql);
    await insertCompleteReservedBatch(database, "batch-premature-adoption", "5");
    await assert.rejects(
      database.sql.unsafe(
        `UPDATE artifact_publication_batches
            SET owner_instance_id = 'new-owner',
                lease_token = 'APB_00000000-0000-4000-8000-000000000009',
                lease_expires_at = lease_expires_at + INTERVAL '1 minute',
                updated_at = lease_expires_at
          WHERE batch_reservation_id = 'batch-premature-adoption'`,
      ),
      /ARTIFACT_PUBLICATION_BATCH_ADOPTION_INVALID/,
    );
  });

  it("rejects reviving an expired aggregate through a same-token heartbeat", async () => {
    await applyContractSpineMigrations(database.sql);
    const { reservationId } = await insertCompleteReservedBatch(
      database,
      "batch-expired-heartbeat",
      "9",
      new Date(Date.now() - 120_000),
    );
    await assert.rejects(
      database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          `UPDATE artifact_publication_reservations
              SET lease_expires_at = NOW() + INTERVAL '1 minute',
                  updated_at = NOW()
            WHERE reservation_id = $1`,
          [reservationId],
        );
        await transaction.unsafe(
          `UPDATE artifact_publication_batches
              SET lease_expires_at = NOW() + INTERVAL '1 minute',
                  updated_at = NOW()
            WHERE batch_reservation_id = 'batch-expired-heartbeat'`,
        );
      }),
      /ARTIFACT_PUBLICATION_BATCH_HEARTBEAT_INVALID/,
    );
  });

  it("rejects adopting an expired aggregate into another already-expired fence", async () => {
    await applyContractSpineMigrations(database.sql);
    const { reservationId } = await insertCompleteReservedBatch(
      database,
      "batch-expired-adoption-output",
      "a",
      new Date(Date.now() - 120_000),
    );
    const replacementToken = "APB_00000000-0000-4000-8000-000000000098";
    await assert.rejects(
      database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          `UPDATE artifact_publication_reservations
              SET owner_instance_id = 'replacement-owner', lease_token = $2,
                  lease_expires_at = lease_expires_at + INTERVAL '1 millisecond',
                  updated_at = lease_expires_at
            WHERE reservation_id = $1`,
          [reservationId, replacementToken],
        );
        await transaction.unsafe(
          `UPDATE artifact_publication_batches
              SET owner_instance_id = 'replacement-owner', lease_token = $1,
                  lease_expires_at = lease_expires_at + INTERVAL '1 millisecond',
                  updated_at = lease_expires_at
            WHERE batch_reservation_id = 'batch-expired-adoption-output'`,
          [replacementToken],
        );
      }),
      /ARTIFACT_PUBLICATION_BATCH_ADOPTION_INVALID/,
    );
  });

  it("rejects an initially unbounded aggregate lease before recovery can be stranded", async () => {
    await applyContractSpineMigrations(database.sql);
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO artifact_publication_batches (
           batch_reservation_id, identity_schema, batch_identity_hash, artifact_count,
           created_by_instance_id, state, owner_instance_id, lease_token,
           lease_expires_at, created_at, updated_at
         ) VALUES (
           'batch-unbounded-initial-lease', 'setfarm.artifact-publication-batch.v1',
           $1, 1, 'migration-test', 'active', 'migration-test',
           'APB_00000000-0000-4000-8000-000000000097',
           NOW() + INTERVAL '100 years', NOW(), NOW()
         )`,
        ["b".repeat(64)],
      ),
      /artifact_publication_batches_time_check/,
    );
  });

  it("rejects a direct batch-child publish without its semantic and accounting effects", async () => {
    await applyContractSpineMigrations(database.sql);
    const { reservationId } = await insertCompleteReservedBatch(
      database,
      "batch-direct-publish",
      "6",
    );
    await assert.rejects(
      database.sql.unsafe(
        `UPDATE artifact_publication_reservations
            SET state = 'published', owner_instance_id = NULL,
                lease_token = NULL, lease_expires_at = NULL,
                published_at = NOW(), finalized_at = NOW(), updated_at = NOW()
          WHERE reservation_id = $1`,
        [reservationId],
      ),
      /ARTIFACT_PUBLICATION_BATCH_PUBLISHED_IDENTITY_MISMATCH/,
    );
  });

  it("rejects a fully accounted last-child publish without completing its header", async () => {
    await applyContractSpineMigrations(database.sql);
    const { reservationId, artifactHash } = await insertCompleteReservedBatch(
      database,
      "batch-last-child-header-stuck",
      "b",
    );
    await assert.rejects(
      database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          `INSERT INTO semantic_artifacts (
             artifact_hash, artifact_type, byte_length, producer_metadata
           ) VALUES ($1, 'setfarm.byte-chunk.v1', 10, $2::text::jsonb)`,
          [artifactHash, JSON.stringify(migrationProducer)],
        );
        await transaction.unsafe(
          `UPDATE artifact_capacity
              SET total_bytes = total_bytes + 10,
                  reserved_bytes = reserved_bytes - 10,
                  updated_at = NOW()
            WHERE capacity_key = 'semantic-artifacts'`,
        );
        await transaction.unsafe(
          `UPDATE artifact_publication_reservations
              SET state = 'published', owner_instance_id = NULL,
                  lease_token = NULL, lease_expires_at = NULL,
                  published_at = NOW(), finalized_at = NOW(), updated_at = NOW()
            WHERE reservation_id = $1`,
          [reservationId],
        );
      }),
      /ARTIFACT_PUBLICATION_BATCH_ACTIVE_WITHOUT_RESERVATION/,
    );
  });

  it("rejects a direct aggregate release without its capacity effect", async () => {
    await applyContractSpineMigrations(database.sql);
    const { reservationId } = await insertCompleteReservedBatch(
      database,
      "batch-direct-release",
      "7",
    );
    await assert.rejects(
      database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          `UPDATE artifact_publication_reservations
              SET state = 'released', owner_instance_id = NULL,
                  lease_token = NULL, lease_expires_at = NULL,
                  finalized_at = NOW(), updated_at = NOW()
            WHERE reservation_id = $1`,
          [reservationId],
        );
        await transaction.unsafe(
          `UPDATE artifact_publication_batches
              SET state = 'released', owner_instance_id = NULL,
                  lease_token = NULL, lease_expires_at = NULL,
                  diagnostic = 'raw release without accounting',
                  finalized_at = NOW(), updated_at = NOW()
            WHERE batch_reservation_id = 'batch-direct-release'`,
        );
      }),
      /ARTIFACT_PUBLICATION_BATCH_CAPACITY_INCOHERENT/,
    );
  });

  it("reports a dropped required trigger consistently in plan and verify", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(
      "DROP TRIGGER trg_artifact_publication_batches_complete ON artifact_publication_batches",
    );
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(
      plan.migrations.find((migration) => migration.version === 23)?.state,
      "adoption_mismatch",
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("reports a missing journaled batch relation as typed drift", async () => {
    await applyContractSpineMigrations(database.sql);
    await rollbackEmptyAuthorityLedger(database);
    await database.sql.unsafe("DROP TABLE artifact_publication_batch_items CASCADE");
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(
      plan.migrations.find((migration) => migration.version === 23)?.state,
      "adoption_mismatch",
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    for (const operation of [
      () => applyContractSpineMigrations(database.sql),
      () => rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
        targetReleaseSha: "b".repeat(40),
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("reports a missing journaled helper as typed drift across every operation", async () => {
    await applyContractSpineMigrations(database.sql);
    await rollbackEmptyAuthorityLedger(database);
    await database.sql.unsafe(
      "DROP FUNCTION public.setfarm_artifact_publication_batch_producer_identity_bytes(jsonb)",
    );
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(
      plan.migrations.find((migration) => migration.version === 23)?.state,
      "adoption_mismatch",
    );
    for (const operation of [
      () => applyContractSpineMigrations(database.sql),
      () => verifyContractSpineMigrations(database.sql),
      () => auditArtifactPublicationBatchLedgerData(database.sql),
      () => rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
        targetReleaseSha: "b".repeat(40),
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("rejects unlogged batch relations across plan, verify, audit, apply, and rollback", async () => {
    await applyContractSpineMigrations(database.sql);
    await rollbackEmptyAuthorityLedger(database);
    await database.sql.unsafe("ALTER TABLE artifact_publication_batch_items SET UNLOGGED");
    await database.sql.unsafe("ALTER TABLE artifact_publication_batches SET UNLOGGED");
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(
      plan.migrations.find((migration) => migration.version === 23)?.state,
      "adoption_mismatch",
    );
    for (const operation of [
      () => verifyContractSpineMigrations(database.sql),
      () => auditArtifactPublicationBatchLedgerData(database.sql),
      () => applyContractSpineMigrations(database.sql),
      () => rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
        targetReleaseSha: "b".repeat(40),
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("rejects an unjournaled extra object before adopting migration 23", async () => {
    await applyContractSpineMigrations(database.sql);
    await rollbackEmptyReleaseStoreRecordLedger(database);
    await rollbackArtifactPublicationBatchPlanLedgerToV25(database.sql, {
      targetReleaseSha: "7".repeat(40),
    });
    await database.sql.unsafe("DELETE FROM setfarm_schema_migrations WHERE version = 23");
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      ADD CONSTRAINT artifact_publication_batches_extra_check CHECK (true)
    `);
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(
      plan.migrations.find((migration) => migration.version === 23)?.state,
      "adoption_mismatch",
    );
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    const journal = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM setfarm_schema_migrations
       WHERE version = 23
    `;
    assert.equal(journal[0]?.count, 0);
  });

  it("fails plan, audit, and rollback closed on shared reservation schema poison", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: "a".repeat(40) });
    await rollbackEmptyAuthorityLedger(database);
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_reservations
      ADD CONSTRAINT artifact_publication_reservations_poison_check CHECK (true)
    `);
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(
      plan.migrations.find((migration) => migration.version === 23)?.state,
      "adoption_mismatch",
    );
    for (const operation of [
      () => auditArtifactPublicationBatchLedgerData(database.sql),
      () => rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
        targetReleaseSha: "b".repeat(40),
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
    const journal = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM setfarm_schema_migrations
       WHERE version = 23
    `;
    assert.equal(journal[0]?.count, 1);
  });

  for (const relation of [
    "artifact_capacity",
    "artifact_publication_reservations",
    "semantic_artifacts",
  ] as const) {
    it(`fails every v23 operation closed when shared authority ${relation} enables RLS`, async () => {
      await applyContractSpineMigrations(database.sql, { releaseSha: "a".repeat(40) });
      await rollbackEmptyAuthorityLedger(database);
      await database.sql.unsafe(`
        ALTER TABLE public.${relation} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.${relation} FORCE ROW LEVEL SECURITY
      `);

      const plan = await planContractSpineMigrations(database.sql);
      assert.equal(plan.status, "drift");
      assert.equal(
        plan.migrations.find((migration) => migration.version === 23)?.state,
        "adoption_mismatch",
      );
      for (const operation of [
        () => verifyContractSpineMigrations(database.sql),
        () => applyContractSpineMigrations(database.sql, { releaseSha: "b".repeat(40) }),
        () => auditArtifactPublicationBatchLedgerData(database.sql),
        () => rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
          targetReleaseSha: "b".repeat(40),
        }),
      ]) {
        await assert.rejects(
          operation(),
          (error: unknown) => error instanceof ContractSpineMigrationError
            && error.code === "MIGRATION_ADOPTION_MISMATCH",
        );
      }
      const journal = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count
          FROM setfarm_schema_migrations
         WHERE version = 23
      `;
      assert.equal(journal[0]?.count, 1);
    });
  }

  it("rejects a disabled semantic artifact immutability authority on every v23 path", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: "a".repeat(40) });
    await rollbackEmptyAuthorityLedger(database);
    await database.sql.unsafe(
      "ALTER TABLE semantic_artifacts DISABLE TRIGGER trg_semantic_artifacts_immutable",
    );
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(
      plan.migrations.find((migration) => migration.version === 23)?.state,
      "adoption_mismatch",
    );
    for (const operation of [
      () => verifyContractSpineMigrations(database.sql),
      () => applyContractSpineMigrations(database.sql, { releaseSha: "b".repeat(40) }),
      () => auditArtifactPublicationBatchLedgerData(database.sql),
      () => rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
        targetReleaseSha: "b".repeat(40),
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("rejects weakened capacity authority and coherent over-quota batch data", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: "a".repeat(40) });
    await rollbackEmptyAuthorityLedger(database);
    await database.sql.unsafe(`
      UPDATE artifact_capacity
         SET quota_bytes = 100, max_payload_bytes = 80,
             total_bytes = 0, reserved_bytes = 0,
             state = 'ready', reconciled_at = NOW(), diagnostic = NULL,
             updated_at = NOW()
       WHERE capacity_key = 'semantic-artifacts';
      ALTER TABLE artifact_capacity DROP CONSTRAINT artifact_capacity_values_check;
      ALTER TABLE artifact_capacity
        ADD CONSTRAINT artifact_capacity_values_check CHECK (
          quota_bytes > 0
          AND max_payload_bytes > 0
          AND max_payload_bytes <= quota_bytes
          AND total_bytes >= 0
          AND reserved_bytes >= 0
          AND total_bytes + reserved_bytes <= quota_bytes
          OR TRUE
        )
    `);
    await insertCompleteReservedBatch(
      database,
      "batch-over-quota-shared-authority",
      "c",
      new Date(),
      110,
    );
    const capacity = await database.sql<Array<{
      quota_bytes: number;
      reserved_bytes: number;
      reservation_bytes: number;
    }>>`
      SELECT c.quota_bytes, c.reserved_bytes,
             (SELECT COALESCE(SUM(byte_length), 0)::bigint
                FROM artifact_publication_reservations
               WHERE state = 'reserved') AS reservation_bytes
        FROM artifact_capacity c
       WHERE c.capacity_key = 'semantic-artifacts'
    `;
    assert.equal(Number(capacity[0]?.quota_bytes), 100);
    assert.equal(Number(capacity[0]?.reserved_bytes), 110);
    assert.equal(Number(capacity[0]?.reservation_bytes), 110);

    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(
      plan.migrations.find((migration) => migration.version === 23)?.state,
      "adoption_mismatch",
    );
    for (const operation of [
      () => verifyContractSpineMigrations(database.sql),
      () => applyContractSpineMigrations(database.sql, { releaseSha: "b".repeat(40) }),
      () => rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
        targetReleaseSha: "b".repeat(40),
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
    await assert.rejects(
      auditArtifactPublicationBatchLedgerData(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH"
        && /capacity value ownership mismatch/.test(error.message),
    );
  });

  for (const relation of [
    "artifact_capacity",
    "artifact_publication_reservations",
    "semantic_artifacts",
  ] as const) {
    it(`classifies pre-v23 shared authority ${relation} RLS poison before adoption`, async () => {
      await applyContractSpineMigrations(database.sql, { releaseSha: "a".repeat(40) });
      await rollbackEmptyAuthorityLedger(database);
      await rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
        targetReleaseSha: "b".repeat(40),
      });
      await database.sql.unsafe(`
        ALTER TABLE public.${relation} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.${relation} FORCE ROW LEVEL SECURITY
      `);

      const plan = await planContractSpineMigrations(database.sql);
      assert.equal(plan.status, "drift");
      assert.equal(
        plan.migrations.find((migration) => migration.version === 23)?.state,
        "adoption_mismatch",
      );
      for (const operation of [
        () => verifyContractSpineMigrations(database.sql),
        () => applyContractSpineMigrations(database.sql, { releaseSha: "c".repeat(40) }),
      ]) {
        await assert.rejects(
          operation(),
          (error: unknown) => error instanceof ContractSpineMigrationError
            && error.code === "MIGRATION_ADOPTION_MISMATCH",
        );
      }
      const rows = await database.sql<Array<{
        journaled: boolean;
        batch_relation: string | null;
      }>>`
        SELECT EXISTS (
                 SELECT 1 FROM setfarm_schema_migrations WHERE version = 23
               ) AS journaled,
               to_regclass('public.artifact_publication_batches')::text AS batch_relation
      `;
      assert.equal(rows[0]?.journaled, false);
      assert.equal(rows[0]?.batch_relation, null);
    });
  }

  it("classifies a legacy APRB namespace row as typed migration drift", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: "a".repeat(40) });
    await rollbackEmptyAuthorityLedger(database);
    await rollbackArtifactPublicationBatchLedgerToV22(database.sql, {
      targetReleaseSha: "b".repeat(40),
    });
    await database.sql.unsafe(
      `INSERT INTO artifact_publication_reservations (
         reservation_id, artifact_hash, artifact_type, byte_length,
         producer_metadata, state, owner_instance_id, lease_token,
         lease_expires_at, created_at, updated_at
       ) VALUES ($1, $2, 'setfarm.byte-chunk.v1', 10, $3::text::jsonb,
                 'reserved', 'legacy-owner', 'legacy-lease', NOW() + INTERVAL '1 minute',
                 NOW(), NOW())`,
      [`APRB_${"f".repeat(64)}`, "1".repeat(64), JSON.stringify(migrationProducer)],
    );
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(
      plan.migrations.find((migration) => migration.version === 23)?.state,
      "adoption_mismatch",
    );
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("keeps startup verification bounded while offline audit detects row tamper", async () => {
    await applyContractSpineMigrations(database.sql);
    await insertCompleteReservedBatch(database, "batch-offline-audit", "3");
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      DISABLE TRIGGER trg_artifact_publication_batches_immutable
    `);
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      DISABLE TRIGGER trg_artifact_publication_batches_complete
    `);
    await database.sql.unsafe(
      `UPDATE artifact_publication_batches
          SET batch_identity_hash = $1
        WHERE batch_reservation_id = 'batch-offline-audit'`,
      ["4".repeat(64)],
    );
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      ENABLE TRIGGER trg_artifact_publication_batches_immutable
    `);
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      ENABLE TRIGGER trg_artifact_publication_batches_complete
    `);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
    await rollbackEmptyReleaseStoreRecordLedger(database);
    await assert.rejects(
      auditCurrentArtifactPublicationAuthorityLedgerData(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("keeps startup bounded while offline audit detects historical capacity tamper", async () => {
    await applyContractSpineMigrations(database.sql);
    const { reservationId } = await insertCompleteReservedBatch(
      database,
      "batch-offline-capacity-audit",
      "8",
    );
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      DISABLE TRIGGER trg_artifact_publication_batches_complete
    `);
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_reservations
      DISABLE TRIGGER trg_artifact_publication_batch_child_membership
    `);
    await database.sql.begin(async (transaction) => {
      await transaction.unsafe(
        `UPDATE artifact_publication_reservations
            SET state = 'released', owner_instance_id = NULL,
                lease_token = NULL, lease_expires_at = NULL,
                finalized_at = NOW(), updated_at = NOW()
          WHERE reservation_id = $1`,
        [reservationId],
      );
      await transaction.unsafe(
        `UPDATE artifact_publication_batches
            SET state = 'released', owner_instance_id = NULL,
                lease_token = NULL, lease_expires_at = NULL,
                diagnostic = 'historical accounting tamper',
                finalized_at = NOW(), updated_at = NOW()
          WHERE batch_reservation_id = 'batch-offline-capacity-audit'`,
      );
    });
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      ENABLE TRIGGER trg_artifact_publication_batches_complete
    `);
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_reservations
      ENABLE TRIGGER trg_artifact_publication_batch_child_membership
    `);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
    await rollbackEmptyReleaseStoreRecordLedger(database);
    await assert.rejects(
      auditCurrentArtifactPublicationAuthorityLedgerData(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH"
        && error.message.includes("capacity accounting"),
    );
  });

  it("keeps startup bounded while offline audit detects a resurrected indexed child", async () => {
    await applyContractSpineMigrations(database.sql);
    const { reservationId, artifactHash } = await insertCompleteReservedBatch(
      database,
      "batch-offline-resurrection-audit",
      "c",
    );
    await database.sql.begin(async (transaction) => {
      await transaction.unsafe(
        `INSERT INTO semantic_artifacts (
           artifact_hash, artifact_type, byte_length, producer_metadata
         ) VALUES ($1, 'setfarm.byte-chunk.v1', 10, $2::text::jsonb)`,
        [artifactHash, JSON.stringify(migrationProducer)],
      );
      await transaction.unsafe(
        `UPDATE artifact_capacity
            SET total_bytes = total_bytes + 10,
                reserved_bytes = reserved_bytes - 10,
                updated_at = NOW()
          WHERE capacity_key = 'semantic-artifacts'`,
      );
      await transaction.unsafe(
        `UPDATE artifact_publication_reservations
            SET state = 'published', owner_instance_id = NULL,
                lease_token = NULL, lease_expires_at = NULL,
                published_at = NOW(), finalized_at = NOW(), updated_at = NOW()
          WHERE reservation_id = $1`,
        [reservationId],
      );
      await transaction.unsafe(
        `UPDATE artifact_publication_batches
            SET state = 'completed', owner_instance_id = NULL,
                lease_token = NULL, lease_expires_at = NULL,
                diagnostic = NULL, finalized_at = NOW(), updated_at = NOW()
          WHERE batch_reservation_id = 'batch-offline-resurrection-audit'`,
      );
    });
    for (const statement of [
      "ALTER TABLE artifact_publication_batches DISABLE TRIGGER trg_artifact_publication_batches_immutable",
      "ALTER TABLE artifact_publication_batches DISABLE TRIGGER trg_artifact_publication_batches_complete",
      "ALTER TABLE artifact_publication_reservations DISABLE TRIGGER trg_artifact_publication_reservations_identity_immutable",
      "ALTER TABLE artifact_publication_reservations DISABLE TRIGGER trg_artifact_publication_batch_child_membership",
    ]) await database.sql.unsafe(statement);
    const revivedToken = "APB_00000000-0000-4000-8000-000000000099";
    await database.sql.begin(async (transaction) => {
      await transaction.unsafe(
        `UPDATE artifact_capacity
            SET reserved_bytes = reserved_bytes + 10,
                updated_at = NOW()
          WHERE capacity_key = 'semantic-artifacts'`,
      );
      await transaction.unsafe(
        `UPDATE artifact_publication_reservations
            SET state = 'reserved', owner_instance_id = 'revived-owner',
                lease_token = $2, lease_expires_at = NOW() + INTERVAL '1 minute',
                diagnostic = NULL, published_at = NULL,
                finalized_at = NULL, updated_at = NOW()
          WHERE reservation_id = $1`,
        [reservationId, revivedToken],
      );
      await transaction.unsafe(
        `UPDATE artifact_publication_batches
            SET state = 'active', owner_instance_id = 'revived-owner',
                lease_token = $1, lease_expires_at = NOW() + INTERVAL '1 minute',
                diagnostic = NULL, finalized_at = NULL, updated_at = NOW()
          WHERE batch_reservation_id = 'batch-offline-resurrection-audit'`,
        [revivedToken],
      );
    });
    for (const statement of [
      "ALTER TABLE artifact_publication_batches ENABLE TRIGGER trg_artifact_publication_batches_immutable",
      "ALTER TABLE artifact_publication_batches ENABLE TRIGGER trg_artifact_publication_batches_complete",
      "ALTER TABLE artifact_publication_reservations ENABLE TRIGGER trg_artifact_publication_reservations_identity_immutable",
      "ALTER TABLE artifact_publication_reservations ENABLE TRIGGER trg_artifact_publication_batch_child_membership",
    ]) await database.sql.unsafe(statement);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
    await rollbackEmptyReleaseStoreRecordLedger(database);
    await assert.rejects(
      auditCurrentArtifactPublicationAuthorityLedgerData(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH"
        && error.message.includes("identity is mismatched"),
    );
  });
});
