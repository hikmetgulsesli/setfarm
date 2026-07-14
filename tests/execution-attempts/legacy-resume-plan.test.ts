import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compileLegacyResumePlan,
  OPERATOR_ACTION_STATE_SCHEMA,
  type LegacyResumePlanSource,
} from "../../src/execution/legacy-resume-plan.js";

function step(
  runId: string,
  stepId: string,
  stepIndex: number,
  status: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: `STEP_${stepId}_${stepIndex}`,
    run_id: runId,
    step_id: stepId,
    agent_id: `agent-${stepId}`,
    step_index: stepIndex,
    input_template: `input-${stepId}`,
    expects: `expects-${stepId}`,
    type: "single",
    status,
    output: status === "failed" ? `failure-${stepId}` : null,
    retry_count: status === "failed" ? 2 : 0,
    max_retries: 3,
    abandoned_count: 1,
    current_story_id: null,
    loop_config: null,
    ...extra,
  };
}

function story(
  runId: string,
  storyId: string,
  storyIndex: number,
  status: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: `STORY_${storyId}`,
    run_id: runId,
    story_id: storyId,
    story_index: storyIndex,
    title: storyId,
    status,
    output: null,
    retry_count: 2,
    max_retries: 3,
    abandoned_count: 0,
    claimed_by: null,
    claimed_at: null,
    claim_generation: 1,
    pr_url: null,
    ...extra,
  };
}

function source(overrides: Partial<LegacyResumePlanSource> = {}): LegacyResumePlanSource {
  const runId = "RUN_legacy-resume-plan-0001";
  return {
    schema: OPERATOR_ACTION_STATE_SCHEMA,
    run: {
      id: runId,
      workflow_id: "feature-dev",
      protocol: "legacy",
      protocol_version: 1,
      status: "failed",
      context: JSON.stringify({ branch: "main", previous_failure: "stale" }),
      meta: JSON.stringify({ terminal_failure: true, durable: "preserve" }),
    },
    steps: [
      step(runId, "plan", 0, "done"),
      step(runId, "implement", 1, "failed", { type: "loop", loop_config: "{}" }),
      step(runId, "verify", 2, "failed"),
      step(runId, "deploy", 3, "skipped"),
    ],
    stories: [story(runId, "US-001", 0, "failed")],
    ...overrides,
  };
}

