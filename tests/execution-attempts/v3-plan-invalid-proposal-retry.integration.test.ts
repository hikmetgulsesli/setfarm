import assert from "node:assert/strict";
import { test } from "node:test";

import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { recoverV3StageFailureV1 } from "../../src/execution/v3-stage-retry-authority.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import {
  canonicalProductDeliveryProfileCatalogV1,
  productDeliveryProfileCatalogHashV1,
} from "../../src/product-compiler/product-delivery-profile-catalog.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
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
    // Import installer modules only after the isolated database has installed its
    // connection URL. Static imports would bind the shared DB singleton to the
    // developer database before the test database exists.
    const { buildPrompt: buildPlanPrompt } = await import("../../src/installer/steps/01-plan/module.js");
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
    const planInstruction = buildPlanPrompt({
      runId,
      task: TASK,
      context: {
        task: TASK,
        plan_protocol: "v3",
        v3_requirement_ledger: canonicalJsonStringify(extractTaskRequirementLedgerV1(TASK)),
        v3_delivery_profile_catalog: canonicalProductDeliveryProfileCatalogV1(),
        v3_delivery_profile_catalog_hash: productDeliveryProfileCatalogHashV1(),
        v3_requested_stack_pack_id: "",
      },
    });

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
      input: planInstruction,
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
    const stageFailure = recoverV3StageFailureV1({
      workflowStepId: "plan",
      diagnostic: ownerState[0]!.plan_output,
    });
    assert.equal(stageFailure.schema, "setfarm.v3-stage-failure.v1");
    assert.equal(stageFailure.kind, "output_contract_invalid");
    assert.ok(stageFailure.diagnostics.length > 0);
    assert.match(stageFailure.diagnostics[0]!.message, /expected/i);
    assert.equal(ownerState[0]!.plan_output, ownerState[0]!.claim_diagnostic);

    const prematureRetry = await (await import("../../src/installer/step-ops.js")).claimStep(
      claimAgentId,
      "v3-plan-retry-before-effects-commit",
      {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: "RTS_v3-plan-retry-premature",
        runtimeAgentId: "planner-retry-premature-runtime",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-test-premature-retry",
      },
    );
    assert.deepEqual(prematureRetry, { found: false });
    const prematureState = await database.sql<Array<{
      run_status: string;
      step_status: string;
      claim_count: number;
      runtime_count: number;
      termination_count: number;
    }>>`
      SELECT run.status AS run_status,
             step.status AS step_status,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id) AS claim_count,
             (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = run.id) AS runtime_count,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = run.id) AS termination_count
        FROM runs run
        JOIN steps step ON step.id = ${stepDbId}
       WHERE run.id = ${runId}
    `;
    assert.deepEqual({ ...prematureState[0] }, {
      run_status: "running",
      step_status: "pending",
      claim_count: 1,
      runtime_count: 1,
      termination_count: 0,
    });

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

    const retryClaim = await (await import("../../src/installer/step-ops.js")).claimStep(
      claimAgentId,
      "v3-plan-retry-integration",
      {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: "RTS_v3-plan-retry-0002",
        runtimeAgentId: "planner-retry-runtime",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-test-retry",
      },
    );
    assert.equal(retryClaim.found, true);
    assert.equal(retryClaim.protocol, "v3");
    assert.equal(retryClaim.v3StageRetrySource?.schema, "setfarm.v3-stage-retry-source.v1");
    assert.equal(retryClaim.v3StageRetrySource?.retryOrdinal, 1);
    assert.equal(retryClaim.v3StageRetrySource?.previousClaimId, claimId);
    assert.equal(retryClaim.v3StageRetrySource?.previousOutput.content, output);
    assert.equal(
      retryClaim.v3StageRetrySource?.failure.failureHash,
      stageFailure.failureHash,
    );
    assert.match(
      retryClaim.v3StageRetrySource?.failure.diagnostics[0]?.message || "",
      /expected/i,
    );
    assert.equal(retryClaim.resolvedInput, planInstruction);
    if (!retryClaim.claimId || !retryClaim.runtimeSessionId) {
      throw new Error("retry claim authority missing");
    }
    const retryOwner = "spawner-test-retry";
    await sessions.markStarting({
      sessionId: retryClaim.runtimeSessionId,
      ownerInstanceId: retryOwner,
    });
    await sessions.markRunning({
      sessionId: retryClaim.runtimeSessionId,
      ownerInstanceId: retryOwner,
      sessionKey: "v3-plan-invalid-retry-key-2",
    });
    const retryEnvelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-14T22:10:00.000Z",
      stepId: stepDbId,
      workflowStepId: "plan",
      runId,
      claimId: retryClaim.claimId,
      claimAgentId,
      runtimeAgentId: "planner-retry-runtime",
      input: retryClaim.resolvedInput,
    };
    const changedOutput = `${output}\n`;
    const requestedRetry = await requestRuntimeCompletion(database.sql, {
      envelope: retryEnvelope,
      output: changedOutput,
      requestId: "RCR_v3-plan-invalid-retry2",
    });
    assert.equal(requestedRetry.status, "requested");
    if (requestedRetry.status !== "requested") throw new Error("retry completion missing");
    await completions.claim({
      requestId: requestedRetry.request.requestId,
      ownerInstanceId: retryOwner,
    });
    await sessions.markDrained({
      sessionId: retryClaim.runtimeSessionId,
      ownerInstanceId: retryOwner,
      evidence: {
        ...DRAIN_EVIDENCE,
        observedAt: "2026-07-14T22:11:00.000Z",
        evidenceRefs: ["setfarm://test/v3-plan-invalid-proposal-retry-drain-2"],
      },
    });
    await completions.markProcessing({
      requestId: requestedRetry.request.requestId,
      ownerInstanceId: retryOwner,
    });
    assert.deepEqual(await completeStep(stepDbId, changedOutput, retryEnvelope, {
      deferContinuationToEffectLedger: true,
    }), { advanced: false, runCompleted: false });
    const retryEffect = await effects.claimNext({
      requestId: requestedRetry.request.requestId,
      ownerInstanceId: retryOwner,
    });
    if (!retryEffect?.leaseToken) throw new Error("retry failure finalization effect missing");
    await effects.settle({
      requestId: requestedRetry.request.requestId,
      effectKey: retryEffect.effectKey,
      ownerInstanceId: retryOwner,
      leaseToken: retryEffect.leaseToken,
      resolution: "reconciled",
      result,
      evidence: { source: "canonical-plan-invalid-retry-owner-2" },
    });
    await completions.markEffectsCommitted({
      requestId: requestedRetry.request.requestId,
      ownerInstanceId: retryOwner,
      result,
    });
    await completions.acceptAndRelease({
      requestId: requestedRetry.request.requestId,
      ownerInstanceId: retryOwner,
      result,
    });

    const returningClaim = await (await import("../../src/installer/step-ops.js")).claimStep(
      claimAgentId,
      "v3-plan-retry-returning-output-integration",
      {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: "RTS_v3-plan-retry-0003",
        runtimeAgentId: "planner-retry-runtime-3",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-test-retry-3",
      },
    );
    assert.equal(returningClaim.found, true);
    assert.equal(returningClaim.v3StageRetrySource?.previousOutput.content, changedOutput);
    if (!returningClaim.claimId || !returningClaim.runtimeSessionId) {
      throw new Error("returning retry claim authority missing");
    }
    const returningOwner = "spawner-test-retry-3";
    await sessions.markStarting({
      sessionId: returningClaim.runtimeSessionId,
      ownerInstanceId: returningOwner,
    });
    await sessions.markRunning({
      sessionId: returningClaim.runtimeSessionId,
      ownerInstanceId: returningOwner,
      sessionKey: "v3-plan-invalid-retry-key-3",
    });
    const returningEnvelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-14T22:20:00.000Z",
      stepId: stepDbId,
      workflowStepId: "plan",
      runId,
      claimId: returningClaim.claimId,
      claimAgentId,
      runtimeAgentId: "planner-retry-runtime-3",
      input: returningClaim.resolvedInput,
    };
    const requestedReturning = await requestRuntimeCompletion(database.sql, {
      envelope: returningEnvelope,
      output,
      requestId: "RCR_v3-plan-invalid-retry3",
    });
    assert.equal(requestedReturning.status, "requested");
    if (requestedReturning.status !== "requested") throw new Error("returning retry completion missing");
    await completions.claim({
      requestId: requestedReturning.request.requestId,
      ownerInstanceId: returningOwner,
    });
    await sessions.markDrained({
      sessionId: returningClaim.runtimeSessionId,
      ownerInstanceId: returningOwner,
      evidence: {
        ...DRAIN_EVIDENCE,
        observedAt: "2026-07-14T22:21:00.000Z",
        evidenceRefs: ["setfarm://test/v3-plan-invalid-proposal-retry-drain-3"],
      },
    });
    await completions.markProcessing({
      requestId: requestedReturning.request.requestId,
      ownerInstanceId: returningOwner,
    });
    assert.deepEqual(await completeStep(stepDbId, output, returningEnvelope, {
      deferContinuationToEffectLedger: true,
    }), { advanced: false, runCompleted: false });
    const returningEffect = await effects.claimNext({
      requestId: requestedReturning.request.requestId,
      ownerInstanceId: returningOwner,
    });
    if (!returningEffect?.leaseToken) throw new Error("returning retry failure finalization effect missing");
    await effects.settle({
      requestId: requestedReturning.request.requestId,
      effectKey: returningEffect.effectKey,
      ownerInstanceId: returningOwner,
      leaseToken: returningEffect.leaseToken,
      resolution: "reconciled",
      result,
      evidence: { source: "canonical-plan-invalid-retry-owner-3" },
    });
    await completions.markEffectsCommitted({
      requestId: requestedReturning.request.requestId,
      ownerInstanceId: returningOwner,
      result,
    });
    await completions.acceptAndRelease({
      requestId: requestedReturning.request.requestId,
      ownerInstanceId: returningOwner,
      result,
    });

    const duplicateDispatch = await (await import("../../src/installer/step-ops.js")).claimStep(
      claimAgentId,
      "v3-plan-retry-dedupe-integration",
      {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: "RTS_v3-plan-retry-0004",
        runtimeAgentId: "planner-retry-runtime-4",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-test-retry-4",
      },
    );
    assert.deepEqual(duplicateDispatch, { found: false });
    const dedupeState = await database.sql<Array<{
      run_status: string;
      step_status: string;
      claim_count: number;
      open_claims: number;
      released_runtimes: number;
      termination_count: number;
      latest_diagnostic: string;
      dedupe_observations: number;
    }>>`
      SELECT run.status AS run_status,
             step.status AS step_status,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id) AS claim_count,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id AND outcome IS NULL) AS open_claims,
             (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = run.id AND state = 'released') AS released_runtimes,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = run.id) AS termination_count,
             (SELECT diagnostic FROM claim_log WHERE run_id = run.id ORDER BY id DESC LIMIT 1) AS latest_diagnostic,
             (SELECT COUNT(*)::integer FROM run_observations WHERE run_id = run.id AND check_id LIKE 'v3.stage-retry.duplicate:%') AS dedupe_observations
        FROM runs run
        JOIN steps step ON step.id = ${stepDbId}
       WHERE run.id = ${runId}
    `;
    assert.deepEqual({
      ...dedupeState[0],
      latest_diagnostic: dedupeState[0]!.latest_diagnostic.replace(/: [a-f0-9]{64};.*/, ": <dedupe>"),
    }, {
      run_status: "failing",
      step_status: "failed",
      claim_count: 4,
      open_claims: 0,
      released_runtimes: 4,
      termination_count: 1,
      latest_diagnostic: "V3_STAGE_RETRY_DUPLICATE_UNCHANGED_TUPLE: <dedupe>",
      dedupe_observations: 1,
    });
  } finally {
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
