import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { applyContractSpineMigrationsIfNeeded, planContractSpineMigrations, verifyContractSpineMigrations } from "../../src/db/contract-spine-migrations.js";
import { type ConvergenceJobControlV1, type ConvergenceRunnerPorts, type ConvergenceRunCollection, createPostgresConvergencePort, runConvergenceSuite } from "../../src/evals/convergence-runner.js";
import { loadConvergenceSuite, ProductConvergenceSuiteV1Schema } from "../../src/evals/suite-schema.js";
import { createOperationalOutboxRepository } from "../../src/execution/operational-outbox-repository.js";
import { createOperationalOutboxPublisher } from "../../src/execution/operational-outbox-publisher.js";
import { createOperationalEventDeliveryRepository, type OperationalEventDelivery } from "../../src/execution/operational-event-delivery-repository.js";
import { createOperationalEventDeliveryConsumer } from "../../src/execution/operational-event-delivery-consumer.js";
import { CanonicalOperationalEventV1Schema } from "../../src/execution/schemas/operational-event-v1.js";
import { RuntimeCompletionEffectInputV1Schema } from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { createArtifactInventoryStoreV1 } from "../../src/product-compiler/artifact-inventory-store.js";
import { bootstrapArtifactIndex } from "../../src/product-compiler/indexed-artifact-publisher.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { canonicalizeProductSpecRejectionV1 } from "../../src/product-compiler/producers/plan-product-spec-proposal.js";
import { resolveArtifactStorePublicationAuthorityMode, resolveProductArtifactCapacity } from "../../src/runtime-config.js";
import { buildRunOperationalSnapshot } from "../../src/server/run-operational-snapshot.js";
import { computeRunOperationalSnapshotHashV3, RunOperationalSnapshotV3Schema, type RunOperationalSnapshotV3 } from "../../src/server/schemas/run-operational-snapshot-v3.js";
import { after, before, test } from "node:test";

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
import { assertFreshInstallationSelectionUnchangedV1, freshInstallationSelectionV1 } from "../../src/installation/fresh-installation-selection-v1.js";
import { createIsolatedTestDatabase } from "./test-database.js";


// ESM dependencies load before these hooks. Root's unchanged eager-import
// no-log/no-event-write audit remains an execution prerequisite. Runtime error
// paths resolve logger/events from this marker for the entire admitted file.
const previousLogEventDbPath = process.env.SETFARM_DB_PATH;
let ownedLogEventRoot: string | undefined;
before(async () => {
  // Never serialize the credential-bearing captured selection in an assertion.
  assert.equal(freshInstallationSelectionV1 === null, true, "isolated whole-file tests require no captured fresh installation");
  assertFreshInstallationSelectionUnchangedV1();
  ownedLogEventRoot = await mkdtemp(path.join(tmpdir(), "setfarm-task3-refusal-log-events-"));
  process.env.SETFARM_DB_PATH = path.join(ownedLogEventRoot, "setfarm.db");
});
after(async () => {
  // All test finally blocks (owned pools/DB/effects/artifacts) and afterEach
  // hooks finish before this file-level teardown restores public config.
  try {
    if (ownedLogEventRoot) {
      assert.equal(process.env.SETFARM_DB_PATH === path.join(ownedLogEventRoot, "setfarm.db"), true,
        "whole-file log/event containment must survive owned fixture cleanup");
      assertFreshInstallationSelectionUnchangedV1();
    }
  } finally {
    if (previousLogEventDbPath === undefined) delete process.env.SETFARM_DB_PATH;
    else process.env.SETFARM_DB_PATH = previousLogEventDbPath;
    if (ownedLogEventRoot) await rm(ownedLogEventRoot, { recursive: true, force: true });
  }
});

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


type OwnedDatabase = Awaited<ReturnType<typeof createIsolatedTestDatabase>>;
type MaintainedSuite = Awaited<ReturnType<typeof loadConvergenceSuite>>;
type MaintainedCase = MaintainedSuite["suite"]["cases"][number];

