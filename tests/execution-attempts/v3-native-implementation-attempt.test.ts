import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { verifyLegacyImplementationSliceV2 } from "../../src/product-compiler/slice-compiler-v2-legacy.js";
import { createV3ImplementationAttemptV2Assembler } from "../../src/execution/v3-implementation-attempt-v2.js";
import { createV3PreparationClaimAuthorityV2 } from "../../src/execution/v3-preparation-claim-authority-v2.js";
import { nativeJoinPacket, nativeJoinSourceFixture, NATIVE_JOIN_LIMITS } from "./helpers/native-implementation-join-fixture.js";

// These are witness controls. Feature RED lives in preclaim and the owned join;
// this file deliberately never imports an as-yet-unimplemented service.
describe("native original compiler witnesses", () => {
  const roots: string[] = [];
  afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

  async function fixture() {
    const source = await nativeJoinSourceFixture();
    roots.push(source.root);
    const packet = nativeJoinPacket("run-native-original-witness");
    const authority = createV3PreparationClaimAuthorityV2({
      stateVersion: 1, runId: packet.runId, stepId: "implement", storyId: "US-001",
      packetHash: packet.packetHash, compilationReportHash: packet.refs.compilationReport,
      baseRevision: source.sourceBefore, projectedDependencyIds: [], dependencyAttempts: [],
    });
    const assembler = createV3ImplementationAttemptV2Assembler({ readPacket: async () => packet });
    const input = { runId: packet.runId, stepId: "implement", storyId: "US-001",
      worktree: source.worktree, preparationAuthority: authority };
    return { ...source, packet, assembler, input, assembled: await assembler.assemble(input) };
  }

  // Break: reconstructing original compiler input from a dirty current worktree.
  it("reproduces the original native slice after allowed source edits without reassembly", async () => {
    const value = await fixture();
    const original = structuredClone(value.assembled.sliceVerificationInput);
    await writeFile(path.join(value.worktree, "src/index.ts"), "export const implementationChanged = true;\n");
    const verified = verifyLegacyImplementationSliceV2(original);
    assert.equal(verified.status, "verified", JSON.stringify(verified));
    if (verified.status !== "verified") assert.fail("immutable original witnesses must reproduce");
    assert.equal(verified.sliceHash, value.assembled.sliceHash);
    assert.deepEqual(verified.slice, value.assembled.slice);
    await assert.rejects(value.assembler.assemble(value.input), { code: "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH" });
    assert.equal("evidencePlan" in value.assembled, false);
    assert.equal("attempt" in value.assembled, false);
  });

  it("rejects changed original source signatures even when the slice itself is unchanged", async () => {
    const value = await fixture();
    const changed = structuredClone(value.assembled.sliceVerificationInput);
    changed.compilerInput.currentFiles[0]!.contentHash = "f".repeat(64);
    assert.equal(verifyLegacyImplementationSliceV2(changed).status, "rejected");
  });

  it("authenticates stored native slice bytes and refuses corrupted CAS", async () => {
    const value = await fixture();
    const store = new ContentAddressedArtifactStore(path.join(value.root, "artifacts"), { limits: NATIVE_JOIN_LIMITS });
    const stored = await store.put(value.assembled.envelope);
    assert.equal(stored.hash, value.assembled.sliceHash);
    const read = await store.get(stored.hash);
    assert.deepEqual(read.envelope.payload, value.assembled.slice);
    await writeFile(stored.path, "{}\n");
    await assert.rejects(store.get(stored.hash));
  });
});
