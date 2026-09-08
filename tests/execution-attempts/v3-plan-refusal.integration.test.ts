import assert from "node:assert/strict";
import { test } from "node:test";

import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import type { PgTransactionSql } from "../../src/db-pg.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
} from "../../src/execution/claim-runtime-publication.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { persistWorkflowRunInTransaction } from "../../src/execution/run-persistence.js";
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

    await database.sql.begin((transaction) => persistWorkflowRunInTransaction(
      transaction as PgTransactionSql,
      {
        run: {
          id: runId,
          runNumber: 8701,
          workflowId: "feature-dev",
          task: TASK,
          context: JSON.stringify({ task: TASK, plan_protocol: "v3" }),
          notifyUrl: null,
          createdAt: "2026-07-13T12:00:00.000Z",
          protocol: {
            mode: "v3",
            version: 1,
            compilerReleaseSha: releaseSha,
            activationPreflightHash: "e".repeat(64),
            releaseAdmissionHash,
            releaseAdmissionKind: "release_go",
            canaryAdmission: null,
          },
        },
        steps: [
          { id: stepDbId, stepId: "plan", agentId: claimAgentId, stepIndex: 1, inputTemplate: "", expects: "", status: "running", maxRetries: 3, type: "single", loopConfig: null },
          { id: "step-v3-plan-refusal-design", stepId: "design", agentId: "feature-dev_designer", stepIndex: 2, inputTemplate: "", expects: "", status: "waiting", maxRetries: 3, type: "single", loopConfig: null },
        ],
      },
    ));
    const boundRunOwners = await database.sql<Array<{
      producer_implementation_id: string;
      category: string;
      owner_key: string;
      state: string;
    }>>`
      SELECT producer_implementation_id, category, owner_key, state
        FROM internal_production_owner_reservations_v1
       WHERE category = 'run' AND owner_key = ${runId}
    `;
    assert.deepEqual(boundRunOwners.map((row) => ({ ...row })), [{
      producer_implementation_id: "a-runtime-run-v1",
      category: "run",
      owner_key: runId,
      state: "bound",
    }]);
    const claimId = await database.sql.begin(async (transaction) => {
      const rows = await (transaction as PgTransactionSql)<Array<{ id: unknown }>>`
        SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
      `;
      const birth = await prepareInternalProductionClaimBirthV1(
        transaction as PgTransactionSql,
        "a-claim-single-runtime-v1",
        rows,
      );
      return insertAndBindInternalProductionClaimBirthV1(transaction as PgTransactionSql, birth, {
        runId,
        workflowStepId: "plan",
        storyId: null,
        claimAgentId,
        claimedAt: new Date("2026-07-13T12:00:00.000Z"),
      });
    }) as number;
    const boundClaimOwners = await database.sql<Array<{
      producer_implementation_id: string;
      category: string;
      owner_key: string;
      state: string;
    }>>`
      SELECT producer_implementation_id, category, owner_key, state
        FROM internal_production_owner_reservations_v1
       WHERE category = 'claim' AND owner_key = ${String(claimId)}
    `;
    assert.deepEqual(boundClaimOwners.map((row) => ({ ...row })), [{
      producer_implementation_id: "a-claim-single-runtime-v1",
      category: "claim",
      owner_key: String(claimId),
      state: "bound",
    }]);
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
    const closedClaimOwners = await database.sql<Array<{ state: string }>>`
      SELECT state
        FROM internal_production_owner_reservations_v1
       WHERE category = 'claim' AND owner_key = ${String(claimId)}
    `;
    assert.deepEqual(closedClaimOwners.map((row) => ({ ...row })), [{ state: "closed" }]);
    assert.deepEqual(owner.termination_evidence.operationalFailureCause, {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: "plan",
      boundary: "product_compiler.plan_refusal",
      failureClass: "contract_invalid",
      failureCode: "V3_PLAN_CLARIFICATION_REQUIRED",
    });
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
    const closedRunOwners = await database.sql<Array<{ state: string }>>`
      SELECT state
        FROM internal_production_owner_reservations_v1
       WHERE category = 'run' AND owner_key = ${runId}
    `;
    assert.deepEqual(closedRunOwners.map((row) => ({ ...row })), [{ state: "closed" }]);
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