for (const [caseId, reasonCode] of [
  ["negative-ambiguous-product", "PRODUCT_SPEC_TASK_AMBIGUOUS"],
  ["negative-unsupported-kernel", "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED"],
] as const) test(`owned V2 bare refusal ${caseId}: actual completion, producer and SQL collector; partial fixture suite stays no_go`, async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  let artifactRoot: string | undefined;
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const loaded = await loadConvergenceSuite(path.resolve("evals/suites/product-convergence-codex-v1.json"));
    const selected = loaded.suite.cases.find(item => item.caseId === caseId)!;
    assert.equal(selected.oracle.expectedDecision.kind, "typed_rejection");
    const TASK = selected.task;
    const runId = `run-v3-plan-refusal-${caseId}`;
    const stepDbId = `${runId}-plan`;
    const designDbId = `${runId}-design`;
    const claimAgentId = "feature-dev_planner";
    const runtimeAgentId = "planner-runtime";
    const identity = await database.sql`SELECT current_database() AS database, current_user AS role`;
    const singletonIdentity = await runtimeDb.getSql()`SELECT current_database() AS database, current_user AS role`;
    const expectedIdentity = { database: database.database, role: decodeURIComponent(new URL(database.url).username) };
    assert.deepEqual({ ...identity[0] }, expectedIdentity);
    assert.deepEqual({ ...singletonIdentity[0] }, expectedIdentity);
    // The factory has authenticated P3's projection. This is an additional
    // bounded read-only Git child, never a source/main release substitution.
    const releaseSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(), encoding: "utf8", timeout: 10_000, maxBuffer: 1024,
    }).trim();
    assert.match(releaseSha, /^[a-f0-9]{40}$/);
    await attestCurrentOwnedClone(database, releaseSha);
    await assertActualRenderedPlanTemplates(runId, TASK);
    artifactRoot = await mkdtemp(path.join(tmpdir(), `v3-plan-refusal-${caseId}-`));
    const artifactLimits = resolveProductArtifactCapacity();
    const publicationAuthorityMode = resolveArtifactStorePublicationAuthorityMode();
    const ownedOptions = { artifactRoot, artifactLimits, publicationAuthorityMode };
    const inventory = createArtifactInventoryStoreV1({ sql: database.sql, ...ownedOptions, purpose: "inventory-adoption" });
    assert.equal(inventory.publicationAuthority, publicationAuthorityMode);
    assert.deepEqual(inventory.store.limits, artifactLimits);
    const bootstrap = await bootstrapArtifactIndex({ index: createArtifactIndex(database.sql), store: inventory.store,
      quotaBytes: artifactLimits.rootQuotaBytes, maxPayloadBytes: artifactLimits.maxPayloadBytes });
    assert.equal(bootstrap.inventory.status, "verified");
    assert.equal(bootstrap.inventory.finalEntryCount, 0);
    assert.deepEqual(bootstrap.artifacts, []);
    assert.equal(bootstrap.capacity.state, "ready");
    assert.equal(bootstrap.capacity.totalBytes, 0);
    assert.equal(bootstrap.capacity.reservedBytes, 0);
    const artifactRows = await database.sql`
      SELECT (SELECT COUNT(*)::integer FROM semantic_artifacts) AS artifacts,
        (SELECT COUNT(*)::integer FROM artifact_publication_reservations) AS reservations,
        (SELECT COUNT(*)::integer FROM artifact_publication_batches) AS batches`;
    assert.deepEqual({ ...artifactRows[0] }, { artifacts: 0, reservations: 0, batches: 0 });
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    const ledger = extractTaskRequirementLedgerV1(TASK);
    const rejection = {
      schema: "setfarm.product-spec-rejection.v1" as const,
      sourceTaskHash: ledger.sourceHash,
      reasons: [{
        code: reasonCode,
        requirementRefs: ledger.requirements.map((requirement) => requirement.id),
        message: reasonCode === "PRODUCT_SPEC_TASK_AMBIGUOUS"
          ? "The exact task leaves the incompatible personal-journal and shared-team workflows undecided."
          : "The requested signed kernel-mode hardware driver is outside the activated product classes.",
      }],
    };
    const output = [
      "STATUS: done",
      "```product-spec-rejection-v1",
      JSON.stringify(rejection, null, 2),
      "```",
    ].join("\n");

    await database.sql.begin((transaction) => persistWorkflowRunInTransaction(
      transaction as PgTransactionSql,
      {
        run: {
          id: runId,
          runNumber: caseId === "negative-ambiguous-product" ? 8702 : 8703,
          workflowId: "feature-dev",
          task: TASK,
          context: JSON.stringify({ task: TASK, plan_protocol: "v3", product_semantics_version: "v2", plan_output_authority_version: "product_build_v1" }),
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
          { id: designDbId, stepId: "design", agentId: "feature-dev_designer", stepIndex: 2, inputTemplate: "", expects: "", status: "waiting", maxRetries: 3, type: "single", loopConfig: null },
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
      sessionId: `RTS_${caseId}`,
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
      sessionKey: `fixture-session/${caseId}`,
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
      requestId: `RCR_${caseId}`,
    });
    assert.equal(requested.status, "requested");
    if (requested.status !== "requested") throw new Error("runtime completion missing");
    assert.equal(requested.request.output, output);
    assert.equal(requested.request.outputHash, createHash("sha256").update(output, "utf8").digest("hex"));
    assert.equal(output.includes("PRD:"), false);
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
        JOIN steps design ON design.id = ${designDbId}
        JOIN runs run ON run.id = cl.run_id
        JOIN runtime_completion_requests completion ON completion.claim_id = cl.id
        JOIN run_termination_requests termination ON termination.run_id = run.id
       WHERE cl.id = ${claimId}
    `;
    assert.equal(ownerState.length, 1);
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
    const canonicalRejection = canonicalizeProductSpecRejectionV1({ task: TASK, rejection });
    assert.deepEqual(record, {
      schema: "setfarm.v3-plan-clarification-record.v1", disposition: "clarification_required", owner: "compiler",
      runId, stepDbId, claimId, sourceTaskHash: ledger.sourceHash,
      rejectionHash: hashCanonicalJson(canonicalRejection), rejection: canonicalRejection,
      terminal: { outcome: "blocked", reasonCode: "product_spec_clarification_required", modelRedispatchBudget: 0 },
    });
    assert.equal(owner.termination_evidence.rejectionHash, record.rejectionHash);
    assert.equal(owner.termination_evidence.sourceTaskHash, record.sourceTaskHash);
    assert.equal(owner.plan_output, canonicalJsonStringify(record));
    await assertNoDownstream(database, runId, claimId);
    const exactCounts = await database.sql`
      SELECT (SELECT COUNT(*)::integer FROM steps WHERE run_id=${runId} AND step_id='plan') AS plans,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id=${runId} AND step_id='plan' AND outcome='completed') AS claims,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id=${runId}) AS terminations,
             (SELECT COUNT(*)::integer FROM runtime_completion_effects WHERE request_id=${requested.request.requestId}) AS effects`;
    assert.deepEqual({ ...exactCounts[0] }, { plans: 1, claims: 1, terminations: 1, effects: 1 });

    const effects = createRuntimeCompletionEffectRepository(database.sql);
    const effect = await effects.claimNext({
      requestId: requested.request.requestId,
      ownerInstanceId: "spawner-test",
    });
    assert.equal(effect?.effectType, "v3.plan.clarification.recorded");
    if (!effect?.leaseToken) throw new Error("plan refusal effect missing");
    assert.equal(effect.requestId, requested.request.requestId);
    assert.equal(effect.mandatory, true);
    const effectInput = RuntimeCompletionEffectInputV1Schema.parse(effect.payload);
    const committedRequest = await completions.findById(requested.request.requestId);
    if (!committedRequest?.completionPlan || !committedRequest.completionPlanHash) {
      throw new Error("committed plan refusal completion plan missing");
    }
    assert.equal(committedRequest.applyPhase, "owner_committed");
    assert.equal(effect.inputHash, hashCanonicalJson(effectInput));
    assert.equal(effectInput.planHash, committedRequest.completionPlanHash);
    assert.equal(effectInput.planHash, hashCanonicalJson(effectInput.plan));
    assert.deepEqual(effectInput.plan, committedRequest.completionPlan);
    assert.equal(effectInput.plan.requestId, requested.request.requestId);
    assert.equal(effectInput.plan.claimId, claimId);
    assert.equal(effectInput.plan.runId, runId);
    assert.equal(effectInput.plan.stepDbId, stepDbId);
    assert.equal(effectInput.plan.workflowStepId, "plan");
    assert.equal(effectInput.plan.outputHash, requested.request.outputHash);
    assert.equal(effectInput.plan.outputHash, committedRequest.outputHash);
    assert.equal(effectInput.plan.kind, "single_failure");
    assert.deepEqual(effectInput.plan.continuation, { type: "failure_finalize" });
    assert.equal(effectInput.plan.subject, undefined);
    const compilerEffect = {
      schema: "setfarm.v3-plan-clarification-effect.v1",
      owner: "compiler",
      rejectionHash: record.rejectionHash,
      sourceTaskHash: ledger.sourceHash,
      reasonCodes: [...new Set(canonicalRejection.reasons.map(reason => reason.code))].sort(),
      requirementRefs: [...new Set(canonicalRejection.reasons.flatMap(reason => reason.requirementRefs))].sort(),
      modelRedispatchBudget: 0,
    };
    assert.deepEqual(effectInput.effect, compilerEffect);
    assert.equal(effect.effectKey, "continuation/failure_finalize/failure_finalize");
    assert.equal(effect.ordinal, 0);
    assert.deepEqual(effectInput.plan.effects, [{ effectKey: effect.effectKey, ordinal: 0,
      effectType: "v3.plan.clarification.recorded", mandatory: true, payload: compilerEffect }]);
    await effects.settle({
      requestId: requested.request.requestId,
      effectKey: effect.effectKey,
      ownerInstanceId: "spawner-test",
      leaseToken: effect.leaseToken,
      resolution: "reconciled",
      result: { advanced: false, runCompleted: false },
      evidence: { source: "canonical-plan-refusal-owner", runId, stepDbId, claimId, recordHash: hashCanonicalJson(record), rejectionHash: record.rejectionHash },
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
    assert.equal((await terminations.findById(termination.requestId))!.state, "terminalized");
    const exactTermination = await database.sql`
      SELECT request_id, requested_by, target_status, state, evidence FROM run_termination_requests WHERE run_id=${runId}`;
    assert.equal(exactTermination.length, 1);
    assert.equal(exactTermination[0]!.request_id, termination.requestId);
    assert.equal(exactTermination[0]!.requested_by, "setfarm.product-compiler.plan-refusal");
    assert.equal(exactTermination[0]!.target_status, "failed");
    assert.equal(exactTermination[0]!.state, "terminalized");
    assert.deepEqual(exactTermination[0]!.evidence, owner.termination_evidence);
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
        JOIN steps design ON design.id = ${designDbId}
       WHERE run.id = ${runId}
    `;
    assert.deepEqual({ ...terminal[0] }, {
      run_status: "failed",
      plan_status: "failed",
      design_status: "failed",
      open_claims: 0,
    });
    await assertNoDownstream(database, runId, claimId);
    await closeOwnedOperationalDeliveries(database, runId);
    await assertClosedSidecars(database, runId, claimId, session.sessionId, requested.request.requestId);
    const snapshot = RunOperationalSnapshotV3Schema.parse(await buildRunOperationalSnapshot(database.sql, runId, ownedOptions));
    assert.equal(snapshot.snapshotHash, computeRunOperationalSnapshotHashV3(snapshot));
    assert.equal(snapshot.run.id, runId);
    assert.equal(snapshot.source.verifiedReleaseSha, releaseSha);
    assert.ok(snapshot.source.migrationVersions.includes(19));
    assert.ok(snapshot.source.migrationVersions.includes(22));
    assert.equal(snapshot.source.projection, "complete");
    assert.equal(snapshot.run.terminal, true);
    assert.equal(snapshot.summary.lifecycleState, "terminal");
    assert.equal(snapshot.summary.health, "ok");
    assert.equal(snapshot.summary.invariantViolations, 0);
    assert.deepEqual(snapshot.invariants, []);
    assert.equal(snapshot.summary.operatorActions.stop.allowed, false);
    assert.equal(snapshot.summary.operatorActions.resume.allowed, false);
    for (const key of ["activeClaims", "activeAttempts", "activeRuntimes", "openCompletions", "mandatoryEffectsPending", "unpublishedOutbox"] as const) {
      assert.equal(snapshot.summary[key], 0, key);
    }
    assert.ok(snapshot.outbox.length > 0);
    assert.ok(snapshot.outbox.every(event => event.state === "published"));
    assert.equal(snapshot.operationalFailure!.terminationRequestRef, `setfarm://run-termination/${termination.requestId}`);
    await collectOwnedRefusalThroughRunner(database, loaded, selected, runId, releaseSha, ownedOptions, snapshot);
    await assertClosedSidecars(database, runId, claimId, session.sessionId, requested.request.requestId);
    await assertNoDownstream(database, runId, claimId);
    assert.equal(resolveArtifactStorePublicationAuthorityMode(), publicationAuthorityMode);
    assert.deepEqual(resolveProductArtifactCapacity(), artifactLimits);
  } finally {
    try { await runtimeDb?.pgClose(); }
    finally {
      try { await database.cleanup(); }
      finally {
        try { if (artifactRoot) await rm(artifactRoot, { recursive: true, force: true }); }
        finally {
          if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
          else process.env.SETFARM_PG_URL = previousPgUrl;
        }
      }
    }
  }
});

