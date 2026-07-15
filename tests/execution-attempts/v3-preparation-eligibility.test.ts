import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createV3PreparationEligibilityEvaluator,
} from "../../src/execution/v3-preparation-eligibility.js";
import type { SealedRuntimePacketV1 } from "../../src/product-compiler/runtime-artifact-reader.js";
import { buildMinimalValidV3Contracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const PACKET_HASH = "a".repeat(64);
const SOURCE = { sha: "b".repeat(40), treeHash: "c".repeat(64) };

function packet(withRuntimeEvidence = true): SealedRuntimePacketV1 {
  const values = buildMinimalValidV3Contracts();
  if (!withRuntimeEvidence) {
    delete (values.buildTopology as any).runtimeEvidenceContract;
    delete (values.buildTopology as any).runtimeEvidenceContractHash;
  }
  const first = values.storyPlan.stories[0]!;
  values.storyPlan.stories.push({
    ...first,
    id: "US-002",
    order: first.order + 1,
    title: "Dependent story",
    dependsOn: [first.id],
  });
  return {
    runId: "run-preparation",
    packetHash: PACKET_HASH,
    producer: { pass: "test", codeSha: "abc1234", toolVersions: {} },
    productSpec: values.productSpec,
    designGraph: values.designGraph,
    buildTopology: values.buildTopology,
    storyPlan: values.storyPlan,
    packet: {} as SealedRuntimePacketV1["packet"],
    compilationReport: {} as SealedRuntimePacketV1["compilationReport"],
    refs: {
      productSpec: "1".repeat(64),
      designGraph: "2".repeat(64),
      buildTopology: "3".repeat(64),
      storyPlan: "4".repeat(64),
      packet: PACKET_HASH,
      compilationReport: "5".repeat(64),
    },
  };
}

describe("v3 preparation eligibility", () => {
  it("does not authorize a dependency from legacy story status without a successful packet-bound attempt", async () => {
    let reads = 0;
    const evaluator = createV3PreparationEligibilityEvaluator({
      readPacket: async () => packet(),
      captureSource: async () => SOURCE,
      readTerminalDependencyAttempts: async () => { reads += 1; return []; },
    });
    const result = await evaluator.evaluate({
      runId: "run-preparation",
      stepId: "implement",
      storyId: "US-002",
      sourceWorktree: "/project",
      projectedDependencyIds: ["US-001"],
    });
    assert.equal(reads, 1);
    assert.equal(result.status, "blocked");
    if (result.status !== "blocked") assert.fail("expected dependency wait");
    assert.equal(result.decision.action, "dependency_wait");
    assert.equal(result.decision.consumesClaim, false);
    assert.equal(result.decision.dispatchModel, false);
    assert.deepEqual(result.dependencyState, [{ storyId: "US-001", state: "missing" }]);
  });

  it("authorizes only the exact successful attempt bound to the active packet", async () => {
    let observedPacketHash = "";
    const evaluator = createV3PreparationEligibilityEvaluator({
      readPacket: async () => packet(),
      captureSource: async () => SOURCE,
      readTerminalDependencyAttempts: async (input) => {
        observedPacketHash = input.packetHash;
        return [{
          storyId: "US-001",
          attemptId: "ATT_dependency-terminal-0001",
          disposition: "produced_delta",
          sourceAfterSha: "d".repeat(40),
          sourceAfterTreeHash: "e".repeat(64),
        }];
      },
    });
    const result = await evaluator.evaluate({
      runId: "run-preparation",
      stepId: "implement",
      storyId: "US-002",
      sourceWorktree: "/project",
      projectedDependencyIds: ["US-001"],
    });
    assert.equal(observedPacketHash, PACKET_HASH);
    assert.equal(result.status, "ready");
    assert.equal(result.dependencyState[0]?.attemptId, "ATT_dependency-terminal-0001");
  });

  it("blocks packet/runtime and projection defects before claim publication", async () => {
    const unsupported = createV3PreparationEligibilityEvaluator({
      readPacket: async () => packet(false),
      captureSource: async () => SOURCE,
      readTerminalDependencyAttempts: async () => {
        assert.fail("unsealed runtime evidence must block before dependency lookup");
      },
    });
    const unsupportedResult = await unsupported.evaluate({
      runId: "run-preparation",
      stepId: "implement",
      storyId: "US-001",
      sourceWorktree: "/project",
    });
    assert.equal(unsupportedResult.status, "blocked");
    if (unsupportedResult.status !== "blocked") assert.fail("expected packet amendment");
    assert.equal(unsupportedResult.decision.action, "packet_amendment");

    const mismatch = createV3PreparationEligibilityEvaluator({
      readPacket: async () => packet(),
      captureSource: async () => SOURCE,
      readTerminalDependencyAttempts: async () => [],
    });
    const mismatchResult = await mismatch.evaluate({
      runId: "run-preparation",
      stepId: "implement",
      storyId: "US-002",
      sourceWorktree: "/project",
      projectedDependencyIds: [],
    });
    assert.equal(mismatchResult.status, "blocked");
    if (mismatchResult.status !== "blocked") assert.fail("expected invariant block");
    assert.equal(mismatchResult.decision.action, "invariant_failure");
  });

  it("deduplicates an unchanged open dependency fingerprint", async () => {
    let openFingerprint: string | undefined;
    const dependencies = {
      readPacket: async () => packet(),
      captureSource: async () => SOURCE,
      readTerminalDependencyAttempts: async () => [],
      readOpenFingerprint: async () => openFingerprint,
    };
    const evaluator = createV3PreparationEligibilityEvaluator(dependencies);
    const first = await evaluator.evaluate({
      runId: "run-preparation",
      stepId: "implement",
      storyId: "US-002",
      sourceWorktree: "/project",
      projectedDependencyIds: ["US-001"],
    });
    assert.equal(first.status, "blocked");
    if (first.status !== "blocked") assert.fail("expected dependency block");
    openFingerprint = first.decision.fingerprint;
    const replay = await evaluator.evaluate({
      runId: "run-preparation",
      stepId: "implement",
      storyId: "US-002",
      sourceWorktree: "/project",
      projectedDependencyIds: ["US-001"],
    });
    assert.equal(replay.status, "blocked");
    if (replay.status !== "blocked") assert.fail("expected replay block");
    assert.equal(replay.decision.action, "unchanged_replay");
  });
});
