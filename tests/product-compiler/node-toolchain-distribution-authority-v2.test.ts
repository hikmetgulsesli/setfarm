import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  link,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  NodeToolchainDistributionAuthorityErrorV2,
  copyVerifiedNodeToolchainDistributionArchiveBytesV2,
  disposeVerifiedNodeToolchainDistributionArchiveV2,
  inspectNodeToolchainDistributionVerificationReceiptV2,
  revalidateVerifiedNodeToolchainDistributionArchiveV2,
  verifyNodeToolchainDistributionArchiveV2,
  verifyNodeToolchainDistributionArchiveV2ForTest,
  type VerifiedNodeToolchainDistributionArchiveV2,
} from "../../src/product-compiler/node-toolchain-distribution-authority-v2.js";
import {
  NodeToolchainDistributionArtifactV2Schema,
  NodeToolchainDistributionManifestV2Schema,
  NodeToolchainDistributionVerificationReceiptV2Schema,
  hashNodeToolchainDistributionArtifactV2,
  hashNodeToolchainDistributionVerificationReceiptV2,
} from "../../src/product-compiler/schemas/node-toolchain-distribution-v2.js";
import {
  NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_HASH_V2,
  getCodeOwnedNodeToolchainDistributionManifestV2,
} from "../../src/product-compiler/node-toolchain-distribution-manifest-v2.js";

const roots: string[] = [];
const handles: VerifiedNodeToolchainDistributionArchiveV2[] = [];

function track(
  handle: VerifiedNodeToolchainDistributionArchiveV2,
): VerifiedNodeToolchainDistributionArchiveV2 {
  handles.push(handle);
  return handle;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function candidate(bytes: Uint8Array): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "setfarm-node-dist-v2-"));
  roots.push(root);
  const archivePath = path.join(root, "candidate.tar.xz");
  await writeFile(archivePath, bytes, { mode: 0o600 });
  await chmod(archivePath, 0o600);
  return archivePath;
}

function testArtifact(bytes: Uint8Array) {
  const identity = {
    schema: "setfarm.node-toolchain-distribution-artifact.v2" as const,
    artifactRef: "TEST_NODE_TOOLCHAIN_DISTRIBUTION_ARM64_V2",
    sourceAuthority: "test_fixture" as const,
    architecture: "arm64" as const,
    origin: "https://example.invalid/node-test.tar.xz",
    fileName: "node-test.tar.xz",
    mediaType: "application/x-xz" as const,
    archiveFormat: "tar_xz" as const,
    archiveRoot: "node-v22.23.1-darwin-arm64",
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
    expectedRuntime: {
      nodeVersion: "22.23.1" as const,
      modulesAbi: "127" as const,
      napiVersion: "10" as const,
      npmVersion: "10.9.8" as const,
      platform: "darwin" as const,
      architecture: "arm64" as const,
    },
    selection: {
      nodeExecutableLocator: "bin/node" as const,
      npmPackageRootLocator: "lib/node_modules/npm" as const,
      npmCliLocator: "lib/node_modules/npm/bin/npm-cli.js" as const,
      npmPackageJsonLocator: "lib/node_modules/npm/package.json" as const,
      npmBuiltinConfigLocator: "lib/node_modules/npm/npmrc" as const,
      npmBuiltinConfigExpectation: "absent" as const,
      discardUnselectedArchiveEntries: true as const,
    },
  };
  return NodeToolchainDistributionArtifactV2Schema.parse({
    ...identity,
    artifactHash: hashNodeToolchainDistributionArtifactV2(identity),
  });
}

