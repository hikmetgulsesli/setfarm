import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import type { PgTransactionSql } from "../../../src/db-pg.js";
import { completeSingleStepClaimAndState } from "../../../src/execution/claim-attempt-transition.js";
import { publishSingleClaimRuntime } from "../../../src/execution/claim-runtime-publication.js";
import { loadCompilerEnglishAdmissionLedgerAuthorityV1 } from "../../../src/execution/compiler-english-admission-ledger-v1.js";
import { publishCompilerStoryEnglishAdmissionAndCompleteV1 } from "../../../src/execution/compiler-story-english-admission-publication-v1.js";
import { createRuntimeCompletionEffectRepository } from "../../../src/execution/runtime-completion-effect-repository.js";
import { runRuntimeCompletionEffectLedger } from "../../../src/execution/runtime-completion-effect-runner.js";
import { runWithRuntimeCompletionOwner } from "../../../src/execution/runtime-completion-owner-context.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../../src/execution/runtime-completion.js";
import {
  createRuntimeSessionRepository,
  type RuntimeClaimIntentV1,
} from "../../../src/execution/runtime-session-repository.js";
import type { ClaimEnvelopeV1 } from "../../../src/execution/schemas/claim-envelope-v1.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../../src/execution/schemas/runtime-completion-plan-v1.js";
import { persistWorkflowRunInTransaction } from "../../../src/execution/run-persistence.js";
import {
  reconcileRuntimeCompletionEffects,
  resumeRuntimeCompletionEffects,
} from "../../../src/installer/step-ops.js";
import { buildV3AutoStoriesOutput } from "../../../src/installer/steps/03-stories/preclaim.js";
import { designAuthoritySubjectHashV1 } from "../../../src/installer/steps/03-stories/guards.js";
import {
  compileCompilerEnglishAdmissionV1,
  compilerEnglishAdmissionReceiptV1,
} from "../../../src/product-compiler/compiler-english-admission-v1.js";
import {
  compileCompilerStoryEnglishAdmissionV1,
  compilerStoryEnglishAdmissionStateV1,
} from "../../../src/product-compiler/compiler-story-english-admission-v1.js";
import { hashCanonicalJson } from "../../../src/product-compiler/canonical-json.js";
import { renderProductSpecV2Compatibility } from "../../../src/product-compiler/renderers/product-spec-v2-compatibility.js";
import {
  NODE_CLI_TASK,
  genuineNodeCliProductSpecV2,
} from "../../product-compiler/fixtures/no-design-product-semantics-v2.js";
import type { TestDatabase } from "../test-database.js";

const COMPILER_ADMISSION_DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-15T11:59:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/setup-build-compiler-admission"],
};

