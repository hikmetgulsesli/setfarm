import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  createArtifactPublicationBatchPlanBindingV1,
  prepareArtifactStoreBatchPlanV1,
} from "../../src/product-compiler/artifact-store-batch-plan.js";
import { createArtifactIndexForTests } from "../../src/product-compiler/artifact-index.js";
import { recoverExpiredArtifactPublicationBatches } from "../../src/product-compiler/indexed-artifact-publisher.js";
import { createByteBundleV1 } from "../../src/product-compiler/schemas/byte-bundle-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const producer = Object.freeze({
  pass: "batch-recovery-integration-test",
  codeSha: "d".repeat(40),
  toolVersions: Object.freeze({ node: "22", setfarm: "test" }),
});

describe("artifact publication batch crash recovery", () => {
  let database: TestDatabase;
  const roots: string[] = [];

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => {
    await database.cleanup();
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  });

  it("completes one durable CAS batch after its original database owner disappears", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-batch-recovery-integration-"));
    roots.push(root);
    const store = new ContentAddressedArtifactStore(root);
    const index = createArtifactIndexForTests(database.sql);
    const recoveryAt = new Date();
    const reservedAt = new Date(recoveryAt.getTime() - 1_000);
    await index.bootstrap({
      artifacts: [],
      quotaBytes: 1_000_000,
      maxPayloadBytes: 100_000,
      now: reservedAt,
    });

    const bundle = createByteBundleV1({
      bytes: Buffer.from("durable bytes outlive their original publisher", "utf8"),
      producer,
    });
    assert.equal(bundle.status, "produced");
    if (bundle.status !== "produced") return;
    const prepared = prepareArtifactStoreBatchPlanV1({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [
        ...bundle.chunks.map((chunk) => ({
          durabilityTier: 0,
          envelope: chunk.envelope,
        })),
        { durabilityTier: 1, envelope: bundle.bundle.envelope },
      ],
    });
    const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
    const plan = createArtifactPublicationBatchPlanBindingV1(items.map((item) => ({
      durabilityTier: item.durabilityTier,
      identity: item.identity,
    })));
    const reservation = await index.reservePublicationBatch({
      batchReservationId: "batch-recovery-crash-integration",
      artifacts: items.map((item) => item.identity),
      plan,
      ownerInstanceId: "publisher-that-disappeared",
      leaseMs: 100,
      now: reservedAt,
    });

    await store.putPreparedBatch(prepared);
    assert.deepEqual(await index.listExpired(recoveryAt), []);
    const publicationOrder: string[] = [];
    const recoveryIndex = {
      ...index,
      async publishPublicationBatchItem(
        input: Parameters<typeof index.publishPublicationBatchItem>[0],
      ) {
        publicationOrder.push(input.artifact.hash);
        return index.publishPublicationBatchItem(input);
      },
    };

    const recovered = await recoverExpiredArtifactPublicationBatches({
      index: recoveryIndex,
      store,
      ownerInstanceId: "bounded-recovery-owner",
      now: recoveryAt,
    });

    assert.equal(recovered.length, 1);
    assert.equal(recovered[0]?.schema, "setfarm.artifact-publication-batch-recovery-result.v1");
    assert.equal(recovered[0]?.batchReservationId, reservation.batchReservationId);
    assert.equal(recovered[0]?.resolution, "completed");
    assert.deepEqual(publicationOrder, items.map((item) => item.identity.hash));
    assert.deepEqual(
      recovered[0]?.members.map((member) => [member.observation, member.action]),
      items.map(() => ["exact", "published"]),
    );
    assert.equal((await index.getCapacity()).reservedBytes, 0);
    assert.deepEqual(await recoverExpiredArtifactPublicationBatches({
      index,
      store,
      now: new Date(recoveryAt.getTime() + 1),
    }), []);
  });
});