afterEach(async () => {
  await Promise.all(handles.splice(0).map(async (handle) => {
    try {
      await disposeVerifiedNodeToolchainDistributionArchiveV2(handle);
    } catch {
      // A failed assertion must not hide the original test result.
    }
  }));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("NodeToolchainDistributionManifestV2", () => {
  it("pins the exact official Darwin archives and selected runtime identities", () => {
    const manifest = getCodeOwnedNodeToolchainDistributionManifestV2();
    assert.equal(NodeToolchainDistributionManifestV2Schema.parse(manifest).manifestHash, manifest.manifestHash);
    assert.equal(manifest.manifestHash, NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_HASH_V2);
    assert.equal(Object.isFrozen(manifest), true);
    assert.equal(Object.isFrozen(manifest.artifacts), true);
    assert.deepEqual(manifest.artifacts.map((artifact) => artifact.architecture), ["arm64", "x64"]);
    assert.deepEqual(manifest.artifacts.map((artifact) => artifact.byteLength), [25_962_500, 27_528_028]);
    assert.deepEqual(manifest.artifacts.map((artifact) => artifact.sha256), [
      "fb526811860f81dcac7dd8b2b55eca4accfc5d61c3b7c2508f2639faee8a738d",
      "efeec6641a2f15f5396d27cd0b32f5062d6689d1e9e5d89607d0b29bda890233",
    ]);
    assert.ok(manifest.artifacts.every((artifact) =>
      artifact.expectedRuntime.nodeVersion === "22.23.1"
      && artifact.expectedRuntime.npmVersion === "10.9.8"
      && artifact.expectedRuntime.modulesAbi === "127"
      && artifact.expectedRuntime.napiVersion === "10"));
    assert.equal(manifest.extraction.finalFileModes.nonExecutable, "0444");
    assert.equal(manifest.extraction.finalFileModes.executable, "0555");
    assert.equal(manifest.extraction.finalDirectoryMode, "0555");
    assert.equal(
      manifest.extraction.unselectedEntryPolicy,
      "inventory_then_discard_without_extraction_v2",
    );
    assert.equal(manifest.extraction.selectedClosureRejectSymlink, true);
  });
});

describe("verified Node toolchain distribution archive", () => {
  it("copies exact candidate bytes privately and returns one pathless receipt", async () => {
    const bytes = randomBytes(256 * 1024 + 17);
    const archivePath = await candidate(bytes);
    const artifact = testArtifact(bytes);
    const handle = track(await verifyNodeToolchainDistributionArchiveV2ForTest({
      archivePath,
      artifact,
      manifestHash: "a".repeat(64),
    }));
    const receipt = inspectNodeToolchainDistributionVerificationReceiptV2(handle);

    assert.equal(receipt.admissionScope, "test_fixture");
    assert.equal(receipt.archive.sha256, sha256(bytes));
    assert.equal(receipt.archive.byteLength, bytes.byteLength);
    assert.equal(receipt.artifact.artifactHash, artifact.artifactHash);
    assert.equal(NodeToolchainDistributionVerificationReceiptV2Schema.parse(receipt).receiptHash, receipt.receiptHash);
    assert.equal(Object.isFrozen(receipt), true);
    assert.doesNotMatch(JSON.stringify(receipt), /setfarm-node-dist-v2|candidate\.tar|\/private\/|\/var\//);
    const firstCopy = await copyVerifiedNodeToolchainDistributionArchiveBytesV2(handle);
    assert.deepEqual(firstCopy, bytes);
    firstCopy.fill(0);
    assert.deepEqual(await copyVerifiedNodeToolchainDistributionArchiveBytesV2(handle), bytes);

    await chmod(archivePath, 0o600);
    await writeFile(archivePath, randomBytes(bytes.byteLength));
    assert.equal(
      (await revalidateVerifiedNodeToolchainDistributionArchiveV2(handle)).receiptHash,
      receipt.receiptHash,
    );
    await disposeVerifiedNodeToolchainDistributionArchiveV2(handle);
    assert.throws(() => inspectNodeToolchainDistributionVerificationReceiptV2(handle), {
      code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_DISPOSED",
    });
    await disposeVerifiedNodeToolchainDistributionArchiveV2(handle);
  });

  it("rejects wrong length and wrong digest before a handle exists", async () => {
    const bytes = Buffer.from("exact candidate bytes\n");
    const archivePath = await candidate(bytes);
    const artifact = testArtifact(bytes);
    const wrongLengthIdentity = { ...artifact, byteLength: artifact.byteLength + 1 };
    const { artifactHash: _wrongLengthHash, ...wrongLengthPayload } = wrongLengthIdentity;
    const wrongLength = NodeToolchainDistributionArtifactV2Schema.parse({
      ...wrongLengthPayload,
      artifactHash: hashNodeToolchainDistributionArtifactV2(wrongLengthPayload),
    });
    await assert.rejects(verifyNodeToolchainDistributionArchiveV2ForTest({
      archivePath,
      artifact: wrongLength,
      manifestHash: "a".repeat(64),
    }), { code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_LENGTH_MISMATCH" });

    const wrongDigestIdentity = { ...artifact, sha256: "b".repeat(64) };
    const { artifactHash: _wrongDigestHash, ...wrongDigestPayload } = wrongDigestIdentity;
    const wrongDigest = NodeToolchainDistributionArtifactV2Schema.parse({
      ...wrongDigestPayload,
      artifactHash: hashNodeToolchainDistributionArtifactV2(wrongDigestPayload),
    });
    await assert.rejects(verifyNodeToolchainDistributionArchiveV2ForTest({
      archivePath,
      artifact: wrongDigest,
      manifestHash: "a".repeat(64),
    }), { code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_DIGEST_MISMATCH" });
  });

  it("rejects symlink, hard-link and concurrent source substitution", async () => {
    const bytes = Buffer.from("archive bytes\n");
    const original = await candidate(bytes);
    const artifact = testArtifact(bytes);
    const symlinkPath = path.join(path.dirname(original), "symlink.tar.xz");
    await symlink(original, symlinkPath);
    await assert.rejects(verifyNodeToolchainDistributionArchiveV2ForTest({
      archivePath: symlinkPath,
      artifact,
      manifestHash: "a".repeat(64),
    }), { code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_SOURCE_INVALID" });

    const hardlinkPath = path.join(path.dirname(original), "hardlink.tar.xz");
    await link(original, hardlinkPath);
    await assert.rejects(verifyNodeToolchainDistributionArchiveV2ForTest({
      archivePath: hardlinkPath,
      artifact,
      manifestHash: "a".repeat(64),
    }), { code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_SOURCE_INVALID" });

    await rm(hardlinkPath);
    await assert.rejects(verifyNodeToolchainDistributionArchiveV2ForTest({
      archivePath: original,
      artifact,
      manifestHash: "a".repeat(64),
      testHooks: {
        afterSourceCopy: async () => {
          await chmod(original, 0o600);
          await writeFile(original, Buffer.alloc(bytes.byteLength, 0x61));
        },
      },
    }), { code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_SOURCE_CHANGED" });
  });

  it("rejects corruption of the private copy before issuing authority", async () => {
    const bytes = Buffer.from("archive bytes\n");
    const archivePath = await candidate(bytes);
    await assert.rejects(verifyNodeToolchainDistributionArchiveV2ForTest({
      archivePath,
      artifact: testArtifact(bytes),
      manifestHash: "a".repeat(64),
      testHooks: {
        afterPrivateSync: async ({ privateArchivePath }) => {
          await chmod(privateArchivePath, 0o600);
          await writeFile(privateArchivePath, Buffer.alloc(bytes.byteLength, 0x62));
        },
      },
    }), { code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_PRIVATE_COPY_MISMATCH" });
  });

  it("rejects forged receipts, proxy handles and schema-valid self-rehashing", async () => {
    const bytes = Buffer.from("archive bytes\n");
    const archivePath = await candidate(bytes);
    const handle = track(await verifyNodeToolchainDistributionArchiveV2ForTest({
      archivePath,
      artifact: testArtifact(bytes),
      manifestHash: "a".repeat(64),
    }));
    const receipt = inspectNodeToolchainDistributionVerificationReceiptV2(handle);
    assert.throws(() => inspectNodeToolchainDistributionVerificationReceiptV2(receipt as never), {
      code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED",
    });
    await assert.rejects(copyVerifiedNodeToolchainDistributionArchiveBytesV2(receipt as never), {
      code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED",
    });
    assert.throws(() => inspectNodeToolchainDistributionVerificationReceiptV2(new Proxy(handle, {}) as never), {
      code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED",
    });
    const { receiptHash: _receiptHash, ...payload } = receipt;
    const { artifactHash: _artifactHash, ...artifactIdentity } = payload.artifact;
    const forgedArtifactIdentity = {
      ...artifactIdentity,
      sha256: "c".repeat(64),
    };
    const forgedArtifact = {
      ...forgedArtifactIdentity,
      artifactHash: hashNodeToolchainDistributionArtifactV2(forgedArtifactIdentity),
    };
    const forged = {
      ...payload,
      artifact: forgedArtifact,
      archive: { ...payload.archive, sha256: "c".repeat(64) },
      receiptHash: "d".repeat(64),
    };
    forged.receiptHash = hashNodeToolchainDistributionVerificationReceiptV2(forged);
    assert.equal(NodeToolchainDistributionVerificationReceiptV2Schema.safeParse(forged).success, true);
    assert.throws(() => inspectNodeToolchainDistributionVerificationReceiptV2(forged as never), {
      code: "NODE_TOOLCHAIN_DISTRIBUTION_V2_HANDLE_UNAUTHENTICATED",
    });
    await disposeVerifiedNodeToolchainDistributionArchiveV2(handle);
  });

  it("keeps production expectations code-owned and rejects extra input authority", async () => {
    const source = await readFile(
      path.resolve("src/product-compiler/node-toolchain-distribution-authority-v2.ts"),
      "utf8",
    );
    assert.match(source, /getCodeOwnedNodeToolchainDistributionManifestV2/);
    assert.match(source, /verifyNodeToolchainDistributionArchiveV2\(input: unknown\)/);
    assert.doesNotMatch(source, /expectedSha256/);

    await assert.rejects(verifyNodeToolchainDistributionArchiveV2({
      architecture: "arm64",
      archivePath: "/tmp/candidate.tar.xz",
      expectedSha256: "a".repeat(64),
    } as never), (error: unknown) => error instanceof NodeToolchainDistributionAuthorityErrorV2
      && error.code === "NODE_TOOLCHAIN_DISTRIBUTION_V2_INPUT_INVALID");
  });
});