async function publishSingleRuntimeClaimFixtureV1(
  database: TestDatabase,
  input: Readonly<{
    runId: string;
    stepDbId: string;
    workflowStepId: string;
    claimAgentId: string;
    runtimeAgentId: string;
    ownerInstanceId: string;
  }>,
): Promise<Readonly<{
  claimId: number;
  protocol: "v3";
  runtime: Readonly<{ sessionId: string; ownerInstanceId: string }>;
  runtimeIntent: RuntimeClaimIntentV1;
}>> {
  const token = createHash("sha256")
    .update(`${input.runId}:${input.workflowStepId}`, "utf8")
    .digest("hex")
    .slice(0, 24);
  const sessionId = `RTS_${token}`;
  const runtimeIntent = Object.freeze({
    schema: "setfarm.runtime-claim-intent.v1" as const,
    sessionId,
    runtimeAgentId: input.runtimeAgentId,
    runtimeKind: "openclaw_session" as const,
    ownerInstanceId: input.ownerInstanceId,
    sessionKey: `${input.workflowStepId}-fixture-session`,
  });
  const publication = await publishSingleClaimRuntime(database.sql, {
    runId: input.runId,
    stepDbId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    claimAgentId: input.claimAgentId,
    runtimeIntent,
    now: new Date("2026-07-15T11:58:00.000Z"),
  });
  assert.ok(publication?.runtime);
  assert.equal(publication.protocol, "v3");
  assert.deepEqual(publication.runtime, { sessionId, ownerInstanceId: input.ownerInstanceId });
  return Object.freeze({
    claimId: publication.claimId,
    protocol: "v3",
    runtime: publication.runtime,
    runtimeIntent,
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
  const publication = await publishSingleRuntimeClaimFixtureV1(database, {
    runId: input.runId,
    stepDbId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    claimAgentId,
    runtimeAgentId,
    ownerInstanceId,
  });
  const claimId = publication.claimId;
  const sessions = createRuntimeSessionRepository(database.sql);
  await sessions.markStarting({ sessionId: publication.runtime.sessionId, ownerInstanceId });
  await sessions.markRunning({
    sessionId: publication.runtime.sessionId,
    ownerInstanceId,
    sessionKey: `${input.workflowStepId}-fixture-session`,
  });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    protocol: publication.protocol,
    issuedAt: "2026-07-15T11:58:00.000Z",
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
    sessionId: publication.runtime.sessionId,
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
    output: input.output,
    runtimeSessionId: publication.runtime.sessionId,
  };
}

async function settleCompilerAdmissionCompletion(
  database: TestDatabase,
  managed: Awaited<ReturnType<typeof prepareCompilerAdmissionCompletion>>,
): Promise<void> {
  const effects = createRuntimeCompletionEffectRepository(database.sql);
  const result = await runRuntimeCompletionEffectLedger({
    requestId: managed.requestId,
    ownerInstanceId: managed.ownerInstanceId,
    repository: effects,
    heartbeatIntervalMs: 100,
    handler: {
      reconcile: async ({ input: effectInput }) => {
        const reconciled = await reconcileRuntimeCompletionEffects({
          protocol: managed.envelope.protocol,
          claimId: managed.claimId,
          runtimeSessionId: managed.runtimeSessionId,
          runId: managed.envelope.runId,
          stepDbId: managed.envelope.stepId,
          workflowStepId: managed.envelope.workflowStepId,
          output: managed.output,
          completionPlan: effectInput.plan,
        });
        if (!reconciled) return undefined;
        return {
          resolution: "reconciled" as const,
          result: reconciled.result,
          evidence: reconciled.evidence,
        };
      },
      apply: async ({ input: effectInput, effect, assertLease }) => {
        await assertLease();
        const applied = await resumeRuntimeCompletionEffects({
          protocol: managed.envelope.protocol,
          claimId: managed.claimId,
          runtimeSessionId: managed.runtimeSessionId,
          runId: managed.envelope.runId,
          stepDbId: managed.envelope.stepId,
          workflowStepId: managed.envelope.workflowStepId,
          output: managed.output,
          completionPlan: effectInput.plan,
        });
        await assertLease();
        return {
          resolution: "applied" as const,
          result: applied,
          evidence: {
            schema: "setfarm.test.compiler-admission-continuation-evidence.v1",
            requestId: managed.requestId,
            effectKey: effect.effectKey,
          },
        };
      },
    },
  });
  assert.equal(result.advanced, true);
  assert.equal(result.runCompleted, false);
  const settled = await effects.listForRequest(managed.requestId);
  assert.equal(settled.length, 1);
  assert.equal(settled[0]!.state, "applied");
  assert.deepEqual(settled[0]!.result, { advanced: true, runCompleted: false });
  await managed.completions.markEffectsCommitted({
    requestId: managed.requestId,
    ownerInstanceId: managed.ownerInstanceId,
    ownerAttemptCount: managed.processing.ownerAttemptCount,
    result,
  });
  await managed.completions.acceptAndRelease({
    requestId: managed.requestId,
    ownerInstanceId: managed.ownerInstanceId,
    ownerAttemptCount: managed.processing.ownerAttemptCount,
    result,
  });
}

async function requirePendingStepV1(database: TestDatabase, stepDbId: string): Promise<void> {
  const rows = await database.sql<Array<{ status: string }>>`
    SELECT status FROM steps WHERE id = ${stepDbId}
  `;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.status, "pending");
}

async function readRunContextV1(database: TestDatabase, runId: string): Promise<Record<string, string>> {
  const rows = await database.sql<Array<{ context: string }>>`
    SELECT context FROM runs WHERE id = ${runId}
  `;
  assert.equal(rows.length, 1);
  const parsed = JSON.parse(rows[0]!.context) as unknown;
  assert.ok(parsed && typeof parsed === "object" && !Array.isArray(parsed));
  return parsed as Record<string, string>;
}

