import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import postgres from "postgres";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { completeSingleStepClaimAndState } from "../../src/execution/claim-attempt-transition.js";
import { loadCompilerEnglishAdmissionLedgerAuthorityV1 } from "../../src/execution/compiler-english-admission-ledger-v1.js";
import {
  createCompilerStoryEnglishAdmissionClaimProofV1,
  loadCompilerStoryEnglishAdmissionLedgerAuthorityV1,
} from "../../src/execution/compiler-story-english-admission-ledger-v1.js";
import { publishCompilerStoryEnglishAdmissionAndCompleteV1 } from "../../src/execution/compiler-story-english-admission-publication-v1.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createV3RecoveryClaimAuthority } from "../../src/recovery/v3-recovery-claim-authority.js";
import { createV3RecoveryLifecycleReconciler } from "../../src/recovery/v3-recovery-lifecycle-reconciler.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
  publishLoopClaimRuntime,
  publishSingleClaimRuntime,
} from "../../src/execution/claim-runtime-publication.js";
import {
  beginOrAdoptInternalProductionOwnerReservationV1,
  bindInternalProductionOwnerReservationV1,
  createInternalProductionWorkflowRunCanonicalOwnerIdentityV1,
  type PgTransactionSql,
} from "../../src/db-pg.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import {
  createRuntimeSessionRepository,
  releaseDrainedRuntimeSessionInTransaction,
  releaseDrainedRuntimeSessionsInTransaction,
  releaseReservedRuntimeSessionInTransaction,
  releaseRuntimeSessionForTerminalRunInTransactionV1,
} from "../../src/execution/runtime-session-repository.js";
import {
  createRunTerminationRepository,
  requestRunTermination,
} from "../../src/execution/run-termination.js";
import { transitionRunToTerminal } from "../../src/execution/run-terminal-transition.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { buildV3AutoStoriesOutput } from "../../src/installer/steps/03-stories/preclaim.js";
import { designAuthoritySubjectHashV1 } from "../../src/installer/steps/03-stories/guards.js";
import {
  compileCompilerEnglishAdmissionV1,
  compilerEnglishAdmissionReceiptV1,
} from "../../src/product-compiler/compiler-english-admission-v1.js";
import {
  compileCompilerStoryEnglishAdmissionV1,
  compilerStoryEnglishAdmissionStateV1,
} from "../../src/product-compiler/compiler-story-english-admission-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { renderProductSpecV2Compatibility } from "../../src/product-compiler/renderers/product-spec-v2-compatibility.js";
import { HASH_A, HASH_B, HASH_C, HASH_D, SHA_A, TREE_A, exactProductReservation } from "./fixtures.js";
import {
  NODE_CLI_TASK,
  genuineNodeCliProductSpecV2,
} from "../product-compiler/fixtures/no-design-product-semantics-v2.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T12:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/runtime-absent"],
};

const COMPILER_ADMISSION_DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T09:59:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/runtime-session-repository-compiler-admission"],
};

async function runtimeOwnerState(
  database: TestDatabase,
  sessionId: string,
): Promise<string | undefined> {
  const rows = await database.sql<Array<{ state: string }>>`
    SELECT owner.state
      FROM internal_production_owner_reservations_v1 owner
     WHERE owner.category = 'runtime-session'
       AND owner.owner_key = ${sessionId}
  `;
  return rows[0]?.state;
}

async function bindTestRunOwner(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
): Promise<void> {
  await database.sql.begin(async (transaction) => {
    const identity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
    const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
      transaction as PgTransactionSql,
      { producerImplementationId: "a-runtime-run-v1", ownerKey: identity.ownerKey },
    );
    await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: identity,
    });
  });
}

async function insertOwnedClaim(
  database: TestDatabase,
  input: Readonly<{
    producerImplementationId: "a-claim-single-runtime-v1" | "a-claim-loop-runtime-v1";
    runId: string;
    workflowStepId: string;
    storyId: string | null;
    claimAgentId: string;
  }>,
): Promise<number> {
  return database.sql.begin(async (transaction) => {
    const idRows = await transaction.unsafe<Array<{ id: unknown }>>(
      "SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id",
    );
    const birth = await prepareInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      input.producerImplementationId,
      idRows,
    );
    return insertAndBindInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      birth,
      {
        runId: input.runId,
        workflowStepId: input.workflowStepId,
        storyId: input.storyId,
        claimAgentId: input.claimAgentId,
        claimedAt: new Date(),
      },
    );
  });
}

async function prepareCompilerAdmissionCompletion(
  database: TestDatabase,
  input: Readonly<{
    runId: string;
    stepDbId: string;
    workflowStepId: "plan" | "design" | "stories";
    output: string;
  }>,
) {
  const token = createHash("sha256")
    .update(`${input.runId}:${input.workflowStepId}`, "utf8")
    .digest("hex")
    .slice(0, 24);
  const claimAgentId = `feature-dev_${input.workflowStepId}`;
  const runtimeAgentId = `${input.workflowStepId}-fixture-runtime`;
  const ownerInstanceId = `${input.workflowStepId}-fixture-owner`;
  const claimId = await insertOwnedClaim(database, {
    producerImplementationId: "a-claim-single-runtime-v1",
    runId: input.runId,
    workflowStepId: input.workflowStepId,
    storyId: null,
    claimAgentId,
  });
  const sessions = createRuntimeSessionRepository(database.sql);
  const session = await sessions.reserve({
    sessionId: `RTS_${token}`,
    runId: input.runId,
    stepDbId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    claimId,
    claimAgentId,
    runtimeAgentId,
    runtimeKind: "openclaw_session",
    ownerInstanceId,
  });
  await sessions.markStarting({ sessionId: session.sessionId, ownerInstanceId });
  await sessions.markRunning({
    sessionId: session.sessionId,
    ownerInstanceId,
    sessionKey: `${input.workflowStepId}-fixture-session`,
  });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    protocol: "v3",
    issuedAt: "2026-07-13T09:58:00.000Z",
    stepId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    runId: input.runId,
    claimId,
    claimAgentId,
    runtimeAgentId,
    input: `Durable ${input.workflowStepId} compiler admission fixture`,
  };
  const requested = await requestRuntimeCompletion(database.sql, {
    envelope,
    output: input.output,
    requestId: `RCR_${token}`,
  });
  assert.equal(requested.status, "requested");
  if (requested.status !== "requested") {
    throw new Error("compiler admission completion request missing");
  }
  const completions = createRuntimeCompletionRepository(database.sql);
  await completions.claim({ requestId: requested.request.requestId, ownerInstanceId });
  await sessions.markDrained({
    sessionId: session.sessionId,
    ownerInstanceId,
    evidence: COMPILER_ADMISSION_DRAIN_EVIDENCE,
  });
  const processing = await completions.markProcessing({
    requestId: requested.request.requestId,
    ownerInstanceId,
  });
  if (!processing.ownerInstanceId || !processing.leaseExpiresAt) {
    throw new Error("compiler admission completion owner capability missing");
  }
  return {
    claimId,
    envelope,
    completions,
    processing,
    requestId: requested.request.requestId,
    ownerInstanceId,
  };
}

async function settleCompilerAdmissionCompletion(
  database: TestDatabase,
  managed: Awaited<ReturnType<typeof prepareCompilerAdmissionCompletion>>,
): Promise<void> {
  const effects = createRuntimeCompletionEffectRepository(database.sql);
  const effect = await effects.claimNext({
    requestId: managed.requestId,
    ownerInstanceId: managed.ownerInstanceId,
  });
  assert.ok(effect?.leaseToken);
  await effects.settle({
    requestId: managed.requestId,
    effectKey: effect.effectKey,
    ownerInstanceId: managed.ownerInstanceId,
    leaseToken: effect.leaseToken,
    resolution: "applied",
    result: { advanced: false, runCompleted: false },
    evidence: { source: "runtime-session-repository-compiler-admission-fixture" },
  });
  await managed.completions.markEffectsCommitted({
    requestId: managed.requestId,
    ownerInstanceId: managed.ownerInstanceId,
    ownerAttemptCount: managed.processing.ownerAttemptCount,
    result: { advanced: false, runCompleted: false },
  });
  await managed.completions.acceptAndRelease({
    requestId: managed.requestId,
    ownerInstanceId: managed.ownerInstanceId,
    ownerAttemptCount: managed.processing.ownerAttemptCount,
    result: { advanced: false, runCompleted: false },
  });
}

