import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  completeSingleStepClaimAndState,
} from "../../src/execution/claim-attempt-transition.js";
import {
  loadCompilerEnglishAdmissionLedgerAuthorityV1,
} from "../../src/execution/compiler-english-admission-ledger-v1.js";
import {
  createCompilerStoryEnglishAdmissionClaimProofV1,
  inspectCompilerStoryEnglishAdmissionLedgerAuthorityV1,
  loadCompilerStoryEnglishAdmissionLedgerAuthorityV1,
} from "../../src/execution/compiler-story-english-admission-ledger-v1.js";
import {
  publishLoopClaimRuntime,
  publishSingleClaimRuntime,
} from "../../src/execution/claim-runtime-publication.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import {
  compileCompilerEnglishAdmissionV1,
  compilerEnglishAdmissionReceiptV1,
} from "../../src/product-compiler/compiler-english-admission-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { renderProductSpecV2Compatibility } from "../../src/product-compiler/renderers/product-spec-v2-compatibility.js";
import { CompilerStoryEnglishAdmissionReceiptV1Schema } from "../../src/product-compiler/schemas/compiler-story-english-admission-receipt-v1.js";
import { buildV3AutoStoriesOutput } from "../../src/installer/steps/03-stories/preclaim.js";
import {
  NODE_CLI_TASK,
  genuineNodeCliProductSpecV2,
} from "../product-compiler/fixtures/no-design-product-semantics-v2.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-08-12T12:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/atomic-story-publication-drain"],
};

type TestDatabase = Awaited<ReturnType<typeof createIsolatedTestDatabase>>;

