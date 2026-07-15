import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createV3PreDispatchFailureV1,
  decideV3PreDispatchDispositionV1,
  V3_PRE_DISPATCH_TRANSIENT_ATTEMPT_LIMIT,
} from "../../src/execution/v3-pre-dispatch-failure.js";
import { V3ImplementationAttemptError } from "../../src/execution/v3-implementation-attempt.js";

function identity(sourceSha = "a".repeat(40)) {
  return {
    runId: "run-v3-pre-dispatch",
    stepId: "implement",
    storyId: "US-002",
    packetHash: "b".repeat(64),
    sourceSha,
    sourceTreeHash: "c".repeat(40),
    phase: "reservation" as const,
    dependencyState: [{
      storyId: "US-001",
      state: "ready" as const,
      attemptId: "ATT_dependency-0001",
      disposition: "produced_delta" as const,
      sourceAfterSha: "d".repeat(40),
      sourceAfterTreeHash: "e".repeat(40),
    }],
  };
}

describe("v3 pre-dispatch failure ownership", () => {
  it("terminalizes the #2035 evidence-contract class on its first exact occurrence", () => {
    const failure = createV3PreDispatchFailureV1({
      identity: identity(),
      error: new V3ImplementationAttemptError(
        "V3_EVIDENCE_PLAN_COMPILATION_REJECTED",
        "EVIDENCE_PLAN_ACTION_MISSING:EVID_PERSISTENCE_RELOAD",
      ),
    });
    const disposition = decideV3PreDispatchDispositionV1({
      failure,
      priorEquivalentFailures: 0,
    });
    assert.equal(failure.decision.action, "packet_amendment");
    assert.equal(disposition.occurrence, 1);
    assert.equal(disposition.disposition, "terminal_contract");
    assert.equal(disposition.claimOutcome, "failed");
    assert.equal(disposition.runTerminal, true);
    assert.match(disposition.diagnostic, /V3_EVIDENCE_PLAN_COMPILATION_REJECTED/);
    assert.match(disposition.diagnostic, /EVIDENCE_PLAN_ACTION_MISSING:EVID_PERSISTENCE_RELOAD/);
  });

  it("allows only two exact transient retries and terminalizes the third", () => {
    const failure = createV3PreDispatchFailureV1({
      identity: identity(),
      error: Object.assign(new Error("temporary database timeout"), { code: "ETIMEDOUT" }),
    });
    assert.equal(failure.decision.action, "bounded_infra");
    for (let prior = 0; prior < V3_PRE_DISPATCH_TRANSIENT_ATTEMPT_LIMIT; prior += 1) {
      const disposition = decideV3PreDispatchDispositionV1({ failure, priorEquivalentFailures: prior });
      assert.equal(disposition.occurrence, prior + 1);
      assert.equal(disposition.disposition, prior < 2 ? "retry_transient" : "terminal_contract");
    }
  });

  it("binds the retry budget to exact source identity and fails untyped errors closed", () => {
    const first = createV3PreDispatchFailureV1({
      identity: identity(),
      error: Object.assign(new Error("temporary database timeout"), { code: "ETIMEDOUT" }),
    });
    const changed = createV3PreDispatchFailureV1({
      identity: identity("f".repeat(40)),
      error: Object.assign(new Error("temporary database timeout"), { code: "ETIMEDOUT" }),
    });
    assert.notEqual(first.decision.fingerprint, changed.decision.fingerprint);

    const untyped = createV3PreDispatchFailureV1({
      identity: identity(),
      error: new Error("unknown reservation failure"),
    });
    assert.equal(untyped.decision.action, "invariant_failure");
    assert.equal(decideV3PreDispatchDispositionV1({
      failure: untyped,
      priorEquivalentFailures: 0,
    }).disposition, "terminal_contract");
  });

  it("never retries a refused typed operational retry", () => {
    const failure = createV3PreDispatchFailureV1({
      identity: identity(),
      error: Object.assign(new Error("temporary database timeout"), { code: "ETIMEDOUT" }),
    });
    const disposition = decideV3PreDispatchDispositionV1({
      failure,
      priorEquivalentFailures: 0,
      forceTerminal: true,
    });
    assert.equal(disposition.disposition, "terminal_contract");
    assert.equal(disposition.occurrence, 1);
  });
});