async function seedRecoveryStoryAdmissionAuthority(
  database: TestDatabase,
  runId: string,
) {
  const productSpec = genuineNodeCliProductSpecV2();
  const productSpecHash = hashCanonicalJson(productSpec);
  const renderedPlan = renderProductSpecV2Compatibility(productSpec);
  const prdMarker = "\nPRD:\n";
  const prdIndex = renderedPlan.indexOf(prdMarker);
  assert.ok(prdIndex > 0);
  const prd = renderedPlan.slice(prdIndex + prdMarker.length);
  const releaseSha = "d".repeat(40);
  const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
  const baseContext: Record<string, string> = {
    task: NODE_CLI_TASK,
    repo: `/tmp/${runId}`,
    prd,
    product_semantics_version: "v2",
    product_spec_schema: productSpec.schema,
    product_spec_hash: productSpecHash,
    product_spec_source_task_hash: productSpec.traceability.sourceTaskHash,
    ui_language: "English",
    project_name: productSpec.product.name,
    project_display_name: productSpec.product.name,
    project_slug: "task-cli",
    app_title: productSpec.product.name,
    ui_vision_summary: productSpec.delivery.uiVisionSummary,
    design_required: "false",
  };
  const planStepDbId = `${runId}-plan-step`;
  const designStepDbId = `${runId}-design-step`;
  const storiesStepDbId = `${runId}-stories-step`;
  const stepDbId = `${runId}-step`;
  const superviseStepDbId = `${runId}-supervise-step`;
  await database.sql`
    INSERT INTO runs (
      id, workflow_id, task, status, context, protocol, protocol_version,
      compiler_release_sha, packet_hash, activation_preflight_hash, release_admission_hash
    ) VALUES (
      ${runId}, 'feature-dev', ${NODE_CLI_TASK}, 'running', ${JSON.stringify(baseContext)},
      'v3', 1, ${releaseSha}, ${HASH_A}, ${"e".repeat(64)}, ${releaseAdmissionHash}
    )
  `;
  await bindTestRunOwner(database, runId);
  await database.sql`
    INSERT INTO steps (
      id, run_id, step_id, agent_id, step_index, input_template, expects,
      status, type, retry_count, max_retries
    ) VALUES (
      ${planStepDbId}, ${runId}, 'plan', 'feature-dev_planner', 1, '', '',
      'running', 'single', 0, 3
    ), (
      ${designStepDbId}, ${runId}, 'design', 'feature-dev_designer', 2, '', '',
      'waiting', 'single', 0, 3
    ), (
      ${storiesStepDbId}, ${runId}, 'stories', 'feature-dev_story-planner', 3, '', '',
      'waiting', 'single', 0, 3
    ), (
      ${stepDbId}, ${runId}, 'implement', 'feature-dev_developer', 4, '', '',
      'pending', 'loop', 0, 3
    ), (
      ${superviseStepDbId}, ${runId}, 'supervise', 'feature-dev_supervisor', 5, '', '',
      'waiting', 'single', 0, 3
    )
  `;
  await database.sql`
    UPDATE steps
       SET loop_config = ${JSON.stringify({ superviseEach: true, superviseStep: "supervise" })}
     WHERE id = ${stepDbId}
  `;

  const managedPlan = await prepareCompilerAdmissionCompletion(database, {
    runId,
    stepDbId: planStepDbId,
    workflowStepId: "plan",
    output: "STATUS: done",
  });
  const planAuthority = compileCompilerEnglishAdmissionV1({
    claimId: managedPlan.claimId,
    runId,
    stepDbId: planStepDbId,
    workflowStepId: "plan",
    productSpec,
    finalContext: baseContext,
  });
  const planReceipt = compilerEnglishAdmissionReceiptV1(planAuthority);
  const planContext = {
    ...baseContext,
    plan_english_authority_version: planReceipt.authorityVersion,
    plan_english_admission_receipt_hash: planAuthority.receiptHash,
  };
  await runWithRuntimeCompletionOwner({
    requestId: managedPlan.processing.requestId,
    ownerInstanceId: managedPlan.processing.ownerInstanceId!,
    leaseExpiresAt: managedPlan.processing.leaseExpiresAt!,
    ownerAttemptCount: managedPlan.processing.ownerAttemptCount,
  }, () => completeSingleStepClaimAndState(database.sql, {
    envelope: managedPlan.envelope,
    stepStatus: "done",
    stepOutput: "STATUS: done",
    runContextJson: JSON.stringify(planContext),
    expectedRunContextJson: JSON.stringify(baseContext),
    requireRuntimeCompletionOwner: true,
    completionPlan: createSingleEffectCompletionPlanDescriptorV1({
      kind: "single_completion",
      continuation: { type: "single_pipeline_advance" },
      effectPayload: { stepId: "plan", compilerEnglishAdmissionReceipt: planReceipt },
    }),
  }));
  await settleCompilerAdmissionCompletion(database, managedPlan);
  const durablePlanAuthority = await loadCompilerEnglishAdmissionLedgerAuthorityV1(
    database.sql,
    { runId },
  );

  const designOutput = [
    "STATUS: done",
    "DESIGN_REQUIRED: false",
    "DEVICE_TYPE: NONE",
    "DESIGN_SYSTEM: {}",
    "SCREEN_MAP: []",
    "SCREENS_GENERATED: 0",
    "AUTO_COMPLETED: design-bypass (DESIGN_REQUIRED=false)",
  ].join("\n");
  const designContext = {
    ...planContext,
    screen_map: "[]",
    screens_generated: "0",
    design_system: "{}",
  };
  await database.sql`UPDATE steps SET status = 'running' WHERE id = ${designStepDbId}`;
  const managedDesign = await prepareCompilerAdmissionCompletion(database, {
    runId,
    stepDbId: designStepDbId,
    workflowStepId: "design",
    output: designOutput,
  });
  await runWithRuntimeCompletionOwner({
    requestId: managedDesign.processing.requestId,
    ownerInstanceId: managedDesign.processing.ownerInstanceId!,
    leaseExpiresAt: managedDesign.processing.leaseExpiresAt!,
    ownerAttemptCount: managedDesign.processing.ownerAttemptCount,
  }, () => completeSingleStepClaimAndState(database.sql, {
    envelope: managedDesign.envelope,
    stepStatus: "done",
    stepOutput: designOutput,
    runContextJson: JSON.stringify(designContext),
    expectedRunContextJson: JSON.stringify(planContext),
    requireRuntimeCompletionOwner: true,
    completionPlan: createSingleEffectCompletionPlanDescriptorV1({
      kind: "single_completion",
      continuation: { type: "single_pipeline_advance" },
      effectPayload: { stepId: "design" },
    }),
  }));
  await settleCompilerAdmissionCompletion(database, managedDesign);

  const storiesOutput = buildV3AutoStoriesOutput({
    repo: baseContext.repo,
    prd,
    expectedProductSpecHash: productSpecHash,
    productSemanticsVersion: "v2",
  });
  const screenMapLine = storiesOutput.split("\n").find((line) => line.startsWith("SCREEN_MAP: "));
  assert.ok(screenMapLine);
  const storiesContext = {
    ...designContext,
    screen_map: screenMapLine.slice("SCREEN_MAP: ".length),
  };
  await database.sql`
    UPDATE runs SET context = ${JSON.stringify(storiesContext)} WHERE id = ${runId}
  `;
  await database.sql`UPDATE steps SET status = 'running' WHERE id = ${storiesStepDbId}`;
  const managedStories = await prepareCompilerAdmissionCompletion(database, {
    runId,
    stepDbId: storiesStepDbId,
    workflowStepId: "stories",
    output: storiesOutput,
  });
  const designAuthorityHash = await designAuthoritySubjectHashV1(
    database.sql,
    runId,
    storiesContext,
    productSpecHash,
    false,
  );
  const storiesAuthority = compileCompilerStoryEnglishAdmissionV1({
    claimId: managedStories.claimId,
    runId,
    stepDbId: storiesStepDbId,
    workflowStepId: "stories",
    planAuthority: durablePlanAuthority,
    designAuthoritySubjectHash: designAuthorityHash,
    rawOutput: storiesOutput,
    expectedOutput: storiesOutput,
    finalContext: storiesContext,
  });
  const storiesReceipt = compilerStoryEnglishAdmissionStateV1(storiesAuthority).receipt;
  const admittedContext = {
    ...storiesContext,
    stories_english_authority_version: storiesReceipt.authorityVersion,
    stories_english_admission_receipt_hash: storiesAuthority.receiptHash,
  };
  await runWithRuntimeCompletionOwner({
    requestId: managedStories.processing.requestId,
    ownerInstanceId: managedStories.processing.ownerInstanceId!,
    leaseExpiresAt: managedStories.processing.leaseExpiresAt!,
    ownerAttemptCount: managedStories.processing.ownerAttemptCount,
  }, () => publishCompilerStoryEnglishAdmissionAndCompleteV1(database.sql, {
    authority: storiesAuthority,
    completion: {
      envelope: managedStories.envelope,
      stepStatus: "done",
      stepOutput: storiesOutput,
      runContextJson: JSON.stringify(admittedContext),
      expectedRunContextJson: JSON.stringify(storiesContext),
      requireRuntimeCompletionOwner: true,
      completionPlan: createSingleEffectCompletionPlanDescriptorV1({
        kind: "single_completion",
        continuation: { type: "single_pipeline_advance" },
        effectPayload: {
          stepId: "stories",
          compilerStoryEnglishAdmissionReceipt: storiesReceipt,
        },
      }),
    },
  }));
  await settleCompilerAdmissionCompletion(database, managedStories);
  const durableStoryAuthority = await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(
    database.sql,
    { runId },
  );
  const storyRows = await database.sql<Array<{ id: string; story_id: string }>>`
    SELECT id, story_id
      FROM stories
     WHERE run_id = ${runId}
     ORDER BY story_index, story_id
  `;
  assert.equal(storyRows.length, 1);
  assert.equal(storyRows[0]?.story_id, "US-001");
  return Object.freeze({
    stepDbId,
    storyDbId: storyRows[0]!.id,
    storyId: storyRows[0]!.story_id,
    storyAdmissionProof: createCompilerStoryEnglishAdmissionClaimProofV1(
      durableStoryAuthority,
    ),
  });
}

