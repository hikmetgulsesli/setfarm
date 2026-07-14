import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createV3SealedRuntimeManifestV1,
  V3SealedRuntimeManifestV1Schema,
} from "../../src/execution/schemas/v3-sealed-runtime-manifest-v1.js";

const runId = "run-v3-sealed-runtime-manifest";
const candidateHash = "a".repeat(64);
const buildArtifactHash = "b".repeat(64);

function manifest() {
  return createV3SealedRuntimeManifestV1({
    schema: "setfarm.v3-sealed-runtime-manifest.v1",
    runId,
    candidateHash,
    sourceRevision: { sha: "c".repeat(40), treeHash: "d".repeat(64) },
    buildArtifactHash,
    runtimeDataContractHash: "9".repeat(64),
    dependencyRoots: ["node_modules"],
    directories: ["dist", "node_modules", "node_modules/runtime-value"],
    files: [
      {
        path: "dist/index.html",
        byteLength: 6,
        contentHash: "e".repeat(64),
        executable: false,
      },
      {
        path: "node_modules/runtime-value/index.js",
        byteLength: 7,
        contentHash: "f".repeat(64),
        executable: false,
      },
      {
        path: "source.ts",
        byteLength: 8,
        contentHash: "1".repeat(64),
        executable: false,
      },
    ],
    totalBytes: 21,
  });
}

describe("v3 sealed runtime manifest", () => {
  it("binds canonical source, build, dependency, directory, and file identity", () => {
    const value = manifest();
    assert.deepEqual(V3SealedRuntimeManifestV1Schema.parse(value), value);
    assert.equal(
      value.evidenceRef,
      `setfarm://deploy/sealed-runtime-manifest/${runId}/${candidateHash}/${buildArtifactHash}/${value.manifestHash}`,
    );
  });

  it("rejects changed bytes, evidence refs, and non-canonical topology", () => {
    const value = manifest();
    assert.throws(
      () => V3SealedRuntimeManifestV1Schema.parse({
        ...value,
        files: value.files.map((file, index) => index === 0 ? { ...file, contentHash: "2".repeat(64) } : file),
      }),
      /manifest hash mismatch/i,
    );
    assert.throws(
      () => V3SealedRuntimeManifestV1Schema.parse({ ...value, evidenceRef: "setfarm://wrong" }),
      /evidence reference mismatch/i,
    );
    assert.throws(
      () => createV3SealedRuntimeManifestV1({
        schema: "setfarm.v3-sealed-runtime-manifest.v1",
        runId,
        candidateHash,
        sourceRevision: value.sourceRevision,
        buildArtifactHash,
        runtimeDataContractHash: value.runtimeDataContractHash,
        dependencyRoots: ["node_modules"],
        directories: ["node_modules/runtime-value", "node_modules", "dist"],
        files: value.files,
        totalBytes: value.totalBytes,
      }),
      /directories must be unique and canonically sorted/i,
    );
  });
});
