import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { compileProductBuildPacket } from "../../src/product-compiler/packet-compiler.js";
import { compileImplementationSlice } from "../../src/product-compiler/slice-compiler.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

const PRODUCER = {
  pass: "product-packet-compiler",
  codeSha: "5840ae3",
  toolVersions: { zod: "4.4.3" },
};

describe("implementation slice compiler", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function sealedInput() {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-slice-compiler-"));
    roots.push(root);
    const artifactStore = new ContentAddressedArtifactStore(path.join(root, "artifacts"));
    const values = buildMinimalValidContracts();
    const compilation = await compileProductBuildPacket({
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      compiler: { version: "3.0.0-shadow.1", codeSha: "5840ae3" },
      producer: PRODUCER,
      artifactStore,
    });
    assert.equal(compilation.status, "sealed");
    return {
      packetHash: compilation.packetHash!,
      packet: compilation.packet!,
      productSpec: values.productSpec,
      designGraph: values.designGraph,
      buildTopology: values.buildTopology,
      storyPlan: values.storyPlan,
      storyId: "US-001",
      sourceRevision: {
        sha: "3".repeat(40),
        treeHash: "4".repeat(40),
      },
      producer: PRODUCER,
      fileContentHashes: { PATH_APP: "f".repeat(64) },
      dependencySignatures: {},
    };
  }

  it("produces the same slice for the same packet, story, and source revision", async () => {
    const input = await sealedInput();
    const first = compileImplementationSlice(input);
    const second = compileImplementationSlice(input);

    assert.equal(first.status, "compiled");
    assert.equal(second.status, "compiled");
    assert.equal(second.sliceHash, first.sliceHash);
    assert.deepEqual(second.slice, first.slice);
    assert.equal(first.slice?.packetHash, input.packetHash);
    assert.equal(first.slice?.storyId, "US-001");
    assert.deepEqual(first.slice?.contract.actions.map((item) => item.id), ["ACT_SAVE_TASK"]);
    assert.deepEqual(first.slice?.contract.controls.map((item) => item.id), ["CTRL_SAVE_TASK"]);
    assert.deepEqual(first.slice?.files, [{
      pathRef: "PATH_APP",
      path: "src/App.tsx",
      role: "owned",
      knownContentHash: "f".repeat(64),
    }]);
  });

  it("changes the slice hash when source SHA or tree changes", async () => {
    const input = await sealedInput();
    const original = compileImplementationSlice(input);
    const changedSha = compileImplementationSlice({
      ...input,
      sourceRevision: { ...input.sourceRevision, sha: "5".repeat(40) },
    });
    const changedTree = compileImplementationSlice({
      ...input,
      sourceRevision: { ...input.sourceRevision, treeHash: "6".repeat(40) },
    });
    assert.equal(original.status, "compiled");
    assert.equal(changedSha.status, "compiled");
    assert.equal(changedTree.status, "compiled");
    assert.notEqual(changedSha.sliceHash, original.sliceHash);
    assert.notEqual(changedTree.sliceHash, original.sliceHash);
  });

  it("rejects a missing owned-file content hash", async () => {
    const input = await sealedInput();
    input.fileContentHashes = {};
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.diagnostics.some((item) => item.code === "SLICE_OWNED_FILE_HASH_MISSING"),
      true,
    );
  });

  it("rejects child payloads that do not match the sealed packet hashes", async () => {
    const input = await sealedInput();
    input.productSpec.actions[0]!.name = "Mutated after sealing";
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "rejected");
    assert.equal(
      result.diagnostics.some((item) => item.code === "SLICE_PRODUCT_SPEC_HASH_MISMATCH"),
      true,
    );
  });

  it("rejects absent story identity instead of reconstructing it from prose", async () => {
    const input = await sealedInput();
    input.storyId = "US-999";
    const result = compileImplementationSlice(input);
    assert.equal(result.status, "rejected");
    assert.equal(result.diagnostics.some((item) => item.code === "SLICE_STORY_NOT_FOUND"), true);
  });
});