async function seedStory(database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>, runId: string) {
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
  const claimId = await insertOwnedClaim(database, {
    producerImplementationId: "a-claim-loop-runtime-v1",
    runId,
    workflowStepId: "implement",
    storyId: "US-001",
    claimAgentId: "feature-dev_developer",
  });
  return { stepDbId, storyDbId, claimId };
}

async function seedPreAttemptRecoveryRuntime(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{ runId: string; leaseMs?: number; sessionId?: string }>,
) {
  const admission = await seedRecoveryStoryAdmissionAuthority(database, input.runId);
  const {
    storyId,
    storyDbId,
    stepDbId,
    storyAdmissionProof,
  } = admission;
  await database.sql`
    UPDATE steps SET status = 'running', current_story_id = NULL WHERE id = ${stepDbId}
  `;
  await database.sql`
    UPDATE stories
       SET status = 'failed', claimed_by = NULL, claimed_at = NULL,
           claim_generation = 0, updated_at = NOW()
     WHERE id = ${storyDbId}
  `;

  const findingSet = createFindingSetV1({
    runId: input.runId,
    storyId,
    packetHash: HASH_A,
    sliceHash: HASH_C,
    sourceRevision: { sha: SHA_A, treeHash: TREE_A },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_RUNTIME_START",
      sourceLocators: [{ path: "src/App.tsx", contentHash: HASH_D }],
      observedEvidenceRefs: [HASH_B],
      expectedPredicateRef: "EVID_RUNTIME_START",
      status: "open",
    }],
  });
  const draft: RecoveryCaseDraftV1 = {
    runId: input.runId,
    storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: HASH_A,
    sliceHash: HASH_C,
    sourceRevision: findingSet.sourceRevision,
    owner: "implement",
    expectedDelta: {
      kind: "source_change",
      invariantRefs: ["INV_RUNTIME_START"],
      requiredPaths: ["src/App.tsx"],
    },
    allowedPaths: ["src/App.tsx"],
    evidencePlan: ["EVID_RUNTIME_START"],
    priorAttemptRefs: [],
    budget: {
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  };
  const findings = createFindingRecoveryRepository(database.sql);
  await findings.putFindingSet(findingSet);
  const opened = await findings.openRecoveryCase(draft);
  const deliveries = createRecoveryDeliveryRepository(database.sql);
  const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
  assert.ok(revision);
  const authorization = await deliveries.authorizeCurrentRevision({
    recoveryCaseId: opened.recoveryCase.recoveryCaseId,
    revisionId: revision.revisionId,
    expectedStateVersion: opened.recoveryCase.stateVersion,
    dispatchClass: "product_implementation",
  });
  assert.equal(authorization.status, "authorized");
  if (authorization.status !== "authorized") throw new Error("test recovery authorization failed");
  const handoff = await createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
    runId: input.runId,
    storyId,
    ownerInstanceId: "spawner-recovery",
    leaseMs: input.leaseMs ?? 60_000,
  });

  const runtimeOwnerInstanceId = handoff.lease.ownerInstanceId;
  const publication = await publishLoopClaimRuntime(database.sql, {
    runId: input.runId,
    stepDbId,
    workflowStepId: "implement",
    storyDbId,
    storyId,
    claimAgentId: "feature-dev_developer",
    parallelLimit: 1,
    runtimeIntent: {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: input.sessionId ?? "RTS_recovery-runtime-0001",
      runtimeAgentId: "prism",
      runtimeKind: "openclaw_session",
      ownerInstanceId: runtimeOwnerInstanceId,
    },
    recoveryHandoff: handoff,
    storyAdmissionProof,
  });
  assert.equal(publication?.claimAuthority?.mode, "recovery");
  assert.ok(publication?.runtime);
  const sessions = createRuntimeSessionRepository(database.sql);
  const session = await sessions.findById(publication.runtime.sessionId);
  assert.ok(session);
  return {
    sessions,
    session,
    publication,
    findingSet,
    deliveries,
    handoff,
    storyId,
    storyDbId,
    stepDbId,
  };
}

async function seedAttemptBoundRecoveryRuntime(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{ runId: string; runtimeOwnerInstanceId?: string }>,
) {
  const preAttempt = await seedPreAttemptRecoveryRuntime(database, input);
  const { publication, findingSet, handoff, storyId } = preAttempt;
  const claimId = publication.claimId;
  const attempt = await createAttemptRepository(database.sql, {
    attemptId: () => "ATT_recovery-runtime-0001",
    fenceToken: () => "f".repeat(64),
  }).reserve(exactProductReservation({
    claimId,
    runId: input.runId,
    storyId,
    agentId: "feature-dev_developer",
    packetHash: HASH_A,
    compilationReportHash: HASH_B,
    sliceHash: HASH_C,
    sourceBefore: findingSet.sourceRevision,
    findingSetHash: findingSet.findingSetHash,
    recoveryCaseRevisionId: handoff.revisionId,
    recoveryDispatchId: handoff.dispatchId,
    recoveryDeliveryLease: {
      ownerInstanceId: handoff.lease.ownerInstanceId,
      leaseToken: handoff.lease.leaseToken,
    },
    evidenceRefs: [`setfarm://claim-log/${claimId}`],
  }));
  assert.equal(attempt.status, "reserved");
  const { sessions } = preAttempt;
  await sessions.bindAttempt({
    sessionId: publication.runtime.sessionId,
    attemptId: attempt.attempt.attemptId,
    ownerInstanceId: publication.runtime.ownerInstanceId,
  });
  if (
    input.runtimeOwnerInstanceId
    && input.runtimeOwnerInstanceId !== publication.runtime.ownerInstanceId
  ) {
    await database.sql`
      UPDATE runtime_sessions SET owner_instance_id=${input.runtimeOwnerInstanceId}
       WHERE session_id=${publication.runtime.sessionId}
    `;
  }
  const session = await sessions.findById(publication.runtime.sessionId);
  assert.ok(session);
  const recoveryFence = {
    revisionId: handoff.revisionId,
    dispatchId: handoff.dispatchId,
    leaseToken: handoff.lease.leaseToken,
    attempt: {
      attemptId: attempt.attempt.attemptId,
      generation: attempt.attempt.generation,
      fenceToken: attempt.attempt.fenceToken,
    },
  };
  return {
    ...preAttempt,
    session,
    attempt,
    recoveryFence,
  };
}

