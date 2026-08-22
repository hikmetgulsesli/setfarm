import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  completeSingleStepClaimAndState,
  completeStoryClaimAndBoundAttempt,
} from "../../src/execution/claim-attempt-transition.js";
import { ensureCompilerClaimFence } from "../../src/execution/compiler-claim-fence.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
  publishLoopClaimRuntime,
} from "../../src/execution/claim-runtime-publication.js";
import type { PgTransactionSql } from "../../src/db-pg.js";
import { loadCompilerEnglishAdmissionLedgerAuthorityV1 } from "../../src/execution/compiler-english-admission-ledger-v1.js";
import {
  createCompilerStoryEnglishAdmissionClaimProofV1,
  loadCompilerStoryEnglishAdmissionLedgerAuthorityV1,
  type CompilerStoryEnglishAdmissionClaimProofV1,
} from "../../src/execution/compiler-story-english-admission-ledger-v1.js";
import { publishCompilerStoryEnglishAdmissionAndCompleteV1 } from "../../src/execution/compiler-story-english-admission-publication-v1.js";
import { withdrawPreDispatchClaimInTransaction } from "../../src/execution/pre-dispatch-withdrawal-authority.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { designAuthoritySubjectHashV1 } from "../../src/installer/steps/03-stories/guards.js";
import { buildV3AutoStoriesOutput } from "../../src/installer/steps/03-stories/preclaim.js";
import {
  compileCompilerEnglishAdmissionV1,
  compilerEnglishAdmissionReceiptV1,
} from "../../src/product-compiler/compiler-english-admission-v1.js";
import {
  compileCompilerStoryEnglishAdmissionV1,
  compilerStoryEnglishAdmissionStateV1,
} from "../../src/product-compiler/compiler-story-english-admission-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { renderProductSpecV2Compatibility } from "../../src/product-compiler/renderers/product-spec-v2-compatibility.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import {
  createV3RecoveryClaimAuthority,
  v3RecoveryStoryLockIdentity,
} from "../../src/recovery/v3-recovery-claim-authority.js";
import { createV3RecoveryLifecycleReconciler } from "../../src/recovery/v3-recovery-lifecycle-reconciler.js";
import { createV3RecoveryOwnerLeaseRepository } from "../../src/recovery/v3-recovery-owner-lease.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";
import {
  NODE_CLI_TASK,
  genuineNodeCliProductSpecV2,
} from "../product-compiler/fixtures/no-design-product-semantics-v2.js";

const PACKET_HASH = "a".repeat(64);
const SLICE_HASH = "b".repeat(64);
const OBSERVATION_HASH = "c".repeat(64);
const CONTENT_HASH = "d".repeat(64);
const SOURCE_SHA = "1".repeat(40);
const SOURCE_TREE = "2".repeat(40);
const STORY_ADMISSION_DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-08-12T00:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/v3-recovery-lifecycle-story-admission-drain"],
};