async function prepareManagedCompletion(
  database: TestDatabase,
  input: Readonly<{
    runId: string;
    stepDbId: string;
    workflowStepId: string;
    claimAgentId: string;
    runtimeAgentId: string;
    ownerInstanceId: string;
    sessionId: string;
    requestId: string;
    output: string;
  }>,
) {
  const claims = await database.sql<Array<{ id: number }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
    VALUES (${input.runId}, ${input.workflowStepId}, NULL, ${input.claimAgentId})
    RETURNING id::integer AS id
  `;
  const claimId = claims[0]!.id;
  const sessions = createRuntimeSessionRepository(database.sql);
  const session = await sessions.reserve({
    sessionId: input.sessionId,
    runId: input.runId,
    stepDbId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    claimId,
    claimAgentId: input.claimAgentId,
    runtimeAgentId: input.runtimeAgentId,
    runtimeKind: "openclaw_session",
    ownerInstanceId: input.ownerInstanceId,
  });
  await sessions.markStarting({ sessionId: session.sessionId, ownerInstanceId: input.ownerInstanceId });
  await sessions.markRunning({
    sessionId: session.sessionId,
    ownerInstanceId: input.ownerInstanceId,
    sessionKey: `${input.workflowStepId}-atomic-publication-session`,
  });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    protocol: "v3",
    issuedAt: "2026-08-12T11:59:00.000Z",
    stepId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    runId: input.runId,
    claimId,
    claimAgentId: input.claimAgentId,
    runtimeAgentId: input.runtimeAgentId,
    input: `Compiler-owned ${input.workflowStepId} completion`,
  };
  const requested = await requestRuntimeCompletion(database.sql, {
    envelope,
    output: input.output,
    requestId: input.requestId,
  });
  assert.equal(requested.status, "requested");
  if (requested.status !== "requested") throw new Error("runtime completion request missing");
  const completions = createRuntimeCompletionRepository(database.sql);
  await completions.claim({
    requestId: requested.request.requestId,
    ownerInstanceId: input.ownerInstanceId,
  });
  await sessions.markDrained({
    sessionId: session.sessionId,
    ownerInstanceId: input.ownerInstanceId,
    evidence: DRAIN_EVIDENCE,
  });
  const processing = await completions.markProcessing({
    requestId: requested.request.requestId,
    ownerInstanceId: input.ownerInstanceId,
  });
  if (!processing.ownerInstanceId || !processing.leaseExpiresAt) {
    throw new Error("runtime completion owner capability missing");
  }
  return { claimId, envelope, completions, processing, requestId: requested.request.requestId };
}

async function settleManagedCompletion(
  database: TestDatabase,
  managed: Awaited<ReturnType<typeof prepareManagedCompletion>>,
  ownerInstanceId: string,
): Promise<void> {
  const effects = createRuntimeCompletionEffectRepository(database.sql);
  const effect = await effects.claimNext({ requestId: managed.requestId, ownerInstanceId });
  assert.ok(effect?.leaseToken);
  await effects.settle({
    requestId: managed.requestId,
    effectKey: effect.effectKey,
    ownerInstanceId,
    leaseToken: effect.leaseToken,
    resolution: "applied",
    result: { advanced: false, runCompleted: false },
    evidence: { source: "atomic-story-publication-test" },
  });
  await managed.completions.markEffectsCommitted({
    requestId: managed.requestId,
    ownerInstanceId,
    ownerAttemptCount: managed.processing.ownerAttemptCount,
    result: { advanced: false, runCompleted: false },
  });
  await managed.completions.acceptAndRelease({
    requestId: managed.requestId,
    ownerInstanceId,
    ownerAttemptCount: managed.processing.ownerAttemptCount,
    result: { advanced: false, runCompleted: false },
  });
}

async function assertOversizedAuthorityProjectionRejected(
  input: Readonly<{
    mutate: () => Promise<unknown>;
    load: () => Promise<unknown>;
    expected: RegExp;
    restore: () => Promise<unknown>;
  }>,
): Promise<void> {
  await input.mutate();
  try {
    await assert.rejects(input.load(), input.expected);
  } finally {
    await input.restore();
  }
}

type StoryRow = Readonly<{
  story_index: number;
  story_id: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  status: string;
  retry_count: number;
  max_retries: number;
  depends_on: string | null;
  scope_targets: string | null;
}>;

async function rowsForRun(
  sql: Awaited<ReturnType<typeof createIsolatedTestDatabase>>["sql"],
  runId: string,
): Promise<StoryRow[]> {
  return sql.unsafe<StoryRow[]>(
    `SELECT story_index, story_id, title, description, acceptance_criteria,
            status, retry_count, max_retries, depends_on, scope_targets
       FROM stories
      WHERE run_id = $1
      ORDER BY story_index, story_id`,
    [runId],
  );
}

describe("canonical story publication", { concurrency: 1 }, () => {
  it("bounds authority effect payloads before the limited row fetch", () => {
    const source = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../src/execution/runtime-completion-authority-projection-v1.ts",
      ),
      "utf8",
    );
    const fetchStart = source.indexOf("const effectRows = await sql.unsafe");
    const fetchEnd = source.indexOf("if (effectRows.length !== effectCount)", fetchStart);
    assert.notEqual(fetchStart, -1, "bounded effect fetch must exist");
    assert.notEqual(fetchEnd, -1, "bounded effect fetch end must exist");
    const fetch = source.slice(fetchStart, fetchEnd);
    assert.match(fetch, /LIMIT \$2/);
    assert.doesNotMatch(fetch, /\bOVER\s*\(/i);
    assert.match(fetch, /SELECT COUNT\(\*\) = \$6::bigint/);
    assert.match(source.slice(0, fetchStart), /SELECT COUNT\(\*\)::text AS effect_count/);
  });

  it("validates before mutation and atomically replaces the complete story set", async () => {
    const previousPgUrl = process.env.SETFARM_PG_URL;
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const { parseAndInsertStories } = await import("../../src/installer/story-ops.js");
    const runId = "run-canonical-story-publication";
    try {
      await database.insertRun(runId);
      await database.sql`
        INSERT INTO stories (
          id, run_id, story_index, story_id, title, description,
          acceptance_criteria, status, retry_count, max_retries
        ) VALUES (
          'story-row-retained', ${runId}, 0, 'US-RETAINED',
          'Retained story', 'Preserve this row until canonical publication succeeds.',
          ${JSON.stringify(["The retained row remains unchanged."])},
          'pending', 0, 5
        )
      `;
      const retainedRows = await rowsForRun(database.sql, runId);
      assert.equal(retainedRows.length, 1);

      const localizedTitle = String.fromCharCode(
        71, 117, 97, 114, 100, 97, 114, 32, 99, 97, 109, 98, 105, 111, 115,
      );
      await assert.rejects(
        parseAndInsertStories(`STORIES_JSON: ${JSON.stringify([{
          id: "US-INVALID",
          title: localizedTitle,
          description: "This candidate must fail before publication.",
          acceptanceCriteria: ["The invalid candidate is rejected."],
        }])}`, runId, { replaceExisting: true }),
        /STORIES_ENGLISH_TEXT_REQUIRED/,
      );
      assert.deepEqual(await rowsForRun(database.sql, runId), retainedRows);

      await assert.rejects(
        parseAndInsertStories("STORIES_JSON: []", runId, { replaceExisting: true }),
        /STORIES_JSON must contain at least one story/,
      );
      assert.deepEqual(await rowsForRun(database.sql, runId), retainedRows);

      await database.sql`
        ALTER TABLE stories
        ADD CONSTRAINT story_publication_test_rejection
        CHECK (story_id <> 'US-ROLLBACK')
      `;
      await assert.rejects(
        parseAndInsertStories(`STORIES_JSON: ${JSON.stringify([{
          id: "US-ROLLBACK",
          title: "Rollback story",
          description: "Force an insertion failure after the canonical delete.",
          acceptanceCriteria: ["The transaction restores the retained row."],
        }])}`, runId, { replaceExisting: true }),
        /story_publication_test_rejection/,
      );
      assert.deepEqual(await rowsForRun(database.sql, runId), retainedRows);
      await database.sql`
        ALTER TABLE stories DROP CONSTRAINT story_publication_test_rejection
      `;

      const canonicalStories = [{
        id: "US-001",
        title: "Create the workspace",
        description: "Create the canonical workspace view.",
        acceptanceCriteria: ["The workspace displays its approved title."],
        depends_on: [],
        scope_targets: [{ role: "surface_component", locator: "workspace" }],
      }, {
        id: "US-002",
        title: "Persist workspace settings",
        description: "Persist approved workspace settings.",
        acceptanceCriteria: ["Saved settings remain available after reload."],
        depends_on: ["US-001"],
        scope_targets: [{ role: "action_handler", locator: "save-workspace" }],
      }];
      const encoded = Buffer.from(JSON.stringify(canonicalStories), "utf8").toString("base64");
      await parseAndInsertStories(
        `STORIES_JSON_B64: ${encoded}`,
        runId,
        { replaceExisting: true },
      );

      const published = await rowsForRun(database.sql, runId);
      assert.equal(published.length, 2);
      assert.deepEqual(published.map((row) => row.story_id), ["US-001", "US-002"]);
      assert.deepEqual(published.map((row) => row.story_index), [0, 1]);
      assert.equal(published[0]!.title, canonicalStories[0]!.title);
      assert.equal(published[1]!.description, canonicalStories[1]!.description);
      assert.deepEqual(JSON.parse(published[0]!.acceptance_criteria), canonicalStories[0]!.acceptanceCriteria);
      assert.deepEqual(JSON.parse(published[1]!.depends_on!), ["US-001"]);
      assert.deepEqual(JSON.parse(published[1]!.scope_targets!), canonicalStories[1]!.scope_targets);
      assert.deepEqual(published.map((row) => row.status), ["pending", "pending"]);
      assert.deepEqual(published.map((row) => row.retry_count), [0, 0]);
      assert.deepEqual(published.map((row) => row.max_retries), [5, 5]);
      assert.equal(published.some((row) => row.story_id === "US-RETAINED"), false);
    } finally {
      await runtimeDb.pgClose();
      await database.cleanup();
      if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
      else process.env.SETFARM_PG_URL = previousPgUrl;
    }
  });

  it("commits compiler-owned stories, context, claim, step, and receipt as one transaction", async () => {
    const previousPgUrl = process.env.SETFARM_PG_URL;
    const database = await createIsolatedTestDatabase();
    const runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-atomic-stories-"));
    try {
      const { completeStep } = await import("../../src/installer/step-ops.js");
      const {
        designAuthoritySubjectHashV1,
        prepareV3StoriesCompletionV1,
      } = await import("../../src/installer/steps/03-stories/guards.js");
      const runId = "run-atomic-compiler-story-publication";
      const planStepDbId = "step-atomic-compiler-story-plan";
      const designStepDbId = "step-atomic-compiler-story-design";
      const storyStepDbId = "step-atomic-compiler-story-stories";
      const implementStepDbId = "step-atomic-compiler-story-implement";
      const superviseStepDbId = "step-atomic-compiler-story-supervise";
      const releaseSha = "e".repeat(40);
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
      const productSpec = genuineNodeCliProductSpecV2();
      const productSpecHash = hashCanonicalJson(productSpec);
      const renderedPlan = renderProductSpecV2Compatibility(productSpec);
      const prdMarker = "\nPRD:\n";
      const prdIndex = renderedPlan.indexOf(prdMarker);
      assert.ok(prdIndex > 0);
      const prd = renderedPlan.slice(prdIndex + prdMarker.length);
      const baseContext: Record<string, string> = {
        task: NODE_CLI_TASK,
        repo,
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
      const baseContextJson = JSON.stringify(baseContext);
      await database.sql`
        INSERT INTO runs (
          id, workflow_id, task, status, context, protocol,
          compiler_release_sha, activation_preflight_hash, release_admission_hash
        ) VALUES (
          ${runId}, 'feature-dev', ${NODE_CLI_TASK}, 'running', ${baseContextJson}, 'v3',
          ${releaseSha}, ${"b".repeat(64)}, ${releaseAdmissionHash}
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
          ${storyStepDbId}, ${runId}, 'stories', 'feature-dev_story-planner', 3, '', '',
          'waiting', 'single', 0, 3
        ), (
          ${implementStepDbId}, ${runId}, 'implement', 'feature-dev_developer', 4, '', '',
          'pending', 'loop', 0, 3
        ), (
          ${superviseStepDbId}, ${runId}, 'supervise', 'feature-dev_supervisor', 5, '', '',
          'pending', 'single', 0, 3
        )
      `;

      const managedPlan = await prepareManagedCompletion(database, {
        runId,
        stepDbId: planStepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeAgentId: "planner-runtime",
        ownerInstanceId: "atomic-story-plan-owner",
        sessionId: "RTS_atomic-story-plan-0001",
        requestId: "RCR_atomic-story-plan-0001",
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
        effectPayload: {
          stepId: "plan",
          compilerEnglishAdmissionReceipt: planReceipt,
        },
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
        expectedRunContextJson: baseContextJson,
        requireRuntimeCompletionOwner: true,
        completionPlan: planCompletionPlan,
      }));
      await settleManagedCompletion(database, managedPlan, "atomic-story-plan-owner");
      const durablePlanAuthority = await loadCompilerEnglishAdmissionLedgerAuthorityV1(
        database.sql,
        { runId },
      );
      assert.equal(durablePlanAuthority.receiptHash, planAuthority.receiptHash);

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
      await database.sql`
        UPDATE steps SET status = 'running' WHERE id = ${designStepDbId}
      `;
      const managedDesign = await prepareManagedCompletion(database, {
        runId,
        stepDbId: designStepDbId,
        workflowStepId: "design",
        claimAgentId: "feature-dev_designer",
        runtimeAgentId: "designer-runtime",
        ownerInstanceId: "atomic-story-design-owner",
        sessionId: "RTS_atomic-story-design-0001",
        requestId: "RCR_atomic-story-design-0001",
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

      const storyOutput = buildV3AutoStoriesOutput({
        repo,
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
      await assert.rejects(
        prepareV3StoriesCompletionV1({
          runId,
          stepId: "stories",
          parsed: { status: "done" },
          context: storyAdmissionContext,
          rawOutput: storyOutput,
        }),
        /STORIES_DESIGN_COMPLETION_OWNER_COUNT_INVALID:0/,
      );
      await settleManagedCompletion(database, managedDesign, "atomic-story-design-owner");
      await database.sql`
        UPDATE runs SET context = ${JSON.stringify(storyAdmissionContext)} WHERE id = ${runId}
      `;
      await database.sql`
        INSERT INTO stories (
          id, run_id, story_index, story_id, title, description,
          acceptance_criteria, status, retry_count, max_retries
        ) VALUES (
          'story-atomic-retained', ${runId}, 0, 'US-RETAINED',
          'Retained atomic story', 'Preserve this row until the authority transaction commits.',
          ${JSON.stringify(["The retained row survives every rejected publication."])},
          'pending', 0, 5
        )
      `;
      await assert.rejects(
        prepareV3StoriesCompletionV1({
          runId,
          stepId: "stories",
          parsed: { status: "done" },
          context: storyAdmissionContext,
          rawOutput: `${storyOutput}\n`,
        }),
        /V3_STORY_PROJECTION_MISMATCH/,
      );
      assert.deepEqual((await rowsForRun(database.sql, runId)).map((row) => row.story_id), ["US-RETAINED"]);

      await database.sql`
        UPDATE steps SET status = 'running' WHERE id = ${storyStepDbId}
      `;
      const managedStories = await prepareManagedCompletion(database, {
        runId,
        stepDbId: storyStepDbId,
        workflowStepId: "stories",
        claimAgentId: "feature-dev_story-planner",
        runtimeAgentId: "story-planner-runtime",
        ownerInstanceId: "atomic-story-completion-owner",
        sessionId: "RTS_atomic-story-completion-0001",
        requestId: "RCR_atomic-story-completion-0001",
        output: storyOutput,
      });
      const storyCandidates = JSON.parse(
        storyOutput.split("\n").find((line) => line.startsWith("STORIES_JSON: "))!
          .slice("STORIES_JSON: ".length),
      ) as Array<{
        id: string;
        title: string;
        acceptanceCriteria: string[];
      }>;
      assert.ok(storyCandidates[0]?.id);
      assert.match(storyCandidates[0]!.id, /^[A-Z0-9-]+$/);
      await database.sql.unsafe(
        `ALTER TABLE stories
           ADD CONSTRAINT story_atomic_publication_rejection
           CHECK (story_id <> '${storyCandidates[0]!.id}')`,
        [],
      );
      const ownerCapability = {
        requestId: managedStories.processing.requestId,
        ownerInstanceId: managedStories.processing.ownerInstanceId!,
        leaseExpiresAt: managedStories.processing.leaseExpiresAt!,
        ownerAttemptCount: managedStories.processing.ownerAttemptCount,
      };
      await assert.rejects(
        runWithRuntimeCompletionOwner(ownerCapability, () => completeStep(
          storyStepDbId,
          storyOutput,
          managedStories.envelope,
          { deferContinuationToEffectLedger: true },
        )),
        /story_atomic_publication_rejection/,
      );
      const rolledBack = await database.sql<Array<{
        claim_outcome: string | null;
        step_status: string;
        apply_phase: string;
        context: string;
      }>>`
        SELECT claim.outcome AS claim_outcome,
               step.status AS step_status,
               completion.apply_phase,
               run.context
          FROM runs run
          JOIN steps step ON step.id = ${storyStepDbId}
          JOIN claim_log claim ON claim.id = ${managedStories.claimId}
          JOIN runtime_completion_requests completion ON completion.claim_id = claim.id
         WHERE run.id = ${runId}
      `;
      assert.equal(rolledBack[0]!.claim_outcome, null);
      assert.equal(rolledBack[0]!.step_status, "running");
      assert.notEqual(rolledBack[0]!.apply_phase, "owner_committed");
      assert.equal(JSON.parse(rolledBack[0]!.context).stories_english_admission_receipt_hash, undefined);
      assert.deepEqual((await rowsForRun(database.sql, runId)).map((row) => row.story_id), ["US-RETAINED"]);
      await database.sql`ALTER TABLE stories DROP CONSTRAINT story_atomic_publication_rejection`;

      assert.deepEqual(await runWithRuntimeCompletionOwner(ownerCapability, () => completeStep(
        storyStepDbId,
        storyOutput,
        managedStories.envelope,
        { deferContinuationToEffectLedger: true },
      )), { advanced: false, runCompleted: false });
      const committed = await database.sql<Array<{
        claim_outcome: string;
        step_status: string;
        step_output: string;
        apply_phase: string;
        context: string;
        receipt: unknown;
      }>>`
        SELECT claim.outcome AS claim_outcome,
               step.status AS step_status,
               step.output AS step_output,
               completion.apply_phase,
               run.context,
               effect.payload::jsonb #> '{effect,compilerStoryEnglishAdmissionReceipt}' AS receipt
          FROM runs run
          JOIN steps step ON step.id = ${storyStepDbId}
          JOIN claim_log claim ON claim.id = ${managedStories.claimId}
          JOIN runtime_completion_requests completion ON completion.claim_id = claim.id
          JOIN runtime_completion_effects effect ON effect.request_id = completion.request_id
         WHERE run.id = ${runId}
      `;
      assert.equal(committed.length, 1);
      assert.equal(committed[0]!.claim_outcome, "completed");
      assert.equal(committed[0]!.step_status, "done");
      assert.equal(committed[0]!.step_output, storyOutput);
      assert.equal(committed[0]!.apply_phase, "owner_committed");
      const storyReceipt = CompilerStoryEnglishAdmissionReceiptV1Schema.parse(committed[0]!.receipt);
      const committedContext = JSON.parse(committed[0]!.context) as Record<string, string>;
      assert.equal(committedContext["stories_english_authority_version"], storyReceipt.authorityVersion);
      assert.equal(committedContext["stories_english_admission_receipt_hash"], hashCanonicalJson(storyReceipt));
      assert.equal(storyReceipt.parentPlanReceiptHash, durablePlanAuthority.receiptHash);
      assert.equal(storyReceipt.productionAuthority, false);
      assert.equal(storyReceipt.storyCount, storyCandidates.length);
      assert.deepEqual(
        (await rowsForRun(database.sql, runId)).map((row) => row.story_id),
        storyCandidates.map((story) => story.id),
      );
      await assert.rejects(
        loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_OWNER_COUNT_INVALID:0/,
      );
      await settleManagedCompletion(database, managedStories, "atomic-story-completion-owner");
      const storyLedgerAuthority = await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(
        database.sql,
        { runId },
      );
      assert.equal(storyLedgerAuthority.receiptHash, hashCanonicalJson(storyReceipt));
      assert.equal(
        inspectCompilerStoryEnglishAdmissionLedgerAuthorityV1(storyLedgerAuthority).subjectHash,
        storyReceipt.subjectHash,
      );
      assert.throws(
        () => inspectCompilerStoryEnglishAdmissionLedgerAuthorityV1({ ...storyLedgerAuthority }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_AUTHORITY_UNAUTHENTICATED/,
      );
      const planRequestRows = await database.sql<Array<{
        claim_envelope: unknown;
        source_proposal: string | null;
        submission_evidence: unknown | null;
        result: unknown;
      }>>`
        SELECT claim_envelope, source_proposal, submission_evidence, result
          FROM runtime_completion_requests
         WHERE request_id = ${managedPlan.requestId}
      `;
      const storyRequestRows = await database.sql<Array<{
        claim_envelope: unknown;
        result: unknown;
      }>>`
        SELECT claim_envelope, result
          FROM runtime_completion_requests
         WHERE request_id = ${managedStories.requestId}
      `;
      const designEffectRows = await database.sql<Array<{
        result: unknown;
        evidence: unknown;
      }>>`
        SELECT result, evidence
          FROM runtime_completion_effects
         WHERE request_id = ${managedDesign.requestId}
      `;
      const planRequest = planRequestRows[0]!;
      const storyRequest = storyRequestRows[0]!;
      const designEffect = designEffectRows[0]!;
      let requestTriggersDisabled = false;
      let effectTriggersDisabled = false;
      let submissionEvidenceConstraintDropped = false;
      try {
        await database.sql`ALTER TABLE runtime_completion_requests DISABLE TRIGGER USER`;
        requestTriggersDisabled = true;
        await database.sql`ALTER TABLE runtime_completion_effects DISABLE TRIGGER USER`;
        effectTriggersDisabled = true;
        await database.sql`
          ALTER TABLE runtime_completion_requests
          DROP CONSTRAINT runtime_completion_requests_submission_evidence_check
        `;
        submissionEvidenceConstraintDropped = true;

        await assertOversizedAuthorityProjectionRejected({
          mutate: () => database.sql`
            UPDATE runtime_completion_requests
               SET claim_envelope = jsonb_build_object('oversized', repeat('x', 4000001))
             WHERE request_id = ${managedStories.requestId}
          `,
          load: () => loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
          expected: /RUNTIME_COMPLETION_AUTHORITY_REQUEST_FIELD_LIMIT_EXCEEDED:claim_envelope/,
          restore: () => database.sql`
            UPDATE runtime_completion_requests
               SET claim_envelope = ${storyRequest.claim_envelope}::jsonb
             WHERE request_id = ${managedStories.requestId}
          `,
        });
        await assertOversizedAuthorityProjectionRejected({
          mutate: () => database.sql`
            UPDATE runtime_completion_requests
               SET source_proposal = repeat('x', 4000001)
             WHERE request_id = ${managedPlan.requestId}
          `,
          load: () => loadCompilerEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
          expected: /RUNTIME_COMPLETION_AUTHORITY_REQUEST_FIELD_LIMIT_EXCEEDED:source_proposal/,
          restore: () => database.sql`
            UPDATE runtime_completion_requests
               SET source_proposal = ${planRequest.source_proposal}
             WHERE request_id = ${managedPlan.requestId}
          `,
        });
        await assertOversizedAuthorityProjectionRejected({
          mutate: () => database.sql`
            UPDATE runtime_completion_requests
               SET submission_evidence = jsonb_build_object('oversized', repeat('x', 4000001))
             WHERE request_id = ${managedPlan.requestId}
          `,
          load: () => loadCompilerEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
          expected: /RUNTIME_COMPLETION_AUTHORITY_REQUEST_FIELD_LIMIT_EXCEEDED:submission_evidence/,
          restore: () => database.sql`
            UPDATE runtime_completion_requests
               SET submission_evidence = ${planRequest.submission_evidence}::jsonb
             WHERE request_id = ${managedPlan.requestId}
          `,
        });
        await assertOversizedAuthorityProjectionRejected({
          mutate: () => database.sql`
            UPDATE runtime_completion_requests
               SET result = jsonb_build_object('oversized', repeat('x', 4000001))
             WHERE request_id = ${managedStories.requestId}
          `,
          load: () => loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
          expected: /RUNTIME_COMPLETION_AUTHORITY_REQUEST_FIELD_LIMIT_EXCEEDED:result/,
          restore: () => database.sql`
            UPDATE runtime_completion_requests
               SET result = ${storyRequest.result}::jsonb
             WHERE request_id = ${managedStories.requestId}
          `,
        });
        await assertOversizedAuthorityProjectionRejected({
          mutate: () => database.sql`
            UPDATE runtime_completion_effects
               SET result = jsonb_build_object('oversized', repeat('x', 4000001))
             WHERE request_id = ${managedDesign.requestId}
          `,
          load: () => designAuthoritySubjectHashV1(
            database.sql,
            runId,
            storyAdmissionContext,
            productSpecHash,
            false,
          ),
          expected: /RUNTIME_COMPLETION_AUTHORITY_EFFECT_FIELD_LIMIT_EXCEEDED:result/,
          restore: () => database.sql`
            UPDATE runtime_completion_effects
               SET result = ${designEffect.result}::jsonb
             WHERE request_id = ${managedDesign.requestId}
          `,
        });
        await assertOversizedAuthorityProjectionRejected({
          mutate: () => database.sql`
            UPDATE runtime_completion_effects
               SET evidence = jsonb_build_object('oversized', repeat('x', 4000001))
             WHERE request_id = ${managedDesign.requestId}
          `,
          load: () => designAuthoritySubjectHashV1(
            database.sql,
            runId,
            storyAdmissionContext,
            productSpecHash,
            false,
          ),
          expected: /RUNTIME_COMPLETION_AUTHORITY_EFFECT_FIELD_LIMIT_EXCEEDED:evidence/,
          restore: () => database.sql`
            UPDATE runtime_completion_effects
               SET evidence = ${designEffect.evidence}::jsonb
             WHERE request_id = ${managedDesign.requestId}
          `,
        });
      } finally {
        if (submissionEvidenceConstraintDropped) {
          await database.sql`
            ALTER TABLE runtime_completion_requests
            ADD CONSTRAINT runtime_completion_requests_submission_evidence_check
            CHECK (
              ((submission_evidence IS NULL) = (source_proposal IS NULL))
              AND (
                submission_evidence IS NULL
                OR (
                  jsonb_typeof(submission_evidence) = 'object'
                  AND octet_length(source_proposal) BETWEEN 2 AND 524288
                ) IS TRUE
              )
            )
          `;
        }
        if (effectTriggersDisabled) {
          await database.sql`ALTER TABLE runtime_completion_effects ENABLE TRIGGER USER`;
        }
        if (requestTriggersDisabled) {
          await database.sql`ALTER TABLE runtime_completion_requests ENABLE TRIGGER USER`;
        }
      }
      const authorityLimitRollback = await database.sql<Array<{
        implement_status: string;
        supervise_status: string;
        downstream_claims: number;
        downstream_sessions: number;
      }>>`
        SELECT implement.status AS implement_status,
               supervise.status AS supervise_status,
               (SELECT COUNT(*)::integer
                  FROM claim_log
                 WHERE run_id = ${runId}
                   AND step_id IN ('implement', 'supervise')) AS downstream_claims,
               (SELECT COUNT(*)::integer
                  FROM runtime_sessions
                 WHERE run_id = ${runId}
                   AND workflow_step_id IN ('implement', 'supervise')) AS downstream_sessions
          FROM steps implement
          JOIN steps supervise ON supervise.id = ${superviseStepDbId}
         WHERE implement.id = ${implementStepDbId}
      `;
      assert.deepEqual({ ...authorityLimitRollback[0] }, {
        implement_status: "pending",
        supervise_status: "pending",
        downstream_claims: 0,
        downstream_sessions: 0,
      });
      const storyClaimProof = createCompilerStoryEnglishAdmissionClaimProofV1(
        storyLedgerAuthority,
      );
      const admittedStories = await database.sql<Array<{
        id: string;
        story_id: string;
        title: string;
      }>>`
        SELECT id, story_id, title
          FROM stories
         WHERE run_id = ${runId}
         ORDER BY story_index, story_id
      `;
      const admittedStory = admittedStories[0]!;
      const loopPublicationInput = {
        runId,
        stepDbId: implementStepDbId,
        workflowStepId: "implement",
        storyDbId: admittedStory.id,
        storyId: admittedStory.story_id,
        claimAgentId: "feature-dev_developer",
        parallelLimit: 1,
        runtimeIntent: {
          schema: "setfarm.runtime-claim-intent.v1",
          sessionId: "RTS_story-proof-loop-0001",
          runtimeAgentId: "story-proof-runtime",
          runtimeKind: "openclaw_session",
          ownerInstanceId: "story-proof-loop-owner",
        },
      } as const;
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, loopPublicationInput),
        /COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_PROOF_REQUIRED/,
      );
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, {
          ...loopPublicationInput,
          storyAdmissionProof: {
            ...storyClaimProof,
            receiptHash: "0".repeat(64),
          },
        }),
        /COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_RECEIPT_HASH_MISMATCH/,
      );
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, {
          ...loopPublicationInput,
          storyAdmissionProof: {
            ...storyClaimProof,
            subjectHash: "0".repeat(64),
          },
        }),
        /COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_SUBJECT_HASH_MISMATCH/,
      );
      await database.sql`
        UPDATE stories SET title = 'Late unauthorized claim drift'
         WHERE id = ${admittedStory.id}
      `;
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, {
          ...loopPublicationInput,
          storyAdmissionProof: storyClaimProof,
        }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_IMMUTABLE_STORY_DRIFT/,
      );
      const loopRollback = await database.sql<Array<{
        step_status: string;
        story_status: string;
        claims: number;
        sessions: number;
      }>>`
        SELECT step.status AS step_status,
               story.status AS story_status,
               (SELECT COUNT(*)::integer
                  FROM claim_log
                 WHERE run_id = ${runId} AND step_id = 'implement') AS claims,
               (SELECT COUNT(*)::integer
                  FROM runtime_sessions
                 WHERE run_id = ${runId} AND workflow_step_id = 'implement') AS sessions
          FROM steps step
          JOIN stories story ON story.id = ${admittedStory.id}
         WHERE step.id = ${implementStepDbId}
      `;
      assert.deepEqual({ ...loopRollback[0] }, {
        step_status: "pending",
        story_status: "pending",
        claims: 0,
        sessions: 0,
      });
      await database.sql`
        UPDATE stories SET title = ${admittedStory.title}
         WHERE id = ${admittedStory.id}
      `;

      const unauthorizedClaimStoryDbId = `unauthorized-claim-story-${runId}`;
      await database.sql`
        INSERT INTO stories (
          id, run_id, story_index, story_id, title, description,
          acceptance_criteria, status, retry_count, max_retries,
          depends_on, scope_files, shared_files, scope_targets,
          requested_dependencies, shared_edit_requests, resolved_scope_files,
          scope_description, file_skeletons, implementation_contract,
          created_at, updated_at
        )
        SELECT ${unauthorizedClaimStoryDbId}, run_id, 999, 'UNAUTHORIZED-CLAIM-001',
               'Unauthorized claim story', description, acceptance_criteria,
               'pending', 0, max_retries, depends_on, scope_files, shared_files,
               scope_targets, requested_dependencies, shared_edit_requests,
               resolved_scope_files, scope_description, file_skeletons,
               implementation_contract, NOW(), NOW()
          FROM stories
         WHERE id = ${admittedStory.id}
      `;
      await assert.rejects(
        publishSingleClaimRuntime(database.sql, {
          runId,
          stepDbId: superviseStepDbId,
          workflowStepId: "supervise",
          claimAgentId: "feature-dev_supervisor",
          runtimeIntent: {
            schema: "setfarm.runtime-claim-intent.v1",
            sessionId: "RTS_story-proof-supervise-0001",
            runtimeAgentId: "story-proof-supervisor-runtime",
            runtimeKind: "openclaw_session",
            ownerInstanceId: "story-proof-supervisor-owner",
          },
          storyAdmissionProof: storyClaimProof,
          storySubject: {
            kind: "story_member",
            storyDbId: unauthorizedClaimStoryDbId,
            storyId: "UNAUTHORIZED-CLAIM-001",
          },
        }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_IMMUTABLE_STORY_DRIFT/,
      );
      const supervisorRollback = await database.sql<Array<{
        step_status: string;
        claims: number;
        sessions: number;
      }>>`
        SELECT step.status AS step_status,
               (SELECT COUNT(*)::integer
                  FROM claim_log
                 WHERE run_id = ${runId} AND step_id = 'supervise') AS claims,
               (SELECT COUNT(*)::integer
                  FROM runtime_sessions
                 WHERE run_id = ${runId} AND workflow_step_id = 'supervise') AS sessions
          FROM steps step
         WHERE step.id = ${superviseStepDbId}
      `;
      assert.deepEqual({ ...supervisorRollback[0] }, {
        step_status: "pending",
        claims: 0,
        sessions: 0,
      });
      await database.sql`DELETE FROM stories WHERE id = ${unauthorizedClaimStoryDbId}`;
      await database.sql`
        UPDATE stories
           SET scope_files = ${JSON.stringify(["src/commands/add.ts"])},
               status = 'running'
         WHERE run_id = ${runId}
           AND story_index = 0
      `;
      assert.equal(
        (await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId })).receiptHash,
        storyLedgerAuthority.receiptHash,
        "durable admission must survive legitimate scheduling-row mutation",
      );
      const canonicalFirstTitle = storyCandidates[0]!.title;
      await database.sql`
        UPDATE stories SET title = 'Unauthorized title drift'
         WHERE run_id = ${runId} AND story_index = 0
      `;
      await assert.rejects(
        loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_IMMUTABLE_STORY_DRIFT/,
      );
      await database.sql`
        UPDATE stories SET title = ${canonicalFirstTitle}
         WHERE run_id = ${runId} AND story_index = 0
      `;
      const enrichedCriteria = [
        ...storyCandidates[0]!.acceptanceCriteria,
        "A setup-owned derived criterion remains append-only.",
      ];
      await database.sql`
        UPDATE stories SET acceptance_criteria = ${JSON.stringify(enrichedCriteria)}
         WHERE run_id = ${runId} AND story_index = 0
      `;
      await assert.rejects(
        loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CRITERIA_DRIFT/,
        "compiler-owned V3 criteria must reject unreceipted suffixes",
      );
      await database.sql`
        UPDATE stories SET acceptance_criteria = ${JSON.stringify(enrichedCriteria.slice(1))}
         WHERE run_id = ${runId} AND story_index = 0
      `;
      await assert.rejects(
        loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CRITERIA_DRIFT/,
      );
      await database.sql`
        UPDATE stories SET acceptance_criteria = ${JSON.stringify(storyCandidates[0]!.acceptanceCriteria)}
         WHERE run_id = ${runId} AND story_index = 0
      `;
      const unauthorizedStoryDbId = `unauthorized-story-${runId}`;
      await database.sql`
        INSERT INTO stories (
          id, run_id, story_index, story_id, title, description,
          acceptance_criteria, status, retry_count, max_retries,
          depends_on, scope_files, shared_files, scope_targets,
          requested_dependencies, shared_edit_requests, resolved_scope_files,
          scope_description, file_skeletons, implementation_contract,
          created_at, updated_at
        )
        SELECT ${unauthorizedStoryDbId}, run_id, 999, 'UNAUTHORIZED-001',
               'Unauthorized story', description, acceptance_criteria,
               'pending', 0, max_retries, depends_on, scope_files, shared_files,
               scope_targets, requested_dependencies, shared_edit_requests,
               resolved_scope_files, scope_description, file_skeletons,
               implementation_contract, NOW(), NOW()
          FROM stories
         WHERE run_id = ${runId} AND story_index = 0
      `;
      await assert.rejects(
        loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_IMMUTABLE_STORY_DRIFT/,
        "unreceipted story rows must be rejected before scheduling",
      );
      await database.sql`DELETE FROM stories WHERE id = ${unauthorizedStoryDbId}`;

      const downstreamContext = {
        ...committedContext,
        existing_code: "true",
        existing_code_hint: "A setup-owned mutable context field.",
        branch: "feature/atomic-story-test",
      };
      let committedContextJson = JSON.stringify(downstreamContext);
      await database.sql`
        UPDATE runs SET context = ${committedContextJson} WHERE id = ${runId}
      `;
      assert.equal(
        (await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId })).receiptHash,
        storyLedgerAuthority.receiptHash,
        "durable admission must ignore unrelated downstream context evolution",
      );
      const screenMapDrift = {
        ...downstreamContext,
        screen_map: JSON.stringify([{ screenId: "unauthorized", stories: [] }]),
      };
      await database.sql`
        UPDATE runs SET context = ${JSON.stringify(screenMapDrift)} WHERE id = ${runId}
      `;
      await assert.rejects(
        loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_SCREEN_MAP_DRIFT|COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_RECEIPT_DRIFT/,
      );
      await database.sql`
        UPDATE runs SET context = ${committedContextJson} WHERE id = ${runId}
      `;

      const driftedContext = JSON.parse(committedContextJson) as Record<string, string>;
      driftedContext["stories_english_admission_receipt_hash"] = "0".repeat(64);
      await database.sql`
        UPDATE runs SET context = ${JSON.stringify(driftedContext)} WHERE id = ${runId}
      `;
      await assert.rejects(
        loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CONTEXT_BINDING_INVALID/,
      );
      await database.sql`
        UPDATE runs SET context = ${committedContextJson} WHERE id = ${runId}
      `;

      const completionPlanRows = await database.sql<Array<{
        completion_plan: Record<string, unknown>;
        completion_plan_hash: string;
      }>>`
        SELECT completion_plan, completion_plan_hash
          FROM runtime_completion_requests
         WHERE request_id = ${managedStories.requestId}
      `;
      const originalCompletionPlan = completionPlanRows[0]!.completion_plan;
      const originalCompletionPlanHash = completionPlanRows[0]!.completion_plan_hash;
      const foreignCompletionPlan = {
        ...originalCompletionPlan,
        continuation: { type: "legacy_receipt_only" },
      };
      await assert.rejects(
        database.sql`
          UPDATE runtime_completion_requests
             SET completion_plan = ${database.sql.json(foreignCompletionPlan)},
                 completion_plan_hash = ${hashCanonicalJson(foreignCompletionPlan)}
           WHERE request_id = ${managedStories.requestId}
        `,
        /RUNTIME_COMPLETION_PLAN_IMMUTABLE/,
      );
      assert.equal(originalCompletionPlanHash, completionPlanRows[0]!.completion_plan_hash);
      await database.sql`
        UPDATE steps SET output = 'STATUS: done\nDRIFT: true' WHERE id = ${storyStepDbId}
      `;
      await assert.rejects(
        loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
        /COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_COMPLETION_BINDING_INVALID/,
      );
      await database.sql`
        UPDATE steps SET output = ${storyOutput} WHERE id = ${storyStepDbId}
      `;
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      await runtimeDb.pgClose();
      await database.cleanup();
      if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
      else process.env.SETFARM_PG_URL = previousPgUrl;
    }
  });
});