async function assertActualRenderedPlanTemplates(runId: string, task: string): Promise<void> {
  // Import only after both clients have proved their owned database/role.
  // buildPrompt alone: no harness/injectContext/preClaim/onComplete/logging call.
  const { planModule } = await import("../../src/installer/steps/01-plan/module.js");
  const rejectionJson = '{"schema":"setfarm.product-spec-rejection.v1","sourceTaskHash":"<exact sourceTaskHash from requirement index>","reasons":[{"code":"PRODUCT_SPEC_TASK_AMBIGUOUS","requirementRefs":["<exact requirement ID>"],"message":"<concrete reason>"}]}';
  for (const version of ["v1", "v2"] as const) {
    const input = { runId, task, context: {
      task, plan_protocol: "v3", product_semantics_version: version,
      plan_output_authority_version: "product_build_v1",
      v3_requirement_ledger: canonicalJsonStringify(extractTaskRequirementLedgerV1(task)),
    } };
    const before = structuredClone(input);
    const prompt = planModule.buildPrompt(input);
    const sections = prompt.split("## Typed rejection output\n");
    assert.equal(sections.length, 2, `semantics ${version}: unique refusal section`);
    const section = sections[1]!;
    const template = ["STATUS: done", ...(version === "v1" ? ["PRD:"] : []),
      "```product-spec-rejection-v1", rejectionJson, "```"].join("\n");
    const renderedTemplates = [...section.matchAll(/````text\n([\s\S]*?)\n````/g)];
    assert.equal(renderedTemplates.length, 1, `semantics ${version}: unique entire refusal template`);
    assert.equal(renderedTemplates[0]![1], template, `semantics ${version}: exact STATUS/PRD/fences`);
    assert.equal(section.endsWith(`\`\`\`\`text\n${template}\n\`\`\`\``), true);
    assert.equal((prompt.match(/Choose exactly one decision: proposal or typed rejection\./g) ?? []).length, 1);
    const proposal = version === "v2" ? "plan-product-build-proposal-v1" : "plan-semantic-proposal-v1";
    assert.ok(prompt.includes(`- For a proposal, emit exactly one ${proposal} JSON fence.`));
    assert.ok(prompt.includes(`STATUS: done\nPRD:\n\`\`\`${proposal}`));
    assert.ok(section.includes(version === "v2"
      ? "The following bare refusal is the entire submission. Do not add PRD, other output keys, prose, or another fence."
      : "The following PRD-wrapped refusal is the entire submission. Do not add other output keys, prose, or another fence."));
    assert.equal(template.includes("\nPRD:\n"), version === "v1");
    assert.deepEqual(input, before, `semantics ${version}: prompt input unchanged`);
  }
}

