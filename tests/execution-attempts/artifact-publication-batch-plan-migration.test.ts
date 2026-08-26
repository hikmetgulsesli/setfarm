import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ARTIFACT_PUBLICATION_BATCH_PLAN_STATEMENTS,
} from "../../src/db/artifact-publication-batch-plan-migration.js";
import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  auditAuthorityV3ContractSpineThroughMigration31V1,
  auditCurrentArtifactPublicationAuthorityLedgerData,
  planContractSpineMigrations,
  rollbackArtifactPublicationBatchPlanLedgerToV25,
  rollbackPlatformReleaseStoreRecordLedgerV3ToV26,
  rollbackRuntimeCompletionManifestAuthorityToV27,
  rollbackOperationalFailureCauseAuthorityV2ToV29,
  rollbackOperationalFailureCauseAuthorityV3ToV30,
  rollbackV3StoryClaimRuntimeBindingToV28,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import {
  ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
  computeArtifactPublicationBatchChildReservationId,
  computeArtifactPublicationBatchIdentityHash,
  type ArtifactPublicationBatchIdentityItem,
} from "../../src/product-compiler/artifact-publication-batch-identity.js";
import {
  ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1,
  computeArtifactStoreBatchPlanIdentityHashV1,
} from "../../src/product-compiler/artifact-store-batch-plan.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const RELEASE_SHA = "a".repeat(40);
const TARGET_RELEASE_SHA = "b".repeat(40);
const producer = Object.freeze({
  pass: "batch-plan-migration-test",
  codeSha: "c".repeat(40),
  toolVersions: Object.freeze({ node: "22" }),
});

async function rollbackEmptyCurrentHeadsToV26(database: TestDatabase): Promise<void> {
  await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
    targetReleaseSha: "8".repeat(40),
  });
  await rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
    targetReleaseSha: "9".repeat(40),
  });
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

function identity(token: string, byteLength = 10): ArtifactPublicationBatchIdentityItem {
  return Object.freeze({
    hash: token.repeat(64),
    artifactType: "setfarm.byte-chunk.v1",
    byteLength,
    producer,
  });
}

async function insertBatch(
  database: TestDatabase,
  suffix: string,
  options: Readonly<{
    includePlan?: boolean;
    tiers?: readonly number[];
    storedTiers?: readonly number[];
    planOrdinals?: readonly number[];
  }> = {},
): Promise<Readonly<{ batchReservationId: string; planIdentityHash: string }>> {
  const artifacts = [identity("a"), identity("b", 11)];
  const tiers = options.tiers ?? [0, 1];
  const planItems = artifacts.map((artifact, index) => ({
    durabilityTier: tiers[index]!,
    identity: artifact,
  })).sort((left, right) => left.durabilityTier - right.durabilityTier
    || left.identity.hash.localeCompare(right.identity.hash));
  const planIdentityHash = computeArtifactStoreBatchPlanIdentityHashV1(planItems);
  const batchReservationId = `batch-plan.${suffix}`;
  const batchIdentityHash = computeArtifactPublicationBatchIdentityHash(artifacts);
  const leaseToken = "APB_00000000-0000-4000-8000-000000000026";
  const now = new Date("2026-07-21T12:00:00.000Z");
  const expiresAt = new Date(now.getTime() + 60_000);

  await database.sql.begin(async (transaction) => {
    await transaction.unsafe(
      `UPDATE public.artifact_capacity
          SET reserved_bytes = reserved_bytes + $1, updated_at = $2
        WHERE capacity_key = 'semantic-artifacts'`,
      [artifacts.reduce((total, artifact) => total + artifact.byteLength, 0), now],
    );
    for (const artifact of artifacts) {
      await transaction.unsafe(
        `INSERT INTO public.artifact_publication_reservations (
           reservation_id, artifact_hash, artifact_type, byte_length,
           producer_metadata, state, owner_instance_id, lease_token,
           lease_expires_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5::text::jsonb, 'reserved',
                   'batch-plan-owner', $6, $7, $8, $8)`,
        [
          computeArtifactPublicationBatchChildReservationId(
            batchReservationId,
            batchIdentityHash,
            artifact.hash,
          ),
          artifact.hash,
          artifact.artifactType,
          artifact.byteLength,
          JSON.stringify(artifact.producer),
          leaseToken,
          expiresAt,
          now,
        ],
      );
    }
    await transaction.unsafe(
      `INSERT INTO public.artifact_publication_batches (
         batch_reservation_id, identity_schema, batch_identity_hash, artifact_count,
         created_by_instance_id, state, owner_instance_id, lease_token,
         lease_expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, 2, 'batch-plan-owner', 'active',
                 'batch-plan-owner', $4, $5, $6, $6)`,
      [
        batchReservationId,
        ARTIFACT_PUBLICATION_BATCH_IDENTITY_SCHEMA,
        batchIdentityHash,
        leaseToken,
        expiresAt,
        now,
      ],
    );
    for (const [ordinal, artifact] of [...artifacts]
      .sort((left, right) => left.hash.localeCompare(right.hash)).entries()) {
      await transaction.unsafe(
        `INSERT INTO public.artifact_publication_batch_items (
           batch_reservation_id, ordinal, artifact_hash, artifact_type,
           byte_length, producer_metadata, reservation_id,
           indexed_artifact_hash, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, NULL, $8)`,
        [
          batchReservationId,
          ordinal,
          artifact.hash,
          artifact.artifactType,
          artifact.byteLength,
          JSON.stringify(artifact.producer),
          computeArtifactPublicationBatchChildReservationId(
            batchReservationId,
            batchIdentityHash,
            artifact.hash,
          ),
          now,
        ],
      );
    }
    if (options.includePlan !== false) {
      await transaction.unsafe(
        `INSERT INTO public.artifact_publication_batch_plans (
           batch_reservation_id, plan_schema, plan_identity_hash, item_count, created_at
         ) VALUES ($1, $2, $3, 2, $4)`,
        [
          batchReservationId,
          ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1,
          planIdentityHash,
          now,
        ],
      );
      for (const [index, item] of planItems.entries()) {
        await transaction.unsafe(
          `INSERT INTO public.artifact_publication_batch_plan_items (
             batch_reservation_id, ordinal, artifact_hash, durability_tier, created_at
           ) VALUES ($1, $2, $3, $4, $5)`,
          [
            batchReservationId,
            options.planOrdinals?.[index] ?? index,
            item.identity.hash,
            options.storedTiers?.[index] ?? item.durabilityTier,
            now,
          ],
        );
      }
    }
  });
  return { batchReservationId, planIdentityHash };
}

