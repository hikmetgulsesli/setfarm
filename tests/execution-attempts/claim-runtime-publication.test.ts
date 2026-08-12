import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { completeSingleStepClaimAndState } from "../../src/execution/claim-attempt-transition.js";
import {
  publishLoopClaimRuntime,
  publishSingleClaimRuntime,
} from "../../src/execution/claim-runtime-publication.js";
import { loadCompilerEnglishAdmissionLedgerAuthorityV1 } from "../../src/execution/compiler-english-admission-ledger-v1.js";
import {
  createCompilerStoryEnglishAdmissionClaimProofV1,
  lockAndAuthenticateCompilerStoryEnglishAdmissionClaimSubjectV1,
  loadCompilerStoryEnglishAdmissionLedgerAuthorityV1,
  type CompilerStoryEnglishAdmissionClaimProofV1,
} from "../../src/execution/compiler-story-english-admission-ledger-v1.js";
import { publishCompilerStoryEnglishAdmissionAndCompleteV1 } from "../../src/execution/compiler-story-english-admission-publication-v1.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { requestRunTermination } from "../../src/execution/run-termination.js";
import {
  createRuntimeSessionRepository,
  releaseReservedRuntimeSessionInTransaction,
} from "../../src/execution/runtime-session-repository.js";
import { insertV3StoryClaimRuntimeBindingV1 } from "../../src/execution/v3-story-claim-runtime-binding-v1.js";
import { parseV3SupervisorRetryDirectiveStoryOutputV1 } from "../../src/execution/v3-supervisor-retry-directive.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
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
import {
  ProductSpecV2Schema,
  deriveActionInvocationEvidenceIdV2,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import {
  V3RecoveryClaimAuthorityError,
  V3RecoveryClaimHandoffV1Schema,
  createV3RecoveryClaimAuthority,
  type V3RecoveryClaimHandoffV1,
} from "../../src/recovery/v3-recovery-claim-authority.js";
import {
  NODE_CLI_TASK,
  genuineNodeCliProductSpecV2,
} from "../product-compiler/fixtures/no-design-product-semantics-v2.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const PACKET_HASH = "a".repeat(64);
const CONTRACT_SLICE_HASH = "b".repeat(64);
const EVIDENCE_HASH = "c".repeat(64);
const CONTENT_HASH = "d".repeat(64);
const SOURCE_SHA = "1".repeat(40);
const SOURCE_TREE_HASH = "2".repeat(40);
const RECOVERY_LEASE_AT = new Date("2026-07-13T10:00:00.000Z");
const STORY_ADMISSION_DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T09:59:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/claim-runtime-story-admission-drain"],
};

function twoComponentNodeCliProductSpecV2(): ProductSpecV2 {
  const value = structuredClone(genuineNodeCliProductSpecV2()) as any;
  const requirementRefs = value.requirements.map((requirement: any) => requirement.id);
  value.product.goals.push({
    id: "GOAL_ARCHIVE_TASK",
    statement: "Archive one typed task through a separate public CLI interface.",
  });
  value.states.push({
    id: "STATE_ARCHIVED_TASKS",
    name: "Archived Tasks",
    kind: "application",
    initialValue: [],
    invariants: ["Every archived task title is a non-empty string."],
  });
  value.routes.push({
    id: "ROUTE_ARCHIVE_CLI",
    path: "/archive-cli",
    rootSurfaceRef: "SURF_ARCHIVE_TERMINAL",
    surfaceRefs: ["SURF_ARCHIVE_TERMINAL"],
    entry: false,
  });
  value.surfaces.push({
    id: "SURF_ARCHIVE_TERMINAL",
    name: "Archive CLI Terminal",
    kind: "terminal",
    routeRef: "ROUTE_ARCHIVE_CLI",
    required: true,
    composition: { kind: "route_root" },
  });
  const invocationEvidence = deriveActionInvocationEvidenceIdV2("ACT_ARCHIVE_TASK");
  value.actions.push({
    id: "ACT_ARCHIVE_TASK",
    name: "Archive Task",
    trigger: { kind: "user" },
    input: { fields: [{ name: "title", valueType: "string", required: true }] },
    preconditions: [],
    stateDeltas: [{
      stateRef: "STATE_ARCHIVED_TASKS",
      operation: "append",
      path: "",
      valueFrom: { kind: "input", field: "title" },
    }],
    navigation: { kind: "stay" },
    persistenceEffects: [],
    success: {
      stateRefs: ["STATE_ARCHIVED_TASKS"],
      persistenceRefs: [],
      evidenceRefs: ["EVID_TASK_ARCHIVED", invocationEvidence],
      userVisible: true,
    },
    failure: { stateRefs: [], persistenceRefs: [], evidenceRefs: [], userVisible: true },
    evidenceRefs: ["EVID_TASK_ARCHIVED", invocationEvidence],
    invocationInterface: {
      schema: "setfarm.action-invocation-interface-intent.v1",
      kind: "cli_command",
      subcommandTokens: ["archive"],
      fieldBindings: [{
        fieldName: "title",
        optionalPresence: "not_applicable",
        channel: { kind: "argv_flag", flag: "--title", style: "separate" },
      }],
      result: {
        kind: "stdout_json",
        successExitCodes: [0],
        valuePointer: "/task",
        failureCases: structuredClone(value.actions[0].invocationInterface.result.failureCases),
      },
    },
    controlPlacements: [],
    affectedSurfaceRefs: ["SURF_ARCHIVE_TERMINAL"],
    evidenceScenario: { targetInputValues: { title: "Archive Setfarm" }, prerequisiteSteps: [] },
    observableEffects: [{
      id: "OBS_TASK_ARCHIVED",
      selector: {
        kind: "invocation_output",
        coordinate: "result_value",
        pointer: "/title",
        valueContract: { valueType: "string", expectedFrom: { kind: "input", fieldName: "title" } },
      },
      assertions: [{ phase: "after", property: "value", operator: "equals", expected: "Archive Setfarm" }],
      evidenceRef: "EVID_TASK_ARCHIVED",
    }],
  });
  value.evidencePredicates.push(
    {
      id: "EVID_TASK_ARCHIVED",
      kind: "observable_outcome",
      required: true,
      subjectRef: "OBS_TASK_ARCHIVED",
      capabilityRefs: [],
      assertion: { operator: "passes" },
    },
    {
      id: invocationEvidence,
      kind: "action_invocation",
      required: true,
      subjectRef: "ACT_ARCHIVE_TASK",
      capabilityRefs: [],
      assertion: { operator: "passes" },
    },
  );
  for (const [semanticKind, semanticRef] of [
    ["goal", "GOAL_ARCHIVE_TASK"],
    ["state", "STATE_ARCHIVED_TASKS"],
    ["route", "ROUTE_ARCHIVE_CLI"],
    ["surface", "SURF_ARCHIVE_TERMINAL"],
    ["action", "ACT_ARCHIVE_TASK"],
    ["observable", "OBS_TASK_ARCHIVED"],
    ["evidence", "EVID_TASK_ARCHIVED"],
    ["evidence", invocationEvidence],
  ]) {
    value.traceability.bindings.push({ semanticKind, semanticRef, requirementRefs });
  }
  return ProductSpecV2Schema.parse(value);
}

function runtimeIntent(sessionId: string, runtimeAgentId = "prism") {
  return {
    schema: "setfarm.runtime-claim-intent.v1" as const,
    sessionId,
    runtimeAgentId,
    runtimeKind: "openclaw_session" as const,
    ownerInstanceId: "spawner-test",
    sessionKey: `key:${sessionId}`,
  };
}

