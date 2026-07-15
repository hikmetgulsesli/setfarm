import assert from "node:assert/strict";
import { test } from "node:test";

import { closeExactSingleStepClaimInTransaction } from "../../src/execution/claim-attempt-transition.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { requestRunTermination } from "../../src/execution/run-termination.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("post-claim finalizer settles terminal reserved and pre-transfer starting owners", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const { releaseUntransferredPostClaimOwnership } = await import("../../src/spawner.js");
    const sessions = createRuntimeSessionRepository(database.sql);

    const terminalRunId = "run-post-claim-terminal-reserved";
    const terminalStepDbId = `${terminalRunId}-step`;
    const terminalAgent = "feature-dev_security";
    await database.insertRun(terminalRunId);
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${terminalStepDbId}, ${terminalRunId}, 'security-gate', ${terminalAgent},
        1, '', '', 'running', 'single', 0, 3
      )
    `;
    const terminalClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${terminalRunId}, 'security-gate', NULL, ${terminalAgent})
      RETURNING id::integer AS id
    `;
    const terminalClaimId = terminalClaims[0]!.id;
    const terminalSession = await sessions.reserve({
      sessionId: "RTS_post-claim-terminal-reserved",
      runId: terminalRunId,
      stepDbId: terminalStepDbId,
      workflowStepId: "security-gate",
      claimId: terminalClaimId,
      claimAgentId: terminalAgent,
      runtimeAgentId: "security-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "spawner-test",
    });
    const terminalEnvelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "shadow",
      issuedAt: new Date().toISOString(),
      stepId: terminalStepDbId,
      workflowStepId: "security-gate",
      runId: terminalRunId,
      claimId: terminalClaimId,
      claimAgentId: terminalAgent,
      runtimeAgentId: "security-runtime",
    };
    await database.sql.begin((transaction) => closeExactSingleStepClaimInTransaction(transaction, {
      envelope: terminalEnvelope,
      outcome: "completed",
      diagnostic: "inline gate committed before its no-spawn release response",
    }));

    await releaseUntransferredPostClaimOwnership({
      found: true,
      protocol: "shadow",
      runId: terminalRunId,
      stepId: terminalStepDbId,
      workflowStepId: "security-gate",
      claimId: terminalClaimId,
      claimAgentId: terminalAgent,
      runtimeSessionId: terminalSession.sessionId,
      runtimeOwnerInstanceId: terminalSession.ownerInstanceId,
    } as never, "security-runtime", "injected throw after claim close before runtime release");

    const terminalState = await database.sql<Array<{ outcome: string; runtime_state: string }>>`
      SELECT claim.outcome, runtime.state AS runtime_state
        FROM claim_log claim
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
       WHERE claim.id = ${terminalClaimId}
    `;
    assert.deepEqual({ ...terminalState[0] }, { outcome: "completed", runtime_state: "released" });

    const startingRunId = "run-post-claim-starting-single";
    const startingStepDbId = `${startingRunId}-step`;
    const startingAgent = "feature-dev_reviewer";
    await database.insertRun(startingRunId);
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${startingStepDbId}, ${startingRunId}, 'verify', ${startingAgent},
        1, '', '', 'running', 'single', 0, 3
      )
    `;
    const startingClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${startingRunId}, 'verify', NULL, ${startingAgent})
      RETURNING id::integer AS id
    `;
    const startingClaimId = startingClaims[0]!.id;
    const startingSession = await sessions.reserve({
      sessionId: "RTS_post-claim-starting-single",
      runId: startingRunId,
      stepDbId: startingStepDbId,
      workflowStepId: "verify",
      claimId: startingClaimId,
      claimAgentId: startingAgent,
      runtimeAgentId: "review-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "spawner-test",
    });
    await sessions.markStarting({
      sessionId: startingSession.sessionId,
      ownerInstanceId: startingSession.ownerInstanceId,
    });

    await releaseUntransferredPostClaimOwnership({
      found: true,
      protocol: "shadow",
      runId: startingRunId,
      stepId: startingStepDbId,
      workflowStepId: "verify",
      claimId: startingClaimId,
      claimAgentId: startingAgent,
      runtimeSessionId: startingSession.sessionId,
      runtimeOwnerInstanceId: startingSession.ownerInstanceId,
    } as never, "review-runtime", "injected synchronous spawn failure after markStarting");

    const startingState = await database.sql<Array<{
      outcome: string;
      runtime_state: string;
      active_attempts: number;
      active_deliveries: number;
    }>>`
      SELECT claim.outcome, runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM execution_attempts attempt
               WHERE attempt.claim_id = claim.id
                 AND attempt.disposition IN ('claimed', 'running')) AS active_attempts,
             (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries delivery
               WHERE delivery.claim_id = claim.id
                 AND delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')) AS active_deliveries
        FROM claim_log claim
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
       WHERE claim.id = ${startingClaimId}
    `;
    assert.deepEqual({ ...startingState[0] }, {
      outcome: "infra_retry",
      runtime_state: "released",
      active_attempts: 0,
      active_deliveries: 0,
    });

    const completionRunId = "run-post-claim-completion-handoff";
    const completionStepDbId = `${completionRunId}-step`;
    const completionAgent = "feature-dev_qa";
    await database.insertRun(completionRunId);
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${completionStepDbId}, ${completionRunId}, 'qa', ${completionAgent},
        1, '', '', 'running', 'single', 0, 3
      )
    `;
    const completionClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${completionRunId}, 'qa', NULL, ${completionAgent})
      RETURNING id::integer AS id
    `;
    const completionClaimId = completionClaims[0]!.id;
    const completionSession = await sessions.reserve({
      sessionId: "RTS_post-claim-completion-handoff",
      runId: completionRunId,
      stepDbId: completionStepDbId,
      workflowStepId: "qa",
      claimId: completionClaimId,
      claimAgentId: completionAgent,
      runtimeAgentId: "qa-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "spawner-test",
    });
    const completionEnvelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "shadow",
      issuedAt: new Date().toISOString(),
      stepId: completionStepDbId,
      workflowStepId: "qa",
      runId: completionRunId,
      claimId: completionClaimId,
      claimAgentId: completionAgent,
      runtimeAgentId: "qa-runtime",
    };
    const completionRequest = await requestRuntimeCompletion(database.sql, {
      envelope: completionEnvelope,
      output: JSON.stringify({ status: "ready" }),
      requestId: "RCR_post-claim-completion-handoff",
    });
    assert.equal(completionRequest.status, "requested");
    const completionHandoff = await releaseUntransferredPostClaimOwnership({
      found: true,
      protocol: "shadow",
      runId: completionRunId,
      stepId: completionStepDbId,
      workflowStepId: "qa",
      claimId: completionClaimId,
      claimAgentId: completionAgent,
      runtimeSessionId: completionSession.sessionId,
      runtimeOwnerInstanceId: completionSession.ownerInstanceId,
    } as never, "qa-runtime", "spawn callback raced durable completion publication");
    assert.equal(completionHandoff.status, "handed_off_completion");
    const completionState = await database.sql<Array<{
      outcome: string | null;
      runtime_state: string;
      completion_state: string;
    }>>`
      SELECT claim.outcome, runtime.state AS runtime_state, completion.state AS completion_state
        FROM claim_log claim
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
        JOIN runtime_completion_requests completion ON completion.claim_id = claim.id
       WHERE claim.id = ${completionClaimId}
    `;
    assert.deepEqual({ ...completionState[0] }, {
      outcome: null,
      runtime_state: "drain_requested",
      completion_state: "requested",
    });

    const quarantinedRunId = "run-post-claim-quarantined-completion";
    const quarantinedStepDbId = `${quarantinedRunId}-step`;
    const quarantinedAgent = "feature-dev_quarantine";
    await database.insertRun(quarantinedRunId);
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${quarantinedStepDbId}, ${quarantinedRunId}, 'qa', ${quarantinedAgent},
        1, '', '', 'running', 'single', 0, 3
      )
    `;
    const quarantinedClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${quarantinedRunId}, 'qa', NULL, ${quarantinedAgent})
      RETURNING id::integer AS id
    `;
    const quarantinedClaimId = quarantinedClaims[0]!.id;
    const quarantinedSession = await sessions.reserve({
      sessionId: "RTS_post-claim-quarantined-completion",
      runId: quarantinedRunId,
      stepDbId: quarantinedStepDbId,
      workflowStepId: "qa",
      claimId: quarantinedClaimId,
      claimAgentId: quarantinedAgent,
      runtimeAgentId: "qa-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "spawner-test",
    });
    const quarantinedEnvelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "shadow",
      issuedAt: new Date().toISOString(),
      stepId: quarantinedStepDbId,
      workflowStepId: "qa",
      runId: quarantinedRunId,
      claimId: quarantinedClaimId,
      claimAgentId: quarantinedAgent,
      runtimeAgentId: "qa-runtime",
    };
    const quarantinedRequest = await requestRuntimeCompletion(database.sql, {
      envelope: quarantinedEnvelope,
      output: JSON.stringify({ status: "ready" }),
      requestId: "RCR_post-claim-quarantined-completion",
    });
    if (quarantinedRequest.status !== "requested") throw new Error("quarantined completion request missing");
    const completionRepository = createRuntimeCompletionRepository(database.sql);
    const quarantinedOwner = await completionRepository.claim({
      requestId: quarantinedRequest.request.requestId,
      ownerInstanceId: "completion-owner",
    });
    if (!quarantinedOwner?.leaseExpiresAt) throw new Error("quarantined completion owner missing");
    await completionRepository.quarantine({
      requestId: quarantinedOwner.requestId,
      ownerInstanceId: "completion-owner",
      expectedState: "draining",
      expectedLeaseExpiresAt: quarantinedOwner.leaseExpiresAt,
      expectedUpdatedAt: quarantinedOwner.updatedAt,
      diagnostic: "bounded owner exhausted before post-claim finalization",
    });
    await assert.rejects(
      releaseUntransferredPostClaimOwnership({
        found: true,
        protocol: "shadow",
        runId: quarantinedRunId,
        stepId: quarantinedStepDbId,
        workflowStepId: "qa",
        claimId: quarantinedClaimId,
        claimAgentId: quarantinedAgent,
        runtimeSessionId: quarantinedSession.sessionId,
        runtimeOwnerInstanceId: quarantinedSession.ownerInstanceId,
      } as never, "qa-runtime", "spawn callback observed a quarantined completion"),
      /POST_CLAIM_COMPLETION_QUARANTINED/,
    );
    const quarantinedState = await database.sql<Array<{
      outcome: string | null;
      runtime_state: string;
      completion_state: string;
    }>>`
      SELECT claim.outcome, runtime.state AS runtime_state, completion.state AS completion_state
        FROM claim_log claim
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
        JOIN runtime_completion_requests completion ON completion.claim_id = claim.id
       WHERE claim.id = ${quarantinedClaimId}
    `;
    assert.deepEqual({ ...quarantinedState[0] }, {
      outcome: null,
      runtime_state: "drain_requested",
      completion_state: "quarantined",
    });

    const terminationRunId = "run-post-claim-termination-handoff";
    const terminationStepDbId = `${terminationRunId}-step`;
    const terminationAgent = "feature-dev_final";
    await database.insertRun(terminationRunId);
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${terminationStepDbId}, ${terminationRunId}, 'final', ${terminationAgent},
        1, '', '', 'running', 'single', 0, 3
      )
    `;
    const terminationClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${terminationRunId}, 'final', NULL, ${terminationAgent})
      RETURNING id::integer AS id
    `;
    const terminationClaimId = terminationClaims[0]!.id;
    const terminationSession = await sessions.reserve({
      sessionId: "RTS_post-claim-termination-handoff",
      runId: terminationRunId,
      stepDbId: terminationStepDbId,
      workflowStepId: "final",
      claimId: terminationClaimId,
      claimAgentId: terminationAgent,
      runtimeAgentId: "final-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "spawner-test",
    });
    await requestRunTermination(database.sql, {
      runId: terminationRunId,
      targetStatus: "failed",
      requestedBy: "test.post-claim-finalizer",
      diagnostic: "termination became the durable recovery owner",
      requestId: "RTR_post-claim-termination-handoff",
    });
    await sessions.requestDrain({
      sessionId: terminationSession.sessionId,
      ownerInstanceId: terminationSession.ownerInstanceId,
      diagnostic: "termination owns runtime drain",
    });
    const terminationHandoff = await releaseUntransferredPostClaimOwnership({
      found: true,
      protocol: "shadow",
      runId: terminationRunId,
      stepId: terminationStepDbId,
      workflowStepId: "final",
      claimId: terminationClaimId,
      claimAgentId: terminationAgent,
      runtimeSessionId: terminationSession.sessionId,
      runtimeOwnerInstanceId: terminationSession.ownerInstanceId,
    } as never, "final-runtime", "spawn callback raced durable termination publication");
    assert.equal(terminationHandoff.status, "handed_off_termination");
    const terminationState = await database.sql<Array<{
      outcome: string | null;
      runtime_state: string;
      termination_state: string;
    }>>`
      SELECT claim.outcome, runtime.state AS runtime_state, termination.state AS termination_state
        FROM claim_log claim
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
        JOIN run_termination_requests termination ON termination.run_id = claim.run_id
       WHERE claim.id = ${terminationClaimId}
    `;
    assert.deepEqual({ ...terminationState[0] }, {
      outcome: null,
      runtime_state: "drain_requested",
      termination_state: "requested",
    });
  } finally {
    await runtimeDb?.pgClose().catch(() => {});
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
