import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  DeepByteBundleVerificationErrorV2,
  copyVerifiedDeepByteBundleBytesV2,
  createDeepByteBundleCasAuthorityV2,
  verifyDeepByteBundleFromCasV2,
} from "../../src/product-compiler/deep-byte-bundle-verifier-v2.js";
import {
  createHybridArtifactStoreCapacityLeaseProviderV1,
} from "../../src/product-compiler/artifact-store-authority.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { createArtifactIndexForTests as createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import {
  IndexedArtifactPublisher,
} from "../../src/product-compiler/indexed-artifact-publisher.js";
import {
  getCodeOwnedNodeScaffoldAssetPublicationV2,
  verifyCodeOwnedNodeScaffoldAssetByteBundleV2,
} from "../../src/product-compiler/node-scaffold-toolchain-catalog-v2.js";
import {
  NODE_SCAFFOLD_CANONICAL_TEXT_BY_PROFILE_V2,
} from "../../src/product-compiler/node-scaffold-assets-v2.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  prepareArtifactStoreBatchPlanV1,
} from "../../src/product-compiler/artifact-store-batch-plan.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  createByteBundleV1,
} from "../../src/product-compiler/schemas/byte-bundle-v1.js";
import {
  DeepByteBundleVerificationReceiptV2Schema,
  hashDeepByteBundleConsumerBindingV2,
  hashDeepByteBundleVerificationReceiptV2,
} from "../../src/product-compiler/schemas/deep-byte-bundle-verification-receipt-v2.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";

const LIMITS = Object.freeze({
  maxPayloadBytes: 4 * 1024 * 1024,
  rootQuotaBytes: 256 * 1024 * 1024,
  minFreeBytes: 0,
});

const TEST_PRODUCER = Object.freeze({
  pass: "deep-byte-bundle-verifier-v2-test",
  codeSha: "a".repeat(40),
  model: "code-owned",
  toolVersions: Object.freeze({ byteBundle: "1.0.0" }),
});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function testBinding(subjectRef = "TEST_BYTE_BUNDLE_V2") {
  const withoutHash = {
    authoritySchema: "setfarm.test-byte-bundle-authority.v2",
    authorityHash: "b".repeat(64),
    subjectRef,
    subjectHash: "c".repeat(64),
  };
  return {
    ...withoutHash,
    bindingHash: hashDeepByteBundleConsumerBindingV2(withoutHash),
  };
}

function bundleRef(produced: Extract<ReturnType<typeof createByteBundleV1>, { status: "produced" }>) {
  return {
    artifactType: BYTE_BUNDLE_ARTIFACT_TYPE_V1,
    envelopeHash: produced.bundle.envelopeHash,
    envelopeByteLength: produced.bundle.envelopeByteLength,
    rawHash: produced.rawHash,
    rawByteLength: produced.rawByteLength,
  };
}

