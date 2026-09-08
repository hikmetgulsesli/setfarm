import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import type { PgTransactionSql } from "../../../src/db-pg.js";
import { completeSingleStepClaimAndState } from "../../../src/execution/claim-attempt-transition.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
} from "../../../src/execution/claim-runtime-publication.js";
import { loadCompilerEnglishAdmissionLedgerAuthorityV1 } from "../../../src/execution/compiler-english-admission-ledger-v1.js";
import {
  createCompilerStoryEnglishAdmissionClaimProofV1,
  loadCompilerStoryEnglishAdmissionLedgerAuthorityV1,
  type CompilerStoryEnglishAdmissionClaimProofV1,
} from "../../../src/execution/compiler-story-english-admission-ledger-v1.js";
import { publishCompilerStoryEnglishAdmissionAndCompleteV1 } from "../../../src/execution/compiler-story-english-admission-publication-v1.js";
import { createRuntimeCompletionEffectRepository } from "../../../src/execution/runtime-completion-effect-repository.js";
import { runWithRuntimeCompletionOwner } from "../../../src/execution/runtime-completion-owner-context.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../../src/execution/runtime-completion.js";
import { createRuntimeSessionRepository } from "../../../src/execution/runtime-session-repository.js";
import type { ClaimEnvelopeV1 } from "../../../src/execution/schemas/claim-envelope-v1.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../../src/execution/schemas/runtime-completion-plan-v1.js";
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
  NODE_EXPRESS_API_TASK,
  twoStoryNodeExpressApiProductSpecV2,
} from "../../product-compiler/fixtures/no-design-product-semantics-v2.js";
import type { TestDatabase } from "../test-database.js";

const COMPILER_ADMISSION_DRAIN_EVIDENCE = Object.freeze({
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-13T09:59:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/compiler-story-english-admission-fixture"],
});

type ManagedCompilerAdmissionCompletion = Awaited<
  ReturnType<typeof prepareCompilerAdmissionCompletion>