describe("durable runtime session ownership", () => {
  it("serializes pre-attempt expiry with compound failure in both constructible lock orders", async () => {
    for (const ordering of ["expiry-first", "termination-first"] as const) {
      const database = await createIsolatedTestDatabase();
      try {
        const runId = `run-pre-attempt-${ordering}`;
        const fixture = await seedPreAttemptRecoveryRuntime(database, {
          runId,
          leaseMs: 10_000,
          sessionId: `RTS_pre-attempt-${ordering}`,
        });
        const publicationBefore = await database.sql<Array<{
          handoff_canonical_json: string;
          handoff_hash: string;
        }>>`
          SELECT handoff_canonical_json,handoff_hash
            FROM internal_production_v3_recovery_claim_publications_v1
           WHERE claim_id=${fixture.publication.claimId}
        `;
        const state = async () => (await database.sql<Array<{
          run_status: string;
          claim_outcome: string | null;
          runtime_state: string;
          runtime_attempt_id: string | null;
          claim_owner_state: string;
          runtime_owner_state: string;
          delivery_state: string;
          case_status: string;
        }>>`
          SELECT run.status AS run_status,claim.outcome AS claim_outcome,
                 runtime.state AS runtime_state,runtime.attempt_id AS runtime_attempt_id,
                 claim_owner.state AS claim_owner_state,
                 runtime_owner.state AS runtime_owner_state,
                 delivery.state AS delivery_state,recovery_case.status AS case_status
            FROM runs run
            JOIN claim_log claim ON claim.run_id=run.id
            JOIN runtime_sessions runtime ON runtime.claim_id=claim.id
            JOIN internal_production_owner_reservations_v1 claim_owner
              ON claim_owner.category='claim' AND claim_owner.owner_key=claim.id::text
            JOIN internal_production_owner_reservations_v1 runtime_owner
              ON runtime_owner.category='runtime-session' AND runtime_owner.owner_key=runtime.session_id
            JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id=${fixture.handoff.dispatchId}
            JOIN recovery_cases recovery_case ON recovery_case.recovery_case_id=delivery.recovery_case_id
           WHERE run.id=${runId}
        `)[0]!;
        const pristine = { ...await state() };

        if (ordering === "expiry-first") {
          await assert.rejects(
            transitionRunToTerminal(database.sql, {
              runId,
              status: "failed",
              diagnostic: "compound cannot invent pre-attempt drain proof",
            }),
            /RUN_TERMINAL_FAIL_DRAIN_PROOF_REQUIRED/,
          );
          assert.deepEqual({ ...await state() }, pristine);
          await database.sql.unsafe(
            `SELECT pg_sleep(GREATEST(
               EXTRACT(EPOCH FROM (
                 (SELECT lease_expires_at FROM recovery_dispatch_deliveries WHERE dispatch_id=$1)
                 - clock_timestamp()
               )) + 0.05,
               0
             ))`,
            [fixture.handoff.dispatchId],
          );
          const report = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive({ runId });
          assert.equal(report.counts.rolledBackPublications, 1, JSON.stringify(report.events));
          assert.deepEqual({ ...await state() }, {
            run_status: "running",
            claim_outcome: "infra_retry",
            runtime_state: "released",
            runtime_attempt_id: null,
            claim_owner_state: "closed",
            runtime_owner_state: "closed",
            delivery_state: "blocked",
            case_status: "blocked",
          });
          const headBeforeReplay = (await database.sql<Array<{ head_version: string }>>`
            SELECT head_version::text FROM internal_production_owner_admission_head_v1 WHERE singleton
          `)[0]!.head_version;
          const replay = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive({ runId });
          assert.equal(replay.counts.scanned, 0);
          assert.equal((await database.sql<Array<{ head_version: string }>>`
            SELECT head_version::text FROM internal_production_owner_admission_head_v1 WHERE singleton
          `)[0]!.head_version, headBeforeReplay);
        } else {
          const requested = await requestRunTermination(database.sql, {
            runId,
            targetStatus: "failed",
            requestedBy: "task6-pre-attempt-race",
            diagnostic: "termination fences pre-attempt expiry",
            requestId: "RTR_pre-attempt-termination-first",
          });
          assert.equal(requested.status, "requested");
          const beforeReport = { ...await state() };
          const report = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive({ runId });
          assert.ok(
            report.events.some((event) => (
              event.code === "V3_RECOVERY_LIFECYCLE_TERMINATION_PENDING"
              || event.code === "V3_RECOVERY_LIFECYCLE_RUN_NOT_ACTIVE"
            )),
            JSON.stringify(report.events),
          );
          assert.deepEqual({ ...await state() }, beforeReport);
        }

        assert.deepEqual(await database.sql<Array<{
          handoff_canonical_json: string;
          handoff_hash: string;
        }>>`
          SELECT handoff_canonical_json,handoff_hash
            FROM internal_production_v3_recovery_claim_publications_v1
           WHERE claim_id=${fixture.publication.claimId}
        `, publicationBefore, "expiry/termination ordering cannot rewrite the immutable publication");

        const requested = await requestRunTermination(database.sql, {
          runId,
          targetStatus: "failed",
          requestedBy: "task6-pre-attempt-race",
          diagnostic: ordering === "termination-first"
            ? "termination fences pre-attempt expiry"
            : "later exact compound adoption",
          requestId: ordering === "expiry-first"
            ? "RTR_pre-attempt-expiry-first"
            : "RTR_pre-attempt-termination-first",
        });
        assert.ok(requested.status === "requested" || requested.status === "existing");
        if (requested.status === "already_terminal") throw new Error("termination request missing");
        const terminations = createRunTerminationRepository(database.sql);
        const claimed = await terminations.claim({
          requestId: requested.request.requestId,
          ownerInstanceId: `task6-${ordering}`,
        });
        assert.ok(claimed?.ownerInstanceId);
        const runtime = await fixture.sessions.findById(fixture.session.sessionId);
        assert.ok(runtime);
        if (runtime.state === "drain_requested") {
          await fixture.sessions.markDrained({
            sessionId: runtime.sessionId,
            ownerInstanceId: runtime.ownerInstanceId,
            evidence: DRAIN_EVIDENCE,
          });
        }
        await terminations.markDrained({
          requestId: requested.request.requestId,
          ownerInstanceId: claimed!.ownerInstanceId!,
          evidence: { proofRef: `setfarm://test/pre-attempt/${ordering}` },
        });
        const terminal = await terminations.terminalize({ requestId: requested.request.requestId });
        assert.equal(terminal.status, "failed");
        assert.equal((await terminations.terminalize({ requestId: requested.request.requestId })).status, "failed");
      } finally {
        await database.cleanup();
      }
    }
  });

  it("adopts a committed reservation with its original birth timestamps and token", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-reserve-response-loss";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const input = {
        sessionId: "RTS_runtime-reserve-response-loss",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session" as const,
        ownerInstanceId: "spawner-response-loss",
        sessionKey: "stable-original-session-token",
      };
      const committed = await sessions.reserve(input);
      const replay = await sessions.reserve(input);
      assert.deepEqual(replay, committed);
    } finally {
      await database.cleanup();
    }
  });

  it("orders committed session adoption before an exact quarantine close", async () => {
    const database = await createIsolatedTestDatabase();
    const blocker = postgres(database.url, { max: 1 });
    try {
      const runId = "run-runtime-adoption-close-order";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const input = {
        sessionId: "RTS_runtime-adoption-close-order",
        runId, stepDbId, workflowStepId: "implement", storyDbId, storyId: "US-001",
        claimId, claimAgentId: "feature-dev_developer", runtimeAgentId: "prism",
        runtimeKind: "openclaw_session" as const, ownerInstanceId: "spawner-order",
        sessionKey: "stable-session-order-token",
      };
      const committed = await sessions.reserve(input);
      await database.sql.unsafe("CREATE SEQUENCE runtime_adoption_close_latch_v1");
      await database.sql.unsafe(`
        CREATE FUNCTION runtime_adoption_close_latch_v1() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.session_id='RTS_runtime-adoption-close-order' THEN
            PERFORM nextval('runtime_adoption_close_latch_v1');
            PERFORM pg_advisory_xact_lock(730032);
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER runtime_adoption_close_latch_v1 BEFORE INSERT ON runtime_sessions
        FOR EACH ROW EXECUTE FUNCTION runtime_adoption_close_latch_v1()
      `);
      let release!: () => void;
      const mayRelease = new Promise<void>((resolve) => { release = resolve; });
      let locked!: () => void;
      const blockerReady = new Promise<void>((resolve) => { locked = resolve; });
      const held = blocker.begin(async (sql) => {
        await sql.unsafe("SELECT pg_advisory_xact_lock(730032)");
        locked();
        await mayRelease;
      });
      await blockerReady;
      const replay = sessions.reserve(input);
      for (;;) {
        const latch = await database.sql<Array<{ is_called: boolean }>>`
          SELECT is_called FROM runtime_adoption_close_latch_v1
        `;
        if (latch[0]?.is_called) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const quarantine = sessions.quarantine({
        sessionId: committed.sessionId,
        expectedOwnerInstanceId: committed.ownerInstanceId,
        expectedStateVersion: committed.stateVersion,
        diagnostic: "adoption versus quarantine close",
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      await held;
      assert.deepEqual(await replay, committed);
      const closed = await quarantine;
      assert.equal(closed.state, "quarantined");
      assert.equal(await runtimeOwnerState(database, committed.sessionId), "closed");
    } finally {
      await blocker.end({ timeout: 5 });
      await database.cleanup();
    }
  });

  it("tracks reserve, attempt binding, start, drain, and release behind exact owners", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-session";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const attempts = createAttemptRepository(database.sql, {
        attemptId: () => "ATT_runtime-session-0001",
        fenceToken: () => "f".repeat(64),
      });
      const reservedAttempt = await attempts.reserve(exactProductReservation({
        claimId,
        runId,
        storyId: "US-001",
        agentId: "feature-dev_developer",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }));
      const sessions = createRuntimeSessionRepository(database.sql);
      const session = await sessions.reserve({
        sessionId: "RTS_runtime-session-0001",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-a",
        worktree: ".worktrees/us-001",
        now: new Date("2099-01-01T00:00:00.000Z"),
      });
      assert.equal(session.state, "reserved");
      assert.equal(session.attemptId, undefined);
      assert.ok(new Date(session.updatedAt).getUTCFullYear() < 2099);
      const bound = await sessions.bindAttempt({
        sessionId: session.sessionId,
        attemptId: reservedAttempt.attempt.attemptId,
        ownerInstanceId: "spawner-a",
      });
      assert.equal(bound.attemptId, "ATT_runtime-session-0001");
      const starting = await sessions.markStarting({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-a",
        sessionKey: "openclaw-key-starting",
        worktree: ".worktrees/us-001-exact",
        runtimePath: "/tmp/runtime-us-001",
        transcriptPath: "/tmp/runtime-us-001.jsonl",
        now: new Date("2099-01-01T00:00:01.000Z"),
      });
      assert.equal(starting.state, "starting");
      assert.equal(starting.sessionKey, "openclaw-key-starting");
      assert.equal(starting.worktree, ".worktrees/us-001-exact");
      assert.equal(starting.runtimePath, "/tmp/runtime-us-001");
      assert.equal(starting.transcriptPath, "/tmp/runtime-us-001.jsonl");
      assert.ok(new Date(starting.updatedAt).getUTCFullYear() < 2099);
      await assert.rejects(
        sessions.markRunning({
          sessionId: session.sessionId,
          ownerInstanceId: "spawner-a",
          pid: 1234,
          sessionKey: "openclaw-key",
        }),
        /RUNTIME_SESSION_PROCESS_IDENTITY_REQUIRED/,
      );
      assert.equal((await sessions.findById(session.sessionId))?.state, "starting");
      const processIdentity = {
        schema: "setfarm.process-identity.v1" as const,
        pid: 1234,
        processStartedAt: "2026-07-13T12:00:00.000Z",
        processGroupId: 1234,
        source: "observed_os" as const,
      };
      const running = await sessions.markRunning({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-a",
        pid: 1234,
        sessionKey: "openclaw-key",
        processIdentity,
        now: new Date("2099-01-01T00:00:02.000Z"),
      });
      assert.equal(running.status, "running");
      assert.equal(running.session.pid, 1234);
      assert.deepEqual(running.session.processIdentity, processIdentity);
      assert.equal(running.session.processGroupId, 1234);
      assert.ok(new Date(running.session.updatedAt).getUTCFullYear() < 2099);
      const runningAttempt = await attempts.findById(reservedAttempt.attempt.attemptId);
      assert.equal(
        runningAttempt?.disposition,
        "running",
        "the runtime and its exact compiler attempt must publish running in one transaction",
      );
      await assert.rejects(
        sessions.requestDrain({
          sessionId: session.sessionId,
          ownerInstanceId: "spawner-b",
          diagnostic: "wrong owner",
        }),
        /RUNTIME_SESSION_DRAIN_REQUEST_FAILED/,
      );
      assert.equal((await sessions.requestDrain({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-a",
        diagnostic: "shutdown",
        now: new Date("2099-01-01T00:00:03.000Z"),
      })).state, "drain_requested");
      await assert.rejects(
        sessions.markDrained({
          sessionId: session.sessionId,
          ownerInstanceId: "spawner-a",
          evidence: { ...DRAIN_EVIDENCE, localProcessAbsent: false },
        }),
      );
      await assert.rejects(
        sessions.markDrained({
          sessionId: session.sessionId,
          ownerInstanceId: "spawner-b",
          evidence: DRAIN_EVIDENCE,
        }),
        /RUNTIME_SESSION_DRAIN_CAS_LOST/,
      );
      const firstDrained = await sessions.markDrained({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-a",
        evidence: DRAIN_EVIDENCE,
        now: new Date("2099-01-01T00:00:04.000Z"),
      });
      assert.equal(firstDrained.state, "drained");
      assert.equal(await runtimeOwnerState(database, session.sessionId), "bound");
      assert.ok(new Date(firstDrained.updatedAt).getUTCFullYear() < 2099);
      const reusedDrainProof = await sessions.markDrained({
        sessionId: session.sessionId,
        ownerInstanceId: "spawner-b",
        evidence: {
          ...DRAIN_EVIDENCE,
          observedAt: "2026-07-13T12:00:01.000Z",
          evidenceRefs: ["setfarm://test/second-recovery-intent"],
        },
      });
      assert.equal(reusedDrainProof.state, "drained");
      assert.equal(
        reusedDrainProof.drainedAt,
        firstDrained.drainedAt,
        "a later completion/cancellation intent must reuse the already-proven drain boundary",
      );
      assert.deepEqual(
        reusedDrainProof.drainEvidence,
        firstDrained.drainEvidence,
        "idempotent drain adoption must not overwrite the canonical proof that won the first transition",
      );
      await assert.rejects(
        database.sql.begin((transaction) => releaseDrainedRuntimeSessionsInTransaction(
          transaction,
          { runId },
        )),
        /RUNTIME_SESSION_RELEASE_OWNER_ACTIVE/,
      );
      await database.sql`UPDATE execution_attempts SET disposition = 'inconclusive' WHERE attempt_id = 'ATT_runtime-session-0001'`;
      await database.sql`UPDATE claim_log SET outcome = 'infra_retry' WHERE id = ${claimId}`;
      assert.equal((await database.sql.begin((transaction) => releaseDrainedRuntimeSessionInTransaction(
        transaction,
        {
          sessionId: session.sessionId,
          claimId,
          ownerInstanceId: "spawner-a",
          now: new Date("2099-01-01T00:00:05.000Z"),
        },
      ))).state, "released");
      assert.equal(await runtimeOwnerState(database, session.sessionId), "closed");
      assert.equal(await database.sql.begin((transaction) => releaseDrainedRuntimeSessionsInTransaction(
        transaction,
        { runId },
      )), 0);
      assert.equal((await sessions.findById(session.sessionId))?.state, "released");
    } finally {
      await database.cleanup();
    }
  });

  it("rejects mismatched and duplicate claim capabilities", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-session-binding";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const base = {
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session" as const,
        ownerInstanceId: "spawner-a",
      };
      await assert.rejects(
        sessions.reserve({ ...base, sessionId: "RTS_runtime-session-bad01", storyId: "US-WRONG" }),
        /RUNTIME_SESSION_CLAIM_IDENTITY_MISMATCH/,
      );
      await sessions.reserve({ ...base, sessionId: "RTS_runtime-session-good1" });
      await assert.rejects(
        sessions.reserve({ ...base, sessionId: "RTS_runtime-session-good2" }),
        /duplicate key value|unique constraint/i,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("releases and closes every exact locked drained owner in the bulk path", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-bulk-release";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const session = await sessions.reserve({
        sessionId: "RTS_runtime-bulk-release1",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-bulk",
      });
      await sessions.markStarting({
        sessionId: session.sessionId,
        ownerInstanceId: session.ownerInstanceId,
      });
      await sessions.requestDrain({
        sessionId: session.sessionId,
        ownerInstanceId: session.ownerInstanceId,
        diagnostic: "bulk release fixture drain",
      });
      await sessions.markDrained({
        sessionId: session.sessionId,
        ownerInstanceId: session.ownerInstanceId,
        evidence: DRAIN_EVIDENCE,
      });
      await database.sql`UPDATE claim_log SET outcome='infra_retry' WHERE id=${claimId}`;
      assert.equal(await database.sql.begin((transaction) => releaseDrainedRuntimeSessionsInTransaction(
        transaction,
        { runId },
      )), 1);
      assert.equal((await sessions.findById(session.sessionId))?.state, "released");
      assert.equal(await runtimeOwnerState(database, session.sessionId), "closed");
    } finally {
      await database.cleanup();
    }
  });

  it("keeps a compound-terminal runtime owner bound until the later close-all phase", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-compound-phase-barrier";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const session = await sessions.reserve({
        sessionId: "RTS_runtime-compound-barrier1",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-compound-barrier",
      });
      await sessions.markStarting({
        sessionId: session.sessionId,
        ownerInstanceId: session.ownerInstanceId,
      });
      await sessions.requestDrain({
        sessionId: session.sessionId,
        ownerInstanceId: session.ownerInstanceId,
        diagnostic: "compound barrier drain",
      });
      await sessions.markDrained({
        sessionId: session.sessionId,
        ownerInstanceId: session.ownerInstanceId,
        evidence: DRAIN_EVIDENCE,
      });

      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await releaseRuntimeSessionForTerminalRunInTransactionV1(transaction, {
            sessionId: session.sessionId,
            runId,
            transitionTime: new Date("2026-08-23T00:00:00.000Z"),
          });
          const inside = await transaction.unsafe<Array<{ runtime_state: string; owner_state: string }>>(
            `SELECT runtime.state AS runtime_state,owner.state AS owner_state
               FROM runtime_sessions runtime
               JOIN internal_production_owner_reservations_v1 owner
                 ON owner.category='runtime-session' AND owner.owner_key=runtime.session_id
              WHERE runtime.session_id=$1`,
            [session.sessionId],
          );
          assert.deepEqual({ ...inside[0] }, { runtime_state: "released", owner_state: "bound" });
          throw new Error("TEST_TASK6_AFTER_RUNTIME_MUTATION");
        }),
        /TEST_TASK6_AFTER_RUNTIME_MUTATION/,
      );
      assert.equal((await sessions.findById(session.sessionId))?.state, "drained");
      assert.equal(await runtimeOwnerState(database, session.sessionId), "bound");
    } finally {
      await database.cleanup();
    }
  });

  it("orders and serializes concurrent bulk release across multiple owners", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-bulk-release-multiple";
      await database.insertRun(runId);
      const publications = [];
      for (const [ordinal, workflowStepId] of [[1, "plan"], [2, "stories"]] as const) {
        const stepDbId = `${runId}-${workflowStepId}-step`;
        await database.sql`
          INSERT INTO steps (id,run_id,step_id,agent_id,step_index,input_template,expects,status)
          VALUES (${stepDbId},${runId},${workflowStepId},'feature-dev_planner',${ordinal},'','','pending')
        `;
        const publication = await publishSingleClaimRuntime(database.sql, {
          runId, stepDbId, workflowStepId, claimAgentId: "feature-dev_planner",
          runtimeIntent: {
            schema: "setfarm.runtime-claim-intent.v1",
            sessionId: `RTS_bulk-multiple-${workflowStepId}`,
            runtimeAgentId: "prism", runtimeKind: "openclaw_session",
            ownerInstanceId: "spawner-bulk-multiple",
            sessionKey: `token-${workflowStepId}`,
          },
        });
        assert.ok(publication?.runtime);
        publications.push(publication!);
      }
      const sessions = createRuntimeSessionRepository(database.sql);
      for (const publication of publications) {
        await sessions.markStarting({
          sessionId: publication.runtime!.sessionId,
          ownerInstanceId: publication.runtime!.ownerInstanceId,
        });
        await sessions.requestDrain({
          sessionId: publication.runtime!.sessionId,
          ownerInstanceId: publication.runtime!.ownerInstanceId,
          diagnostic: "multi-owner bulk drain",
        });
        await sessions.markDrained({
          sessionId: publication.runtime!.sessionId,
          ownerInstanceId: publication.runtime!.ownerInstanceId,
          evidence: DRAIN_EVIDENCE,
        });
        await database.sql`UPDATE claim_log SET outcome='infra_retry' WHERE id=${publication.claimId}`;
      }
      const released = await Promise.all([
        database.sql.begin((sql) => releaseDrainedRuntimeSessionsInTransaction(sql, { runId })),
        database.sql.begin((sql) => releaseDrainedRuntimeSessionsInTransaction(sql, { runId })),
      ]);
      assert.deepEqual([...released].sort((a, b) => a - b), [0, 2]);
      const rows = await database.sql<Array<{ session_id: string; state: string; owner_state: string }>>`
        SELECT rs.session_id,rs.state,r.state AS owner_state FROM runtime_sessions rs
          JOIN internal_production_owner_reservations_v1 r
            ON r.category='runtime-session' AND r.owner_key=rs.session_id
         WHERE rs.run_id=${runId} ORDER BY rs.session_id
      `;
      assert.deepEqual(rows.map((row) => ({ ...row })), [
        { session_id: "RTS_bulk-multiple-plan", state: "released", owner_state: "closed" },
        { session_id: "RTS_bulk-multiple-stories", state: "released", owner_state: "closed" },
      ]);
    } finally {
      await database.cleanup();
    }
  });

  it("serializes concurrent reserved release and quarantine to one closed owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-release-quarantine-race";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const session = await sessions.reserve({
        sessionId: "RTS_release-quarantine-race1",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-race",
      });
      await database.sql`UPDATE claim_log SET outcome='infra_retry' WHERE id=${claimId}`;
      const [release, quarantine] = await Promise.allSettled([
        database.sql.begin((transaction) => releaseReservedRuntimeSessionInTransaction(
          transaction,
          {
            sessionId: session.sessionId,
            claimId,
            ownerInstanceId: session.ownerInstanceId,
            diagnostic: "concurrent no-spawn release",
          },
        )),
        sessions.quarantine({
          sessionId: session.sessionId,
          expectedOwnerInstanceId: session.ownerInstanceId,
          expectedStateVersion: session.stateVersion,
          diagnostic: "concurrent uncertainty quarantine",
        }),
      ]);
      assert.equal(quarantine.status, "fulfilled");
      assert.ok(release.status === "fulfilled" || release.reason instanceof Error);
      assert.ok(["released", "quarantined"].includes((await sessions.findById(session.sessionId))!.state));
      assert.equal(await runtimeOwnerState(database, session.sessionId), "closed");
    } finally {
      await database.cleanup();
    }
  });

  it("publishes a recovery attempt, runtime, and dispatch delivery as running atomically", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedAttemptBoundRecoveryRuntime(database, {
        runId: "run-recovery-runtime-start",
      });
      assert.equal((await fixture.deliveries.findDelivery(fixture.handoff.dispatchId))?.state, "attempt_reserved");
      await fixture.sessions.markStarting({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        recoveryFence: fixture.recoveryFence,
      });
      const running = await fixture.sessions.markRunning({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        pid: 4321,
        processIdentity: {
          schema: "setfarm.process-identity.v1",
          pid: 4321,
          processStartedAt: "2026-07-13T12:10:00.000Z",
          processGroupId: 4321,
          source: "observed_os",
        },
        recoveryFence: fixture.recoveryFence,
      });
      assert.equal(running.status, "running");
      assert.equal((await fixture.deliveries.findDelivery(fixture.handoff.dispatchId))?.state, "running");
      assert.equal(
        (await createAttemptRepository(database.sql).findById(fixture.attempt.attempt.attemptId))?.disposition,
        "running",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("blocks runtime start before publication when the recovery delivery owner differs", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedAttemptBoundRecoveryRuntime(database, {
        runId: "run-recovery-runtime-owner-mismatch",
        runtimeOwnerInstanceId: "different-spawner",
      });
      await assert.rejects(
        fixture.sessions.markStarting({
          sessionId: fixture.session.sessionId,
          ownerInstanceId: fixture.session.ownerInstanceId,
          recoveryFence: fixture.recoveryFence,
        }),
        /RUNTIME_SESSION_RECOVERY_DELIVERY_FENCE_STALE/,
      );
      assert.equal((await fixture.sessions.findById(fixture.session.sessionId))?.state, "reserved");
      assert.equal((await fixture.deliveries.findDelivery(fixture.handoff.dispatchId))?.state, "attempt_reserved");
      assert.equal(
        (await createAttemptRepository(database.sql).findById(fixture.attempt.attempt.attemptId))?.disposition,
        "claimed",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("fences a stale quarantine observation after runtime ownership advances", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-quarantine-fence";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const reserved = await sessions.reserve({
        sessionId: "RTS_runtime-quarantine-fence1",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-stale",
      });
      const staleObservation = await sessions.markStarting({
        sessionId: reserved.sessionId,
        ownerInstanceId: "spawner-stale",
      });

      await database.sql`
        UPDATE runtime_sessions
           SET owner_instance_id = 'spawner-current',
               state_version = state_version + 1,
               heartbeat_at = NOW(),
               updated_at = NOW()
         WHERE session_id = ${reserved.sessionId}
           AND owner_instance_id = 'spawner-stale'
           AND state_version = ${staleObservation.stateVersion}
      `;

      await assert.rejects(
        sessions.quarantine({
          sessionId: reserved.sessionId,
          expectedOwnerInstanceId: staleObservation.ownerInstanceId,
          expectedStateVersion: staleObservation.stateVersion,
          diagnostic: "stale worker must not quarantine adopted runtime",
        }),
        /RUNTIME_SESSION_QUARANTINE_CAS_LOST/,
      );
      const adopted = await sessions.findById(reserved.sessionId);
      assert.ok(adopted);
      assert.equal(adopted.ownerInstanceId, "spawner-current");
      assert.equal(adopted.state, "starting");
      assert.equal(adopted.stateVersion, staleObservation.stateVersion + 1);

      const quarantined = await sessions.quarantine({
        sessionId: adopted.sessionId,
        expectedOwnerInstanceId: adopted.ownerInstanceId,
        expectedStateVersion: adopted.stateVersion,
        diagnostic: "current worker proved runtime uncertainty",
      });
      assert.equal(quarantined.state, "quarantined");
      assert.equal(quarantined.stateVersion, adopted.stateVersion + 1);
      assert.equal(await runtimeOwnerState(database, reserved.sessionId), "closed");
      const replay = await sessions.quarantine({
        sessionId: adopted.sessionId,
        expectedOwnerInstanceId: staleObservation.ownerInstanceId,
        expectedStateVersion: staleObservation.stateVersion,
        diagnostic: "lost response replay must not rewrite terminal receipt",
      });
      assert.equal(replay.state, "quarantined");
      assert.equal(replay.stateVersion, quarantined.stateVersion);
      assert.equal(replay.diagnostic, quarantined.diagnostic);
    } finally {
      await database.cleanup();
    }
  });

  it("preserves drain proof through quarantine and re-proves it only for the exact termination owner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-quarantine-stop";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const reserved = await sessions.reserve({
        sessionId: "RTS_runtime-quarantine-stop1",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-runtime",
      });
      await sessions.markStarting({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
      });
      const running = await sessions.markRunning({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        sessionKey: "runtime-quarantine-stop-key",
      });
      assert.equal(running.status, "running");
      const draining = await sessions.requestDrain({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        diagnostic: "completion requested drain",
      });
      const drained = await sessions.markDrained({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        evidence: DRAIN_EVIDENCE,
      });
      const quarantined = await sessions.quarantine({
        sessionId: reserved.sessionId,
        expectedOwnerInstanceId: drained.ownerInstanceId,
        expectedStateVersion: drained.stateVersion,
        diagnostic: "completion owner rejected an invalid proposal",
        evidence: { completionRequestId: "RCR_runtime-quarantine-stop1" },
      });
      assert.equal(draining.state, "drain_requested");
      assert.equal(quarantined.state, "quarantined");
      assert.deepEqual(quarantined.drainEvidence, DRAIN_EVIDENCE);

      const requested = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "test.operator.stop",
        diagnostic: "operator requested cancellation against quarantine",
        requestId: "RTR_runtime-quarantine-stop1",
      });
      assert.equal(requested.status, "requested");
      if (requested.status === "already_terminal") throw new Error("termination request missing");
      const terminations = createRunTerminationRepository(database.sql);
      const termination = await terminations.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-termination",
      });
      assert.equal(termination?.state, "draining");
      assert.ok(termination?.ownerInstanceId);

      const freshEvidence = {
        ...DRAIN_EVIDENCE,
        observedAt: "2026-07-13T12:05:00.000Z",
        evidenceRefs: [
          `setfarm://run-termination/${termination!.requestId}`,
          `setfarm://runtime-session/${quarantined.sessionId}`,
        ],
      };
      await assert.rejects(
        sessions.recoverQuarantinedForTermination({
          sessionId: quarantined.sessionId,
          expectedStateVersion: quarantined.stateVersion,
          terminationRequestId: termination!.requestId,
          terminationOwnerInstanceId: "wrong-owner",
          evidence: freshEvidence,
          diagnostic: "wrong owner must not recover quarantine",
        }),
        /RUNTIME_SESSION_TERMINATION_RECOVERY_LEASE_INVALID/,
      );
      await database.sql`
        UPDATE run_termination_requests
           SET lease_expires_at = clock_timestamp() - interval '1 second'
         WHERE request_id = ${termination!.requestId}
      `;
      await assert.rejects(
        sessions.recoverQuarantinedForTermination({
          sessionId: quarantined.sessionId,
          expectedStateVersion: quarantined.stateVersion,
          terminationRequestId: termination!.requestId,
          terminationOwnerInstanceId: termination!.ownerInstanceId!,
          evidence: freshEvidence,
          diagnostic: "expired owner must not recover quarantine",
          now: new Date("2000-01-01T00:00:00.000Z"),
        }),
        /RUNTIME_SESSION_TERMINATION_RECOVERY_LEASE_INVALID/,
      );
      const adopted = await terminations.claim({
        requestId: termination!.requestId,
        ownerInstanceId: "spawner-termination-adopted",
      });
      assert.equal(adopted?.state, "draining");
      const recovered = await sessions.recoverQuarantinedForTermination({
        sessionId: quarantined.sessionId,
        expectedStateVersion: quarantined.stateVersion,
        terminationRequestId: adopted!.requestId,
        terminationOwnerInstanceId: adopted!.ownerInstanceId!,
        evidence: freshEvidence,
        diagnostic: "termination owner re-proved process, task, and workspace absence",
      });
      assert.equal(recovered.state, "drained");
      assert.deepEqual(recovered.drainEvidence, freshEvidence);
      assert.match(recovered.diagnostic || "", /completion owner rejected an invalid proposal/);
      assert.match(recovered.diagnostic || "", /termination owner re-proved/);

      const replay = await sessions.recoverQuarantinedForTermination({
        sessionId: quarantined.sessionId,
        expectedStateVersion: quarantined.stateVersion,
        terminationRequestId: adopted!.requestId,
        terminationOwnerInstanceId: adopted!.ownerInstanceId!,
        evidence: freshEvidence,
        diagnostic: "lost response replay",
      });
      assert.equal(replay.state, "drained");
      assert.deepEqual(replay.drainEvidence, freshEvidence);
    } finally {
      await database.cleanup();
    }
  });

  it("returns the durable termination drain handoff when termination wins after markStarting", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-start-termination-handoff";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const reserved = await sessions.reserve({
        sessionId: "RTS_runtime-start-termination-handoff",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-runtime",
      });
      await sessions.markStarting({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
      });
      const termination = await requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "test.runtime-start-race",
        diagnostic: "termination won after runtime start intent",
        requestId: "RTR_runtime-start-termination-handoff",
      });
      assert.equal(termination.status, "requested");
      const draining = await sessions.requestDrain({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        diagnostic: "termination owns the drain",
      });
      assert.equal(draining.state, "drain_requested");

      const handoff = await sessions.markRunning({
        sessionId: reserved.sessionId,
        ownerInstanceId: reserved.ownerInstanceId,
        sessionKey: "must-not-be-published-running",
      });
      assert.equal(handoff.status, "drain_requested");
      assert.equal(handoff.session.state, "drain_requested");
      assert.equal(handoff.session.sessionKey, undefined);
      const rows = await database.sql<Array<{
        run_status: string;
        runtime_state: string;
        termination_count: number;
      }>>`
        SELECT run.status AS run_status, runtime.state AS runtime_state,
               (SELECT COUNT(*)::integer FROM run_termination_requests request
                 WHERE request.run_id = run.id AND request.state <> 'terminalized') AS termination_count
          FROM runs run
          JOIN runtime_sessions runtime ON runtime.run_id = run.id
         WHERE run.id = ${runId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        run_status: "failing",
        runtime_state: "drain_requested",
        termination_count: 1,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("returns a recovery runtime drain handoff before consulting a stale attempt fence", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedAttemptBoundRecoveryRuntime(database, {
        runId: "run-recovery-runtime-termination-handoff",
      });
      await fixture.sessions.markStarting({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        recoveryFence: fixture.recoveryFence,
      });
      const termination = await requestRunTermination(database.sql, {
        runId: fixture.session.runId,
        targetStatus: "failed",
        requestedBy: "test.recovery-runtime-start-race",
        diagnostic: "termination won while the recovery runtime was starting",
        requestId: "RTR_recovery-runtime-termination-handoff",
      });
      assert.equal(termination.status, "requested");
      const draining = await fixture.sessions.requestDrain({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        diagnostic: "termination owns the recovery runtime drain",
      });
      assert.equal(draining.state, "drain_requested");

      await database.sql`
        UPDATE execution_attempts
           SET fence_token = ${"e".repeat(64)}, updated_at = NOW()
         WHERE attempt_id = ${fixture.attempt.attempt.attemptId}
      `;

      const handoff = await fixture.sessions.markRunning({
        sessionId: fixture.session.sessionId,
        ownerInstanceId: fixture.session.ownerInstanceId,
        sessionKey: "must-not-be-published-after-recovery-relinquish",
        recoveryFence: fixture.recoveryFence,
      });
      assert.equal(handoff.status, "drain_requested");
      assert.equal(handoff.session.state, "drain_requested");
      assert.equal(handoff.session.sessionKey, undefined);
      assert.equal(
        (await fixture.sessions.findById(fixture.session.sessionId))?.state,
        "drain_requested",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("releases an exact reserved no-spawn owner only after its claim is terminal", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-runtime-no-spawn";
      const { stepDbId, storyDbId, claimId } = await seedStory(database, runId);
      const sessions = createRuntimeSessionRepository(database.sql);
      const session = await sessions.reserve({
        sessionId: "RTS_runtime-no-spawn-0001",
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimId,
        claimAgentId: "feature-dev_developer",
        runtimeAgentId: "prism",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-a",
      });
      await assert.rejects(
        database.sql.begin((transaction) => releaseReservedRuntimeSessionInTransaction(
          transaction,
          {
            sessionId: session.sessionId,
            claimId,
            ownerInstanceId: "spawner-a",
            diagnostic: "no spawn",
          },
        )),
        /RUNTIME_SESSION_RESERVED_RELEASE_CLAIM_ACTIVE/,
      );
      await database.sql`UPDATE claim_log SET outcome = 'infra_retry' WHERE id = ${claimId}`;
      await database.sql.unsafe(`
        CREATE FUNCTION reject_runtime_owner_close_v1() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.category='runtime-session' AND NEW.state='closed' THEN
            RAISE EXCEPTION 'TEST_RUNTIME_OWNER_CLOSE_REJECTED';
          END IF;
          RETURN NEW;
        END $$
      `);
      await database.sql.unsafe(`
        CREATE TRIGGER reject_runtime_owner_close_v1
        BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
        FOR EACH ROW EXECUTE FUNCTION reject_runtime_owner_close_v1()
      `);
      await assert.rejects(
        database.sql.begin((transaction) => releaseReservedRuntimeSessionInTransaction(
          transaction,
          {
            sessionId: session.sessionId,
            claimId,
            ownerInstanceId: "spawner-a",
            diagnostic: "rejected close rolls release back",
          },
        )),
        /TEST_RUNTIME_OWNER_CLOSE_REJECTED/,
      );
      assert.equal((await sessions.findById(session.sessionId))?.state, "reserved");
      assert.equal(await runtimeOwnerState(database, session.sessionId), "bound");
      await database.sql.unsafe("DROP TRIGGER reject_runtime_owner_close_v1 ON internal_production_owner_reservations_v1");
      await database.sql.unsafe("DROP FUNCTION reject_runtime_owner_close_v1()");
      const released = await database.sql.begin((transaction) => releaseReservedRuntimeSessionInTransaction(
        transaction,
        {
          sessionId: session.sessionId,
          claimId,
          ownerInstanceId: "spawner-a",
          diagnostic: "preclaim rejected before spawn",
        },
      ));
      assert.equal(released.state, "released");
      assert.equal(released.drainEvidence.sourceState, "reserved");
      assert.equal(await runtimeOwnerState(database, session.sessionId), "closed");
      const replay = await sessions.quarantine({
        sessionId: session.sessionId,
        expectedOwnerInstanceId: session.ownerInstanceId,
        expectedStateVersion: session.stateVersion,
        diagnostic: "late quarantine replay must preserve release",
      });
      assert.equal(replay.state, "released");
      assert.equal(replay.stateVersion, released.stateVersion);
      assert.equal(replay.diagnostic, released.diagnostic);
    } finally {
      await database.cleanup();
    }
  });
});
