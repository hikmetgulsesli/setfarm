import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
import {
  createCompilerStoryEnglishAdmissionClaimProofV1,
  loadCompilerStoryEnglishAdmissionLedgerAuthorityV1,
  lockAndAuthenticateCompilerStoryEnglishAdmissionClaimSubjectV1,
} from "../../../src/execution/compiler-story-english-admission-ledger-v1.js";
import { hasPendingV3SinglePredecessorCompletionInTransactionV1 } from "../../../src/execution/v3-predecessor-completion-claim-barrier-v1.js";
import {
  createPostgresV3PendingStoryReader,
  createV3NormalImplementationPreclaim,
} from "../../../src/execution/v3-normal-implementation-preclaim.js";
import { createPostgresTerminalDependencyAttemptReader } from "../../../src/execution/v3-preparation-eligibility.js";
import { createV3PreparationBlockRepository } from "../../../src/execution/v3-preparation-block-repository.js";
import { bootstrapArtifactIndex } from "../../../src/product-compiler/indexed-artifact-publisher.js";
import { createArtifactIndex } from "../../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../../src/product-compiler/artifact-store.js";
import { createRuntimeArtifactReader } from "../../../src/product-compiler/runtime-artifact-reader.js";
import { createRuntimePacketCompiler } from "../../../src/product-compiler/runtime-packet-compiler.js";
import { produceRuntimeDataContractV1 } from "../../../src/product-compiler/producers/runtime-data-contract.js";
import { produceStoryPlanV2 } from "../../../src/product-compiler/producers/story-plan-v2.js";
import { BuildTopologyV1Schema } from "../../../src/product-compiler/schemas/build-topology-v1.js";
import {
  RuntimeEvidenceContractV1Schema,
  hashRuntimeEvidenceContractV1,
} from "../../../src/evidence/runtime-evidence-contract-v1.js";
import { resolveProductArtifactCapacity, resolveProductArtifactDir } from "../../../src/runtime-config.js";
import { buildNoDesignProductBuildPacketV3Contracts } from "../../product-compiler/fixtures/product-build-packet-v3.js";

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
    workflowStepId: "plan" | "design" | "stories" | "setup-build";
    output: string;
    existingClaim?: Readonly<{ claimId: number; runtimeIntent: RuntimeClaimIntentV1 }>;
  }>,
) {
  const token = createHash("sha256")
    .update(`${input.runId}:${input.workflowStepId}`, "utf8")
    .digest("hex")
    .slice(0, 24);
  const claimAgentId = input.existingClaim?.runtimeIntent.runtimeAgentId ?? `feature-dev_${input.workflowStepId}`;
  const runtimeAgentId = input.existingClaim?.runtimeIntent.runtimeAgentId ?? `${input.workflowStepId}-fixture-runtime`;
  const ownerInstanceId = input.existingClaim?.runtimeIntent.ownerInstanceId ?? `${input.workflowStepId}-fixture-owner`;
  const publication = input.existingClaim ?? await publishSingleRuntimeClaimFixtureV1(database, {
    runId: input.runId,
    stepDbId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    claimAgentId,
    runtimeAgentId,
    ownerInstanceId,
  });
  const claimId = publication.claimId;
  const sessionId = publication.runtimeIntent.sessionId;
  const sessions = createRuntimeSessionRepository(database.sql);
  await sessions.markStarting({ sessionId, ownerInstanceId });
  await sessions.markRunning({
    sessionId,
    ownerInstanceId,
    sessionKey: `${input.workflowStepId}-fixture-session`,
  });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    // Both freshly published and reused fixture claims belong to this v3-only helper.
    // The canonical setup fixture intentionally does not export a protocol key.
    protocol: "v3",
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
    sessionId,
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
    runtimeSessionId: sessionId,
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
    implementationStepDbId?: string;
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
        ...(input.implementationStepDbId ? [{
          id: input.implementationStepDbId, stepId: "implement", agentId: "feature-dev_developer",
          stepIndex: 5, inputTemplate: "", expects: "", status: "waiting" as const,
          maxRetries: 3, type: "loop" as const, loopConfig: JSON.stringify({ over: "stories" }),
        }] : []),
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

/** Real native authority in a disposable repository; never substitutes the public reader. */
export async function seedNativePacketV3ImplementationClaimFixture(
  database: TestDatabase,
  input: Readonly<{ runId: string; repo: string; releaseSha: string }>,
): Promise<Readonly<{
  runId: string;
  stepDbId: string;
  storyDbId: string;
  agentId: string;
  runtimeIntent: RuntimeClaimIntentV1;
  packetHash: string;
  compilationReportHash: string;
  storyId: string;
}>> {
  // The caller owns this empty directory and its parent, including logs and CAS.
  assert.deepEqual(fs.readdirSync(input.repo), []);
  const artifactRoot = resolveProductArtifactDir();
  const fixtureRoot = path.dirname(input.repo);
  assert.equal(path.dirname(path.dirname(artifactRoot)), fixtureRoot);
  assert.equal(path.dirname(process.env.SETFARM_DB_PATH ?? ""), fixtureRoot);
  const cliSource = [
    'const title = process.argv[process.argv.indexOf("--title") + 1];',
    'if (process.argv[2] !== "add" || !title) process.exit(1);',
    'console.log(JSON.stringify({ title, states: { STATE_TASKS: [{ title }] } }));',
    "",
  ].join("\n");
  fs.mkdirSync(path.join(input.repo, "src"));
  fs.writeFileSync(path.join(input.repo, "src/index.ts"), cliSource);
  fs.writeFileSync(path.join(input.repo, "package.json"), JSON.stringify({
    name: "native-v3-public-claim-fixture", version: "1.0.0", type: "module",
    scripts: { build: "node --check src/index.ts" },
  }));
  const git = (...args: string[]) => execFileSync("git", args, {
    cwd: input.repo, encoding: "utf8", timeout: 5_000, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  git("init", "--initial-branch=main");

  const stepDbId = `${input.runId}-implement-step`;
  const setupBuildStepDbId = `${input.runId}-setup-build-step`;
  const admission = await seedCanonicalSetupBuildCompilerStoryAdmissionFixture(database, {
    ...input,
    setupBuildStepDbId,
    setupBuildClaimAgentId: "feature-dev_builder",
    implementationStepDbId: stepDbId,
    additionalContext: {
      stack_pack_id: "node-cli", tech_stack: "node-cli", branch: "main",
    },
  });
  const setupOutput = "STATUS: done\nBUILD: passed";
  const setupCompletion = await prepareCompilerAdmissionCompletion(database, {
    runId: input.runId,
    stepDbId: setupBuildStepDbId,
    workflowStepId: "setup-build",
    output: setupOutput,
    existingClaim: admission,
  });
  await runWithRuntimeCompletionOwner({
    requestId: setupCompletion.processing.requestId,
    ownerInstanceId: setupCompletion.processing.ownerInstanceId!,
    leaseExpiresAt: setupCompletion.processing.leaseExpiresAt!,
    ownerAttemptCount: setupCompletion.processing.ownerAttemptCount,
  }, () => completeSingleStepClaimAndState(database.sql, {
    envelope: setupCompletion.envelope,
    stepStatus: "done", stepOutput: setupOutput,
    requireRuntimeCompletionOwner: true,
    completionPlan: createSingleEffectCompletionPlanDescriptorV1({
      kind: "single_completion", continuation: { type: "single_pipeline_advance" },
      effectPayload: { stepId: "setup-build" },
    }),
  }));
  await settleCompilerAdmissionCompletion(database, setupCompletion);
  await requirePendingStepV1(database, stepDbId);
  const predecessors = await database.sql<Array<{
    step_id: string; status: string; outcome: string; state: string; apply_phase: string;
    runtime_state: string; effect_count: number; committed_effect_count: number;
  }>>`
    SELECT step.step_id, step.status, claim.outcome, request.state, request.apply_phase,
           runtime.state AS runtime_state,
           (SELECT COUNT(*)::integer FROM runtime_completion_effects effect
             WHERE effect.request_id=request.request_id) AS effect_count,
           (SELECT COUNT(*)::integer FROM runtime_completion_effects effect
             WHERE effect.request_id=request.request_id AND effect.state IN ('applied','reconciled')) AS committed_effect_count
      FROM steps step
      JOIN claim_log claim ON claim.run_id=step.run_id AND claim.step_id=step.step_id
      JOIN runtime_completion_requests request ON request.claim_id=claim.id
      JOIN runtime_sessions runtime ON runtime.claim_id=claim.id
     WHERE step.run_id=${input.runId} AND step.step_index<5 ORDER BY step.step_index
  `;
  assert.deepEqual(predecessors.map((row) => ({ ...row })),
    ["plan", "design", "stories", "setup-build"].map((step_id) => ({
      step_id, status: "done", outcome: "completed", state: "accepted",
      apply_phase: "effects_committed", runtime_state: "released",
      effect_count: 1, committed_effect_count: 1,
    })));
  await database.sql.begin(async (transaction) => {
    await transaction`SELECT id FROM runs WHERE id=${input.runId} FOR UPDATE`;
    assert.equal(await hasPendingV3SinglePredecessorCompletionInTransactionV1(transaction, {
      runId: input.runId, stepDbId, workflowStepId: "implement",
    }), false);
  });

  // Completion effects can refresh repository contracts. Pin their final bytes,
  // together with the CLI source, only after every predecessor is accepted.
  git("add", "--all");
  git("-c", "user.name=Setfarm Test", "-c", "user.email=setfarm-test@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "-m", "Native claim fixture");
  const baseSha = git("rev-parse", "HEAD");
  const treeHash = git("rev-parse", "HEAD^{tree}");
  assert.match(baseSha, /^[a-f0-9]{40}$/);
  assert.match(treeHash, /^[a-f0-9]{40}$/);
  assert.equal(git("status", "--porcelain"), "");

  const contracts = buildNoDesignProductBuildPacketV3Contracts();
  const runtimeData = produceRuntimeDataContractV1({
    productSpec: contracts.productSpecV2, commands: contracts.buildTopologyV1.commands,
  });
  assert.equal(runtimeData.status, "produced", JSON.stringify(runtimeData));
  if (runtimeData.status !== "produced") throw new Error("native fixture runtime-data rejected");
  const runtimeEvidence = RuntimeEvidenceContractV1Schema.parse({
    schema: "setfarm.runtime-evidence-contract.v1", adapter: "cli-process", stackPackId: "node-cli",
    actions: [{
      actionRef: "ACT_ADD_TASK", inputValues: { title: "Ship Setfarm" },
      action: {
        command: { argv: ["node", "src/index.ts", "add", "--title", "Ship Setfarm"], cwd: ".", timeoutMs: 5_000 },
        expectedExitCode: 0, capture: { format: "json", statePointer: "/states" },
      },
    }],
  });
  const buildTopologyV1 = BuildTopologyV1Schema.parse({
    ...contracts.buildTopologyV1,
    repo: { id: "native-v3-public-claim-fixture", baseSha, treeHash },
    pathBindings: contracts.buildTopologyV1.pathBindings.map((binding) => ({
      ...binding, knownContentHash: createHash("sha256").update(fs.readFileSync(path.join(input.repo, binding.path))).digest("hex"),
    })),
    runtimeDataContract: runtimeData.contract, runtimeDataContractHash: runtimeData.contractHash,
    runtimeEvidenceContract: runtimeEvidence,
    runtimeEvidenceContractHash: hashRuntimeEvidenceContractV1(runtimeEvidence),
  });
  const stories = produceStoryPlanV2({ productSpec: contracts.productSpecV2, buildTopology: buildTopologyV1 });
  assert.equal(stories.status, "produced", JSON.stringify(stories));
  if (stories.status !== "produced") throw new Error("native fixture StoryPlanV2 rejected");
  const limits = resolveProductArtifactCapacity();
  await bootstrapArtifactIndex({
    index: createArtifactIndex(database.sql),
    store: new ContentAddressedArtifactStore(artifactRoot, { limits }),
    quotaBytes: limits.rootQuotaBytes, maxPayloadBytes: limits.maxPayloadBytes,
  });
  const compiled = await createRuntimePacketCompiler({
    sql: database.sql, artifactRoot, artifactLimits: limits, ownerInstanceId: "native-v3-public-claim-test",
  }).compile({
    ...contracts, runId: input.runId, expectedMode: "v3",
    buildTopologyV1, storyPlanV2: stories.storyPlan,
    implementationSourceInputsV1: {
      ...contracts.implementationSourceInputsV1, buildTopology: buildTopologyV1, storyPlan: stories.storyPlan,
    },
    compiler: { version: "4.0.0", codeSha: input.releaseSha },
    producer: { pass: "native-v3-public-claim-test", codeSha: input.releaseSha, toolVersions: {} },
  });
  assert.equal(compiled.activation, "activated", JSON.stringify(compiled));
  assert.equal(compiled.compilation.status, "sealed");
  const reader = createRuntimeArtifactReader({
    sql: database.sql, artifactRoot, artifactLimits: limits,
  });
  const packet = await reader.readExactSealedPacket(input.runId);
  assert.equal(packet.packet.schema, "setfarm.product-build-packet.v3");
  if (packet.packet.schema !== "setfarm.product-build-packet.v3") throw new Error("native fixture packet schema drift");
  if (!("implementationSourceMap" in packet)) throw new Error("native fixture SourceMap missing");
  assert.equal(packet.compilationReport.schema, "setfarm.product-compilation-report.v3");
  assert.equal(packet.packetHash, compiled.compilation.packetHash);
  assert.equal(packet.refs.compilationReport, compiled.compilation.reportHash);
  assert.deepEqual(packet.productSpec, genuineNodeCliProductSpecV2());
  assert.deepEqual(packet.storyPlan, stories.storyPlan);
  assert.deepEqual(packet.buildTopology, buildTopologyV1);
  assert.equal(packet.implementationSourceMap.designSourceKind, "none");
  assert.equal(packet.implementationSourceMap.buildTopologyV1PayloadHash, hashCanonicalJson(buildTopologyV1));
  assert.equal(packet.implementationSourceMap.storyPlanV2PayloadHash, hashCanonicalJson(stories.storyPlan));
  const pending = await database.sql<Array<{ id: string; story_id: string; story_index: number; status: string; depends_on: string }>>`
    SELECT id,story_id,story_index,status,depends_on FROM stories
     WHERE run_id=${input.runId} ORDER BY story_index,story_id
  `;
  assert.ok(pending.length > 0, "native fixture must contain an admitted pending story");
  assert.deepEqual(pending.map((row) => row.story_id), packet.storyPlan.stories.map((story) => story.id));
  assert.ok(pending.every((row) => row.status === "pending"));
  const story = pending[0]!;
  assert.equal(story.story_id, "US-001");
  const englishAuthority = await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId: input.runId });
  const subject = await database.sql.begin((transaction) => lockAndAuthenticateCompilerStoryEnglishAdmissionClaimSubjectV1(transaction, {
    runId: input.runId, proof: createCompilerStoryEnglishAdmissionClaimProofV1(englishAuthority),
    subject: { kind: "story_member", storyDbId: story.id, storyId: story.story_id },
  }));
  assert.equal(subject.subject.kind, "story_member");
  if (subject.subject.kind !== "story_member") throw new Error("native fixture admission subject drift");
  assert.equal(subject.subject.storyStatus, "pending");
  assert.equal(subject.subject.storyId, story.story_id);
  assert.equal(subject.subject.storyDbId, story.id);
  const prepared = await createV3NormalImplementationPreclaim({
    readPacket: (runId) => reader.readExactSealedPacket(runId),
    readPendingStories: createPostgresV3PendingStoryReader(database.sql),
    readTerminalDependencyAttempts: createPostgresTerminalDependencyAttemptReader(database.sql),
    blockRepository: createV3PreparationBlockRepository(database.sql),
  }).prepare({
    runId: input.runId, stepId: "implement", repo: input.repo,
    requestedBaseRef: "main", expectedSha: baseSha,
  });
  assert.equal(prepared.status, "ready", JSON.stringify(prepared));
  if (prepared.status !== "ready") throw new Error("native fixture exact-reader preclaim not ready");
  assert.equal(prepared.story.id, story.id);
  assert.equal(prepared.packetHash, packet.packetHash);
  assert.equal(prepared.baseRevision.sha, baseSha);
  assert.equal(prepared.baseRevision.treeHash, treeHash);
  assert.equal(git("status", "--porcelain"), "");
  assert.equal(git("rev-parse", "HEAD"), baseSha);
  const agentId = "feature-dev_developer";
  const token = createHash("sha256").update(`${input.runId}:implement`, "utf8").digest("hex").slice(0, 24);
  return Object.freeze({
    runId: input.runId, stepDbId, storyDbId: story.id, storyId: story.story_id, agentId,
    packetHash: packet.packetHash, compilationReportHash: packet.refs.compilationReport,
    runtimeIntent: Object.freeze({
      schema: "setfarm.runtime-claim-intent.v1" as const, sessionId: `RTS_${token}`,
      runtimeAgentId: agentId, runtimeKind: "openclaw_session" as const,
      ownerInstanceId: "native-v3-public-claim-owner", sessionKey: "native-v3-public-claim-session",
    }),
  });
}
