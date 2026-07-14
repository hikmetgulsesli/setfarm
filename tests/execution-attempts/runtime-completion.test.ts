import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  closeExactSingleStepClaimInTransaction,
  completeSingleStepClaimAndState,
  completeStoryClaimAndBoundAttempt,
} from "../../src/execution/claim-attempt-transition.js";
import {
  createRuntimeCompletionRepository,
  markRuntimeCompletionOwnerCommittedInTransaction,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import {
  createRuntimeSessionRepository,
} from "../../src/execution/runtime-session-repository.js";
import {
  createRunTerminationRepository,
  requestRunTermination,
  requestRunTerminationInTransaction,
} from "../../src/execution/run-termination.js";
import { transitionRunToTerminal } from "../../src/execution/run-terminal-transition.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T12:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/completion-drain-proof"],
};

async function seedManagedClaim(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
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
  await sessions.markRunning({
    sessionId: session.sessionId,
    ownerInstanceId: "spawner-a",
    sessionKey: `key-${runId}`,
  });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    protocol: "shadow",
    issuedAt: "2026-07-13T12:00:00.000Z",
    stepId: stepDbId,
    workflowStepId: "implement",
    runId,
    storyId: "US-001",
    storyDbId,
    claimId,
    claimAgentId: "feature-dev_developer",
    runtimeAgentId: "prism",
    claimGeneration: 1,
    attempt: {
      attemptId: attempt.attempt.attemptId,
      generation: attempt.attempt.generation,
      fenceToken: attempt.attempt.fenceToken,
    },
  };
  return { stepDbId, storyDbId, claimId, attempts, attempt, sessions, session, envelope };
}

async function seedManagedSingleStepClaim(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
) {
  const stepDbId = `${runId}-step`;
  await database.insertRun(runId);
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
    VALUES
      (${stepDbId}, ${runId}, 'verify', 'feature-dev_reviewer', 1, '', '', 'running')
  `;
  const claims = await database.sql<Array<{ id: number }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
    VALUES (${runId}, 'verify', NULL, 'feature-dev_reviewer')
    RETURNING id::integer AS id
  `;
  const claimId = claims[0]!.id;
  const sessions = createRuntimeSessionRepository(database.sql);
  const session = await sessions.reserve({
    sessionId: `RTS_${runId}-session`,
    runId,
    stepDbId,
    workflowStepId: "verify",
    claimId,
    claimAgentId: "feature-dev_reviewer",
    runtimeAgentId: "flux",
    runtimeKind: "openclaw_session",
    ownerInstanceId: "spawner-a",
  });
  await sessions.markStarting({ sessionId: session.sessionId, ownerInstanceId: "spawner-a" });
  await sessions.markRunning({
    sessionId: session.sessionId,
    ownerInstanceId: "spawner-a",
    sessionKey: `key-${runId}`,
  });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    protocol: "shadow",
    issuedAt: "2026-07-13T12:00:00.000Z",
    stepId: stepDbId,
    workflowStepId: "verify",
    runId,
    claimId,
    claimAgentId: "feature-dev_reviewer",
    runtimeAgentId: "flux",
  };
  return { stepDbId, claimId, sessions, session, envelope };
}