describe("artifact publication batch recovery plan migration 26", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
  });

  it("installs, verifies, audits, and rolls an empty exact ledger back to v25", async () => {
    const applied = await applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA });
    assert.equal(
      applied.applied.includes("026_artifact_publication_batch_plan_ledger"),
      true,
    );
    assert.equal(
      (await auditAuthorityV3ContractSpineThroughMigration31V1(database.sql)).status,
      "verified",
    );
    await rollbackEmptyCurrentHeadsToV26(database);
    assert.equal(
      (await auditCurrentArtifactPublicationAuthorityLedgerData(database.sql)).status,
      "verified",
    );
    const rollback = await rollbackArtifactPublicationBatchPlanLedgerToV25(database.sql, {
      targetReleaseSha: TARGET_RELEASE_SHA,
    });
    assert.deepEqual({
      fromVersion: rollback.fromVersion,
      targetVersion: rollback.targetVersion,
      rowsRewritten: rollback.rowsRewritten,
    }, { fromVersion: 26, targetVersion: 25, rowsRewritten: 0 });
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.migrations.find((item) => item.version === 25)?.state, "applied");
    assert.equal(plan.migrations.find((item) => item.version === 26)?.state, "pending");
  });

  it("requires a complete canonical plan in the same commit as every batch", async () => {
    await applyContractSpineMigrations(database.sql);
    await assert.rejects(
      insertBatch(database, "missing-plan", { includePlan: false }),
      /ARTIFACT_PUBLICATION_BATCH_PLAN_MISSING/,
    );
    await assert.rejects(
      insertBatch(database, "tier-gap", { storedTiers: [0, 2] }),
      /ARTIFACT_PUBLICATION_BATCH_PLAN_TIER_MISMATCH/,
    );
    await assert.rejects(
      insertBatch(database, "wrong-order", { planOrdinals: [1, 0] }),
      /ARTIFACT_PUBLICATION_BATCH_PLAN_ORDER_MISMATCH/,
    );
  });

  it("preserves one immutable plan and refuses destructive rollback", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA });
    const inserted = await insertBatch(database, "immutable");
    await assert.rejects(
      database.sql`UPDATE public.artifact_publication_batch_plans
                      SET plan_identity_hash = ${"f".repeat(64)}
                    WHERE batch_reservation_id = ${inserted.batchReservationId}`,
      /ARTIFACT_PUBLICATION_BATCH_PLAN_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`DELETE FROM public.artifact_publication_batch_plan_items
                    WHERE batch_reservation_id = ${inserted.batchReservationId}`,
      /ARTIFACT_PUBLICATION_BATCH_PLAN_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`TRUNCATE TABLE public.artifact_publication_batch_plans CASCADE`,
      /ARTIFACT_PUBLICATION_BATCH_PLAN_IMMUTABLE/,
    );
    await rollbackEmptyCurrentHeadsToV26(database);
    await assert.rejects(
      rollbackArtifactPublicationBatchPlanLedgerToV25(database.sql, {
        targetReleaseSha: TARGET_RELEASE_SHA,
      }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );
  });

  it("rejects migration adoption when legacy migration-23 batch evidence exists", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA });
    await rollbackEmptyCurrentHeadsToV26(database);
    await rollbackArtifactPublicationBatchPlanLedgerToV25(database.sql, {
      targetReleaseSha: TARGET_RELEASE_SHA,
    });
    await insertBatch(database, "legacy", { includePlan: false });
    await assert.rejects(
      applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH"
        && error.message.includes("requires an empty artifact publication batch ledger"),
    );
  });

  it("adopts only an exact empty unjournaled migration-26 shape", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA });
    await rollbackEmptyCurrentHeadsToV26(database);
    await rollbackArtifactPublicationBatchPlanLedgerToV25(database.sql, {
      targetReleaseSha: TARGET_RELEASE_SHA,
    });
    for (const statement of ARTIFACT_PUBLICATION_BATCH_PLAN_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    const before = await planContractSpineMigrations(database.sql);
    assert.equal(before.migrations.find((item) => item.version === 26)?.state, "adoptable");
    const applied = await applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA });
    assert.equal(applied.adopted.includes("026_artifact_publication_batch_plan_ledger"), true);
  });

  it("reports exact function and relation drift as migration 26", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(
      "ALTER TABLE public.artifact_publication_batch_plans ADD COLUMN poison TEXT",
    );
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.find((item) => item.version === 26)?.state, "adoption_mismatch");
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });
});