>;

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
  const runtimeAgentId = `${input.workflowStepId}-admission-fixture-runtime`;
  const ownerInstanceId = `${input.workflowStepId}-admission-fixture-owner`;
  const claimId = await database.sql.begin(async (sql) => {
    const rows = await sql<Array<{ id: unknown }>>`
      SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id
    `;
    const birth = await prepareInternalProductionClaimBirthV1(
      sql as PgTransactionSql,
      "a-claim-single-runtime-v1",
      rows,
    );
    return insertAndBindInternalProductionClaimBirthV1(sql as PgTransactionSql, birth, {
      runId: input.runId,
      workflowStepId: input.workflowStepId,
      storyId: null,
      claimAgentId,
      claimedAt: new Date("2026-07-13T09:58:00.000Z"),
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
    sessionKey: `${input.workflowStepId}-admission-fixture-session`,
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
    throw new Error("Compiler admission completion request is missing");
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
    throw new Error("Compiler admission completion owner capability is missing");
  }
  return Object.freeze({
    claimId,
    envelope,
    completions,
    processing,
    requestId: requested.request.requestId,
    ownerInstanceId,
  });
}

async function settleCompilerAdmissionCompletion(
  database: TestDatabase,
  managed: ManagedCompilerAdmissionCompletion,
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
    evidence: { source: "compiler-story-english-admission-fixture" },
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

export type CanonicalCompilerStoryAdmissionFixture = Readonly<{
  runId: string;
  implementStepDbId: string;
  stories: readonly Readonly<{
    id: string;
    storyId: string;
    dependsOn: readonly string[];
  }>[];
  storyAdmissionProof: CompilerStoryEnglishAdmissionClaimProofV1;
}>;

export async function seedCanonicalCompilerStoryAdmissionFixture(
  database: TestDatabase,
  input: Readonly<{
    runId: string;
    releaseSha: string;
    packetHash: string;
  }>,
): Promise<CanonicalCompilerStoryAdmissionFixture> {
  const productSpec = twoStoryNodeExpressApiProductSpecV2();
  const productSpecHash = hashCanonicalJson(productSpec);
  const renderedPlan = renderProductSpecV2Compatibility(productSpec);
  const prdMarker = "\nPRD:\n";
  const prdIndex = renderedPlan.indexOf(prdMarker);
  assert.ok(prdIndex > 0);
  const prd = renderedPlan.slice(prdIndex + prdMarker.length);
  const baseContext: Record<string, string> = {
    task: NODE_EXPRESS_API_TASK,
    repo: `/tmp/${input.runId}`,
    prd,
    product_semantics_version: "v2",
    product_spec_schema: productSpec.schema,
    product_spec_hash: productSpecHash,
    product_spec_source_task_hash: productSpec.traceability.sourceTaskHash,
    ui_language: "English",
    project_name: productSpec.product.name,
    project_display_name: productSpec.product.name,
    project_slug: "task-api",
    app_title: productSpec.product.name,
    ui_vision_summary: productSpec.delivery.uiVisionSummary,
    design_required: "false",
  };
  const planStepDbId = `${input.runId}-plan-step`;
  const designStepDbId = `${input.runId}-design-step`;
  const storiesStepDbId = `${input.runId}-stories-step`;
  const implementStepDbId = `${input.runId}-step`;
  const admissionHash = await database.seedV3ReleaseGoAdmission(input.releaseSha);
  await database.sql`
    INSERT INTO runs (
      id, workflow_id, task, status, context, protocol, protocol_version,
      compiler_release_sha, packet_hash, activation_preflight_hash,
      release_admission_hash
    ) VALUES (
      ${input.runId}, 'feature-dev', ${NODE_EXPRESS_API_TASK}, 'running',
      ${JSON.stringify(baseContext)}, 'v3', 1, ${input.releaseSha},
      ${input.packetHash}, ${"e".repeat(64)}, ${admissionHash}
    )
  `;
  await database.sql`
    INSERT INTO steps (
      id, run_id, step_id, agent_id, step_index, input_template, expects,
      status, type, retry_count, max_retries
    ) VALUES (
      ${planStepDbId}, ${input.runId}, 'plan', 'feature-dev_planner', 1,
      '', '', 'running', 'single', 0, 3
    ), (
      ${designStepDbId}, ${input.runId}, 'design', 'feature-dev_designer', 2,
      '', '', 'waiting', 'single', 0, 3
    ), (
      ${storiesStepDbId}, ${input.runId}, 'stories', 'feature-dev_story-planner', 3,
      '', '', 'waiting', 'single', 0, 3
    ), (
      ${implementStepDbId}, ${input.runId}, 'implement', 'feature-dev_developer', 4,
      '', '', 'pending', 'loop', 0, 3
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
    ownerInstanceId: managedPlan.processing.ownerInstanceId,
    leaseExpiresAt: managedPlan.processing.leaseExpiresAt,
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
    ownerInstanceId: managedDesign.processing.ownerInstanceId,
    leaseExpiresAt: managedDesign.processing.leaseExpiresAt,
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
  const screenMapLine = storiesOutput
    .split("\n")
    .find((line) => line.startsWith("SCREEN_MAP: "));
  assert.ok(screenMapLine);
  const storiesContext = {
    ...designContext,
    screen_map: screenMapLine.slice("SCREEN_MAP: ".length),
  };
  await database.sql`
    UPDATE runs SET context = ${JSON.stringify(storiesContext)} WHERE id = ${input.runId}
  `;
  await database.sql`UPDATE steps SET status = 'running' WHERE id = ${storiesStepDbId}`;
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
    ownerInstanceId: managedStories.processing.ownerInstanceId,
    leaseExpiresAt: managedStories.processing.leaseExpiresAt,
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
    { runId: input.runId },
  );
  const storyRows = await database.sql<Array<{
    id: string;
    story_id: string;
    depends_on: string | null;
  }>>`
    SELECT id, story_id, depends_on
      FROM stories
     WHERE run_id = ${input.runId}
     ORDER BY story_index, story_id
  `;
  assert.equal(storyRows.length, 2);
  return Object.freeze({
    runId: input.runId,
    implementStepDbId,
    stories: Object.freeze(storyRows.map((story) => Object.freeze({
      id: story.id,
      storyId: story.story_id,
      dependsOn: Object.freeze(
        story.depends_on ? JSON.parse(story.depends_on) as string[] : [],
      ),
    }))),
    storyAdmissionProof: createCompilerStoryEnglishAdmissionClaimProofV1(
      durableStoryAuthority,
    ),
  });
}
