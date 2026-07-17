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
  createArtifactIndexForTests as createArtifactIndex,
  type ArtifactIdentity,
} from "../../src/product-compiler/artifact-index.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import {
  IndexedArtifactPublisher,
  bootstrapArtifactIndex,
  recoverExpiredArtifactPublications,
  scanArtifactInventory,
} from "../../src/product-compiler/indexed-artifact-publisher.js";
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

function identity(value: ReturnType<typeof envelope>): ArtifactIdentity {
  const bytes = canonicalJsonBytes(value);
  return {
    hash: createHash("sha256").update(bytes).digest("hex"),
    artifactType: value.artifactType,
    byteLength: bytes.length,
    producer: value.producer,
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
      "TRUNCATE product_packets, run_artifact_refs, artifact_publication_reservations, semantic_artifacts CASCADE",
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
