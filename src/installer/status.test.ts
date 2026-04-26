import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { pgQuery, pgGet, pgRun, now } from "../db-pg.js";
import { stopWorkflow } from "./status.js";
import type { StopWorkflowResult } from "./status.js";

// Helper to create a test run with steps
async function createTestRun(opts: {
  runId: string;
  workflowId: string;
  status?: string;
  steps?: Array<{ stepId: string; status: string; output?: string | null }>;
}) {
  const ts = now();
  await pgRun(
    "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES ($1, $2, $3, $4, '{}', $5, $6)",
    [opts.runId, opts.workflowId, "test task", opts.status ?? "running", ts, ts]
  );

  if (opts.steps) {
    for (let i = 0; i < opts.steps.length; i++) {
      const s = opts.steps[i];
      await pgRun(
        "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, '', '', $6, $7, $8, $9)",
        [
          crypto.randomUUID(),
          opts.runId,
          s.stepId,
          "test-agent",
          i,
          s.status,
          s.output ?? null,
          ts,
          ts,
        ]
      );
    }
  }
}

// Helper to clean up a test run and its steps
async function cleanupTestRun(runId: string) {
  await pgRun("DELETE FROM steps WHERE run_id = $1", [runId]);
  await pgRun("DELETE FROM runs WHERE id = $1", [runId]);
}

describe("stopWorkflow", () => {
  const testRunIds: string[] = [];

  afterEach(async () => {
    for (const id of testRunIds) {
      await cleanupTestRun(id);
    }
    testRunIds.length = 0;
  });

  it("stops a running workflow with mixed step statuses and returns correct cancelled count", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-1",
      status: "running",
      steps: [
        { stepId: "plan", status: "done", output: "plan output" },
        { stepId: "implement", status: "running" },
        { stepId: "verify", status: "waiting" },
        { stepId: "deploy", status: "pending" },
      ],
    });

    const result = await stopWorkflow(runId);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return; // narrow type
    assert.equal(result.runId, runId);
    assert.equal(result.workflowId, "test-wf-1");
    assert.equal(result.cancelledSteps, 3); // running + waiting + pending

    // Verify DB state
    const run = await pgGet<{ status: string }>("SELECT status FROM runs WHERE id = $1", [runId]);
    assert.equal(run?.status, "cancelled");

    const steps = await pgQuery<{ step_id: string; status: string; output: string | null }>(
      "SELECT step_id, status, output FROM steps WHERE run_id = $1 ORDER BY step_index", [runId]
    );
    assert.equal(steps[0].status, "done"); // done step unchanged
    assert.equal(steps[0].output, "plan output"); // done step output unchanged
    assert.equal(steps[1].status, "cancelled");
    assert.equal(steps[1].output, "Cancelled by user");
    assert.equal(steps[2].status, "cancelled");
    assert.equal(steps[2].output, "Cancelled by user");
    assert.equal(steps[3].status, "cancelled");
    assert.equal(steps[3].output, "Cancelled by user");
  });

  it("returns not_found for a non-existent run", async () => {
    const result = await stopWorkflow("nonexistent-run-id-12345");
    assert.equal(result.status, "not_found");
    if (result.status !== "not_found") return;
    assert.ok(result.message.includes("nonexistent-run-id-12345"));
  });

  it("returns already_done for an already completed run", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-2",
      status: "completed",
      steps: [{ stepId: "plan", status: "done" }],
    });

    const result = await stopWorkflow(runId);
    assert.equal(result.status, "already_done");
    if (result.status !== "already_done") return;
    assert.ok(result.message.includes("completed"));
  });

  it("returns already_done for an already cancelled run", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-3",
      status: "cancelled",
      steps: [{ stepId: "plan", status: "failed" }],
    });

    const result = await stopWorkflow(runId);
    assert.equal(result.status, "already_done");
    if (result.status !== "already_done") return;
    assert.ok(result.message.includes("cancelled"));
  });

  it("cleans up active steps in an already cancelled run", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-cancel-cleanup",
      status: "cancelled",
      steps: [
        { stepId: "plan", status: "done", output: "plan output" },
        { stepId: "implement", status: "running" },
      ],
    });

    const result = await stopWorkflow(runId);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.cancelledSteps, 1);

    const step = await pgGet<{ status: string; output: string | null }>(
      "SELECT status, output FROM steps WHERE run_id = $1 AND step_id = 'implement'",
      [runId]
    );
    assert.equal(step?.status, "cancelled");
    assert.equal(step?.output, "Cancelled by user");
  });

  it("supports prefix matching with first 8 chars of UUID", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-4",
      status: "running",
      steps: [{ stepId: "plan", status: "waiting" }],
    });

    const prefix = runId.slice(0, 8);
    const result = await stopWorkflow(prefix);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.runId, runId);
    assert.equal(result.cancelledSteps, 1);
  });

  it("does NOT change done steps to failed", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-5",
      status: "running",
      steps: [
        { stepId: "step-a", status: "done", output: "original output" },
        { stepId: "step-b", status: "done", output: "also done" },
        { stepId: "step-c", status: "running" },
      ],
    });

    const result = await stopWorkflow(runId);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.cancelledSteps, 1); // only the running step

    // Verify done steps are untouched
    const steps = await pgQuery<{ step_id: string; status: string; output: string | null }>(
      "SELECT step_id, status, output FROM steps WHERE run_id = $1 ORDER BY step_index", [runId]
    );
    assert.equal(steps[0].status, "done");
    assert.equal(steps[0].output, "original output");
    assert.equal(steps[1].status, "done");
    assert.equal(steps[1].output, "also done");
    assert.equal(steps[2].status, "cancelled");
    assert.equal(steps[2].output, "Cancelled by user");
  });
});