describe("DeepByteBundleVerificationReceiptV2 CAS authority", () => {
  let database: TestDatabase;
  let sandbox: string;
  let artifactRoot: string;
  let index: ReturnType<typeof createArtifactIndex>;
  let writer: ContentAddressedArtifactStore;

  before(async () => {
    database = await createIsolatedTestDatabase();
    sandbox = await mkdtemp(path.join(tmpdir(), "setfarm-deep-byte-bundle-v2-"));
  });

  after(async () => {
    await rm(sandbox, { recursive: true, force: true });
    await database.cleanup();
  });

  beforeEach(async (context) => {
    await database.reset();
    index = createArtifactIndex(database.sql);
    await index.bootstrap({
      artifacts: [],
      quotaBytes: LIMITS.rootQuotaBytes,
      maxPayloadBytes: LIMITS.maxPayloadBytes,
    });
    artifactRoot = path.join(
      sandbox,
      `${context.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${randomUUID()}`,
      "sha256",
    );
    await mkdir(path.dirname(artifactRoot), { recursive: true });
    writer = new ContentAddressedArtifactStore(artifactRoot, {
      limits: LIMITS,
      capacityLeaseProvider: createHybridArtifactStoreCapacityLeaseProviderV1({
        sql: database.sql,
        artifactRoot,
        purpose: "writer",
      }),
    });
  });

  function reader(
    reads?: string[],
  ) {
    return createDeepByteBundleCasAuthorityV2({
      sql: database.sql,
      artifactRoot,
      artifactLimits: LIMITS,
      ...(reads
        ? { testHooks: { afterArtifactRead: ({ artifactHash }: { artifactHash: string }) => {
          reads.push(artifactHash);
        } } }
        : {}),
    });
  }

  async function publish(plan: unknown, id = randomUUID()): Promise<void> {
    const publisher = new IndexedArtifactPublisher({
      index,
      store: writer,
      ownerInstanceId: `deep-byte-bundle-v2-${id}`,
      publicationAuthority: "hybrid-required",
    });
    await publisher.putBatch({ batchReservationId: id, plan });
  }

  async function publishScaffoldAssets(): Promise<
  ReturnType<typeof getCodeOwnedNodeScaffoldAssetPublicationV2>> {
    const publication = getCodeOwnedNodeScaffoldAssetPublicationV2();
    for (const batch of publication.batches) await publish(batch.plan);
    return publication;
  }

  it("publishes every code-owned scaffold bundle and returns pathless authenticated bytes", async () => {
    const publication = getCodeOwnedNodeScaffoldAssetPublicationV2();
    assert.equal(publication.fileCount, 6);
    assert.equal(publication.files.length, 6);
    assert.equal(publication.batchCount, 2);
    assert.deepEqual(publication.batches.map((batch) => batch.plan.items.length), [6, 6]);
    assert.ok(publication.batches.every((batch) =>
      batch.plan.schema === ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1
      && batch.planIdentityHash.length === 64));
    for (const batch of publication.batches) await publish(batch.plan);
    const roleKey = {
      package_manifest: "packageJson",
      dependency_lock_manifest: "packageLockJson",
      typescript_compiler_config: "tsconfigJson",
    } as const;
    for (const file of publication.files) {
      const verified = await verifyCodeOwnedNodeScaffoldAssetByteBundleV2({
        authority: reader(),
        profileId: file.profileId,
        role: file.role,
      });
      const bytes = copyVerifiedDeepByteBundleBytesV2(verified);
      assert.equal(
        bytes.toString("utf8"),
        NODE_SCAFFOLD_CANONICAL_TEXT_BY_PROFILE_V2[file.profileId][roleKey[file.role]],
      );
      assert.equal(verified.receipt.status, "verified");
      assert.equal(verified.receipt.bundle.rawHash, sha256(bytes));
      assert.equal(verified.receipt.binding.bindingHash, file.binding.bindingHash);
      assert.equal(verified.receipt.chunkCount, 1);
      assert.equal(verified.receipt.closureMemberCount, 2);
      assert.equal(Object.isFrozen(verified), true);
      assert.equal(Object.isFrozen(verified.receipt), true);
      const serialized = JSON.stringify(verified.receipt);
      assert.doesNotMatch(serialized, /setfarm-deep-byte-bundle-v2|\/sha256|\.json/);
    }
  });

  it("keeps private verified bytes stable when a caller mutates a returned copy", async () => {
    await publishScaffoldAssets();
    const verified = await verifyCodeOwnedNodeScaffoldAssetByteBundleV2({
      authority: reader(),
      profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      role: "typescript_compiler_config",
    });
    const first = copyVerifiedDeepByteBundleBytesV2(verified);
    const expected = Buffer.from(first);
    first.fill(0);
    assert.deepEqual(copyVerifiedDeepByteBundleBytesV2(verified), expected);
  });

  it("reads every declared chunk before classifying a missing dependency", async () => {
    const raw = Buffer.alloc((2 * 1024 * 1024 * 2) + 17, 0x41);
    raw.fill(0x42, 2 * 1024 * 1024, 4 * 1024 * 1024);
    raw.fill(0x43, 4 * 1024 * 1024);
    const produced = createByteBundleV1({ bytes: raw, producer: TEST_PRODUCER });
    assert.equal(produced.status, "produced");
    if (produced.status !== "produced") return;
    await publish({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [
        ...produced.chunks.map((chunk) => ({ durabilityTier: 0, envelope: chunk.envelope })),
        { durabilityTier: 1, envelope: produced.bundle.envelope },
      ],
    });
    const missing = produced.chunks[0]!.envelopeHash;
    await unlink(path.join(artifactRoot, `${missing}.json`));
    const reads: string[] = [];

    await assert.rejects(
      verifyDeepByteBundleFromCasV2({
        authority: reader(reads),
        binding: testBinding(),
        bundle: bundleRef(produced),
      }),
      (error: unknown) => error instanceof DeepByteBundleVerificationErrorV2
        && error.code === "DEEP_BYTE_BUNDLE_V2_CHUNK_UNAVAILABLE",
    );
    assert.ok(reads.includes(produced.bundle.envelopeHash));
    assert.ok(reads.includes(produced.chunks[1]!.envelopeHash));
    assert.ok(reads.includes(produced.chunks[2]!.envelopeHash));
  });

  it("rejects a hash-named corrupt chunk and never returns partial bytes", async () => {
    const produced = createByteBundleV1({
      bytes: Buffer.from("deep byte bundle corruption", "utf8"),
      producer: TEST_PRODUCER,
    });
    assert.equal(produced.status, "produced");
    if (produced.status !== "produced") return;
    await publish({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [
        { durabilityTier: 0, envelope: produced.chunks[0]!.envelope },
        { durabilityTier: 1, envelope: produced.bundle.envelope },
      ],
    });
    await writeFile(
      path.join(artifactRoot, `${produced.chunks[0]!.envelopeHash}.json`),
      canonicalJsonBytes(produced.bundle.envelope),
    );

    await assert.rejects(
      verifyDeepByteBundleFromCasV2({
        authority: reader(),
        binding: testBinding(),
        bundle: bundleRef(produced),
      }),
      (error: unknown) => error instanceof DeepByteBundleVerificationErrorV2
        && error.code === "DEEP_BYTE_BUNDLE_V2_CHUNK_UNAVAILABLE",
    );
  });

  it("rejects a complete filesystem bundle when any member lacks DB index authority", async () => {
    const produced = createByteBundleV1({
      bytes: Buffer.from("filesystem bytes are not DB-first authority", "utf8"),
      producer: TEST_PRODUCER,
    });
    assert.equal(produced.status, "produced");
    if (produced.status !== "produced") return;
    await writer.putPreparedBatch(prepareArtifactStoreBatchPlanV1({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [
        { durabilityTier: 0, envelope: produced.chunks[0]!.envelope },
        { durabilityTier: 1, envelope: produced.bundle.envelope },
      ],
    }));

    await assert.rejects(
      verifyDeepByteBundleFromCasV2({
        authority: reader(),
        binding: testBinding(),
        bundle: bundleRef(produced),
      }),
      (error: unknown) => error instanceof DeepByteBundleVerificationErrorV2
        && error.code === "DEEP_BYTE_BUNDLE_V2_INDEX_IDENTITY_MISMATCH"
        && [
          produced.bundle.envelopeHash,
          produced.chunks[0]!.envelopeHash,
        ].includes(error.artifactHash ?? ""),
    );
  });

  it("rejects cross-profile substitution through fresh code-owned root binding", async () => {
    const publication = getCodeOwnedNodeScaffoldAssetPublicationV2();
    const cli = publication.files.find((file) =>
      file.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      && file.role === "package_manifest")!;
    const api = publication.files.find((file) =>
      file.profileId === "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
      && file.role === "package_manifest")!;
    assert.notEqual(cli.byteBundle.envelopeHash, api.byteBundle.envelopeHash);
    const apiBatch = publication.batches.find((batch) =>
      batch.profileId === "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2")!;
    await publish({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: apiBatch.plan.items.filter((item) => {
        const bytes = canonicalJsonBytes(item.envelope);
        return sha256(bytes) !== cli.byteBundle.envelopeHash
          && item.envelope.payload.rawHash !== cli.rawHash;
      }),
    });

    await assert.rejects(
      verifyCodeOwnedNodeScaffoldAssetByteBundleV2({
        authority: reader(),
        profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
        role: "package_manifest",
      }),
      (error: unknown) => error instanceof DeepByteBundleVerificationErrorV2
        && error.code === "DEEP_BYTE_BUNDLE_V2_ROOT_UNAVAILABLE",
    );
  });

  it("treats a self-rehashed receipt as data, never as a byte capability", async () => {
    await publishScaffoldAssets();
    const verified = await verifyCodeOwnedNodeScaffoldAssetByteBundleV2({
      authority: reader(),
      profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      role: "dependency_lock_manifest",
    });
    const forged: any = structuredClone(verified.receipt);
    forged.binding.subjectRef = "FORGED_SELF_REHASHED_SUBJECT";
    const bindingWithoutHash = { ...forged.binding };
    delete bindingWithoutHash.bindingHash;
    forged.binding.bindingHash = hashDeepByteBundleConsumerBindingV2(bindingWithoutHash);
    forged.receiptHash = hashDeepByteBundleVerificationReceiptV2(forged);
    assert.equal(DeepByteBundleVerificationReceiptV2Schema.safeParse(forged).success, true);
    assert.throws(
      () => copyVerifiedDeepByteBundleBytesV2({ receipt: forged } as any),
      (error: unknown) => error instanceof DeepByteBundleVerificationErrorV2
        && error.code === "DEEP_BYTE_BUNDLE_V2_HANDLE_UNAUTHENTICATED",
    );
  });

  it("requires the authenticated CAS/index authority and rejects hostile public bindings", async () => {
    const produced = createByteBundleV1({
      bytes: Buffer.from("authority required", "utf8"),
      producer: TEST_PRODUCER,
    });
    assert.equal(produced.status, "produced");
    if (produced.status !== "produced") return;
    const standaloneRoot = path.join(sandbox, `standalone-${randomUUID()}`);
    const standalone = new ContentAddressedArtifactStore(standaloneRoot);
    await standalone.put(produced.chunks[0]!.envelope);
    await standalone.put(produced.bundle.envelope);

    await assert.rejects(
      verifyDeepByteBundleFromCasV2({
        authority: standalone as any,
        binding: testBinding(),
        bundle: bundleRef(produced),
      }),
      (error: unknown) => error instanceof DeepByteBundleVerificationErrorV2
        && error.code === "DEEP_BYTE_BUNDLE_V2_PRODUCTION_AUTHORITY_REQUIRED",
    );
    await assert.rejects(
      verifyDeepByteBundleFromCasV2({
        authority: reader(),
        binding: new Proxy(testBinding(), { ownKeys: () => { throw new Error("HOSTILE"); } }),
        bundle: bundleRef(produced),
      }),
      (error: unknown) => error instanceof DeepByteBundleVerificationErrorV2
        && error.code === "DEEP_BYTE_BUNDLE_V2_INPUT_INVALID",
    );

    await assert.rejects(
      verifyDeepByteBundleFromCasV2({
        authority: Object.freeze({
          schema: "setfarm.deep-byte-bundle-cas-authority.v2",
        }) as any,
        binding: testBinding(),
        bundle: bundleRef(produced),
      }),
      (error: unknown) => error instanceof DeepByteBundleVerificationErrorV2
        && error.code === "DEEP_BYTE_BUNDLE_V2_PRODUCTION_AUTHORITY_REQUIRED",
    );

    const oversized = { ...bundleRef(produced), rawByteLength: (16 * 1024 * 1024) + 1 };
    await assert.rejects(
      verifyDeepByteBundleFromCasV2({
        authority: reader(),
        binding: testBinding(),
        bundle: oversized,
      }),
      (error: unknown) => error instanceof DeepByteBundleVerificationErrorV2
        && error.code === "DEEP_BYTE_BUNDLE_V2_INPUT_INVALID",
    );
  });
});
