import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { publishSingleClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import {
  createPostgresTerminalClaimRuntimeReconciler,
} from "../../src/execution/terminal-claim-runtime-reconciler.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { requestRunTermination } from "../../src/execution/run-termination.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-15T02:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://terminal-claim-runtime-reconciler/test"],
};

function runtimeIntent(sessionId: string) {
  return {
    schema: "setfarm.runtime-claim-intent.v1" as const,
    sessionId,
    runtimeAgentId: "planner-runtime",
    runtimeKind: "openclaw_session" as const,
    ownerInstanceId: "spawner-terminal-runtime-test",
    sessionKey: `test:${sessionId}`,
  };
}

async function seedPendingPlanWithTerminalRuntime(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  suffix: string,
) {
  const runId = `run-terminal-runtime-${suffix}`;
  const stepDbId = `${runId}-step`;
  const sessionId = `RTS_terminal-runtime-${suffix}`;
  await database.insertRun(runId);
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, retry_count)
    VALUES
      (${stepDbId}, ${runId}, 'plan', 'feature-dev_planner', 1, '', '', 'pending', 1)
  `;
  const claim = await publishSingleClaimRuntime(database.sql, {
    runId,
    stepDbId,
    workflowStepId: "plan",
    claimAgentId: "feature-dev_planner",
    runtimeIntent: runtimeIntent(sessionId),
  });
  assert.ok(claim);
  await database.sql.begin(async (transaction) => {
    await transaction.unsafe(
      `UPDATE claim_log
          SET outcome = 'infra_retry', abandoned_at = NOW(),
              diagnostic = 'AGENT_MODEL_TURN_STALLED'
        WHERE id = $1 AND outcome IS NULL`,
      [claim.claimId],
    );
    await transaction.unsafe(
      "UPDATE steps SET status = 'pending', updated_at = NOW() WHERE id = $1 AND status = 'running'",
      [stepDbId],
    );
  });
  return { runId, stepDbId, sessionId, claimId: claim.claimId };
}

function reconciler(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  drainCalls: string[],
) {
  const sessions = createRuntimeSessionRepository(database.sql);
  return createPostgresTerminalClaimRuntimeReconciler(database.sql, {
    async drain(session) {
      drainCalls.push(session.sessionId);
      const current = await sessions.findById(session.sessionId);
      if (!current || ["drained", "released"].includes(current.state)) return;
      assert.equal(current.state, "drain_requested");
      await sessions.markDrained({
        sessionId: current.sessionId,
        ownerInstanceId: current.ownerInstanceId,
        evidence: DRAIN_EVIDENCE,
      });
    },
  });
}

describe("terminal claim runtime reconciler", () => {
  it("releases the exact closed-claim runtime without consuming retry budget", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const seeded = await seedPendingPlanWithTerminalRuntime(database, "exact-01");
      const drainCalls: string[] = [];
      const result = await reconciler(database, drainCalls).reconcile();

      assert.deepEqual(result, { scanned: 1, released: 1, alreadySettled: 0, failed: 0 });
      assert.deepEqual(drainCalls, [seeded.sessionId]);
      const state = await database.sql<Array<{
        runtime_state: string;
        claim_outcome: string;
        step_status: string;
        retry_count: number;
      }>>`
        SELECT runtime.state AS runtime_state,
               claim.outcome AS claim_outcome,
               step.status AS step_status,
               step.retry_count
          FROM runtime_sessions runtime
          JOIN claim_log claim ON claim.id = runtime.claim_id
          JOIN steps step ON step.id = runtime.step_db_id
         WHERE runtime.session_id = ${seeded.sessionId}
      `;
      assert.deepEqual({ ...state[0] }, {
        runtime_state: "released",
        claim_outcome: "infra_retry",
        step_status: "pending",
        retry_count: 1,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("does not steal a terminal runtime from an active run-termination owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const seeded = await seedPendingPlanWithTerminalRuntime(database, "termination-01");
      await requestRunTermination(database.sql, {
        runId: seeded.runId,
        targetStatus: "cancelled",
        requestedBy: "terminal-runtime-test",
        diagnostic: "termination owns runtime drain",
        requestId: "RTR_terminal-runtime-owner-01",
      });
      const drainCalls: string[] = [];
      const result = await reconciler(database, drainCalls).reconcile();

      assert.deepEqual(result, { scanned: 0, released: 0, alreadySettled: 0, failed: 0 });
      assert.deepEqual(drainCalls, []);
      const runtime = await createRuntimeSessionRepository(database.sql).findById(seeded.sessionId);
      assert.equal(runtime?.state, "reserved");
    } finally {
      await database.cleanup();
    }
  });

  it("is idempotent under concurrent reconciliation and permits exactly one next claim", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const seeded = await seedPendingPlanWithTerminalRuntime(database, "race-01");
      const drainCalls: string[] = [];
      const first = reconciler(database, drainCalls);
      const second = reconciler(database, drainCalls);
      const results = await Promise.all([first.reconcile(), second.reconcile()]);
      assert.equal(results.reduce((count, result) => count + result.failed, 0), 0);
      assert.equal(
        (await createRuntimeSessionRepository(database.sql).findById(seeded.sessionId))?.state,
        "released",
      );

      const [claimA, claimB] = await Promise.all([
        publishSingleClaimRuntime(database.sql, {
          runId: seeded.runId,
          stepDbId: seeded.stepDbId,
          workflowStepId: "plan",
          claimAgentId: "feature-dev_planner",
          runtimeIntent: runtimeIntent("RTS_terminal-runtime-race-next-a"),
        }),
        publishSingleClaimRuntime(database.sql, {
          runId: seeded.runId,
          stepDbId: seeded.stepDbId,
          workflowStepId: "plan",
          claimAgentId: "feature-dev_planner",
          runtimeIntent: runtimeIntent("RTS_terminal-runtime-race-next-b"),
        }),
      ]);
      assert.equal([claimA, claimB].filter(Boolean).length, 1);
      const counts = await database.sql<Array<{
        claims: number;
        open_claims: number;
        active_runtimes: number;
        retry_count: number;
      }>>`
        SELECT COUNT(DISTINCT claim.id)::integer AS claims,
               COUNT(DISTINCT claim.id) FILTER (WHERE claim.outcome IS NULL)::integer AS open_claims,
               COUNT(DISTINCT runtime.session_id) FILTER (
                 WHERE runtime.state IN ('reserved', 'starting', 'running', 'drain_requested')
               )::integer AS active_runtimes,
               MAX(step.retry_count)::integer AS retry_count
          FROM steps step
          LEFT JOIN claim_log claim ON claim.run_id = step.run_id AND claim.step_id = step.step_id
          LEFT JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
         WHERE step.id = ${seeded.stepDbId}
      `;
      assert.deepEqual({ ...counts[0] }, {
        claims: 2,
        open_claims: 1,
        active_runtimes: 1,
        retry_count: 1,
      });
    } finally {
      await database.cleanup();
    }
  });
});
