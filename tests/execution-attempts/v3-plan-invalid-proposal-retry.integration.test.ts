import assert from "node:assert/strict";
import { test } from "node:test";

import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const TASK = "Build a single-page status utility at /status with a Refresh button and reload persistence.";
const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-14T22:08:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/v3-plan-invalid-proposal-drain"],
};

test("invalid PLAN v3 proposal closes the exact claim and settles as a bounded retry", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  try {
    const runId = "run-v3-plan-invalid-retry";
    const stepDbId = "step-v3-plan-invalid-retry";
    const claimAgentId = "feature-dev_planner";
    const runtimeAgentId = "planner-runtime";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    const output = [
      "STATUS: done",
      "PRD:",
      "```product-spec-v1",
      JSON.stringify({
        schema: "setfarm.product-spec.v1",
        product: { id: "PROD_STATUS", name: "Status Utility", class: "utility" },
      }, null, 2),
      "```",
    ].join("\n");

    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', ${TASK}, 'running',
        ${JSON.stringify({ task: TASK, plan_protocol: "v3" })}, 'v3',
        ${releaseSha}, ${"e".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${stepDbId}, ${runId}, 'plan', ${claimAgentId}, 1, '', '',
        'running', 'single', 0, 3
      ), (
        'step-v3-plan-invalid-design', ${runId}, 'design', 'feature-dev_designer', 2, '', '',
        'waiting', 'single', 0, 3
      )
    `;
    const claims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${runId}, 'plan', NULL, ${claimAgentId})
      RETURNING id::integer AS id
    `;
    const claimId = claims[0]!.id;
    const sessions = createRuntimeSessionRepository(database.sql);
    const session = await sessions.reserve({
      sessionId: "RTS_v3-plan-invalid-retry1",
      runId,
      stepDbId,
      workflowStepId: "plan",
      claimId,
      claimAgentId,
      runtimeAgentId,
      runtimeKind: "openclaw_session",
      ownerInstanceId: "spawner-test",
    });
    await sessions.markStarting({ sessionId: session.sessionId, ownerInstanceId: "spawner-test" });
    await sessions.markRunning({
      sessionId: session.sessionId,
      ownerInstanceId: "spawner-test",
      sessionKey: "v3-plan-invalid-retry-key",
    });
    const envelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-14T22:00:00.000Z",
      stepId: stepDbId,
      workflowStepId: "plan",
      runId,
      claimId,
      claimAgentId,
      runtimeAgentId,
    };
    const requested = await requestRuntimeCompletion(database.sql, {
      envelope,
      output,
      requestId: "RCR_v3-plan-invalid-retry1",
    });
    assert.equal(requested.status, "requested");
    if (requested.status !== "requested") throw new Error("runtime completion missing");
    const completions = createRuntimeCompletionRepository(database.sql);
    await completions.claim({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
    });
    await sessions.markDrained({
      sessionId: session.sessionId,
      ownerInstanceId: "spawner-test",
      evidence: DRAIN_EVIDENCE,
    });
    await completions.markProcessing({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
    });

    const { completeStep } = await import("../../src/installer/step-ops.js");
    assert.deepEqual(await completeStep(stepDbId, output, envelope, {
      deferContinuationToEffectLedger: true,
    }), { advanced: false, runCompleted: false });

    const ownerState = await database.sql<Array<{
      claim_outcome: string;
      claim_diagnostic: string;
      plan_status: string;
      plan_output: string;
      retry_count: number;
      design_status: string;
      run_status: string;
      completion_state: string;
      completion_phase: string;
      runtime_state: string;
      termination_count: number;
    }>>`
      SELECT cl.outcome AS claim_outcome,
             cl.diagnostic AS claim_diagnostic,
             plan.status AS plan_status,
             plan.output AS plan_output,
             plan.retry_count,
             design.status AS design_status,
             run.status AS run_status,
             completion.state AS completion_state,
             completion.apply_phase AS completion_phase,
             runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = run.id) AS termination_count
        FROM claim_log cl
        JOIN steps plan ON plan.id = ${stepDbId}
        JOIN steps design ON design.id = 'step-v3-plan-invalid-design'
        JOIN runs run ON run.id = cl.run_id
        JOIN runtime_completion_requests completion ON completion.claim_id = cl.id
        JOIN runtime_sessions runtime ON runtime.claim_id = cl.id
       WHERE cl.id = ${claimId}
    `;
    assert.deepEqual({ ...ownerState[0] }, {
      claim_outcome: "failed",
      claim_diagnostic: ownerState[0]!.claim_diagnostic,
      plan_status: "pending",
      plan_output: ownerState[0]!.plan_output,
      retry_count: 1,
      design_status: "waiting",
      run_status: "running",
      completion_state: "processing",
      completion_phase: "owner_committed",
      runtime_state: "drained",
      termination_count: 0,
    });
    assert.match(ownerState[0]!.claim_diagnostic, /^V3_PLAN_OUTPUT_REJECTED: V3_PLAN_PRODUCT_SPEC_PROPOSAL_INVALID:/);
    assert.equal(ownerState[0]!.plan_output, ownerState[0]!.claim_diagnostic);

    const effects = createRuntimeCompletionEffectRepository(database.sql);
    const effect = await effects.claimNext({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
    });
    assert.equal(effect?.effectType, "failure.finalize");
    if (!effect?.leaseToken) throw new Error("failure finalization effect missing");
    const result = { advanced: false, runCompleted: false };
    await effects.settle({
      requestId: requested.request.requestId,
      effectKey: effect.effectKey,
      ownerInstanceId: "spawner-test",
      leaseToken: effect.leaseToken,
      resolution: "reconciled",
      result,
      evidence: { source: "canonical-plan-invalid-retry-owner" },
    });
    await completions.markEffectsCommitted({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
      result,
    });
    await completions.acceptAndRelease({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
      result,
    });

    assert.equal((await completions.findById(requested.request.requestId))?.state, "accepted");
    assert.equal((await sessions.findById(session.sessionId))?.state, "released");
  } finally {
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
