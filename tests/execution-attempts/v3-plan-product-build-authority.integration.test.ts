import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import {
  inspectCompilerEnglishAdmissionLedgerAuthorityV1,
  loadCompilerEnglishAdmissionLedgerAuthorityV1,
} from "../../src/execution/compiler-english-admission-ledger-v1.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { resolveV3PlanOutputAuthorityV2 } from "../../src/execution/v3-plan-output-authority-v2.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { CompilerEnglishAdmissionReceiptV1Schema } from "../../src/product-compiler/schemas/compiler-english-admission-receipt-v1.js";
import { executeDesignPreclaimV2 } from "../../src/installer/steps/02-design/runtime-v2.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProductBuildProposalV1,
} from "../product-compiler/fixtures/product-semantics-v2.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const DRAIN_EVIDENCE = {
  schema: "setfarm.runtime-drain-evidence.v1" as const,
  observedAt: "2026-07-21T18:00:00.000Z",
  localProcessAbsent: true,
  openClawTaskAbsent: true,
  workspaceProcessAbsent: true,
  stableObservations: 2,
  evidenceRefs: ["setfarm://test/v3-plan-product-build-authority-drain"],
};

function block(kind: string, value: unknown): string {
  return `\`\`\`${kind}\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

test("atomic PLAN completion persists exact build and behavior authority", async () => {
  const stepOpsSource = fs.readFileSync("src/installer/step-ops.ts", "utf8");
  const candidateSnapshot = stepOpsSource.indexOf("const candidateContextSnapshot = await pgGet");
  const atomicSnapshotReuse = stepOpsSource.indexOf("const prevContextJson = candidateContextSnapshot", candidateSnapshot);
  const receiptCompilation = stepOpsSource.indexOf("compileCompilerEnglishAdmissionV1({", atomicSnapshotReuse);
  assert.ok(candidateSnapshot > 0 && atomicSnapshotReuse > candidateSnapshot && receiptCompilation > atomicSnapshotReuse);
  assert.match(
    stepOpsSource.slice(candidateSnapshot, receiptCompilation),
    /const prevContextJson = candidateContextSnapshot/,
  );
  assert.match(stepOpsSource.slice(atomicSnapshotReuse, receiptCompilation), /STEP_COMPLETION_RUN_CONTEXT_CAS_LOST/);
  assert.match(stepOpsSource.slice(atomicSnapshotReuse, receiptCompilation), /STEP_COMPLETION_CONTEXT_RESTORE_CAS_LOST/);
  const completionContextRegion = stepOpsSource.slice(atomicSnapshotReuse);
  assert.doesNotMatch(
    completionContextRegion,
    /pgRun\("UPDATE runs SET context = \$1, updated_at = \$2 WHERE id = \$3"/,
    "completion context publication must remain on the compare-and-swap helper",
  );
  const setupBuildContextRegion = completionContextRegion.slice(
    completionContextRegion.indexOf("// SETUP-BUILD APP.TSX SCAFFOLD BASELINE GUARDRAIL."),
    completionContextRegion.indexOf("let v3DeployReceipt"),
  );
  assert.ok(setupBuildContextRegion.length > 0);
  assert.doesNotMatch(
    setupBuildContextRegion,
    /updateRunContext\(step\.run_id, context\)/,
    "setup-build completion guardrails must keep the compare-and-swap snapshot current",
  );
  assert.match(
    completionContextRegion,
    /expectedRunContextJson: completionOwnedContextJson/,
    "phased story completion must compare-and-swap the context in its settlement transaction",
  );
  assert.match(
    completionContextRegion,
    /WHERE id = \$3\s+AND context = \$4\s+RETURNING id/,
    "legacy phased completion must compare-and-swap context inside its settlement transaction",
  );

  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const { buildPrompt } = await import("../../src/installer/steps/01-plan/module.js");
    const { onComplete: completeStories } = await import("../../src/installer/steps/03-stories/guards.js");
    const { completeStep } = await import("../../src/installer/step-ops.js");

    const runId = "run-v3-plan-product-build-authority";
    const stepDbId = "step-v3-plan-product-build-authority";
    const claimAgentId = "feature-dev_planner";
    const runtimeAgentId = "planner-runtime";
    const ownerInstanceId = "spawner-test-plan-product-build";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    const proposal = containedGamePlanProductBuildProposalV1();
    const rawPrd = block("plan-product-build-proposal-v1", proposal);
    const expected = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: { status: "done", prd: rawPrd },
    });
    assert.equal(expected.status, "proposal");
    if (expected.status !== "proposal"
      || expected.sourceTransport !== "product_build_proposal_v1") {
      throw new Error("atomic PLAN fixture did not compile");
    }
    const output = [
      "STATUS: done",
      "PLAN_SOURCE_TRANSPORT: forged_transport",
      `PLAN_SOURCE_PROPOSAL_HASH: ${"f".repeat(64)}`,
      "PLAN_OUTPUT_AUTHORITY_VERSION: semantic_only_v2",
      `PLAN_PRODUCT_BUILD_AUTHORITY_HASH: ${"e".repeat(64)}`,
      `PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_HASH: ${"c".repeat(64)}`,
      "PRODUCT_SEMANTICS_VERSION: v1",
      "PRODUCT_SPEC_SCHEMA: forged.product-spec.v0",
      "PRODUCT_PERSISTENCE_PROJECTION: {\"forged\":true}",
      `PRODUCT_PERSISTENCE_PROJECTION_HASH: ${"b".repeat(64)}`,
      "PRD:",
      rawPrd,
    ].join("\n");
    const instruction = buildPrompt({
      runId,
      task: CONTAINED_GAME_TASK,
      context: {
        task: CONTAINED_GAME_TASK,
        plan_protocol: "v3",
        product_semantics_version: "v2",
        v3_requirement_ledger: canonicalJsonStringify(
          extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK),
        ),
        v3_requested_stack_pack_id: "",
      },
    });

    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', ${CONTAINED_GAME_TASK}, 'running',
        ${JSON.stringify({
          task: CONTAINED_GAME_TASK,
          plan_protocol: "v3",
          product_semantics_version: "v2",
          plan_output_authority_version: "product_build_v1",
        })}, 'v3', ${releaseSha}, ${"a".repeat(64)}, ${releaseAdmissionHash}
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
        'step-v3-plan-product-build-design', ${runId}, 'design',
        'feature-dev_designer', 2, '', '', 'waiting', 'single', 0, 3
      )
    `;
    const claimRows = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${runId}, 'plan', NULL, ${claimAgentId})
      RETURNING id::integer AS id
    `;
    const claimId = claimRows[0]!.id;
    const sessions = createRuntimeSessionRepository(database.sql);
    const session = await sessions.reserve({
      sessionId: "RTS_v3-plan-product-build-0001",
      runId,
      stepDbId,
      workflowStepId: "plan",
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
      sessionKey: "v3-plan-product-build-session-key",
    });
    const envelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-21T17:59:00.000Z",
      stepId: stepDbId,
      workflowStepId: "plan",
      runId,
      claimId,
      claimAgentId,
      runtimeAgentId,
      input: instruction,
    };
    const requested = await requestRuntimeCompletion(database.sql, {
      envelope,
      output,
      requestId: "RCR_v3-plan-product-build-0001",
    });
    assert.equal(requested.status, "requested");
    if (requested.status !== "requested") throw new Error("runtime completion missing");
    const completions = createRuntimeCompletionRepository(database.sql);
    await completions.claim({ requestId: requested.request.requestId, ownerInstanceId });
    await sessions.markDrained({
      sessionId: session.sessionId,
      ownerInstanceId,
      evidence: DRAIN_EVIDENCE,
    });
    const processing = await completions.markProcessing({
      requestId: requested.request.requestId,
      ownerInstanceId,
    });
    if (!processing.ownerInstanceId || !processing.leaseExpiresAt) {
      throw new Error("test completion owner capability missing");
    }

    assert.deepEqual(await runWithRuntimeCompletionOwner({
      requestId: processing.requestId,
      ownerInstanceId: processing.ownerInstanceId,
      leaseExpiresAt: processing.leaseExpiresAt,
      ownerAttemptCount: processing.ownerAttemptCount,
    }, () => completeStep(stepDbId, output, envelope, {
      deferContinuationToEffectLedger: true,
    })), { advanced: false, runCompleted: false });

    const state = await database.sql<Array<{
      claim_outcome: string;
      plan_status: string;
      design_status: string;
      completion_phase: string;
      source_transport: string;
      source_proposal_hash: string;
      semantic_proposal_hash: string;
      output_authority_version: string;
      build_authority: string;
      build_authority_hash: string;
      behavior_proposal: string;
      behavior_proposal_hash: string;
      behavior_contract: string;
      behavior_contract_hash: string;
      semantics_version: string;
      product_spec_schema: string;
      persistence_projection: string;
      persistence_projection_hash: string;
      product_spec_hash: string;
      canonical_prd: string;
      english_receipt_hash: string;
      english_receipt: unknown;
    }>>`
      SELECT claim.outcome AS claim_outcome,
             plan.status AS plan_status,
             design.status AS design_status,
             completion.apply_phase AS completion_phase,
             run.context::jsonb ->> 'plan_source_transport' AS source_transport,
             run.context::jsonb ->> 'plan_source_proposal_hash' AS source_proposal_hash,
             run.context::jsonb ->> 'plan_semantic_proposal_hash' AS semantic_proposal_hash,
             run.context::jsonb ->> 'plan_output_authority_version' AS output_authority_version,
             run.context::jsonb ->> 'plan_product_build_authority' AS build_authority,
             run.context::jsonb ->> 'plan_product_build_authority_hash' AS build_authority_hash,
             run.context::jsonb ->> 'product_runtime_behavior_proposal' AS behavior_proposal,
             run.context::jsonb ->> 'product_runtime_behavior_proposal_hash' AS behavior_proposal_hash,
             run.context::jsonb ->> 'product_runtime_behavior_contract' AS behavior_contract,
             run.context::jsonb ->> 'product_runtime_behavior_contract_hash' AS behavior_contract_hash,
             run.context::jsonb ->> 'product_semantics_version' AS semantics_version,
             run.context::jsonb ->> 'product_spec_schema' AS product_spec_schema,
             run.context::jsonb ->> 'product_persistence_projection' AS persistence_projection,
             run.context::jsonb ->> 'product_persistence_projection_hash' AS persistence_projection_hash,
             run.context::jsonb ->> 'product_spec_hash' AS product_spec_hash,
             run.context::jsonb ->> 'prd' AS canonical_prd,
             run.context::jsonb ->> 'plan_english_admission_receipt_hash' AS english_receipt_hash,
             effect.payload::jsonb #> '{effect,compilerEnglishAdmissionReceipt}' AS english_receipt
        FROM runs run
        JOIN steps plan ON plan.id = ${stepDbId}
        JOIN steps design ON design.id = 'step-v3-plan-product-build-design'
        JOIN claim_log claim ON claim.id = ${claimId}
        JOIN runtime_completion_requests completion ON completion.claim_id = claim.id
        JOIN runtime_completion_effects effect ON effect.request_id = completion.request_id
       WHERE run.id = ${runId}
    `;
    assert.equal(state.length, 1);
    const row = state[0]!;
    assert.equal(row.claim_outcome, "completed");
    assert.equal(row.plan_status, "done");
    assert.equal(row.design_status, "waiting");
    assert.equal(row.completion_phase, "owner_committed");
    assert.equal(row.source_transport, "product_build_proposal_v1");
    assert.equal(row.source_proposal_hash, expected.sourceProposalHash);
    assert.equal(row.semantic_proposal_hash, expected.sourceSemanticProposalHash);
    assert.equal(row.output_authority_version, "product_build_v1");
    assert.equal(row.build_authority, expected.planProductBuildAuthorityCanonicalBytes);
    assert.equal(row.build_authority_hash, expected.planProductBuildAuthority.authorityHash);
    assert.equal(
      row.behavior_proposal,
      expected.runtimeBehaviorProposalCanonicalBytes,
    );
    assert.equal(
      row.behavior_proposal_hash,
      expected.runtimeBehaviorProposalHash,
    );
    assert.equal(row.behavior_contract, expected.runtimeBehaviorCanonicalBytes);
    assert.equal(row.behavior_contract_hash, expected.runtimeBehaviorContract.contractHash);
    assert.equal(row.semantics_version, "v2");
    assert.equal(row.product_spec_schema, "setfarm.product-spec.v2");
    assert.equal(
      row.persistence_projection,
      canonicalJsonStringify(expected.persistenceProjectionEvidence),
    );
    assert.equal(
      row.persistence_projection_hash,
      hashCanonicalJson(expected.persistenceProjectionEvidence),
    );
    assert.equal(row.product_spec_hash, hashCanonicalJson(expected.productSpec));
    const englishReceipt = CompilerEnglishAdmissionReceiptV1Schema.parse(row.english_receipt);
    assert.equal(englishReceipt.claimId, claimId);
    assert.equal(englishReceipt.runId, runId);
    assert.equal(englishReceipt.stepDbId, stepDbId);
    assert.equal(englishReceipt.productSpecHash, hashCanonicalJson(expected.productSpec));
    assert.equal(englishReceipt.sourceTaskHash, expected.productSpec.traceability.sourceTaskHash);
    assert.equal(englishReceipt.productionAuthority, false);
    assert.equal(row.english_receipt_hash, hashCanonicalJson(englishReceipt));
    assert.doesNotMatch(row.canonical_prd, /plan-product-build-proposal-v1/u);
    assert.match(row.canonical_prd, /```product-spec-v2/u);
    assert.doesNotMatch(row.canonical_prd, /product-runtime-behavior-contract-v1/u);
    assert.doesNotMatch(row.canonical_prd, /plan-product-build-authority-v1/u);
    assert.equal(
      JSON.parse(row.behavior_proposal).schema,
      "setfarm.product-runtime-behavior-proposal.v1",
    );
    assert.equal(
      JSON.parse(row.behavior_contract).schema,
      "setfarm.product-runtime-behavior-contract.v1",
    );
    assert.equal(
      JSON.parse(row.build_authority).schema,
      "setfarm.plan-product-build-authority.v1",
    );

    await assert.rejects(
      loadCompilerEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
      /COMPILER_ENGLISH_ADMISSION_LEDGER_OWNER_COUNT_INVALID:0/,
    );
    const effects = createRuntimeCompletionEffectRepository(database.sql);
    const effect = await effects.claimNext({
      requestId: requested.request.requestId,
      ownerInstanceId,
    });
    assert.ok(effect?.leaseToken);
    await effects.settle({
      requestId: requested.request.requestId,
      effectKey: effect.effectKey,
      ownerInstanceId,
      leaseToken: effect.leaseToken,
      resolution: "applied",
      result: { advanced: false, runCompleted: false },
      evidence: { source: "atomic-plan-English-admission-fixture" },
    });
    await completions.markEffectsCommitted({
      requestId: requested.request.requestId,
      ownerInstanceId,
      ownerAttemptCount: processing.ownerAttemptCount,
      result: { advanced: false, runCompleted: false },
    });
    await completions.acceptAndRelease({
      requestId: requested.request.requestId,
      ownerInstanceId,
      ownerAttemptCount: processing.ownerAttemptCount,
      result: { advanced: false, runCompleted: false },
    });
    const ledgerAuthority = await loadCompilerEnglishAdmissionLedgerAuthorityV1(
      database.sql,
      { runId },
    );
    assert.equal(
      hashCanonicalJson(inspectCompilerEnglishAdmissionLedgerAuthorityV1(ledgerAuthority)),
      row.english_receipt_hash,
    );
    assert.throws(
      () => inspectCompilerEnglishAdmissionLedgerAuthorityV1({ ...ledgerAuthority }),
      /COMPILER_ENGLISH_ADMISSION_LEDGER_AUTHORITY_UNAUTHENTICATED/,
    );
    await database.sql`
      UPDATE runs SET task = 'Drifted task bytes' WHERE id = ${runId}
    `;
    await assert.rejects(
      loadCompilerEnglishAdmissionLedgerAuthorityV1(database.sql, { runId }),
      /COMPILER_ENGLISH_ADMISSION_LEDGER_SOURCE_TASK_DRIFT/,
    );
    await database.sql`
      UPDATE runs SET task = ${CONTAINED_GAME_TASK} WHERE id = ${runId}
    `;
    let externalProjectOperationStarted = false;
    await assert.rejects(
      executeDesignPreclaimV2({
        sql: database.sql,
        repo: "/unused-design-authority-fixture",
        runId,
        prd: `${row.canonical_prd}\n`,
        originClaimId: claimId,
        ownerClaimId: claimId,
        ownerInstanceId: "design-English-admission-binding-test",
        producerReleaseSha: releaseSha,
        deviceType: "DESKTOP",
        englishAdmissionAuthority: ledgerAuthority,
      }, {
        ensureProject: async () => {
          externalProjectOperationStarted = true;
          throw new Error("unexpected external project operation");
        },
      }),
      /DESIGN_V2_ENGLISH_ADMISSION_BINDING_MISMATCH/,
    );
    assert.equal(externalProjectOperationStarted, false);

    const contextRows = await database.sql<Array<{ context: string }>>`
      SELECT context FROM runs WHERE id = ${runId}
    `;
    assert.equal(contextRows.length, 1);
    const originalContextJson = contextRows[0]!.context;
    const driftedContext = JSON.parse(originalContextJson) as Record<string, string>;
    driftedContext["plan_english_admission_receipt_hash"] = "0".repeat(64);
    await database.sql`
      UPDATE runs SET context = ${JSON.stringify(driftedContext)} WHERE id = ${runId}
    `;
    await database.sql`
      INSERT INTO stories (
        id, run_id, story_index, story_id, title, description,
        acceptance_criteria, status, retry_count, max_retries
      ) VALUES (
        'story-plan-ledger-retained', ${runId}, 0, 'US-RETAINED',
        'Retained story', 'Preserve this story when completion authority drifts.',
        ${JSON.stringify(["The retained story remains unchanged."])},
        'pending', 0, 5
      )
    `;
    await assert.rejects(
      completeStories({
        runId,
        stepId: "stories",
        parsed: { status: "done" },
        context: driftedContext,
        rawOutput: `STATUS: done\nSTORIES_JSON: ${JSON.stringify([{
          id: "US-NEW",
          title: "Unauthorized replacement",
          description: "This candidate must not reach publication.",
          acceptanceCriteria: ["Durable authority rejects the candidate."],
        }])}`,
      }),
      /COMPILER_ENGLISH_ADMISSION_LEDGER_RECEIPT_DRIFT/,
    );
    const storyRowsAfterDrift = await database.sql<Array<{ story_id: string }>>`
      SELECT story_id FROM stories WHERE run_id = ${runId} ORDER BY story_id
    `;
    assert.deepEqual(storyRowsAfterDrift.map((story) => story.story_id), ["US-RETAINED"]);
    await database.sql`
      UPDATE runs SET context = ${originalContextJson} WHERE id = ${runId}
    `;

    const observations = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM run_observations
       WHERE run_id = ${runId}
         AND check_id = 'product_compiler.product_spec_v2_canonicalized'
    `;
    assert.equal(observations[0]?.count, 0, "v3 PLAN must not publish success before owner settlement");
  } finally {
    if (runtimeDb) await runtimeDb.pgClose();
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
