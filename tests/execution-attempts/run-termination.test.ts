import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  createRuntimeSessionRepository,
} from "../../src/execution/runtime-session-repository.js";
import {
  createRunTerminationRepository,
  requestRunTermination,
} from "../../src/execution/run-termination.js";
import { transitionRunToTerminal } from "../../src/execution/run-terminal-transition.js";
import { exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T12:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/drain-proof"],
};

async function seedOwnedRuntime(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  runtimeState: "starting" | "running" = "running",
) {
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
  await database.insertRun(runId);
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, current_story_id)
    VALUES
      (${stepDbId}, ${runId}, 'implement', 'feature-dev_developer', 1, '', '', 'running', ${storyDbId})
  `;
  await database.sql`
    INSERT INTO stories
      (id, run_id, story_index, story_id, title, status, claimed_by, claim_generation)
    VALUES
      (${storyDbId}, ${runId}, 1, 'US-001', 'Story', 'running', 'feature-dev_developer', 1)
  `;
  const claims = await database.sql<Array<{ id: number }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
    VALUES (${runId}, 'implement', 'US-001', 'feature-dev_developer')
    RETURNING id::integer AS id
  `;
  const claimId = claims[0]!.id;
  const attempts = createAttemptRepository(database.sql, {
    attemptId: () => `ATT_${runId}-attempt`,
    fenceToken: () => "f".repeat(64),
  });
  const attempt = await attempts.reserve(exactProductReservation({
    claimId,
    runId,
    storyId: "US-001",
    agentId: "feature-dev_developer",
    evidenceRefs: [`setfarm://claim-log/${claimId}`],
  }));
  const sessions = createRuntimeSessionRepository(database.sql);
  const session = await sessions.reserve({
    sessionId: `RTS_${runId}-session`,
    runId,
    stepDbId,
    workflowStepId: "implement",
    storyDbId,
    storyId: "US-001",
    claimId,
    attemptId: attempt.attempt.attemptId,
    claimAgentId: "feature-dev_developer",
    runtimeAgentId: "prism",
    runtimeKind: "openclaw_session",
    ownerInstanceId: "spawner-a",
  });
  await sessions.markStarting({ sessionId: session.sessionId, ownerInstanceId: "spawner-a" });
  if (runtimeState === "running") {
    await sessions.markRunning({
      sessionId: session.sessionId,
      ownerInstanceId: "spawner-a",
      sessionKey: `key-${runId}`,
    });
  }
  return { stepDbId, storyDbId, claimId, attempt, sessions, sessionId: session.sessionId };
}

