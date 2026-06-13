import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRunOperationalModel } from "../src/server/run-operational-model.js";
import type { RunInfo, StepInfo } from "../src/installer/status.js";

function run(overrides: Partial<RunInfo> = {}): RunInfo {
  return {
    id: "run-1",
    run_number: 862,
    workflow_id: "feature-dev",
    task: "Build a compact browser-game called FluxRail Lite with keyboard controls and gameplay.",
    status: "failed",
    context: JSON.stringify({ stack_pack_id: "browser-game-canvas", tech_stack: "browser-game" }),
    created_at: "2026-06-06T12:00:00.000Z",
    updated_at: "2026-06-06T13:00:00.000Z",
    ...overrides,
  };
}

function step(step_id: string, status: string, output = ""): StepInfo {
  return {
    id: `step-${step_id}`,
    run_id: "run-1",
    step_id,
    agent_id: `feature-dev_${step_id}`,
    step_index: 1,
    input_template: "",
    expects: "",
    status,
    output,
    retry_count: 0,
    max_retries: 5,
    created_at: "2026-06-06T12:00:00.000Z",
    updated_at: "2026-06-06T13:00:00.000Z",
  };
}

describe("run operational model", () => {
  it("classifies merged PR smoke failures as post-merge product regressions without reopening implement", () => {
    const model = buildRunOperationalModel({
      run: run(),
      steps: [
        step("plan", "done"),
        step("implement", "done"),
        step("verify", "failed", [
          "POST_MERGE_QUALITY_REGRESSION:",
          "US-003 PR is already MERGED; Setfarm must not reopen or recode the original story branch.",
          "SYSTEM_SMOKE_FAILURE:",
          "VERIFY_SYSTEM_SMOKE_FAILURE for US-003",
        ].join("\n")),
      ],
      stories: [
        { story_id: "US-001", status: "verified", retry_count: 6, max_retries: 7 },
        { story_id: "US-002", status: "verified", retry_count: 0, max_retries: 5 },
        { story_id: "US-003", status: "done", retry_count: 3, max_retries: 5, pr_url: "https://github.test/pull/3" },
      ],
    });

    assert.equal(model.stack.stackPackId, "browser-game-canvas");
    assert.equal(model.stack.runtimeKind, "browser");
    assert.equal(model.failure.present, true);
    assert.equal(model.failure.category, "post_merge_quality_regression");
    assert.equal(model.failure.owner, "product");
    assert.equal(model.failure.action, "manual_review");
    assert.equal(model.failure.postMergeQualityRegression, true);
    assert.equal(model.failure.recoveryPolicy, "manual_review");
    assert.equal(model.failure.retryable, false);
    assert.equal(model.pipeline.currentStepId, null);
    assert.equal(model.pipeline.failedStepId, "verify");
    assert.deepEqual(model.stories, {
      total: 3,
      verified: 2,
      doneAwaitingVerify: 1,
      failed: 0,
      skipped: 0,
      running: 0,
      pending: 0,
      completed: 2,
    });
  });

  it("classifies exhausted PR review repair loops as product manual review", () => {
    const model = buildRunOperationalModel({
      run: run(),
      steps: [
        step("plan", "done"),
        step("implement", "failed", [
          "Story US-001 retries exhausted (6/5):",
          "PR_REVIEW_COMMENTS_OPEN: US-001 has actionable PR review comments that must be fixed before merge.",
        ].join("\n")),
      ],
      stories: [
        {
          story_id: "US-001",
          status: "failed",
          retry_count: 6,
          max_retries: 5,
          output: "PR_REVIEW_COMMENTS_OPEN: US-001 has actionable PR review comments that must be fixed before merge.",
        },
        { story_id: "US-002", status: "pending" },
      ],
      observations: [
        {
          step_id: "implement",
          status: "info",
          summary: "ambiguous_failure/unknown: Failure is not mechanically confirmed as platform failure.",
          detail: "older platform-self-heal observation should not mask the failed story output",
        },
      ],
    });

    assert.equal(model.failure.present, true);
    assert.equal(model.failure.owner, "product");
    assert.equal(model.failure.action, "manual_review");
    assert.equal(model.failure.category, "pr_review_retry_exhausted");
    assert.equal(model.failure.recoveryPolicy, "manual_review");
    assert.equal(model.failure.retryable, false);
  });

  it("keeps verified story counts separate from done-awaiting-verify", () => {
    const model = buildRunOperationalModel({
      run: run({ status: "completed" }),
      steps: [step("plan", "done"), step("verify", "done")],
      stories: [
        { story_id: "US-001", status: "verified" },
        { story_id: "US-002", status: "verified" },
        { story_id: "US-003", status: "verified" },
      ],
    });

    assert.equal(model.run.terminal, true);
    assert.equal(model.stories.total, 3);
    assert.equal(model.stories.verified, 3);
    assert.equal(model.stories.completed, 3);
    assert.equal(model.stories.doneAwaitingVerify, 0);
    assert.equal(model.failure.present, false);
  });

  it("does not let a generic vite context hide browser-game stack intent", () => {
    const model = buildRunOperationalModel({
      run: run({
        context: JSON.stringify({ stack_pack_id: "vite-react-web-app", tech_stack: "browser-game" }),
      }),
      steps: [step("plan", "done")],
      stories: [],
    });

    assert.equal(model.stack.stackPackId, "browser-game-canvas");
    assert.equal(model.stack.confidence, "high");
    assert.match(model.stack.evidence.join(" "), /override generic vite-react/);
  });

  it("does not infer browser-game stack from explicit non-game task text", () => {
    const model = buildRunOperationalModel({
      run: run({
        task: "Build a compact browser tool called StackLens Canary. Use a frontend web app stack, not a game. Compare module stack health across projects.",
        status: "running",
        context: JSON.stringify({ tech_stack: "vite-react", platform: "web" }),
      }),
      steps: [step("plan", "done"), step("design", "running")],
      stories: [],
    });

    assert.equal(model.stack.stackPackId, "vite-react-web-app");
    assert.equal(model.stack.confidence, "low");
    assert.notEqual(model.stack.stackPackId, "browser-game-canvas");
  });
});
