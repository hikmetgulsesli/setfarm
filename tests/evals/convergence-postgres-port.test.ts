import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import {
  computeEvidenceBundleHash,
  computeObservationRef,
  createEvidenceBundleV2,
} from "../../src/evidence/evidence-bundle-v2.js";
import { createPostgresConvergencePort } from "../../src/evals/convergence-runner.js";
import { loadConvergenceSuite } from "../../src/evals/suite-schema.js";
import { TaskIntentOracleV2Schema } from "../../src/evals/task-intent-oracle-v2.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { bootstrapArtifactIndex } from "../../src/product-compiler/indexed-artifact-publisher.js";
import { createRuntimePacketCompiler } from "../../src/product-compiler/runtime-packet-compiler.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import { buildTaskIntentOracleFixture } from "./fixtures/task-intent-oracle-fixture.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "../execution-attempts/test-database.js";

describe("convergence PostgreSQL port", () => {
  let database: TestDatabase;
  const roots: string[] = [];
  const artifactLimits = {
    maxPayloadBytes: 4 * 1024 * 1024,
    rootQuotaBytes: 8 * 1024 * 1024,
    minFreeBytes: 0,
  };

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
    await database.cleanup();
  });

  it("reads a real migrated run without relying on mocked eval ports", async () => {
    const runId = "eval-postgres-read-run";
    await database.insertRun(runId);
    const port = createPostgresConvergencePort(database.sql);

    const read = await port.readRun(runId);

    assert.equal(read.runId, runId);
    assert.equal(read.protocol, "shadow");
    assert.equal(read.status, "running");
    assert.equal(read.terminal, false);
    assert.deepEqual(read.ownership, {
      openClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      activeRecoveryDeliveries: 0,
    });
  });

  it("reports product artifact readiness only after the exact inventory is bootstrapped", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-eval-preflight-artifacts-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const port = createPostgresConvergencePort(database.sql, { artifactRoot, artifactLimits });

    assert.equal((await port.inspectPlatform()).artifactIndexReady, false);

    await bootstrapArtifactIndex({
      index: createArtifactIndex(database.sql),
      store: new ContentAddressedArtifactStore(artifactRoot, { limits: artifactLimits }),
      quotaBytes: artifactLimits.rootQuotaBytes,
      maxPayloadBytes: artifactLimits.maxPayloadBytes,
    });

    assert.equal((await port.inspectPlatform()).artifactIndexReady, true);
  });

  it("accepts a compiler-owned typed rejection only with zero downstream product side effects", async () => {
    const runId = "eval-postgres-typed-rejection";
    const releaseSha = "e".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    const loaded = await loadConvergenceSuite(path.resolve("evals/suites/product-convergence-v1.json"));
    const evalCase = loaded.suite.cases.find((item) => item.caseId === "negative-ambiguous-product")!;
    const ledger = extractTaskRequirementLedgerV1(evalCase.task);
    const rejection = {
      schema: "setfarm.product-spec-rejection.v1",
      sourceTaskHash: ledger.sourceHash,
      reasons: [{
        code: "PRODUCT_SPEC_TASK_AMBIGUOUS",
        requirementRefs: ledger.requirements.map((requirement) => requirement.id),
        message: "The task deliberately withholds users, workflow, data, actions, and platform.",
      }],
    };
    const rejectionHash = hashCanonicalJson(rejection);
    const record = {
      schema: "setfarm.v3-plan-clarification-record.v1",
      disposition: "clarification_required",
      owner: "compiler",
      runId,
      stepDbId: "step-eval-negative-plan",
      claimId: 1,
      sourceTaskHash: ledger.sourceHash,
      rejectionHash,
      rejection,
      terminal: {
        outcome: "blocked",
        reasonCode: "product_spec_clarification_required",
        modelRedispatchBudget: 0,
      },
    };
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, context, protocol, protocol_version,
         compiler_release_sha, activation_preflight_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', $2, 'failed', '{}', 'v3', 1, $3, $4, $5)`,
      [runId, evalCase.task, releaseSha, "1".repeat(64), releaseAdmissionHash],
    );
    const claims = await database.sql.unsafe<Array<Record<string, unknown>>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, outcome, diagnostic)
       VALUES ($1, 'plan', NULL, 'feature-dev_planner', 'completed', 'typed clarification')
       RETURNING id`,
      [runId],
    );
    record.claimId = Number(claims[0]?.["id"]);
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, output, retry_count, max_retries, type
       ) VALUES ($1, $2, 'plan', 'feature-dev_planner', 1, '', '',
                 'failed', $3, 0, 3, 'single')`,
      [record.stepDbId, runId, JSON.stringify(record)],
    );
    await database.sql.unsafe(
      `INSERT INTO run_termination_requests (
         request_id, run_id, target_status, state, requested_by,
         requested_at, drained_at, terminalized_at, diagnostic, evidence
       ) VALUES ($1, $2, 'failed', 'terminalized',
                 'setfarm.product-compiler.plan-refusal', NOW(), NOW(), NOW(),
                 'typed clarification', $3::text::jsonb)`,
      [
        "TERM_eval-postgres-typed-rejection",
        runId,
        JSON.stringify({
          schema: "setfarm.v3-plan-clarification-termination.v1",
          terminalFailure: true,
          owner: "compiler",
          rejectionHash,
          sourceTaskHash: ledger.sourceHash,
          reasonCodes: ["PRODUCT_SPEC_TASK_AMBIGUOUS"],
          requirementRefs: ledger.requirements.map((requirement) => requirement.id),
          modelRedispatchBudget: 0,
          operationalFailureCause: {
            schema: "setfarm.operational-failure-cause.v1",
            workflowStepId: "plan",
            boundary: "product_compiler.plan_refusal",
            failureClass: "contract_invalid",
            failureCode: "V3_PLAN_CLARIFICATION_REQUIRED",
          },
        }),
      ],
    );
    const port = createPostgresConvergencePort(database.sql);
    const clean = await port.collectRun(runId, { task: evalCase.task, oracle: evalCase.oracle });
    assert.deepEqual(clean.canonical.invariantCodes, []);
    assert.equal(clean.canonical.oracle.actualDecision, "typed_rejection");
    assert.equal(clean.canonical.oracle.contractComplete, true);
    assert.equal(clean.canonical.oracle.decisionEvidenceVerified, true);
    assert.equal(clean.canonical.packet.packetRows, 0);
    assert.equal(clean.canonical.acceptance.candidates, 0);
    assert.equal(clean.pullRequests.length, 0);
    assert.equal(clean.operationalFailureCause, null);
    assert.equal(clean.scopedFailure, null);

    await database.sql.unsafe(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, outcome, diagnostic)
       VALUES ($1, 'plan', NULL, 'feature-dev_planner', 'completed', 'forbidden redispatch')`,
      [runId],
    );
    const redispatched = await port.collectRun(runId, { task: evalCase.task, oracle: evalCase.oracle });
    assert.ok(redispatched.canonical.invariantCodes.includes("EVAL_TYPED_REJECTION_REDISPATCH_DETECTED"));

    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, status, pr_url, merge_status
       ) VALUES ($1, $2, 1, 'US-001', 'Forbidden downstream story', 'done',
                 'https://github.com/example/forbidden/pull/1', 'merged')`,
      ["story-eval-negative-side-effect", runId],
    );
    const polluted = await port.collectRun(runId, { task: evalCase.task, oracle: evalCase.oracle });
    assert.ok(polluted.canonical.invariantCodes.includes("EVAL_TYPED_REJECTION_DOWNSTREAM_SIDE_EFFECT"));
    assert.equal(polluted.pullRequests.length, 1);
    assert.equal(polluted.operationalFailureCause, null);
    assert.equal(polluted.scopedFailure, null);
  });

  it("binds the #2047 two-code rejection to exact per-reason requirements in v2 canonical evidence", async () => {
    const runId = "eval-postgres-2047-two-code";
    const releaseSha = "f".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    const task = "Build a polished experience but leave its users and workflow deliberately unspecified. Also require a native kernel driver that this product compiler does not support.";
    const ledger = extractTaskRequirementLedgerV1(task);
    const oracle = TaskIntentOracleV2Schema.parse({
      schema: "setfarm.task-intent-oracle.v2",
      oracleId: "issue-2047-two-code",
      oracleVersion: 2,
      locale: "en",
      cohort: "negative",
      variant: "unsupported",
      expectedDecision: {
        kind: "typed_rejection",
        requiredReasonCodes: [
          "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
          "PRODUCT_SPEC_TASK_AMBIGUOUS",
        ],
        allowedReasonCodes: [
          "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
          "PRODUCT_SPEC_TASK_AMBIGUOUS",
        ],
        reasonRequirements: [
          { reasonCode: "PRODUCT_SPEC_TASK_AMBIGUOUS", clauseRefs: ["ambiguous-product"] },
          { reasonCode: "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED", clauseRefs: ["unsupported-kernel"] },
        ],
      },
      clauses: ledger.requirements.map((requirement, index) => ({
        clauseId: index === 0 ? "ambiguous-product" : "unsupported-kernel",
        source: {
          startOffset: requirement.sources[0]!.span.startOffset,
          endOffset: requirement.sources[0]!.span.endOffset,
          normalizedClause: requirement.normalizedClause,
        },
        requiredSemanticKinds: [],
      })),
      expectations: [],
    });
    const rejection = {
      schema: "setfarm.product-spec-rejection.v1",
      sourceTaskHash: ledger.sourceHash,
      reasons: [
        {
          code: "PRODUCT_SPEC_TASK_AMBIGUOUS",
          requirementRefs: [ledger.requirements[0]!.id],
          message: "The primary product semantics are deliberately ambiguous.",
        },
        {
          code: "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
          requirementRefs: [ledger.requirements[1]!.id],
          message: "A native kernel driver is outside the activated compiler semantics.",
        },
      ],
    };
    const rejectionHash = hashCanonicalJson(rejection);
    const record = {
      schema: "setfarm.v3-plan-clarification-record.v1",
      disposition: "clarification_required",
      owner: "compiler",
      runId,
      stepDbId: "step-eval-2047-plan",
      claimId: 1,
      sourceTaskHash: ledger.sourceHash,
      rejectionHash,
      rejection,
      terminal: {
        outcome: "blocked",
        reasonCode: "product_spec_clarification_required",
        modelRedispatchBudget: 0,
      },
    };
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, context, protocol, protocol_version,
         compiler_release_sha, activation_preflight_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', $2, 'failed', '{}', 'v3', 1, $3, $4, $5)`,
      [runId, task, releaseSha, "2".repeat(64), releaseAdmissionHash],
    );
    const claims = await database.sql.unsafe<Array<Record<string, unknown>>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, outcome, diagnostic)
       VALUES ($1, 'plan', NULL, 'feature-dev_planner', 'completed', 'typed two-code clarification')
       RETURNING id`,
      [runId],
    );
    record.claimId = Number(claims[0]?.["id"]);
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, output, retry_count, max_retries, type
       ) VALUES ($1, $2, 'plan', 'feature-dev_planner', 1, '', '',
                 'failed', $3, 0, 3, 'single')`,
      [record.stepDbId, runId, JSON.stringify(record)],
    );
    await database.sql.unsafe(
      `INSERT INTO run_termination_requests (
         request_id, run_id, target_status, state, requested_by,
         requested_at, drained_at, terminalized_at, diagnostic, evidence
       ) VALUES ($1, $2, 'failed', 'terminalized',
                 'setfarm.product-compiler.plan-refusal', NOW(), NOW(), NOW(),
                 'typed two-code clarification', $3::text::jsonb)`,
      [
        "TERM_eval-postgres-2047-two-code",
        runId,
        JSON.stringify({
          schema: "setfarm.v3-plan-clarification-termination.v1",
          terminalFailure: true,
          owner: "compiler",
          rejectionHash,
          sourceTaskHash: ledger.sourceHash,
          reasonCodes: [
            "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
            "PRODUCT_SPEC_TASK_AMBIGUOUS",
          ],
          requirementRefs: ledger.requirements.map((requirement) => requirement.id),
          modelRedispatchBudget: 0,
          operationalFailureCause: {
            schema: "setfarm.operational-failure-cause.v1",
            workflowStepId: "plan",
            boundary: "product_compiler.plan_refusal",
            failureClass: "contract_invalid",
            failureCode: "V3_PLAN_CLARIFICATION_REQUIRED",
          },
        }),
      ],
    );

    const collected = await createPostgresConvergencePort(database.sql).collectRun(runId, { task, oracle });
    assert.equal(collected.canonical.oracle.schema, "setfarm.task-intent-oracle-evaluation.v2");
    assert.deepEqual(collected.canonical.invariantCodes, []);
    assert.equal(collected.canonical.oracle.contractComplete, true);
    assert.equal(collected.canonical.oracle.decisionEvidenceVerified, true);
    assert.deepEqual(collected.canonical.oracle.rejectionContract?.actualReasonCodes, [
      "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
      "PRODUCT_SPEC_TASK_AMBIGUOUS",
    ]);
    assert.deepEqual(collected.canonical.oracle.rejectionContract?.actualReasonRequirements, [
      {
        reasonCode: "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
        requirementRefs: [ledger.requirements[1]!.id],
      },
      {
        reasonCode: "PRODUCT_SPEC_TASK_AMBIGUOUS",
        requirementRefs: [ledger.requirements[0]!.id],
      },
    ]);
  });

  it("selects canonical evidence against each story attempt instead of the last global tree", async () => {
    const runId = "eval-postgres-multi-story";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-eval-postgres-cas-"));
    roots.push(root);
    const artifactRoot = path.join(root, "sha256");
    const intent = buildTaskIntentOracleFixture(runId);
    const store = new ContentAddressedArtifactStore(artifactRoot, { limits: artifactLimits });
    await bootstrapArtifactIndex({
      index: createArtifactIndex(database.sql),
      store,
      quotaBytes: artifactLimits.rootQuotaBytes,
      maxPayloadBytes: artifactLimits.maxPayloadBytes,
    });
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, context, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, 'feature-dev', $2, 'running', '{}',
                 'v3', 1, $3, NULL, $4, $5)`,
      [runId, intent.task, releaseSha, "9".repeat(64), releaseAdmissionHash],
    );
    const compilation = await createRuntimePacketCompiler({
      sql: database.sql,
      artifactRoot,
      artifactLimits,
      ownerInstanceId: "eval-postgres-test",
    }).compile({
      runId,
      expectedMode: "v3",
      ...intent.contracts,
      compiler: { version: "3.0.0", codeSha: releaseSha },
      producer: { pass: "eval-postgres-test", codeSha: releaseSha, toolVersions: {} },
    });
    assert.equal(compilation.activation, "activated");
    assert.equal(compilation.compilation.status, "sealed");
    const packetHash = compilation.compilation.packetHash!;
    const reportHash = compilation.compilation.reportHash;
    await database.sql.unsafe("UPDATE runs SET status = 'completed' WHERE id = $1", [runId]);

    const stories = [
      {
        storyId: "US-001",
        attemptId: "ATT_00000000-0000-0000-0000-000000000101",
        sliceHash: "2".repeat(64),
        sourceSha: "3".repeat(40),
        sourceTreeHash: "4".repeat(40),
        predicateRef: "EVID_STORY_ONE",
      },
      {
        storyId: "US-002",
        attemptId: "ATT_00000000-0000-0000-0000-000000000102",
        sliceHash: "6".repeat(64),
        sourceSha: "7".repeat(40),
        sourceTreeHash: "8".repeat(40),
        predicateRef: "EVID_STORY_TWO",
      },
    ] as const;
    for (const [index, story] of stories.entries()) {
      await database.sql.unsafe(
        `INSERT INTO execution_attempts (
           attempt_id, run_id, step_id, story_id, generation, fence_token,
           attempt_class, packet_hash, compilation_report_hash, slice_hash,
           source_before_sha, source_before_tree_hash, source_after_sha,
           source_after_tree_hash, role, agent_id, lease_acquired_at,
           lease_expires_at, heartbeat_at, disposition, evidence_refs,
           created_at, updated_at
         ) VALUES (
           $1, $2, 'implement-step', $3, 1, $4, 'product_implementation',
           $5, $6, $7, $8, $9, $8, $9, 'developer', 'feature-dev_developer',
           $10, $11, $11, 'produced_delta', '[]', $10, $11
         )`,
        [
          story.attemptId,
          runId,
          story.storyId,
          `${index + 1}`.repeat(64),
          packetHash,
          reportHash,
          story.sliceHash,
          story.sourceSha,
          story.sourceTreeHash,
          new Date(`2026-07-13T12:0${index}:00.000Z`),
          new Date(`2026-07-13T12:0${index}:30.000Z`),
        ],
      );
      const startedAt = `2026-07-13T12:0${index}:31.000Z`;
      const completedAt = `2026-07-13T12:0${index}:40.000Z`;
      const artifactHash = hashCanonicalJson({ storyId: story.storyId, result: "pass" });
      const observation = {
        kind: "command" as const,
        owner: "setfarm-orchestrator" as const,
        startedAt,
        completedAt,
        commandRef: "CMD_TEST",
        exitCode: 0,
        stdoutArtifactHash: artifactHash,
      };
      const bundle = createEvidenceBundleV2({
        runId,
        storyId: story.storyId,
        packetHash,
        sliceHash: story.sliceHash,
        sourceRevision: { sha: story.sourceSha, treeHash: story.sourceTreeHash },
        attemptId: story.attemptId,
        predicates: [{
          predicateRef: story.predicateRef,
          invariantRef: "INV_STATE_TRANSITION",
          required: true,
          verdict: "pass",
          observationRefs: [computeObservationRef(observation)],
        }],
        observations: [observation],
        artifacts: [{
          hash: artifactHash,
          mediaType: "text/plain",
          locator: `evidence/${story.storyId}.txt`,
        }],
        runner: {
          id: "eval-postgres-test",
          version: "1.0.0",
          environmentHash: "a".repeat(64),
        },
        startedAt,
        completedAt,
      });
      const evidenceHash = computeEvidenceBundleHash(bundle);
      await database.sql.unsafe(
        `INSERT INTO evidence_bundles (
           evidence_bundle_hash, evidence_id, run_id, story_id, packet_hash,
           slice_hash, source_sha, source_tree_hash, attempt_id,
           aggregate_verdict, payload, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pass', $10::text::jsonb, $11)`,
        [
          evidenceHash,
          bundle.evidenceId,
          runId,
          story.storyId,
          packetHash,
          story.sliceHash,
          story.sourceSha,
          story.sourceTreeHash,
          story.attemptId,
          JSON.stringify(bundle),
          new Date(completedAt),
        ],
      );
    }

    const collected = await createPostgresConvergencePort(database.sql, {
      artifactRoot,
      artifactLimits,
    }).collectRun(runId, {
      task: intent.task,
      oracle: intent.oracle,
    });

    assert.equal(collected.canonical.evidence.bundles, 2);
    assert.equal(collected.canonical.evidence.passing, 2);
    assert.equal(collected.canonical.evidence.missingAttemptEvidence, 0);
    assert.equal(collected.canonical.evidence.missingExpectedPredicates, 2);
    assert.equal(collected.canonical.evidence.unexpectedProductPredicates, 2);
    assert.equal(collected.canonical.packet.casDeepVerified, true);
    assert.equal(collected.canonical.packet.sealedStackPackId, "vite-react-web-app");
    assert.ok(collected.canonical.invariantCodes.includes("EVAL_ATTEMPT_OWNERSHIP_INVALID"));
    assert.ok(collected.canonical.invariantCodes.includes("EVAL_EVIDENCE_LEDGER_INCOMPLETE"));
    assert.ok(collected.canonical.invariantCodes.includes("EVAL_ACCEPTED_CANDIDATE_INVALID"));
    assert.ok(collected.canonical.invariantCodes.includes("EVAL_TASK_INTENT_ORACLE_MISMATCH"));

    await database.sql.unsafe(
      `INSERT INTO evidence_bundles (
         evidence_bundle_hash, evidence_id, run_id, story_id, packet_hash,
         slice_hash, source_sha, source_tree_hash, attempt_id,
         aggregate_verdict, payload, created_at
       ) SELECT $1, evidence_id, run_id, story_id, packet_hash,
                slice_hash, source_sha, source_tree_hash, attempt_id,
                aggregate_verdict, payload, created_at + INTERVAL '1 second'
           FROM evidence_bundles
          WHERE run_id = $2 AND story_id = 'US-002'
          ORDER BY created_at DESC LIMIT 1`,
      ["9".repeat(64), runId],
    );
    const forged = await createPostgresConvergencePort(database.sql, {
      artifactRoot,
      artifactLimits,
    }).collectRun(runId, {
      task: intent.task,
      oracle: intent.oracle,
    });
    assert.equal(forged.canonical.evidence.invalidBindings, 1);
    assert.ok(forged.canonical.invariantCodes.includes("EVAL_EVIDENCE_LEDGER_INCOMPLETE"));

    await writeFile(store.pathFor(packetHash), "{}\n", "utf8");
    const corruptedCas = await createPostgresConvergencePort(database.sql, {
      artifactRoot,
      artifactLimits,
    }).collectRun(runId, {
      task: intent.task,
      oracle: intent.oracle,
    });
    assert.equal(corruptedCas.canonical.packet.casDeepVerified, false);
    assert.ok(corruptedCas.canonical.invariantCodes.includes("EVAL_PACKET_CAS_AUDIT_FAILED"));

    const operationalFailureCause = {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: "setup-build",
      boundary: "stitch.converter.generated_tsx",
      failureClass: "generated_artifact_invalid",
      failureCode: "V3_OBSERVABLE_REF_INVALID",
    } as const;
    await database.sql.unsafe("UPDATE runs SET status = 'failed' WHERE id = $1", [runId]);
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, type
       ) VALUES ($1, $2, 'setup-build', 'feature-dev_builder', 99, '', '',
                 'failed', 'single')`,
      ["step-eval-postgres-cause-setup", runId],
    );
    await database.sql.unsafe(
      `INSERT INTO run_termination_requests (
         request_id, run_id, target_status, state, requested_by,
         requested_at, drained_at, terminalized_at, diagnostic, evidence
       ) VALUES ($1, $2, 'failed', 'terminalized', 'setfarm.step-fail.single',
                 NOW(), NOW(), NOW(), 'typed converter failure', $3::text::jsonb)`,
      [
        "RTR_eval-postgres-cause01",
        runId,
        JSON.stringify({ operationalFailureCause }),
      ],
    );
    await database.sql.unsafe(
      `INSERT INTO run_observations (
         id, run_id, step_id, story_id, phase, check_id, label, status,
         evidence, event_type, created_at, updated_at
       ) VALUES
         ($1, $2, 'setup-build', '', 'building', 'setup-build.converter',
          'Converter failed', 'fail', '{}', 'setup-build.converter.failed', NOW(), NOW()),
         ($3, $2, 'run', '', 'operations', 'run.failed',
          'Run failed', 'fail', '{}', 'run.failed', NOW() + INTERVAL '1 second', NOW() + INTERVAL '1 second')`,
      ["OBS_eval-postgres-cause-step", runId, "OBS_eval-postgres-cause-run"],
    );
    const attributed = await createPostgresConvergencePort(database.sql, {
      artifactRoot,
      artifactLimits,
    }).collectRun(runId, {
      task: intent.task,
      oracle: intent.oracle,
    });
    assert.deepEqual(attributed.operationalFailureCause, operationalFailureCause);
    assert.deepEqual(attributed.scopedFailure, {
      workflowStepId: "setup-build",
      phase: "building",
      kind: "step",
    });

    await assert.rejects(
      database.sql.unsafe(
        "UPDATE run_termination_requests SET requested_by = 'untrusted-writer' WHERE run_id = $1",
        [runId],
      ),
      /SETFARM_RUN_TERMINATION_REQUESTED_BY_IMMUTABLE/,
    );
    const sealed = await createPostgresConvergencePort(database.sql, {
      artifactRoot,
      artifactLimits,
    }).collectRun(runId, { task: intent.task, oracle: intent.oracle });
    assert.deepEqual(sealed.operationalFailureCause, operationalFailureCause);
  });
});