export async function seedCanonicalSetupBuildCompilerStoryAdmissionFixture(
  database: TestDatabase,
  input: Readonly<{
    runId: string;
    repo: string;
    setupBuildStepDbId: string;
    setupBuildClaimAgentId: string;
    releaseSha: string;
    additionalContext?: Readonly<Record<string, string>>;
}>,
): Promise<Readonly<{
  claimId: number;
  runtimeIntent: RuntimeClaimIntentV1;
  context: Readonly<Record<string, string>>;
  task: string;
}>> {
  const runtimeDb = await import("../../../src/db-pg.js");
  await runtimeDb.initializeInternalProductionCurrentEntryDatabaseV1();
  const productSpec = genuineNodeCliProductSpecV2();
  const productSpecHash = hashCanonicalJson(productSpec);
  const renderedPlan = renderProductSpecV2Compatibility(productSpec);
  const prdMarker = "\nPRD:\n";
  const prdIndex = renderedPlan.indexOf(prdMarker);
  assert.ok(prdIndex > 0);
  const prd = renderedPlan.slice(prdIndex + prdMarker.length);
  const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(input.releaseSha);
  const baseContext: Record<string, string> = {
    task: NODE_CLI_TASK,
    repo: input.repo,
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
    ...input.additionalContext,
  };
  const planStepDbId = `${input.runId}-plan-step`;
  const designStepDbId = `${input.runId}-design-step`;
  const storiesStepDbId = `${input.runId}-stories-step`;
  const runNumber = Number.parseInt(
    createHash("sha256").update(input.runId, "utf8").digest("hex").slice(0, 7),
    16,
  ) + 1;
  await database.sql.begin((transaction) => persistWorkflowRunInTransaction(
    transaction as PgTransactionSql,
    {
      run: {
        id: input.runId,
        runNumber,
        workflowId: "feature-dev",
        task: NODE_CLI_TASK,
        context: JSON.stringify(baseContext),
        notifyUrl: null,
        createdAt: "2026-07-15T11:57:00.000Z",
        protocol: {
          mode: "v3",
          version: 1,
          compilerReleaseSha: input.releaseSha,
          activationPreflightHash: hashCanonicalJson({
            fixture: "v3-release-preflight",
            releaseSha: input.releaseSha,
          }),
          releaseAdmissionHash,
          releaseAdmissionKind: "release_go",
          canaryAdmission: null,
        },
      },
      steps: [
        { id: planStepDbId, stepId: "plan", agentId: "feature-dev_planner", stepIndex: 1, inputTemplate: "", expects: "", status: "pending", maxRetries: 3, type: "single", loopConfig: null },
        { id: designStepDbId, stepId: "design", agentId: "feature-dev_designer", stepIndex: 2, inputTemplate: "", expects: "", status: "waiting", maxRetries: 3, type: "single", loopConfig: null },
        { id: storiesStepDbId, stepId: "stories", agentId: "feature-dev_story-planner", stepIndex: 3, inputTemplate: "", expects: "", status: "waiting", maxRetries: 3, type: "single", loopConfig: null },
        { id: input.setupBuildStepDbId, stepId: "setup-build", agentId: input.setupBuildClaimAgentId, stepIndex: 4, inputTemplate: "", expects: "", status: "waiting", maxRetries: 3, type: "single", loopConfig: null },
      ],
    },
  ));

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
  await requirePendingStepV1(database, designStepDbId);
  const advancedPlanContext = await readRunContextV1(database, input.runId);
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
    ...advancedPlanContext,
    screen_map: "[]",
    screens_generated: "0",
    design_system: "{}",
  };
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
    expectedRunContextJson: JSON.stringify(advancedPlanContext),
    requireRuntimeCompletionOwner: true,
    completionPlan: createSingleEffectCompletionPlanDescriptorV1({
      kind: "single_completion",
      continuation: { type: "single_pipeline_advance" },
      effectPayload: { stepId: "design" },
    }),
  }));
  await settleCompilerAdmissionCompletion(database, managedDesign);
  await requirePendingStepV1(database, storiesStepDbId);
  const advancedDesignContext = await readRunContextV1(database, input.runId);

  const storiesOutput = buildV3AutoStoriesOutput({
    repo: input.repo,
    prd,
    expectedProductSpecHash: productSpecHash,
    productSemanticsVersion: "v2",
  });
  const screenMapLine = storiesOutput.split("\n").find((line) =>
    line.startsWith("SCREEN_MAP: "));
  assert.ok(screenMapLine);
  const storiesContext = {
    ...advancedDesignContext,
    screen_map: screenMapLine.slice("SCREEN_MAP: ".length),
  };
  await database.sql`
    UPDATE runs SET context = ${JSON.stringify(storiesContext)} WHERE id = ${input.runId}
  `;
  const managedStories = await prepareCompilerAdmissionCompletion(database, {
    runId: input.runId,
    stepDbId: storiesStepDbId,
    workflowStepId: "stories",
    output: storiesOutput,
  });
  const designAuthorityHash = await designAuthoritySubjectHashV1(
    database.sql,
    input.runId,
    storiesContext,
    productSpecHash,
    false,
  );
  const storiesAuthority = compileCompilerStoryEnglishAdmissionV1({
    claimId: managedStories.claimId,
    runId: input.runId,
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
  await requirePendingStepV1(database, input.setupBuildStepDbId);
  const advancedStoriesContext = await readRunContextV1(database, input.runId);
  const setupPublication = await publishSingleRuntimeClaimFixtureV1(database, {
    runId: input.runId,
    stepDbId: input.setupBuildStepDbId,
    workflowStepId: "setup-build",
    claimAgentId: input.setupBuildClaimAgentId,
    runtimeAgentId: input.setupBuildClaimAgentId,
    ownerInstanceId: "setup-build-fixture-owner",
  });
  return Object.freeze({
    claimId: setupPublication.claimId,
    runtimeIntent: setupPublication.runtimeIntent,
    context: Object.freeze(advancedStoriesContext),
    task: NODE_CLI_TASK,
  });
}
