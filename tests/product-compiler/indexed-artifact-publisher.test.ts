import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import {
  ArtifactStoreError,
  ContentAddressedArtifactStore,
  SemanticArtifactEnvelopeV1Schema,
} from "../../src/product-compiler/artifact-store.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
} from "../../src/product-compiler/artifact-store-batch-plan.js";
import {
  ArtifactIndexError,
  createArtifactIndexForTests as createArtifactIndex,
  type ArtifactIdentity,
} from "../../src/product-compiler/artifact-index.js";
import { computeArtifactPublicationBatchIdentityHash } from "../../src/product-compiler/artifact-publication-batch-identity.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import {
  IndexedArtifactPublisher,
  bootstrapArtifactIndex,
  recoverExpiredArtifactPublications,
  scanArtifactInventory,
} from "../../src/product-compiler/indexed-artifact-publisher.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_CHUNK_ARTIFACT_TYPE_V1,
  createByteBundleV1,
} from "../../src/product-compiler/schemas/byte-bundle-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const producer = Object.freeze({
  pass: "indexed-publisher-test",
  codeSha: "b".repeat(40),
  toolVersions: Object.freeze({ node: "22", setfarm: "test" }),
});

function envelope(token = "one") {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: "setfarm.product-spec.v1",
    producer,
    payload: { token },
  });
}

function identity(value: unknown): ArtifactIdentity {
  const parsed = SemanticArtifactEnvelopeV1Schema.parse(value);
  const bytes = canonicalJsonBytes(parsed);
  return {
    hash: createHash("sha256").update(bytes).digest("hex"),
    artifactType: parsed.artifactType,
    byteLength: bytes.length,
    producer: parsed.producer,
  };
}

function leafPlan(token = "batch-leaf") {
  return {
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items: [{ durabilityTier: 0, envelope: envelope(token) }],
  };
}

function byteBundlePlan(bytes = Buffer.from("indexed-bundle", "utf8")) {
  const produced = createByteBundleV1({ bytes, producer });
  if (produced.status !== "produced") throw new Error("Expected ByteBundleV1 fixture");
  return {
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items: [
      ...produced.chunks.map((chunk) => ({
        durabilityTier: 0,
        envelope: chunk.envelope,
      })),
      { durabilityTier: 1, envelope: produced.bundle.envelope },
    ],
  };
}

function at(offsetMs: number): Date {
  return new Date(Date.UTC(2026, 6, 13, 12, 0, 0, offsetMs));
}

