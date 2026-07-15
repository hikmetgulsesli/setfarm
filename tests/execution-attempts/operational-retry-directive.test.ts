import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OperationalRetryDirectiveV1Schema,
  createOperationalRetryDirectiveV1,
  parseOperationalRetryDirectiveStoryOutput,
  resolveV3ExecutionProfile,
  serializeOperationalRetryDirectiveV1,
} from "../../src/execution/operational-retry-directive.js";

const source = Object.freeze({ sha: "1".repeat(40), treeHash: "2".repeat(64) });

function fixture() {
  return createOperationalRetryDirectiveV1({
    runId: "run-operational-retry",
    stepId: "implement",
    storyId: "US-001",
    priorAttempt: {
      claimId: 5429,
      attemptId: "ATT_operational-retry-0001",
      generation: 1,
      attemptClass: "product_implementation",
      packetHash: "3".repeat(64),
      sliceHash: "4".repeat(64),
      sourceBefore: source,
      terminalDisposition: "inconclusive",
    },
    failure: {
      code: "IMPLEMENT_NO_DELTA_STALL",
      diagnostic: "IMPLEMENT_NO_DELTA_STALL: no source delta before the bounded model deadline",
    },
    nextSourceRevision: source,
    allowedPaths: ["src/test/bridge.ts", "src/App.tsx", "src/App.tsx"],
  });
}

describe("operational retry directive v1", () => {
  it("canonically binds the prior attempt, failure evidence, expected delta, and one fallback", () => {
    const directive = fixture();
    assert.equal(directive.schema, "setfarm.operational-retry-directive.v1");
    assert.equal(directive.priorAttempt.attemptClass, "product_implementation");
    assert.deepEqual(directive.expectedDelta.allowedPaths, ["src/App.tsx", "src/test/bridge.ts"]);
    assert.deepEqual(directive.retryBudget, { ordinal: 1, limit: 1 });
    assert.deepEqual(directive.executionProfile, {
      schema: "setfarm.model-execution-profile.v1",
      providerId: "kimi",
      modelId: "kimi/kimi-for-coding",
      selection: "fallback",
    });
    assert.equal(parseOperationalRetryDirectiveStoryOutput(serializeOperationalRetryDirectiveV1(directive))?.directiveHash, directive.directiveHash);
    assert.deepEqual(OperationalRetryDirectiveV1Schema.parse(directive), directive);
  });

  it("rejects tampered evidence, directive identity, path order, and reset source", () => {
    const directive = fixture();
    assert.equal(OperationalRetryDirectiveV1Schema.safeParse({
      ...directive,
      failure: { ...directive.failure, diagnostic: `${directive.failure.diagnostic} tampered` },
    }).success, false);
    assert.equal(OperationalRetryDirectiveV1Schema.safeParse({
      ...directive,
      directiveHash: "0".repeat(64),
    }).success, false);
    assert.equal(OperationalRetryDirectiveV1Schema.safeParse({
      ...directive,
      expectedDelta: {
        ...directive.expectedDelta,
        allowedPaths: [...directive.expectedDelta.allowedPaths].reverse(),
      },
    }).success, false);
    assert.equal(OperationalRetryDirectiveV1Schema.safeParse({
      ...directive,
      nextSourceRevision: { ...source, treeHash: "5".repeat(64) },
    }).success, false);
    assert.equal(OperationalRetryDirectiveV1Schema.safeParse({
      ...directive,
      executionProfile: {
        ...directive.executionProfile,
        providerId: "other",
        modelId: "other/fallback-model",
      },
    }).success, false);
  });

  it("ignores ordinary legacy output but fails closed for a malformed schema lookalike", () => {
    assert.equal(parseOperationalRetryDirectiveStoryOutput("STATUS: retry\nlegacy prose"), undefined);
    assert.equal(parseOperationalRetryDirectiveStoryOutput(JSON.stringify({ schema: "another.schema" })), undefined);
    assert.throws(
      () => parseOperationalRetryDirectiveStoryOutput(JSON.stringify({
        schema: "setfarm.operational-retry-directive.v1",
        directiveHash: "0".repeat(64),
      })),
      /operational-retry-directive|Required|expected/i,
    );
  });

  it("selects MiniMax M3 initially and Kimi only for the bounded fallback", () => {
    assert.deepEqual(resolveV3ExecutionProfile("primary"), {
      schema: "setfarm.model-execution-profile.v1",
      providerId: "minimax",
      modelId: "minimax/MiniMax-M3",
      selection: "primary",
    });
    assert.deepEqual(resolveV3ExecutionProfile("fallback"), fixture().executionProfile);
    assert.throws(
      () => createOperationalRetryDirectiveV1({
        runId: "run-operational-retry",
        stepId: "implement",
        storyId: "US-001",
        priorAttempt: fixture().priorAttempt,
        failure: fixture().failure,
        nextSourceRevision: source,
        allowedPaths: ["src/App.tsx"],
        executionProfile: {
          schema: "setfarm.model-execution-profile.v1",
          providerId: "other",
          modelId: "other/fallback-model",
          selection: "fallback",
        },
      }),
      /canonical Kimi fallback profile/i,
    );
  });
});