function createBoundStoryGitWorktree(storyId: string): Readonly<{ root: string; repo: string; branch: string }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-bound-story-"));
  const repo = path.join(root, "repo");
  const origin = path.join(root, "origin.git");
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(origin, { recursive: true });
  execFileSync("git", ["init", "--bare", "-q"], { cwd: origin });
  execFileSync("git", ["init", "-q"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "setfarm-test@example.invalid"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
  fs.writeFileSync(path.join(repo, "README.md"), "# Exact bound story\n", "utf8");
  execFileSync("git", ["add", "README.md"], { cwd: repo });
  execFileSync("git", ["commit", "-qm", "initial story source"], { cwd: repo });
  const branch = storyId.toLowerCase();
  execFileSync("git", ["branch", "-M", branch], { cwd: repo });
  execFileSync("git", ["remote", "add", "origin", origin], { cwd: repo });
  execFileSync("git", ["push", "-qu", "origin", branch], { cwd: repo });
  return { root, repo, branch };
}

async function prepareStoryAdmissionCompletion(
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
  const claims = await database.sql<Array<{ id: number }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
    VALUES (${input.runId}, ${input.workflowStepId}, NULL, ${claimAgentId})
    RETURNING id::integer AS id
  `;
  const claimId = claims[0]!.id;
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
    input: `Durable ${input.workflowStepId} fixture completion`,
  };
  const requested = await requestRuntimeCompletion(database.sql, {
    envelope,
    output: input.output,
    requestId: `RCR_${token}`,
  });
  assert.equal(requested.status, "requested");
  if (requested.status !== "requested") throw new Error("story admission completion request missing");
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
    throw new Error("story admission completion owner capability missing");
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

async function settleStoryAdmissionCompletion(
  database: TestDatabase,
  managed: Awaited<ReturnType<typeof prepareStoryAdmissionCompletion>>,
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
    evidence: { source: "claim-runtime-story-admission-fixture" },
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

async function seedV3LoopWithStoryAdmission(
  database: TestDatabase,
  runId: string,
  productSpec: ProductSpecV2 = genuineNodeCliProductSpecV2(),
): Promise<Readonly<{
  stepDbId: string;
  storyDbId: string;
  storyAdmissionProof: CompilerStoryEnglishAdmissionClaimProofV1;
}>> {
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
  const verifyStepDbId = `${runId}-verify-step`;
  await database.sql`
    INSERT INTO runs (
      id, workflow_id, task, status, context, protocol, protocol_version,
      compiler_release_sha, packet_hash, activation_preflight_hash, release_admission_hash
    ) VALUES (
      ${runId}, 'feature-dev', ${NODE_CLI_TASK}, 'running', ${JSON.stringify(baseContext)},
      'v3', 1, ${releaseSha}, ${PACKET_HASH}, ${"e".repeat(64)}, ${releaseAdmissionHash}
    )
  `;
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
    ), (
      ${verifyStepDbId}, ${runId}, 'verify', 'feature-dev_reviewer', 6, '', '',
      'waiting', 'single', 0, 3
    )
  `;
  await database.sql`
    UPDATE steps
       SET loop_config = ${JSON.stringify({ superviseEach: true, superviseStep: "supervise" })}
     WHERE id = ${stepDbId}
  `;

  const managedPlan = await prepareStoryAdmissionCompletion(database, {
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
  const planCompletionPlan = createSingleEffectCompletionPlanDescriptorV1({
    kind: "single_completion",
    continuation: { type: "single_pipeline_advance" },
    effectPayload: { stepId: "plan", compilerEnglishAdmissionReceipt: planReceipt },
  });
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
    completionPlan: planCompletionPlan,
  }));
  await settleStoryAdmissionCompletion(database, managedPlan);
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
  const designContext = { ...planContext, screen_map: "[]", screens_generated: "0", design_system: "{}" };
  await database.sql`UPDATE steps SET status = 'running' WHERE id = ${designStepDbId}`;
  const managedDesign = await prepareStoryAdmissionCompletion(database, {
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
  await settleStoryAdmissionCompletion(database, managedDesign);

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
    UPDATE runs SET context = ${JSON.stringify(storyAdmissionContext)} WHERE id = ${runId}
  `;
  await database.sql`UPDATE steps SET status = 'running' WHERE id = ${storiesStepDbId}`;
  const managedStories = await prepareStoryAdmissionCompletion(database, {
    runId,
    stepDbId: storiesStepDbId,
    workflowStepId: "stories",
    output: storyOutput,
  });
  const designAuthoritySubjectHash = await designAuthoritySubjectHashV1(
    database.sql,
    runId,
    storyAdmissionContext,
    productSpecHash,
    false,
  );
  const storyAuthority = compileCompilerStoryEnglishAdmissionV1({
    claimId: managedStories.claimId,
    runId,
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
  await settleStoryAdmissionCompletion(database, managedStories);
  const durableStoryAuthority = await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(
    database.sql,
    { runId },
  );
  const storyRows = await database.sql<Array<{ id: string; story_id: string }>>`
    SELECT id, story_id FROM stories WHERE run_id = ${runId} ORDER BY story_index, story_id
  `;
  assert.equal(storyRows[0]?.story_id, "US-001");
  return Object.freeze({
    stepDbId,
    storyDbId: storyRows[0]!.id,
    storyAdmissionProof: createCompilerStoryEnglishAdmissionClaimProofV1(durableStoryAuthority),
  });
}

async function prepareV3SupervisorCompletion(
  database: TestDatabase,
  input: Readonly<{
    runId: string;
    storyDbId?: string;
    storyId?: string;
    storyAdmissionProof: CompilerStoryEnglishAdmissionClaimProofV1;
    subjectKind: "story_member" | "final_product";
    sessionId: string;
    output: string;
  }>,
) {
  const superviseStepDbId = `${input.runId}-supervise-step`;
  const publication = await publishSingleClaimRuntime(database.sql, {
    runId: input.runId,
    stepDbId: superviseStepDbId,
    workflowStepId: "supervise",
    claimAgentId: "feature-dev_supervisor",
    runtimeIntent: runtimeIntent(input.sessionId),
    storyAdmissionProof: input.storyAdmissionProof,
    storySubject: input.subjectKind === "final_product"
      ? { kind: "final_product" }
      : {
          kind: "story_member",
          storyDbId: input.storyDbId!,
          storyId: input.storyId!,
        },
  });
  assert.ok(publication);
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    protocol: "v3",
    issuedAt: new Date().toISOString(),
    stepId: superviseStepDbId,
    workflowStepId: "supervise",
    runId: input.runId,
    claimId: publication!.claimId,
    claimAgentId: "feature-dev_supervisor",
    runtimeAgentId: "prism",
  };
  const requested = await requestRuntimeCompletion(database.sql, {
    envelope,
    output: input.output,
  });
  assert.equal(requested.status, "requested");
  if (requested.status !== "requested") throw new Error("supervisor completion request missing");
  const completions = createRuntimeCompletionRepository(database.sql);
  await completions.claim({
    requestId: requested.request.requestId,
    ownerInstanceId: "spawner-test",
  });
  await createRuntimeSessionRepository(database.sql).markDrained({
    sessionId: input.sessionId,
    ownerInstanceId: "spawner-test",
    evidence: STORY_ADMISSION_DRAIN_EVIDENCE,
  });
  const processing = await completions.markProcessing({
    requestId: requested.request.requestId,
    ownerInstanceId: "spawner-test",
  });
  if (!processing.ownerInstanceId || !processing.leaseExpiresAt) {
    throw new Error("supervisor completion owner capability missing");
  }
  return {
    publication: publication!,
    envelope,
    completions,
    processing,
    requestId: requested.request.requestId,
    superviseStepDbId,
  };
}

async function settleV3SupervisorFailureEffect(
  database: TestDatabase,
  managed: Awaited<ReturnType<typeof prepareV3SupervisorCompletion>>,
): Promise<void> {
  const effects = createRuntimeCompletionEffectRepository(database.sql);
  const effect = await effects.claimNext({
    requestId: managed.requestId,
    ownerInstanceId: "spawner-test",
  });
  assert.ok(effect?.leaseToken);
  await effects.settle({
    requestId: managed.requestId,
    effectKey: effect!.effectKey,
    ownerInstanceId: "spawner-test",
    leaseToken: effect!.leaseToken!,
    resolution: "reconciled",
    result: { advanced: false, runCompleted: false },
    evidence: { source: "v3-supervisor-failure-owner-state" },
  });
  await managed.completions.markEffectsCommitted({
    requestId: managed.requestId,
    ownerInstanceId: "spawner-test",
    ownerAttemptCount: managed.processing.ownerAttemptCount,
    result: { advanced: false, runCompleted: false },
  });
  await managed.completions.acceptAndRelease({
    requestId: managed.requestId,
    ownerInstanceId: "spawner-test",
    ownerAttemptCount: managed.processing.ownerAttemptCount,
    result: { advanced: false, runCompleted: false },
  });
}

async function seedSingle(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
) {
  await database.insertRun(runId);
  const stepDbId = `${runId}-step`;
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
    VALUES
      (${stepDbId}, ${runId}, 'plan', 'feature-dev_planner', 1, '', '', 'pending')
  `;
  return stepDbId;
}

async function seedV3PlanSingle(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  context: Readonly<Record<string, unknown>>,
) {
  const releaseSha = "4".repeat(40);
  const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
  await database.sql`
    INSERT INTO runs (
      id, workflow_id, task, status, context, protocol,
      compiler_release_sha, activation_preflight_hash, release_admission_hash
    ) VALUES (
      ${runId}, 'feature-dev', 'atomic plan authority', 'running',
      ${JSON.stringify(context)}, 'v3', ${releaseSha}, ${"e".repeat(64)},
      ${releaseAdmissionHash}
    )
  `;
  const stepDbId = `${runId}-step`;
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
    VALUES
      (${stepDbId}, ${runId}, 'plan', 'feature-dev_planner', 1, '', '', 'pending')
  `;
  return stepDbId;
}

async function seedLoop(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  protocol: "shadow" | "v3" = "shadow",
) {
  if (protocol === "v3") {
    return seedV3LoopWithStoryAdmission(database, runId);
  }
  await database.insertRun(runId);
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type)
    VALUES
      (${stepDbId}, ${runId}, 'implement', 'feature-dev_developer', 1, '', '', 'pending', 'loop')
  `;
  await database.sql`
    INSERT INTO stories
      (id, run_id, story_index, story_id, title, status, claim_generation)
    VALUES
      (${storyDbId}, ${runId}, 1, 'US-001', 'Story', 'pending', 0)
  `;
  return { stepDbId, storyDbId };
}

function recoveryFindingSet(runId: string) {
  return createFindingSetV1({
    runId,
    storyId: "US-001",
    packetHash: PACKET_HASH,
    sliceHash: CONTRACT_SLICE_HASH,
    sourceRevision: { sha: SOURCE_SHA, treeHash: SOURCE_TREE_HASH },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: CONTENT_HASH }],
      observedEvidenceRefs: [EVIDENCE_HASH],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function recoveryDraft(
  findingSet: ReturnType<typeof recoveryFindingSet>,
): RecoveryCaseDraftV1 {
  return {
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: findingSet.packetHash,
    sliceHash: findingSet.sliceHash,
    sourceRevision: findingSet.sourceRevision,
    owner: "implement",
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

async function seedRecoveryCase(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  storyStatus: "pending" | "failed" = "failed",
) {
  const loop = await seedLoop(database, runId, "v3");
  await database.sql`
    UPDATE stories SET status = ${storyStatus} WHERE id = ${loop.storyDbId}
  `;
  const findingSet = recoveryFindingSet(runId);
  const findings = createFindingRecoveryRepository(database.sql);
  await findings.putFindingSet(findingSet);
  const opened = await findings.openRecoveryCase(recoveryDraft(findingSet), {
    now: new Date("2026-07-13T09:59:58.000Z"),
  });
  const deliveries = createRecoveryDeliveryRepository(database.sql);
  const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
  assert.ok(revision);
  return {
    ...loop,
    findingSet,
    recoveryCase: opened.recoveryCase,
    revision,
    deliveries,
  };
}

async function seedRecoveryLoop(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
) {
  const fixture = await seedRecoveryCase(database, runId);
  const authorization = await fixture.deliveries.authorizeCurrentRevision({
    recoveryCaseId: fixture.recoveryCase.recoveryCaseId,
    revisionId: fixture.revision.revisionId,
    expectedStateVersion: fixture.recoveryCase.stateVersion,
    dispatchClass: "product_implementation",
  }, { now: new Date("2026-07-13T09:59:59.000Z") });
  assert.equal(authorization.status, "authorized");
  if (authorization.status !== "authorized") throw new Error("expected recovery dispatch authorization");
  return {
    ...fixture,
    dispatch: authorization.dispatch,
  };
}

async function acquireRecoveryHandoff(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{ runId: string; ownerInstanceId?: string; leaseMs?: number }>,
): Promise<V3RecoveryClaimHandoffV1> {
  return createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
    runId: input.runId,
    storyId: "US-001",
    ownerInstanceId: input.ownerInstanceId ?? "recovery-worker",
    leaseMs: input.leaseMs ?? 60_000,
  }, { now: RECOVERY_LEASE_AT });
}

function recoveryPublicationInput(
  runId: string,
  loop: Readonly<{
    stepDbId: string;
    storyDbId: string;
    storyAdmissionProof: CompilerStoryEnglishAdmissionClaimProofV1;
  }>,
  sessionId: string,
  recoveryHandoff?: V3RecoveryClaimHandoffV1,
) {
  return {
    runId,
    stepDbId: loop.stepDbId,
    workflowStepId: "implement",
    storyDbId: loop.storyDbId,
    storyId: "US-001",
    claimAgentId: "recovery-implement-agent",
    callerGatewayAgent: "supervisor-gateway-pool",
    parallelLimit: 1,
    runtimeIntent: runtimeIntent(sessionId, "recovery-runtime-agent"),
    storyAdmissionProof: loop.storyAdmissionProof,
    ...(recoveryHandoff ? { recoveryHandoff } : {}),
    now: new Date("2026-07-13T10:00:01.000Z"),
  } as const;
}

describe("atomic claim and durable runtime publication", () => {
  it("publishes a single claim, running step, and reserved runtime in one commit", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-publication";
      const stepDbId = await seedSingle(database, runId);
      const result = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_single-publication-01"),
      });
      assert.ok(result);
      const rows = await database.sql<Array<{
        step_status: string;
        claim_count: number;
        session_count: number;
        claim_id: number;
        session_claim_id: number;
        session_state: string;
      }>>`
        SELECT s.status AS step_status,
               COUNT(DISTINCT cl.id)::integer AS claim_count,
               COUNT(DISTINCT rs.session_id)::integer AS session_count,
               MIN(cl.id)::integer AS claim_id,
               MIN(rs.claim_id)::integer AS session_claim_id,
               MIN(rs.state) AS session_state
          FROM steps s
          JOIN claim_log cl ON cl.run_id = s.run_id AND cl.step_id = s.step_id
          JOIN runtime_sessions rs ON rs.claim_id = cl.id
         WHERE s.id = ${stepDbId}
         GROUP BY s.status
      `;
      assert.deepEqual({ ...rows[0] }, {
        step_status: "running",
        claim_count: 1,
        session_count: 1,
        claim_id: result!.claimId,
        session_claim_id: result!.claimId,
        session_state: "reserved",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("atomically seals the PLAN output authority with its new v3 claim", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-plan-authority-seal";
      const stepDbId = await seedV3PlanSingle(database, runId, {
        task: "atomic plan authority",
      });
      const result = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_single-plan-authority-seal"),
        planAuthoritySeal: {
          productSemanticsVersion: "v2",
          outputAuthorityVersion: "product_build_v1",
        },
      });
      assert.ok(result);
      const rows = await database.sql<Array<{
        step_status: string;
        claim_count: number;
        session_count: number;
        semantics_version: string;
        authority_version: string;
      }>>`
        SELECT step.status AS step_status,
               (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id) AS claim_count,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = run.id) AS session_count,
               run.context::jsonb ->> 'product_semantics_version' AS semantics_version,
               run.context::jsonb ->> 'plan_output_authority_version' AS authority_version
          FROM runs run
          JOIN steps step ON step.id = ${stepDbId}
         WHERE run.id = ${runId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        step_status: "running",
        claim_count: 1,
        session_count: 1,
        semantics_version: "v2",
        authority_version: "product_build_v1",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back PLAN publication when its authority seal conflicts", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-plan-authority-conflict";
      const stepDbId = await seedV3PlanSingle(database, runId, {
        product_semantics_version: "v1",
      });
      await assert.rejects(
        publishSingleClaimRuntime(database.sql, {
          runId,
          stepDbId,
          workflowStepId: "plan",
          claimAgentId: "feature-dev_planner",
          runtimeIntent: runtimeIntent("RTS_single-plan-authority-conflict"),
          planAuthoritySeal: {
            productSemanticsVersion: "v2",
            outputAuthorityVersion: "product_build_v1",
          },
        }),
        /PLAN_AUTHORITY_SEAL_SEMANTICS_VERSION_CONFLICT/u,
      );
      const rows = await database.sql<Array<{
        step_status: string;
        claim_count: number;
        session_count: number;
        authority_version: string | null;
      }>>`
        SELECT step.status AS step_status,
               (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id) AS claim_count,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = run.id) AS session_count,
               run.context::jsonb ->> 'plan_output_authority_version' AS authority_version
          FROM runs run
          JOIN steps step ON step.id = ${stepDbId}
         WHERE run.id = ${runId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        step_status: "pending",
        claim_count: 0,
        session_count: 0,
        authority_version: null,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects malformed PLAN authority seals before publication", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-plan-authority-invalid";
      const stepDbId = await seedV3PlanSingle(database, runId, {
        task: "invalid plan authority",
      });
      const baseInput = {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_single-plan-authority-invalid"),
      };
      await assert.rejects(
        publishSingleClaimRuntime(database.sql, {
          ...baseInput,
          planAuthoritySeal: {
            productSemanticsVersion: "v1",
            outputAuthorityVersion: "product_build_v1",
          } as never,
        }),
        /PLAN_AUTHORITY_SEAL_INVALID/u,
      );
      await assert.rejects(
        publishSingleClaimRuntime(database.sql, {
          ...baseInput,
          planAuthoritySeal: {
            productSemanticsVersion: "v2",
            outputAuthorityVersion: "product_build_v1",
            forged: true,
          } as never,
        }),
        /PLAN_AUTHORITY_SEAL_INVALID/u,
      );
      const rows = await database.sql<Array<{
        step_status: string;
        claim_count: number;
        session_count: number;
        semantics_version: string | null;
        authority_version: string | null;
      }>>`
        SELECT step.status AS step_status,
               (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id) AS claim_count,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = run.id) AS session_count,
               run.context::jsonb ->> 'product_semantics_version' AS semantics_version,
               run.context::jsonb ->> 'plan_output_authority_version' AS authority_version
          FROM runs run
          JOIN steps step ON step.id = ${stepDbId}
         WHERE run.id = ${runId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        step_status: "pending",
        claim_count: 0,
        session_count: 0,
        semantics_version: null,
        authority_version: null,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back the PLAN authority seal when runtime reservation fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const firstRun = "run-plan-seal-runtime-fault-a";
      const firstStep = await seedSingle(database, firstRun);
      const duplicateSessionId = "RTS_plan-seal-runtime-fault";
      await publishSingleClaimRuntime(database.sql, {
        runId: firstRun,
        stepDbId: firstStep,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent(duplicateSessionId),
      });

      const secondRun = "run-plan-seal-runtime-fault-b";
      const secondStep = await seedV3PlanSingle(database, secondRun, {
        task: "atomic rollback",
      });
      await assert.rejects(
        publishSingleClaimRuntime(database.sql, {
          runId: secondRun,
          stepDbId: secondStep,
          workflowStepId: "plan",
          claimAgentId: "feature-dev_planner",
          runtimeIntent: runtimeIntent(duplicateSessionId),
          planAuthoritySeal: {
            productSemanticsVersion: "v2",
            outputAuthorityVersion: "product_build_v1",
          },
        }),
        /duplicate key value|unique constraint/i,
      );
      const rows = await database.sql<Array<{
        step_status: string;
        claim_count: number;
        semantics_version: string | null;
        authority_version: string | null;
      }>>`
        SELECT step.status AS step_status,
               (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id) AS claim_count,
               run.context::jsonb ->> 'product_semantics_version' AS semantics_version,
               run.context::jsonb ->> 'plan_output_authority_version' AS authority_version
          FROM runs run
          JOIN steps step ON step.id = ${secondStep}
         WHERE run.id = ${secondRun}
      `;
      assert.deepEqual({ ...rows[0] }, {
        step_status: "pending",
        claim_count: 0,
        semantics_version: null,
        authority_version: null,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back step and claim publication when runtime reservation fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const firstRun = "run-publication-fault-a";
      const firstStep = await seedSingle(database, firstRun);
      const duplicateSessionId = "RTS_publication-fault-01";
      await publishSingleClaimRuntime(database.sql, {
        runId: firstRun,
        stepDbId: firstStep,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent(duplicateSessionId),
      });

      const secondRun = "run-publication-fault-b";
      const secondStep = await seedSingle(database, secondRun);
      await assert.rejects(
        publishSingleClaimRuntime(database.sql, {
          runId: secondRun,
          stepDbId: secondStep,
          workflowStepId: "plan",
          claimAgentId: "feature-dev_planner",
          runtimeIntent: runtimeIntent(duplicateSessionId),
        }),
        /duplicate key value|unique constraint/i,
      );
      const state = await database.sql<Array<{ status: string; claims: number }>>`
        SELECT s.status, COUNT(cl.id)::integer AS claims
          FROM steps s
          LEFT JOIN claim_log cl ON cl.run_id = s.run_id
         WHERE s.id = ${secondStep}
         GROUP BY s.status
      `;
      assert.deepEqual({ ...state[0] }, { status: "pending", claims: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("does not republish the same single-step work until its previous runtime owner is released", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-unreleased-owner";
      const stepDbId = await seedSingle(database, runId);
      const firstSessionId = "RTS_single-unreleased-owner-01";
      const first = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent(firstSessionId),
      });
      assert.ok(first);

      await database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          "UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW() WHERE id = $1",
          [first!.claimId],
        );
        await transaction.unsafe(
          "UPDATE steps SET status = 'pending', updated_at = NOW() WHERE id = $1",
          [stepDbId],
        );
      });

      const blocked = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_single-unreleased-owner-02"),
      });
      assert.equal(blocked, undefined);

      await database.sql.begin((transaction) => releaseReservedRuntimeSessionInTransaction(transaction, {
        sessionId: firstSessionId,
        claimId: first!.claimId,
        ownerInstanceId: "spawner-test",
        diagnostic: "test proved the first runtime never spawned",
      }));
      const retried = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_single-unreleased-owner-03"),
      });
      assert.ok(retried);
      assert.notEqual(retried!.claimId, first!.claimId);
    } finally {
      await database.cleanup();
    }
  });

  it("serializes cancellation before claim publication on the run row", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-cancel-first-publication";
      const stepDbId = await seedSingle(database, runId);
      await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "test",
        diagnostic: "cancel first",
        requestId: "RTR_cancel-first-publish01",
      });
      const claim = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_cancel-first-publish01"),
      });
      assert.equal(claim, undefined);
      const rows = await database.sql<Array<{ run_status: string; step_status: string; claims: number; sessions: number }>>`
        SELECT r.status AS run_status, s.status AS step_status,
               COUNT(DISTINCT cl.id)::integer AS claims,
               COUNT(DISTINCT rs.session_id)::integer AS sessions
          FROM runs r
          JOIN steps s ON s.run_id = r.id
          LEFT JOIN claim_log cl ON cl.run_id = r.id
          LEFT JOIN runtime_sessions rs ON rs.run_id = r.id
         WHERE r.id = ${runId}
         GROUP BY r.status, s.status
      `;
      assert.deepEqual({ ...rows[0] }, {
        run_status: "cancelling",
        step_status: "pending",
        claims: 0,
        sessions: 0,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("publishes exactly one loop claim and runtime under concurrent claimers", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-loop-publication-race";
      const { stepDbId, storyDbId } = await seedLoop(database, runId);
      const input = {
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimAgentId: "feature-dev_developer",
        callerGatewayAgent: "prism",
        parallelLimit: 1,
      } as const;
      const [left, right] = await Promise.all([
        publishLoopClaimRuntime(database.sql, {
          ...input,
          runtimeIntent: runtimeIntent("RTS_loop-publication-left"),
        }),
        publishLoopClaimRuntime(database.sql, {
          ...input,
          runtimeIntent: runtimeIntent("RTS_loop-publication-right"),
        }),
      ]);
      assert.equal([left, right].filter(Boolean).length, 1);
      const rows = await database.sql<Array<{ claims: number; sessions: number; generation: number; story_status: string }>>`
        SELECT COUNT(DISTINCT cl.id)::integer AS claims,
               COUNT(DISTINCT rs.session_id)::integer AS sessions,
               MAX(st.claim_generation)::integer AS generation,
               MIN(st.status) AS story_status
          FROM stories st
          LEFT JOIN claim_log cl ON cl.run_id = st.run_id AND cl.story_id = st.story_id
          LEFT JOIN runtime_sessions rs ON rs.claim_id = cl.id
         WHERE st.id = ${storyDbId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        claims: 1,
        sessions: 1,
        generation: 1,
        story_status: "running",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("serializes sibling implementation behind the exact canonical story quality gate", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-cross-story-quality-fence";
      const fixture = await seedV3LoopWithStoryAdmission(
        database,
        runId,
        twoComponentNodeCliProductSpecV2(),
      );
      const stories = await database.sql<Array<{ id: string; story_id: string }>>`
        SELECT id, story_id FROM stories WHERE run_id = ${runId} ORDER BY story_index
      `;
      assert.equal(stories.length, 2);
      const first = stories[0]!;
      const second = stories[1]!;
      await database.sql`
        UPDATE stories SET status = 'done', claim_generation = 1 WHERE id = ${first.id}
      `;
      const blocked = await publishLoopClaimRuntime(database.sql, {
        runId,
        stepDbId: fixture.stepDbId,
        workflowStepId: "implement",
        storyDbId: second.id,
        storyId: second.story_id,
        claimAgentId: "feature-dev_developer",
        parallelLimit: 1,
        runtimeIntent: runtimeIntent("RTS_v3-cross-story-quality-blocked"),
        storyAdmissionProof: fixture.storyAdmissionProof,
      });
      assert.equal(blocked, undefined);
      await database.sql`
        UPDATE steps SET status = 'pending', current_story_id = ${first.id}
         WHERE id = ${runId + "-supervise-step"}
      `;
      assert.equal(await publishLoopClaimRuntime(database.sql, {
        runId,
        stepDbId: fixture.stepDbId,
        workflowStepId: "implement",
        storyDbId: second.id,
        storyId: second.story_id,
        claimAgentId: "feature-dev_developer",
        parallelLimit: 1,
        runtimeIntent: runtimeIntent("RTS_v3-cross-story-supervise-pending"),
        storyAdmissionProof: fixture.storyAdmissionProof,
      }), undefined);
      await database.sql`
        UPDATE stories SET status = 'verified' WHERE id = ${first.id}
      `;
      await database.sql`
        UPDATE steps SET status = 'waiting', current_story_id = NULL
         WHERE id = ${runId + "-supervise-step"}
      `;
      const admitted = await publishLoopClaimRuntime(database.sql, {
        runId,
        stepDbId: fixture.stepDbId,
        workflowStepId: "implement",
        storyDbId: second.id,
        storyId: second.story_id,
        claimAgentId: "feature-dev_developer",
        parallelLimit: 1,
        runtimeIntent: runtimeIntent("RTS_v3-cross-story-quality-admitted"),
        storyAdmissionProof: fixture.storyAdmissionProof,
      });
      assert.ok(admitted);
      assert.equal(admitted!.claimGeneration, 1);
    } finally {
      await database.cleanup();
    }
  });

  it("rejects invalid loop parallel limits before publication", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-loop-invalid-parallel-limit";
      const { stepDbId, storyDbId } = await seedLoop(database, runId);
      for (const parallelLimit of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1, 1.5, 101]) {
        await assert.rejects(
          publishLoopClaimRuntime(database.sql, {
            runId,
            stepDbId,
            workflowStepId: "implement",
            storyDbId,
            storyId: "US-001",
            claimAgentId: "feature-dev_developer",
            parallelLimit,
            runtimeIntent: runtimeIntent(`RTS_invalid-parallel-${String(parallelLimit)}`),
          }),
          /LOOP_CLAIM_PARALLEL_LIMIT_INVALID/,
        );
      }
      const state = await database.sql<Array<{ claims: number; sessions: number; story_status: string }>>`
        SELECT (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = ${runId}) AS sessions,
               status AS story_status
          FROM stories WHERE id = ${storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, { claims: 0, sessions: 0, story_status: "pending" });
    } finally {
      await database.cleanup();
    }
  });

  it("derives the exact V3 story binding generation inside loop publication", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-story-binding-generation";
      const fixture = await seedV3LoopWithStoryAdmission(database, runId);
      const publication = await publishLoopClaimRuntime(database.sql, {
        runId,
        stepDbId: fixture.stepDbId,
        workflowStepId: "implement",
        storyDbId: fixture.storyDbId,
        storyId: "US-001",
        claimAgentId: "feature-dev_developer",
        callerGatewayAgent: "prism",
        parallelLimit: 1,
        runtimeIntent: runtimeIntent("RTS_v3-story-binding-generation"),
        storyAdmissionProof: fixture.storyAdmissionProof,
      });
      assert.ok(publication);
      assert.deepEqual(publication!.storySubject, {
        kind: "story_member",
        storyDbId: fixture.storyDbId,
        storyId: "US-001",
        storyIndex: 0,
        storyClaimGeneration: 1,
      });
      const bindings = await database.sql<Array<{
        claim_id: number;
        runtime_session_id: string;
        subject_kind: string;
        story_db_id: string;
        story_id: string;
        story_index: number;
        story_claim_generation: number;
      }>>`
        SELECT claim_id::integer AS claim_id, runtime_session_id, subject_kind,
               story_db_id, story_id, story_index, story_claim_generation
          FROM v3_story_claim_runtime_bindings_v1
         WHERE claim_id = ${publication!.claimId}
      `;
      assert.deepEqual({ ...bindings[0] }, {
        claim_id: publication!.claimId,
        runtime_session_id: "RTS_v3-story-binding-generation",
        subject_kind: "story_member",
        story_db_id: fixture.storyDbId,
        story_id: "US-001",
        story_index: 0,
        story_claim_generation: 1,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back the full V3 claim and runtime publication when binding insertion fails late", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-story-binding-late-rollback";
      const fixture = await seedV3LoopWithStoryAdmission(database, runId);
      await database.sql.unsafe(
        `ALTER TABLE v3_story_claim_runtime_bindings_v1
           ADD CONSTRAINT v3_binding_late_rejection
           CHECK (runtime_session_id <> 'RTS_v3-story-binding-late-rollback')`,
        [],
      );
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, {
          runId,
          stepDbId: fixture.stepDbId,
          workflowStepId: "implement",
          storyDbId: fixture.storyDbId,
          storyId: "US-001",
          claimAgentId: "feature-dev_developer",
          parallelLimit: 1,
          runtimeIntent: runtimeIntent("RTS_v3-story-binding-late-rollback"),
          storyAdmissionProof: fixture.storyAdmissionProof,
        }),
        /v3_binding_late_rejection/,
      );
      const state = await database.sql<Array<{
        story_status: string;
        story_generation: number;
        step_status: string;
        current_story_id: string | null;
        claims: number;
        runtimes: number;
        bindings: number;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation AS story_generation,
               step.status AS step_status,
               step.current_story_id,
               (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${runId} AND step_id = 'implement') AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${runId} AND workflow_step_id = 'implement') AS runtimes,
               (SELECT COUNT(*)::integer FROM v3_story_claim_runtime_bindings_v1 WHERE run_id = ${runId}) AS bindings
          FROM stories story
          JOIN steps step ON step.id = ${fixture.stepDbId}
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "pending",
        story_generation: 0,
        step_status: "pending",
        current_story_id: null,
        claims: 0,
        runtimes: 0,
        bindings: 0,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("does not let an authenticated final subject bypass binding eligibility", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-final-binding-direct-bypass";
      const fixture = await seedV3LoopWithStoryAdmission(database, runId);
      const durable = await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(
        database.sql,
        { runId },
      );
      await database.sql`
        UPDATE stories SET status = 'done' WHERE run_id = ${runId}
      `;
      await assert.rejects(
        database.sql.begin(async (transaction) => {
          const authority = await lockAndAuthenticateCompilerStoryEnglishAdmissionClaimSubjectV1(
            transaction,
            {
              runId,
              proof: createCompilerStoryEnglishAdmissionClaimProofV1(durable),
              subject: { kind: "final_product" },
            },
          );
          await insertV3StoryClaimRuntimeBindingV1(transaction, {
            claimId: 999_999,
            runtimeSessionId: "RTS_v3-final-binding-direct-bypass",
            runId,
            stepDbId: `${runId}-supervise-step`,
            workflowStepId: "supervise",
            authority,
          });
        }),
        /V3_SUPERVISE_FINAL_PRODUCT_NOT_ELIGIBLE/,
      );
      const bindings = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count
          FROM v3_story_claim_runtime_bindings_v1
         WHERE run_id = ${runId}
      `;
      assert.equal(bindings[0]?.count, 0);
      assert.ok(fixture.storyDbId);
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back a supervisor publication when a locked pointer swaps before eligibility", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-supervise-pointer-swap";
      const fixture = await seedV3LoopWithStoryAdmission(database, runId);
      const superviseStepDbId = `${runId}-supervise-step`;
      await database.sql`
        UPDATE stories SET status = 'done', claim_generation = 1 WHERE id = ${fixture.storyDbId}
      `;
      await database.sql`
        UPDATE steps SET status = 'pending', current_story_id = ${fixture.storyDbId}
         WHERE id = ${superviseStepDbId}
      `;
      let locked!: () => void;
      const lockReady = new Promise<void>((resolve) => { locked = resolve; });
      let release!: () => void;
      const maySwap = new Promise<void>((resolve) => { release = resolve; });
      const swap = database.sql.begin(async (transaction) => {
        await transaction.unsafe("SELECT id FROM steps WHERE id = $1 FOR UPDATE", [superviseStepDbId]);
        locked();
        await maySwap;
        await transaction.unsafe(
          "UPDATE steps SET current_story_id = NULL WHERE id = $1",
          [superviseStepDbId],
        );
      });
      await lockReady;
      const publication = publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId: superviseStepDbId,
        workflowStepId: "supervise",
        claimAgentId: "feature-dev_supervisor",
        runtimeIntent: runtimeIntent("RTS_v3-supervise-pointer-swap"),
        storyAdmissionProof: fixture.storyAdmissionProof,
        storySubject: {
          kind: "story_member",
          storyDbId: fixture.storyDbId,
          storyId: "US-001",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
      release();
      await swap;
      await assert.rejects(publication, /V3_SUPERVISE_STORY_SUBJECT_NOT_ELIGIBLE/);
      const state = await database.sql<Array<{ claims: number; runtimes: number; bindings: number }>>`
        SELECT (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${runId} AND step_id = 'supervise') AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${runId} AND workflow_step_id = 'supervise') AS runtimes,
               (SELECT COUNT(*)::integer FROM v3_story_claim_runtime_bindings_v1
                 WHERE run_id = ${runId} AND workflow_step_id = 'supervise') AS bindings
      `;
      assert.deepEqual({ ...state[0] }, { claims: 0, runtimes: 0, bindings: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("ignores settled supervision from a prior story claim generation", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-supervise-generation-retry";
      const fixture = await seedV3LoopWithStoryAdmission(database, runId);
      const superviseStepDbId = `${runId}-supervise-step`;
      await database.sql`
        UPDATE stories
           SET status = 'done', claim_generation = 1
         WHERE id = ${fixture.storyDbId}
      `;
      await database.sql`
        UPDATE steps
           SET status = 'pending', current_story_id = ${fixture.storyDbId}
         WHERE id = ${superviseStepDbId}
      `;
      const first = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId: superviseStepDbId,
        workflowStepId: "supervise",
        claimAgentId: "feature-dev_supervisor",
        runtimeIntent: runtimeIntent("RTS_v3-supervise-generation-one"),
        storyAdmissionProof: fixture.storyAdmissionProof,
        storySubject: {
          kind: "story_member",
          storyDbId: fixture.storyDbId,
          storyId: "US-001",
        },
      });
      assert.equal(first?.storySubject?.kind, "story_member");
      assert.equal(first?.storySubject?.storyClaimGeneration, 1);
      const firstEnvelope: ClaimEnvelopeV1 = {
        schema: "setfarm.claim-envelope.v1",
        protocol: "v3",
        issuedAt: new Date().toISOString(),
        stepId: superviseStepDbId,
        workflowStepId: "supervise",
        runId,
        claimId: first!.claimId,
        claimAgentId: "feature-dev_supervisor",
        runtimeAgentId: "prism",
      };
      const requested = await requestRuntimeCompletion(database.sql, {
        envelope: firstEnvelope,
        output: "STATUS: done\nSUPERVISOR_DECISION: pass",
      });
      assert.equal(requested.status, "requested");
      if (requested.status !== "requested") throw new Error("supervise completion request missing");
      const completions = createRuntimeCompletionRepository(database.sql);
      await completions.claim({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-test",
      });
      await createRuntimeSessionRepository(database.sql).markDrained({
        sessionId: "RTS_v3-supervise-generation-one",
        ownerInstanceId: "spawner-test",
        evidence: STORY_ADMISSION_DRAIN_EVIDENCE,
      });
      const processing = await completions.markProcessing({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-test",
      });
      await runWithRuntimeCompletionOwner({
        requestId: processing.requestId,
        ownerInstanceId: processing.ownerInstanceId!,
        leaseExpiresAt: processing.leaseExpiresAt!,
        ownerAttemptCount: processing.ownerAttemptCount,
      }, () => completeSingleStepClaimAndState(database.sql, {
        envelope: firstEnvelope,
        stepStatus: "waiting",
        stepOutput: "STATUS: done\nSUPERVISOR_DECISION: pass",
        clearCurrentStory: true,
        completionPlan: createSingleEffectCompletionPlanDescriptorV1({
          kind: "single_completion",
          continuation: {
            type: "supervise_each_decision",
            targetStepDbId: `${runId}-verify-step`,
            targetStepId: "verify",
          },
          subject: { storyDbId: fixture.storyDbId, storyId: "US-001" },
          effectPayload: { supervisorStepDbId: superviseStepDbId },
        }),
      }));
      const effects = createRuntimeCompletionEffectRepository(database.sql);
      const effect = await effects.claimNext({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-test",
      });
      assert.ok(effect?.leaseToken);
      await effects.settle({
        requestId: requested.request.requestId,
        effectKey: effect!.effectKey,
        ownerInstanceId: "spawner-test",
        leaseToken: effect!.leaseToken!,
        resolution: "applied",
        result: { advanced: false, runCompleted: false },
        evidence: { source: "same-generation-supervise-settlement" },
      });
      await completions.markEffectsCommitted({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-test",
        ownerAttemptCount: processing.ownerAttemptCount,
        result: { advanced: false, runCompleted: false },
      });
      await completions.acceptAndRelease({
        requestId: requested.request.requestId,
        ownerInstanceId: "spawner-test",
        ownerAttemptCount: processing.ownerAttemptCount,
        result: { advanced: false, runCompleted: false },
      });
      await database.sql`
        UPDATE stories SET claim_generation = 2, status = 'done'
         WHERE id = ${fixture.storyDbId}
      `;
      await database.sql`
        UPDATE steps SET status = 'pending', current_story_id = ${fixture.storyDbId}
         WHERE id = ${superviseStepDbId}
      `;
      const second = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId: superviseStepDbId,
        workflowStepId: "supervise",
        claimAgentId: "feature-dev_supervisor",
        runtimeIntent: runtimeIntent("RTS_v3-supervise-generation-two"),
        storyAdmissionProof: fixture.storyAdmissionProof,
        storySubject: {
          kind: "story_member",
          storyDbId: fixture.storyDbId,
          storyId: "US-001",
        },
      });
      assert.equal(second?.storySubject?.kind, "story_member");
      assert.equal(second?.storySubject?.storyClaimGeneration, 2);
    } finally {
      await database.cleanup();
    }
  });

  it("fences reimplementation until atomic story retry ownership settles", async () => {
    const previousPgUrl = process.env.SETFARM_PG_URL;
    const database = await createIsolatedTestDatabase();
    let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
    let gitFixture: ReturnType<typeof createBoundStoryGitWorktree> | undefined;
    try {
      runtimeDb = await import("../../src/db-pg.js");
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      const { completeStep, reconcileRuntimeCompletionEffects } = await import("../../src/installer/step-ops.js");
      const runId = "run-v3-supervise-story-retry-fence";
      const fixture = await seedV3LoopWithStoryAdmission(database, runId);
      const storyRows = await database.sql<Array<{ id: string; story_id: string }>>`
        SELECT id, story_id FROM stories WHERE run_id = ${runId} ORDER BY story_index
      `;
      assert.equal(storyRows.length, 1);
      const firstStory = storyRows[0]!;
      gitFixture = createBoundStoryGitWorktree(firstStory.story_id);
      await database.sql`
        UPDATE stories SET status = 'done', claim_generation = 1, retry_count = 0,
                           story_branch = ${gitFixture.branch}
         WHERE id = ${firstStory.id}
      `;
      await database.sql`
        UPDATE steps SET status = 'pending', current_story_id = ${firstStory.id}
         WHERE id = ${runId + "-supervise-step"}
      `;
      const blockOutput = "STATUS: done\nSUPERVISOR_DECISION: block\nISSUES: Correct the bound story.";
      const first = await prepareV3SupervisorCompletion(database, {
        runId,
        storyDbId: firstStory.id,
        storyId: firstStory.story_id,
        storyAdmissionProof: fixture.storyAdmissionProof,
        subjectKind: "story_member",
        sessionId: "RTS_v3-supervise-story-retry-one",
        output: blockOutput,
      });
      await database.sql`
        UPDATE runtime_sessions SET worktree = ${gitFixture.repo}
         WHERE session_id = 'RTS_v3-supervise-story-retry-one'
      `;
      assert.deepEqual(await runWithRuntimeCompletionOwner({
        requestId: first.processing.requestId,
        ownerInstanceId: first.processing.ownerInstanceId,
        leaseExpiresAt: first.processing.leaseExpiresAt,
        ownerAttemptCount: first.processing.ownerAttemptCount,
      }, () => completeStep(
        first.superviseStepDbId,
        blockOutput,
        first.envelope,
        { deferContinuationToEffectLedger: true },
      )), { advanced: false, runCompleted: false });
      const owner = await first.completions.findById(first.requestId);
      assert.equal(owner?.applyPhase, "owner_committed");
      assert.equal(owner?.claimOutcome, "failed");
      assert.equal(owner?.completionPlan?.continuation.type, "failure_finalize");
      const firstOwnerState = await database.sql<Array<{
        story_status: string;
        story_retry: number;
        implement_status: string;
        supervise_status: string;
        supervise_retry: number;
        verify_status: string;
      }>>`
        SELECT story.status AS story_status, story.retry_count AS story_retry,
               implement.status AS implement_status,
               supervise.status AS supervise_status,
               supervise.retry_count AS supervise_retry,
               verify.status AS verify_status
          FROM stories story
          JOIN steps implement ON implement.id = ${fixture.stepDbId}
          JOIN steps supervise ON supervise.id = ${first.superviseStepDbId}
          JOIN steps verify ON verify.id = ${runId + "-verify-step"}
         WHERE story.id = ${firstStory.id}
      `;
      assert.deepEqual({ ...firstOwnerState[0] }, {
        story_status: "pending",
        story_retry: 1,
        implement_status: "pending",
        supervise_status: "waiting",
        supervise_retry: 0,
        verify_status: "waiting",
      });
      const retryOutput = (await database.sql<Array<{ output: string | null }>>`
        SELECT output FROM stories WHERE id = ${firstStory.id}
      `)[0]!.output;
      const retryDirective = parseV3SupervisorRetryDirectiveStoryOutputV1(retryOutput);
      assert.ok(retryDirective);
      assert.deepEqual(retryDirective!.sourceRevision, {
        sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: gitFixture.repo, encoding: "utf8" }).trim(),
        treeHash: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: gitFixture.repo, encoding: "utf8" }).trim(),
      });
      assert.equal(await publishLoopClaimRuntime(database.sql, {
        runId,
        stepDbId: fixture.stepDbId,
        workflowStepId: "implement",
        storyDbId: firstStory.id,
        storyId: firstStory.story_id,
        claimAgentId: "feature-dev_developer",
        parallelLimit: 1,
        runtimeIntent: runtimeIntent("RTS_v3-supervise-story-retry-fenced"),
        storyAdmissionProof: fixture.storyAdmissionProof,
      }), undefined);
      const reconciled = await reconcileRuntimeCompletionEffects({
        protocol: "v3",
        claimId: first.publication.claimId,
        runtimeSessionId: "RTS_v3-supervise-story-retry-one",
        runId,
        stepDbId: first.superviseStepDbId,
        workflowStepId: "supervise",
        output: blockOutput,
        storyDbId: firstStory.id,
        storyId: firstStory.story_id,
        completionPlan: owner!.completionPlan,
      });
      assert.deepEqual(reconciled?.result, { advanced: false, runCompleted: false });
      assert.equal(reconciled?.evidence.reason, "authenticated-supervisor-retry-already-published");
      assert.equal((await database.sql<Array<{ retry_count: number }>>`
        SELECT retry_count FROM stories WHERE id = ${firstStory.id}
      `)[0]!.retry_count, 1);
      await settleV3SupervisorFailureEffect(database, first);
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, {
          runId,
          stepDbId: fixture.stepDbId,
          workflowStepId: "implement",
          storyDbId: firstStory.id,
          storyId: firstStory.story_id,
          claimAgentId: "feature-dev_developer",
          parallelLimit: 1,
          runtimeIntent: runtimeIntent("RTS_v3-supervise-story-retry-reimplementation"),
          storyAdmissionProof: fixture.storyAdmissionProof,
        }),
        /V3_SUPERVISOR_RETRY_PREPARATION_AUTHORITY_REQUIRED/,
      );
    } finally {
      await runtimeDb?.pgClose().catch(() => {});
      await database.cleanup();
      if (gitFixture) fs.rmSync(gitFixture.root, { recursive: true, force: true });
      if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
      else process.env.SETFARM_PG_URL = previousPgUrl;
    }
  });

  for (const rejection of [
    { name: "skip", output: "STATUS: skip\nSUPERVISOR_DECISION: pass" },
    { name: "failed", output: "STATUS: failed\nSUPERVISOR_DECISION: pass" },
    { name: "unknown", output: "STATUS: done\nSUPERVISOR_DECISION: unknown" },
  ]) {
    it(`fails closed for authenticated story supervisor ${rejection.name} output`, async () => {
      const previousPgUrl = process.env.SETFARM_PG_URL;
      const database = await createIsolatedTestDatabase();
      let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
      try {
        runtimeDb = await import("../../src/db-pg.js");
        runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
        const { completeStep } = await import("../../src/installer/step-ops.js");
        const runId = `run-v3-supervise-story-${rejection.name}`;
        const fixture = await seedV3LoopWithStoryAdmission(database, runId);
        await database.sql`
          UPDATE stories SET status = 'done', claim_generation = 1, retry_count = 0
           WHERE id = ${fixture.storyDbId}
        `;
        await database.sql`
          UPDATE steps SET status = 'pending', current_story_id = ${fixture.storyDbId}
           WHERE id = ${runId + "-supervise-step"}
        `;
        const managed = await prepareV3SupervisorCompletion(database, {
          runId,
          storyDbId: fixture.storyDbId,
          storyId: "US-001",
          storyAdmissionProof: fixture.storyAdmissionProof,
          subjectKind: "story_member",
          sessionId: `RTS_v3-supervise-story-${rejection.name}`,
          output: rejection.output,
        });
        assert.deepEqual(await runWithRuntimeCompletionOwner({
          requestId: managed.processing.requestId,
          ownerInstanceId: managed.processing.ownerInstanceId,
          leaseExpiresAt: managed.processing.leaseExpiresAt,
          ownerAttemptCount: managed.processing.ownerAttemptCount,
        }, () => completeStep(
          managed.superviseStepDbId,
          rejection.output,
          managed.envelope,
          { deferContinuationToEffectLedger: true },
        )), { advanced: false, runCompleted: false });
        const owner = await managed.completions.findById(managed.requestId);
        assert.equal(owner?.applyPhase, "owner_committed");
        assert.equal(owner?.claimOutcome, "failed");
        assert.equal(owner?.completionPlan?.continuation.type, "failure_finalize");
        const state = await database.sql<Array<{
          story_status: string;
          story_retry: number;
          verify_status: string;
        }>>`
          SELECT story.status AS story_status, story.retry_count AS story_retry,
                 verify.status AS verify_status
            FROM stories story
            JOIN steps verify ON verify.id = ${runId + "-verify-step"}
           WHERE story.id = ${fixture.storyDbId}
        `;
        assert.deepEqual({ ...state[0] }, {
          story_status: "done",
          story_retry: 0,
          verify_status: "waiting",
        });
      } finally {
        await runtimeDb?.pgClose().catch(() => {});
        await database.cleanup();
        if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
        else process.env.SETFARM_PG_URL = previousPgUrl;
      }
    });
  }

  it("fails closed for authenticated final-product skip output", async () => {
    const previousPgUrl = process.env.SETFARM_PG_URL;
    const database = await createIsolatedTestDatabase();
    let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
    try {
      runtimeDb = await import("../../src/db-pg.js");
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      const { completeStep } = await import("../../src/installer/step-ops.js");
      const runId = "run-v3-supervise-final-skip";
      const fixture = await seedV3LoopWithStoryAdmission(database, runId);
      await database.sql`
        UPDATE stories SET status = 'done' WHERE run_id = ${runId}
      `;
      await database.sql`
        UPDATE steps SET status = 'done', current_story_id = NULL,
                         loop_config = ${JSON.stringify({ superviseEach: false, superviseStep: "supervise" })}
         WHERE id = ${fixture.stepDbId}
      `;
      await database.sql`
        UPDATE steps SET status = 'pending', current_story_id = NULL
         WHERE id = ${runId + "-supervise-step"}
      `;
      const output = "STATUS: skip\nSUPERVISOR_DECISION: pass";
      const managed = await prepareV3SupervisorCompletion(database, {
        runId,
        storyAdmissionProof: fixture.storyAdmissionProof,
        subjectKind: "final_product",
        sessionId: "RTS_v3-supervise-final-skip",
        output,
      });
      assert.deepEqual(await runWithRuntimeCompletionOwner({
        requestId: managed.processing.requestId,
        ownerInstanceId: managed.processing.ownerInstanceId,
        leaseExpiresAt: managed.processing.leaseExpiresAt,
        ownerAttemptCount: managed.processing.ownerAttemptCount,
      }, () => completeStep(
        managed.superviseStepDbId,
        output,
        managed.envelope,
        { deferContinuationToEffectLedger: true },
      )), { advanced: false, runCompleted: false });
      const owner = await managed.completions.findById(managed.requestId);
      assert.equal(owner?.claimOutcome, "failed");
      assert.equal(owner?.completionPlan?.continuation.type, "failure_finalize");
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM steps WHERE id = ${runId + "-verify-step"}
      `)[0]!.status, "waiting");
    } finally {
      await runtimeDb?.pgClose().catch(() => {});
      await database.cleanup();
      if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
      else process.env.SETFARM_PG_URL = previousPgUrl;
    }
  });

  it("completes authenticated final product without story identity through the durable owner effect", async () => {
    const previousPgUrl = process.env.SETFARM_PG_URL;
    const database = await createIsolatedTestDatabase();
    let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
    try {
      runtimeDb = await import("../../src/db-pg.js");
      runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
      const { completeStep } = await import("../../src/installer/step-ops.js");
      const runId = "run-v3-supervise-final-success";
      const fixture = await seedV3LoopWithStoryAdmission(database, runId);
      await database.sql`UPDATE stories SET status = 'done' WHERE run_id = ${runId}`;
      await database.sql`
        UPDATE steps SET status = 'done', current_story_id = NULL,
                         loop_config = ${JSON.stringify({ superviseEach: false, superviseStep: "supervise" })}
         WHERE id = ${fixture.stepDbId}
      `;
      await database.sql`
        UPDATE steps SET status = 'pending', current_story_id = NULL
         WHERE id = ${runId + "-supervise-step"}
      `;
      const output = "STATUS: done\nSUPERVISOR_DECISION: pass\nAC_COVERAGE: complete";
      const managed = await prepareV3SupervisorCompletion(database, {
        runId,
        storyAdmissionProof: fixture.storyAdmissionProof,
        subjectKind: "final_product",
        sessionId: "RTS_v3-supervise-final-success",
        output,
      });
      assert.deepEqual(await runWithRuntimeCompletionOwner({
        requestId: managed.processing.requestId,
        ownerInstanceId: managed.processing.ownerInstanceId,
        leaseExpiresAt: managed.processing.leaseExpiresAt,
        ownerAttemptCount: managed.processing.ownerAttemptCount,
      }, () => completeStep(
        managed.superviseStepDbId,
        output,
        managed.envelope,
        { deferContinuationToEffectLedger: true },
      )), { advanced: false, runCompleted: false });
      const owner = await managed.completions.findById(managed.requestId);
      assert.equal(owner?.applyPhase, "owner_committed");
      assert.equal(owner?.claimOutcome, "completed");
      assert.equal(owner?.storyDbId, undefined);
      assert.equal(owner?.storyId, undefined);
      assert.equal(owner?.completionPlan?.subject, undefined);
      assert.equal(owner?.completionPlan?.continuation.type, "single_pipeline_advance");
      assert.equal((await database.sql<Array<{ status: string }>>`
        SELECT status FROM steps WHERE id = ${managed.superviseStepDbId}
      `)[0]!.status, "done");
      const effects = createRuntimeCompletionEffectRepository(database.sql);
      const effect = await effects.claimNext({
        requestId: managed.requestId,
        ownerInstanceId: "spawner-test",
      });
      assert.ok(effect?.leaseToken);
      await effects.settle({
        requestId: managed.requestId,
        effectKey: effect!.effectKey,
        ownerInstanceId: "spawner-test",
        leaseToken: effect!.leaseToken!,
        resolution: "applied",
        result: { advanced: true, runCompleted: false },
        evidence: { source: "authenticated-final-product" },
      });
      await managed.completions.markEffectsCommitted({
        requestId: managed.requestId,
        ownerInstanceId: "spawner-test",
        ownerAttemptCount: managed.processing.ownerAttemptCount,
        result: { advanced: true, runCompleted: false },
      });
      await managed.completions.acceptAndRelease({
        requestId: managed.requestId,
        ownerInstanceId: "spawner-test",
        ownerAttemptCount: managed.processing.ownerAttemptCount,
        result: { advanced: true, runCompleted: false },
      });
      const settled = await managed.completions.findById(managed.requestId);
      assert.equal(settled?.state, "accepted");
      assert.equal(settled?.applyPhase, "effects_committed");
      assert.equal((await database.sql<Array<{ state: string }>>`
        SELECT state FROM runtime_sessions WHERE session_id = 'RTS_v3-supervise-final-success'
      `)[0]!.state, "released");
    } finally {
      await runtimeDb?.pgClose().catch(() => {});
      await database.cleanup();
      if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
      else process.env.SETFARM_PG_URL = previousPgUrl;
    }
  });

  it("fails closed for normal v3 publication while an active recovery delivery owns the story", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const blockedRunId = "run-v3-normal-blocked-by-recovery";
      const blockedFixture = await seedRecoveryLoop(database, blockedRunId);
      const blocked = await publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
        blockedRunId,
        blockedFixture,
        "RTS_v3-normal-blocked",
      ));
      assert.equal(blocked, undefined);
      const blockedState = await database.sql<Array<{
        story_status: string;
        step_status: string;
        claims: number;
        sessions: number;
        assigned_developer: string | null;
      }>>`
        SELECT story.status AS story_status,
               step.status AS step_status,
               (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${blockedRunId} AND step_id = 'implement') AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${blockedRunId} AND workflow_step_id = 'implement') AS sessions,
               run.assigned_developer
          FROM stories story
          JOIN steps step ON step.run_id = story.run_id
          JOIN runs run ON run.id = story.run_id
         WHERE story.id = ${blockedFixture.storyDbId}
           AND step.id = ${blockedFixture.stepDbId}
      `;
      assert.deepEqual({ ...blockedState[0] }, {
        story_status: "failed",
        step_status: "pending",
        claims: 0,
        sessions: 0,
        assigned_developer: null,
      });

      const normalRunId = "run-v3-normal-publication-mode";
      const normalLoop = await seedLoop(database, normalRunId, "v3");
      const normal = await publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
        normalRunId,
        normalLoop,
        "RTS_v3-normal-publication",
      ));
      assert.ok(normal);
      assert.deepEqual(normal!.claimAuthority, { mode: "normal" });
    } finally {
      await database.cleanup();
    }
  });

  it("serializes pending normal publication against recovery authorization with one authority winner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-authorization-normal-race";
      const fixture = await seedRecoveryCase(database, runId, "pending");
      const publicationInput = recoveryPublicationInput(
        runId,
        fixture,
        "RTS_v3-authorization-normal-race",
      );
      const [normalResult, authorizationResult] = await Promise.allSettled([
        publishLoopClaimRuntime(database.sql, publicationInput),
        fixture.deliveries.authorizeCurrentRevision({
          recoveryCaseId: fixture.recoveryCase.recoveryCaseId,
          revisionId: fixture.revision.revisionId,
          expectedStateVersion: fixture.recoveryCase.stateVersion,
          dispatchClass: "product_implementation",
        }, { now: new Date("2026-07-13T10:00:00.000Z") }),
      ]);

      assert.equal(normalResult.status, "fulfilled");
      if (normalResult.status !== "fulfilled") throw normalResult.reason;
      assert.ok(normalResult.value);
      assert.equal(normalResult.value.claimAuthority?.mode, "normal");
      assert.equal(authorizationResult.status, "rejected");
      if (authorizationResult.status !== "rejected") {
        throw new Error(`expected recovery authorization rejection, got ${authorizationResult.value.status}`);
      }
      assert.match(String(authorizationResult.reason), /RECOVERY_DISPATCH_STORY_NOT_FAILED:(pending|running)/);

      const state = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        claims: number;
        sessions: number;
        dispatches: number;
        deliveries: number;
        state_version: number;
        used_implement: number;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${runId} AND step_id = 'implement') AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${runId} AND workflow_step_id = 'implement') AS sessions,
               (SELECT COUNT(*)::integer FROM recovery_revision_dispatches WHERE recovery_case_id = recovery.recovery_case_id) AS dispatches,
               (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries WHERE recovery_case_id = recovery.recovery_case_id) AS deliveries,
               recovery.state_version,
               recovery.used_implement
          FROM stories story
          JOIN recovery_cases recovery
            ON recovery.run_id = story.run_id AND recovery.story_id = story.story_id
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "running",
        claim_generation: 1,
        claims: 1,
        sessions: 1,
        dispatches: 0,
        deliveries: 0,
        state_version: fixture.recoveryCase.stateVersion,
        used_implement: 0,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("publishes an exact lease-reissued recovery handoff without taking the normal gateway assignment", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-exact-recovery-publication";
      const fixture = await seedRecoveryLoop(database, runId);
      const leased = await acquireRecoveryHandoff(database, {
        runId,
        ownerInstanceId: "exact-recovery-owner",
      });
      const handoff = await createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
        runId,
        storyId: "US-001",
        ownerInstanceId: leased.lease.ownerInstanceId,
        continuation: {
          kind: "unreserved_lease",
          leaseToken: leased.lease.leaseToken,
        },
      }, { now: new Date("2026-07-13T10:00:00.500Z") });
      assert.equal(handoff.status, "lease_reissued");

      const publication = await publishLoopClaimRuntime(database.sql, {
        ...recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-exact-recovery",
          handoff,
        ),
        now: new Date("2200-01-01T00:00:00.000Z"),
      });
      assert.ok(publication);
      assert.deepEqual(publication!.claimAuthority, { mode: "recovery", handoff });
      const state = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        claimed_by: string | null;
        step_status: string;
        current_story_id: string | null;
        assigned_developer: string | null;
        claim_agent_id: string;
        session_state: string;
        runtime_agent_id: string;
        delivery_state: string;
        attempt_id: string | null;
        delivery_claim_id: string | number | null;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               story.claimed_by,
               step.status AS step_status,
               step.current_story_id,
               run.assigned_developer,
               claim.agent_id AS claim_agent_id,
               runtime.state AS session_state,
               runtime.runtime_agent_id,
               delivery.state AS delivery_state,
               delivery.attempt_id,
               delivery.claim_id AS delivery_claim_id
          FROM stories story
          JOIN steps step ON step.id = ${fixture.stepDbId}
          JOIN runs run ON run.id = story.run_id
          JOIN claim_log claim ON claim.run_id = story.run_id AND claim.story_id = story.story_id
          JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
          JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = ${handoff.dispatchId}
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "running",
        claim_generation: 1,
        claimed_by: "recovery-implement-agent",
        step_status: "running",
        current_story_id: fixture.storyDbId,
        assigned_developer: null,
        claim_agent_id: "recovery-implement-agent",
        session_state: "reserved",
        runtime_agent_id: "recovery-runtime-agent",
        delivery_state: "leased",
        attempt_id: null,
        delivery_claim_id: null,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("serializes concurrent normal and recovery publication so only the recovery owner can publish", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-normal-recovery-publication-race";
      const fixture = await seedRecoveryLoop(database, runId);
      const handoff = await acquireRecoveryHandoff(database, { runId });
      const [normal, recovery] = await Promise.all([
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-race-normal-session",
        )),
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-race-recovery",
          handoff,
        )),
      ]);
      assert.equal([normal, recovery].filter(Boolean).length, 1);
      assert.equal(normal, undefined);
      assert.equal(recovery?.claimAuthority?.mode, "recovery");
      const counts = await database.sql<Array<{
        claims: number;
        sessions: number;
        story_status: string;
        claim_generation: number;
      }>>`
        SELECT (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${runId} AND step_id = 'implement') AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${runId} AND workflow_step_id = 'implement') AS sessions,
               status AS story_status,
               claim_generation
          FROM stories
         WHERE id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...counts[0] }, {
        claims: 1,
        sessions: 1,
        story_status: "running",
        claim_generation: 1,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects forged, stale, and attempt-bound recovery handoffs without publishing ownership", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-invalid-recovery-publication";
      const fixture = await seedRecoveryLoop(database, runId);
      const handoff = await acquireRecoveryHandoff(database, { runId });
      const forgedLease = V3RecoveryClaimHandoffV1Schema.parse({
        ...handoff,
        lease: { ...handoff.lease, leaseToken: "f".repeat(64) },
      });
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-forged-lease-session",
          forgedLease,
        )),
        (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
          && error.code === "V3_RECOVERY_PUBLICATION_LEASE_INVALID",
      );

      const forgedDirective = V3RecoveryClaimHandoffV1Schema.parse({
        ...handoff,
        directive: { ...handoff.directive, contractSliceHash: "f".repeat(64) },
      });
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-forged-directive",
          forgedDirective,
        )),
        (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
          && error.code === "V3_RECOVERY_PUBLICATION_DIRECTIVE_MISMATCH",
      );

      const clocks = await database.sql<Array<{ wall_clock: Date }>>`
        SELECT clock_timestamp() AS wall_clock
      `;
      await database.sql`
        UPDATE recovery_dispatch_deliveries
           SET lease_expires_at = ${new Date(clocks[0]!.wall_clock.getTime() - 1_000)}
         WHERE dispatch_id = ${handoff.dispatchId}
      `;
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, {
          ...recoveryPublicationInput(runId, fixture, "RTS_v3-stale-lease-session", handoff),
          now: new Date("1900-01-01T00:00:00.000Z"),
        }),
        (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
          && error.code === "V3_RECOVERY_PUBLICATION_LEASE_INVALID",
      );

      const attemptBound = V3RecoveryClaimHandoffV1Schema.parse({
        ...handoff,
        status: "attempt_bound_reissue",
        attemptBinding: {
          attemptId: `ATT_${"x".repeat(16)}`,
          claimId: 123,
          executionSliceHash: "9".repeat(64),
        },
        reservationBoundary: {
          leaseAndAttemptAtomicInThisModule: false,
          state: "attempt_already_reserved_requires_exact_resume",
          reconcileRequired: true,
          requiredNextOperation: "resume_exact_attempt_only",
        },
      });
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-attempt-bound",
          attemptBound,
        )),
        (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
          && error.code === "V3_RECOVERY_PUBLICATION_ATTEMPT_BOUND_REISSUE",
      );

      const state = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        step_status: string;
        claims: number;
        sessions: number;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               step.status AS step_status,
               (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${runId} AND step_id = 'implement') AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${runId} AND workflow_step_id = 'implement') AS sessions
          FROM stories story
          JOIN steps step ON step.id = ${fixture.stepDbId}
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "failed",
        claim_generation: 0,
        step_status: "pending",
        claims: 0,
        sessions: 0,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back recovery story, step, and claim publication when runtime reservation fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const duplicateSessionId = "RTS_v3-recovery-rollback";
      const ownerRunId = "run-v3-recovery-runtime-owner";
      const ownerStep = await seedSingle(database, ownerRunId);
      await publishSingleClaimRuntime(database.sql, {
        runId: ownerRunId,
        stepDbId: ownerStep,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent(duplicateSessionId),
      });

      const runId = "run-v3-recovery-publication-rollback";
      const fixture = await seedRecoveryLoop(database, runId);
      const handoff = await acquireRecoveryHandoff(database, { runId });
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          duplicateSessionId,
          handoff,
        )),
        /duplicate key value|unique constraint/i,
      );
      const state = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        claimed_by: string | null;
        step_status: string;
        current_story_id: string | null;
        claims: number;
        sessions: number;
        delivery_state: string;
        attempt_id: string | null;
        delivery_claim_id: string | number | null;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               story.claimed_by,
               step.status AS step_status,
               step.current_story_id,
               (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${runId} AND step_id = 'implement') AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${runId} AND workflow_step_id = 'implement') AS sessions,
               delivery.state AS delivery_state,
               delivery.attempt_id,
               delivery.claim_id AS delivery_claim_id
          FROM stories story
          JOIN steps step ON step.id = ${fixture.stepDbId}
          JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = ${handoff.dispatchId}
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "failed",
        claim_generation: 0,
        claimed_by: null,
        step_status: "pending",
        current_story_id: null,
        claims: 0,
        sessions: 0,
        delivery_state: "leased",
        attempt_id: null,
        delivery_claim_id: null,
      });
    } finally {
      await database.cleanup();
    }
  });
});
