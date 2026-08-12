import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import {
  ArtifactStoreError,
  ContentAddressedArtifactStore,
  MAX_ARTIFACT_INVENTORY_FINAL_FILES_V1,
  SemanticArtifactEnvelopeV1Schema,
  assertArtifactInventoryFinalEntryCountV1,
} from "../../src/product-compiler/artifact-store.js";
import {
  createHybridArtifactStoreCapacityLeaseProviderV1,
} from "../../src/product-compiler/artifact-store-authority.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  createArtifactPublicationBatchPlanBindingV1,
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
  IndexedArtifactPublisherError,
  bootstrapArtifactIndex,
  inspectIndexedArtifactPublisherAuthorityV1,
  recoverExpiredArtifactPublicationBatches,
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

async function reserveExpiredBatch(
  index: ReturnType<typeof createArtifactIndex>,
  batchReservationId: string,
  plan: ReturnType<typeof leafPlan> | ReturnType<typeof byteBundlePlan>,
) {
  const recoveryNow = new Date();
  const prepared = prepareArtifactStoreBatchPlanV1(plan);
  const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
  const binding = createArtifactPublicationBatchPlanBindingV1(items.map((item) => ({
    durabilityTier: item.durabilityTier,
    identity: item.identity,
  })));
  const reservation = await index.reservePublicationBatch({
    batchReservationId,
    artifacts: items.map((item) => item.identity),
    plan: binding,
    ownerInstanceId: "dead-batch-publisher",
    leaseMs: 100,
    now: new Date(recoveryNow.getTime() - 1_000),
  });
  return { prepared, items, reservation, recoveryNow };
}

