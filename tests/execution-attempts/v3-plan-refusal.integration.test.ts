import assert from "node:assert/strict";
import { test } from "node:test";

import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { createRunTerminationRepository } from "../../src/execution/run-termination.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const TASK = "Connect the workspace to an external provider and preserve the result safely.";
const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T12:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/v3-plan-refusal-drain"],
};

test("exact PLAN v3 rejection terminally requests compiler-owned clarification without redispatch", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const runId = "run-v3-plan-refusal";
    const stepDbId = "step-v3-plan-refusal";
    const claimAgentId = "feature-dev_planner";
    const runtimeAgentId = "planner-runtime";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    const ledger = extractTaskRequirementLedgerV1(TASK);
    const rejection = {
      schema: "setfarm.product-spec-rejection.v1" as const,
      sourceTaskHash: ledger.sourceHash,
      reasons: [{
        code: "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING" as const,
        requirementRefs: ledger.requirements.map((requirement) => requirement.id),
        message: "The exact provider and persistence authority are not specified.",
      }],
    };
    const output = [
      "STATUS: done",
      "PRD:",
      "```product-spec-rejection-v1",
      JSON.stringify(rejection, null, 2),
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
        'step-v3-plan-refusal-design', ${runId}, 'design', 'feature-dev_designer', 2, '', '',
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
      sessionId: "RTS_v3-plan-refusal-session",
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
      sessionKey: "v3-plan-refusal-session-key",
    });
    const envelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-13T12:00:00.000Z",
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
      requestId: "RCR_v3-plan-refusal-0001",
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
    const processing = await completions.markProcessing({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
    });
    if (!processing.ownerInstanceId || !processing.leaseExpiresAt) {
      throw new Error("test completion owner capability missing");
    }

    const { completeStep } = await import("../../src/installer/step-ops.js");
    assert.deepEqual(await runWithRuntimeCompletionOwner({
      requestId: processing.requestId,
      ownerInstanceId: processing.ownerInstanceId,
      leaseExpiresAt: processing.leaseExpiresAt,
      ownerAttemptCount: processing.ownerAttemptCount,
    }, () => completeStep(stepDbId, output, envelope, {
        deferContinuationToEffectLedger: true,
      })), { advanced: false, runCompleted: false });

    const ownerState = await database.sql<Array<{
      claim_outcome: string;
      plan_status: string;
      plan_output: string;
      design_status: string;
      run_status: string;
      retry_count: number;
      completion_phase: string;
      termination_state: string;
      termination_evidence: Record<string, unknown>;
    }>>`
      SELECT cl.outcome AS claim_outcome,
             plan.status AS plan_status,
             plan.output AS plan_output,
             design.status AS design_status,
             run.status AS run_status,
             plan.retry_count,
             completion.apply_phase AS completion_phase,
             termination.state AS termination_state,
             termination.evidence AS termination_evidence
        FROM claim_log cl
        JOIN steps plan ON plan.id = ${stepDbId}
        JOIN steps design ON design.id = 'step-v3-plan-refusal-design'
        JOIN runs run ON run.id = cl.run_id
        JOIN runtime_completion_requests completion ON completion.claim_id = cl.id
        JOIN run_termination_requests termination ON termination.run_id = run.id
       WHERE cl.id = ${claimId}
    `;
    const owner = ownerState[0]!;
    assert.equal(owner.claim_outcome, "completed");
    assert.equal(owner.plan_status, "failed");
    assert.equal(owner.design_status, "waiting");
    assert.equal(owner.run_status, "running");
    assert.equal(owner.retry_count, 0);
    assert.equal(owner.completion_phase, "owner_committed");
    assert.equal(owner.termination_state, "requested");
    assert.equal(owner.termination_evidence.owner, "compiler");
    assert.equal(owner.termination_evidence.modelRedispatchBudget, 0);
    const record = JSON.parse(owner.plan_output);
    assert.equal(record.schema, "setfarm.v3-plan-clarification-record.v1");
    assert.equal(record.sourceTaskHash, ledger.sourceHash);
    assert.equal(record.terminal.modelRedispatchBudget, 0);

    const effects = createRuntimeCompletionEffectRepository(database.sql);
    const effect = await effects.claimNext({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
    });
    assert.equal(effect?.effectType, "v3.plan.clarification.recorded");
    if (!effect?.leaseToken) throw new Error("plan refusal effect missing");
    await effects.settle({
      requestId: requested.request.requestId,
      effectKey: effect.effectKey,
      ownerInstanceId: "spawner-test",
      leaseToken: effect.leaseToken,
      resolution: "reconciled",
      result: { advanced: false, runCompleted: false },
      evidence: { source: "canonical-plan-refusal-owner" },
    });
    const result = { advanced: false, runCompleted: false };
    await completions.markEffectsCommitted({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
      ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
      result,
    });
    await completions.acceptAndRelease({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
      ownerAttemptCount: (await completions.findById(requested.request.requestId))!.ownerAttemptCount,
      result,
    });

    const terminations = createRunTerminationRepository(database.sql);
    const termination = await terminations.claim({ ownerInstanceId: "spawner-test" });
    assert.equal(termination?.state, "draining");
    if (!termination) throw new Error("plan refusal termination missing");
    await terminations.markDrained({
      requestId: termination.requestId,
      ownerInstanceId: "spawner-test",
    });
    await terminations.terminalize({ requestId: termination.requestId });
    const terminal = await database.sql<Array<{
      run_status: string;
      plan_status: string;
      design_status: string;
      open_claims: number;
    }>>`
      SELECT run.status AS run_status,
             plan.status AS plan_status,
             design.status AS design_status,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId} AND outcome IS NULL) AS open_claims
        FROM runs run
        JOIN steps plan ON plan.id = ${stepDbId}
        JOIN steps design ON design.id = 'step-v3-plan-refusal-design'
       WHERE run.id = ${runId}
    `;
    assert.deepEqual({ ...terminal[0] }, {
      run_status: "failed",
      plan_status: "failed",
      design_status: "failed",
      open_claims: 0,
    });
  } finally {
    await runtimeDb?.pgClose().catch(() => {});
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