async function attestCurrentOwnedClone(database: OwnedDatabase, projectedHead: string): Promise<void> {
  const beforePlan = await planContractSpineMigrations(database.sql);
  assert.equal(beforePlan.status, "current");
  assert.deepEqual(beforePlan.migrations.map(item => item.version), Array.from({ length: 33 }, (_, i) => i + 1));
  assert.ok(beforePlan.migrations.every(item => item.state === "applied" || item.state === "adopted"));
  assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  const stableJournal = () => database.sql`
    SELECT to_jsonb(journal) - 'verified_release_sha' - 'verified_at' AS value
      FROM public.setfarm_schema_migrations journal ORDER BY version`;
  const authority = () => database.sql`
    SELECT to_jsonb(current_head) AS current, to_jsonb(head) AS head, to_jsonb(receipt) AS receipt
      FROM public.internal_production_owner_producer_manifest_set_current_v1 current_head
      JOIN public.internal_production_owner_producer_manifest_activation_heads_v1 head
        ON head.head_ref=current_head.head_ref AND head.head_hash=current_head.head_hash
      JOIN public.internal_production_owner_producer_manifest_set_activations_v1 receipt
        ON receipt.activation_ref=current_head.activation_ref AND receipt.activation_hash=current_head.activation_hash`;
  const beforeJournal = await stableJournal(), beforeAuthority = await authority();
  assert.equal(beforeJournal.length, 33);
  assert.equal(beforeAuthority.length, 1);
  assert.equal(beforeAuthority[0]!.current.phase, "A");
  assert.equal(beforeAuthority[0]!.head.phase, "A");
  assert.equal(beforeAuthority[0]!.receipt.phase, "A");
  // Already-current public plan and verification are mandatory above. No
  // legacy head0 call, migration application, activation or fallback admission.
  const result = await applyContractSpineMigrationsIfNeeded(database.sql, { releaseSha: projectedHead });
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.adopted, []);
  assert.deepEqual(result.guardedPending, []);
  assert.deepEqual(result.alreadyApplied, beforePlan.migrations.map(item => item.name));
  assert.equal(result.alreadyApplied.length, 33);
  assert.deepEqual(await stableJournal(), beforeJournal, "journal identity/checksum/state/release_sha unchanged");
  assert.deepEqual(await authority(), beforeAuthority, "A current/head/receipt unchanged");
  const attested = await database.sql`
    SELECT version, verified_release_sha, verified_at FROM public.setfarm_schema_migrations ORDER BY version`;
  assert.equal(attested.length, 33);
  assert.ok(attested.every(row => row.verified_release_sha === projectedHead && row.verified_at !== null));
  assert.deepEqual(await planContractSpineMigrations(database.sql), beforePlan);
  assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
}

