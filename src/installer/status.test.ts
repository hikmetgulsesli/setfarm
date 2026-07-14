import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getSql, pgQuery, pgGet, pgRun, now } from "../db-pg.js";
import { stopWorkflow as stopWorkflowWithCas } from "./status.js";
import type { StopWorkflowResult } from "./status.js";
import { createAttemptRepository } from "../execution/attempt-repository.js";
import { resolveRunOperationalActionTarget } from "../execution/run-operational-action.js";
import { buildRunOperationalSnapshot } from "../server/run-operational-snapshot.js";

let nextTestRunNumber = 8_000_000 + Math.floor(Math.random() * 100_000);

async function stopWorkflow(query: string): Promise<StopWorkflowResult> {
  const runId = await resolveRunOperationalActionTarget(getSql(), query);
  const snapshot = await buildRunOperationalSnapshot(getSql(), runId);
  assert.ok(snapshot);
  return stopWorkflowWithCas(query, snapshot.snapshotHash);
}

// Helper to create a test run with steps
async function createTestRun(opts: {
  runId: string;
  runNumber?: number | null;
  workflowId: string;
  status?: string;
  protocol?: "legacy" | "shadow";
  steps?: Array<{ stepId: string; status: string; output?: string | null }>;
}) {
  const ts = now();
  await pgRun(
    `INSERT INTO runs (
       id, run_number, workflow_id, task, status, context,
       protocol, compiler_release_sha, activation_preflight_hash,
       created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, '{}', $6, $7, $8, $9, $10)`,
    [
      opts.runId,
      opts.runNumber ?? nextTestRunNumber++,
      opts.workflowId,
      "test task",
      opts.status ?? "running",
      opts.protocol ?? "legacy",
      opts.protocol === "shadow" ? "d".repeat(40) : null,
      opts.protocol === "shadow" ? "e".repeat(64) : null,
      ts,
      ts,
    ]
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
  await pgRun("DELETE FROM runtime_sessions WHERE run_id = $1", [runId]);
  await pgRun("DELETE FROM run_termination_requests WHERE run_id = $1", [runId]);
  await pgRun("DELETE FROM execution_attempts WHERE run_id = $1", [runId]);
  await pgRun("DELETE FROM claim_log WHERE run_id = $1", [runId]);
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

  it("requests cancellation without closing steps before runtime drain proof", async () => {
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
    assert.equal(result.cancelledSteps, 0);
    assert.equal(result.requestState, "requested");
    assert.match(result.terminationRequestId, /^RTR_/);

    // Verify DB state
    const run = await pgGet<{ status: string }>("SELECT status FROM runs WHERE id = $1", [runId]);
    assert.equal(run?.status, "cancelling");

    const steps = await pgQuery<{ step_id: string; status: string; output: string | null }>(
      "SELECT step_id, status, output FROM steps WHERE run_id = $1 ORDER BY step_index", [runId]
    );
    assert.equal(steps[0].status, "done"); // done step unchanged
    assert.equal(steps[0].output, "plan output"); // done step output unchanged
    assert.equal(steps[1].status, "running");
    assert.equal(steps[2].status, "waiting");
    assert.equal(steps[3].status, "pending");
    const request = await pgGet<{ state: string; target_status: string }>(
      "SELECT state, target_status FROM run_termination_requests WHERE request_id = $1",
      [result.terminationRequestId],
    );
    assert.deepEqual(request, { state: "requested", target_status: "cancelled" });
  });

  it("returns not_found for a non-existent run", async () => {
    await assert.rejects(
      () => stopWorkflow("nonexistent-run-id-12345"),
      /RUN_OPERATIONAL_ACTION_RUN_NOT_FOUND/,
    );
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

    await assert.rejects(() => stopWorkflow(runId), /RUN_OPERATIONAL_ACTION_DENIED:RUN_ALREADY_TERMINAL/);
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

    await assert.rejects(() => stopWorkflow(runId), /RUN_OPERATIONAL_ACTION_DENIED:RUN_ALREADY_TERMINAL/);
  });

  it("does not repair inconsistent ownership from the CLI after a run is already cancelled", async () => {
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

    await assert.rejects(() => stopWorkflow(runId), /RUN_OPERATIONAL_ACTION_DENIED:RUN_ALREADY_TERMINAL/);

    const step = await pgGet<{ status: string; output: string | null }>(
      "SELECT status, output FROM steps WHERE run_id = $1 AND step_id = 'implement'",
      [runId]
    );
    assert.equal(step?.status, "running");
    assert.equal(step?.output, null);
  });

  it("keeps claim ownership active until the drainer terminalizes the request", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-claim-cleanup",
      status: "running",
      steps: [{ stepId: "verify", status: "running" }],
    });
    await pgRun(
      "INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES ($1, 'verify', NULL, 'feature-dev_reviewer', $2)",
      [runId, now()]
    );

    const result = await stopWorkflow(runId);
    assert.equal(result.status, "ok");

    const claim = await pgGet<{ outcome: string | null; diagnostic: string | null; duration_ms: number | null }>(
      "SELECT outcome, diagnostic, duration_ms FROM claim_log WHERE run_id = $1 AND step_id = 'verify'",
      [runId]
    );
    assert.equal(claim?.outcome, null);
    assert.equal(claim?.diagnostic, null);
    assert.equal(claim?.duration_ms, null);
  });

  it("keeps the bound shadow attempt active until proven drain", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-shadow-cancel",
      status: "running",
      protocol: "shadow",
      steps: [{ stepId: "implement", status: "running" }],
    });
    const claims = await pgQuery<{ id: number }>(
      "INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES ($1, 'implement', 'US-CANCEL', 'feature-dev_developer', $2) RETURNING id::integer AS id",
      [runId, now()],
    );
    const claimId = claims[0]!.id;
    const attempts = createAttemptRepository(getSql());
    const reserved = await attempts.reserve({
      claimId,
      runId,
      stepId: "implement",
      storyId: "US-CANCEL",
      attemptClass: "product_implementation",
      packetHash: "a".repeat(64),
      compilationReportHash: "b".repeat(64),
      sliceHash: "c".repeat(64),
      sourceBefore: { sha: "1".repeat(40), treeHash: "2".repeat(40) },
      findingSetHash: "d".repeat(64),
      role: "developer",
      agentId: "feature-dev_developer",
      evidenceRefs: [`setfarm://claim-log/${claimId}`],
    });
    assert.equal(reserved.status, "reserved");

    const result = await stopWorkflow(runId);
    assert.equal(result.status, "ok");
    const active = await pgGet<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM execution_attempts WHERE run_id = $1 AND disposition IN ('claimed', 'running')",
      [runId],
    );
    assert.equal(active?.count, "1");
    assert.equal((await attempts.findById(reserved.attempt.attemptId))?.disposition, "claimed");
  });

  it("leaves already-cancelled claim drift for the bounded recovery owner", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-cancelled-claim-cleanup",
      status: "cancelled",
      steps: [{ stepId: "verify", status: "cancelled" }],
    });
    await pgRun(
      "INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES ($1, 'verify', NULL, 'feature-dev_reviewer', $2)",
      [runId, now()]
    );

    await assert.rejects(() => stopWorkflow(runId), /RUN_OPERATIONAL_ACTION_INVARIANT_BLOCKED/);

    const openClaims = await pgGet<{ cnt: string }>(
      "SELECT COUNT(*) AS cnt FROM claim_log WHERE run_id = $1 AND outcome IS NULL",
      [runId]
    );
    assert.equal(openClaims?.cnt, "1");
  });

  it("does not rewrite old claim durations outside terminalization", async () => {
    const runId = crypto.randomUUID();
    testRunIds.push(runId);
    await createTestRun({
      runId,
      workflowId: "test-wf-old-claim-cleanup",
      status: "cancelled",
      steps: [{ stepId: "verify", status: "cancelled" }],
    });
    await pgRun(
      "INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at) VALUES ($1, 'verify', NULL, 'feature-dev_reviewer', NOW() - INTERVAL '90 days')",
      [runId]
    );

    await assert.rejects(() => stopWorkflow(runId), /RUN_OPERATIONAL_ACTION_INVARIANT_BLOCKED/);

    const claim = await pgGet<{ outcome: string | null; duration_ms: number | null }>(
      "SELECT outcome, duration_ms FROM claim_log WHERE run_id = $1 AND step_id = 'verify'",
      [runId]
    );
    assert.equal(claim?.outcome, null);
    assert.equal(claim?.duration_ms, null);
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
    assert.equal(result.cancelledSteps, 0);
  });

  it("prefers numeric run_number over UUID prefix", async () => {
    const runNumber = 990000 + Math.floor(Math.random() * 10000);
    const query = String(runNumber);
    const prefixRunId = `${query}-prefix-shadow-run`;
    const numberedRunId = crypto.randomUUID();
    testRunIds.push(prefixRunId, numberedRunId);

    await createTestRun({
      runId: prefixRunId,
      workflowId: "test-wf-prefix-shadow",
      status: "running",
      steps: [{ stepId: "shadow", status: "pending" }],
    });
    await createTestRun({
      runId: numberedRunId,
      runNumber,
      workflowId: "test-wf-numbered",
      status: "running",
      steps: [{ stepId: "target", status: "pending" }],
    });

    const result = await stopWorkflow(query);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.runId, numberedRunId);

    const shadow = await pgGet<{ status: string }>("SELECT status FROM runs WHERE id = $1", [prefixRunId]);
    const target = await pgGet<{ status: string }>("SELECT status FROM runs WHERE id = $1", [numberedRunId]);
    assert.equal(shadow?.status, "running");
    assert.equal(target?.status, "cancelling");
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
    assert.equal(result.cancelledSteps, 0);

    // Verify done steps are untouched
    const steps = await pgQuery<{ step_id: string; status: string; output: string | null }>(
      "SELECT step_id, status, output FROM steps WHERE run_id = $1 ORDER BY step_index", [runId]
    );
    assert.equal(steps[0].status, "done");
    assert.equal(steps[0].output, "original output");
    assert.equal(steps[1].status, "done");
    assert.equal(steps[1].output, "also done");
    assert.equal(steps[2].status, "running");
    assert.equal(steps[2].output, null);
  });
});