describe("versioned legacy resume plan", () => {
  it("chooses the first failed target, resets only its downstream terminal suffix, and scrubs transient state", () => {
    const result = compileLegacyResumePlan(source());
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.equal(result.plan.schema, "setfarm.legacy-resume-plan.v1");
    assert.equal(result.plan.targetWorkflowStepId, "implement");
    assert.deepEqual(result.plan.stepMutations.map((item) => [item.workflowStepId, item.fromStatus, item.toStatus]), [
      ["implement", "failed", "pending"],
      ["verify", "failed", "waiting"],
      ["deploy", "skipped", "waiting"],
    ]);
    assert.deepEqual(result.plan.storyMutations.map((item) => item.storyId), ["US-001"]);
    assert.deepEqual(JSON.parse(result.plan.contextAfter), { branch: "main" });
    assert.deepEqual(JSON.parse(result.plan.metaAfter), { durable: "preserve" });
    assert.match(result.plan.stateHash, /^[a-f0-9]{64}$/);
    assert.match(result.plan.planHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(compileLegacyResumePlan(source()), result);
  });

  it("changes the action state hash for hidden context, meta, loop config, topology, or story state", () => {
    const baseline = compileLegacyResumePlan(source()).stateHash;
    const variants = [
      source({ run: { ...source().run, context: JSON.stringify({ branch: "other" }) } }),
      source({ run: { ...source().run, meta: JSON.stringify({ durable: "changed" }) } }),
      source({ steps: source().steps.map((row, index) => index === 1 ? { ...row, loop_config: '{"verifyEach":false}' } : row) }),
      source({ steps: source().steps.map((row, index) => index === 3 ? { ...row, step_index: 4 } : row) }),
      source({ stories: source().stories.map((row) => ({ ...row, retry_count: 3 })) }),
    ];
    for (const variant of variants) assert.notEqual(compileLegacyResumePlan(variant).stateHash, baseline);
  });

  it("uses exactly one active verifyEach loop, keeps verify waiting, and preserves done or PR-backed stories", () => {
    const base = source();
    const result = compileLegacyResumePlan(source({
      steps: [
        step(String(base.run.id), "plan", 0, "done"),
        step(String(base.run.id), "implement", 1, "failed", {
          type: "loop",
          loop_config: JSON.stringify({ verifyEach: true, verifyStep: "verify" }),
        }),
        step(String(base.run.id), "verify", 2, "failed"),
        step(String(base.run.id), "deploy", 3, "failed"),
      ],
      stories: [
        story(String(base.run.id), "US-001", 0, "failed"),
        story(String(base.run.id), "US-002", 1, "skipped", { pr_url: "https://example.test/pr/2" }),
        story(String(base.run.id), "US-003", 2, "done"),
        story(String(base.run.id), "US-004", 3, "verified"),
      ],
    }));
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    // The loop itself is the first failed target here, so it resumes directly;
    // verifyEach special mode is used only when the verify step is the target.
    assert.equal(result.plan.mode, "direct");
    assert.deepEqual(result.plan.storyMutations.map((item) => item.storyId), ["US-001"]);

    const verifyTarget = source({
      steps: [
        step(String(base.run.id), "plan", 0, "done"),
        step(String(base.run.id), "implement", 1, "running", {
          type: "loop",
          loop_config: JSON.stringify({ verifyEach: true, verifyStep: "verify" }),
        }),
        step(String(base.run.id), "verify", 2, "failed"),
        step(String(base.run.id), "deploy", 3, "failed"),
      ],
    });
    const special = compileLegacyResumePlan(verifyTarget);
    assert.equal(special.status, "ready");
    if (special.status !== "ready") return;
    assert.equal(special.plan.mode, "verify_each");
    assert.deepEqual(special.plan.stepMutations.map((item) => [item.workflowStepId, item.toStatus]), [
      ["implement", "pending"],
      ["verify", "waiting"],
      ["deploy", "waiting"],
    ]);
  });

  it("does not reopen a done verifyEach loop", () => {
    const base = source();
    const result = compileLegacyResumePlan(source({
      steps: [
        step(String(base.run.id), "implement", 0, "done", {
          type: "loop",
          loop_config: JSON.stringify({ verifyEach: true, verifyStep: "verify" }),
        }),
        step(String(base.run.id), "verify", 1, "failed"),
      ],
    }));
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.equal(result.plan.mode, "direct");
    assert.deepEqual(result.plan.stepMutations.map((item) => [item.workflowStepId, item.toStatus]), [["verify", "pending"]]);
  });

  it("fails closed on malformed JSON, ambiguous topology/verifyEach ownership, and missing target", () => {
    const base = source();
    const cases: Array<[LegacyResumePlanSource, string]> = [
      [source({ run: { ...base.run, context: "{" } }), "LEGACY_RESUME_PLAN_CONTEXT_INVALID"],
      [source({ run: { ...base.run, meta: "[]" } }), "LEGACY_RESUME_PLAN_META_INVALID"],
      [source({ steps: base.steps.map((row, index) => index === 1 ? { ...row, loop_config: "{" } : row) }), "LEGACY_RESUME_PLAN_LOOP_CONFIG_INVALID"],
      [source({ steps: base.steps.map((row, index) => index === 1 ? { ...row, loop_config: null } : row) }), "LEGACY_RESUME_PLAN_LOOP_CONFIG_INVALID"],
      [source({ steps: [base.steps[0]!, { ...base.steps[1]!, step_id: "plan" }] }), "LEGACY_RESUME_PLAN_TOPOLOGY_AMBIGUOUS"],
      [source({ steps: base.steps.map((row) => ({ ...row, status: "done" })) }), "LEGACY_RESUME_PLAN_TARGET_MISSING"],
      [source({
        steps: [
          step(String(base.run.id), "loop-a", 0, "running", { type: "loop", loop_config: JSON.stringify({ verifyEach: true, verifyStep: "verify" }) }),
          step(String(base.run.id), "loop-b", 1, "running", { type: "loop", loop_config: JSON.stringify({ verifyEach: true, verifyStep: "verify" }) }),
          step(String(base.run.id), "verify", 2, "failed"),
        ],
      }), "LEGACY_RESUME_PLAN_VERIFY_EACH_AMBIGUOUS"],
    ];
    for (const [input, reasonCode] of cases) {
      const result = compileLegacyResumePlan(input);
      assert.equal(result.status, "denied");
      if (result.status === "denied") assert.equal(result.reasonCode, reasonCode);
    }
  });
});