function finding(runId: string, storyId: string) {
  return createFindingSetV1({
    runId,
    storyId,
    packetHash: PACKET_HASH,
    sliceHash: SLICE_HASH,
    sourceRevision: { sha: SOURCE_SHA, treeHash: SOURCE_TREE },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: CONTENT_HASH }],
      observedEvidenceRefs: [OBSERVATION_HASH],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function recoveryDraft(
  findingSet: ReturnType<typeof finding>,
  owner: "implement" | "supervisor" = "implement",
): RecoveryCaseDraftV1 {
  return {
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((item) => item.findingId),
    packetHash: findingSet.packetHash,
    sliceHash: findingSet.sliceHash,
    sourceRevision: findingSet.sourceRevision,
    owner,
    expectedDelta: {
      kind: "source_change",
      invariantRefs: ["INV_SAVE_RELOAD"],
      requiredPaths: ["src/App.tsx"],
    },
    allowedPaths: ["src/App.tsx"],
    evidencePlan: ["EVID_SAVE_RELOAD"],
    priorAttemptRefs: [],
    budget: {
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  };
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
  const claimId = await database.sql.begin(async (transaction) => {
    const idRows = await transaction.unsafe<Array<{ id: unknown }>>(
      "SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id",
    );
    const birth = await prepareInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      "a-claim-single-runtime-v1",
      idRows,
    );
    return insertAndBindInternalProductionClaimBirthV1(transaction as PgTransactionSql, birth, {
      runId: input.runId,
      workflowStepId: input.workflowStepId,
      storyId: null,
      claimAgentId,
      claimedAt: new Date(),
    });
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
    issuedAt: "2026-08-12T00:00:00.000Z",
    stepId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    runId: input.runId,
    claimId,
    claimAgentId,
    runtimeAgentId,
    input: `Durable ${input.workflowStepId} fixture completion`,
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
    evidence: STORY_ADMISSION_DRAIN_EVIDENCE,
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
    evidence: { source: "v3-recovery-lifecycle-story-admission-fixture" },
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

async function seedCanonicalStoryAdmission(
  database: TestDatabase,
  input: Readonly<{ runId: string; implementStepDbId: string }>,
): Promise<Readonly<{
  storyDbId: string;
  storyId: string;
  storyAdmissionProof: CompilerStoryEnglishAdmissionClaimProofV1;
}>> {
  const productSpec = genuineNodeCliProductSpecV2();
  const releaseSha = "3".repeat(40);
  const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
  const productSpecHash = hashCanonicalJson(productSpec);
  const renderedPlan = renderProductSpecV2Compatibility(productSpec);
  const prdMarker = "\nPRD:\n";
  const prdIndex = renderedPlan.indexOf(prdMarker);
  assert.ok(prdIndex > 0);
  const prd = renderedPlan.slice(prdIndex + prdMarker.length);
  const baseContext: Record<string, string> = {
    task: NODE_CLI_TASK,
    repo: `/tmp/${input.runId}`,
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
  const planStepDbId = `${input.runId}-plan-step`;
  const designStepDbId = `${input.runId}-design-step`;
  const storiesStepDbId = `${input.runId}-stories-step`;
  const releaseAdmissionPreflightHash = "e".repeat(64);
  await database.sql`
    INSERT INTO runs (
      id, workflow_id, task, status, context, protocol, protocol_version,
      compiler_release_sha, packet_hash, activation_preflight_hash, release_admission_hash
    ) VALUES (
      ${input.runId}, 'feature-dev', ${NODE_CLI_TASK}, 'running', ${JSON.stringify(baseContext)},
      'v3', 1, ${releaseSha}, ${PACKET_HASH}, ${releaseAdmissionPreflightHash},
      ${releaseAdmissionHash}
    )
  `;
  await database.sql`
    INSERT INTO steps (
      id, run_id, step_id, agent_id, step_index, input_template, expects,
      status, type, retry_count, max_retries
    ) VALUES (
      ${planStepDbId}, ${input.runId}, 'plan', 'feature-dev_planner', 1, '', '',
      'running', 'single', 0, 3
    ), (
      ${designStepDbId}, ${input.runId}, 'design', 'feature-dev_designer', 2, '', '',
      'waiting', 'single', 0, 3
    ), (
      ${storiesStepDbId}, ${input.runId}, 'stories', 'feature-dev_story-planner', 3, '', '',
      'waiting', 'single', 0, 3
    ), (
      ${input.implementStepDbId}, ${input.runId}, 'implement', 'implement-agent', 5, '', '',
      'pending', 'loop', 0, 3
    )
  `;

  const managedPlan = await prepareCompilerAdmissionCompletion(database, {
    runId: input.runId,
    stepDbId: planStepDbId,
    workflowStepId: "plan",
    output: "STATUS: done",
  });
  const planAuthority = compileCompilerEnglishAdmissionV1({
    claimId: managedPlan.claimId,
    runId: input.runId,
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
    { runId: input.runId },
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
    runId: input.runId,
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

  const storyOutput = buildV3AutoStoriesOutput({
    repo: baseContext.repo,
    prd,
    expectedProductSpecHash: productSpecHash,
    productSemanticsVersion: "v2",
  });
  const screenMapLine = storyOutput.split("\n").find((line) => line.startsWith("SCREEN_MAP: "));
  assert.ok(screenMapLine);
  const storyAdmissionContext = {
    ...designContext,
    screen_map: screenMapLine.slice("SCREEN_MAP: ".length),
  };
  await database.sql`
    UPDATE runs SET context = ${JSON.stringify(storyAdmissionContext)} WHERE id = ${input.runId}
  `;
  await database.sql`UPDATE steps SET status = 'running' WHERE id = ${storiesStepDbId}`;
  const managedStories = await prepareCompilerAdmissionCompletion(database, {
    runId: input.runId,
    stepDbId: storiesStepDbId,
    workflowStepId: "stories",
    output: storyOutput,
  });
  const designAuthoritySubjectHash = await designAuthoritySubjectHashV1(
    database.sql,
    input.runId,
    storyAdmissionContext,
    productSpecHash,
    false,
  );
  const storyAuthority = compileCompilerStoryEnglishAdmissionV1({
    claimId: managedStories.claimId,
    runId: input.runId,
    stepDbId: storiesStepDbId,
    workflowStepId: "stories",
    planAuthority: durablePlanAuthority,
    designAuthoritySubjectHash,
    rawOutput: storyOutput,
    expectedOutput: storyOutput,
    finalContext: storyAdmissionContext,
  });
  const storyReceipt = compilerStoryEnglishAdmissionStateV1(storyAuthority).receipt;
  const finalContext = {
    ...storyAdmissionContext,
    stories_english_authority_version: storyReceipt.authorityVersion,
    stories_english_admission_receipt_hash: storyAuthority.receiptHash,
  };
  await runWithRuntimeCompletionOwner({
    requestId: managedStories.processing.requestId,
    ownerInstanceId: managedStories.processing.ownerInstanceId!,
    leaseExpiresAt: managedStories.processing.leaseExpiresAt!,
    ownerAttemptCount: managedStories.processing.ownerAttemptCount,
  }, () => publishCompilerStoryEnglishAdmissionAndCompleteV1(database.sql, {
    authority: storyAuthority,
    completion: {
      envelope: managedStories.envelope,
      stepStatus: "done",
      stepOutput: storyOutput,
      runContextJson: JSON.stringify(finalContext),
      expectedRunContextJson: JSON.stringify(storyAdmissionContext),
      requireRuntimeCompletionOwner: true,
      completionPlan: createSingleEffectCompletionPlanDescriptorV1({
        kind: "single_completion",
        continuation: { type: "single_pipeline_advance" },
        effectPayload: {
          stepId: "stories",
          compilerStoryEnglishAdmissionReceipt: storyReceipt,
        },
      }),
    },
  }));
  await settleCompilerAdmissionCompletion(database, managedStories);
  const durableStoryAuthority = await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(
    database.sql,
    { runId: input.runId },
  );
  const storyRows = await database.sql<Array<{ id: string; story_id: string }>>`
    SELECT id, story_id
      FROM stories
     WHERE run_id = ${input.runId}
     ORDER BY story_index, story_id
  `;
  assert.ok(storyRows[0]);
  return Object.freeze({
    storyDbId: storyRows[0]!.id,
    storyId: storyRows[0]!.story_id,
    storyAdmissionProof: createCompilerStoryEnglishAdmissionClaimProofV1(durableStoryAuthority),
  });
}

describe("v3 recovery lifecycle reconciler", () => {
  let database: TestDatabase;
  let sequence = 0;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  async function setup(input: Readonly<{
    owner?: "implement" | "supervisor";
    dispatchClass?: "product_implementation" | "supervisor_repair";
  }> = {}) {
    sequence += 1;
    const runId = `run-v3-lifecycle-${sequence}`;
    const stepDbId = `step-v3-lifecycle-${sequence}`;
    const base = new Date(Date.now() + sequence * 1_000);
    const canonical = await seedCanonicalStoryAdmission(database, {
      runId,
      implementStepDbId: stepDbId,
    });
    const { storyDbId, storyId, storyAdmissionProof } = canonical;
    await database.sql.unsafe(
      `UPDATE stories
          SET status = 'failed', output = NULL, claimed_by = NULL,
              claimed_at = NULL, started_at = NULL
        WHERE id = $1 AND run_id = $2 AND story_id = $3`,
      [storyDbId, runId, storyId],
    );

    const findingSet = finding(runId, storyId);
    const findings = createFindingRecoveryRepository(database.sql);
    await findings.putFindingSet(findingSet);
    const opened = await findings.openRecoveryCase(recoveryDraft(findingSet, input.owner), { now: base });
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(revision);
    const authorized = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass: input.dispatchClass ?? "product_implementation",
    }, { now: new Date(base.getTime() + 1_000) });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected recovery delivery authorization");
    return {
      runId,
      storyId,
      stepDbId,
      storyDbId,
      base,
      findingSet,
      revision,
      dispatch: authorized.dispatch,
      delivery: authorized.delivery,
      deliveries,
      storyAdmissionProof,
    };
  }

  async function lease(
    fixture: Awaited<ReturnType<typeof setup>>,
    input: Readonly<{ ownerInstanceId: string; leaseMs: number; now: Date }>,
  ) {
    return createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
      runId: fixture.runId,
      storyId: fixture.storyId,
      ownerInstanceId: input.ownerInstanceId,
      leaseMs: input.leaseMs,
    }, { now: input.now });
  }

  async function publish(
    fixture: Awaited<ReturnType<typeof setup>>,
    handoff: Awaited<ReturnType<typeof lease>>,
    input: Readonly<{ sessionId: string; now: Date }>,
  ) {
    const publication = await publishLoopClaimRuntime(database.sql, {
      runId: fixture.runId,
      stepDbId: fixture.stepDbId,
      workflowStepId: "implement",
      storyDbId: fixture.storyDbId,
      storyId: fixture.storyId,
      claimAgentId: "recovery-agent",
      parallelLimit: 1,
      recoveryHandoff: handoff,
      storyAdmissionProof: fixture.storyAdmissionProof,
      runtimeIntent: {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: input.sessionId,
        runtimeAgentId: "recovery-runtime-agent",
        runtimeKind: "local_process",
        ownerInstanceId: handoff.lease.ownerInstanceId,
      },
      now: input.now,
    });
    assert.ok(publication?.runtime);
    return publication;
  }

  function modelReservationInput(
    fixture: Awaited<ReturnType<typeof setup>>,
    handoff: Awaited<ReturnType<typeof lease>>,
    claimId: number,
  ) {
    return {
      claimId,
      runId: fixture.runId,
      stepId: "implement",
      storyId: fixture.storyId,
      attemptClass: handoff.dispatchClass,
      packetHash: handoff.directive.packetHash,
      compilationReportHash: "f".repeat(64),
      sliceHash: handoff.directive.contractSliceHash,
      sourceBefore: handoff.directive.sourceRevision,
      findingSetHash: handoff.directive.findingSetHash,
      recoveryCaseRevisionId: handoff.revisionId,
      recoveryDispatchId: handoff.dispatchId,
      recoveryDeliveryLease: {
        ownerInstanceId: handoff.lease.ownerInstanceId,
        leaseToken: handoff.lease.leaseToken,
      },
      role: "developer",
      agentId: "recovery-agent",
      evidenceRefs: [`setfarm://claim-log/${claimId}`],
    };
  }

  async function reserveModelAttempt(
    fixture: Awaited<ReturnType<typeof setup>>,
    handoff: Awaited<ReturnType<typeof lease>>,
    input: Readonly<{ sessionId: string; now: Date; start?: boolean; replay?: boolean }>,
  ) {
    const publication = await publish(fixture, handoff, {
      sessionId: input.sessionId,
      now: input.now,
    });
    assert.ok(publication);
    const reservationInput = modelReservationInput(fixture, handoff, publication!.claimId);
    const attempts = createAttemptRepository(database.sql);
    const reservation = await attempts.reserve(
      reservationInput,
      { now: new Date(input.now.getTime() + 100), leaseMs: 60_000 },
    );
    assert.equal(reservation.status, "reserved");
    if (reservation.status !== "reserved") throw new Error("expected model attempt reservation");
    const deliveryPair = await database.sql<Array<{
      claim_id: string;
      attempt_id: string;
      execution_slice_hash: string;
      state: string;
      attempt_count: number;
    }>>`
      SELECT claim_id::text,attempt_id,execution_slice_hash,state,attempt_count
        FROM recovery_dispatch_deliveries
       WHERE dispatch_id=${handoff.dispatchId}
    `;
    assert.deepEqual({ ...deliveryPair[0]! }, {
      claim_id: String(publication!.claimId),
      attempt_id: reservation.attempt.attemptId,
      execution_slice_hash: handoff.directive.contractSliceHash,
      state: "attempt_reserved",
      attempt_count: 1,
    });
    if (input.replay) {
      const headBefore = await database.sql<Array<{ head_version: number }>>`
        SELECT head_version FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
      `;
      const replay = await attempts.reserve(
        reservationInput,
        { now: new Date(input.now.getTime() + 150), leaseMs: 60_000 },
      );
      assert.equal(replay.status, "duplicate");
      assert.equal(replay.attempt.attemptId, reservation.attempt.attemptId);
      const replayState = await database.sql<Array<{
        head_version: number;
        attempt_count: number;
        claim_id: string;
        attempt_id: string;
      }>>`
        SELECT head.head_version,delivery.attempt_count,
               delivery.claim_id::text,delivery.attempt_id
          FROM internal_production_owner_admission_head_v1 head
          JOIN recovery_dispatch_deliveries delivery ON TRUE
         WHERE head.singleton=TRUE AND delivery.dispatch_id=${handoff.dispatchId}
      `;
      assert.deepEqual({ ...replayState[0]! }, {
        head_version: headBefore[0]!.head_version,
        attempt_count: 1,
        claim_id: String(publication!.claimId),
        attempt_id: reservation.attempt.attemptId,
      });
    }
    await createRuntimeSessionRepository(database.sql).bindAttempt({
      sessionId: input.sessionId,
      attemptId: reservation.attempt.attemptId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      now: new Date(input.now.getTime() + 200),
    });
    if (input.start !== false) {
      await createRuntimeSessionRepository(database.sql).markStarting({
        sessionId: input.sessionId,
        ownerInstanceId: handoff.lease.ownerInstanceId,
        recoveryFence: {
          revisionId: handoff.revisionId,
          dispatchId: handoff.dispatchId,
          leaseToken: handoff.lease.leaseToken,
          attempt: {
            attemptId: reservation.attempt.attemptId,
            generation: reservation.attempt.generation,
            fenceToken: reservation.attempt.fenceToken,
          },
        },
        now: new Date(input.now.getTime() + 300),
      });
    }
    return { publication: publication!, attempt: reservation.attempt };
  }

  async function expireDelivery(dispatchId: string): Promise<void> {
    const clocks = await database.sql<Array<{ wall_clock: Date }>>`
      SELECT clock_timestamp() AS wall_clock
    `;
    await database.sql`
      UPDATE recovery_dispatch_deliveries
         SET lease_expires_at = ${new Date(clocks[0]!.wall_clock.getTime() - 1_000)}
       WHERE dispatch_id = ${dispatchId}
    `;
  }

  async function expireModelOwner(dispatchId: string, attemptId: string): Promise<void> {
    await database.sql.begin(async (transaction) => {
      const clocks = await transaction.unsafe<Array<{ wall_clock: Date }>>(
        "SELECT clock_timestamp() AS wall_clock",
      );
      const anchor = clocks[0]!.wall_clock.getTime();
      const claimAt = new Date(anchor - 3_000);
      const startedAt = new Date(anchor - 2_000);
      const expiresAt = new Date(anchor - 1_000);
      await transaction.unsafe(
        `UPDATE claim_log claim
            SET claimed_at = $2
          WHERE claim.id = (SELECT attempt.claim_id FROM execution_attempts attempt WHERE attempt.attempt_id = $1)`,
        [attemptId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE stories story
            SET claimed_at = $2
           FROM execution_attempts attempt
          WHERE attempt.attempt_id = $1
            AND story.run_id = attempt.run_id
            AND story.story_id = attempt.story_id`,
        [attemptId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE runtime_sessions
            SET created_at = $2, heartbeat_at = $3, updated_at = $3
          WHERE attempt_id = $1`,
        [attemptId, claimAt, startedAt],
      );
      await transaction.unsafe(
        `UPDATE execution_attempts
            SET lease_acquired_at = $2, heartbeat_at = $2,
                lease_expires_at = $3, updated_at = $2
          WHERE attempt_id = $1`,
        [attemptId, startedAt, expiresAt],
      );
      await transaction.unsafe(
        `UPDATE recovery_dispatch_deliveries
            SET started_at = $2, lease_expires_at = $3, updated_at = $2
          WHERE dispatch_id = $1`,
        [dispatchId, startedAt, expiresAt],
      );
    });
  }

  async function expireUnreservedPublication(dispatchId: string): Promise<void> {
    await database.sql.begin(async (transaction) => {
      const clocks = await transaction.unsafe<Array<{ wall_clock: Date }>>(
        "SELECT clock_timestamp() AS wall_clock",
      );
      const anchor = clocks[0]!.wall_clock.getTime();
      const deliveryAt = new Date(anchor - 4_000);
      const claimAt = new Date(anchor - 3_000);
      const expiresAt = new Date(anchor - 1_000);
      await transaction.unsafe(
        `UPDATE claim_log claim
            SET claimed_at = $2
           FROM recovery_dispatch_deliveries delivery
          WHERE delivery.dispatch_id = $1
            AND claim.run_id = delivery.run_id
            AND claim.story_id = delivery.story_id
            AND claim.outcome IS NULL`,
        [dispatchId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE stories story
            SET claimed_at = $2
           FROM recovery_dispatch_deliveries delivery
          WHERE delivery.dispatch_id = $1
            AND story.run_id = delivery.run_id
            AND story.story_id = delivery.story_id`,
        [dispatchId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE runtime_sessions runtime
            SET created_at = $2, heartbeat_at = $2, updated_at = $2
           FROM recovery_dispatch_deliveries delivery
          WHERE delivery.dispatch_id = $1
            AND runtime.run_id = delivery.run_id
            AND runtime.story_id = delivery.story_id
            AND runtime.state <> 'released'`,
        [dispatchId, claimAt],
      );
      await transaction.unsafe(
        `UPDATE recovery_dispatch_deliveries
            SET lease_expires_at = $2, updated_at = $3
          WHERE dispatch_id = $1`,
        [dispatchId, expiresAt, deliveryAt],
      );
    });
  }

  async function waitForBlockedStoryAdvisory(minimum = 1): Promise<void> {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const rows = await database.sql<Array<{ blocked: number }>>`
        SELECT COUNT(*)::integer AS blocked
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%pg_advisory_xact_lock(hashtextextended($1, 0))%'
      `;
      if ((rows[0]?.blocked ?? 0) >= minimum) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`TEST_BARRIER_RECOVERY_ADVISORY_WAITERS_MISSING:${minimum}`);
  }

  async function holdStoryAdvisory(runId: string, storyId: string) {
    let entered!: () => void;
    let release!: () => void;
    const enteredGate = new Promise<void>((resolve) => { entered = resolve; });
    const releaseGate = new Promise<void>((resolve) => { release = resolve; });
    const done = database.sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        v3RecoveryStoryLockIdentity({ runId, storyId }),
      ]);
      entered();
      await releaseGate;
    });
    await enteredGate;
    return { release, done };
  }

  async function waitForBlockedRunLock(runId: string, minimum: number): Promise<void> {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const rows = await database.sql<Array<{ blocked: number }>>`
        SELECT count(*)::integer AS blocked
          FROM pg_stat_activity
         WHERE datname=current_database()
           AND pid<>pg_backend_pid()
           AND wait_event_type='Lock'
           AND query ILIKE '%FROM runs WHERE id%'
      `;
      if ((rows[0]?.blocked ?? 0) >= minimum) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`TEST_BARRIER_RUN_LOCK_WAITERS_MISSING:${runId}:${minimum}`);
  }

  async function holdRunRow(runId: string) {
    let entered!: () => void;
    let release!: () => void;
    const enteredGate = new Promise<void>((resolve) => { entered = resolve; });
    const releaseGate = new Promise<void>((resolve) => { release = resolve; });
    const done = database.sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT id FROM runs WHERE id=$1 FOR UPDATE", [runId]);
      entered();
      await releaseGate;
    });
    await enteredGate;
    return { release, done };
  }

  async function makeModelOwner(label: string, start = true) {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: `barrier-owner-${label}`,
      leaseMs: 120_000,
      now: leaseAt,
    });
    const safeLabel = label.replace(/[^A-Za-z0-9-]/g, "x").padEnd(20, "x").slice(0, 20);
    const sessionId = `RTS_${safeLabel}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start,
    });
    const recoveryFence = {
      revisionId: handoff.revisionId,
      dispatchId: handoff.dispatchId,
      leaseToken: handoff.lease.leaseToken,
      attempt: {
        attemptId: bound.attempt.attemptId,
        generation: bound.attempt.generation,
        fenceToken: bound.attempt.fenceToken,
      },
    };
    const exact = {
      kind: "model_runtime" as const,
      runId: fixture.runId,
      storyId: fixture.storyId,
      claimId: bound.publication.claimId,
      claimAgentId: "recovery-agent",
      revisionId: handoff.revisionId,
      dispatchId: handoff.dispatchId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      leaseToken: handoff.lease.leaseToken,
      attempt: recoveryFence.attempt,
      runtimeSessionId: sessionId,
    };
    return {
      fixture,
      handoff,
      bound,
      sessionId,
      recoveryFence,
      exact,
      sessions: createRuntimeSessionRepository(database.sql),
      leases: createV3RecoveryOwnerLeaseRepository(database.sql),
    };
  }

  it("rejects a caller-selected model slice before attempt birth and preserves the null delivery pair", async () => {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "model-slice-authority-owner",
      leaseMs: 120_000,
      now: leaseAt,
    });
    const publication = await publish(fixture, handoff, {
      sessionId: `RTS_${"s".repeat(20)}-${sequence}`,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);
    await assert.rejects(
      createAttemptRepository(database.sql).reserve({
        ...modelReservationInput(fixture, handoff, publication!.claimId),
        sliceHash: "9".repeat(64),
      }),
      /RECOVERY_DELIVERY_SLICE_AUTHORITY_MISMATCH/,
    );
    const state = await database.sql<Array<{
      claim_id: string | null;
      attempt_id: string | null;
      execution_slice_hash: string | null;
      attempt_count: number;
      attempt_rows: number;
    }>>`
      SELECT delivery.claim_id::text,delivery.attempt_id,delivery.execution_slice_hash,
             delivery.attempt_count,
             (SELECT count(*)::integer FROM execution_attempts attempt
               WHERE attempt.recovery_dispatch_id=delivery.dispatch_id) AS attempt_rows
        FROM recovery_dispatch_deliveries delivery
       WHERE delivery.dispatch_id=${handoff.dispatchId}
    `;
    assert.deepEqual({ ...state[0]! }, {
      claim_id: null,
      attempt_id: null,
      execution_slice_hash: null,
      attempt_count: 0,
      attempt_rows: 0,
    });
  });

  it("rejects crossed and tampered immutable m33 scalars without attempt, pair, or owner-head residue", async () => {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "model-publication-tamper-owner",
      leaseMs: 120_000,
      now: leaseAt,
    });
    const publication = await publish(fixture, handoff, {
      sessionId: `RTS_${"t".repeat(20)}-${sequence}`,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);
    const original = (await database.sql<Array<{
      step_db_id: string;
      story_db_id: string;
      story_index: number;
      bound_at: Date;
      head_version: number;
    }>>`
      SELECT publication.step_db_id,publication.story_db_id,publication.story_index,
             publication.bound_at,head.head_version
        FROM internal_production_v3_recovery_claim_publications_v1 publication
        JOIN internal_production_owner_admission_head_v1 head ON head.singleton=TRUE
       WHERE publication.claim_id=${publication!.claimId}
    `)[0]!;
    const mutations: ReadonlyArray<Readonly<{ column: string; value: unknown }>> = [
      { column: "step_db_id", value: fixture.storyDbId },
      { column: "story_db_id", value: fixture.stepDbId },
      { column: "story_index", value: original.story_index + 1 },
      { column: "bound_at", value: new Date(original.bound_at.getTime() + 1) },
    ];
    await database.sql`ALTER TABLE internal_production_v3_recovery_claim_publications_v1 DISABLE TRIGGER ALL`;
    try {
      for (const mutation of mutations) {
        await database.sql.unsafe(
          `UPDATE internal_production_v3_recovery_claim_publications_v1 SET ${mutation.column}=$2 WHERE claim_id=$1`,
          [publication!.claimId, mutation.value],
        );
        await assert.rejects(
          createAttemptRepository(database.sql).reserve(
            modelReservationInput(fixture, handoff, publication!.claimId),
          ),
          /RECOVERY_ATTEMPT_CLAIM_PUBLICATION_(?:NOT_FOUND|MISMATCH)/,
          mutation.column,
        );
        await database.sql.unsafe(
          `UPDATE internal_production_v3_recovery_claim_publications_v1
              SET step_db_id=$2,story_db_id=$3,story_index=$4,bound_at=$5
            WHERE claim_id=$1`,
          [
            publication!.claimId,
            original.step_db_id,
            original.story_db_id,
            original.story_index,
            original.bound_at,
          ],
        );
      }
    } finally {
      await database.sql`ALTER TABLE internal_production_v3_recovery_claim_publications_v1 ENABLE TRIGGER ALL`;
    }
    const unchanged = (await database.sql<Array<{
      head_version: number;
      attempts: number;
      claim_id: string | null;
      attempt_id: string | null;
      execution_slice_hash: string | null;
      attempt_count: number;
    }>>`
      SELECT head.head_version,
             (SELECT count(*)::integer FROM execution_attempts attempt
               WHERE attempt.recovery_dispatch_id=${handoff.dispatchId}) AS attempts,
             delivery.claim_id::text,delivery.attempt_id,delivery.execution_slice_hash,
             delivery.attempt_count
        FROM internal_production_owner_admission_head_v1 head
        JOIN recovery_dispatch_deliveries delivery ON TRUE
       WHERE head.singleton=TRUE AND delivery.dispatch_id=${handoff.dispatchId}
    `)[0]!;
    assert.deepEqual({ ...unchanged }, {
      head_version: original.head_version,
      attempts: 0,
      claim_id: null,
      attempt_id: null,
      execution_slice_hash: null,
      attempt_count: 0,
    });
  });

  it("requires the exact fresh runtime clock and authorized dispatch chain before model attempt birth", async () => {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "model-fresh-birth-chain-owner",
      leaseMs: 120_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"u".repeat(20)}-${sequence}`;
    const publication = await publish(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);
    const original = (await database.sql<Array<{
      runtime_state: string;
      runtime_attempt_id: string | null;
      runtime_heartbeat_exact: boolean;
      bound_matches_claim: boolean;
      bound_matches_story: boolean;
      bound_not_after_runtime_creation: boolean;
      delivery_authorization_exact: boolean;
      delivery_lease_exact: boolean;
      case_owner: string;
      revision_owner: string;
      dispatch_class: string;
      handoff_canonical_json: string;
      handoff_hash: string;
      bound_at_text: string;
      claim_claimed_at_text: string;
      story_claimed_at_text: string;
      head_version: number;
    }>>`
      SELECT runtime.state AS runtime_state,runtime.attempt_id AS runtime_attempt_id,
             runtime.heartbeat_at=runtime.created_at AS runtime_heartbeat_exact,
             publication.bound_at=claim.claimed_at AS bound_matches_claim,
             publication.bound_at=story.claimed_at AS bound_matches_story,
             publication.bound_at<=runtime.created_at AS bound_not_after_runtime_creation,
             delivery.authorized_at=dispatch.authorized_at AS delivery_authorization_exact,
             delivery.lease_expires_at=(
               publication.handoff_canonical_json::jsonb#>>'{lease,expiresAt}'
             )::timestamptz AS delivery_lease_exact,
             recovery_case.owner AS case_owner,revision.owner AS revision_owner,
             dispatch.dispatch_class,publication.handoff_canonical_json,
             publication.handoff_hash,publication.bound_at::text AS bound_at_text,
             claim.claimed_at::text AS claim_claimed_at_text,
             story.claimed_at::text AS story_claimed_at_text,head.head_version
        FROM runtime_sessions runtime
        JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id=${handoff.dispatchId}
        JOIN recovery_revision_dispatches dispatch ON dispatch.dispatch_id=delivery.dispatch_id
        JOIN recovery_cases recovery_case ON recovery_case.recovery_case_id=delivery.recovery_case_id
        JOIN recovery_case_revisions revision ON revision.revision_id=delivery.revision_id
        JOIN internal_production_v3_recovery_claim_publications_v1 publication
          ON publication.runtime_session_id=runtime.session_id
        JOIN claim_log claim ON claim.id=publication.claim_id
        JOIN stories story ON story.id=publication.story_db_id
        JOIN internal_production_owner_admission_head_v1 head ON head.singleton=TRUE
       WHERE runtime.session_id=${sessionId}
    `)[0]!;
    assert.equal(original.runtime_state, "reserved");
    assert.equal(original.runtime_attempt_id, null);
    assert.equal(original.runtime_heartbeat_exact, true);
    assert.equal(original.bound_matches_claim, true);
    assert.equal(original.bound_matches_story, true);
    assert.equal(original.bound_not_after_runtime_creation, true);
    assert.equal(original.delivery_authorization_exact, true);
    assert.equal(original.delivery_lease_exact, true);

    const snapshot = async () => (await database.sql<Array<{
      attempts: number;
      claim_id: string | null;
      attempt_id: string | null;
      execution_slice_hash: string | null;
      attempt_count: number;
      head_version: number;
    }>>`
      SELECT (SELECT count(*)::integer FROM execution_attempts
               WHERE recovery_dispatch_id=${handoff.dispatchId}) AS attempts,
             delivery.claim_id::text,delivery.attempt_id,delivery.execution_slice_hash,
             delivery.attempt_count,head.head_version
        FROM recovery_dispatch_deliveries delivery
        JOIN internal_production_owner_admission_head_v1 head ON head.singleton=TRUE
       WHERE delivery.dispatch_id=${handoff.dispatchId}
    `)[0]!;
    const pristine = { ...await snapshot() };
    const reserve = () => createAttemptRepository(database.sql).reserve(
      modelReservationInput(fixture, handoff, publication!.claimId),
    );
    const cases: ReadonlyArray<Readonly<{
      name: string;
      mutate: () => Promise<unknown>;
      restore: () => Promise<unknown>;
    }>> = [
      {
        name: "runtime heartbeat",
        mutate: () => database.sql`UPDATE runtime_sessions SET heartbeat_at=heartbeat_at+interval '1 microsecond' WHERE session_id=${sessionId}`,
        restore: () => database.sql`UPDATE runtime_sessions SET heartbeat_at=heartbeat_at-interval '1 microsecond' WHERE session_id=${sessionId}`,
      },
      {
        name: "runtime creation clock",
        mutate: () => database.sql`UPDATE runtime_sessions SET created_at=created_at+interval '1 microsecond' WHERE session_id=${sessionId}`,
        restore: () => database.sql`UPDATE runtime_sessions SET created_at=created_at-interval '1 microsecond' WHERE session_id=${sessionId}`,
      },
      {
        name: "fresh runtime attempt id",
        mutate: () => database.sql`UPDATE runtime_sessions SET attempt_id=${`ATT_${"0".repeat(20)}`} WHERE session_id=${sessionId}`,
        restore: () => database.sql`UPDATE runtime_sessions SET attempt_id=NULL WHERE session_id=${sessionId}`,
      },
      {
        name: "delivery authorized_at",
        mutate: () => database.sql`UPDATE recovery_dispatch_deliveries SET authorized_at=authorized_at+interval '1 microsecond' WHERE dispatch_id=${handoff.dispatchId}`,
        restore: () => database.sql`UPDATE recovery_dispatch_deliveries SET authorized_at=authorized_at-interval '1 microsecond' WHERE dispatch_id=${handoff.dispatchId}`,
      },
      {
        name: "dispatch authorized_at",
        mutate: () => database.sql`UPDATE recovery_revision_dispatches SET authorized_at=authorized_at+interval '1 microsecond' WHERE dispatch_id=${handoff.dispatchId}`,
        restore: () => database.sql`UPDATE recovery_revision_dispatches SET authorized_at=authorized_at-interval '1 microsecond' WHERE dispatch_id=${handoff.dispatchId}`,
      },
      {
        name: "delivery lease expiry",
        mutate: () => database.sql`UPDATE recovery_dispatch_deliveries SET lease_expires_at=lease_expires_at+interval '1 microsecond' WHERE dispatch_id=${handoff.dispatchId}`,
        restore: () => database.sql`UPDATE recovery_dispatch_deliveries SET lease_expires_at=lease_expires_at-interval '1 microsecond' WHERE dispatch_id=${handoff.dispatchId}`,
      },
      {
        name: "m33 bound clock",
        mutate: () => database.sql`UPDATE internal_production_v3_recovery_claim_publications_v1 SET bound_at=bound_at+interval '1 microsecond' WHERE claim_id=${publication!.claimId}`,
        restore: () => database.sql`UPDATE internal_production_v3_recovery_claim_publications_v1 SET bound_at=bound_at-interval '1 microsecond' WHERE claim_id=${publication!.claimId}`,
      },
      {
        name: "claim clock",
        mutate: () => database.sql`UPDATE claim_log SET claimed_at=claimed_at+interval '1 microsecond' WHERE id=${publication!.claimId}`,
        restore: () => database.sql`UPDATE claim_log SET claimed_at=claimed_at-interval '1 microsecond' WHERE id=${publication!.claimId}`,
      },
      {
        name: "story claim clock",
        mutate: () => database.sql`UPDATE stories SET claimed_at=claimed_at+interval '1 microsecond' WHERE id=${fixture.storyDbId}`,
        restore: () => database.sql`UPDATE stories SET claimed_at=claimed_at-interval '1 microsecond' WHERE id=${fixture.storyDbId}`,
      },
      {
        name: "m33 bound after runtime creation",
        mutate: async () => {
          await database.sql`
            UPDATE internal_production_v3_recovery_claim_publications_v1 publication
               SET bound_at=(SELECT created_at+interval '1 microsecond'
                               FROM runtime_sessions WHERE session_id=${sessionId})
             WHERE claim_id=${publication!.claimId}
          `;
          await database.sql`
            UPDATE claim_log
               SET claimed_at=(SELECT bound_at FROM internal_production_v3_recovery_claim_publications_v1
                                WHERE claim_id=${publication!.claimId})
             WHERE id=${publication!.claimId}
          `;
          await database.sql`
            UPDATE stories
               SET claimed_at=(SELECT bound_at FROM internal_production_v3_recovery_claim_publications_v1
                                WHERE claim_id=${publication!.claimId})
             WHERE id=${fixture.storyDbId}
          `;
        },
        restore: async () => {
          await database.sql`UPDATE stories SET claimed_at=${original.story_claimed_at_text}::timestamptz WHERE id=${fixture.storyDbId}`;
          await database.sql`UPDATE claim_log SET claimed_at=${original.claim_claimed_at_text}::timestamptz WHERE id=${publication!.claimId}`;
          await database.sql`UPDATE internal_production_v3_recovery_claim_publications_v1 SET bound_at=${original.bound_at_text}::timestamptz WHERE claim_id=${publication!.claimId}`;
        },
      },
      {
        name: "canonical supervisor owner under product dispatch",
        mutate: async () => {
          const crossedHandoff = {
            ...(JSON.parse(original.handoff_canonical_json) as Record<string, unknown>),
            recoveryOwner: "supervisor",
          };
          const crossedCanonical = canonicalJsonStringify(crossedHandoff);
          await database.sql`UPDATE recovery_cases SET owner='supervisor' WHERE recovery_case_id=${handoff.recoveryCaseId}`;
          await database.sql`UPDATE recovery_case_revisions SET owner='supervisor' WHERE revision_id=${handoff.revisionId}`;
          await database.sql`
            UPDATE internal_production_v3_recovery_claim_publications_v1
               SET handoff_canonical_json=${crossedCanonical},
                   handoff_hash=${hashCanonicalJson(crossedHandoff)}
             WHERE claim_id=${publication!.claimId}
          `;
        },
        restore: async () => {
          await database.sql`
            UPDATE internal_production_v3_recovery_claim_publications_v1
               SET handoff_canonical_json=${original.handoff_canonical_json},
                   handoff_hash=${original.handoff_hash}
             WHERE claim_id=${publication!.claimId}
          `;
          await database.sql`UPDATE recovery_cases SET owner=${original.case_owner} WHERE recovery_case_id=${handoff.recoveryCaseId}`;
          await database.sql`UPDATE recovery_case_revisions SET owner=${original.revision_owner} WHERE revision_id=${handoff.revisionId}`;
        },
      },
      {
        name: "starting fresh runtime",
        mutate: () => database.sql`UPDATE runtime_sessions SET state='starting' WHERE session_id=${sessionId}`,
        restore: () => database.sql`UPDATE runtime_sessions SET state=${original.runtime_state} WHERE session_id=${sessionId}`,
      },
    ];
    await database.sql`ALTER TABLE runtime_sessions DISABLE TRIGGER ALL`;
    await database.sql`ALTER TABLE recovery_dispatch_deliveries DISABLE TRIGGER ALL`;
    await database.sql`ALTER TABLE recovery_revision_dispatches DISABLE TRIGGER ALL`;
    await database.sql`ALTER TABLE recovery_cases DISABLE TRIGGER ALL`;
    await database.sql`ALTER TABLE recovery_case_revisions DISABLE TRIGGER ALL`;
    await database.sql`ALTER TABLE internal_production_v3_recovery_claim_publications_v1 DISABLE TRIGGER ALL`;
    await database.sql`ALTER TABLE claim_log DISABLE TRIGGER ALL`;
    await database.sql`ALTER TABLE stories DISABLE TRIGGER ALL`;
    try {
      for (const mutation of cases) {
        await mutation.mutate();
        try {
          await assert.rejects(reserve, /RECOVERY_ATTEMPT_CLAIM_PUBLICATION_MISMATCH/, mutation.name);
        } finally {
          await mutation.restore();
        }
        assert.deepEqual({ ...await snapshot() }, pristine, `${mutation.name} left birth residue`);
      }
    } finally {
      await database.sql`ALTER TABLE stories ENABLE TRIGGER ALL`;
      await database.sql`ALTER TABLE claim_log ENABLE TRIGGER ALL`;
      await database.sql`ALTER TABLE internal_production_v3_recovery_claim_publications_v1 ENABLE TRIGGER ALL`;
      await database.sql`ALTER TABLE recovery_case_revisions ENABLE TRIGGER ALL`;
      await database.sql`ALTER TABLE recovery_cases ENABLE TRIGGER ALL`;
      await database.sql`ALTER TABLE recovery_revision_dispatches ENABLE TRIGGER ALL`;
      await database.sql`ALTER TABLE recovery_dispatch_deliveries ENABLE TRIGGER ALL`;
      await database.sql`ALTER TABLE runtime_sessions ENABLE TRIGGER ALL`;
    }
  });

  it("allows supervisor repair only for the supervisor owner and starting only as an exact complete replay", async () => {
    const supervisorFixture = await setup({
      owner: "supervisor",
      dispatchClass: "supervisor_repair",
    });
    const supervisorLeaseAt = new Date(Date.now() - 1_000);
    const supervisorHandoff = await lease(supervisorFixture, {
      ownerInstanceId: "supervisor-model-birth-owner",
      leaseMs: 120_000,
      now: supervisorLeaseAt,
    });
    const supervisorPublication = await publish(supervisorFixture, supervisorHandoff, {
      sessionId: `RTS_${"v".repeat(20)}-${sequence}`,
      now: new Date(supervisorLeaseAt.getTime() + 100),
    });
    assert.ok(supervisorPublication);
    const supervisorReservation = await createAttemptRepository(database.sql).reserve(
      modelReservationInput(supervisorFixture, supervisorHandoff, supervisorPublication!.claimId),
    );
    assert.equal(supervisorReservation.status, "reserved");
    assert.equal(supervisorReservation.attempt.attemptClass, "supervisor_repair");

    const replayFixture = await setup();
    const replayLeaseAt = new Date(Date.now() - 1_000);
    const replayHandoff = await lease(replayFixture, {
      ownerInstanceId: "starting-complete-replay-owner",
      leaseMs: 120_000,
      now: replayLeaseAt,
    });
    const sessionId = `RTS_${"w".repeat(20)}-${sequence}`;
    const replayPublication = await publish(replayFixture, replayHandoff, {
      sessionId,
      now: new Date(replayLeaseAt.getTime() + 100),
    });
    assert.ok(replayPublication);
    const input = modelReservationInput(replayFixture, replayHandoff, replayPublication!.claimId);
    const attempts = createAttemptRepository(database.sql);
    const first = await attempts.reserve(input);
    assert.equal(first.status, "reserved");
    const sessions = createRuntimeSessionRepository(database.sql);
    await sessions.bindAttempt({
      sessionId,
      attemptId: first.attempt.attemptId,
      ownerInstanceId: replayHandoff.lease.ownerInstanceId,
    });
    await sessions.markStarting({
      sessionId,
      ownerInstanceId: replayHandoff.lease.ownerInstanceId,
      recoveryFence: {
        revisionId: replayHandoff.revisionId,
        dispatchId: replayHandoff.dispatchId,
        leaseToken: replayHandoff.lease.leaseToken,
        attempt: {
          attemptId: first.attempt.attemptId,
          generation: first.attempt.generation,
          fenceToken: first.attempt.fenceToken,
        },
      },
    });
    const replaySnapshot = async () => (await database.sql<Array<{
      head_version: number;
      attempt_count: number;
      delivery_state: string;
      delivery_claim_id: string;
      delivery_attempt_id: string;
      delivery_slice_hash: string;
      runtime_state: string;
      runtime_attempt_id: string;
    }>>`
      SELECT head.head_version,delivery.attempt_count,
             delivery.state AS delivery_state,delivery.claim_id::text AS delivery_claim_id,
             delivery.attempt_id AS delivery_attempt_id,
             delivery.execution_slice_hash AS delivery_slice_hash,
             runtime.state AS runtime_state,runtime.attempt_id AS runtime_attempt_id
        FROM internal_production_owner_admission_head_v1 head
        JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id=${replayHandoff.dispatchId}
        JOIN runtime_sessions runtime ON runtime.session_id=${sessionId}
       WHERE head.singleton=TRUE
    `)[0]!;
    const pristineReplay = { ...await replaySnapshot() };
    await database.sql`
      UPDATE recovery_dispatch_deliveries
         SET lease_expires_at=lease_expires_at+interval '1 microsecond'
       WHERE dispatch_id=${replayHandoff.dispatchId}
    `;
    try {
      const leaseIdentity = await database.sql<Array<{ exact: boolean }>>`
        SELECT delivery.lease_expires_at=(
                 publication.handoff_canonical_json::jsonb#>>'{lease,expiresAt}'
               )::timestamptz AS exact
          FROM recovery_dispatch_deliveries delivery
          JOIN internal_production_v3_recovery_claim_publications_v1 publication
            ON publication.dispatch_id=delivery.dispatch_id
         WHERE delivery.dispatch_id=${replayHandoff.dispatchId}
      `;
      assert.equal(leaseIdentity[0]?.exact, false);
      await assert.rejects(
        attempts.reserve(input),
        /RECOVERY_ATTEMPT_CLAIM_PUBLICATION_MISMATCH/,
      );
      assert.deepEqual({ ...await replaySnapshot() }, pristineReplay);
    } finally {
      await database.sql`
        UPDATE recovery_dispatch_deliveries
           SET lease_expires_at=lease_expires_at-interval '1 microsecond'
         WHERE dispatch_id=${replayHandoff.dispatchId}
      `;
    }
    const replay = await attempts.reserve(input);
    assert.equal(replay.status, "duplicate");
    assert.equal(replay.attempt.attemptId, first.attempt.attemptId);
  });

  it("completes a real model-recovery story through the envelope claim and closes both exact owners", async () => {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "model-story-completion-owner",
      leaseMs: 120_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"c".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start: true,
    });
    const sourceAfter = handoff.directive.sourceRevision;
    const attempts = createAttemptRepository(database.sql);
    assert.equal((await attempts.recordCandidateSource({
      attemptId: bound.attempt.attemptId,
      generation: bound.attempt.generation,
      fenceToken: bound.attempt.fenceToken,
      sourceAfter,
    })).status, "candidate");
    const envelope: ClaimEnvelopeV1 = {
        schema: "setfarm.claim-envelope.v1",
        protocol: "v3",
        issuedAt: new Date().toISOString(),
        stepId: fixture.stepDbId,
        workflowStepId: "implement",
        runId: fixture.runId,
        storyId: fixture.storyId,
        storyDbId: fixture.storyDbId,
        claimId: bound.publication.claimId,
        claimAgentId: "recovery-agent",
        runtimeAgentId: "recovery-runtime-agent",
        claimGeneration: bound.publication.claimGeneration,
        attempt: {
          attemptId: bound.attempt.attemptId,
          generation: bound.attempt.generation,
          fenceToken: bound.attempt.fenceToken,
        },
    };
    const requestId = `RCR_${createHash("sha256").update(sessionId).digest("hex").slice(0, 24)}`;
    const completionOutput = "{}";
    const completionOutputHash = createHash("sha256").update(completionOutput, "utf8").digest("hex");
    const submissionEvidence = {
      schema: "setfarm.runtime-completion-submission-evidence.v1",
      compiler: "setfarm.v3-implementation-output-compilation.v1",
      sourceSchema: "setfarm.v3-implementation-agent-proposal.v1",
      sourceProposalHash: completionOutputHash,
      canonicalOutputHash: completionOutputHash,
      ignoredFieldPaths: [],
    };
    const completionLease = new Date(Date.now() + 60_000);
    await database.sql`
      INSERT INTO runtime_completion_requests (
        request_id,runtime_session_id,claim_id,run_id,step_db_id,workflow_step_id,
        story_db_id,story_id,attempt_id,claim_envelope,output,output_hash,
        source_proposal,submission_evidence,
        apply_phase,state,requested_by,owner_instance_id,lease_expires_at,
        owner_attempt_count,requested_at,drained_at,processing_at,result
      ) VALUES (
        ${requestId},${sessionId},${bound.publication.claimId},${fixture.runId},${fixture.stepDbId},'implement',
        ${fixture.storyDbId},${fixture.storyId},${bound.attempt.attemptId},${database.sql.json(envelope)},
        ${completionOutput},${completionOutputHash},${completionOutput},${database.sql.json(submissionEvidence)},
        'executing','processing','recovery-runtime-agent',
        ${handoff.lease.ownerInstanceId},${completionLease},1,clock_timestamp(),clock_timestamp(),clock_timestamp(),'{}'::jsonb
      )
    `;
    const sessions = createRuntimeSessionRepository(database.sql);
    await sessions.requestDrain({
      sessionId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      diagnostic: "real recovery completion regression",
    });
    await sessions.markDrained({
      sessionId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      evidence: STORY_ADMISSION_DRAIN_EVIDENCE,
    });
    const result = await runWithRuntimeCompletionOwner({
      requestId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      leaseExpiresAt: completionLease.toISOString(),
      ownerAttemptCount: 1,
    }, () => completeStoryClaimAndBoundAttempt(database.sql, {
      envelope,
      sourceAfter,
      outputHash: completionOutputHash,
      attemptDisposition: "verified",
      evidenceRefs: ["setfarm://test/model-recovery-story-completion"],
      storyStatus: "done",
      storyOutput: "STATUS: done",
      stepStatus: "running",
      stepOutput: "STATUS: done",
      completionPlan: createSingleEffectCompletionPlanDescriptorV1({
        kind: "story_completion",
        continuation: { type: "story_loop_continue" },
        subject: { storyDbId: fixture.storyDbId, storyId: fixture.storyId },
        effectPayload: { stepId: "implement", storyId: fixture.storyId },
      }),
    }));
    assert.equal(result.status, "completed");
    const owners = await database.sql<Array<{ category: string; state: string }>>`
      SELECT category,state
        FROM internal_production_owner_reservations_v1
       WHERE (category='claim' AND owner_key=${String(bound.publication.claimId)})
          OR (category='execution-attempt' AND owner_key=${bound.attempt.attemptId})
       ORDER BY category
    `;
    assert.deepEqual(owners.map((row) => ({ ...row })), [
      { category: "claim", state: "closed" },
      { category: "execution-attempt", state: "closed" },
    ]);
  });

  it("linearizes attempt birth and pre-birth expiry in both run-lock orders and uses waiter-side database time", async () => {
    const birthFirstFixture = await setup();
    const birthFirstAt = new Date(Date.now() - 1_000);
    const birthFirstHandoff = await lease(birthFirstFixture, {
      ownerInstanceId: "birth-first-owner",
      leaseMs: 120_000,
      now: birthFirstAt,
    });
    const birthFirstPublication = await publish(birthFirstFixture, birthFirstHandoff, {
      sessionId: `RTS_${"b".repeat(20)}-${sequence}`,
      now: new Date(birthFirstAt.getTime() + 100),
    });
    assert.ok(birthFirstPublication);
    const birthFirstLatch = await holdRunRow(birthFirstFixture.runId);
    const winningBirth = createAttemptRepository(database.sql).reserve(
      modelReservationInput(birthFirstFixture, birthFirstHandoff, birthFirstPublication!.claimId),
    );
    await waitForBlockedRunLock(birthFirstFixture.runId, 1);
    const losingExpiry = createV3RecoveryLifecycleReconciler(database.sql).reconcileActive({
      runId: birthFirstFixture.runId,
    });
    await waitForBlockedRunLock(birthFirstFixture.runId, 2);
    birthFirstLatch.release();
    await birthFirstLatch.done;
    assert.equal((await winningBirth).status, "reserved");
    const afterBirth = await losingExpiry;
    assert.equal(afterBirth.counts.rolledBackPublications, 0);
    assert.equal((await birthFirstFixture.deliveries.findDelivery(birthFirstHandoff.dispatchId))?.state, "attempt_reserved");

    const expiryFirstFixture = await setup();
    const expiryFirstAt = new Date();
    const expiryFirstHandoff = await lease(expiryFirstFixture, {
      ownerInstanceId: "expiry-first-owner",
      leaseMs: 30_000,
      now: expiryFirstAt,
    });
    const expiryFirstPublication = await publish(expiryFirstFixture, expiryFirstHandoff, {
      sessionId: `RTS_${"e".repeat(20)}-${sequence}`,
      now: new Date(Date.now() + 100),
    });
    assert.ok(expiryFirstPublication);
    const authenticPreBirth = (await database.sql<Array<{
      runtime_state: string;
      story_status: string;
      step_status: string;
      delivery_before_claim: boolean;
      claim_before_runtime: boolean;
      runtime_heartbeat_exact: boolean;
      runtime_before_expiry: boolean;
    }>>`
      SELECT runtime.state AS runtime_state,story.status AS story_status,step.status AS step_status,
             delivery.updated_at <= claim.claimed_at AS delivery_before_claim,
             claim.claimed_at <= runtime.created_at AS claim_before_runtime,
             runtime.created_at = runtime.heartbeat_at AS runtime_heartbeat_exact,
             runtime.created_at <= delivery.lease_expires_at AS runtime_before_expiry
        FROM internal_production_v3_recovery_claim_publications_v1 publication
        JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id=publication.dispatch_id
        JOIN claim_log claim ON claim.id=publication.claim_id
        JOIN runtime_sessions runtime ON runtime.session_id=publication.runtime_session_id
        JOIN steps step ON step.id=publication.step_db_id
        JOIN stories story ON story.id=publication.story_db_id
       WHERE publication.claim_id=${expiryFirstPublication!.claimId}
    `)[0]!;
    assert.deepEqual({ ...authenticPreBirth }, {
      runtime_state: "reserved",
      story_status: "running",
      step_status: "running",
      delivery_before_claim: true,
      claim_before_runtime: true,
      runtime_heartbeat_exact: true,
      runtime_before_expiry: true,
    });
    await database.sql.unsafe(
      `SELECT pg_sleep(GREATEST(EXTRACT(EPOCH FROM (
         (SELECT lease_expires_at FROM recovery_dispatch_deliveries WHERE dispatch_id=$1)
         - clock_timestamp())) + 0.05, 0))`,
      [expiryFirstHandoff.dispatchId],
    );
    const expiryFirstLatch = await holdRunRow(expiryFirstFixture.runId);
    const winningExpiry = createV3RecoveryLifecycleReconciler(database.sql).reconcileActive({
      runId: expiryFirstFixture.runId,
    });
    await waitForBlockedRunLock(expiryFirstFixture.runId, 1);
    const losingBirth = createAttemptRepository(database.sql).reserve(
      modelReservationInput(expiryFirstFixture, expiryFirstHandoff, expiryFirstPublication!.claimId),
    );
    await waitForBlockedRunLock(expiryFirstFixture.runId, 2);
    expiryFirstLatch.release();
    await expiryFirstLatch.done;
    const [expiryResult, birthResult] = await Promise.allSettled([winningExpiry, losingBirth]);
    assert.equal(expiryResult.status, "fulfilled");
    assert.equal(expiryResult.status === "fulfilled" ? expiryResult.value.counts.rolledBackPublications : 0, 1);
    assert.equal(birthResult.status, "rejected");
    assert.equal((await expiryFirstFixture.deliveries.findDelivery(expiryFirstHandoff.dispatchId))?.state, "blocked");

    const waiterFixture = await setup();
    const waiterAt = new Date();
    const waiterHandoff = await lease(waiterFixture, {
      ownerInstanceId: "database-time-waiter-owner",
      leaseMs: 30_000,
      now: waiterAt,
    });
    const waiterPublication = await publish(waiterFixture, waiterHandoff, {
      sessionId: `RTS_${"w".repeat(20)}-${sequence}`,
      now: new Date(waiterAt.getTime() + 100),
    });
    assert.ok(waiterPublication);
    const waiterLatch = await holdRunRow(waiterFixture.runId);
    const waitingBirth = createAttemptRepository(database.sql).reserve(
      modelReservationInput(waiterFixture, waiterHandoff, waiterPublication!.claimId),
    );
    await waitForBlockedRunLock(waiterFixture.runId, 1);
    await database.sql.unsafe(
      `SELECT pg_sleep(GREATEST(EXTRACT(EPOCH FROM (
         (SELECT lease_expires_at FROM recovery_dispatch_deliveries WHERE dispatch_id=$1)
         - clock_timestamp())) + 0.05, 0))`,
      [waiterHandoff.dispatchId],
    );
    waiterLatch.release();
    await waiterLatch.done;
    await assert.rejects(waitingBirth, /RECOVERY_DELIVERY_LEASE_INVALID/);
    const waiterState = await database.sql<Array<{ attempts: number; claim_id: string | null; attempt_id: string | null }>>`
      SELECT (SELECT count(*)::integer FROM execution_attempts attempt
               WHERE attempt.recovery_dispatch_id=delivery.dispatch_id) AS attempts,
             delivery.claim_id::text,delivery.attempt_id
        FROM recovery_dispatch_deliveries delivery
       WHERE delivery.dispatch_id=${waiterHandoff.dispatchId}
    `;
    assert.deepEqual({ ...waiterState[0]! }, { attempts: 0, claim_id: null, attempt_id: null });
  });

  it("heartbeats runtime, attempt and delivery atomically and rejects a second owner", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "canonical-model-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"h".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      replay: true,
    });
    const heartbeatAt = new Date(leaseAt.getTime() + 1_000);
    const leases = createV3RecoveryOwnerLeaseRepository(database.sql);
    const exactInput = {
      kind: "model_runtime" as const,
      runId: fixture.runId,
      storyId: fixture.storyId,
      claimId: bound.publication.claimId,
      claimAgentId: "recovery-agent",
      revisionId: handoff.revisionId,
      dispatchId: handoff.dispatchId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      leaseToken: handoff.lease.leaseToken,
      attempt: {
        attemptId: bound.attempt.attemptId,
        generation: bound.attempt.generation,
        fenceToken: bound.attempt.fenceToken,
      },
      runtimeSessionId: sessionId,
    };
    const [retained, forged] = await Promise.all([
      leases.heartbeat(exactInput, { now: heartbeatAt, leaseMs: 120_000 }),
      leases.heartbeat({ ...exactInput, ownerInstanceId: "forged-second-owner" }, {
        now: heartbeatAt,
        leaseMs: 120_000,
      }),
    ]);
    assert.equal(retained.status, "retained");
    assert.equal(forged.status, "stale_fence");
    if (retained.status !== "retained") throw new Error("expected retained owner heartbeat");
    const rows = await database.sql.unsafe<Array<{
      runtime_heartbeat: Date;
      attempt_heartbeat: Date;
      attempt_expiry: Date;
      delivery_expiry: Date;
    }>>(
      `SELECT runtime.heartbeat_at AS runtime_heartbeat,
              attempt.heartbeat_at AS attempt_heartbeat,
              attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM runtime_sessions runtime
         JOIN execution_attempts attempt ON attempt.attempt_id = runtime.attempt_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE runtime.session_id = $1`,
      [sessionId],
    );
    assert.equal(rows[0]?.runtime_heartbeat.toISOString(), rows[0]?.attempt_heartbeat.toISOString());
    assert.equal(rows[0]?.attempt_expiry.toISOString(), retained.expiresAt);
    assert.equal(rows[0]?.delivery_expiry.toISOString(), retained.expiresAt);
    assert.equal(
      rows[0]!.attempt_expiry.getTime() - rows[0]!.attempt_heartbeat.getTime(),
      120_000,
      "one fresh DB wall-clock instant must drive heartbeat and expiry",
    );
  });

  it("relinquishes only the exact active owner leases without terminalizing product state", async () => {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "relinquish-owner",
      leaseMs: 120_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"r".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start: false,
    });
    const exact = {
      kind: "model_runtime" as const,
      runId: fixture.runId,
      storyId: fixture.storyId,
      claimId: bound.publication.claimId,
      claimAgentId: "recovery-agent",
      revisionId: handoff.revisionId,
      dispatchId: handoff.dispatchId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      leaseToken: handoff.lease.leaseToken,
      attempt: {
        attemptId: bound.attempt.attemptId,
        generation: bound.attempt.generation,
        fenceToken: bound.attempt.fenceToken,
      },
      runtimeSessionId: sessionId,
    };
    const repository = createV3RecoveryOwnerLeaseRepository(database.sql);
    for (const forged of [
      { ...exact, ownerInstanceId: "forged-owner" },
      { ...exact, leaseToken: "forged-lease-token-000000" },
      { ...exact, claimAgentId: "forged-claim-agent" },
      { ...exact, claimId: exact.claimId + 100_000 },
      { ...exact, revisionId: `RREV_${"0".repeat(64)}` },
      { ...exact, dispatchId: `RDISP_${"0".repeat(64)}` },
      { ...exact, runtimeSessionId: `RTS_${"x".repeat(20)}-${sequence}` },
      { ...exact, attempt: { ...exact.attempt, attemptId: `ATT_${"x".repeat(20)}` } },
      { ...exact, attempt: { ...exact.attempt, generation: exact.attempt.generation + 1 } },
      { ...exact, attempt: { ...exact.attempt, fenceToken: "forged-fence-token-000000" } },
    ]) {
      assert.equal((await repository.relinquish(forged)).status, "stale_fence");
    }

    const result = await repository.relinquish(exact);
    assert.equal(result.status, "relinquished");
    if (result.status !== "relinquished") throw new Error("expected exact relinquish");
    const rows = await database.sql.unsafe<Array<{
      claim_outcome: string | null;
      story_status: string;
      step_status: string;
      attempt_disposition: string;
      delivery_state: string;
      attempt_expiry: Date;
      delivery_expiry: Date;
    }>>(
      `SELECT claim.outcome AS claim_outcome, story.status AS story_status,
              step.status AS step_status, attempt.disposition AS attempt_disposition,
              delivery.state AS delivery_state,
              attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM claim_log claim
         JOIN stories story ON story.run_id = claim.run_id AND story.story_id = claim.story_id
         JOIN steps step ON step.run_id = claim.run_id AND step.step_id = claim.step_id
         JOIN execution_attempts attempt ON attempt.claim_id = claim.id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE claim.id = $1`,
      [exact.claimId],
    );
    assert.deepEqual({
      claimOutcome: rows[0]?.claim_outcome,
      storyStatus: rows[0]?.story_status,
      stepStatus: rows[0]?.step_status,
      attemptDisposition: rows[0]?.attempt_disposition,
      deliveryState: rows[0]?.delivery_state,
    }, {
      claimOutcome: null,
      storyStatus: "running",
      stepStatus: "running",
      attemptDisposition: "claimed",
      deliveryState: "attempt_reserved",
    });
    assert.equal(rows[0]?.attempt_expiry.toISOString(), result.relinquishedAt);
    assert.equal(rows[0]?.delivery_expiry.toISOString(), result.relinquishedAt);
  });

  it("hard-fences runtime start in both orders around exact relinquish", async () => {
    const relinquishFirst = await makeModelOwner("relinquish-first", false);
    const firstBarrier = await holdStoryAdvisory(
      relinquishFirst.fixture.runId,
      relinquishFirst.fixture.storyId,
    );
    const relinquishPending = relinquishFirst.leases.relinquish(relinquishFirst.exact);
    await waitForBlockedStoryAdvisory(1);
    const startPending = relinquishFirst.sessions.markStarting({
      sessionId: relinquishFirst.sessionId,
      ownerInstanceId: relinquishFirst.handoff.lease.ownerInstanceId,
      recoveryFence: relinquishFirst.recoveryFence,
    });
    await waitForBlockedStoryAdvisory(2);
    firstBarrier.release();
    await firstBarrier.done;
    assert.equal((await relinquishPending).status, "relinquished");
    await assert.rejects(startPending, /RUNTIME_SESSION_RECOVERY_ATTEMPT_FENCE_STALE/);

    const startFirst = await makeModelOwner("start-first", false);
    const secondBarrier = await holdStoryAdvisory(startFirst.fixture.runId, startFirst.fixture.storyId);
    const startFirstPending = startFirst.sessions.markStarting({
      sessionId: startFirst.sessionId,
      ownerInstanceId: startFirst.handoff.lease.ownerInstanceId,
      recoveryFence: startFirst.recoveryFence,
    });
    await waitForBlockedStoryAdvisory(1);
    const relinquishSecondPending = startFirst.leases.relinquish(startFirst.exact);
    await waitForBlockedStoryAdvisory(2);
    secondBarrier.release();
    await secondBarrier.done;
    assert.equal((await startFirstPending).state, "starting");
    assert.equal((await relinquishSecondPending).status, "relinquished");
    await assert.rejects(
      startFirst.sessions.markRunning({
        sessionId: startFirst.sessionId,
        ownerInstanceId: startFirst.handoff.lease.ownerInstanceId,
        recoveryFence: startFirst.recoveryFence,
      }),
      /RUNTIME_SESSION_RECOVERY_ATTEMPT_FENCE_STALE/,
    );
  });

  it("cannot revive a lease that expires while heartbeat or relinquish waits on the owner lock", async () => {
    const runBlockedExpiry = async (
      label: string,
      operation: (owner: Awaited<ReturnType<typeof makeModelOwner>>) => Promise<{ status: string }>,
    ) => {
      const owner = await makeModelOwner(label);
      const barrier = await holdStoryAdvisory(owner.fixture.runId, owner.fixture.storyId);
      await database.sql.begin(async (transaction) => {
        const times = await transaction.unsafe<Array<{ expires_at: Date }>>(
          "SELECT clock_timestamp() + INTERVAL '350 milliseconds' AS expires_at",
        );
        const expiresAt = times[0]!.expires_at;
        await transaction.unsafe(
          `UPDATE execution_attempts SET lease_expires_at = $2
            WHERE attempt_id = $1`,
          [owner.bound.attempt.attemptId, expiresAt],
        );
        await transaction.unsafe(
          `UPDATE recovery_dispatch_deliveries SET lease_expires_at = $2
            WHERE dispatch_id = $1`,
          [owner.handoff.dispatchId, expiresAt],
        );
      });
      const pending = operation(owner);
      await waitForBlockedStoryAdvisory(1);
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      barrier.release();
      await barrier.done;
      const result = await pending;
      assert.equal(result.status, "stale_fence");
      const rows = await database.sql.unsafe<Array<{
        attempt_expiry: Date;
        delivery_expiry: Date;
        db_now: Date;
      }>>(
        `SELECT attempt.lease_expires_at AS attempt_expiry,
                delivery.lease_expires_at AS delivery_expiry,
                clock_timestamp() AS db_now
           FROM execution_attempts attempt
           JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
          WHERE attempt.attempt_id = $1`,
        [owner.bound.attempt.attemptId],
      );
      assert.ok(rows[0]!.attempt_expiry.getTime() <= rows[0]!.db_now.getTime());
      assert.equal(rows[0]!.attempt_expiry.toISOString(), rows[0]!.delivery_expiry.toISOString());
    };

    await runBlockedExpiry("heartbeat-expiry", (owner) => owner.leases.heartbeat(
      owner.exact,
      { now: new Date("2000-01-01T00:00:00.000Z"), leaseMs: 120_000 },
    ));
    await runBlockedExpiry("relinquish-expiry", (owner) => owner.leases.relinquish(owner.exact));
  });

  it("linearizes simultaneous relinquish before heartbeat to one durable owner outcome", async () => {
    const owner = await makeModelOwner("heartbeat-relinquish");
    const barrier = await holdStoryAdvisory(owner.fixture.runId, owner.fixture.storyId);
    const relinquishPending = owner.leases.relinquish(owner.exact);
    await waitForBlockedStoryAdvisory(1);
    const heartbeatPending = owner.leases.heartbeat(owner.exact, {
      now: new Date("2000-01-01T00:00:00.000Z"),
      leaseMs: 120_000,
    });
    await waitForBlockedStoryAdvisory(2);
    barrier.release();
    await barrier.done;
    assert.equal((await relinquishPending).status, "relinquished");
    assert.equal((await heartbeatPending).status, "stale_fence");
  });

  it("relinquishes every nonreleased recovery runtime state without mutating product state", async () => {
    for (const state of ["running", "drain_requested", "drained", "quarantined"] as const) {
      const owner = await makeModelOwner(`state-${state}`);
      if (state === "running") {
        assert.equal((await owner.sessions.markRunning({
          sessionId: owner.sessionId,
          ownerInstanceId: owner.handoff.lease.ownerInstanceId,
          recoveryFence: owner.recoveryFence,
        })).status, "running");
      }
      if (["drain_requested", "drained"].includes(state)) {
        assert.equal((await owner.sessions.requestDrain({
          sessionId: owner.sessionId,
          ownerInstanceId: owner.handoff.lease.ownerInstanceId,
          diagnostic: `fixture ${state}`,
        })).state, "drain_requested");
      }
      if (state === "drained") {
        assert.equal((await owner.sessions.markDrained({
          sessionId: owner.sessionId,
          ownerInstanceId: owner.handoff.lease.ownerInstanceId,
          evidence: {
            schema: "setfarm.runtime-drain-evidence.v1",
            observedAt: new Date().toISOString(),
            localProcessAbsent: true,
            openClawTaskAbsent: true,
            workspaceProcessAbsent: true,
            stableObservations: 2,
            evidenceRefs: ["setfarm://test/relinquish-state-matrix"],
          },
        })).state, "drained");
      }
      if (state === "quarantined") {
        const current = await owner.sessions.findById(owner.sessionId);
        assert.ok(current);
        assert.equal((await owner.sessions.quarantine({
          sessionId: owner.sessionId,
          expectedOwnerInstanceId: owner.handoff.lease.ownerInstanceId,
          expectedStateVersion: current.stateVersion,
          diagnostic: "fixture quarantined owner",
        })).state, "quarantined");
      }
      assert.equal((await owner.leases.relinquish(owner.exact)).status, "relinquished");
      const product = await database.sql.unsafe<Array<{
        claim_outcome: string | null;
        story_status: string;
      }>>(
        `SELECT claim.outcome AS claim_outcome, story.status AS story_status
           FROM claim_log claim
           JOIN stories story ON story.run_id = claim.run_id AND story.story_id = claim.story_id
          WHERE claim.id = $1`,
        [owner.exact.claimId],
      );
      assert.equal(product[0]?.claim_outcome, null);
      assert.equal(product[0]?.story_status, "running");
    }
  });

  it("blocks generic pre-dispatch withdrawal behind a foreign active recovery owner", async () => {
    const owner = await makeModelOwner("foreign-predispatch");
    // The partial unique index correctly prevents two open story claims. Model
    // the stale/foreign recovery envelope that this fence must reject by
    // closing its old claim while leaving the independently durable delivery
    // active, then publish the duplicate pre-dispatch claim.
    await database.sql`
      UPDATE claim_log
         SET outcome = 'infra_retry', abandoned_at = clock_timestamp()
       WHERE id = ${owner.exact.claimId}
    `;
    const duplicateClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (
        ${owner.fixture.runId}, 'implement', ${owner.fixture.storyId},
        'duplicate-agent', clock_timestamp()
      )
      RETURNING id::integer AS id
    `;
    const duplicateClaimId = duplicateClaims[0]!.id;
    await database.sql`
      UPDATE stories
         SET claimed_by = 'duplicate-agent', claimed_at = clock_timestamp(),
             claim_generation = claim_generation + 1
       WHERE id = ${owner.fixture.storyDbId}
    `;
    const duplicateRuntimeId = `RTS_${"d".repeat(20)}-${sequence}`;
    await createRuntimeSessionRepository(database.sql).reserve({
      sessionId: duplicateRuntimeId,
      runId: owner.fixture.runId,
      stepDbId: owner.fixture.stepDbId,
      workflowStepId: "implement",
      storyDbId: owner.fixture.storyDbId,
      storyId: owner.fixture.storyId,
      claimId: duplicateClaimId,
      claimAgentId: "duplicate-agent",
      runtimeAgentId: "duplicate-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "duplicate-owner",
    });

    await assert.rejects(
      database.sql.begin((transaction) => withdrawPreDispatchClaimInTransaction(transaction, {
        identity: {
          claimId: duplicateClaimId,
          runId: owner.fixture.runId,
          workflowStepId: "implement",
          storyId: owner.fixture.storyId,
          claimAgentId: "duplicate-agent",
          runtime: { sessionId: duplicateRuntimeId, ownerInstanceId: "duplicate-owner" },
        },
        outcome: "infra_retry",
        diagnostic: "generic duplicate must not steal a recovery-owned story",
      })),
      /CLAIM_MUTATION_DURABLE_OWNER_ACTIVE:recovery_dispatch/,
    );
    const state = await database.sql<Array<{
      claim_outcome: string | null;
      runtime_state: string;
      story_status: string;
      step_status: string;
    }>>`
      SELECT claim.outcome AS claim_outcome, runtime.state AS runtime_state,
             story.status AS story_status, step.status AS step_status
        FROM claim_log claim
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
        JOIN stories story ON story.run_id = claim.run_id AND story.story_id = claim.story_id
        JOIN steps step ON step.run_id = claim.run_id AND step.step_id = claim.step_id
       WHERE claim.id = ${duplicateClaimId}
    `;
    assert.deepEqual({ ...state[0] }, {
      claim_outcome: null,
      runtime_state: "reserved",
      story_status: "running",
      step_status: "running",
    });
  });

  it("withdraws compiler duplicates but never resets product state owned by authorized or leased recovery", async () => {
    for (const deliveryState of ["authorized", "leased"] as const) {
      const fixture = await setup();
      if (deliveryState === "leased") {
        await lease(fixture, {
          ownerInstanceId: `compiler-foreign-${deliveryState}`,
          leaseMs: 120_000,
          now: new Date(Date.now() - 1_000),
        });
      }
      await database.sql.unsafe(
        `UPDATE stories
            SET status = 'running', claimed_by = 'duplicate-agent', claimed_at = clock_timestamp()
          WHERE id = $1`,
        [fixture.storyDbId],
      );
      await database.sql.unsafe(
        `UPDATE steps SET status = 'running', current_story_id = $2 WHERE id = $1`,
        [fixture.stepDbId, fixture.storyDbId],
      );
      const claimId = await database.sql.begin(async (transaction) => {
        const identities = await transaction.unsafe<Array<{ id: unknown }>>(
          "SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id",
        );
        const birth = await prepareInternalProductionClaimBirthV1(
          transaction as PgTransactionSql,
          "a-claim-loop-runtime-v1",
          identities,
        );
        return insertAndBindInternalProductionClaimBirthV1(
          transaction as PgTransactionSql,
          birth,
          {
            runId: fixture.runId,
            workflowStepId: "implement",
            storyId: fixture.storyId,
            claimAgentId: "duplicate-agent",
            claimedAt: new Date(),
          },
        );
      });
      const runtimeSessionId = `RTS_${deliveryState.padEnd(20, "x")}-${sequence}`;
      await createRuntimeSessionRepository(database.sql).reserve({
        sessionId: runtimeSessionId,
        runId: fixture.runId,
        stepDbId: fixture.stepDbId,
        workflowStepId: "implement",
        storyDbId: fixture.storyDbId,
        storyId: fixture.storyId,
        claimId,
        claimAgentId: "duplicate-agent",
        runtimeAgentId: "duplicate-runtime",
        runtimeKind: "local_process",
        ownerInstanceId: "duplicate-owner",
      });

      assert.deepEqual(await ensureCompilerClaimFence(database.sql, {
        claimId,
        runId: fixture.runId,
        stepId: "implement",
        storyId: fixture.storyId,
        storyDbId: fixture.storyDbId,
        claimAgentId: "duplicate-agent",
        diagnostic: "compiler duplicate observed a foreign recovery owner",
      }), {
        status: "blocked",
        reason: "COMPILER_CLAIM_FOREIGN_OWNER_RETAINED",
      });
      const state = await database.sql<Array<{
        story_status: string;
        step_status: string;
        current_story_id: string | null;
        claim_outcome: string | null;
        runtime_state: string;
        delivery_state: string;
      }>>`
        SELECT story.status AS story_status, step.status AS step_status,
               step.current_story_id, claim.outcome AS claim_outcome,
               runtime.state AS runtime_state, delivery.state AS delivery_state
          FROM stories story
          JOIN steps step ON step.run_id = story.run_id AND step.step_id = 'implement'
          JOIN claim_log claim ON claim.id = ${claimId}
          JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
          JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = ${fixture.dispatch.dispatchId}
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "running",
        step_status: "running",
        current_story_id: fixture.storyDbId,
        claim_outcome: "infra_retry",
        runtime_state: "released",
        delivery_state: deliveryState,
      });
    }
  });

  it("rolls back every owner heartbeat when the delivery fence update fails", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "heartbeat-rollback-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"r".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    const before = await database.sql.unsafe<Array<{
      runtime_heartbeat: Date;
      attempt_heartbeat: Date;
      attempt_expiry: Date;
      delivery_expiry: Date;
    }>>(
      `SELECT runtime.heartbeat_at AS runtime_heartbeat,
              attempt.heartbeat_at AS attempt_heartbeat,
              attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM runtime_sessions runtime
         JOIN execution_attempts attempt ON attempt.attempt_id = runtime.attempt_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE runtime.session_id = $1`,
      [sessionId],
    );
    const functionName = `test_fail_owner_heartbeat_${sequence}`;
    const triggerName = `trg_fail_owner_heartbeat_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF NEW.lease_expires_at <> OLD.lease_expires_at THEN
             RAISE EXCEPTION 'TEST_FORCED_OWNER_HEARTBEAT_FAILURE';
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${triggerName}
         BEFORE UPDATE ON recovery_dispatch_deliveries
         FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      await assert.rejects(
        createV3RecoveryOwnerLeaseRepository(database.sql).heartbeat({
          kind: "model_runtime",
          runId: fixture.runId,
          storyId: fixture.storyId,
          claimId: bound.publication.claimId,
          claimAgentId: "recovery-agent",
          revisionId: handoff.revisionId,
          dispatchId: handoff.dispatchId,
          ownerInstanceId: handoff.lease.ownerInstanceId,
          leaseToken: handoff.lease.leaseToken,
          attempt: {
            attemptId: bound.attempt.attemptId,
            generation: bound.attempt.generation,
            fenceToken: bound.attempt.fenceToken,
          },
          runtimeSessionId: sessionId,
        }, { now: new Date(leaseAt.getTime() + 1_000), leaseMs: 120_000 }),
        /TEST_FORCED_OWNER_HEARTBEAT_FAILURE/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON recovery_dispatch_deliveries`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
    const after = await database.sql.unsafe<typeof before>(
      `SELECT runtime.heartbeat_at AS runtime_heartbeat,
              attempt.heartbeat_at AS attempt_heartbeat,
              attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM runtime_sessions runtime
         JOIN execution_attempts attempt ON attempt.attempt_id = runtime.attempt_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE runtime.session_id = $1`,
      [sessionId],
    );
    assert.deepEqual(
      Object.fromEntries(Object.entries(after[0]!).map(([key, value]) => [key, (value as Date).toISOString()])),
      Object.fromEntries(Object.entries(before[0]!).map(([key, value]) => [key, (value as Date).toISOString()])),
    );
  });

  it("rolls back exact relinquish atomically when the delivery lease update fails", async () => {
    const fixture = await setup();
    const leaseAt = new Date(Date.now() - 1_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "relinquish-rollback-owner",
      leaseMs: 120_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"q".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start: false,
    });
    const readLeases = () => database.sql.unsafe<Array<{
      attempt_expiry: Date;
      delivery_expiry: Date;
    }>>(
      `SELECT attempt.lease_expires_at AS attempt_expiry,
              delivery.lease_expires_at AS delivery_expiry
         FROM execution_attempts attempt
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE attempt.attempt_id = $1`,
      [bound.attempt.attemptId],
    );
    const before = await readLeases();
    const functionName = `test_fail_owner_relinquish_${sequence}`;
    const triggerName = `trg_fail_owner_relinquish_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF NEW.lease_expires_at <> OLD.lease_expires_at THEN
             RAISE EXCEPTION 'TEST_FORCED_OWNER_RELINQUISH_FAILURE';
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${triggerName}
         BEFORE UPDATE ON recovery_dispatch_deliveries
         FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      await assert.rejects(
        createV3RecoveryOwnerLeaseRepository(database.sql).relinquish({
          kind: "model_runtime",
          runId: fixture.runId,
          storyId: fixture.storyId,
          claimId: bound.publication.claimId,
          claimAgentId: "recovery-agent",
          revisionId: handoff.revisionId,
          dispatchId: handoff.dispatchId,
          ownerInstanceId: handoff.lease.ownerInstanceId,
          leaseToken: handoff.lease.leaseToken,
          attempt: {
            attemptId: bound.attempt.attemptId,
            generation: bound.attempt.generation,
            fenceToken: bound.attempt.fenceToken,
          },
          runtimeSessionId: sessionId,
        }),
        /TEST_FORCED_OWNER_RELINQUISH_FAILURE/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON recovery_dispatch_deliveries`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
    const after = await readLeases();
    assert.deepEqual(
      after[0] && {
        attemptExpiry: after[0].attempt_expiry.toISOString(),
        deliveryExpiry: after[0].delivery_expiry.toISOString(),
      },
      before[0] && {
        attemptExpiry: before[0].attempt_expiry.toISOString(),
        deliveryExpiry: before[0].delivery_expiry.toISOString(),
      },
    );
  });

  it("drains and terminalizes one expired model owner exactly once across crash-boundary scans", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "expired-model-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"x".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    await expireModelOwner(handoff.dispatchId, bound.attempt.attemptId);
    const reconcileAt = new Date(leaseAt.getTime() + 70_000);
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);

    const drainReports = await Promise.all([
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
    ]);
    const drainEvents = drainReports.flatMap((report) => report.events);
    assert.equal(drainReports.reduce((sum, report) => sum + report.counts.requestedRuntimeDrains, 0), 2);
    assert.equal(drainEvents.filter((event) => event.action === "request_runtime_drain" && event.mutated).length, 1);
    assert.equal(drainEvents.filter((event) => event.code === "V3_RECOVERY_LIFECYCLE_MODEL_OWNER_DRAIN_PENDING").length, 1);
    assert.ok(drainEvents.every((event) => event.runtimeSessionId === sessionId));

    const pending = await createRuntimeSessionRepository(database.sql).findById(sessionId);
    assert.equal(pending?.state, "drain_requested");
    const stillOwned = await database.sql.unsafe<Array<{
      attempt_disposition: string;
      claim_outcome: string | null;
      delivery_state: string;
    }>>(
      `SELECT attempt.disposition AS attempt_disposition,
              claim.outcome AS claim_outcome,
              delivery.state AS delivery_state
         FROM execution_attempts attempt
         JOIN claim_log claim ON claim.id = attempt.claim_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
        WHERE attempt.attempt_id = $1`,
      [bound.attempt.attemptId],
    );
    assert.deepEqual({ ...stillOwned[0]! }, {
      attempt_disposition: "claimed",
      claim_outcome: null,
      delivery_state: "attempt_reserved",
    }, "drain request does not expose or terminalize a runtime that may still exist");

    await createRuntimeSessionRepository(database.sql).markDrained({
      sessionId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      now: new Date(reconcileAt.getTime() + 1_000),
      evidence: {
        schema: "setfarm.runtime-drain-evidence.v1",
        observedAt: new Date(reconcileAt.getTime() + 1_000).toISOString(),
        localProcessAbsent: true,
        openClawTaskAbsent: true,
        workspaceProcessAbsent: true,
        stableObservations: 2,
        evidenceRefs: [
          `setfarm://v3-recovery-owner/${handoff.dispatchId}`,
          `setfarm://runtime-session/${sessionId}`,
        ],
      },
    });

    const terminalAt = new Date(reconcileAt.getTime() + 2_000);
    const closeFunction = `test_reject_expired_model_close_${sequence}`;
    const closeTrigger = `trg_reject_expired_model_close_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${closeFunction}() RETURNS trigger AS $$ BEGIN
           IF NEW.category='execution-attempt' AND NEW.owner_key='${bound.attempt.attemptId}'
              AND NEW.state='closed' THEN RAISE EXCEPTION 'TEST_EXPIRED_MODEL_CLOSE_REJECTED'; END IF;
           RETURN NEW;
         END $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${closeTrigger} BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
         FOR EACH ROW EXECUTE FUNCTION ${closeFunction}()`,
      );
      await assert.rejects(
        reconciler.reconcileActive({ runId: fixture.runId }, { now: terminalAt }),
        /TEST_EXPIRED_MODEL_CLOSE_REJECTED/,
      );
      const rolledBack = await database.sql<Array<{ disposition: string; outcome: string | null; owner_state: string }>>`
        SELECT attempt.disposition,claim.outcome,owner.state AS owner_state
          FROM execution_attempts attempt
          JOIN claim_log claim ON claim.id=attempt.claim_id
          JOIN internal_production_owner_reservations_v1 owner
            ON owner.category='execution-attempt' AND owner.owner_key=attempt.attempt_id
         WHERE attempt.attempt_id=${bound.attempt.attemptId}
      `;
      assert.deepEqual({ ...rolledBack[0]! }, { disposition: "claimed", outcome: null, owner_state: "bound" });
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${closeTrigger} ON internal_production_owner_reservations_v1`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${closeFunction}()`);
    }
    const terminalReports = await Promise.all([
      reconciler.reconcileActive({ runId: fixture.runId }, { now: terminalAt }),
      reconciler.reconcileActive({ runId: fixture.runId }, { now: terminalAt }),
    ]);
    assert.equal(
      terminalReports.reduce((sum, report) => sum + report.counts.blockedExpiredModelAttempts, 0),
      1,
    );
    assert.equal(terminalReports.flatMap((report) => report.events)
      .filter((event) => event.action === "block_expired_model_attempt" && event.mutated).length, 1);

    const terminalRows = await database.sql.unsafe<Array<{
      attempt_disposition: string;
      claim_outcome: string | null;
      runtime_state: string;
      delivery_state: string;
      case_status: string;
      story_status: string;
      story_claimed_by: string | null;
      step_status: string;
      current_story_id: string | null;
      claim_owner_state: string;
      runtime_owner_state: string;
      attempt_owner_state: string;
    }>>(
      `SELECT attempt.disposition AS attempt_disposition,
              claim.outcome AS claim_outcome,
              runtime.state AS runtime_state,
              delivery.state AS delivery_state,
              recovery_case.status AS case_status,
              story.status AS story_status,
              story.claimed_by AS story_claimed_by,
              step.status AS step_status,
              step.current_story_id,
              claim_owner.state AS claim_owner_state,
              runtime_owner.state AS runtime_owner_state,
              attempt_owner.state AS attempt_owner_state
         FROM execution_attempts attempt
         JOIN claim_log claim ON claim.id = attempt.claim_id
         JOIN runtime_sessions runtime ON runtime.attempt_id = attempt.attempt_id
         JOIN recovery_dispatch_deliveries delivery ON delivery.attempt_id = attempt.attempt_id
         JOIN recovery_cases recovery_case ON recovery_case.recovery_case_id = delivery.recovery_case_id
         JOIN stories story ON story.run_id = attempt.run_id AND story.story_id = attempt.story_id
         JOIN steps step ON step.id = runtime.step_db_id
         JOIN internal_production_owner_reservations_v1 claim_owner
           ON claim_owner.category='claim' AND claim_owner.owner_key=claim.id::text
         JOIN internal_production_owner_reservations_v1 runtime_owner
           ON runtime_owner.category='runtime-session' AND runtime_owner.owner_key=runtime.session_id
         JOIN internal_production_owner_reservations_v1 attempt_owner
           ON attempt_owner.category='execution-attempt' AND attempt_owner.owner_key=attempt.attempt_id
        WHERE attempt.attempt_id = $1`,
      [bound.attempt.attemptId],
    );
    assert.deepEqual({ ...terminalRows[0]! }, {
      attempt_disposition: "inconclusive",
      claim_outcome: "infra_retry",
      runtime_state: "released",
      delivery_state: "blocked",
      case_status: "blocked",
      story_status: "failed",
      story_claimed_by: null,
      step_status: "running",
      current_story_id: null,
      claim_owner_state: "closed",
      runtime_owner_state: "closed",
      attempt_owner_state: "closed",
    });
    const replay = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(terminalAt.getTime() + 1_000) },
    );
    assert.equal(replay.counts.scanned, 0, "terminal owner is never sent through recovery again");
  });

  it("blocks the exact owner chain when runtime absence proof is quarantined", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "quarantined-model-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"q".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    await expireModelOwner(handoff.dispatchId, bound.attempt.attemptId);
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const expiredAt = new Date(leaseAt.getTime() + 70_000);
    const requested = await reconciler.reconcileActive({ runId: fixture.runId }, { now: expiredAt });
    assert.equal(requested.counts.requestedRuntimeDrains, 1);
    const sessions = createRuntimeSessionRepository(database.sql);
    const observedRuntime = await sessions.findById(sessionId);
    assert.ok(observedRuntime);
    await sessions.quarantine({
      sessionId,
      expectedOwnerInstanceId: observedRuntime.ownerInstanceId,
      expectedStateVersion: observedRuntime.stateVersion,
      diagnostic: "TEST_RUNTIME_ABSENCE_NOT_PROVEN",
      evidence: { localProcessAbsent: false },
      now: new Date(expiredAt.getTime() + 1_000),
    });
    const blocked = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(expiredAt.getTime() + 2_000) },
    );
    assert.equal(blocked.counts.blockedExpiredModelAttempts, 1);
    assert.equal(blocked.events[0]?.code, "V3_RECOVERY_LIFECYCLE_MODEL_OWNER_QUARANTINED");
    assert.equal((await createRuntimeSessionRepository(database.sql).findById(sessionId))?.state, "quarantined");
    assert.equal((await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId))?.state, "blocked");
  });

  it("terminalizes an expired attempt-bound reserved runtime with no-spawn proof", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "reserved-model-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"z".repeat(20)}-${sequence}`;
    const bound = await reserveModelAttempt(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
      start: false,
    });
    await expireModelOwner(handoff.dispatchId, bound.attempt.attemptId);
    const report = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 70_000) },
    );
    assert.equal(report.counts.blockedExpiredModelAttempts, 1);
    const runtime = await createRuntimeSessionRepository(database.sql).findById(sessionId);
    assert.equal(runtime?.state, "released");
    assert.equal(runtime?.drainEvidence.schema, "setfarm.no-spawn-release-evidence.v1");
  });

  it("repairs an acquire/post-lease-validation crash exactly once under concurrent scans", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, { ownerInstanceId: "lease-race-owner", leaseMs: 60_000, now: leaseAt });
    await expireDelivery(handoff.dispatchId);
    const reconcileAt = new Date(leaseAt.getTime() + 2_000);
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);

    const reports = await Promise.all([
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
    ]);
    const events = reports.flatMap((report) => report.events);
    assert.equal(
      reports.reduce((sum, report) => sum + report.counts.resetExpiredLeases, 0),
      1,
      JSON.stringify(events),
    );
    assert.equal(events.filter((item) => item.mutated).length, 1);
    assert.ok(events.some((item) => item.code === "V3_RECOVERY_LIFECYCLE_AUTHORIZED_CONSISTENT"));

    const delivery = await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId);
    assert.equal(delivery?.state, "authorized");
    assert.equal(delivery?.ownerInstanceId, undefined);
    assert.equal(delivery?.leaseToken, undefined);
    assert.equal(delivery?.leaseExpiresAt, undefined);
    const attempts = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM execution_attempts
       WHERE recovery_dispatch_id = ${fixture.dispatch.dispatchId}
    `;
    assert.equal(attempts[0]?.count, 0, "reconciliation never fabricates an attempt");
  });

  it("rolls lifecycle mutation back when its canonical outbox evidence cannot commit", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "atomic-outbox-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    await expireDelivery(handoff.dispatchId);
    const reconcileAt = new Date(leaseAt.getTime() + 2_000);
    const functionName = `test_fail_lifecycle_outbox_${sequence}`;
    const triggerName = `trg_fail_lifecycle_outbox_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF NEW.event_type = 'product_compiler.v3_recovery_lifecycle_reconciled' THEN
             RAISE EXCEPTION 'TEST_FORCED_LIFECYCLE_OUTBOX_FAILURE';
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${triggerName}
         BEFORE INSERT ON operational_outbox
         FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      await assert.rejects(
        createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
          { runId: fixture.runId },
          { now: reconcileAt },
        ),
        /TEST_FORCED_LIFECYCLE_OUTBOX_FAILURE/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON operational_outbox`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }

    const rolledBack = await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId);
    assert.equal(rolledBack?.state, "leased");
    assert.equal(rolledBack?.ownerInstanceId, handoff.lease.ownerInstanceId);
    assert.equal(rolledBack?.leaseToken, handoff.lease.leaseToken);
    assert.equal((await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM operational_outbox
       WHERE aggregate_id = ${fixture.runId}
         AND event_type = 'product_compiler.v3_recovery_lifecycle_reconciled'
    `)[0]?.count, 0);

    const committed = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: reconcileAt },
    );
    assert.equal(committed.counts.resetExpiredLeases, 1, JSON.stringify(committed.events));
    const evidence = await database.sql<Array<{ action: string; mutated: boolean }>>`
      SELECT payload->>'action' AS action,
             (payload->>'mutated')::boolean AS mutated
        FROM operational_outbox
       WHERE aggregate_id = ${fixture.runId}
         AND event_type = 'product_compiler.v3_recovery_lifecycle_reconciled'
    `;
    assert.deepEqual(evidence.map((row) => ({ ...row })), [{
      action: "reset_expired_lease",
      mutated: true,
    }]);
  });

  it("deduplicates repeated report-only evidence while its source row is unchanged", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    await lease(fixture, {
      ownerInstanceId: "stable-evidence-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const first = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 1_000) },
    );
    const second = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 2_000) },
    );
    assert.equal(first.events[0]?.code, "V3_RECOVERY_LIFECYCLE_LEASE_NOT_EXPIRED");
    assert.equal(second.events[0]?.code, "V3_RECOVERY_LIFECYCLE_LEASE_NOT_EXPIRED");
    assert.equal(first.events[0]?.observedAt, second.events[0]?.observedAt);

    const evidence = await database.sql<Array<{ count: number; keys: number }>>`
      SELECT COUNT(*)::integer AS count,
             COUNT(DISTINCT event_key)::integer AS keys
        FROM operational_outbox
       WHERE aggregate_id = ${fixture.runId}
         AND event_type = 'product_compiler.v3_recovery_lifecycle_reconciled'
    `;
    assert.deepEqual({ ...evidence[0]! }, { count: 1, keys: 1 });
  });

  it("preserves Task 3 claim/runtime/m33 and the null delivery prefix when model pair publication rolls back", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "model-pair-rollback-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"k".repeat(20)}-${sequence}`;
    const publication = await publish(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);
    const before = await database.sql<Array<{
      head_version: number;
      handoff_canonical_json: string;
      handoff_hash: string;
    }>>`
      SELECT head.head_version,publication.handoff_canonical_json,publication.handoff_hash
        FROM internal_production_owner_admission_head_v1 head
        JOIN internal_production_v3_recovery_claim_publications_v1 publication ON TRUE
       WHERE head.singleton=TRUE AND publication.claim_id=${publication!.claimId}
    `;
    const functionName = `test_reject_model_pair_${sequence}`;
    const triggerName = `trg_reject_model_pair_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF NEW.dispatch_id='${handoff.dispatchId}' AND NEW.state='attempt_reserved' THEN
             RAISE EXCEPTION 'TEST_MODEL_PAIR_CAS_REJECTED';
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${triggerName}
         BEFORE UPDATE ON recovery_dispatch_deliveries
         FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      await assert.rejects(
        createAttemptRepository(database.sql).reserve(
          modelReservationInput(fixture, handoff, publication!.claimId),
          { now: new Date(leaseAt.getTime() + 200), leaseMs: 60_000 },
        ),
        /TEST_MODEL_PAIR_CAS_REJECTED/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON recovery_dispatch_deliveries`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
    const after = await database.sql<Array<{
      head_version: number;
      handoff_canonical_json: string;
      handoff_hash: string;
      claim_outcome: string | null;
      runtime_state: string;
      attempts: number;
      delivery_state: string;
      delivery_claim_id: string | null;
      delivery_attempt_id: string | null;
      execution_slice_hash: string | null;
      attempt_count: number;
    }>>`
      SELECT head.head_version,publication.handoff_canonical_json,publication.handoff_hash,
             claim.outcome AS claim_outcome,runtime.state AS runtime_state,
             (SELECT COUNT(*)::integer FROM execution_attempts attempt
               WHERE attempt.recovery_dispatch_id=${handoff.dispatchId}) AS attempts,
             delivery.state AS delivery_state,delivery.claim_id::text AS delivery_claim_id,
             delivery.attempt_id AS delivery_attempt_id,delivery.execution_slice_hash,
             delivery.attempt_count
        FROM internal_production_owner_admission_head_v1 head
        JOIN internal_production_v3_recovery_claim_publications_v1 publication ON publication.claim_id=${publication!.claimId}
        JOIN claim_log claim ON claim.id=publication.claim_id
        JOIN runtime_sessions runtime ON runtime.session_id=publication.runtime_session_id
        JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id=publication.dispatch_id
       WHERE head.singleton=TRUE
    `;
    assert.deepEqual({ ...after[0]! }, {
      head_version: before[0]!.head_version,
      handoff_canonical_json: before[0]!.handoff_canonical_json,
      handoff_hash: before[0]!.handoff_hash,
      claim_outcome: null,
      runtime_state: "reserved",
      attempts: 0,
      delivery_state: "leased",
      delivery_claim_id: null,
      delivery_attempt_id: null,
      execution_slice_hash: null,
      attempt_count: 0,
    });
  });

  it("terminally blocks an expired reserved publication before attempt birth without mutating m33", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "publication-owner",
      leaseMs: 10_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"p".repeat(20)}-${sequence}`;
    const publication = await publish(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);
    const immutableBefore = await database.sql<Array<{
      claim_id: string;
      runtime_session_id: string;
      dispatch_id: string;
      handoff_canonical_json: string;
      handoff_hash: string;
    }>>`
      SELECT claim_id::text,runtime_session_id,dispatch_id,
             handoff_canonical_json,handoff_hash
        FROM internal_production_v3_recovery_claim_publications_v1
       WHERE claim_id=${publication!.claimId}
    `;
    assert.equal(immutableBefore.length, 1);
    await database.sql.unsafe(
      `SELECT pg_sleep(GREATEST(
         EXTRACT(EPOCH FROM (
           (SELECT lease_expires_at FROM recovery_dispatch_deliveries WHERE dispatch_id=$1)
           - clock_timestamp()
         )) + 0.05,
         0
       ))`,
      [handoff.dispatchId],
    );

    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const expirySnapshot = async () => (await database.sql<Array<{
      head_version: number;
      claim_outcome: string | null;
      runtime_state: string;
      runtime_attempt_id: string | null;
      claim_owner_state: string;
      runtime_owner_state: string;
      story_status: string;
      story_claimed_by: string | null;
      story_claimed_at: string | null;
      step_status: string;
      step_current_story_id: string | null;
      delivery_state: string;
      delivery_claim_id: string | null;
      delivery_attempt_id: string | null;
      delivery_slice_hash: string | null;
      delivery_attempt_count: number;
      delivery_diagnostic: string | null;
      case_status: string;
    }>>`
      SELECT head.head_version,claim.outcome AS claim_outcome,
             runtime.state AS runtime_state,runtime.attempt_id AS runtime_attempt_id,
             claim_owner.state AS claim_owner_state,
             runtime_owner.state AS runtime_owner_state,
             story.status AS story_status,story.claimed_by AS story_claimed_by,
             story.claimed_at::text AS story_claimed_at,
             step.status AS step_status,step.current_story_id AS step_current_story_id,
             delivery.state AS delivery_state,delivery.claim_id::text AS delivery_claim_id,
             delivery.attempt_id AS delivery_attempt_id,
             delivery.execution_slice_hash AS delivery_slice_hash,
             delivery.attempt_count AS delivery_attempt_count,
             delivery.diagnostic AS delivery_diagnostic,
             recovery_case.status AS case_status
        FROM internal_production_owner_admission_head_v1 head
        JOIN internal_production_v3_recovery_claim_publications_v1 publication
          ON publication.claim_id=${publication!.claimId}
        JOIN claim_log claim ON claim.id=publication.claim_id
        JOIN runtime_sessions runtime ON runtime.session_id=publication.runtime_session_id
        JOIN internal_production_owner_reservations_v1 claim_owner
          ON claim_owner.category='claim' AND claim_owner.owner_key=claim.id::text
        JOIN internal_production_owner_reservations_v1 runtime_owner
          ON runtime_owner.category='runtime-session' AND runtime_owner.owner_key=runtime.session_id
        JOIN stories story ON story.id=publication.story_db_id
        JOIN steps step ON step.id=publication.step_db_id
        JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id=publication.dispatch_id
        JOIN recovery_cases recovery_case ON recovery_case.recovery_case_id=publication.recovery_case_id
       WHERE head.singleton=TRUE
    `)[0]!;
    const pristineExpiry = { ...await expirySnapshot() };
    await database.sql`
      UPDATE recovery_dispatch_deliveries
         SET lease_expires_at=lease_expires_at+interval '1 microsecond'
       WHERE dispatch_id=${handoff.dispatchId}
    `;
    const driftedLeaseIdentity = await database.sql<Array<{ exact: boolean }>>`
      SELECT delivery.lease_expires_at=(
               publication.handoff_canonical_json::jsonb#>>'{lease,expiresAt}'
             )::timestamptz AS exact
        FROM recovery_dispatch_deliveries delivery
        JOIN internal_production_v3_recovery_claim_publications_v1 publication
          ON publication.dispatch_id=delivery.dispatch_id
       WHERE delivery.dispatch_id=${handoff.dispatchId}
    `;
    assert.equal(driftedLeaseIdentity[0]?.exact, false);
    const driftedReport = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 2_000) },
    );
    assert.equal(driftedReport.counts.rolledBackPublications, 0);
    assert.equal(driftedReport.counts.quarantined, 1);
    assert.equal(
      driftedReport.events[0]?.code,
      "V3_RECOVERY_LIFECYCLE_PUBLICATION_AUTHORITY_MISMATCH",
    );
    assert.deepEqual({ ...await expirySnapshot() }, pristineExpiry);
    await database.sql`
      UPDATE recovery_dispatch_deliveries
         SET lease_expires_at=lease_expires_at-interval '1 microsecond'
       WHERE dispatch_id=${handoff.dispatchId}
    `;
    const restoredLeaseIdentity = await database.sql<Array<{ exact: boolean }>>`
      SELECT delivery.lease_expires_at=(
               publication.handoff_canonical_json::jsonb#>>'{lease,expiresAt}'
             )::timestamptz AS exact
        FROM recovery_dispatch_deliveries delivery
        JOIN internal_production_v3_recovery_claim_publications_v1 publication
          ON publication.dispatch_id=delivery.dispatch_id
       WHERE delivery.dispatch_id=${handoff.dispatchId}
    `;
    assert.equal(restoredLeaseIdentity[0]?.exact, true);
    const reports = await Promise.all([
      reconciler.reconcileActive(
        { runId: fixture.runId },
        { now: new Date(leaseAt.getTime() + 2_000) },
      ),
      reconciler.reconcileActive(
        { runId: fixture.runId },
        { now: new Date(leaseAt.getTime() + 2_000) },
      ),
    ]);
    assert.equal(
      reports.reduce((sum, item) => sum + item.counts.rolledBackPublications, 0),
      1,
    );
    const report = reports.find((item) => item.counts.rolledBackPublications === 1)!;
    assert.equal(report.events[0]?.code, "V3_RECOVERY_LIFECYCLE_PUBLICATION_BLOCKED");

    const claims = await database.sql<Array<{ outcome: string | null }>>`
      SELECT outcome FROM claim_log WHERE id = ${publication!.claimId}
    `;
    assert.equal(claims[0]?.outcome, "infra_retry");
    const runtimes = await database.sql<Array<{
      state: string;
      attempt_id: string | null;
      claim_owner_state: string;
      runtime_owner_state: string;
    }>>`
      SELECT runtime.state,runtime.attempt_id,
             claim_owner.state AS claim_owner_state,
             runtime_owner.state AS runtime_owner_state
        FROM runtime_sessions runtime
        JOIN internal_production_owner_reservations_v1 claim_owner
          ON claim_owner.category='claim'
         AND claim_owner.owner_key=runtime.claim_id::text
        JOIN internal_production_owner_reservations_v1 runtime_owner
          ON runtime_owner.category='runtime-session'
         AND runtime_owner.owner_key=runtime.session_id
       WHERE runtime.session_id = ${sessionId}
    `;
    assert.deepEqual({ ...runtimes[0]! }, {
      state: "released",
      attempt_id: null,
      claim_owner_state: "closed",
      runtime_owner_state: "closed",
    });
    const stories = await database.sql<Array<{ status: string; claimed_by: string | null; claimed_at: Date | null }>>`
      SELECT status, claimed_by, claimed_at FROM stories WHERE id = ${fixture.storyDbId}
    `;
    assert.equal(stories[0]?.status, "failed");
    assert.equal(stories[0]?.claimed_by, null);
    assert.equal(stories[0]?.claimed_at, null);
    const steps = await database.sql<Array<{ status: string; current_story_id: string | null }>>`
      SELECT status, current_story_id FROM steps WHERE id = ${fixture.stepDbId}
    `;
    assert.deepEqual({ ...steps[0]! }, { status: "running", current_story_id: null });
    const delivery = await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId);
    assert.equal(delivery?.state, "blocked");
    assert.equal(delivery?.attemptId, undefined);
    assert.equal(delivery?.claimId, undefined);
    assert.match(delivery?.diagnostic ?? "", /expired before attempt/i);
    const cases = await database.sql<Array<{ status: string }>>`
      SELECT status FROM recovery_cases WHERE recovery_case_id=${handoff.recoveryCaseId}
    `;
    assert.equal(cases[0]?.status, "blocked");
    const immutableAfter = await database.sql<Array<{
      claim_id: string;
      runtime_session_id: string;
      dispatch_id: string;
      handoff_canonical_json: string;
      handoff_hash: string;
    }>>`
      SELECT claim_id::text,runtime_session_id,dispatch_id,
             handoff_canonical_json,handoff_hash
        FROM internal_production_v3_recovery_claim_publications_v1
       WHERE claim_id=${publication!.claimId}
    `;
    assert.deepEqual(immutableAfter.map((row) => ({ ...row })), immutableBefore.map((row) => ({ ...row })));
    const headAfterBlock = await database.sql<Array<{ head_version: number }>>`
      SELECT head_version FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
    `;
    const responseLossReplay = await reconciler.reconcileActive({ runId: fixture.runId });
    assert.equal(responseLossReplay.counts.scanned, 0);
    const headAfterReplay = await database.sql<Array<{ head_version: number }>>`
      SELECT head_version FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
    `;
    assert.equal(headAfterReplay[0]!.head_version, headAfterBlock[0]!.head_version);

    const successorFindingSet = createFindingSetV1({
      runId: fixture.runId,
      storyId: fixture.storyId,
      packetHash: PACKET_HASH,
      sliceHash: SLICE_HASH,
      sourceRevision: { sha: SOURCE_SHA, treeHash: SOURCE_TREE },
      findings: [{
        origin: "runtime",
        classification: "structured",
        invariantRef: "INV_SAVE_RELOAD",
        sourceLocators: [{ path: "src/App.tsx", contentHash: "f".repeat(64) }],
        observedEvidenceRefs: ["e".repeat(64)],
        expectedPredicateRef: "EVID_SAVE_RELOAD",
        status: "open",
      }],
    });
    const findings = createFindingRecoveryRepository(database.sql);
    await findings.putFindingSet(successorFindingSet);
    const successorCase = await findings.openRecoveryCase(
      recoveryDraft(successorFindingSet),
      { now: new Date(leaseAt.getTime() + 3_000) },
    );
    const successorRevision = await fixture.deliveries.findCurrentRevision(
      successorCase.recoveryCase.recoveryCaseId,
    );
    assert.ok(successorRevision);
    const successorAuthorized = await fixture.deliveries.authorizeCurrentRevision({
      recoveryCaseId: successorCase.recoveryCase.recoveryCaseId,
      revisionId: successorRevision.revisionId,
      expectedStateVersion: successorCase.recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
    }, { now: new Date(leaseAt.getTime() + 3_100) });
    assert.equal(successorAuthorized.status, "authorized");
    if (successorAuthorized.status !== "authorized") throw new Error("expected independent successor authorization");
    const successorFixture = {
      ...fixture,
      findingSet: successorFindingSet,
      revision: successorRevision,
      dispatch: successorAuthorized.dispatch,
      delivery: successorAuthorized.delivery,
    };
    const successorHandoff = await lease(successorFixture, {
      ownerInstanceId: "successor-publication-owner",
      leaseMs: 60_000,
      now: new Date(leaseAt.getTime() + 3_200),
    });
    const successor = await reserveModelAttempt(successorFixture, successorHandoff, {
      sessionId: `RTS_${"s".repeat(20)}-${sequence}`,
      now: new Date(leaseAt.getTime() + 3_300),
      start: false,
    });
    assert.equal(successor.attempt.recoveryDispatchId, successorAuthorized.dispatch.dispatchId);
  });

  it("fails closed when a reserved publication heartbeat drifts from its creation proof", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "publication-heartbeat-drift-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"h".repeat(20)}-${sequence}`;
    const publication = await publish(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);
    await expireUnreservedPublication(handoff.dispatchId);
    await database.sql`
      UPDATE runtime_sessions
         SET heartbeat_at = created_at + INTERVAL '1 millisecond',
             updated_at = created_at + INTERVAL '1 millisecond'
       WHERE session_id = ${sessionId}
    `;

    const report = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 2_000) },
    );
    assert.equal(report.counts.rolledBackPublications, 0);
    assert.equal(report.counts.quarantined, 1);
    assert.equal(report.events[0]?.code, "V3_RECOVERY_LIFECYCLE_UNBOUND_OWNER_AMBIGUOUS");

    const ownerRows = await database.sql<Array<{
      runtime_state: string;
      claim_outcome: string | null;
      story_status: string;
    }>>`
      SELECT runtime.state AS runtime_state,
             claim.outcome AS claim_outcome,
             story.status AS story_status
        FROM runtime_sessions runtime
        JOIN claim_log claim ON claim.id = runtime.claim_id
        JOIN stories story ON story.id = runtime.story_db_id
       WHERE runtime.session_id = ${sessionId}
    `;
    assert.deepEqual({ ...ownerRows[0]! }, {
      runtime_state: "reserved",
      claim_outcome: null,
      story_status: "running",
    });
    assert.equal(
      (await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId))?.state,
      "leased",
    );
  });

  it("advances only an exact running runtime and active attempt, then becomes a no-op", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "attempt-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const sessionId = `RTS_${"a".repeat(20)}-${sequence}`;
    const publication = await publish(fixture, handoff, {
      sessionId,
      now: new Date(leaseAt.getTime() + 100),
    });
    assert.ok(publication);
    const reservation = await createAttemptRepository(database.sql).reserve({
      claimId: publication!.claimId,
      runId: fixture.runId,
      stepId: "implement",
      storyId: fixture.storyId,
      attemptClass: "product_implementation",
      packetHash: handoff.directive.packetHash,
      compilationReportHash: "f".repeat(64),
      sliceHash: handoff.directive.contractSliceHash,
      sourceBefore: handoff.directive.sourceRevision,
      findingSetHash: handoff.directive.findingSetHash,
      recoveryCaseRevisionId: handoff.revisionId,
      recoveryDispatchId: handoff.dispatchId,
      recoveryDeliveryLease: {
        ownerInstanceId: handoff.lease.ownerInstanceId,
        leaseToken: handoff.lease.leaseToken,
      },
      role: "developer",
      agentId: "recovery-agent",
      evidenceRefs: [`setfarm://claim-log/${publication!.claimId}`],
    }, { now: new Date(leaseAt.getTime() + 200) });
    assert.equal(reservation.status, "reserved");
    await createAttemptRepository(database.sql).markRunning({
      attemptId: reservation.attempt.attemptId,
      generation: reservation.attempt.generation,
      fenceToken: reservation.attempt.fenceToken,
    }, { now: new Date("2200-01-01T00:00:00.000Z") });
    await createRuntimeSessionRepository(database.sql).bindAttempt({
      sessionId,
      attemptId: reservation.attempt.attemptId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      now: new Date(leaseAt.getTime() + 300),
    });
    await database.sql`
      UPDATE runtime_sessions
         SET state = 'running',
             created_at = (
               SELECT claim.claimed_at + interval '1 second'
                 FROM claim_log claim
                WHERE claim.id = runtime_sessions.claim_id
             ),
             started_at = ${new Date(leaseAt.getTime() + 400)},
             heartbeat_at = ${new Date(leaseAt.getTime() + 400)},
             updated_at = ${new Date(leaseAt.getTime() + 400)}
       WHERE session_id = ${sessionId} AND state = 'reserved'
    `;
    await database.sql`
      UPDATE recovery_dispatch_deliveries delivery
         SET started_at = claim.claimed_at + interval '2 seconds'
        FROM claim_log claim
       WHERE delivery.dispatch_id = ${fixture.dispatch.dispatchId}
         AND claim.id = delivery.claim_id
    `;

    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const first = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 500) },
    );
    assert.equal(first.counts.advancedRunning, 1, JSON.stringify(first, null, 2));
    assert.equal((await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId))?.state, "running");

    const replay = await reconciler.reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 600) },
    );
    assert.equal(replay.counts.noops, 1);
    assert.equal(replay.events[0]?.code, "V3_RECOVERY_LIFECYCLE_RUNNING_CONSISTENT");
  });

  it("reports a nonexpired lease and an expired starting runtime without mutating either owner", async () => {
    const leasedFixture = await setup();
    const leaseAt = new Date(leasedFixture.base.getTime() + 2_000);
    await lease(leasedFixture, {
      ownerInstanceId: "live-lease-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const liveReport = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: leasedFixture.runId },
      { now: new Date(leaseAt.getTime() + 1_000) },
    );
    assert.equal(liveReport.counts.quarantined, 1);
    assert.equal(liveReport.events[0]?.code, "V3_RECOVERY_LIFECYCLE_LEASE_NOT_EXPIRED");
    assert.equal((await leasedFixture.deliveries.findDelivery(leasedFixture.dispatch.dispatchId))?.state, "leased");

    const runtimeFixture = await setup();
    const runtimeLeaseAt = new Date(runtimeFixture.base.getTime() + 2_000);
    const handoff = await lease(runtimeFixture, {
      ownerInstanceId: "starting-runtime-owner",
      leaseMs: 60_000,
      now: runtimeLeaseAt,
    });
    const sessionId = `RTS_${"s".repeat(20)}-${sequence}`;
    const publication = await publish(runtimeFixture, handoff, {
      sessionId,
      now: new Date(runtimeLeaseAt.getTime() + 100),
    });
    assert.ok(publication);
    await createRuntimeSessionRepository(database.sql).markStarting({
      sessionId,
      ownerInstanceId: handoff.lease.ownerInstanceId,
      now: new Date(runtimeLeaseAt.getTime() + 200),
    });
    await expireDelivery(handoff.dispatchId);

    const unsafeReport = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: runtimeFixture.runId },
      { now: new Date(runtimeLeaseAt.getTime() + 2_000) },
    );
    assert.equal(unsafeReport.counts.quarantined, 1);
    assert.equal(unsafeReport.events[0]?.code, "V3_RECOVERY_LIFECYCLE_UNRELEASED_RUNTIME_UNSAFE");
    assert.equal((await runtimeFixture.deliveries.findDelivery(runtimeFixture.dispatch.dispatchId))?.state, "leased");
    const ownerRows = await database.sql<Array<{ runtime_state: string; claim_outcome: string | null; story_status: string }>>`
      SELECT rs.state AS runtime_state, cl.outcome AS claim_outcome, story.status AS story_status
        FROM runtime_sessions rs
        JOIN claim_log cl ON cl.id = rs.claim_id
        JOIN stories story ON story.id = rs.story_db_id
       WHERE rs.session_id = ${sessionId}
    `;
    assert.deepEqual({ ...ownerRows[0]! }, {
      runtime_state: "starting",
      claim_outcome: null,
      story_status: "running",
    });
  });

  it("fails closed on an ambiguous expired lease and never exposes a normal pending story", async () => {
    const fixture = await setup();
    const leaseAt = new Date(fixture.base.getTime() + 2_000);
    const handoff = await lease(fixture, {
      ownerInstanceId: "ambiguous-owner",
      leaseMs: 60_000,
      now: leaseAt,
    });
    const claims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (${fixture.runId}, 'implement', ${fixture.storyId}, 'orphan-agent', ${new Date(leaseAt.getTime() + 100)})
      RETURNING id::integer AS id
    `;
    await expireDelivery(handoff.dispatchId);

    const report = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: new Date(leaseAt.getTime() + 2_000) },
    );
    assert.equal(report.counts.quarantined, 1);
    assert.equal(report.events[0]?.code, "V3_RECOVERY_LIFECYCLE_UNBOUND_OWNER_AMBIGUOUS");
    assert.equal((await fixture.deliveries.findDelivery(fixture.dispatch.dispatchId))?.state, "leased");
    const story = await database.sql<Array<{ status: string }>>`
      SELECT status FROM stories WHERE id = ${fixture.storyDbId}
    `;
    assert.equal(story[0]?.status, "failed");
    const claim = await database.sql<Array<{ outcome: string | null }>>`
      SELECT outcome FROM claim_log WHERE id = ${claims[0]!.id}
    `;
    assert.equal(claim[0]?.outcome, null);
  });
});