describe("indexed semantic artifact publisher", () => {
  let database: TestDatabase;
  const roots: string[] = [];

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.sql.unsafe(
      "TRUNCATE product_packets, run_artifact_refs, artifact_publication_batch_items, artifact_publication_batches, artifact_publication_reservations, semantic_artifacts CASCADE",
    );
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

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function store(): Promise<ContentAddressedArtifactStore> {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-indexed-publisher-"));
    roots.push(root);
    return new ContentAddressedArtifactStore(path.join(root, "sha256"));
  }

  it("bootstraps the exact canonical filesystem inventory before indexed writes", async () => {
    const artifactStore = await store();
    const legacy = await artifactStore.put(envelope("legacy"));
    const index = createArtifactIndex(database.sql);

    const bootstrapped = await bootstrapArtifactIndex({
      index,
      store: artifactStore,
      quotaBytes: 10_000,
      maxPayloadBytes: 5_000,
      now: at(0),
    });

    assert.equal(bootstrapped.artifacts.length, 1);
    assert.equal(bootstrapped.artifacts[0]!.hash, legacy.hash);
    assert.equal(bootstrapped.capacity.state, "ready");
    assert.equal((await index.getArtifact(legacy.hash))?.byteLength, bootstrapped.artifacts[0]!.byteLength);
  });

  it("reserves before CAS publication and converges concurrent identical writes", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    const publisher = new IndexedArtifactPublisher({
      index,
      store: artifactStore,
      ownerInstanceId: "publisher-concurrency",
      busyWaitMs: 2_000,
      retryDelayMs: 2,
    });

    const writes = await Promise.all(Array.from({ length: 20 }, () => publisher.put(envelope())));

    assert.equal(new Set(writes.map((item) => item.hash)).size, 1);
    assert.equal(writes.filter((item) => item.created).length, 1);
    assert.equal(writes.filter((item) => item.indexCreated).length, 1);
    assert.equal((await index.getCapacity()).reservedBytes, 0);
    assert.equal((await scanArtifactInventory(artifactStore)).length, 1);
  });

  it("releases the exact owned quota reservation when CAS fails before durable bytes exist", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    const publisher = new IndexedArtifactPublisher({
      index,
      ownerInstanceId: "publisher-failure",
      store: {
        put: async () => {
          throw new Error("injected filesystem failure");
        },
        get: (hash) => artifactStore.get(hash),
      },
    });

    await assert.rejects(publisher.put(envelope()), /injected filesystem failure/);
    const capacity = await index.getCapacity();
    assert.equal(capacity.state, "ready");
    assert.equal(capacity.reservedBytes, 0);
    const reservations = await database.sql<Array<{ state: string }>>`
      SELECT state FROM artifact_publication_reservations
    `;
    assert.deepEqual(reservations.map((row) => row.state), ["released"]);
  });

  it("finishes immutable batch preparation before creating a database reservation", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    let reserveCalls = 0;
    const publisher = new IndexedArtifactPublisher({
      index: {
        ...index,
        reservePublicationBatch: async (input) => {
          reserveCalls += 1;
          return index.reservePublicationBatch(input);
        },
      },
      store: artifactStore,
      ownerInstanceId: "batch-preparation-order",
    });
    const invalidPlan = {
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [{
        durabilityTier: 0,
        get envelope(): never {
          throw new Error("hostile plan accessor");
        },
      }],
    };

    await assert.rejects(publisher.putBatch({
      batchReservationId: "batch-preparation-order",
      plan: invalidPlan,
    }));
    assert.equal(reserveCalls, 0);
    assert.equal((await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM artifact_publication_batches
    `)[0]?.count, 0);
  });

  it("commits exact migration-23 membership before the first batch CAS mutation", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    let observedCommittedMembership = false;
    const publisher = new IndexedArtifactPublisher({
      index,
      store: {
        put: artifactStore.put.bind(artifactStore),
        get: artifactStore.get.bind(artifactStore),
        putPreparedBatch: async (prepared) => {
          const rows = await database.sql<Array<{
            state: string;
            item_count: number;
            reservation_count: number;
          }>>`
            SELECT b.state,
                   COUNT(DISTINCT i.artifact_hash)::integer AS item_count,
                   COUNT(DISTINCT r.reservation_id)::integer AS reservation_count
              FROM artifact_publication_batches b
              JOIN artifact_publication_batch_items i USING (batch_reservation_id)
              JOIN artifact_publication_reservations r ON r.reservation_id = i.reservation_id
             WHERE b.batch_reservation_id = 'batch-db-before-cas'
             GROUP BY b.state
          `;
          assert.deepEqual(rows.map((row) => ({ ...row })), [{
            state: "active",
            item_count: 1,
            reservation_count: 1,
          }]);
          observedCommittedMembership = true;
          return artifactStore.putPreparedBatch(prepared);
        },
      },
      ownerInstanceId: "batch-db-before-cas",
    });

    const result = await publisher.putBatch({
      batchReservationId: "batch-db-before-cas",
      plan: leafPlan(),
    });

    assert.equal(observedCommittedMembership, true);
    assert.equal(result.lifecycle.state, "completed");
  });

  it("rejects returned batch membership drift before touching CAS", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    let casCalls = 0;
    const publisher = new IndexedArtifactPublisher({
      index: {
        ...index,
        reservePublicationBatch: async (input) => {
          const reserved = await index.reservePublicationBatch(input);
          return Object.freeze({ ...reserved, items: Object.freeze([]) });
        },
      },
      store: {
        put: artifactStore.put.bind(artifactStore),
        get: artifactStore.get.bind(artifactStore),
        putPreparedBatch: async (prepared) => {
          casCalls += 1;
          return artifactStore.putPreparedBatch(prepared);
        },
      },
      ownerInstanceId: "batch-membership-drift",
    });

    await assert.rejects(
      publisher.putBatch({
        batchReservationId: "batch-membership-drift",
        plan: leafPlan("membership"),
      }),
      /ARTIFACT_BATCH_PUBLICATION_INCOMPLETE/,
    );
    assert.equal(casCalls, 0);
    await assert.rejects(artifactStore.get(identity(envelope("membership")).hash),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_NOT_FOUND");
    assert.equal((await database.sql<Array<{ state: string }>>`
      SELECT state FROM artifact_publication_batches
       WHERE batch_reservation_id = 'batch-membership-drift'
    `)[0]?.state, "released");
  });

  it("requires the exact aggregate token and expiry returned with every active child", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    let originalToken = "";
    let casCalls = 0;
    const publisher = new IndexedArtifactPublisher({
      index: {
        ...index,
        reservePublicationBatch: async (input) => {
          const reserved = await index.reservePublicationBatch(input);
          originalToken = reserved.leaseToken!;
          return Object.freeze({ ...reserved, leaseToken: "tampered-aggregate-token" });
        },
      },
      store: {
        put: artifactStore.put.bind(artifactStore),
        get: artifactStore.get.bind(artifactStore),
        putPreparedBatch: async (prepared) => {
          casCalls += 1;
          return artifactStore.putPreparedBatch(prepared);
        },
      },
      ownerInstanceId: "batch-exact-fence",
    });

    await assert.rejects(
      publisher.putBatch({
        batchReservationId: "batch-exact-fence",
        plan: leafPlan("exact-fence"),
      }),
      /exact aggregate owner\/token\/expiry fence|differs from its aggregate fence/,
    );
    assert.equal(casCalls, 0);
    const rows = await database.sql<Array<{
      state: string;
      lease_token: string;
      diagnostic: string | null;
    }>>`
      SELECT state, lease_token, diagnostic
        FROM artifact_publication_batches
       WHERE batch_reservation_id = 'batch-exact-fence'
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{
      state: "active",
      lease_token: originalToken,
      diagnostic: null,
    }]);
  });

  it("fresh-reads every CAS member and deep closure on a completed replay", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000_000, maxPayloadBytes: 5_000_000 });
    const plan = byteBundlePlan();
    const first = new IndexedArtifactPublisher({
      index,
      store: artifactStore,
      ownerInstanceId: "batch-completed-first",
    });
    await first.putBatch({ batchReservationId: "batch-completed-replay", plan });

    let getCalls = 0;
    let batchWriteCalls = 0;
    const replay = new IndexedArtifactPublisher({
      index,
      store: {
        put: artifactStore.put.bind(artifactStore),
        get: async (hash) => {
          getCalls += 1;
          return artifactStore.get(hash);
        },
        putPreparedBatch: async (prepared) => {
          batchWriteCalls += 1;
          return artifactStore.putPreparedBatch(prepared);
        },
      },
      ownerInstanceId: "batch-completed-second",
    });
    const result = await replay.putBatch({
      batchReservationId: "batch-completed-replay",
      plan,
    });

    assert.equal(getCalls, 2);
    assert.equal(batchWriteCalls, 0);
    assert.equal(result.cas.createdCount, 0);
    assert.equal(result.closures.length, 1);
    assert.equal(result.closures[0]?.status, "verified");
    assert.equal(result.lifecycle.state, "completed");
  });

  it("never recreates an indexed CAS member that is missing on completed replay", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    const plan = leafPlan("indexed-missing");
    const publisher = new IndexedArtifactPublisher({
      index,
      store: artifactStore,
      ownerInstanceId: "batch-indexed-missing-first",
    });
    const first = await publisher.putBatch({
      batchReservationId: "batch-indexed-missing",
      plan,
    });
    await rm(first.items[0]!.path);

    let batchWriteCalls = 0;
    const replay = new IndexedArtifactPublisher({
      index,
      store: {
        put: artifactStore.put.bind(artifactStore),
        get: artifactStore.get.bind(artifactStore),
        putPreparedBatch: async (prepared) => {
          batchWriteCalls += 1;
          return artifactStore.putPreparedBatch(prepared);
        },
      },
      ownerInstanceId: "batch-indexed-missing-second",
    });
    await assert.rejects(
      replay.putBatch({ batchReservationId: "batch-indexed-missing", plan }),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_NOT_FOUND",
    );
    assert.equal(batchWriteCalls, 0);
    await assert.rejects(artifactStore.get(first.items[0]!.identity.hash),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_NOT_FOUND");
  });

  it("quarantines an active mixed batch instead of recreating its missing indexed member", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    const firstPublisher = new IndexedArtifactPublisher({
      index,
      store: artifactStore,
      ownerInstanceId: "batch-mixed-drift-first",
    });
    const indexed = await firstPublisher.put(envelope("mixed-indexed"));
    await rm(indexed.path);
    const mixedPlan = {
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [
        { durabilityTier: 0, envelope: envelope("mixed-indexed") },
        { durabilityTier: 0, envelope: envelope("mixed-pending") },
      ],
    };
    let batchWriteCalls = 0;
    const publisher = new IndexedArtifactPublisher({
      index,
      store: {
        put: artifactStore.put.bind(artifactStore),
        get: artifactStore.get.bind(artifactStore),
        putPreparedBatch: async (prepared) => {
          batchWriteCalls += 1;
          return artifactStore.putPreparedBatch(prepared);
        },
      },
      ownerInstanceId: "batch-mixed-drift-second",
    });

    await assert.rejects(
      publisher.putBatch({ batchReservationId: "batch-mixed-drift", plan: mixedPlan }),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_NOT_FOUND",
    );
    assert.equal(batchWriteCalls, 0);
    assert.deepEqual((await database.sql<Array<{ batch_state: string; capacity_state: string }>>`
      SELECT b.state AS batch_state, c.state AS capacity_state
        FROM artifact_publication_batches b
        CROSS JOIN artifact_capacity c
       WHERE b.batch_reservation_id = 'batch-mixed-drift'
    `).map((row) => ({ ...row })), [{
      batch_state: "quarantined",
      capacity_state: "quarantined",
    }]);
    await assert.rejects(
      artifactStore.get(identity(envelope("mixed-pending")).hash),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_NOT_FOUND",
    );
  });

  it("publishes ByteChunk dependencies before the ByteBundle root and binds the final result", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000_000, maxPayloadBytes: 5_000_000 });
    const publishOrder: string[] = [];
    const publisher = new IndexedArtifactPublisher({
      index: {
        ...index,
        publishPublicationBatchItem: async (input) => {
          publishOrder.push(input.artifact.artifactType);
          return index.publishPublicationBatchItem(input);
        },
      },
      store: artifactStore,
      ownerInstanceId: "batch-tier-order",
    });
    const plan = byteBundlePlan();
    const prepared = prepareArtifactStoreBatchPlanV1(plan);
    const result = await publisher.putBatch({
      batchReservationId: "batch-tier-order",
      plan,
    });

    assert.deepEqual(publishOrder, [BYTE_CHUNK_ARTIFACT_TYPE_V1, BYTE_BUNDLE_ARTIFACT_TYPE_V1]);
    assert.equal(result.schema, "setfarm.indexed-artifact-batch-publication-result.v1");
    assert.equal(result.batchReservationId, "batch-tier-order");
    assert.match(result.batchIdentityHash, /^[a-f0-9]{64}$/);
    assert.match(result.planIdentityHash, /^[a-f0-9]{64}$/);
    assert.equal(result.planIdentityHash, prepared.planIdentityHash);
    assert.equal(
      result.batchIdentityHash,
      computeArtifactPublicationBatchIdentityHash(
        copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared).map((item) => item.identity),
      ),
    );
    assert.equal(result.cas.planIdentityHash, result.planIdentityHash);
    assert.equal(result.items.length, 2);
    assert.equal(result.items.every((item) => item.indexCreated), true);
    assert.equal(result.lifecycle.state, "completed");
    assert.equal(result.lifecycle.reservations.every((item) => item.state === "published"), true);
  });

  it("keeps a ByteBundle root unindexed when its declared closure is absent", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000_000, maxPayloadBytes: 5_000_000 });
    const complete = byteBundlePlan();
    const rootOnlyPlan = {
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [{ durabilityTier: 0, envelope: complete.items.at(-1)!.envelope }],
    };
    let publishCalls = 0;
    const publisher = new IndexedArtifactPublisher({
      index: {
        ...index,
        publishPublicationBatchItem: async (input) => {
          publishCalls += 1;
          return index.publishPublicationBatchItem(input);
        },
      },
      store: artifactStore,
      ownerInstanceId: "batch-missing-closure",
    });

    await assert.rejects(
      publisher.putBatch({
        batchReservationId: "batch-missing-closure",
        plan: rootOnlyPlan,
      }),
      /ARTIFACT_CLOSURE_DEPENDENCY_MISSING/,
    );
    assert.equal(publishCalls, 0);
    assert.equal((await scanArtifactInventory(artifactStore)).length, 1);
    assert.equal((await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM semantic_artifacts
    `)[0]?.count, 0);
    assert.equal((await database.sql<Array<{ state: string }>>`
      SELECT state FROM artifact_publication_batches
       WHERE batch_reservation_id = 'batch-missing-closure'
    `)[0]?.state, "active");
  });

  it("returns no partial receipt and preserves active recovery evidence after DB publication fails", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000_000, maxPayloadBytes: 5_000_000 });
    const publishOrder: string[] = [];
    const publisher = new IndexedArtifactPublisher({
      index: {
        ...index,
        publishPublicationBatchItem: async (input): ReturnType<typeof index.publishPublicationBatchItem> => {
          publishOrder.push(input.artifact.artifactType);
          throw new Error("injected child index failure");
        },
      },
      store: artifactStore,
      ownerInstanceId: "batch-db-failure",
    });

    await assert.rejects(
      publisher.putBatch({ batchReservationId: "batch-db-failure", plan: byteBundlePlan() }),
      /injected child index failure/,
    );
    assert.deepEqual(publishOrder, [BYTE_CHUNK_ARTIFACT_TYPE_V1]);
    const rows = await database.sql<Array<{
      batch_state: string;
      child_states: string[];
      reserved_bytes: number;
    }>>`
      SELECT b.state AS batch_state,
             array_agg(r.state ORDER BY r.reservation_id) AS child_states,
             c.reserved_bytes::integer AS reserved_bytes
        FROM artifact_publication_batches b
        JOIN artifact_publication_batch_items i USING (batch_reservation_id)
        JOIN artifact_publication_reservations r ON r.reservation_id = i.reservation_id
        CROSS JOIN artifact_capacity c
       WHERE b.batch_reservation_id = 'batch-db-failure'
       GROUP BY b.state, c.reserved_bytes
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{
      batch_state: "active",
      child_states: ["reserved", "reserved"],
      reserved_bytes: rows[0]!.reserved_bytes,
    }]);
    assert.ok(rows[0]!.reserved_bytes > 0);
    assert.equal((await scanArtifactInventory(artifactStore)).length, 2);
  });

  it("keeps a partially indexed aggregate active when a later child publish fails", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000_000, maxPayloadBytes: 5_000_000 });
    const publishOrder: string[] = [];
    const publisher = new IndexedArtifactPublisher({
      index: {
        ...index,
        publishPublicationBatchItem: async (input) => {
          publishOrder.push(input.artifact.artifactType);
          if (input.artifact.artifactType === BYTE_BUNDLE_ARTIFACT_TYPE_V1) {
            throw new Error("injected root index failure");
          }
          return index.publishPublicationBatchItem(input);
        },
      },
      store: artifactStore,
      ownerInstanceId: "batch-partial-index",
    });

    await assert.rejects(
      publisher.putBatch({ batchReservationId: "batch-partial-index", plan: byteBundlePlan() }),
      /injected root index failure/,
    );
    assert.deepEqual(publishOrder, [BYTE_CHUNK_ARTIFACT_TYPE_V1, BYTE_BUNDLE_ARTIFACT_TYPE_V1]);
    const aggregate = await database.sql<Array<{
      batch_state: string;
      child_states: string[];
      indexed_types: string[];
    }>>`
      SELECT b.state AS batch_state,
             array_agg(DISTINCT r.state ORDER BY r.state) AS child_states,
             COALESCE(array_agg(DISTINCT a.artifact_type ORDER BY a.artifact_type)
               FILTER (WHERE a.artifact_type IS NOT NULL), '{}') AS indexed_types
        FROM artifact_publication_batches b
        JOIN artifact_publication_batch_items i USING (batch_reservation_id)
        JOIN artifact_publication_reservations r ON r.reservation_id = i.reservation_id
        LEFT JOIN semantic_artifacts a ON a.artifact_hash = i.artifact_hash
       WHERE b.batch_reservation_id = 'batch-partial-index'
       GROUP BY b.state
    `;
    assert.deepEqual(aggregate.map((row) => ({ ...row })), [{
      batch_state: "active",
      child_states: ["published", "reserved"],
      indexed_types: [BYTE_CHUNK_ARTIFACT_TYPE_V1],
    }]);
    assert.equal((await scanArtifactInventory(artifactStore)).length, 2);
  });

  it("does not replace or terminally settle an aggregate after lease loss", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    const publisher = new IndexedArtifactPublisher({
      index: {
        ...index,
        publishPublicationBatchItem: async (): ReturnType<typeof index.publishPublicationBatchItem> => {
          throw new ArtifactIndexError(
            "ARTIFACT_BATCH_LEASE_LOST",
            "injected aggregate lease loss",
          );
        },
      },
      store: artifactStore,
      ownerInstanceId: "batch-lease-loss",
    });

    await assert.rejects(
      publisher.putBatch({ batchReservationId: "batch-lease-loss", plan: leafPlan("lease") }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_LEASE_LOST",
    );
    const rows = await database.sql<Array<{
      batches: number;
      state: string;
      diagnostic: string | null;
      children: number;
    }>>`
      SELECT COUNT(DISTINCT b.batch_reservation_id)::integer AS batches,
             MIN(b.state) AS state,
             MIN(b.diagnostic) AS diagnostic,
             COUNT(r.reservation_id)::integer AS children
        FROM artifact_publication_batches b
        JOIN artifact_publication_batch_items i USING (batch_reservation_id)
        JOIN artifact_publication_reservations r ON r.reservation_id = i.reservation_id
       WHERE b.batch_reservation_id = 'batch-lease-loss'
    `;
    assert.deepEqual(rows.map((row) => ({ ...row })), [{
      batches: 1,
      state: "active",
      diagnostic: null,
      children: 1,
    }]);
  });

  it("stops before indexing when the real aggregate lease expires during CAS work", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    const publisher = new IndexedArtifactPublisher({
      index,
      store: {
        put: artifactStore.put.bind(artifactStore),
        get: artifactStore.get.bind(artifactStore),
        putPreparedBatch: async (prepared) => {
          const result = await artifactStore.putPreparedBatch(prepared);
          await new Promise((resolve) => setTimeout(resolve, 150));
          return result;
        },
      },
      ownerInstanceId: "batch-real-lease-expiry",
      leaseMs: 100,
    });

    await assert.rejects(
      publisher.putBatch({
        batchReservationId: "batch-real-lease-expiry",
        plan: leafPlan("real-expiry"),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BATCH_LEASE_LOST",
    );
    assert.equal((await scanArtifactInventory(artifactStore)).length, 1);
    assert.equal((await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM semantic_artifacts
    `)[0]?.count, 0);
    assert.deepEqual((await database.sql<Array<{ state: string; diagnostic: string | null }>>`
      SELECT state, diagnostic FROM artifact_publication_batches
       WHERE batch_reservation_id = 'batch-real-lease-expiry'
    `).map((row) => ({ ...row })), [{ state: "active", diagnostic: null }]);
  });

  it("adopts an expired write-before-index crash and publishes the exact durable CAS identity", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const value = envelope("crash-after-write");
    const target = identity(value);
    await index.reservePublication({
      reservationId: "reservation-crash-after-write",
      artifact: target,
      ownerInstanceId: "dead-publisher",
      leaseMs: 100,
      now: at(1),
    });
    await artifactStore.put(value);

    const recovered = await recoverExpiredArtifactPublications({
      index,
      store: artifactStore,
      ownerInstanceId: "recovery-owner",
      now: at(102),
    });

    assert.deepEqual(recovered.map((item) => item.resolution), ["published"]);
    assert.equal((await index.getArtifact(target.hash))?.artifactType, target.artifactType);
    assert.deepEqual({
      totalBytes: (await index.getCapacity()).totalBytes,
      reservedBytes: (await index.getCapacity()).reservedBytes,
    }, { totalBytes: target.byteLength, reservedBytes: 0 });
  });

  it("releases missing expired bytes and fail-closed quarantines corrupt expired bytes", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const missing = identity(envelope("missing"));
    await index.reservePublication({
      reservationId: "reservation-missing",
      artifact: missing,
      ownerInstanceId: "dead-publisher-a",
      leaseMs: 100,
      now: at(1),
    });
    const missingResult = await recoverExpiredArtifactPublications({
      index,
      store: artifactStore,
      now: at(102),
    });
    assert.deepEqual(missingResult.map((item) => item.resolution), ["released"]);
    assert.equal((await index.getCapacity()).state, "ready");

    const corrupt = identity(envelope("corrupt"));
    await index.reservePublication({
      reservationId: "reservation-corrupt",
      artifact: corrupt,
      ownerInstanceId: "dead-publisher-b",
      leaseMs: 100,
      now: at(200),
    });
    await mkdir(artifactStore.root, { recursive: true });
    await writeFile(artifactStore.pathFor(corrupt.hash), Buffer.from("corrupt", "utf8"));
    const corruptResult = await recoverExpiredArtifactPublications({
      index,
      store: artifactStore,
      now: at(301),
    });
    assert.deepEqual(corruptResult.map((item) => item.resolution), ["quarantined"]);
    assert.equal((await index.getCapacity()).state, "quarantined");
    await assert.rejects(
      artifactStore.get(corrupt.hash),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_HASH_COLLISION_OR_CORRUPTION",
    );
  });
});
