import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  runRuntimeCompletionEffectLedger,
} from "../../src/execution/runtime-completion-effect-runner.js";
import type { RuntimeCompletionEffect } from "../../src/execution/runtime-completion-effect-repository.js";
import {
  createRuntimeCompletionPlanV1,
  createSingleEffectCompletionPlanDescriptorV1,
} from "../../src/execution/schemas/runtime-completion-plan-v1.js";

function effectFixture(): RuntimeCompletionEffect {
  const prepared = createRuntimeCompletionPlanV1({
    requestId: "RCR_effect-runner-test-0001",
    claimId: 1,
    runId: "run-effect-runner",
    stepDbId: "step-effect-runner",
    workflowStepId: "implement",
    outputHash: "a".repeat(64),
    descriptor: createSingleEffectCompletionPlanDescriptorV1({
      kind: "story_completion",
      continuation: { type: "story_loop_continue" },
      subject: { storyDbId: "story-db-1", storyId: "US-001" },
      effectPayload: { exactDelta: "route-next-story" },
    }),
    preparedAt: new Date("2026-07-13T12:00:00.000Z"),
  });
  const spec = prepared.plan.effects[0]!;
  const payload = {
    schema: "setfarm.runtime-completion-effect-input.v1" as const,
    planHash: prepared.planHash,
    plan: prepared.plan,
    effect: spec.payload,
  };
  return {
    requestId: prepared.plan.requestId,
    effectKey: spec.effectKey,
    ordinal: spec.ordinal,
    effectType: spec.effectType,
    inputHash: hashCanonicalJson(payload),
    payload,
    mandatory: true,
    state: "pending",
    attemptCount: 0,
    result: {},
    evidence: {},
    createdAt: "2026-07-13T12:00:00.000Z",
    updatedAt: "2026-07-13T12:00:00.000Z",
  };
}

function fakeRepository(initial = effectFixture()) {
  let effect = { ...initial } as RuntimeCompletionEffect;
  let leaseGeneration = 0;
  const calls = { releases: 0, quarantines: 0, settles: 0 };
  const repository = {
    async listForRequest() { return [effect]; },
    async claimNext() {
      if (effect.state !== "pending") return undefined;
      leaseGeneration += 1;
      effect = {
        ...effect,
        state: "leased",
        ownerInstanceId: "owner-a",
        leaseToken: `lease-${leaseGeneration}`,
        leaseExpiresAt: "2099-01-01T00:00:00.000Z",
        attemptCount: effect.attemptCount + 1,
      };
      return effect;
    },
    async heartbeat() { return true; },
    async assertLease(input: { leaseToken: string }) {
      if (effect.state !== "leased" || effect.leaseToken !== input.leaseToken) {
        throw new Error("fake lease lost");
      }
      return effect;
    },
    async releaseForRetry(input: { leaseToken: string; diagnostic: string }) {
      await repository.assertLease(input);
      calls.releases += 1;
      effect = {
        ...effect,
        state: "pending",
        ownerInstanceId: undefined,
        leaseToken: undefined,
        leaseExpiresAt: undefined,
        result: { lastDiagnostic: input.diagnostic },
      };
    },
    async quarantine(input: { leaseToken: string; diagnostic: string }) {
      await repository.assertLease(input);
      calls.quarantines += 1;
      effect = {
        ...effect,
        state: "quarantined",
        ownerInstanceId: undefined,
        leaseToken: undefined,
        leaseExpiresAt: undefined,
        result: { diagnostic: input.diagnostic },
      };
      return effect;
    },
    async settle(input: {
      leaseToken: string;
      resolution: "applied" | "reconciled";
      result: Record<string, unknown>;
      evidence: Record<string, unknown>;
    }) {
      await repository.assertLease(input);
      calls.settles += 1;
      effect = {
        ...effect,
        state: input.resolution,
        ownerInstanceId: undefined,
        leaseToken: undefined,
        leaseExpiresAt: undefined,
        result: input.result,
        evidence: input.evidence,
      };
      return effect;
    },
  };
  return { repository, calls, current: () => effect };
}

describe("runtime completion effect runner", () => {
  it("reconciles an externally applied effect after a crash without applying twice", async () => {
    const fake = fakeRepository();
    let canonicalApplied = false;
    let applyCalls = 0;
    const result = await runRuntimeCompletionEffectLedger({
      requestId: fake.current().requestId,
      ownerInstanceId: "owner-a",
      repository: fake.repository,
      heartbeatIntervalMs: 100,
      handler: {
        reconcile: async () => canonicalApplied ? {
          resolution: "reconciled",
          result: { advanced: true, runCompleted: false },
          evidence: { source: "canonical-state" },
        } : undefined,
        apply: async () => {
          applyCalls += 1;
          canonicalApplied = true;
          throw new Error("fault-after-external-apply-before-receipt");
        },
      },
    });
    assert.equal(applyCalls, 1);
    assert.equal(fake.calls.releases, 1);
    assert.equal(fake.calls.settles, 1);
    assert.equal(fake.current().state, "reconciled");
    assert.equal(result.advanced, true);
  });

  it("quarantines a corrupt immutable effect input after bounded attempts", async () => {
    const corrupt = { ...effectFixture(), inputHash: "b".repeat(64) };
    const fake = fakeRepository(corrupt);
    let applyCalls = 0;
    await assert.rejects(
      runRuntimeCompletionEffectLedger({
        requestId: corrupt.requestId,
        ownerInstanceId: "owner-a",
        repository: fake.repository,
        maxAttempts: 3,
        heartbeatIntervalMs: 100,
        handler: {
          reconcile: async () => undefined,
          apply: async () => {
            applyCalls += 1;
            return { resolution: "applied", result: {}, evidence: {} };
          },
        },
      }),
      /RUNTIME_COMPLETION_EFFECT_ATTEMPTS_EXHAUSTED/,
    );
    assert.equal(applyCalls, 0);
    assert.equal(fake.calls.releases, 2);
    assert.equal(fake.calls.quarantines, 1);
    assert.equal(fake.current().state, "quarantined");
  });
});
