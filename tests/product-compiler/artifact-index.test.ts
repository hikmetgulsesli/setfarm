import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  ArtifactIndexError,
  createArtifactIndex as createProductionArtifactIndex,
  createArtifactIndexForTests as createArtifactIndex,
  type ArtifactIdentity,
} from "../../src/product-compiler/artifact-index.js";
import {
  createArtifactPublicationBatchPlanBindingV1,
} from "../../src/product-compiler/artifact-publication-batch-plan-binding.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const producer = Object.freeze({
  pass: "artifact-index-test",
  codeSha: "a".repeat(40),
  toolVersions: Object.freeze({ node: "22", setfarm: "test" }),
});

function artifact(
  token: string,
  byteLength: number,
  artifactType = "setfarm.product-spec.v1",
): ArtifactIdentity {
  return {
    hash: token.repeat(64),
    artifactType,
    byteLength,
    producer,
  };
}

function batchPlan(
  artifacts: readonly ArtifactIdentity[],
  durabilityTiers: readonly number[] = artifacts.map(() => 0),
) {
  assert.equal(durabilityTiers.length, artifacts.length);
  const byHash = new Map<string, Readonly<{
    durabilityTier: number;
    identity: ArtifactIdentity;
  }>>();
  for (let index = 0; index < artifacts.length; index += 1) {
    const identity = artifacts[index]!;
    const durabilityTier = durabilityTiers[index]!;
    const previous = byHash.get(identity.hash);
    if (previous) {
      assert.equal(previous.durabilityTier, durabilityTier);
      continue;
    }
    byHash.set(identity.hash, Object.freeze({ durabilityTier, identity }));
  }
  return createArtifactPublicationBatchPlanBindingV1(
    [...byHash.values()].sort((left, right) =>
      left.durabilityTier - right.durabilityTier
        || (left.identity.hash < right.identity.hash ? -1 : 1)),
  );
}

function at(offsetMs: number): Date {
  return new Date(Date.UTC(2026, 6, 13, 12, 0, 0, offsetMs));
}