async function assertNoDownstream(database: OwnedDatabase, runId: string, claimId: number): Promise<void> {
  const rows = await database.sql`
    SELECT
      (SELECT COUNT(*)::integer FROM claim_log WHERE run_id=${runId} AND id<>${claimId}) AS other_claims,
      (SELECT COUNT(*)::integer FROM execution_attempts WHERE run_id=${runId}) AS attempts,
      (SELECT COUNT(*)::integer FROM product_packets WHERE run_id=${runId}) AS packets,
      (SELECT COUNT(*)::integer FROM run_artifact_refs WHERE run_id=${runId}) AS artifact_refs,
      (SELECT COUNT(*)::integer FROM stories WHERE run_id=${runId}) AS stories,
      (SELECT COUNT(*)::integer FROM finding_sets WHERE run_id=${runId}) AS finding_sets,
      (SELECT COUNT(*)::integer FROM recovery_cases WHERE run_id=${runId}) AS recovery_cases,
      (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries WHERE run_id=${runId}) AS dispatches,
      (SELECT COUNT(*)::integer FROM evidence_bundles WHERE run_id=${runId}) AS evidence,
      (SELECT COUNT(*)::integer FROM accepted_candidates WHERE run_id=${runId}) AS candidates,
      (SELECT COUNT(*)::integer FROM v3_deploy_receipts WHERE run_id=${runId}) AS deployments,
      (SELECT COUNT(*)::integer FROM v3_project_transfer_acks WHERE run_id=${runId}) AS transfers`;
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0] }, { other_claims: 0, attempts: 0, packets: 0, artifact_refs: 0, stories: 0,
    finding_sets: 0, recovery_cases: 0, dispatches: 0, evidence: 0, candidates: 0, deployments: 0, transfers: 0 });
}

