import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyV3PreparationFailure,
  createV3PreparationFingerprint,
  decideV3PreparationFailure,
} from "../../src/execution/v3-preparation-decision.js";

const SHA = "a".repeat(40);
const TREE = "b".repeat(40);
const PACKET = "c".repeat(64);

function identity() {
  return {
    runId: "run-preparation",
    stepId: "implement",
    storyId: "US-002",
    packetHash: PACKET,
    sourceSha: SHA,
    sourceTreeHash: TREE,
    phase: "eligibility" as const,
    dependencyState: [{
      storyId: "US-001",
      state: "missing" as const,
    }],
  };
}

describe("v3 preparation decision", () => {
  it("maps typed preparation failures to ownership instead of prose/retry guesses", () => {
    assert.equal(
      classifyV3PreparationFailure({ code: "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING" }).action,
      "dependency_wait",
    );
    assert.equal(
      classifyV3PreparationFailure({ code: "V3_RUNTIME_EVIDENCE_STACK_UNSUPPORTED" }).action,
      "packet_amendment",
    );
    assert.equal(
      classifyV3PreparationFailure({ code: "V3_SLICE_SOURCE_CHANGED_DURING_CAPTURE" }).action,
      "ownership_wait",
    );
    assert.equal(
      classifyV3PreparationFailure({ code: "V3_SLICE_PUBLICATION_HASH_MISMATCH" }).action,
      "invariant_failure",
    );
    assert.deepEqual(
      classifyV3PreparationFailure({ code: "V3_ATTEMPT_DUPLICATE_UNCHANGED_SOURCE" }),
      { action: "invariant_failure", errorCode: "V3_ATTEMPT_DUPLICATE_UNCHANGED_SOURCE" },
    );
    assert.deepEqual(
      classifyV3PreparationFailure({ code: "V3_ATTEMPT_ACTIVE_CONFLICT" }),
      { action: "invariant_failure", errorCode: "V3_ATTEMPT_ACTIVE_CONFLICT" },
    );
    assert.equal(classifyV3PreparationFailure({ code: "40001" }).action, "bounded_infra");
    assert.equal(
      classifyV3PreparationFailure({ code: "V3_PREPARATION_WORKTREE_UNAVAILABLE" }).action,
      "ownership_wait",
    );
    assert.equal(classifyV3PreparationFailure(new Error("unknown")).action, "invariant_failure");
  });

  it("is invariant to dependency query order and changes on exact dependency delta", () => {
    const base = {
      ...identity(),
      schema: "setfarm.v3-preparation-identity.v1" as const,
      errorCode: "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING",
      dependencyState: [
        { storyId: "US-002", state: "missing" as const },
        { storyId: "US-001", state: "missing" as const },
      ],
    };
    const reversed = {
      ...base,
      dependencyState: [...base.dependencyState].reverse(),
    };
    assert.equal(createV3PreparationFingerprint(base), createV3PreparationFingerprint(reversed));
    assert.notEqual(
      createV3PreparationFingerprint(base),
      createV3PreparationFingerprint({
        ...base,
        dependencyState: [
          {
            storyId: "US-001",
            state: "ready",
            attemptId: "ATT_dependency-terminal-0001",
            disposition: "produced_delta",
            sourceAfterSha: SHA,
            sourceAfterTreeHash: TREE,
          },
          { storyId: "US-002", state: "missing" },
        ],
      }),
    );
  });

  it("turns an identical open fingerprint into a zero-claim, zero-model replay", () => {
    const first = decideV3PreparationFailure({
      identity: identity(),
      error: { code: "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING" },
    });
    assert.equal(first.action, "dependency_wait");
    assert.equal(first.consumesClaim, false);
    assert.equal(first.dispatchModel, false);

    const replay = decideV3PreparationFailure({
      identity: identity(),
      error: { code: "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING" },
      existingOpenFingerprint: first.fingerprint,
    });
    assert.equal(replay.action, "unchanged_replay");
    assert.equal(replay.fingerprint, first.fingerprint);
    assert.equal(replay.consumesClaim, false);
    assert.equal(replay.dispatchModel, false);
  });
});