describe("durable two-phase run termination", () => {
  it("keeps ownership active until runtime drain proof then terminalizes atomically", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-two-phase-cancel";
      const seeded = await seedOwnedRuntime(database, runId);
      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "Workflow cancelled by user",
        requestId: "RTR_two-phase-cancel01",
      });
      assert.equal(requested.status, "requested");
      if (requested.status !== "requested") throw new Error("test request missing");
      const beforeDrain = await database.sql<Array<{
        run_status: string;
        story_status: string;
        step_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        session_state: string;
      }>>`
        SELECT r.status AS run_status, st.status AS story_status, s.status AS step_status,
               cl.outcome AS claim_outcome, ea.disposition AS attempt_disposition,
               rs.state AS session_state
          FROM runs r
          JOIN steps s ON s.run_id = r.id
          JOIN stories st ON st.run_id = r.id
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
          JOIN runtime_sessions rs ON rs.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...beforeDrain[0] }, {
        run_status: "cancelling",
        story_status: "running",
        step_status: "running",
        claim_outcome: null,
        attempt_disposition: "running",
        session_state: "running",
      });
      const duplicate = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "duplicate click",
      });
      assert.equal(duplicate.status, "existing");
      if (duplicate.status === "existing") assert.equal(duplicate.request.requestId, requested.request.requestId);

      const terminations = createRunTerminationRepository(database.sql);
      const claimed = await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      assert.equal(claimed?.state, "draining");
      assert.equal((await seeded.sessions.findById(seeded.sessionId))?.state, "drain_requested");
      await assert.rejects(
        terminations.markDrained({
          requestId: requested.request.requestId,
          ownerInstanceId: "spawner-a",
        }),
        /RUN_TERMINATION_RUNTIME_NOT_DRAINED/,
      );
      await seeded.sessions.markDrained({ sessionId: seeded.sessionId, evidence: DRAIN_EVIDENCE });
      assert.equal((await terminations.markDrained({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        evidence: { proofRef: "setfarm://test/drain-proof" },
      })).state, "drained");
      const terminal = await terminations.terminalize({ requestId: requested.request.requestId });
      assert.equal(terminal.status, "cancelled");
      const after = await database.sql<Array<{
        run_status: string;
        claim_outcome: string;
        attempt_disposition: string;
        session_state: string;
        request_state: string;
        outbox_termination_request_id: string;
      }>>`
        SELECT r.status AS run_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, rs.state AS session_state,
               rr.state AS request_state,
               ob.payload->>'terminationRequestId' AS outbox_termination_request_id
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
          JOIN runtime_sessions rs ON rs.run_id = r.id
          JOIN run_termination_requests rr ON rr.run_id = r.id
          JOIN operational_outbox ob ON ob.aggregate_id = r.id AND ob.event_type = 'run.terminal'
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...after[0] }, {
        run_status: "cancelled",
        claim_outcome: "cancelled",
        attempt_disposition: "inconclusive",
        session_state: "released",
        request_state: "terminalized",
        outbox_termination_request_id: requested.request.requestId,
      });
      assert.equal((await terminations.terminalize({ requestId: requested.request.requestId })).previousStatus, "cancelled");
    } finally {
      await database.cleanup();
    }
  });

  it("forbids direct active cancellation and refuses to infer drain from missing runtime evidence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-cancel-proof-required";
      await database.insertRun(runId);
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "cancelled",
          diagnostic: "unsafe direct cancel",
        }),
        /RUN_TERMINAL_CANCEL_DRAIN_PROOF_REQUIRED/,
      );
      const claims = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
        VALUES (${runId}, 'plan', NULL, 'feature-dev_planner')
        RETURNING id::integer AS id
      `;
      const request = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancel with untracked claim",
        requestId: "RTR_untracked-claim-0001",
      });
      if (request.status !== "requested") throw new Error("test request missing");
      const terminations = createRunTerminationRepository(database.sql);
      await terminations.claim({ requestId: request.request.requestId, ownerInstanceId: "spawner-a" });
      await assert.rejects(
        terminations.markDrained({
          requestId: request.request.requestId,
          ownerInstanceId: "spawner-a",
        }),
        /RUN_TERMINATION_OPEN_CLAIM_SESSION_MISSING/,
      );
      const claim = await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${claims[0]!.id}
      `;
      assert.equal(claim[0]?.outcome, null);
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "cancelling");
    } finally {
      await database.cleanup();
    }
  });

  it("quarantines an uncertain drain without exposing retryable or terminal state", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-cancel-quarantine";
      const seeded = await seedOwnedRuntime(database, runId);
      const request = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancel",
        requestId: "RTR_cancel-quarantine01",
      });
      if (request.status !== "requested") throw new Error("test request missing");
      const terminations = createRunTerminationRepository(database.sql);
      await terminations.claim({ requestId: request.request.requestId, ownerInstanceId: "spawner-a" });
      const observedRuntime = await seeded.sessions.findById(seeded.sessionId);
      assert.ok(observedRuntime);
      await seeded.sessions.quarantine({
        sessionId: seeded.sessionId,
        expectedOwnerInstanceId: observedRuntime.ownerInstanceId,
        expectedStateVersion: observedRuntime.stateVersion,
        diagnostic: "runtime absence could not be proven",
      });
      const quarantined = await terminations.quarantine({
        requestId: request.request.requestId,
        ownerInstanceId: "spawner-a",
        diagnostic: "runtime absence could not be proven",
      });
      assert.equal(quarantined.state, "quarantined");
      await assert.rejects(
        terminations.terminalize({ requestId: request.request.requestId }),
        /RUN_TERMINATION_REQUEST_NOT_DRAINED/,
      );
      const state = await database.sql<Array<{
        run_status: string;
        story_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
      }>>`
        SELECT r.status AS run_status, st.status AS story_status,
               cl.outcome AS claim_outcome, ea.disposition AS attempt_disposition
          FROM runs r
          JOIN stories st ON st.run_id = r.id
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...state[0] }, {
        run_status: "cancelling",
        story_status: "running",
        claim_outcome: null,
        attempt_disposition: "running",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("uses the same drain proof owner for failed runs and preserves a starting runtime until proof", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-two-phase-failed";
      const seeded = await seedOwnedRuntime(database, runId, "starting");
      await assert.rejects(
        transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "unsafe direct failure",
        }),
        /RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED/,
      );
      const stillOwned = await database.sql<Array<{
        run_status: string;
        claim_outcome: string | null;
        attempt_disposition: string;
        session_state: string;
      }>>`
        SELECT r.status AS run_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, rs.state AS session_state
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
          JOIN runtime_sessions rs ON rs.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...stillOwned[0] }, {
        run_status: "running",
        claim_outcome: null,
        attempt_disposition: "claimed",
        session_state: "starting",
      });

      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "failure-policy",
        diagnostic: "terminal quality failure",
        requestId: "RTR_two-phase-failed01",
      });
      if (requested.status !== "requested") throw new Error("test request missing");
      const terminations = createRunTerminationRepository(database.sql);
      const claimed = await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      assert.equal(claimed?.targetStatus, "failed");
      assert.equal((await seeded.sessions.findById(seeded.sessionId))?.state, "drain_requested");
      await assert.rejects(
        terminations.markDrained({
          requestId: requested.request.requestId,
          ownerInstanceId: "spawner-a",
        }),
        /RUN_TERMINATION_RUNTIME_NOT_DRAINED/,
      );
      await seeded.sessions.markDrained({ sessionId: seeded.sessionId, evidence: DRAIN_EVIDENCE });
      await terminations.markDrained({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        evidence: { proofRef: "setfarm://test/failed-drain-proof" },
      });
      const terminal = await terminations.terminalize({ requestId: requested.request.requestId });
      assert.equal(terminal.status, "failed");

      const settled = await database.sql<Array<{
        run_status: string;
        claim_outcome: string;
        attempt_disposition: string;
        session_state: string;
        request_state: string;
      }>>`
        SELECT r.status AS run_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, rs.state AS session_state,
               rr.state AS request_state
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.run_id = r.id
          JOIN runtime_sessions rs ON rs.run_id = r.id
          JOIN run_termination_requests rr ON rr.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...settled[0] }, {
        run_status: "failed",
        claim_outcome: "failed",
        attempt_disposition: "failed",
        session_state: "released",
        request_state: "terminalized",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("does not let fifty quarantined rows starve a healthy pending request", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const terminations = createRunTerminationRepository(database.sql);
      for (let index = 0; index < 50; index += 1) {
        const runId = `run-queue-quarantine-${String(index).padStart(3, "0")}`;
        await database.insertRun(runId);
        const request = await requestRunTermination(database.sql, {
          runId,
          targetStatus: "cancelled",
          requestedBy: "queue-test",
          diagnostic: "old poison request",
          requestId: `RTR_queue-quarantine-${String(index).padStart(3, "0")}`,
          now: new Date(1_700_000_000_000 + index),
        });
        if (request.status !== "requested") throw new Error("test request missing");
        await terminations.quarantine({
          requestId: request.request.requestId,
          diagnostic: "bounded poison quarantine",
          now: new Date(1_700_000_100_000 + index),
        });
      }
      const leasedRunId = "run-queue-leased";
      await database.insertRun(leasedRunId);
      const leased = await requestRunTermination(database.sql, {
        runId: leasedRunId,
        targetStatus: "failed",
        requestedBy: "queue-test",
        diagnostic: "healthy owner still holds lease",
        requestId: "RTR_queue-leased-00001",
      });
      if (leased.status !== "requested") throw new Error("test request missing");
      await terminations.claim({
        requestId: leased.request.requestId,
        ownerInstanceId: "live-termination-owner",
        leaseMs: 300_000,
      });
      const orphanedRunId = "run-queue-orphaned-lease";
      await database.insertRun(orphanedRunId);
      const orphaned = await requestRunTermination(database.sql, {
        runId: orphanedRunId,
        targetStatus: "failed",
        requestedBy: "queue-test",
        diagnostic: "owner crashed before lease publication",
        requestId: "RTR_queue-orphaned-0001",
        now: new Date(1_750_000_000_000),
      });
      if (orphaned.status !== "requested") throw new Error("test request missing");
      await database.sql`
        UPDATE run_termination_requests
           SET state = 'draining', owner_instance_id = 'crashed-owner', lease_expires_at = NULL
         WHERE request_id = ${orphaned.request.requestId}
      `;
      const healthyRunId = "run-queue-healthy";
      await database.insertRun(healthyRunId);
      const healthy = await requestRunTermination(database.sql, {
        runId: healthyRunId,
        targetStatus: "failed",
        requestedBy: "queue-test",
        diagnostic: "healthy request",
        requestId: "RTR_queue-healthy-0001",
        now: new Date(1_800_000_000_000),
      });
      if (healthy.status !== "requested") throw new Error("test request missing");

      const pending = await terminations.listPending(50);
      assert.deepEqual(pending.map((request) => request.requestId), [
        orphaned.request.requestId,
        healthy.request.requestId,
      ]);
    } finally {
      await database.cleanup();
    }
  });
});