async function closeOwnedOperationalDeliveries(database: OwnedDatabase, runId: string): Promise<void> {
  const outbox = createOperationalOutboxRepository(database.sql);
  const pending = await outbox.list({ limit: 1000 });
  assert.ok(pending.length > 0 && pending.length < 1000);
  assert.ok(pending.every(item => item.state === "pending" && item.attemptCount === 0));
  const published = await createOperationalOutboxPublisher({ repository: outbox,
    ownerInstanceId: `fixture-outbox/${runId}` }).drain({ maxEvents: 1000 });
  assert.deepEqual(published, { claimed: pending.length, published: pending.length,
    retriesScheduled: 0, quarantined: 0, drained: true });
  const deliveries = createOperationalEventDeliveryRepository(database.sql);
  for (const consumer of ["jsonl", "webhook"] as const) {
    const captured: OperationalEventDelivery[] = [];
    const consumerPort = createOperationalEventDeliveryConsumer({ repository: deliveries, consumer,
      ownerInstanceId: `fixture-${consumer}/${runId}`,
      sink: async delivery => {
        const event = CanonicalOperationalEventV1Schema.parse(delivery.event);
        assert.equal(event.runId, runId);
        assert.equal(event.eventKey, delivery.eventKey);
        assert.equal(delivery.consumer, consumer);
        assert.ok(pending.some(row => row.eventKey === event.eventKey && row.outboxId === event.outboxId));
        // Actual explicit fixture sink actions: serialize/capture the JSONL
        // payload, and record the no-webhook policy action without networking.
        const serializedPayload = JSON.stringify(event);
        assert.deepEqual(JSON.parse(serializedPayload), event);
        captured.push(structuredClone(delivery));
        return { outcome: consumer === "jsonl" ? "delivered" : "skipped",
          result: { fixture: true, consumer, eventHash: event.eventHash, inputHash: delivery.inputHash,
            policy: consumer === "jsonl" ? "captured-in-memory-jsonl" : "no-fixture-webhook-configured",
            payloadHash: createHash("sha256").update(serializedPayload).digest("hex") } };
      } });
    const result = await consumerPort.drain({ maxDeliveries: 1000 });
    assert.deepEqual(result, { claimed: pending.length, delivered: consumer === "jsonl" ? pending.length : 0,
      skipped: consumer === "webhook" ? pending.length : 0, retriesScheduled: 0, quarantined: 0, drained: true });
    assert.equal(captured.length, pending.length, "each delivery performed an explicit fixture sink action");
    assert.equal(new Set(captured.map(item => item.eventKey)).size, pending.length);
    for (const capturedDelivery of captured) {
      const persisted = (await deliveries.find(capturedDelivery.eventKey, consumer))!;
      assert.equal(persisted.state, consumer === "jsonl" ? "delivered" : "skipped");
      assert.equal(persisted.attemptCount, 1);
      assert.equal(persisted.ownerInstanceId, undefined);
      assert.equal(persisted.leaseToken, undefined);
      assert.equal(persisted.inputHash, capturedDelivery.inputHash);
      assert.deepEqual(persisted.event, capturedDelivery.event);
      assert.equal(persisted.result.eventHash, capturedDelivery.event.eventHash);
      assert.equal(persisted.result.inputHash, capturedDelivery.inputHash);
      assert.equal(persisted.result.payloadHash, createHash("sha256").update(JSON.stringify(capturedDelivery.event)).digest("hex"));
      assert.equal(persisted.result.fixture, true);
      assert.equal(persisted.result.policy, consumer === "jsonl" ? "captured-in-memory-jsonl" : "no-fixture-webhook-configured");
    }
  }
  const settled = await outbox.list({ limit: 1000 });
  assert.deepEqual(settled.map(item => [item.eventKey, item.outboxId, item.payload]), pending.map(item => [item.eventKey, item.outboxId, item.payload]));
  assert.ok(settled.every(item => item.state === "published" && item.attemptCount === 1));
}

async function assertClosedSidecars(database: OwnedDatabase, runId: string, claimId: number, sessionId: string, requestId: string): Promise<void> {
  const rows = await database.sql`
    SELECT completion.state AS completion_state, completion.apply_phase,
      completion.owner_instance_id AS completion_owner, completion.lease_expires_at AS completion_lease,
      runtime.state AS runtime_state, claim.outcome AS claim_outcome,
      (SELECT COUNT(*)::integer FROM runtime_completion_effects WHERE request_id=${requestId}) AS effect_count,
      (SELECT COUNT(*)::integer FROM runtime_completion_effects WHERE request_id=${requestId} AND state='reconciled' AND owner_instance_id IS NULL AND lease_token IS NULL) AS reconciled_effects,
      (SELECT COUNT(*)::integer FROM internal_production_owner_reservations_v1 WHERE state<>'closed') AS unclosed_owner_sidecars
    FROM runtime_completion_requests completion
    JOIN runtime_sessions runtime ON runtime.session_id=completion.runtime_session_id
    JOIN claim_log claim ON claim.id=completion.claim_id
    WHERE completion.request_id=${requestId} AND completion.run_id=${runId}
      AND runtime.session_id=${sessionId} AND claim.id=${claimId}`;
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0] }, { completion_state: "accepted", apply_phase: "effects_committed",
    completion_owner: "spawner-test", completion_lease: null, runtime_state: "released", claim_outcome: "completed",
    effect_count: 1, reconciled_effects: 1, unclosed_owner_sidecars: 0 });
  const owners = await database.sql`
    SELECT category, owner_key, state FROM internal_production_owner_reservations_v1
      WHERE (category='run' AND owner_key=${runId}) OR (category='claim' AND owner_key=${String(claimId)})
         OR (category='runtime-session' AND owner_key=${sessionId}) OR (category='completion-owner' AND owner_key=${requestId})`;
  assert.deepEqual(owners.map(row => row.category).sort(), ["claim", "completion-owner", "run", "runtime-session"]);
  assert.ok(owners.every(row => row.state === "closed"));
}