describe("indexed semantic artifact publisher", () => {
  let database: TestDatabase;
  const roots: string[] = [];

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

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function store(): Promise<ContentAddressedArtifactStore> {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-indexed-publisher-"));
    roots.push(root);
    return new ContentAddressedArtifactStore(path.join(root, "sha256"));
  }

  it("authenticates only exact non-proxied publisher instances", async () => {
    const publisher = new IndexedArtifactPublisher({
      index: createArtifactIndex(database.sql),
      store: await store(),
    });
    assert.deepEqual(inspectIndexedArtifactPublisherAuthorityV1(publisher), {
      publicationAuthority: "standalone",
    });
    const forged = Object.create(IndexedArtifactPublisher.prototype);
    assert.throws(
      () => inspectIndexedArtifactPublisherAuthorityV1(forged),
      (error: unknown) => error instanceof IndexedArtifactPublisherError
        && error.code === "ARTIFACT_PRODUCTION_AUTHORITY_REQUIRED",
    );
    const proxied = new Proxy(publisher, {});
    assert.throws(
      () => inspectIndexedArtifactPublisherAuthorityV1(proxied),
      (error: unknown) => error instanceof IndexedArtifactPublisherError
        && error.code === "ARTIFACT_PRODUCTION_AUTHORITY_REQUIRED",
    );
  });

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

  it("acquires adoption authority and cleans staging before reading every legacy identity", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-indexed-adoption-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const legacyStore = new ContentAddressedArtifactStore(artifactRoot);
    const first = await legacyStore.put(envelope("adopt-first"));
    const second = await legacyStore.put(envelope("adopt-second"));
    const abandonedAttempt = path.join(
      artifactRoot,
      ".staging",
      `${"b".repeat(64)}.00000000-0000-4000-8000-000000000002`,
    );
    await mkdir(abandonedAttempt, { recursive: true, mode: 0o700 });
    const events: string[] = [];
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      purpose: "inventory-adoption",
      testHooks: {
        afterStagingInventory: () => { events.push("staging-cleanup"); },
      },
    });
    const adoptionStore = new ContentAddressedArtifactStore(artifactRoot, {
      capacityLeaseProvider: provider,
      testHooks: {
        afterArtifactRead: ({ artifactHash }) => { events.push(`read:${artifactHash}`); },
      },
    });
    const index = createArtifactIndex(database.sql);

    const bootstrapped = await bootstrapArtifactIndex({
      index,
      store: adoptionStore,
      quotaBytes: 10_000,
      maxPayloadBytes: 5_000,
      now: at(0),
    });

    assert.equal(bootstrapped.inventory.status, "verified");
    assert.equal(bootstrapped.inventory.authority.kind, "hybrid");
    assert.deepEqual(
      bootstrapped.artifacts.map((artifact) => artifact.hash).sort(),
      [first.hash, second.hash].sort(),
    );
    assert.equal(events[0], "staging-cleanup");
    assert.deepEqual(
      events.filter((event) => event.startsWith("read:")).sort(),
      [`read:${first.hash}`, `read:${second.hash}`].sort(),
    );
    assert.deepEqual(await (await import("node:fs/promises")).readdir(path.join(artifactRoot, ".staging")), []);
    assert.equal(bootstrapped.capacity.state, "ready");
  });

  it("quarantines an incomplete ByteBundle only after every final identity is read", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-indexed-invalid-closure-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const legacyStore = new ContentAddressedArtifactStore(artifactRoot);
    const produced = createByteBundleV1({
      bytes: Buffer.from("bundle root without its declared chunk", "utf8"),
      producer,
    });
    assert.equal(produced.status, "produced");
    if (produced.status !== "produced") return;
    const rootArtifact = await legacyStore.put(produced.bundle.envelope);
    const unrelated = await legacyStore.put(envelope("unrelated-valid-leaf"));
    const reads: string[] = [];
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      purpose: "inventory-adoption",
    });
    const adoptionStore = new ContentAddressedArtifactStore(artifactRoot, {
      capacityLeaseProvider: provider,
      testHooks: {
        afterArtifactRead: ({ artifactHash }) => { reads.push(artifactHash); },
      },
    });
    const index = createArtifactIndex(database.sql);

    await assert.rejects(
      bootstrapArtifactIndex({
        index,
        store: adoptionStore,
        quotaBytes: 10_000,
        maxPayloadBytes: 5_000,
        now: at(0),
      }),
      (error: unknown) => error instanceof IndexedArtifactPublisherError
        && error.code === "ARTIFACT_INVENTORY_CLOSURE_REJECTED"
        && error.inventory?.status === "rejected",
    );

    assert.deepEqual(reads.sort(), [rootArtifact.hash, unrelated.hash].sort());
    assert.equal((await index.getCapacity()).state, "quarantined");
    assert.equal(await index.getArtifact(rootArtifact.hash), undefined);
    assert.equal(await index.getArtifact(unrelated.hash), undefined);
  });

  it("accepts an orphan ByteChunk as a complete leaf inventory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-indexed-orphan-chunk-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const legacyStore = new ContentAddressedArtifactStore(artifactRoot);
    const produced = createByteBundleV1({
      bytes: Buffer.from("orphan chunk remains a valid leaf", "utf8"),
      producer,
    });
    assert.equal(produced.status, "produced");
    if (produced.status !== "produced") return;
    const orphan = await legacyStore.put(produced.chunks[0]!.envelope);
    const provider = createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: database.sql,
      artifactRoot,
      purpose: "inventory-adoption",
    });
    const adoptionStore = new ContentAddressedArtifactStore(artifactRoot, {
      capacityLeaseProvider: provider,
    });
    const index = createArtifactIndex(database.sql);

    const bootstrapped = await bootstrapArtifactIndex({
      index,
      store: adoptionStore,
      quotaBytes: 10_000,
      maxPayloadBytes: 5_000,
      now: at(0),
    });

    assert.equal(bootstrapped.inventory.status, "verified");
    assert.equal(bootstrapped.inventory.closures[0]?.status, "verified");
    assert.equal(bootstrapped.inventory.closures[0]?.role, "leaf");
    assert.ok(await index.getArtifact(orphan.hash));
  });

  it("quarantines index/CAS drift outside the held adoption lease without recreating either side", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-indexed-adoption-drift-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const legacyStore = new ContentAddressedArtifactStore(artifactRoot);
    const filesystemOnly = await legacyStore.put(envelope("filesystem-only"));
    const databaseOnly = identity(envelope("database-only"));
    await database.sql.unsafe(
      `INSERT INTO semantic_artifacts (
         artifact_hash, artifact_type, byte_length, producer_metadata, created_at
       ) VALUES ($1, $2, $3, $4::text::jsonb, NOW())`,
      [
        databaseOnly.hash,
        databaseOnly.artifactType,
        databaseOnly.byteLength,
        JSON.stringify(databaseOnly.producer),
      ],
    );
    const index = createArtifactIndex(database.sql);
    const adoptionStore = new ContentAddressedArtifactStore(artifactRoot, {
      capacityLeaseProvider: createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: database.sql,
        artifactRoot,
        purpose: "inventory-adoption",
      }),
    });

    await assert.rejects(
      bootstrapArtifactIndex({
        index,
        store: adoptionStore,
        quotaBytes: 10_000,
        maxPayloadBytes: 5_000,
        now: at(0),
      }),
      (error: unknown) => error instanceof ArtifactIndexError
        && error.code === "ARTIFACT_BOOTSTRAP_MISMATCH",
    );

    assert.equal((await index.getCapacity()).state, "quarantined");
    assert.equal(await index.getArtifact(filesystemOnly.hash), undefined);
    assert.equal((await index.getArtifact(databaseOnly.hash))?.hash, databaseOnly.hash);
    assert.equal((await legacyStore.get(filesystemOnly.hash)).hash, filesystemOnly.hash);
    await assert.rejects(legacyStore.get(databaseOnly.hash), /does not exist/);
    assert.equal(
      (await readdir(artifactRoot)).filter((entry) => /^[a-f0-9]{64}\.json$/.test(entry)).length,
      1,
    );
    const authority = await database.sql<Array<{ state: string }>>`
      SELECT state FROM artifact_store_authorities
    `;
    assert.deepEqual(Array.from(authority), [{ state: "ready" }]);
  });

  it("rejects a changed final-file generation before bootstrap and leaves it retryable", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-indexed-adoption-generation-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const legacyStore = new ContentAddressedArtifactStore(artifactRoot);
    const first = await legacyStore.put(envelope("generation-first"));
    const injectedEnvelope = envelope("generation-arrived-during-read");
    const injectedIdentity = identity(injectedEnvelope);
    let injected = false;
    const adoptionStore = new ContentAddressedArtifactStore(artifactRoot, {
      capacityLeaseProvider: createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: database.sql,
        artifactRoot,
        purpose: "inventory-adoption",
      }),
      testHooks: {
        afterArtifactRead: async () => {
          if (injected) return;
          injected = true;
          await writeFile(
            path.join(artifactRoot, `${injectedIdentity.hash}.json`),
            canonicalJsonBytes(injectedEnvelope),
            { flag: "wx", mode: 0o600 },
          );
        },
      },
    });
    const index = createArtifactIndex(database.sql);

    await assert.rejects(
      bootstrapArtifactIndex({
        index,
        store: adoptionStore,
        quotaBytes: 10_000,
        maxPayloadBytes: 5_000,
        now: at(0),
      }),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_ROOT_CHANGED_DURING_OPERATION",
    );

    assert.equal(injected, true);
    assert.equal((await legacyStore.get(first.hash)).hash, first.hash);
    assert.equal(
      (await legacyStore.get(injectedIdentity.hash)).hash,
      injectedIdentity.hash,
    );
    assert.equal(await index.getArtifact(first.hash), undefined);
    assert.equal(await index.getArtifact(injectedIdentity.hash), undefined);
    assert.equal((await index.getCapacity()).state, "bootstrap_required");
  });

  it("rejects an externally aliased final as unsafe inventory without deleting it", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-indexed-adoption-alias-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const legacyStore = new ContentAddressedArtifactStore(artifactRoot);
    const aliased = await legacyStore.put(envelope("externally-aliased-final"));
    const externalAlias = path.join(root, "external-alias.json");
    await link(legacyStore.pathFor(aliased.hash), externalAlias);
    const index = createArtifactIndex(database.sql);
    const adoptionStore = new ContentAddressedArtifactStore(artifactRoot, {
      capacityLeaseProvider: createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: database.sql,
        artifactRoot,
        purpose: "inventory-adoption",
      }),
    });

    await assert.rejects(
      bootstrapArtifactIndex({
        index,
        store: adoptionStore,
        quotaBytes: 10_000,
        maxPayloadBytes: 5_000,
        now: at(0),
      }),
      (error: unknown) => error instanceof IndexedArtifactPublisherError
        && error.code === "ARTIFACT_INVENTORY_ENTRY_INVALID"
        && error.inventory?.entryIssues[0]?.code === "ARTIFACT_UNSAFE_FILE_TYPE",
    );

    assert.equal((await index.getCapacity()).state, "quarantined");
    assert.equal(await index.getArtifact(aliased.hash), undefined);
    assert.equal((await legacyStore.get(aliased.hash)).hash, aliased.hash);
    assert.equal((await legacyStore.get(aliased.hash)).bytes.length > 0, true);
    assert.equal((await readdir(root)).includes(path.basename(externalAlias)), true);
  });

  it("rejects aggregate inventory bytes at the configured root quota before closure or bootstrap", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-indexed-adoption-quota-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const legacyStore = new ContentAddressedArtifactStore(artifactRoot);
    const produced = createByteBundleV1({
      bytes: Buffer.from("bundle root whose missing dependency must not be evaluated after quota loss", "utf8"),
      producer,
    });
    assert.equal(produced.status, "produced");
    if (produced.status !== "produced") return;
    const bundleIdentity = identity(produced.bundle.envelope);
    const leafEnvelope = envelope("quota-crossing-leaf");
    const leafIdentity = identity(leafEnvelope);
    await legacyStore.put(produced.bundle.envelope);
    await legacyStore.put(leafEnvelope);
    const reads: string[] = [];
    const adoptionStore = new ContentAddressedArtifactStore(artifactRoot, {
      limits: {
        maxPayloadBytes: 5_000,
        rootQuotaBytes: bundleIdentity.byteLength + leafIdentity.byteLength - 1,
        minFreeBytes: 0,
      },
      capacityLeaseProvider: createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: database.sql,
        artifactRoot,
        purpose: "inventory-adoption",
      }),
      testHooks: {
        afterArtifactRead: ({ artifactHash }) => { reads.push(artifactHash); },
      },
    });
    const index = createArtifactIndex(database.sql);

    await assert.rejects(
      bootstrapArtifactIndex({
        index,
        store: adoptionStore,
        quotaBytes: 10_000,
        maxPayloadBytes: 5_000,
        now: at(0),
      }),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_INVENTORY_LIMIT_EXCEEDED",
    );

    assert.deepEqual(reads.sort(), [bundleIdentity.hash, leafIdentity.hash].sort());
    assert.equal((await index.getCapacity()).state, "bootstrap_required");
    assert.equal(await index.getArtifact(bundleIdentity.hash), undefined);
    assert.equal(await index.getArtifact(leafIdentity.hash), undefined);
  });

  it("rejects the 100001st final entry before inventory map construction", () => {
    assert.doesNotThrow(() => assertArtifactInventoryFinalEntryCountV1(
      MAX_ARTIFACT_INVENTORY_FINAL_FILES_V1,
    ));
    assert.throws(
      () => assertArtifactInventoryFinalEntryCountV1(
        MAX_ARTIFACT_INVENTORY_FINAL_FILES_V1 + 1,
      ),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_INVENTORY_LIMIT_EXCEEDED",
    );
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
    await assert.rejects(
      scanArtifactInventory(artifactStore),
      (error: unknown) => error instanceof IndexedArtifactPublisherError
        && error.code === "ARTIFACT_INVENTORY_CLOSURE_REJECTED",
    );
    const rootIdentity = identity(rootOnlyPlan.items[0]!.envelope);
    assert.equal((await artifactStore.get(rootIdentity.hash)).hash, rootIdentity.hash);
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

  it("recovers an exact expired aggregate once in canonical tier order", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const batch = await reserveExpiredBatch(
      index,
      "batch-recovery-exact",
      byteBundlePlan(Buffer.from("exact recovery", "utf8")),
    );
    await artifactStore.putPreparedBatch(batch.prepared);
    const published: string[] = [];
    const recoveryIndex = {
      ...index,
      async publishPublicationBatchItem(input: Parameters<typeof index.publishPublicationBatchItem>[0]) {
        published.push(input.artifact.hash);
        return index.publishPublicationBatchItem(input);
      },
    };

    const recovered = await recoverExpiredArtifactPublicationBatches({
      index: recoveryIndex,
      store: artifactStore,
      ownerInstanceId: "batch-recovery-owner",
      now: batch.recoveryNow,
    });

    assert.equal(recovered.length, 1);
    assert.equal(
      recovered[0]?.schema,
      "setfarm.artifact-publication-batch-recovery-result.v1",
    );
    assert.equal(Object.isFrozen(recovered[0]), true);
    assert.equal(Object.isFrozen(recovered[0]?.members), true);
    assert.equal(recovered[0]?.resolution, "completed");
    assert.deepEqual(published, batch.items.map((item) => item.identity.hash));
    assert.deepEqual(
      recovered[0]?.members.map((item) => [item.observation, item.action]),
      batch.items.map(() => ["exact", "published"]),
    );
    assert.equal(recovered[0]?.lifecycle.state, "completed");
    assert.equal((await index.getCapacity()).reservedBytes, 0);
  });

  it("releases an all-missing aggregate without transient adoption", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const batch = await reserveExpiredBatch(
      index,
      "batch-recovery-all-missing",
      leafPlan("all-missing"),
    );
    let adoptionCalls = 0;
    const recoveryIndex = {
      ...index,
      async adoptExpiredPublicationBatch(
        input: Parameters<typeof index.adoptExpiredPublicationBatch>[0],
      ) {
        adoptionCalls += 1;
        return index.adoptExpiredPublicationBatch(input);
      },
    };

    const recovered = await recoverExpiredArtifactPublicationBatches({
      index: recoveryIndex,
      store: artifactStore,
      now: batch.recoveryNow,
    });

    assert.equal(adoptionCalls, 0);
    assert.equal(recovered[0]?.resolution, "released");
    assert.deepEqual(
      recovered[0]?.members.map((item) => [item.observation, item.action]),
      [["missing", "released"]],
    );
    assert.equal((await index.getCapacity()).reservedBytes, 0);
  });

  it("publishes an exact chunk but releases its missing bundle root", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const plan = byteBundlePlan(Buffer.from("mixed closure recovery", "utf8"));
    const batch = await reserveExpiredBatch(index, "batch-recovery-mixed", plan);
    const chunkEnvelope = plan.items.find((item) => item.durabilityTier === 0)!.envelope;
    await artifactStore.put(chunkEnvelope);

    const recovered = await recoverExpiredArtifactPublicationBatches({
      index,
      store: artifactStore,
      now: batch.recoveryNow,
    });

    const chunk = batch.items.find((item) => item.durabilityTier === 0)!;
    const root = batch.items.find((item) => item.durabilityTier === 1)!;
    assert.equal(recovered[0]?.resolution, "released");
    assert.equal(recovered[0]?.members.find((item) => item.identity.hash === chunk.identity.hash)?.action, "published");
    assert.equal(recovered[0]?.members.find((item) => item.identity.hash === root.identity.hash)?.action, "released");
    assert.ok(await index.getArtifact(chunk.identity.hash));
    assert.equal(await index.getArtifact(root.identity.hash), undefined);
  });

  it("never indexes an exact bundle root whose declared chunk is missing", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const plan = byteBundlePlan(Buffer.from("missing chunk recovery", "utf8"));
    const batch = await reserveExpiredBatch(index, "batch-recovery-missing-chunk", plan);
    const rootEnvelope = plan.items.find((item) => item.durabilityTier === 1)!.envelope;
    await artifactStore.put(rootEnvelope);

    const recovered = await recoverExpiredArtifactPublicationBatches({
      index,
      store: artifactStore,
      now: batch.recoveryNow,
    });

    const root = batch.items.find((item) => item.durabilityTier === 1)!;
    assert.equal(recovered[0]?.resolution, "released");
    assert.equal(recovered[0]?.members.find((item) => item.identity.hash === root.identity.hash)?.observation, "exact");
    assert.equal(recovered[0]?.members.find((item) => item.identity.hash === root.identity.hash)?.action, "released");
    assert.equal(await index.getArtifact(root.identity.hash), undefined);
  });

  it("quarantines a dependency root whose durable plan omits its declared member", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const completePlan = byteBundlePlan(Buffer.from("plan omits dependency", "utf8"));
    const incompletePlan = {
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: completePlan.items
        .filter((item) => item.durabilityTier === 1)
        .map((item) => ({ ...item, durabilityTier: 0 })),
    };
    const batch = await reserveExpiredBatch(
      index,
      "batch-recovery-plan-omits-dependency",
      incompletePlan,
    );
    await artifactStore.put(incompletePlan.items[0]!.envelope);

    const recovered = await recoverExpiredArtifactPublicationBatches({
      index,
      store: artifactStore,
      now: batch.recoveryNow,
    });

    assert.equal(recovered[0]?.resolution, "quarantined");
    assert.match(
      recovered[0]?.diagnostic ?? "",
      /^ARTIFACT_CLOSURE_PLAN_MISMATCH:/,
    );
    assert.equal(recovered[0]?.members[0]?.observation, "exact");
    assert.equal(recovered[0]?.members[0]?.action, "quarantined");
    assert.equal(await index.getArtifact(batch.items[0]!.identity.hash), undefined);
    assert.equal((await index.getCapacity()).state, "quarantined");
  });

  it("quarantines a corrupt expired aggregate from typed CAS evidence", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const batch = await reserveExpiredBatch(
      index,
      "batch-recovery-corrupt",
      leafPlan("corrupt-batch"),
    );
    await mkdir(artifactStore.root, { recursive: true });
    await writeFile(
      artifactStore.pathFor(batch.items[0]!.identity.hash),
      Buffer.from("corrupt", "utf8"),
    );

    const recovered = await recoverExpiredArtifactPublicationBatches({
      index,
      store: artifactStore,
      now: batch.recoveryNow,
    });

    assert.equal(recovered[0]?.resolution, "quarantined");
    assert.equal(recovered[0]?.members[0]?.observation, "corrupt");
    assert.equal(recovered[0]?.members[0]?.action, "quarantined");
    assert.equal((await index.getCapacity()).state, "quarantined");
  });

  it("lets one concurrent aggregate recoverer complete and reports one bounded stale result", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const batch = await reserveExpiredBatch(
      index,
      "batch-recovery-concurrent",
      leafPlan("concurrent-batch"),
    );
    await artifactStore.putPreparedBatch(batch.prepared);
    let readCount = 0;
    let releaseReads!: () => void;
    const bothReading = new Promise<void>((resolve) => { releaseReads = resolve; });
    const racedStore = {
      async get(hash: string) {
        const value = await artifactStore.get(hash);
        readCount += 1;
        if (readCount === 2) releaseReads();
        await bothReading;
        return value;
      },
    };

    const results = await Promise.all([
      recoverExpiredArtifactPublicationBatches({
        index,
        store: racedStore,
        ownerInstanceId: "batch-recovery-a",
        now: batch.recoveryNow,
      }),
      recoverExpiredArtifactPublicationBatches({
        index,
        store: racedStore,
        ownerInstanceId: "batch-recovery-b",
        now: batch.recoveryNow,
      }),
    ]);

    assert.deepEqual(
      results.flat().map((item) => item.resolution).sort(),
      ["completed", "stale"],
    );
    assert.deepEqual(await recoverExpiredArtifactPublicationBatches({
      index,
      store: artifactStore,
      now: new Date(batch.recoveryNow.getTime() + 1),
    }), []);
  });

  it("returns stale without reading CAS when a heartbeat replaces the listed generation", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000 });
    const plan = leafPlan("heartbeat-race");
    const prepared = prepareArtifactStoreBatchPlanV1(plan);
    const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
    const binding = createArtifactPublicationBatchPlanBindingV1(items.map((item) => ({
      durabilityTier: item.durabilityTier,
      identity: item.identity,
    })));
    const createdAt = new Date();
    const batch = await index.reservePublicationBatch({
      batchReservationId: "batch-recovery-heartbeat-race",
      artifacts: items.map((item) => item.identity),
      plan: binding,
      ownerInstanceId: "live-heartbeat-owner",
      leaseMs: 2_000,
      now: createdAt,
    });
    let snapshotCalls = 0;
    let casReads = 0;
    const recoveryIndex = {
      ...index,
      async getPublicationBatchRecoverySnapshot(
        input: Parameters<typeof index.getPublicationBatchRecoverySnapshot>[0],
      ) {
        snapshotCalls += 1;
        if (snapshotCalls === 1) {
          await index.heartbeatPublicationBatch({
            batchReservationId: batch.batchReservationId,
            ownerInstanceId: "live-heartbeat-owner",
            leaseToken: batch.leaseToken!,
            leaseMs: 60_000,
            now: new Date(createdAt.getTime() + 1),
          });
        }
        return index.getPublicationBatchRecoverySnapshot(input);
      },
    };

    const recovered = await recoverExpiredArtifactPublicationBatches({
      index: recoveryIndex,
      store: {
        get: async (hash) => {
          casReads += 1;
          return artifactStore.get(hash);
        },
      },
      now: new Date(createdAt.getTime() + 3_000),
    });

    assert.equal(recovered[0]?.resolution, "stale");
    assert.equal(recovered[0]?.diagnostic, "ARTIFACT_BATCH_RECOVERY_STALE_GENERATION");
    assert.equal(casReads, 0);
    assert.equal(recovered[0]?.members[0]?.observation, "not_observed");
  });

  it("treats missing CAS bytes for an already-indexed batch member as corruption", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000_000, maxPayloadBytes: 5_000_000 });
    const publisher = new IndexedArtifactPublisher({
      index: {
        ...index,
        publishPublicationBatchItem: async (input) => {
          if (input.artifact.artifactType === BYTE_BUNDLE_ARTIFACT_TYPE_V1) {
            throw new Error("injected root index failure");
          }
          return index.publishPublicationBatchItem(input);
        },
      },
      store: artifactStore,
      ownerInstanceId: "batch-indexed-cas-loss",
      leaseMs: 2_000,
    });
    await assert.rejects(
      publisher.putBatch({
        batchReservationId: "batch-recovery-indexed-cas-loss",
        plan: byteBundlePlan(Buffer.from("indexed CAS loss", "utf8")),
      }),
      /injected root index failure/,
    );
    const failedSnapshot = await index.getPublicationBatchRecoverySnapshot({
      batchReservationId: "batch-recovery-indexed-cas-loss",
    });
    const indexed = failedSnapshot.members.find((member) => member.authority.kind === "indexed")!;
    await unlink(artifactStore.pathFor(indexed.artifact.hash));

    const recovered = await recoverExpiredArtifactPublicationBatches({
      index,
      store: artifactStore,
      now: new Date(new Date(failedSnapshot.lifecycle.leaseExpiresAt!).getTime() + 1),
    });

    assert.equal(recovered[0]?.resolution, "quarantined");
    assert.equal(
      recovered[0]?.members.find((member) => member.identity.hash === indexed.artifact.hash)?.observation,
      "corrupt",
    );
    assert.equal((await index.getCapacity()).state, "quarantined");
  });

  it("preserves active recovery authority when CAS observation is transiently uncertain", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const batch = await reserveExpiredBatch(
      index,
      "batch-recovery-uncertain-read",
      leafPlan("uncertain-read"),
    );

    await assert.rejects(
      recoverExpiredArtifactPublicationBatches({
        index,
        store: {
          get: async () => {
            throw new ArtifactStoreError(
              "ARTIFACT_FILE_CHANGED_DURING_READ",
              "injected transient read race",
            );
          },
        },
        now: batch.recoveryNow,
      }),
      (error: unknown) => error instanceof ArtifactStoreError
        && error.code === "ARTIFACT_FILE_CHANGED_DURING_READ",
    );
    assert.equal((await index.getPublicationBatchLifecycle({
      batchReservationId: batch.reservation.batchReservationId,
    })).state, "active");
    assert.ok((await index.getCapacity()).reservedBytes > 0);
  });

  it("bounds each aggregate recovery pass and rejects invalid batch limits", async () => {
    const artifactStore = await store();
    const index = createArtifactIndex(database.sql);
    await index.bootstrap({ artifacts: [], quotaBytes: 10_000, maxPayloadBytes: 5_000, now: at(0) });
    const first = await reserveExpiredBatch(index, "batch-recovery-bound-a", leafPlan("bound-a"));
    await reserveExpiredBatch(index, "batch-recovery-bound-b", leafPlan("bound-b"));

    const one = await recoverExpiredArtifactPublicationBatches({
      index,
      store: artifactStore,
      maxBatches: 1,
      now: first.recoveryNow,
    });
    assert.equal(one.length, 1);
    const two = await recoverExpiredArtifactPublicationBatches({
      index,
      store: artifactStore,
      maxBatches: 1,
      now: new Date(first.recoveryNow.getTime() + 1),
    });
    assert.equal(two.length, 1);
    await assert.rejects(
      recoverExpiredArtifactPublicationBatches({
        index,
        store: artifactStore,
        maxBatches: 0,
      }),
      /recovery batch limit must be 1\.\.100/,
    );
  });
});