async function waitForBlockedClaimTransition(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await database.sql<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%FOR UPDATE OF cl, s%'
      ) AS blocked
    `;
    if (rows[0]?.blocked) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("TEST_BARRIER_SINGLE_STEP_COMPLETION_DID_NOT_BLOCK");
}

async function waitForBlockedTerminationPublication(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await database.sql<Array<{ blocked: boolean }>>`
      SELECT EXISTS (
        SELECT 1
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%SELECT status FROM runs WHERE id = $1 FOR UPDATE%'
      ) AS blocked
    `;
    if (rows[0]?.blocked) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("TEST_BARRIER_TERMINATION_PUBLICATION_DID_NOT_BLOCK");
}

async function settleCompletionEffects(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  requestId: string,
  ownerInstanceId: string,
  result: Record<string, unknown>,
): Promise<void> {
  const effects = createRuntimeCompletionEffectRepository(database.sql);
  for (;;) {
    const effect = await effects.claimNext({ requestId, ownerInstanceId });
    if (!effect) return;
    if (!effect.leaseToken) throw new Error("test effect lease token missing");
    await effects.settle({
      requestId,
      effectKey: effect.effectKey,
      ownerInstanceId,
      leaseToken: effect.leaseToken,
      resolution: "applied",
      result,
      evidence: { source: "runtime-completion-test" },
    });
  }
}

describe("manager-owned runtime completion", () => {
  it("keeps claim and product state active until exact runtime drain is accepted", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-managed-completion";
      const seeded = await seedManagedClaim(database, runId);
      const output = "STATUS: done\nCHANGES: exact scoped delta";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_managed-completion01",
      });
      assert.equal(requested.status, "requested");
      if (requested.status !== "requested") throw new Error("completion request missing");
      const beforeDrain = await database.sql<Array<{
        claim_outcome: string | null;
        story_status: string;
        step_status: string;
        attempt_disposition: string;
        runtime_state: string;
        request_state: string;
      }>>`
        SELECT cl.outcome AS claim_outcome, st.status AS story_status,
               s.status AS step_status, ea.disposition AS attempt_disposition,
               rs.state AS runtime_state, rcr.state AS request_state
          FROM claim_log cl
          JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
          JOIN steps s ON s.id = ${seeded.stepDbId}
          JOIN execution_attempts ea ON ea.claim_id = cl.id
          JOIN runtime_sessions rs ON rs.claim_id = cl.id
          JOIN runtime_completion_requests rcr ON rcr.claim_id = cl.id
         WHERE cl.id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...beforeDrain[0] }, {
        claim_outcome: null,
        story_status: "running",
        step_status: "running",
        attempt_disposition: "running",
        runtime_state: "drain_requested",
        request_state: "requested",
      });

      const duplicate = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
      });
      assert.equal(duplicate.status, "existing");
      await assert.rejects(
        requestRuntimeCompletion(database.sql, {
          envelope: seeded.envelope,
          output: `${output}\nDIFFERENT: true`,
        }),
        /RUNTIME_COMPLETION_REQUEST_CONFLICT/,
      );

      const completions = createRuntimeCompletionRepository(database.sql);
      const owned = await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      assert.equal(owned?.state, "draining");
      await assert.rejects(
        completions.markProcessing({
          requestId: requested.request.requestId,
          ownerInstanceId: "spawner-a",
        }),
        /RUNTIME_COMPLETION_RUNTIME_NOT_DRAINED/,
      );
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      assert.equal((await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      })).state, "processing");

      await completeStoryClaimAndBoundAttempt(database.sql, {
        envelope: seeded.envelope,
        sourceAfter: { sha: "2".repeat(40), treeHash: "3".repeat(64) },
        outputHash: createHash("sha256").update(output, "utf8").digest("hex"),
        storyStatus: "done",
        storyOutput: output,
        stepStatus: "running",
        stepOutput: output,
      });
      const completionResult = { advanced: false, runCompleted: false };
      await settleCompletionEffects(
        database,
        requested.request.requestId,
        "spawner-a",
        completionResult,
      );
      await completions.markEffectsCommitted({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        result: completionResult,
      });
      const accepted = await completions.acceptAndRelease({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        result: completionResult,
      });
      assert.equal(accepted.state, "accepted");
      assert.equal((await seeded.sessions.findById(seeded.session.sessionId))?.state, "released");
      const finalOwner = await database.sql<Array<{
        claim_outcome: string;
        attempt_disposition: string;
        story_status: string;
      }>>`
        SELECT cl.outcome AS claim_outcome, ea.disposition AS attempt_disposition,
               st.status AS story_status
          FROM claim_log cl
          JOIN execution_attempts ea ON ea.claim_id = cl.id
          JOIN stories st ON st.run_id = cl.run_id AND st.story_id = cl.story_id
         WHERE cl.id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...finalOwner[0] }, {
        claim_outcome: "completed",
        attempt_disposition: "produced_delta",
        story_status: "done",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("lets canonical cancellation preempt a requested completion without mixed ownership", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-complete-cancel-race";
      const seeded = await seedManagedClaim(database, runId);
      const completion = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: pending acceptance",
        requestId: "RCR_complete-cancel-race1",
      });
      if (completion.status !== "requested") throw new Error("completion request missing");
      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "operator cancellation won before completion acceptance",
        requestId: "RTR_complete-cancel-race1",
      });
      if (cancellation.status !== "requested") throw new Error("termination request missing");
      const terminations = createRunTerminationRepository(database.sql);
      await terminations.claim({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await terminations.markDrained({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await terminations.terminalize({ requestId: cancellation.request.requestId });

      const rows = await database.sql<Array<{
        run_status: string;
        claim_outcome: string;
        attempt_disposition: string;
        runtime_state: string;
        completion_state: string;
        termination_state: string;
      }>>`
        SELECT r.status AS run_status, cl.outcome AS claim_outcome,
               ea.disposition AS attempt_disposition, rs.state AS runtime_state,
               rcr.state AS completion_state, rtr.state AS termination_state
          FROM runs r
          JOIN claim_log cl ON cl.run_id = r.id
          JOIN execution_attempts ea ON ea.claim_id = cl.id
          JOIN runtime_sessions rs ON rs.claim_id = cl.id
          JOIN runtime_completion_requests rcr ON rcr.claim_id = cl.id
          JOIN run_termination_requests rtr ON rtr.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        run_status: "cancelled",
        claim_outcome: "cancelled",
        attempt_disposition: "inconclusive",
        runtime_state: "released",
        completion_state: "rejected",
        termination_state: "terminalized",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("elects only one run-scoped drain owner when cancellation races a claimed completion", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-completion-drain-cancel-race";
      const seeded = await seedManagedClaim(database, runId);
      const completion = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: drain ownership race",
        requestId: "RCR_completion-drain-race1",
      });
      if (completion.status !== "requested") throw new Error("completion request missing");
      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "operator cancellation raced completion drain ownership",
        requestId: "RTR_completion-drain-race1",
      });
      if (cancellation.status !== "requested") throw new Error("termination request missing");

      const completions = createRuntimeCompletionRepository(database.sql);
      const terminations = createRunTerminationRepository(database.sql);
      const [completionOwner, terminationOwner] = await Promise.all([
        completions.claim({
          requestId: completion.request.requestId,
          ownerInstanceId: "completion-manager",
        }),
        terminations.claim({
          requestId: cancellation.request.requestId,
          ownerInstanceId: "termination-manager",
        }),
      ]);

      assert.equal(
        Number(completionOwner !== undefined) + Number(terminationOwner !== undefined),
        1,
        "completion and cancellation must never both acquire run-scoped drain ownership",
      );
      const owners = await database.sql<Array<{
        completion_state: string;
        termination_state: string;
      }>>`
        SELECT rcr.state AS completion_state, rtr.state AS termination_state
          FROM runtime_completion_requests rcr
          JOIN run_termination_requests rtr ON rtr.run_id = rcr.run_id
         WHERE rcr.request_id = ${completion.request.requestId}
           AND rtr.request_id = ${cancellation.request.requestId}
      `;
      const states = [owners[0]?.completion_state, owners[0]?.termination_state];
      assert.equal(
        states.filter((state) => state === "draining" || state === "processing").length,
        1,
        "the durable request rows must name exactly one active drain owner",
      );
      assert.equal(states.includes("quarantined"), false);
    } finally {
      await database.cleanup();
    }
  });

  it("durably defers cancellation during completion processing and then lets cancellation win", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-processing-cancel";
      const seeded = await seedManagedClaim(database, runId);
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: processing race",
        requestId: "RCR_processing-cancel01",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });

      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancel while completion coordinator is processing",
        requestId: "RTR_processing-cancel01",
      });
      if (cancellation.status !== "requested") throw new Error("termination request missing");
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "running");
      const terminations = createRunTerminationRepository(database.sql);
      assert.equal(await terminations.claim({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      }), undefined);
      await assert.rejects(
        completeStoryClaimAndBoundAttempt(database.sql, {
          envelope: seeded.envelope,
          sourceAfter: { sha: "2".repeat(40), treeHash: "3".repeat(64) },
          storyStatus: "done",
          storyOutput: "STATUS: done",
          stepStatus: "running",
          stepOutput: "STATUS: done",
        }),
        /STORY_COMPLETION_TERMINATION_PENDING/,
      );
      await completions.reject({
        requestId: requested.request.requestId,
        diagnostic: "Completion preempted by canonical cancellation",
      });
      assert.equal((await terminations.claim({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      }))?.state, "draining");
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "cancelling");
      await terminations.markDrained({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await terminations.terminalize({ requestId: cancellation.request.requestId });
      const final = await database.sql<Array<{
        run_status: string;
        completion_state: string;
        termination_state: string;
      }>>`
        SELECT r.status AS run_status, rcr.state AS completion_state,
               rtr.state AS termination_state
          FROM runs r
          JOIN runtime_completion_requests rcr ON rcr.run_id = r.id
          JOIN run_termination_requests rtr ON rtr.run_id = r.id
         WHERE r.id = ${runId}
      `;
      assert.deepEqual({ ...final[0] }, {
        run_status: "cancelled",
        completion_state: "rejected",
        termination_state: "terminalized",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("fences single-step completion after canonical cancellation is requested", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-step-cancel-fence";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancel before the single-step worker publishes completion",
        requestId: "RTR_single-step-cancel01",
      });
      assert.equal(cancellation.status, "requested");

      await assert.rejects(
        completeSingleStepClaimAndState(database.sql, {
          envelope: seeded.envelope,
          stepStatus: "done",
          stepOutput: "STATUS: done\nSUMMARY: stale worker output",
        }),
        /SINGLE_STEP_COMPLETION_TERMINATION_PENDING|SINGLE_STEP_CLAIM_RUN_NOT_ACTIVE/,
      );
      const state = await database.sql<Array<{
        claim_outcome: string | null;
        step_status: string;
        run_status: string;
      }>>`
        SELECT cl.outcome AS claim_outcome, s.status AS step_status,
               r.status AS run_status
          FROM claim_log cl
          JOIN steps s ON s.id = ${seeded.stepDbId}
          JOIN runs r ON r.id = cl.run_id
         WHERE cl.id = ${seeded.claimId}
      `;
      assert.deepEqual({ ...state[0] }, {
        claim_outcome: null,
        step_status: "running",
        run_status: "cancelling",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("keeps a processing completion authoritative when its result terminally fails the run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-processing-terminal-failure";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: failed\nERROR: acceptance gate failed",
        requestId: "RCR_processing-failure01",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });

      const failure = await database.sql.begin(async (transaction) => {
        await closeExactSingleStepClaimInTransaction(transaction, {
          envelope: seeded.envelope,
          outcome: "failed",
          diagnostic: "completion-owned acceptance gate failed",
        });
        await transaction.unsafe(
          "UPDATE steps SET status = 'failed', output = $2, updated_at = NOW() WHERE id = $1",
          [seeded.stepDbId, "completion-owned acceptance gate failed"],
        );
        await markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
          claimId: seeded.claimId,
          claimOutcome: "failed",
          plan: createSingleEffectCompletionPlanDescriptorV1({
            kind: "single_failure",
            continuation: { type: "failure_finalize" },
            effectPayload: { runTerminal: true },
          }),
        });
        return requestRunTerminationInTransaction(transaction, {
          runId,
          targetStatus: "failed",
          requestedBy: "runtime-completion-test",
          diagnostic: "completion-owned acceptance gate failed",
        });
      });
      assert.equal(failure.status, "requested");
      const completionResult = { advanced: false, runCompleted: false, runFailed: true };
      await settleCompletionEffects(database, requested.request.requestId, "spawner-a", completionResult);
      await completions.markEffectsCommitted({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        result: completionResult,
      });
      let completionAfterFailure = await completions.acceptAndRelease({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        result: completionResult,
      });
      assert.equal(completionAfterFailure?.state, "accepted");
      assert.equal((await seeded.sessions.findById(seeded.session.sessionId))?.state, "released");

      if (failure.status !== "requested") throw new Error("failure request missing");
      const terminations = createRunTerminationRepository(database.sql);
      await terminations.claim({
        requestId: failure.request.requestId,
        ownerInstanceId: "termination-manager",
      });
      await terminations.markDrained({
        requestId: failure.request.requestId,
        ownerInstanceId: "termination-manager",
      });
      await terminations.terminalize({ requestId: failure.request.requestId });
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "failed");
    } finally {
      await database.cleanup();
    }
  });

  it("returns the durable accepted result when identical completion is replayed after run terminalization", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-completion-replay";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const output = "STATUS: done\nSUMMARY: exact accepted completion";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_terminal-replay001",
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
      });
      await completeSingleStepClaimAndState(database.sql, {
        envelope: seeded.envelope,
        stepStatus: "done",
        stepOutput: output,
      });
      const completionResult = { advanced: true, runCompleted: true };
      await settleCompletionEffects(
        database,
        requested.request.requestId,
        "spawner-a",
        completionResult,
      );
      await completions.markEffectsCommitted({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        result: completionResult,
      });
      await completions.acceptAndRelease({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-a",
        result: completionResult,
      });
      await transitionRunToTerminal(database.sql, {
        runId,
        status: "completed",
        diagnostic: "all work accepted",
      });

      const replay = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
      });
      assert.equal(replay.status, "existing");
      if (replay.status !== "existing") throw new Error("durable completion replay missing");
      assert.equal(replay.request.state, "accepted");
      assert.deepEqual(replay.request.result, { advanced: true, runCompleted: true });
    } finally {
      await database.cleanup();
    }
  });

  it("does not grant cancellation a second drain owner after completion already claimed the run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-after-completion-claim-race";
      const seeded = await seedManagedClaim(database, runId);
      const completion = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nCHANGES: completion already owns drain",
        requestId: "RCR_after-claim-race001",
      });
      if (completion.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      assert.equal((await completions.claim({
        requestId: completion.request.requestId,
        ownerInstanceId: "completion-manager",
      }))?.state, "draining");

      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "cancellation arrived after completion acquired drain ownership",
        requestId: "RTR_after-claim-race001",
      });
      if (cancellation.status !== "requested") throw new Error("termination request missing");
      const terminationOwner = await createRunTerminationRepository(database.sql).claim({
        requestId: cancellation.request.requestId,
        ownerInstanceId: "termination-manager",
      });

      assert.equal(
        terminationOwner,
        undefined,
        "a committed draining completion must remain the sole run-scoped drain owner until it yields or reaches a durable phase boundary",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("serializes cancellation behind the completion owner that already holds the canonical run lock", async () => {
    const database = await createIsolatedTestDatabase();
    let releaseClaimTableLock: (() => void) | undefined;
    let tableLocker: Promise<unknown> | undefined;
    try {
      const runId = "run-single-step-lock-barrier";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const completionRequest = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: raced by deferred cancellation",
        requestId: "RCR_single-step-barrier1",
      });
      if (completionRequest.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: completionRequest.request.requestId,
        ownerInstanceId: "completion-manager",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: completionRequest.request.requestId,
        ownerInstanceId: "completion-manager",
      });

      let claimTableLocked!: () => void;
      const claimTableLockReady = new Promise<void>((resolve) => { claimTableLocked = resolve; });
      const holdClaimTableLock = new Promise<void>((resolve) => { releaseClaimTableLock = resolve; });
      tableLocker = database.sql.begin(async (transaction) => {
        await transaction.unsafe("LOCK TABLE claim_log IN ACCESS EXCLUSIVE MODE");
        claimTableLocked();
        await holdClaimTableLock;
      });
      await claimTableLockReady;

      const completion = completeSingleStepClaimAndState(database.sql, {
        envelope: seeded.envelope,
        stepStatus: "done",
        stepOutput: "STATUS: done\nSUMMARY: raced by deferred cancellation",
      });
      void completion.catch(() => {});
      await waitForBlockedClaimTransition(database);

      const cancellationPromise = requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "requested after the completion owner acquired the canonical run lock",
        requestId: "RTR_single-step-barrier1",
      });
      await waitForBlockedTerminationPublication(database);

      releaseClaimTableLock();
      releaseClaimTableLock = undefined;
      await tableLocker;
      await completion;

      const cancellation = await cancellationPromise;
      assert.equal(cancellation.status, "requested");
      assert.equal((await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${seeded.claimId}
      `)[0]?.outcome, "completed");
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM runs WHERE id = ${runId}
      `)[0]?.status, "running", "owner-committed completion keeps later cancellation deferred");
    } finally {
      releaseClaimTableLock?.();
      await tableLocker?.catch(() => {});
      await database.cleanup();
    }
  });

  it("never leaves a deferred termination request open behind a terminal run", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-terminal-deferred-request";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const completionRequest = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: failed\nERROR: terminal acceptance failure",
        requestId: "RCR_terminal-deferred01",
      });
      if (completionRequest.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: completionRequest.request.requestId,
        ownerInstanceId: "completion-manager",
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
      });
      await completions.markProcessing({
        requestId: completionRequest.request.requestId,
        ownerInstanceId: "completion-manager",
      });
      const cancellation = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "cli-user",
        diagnostic: "deferred while completion owns product transition",
        requestId: "RTR_terminal-deferred01",
      });
      assert.equal(cancellation.status, "requested");

      try {
        await transitionRunToTerminal(database.sql, {
          runId,
          status: "failed",
          diagnostic: "completion-owned gate terminalized the run",
        });
      } catch {
        // Refusing the terminal transition is safe too; the invariant below
        // only forbids publishing terminal state while recovery work is open.
      }

      const state = await database.sql<Array<{ run_status: string; termination_state: string }>>`
        SELECT r.status AS run_status, rtr.state AS termination_state
          FROM runs r
          JOIN run_termination_requests rtr ON rtr.run_id = r.id
         WHERE r.id = ${runId}
      `;
      const terminal = ["completed", "failed", "cancelled"].includes(state[0]?.run_status ?? "");
      const openTermination = state[0]?.termination_state !== "terminalized";
      assert.equal(
        terminal && openTermination,
        false,
        `terminal run stranded ${state[0]?.termination_state ?? "missing"} termination ownership`,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("does not false-accept an expired processing request from claim outcome alone", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-expired-missing-effect-receipt";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: claim closes before routing receipt",
        requestId: "RCR_missing-receipt001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        leaseMs: 60_000,
        now: startedAt,
      });

      await database.sql.begin((transaction) => closeExactSingleStepClaimInTransaction(transaction, {
        envelope: seeded.envelope,
        outcome: "completed",
        diagnostic: "simulated crash after claim close but before step/routing receipt",
        now: new Date(startedAt.getTime() + 1_000),
      }));
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM steps WHERE id = ${seeded.stepDbId}
      `)[0]?.status, "running", "fixture must stop before the product/routing effect is durably acknowledged");

      const recovered = await completions.recoverExpiredProcessing({
        ownerInstanceId: "recovery-manager",
        now: new Date(startedAt.getTime() + 120_000),
      });
      assert.notEqual(
        recovered.status,
        "finalize",
        "a terminal claim is not proof that step state, routing, advance, and external effects all committed",
      );
      assert.equal(recovered.status, "quarantined");
    } finally {
      await database.cleanup();
    }
  });

  it("adopts an expired executing owner with a drained runtime and active exact claim", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-expired-resume-owner";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: resume exact owner",
        requestId: "RCR_resume-owner0001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        leaseMs: 60_000,
        now: startedAt,
      });

      const recovered = await completions.recoverExpiredProcessing({
        ownerInstanceId: "recovery-manager",
        now: new Date(startedAt.getTime() + 120_000),
      });
      assert.equal(recovered.status, "resume_owner");
      assert.equal(recovered.request?.ownerInstanceId, "recovery-manager");
      assert.equal(recovered.request?.applyPhase, "executing");
      assert.equal(recovered.request?.ownerAttemptCount, 2);
      assert.equal((await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${seeded.claimId}
      `)[0]?.outcome, null);
    } finally {
      await database.cleanup();
    }
  });

  it("prevents a stale completion owner from quarantining an adopted live lease", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-completion-quarantine-fence";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: quarantine fencing",
        requestId: "RCR_quarantine-fence001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "stale-manager",
        leaseMs: 60_000,
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: new Date(startedAt.getTime() + 1_000),
      });
      const stale = await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "stale-manager",
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 2_000),
      });
      assert.ok(stale.leaseExpiresAt);

      const adoptedAt = new Date(startedAt.getTime() + 63_000);
      await assert.rejects(
        completions.quarantine({
          requestId: stale.requestId,
          ownerInstanceId: "stale-manager",
          expectedState: "processing",
          expectedLeaseExpiresAt: stale.leaseExpiresAt,
          expectedUpdatedAt: stale.updatedAt,
          diagnostic: "an expired owner cannot quarantine through maintenance",
          now: adoptedAt,
        }),
        /RUNTIME_COMPLETION_QUARANTINE_AUTHORITY_LOST/,
      );
      const afterExpiry = await completions.findById(stale.requestId);
      assert.equal(afterExpiry?.state, "processing");
      assert.equal(afterExpiry?.leaseExpiresAt, stale.leaseExpiresAt);
      assert.equal(afterExpiry?.updatedAt, stale.updatedAt);

      const adopted = await completions.recoverExpiredProcessing({
        ownerInstanceId: "current-manager",
        leaseMs: 60_000,
        now: adoptedAt,
      });
      assert.equal(adopted.status, "resume_owner");
      assert.ok(adopted.request?.leaseExpiresAt);

      await assert.rejects(
        completions.quarantine({
          requestId: stale.requestId,
          ownerInstanceId: "stale-manager",
          expectedState: "processing",
          expectedLeaseExpiresAt: stale.leaseExpiresAt,
          expectedUpdatedAt: stale.updatedAt,
          diagnostic: "stale manager must not quarantine adopted completion",
          now: new Date(adoptedAt.getTime() + 1_000),
        }),
        /RUNTIME_COMPLETION_QUARANTINE_AUTHORITY_LOST/,
      );
      const afterStale = await completions.findById(stale.requestId);
      assert.equal(afterStale?.state, "processing");
      assert.equal(afterStale?.ownerInstanceId, "current-manager");
      assert.equal(afterStale?.leaseExpiresAt, adopted.request?.leaseExpiresAt);
      assert.equal(afterStale?.updatedAt, adopted.request?.updatedAt);

      if (!afterStale?.leaseExpiresAt) throw new Error("current completion lease missing");
      const quarantined = await completions.quarantine({
        requestId: afterStale.requestId,
        ownerInstanceId: "current-manager",
        expectedState: "processing",
        expectedLeaseExpiresAt: afterStale.leaseExpiresAt,
        expectedUpdatedAt: afterStale.updatedAt,
        diagnostic: "current owner exhausted bounded work",
        now: new Date(adoptedAt.getTime() + 2_000),
      });
      assert.equal(quarantined.state, "quarantined");
      assert.equal(quarantined.ownerInstanceId, "current-manager");
      assert.equal(quarantined.leaseExpiresAt, undefined);
    } finally {
      await database.cleanup();
    }
  });

  it("quarantines owner execution after three unchanged completion attempts", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-owner-attempt-budget";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: deterministic owner keeps crashing",
        requestId: "RCR_owner-budget00001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "owner-1",
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      const initial = await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "owner-1",
        leaseMs: 60_000,
        now: startedAt,
      });
      assert.equal(initial.ownerAttemptCount, 1);

      const second = await completions.recoverExpiredProcessing({
        ownerInstanceId: "owner-2",
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 120_000),
      });
      assert.equal(second.status, "resume_owner");
      assert.equal(second.request?.ownerAttemptCount, 2);

      const third = await completions.recoverExpiredProcessing({
        ownerInstanceId: "owner-3",
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 240_000),
      });
      assert.equal(third.status, "resume_owner");
      assert.equal(third.request?.ownerAttemptCount, 3);

      const exhausted = await completions.recoverExpiredProcessing({
        ownerInstanceId: "owner-4",
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 360_000),
      });
      assert.equal(exhausted.status, "quarantined");
      assert.equal(exhausted.request?.ownerAttemptCount, 3);
      assert.match(exhausted.request?.diagnostic ?? "", /OWNER_ATTEMPT_BUDGET_EXHAUSTED/);
      assert.equal((await database.sql<Array<{ outcome: string | null }>>`
        SELECT outcome FROM claim_log WHERE id = ${seeded.claimId}
      `)[0]?.outcome, null, "bounded recovery must not fabricate product completion");
    } finally {
      await database.cleanup();
    }
  });

  it("adopts owner-committed work at the exact effects continuation phase", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-expired-resume-effects";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const output = "STATUS: done\nSUMMARY: resume deterministic effects";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_resume-effects01",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        now: startedAt,
      });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "crashed-manager",
        leaseMs: 60_000,
        now: startedAt,
      });
      await completeSingleStepClaimAndState(database.sql, {
        envelope: seeded.envelope,
        stepStatus: "done",
        stepOutput: output,
        now: new Date(startedAt.getTime() + 1_000),
      });

      const recovered = await completions.recoverExpiredProcessing({
        ownerInstanceId: "recovery-manager",
        now: new Date(startedAt.getTime() + 120_000),
      });
      assert.equal(recovered.status, "resume_effects");
      assert.equal(recovered.request?.ownerInstanceId, "recovery-manager");
      assert.equal(recovered.request?.applyPhase, "owner_committed");
      assert.equal(recovered.request?.claimOutcome, "completed");
    } finally {
      await database.cleanup();
    }
  });

  it("heartbeats processing ownership so a live coordinator cannot be adopted", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-processing-heartbeat";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output: "STATUS: done\nSUMMARY: long-running acceptance gates",
        requestId: "RCR_processing-heart01",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({ requestId: requested.request.requestId, ownerInstanceId: "live-manager", now: startedAt });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "live-manager",
        leaseMs: 60_000,
        now: startedAt,
      });
      assert.equal(await completions.heartbeatProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "live-manager",
        leaseMs: 60_000,
        now: new Date(startedAt.getTime() + 45_000),
      }), true);
      assert.deepEqual(await completions.recoverExpiredProcessing({
        ownerInstanceId: "other-manager",
        now: new Date(startedAt.getTime() + 90_000),
      }), { status: "none" });
    } finally {
      await database.cleanup();
    }
  });

  it("fences mandatory continuation effects and refuses aggregate acceptance before receipts", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-effect-fence";
      const seeded = await seedManagedSingleStepClaim(database, runId);
      const startedAt = new Date("2026-07-13T12:00:00.000Z");
      const output = "STATUS: done\nSUMMARY: effect lease fencing";
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: seeded.envelope,
        output,
        requestId: "RCR_effect-fence0001",
        now: startedAt,
      });
      if (requested.status !== "requested") throw new Error("completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({ requestId: requested.request.requestId, ownerInstanceId: "manager-a", now: startedAt });
      await seeded.sessions.markDrained({
        sessionId: seeded.session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: startedAt,
      });
      await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "manager-a",
        now: startedAt,
      });
      await completeSingleStepClaimAndState(database.sql, {
        envelope: seeded.envelope,
        stepStatus: "done",
        stepOutput: output,
        now: new Date(startedAt.getTime() + 1_000),
      });

      await assert.rejects(
        completions.markEffectsCommitted({
          requestId: requested.request.requestId,
          ownerInstanceId: "manager-a",
          result: { advanced: true, runCompleted: false },
        }),
        /RUNTIME_COMPLETION_MANDATORY_EFFECTS_PENDING/,
      );
      const effects = createRuntimeCompletionEffectRepository(database.sql);
      const first = await effects.claimNext({
        requestId: requested.request.requestId,
        ownerInstanceId: "effect-owner-a",
        leaseMs: 30_000,
        now: new Date(startedAt.getTime() + 2_000),
      });
      assert.equal(first?.state, "leased");
      assert.equal(first?.mandatory, true);
      assert.equal((await effects.claimNext({
        requestId: requested.request.requestId,
        ownerInstanceId: "effect-owner-b",
        now: new Date(startedAt.getTime() + 20_000),
      })), undefined);
      const adopted = await effects.claimNext({
        requestId: requested.request.requestId,
        ownerInstanceId: "effect-owner-b",
        leaseMs: 30_000,
        now: new Date(startedAt.getTime() + 40_000),
      });
      assert.equal(adopted?.state, "leased");
      assert.notEqual(adopted?.leaseToken, first?.leaseToken);
      await assert.rejects(
        effects.settle({
          requestId: requested.request.requestId,
          effectKey: first!.effectKey,
          ownerInstanceId: "effect-owner-a",
          leaseToken: first!.leaseToken!,
          resolution: "applied",
          result: {},
          evidence: {},
          now: new Date(startedAt.getTime() + 41_000),
        }),
        /RUNTIME_COMPLETION_EFFECT_SETTLE_FENCE_LOST/,
      );
      await effects.settle({
        requestId: requested.request.requestId,
        effectKey: adopted!.effectKey,
        ownerInstanceId: "effect-owner-b",
        leaseToken: adopted!.leaseToken!,
        resolution: "reconciled",
        result: { advanced: true, runCompleted: false },
        evidence: { source: "canonical-state-reconciliation" },
        now: new Date(startedAt.getTime() + 41_000),
      });
      assert.equal(await effects.allMandatorySettled(requested.request.requestId), true);
      assert.equal((await completions.markEffectsCommitted({
        requestId: requested.request.requestId,
        ownerInstanceId: "manager-a",
        result: { advanced: true, runCompleted: false },
        now: new Date(startedAt.getTime() + 42_000),
      })).applyPhase, "effects_committed");
    } finally {
      await database.cleanup();
    }
  });
});