async function collectOwnedRefusalThroughRunner(database: OwnedDatabase, original: MaintainedSuite,
  selected: MaintainedCase, runId: string, projectedHead: string,
  ownedOptions: Parameters<typeof createPostgresConvergencePort>[1], initialSnapshot: RunOperationalSnapshotV3): Promise<void> {
  // All eight real suite cases/profiles/oracles remain byte-identical. Only
  // ordering changes; fake start returns the one precreated terminal fixture.
  const suite = ProductConvergenceSuiteV1Schema.parse({ ...original.suite,
    cases: [selected, ...original.suite.cases.filter(item => item.caseId !== selected.caseId)] });
  const loaded = { suite, suiteHash: hashCanonicalJson(suite) };
  assert.equal(suite.cases.length, 8);
  for (const item of suite.cases) assert.deepEqual(item, original.suite.cases.find(value => value.caseId === item.caseId));
  const profile = selected.executionProfile;
  assert.ok(suite.cases.every(item => item.executionProfile.providerId === profile.providerId && item.executionProfile.modelId === profile.modelId));
  const db = createPostgresConvergencePort(database.sql, ownedOptions);
  const inspected = await db.inspectPlatform();
  assert.deepEqual(inspected, { migrationVerified: true, attestedReleaseSha: projectedHead, artifactIndexReady: true,
    activeRuns: 0, openClaims: 0, activeAttempts: 0, activeRuntimes: 0, activeRecoveryDeliveries: 0 });
  const existing = await db.readRun(runId);
  assert.equal(existing.terminal, true);
  assert.equal(existing.compilerReleaseSha, projectedHead);
  let started = 0, forbidden = 0, cancelled = false, time = Date.now(), canaries = 0, preparations = 0, releaseInspections = 0;
  const inspections: Awaited<ReturnType<typeof db.inspectPlatform>>[] = [];
  const collections: ConvergenceRunCollection[] = [], bodies: Array<{ service: string; value: RunOperationalSnapshotV3 }> = [];
  const polls: Awaited<ReturnType<typeof db.readRun>>[] = [], artifacts: unknown[] = [], phases: unknown[] = [];
  const health: string[] = [], github: unknown[] = [], sleeps: number[] = [];
  let fixtureContexts: Awaited<ReturnType<ConvergenceRunnerPorts["admissions"]["createCanary"]>>["contexts"] = [];
  const unexpected = async (): Promise<never> => { forbidden++; throw new Error("unexpected fixture adapter call"); };
  const runnerHash = createHash("sha256").update(await readFile(path.resolve("src/evals/convergence-runner.ts"))).digest("hex");
  const ports: ConvergenceRunnerPorts = {
    sql: {
      inspectPlatform: async () => { const value = await db.inspectPlatform(); inspections.push(value); return value; },
      readRun: async id => { assert.equal(id, runId); const value = await db.readRun(id); polls.push(value); return value; },
      collectRun: async (id, input) => { assert.equal(id, runId); assert.equal(input.task, selected.task);
        assert.deepEqual(input.oracle, selected.oracle); const value = await db.collectRun(id, input); collections.push(value); return value; },
      close: unexpected,
    },
    http: {
      health: async service => { health.push(service); return { ok: true, evidenceHash: hashCanonicalJson({ fixture: "port-health", service }) }; },
      operationalSnapshot: async (service, id) => { assert.equal(id, runId);
        const value = RunOperationalSnapshotV3Schema.parse(await buildRunOperationalSnapshot(database.sql, id, ownedOptions));
        bodies.push({ service, value }); return value; },
      syncProject: unexpected,
    },
    process: {
      inspectRelease: async () => { releaseInspections++; return { headSha: projectedHead, clean: true, runnerHash,
        environmentHash: hashCanonicalJson({ fixture: "synthetic-release-health-start-admission-metadata", profile }),
        ...profile, cliReady: true, v3ActivationEnabled: true }; },
      startRun: async input => { assert.equal(++started, 1); assert.equal(input.task, selected.task);
        assert.equal(input.workflowId, suite.workflowId); assert.equal(input.releaseSha, projectedHead);
        assert.equal(input.admission.caseHash, hashCanonicalJson(selected));
        assert.equal(input.admission.taskHash, hashCanonicalJson(selected.task)); assert.equal(input.admission.repetition, 1);
        assert.equal(input.startChild, undefined); assert.deepEqual(input.admission, fixtureContexts[0]);
        return { runId, runNumber: existing.runNumber }; },
      inspectProject: unexpected,
      inspectGitHub: async refs => { github.push(structuredClone(refs)); assert.deepEqual(refs, []);
        return { stateHash: hashCanonicalJson({ fixture: "no-network-no-prs", refs }), pullRequests: 0, unverified: 0, open: 0 }; },
    },
    admissions: {
      createCanary: async input => { canaries++; assert.equal(input.releaseSha, projectedHead); assert.equal(input.suiteHash, loaded.suiteHash);
        assert.equal(input.slots.length, 8);
        assert.match(input.preflightHash, /^[a-f0-9]{64}$/);
        assert.equal(input.ttlMs, 8 * suite.timeout.runMs + 60 * 60 * 1000);
        assert.equal(new Set(input.slots.map(slot => slot.slotToken)).size, 8);
        assert.ok(input.slots.every(slot => /^[A-Za-z0-9_-]{43}$/.test(slot.slotToken)));
        assert.deepEqual(input.slots.map(slot => ({ caseHash: slot.caseHash, taskHash: slot.taskHash, repetition: slot.repetition })),
          suite.cases.map(item => ({ caseHash: hashCanonicalJson(item), taskHash: hashCanonicalJson(item.task), repetition: 1 })));
        const admissionHash = hashCanonicalJson({ fixture: "no-db-canary", ...input });
        fixtureContexts = input.slots.map(slot => ({ schema: "setfarm.internal-convergence-admission.v1" as const,
          admissionHash, slotHash: hashCanonicalJson({ fixture: "no-db-slot", ...slot }), ...slot }));
        return { contexts: fixtureContexts }; },
      promoteReleaseGo: unexpected,
    },
    artifacts: {
      prepare: async () => { preparations++; },
      put: async value => { artifacts.push(structuredClone(value)); const hash = value.schema === "setfarm.product-convergence-release-gate.v1" ? value.gateHash : value.resultHash;
        return { hash, locator: `sha256/${hash.slice(0, 2)}/${hash}.json`, created: true }; },
    },
    clock: { now: () => new Date(time), sleep: async ms => { sleeps.push(ms); time += ms; } },
  };
  const control: ConvergenceJobControlV1 = {
    beforeCase: async value => { assert.deepEqual(value, { caseId: selected.caseId, caseHash: hashCanonicalJson(selected),
      taskHash: hashCanonicalJson(selected.task), repetition: 1 }); },
    onRunStarted: async value => { assert.equal(value.runId, runId); },
    onRunResult: async value => { assert.equal(value.runId, runId); cancelled = true; },
    cancellationRequested: async () => cancelled,
    requestOwnedRunStop: unexpected,
    onPhase: async value => { phases.push(value); }, onPublication: async value => { phases.push(value); },
    beforeFinalization: async () => "cancel",
  };
  const output = await runConvergenceSuite(loaded, { releaseSha: projectedHead, execute: true, control }, ports);
  assert.equal(started, 1); assert.equal(forbidden, 0); assert.equal(inspections.length, 2);
  assert.deepEqual(inspections, [inspected, inspected]);
  assert.equal(canaries, 1);
  assert.equal(preparations, 1); assert.ok(releaseInspections >= 2);
  assert.ok(polls.length >= 1); assert.ok(polls.every(item => item.runId === runId && item.terminal));
  assert.equal(collections.length, 1); assert.equal(github.length, 1); assert.equal(sleeps.length, 0);
  assert.deepEqual(health.sort(), ["mission_control", "setfarm"]);
  assert.equal(bodies.length, 2); assert.deepEqual(bodies.map(item => item.service).sort(), ["mission_control", "setfarm"]);
  assert.ok(bodies.every(item => item.value.snapshotHash === initialSnapshot.snapshotHash));
  assert.ok(artifacts.length > 0 && phases.length > 0);
  assert.equal(output.result.plannedRuns, 8); assert.equal(output.result.runs.length, 1);
  assert.equal(output.result.status, "blocked"); assert.ok(output.result.blockerCodes.includes("EVAL_CANCEL_REQUESTED"));
  assert.equal(output.gate.decision, "no_go");
  const observed = output.result.runs[0]!;
  assert.equal(observed.runId, runId); assert.equal(observed.caseId, selected.caseId); assert.equal(observed.passed, true);
  assert.deepEqual(observed.canonical, collections[0]!.canonical);
  assert.deepEqual(observed.canonical.invariantCodes, []); assert.deepEqual(observed.canonical.oracle.mismatchCodes, []);
  assert.equal(observed.canonical.evidence.missingExpectedPredicates, 0);
  assert.equal(observed.projection.setfarmProjection, "complete"); assert.equal(observed.projection.missionControlProjection, "complete");
  assert.equal(observed.projection.exactHashMatch, true); assert.equal(observed.projection.operationalSettled, true);
  assert.deepEqual(Object.keys(observed.projection.capabilities).sort(), ["attempts", "claimBinding", "runtimeOwnership", "managerCompletion", "effectLedger", "findingRecovery", "evidenceLedger", "acceptedCandidate", "deploymentReceipt", "projectTransferAck"].sort());
  assert.ok(Object.values(observed.projection.capabilities).every(value => value === true));
  assert.equal(observed.projection.transferAcknowledged, false); assert.equal(observed.projection.projectTransferAckHash, null); assert.equal(observed.projection.projectRecordHash, null);
  assert.equal(observed.projection.setfarmSnapshotHash, bodies.find(item => item.service === "setfarm")!.value.snapshotHash);
  assert.equal(observed.projection.missionControlSnapshotHash, bodies.find(item => item.service === "mission_control")!.value.snapshotHash);
}