describe("durable semantic artifact index", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.reset();
    await database.sql.unsafe(
      `UPDATE artifact_capacity
          SET quota_bytes = 536870912,
              max_payload_bytes = 4194304,
              total_bytes = 0,
              reserved_bytes = 0,
              state = 'bootstrap_required',
              reconciled_at = NULL,
              diagnostic = NULL,
              updated_at = NOW()
        WHERE capacity_key = 'semantic-artifacts'`,
    );
  });

  it("bootstraps from an exact inventory once and fails closed on index/filesystem drift", async () => {
    const index = createArtifactIndex(database.sql);
    const firstArtifact = artifact("a", 20);
    assert.equal((await index.getCapacity()).state, "bootstrap_required");

    const first = await index.bootstrap({
      artifacts: [firstArtifact],
      quotaBytes: 100,
      maxPayloadBytes: 80,
      now: at(0),
    });
    assert.deepEqual({
      state: first.state,
      totalBytes: first.totalBytes,
      reservedBytes: first.reservedBytes,
    }, {
      state: "ready",
      totalBytes: 20,
      reservedBytes: 0,
    });
    assert.deepEqual((await index.getArtifact(firstArtifact.hash))?.producer, producer);
    assert.equal(
      (await index.verifyInventory({ artifacts: [firstArtifact] })).totalBytes,
      firstArtifact.byteLength,
    );
    const semanticColumns = await database.sql<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'semantic_artifacts'
       ORDER BY ordinal_position
    `;
    assert.deepEqual(semanticColumns.map((row) => row.column_name), [
      "artifact_hash",
      "artifact_type",
      "byte_length",
      "producer_metadata",
      "created_at",
    ]);
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO semantic_artifacts (
           artifact_hash, artifact_type, byte_length, producer_metadata
         ) VALUES ($1, 'setfarm.product-spec.v1', 1, $2::text::jsonb)`,
        [
          "9".repeat(64),
          JSON.stringify({ ...producer, unexpected: true }),
        ],
      ),
      /semantic_artifacts_producer_keys_check/,
    );

    const repeated = await index.bootstrap({
      artifacts: [firstArtifact],
      quotaBytes: 100,
      maxPayloadBytes: 80,
      now: at(1),
    });
    assert.equal(repeated.totalBytes, 20);
    await assert.rejects(
      index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(2) }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BOOTSTRAP_MISMATCH",
    );
    assert.equal((await index.getCapacity()).state, "quarantined");
    await assert.rejects(
      index.reservePublication({
        reservationId: "reservation-after-drift",
        artifact: artifact("8", 1),
        ownerInstanceId: "publisher-a",
        now: at(3),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_INDEX_NOT_READY",
    );
  });

  it("verifies exact filesystem identities and capacity accounting without mutating state", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("5", 20);
    await index.bootstrap({ artifacts: [target], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const before = await index.getCapacity();
    await assert.rejects(
      index.verifyInventory({ artifacts: [] }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BOOTSTRAP_MISMATCH",
    );
    await database.sql.unsafe(
      "UPDATE artifact_capacity SET total_bytes = total_bytes + 1 WHERE capacity_key = 'semantic-artifacts'",
    );
    await assert.rejects(
      index.verifyInventory({ artifacts: [target] }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_INDEX_ACCOUNTING_MISMATCH",
    );
    assert.equal((await index.getCapacity()).updatedAt, before.updatedAt);
  });

  it("reserves before publication and settles exact idempotent CAS metadata", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("b", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });

    const reserved = await index.reservePublication({
      reservationId: "reservation-exact",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    assert.equal(reserved.status, "reserved");
    if (reserved.status !== "reserved") return;
    assert.equal((await index.getCapacity()).reservedBytes, 20);

    const repeatedReservation = await index.reservePublication({
      reservationId: "reservation-exact",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(11),
    });
    assert.equal(repeatedReservation.status, "reserved");
    if (repeatedReservation.status !== "reserved") return;
    assert.equal(repeatedReservation.reservation.leaseToken, reserved.reservation.leaseToken);
    assert.equal((await index.getCapacity()).reservedBytes, 20);
    const heartbeat = await index.heartbeatReservation({
      reservationId: "reservation-exact",
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.reservation.leaseToken!,
      leaseMs: 1_000,
      now: at(500),
    });
    assert.notEqual(heartbeat.leaseExpiresAt, reserved.reservation.leaseExpiresAt);

    const published = await index.publish({
      reservationId: "reservation-exact",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.reservation.leaseToken!,
      now: at(501),
    });
    assert.equal(published.created, true);
    const idempotent = await index.publish({
      reservationId: "reservation-exact",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.reservation.leaseToken!,
      now: at(502),
    });
    assert.equal(idempotent.created, false);
    assert.deepEqual({
      totalBytes: (await index.getCapacity()).totalBytes,
      reservedBytes: (await index.getCapacity()).reservedBytes,
    }, { totalBytes: 20, reservedBytes: 0 });
    await assert.rejects(
      database.sql`UPDATE semantic_artifacts SET byte_length = 21 WHERE artifact_hash = ${target.hash}`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`DELETE FROM semantic_artifacts WHERE artifact_hash = ${target.hash}`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );

    const alreadyPublished = await index.reservePublication({
      reservationId: "reservation-after-publish",
      artifact: target,
      ownerInstanceId: "publisher-b",
      now: at(503),
    });
    assert.equal(alreadyPublished.status, "already_published");
    await assert.rejects(
      index.reservePublication({
        reservationId: "reservation-wrong-identity",
        artifact: { ...target, artifactType: "setfarm.story-plan.v1" },
        ownerInstanceId: "publisher-b",
        now: at(504),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_IDENTITY_MISMATCH",
    );
  });

  it("lets the exact live lease owner release a failed publication without waiting for expiry", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("7", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const reserved = await index.reservePublication({
      reservationId: "reservation-owned-release",
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    assert.equal(reserved.status, "reserved");
    if (reserved.status !== "reserved") return;

    await assert.rejects(
      index.finalizeOwnedReservation({
        reservationId: "reservation-owned-release",
        ownerInstanceId: "publisher-b",
        leaseToken: reserved.reservation.leaseToken!,
        resolution: "released",
        diagnostic: "wrong owner",
        now: at(11),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_RESERVATION_LEASE_LOST",
    );
    const released = await index.finalizeOwnedReservation({
      reservationId: "reservation-owned-release",
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.reservation.leaseToken!,
      resolution: "released",
      diagnostic: "filesystem publication failed before index commit",
      now: at(12),
    });
    assert.equal(released.state, "released");
    assert.equal((await index.getCapacity()).reservedBytes, 0);

    const corruptTarget = artifact("6", 10);
    const corrupt = await index.reservePublication({
      reservationId: "reservation-owned-quarantine",
      artifact: corruptTarget,
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(20),
    });
    assert.equal(corrupt.status, "reserved");
    if (corrupt.status !== "reserved") return;
    await index.finalizeOwnedReservation({
      reservationId: "reservation-owned-quarantine",
      ownerInstanceId: "publisher-a",
      leaseToken: corrupt.reservation.leaseToken!,
      resolution: "quarantined",
      diagnostic: "filesystem artifact is corrupt",
      now: at(21),
    });
    const capacity = await index.getCapacity();
    assert.equal(capacity.state, "quarantined");
    assert.equal(capacity.diagnostic, "filesystem artifact is corrupt");
  });

  it("never reuses a finalized reservation id for a different indexed artifact", async () => {
    const index = createArtifactIndex(database.sql);
    const first = artifact("1", 20);
    const second = artifact("2", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    for (const [reservationId, target, offset] of [
      ["immutable-reservation-x", first, 1],
      ["immutable-reservation-y", second, 3],
    ] as const) {
      const reserved = await index.reservePublication({
        reservationId,
        artifact: target,
        ownerInstanceId: "publisher-a",
        leaseMs: 1_000,
        now: at(offset),
      });
      assert.equal(reserved.status, "reserved");
      if (reserved.status !== "reserved") return;
      await index.publish({
        reservationId,
        artifact: target,
        ownerInstanceId: "publisher-a",
        leaseToken: reserved.reservation.leaseToken!,
        now: at(offset + 1),
      });
    }
    await assert.rejects(
      index.reservePublication({
        reservationId: "immutable-reservation-x",
        artifact: second,
        ownerInstanceId: "publisher-a",
        now: at(10),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_IDENTITY_MISMATCH",
    );
  });

  it("fences the quota under concurrent reservations", async () => {
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const results = await Promise.allSettled([
      index.reservePublication({
        reservationId: "reservation-race-a",
        artifact: artifact("c", 60),
        ownerInstanceId: "publisher-a",
        leaseMs: 100,
        now: at(10),
      }),
      index.reservePublication({
        reservationId: "reservation-race-b",
        artifact: artifact("d", 60),
        ownerInstanceId: "publisher-b",
        leaseMs: 100,
        now: at(10),
      }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.ok(rejected.reason instanceof ArtifactIndexError);
    assert.equal(rejected.reason.code, "ARTIFACT_CAPACITY_EXCEEDED");
    assert.equal((await index.getCapacity()).reservedBytes, 60);

    const expired = await index.listExpired(at(111));
    assert.equal(expired.length, 1);
    await index.releaseExpired({ reservationId: expired[0]!.reservationId, now: at(111) });
    assert.equal((await index.getCapacity()).reservedBytes, 0);
  });

  it("reserves a normalized immutable publication batch in one capacity transaction", async () => {
    const index = createArtifactIndex(database.sql);
    const first = artifact("2", 20);
    const second = artifact("1", 30);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });

    const reserved = await index.reservePublicationBatch({
      batchReservationId: "batch-exact",
      artifacts: [first, second, first],
      plan: batchPlan([first, second, first]),
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    assert.equal(reserved.batchCreated, true);
    assert.equal(reserved.state, "active");
    assert.match(reserved.leaseToken!, /^APB_[0-9a-f-]{36}$/);
    assert.equal(reserved.status, "reserved");
    assert.equal(reserved.newlyReservedBytes, 50);
    assert.deepEqual(reserved.items.map((item) => item.artifact.hash), [second.hash, first.hash]);
    assert.equal(reserved.items.every((item) => item.status === "reserved"), true);
    assert.equal(reserved.items.every((item) =>
      item.status === "reserved"
      && /^APRB_[a-f0-9]{64}$/.test(item.reservation.reservationId)
      && item.reservation.leaseToken === reserved.leaseToken
      && item.reservation.leaseExpiresAt === reserved.leaseExpiresAt
      && item.created), true);

    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: "batch-exact",
        artifacts: [second, first],
        plan: batchPlan([second, first]),
        ownerInstanceId: "publisher-b",
        now: at(11),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_LEASE_LOST",
    );

    const replay = await index.reservePublicationBatch({
      batchReservationId: "batch-exact",
      artifacts: [first, first, second],
      plan: batchPlan([first, first, second]),
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.leaseToken,
      leaseMs: 1_000,
      now: at(11),
    });
    assert.equal(replay.batchCreated, false);
    assert.equal(replay.batchIdentityHash, reserved.batchIdentityHash);
    assert.equal(replay.newlyReservedBytes, 0);
    assert.equal(replay.items.every((item) => item.status === "reserved" && !item.created), true);
    assert.equal((await index.getCapacity()).reservedBytes, 50);

    const counts = await database.sql<Array<{ batches: number; items: number; reservations: number }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM artifact_publication_batches) AS batches,
        (SELECT COUNT(*)::integer FROM artifact_publication_batch_items) AS items,
        (SELECT COUNT(*)::integer FROM artifact_publication_reservations) AS reservations
    `;
    assert.deepEqual(counts.map((row) => ({ ...row })), [
      { batches: 1, items: 2, reservations: 2 },
    ]);
    await assert.rejects(
      database.sql`UPDATE artifact_publication_batches SET artifact_count = 1 WHERE batch_reservation_id = 'batch-exact'`,
      /ARTIFACT_PUBLICATION_BATCH_IDENTITY_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`DELETE FROM artifact_publication_batch_items WHERE batch_reservation_id = 'batch-exact'`,
      /ARTIFACT_PUBLICATION_BATCH_IDENTITY_IMMUTABLE/,
    );
  });

  it("persists the exact tier plan and returns one coherent recovery snapshot", async () => {
    const index = createArtifactIndex(database.sql);
    const indexed = artifact("3", 20);
    const pending = artifact("4", 30);
    await index.bootstrap({
      artifacts: [indexed],
      quotaBytes: 100,
      maxPayloadBytes: 80,
      now: at(0),
    });
    const expectedPlan = batchPlan([indexed, pending], [1, 0]);
    const reserved = await index.reservePublicationBatch({
      batchReservationId: "batch-durable-plan",
      artifacts: [indexed, pending],
      plan: expectedPlan,
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    assert.deepEqual(reserved.plan, expectedPlan);

    const rows = await database.sql<Array<{
      plan_schema: string;
      plan_identity_hash: string;
      item_count: number;
      ordinal: number;
      artifact_hash: string;
      durability_tier: number;
      same_created_at: boolean;
    }>>`
      SELECT p.plan_schema, p.plan_identity_hash, p.item_count,
             i.ordinal, i.artifact_hash, i.durability_tier,
             p.created_at = b.created_at AND i.created_at = p.created_at AS same_created_at
        FROM artifact_publication_batches b
        JOIN artifact_publication_batch_plans p USING (batch_reservation_id)
        JOIN artifact_publication_batch_plan_items i USING (batch_reservation_id)
       WHERE b.batch_reservation_id = 'batch-durable-plan'
       ORDER BY i.ordinal
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), expectedPlan.items.map((item, ordinal) => ({
      plan_schema: expectedPlan.schema,
      plan_identity_hash: expectedPlan.planIdentityHash,
      item_count: expectedPlan.items.length,
      ordinal,
      artifact_hash: item.identity.hash,
      durability_tier: item.durabilityTier,
      same_created_at: true,
    })));

    const snapshot = await index.getPublicationBatchRecoverySnapshot({
      batchReservationId: reserved.batchReservationId,
    });
    assert.equal(snapshot.schema, "setfarm.artifact-publication-batch-recovery-snapshot.v1");
    assert.deepEqual(snapshot.plan, expectedPlan);
    assert.equal(snapshot.lifecycle.batchIdentityHash, reserved.batchIdentityHash);
    assert.deepEqual(snapshot.members.map((member) => ({
      ordinal: member.ordinal,
      durabilityTier: member.durabilityTier,
      hash: member.artifact.hash,
      authority: member.authority.kind,
    })), [
      { ordinal: 0, durabilityTier: 0, hash: pending.hash, authority: "reservation" },
      { ordinal: 1, durabilityTier: 1, hash: indexed.hash, authority: "indexed" },
    ]);

    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: reserved.batchReservationId,
        artifacts: [indexed, pending],
        plan: batchPlan([indexed, pending], [0, 1]),
        ownerInstanceId: "publisher-a",
        leaseToken: reserved.leaseToken,
        leaseMs: 1_000,
        now: at(11),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_ID_REUSED",
    );
  });

  it("rejects an invalid recovery plan before any batch authority is written", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("5", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const validPlan = batchPlan([target]);
    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: "batch-invalid-plan",
        artifacts: [target],
        plan: { ...validPlan, planIdentityHash: "0".repeat(64) },
        ownerInstanceId: "publisher-a",
        now: at(10),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_INVALID",
    );
    const counts = await database.sql<Array<{
      batches: number;
      plans: number;
      items: number;
      plan_items: number;
      reservations: number;
    }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM artifact_publication_batches) AS batches,
        (SELECT COUNT(*)::integer FROM artifact_publication_batch_plans) AS plans,
        (SELECT COUNT(*)::integer FROM artifact_publication_batch_items) AS items,
        (SELECT COUNT(*)::integer FROM artifact_publication_batch_plan_items) AS plan_items,
        (SELECT COUNT(*)::integer FROM artifact_publication_reservations) AS reservations
    `;
    assert.deepEqual(counts.map((row) => ({ ...row })), [{
      batches: 0,
      plans: 0,
      items: 0,
      plan_items: 0,
      reservations: 0,
    }]);
  });

  it("tracks mixed and later-published batch members without rewriting membership", async () => {
    const index = createArtifactIndex(database.sql);
    const existing = artifact("3", 20);
    const pending = artifact("4", 30);
    await index.bootstrap({
      artifacts: [existing],
      quotaBytes: 100,
      maxPayloadBytes: 80,
      now: at(0),
    });
    const mixed = await index.reservePublicationBatch({
      batchReservationId: "batch-mixed",
      artifacts: [pending, existing],
      plan: batchPlan([pending, existing]),
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    assert.equal(mixed.status, "partially_published");
    assert.equal(mixed.newlyReservedBytes, 30);
    const pendingItem = mixed.items.find((item) => item.artifact.hash === pending.hash);
    assert.equal(pendingItem?.status, "reserved");
    if (!pendingItem || pendingItem.status !== "reserved") return;

    await index.publishPublicationBatchItem({
      batchReservationId: mixed.batchReservationId,
      reservationId: pendingItem.reservation.reservationId,
      artifact: pending,
      ownerInstanceId: "publisher-a",
      leaseToken: mixed.leaseToken!,
      now: at(11),
    });
    const complete = await index.reservePublicationBatch({
      batchReservationId: "batch-mixed",
      artifacts: [existing, pending],
      plan: batchPlan([existing, pending]),
      ownerInstanceId: "publisher-b",
      now: at(12),
    });
    assert.equal(complete.status, "already_published");
    assert.equal(complete.items.every((item) => item.status === "already_published"), true);
    assert.equal(complete.newlyReservedBytes, 0);
    assert.deepEqual({
      totalBytes: (await index.getCapacity()).totalBytes,
      reservedBytes: (await index.getCapacity()).reservedBytes,
    }, { totalBytes: 50, reservedBytes: 0 });
    const membership = await database.sql<Array<{
      artifact_hash: string;
      reservation_id: string | null;
      indexed_artifact_hash: string | null;
    }>>`
      SELECT artifact_hash, reservation_id, indexed_artifact_hash
        FROM artifact_publication_batch_items
       WHERE batch_reservation_id = 'batch-mixed'
       ORDER BY ordinal
    `;
    assert.deepEqual(membership.map((row) => ({ ...row })), [
      {
        artifact_hash: existing.hash,
        reservation_id: null,
        indexed_artifact_hash: existing.hash,
      },
      {
        artifact_hash: pending.hash,
        reservation_id: pendingItem.reservation.reservationId,
        indexed_artifact_hash: null,
      },
    ]);
  });

  it("records an all-indexed batch as completed without creating a lease", async () => {
    const index = createArtifactIndex(database.sql);
    const first = artifact("3", 20);
    const second = artifact("4", 30);
    await index.bootstrap({
      artifacts: [first, second],
      quotaBytes: 100,
      maxPayloadBytes: 80,
      now: at(0),
    });
    const completed = await index.reservePublicationBatch({
      batchReservationId: "batch-already-indexed",
      artifacts: [second, first],
      plan: batchPlan([second, first]),
      ownerInstanceId: "publisher-a",
      now: at(10),
    });
    assert.equal(completed.state, "completed");
    assert.equal(completed.status, "already_published");
    assert.equal(completed.ownerInstanceId, undefined);
    assert.equal(completed.leaseToken, undefined);
    assert.equal(completed.leaseExpiresAt, undefined);
    assert.equal(completed.newlyReservedBytes, 0);
    assert.equal(completed.items.every((item) => item.status === "already_published"), true);
  });

  it("keeps bounded v22 producer identities with more than 64 tool entries batch-compatible", async () => {
    const index = createArtifactIndex(database.sql);
    const legacyProducer = {
      ...producer,
      toolVersions: Object.fromEntries(
        Array.from({ length: 65 }, (_, item) => [`tool-${item}`, "1"]),
      ),
    };
    const target = { ...artifact("5", 20), producer: legacyProducer };
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const reserved = await index.reservePublicationBatch({
      batchReservationId: "batch-v22-producer-compat",
      artifacts: [target],
      plan: batchPlan([target]),
      ownerInstanceId: "publisher-a",
      now: at(10),
    });
    assert.equal(reserved.status, "reserved");
    assert.deepEqual(reserved.items[0]?.artifact.producer.toolVersions, legacyProducer.toolVersions);
  });

  it("rejects invalid, conflicting, and over-quota batches with zero mutation", async () => {
    const index = createArtifactIndex(database.sql);
    const first = artifact("5", 60);
    const second = artifact("6", 60);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });

    await assert.rejects(
      index.reservePublication({
        reservationId: `APRB_${"a".repeat(64)}`,
        artifact: first,
        ownerInstanceId: "publisher-a",
        now: at(10),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_OPERATION_REQUIRED",
    );

    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: "batch-empty",
        artifacts: [],
        plan: batchPlan([first]),
        ownerInstanceId: "publisher-a",
        now: at(10),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_INVALID",
    );
    let proxyTraps = 0;
    const hostileArtifacts = new Proxy([first], {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error("hostile prototype trap");
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error("hostile ownKeys trap");
      },
    });
    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: "batch-proxy",
        artifacts: hostileArtifacts,
        plan: batchPlan([first]),
        ownerInstanceId: "publisher-a",
        now: at(10),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_INVALID",
    );
    assert.equal(proxyTraps, 0);
    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: "batch-conflict",
        artifacts: [first, { ...first, artifactType: "setfarm.story-plan.v1" }],
        plan: batchPlan([first]),
        ownerInstanceId: "publisher-a",
        now: at(11),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_DUPLICATE_CONFLICT",
    );
    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: "batch-quota",
        artifacts: [first, second],
        plan: batchPlan([first, second]),
        ownerInstanceId: "publisher-a",
        now: at(12),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_CAPACITY_EXCEEDED",
    );
    const counts = await database.sql<Array<{ batches: number; items: number; reservations: number }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM artifact_publication_batches) AS batches,
        (SELECT COUNT(*)::integer FROM artifact_publication_batch_items) AS items,
        (SELECT COUNT(*)::integer FROM artifact_publication_reservations) AS reservations
    `;
    assert.deepEqual(counts.map((row) => ({ ...row })), [
      { batches: 0, items: 0, reservations: 0 },
    ]);
    assert.equal((await index.getCapacity()).reservedBytes, 0);
  });

  it("serializes overlapping batches without leaving a losing partial reservation set", async () => {
    const index = createArtifactIndex(database.sql);
    const shared = artifact("7", 50);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const results = await Promise.allSettled([
      index.reservePublicationBatch({
        batchReservationId: "batch-race-a",
        artifacts: [shared, artifact("8", 20)],
        plan: batchPlan([shared, artifact("8", 20)]),
        ownerInstanceId: "publisher-a",
        leaseMs: 1_000,
        now: at(10),
      }),
      index.reservePublicationBatch({
        batchReservationId: "batch-race-b",
        artifacts: [shared, artifact("9", 20)],
        plan: batchPlan([shared, artifact("9", 20)]),
        ownerInstanceId: "publisher-b",
        leaseMs: 1_000,
        now: at(10),
      }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.ok(rejected.reason instanceof ArtifactIndexError);
    assert.equal(rejected.reason.code, "ARTIFACT_RESERVATION_BUSY");
    const counts = await database.sql<Array<{ batches: number; items: number; reservations: number }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM artifact_publication_batches) AS batches,
        (SELECT COUNT(*)::integer FROM artifact_publication_batch_items) AS items,
        (SELECT COUNT(*)::integer FROM artifact_publication_reservations) AS reservations
    `;
    assert.deepEqual(counts.map((row) => ({ ...row })), [
      { batches: 1, items: 2, reservations: 2 },
    ]);
    assert.equal((await index.getCapacity()).reservedBytes, 70);
  });

  it("fences every batch child behind one aggregate heartbeat and recovery API", async () => {
    const index = createArtifactIndex(database.sql);
    const first = artifact("7", 20);
    const second = artifact("8", 30);
    const liveBase = new Date();
    const liveAt = (offsetMs: number) => new Date(liveBase.getTime() + offsetMs);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const batch = await index.reservePublicationBatch({
      batchReservationId: "batch-aggregate-heartbeat",
      artifacts: [first, second],
      plan: batchPlan([first, second]),
      ownerInstanceId: "publisher-a",
      leaseMs: 60_000,
      now: liveAt(10),
    });
    const children = batch.items.filter((item) => item.status === "reserved");
    assert.equal(children.length, 2);
    const child = children[0]!;
    for (const operation of [
      () => index.reservePublication({
        reservationId: child.reservation.reservationId,
        artifact: child.artifact,
        ownerInstanceId: "publisher-a",
        now: liveAt(20),
      }),
      () => index.heartbeatReservation({
        reservationId: child.reservation.reservationId,
        ownerInstanceId: "publisher-a",
        leaseToken: batch.leaseToken!,
        now: liveAt(20),
      }),
      () => index.finalizeOwnedReservation({
        reservationId: child.reservation.reservationId,
        ownerInstanceId: "publisher-a",
        leaseToken: batch.leaseToken!,
        resolution: "released" as const,
        diagnostic: "must be aggregate",
        now: liveAt(20),
      }),
      () => index.publish({
        reservationId: child.reservation.reservationId,
        artifact: child.artifact,
        ownerInstanceId: "publisher-a",
        leaseToken: batch.leaseToken!,
        now: liveAt(20),
      }),
      () => index.adoptExpired({
        reservationId: child.reservation.reservationId,
        artifact: child.artifact,
        ownerInstanceId: "publisher-b",
        now: liveAt(60_021),
      }),
      () => index.releaseExpired({
        reservationId: child.reservation.reservationId,
        now: liveAt(60_021),
      }),
      () => index.quarantineExpired({
        reservationId: child.reservation.reservationId,
        diagnostic: "must be aggregate",
        now: liveAt(60_021),
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ArtifactIndexError
          && error.code === "ARTIFACT_BATCH_OPERATION_REQUIRED",
      );
    }

    const heartbeat = await index.heartbeatPublicationBatch({
      batchReservationId: batch.batchReservationId,
      ownerInstanceId: "publisher-a",
      leaseToken: batch.leaseToken!,
      leaseMs: 60_000,
      now: liveAt(20),
    });
    const live = heartbeat.reservations.filter((reservation) => reservation.state === "reserved");
    assert.equal(live.length, 2);
    assert.equal(live.every((reservation) =>
      reservation.ownerInstanceId === heartbeat.ownerInstanceId
      && reservation.leaseToken === heartbeat.leaseToken
      && reservation.leaseExpiresAt === heartbeat.leaseExpiresAt), true);
    assert.deepEqual((await index.listExpired(liveAt(60_021))).map((item) => item.reservationId), []);
    assert.deepEqual(
      (await index.listExpiredPublicationBatches(liveAt(60_021)))
        .map((item) => item.batchReservationId),
      [batch.batchReservationId],
    );
    await assert.rejects(
      index.listExpiredPublicationBatches(liveAt(60_021), 0),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_INVALID",
    );
  });

  it("lets exactly one concurrent adopter rotate every remaining batch child", async () => {
    const index = createArtifactIndex(database.sql);
    const first = artifact("7", 20);
    const second = artifact("8", 30);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const batch = await index.reservePublicationBatch({
      batchReservationId: "batch-concurrent-adoption",
      artifacts: [first, second],
      plan: batchPlan([first, second]),
      ownerInstanceId: "dead-owner",
      leaseMs: 100,
      now: at(10),
    });
    const recoveryNow = new Date();
    const results = await Promise.allSettled([
      index.adoptExpiredPublicationBatch({
        batchReservationId: batch.batchReservationId,
        batchIdentityHash: batch.batchIdentityHash,
        expectedLeaseToken: batch.leaseToken!,
        expectedLeaseExpiresAt: batch.leaseExpiresAt!,
        ownerInstanceId: "recovery-a",
        leaseMs: 60_000,
        now: recoveryNow,
      }),
      index.adoptExpiredPublicationBatch({
        batchReservationId: batch.batchReservationId,
        batchIdentityHash: batch.batchIdentityHash,
        expectedLeaseToken: batch.leaseToken!,
        expectedLeaseExpiresAt: batch.leaseExpiresAt!,
        ownerInstanceId: "recovery-b",
        leaseMs: 60_000,
        now: recoveryNow,
      }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const winner = results.find((result) => result.status === "fulfilled");
    assert.ok(winner?.status === "fulfilled");
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.ok(rejected.reason instanceof ArtifactIndexError);
    assert.equal(rejected.reason.code, "ARTIFACT_BATCH_LEASE_LOST");
    assert.equal(winner.value.reservations.every((reservation) =>
      reservation.state !== "reserved"
      || (
        reservation.ownerInstanceId === winner.value.ownerInstanceId
        && reservation.leaseToken === winner.value.leaseToken
        && reservation.leaseExpiresAt === winner.value.leaseExpiresAt
      )), true);
  });

  it("fences expired finalization to the exact observed lease generation", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("6", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const recoveryNow = new Date();
    const originalNow = new Date(recoveryNow.getTime() - 120_000);
    const original = await index.reservePublicationBatch({
      batchReservationId: "batch-stale-expired-finalize-generation",
      artifacts: [target],
      plan: batchPlan([target]),
      ownerInstanceId: "publisher-a",
      leaseMs: 100,
      now: originalNow,
    });
    const staleObservation = (await index.listExpiredPublicationBatches(recoveryNow))[0]!;
    assert.equal(staleObservation.leaseToken, original.leaseToken);

    const adopted = await index.adoptExpiredPublicationBatch({
      batchReservationId: original.batchReservationId,
      batchIdentityHash: original.batchIdentityHash,
      expectedLeaseToken: staleObservation.leaseToken!,
      expectedLeaseExpiresAt: staleObservation.leaseExpiresAt!,
      ownerInstanceId: "recovery-b",
      leaseMs: 60_000,
      now: recoveryNow,
    });
    assert.notEqual(adopted.leaseToken, staleObservation.leaseToken);
    const adoptedExpiredNow = new Date(recoveryNow.getTime() + 60_001);

    await assert.rejects(
      index.adoptExpiredPublicationBatch({
        batchReservationId: staleObservation.batchReservationId,
        batchIdentityHash: staleObservation.batchIdentityHash,
        expectedLeaseToken: staleObservation.leaseToken!,
        expectedLeaseExpiresAt: staleObservation.leaseExpiresAt!,
        ownerInstanceId: "stale-recovery-owner",
        leaseMs: 60_000,
        now: adoptedExpiredNow,
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_LEASE_LOST",
    );

    await assert.rejects(
      index.finalizeExpiredPublicationBatch({
        batchReservationId: staleObservation.batchReservationId,
        batchIdentityHash: staleObservation.batchIdentityHash,
        expectedLeaseToken: staleObservation.leaseToken!,
        expectedLeaseExpiresAt: staleObservation.leaseExpiresAt!,
        resolution: "released",
        diagnostic: `stale observation ${staleObservation.leaseToken}`,
        now: adoptedExpiredNow,
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_LEASE_LOST",
    );
    const afterStale = (await index.listExpiredPublicationBatches(adoptedExpiredNow))[0]!;
    assert.equal(afterStale.state, "active");
    assert.equal(afterStale.leaseToken, adopted.leaseToken);
    assert.equal((await index.getCapacity()).reservedBytes, 20);

    const released = await index.finalizeExpiredPublicationBatch({
      batchReservationId: afterStale.batchReservationId,
      batchIdentityHash: afterStale.batchIdentityHash,
      expectedLeaseToken: afterStale.leaseToken!,
      expectedLeaseExpiresAt: afterStale.leaseExpiresAt!,
      resolution: "released",
      diagnostic: `fresh observation ${afterStale.leaseToken}`,
      now: adoptedExpiredNow,
    });
    assert.equal(released.state, "released");
    assert.equal(released.reservations[0]?.state, "released");
    assert.equal((await index.getCapacity()).reservedBytes, 0);
  });

  it("recovers a partially published batch without reviving the stale owner", async () => {
    const index = createArtifactIndex(database.sql);
    const first = artifact("7", 20);
    const second = artifact("8", 30);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const batch = await index.reservePublicationBatch({
      batchReservationId: "batch-partial-recovery",
      artifacts: [first, second],
      plan: batchPlan([first, second]),
      ownerInstanceId: "publisher-a",
      leaseMs: 100,
      now: at(10),
    });
    const reserved = batch.items.filter((item) => item.status === "reserved");
    const firstItem = reserved.find((item) => item.artifact.hash === first.hash)!;
    const secondItem = reserved.find((item) => item.artifact.hash === second.hash)!;
    const firstPublish = await index.publishPublicationBatchItem({
      batchReservationId: batch.batchReservationId,
      reservationId: firstItem.reservation.reservationId,
      artifact: first,
      ownerInstanceId: "publisher-a",
      leaseToken: batch.leaseToken!,
      now: at(20),
    });
    assert.equal(firstPublish.batchState, "active");
    const partialSnapshot = await index.getPublicationBatchRecoverySnapshot({
      batchReservationId: batch.batchReservationId,
    });
    assert.equal(
      partialSnapshot.members.find((member) => member.artifact.hash === first.hash)?.authority.kind,
      "indexed",
    );
    assert.equal(
      partialSnapshot.members.find((member) => member.artifact.hash === second.hash)?.authority.kind,
      "reservation",
    );
    const recoveryNow = new Date();
    const adopted = await index.adoptExpiredPublicationBatch({
      batchReservationId: batch.batchReservationId,
      batchIdentityHash: batch.batchIdentityHash,
      expectedLeaseToken: batch.leaseToken!,
      expectedLeaseExpiresAt: batch.leaseExpiresAt!,
      ownerInstanceId: "recovery-owner",
      leaseMs: 60_000,
      now: recoveryNow,
    });
    const recoveryPublishNow = new Date(recoveryNow.getTime() + 1);
    await assert.rejects(
      index.publishPublicationBatchItem({
        batchReservationId: batch.batchReservationId,
        reservationId: secondItem.reservation.reservationId,
        artifact: second,
        ownerInstanceId: "publisher-a",
        leaseToken: batch.leaseToken!,
        now: recoveryPublishNow,
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_LEASE_LOST",
    );
    const completed = await index.publishPublicationBatchItem({
      batchReservationId: batch.batchReservationId,
      reservationId: secondItem.reservation.reservationId,
      artifact: second,
      ownerInstanceId: "recovery-owner",
      leaseToken: adopted.leaseToken!,
      now: recoveryPublishNow,
    });
    assert.equal(completed.batchState, "completed");
    const replay = await index.reservePublicationBatch({
      batchReservationId: batch.batchReservationId,
      artifacts: [second, first],
      plan: batchPlan([second, first]),
      ownerInstanceId: "read-only-replay",
      now: new Date(recoveryPublishNow.getTime() + 1),
    });
    assert.equal(replay.state, "completed");
    assert.equal(replay.items.every((item) => item.status === "already_published"), true);
    assert.deepEqual({
      totalBytes: (await index.getCapacity()).totalBytes,
      reservedBytes: (await index.getCapacity()).reservedBytes,
    }, { totalBytes: 50, reservedBytes: 0 });
  });

  it("rejects resurrecting a published batch child under the still-live aggregate fence", async () => {
    const index = createArtifactIndex(database.sql);
    const first = artifact("7", 20);
    const second = artifact("8", 30);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const batch = await index.reservePublicationBatch({
      batchReservationId: "batch-published-child-resurrection",
      artifacts: [first, second],
      plan: batchPlan([first, second]),
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    const firstItem = batch.items.find((item) =>
      item.status === "reserved" && item.artifact.hash === first.hash);
    assert.ok(firstItem?.status === "reserved");
    await index.publishPublicationBatchItem({
      batchReservationId: batch.batchReservationId,
      reservationId: firstItem.reservation.reservationId,
      artifact: first,
      ownerInstanceId: "publisher-a",
      leaseToken: batch.leaseToken!,
      now: at(20),
    });
    await assert.rejects(
      database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          `UPDATE artifact_capacity
              SET reserved_bytes = reserved_bytes + $1,
                  updated_at = $2
            WHERE capacity_key = 'semantic-artifacts'`,
          [first.byteLength, at(30)],
        );
        await transaction.unsafe(
          `UPDATE artifact_publication_reservations
              SET state = 'reserved', owner_instance_id = $2,
                  lease_token = $3, lease_expires_at = $4,
                  diagnostic = NULL, published_at = NULL,
                  finalized_at = NULL, updated_at = $5
            WHERE reservation_id = $1`,
          [
            firstItem.reservation.reservationId,
            batch.ownerInstanceId!,
            batch.leaseToken!,
            batch.leaseExpiresAt!,
            at(30),
          ],
        );
      }),
      /ARTIFACT_PUBLICATION_RESERVATION_TERMINAL_IMMUTABLE/,
    );
  });

  it("linearizes last publish against aggregate release", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("9", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const batch = await index.reservePublicationBatch({
      batchReservationId: "batch-publish-release-race",
      artifacts: [target],
      plan: batchPlan([target]),
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    const item = batch.items[0];
    assert.equal(item?.status, "reserved");
    if (!item || item.status !== "reserved") return;
    const results = await Promise.allSettled([
      index.publishPublicationBatchItem({
        batchReservationId: batch.batchReservationId,
        reservationId: item.reservation.reservationId,
        artifact: target,
        ownerInstanceId: "publisher-a",
        leaseToken: batch.leaseToken!,
        now: at(20),
      }),
      index.finalizeOwnedPublicationBatch({
        batchReservationId: batch.batchReservationId,
        ownerInstanceId: "publisher-a",
        leaseToken: batch.leaseToken!,
        resolution: "released",
        diagnostic: "publisher aborted",
        now: at(20),
      }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rows = await database.sql<Array<{ batch_state: string; child_state: string }>>`
      SELECT b.state AS batch_state, r.state AS child_state
        FROM artifact_publication_batches b
        JOIN artifact_publication_batch_items i USING (batch_reservation_id)
        JOIN artifact_publication_reservations r ON r.reservation_id = i.reservation_id
       WHERE b.batch_reservation_id = 'batch-publish-release-race'
    `;
    assert.equal(
      (rows[0]?.batch_state === "completed" && rows[0]?.child_state === "published")
      || (rows[0]?.batch_state === "released" && rows[0]?.child_state === "released"),
      true,
    );
    const capacity = await index.getCapacity();
    assert.equal(capacity.reservedBytes, 0);
    assert.equal(capacity.totalBytes, rows[0]?.batch_state === "completed" ? 20 : 0);
  });

  it("rejects direct split-owner child mutation and terminal batch mutation", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("9", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const batch = await index.reservePublicationBatch({
      batchReservationId: "batch-database-coherence",
      artifacts: [target],
      plan: batchPlan([target]),
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    const item = batch.items[0];
    assert.equal(item?.status, "reserved");
    if (!item || item.status !== "reserved") return;
    await assert.rejects(
      database.sql`
        UPDATE artifact_publication_reservations
           SET owner_instance_id = 'split-owner'
         WHERE reservation_id = ${item.reservation.reservationId}
      `,
      /ARTIFACT_PUBLICATION_BATCH_CHILD_STATE_INCOHERENT/,
    );
    await index.publishPublicationBatchItem({
      batchReservationId: batch.batchReservationId,
      reservationId: item.reservation.reservationId,
      artifact: target,
      ownerInstanceId: "publisher-a",
      leaseToken: batch.leaseToken!,
      now: at(20),
    });
    await assert.rejects(
      database.sql`
        UPDATE artifact_publication_batches
           SET diagnostic = 'mutated', updated_at = updated_at + INTERVAL '1 second'
         WHERE batch_reservation_id = ${batch.batchReservationId}
      `,
      /ARTIFACT_PUBLICATION_BATCH_TERMINAL_IMMUTABLE/,
    );
  });

  it("uses PostgreSQL time for every production lease fence despite caller clock skew", async () => {
    const index = createProductionArtifactIndex(database.sql);
    const target = artifact("6", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80 });
    const reserved = await index.reservePublicationBatch({
      batchReservationId: "batch-database-clock",
      artifacts: [target],
      plan: batchPlan([target]),
      ownerInstanceId: "stale-owner",
      leaseMs: 60_000,
      now: new Date("2099-01-01T00:00:00.000Z"),
    });
    const item = reserved.items[0];
    assert.equal(item?.status, "reserved");
    if (!item || item.status !== "reserved") return;
    const clockRows = await database.sql<Array<{
      now: Date;
      lease_expires_at: Date;
    }>>`
      SELECT clock_timestamp() AS now, lease_expires_at
        FROM artifact_publication_reservations
       WHERE reservation_id = ${item.reservation.reservationId}
    `;
    assert.ok(clockRows[0]!.lease_expires_at.getTime() > clockRows[0]!.now.getTime());
    assert.ok(
      clockRows[0]!.lease_expires_at.getTime() - clockRows[0]!.now.getTime() <= 60_000,
    );

    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      DISABLE TRIGGER trg_artifact_publication_batches_immutable
    `);
    await database.sql.begin(async (transaction) => {
      const expiryRows = await transaction.unsafe<Array<{ lease_expires_at: Date }>>(
        `UPDATE artifact_publication_batches
            SET lease_expires_at = updated_at + INTERVAL '1 millisecond'
          WHERE batch_reservation_id = $1
          RETURNING lease_expires_at`,
        [reserved.batchReservationId],
      );
      await transaction.unsafe(
        `UPDATE artifact_publication_reservations
            SET lease_expires_at = $2
          WHERE reservation_id = $1`,
        [item.reservation.reservationId, expiryRows[0]!.lease_expires_at],
      );
    });
    await database.sql.unsafe(`
      ALTER TABLE artifact_publication_batches
      ENABLE TRIGGER trg_artifact_publication_batches_immutable
    `);
    await assert.rejects(
      index.publish({
        reservationId: item.reservation.reservationId,
        artifact: target,
        ownerInstanceId: "stale-owner",
        leaseToken: item.reservation.leaseToken!,
        now: new Date("1970-01-01T00:00:00.000Z"),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_OPERATION_REQUIRED",
    );
    assert.deepEqual(
      (await index.listExpired(new Date("1970-01-01T00:00:00.000Z")))
        .map((reservation) => reservation.reservationId),
      [],
    );
    const expiredBatch = (
      await index.listExpiredPublicationBatches(new Date("1970-01-01T00:00:00.000Z"))
    )[0]!;
    assert.equal(expiredBatch.batchReservationId, reserved.batchReservationId);
    const adopted = await index.adoptExpiredPublicationBatch({
      batchReservationId: reserved.batchReservationId,
      batchIdentityHash: reserved.batchIdentityHash,
      expectedLeaseToken: expiredBatch.leaseToken!,
      expectedLeaseExpiresAt: expiredBatch.leaseExpiresAt!,
      ownerInstanceId: "recovery-owner",
      leaseMs: 60_000,
      now: new Date("2099-01-01T00:00:00.000Z"),
    });
    const afterAdoption = await database.sql<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS now
    `;
    assert.ok(new Date(adopted.leaseExpiresAt!).getTime() - afterAdoption[0]!.now.getTime() <= 60_000);
    assert.equal(
      adopted.reservations.find((reservation) => reservation.state === "reserved")?.leaseToken,
      adopted.leaseToken,
    );
  });

  it("refreshes a production creation lease after item-table lock latency", async () => {
    const index = createProductionArtifactIndex(database.sql);
    const target = artifact("5", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80 });

    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    let releaseTable!: () => void;
    const tableReleased = new Promise<void>((resolve) => {
      releaseTable = resolve;
    });
    const blocker = database.sql.begin(async (transaction) => {
      await transaction.unsafe(
        "LOCK TABLE artifact_publication_batch_items IN ACCESS EXCLUSIVE MODE",
      );
      signalLocked();
      await tableReleased;
    });
    await locked;
    const pending = index.reservePublicationBatch({
      batchReservationId: "batch-production-creation-refresh",
      artifacts: [target],
      plan: batchPlan([target]),
      ownerInstanceId: "publisher-a",
      leaseMs: 5_000,
    });
    await new Promise((resolve) => setTimeout(resolve, 5_200));
    releaseTable();
    await blocker;

    const reserved = await pending;
    const item = reserved.items[0];
    assert.equal(item?.status, "reserved");
    if (!item || item.status !== "reserved") return;
    const clockRows = await database.sql<Array<{
      now: Date;
      header_expires_at: Date;
      child_expires_at: Date;
    }>>`
      SELECT clock_timestamp() AS now,
             b.lease_expires_at AS header_expires_at,
             r.lease_expires_at AS child_expires_at
        FROM artifact_publication_batches b
        JOIN artifact_publication_batch_items i USING (batch_reservation_id)
        JOIN artifact_publication_reservations r ON r.reservation_id = i.reservation_id
       WHERE b.batch_reservation_id = 'batch-production-creation-refresh'
    `;
    assert.ok(clockRows[0]!.header_expires_at.getTime() > clockRows[0]!.now.getTime());
    assert.ok(
      clockRows[0]!.header_expires_at.getTime() - clockRows[0]!.now.getTime() <= 5_000,
    );
    assert.equal(
      clockRows[0]!.child_expires_at.toISOString(),
      clockRows[0]!.header_expires_at.toISOString(),
    );
  });

  it("rejects a production replay whose lease expires while aggregate locks are acquired", async () => {
    const index = createProductionArtifactIndex(database.sql);
    const target = artifact("7", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80 });
    const reserved = await index.reservePublicationBatch({
      batchReservationId: "batch-production-stale-replay",
      artifacts: [target],
      plan: batchPlan([target]),
      ownerInstanceId: "publisher-a",
      leaseMs: 5_000,
    });
    const item = reserved.items[0];
    assert.equal(item?.status, "reserved");
    if (!item || item.status !== "reserved") return;

    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    let releaseChild!: () => void;
    const childReleased = new Promise<void>((resolve) => {
      releaseChild = resolve;
    });
    const blocker = database.sql.begin(async (transaction) => {
      await transaction.unsafe(
        `SELECT reservation_id
           FROM artifact_publication_reservations
          WHERE reservation_id = $1
          FOR UPDATE`,
        [item.reservation.reservationId],
      );
      signalLocked();
      await childReleased;
    });
    await locked;
    const replayOutcome = index.reservePublicationBatch({
      batchReservationId: reserved.batchReservationId,
      artifacts: [target],
      plan: batchPlan([target]),
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.leaseToken,
      leaseMs: 5_000,
    }).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason }),
    );
    const waitForExpiry = Math.max(
      0,
      new Date(reserved.leaseExpiresAt!).getTime() - Date.now() + 200,
    );
    await new Promise((resolve) => setTimeout(resolve, waitForExpiry));
    releaseChild();
    await blocker;
    const outcome = await replayOutcome;
    assert.equal(outcome.status, "rejected");
    if (outcome.status !== "rejected") return;
    assert.ok(outcome.reason instanceof ArtifactIndexError);
    assert.equal(outcome.reason.code, "ARTIFACT_BATCH_LEASE_LOST");
  });

  it("fails closed when a batch id is reused or its durable child set becomes terminal", async () => {
    const index = createArtifactIndex(database.sql);
    const target = artifact("a", 20);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const reserved = await index.reservePublicationBatch({
      batchReservationId: "batch-terminal",
      artifacts: [target],
      plan: batchPlan([target]),
      ownerInstanceId: "publisher-a",
      leaseMs: 1_000,
      now: at(10),
    });
    const item = reserved.items[0];
    assert.equal(item?.status, "reserved");
    if (!item || item.status !== "reserved") return;

    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: "batch-terminal",
        artifacts: [artifact("b", 20)],
        plan: batchPlan([artifact("b", 20)]),
        ownerInstanceId: "publisher-a",
        now: at(11),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_ID_REUSED",
    );
    const released = await index.finalizeOwnedPublicationBatch({
      batchReservationId: reserved.batchReservationId,
      ownerInstanceId: "publisher-a",
      leaseToken: reserved.leaseToken!,
      resolution: "released",
      diagnostic: "publication failed",
      now: at(12),
    });
    assert.equal(released.state, "released");
    assert.equal(released.reservations[0]?.state, "released");
    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: "batch-terminal",
        artifacts: [target],
        plan: batchPlan([target]),
        ownerInstanceId: "publisher-a",
        now: at(13),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_TERMINAL",
    );
    assert.equal((await index.getCapacity()).reservedBytes, 0);

    const independent = await index.reservePublication({
      reservationId: "reservation-after-batch-release",
      artifact: target,
      ownerInstanceId: "publisher-b",
      leaseMs: 1_000,
      now: at(14),
    });
    assert.equal(independent.status, "reserved");
    if (independent.status !== "reserved") return;
    await index.publish({
      reservationId: independent.reservation.reservationId,
      artifact: target,
      ownerInstanceId: "publisher-b",
      leaseToken: independent.reservation.leaseToken!,
      now: at(15),
    });
    await assert.rejects(
      index.reservePublicationBatch({
        batchReservationId: "batch-terminal",
        artifacts: [target],
        plan: batchPlan([target]),
        ownerInstanceId: "publisher-a",
        now: at(16),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_TERMINAL",
    );
  });

  it("adopts, releases, and quarantines only expired reservations without changing total bytes", async () => {
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(0) });
    const firstArtifact = artifact("e", 30);
    const first = await index.reservePublication({
      reservationId: "reservation-adopt",
      artifact: firstArtifact,
      ownerInstanceId: "dead-owner",
      leaseMs: 100,
      now: at(10),
    });
    await index.reservePublication({
      reservationId: "reservation-release",
      artifact: artifact("f", 25),
      ownerInstanceId: "dead-owner",
      leaseMs: 100,
      now: at(10),
    });
    assert.equal(first.status, "reserved");
    await assert.rejects(
      index.bootstrap({ artifacts: [], quotaBytes: 100, maxPayloadBytes: 80, now: at(50) }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BOOTSTRAP_ACTIVE_RESERVATIONS",
    );
    assert.equal((await index.getCapacity()).reservedBytes, 55);
    const adopted = await index.adoptExpired({
      reservationId: "reservation-adopt",
      artifact: firstArtifact,
      ownerInstanceId: "recovery-owner",
      leaseMs: 100,
      now: at(111),
    });
    assert.equal(adopted.ownerInstanceId, "recovery-owner");
    assert.notEqual(adopted.leaseToken, first.status === "reserved" ? first.reservation.leaseToken : undefined);
    await assert.rejects(
      index.releaseExpired({ reservationId: "reservation-adopt", now: at(112) }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_RESERVATION_NOT_EXPIRED",
    );
    const quarantined = await index.quarantineExpired({
      reservationId: "reservation-adopt",
      diagnostic: "published bytes could not be verified",
      now: at(212),
    });
    assert.equal(quarantined.state, "quarantined");
    assert.deepEqual({
      totalBytes: (await index.getCapacity()).totalBytes,
      reservedBytes: (await index.getCapacity()).reservedBytes,
    }, { totalBytes: 0, reservedBytes: 25 });
    assert.equal((await index.getCapacity()).state, "quarantined");

    const released = await index.releaseExpired({
      reservationId: "reservation-release",
      diagnostic: "no target file exists",
      now: at(212),
    });
    assert.equal(released.state, "released");
    assert.equal((await index.getCapacity()).reservedBytes, 0);
  });

  it("seals immutable run refs and one packet without mutating runs.packet_hash", async () => {
    const index = createArtifactIndex(database.sql);
    const packetA = artifact("1", 40, "setfarm.product-build-packet.v1");
    const packetB = artifact("2", 45, "setfarm.product-build-packet.v1");
    const child = artifact("3", 15);
    await index.bootstrap({
      artifacts: [packetA, packetB, child],
      quotaBytes: 200,
      maxPayloadBytes: 100,
      now: at(0),
    });
    await database.insertRun("artifact-index-run");

    const ref = await index.addRunArtifactRef({
      runId: "artifact-index-run",
      refKey: "PRODUCT_SPEC",
      artifactHash: child.hash,
      now: at(10),
    });
    assert.equal(ref.created, true);
    assert.equal((await index.addRunArtifactRef({
      runId: "artifact-index-run",
      refKey: "PRODUCT_SPEC",
      artifactHash: child.hash,
      now: at(11),
    })).created, false);
    assert.deepEqual(await index.getRunArtifactRef("artifact-index-run", "PRODUCT_SPEC"), {
      runId: "artifact-index-run",
      refKey: "PRODUCT_SPEC",
      artifactHash: child.hash,
      artifactType: child.artifactType,
      createdAt: at(10).toISOString(),
    });
    assert.deepEqual((await index.listRunArtifactRefs("artifact-index-run")).map((item) => item.refKey), [
      "PRODUCT_SPEC",
    ]);
    assert.equal(await index.getRunArtifactRef("artifact-index-run", "STORY_PLAN"), undefined);
    await assert.rejects(
      index.addRunArtifactRef({
        runId: "artifact-index-run",
        refKey: "PRODUCT_SPEC",
        artifactHash: packetA.hash,
        now: at(12),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "RUN_ARTIFACT_REF_CONFLICT",
    );

    const compiler = { version: "3.0.0", codeSha: "b".repeat(40) };
    assert.equal((await index.sealProductPacket({
      runId: "artifact-index-run",
      packetHash: packetA.hash,
      compiler,
      now: at(20),
    })).created, true);
    assert.equal((await index.sealProductPacket({
      runId: "artifact-index-run",
      packetHash: packetA.hash,
      compiler,
      now: at(21),
    })).created, false);
    await assert.rejects(
      index.sealProductPacket({
        runId: "artifact-index-run",
        packetHash: packetB.hash,
        compiler,
        now: at(22),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "PRODUCT_PACKET_SEAL_CONFLICT",
    );
    const runs = await database.sql<Array<{ packet_hash: string | null }>>`
      SELECT packet_hash FROM runs WHERE id = 'artifact-index-run'
    `;
    assert.equal(runs[0]?.packet_hash, null);

    await assert.rejects(
      database.sql`UPDATE product_packets SET packet_hash = ${packetB.hash} WHERE run_id = 'artifact-index-run'`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql`UPDATE run_artifact_refs SET artifact_hash = ${packetA.hash} WHERE run_id = 'artifact-index-run'`,
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    await database.insertRun("artifact-index-run-invalid");
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata)
         VALUES ('artifact-index-run-invalid', $1, $2::text::jsonb)`,
        [packetA.hash, JSON.stringify({ ...compiler, extra: true })],
      ),
      /product_packets_compiler_keys_check/,
    );
  });

  it("atomically activates the exact canonical packet refs before any v3 attempt", async () => {
    const index = createArtifactIndex(database.sql);
    const refs = {
      PRODUCT_SPEC: artifact("a", 10, "setfarm.product-spec.v1"),
      DESIGN_GRAPH: artifact("b", 10, "setfarm.design-interaction-graph.v1"),
      BUILD_TOPOLOGY: artifact("c", 10, "setfarm.build-topology.v1"),
      STORY_PLAN: artifact("d", 10, "setfarm.story-plan.v1"),
      PRODUCT_BUILD_PACKET: artifact("e", 10, "setfarm.product-build-packet.v1"),
      COMPILATION_REPORT: artifact("f", 10, "setfarm.product-compilation-report.v1"),
    } as const;
    await index.bootstrap({
      artifacts: Object.values(refs),
      quotaBytes: 200,
      maxPayloadBytes: 100,
      now: at(0),
    });
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(producer.codeSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        'packet-activation-run', 'feature-dev', 'packet activation', 'running', 'v3',
        ${producer.codeSha}, ${"9".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    const hashes = Object.fromEntries(
      Object.entries(refs).map(([key, value]) => [key, value.hash]),
    ) as Record<keyof typeof refs, string>;
    const compiler = { version: "3.0.0", codeSha: producer.codeSha };

    const activated = await index.activateProductPacket({
      runId: "packet-activation-run",
      packetHash: refs.PRODUCT_BUILD_PACKET.hash,
      compiler,
      artifactRefs: hashes,
      now: at(10),
    });
    assert.equal(activated.created, true);
    const repeated = await index.activateProductPacket({
      runId: "packet-activation-run",
      packetHash: refs.PRODUCT_BUILD_PACKET.hash,
      compiler,
      artifactRefs: hashes,
      now: at(11),
    });
    assert.equal(repeated.created, false);
    const rows = await database.sql<Array<{ packet_hash: string; refs: number }>>`
      SELECT r.packet_hash, COUNT(ra.ref_key)::integer AS refs
        FROM runs r JOIN run_artifact_refs ra ON ra.run_id = r.id
       WHERE r.id = 'packet-activation-run'
       GROUP BY r.packet_hash
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [
      { packet_hash: refs.PRODUCT_BUILD_PACKET.hash, refs: 6 },
    ]);

    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        'packet-activation-rollback', 'feature-dev', 'packet rollback', 'running', 'v3',
        ${producer.codeSha}, ${"9".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    await assert.rejects(
      index.activateProductPacket({
        runId: "packet-activation-rollback",
        packetHash: refs.PRODUCT_BUILD_PACKET.hash,
        compiler,
        artifactRefs: { ...hashes, STORY_PLAN: refs.PRODUCT_SPEC.hash },
        now: at(20),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "PRODUCT_PACKET_ARTIFACT_TYPE_INVALID",
    );
    const rolledBack = await database.sql<Array<{ refs: number; packets: number; packet_hash: string | null }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = r.id) AS refs,
        (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets,
        r.packet_hash
      FROM runs r WHERE r.id = 'packet-activation-rollback'
    `;
    assert.deepEqual(rolledBack.map((row) => ({ ...row })), [
      { refs: 0, packets: 0, packet_hash: null },
    ]);
  });

  it("activates ProductBuildPacketV3 only from its exact CAS payload and native ref set", async () => {
    const index = createArtifactIndex(database.sql);
    const compiler = { version: "4.0.0", codeSha: producer.codeSha };
    const refs = {
      PRODUCT_SPEC: artifact("1", 10, "setfarm.product-spec.v2"),
      BUILD_TOPOLOGY: artifact("2", 10, "setfarm.build-topology.v1"),
      STORY_PLAN: artifact("3", 10, "setfarm.story-plan.v2"),
      DESIGN_SOURCE_CLOSURE: artifact("4", 10, "setfarm.design-source-closure.v2"),
      COMPILATION_REPORT: artifact("5", 10, "setfarm.product-compilation-report.v3"),
      IMPLEMENTATION_SOURCE_MAP: artifact("6", 10, "setfarm.implementation-source-map.v1"),
    } as const;
    const packet = {
      schema: "setfarm.product-build-packet.v3" as const,
      packetVersion: 3 as const,
      parentPacketHashes: [],
      designSourceKind: "none" as const,
      productSpecV2Hash: refs.PRODUCT_SPEC.hash,
      designGraphV2Hash: null,
      buildTopologyV1Hash: refs.BUILD_TOPOLOGY.hash,
      storyPlanV2Hash: refs.STORY_PLAN.hash,
      designSourceClosureV2Hash: refs.DESIGN_SOURCE_CLOSURE.hash,
      implementationSourceMapV1Hash: refs.IMPLEMENTATION_SOURCE_MAP.hash,
      compiler,
      validationIds: ["VALIDATE_V3_SCHEMA_STRICT"],
    };
    const packetHash = hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.product-build-packet.v3",
      producer,
      payload: packet,
    });
    const packetArtifact: ArtifactIdentity = {
      hash: packetHash,
      artifactType: "setfarm.product-build-packet.v3",
      byteLength: 10,
      producer,
    };
    const wrongMapArtifact = artifact("7", 10, "setfarm.story-plan.v2");
    const wrongTypePacket = {
      ...packet,
      implementationSourceMapV1Hash: wrongMapArtifact.hash,
    };
    const wrongTypePacketHash = hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.product-build-packet.v3",
      producer,
      payload: wrongTypePacket,
    });
    const wrongTypePacketArtifact: ArtifactIdentity = {
      hash: wrongTypePacketHash,
      artifactType: "setfarm.product-build-packet.v3",
      byteLength: 10,
      producer,
    };
    await index.bootstrap({
      artifacts: [
        ...Object.values(refs),
        wrongMapArtifact,
        packetArtifact,
        wrongTypePacketArtifact,
      ],
      quotaBytes: 200,
      maxPayloadBytes: 100,
      now: at(0),
    });
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(producer.codeSha);
    for (const runId of [
      "packet-v3-activation",
      "packet-v3-forged",
      "packet-v3-missing-map",
      "packet-v3-wrong-map-type",
    ]) {
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, protocol,
          compiler_release_sha, activation_preflight_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', 'packet v3 activation', 'running', 'v3',
          ${producer.codeSha}, ${"9".repeat(64)}, ${releaseAdmissionHash}
        )
      `;
    }
    const artifactRefs = {
      PRODUCT_SPEC: refs.PRODUCT_SPEC.hash,
      BUILD_TOPOLOGY: refs.BUILD_TOPOLOGY.hash,
      STORY_PLAN: refs.STORY_PLAN.hash,
      DESIGN_SOURCE_CLOSURE: refs.DESIGN_SOURCE_CLOSURE.hash,
      IMPLEMENTATION_SOURCE_MAP: refs.IMPLEMENTATION_SOURCE_MAP.hash,
      PRODUCT_BUILD_PACKET: packetHash,
      COMPILATION_REPORT: refs.COMPILATION_REPORT.hash,
    };
    const activated = await index.activateProductPacket({
      runId: "packet-v3-activation",
      packetHash,
      compiler,
      packet,
      artifactRefs,
      now: at(10),
    });
    assert.equal(activated.created, true);
    assert.equal((await index.listRunArtifactRefs("packet-v3-activation")).length, 7);

    const {
      IMPLEMENTATION_SOURCE_MAP: _implementationSourceMap,
      ...missingMapRefs
    } = artifactRefs;
    await assert.rejects(
      index.activateProductPacket({
        runId: "packet-v3-missing-map",
        packetHash,
        compiler,
        packet,
        artifactRefs: missingMapRefs,
        now: at(11),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "PRODUCT_PACKET_REFS_INCOMPLETE",
    );

    await assert.rejects(
      index.activateProductPacket({
        runId: "packet-v3-wrong-map-type",
        packetHash: wrongTypePacketHash,
        compiler,
        packet: wrongTypePacket,
        artifactRefs: {
          ...artifactRefs,
          IMPLEMENTATION_SOURCE_MAP: wrongMapArtifact.hash,
          PRODUCT_BUILD_PACKET: wrongTypePacketHash,
        },
        now: at(12),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "PRODUCT_PACKET_ARTIFACT_TYPE_INVALID",
    );

    await assert.rejects(
      index.activateProductPacket({
        runId: "packet-v3-forged",
        packetHash,
        compiler,
        packet: { ...packet, storyPlanV2Hash: refs.PRODUCT_SPEC.hash },
        artifactRefs,
        now: at(13),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_IDENTITY_MISMATCH",
    );
    const rolledBack = await database.sql<Array<{ refs: number; packets: number; packet_hash: string | null }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id = r.id) AS refs,
        (SELECT COUNT(*)::integer FROM product_packets WHERE run_id = r.id) AS packets,
        r.packet_hash
      FROM runs r
      WHERE r.id IN ('packet-v3-forged', 'packet-v3-missing-map', 'packet-v3-wrong-map-type')
      ORDER BY r.id
    `;
    assert.deepEqual(rolledBack.map((row) => ({ ...row })), [
      { refs: 0, packets: 0, packet_hash: null },
      { refs: 0, packets: 0, packet_hash: null },
      { refs: 0, packets: 0, packet_hash: null },
    ]);
  });
});
