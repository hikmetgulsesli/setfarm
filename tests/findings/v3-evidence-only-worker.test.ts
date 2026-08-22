import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { computeObservationRef, createEvidenceBundleV2 } from "../../src/evidence/evidence-bundle-v2.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import type { PgTransactionSql } from "../../src/db-pg.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
} from "../../src/execution/claim-runtime-publication.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  ImplementationSliceV1Schema,
  type ImplementationSliceV1,
} from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import {
  createV3EvidenceOnlyPublication,
  type V3EvidenceOnlyPublicationLeaseV1,
} from "../../src/recovery/v3-evidence-only-publication.js";
import {
  createV3EvidenceOnlyRecoveryWorker,
  type V3EvidenceOnlyAttemptContext,
  type V3EvidenceOnlyLeaseV1,
  type V3EvidenceOnlyWorkerDependencies,
} from "../../src/recovery/v3-evidence-only-worker.js";
import { createV3RecoveryLifecycleReconciler } from "../../src/recovery/v3-recovery-lifecycle-reconciler.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const COMPILATION_REPORT_HASH = "9".repeat(64);
const PRIOR_SLICE_HASH = "b".repeat(64);
const PRIOR_EVIDENCE_HASH = "c".repeat(64);
const SOURCE_REVISION = Object.freeze({ sha: "1".repeat(40), treeHash: "2".repeat(40) });

type DispatchClass = "product_implementation" | "evidence_only";

function cleanSlice(): ImplementationSliceV1 {
  const base = buildMinimalValidContracts().implementationSlice;
  return ImplementationSliceV1Schema.parse({
    ...base,
    contract: {
      ...base.contract,
      actions: base.contract.actions.map((action) => ({
        ...action,
        evidenceScenario: action.evidenceScenario ?? { prerequisiteSteps: [] },
      })),
    },
    sourceRevision: {
      baseSha: SOURCE_REVISION.sha,
      treeHash: SOURCE_REVISION.treeHash,
    },
  });
}

function fullEvidenceRefs(slice: ImplementationSliceV1): string[] {
  const plan = compileEvidencePlanV1({ slice, sliceHash: hashCanonicalJson({ refs: slice.storyId }) });
  return [
    ...plan.predicateRefs,
    ...plan.commands.map((command) => `EVID_COMMAND_${command.commandRef}`),
  ].sort();
}

function priorFinding(runId: string, slice: ImplementationSliceV1) {
  return createFindingSetV1({
    runId,
    storyId: slice.storyId,
    packetHash: slice.packetHash,
    sliceHash: PRIOR_SLICE_HASH,
    sourceRevision: SOURCE_REVISION,
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_PERSISTENCE_ROUND_TRIP",
      sourceLocators: [{ path: "src/App.tsx", contentHash: "a".repeat(64) }],
      observedEvidenceRefs: [PRIOR_EVIDENCE_HASH],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function recoveryDraft(
  findingSet: ReturnType<typeof priorFinding>,
  slice: ImplementationSliceV1,
  dispatchClass: DispatchClass,
): RecoveryCaseDraftV1 {
  const evidenceOnly = dispatchClass === "evidence_only";
  return {
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: findingSet.packetHash,
    sliceHash: findingSet.sliceHash,
    sourceRevision: findingSet.sourceRevision,
    owner: evidenceOnly ? "infrastructure" : "implement",
    expectedDelta: evidenceOnly
      ? { kind: "evidence_refresh", predicateRefs: fullEvidenceRefs(slice) }
      : {
          kind: "source_change",
          invariantRefs: ["INV_PERSISTENCE_ROUND_TRIP"],
          requiredPaths: ["src/App.tsx"],
        },
    allowedPaths: evidenceOnly ? [] : ["src/App.tsx"],
    evidencePlan: fullEvidenceRefs(slice),
    priorAttemptRefs: [],
    budget: {
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  };
}

function canonicalEvidence(input: Readonly<{
  runId: string;
  attemptId: string;
  slice: ImplementationSliceV1;
  sliceHash: string;
  verdict: "pass" | "fail" | "inconclusive";
  salt: string;
}>) {
  const plan = compileEvidencePlanV1({ slice: input.slice, sliceHash: input.sliceHash });
  const flow = plan.flows[0]!;
  const beforeHash = hashCanonicalJson({ salt: input.salt, artifact: "before" });
  const afterHash = hashCanonicalJson({ salt: input.salt, artifact: "after" });
  const control = {
    kind: "control" as const,
    owner: "setfarm-orchestrator" as const,
    actionRef: flow.actionRef,
    ...(flow.controlRef ? { controlRef: flow.controlRef } : {}),
    beforeArtifactHash: beforeHash,
    afterArtifactHash: afterHash,
    startedAt: "2026-07-13T10:00:00.000Z",
    completedAt: "2026-07-13T10:00:01.000Z",
  };
  const commands = plan.commands.map((command, index) => {
    const stdoutArtifactHash = hashCanonicalJson({ salt: input.salt, command: command.commandRef });
    const observation = {
      kind: "command" as const,
      owner: "setfarm-orchestrator" as const,
      commandRef: command.commandRef,
      exitCode: 0,
      stdoutArtifactHash,
      startedAt: `2026-07-13T10:00:0${index + 2}.000Z`,
      completedAt: `2026-07-13T10:00:0${index + 2}.500Z`,
    };
    return { command, observation, stdoutArtifactHash };
  });
  const productPredicate = input.slice.requiredEvidence[0]!;
  const bundle = createEvidenceBundleV2({
    runId: input.runId,
    storyId: input.slice.storyId,
    packetHash: input.slice.packetHash,
    sliceHash: input.sliceHash,
    sourceRevision: SOURCE_REVISION,
    attemptId: input.attemptId,
    predicates: [{
      invariantRef: `INV_${productPredicate.kind.toUpperCase()}`,
      predicateRef: productPredicate.id,
      actionRef: flow.actionRef,
      ...(flow.controlRef ? { controlRef: flow.controlRef } : {}),
      required: true,
      verdict: input.verdict,
      observationRefs: [computeObservationRef(control)],
    }, ...commands.map(({ command, observation }) => ({
      invariantRef: `INV_COMMAND_${command.kind.toUpperCase()}`,
      predicateRef: `EVID_COMMAND_${command.commandRef}`,
      required: true as const,
      verdict: "pass" as const,
      observationRefs: [computeObservationRef(observation)],
    }))],
    observations: [control, ...commands.map(({ observation }) => observation)],
    artifacts: [
      { hash: beforeHash, mediaType: "application/json", locator: "evidence/before.json" },
      { hash: afterHash, mediaType: "application/json", locator: "evidence/after.json" },
      ...commands.map(({ command, stdoutArtifactHash }) => ({
        hash: stdoutArtifactHash,
        mediaType: "text/plain",
        locator: `evidence/${command.commandRef}.stdout`,
      })),
    ],
    runner: {
      id: "setfarm-test-evidence-only-runner",
      version: "1.0.0",
      environmentHash: hashCanonicalJson({ runner: "evidence-only-test", salt: input.salt }),
    },
    startedAt: "2026-07-13T10:00:00.000Z",
    completedAt: "2026-07-13T10:00:05.000Z",
  });
  return {
    bundle,
    bundleHash: hashCanonicalJson(bundle),
    artifactPaths: [] as string[],
  };
}

describe("v3 evidence-only recovery worker", () => {
  let database: TestDatabase;
  let databaseBase: Date;
  let sequence = 0;
  const workdirs: string[] = [];

  const at = (offsetMs = 0) => new Date(databaseBase.getTime() + offsetMs);

  before(async () => {
    database = await createIsolatedTestDatabase();
    const rows = await database.sql.unsafe<Array<{ wall_clock: Date }>>(
      "SELECT date_trunc('milliseconds', clock_timestamp()) AS wall_clock",
    );
    databaseBase = rows[0]!.wall_clock;
  });

  after(async () => {
    await database.cleanup();
    for (const workdir of workdirs) fs.rmSync(workdir, { recursive: true, force: true });
  });

  async function setup(input: Readonly<{
    workflowId: string;
    dispatchClass?: DispatchClass;
    authorizedAt?: Date;
  }>) {
    sequence += 1;
    const slice = cleanSlice();
    const dispatchClass = input.dispatchClass ?? "evidence_only";
    const runId = `run-v3-evidence-worker-${sequence}`;
    const storyDbId = `story-v3-evidence-worker-${sequence}`;
    const stepDbId = `step-v3-evidence-worker-${sequence}`;
    const releaseSha = "3".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, $2, 'evidence-only worker test', 'running', 'v3', 1, $3, $4, $5, $6)`,
      [runId, input.workflowId, releaseSha, slice.packetHash, "e".repeat(64), releaseAdmissionHash],
    );
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, type, loop_config, retry_count
       ) VALUES ($1, $2, 'implement', 'developer', 6, 'implement {{story_id}}',
                 'STATUS: done', 'pending', 'loop', '{"over":"stories"}', 0)`,
      [stepDbId, runId],
    );
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, description,
         acceptance_criteria, status, retry_count, max_retries,
         abandoned_count, claim_generation
       ) VALUES ($1, $2, 1, $3, 'Evidence-only story', 'failed canonical evidence',
                 '["save and reload"]', 'failed', 1, 3, 0, 2)`,
      [storyDbId, runId, slice.storyId],
    );

    const findingSet = priorFinding(runId, slice);
    const findings = createFindingRecoveryRepository(database.sql);
    await findings.putFindingSet(findingSet);
    const priorPlanHash = hashCanonicalJson({ schema: "setfarm.test-prior-evidence-plan.v1", runId });
    const opened = await findings.openRecoveryCase(recoveryDraft(findingSet, slice, dispatchClass), {
      now: at(-2 * 60 * 60_000),
      evidencePlanArtifactHash: priorPlanHash,
    });
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(revision);
    const authorized = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: opened.recoveryCase.stateVersion,
      dispatchClass,
    }, { now: input.authorizedAt ?? at(-60 * 60_000 + sequence * 1_000) });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected authorized recovery dispatch");

    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-v3-evidence-worker-"));
    workdirs.push(workdir);
    fs.mkdirSync(path.join(workdir, "src"), { recursive: true });
    fs.writeFileSync(path.join(workdir, "src", "App.tsx"), "export const app = 'unchanged';\n");
    const sliceHash = PRIOR_SLICE_HASH;
    const plan = compileEvidencePlanV1({ slice, sliceHash });
    const planArtifactHash = priorPlanHash;
    return {
      workflowId: input.workflowId,
      runId,
      storyDbId,
      stepDbId,
      slice,
      sliceHash,
      plan,
      planArtifactHash,
      findingSet,
      recoveryCase: opened.recoveryCase,
      revision,
      dispatch: authorized.dispatch,
      workdir,
    };
  }

  function dependencies(input: Readonly<{
    fixture: Awaited<ReturnType<typeof setup>>;
    verdict: "pass" | "fail" | "inconclusive";
    onExecute?: () => void | Promise<void>;
    attemptNow?: Date;
    captureSource?: () => typeof SOURCE_REVISION;
    completeClaim?: V3EvidenceOnlyWorkerDependencies["completeClaim"];
  }>): V3EvidenceOnlyWorkerDependencies {
    const attempts = createAttemptRepository(database.sql);
    const agentId = `setfarm-evidence-only-${input.fixture.runId}`;
    return {
      async loadOrReserveAttempt({ lease }): Promise<V3EvidenceOnlyAttemptContext> {
        let attempt;
        if (lease.mode === "fresh_execution") {
          const claimId = await database.sql.begin(async (transaction) => {
            const idRows = await transaction.unsafe<Array<{ id: unknown }>>(
              "SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id",
            );
            const birth = await prepareInternalProductionClaimBirthV1(
              transaction as PgTransactionSql,
              "a-claim-v3-evidence-only-v1",
              idRows,
            );
            return insertAndBindInternalProductionClaimBirthV1(
              transaction as PgTransactionSql,
              birth,
              {
                runId: lease.runId,
                workflowStepId: "implement",
                storyId: lease.storyId,
                claimAgentId: agentId,
                claimedAt: at(1_000),
              },
            );
          });
          const reserved = await attempts.reserve({
            claimId,
            runId: lease.runId,
            stepId: "implement",
            storyId: lease.storyId,
            attemptClass: "evidence_only",
            packetHash: lease.packetHash,
            compilationReportHash: COMPILATION_REPORT_HASH,
            sliceHash: input.fixture.sliceHash,
            sourceBefore: lease.sourceRevision,
            findingSetHash: lease.findingSetHash,
            recoveryCaseRevisionId: lease.revisionId,
            recoveryDispatchId: lease.dispatchId,
            recoveryDeliveryLease: {
              ownerInstanceId: lease.ownerInstanceId,
              leaseToken: lease.leaseToken,
            },
            role: "evidence-orchestrator",
            agentId,
            worktree: input.fixture.workdir,
            evidenceRefs: [
              `setfarm://claim-log/${claimId}`,
              `setfarm://artifact/${lease.packetHash}`,
              `setfarm://artifact/${input.fixture.sliceHash}`,
              `setfarm://artifact/${input.fixture.planArtifactHash}`,
            ],
          }, { now: input.attemptNow ?? at(1_000) });
          assert.equal(reserved.status, "reserved");
          attempt = reserved.attempt;
        } else {
          attempt = await attempts.findById(lease.attemptId!);
          assert.ok(attempt);
        }
        return {
          attempt: attempt!,
          workdir: input.fixture.workdir,
          slice: input.fixture.slice,
          sliceHash: input.fixture.sliceHash,
          evidencePlan: input.fixture.plan,
          evidencePlanArtifactHash: input.fixture.planArtifactHash,
        };
      },
      captureSource: async () => input.captureSource?.() ?? SOURCE_REVISION,
      async executeEvidence({ lease, context }) {
        await input.onExecute?.();
        return canonicalEvidence({
          runId: lease.runId,
          attemptId: context.attempt.attemptId,
          slice: context.slice,
          sliceHash: context.sliceHash,
          verdict: input.verdict,
          salt: `${lease.dispatchId}:${input.verdict}`,
        });
      },
      completeClaim: input.completeClaim ?? (async ({ attempt }) => {
        const rows = await database.sql.unsafe<Array<{ id: string }>>(
          `UPDATE claim_log
              SET outcome = 'completed', diagnostic = 'canonical evidence-only worker'
            WHERE id = $1 AND outcome IS NULL
            RETURNING id::text`,
          [attempt.claimId!],
        );
        if (rows.length === 0) {
          const existing = await database.sql.unsafe<Array<{ outcome: string | null }>>(
            "SELECT outcome FROM claim_log WHERE id = $1",
            [attempt.claimId!],
          );
          assert.ok(existing[0]?.outcome);
        }
      }),
    };
  }

  function publicationLease(lease: V3EvidenceOnlyLeaseV1): V3EvidenceOnlyPublicationLeaseV1 {
    assert.equal(lease.mode, "fresh_execution");
    return {
      mode: "fresh_execution",
      runId: lease.runId,
      stepDbId: lease.stepDbId,
      storyDbId: lease.storyDbId,
      storyId: lease.storyId,
      recoveryCaseId: lease.recoveryCaseId,
      revisionId: lease.revisionId,
      dispatchId: lease.dispatchId,
      packetHash: lease.packetHash,
      contractSliceHash: lease.contractSliceHash,
      findingSetHash: lease.findingSetHash,
      sourceRevision: lease.sourceRevision,
      evidencePlan: lease.evidencePlan,
      ...(lease.priorEvidencePlanArtifactHash
        ? { priorEvidencePlanArtifactHash: lease.priorEvidencePlanArtifactHash }
        : {}),
      ownerInstanceId: lease.ownerInstanceId,
      leaseToken: lease.leaseToken,
      leaseExpiresAt: lease.leaseExpiresAt,
    };
  }

  async function indexPublicationArtifacts(input: Readonly<{
    runId: string;
    sliceHash: string;
    planHash: string;
    sliceRefKey: string;
    planRefKey: string;
  }>): Promise<void> {
    const producer = JSON.stringify({
      pass: "v3-evidence-only-publication-test",
      codeSha: "1234567",
      toolVersions: { setfarm: "test" },
    });
    await database.sql.unsafe(
      `INSERT INTO semantic_artifacts (
         artifact_hash, artifact_type, byte_length, producer_metadata
       ) VALUES
         ($1, 'setfarm.implementation-slice.v1', 1, $3::text::jsonb),
         ($2, 'setfarm.evidence-plan.v1', 1, $3::text::jsonb)
       ON CONFLICT (artifact_hash) DO NOTHING`,
      [input.sliceHash, input.planHash, producer],
    );
    await database.sql.unsafe(
      `INSERT INTO run_artifact_refs (run_id, ref_key, artifact_hash)
       VALUES ($1, $2, $3), ($1, $4, $5)`,
      [input.runId, input.sliceRefKey, input.sliceHash, input.planRefKey, input.planHash],
    );
  }

  async function publishEvidenceOwner(input: Readonly<{
    fixture: Awaited<ReturnType<typeof setup>>;
    ownerInstanceId: string;
    leaseMs?: number;
    acquiredAt?: Date;
  }>) {
    const acquiredAt = input.acquiredAt ?? at();
    const worker = createV3EvidenceOnlyRecoveryWorker(
      database.sql,
      dependencies({ fixture: input.fixture, verdict: "pass" }),
    );
    const acquired = await worker.acquireNext({
      workflowId: input.fixture.workflowId,
      ownerInstanceId: input.ownerInstanceId,
      leaseMs: input.leaseMs ?? 60_000,
    }, { now: acquiredAt });
    assert.ok(acquired);
    const lease = publicationLease(acquired);
    const sliceRefKey = `SLICE_${sequence}_OWNER`;
    const planRefKey = `EVIDENCE_PLAN_${sequence}_OWNER`;
    await indexPublicationArtifacts({
      runId: input.fixture.runId,
      sliceHash: lease.contractSliceHash,
      planHash: lease.priorEvidencePlanArtifactHash!,
      sliceRefKey,
      planRefKey,
    });
    const publication = createV3EvidenceOnlyPublication(database.sql);
    const attempt = await publication.reserve(lease, {
      compilationReportHash: COMPILATION_REPORT_HASH,
      sliceHash: lease.contractSliceHash,
      sliceRefKey,
      evidencePlanArtifactHash: lease.priorEvidencePlanArtifactHash!,
      evidencePlanRefKey: planRefKey,
      worktree: input.fixture.workdir,
      branch: "story/evidence-owner",
      role: "evidence-orchestrator",
      agentId: "setfarm-evidence-orchestrator",
      evidenceRefs: [
        `setfarm://artifact/${lease.packetHash}`,
        `setfarm://artifact/${lease.contractSliceHash}`,
        `setfarm://artifact/${lease.priorEvidencePlanArtifactHash!}`,
      ],
    }, { now: new Date(acquiredAt.getTime() + 1_000) });
    return { lease, publication, attempt };
  }

  it("leases only one exact evidence-only dispatch under concurrent workers", async () => {
    const workflowId = "workflow-evidence-only-concurrency";
    await setup({ workflowId, dispatchClass: "product_implementation", authorizedAt: at(-60 * 60_000) });
    const evidence = await setup({ workflowId, dispatchClass: "evidence_only", authorizedAt: at(-60 * 60_000 + 1_000) });
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({ fixture: evidence, verdict: "pass" }));
    const raced = await Promise.all([
      worker.acquireNext({ workflowId, ownerInstanceId: "evidence-racer-a", leaseMs: 60_000 }),
      worker.acquireNext({ workflowId, ownerInstanceId: "evidence-racer-b", leaseMs: 60_000 }),
    ]);
    const acquired = raced.filter((item) => item !== undefined);
    assert.equal(acquired.length, 1);
    assert.equal(acquired[0]!.dispatchId, evidence.dispatch.dispatchId);
    assert.equal(acquired[0]!.mode, "fresh_execution");
    assert.ok(["evidence-racer-a", "evidence-racer-b"].includes(acquired[0]!.ownerInstanceId));
  });

  it("atomically publishes one non-model claim, attempt, and delivery under concurrent publishers", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-publication-concurrency" });
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({ fixture, verdict: "pass" }));
    const acquired = await worker.acquireNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-publication-racer",
      leaseMs: 60_000,
    }, { now: at() });
    assert.ok(acquired);
    const lease = publicationLease(acquired);
    const sliceRefKey = `SLICE_${sequence}_PUBLICATION`;
    const planRefKey = `EVIDENCE_PLAN_${sequence}_PUBLICATION`;
    await indexPublicationArtifacts({
      runId: fixture.runId,
      sliceHash: lease.contractSliceHash,
      planHash: lease.priorEvidencePlanArtifactHash!,
      sliceRefKey,
      planRefKey,
    });
    const prepared = {
      compilationReportHash: COMPILATION_REPORT_HASH,
      sliceHash: lease.contractSliceHash,
      sliceRefKey,
      evidencePlanArtifactHash: lease.priorEvidencePlanArtifactHash!,
      evidencePlanRefKey: planRefKey,
      worktree: fixture.workdir,
      branch: "story/evidence-publication",
      role: "evidence-orchestrator",
      agentId: "setfarm-evidence-orchestrator",
      evidenceRefs: [
        `setfarm://artifact/${lease.packetHash}`,
        `setfarm://artifact/${lease.contractSliceHash}`,
        `setfarm://artifact/${lease.priorEvidencePlanArtifactHash!}`,
      ],
    };
    const publication = createV3EvidenceOnlyPublication(database.sql);
    const raced = await Promise.allSettled([
      publication.reserve(lease, prepared, { now: at(1_000) }),
      publication.reserve(lease, prepared, { now: at(1_000) }),
    ]);
    assert.equal(raced.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(raced.filter((result) => result.status === "rejected").length, 1);
    const rows = await database.sql.unsafe<Array<{
      claims: number;
      attempts: number;
      delivery_state: string;
      delivery_claim_id: string | number | null;
      delivery_attempt_id: string | null;
      attempt_claim_id: string | number | null;
      runtime_count: number;
      publication_count: number;
      story_status: string;
      story_claimed_by: string | null;
    }>>(
      `SELECT
         (SELECT COUNT(*)::integer FROM claim_log
           WHERE run_id = $1 AND story_id = $2 AND outcome IS NULL) AS claims,
         (SELECT COUNT(*)::integer FROM execution_attempts
           WHERE recovery_dispatch_id = $3) AS attempts,
         delivery.state AS delivery_state,
         delivery.claim_id AS delivery_claim_id,
         delivery.attempt_id AS delivery_attempt_id,
         (SELECT attempt.claim_id
            FROM execution_attempts attempt
           WHERE attempt.attempt_id = delivery.attempt_id) AS attempt_claim_id,
         (SELECT COUNT(*)::integer
            FROM runtime_sessions runtime
           WHERE runtime.claim_id = delivery.claim_id) AS runtime_count,
         (SELECT COUNT(*)::integer
            FROM internal_production_v3_recovery_claim_publications_v1 publication
           WHERE publication.claim_id = delivery.claim_id
              OR publication.dispatch_id = delivery.dispatch_id) AS publication_count,
         story.status AS story_status,
         story.claimed_by AS story_claimed_by
       FROM recovery_dispatch_deliveries delivery
       JOIN stories story ON story.id = $4
       WHERE delivery.dispatch_id = $3`,
      [fixture.runId, fixture.slice.storyId, fixture.dispatch.dispatchId, fixture.storyDbId],
    );
    assert.deepEqual({
      claims: rows[0]?.claims,
      attempts: rows[0]?.attempts,
      deliveryState: rows[0]?.delivery_state,
      exactClaimPair: String(rows[0]?.delivery_claim_id) === String(rows[0]?.attempt_claim_id),
      hasAttempt: rows[0]?.delivery_attempt_id !== null,
      runtimeCount: rows[0]?.runtime_count,
      publicationCount: rows[0]?.publication_count,
      storyStatus: rows[0]?.story_status,
      storyClaimedBy: rows[0]?.story_claimed_by,
    }, {
      claims: 1,
      attempts: 1,
      deliveryState: "attempt_reserved",
      exactClaimPair: true,
      hasAttempt: true,
      runtimeCount: 0,
      publicationCount: 0,
      storyStatus: "failed",
      storyClaimedBy: null,
    });
    await assert.rejects(
      database.sql.unsafe(
        "UPDATE recovery_dispatch_deliveries SET claim_id=NULL WHERE dispatch_id=$1",
        [fixture.dispatch.dispatchId],
      ),
      /recovery_dispatch_deliveries_attempt_claim_check/,
    );
    await assert.rejects(
      database.sql.unsafe(
        "UPDATE recovery_dispatch_deliveries SET attempt_id=NULL WHERE dispatch_id=$1",
        [fixture.dispatch.dispatchId],
      ),
      /recovery_dispatch_deliveries_attempt_claim_check/,
    );
  });

  it("rolls back the operational claim when durable artifact publication is incomplete", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-publication-rollback" });
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({ fixture, verdict: "pass" }));
    const acquired = await worker.acquireNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-publication-rollback",
      leaseMs: 60_000,
    }, { now: at() });
    assert.ok(acquired);
    const lease = publicationLease(acquired);
    await assert.rejects(
      createV3EvidenceOnlyPublication(database.sql).reserve(lease, {
        compilationReportHash: COMPILATION_REPORT_HASH,
        sliceHash: lease.contractSliceHash,
        sliceRefKey: `SLICE_${sequence}_MISSING`,
        evidencePlanArtifactHash: lease.priorEvidencePlanArtifactHash!,
        evidencePlanRefKey: `EVIDENCE_PLAN_${sequence}_MISSING`,
        worktree: fixture.workdir,
        branch: "story/evidence-publication-rollback",
        agentId: "setfarm-evidence-orchestrator",
        evidenceRefs: [],
      }, { now: at(1_000) }),
      /V3_EVIDENCE_ONLY_PUBLICATION_ARTIFACT_INDEX_MISMATCH/,
    );
    const claims = await database.sql.unsafe<Array<{ count: number }>>(
      "SELECT COUNT(*)::integer AS count FROM claim_log WHERE run_id = $1 AND story_id = $2",
      [fixture.runId, fixture.slice.storyId],
    );
    const attempts = await database.sql.unsafe<Array<{ count: number }>>(
      "SELECT COUNT(*)::integer AS count FROM execution_attempts WHERE recovery_dispatch_id = $1",
      [fixture.dispatch.dispatchId],
    );
    const delivery = await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatch.dispatchId);
    assert.equal(claims[0]?.count, 0);
    assert.equal(attempts[0]?.count, 0);
    assert.equal(delivery?.state, "leased");
    assert.equal(delivery?.attemptId, undefined);
    assert.equal(delivery?.claimId, undefined);
  });

  it("rejects a positive model-publication candidate without parsing it and rolls child birth back", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-positive-model-authority" });
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({ fixture, verdict: "pass" }));
    const acquired = await worker.acquireNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-positive-model-authority",
      leaseMs: 60_000,
    }, { now: at() });
    assert.ok(acquired);
    const lease = publicationLease(acquired);
    const legacyClaims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id,step_id,story_id,agent_id,claimed_at)
      VALUES (${fixture.runId},'implement',${fixture.slice.storyId},'legacy-model-agent',${at(100)})
      RETURNING id::integer AS id
    `;
    const legacyClaimId = legacyClaims[0]!.id;
    const runtimeSessionId = `RTS_${"m".repeat(20)}-${sequence}`;
    await database.sql`
      UPDATE steps
         SET status='running', current_story_id=${fixture.storyDbId}
       WHERE id=${fixture.stepDbId}
    `;
    await database.sql`
      UPDATE stories
         SET status='running', claimed_by='legacy-model-agent', claimed_at=${at(100)}
       WHERE id=${fixture.storyDbId}
    `;
    await createRuntimeSessionRepository(database.sql).reserve({
      sessionId: runtimeSessionId,
      runId: fixture.runId,
      stepDbId: fixture.stepDbId,
      workflowStepId: "implement",
      storyDbId: fixture.storyDbId,
      storyId: fixture.slice.storyId,
      claimId: legacyClaimId,
      claimAgentId: "legacy-model-agent",
      runtimeAgentId: "legacy-model-runtime",
      runtimeKind: "local_process",
      ownerInstanceId: "legacy-model-owner",
    });
    await database.sql`
      UPDATE steps
         SET status='pending', current_story_id=NULL
       WHERE id=${fixture.stepDbId}
    `;
    await database.sql`
      UPDATE stories
         SET status='failed', claimed_by=NULL, claimed_at=NULL
       WHERE id=${fixture.storyDbId}
    `;
    await database.sql`
      UPDATE claim_log
         SET outcome='infra_retry', abandoned_at=${at(200)}, diagnostic='legacy positive candidate'
       WHERE id=${legacyClaimId}
    `;
    await database.sql`
      INSERT INTO internal_production_v3_recovery_claim_publications_v1 (
        claim_id,runtime_session_id,run_id,step_db_id,workflow_step_id,
        story_db_id,story_id,story_index,recovery_case_id,revision_id,
        dispatch_id,status,handoff_canonical_json,handoff_hash,bound_at
      ) VALUES (
        ${legacyClaimId},${runtimeSessionId},${fixture.runId},${fixture.stepDbId},'implement',
        ${fixture.storyDbId},${fixture.slice.storyId},1,${lease.recoveryCaseId},${lease.revisionId},
        ${lease.dispatchId},'lease_acquired','{}',${"0".repeat(64)},${at(300)}
      )
    `;
    const sliceRefKey = `SLICE_${sequence}_POSITIVE_MODEL`;
    const planRefKey = `EVIDENCE_PLAN_${sequence}_POSITIVE_MODEL`;
    await indexPublicationArtifacts({
      runId: fixture.runId,
      sliceHash: lease.contractSliceHash,
      planHash: lease.priorEvidencePlanArtifactHash!,
      sliceRefKey,
      planRefKey,
    });
    const headBefore = await database.sql<Array<{ head_version: number }>>`
      SELECT head_version FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
    `;
    await assert.rejects(
      createV3EvidenceOnlyPublication(database.sql).reserve(lease, {
        compilationReportHash: COMPILATION_REPORT_HASH,
        sliceHash: lease.contractSliceHash,
        sliceRefKey,
        evidencePlanArtifactHash: lease.priorEvidencePlanArtifactHash!,
        evidencePlanRefKey: planRefKey,
        worktree: fixture.workdir,
        branch: "story/evidence-positive-model-authority",
        role: "evidence-orchestrator",
        agentId: "setfarm-evidence-orchestrator",
        evidenceRefs: [],
      }, { now: at(1_000) }),
      /V3_EVIDENCE_ONLY_PUBLICATION_MODEL_AUTHORITY_FORBIDDEN/,
    );
    const residue = await database.sql<Array<{
      open_claims: number;
      attempts: number;
      delivery_state: string;
      delivery_claim_id: string | null;
      delivery_attempt_id: string | null;
    }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM claim_log claim
          WHERE claim.run_id=${fixture.runId}
            AND claim.story_id=${fixture.slice.storyId}
            AND claim.outcome IS NULL) AS open_claims,
        (SELECT COUNT(*)::integer FROM execution_attempts attempt
          WHERE attempt.recovery_dispatch_id=${lease.dispatchId}) AS attempts,
        delivery.state AS delivery_state,
        delivery.claim_id::text AS delivery_claim_id,
        delivery.attempt_id AS delivery_attempt_id
        FROM recovery_dispatch_deliveries delivery
       WHERE delivery.dispatch_id=${lease.dispatchId}
    `;
    assert.deepEqual({ ...residue[0]! }, {
      open_claims: 0,
      attempts: 0,
      delivery_state: "leased",
      delivery_claim_id: null,
      delivery_attempt_id: null,
    });
    const headAfter = await database.sql<Array<{ head_version: number }>>`
      SELECT head_version FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
    `;
    assert.equal(headAfter[0]!.head_version, headBefore[0]!.head_version);
  });

  it("rolls claim, attempt, both owner births, and delivery pair back when the pair CAS is rejected", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-pair-cas-rollback" });
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({ fixture, verdict: "pass" }));
    const acquired = await worker.acquireNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-pair-cas-rollback",
      leaseMs: 60_000,
    }, { now: at() });
    assert.ok(acquired);
    const lease = publicationLease(acquired);
    const sliceRefKey = `SLICE_${sequence}_PAIR_ROLLBACK`;
    const planRefKey = `EVIDENCE_PLAN_${sequence}_PAIR_ROLLBACK`;
    await indexPublicationArtifacts({
      runId: fixture.runId,
      sliceHash: lease.contractSliceHash,
      planHash: lease.priorEvidencePlanArtifactHash!,
      sliceRefKey,
      planRefKey,
    });
    const headBefore = await database.sql<Array<{ head_version: number }>>`
      SELECT head_version FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE
    `;
    const functionName = `test_reject_evidence_pair_${sequence}`;
    const triggerName = `trg_reject_evidence_pair_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF NEW.dispatch_id='${lease.dispatchId}' AND NEW.state='attempt_reserved' THEN
             RAISE EXCEPTION 'TEST_EVIDENCE_PAIR_CAS_REJECTED';
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
        createV3EvidenceOnlyPublication(database.sql).reserve(lease, {
          compilationReportHash: COMPILATION_REPORT_HASH,
          sliceHash: lease.contractSliceHash,
          sliceRefKey,
          evidencePlanArtifactHash: lease.priorEvidencePlanArtifactHash!,
          evidencePlanRefKey: planRefKey,
          worktree: fixture.workdir,
          branch: "story/evidence-pair-cas-rollback",
          role: "evidence-orchestrator",
          agentId: "setfarm-evidence-orchestrator",
          evidenceRefs: [],
        }, { now: at(1_000) }),
        /TEST_EVIDENCE_PAIR_CAS_REJECTED/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON recovery_dispatch_deliveries`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
    const residue = await database.sql<Array<{
      claims: number;
      attempts: number;
      delivery_state: string;
      claim_id: string | null;
      attempt_id: string | null;
      head_version: number;
    }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM claim_log claim
          WHERE claim.run_id=${fixture.runId} AND claim.story_id=${fixture.slice.storyId}) AS claims,
        (SELECT COUNT(*)::integer FROM execution_attempts attempt
          WHERE attempt.recovery_dispatch_id=${lease.dispatchId}) AS attempts,
        delivery.state AS delivery_state,delivery.claim_id::text,delivery.attempt_id,
        head.head_version
        FROM recovery_dispatch_deliveries delivery
        JOIN internal_production_owner_admission_head_v1 head ON head.singleton=TRUE
       WHERE delivery.dispatch_id=${lease.dispatchId}
    `;
    assert.deepEqual({ ...residue[0]! }, {
      claims: 0,
      attempts: 0,
      delivery_state: "leased",
      claim_id: null,
      attempt_id: null,
      head_version: headBefore[0]!.head_version,
    });
  });

  it("rolls back attempt running when delivery running publication fails in the same transaction", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-running-atomic" });
    const owner = await publishEvidenceOwner({
      fixture,
      ownerInstanceId: "evidence-running-atomic",
    });
    await database.sql.unsafe(
      "UPDATE recovery_dispatch_deliveries SET diagnostic = 'TEST_FAIL_RUNNING' WHERE dispatch_id = $1",
      [fixture.dispatch.dispatchId],
    );
    const functionName = `test_fail_evidence_running_${sequence}`;
    const triggerName = `trg_fail_evidence_running_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF OLD.diagnostic = 'TEST_FAIL_RUNNING' AND NEW.state = 'running' THEN
             RAISE EXCEPTION 'TEST_FORCED_RUNNING_PUBLICATION_FAILURE';
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
        owner.publication.markRunning({
          lease: owner.lease,
          attempt: owner.attempt,
          now: at(2_000),
        }),
        /TEST_FORCED_RUNNING_PUBLICATION_FAILURE/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON recovery_dispatch_deliveries`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
    assert.equal((await createAttemptRepository(database.sql).findById(owner.attempt.attemptId))?.disposition, "claimed");
    assert.equal((await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatch.dispatchId))?.state, "attempt_reserved");
  });

  it("rolls back durable evidence and the terminal attempt when its exact owner close rejects", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-terminal-atomic" });
    const owner = await publishEvidenceOwner({
      fixture,
      ownerInstanceId: "evidence-terminal-atomic",
    });
    await owner.publication.markRunning({
      lease: owner.lease,
      attempt: owner.attempt,
      now: at(2_000),
    });
    const evidence = canonicalEvidence({
      runId: fixture.runId,
      attemptId: owner.attempt.attemptId,
      slice: fixture.slice,
      sliceHash: fixture.sliceHash,
      verdict: "pass",
      salt: "terminal-atomic-rollback",
    });
    await database.sql.unsafe(
      "UPDATE recovery_dispatch_deliveries SET diagnostic = 'TEST_FAIL_TERMINAL' WHERE dispatch_id = $1",
      [fixture.dispatch.dispatchId],
    );
    const functionName = `test_fail_evidence_terminal_${sequence}`;
    const triggerName = `trg_fail_evidence_terminal_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
         BEGIN
           IF NEW.category='execution-attempt' AND NEW.state='closed'
              AND EXISTS (SELECT 1 FROM recovery_dispatch_deliveries delivery
                           WHERE delivery.attempt_id=NEW.owner_key
                             AND delivery.diagnostic='TEST_FAIL_TERMINAL') THEN
             RAISE EXCEPTION 'TEST_FORCED_TERMINAL_PUBLICATION_FAILURE';
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${triggerName}
         BEFORE UPDATE ON internal_production_owner_reservations_v1
         FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
      );
      await assert.rejects(
        owner.publication.completeAttempt({
          lease: owner.lease,
          attempt: owner.attempt,
          disposition: "verified",
          bundle: evidence.bundle,
          now: at(3_000),
        }),
        /TEST_FORCED_TERMINAL_PUBLICATION_FAILURE/,
      );
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON internal_production_owner_reservations_v1`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
    const bundles = await database.sql.unsafe<Array<{ count: number }>>(
      "SELECT COUNT(*)::integer AS count FROM evidence_bundles WHERE attempt_id = $1",
      [owner.attempt.attemptId],
    );
    assert.equal(bundles[0]?.count, 0);
    assert.equal((await createAttemptRepository(database.sql).findById(owner.attempt.attemptId))?.disposition, "running");
    assert.equal((await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatch.dispatchId))?.state, "running");
  });

  it("repairs the historical attempt-running delivery-reserved crash seam without a model or rerun", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-running-reconcile" });
    const owner = await publishEvidenceOwner({
      fixture,
      ownerInstanceId: "evidence-running-reconcile",
    });
    await database.sql.unsafe(
      "UPDATE execution_attempts SET disposition = 'running' WHERE attempt_id = $1 AND disposition = 'claimed'",
      [owner.attempt.attemptId],
    );
    const report = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: at(3_000) },
    );
    assert.equal(report.counts.advancedRunning, 1);
    assert.equal(report.events[0]?.code, "V3_RECOVERY_LIFECYCLE_EVIDENCE_RUNNING_ADVANCED");
    assert.equal((await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatch.dispatchId))?.state, "running");
    assert.equal((await createAttemptRepository(database.sql).findById(owner.attempt.attemptId))?.disposition, "running");
  });

  it("boundedly blocks one evidence owner when either half of the atomic lease fence expires", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-expired-owner" });
    const owner = await publishEvidenceOwner({
      fixture,
      ownerInstanceId: "evidence-expired-owner",
      leaseMs: 30_000,
    });
    await database.sql.unsafe(
      "UPDATE execution_attempts SET lease_expires_at = date_trunc('milliseconds', clock_timestamp()) + interval '10 minutes' WHERE attempt_id = $1",
      [owner.attempt.attemptId],
    );
    await database.sql.unsafe(
      "UPDATE recovery_dispatch_deliveries SET lease_expires_at = date_trunc('milliseconds', clock_timestamp()) - interval '1 second' WHERE dispatch_id = $1",
      [owner.lease.dispatchId],
    );
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const closeFunction = `test_reject_expired_evidence_close_${sequence}`;
    const closeTrigger = `trg_reject_expired_evidence_close_${sequence}`;
    try {
      await database.sql.unsafe(
        `CREATE FUNCTION ${closeFunction}() RETURNS trigger AS $$ BEGIN
           IF NEW.category='execution-attempt' AND NEW.owner_key='${owner.attempt.attemptId}'
              AND NEW.state='closed' THEN RAISE EXCEPTION 'TEST_EXPIRED_EVIDENCE_CLOSE_REJECTED'; END IF;
           RETURN NEW;
         END $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${closeTrigger} BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
         FOR EACH ROW EXECUTE FUNCTION ${closeFunction}()`,
      );
      await assert.rejects(
        reconciler.reconcileActive({ runId: fixture.runId }),
        /TEST_EXPIRED_EVIDENCE_CLOSE_REJECTED/,
      );
      assert.equal((await createAttemptRepository(database.sql).findById(owner.attempt.attemptId))?.disposition, "claimed");
    } finally {
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${closeTrigger} ON internal_production_owner_reservations_v1`);
      await database.sql.unsafe(`DROP FUNCTION IF EXISTS ${closeFunction}()`);
    }
    const reports = await Promise.all([
      reconciler.reconcileActive({ runId: fixture.runId }, { now: new Date("1900-01-01T00:00:00.000Z") }),
      reconciler.reconcileActive({ runId: fixture.runId }, { now: new Date("2999-01-01T00:00:00.000Z") }),
    ]);
    assert.equal(
      reports.reduce((sum, report) => sum + report.counts.blockedExpiredEvidenceAttempts, 0),
      1,
      JSON.stringify(reports.map((report) => report.events)),
    );
    const attempt = await createAttemptRepository(database.sql).findById(owner.attempt.attemptId);
    assert.equal(attempt?.disposition, "inconclusive");
    assert.equal((await database.sql.unsafe<Array<{ state: string }>>(
      "SELECT state FROM internal_production_owner_reservations_v1 WHERE category='execution-attempt' AND owner_key=$1",
      [owner.attempt.attemptId],
    ))[0]?.state, "closed");
    const claims = await database.sql.unsafe<Array<{ outcome: string | null }>>(
      "SELECT outcome FROM claim_log WHERE id = $1",
      [owner.attempt.claimId!],
    );
    assert.equal(claims[0]?.outcome, "infra_retry");
    assert.equal((await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatch.dispatchId))?.state, "blocked");
    const rows = await database.sql.unsafe<Array<{
      case_status: string;
      story_status: string;
      story_claimed_by: string | null;
    }>>(
      `SELECT recovery_case.status AS case_status,
              story.status AS story_status,
              story.claimed_by AS story_claimed_by
         FROM recovery_cases recovery_case
         JOIN stories story ON story.id = $2
        WHERE recovery_case.recovery_case_id = $1`,
      [fixture.recoveryCase.recoveryCaseId, fixture.storyDbId],
    );
    assert.deepEqual({ ...rows[0]! }, {
      case_status: "blocked",
      story_status: "failed",
      story_claimed_by: null,
    });
  });

  it("heartbeats the exact evidence delivery and attempt while a long command is executing", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-heartbeat" });
    const startedAt = new Date();
    let observedPeriodicHeartbeat = false;
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({
      fixture,
      verdict: "pass",
      attemptNow: new Date(startedAt.getTime() + 1),
      onExecute: async () => {
        const before = await database.sql.unsafe<Array<{
          attempt_heartbeat: Date;
          delivery_updated: Date;
        }>>(
          `SELECT attempt.heartbeat_at AS attempt_heartbeat,
                  delivery.updated_at AS delivery_updated
             FROM execution_attempts attempt
             JOIN recovery_dispatch_deliveries delivery
               ON delivery.attempt_id = attempt.attempt_id
            WHERE attempt.recovery_dispatch_id = $1`,
          [fixture.dispatch.dispatchId],
        );
        await new Promise<void>((resolve) => setTimeout(resolve, 45));
        const after = await database.sql.unsafe<Array<{
          attempt_heartbeat: Date;
          delivery_updated: Date;
          attempt_expiry: Date;
          delivery_expiry: Date;
        }>>(
          `SELECT attempt.heartbeat_at AS attempt_heartbeat,
                  delivery.updated_at AS delivery_updated,
                  attempt.lease_expires_at AS attempt_expiry,
                  delivery.lease_expires_at AS delivery_expiry
             FROM execution_attempts attempt
             JOIN recovery_dispatch_deliveries delivery
               ON delivery.attempt_id = attempt.attempt_id
            WHERE attempt.recovery_dispatch_id = $1`,
          [fixture.dispatch.dispatchId],
        );
        observedPeriodicHeartbeat = Boolean(
          before[0]
          && after[0]
          && after[0].attempt_heartbeat.getTime() > before[0].attempt_heartbeat.getTime()
          && after[0].delivery_updated.getTime() > before[0].delivery_updated.getTime()
          && after[0].attempt_expiry.getTime() === after[0].delivery_expiry.getTime(),
        );
      },
    }), {
      ownerHeartbeatIntervalMs: 5,
      ownerLeaseMs: 30_000,
    });
    const result = await worker.runNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-heartbeat-owner",
      leaseMs: 30_000,
    }, { now: startedAt });
    assert.ok(result);
    assert.equal(observedPeriodicHeartbeat, true);
    assert.equal(result.coordinator.status, "resolved");
  });

  it("reruns unchanged-source evidence once and resolves a passing case", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-only-pass" });
    let executions = 0;
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({
      fixture,
      verdict: "pass",
      onExecute: () => { executions += 1; },
    }));
    const result = await worker.runNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-pass-worker",
      leaseMs: 60_000,
    }, { now: new Date("2999-01-01T00:00:00.000Z") });
    assert.ok(result);
    assert.equal(executions, 1);
    assert.equal(result.execution, "executed");
    assert.equal(result.coordinator.status, "resolved");

    const delivery = await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatch.dispatchId);
    assert.equal(delivery?.state, "succeeded");
    const attempt = await createAttemptRepository(database.sql).findById(result.attemptId);
    assert.equal(attempt?.disposition, "verified");
    assert.equal((await database.sql.unsafe<Array<{ state: string }>>(
      "SELECT state FROM internal_production_owner_reservations_v1 WHERE category='execution-attempt' AND owner_key=$1",
      [result.attemptId],
    ))[0]?.state, "closed");
    assert.deepEqual(attempt?.sourceAfter, SOURCE_REVISION);
    const claims = await database.sql.unsafe<Array<{ outcome: string | null }>>(
      "SELECT outcome FROM claim_log WHERE id = $1",
      [attempt!.claimId!],
    );
    assert.equal(claims[0]?.outcome, "completed");
    const clocks = await database.sql.unsafe<Array<{
      attempt_heartbeat: Date | string;
      delivery_updated: Date | string;
      recovery_updated: Date | string;
    }>>(
      `SELECT attempt.heartbeat_at AS attempt_heartbeat,
              delivery.updated_at AS delivery_updated,
              recovery.updated_at AS recovery_updated
         FROM execution_attempts attempt
         JOIN recovery_dispatch_deliveries delivery
           ON delivery.attempt_id = attempt.attempt_id
         JOIN recovery_cases recovery
           ON recovery.recovery_case_id = delivery.recovery_case_id
        WHERE attempt.attempt_id = $1`,
      [result.attemptId],
    );
    const hostileClock = new Date("2999-01-01T00:00:00.000Z").getTime();
    assert.ok(new Date(clocks[0]!.attempt_heartbeat).getTime() < hostileClock);
    assert.ok(new Date(clocks[0]!.delivery_updated).getTime() < hostileClock);
    assert.ok(new Date(clocks[0]!.recovery_updated).getTime() < hostileClock);
  });

  it("publishes typed findings for failed evidence and boundedly blocks unchanged retry", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-only-fail" });
    const result = await createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({
      fixture,
      verdict: "fail",
    })).runNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-fail-worker",
      leaseMs: 60_000,
    }, { now: at() });
    assert.ok(result);
    assert.equal(result.coordinator.status, "blocked");
    if (result.coordinator.status === "blocked") {
      assert.equal(result.coordinator.reasonCode, "evidence_inconclusive");
    }
    const attempt = await createAttemptRepository(database.sql).findById(result.attemptId);
    assert.equal(attempt?.disposition, "no_progress");
    assert.equal(attempt?.evidenceRefs.filter((ref) => ref.startsWith("setfarm://finding-set/")).length, 1);
    const delivery = await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatch.dispatchId);
    assert.equal(delivery?.state, "failed");
    const cases = await database.sql.unsafe<Array<{ status: string; used_evidence_only: number }>>(
      "SELECT status, used_evidence_only FROM recovery_cases WHERE recovery_case_id = $1",
      [fixture.recoveryCase.recoveryCaseId],
    );
    assert.equal(cases[0]?.status, "blocked");
    assert.equal(cases[0]?.used_evidence_only, 1);
  });

  it("replays a terminal durable attempt after a coordinator-boundary crash without rerunning evidence", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-only-replay" });
    let executions = 0;
    const crashing = dependencies({
      fixture,
      verdict: "pass",
      onExecute: () => { executions += 1; },
      completeClaim: async () => {
        throw new Error("simulated crash after terminal evidence");
      },
    });
    const first = createV3EvidenceOnlyRecoveryWorker(database.sql, crashing);
    await assert.rejects(first.runNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "stable-evidence-worker",
      leaseMs: 60_000,
    }, { now: at() }), /claim_completion/);
    assert.equal(executions, 1);
    assert.equal((await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatch.dispatchId))?.state, "running");
    const lifecycle = await createV3RecoveryLifecycleReconciler(database.sql).reconcileActive(
      { runId: fixture.runId },
      { now: at(5_000) },
    );
    assert.equal(lifecycle.counts.noops, 1);
    assert.equal(lifecycle.events[0]?.code, "V3_RECOVERY_LIFECYCLE_EVIDENCE_REPLAY_PENDING");

    const resumed = await createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({
      fixture,
      verdict: "pass",
      onExecute: () => { executions += 1; },
    })).runNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "stable-evidence-worker",
      leaseMs: 60_000,
    }, { now: at(10_000) });
    assert.ok(resumed);
    assert.equal(resumed.execution, "replayed");
    assert.equal(resumed.coordinator.status, "resolved");
    assert.equal(executions, 1);
  });

  it("quarantines source mutation instead of retrying unchanged evidence", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-only-source-mutation" });
    let captures = 0;
    const mutated = { sha: "4".repeat(40), treeHash: "5".repeat(40) };
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({
      fixture,
      verdict: "pass",
      captureSource: () => {
        captures += 1;
        return captures === 1 ? SOURCE_REVISION : mutated;
      },
    }));
    await assert.rejects(worker.runNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-source-fence-worker",
      leaseMs: 60_000,
    }, { now: at() }), /V3_EVIDENCE_ONLY_SOURCE_MUTATED/);
    const rows = await database.sql.unsafe<Array<{ state: string; diagnostic: string | null }>>(
      "SELECT state, diagnostic FROM recovery_dispatch_deliveries WHERE dispatch_id = $1",
      [fixture.dispatch.dispatchId],
    );
    assert.equal(rows[0]?.state, "blocked");
    assert.match(rows[0]?.diagnostic ?? "", /V3_EVIDENCE_ONLY_QUARANTINED:evidence_execution/);
    const cases = await database.sql.unsafe<Array<{
      status: string;
      terminal: { owner: string; outcome: string; reasonCode: string; evidenceBundleHashes: string[] } | null;
    }>>(
      "SELECT status, terminal FROM recovery_cases WHERE recovery_case_id = $1",
      [fixture.recoveryCase.recoveryCaseId],
    );
    assert.equal(cases[0]?.status, "blocked");
    assert.deepEqual(cases[0]?.terminal, {
      owner: "infrastructure",
      outcome: "blocked",
      reasonCode: "operator_required",
      evidenceBundleHashes: [],
    });
    const owners = await database.sql.unsafe<Array<{
      disposition: string;
      outcome: string | null;
      source_after_sha: string | null;
    }>>(
      `SELECT attempt.disposition, claim.outcome, attempt.source_after_sha
         FROM execution_attempts attempt
         JOIN claim_log claim ON claim.id = attempt.claim_id
        WHERE attempt.recovery_dispatch_id = $1`,
      [fixture.dispatch.dispatchId],
    );
    assert.deepEqual({ ...owners[0]! }, {
      disposition: "inconclusive",
      outcome: "infra_retry",
      source_after_sha: null,
    });
    assert.equal((await database.sql.unsafe<Array<{ state: string }>>(
      "SELECT owner.state FROM internal_production_owner_reservations_v1 owner JOIN execution_attempts attempt ON attempt.attempt_id=owner.owner_key WHERE owner.category='execution-attempt' AND attempt.recovery_dispatch_id=$1",
      [fixture.dispatch.dispatchId],
    ))[0]?.state, "closed");
    assert.equal(await worker.acquireNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-source-fence-worker",
    }), undefined);
  });

  it("rolls the complete quarantine owner chain back when its attempt close rejects", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-only-quarantine-close-rollback" });
    let captures = 0;
    const mutated = { sha: "6".repeat(40), treeHash: "7".repeat(40) };
    await database.sql.unsafe(`
      CREATE FUNCTION reject_quarantine_attempt_close_v1() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.category='execution-attempt' AND NEW.state='closed' THEN
          RAISE EXCEPTION 'TEST_QUARANTINE_ATTEMPT_CLOSE_REJECTED';
        END IF;
        RETURN NEW;
      END $$
    `);
    await database.sql.unsafe(`
      CREATE TRIGGER reject_quarantine_attempt_close_v1
      BEFORE UPDATE OF state ON internal_production_owner_reservations_v1
      FOR EACH ROW EXECUTE FUNCTION reject_quarantine_attempt_close_v1()
    `);
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({
      fixture,
      verdict: "pass",
      captureSource: () => {
        captures += 1;
        return captures === 1 ? SOURCE_REVISION : mutated;
      },
    }));
    await assert.rejects(worker.runNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-quarantine-close-worker",
      leaseMs: 60_000,
    }, { now: at() }), /V3_EVIDENCE_ONLY_SOURCE_MUTATED/);
    const rows = (await database.sql<Array<{
      delivery_state: string;
      case_status: string;
      disposition: string;
      claim_outcome: string | null;
      claim_owner_state: string;
      attempt_owner_state: string;
    }>>`
      SELECT delivery.state AS delivery_state,recovery_case.status AS case_status,
             attempt.disposition,claim.outcome AS claim_outcome,
             claim_owner.state AS claim_owner_state,attempt_owner.state AS attempt_owner_state
        FROM recovery_dispatch_deliveries delivery
        JOIN recovery_cases recovery_case
          ON recovery_case.recovery_case_id=delivery.recovery_case_id
        JOIN execution_attempts attempt ON attempt.attempt_id=delivery.attempt_id
        JOIN claim_log claim ON claim.id=attempt.claim_id
        JOIN internal_production_owner_reservations_v1 claim_owner
          ON claim_owner.category='claim' AND claim_owner.owner_key=claim.id::text
        JOIN internal_production_owner_reservations_v1 attempt_owner
          ON attempt_owner.category='execution-attempt' AND attempt_owner.owner_key=attempt.attempt_id
       WHERE delivery.dispatch_id=${fixture.dispatch.dispatchId}
    `)[0]!;
    assert.deepEqual({ ...rows }, {
      delivery_state: "running",
      case_status: "evidencing",
      disposition: "running",
      claim_outcome: null,
      claim_owner_state: "bound",
      attempt_owner_state: "bound",
    });
  });

  it("does not quarantine through a non-finite delivery lease", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-only-nonfinite-lease" });
    const baseDependencies = dependencies({ fixture, verdict: "pass" });
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, {
      ...baseDependencies,
      loadOrReserveAttempt: async () => {
        throw new Error("TEST_ATTEMPT_CONTEXT_FAILURE");
      },
    });
    const lease = await worker.acquireNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-nonfinite-lease-worker",
      leaseMs: 60_000,
    });
    assert.ok(lease);
    await database.sql.unsafe(
      "UPDATE recovery_dispatch_deliveries SET lease_expires_at = 'infinity'::timestamptz WHERE dispatch_id = $1",
      [fixture.dispatch.dispatchId],
    );

    await assert.rejects(worker.runLease(lease), /TEST_ATTEMPT_CONTEXT_FAILURE/);
    const rows = await database.sql.unsafe<Array<{
      delivery_state: string;
      case_status: string;
    }>>(
      `SELECT delivery.state AS delivery_state, recovery_case.status AS case_status
         FROM recovery_dispatch_deliveries delivery
         JOIN recovery_cases recovery_case
           ON recovery_case.recovery_case_id = delivery.recovery_case_id
        WHERE delivery.dispatch_id = $1`,
      [fixture.dispatch.dispatchId],
    );
    assert.deepEqual({ ...rows[0]! }, {
      delivery_state: "leased",
      case_status: "evidencing",
    });
  });

  it("leaves a forged recovery chain unleased", async () => {
    const fixture = await setup({ workflowId: "workflow-evidence-only-forged" });
    await database.sql.unsafe(
      "UPDATE recovery_dispatch_deliveries SET story_id = $2 WHERE dispatch_id = $1",
      [fixture.dispatch.dispatchId, `${fixture.slice.storyId}-forged`],
    );
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, dependencies({ fixture, verdict: "pass" }));
    assert.equal(await worker.acquireNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-forged-worker",
    }), undefined);
    const deliveries = await database.sql.unsafe<Array<{
      state: string;
      owner_instance_id: string | null;
    }>>(
      "SELECT state, owner_instance_id FROM recovery_dispatch_deliveries WHERE dispatch_id = $1",
      [fixture.dispatch.dispatchId],
    );
    assert.equal(deliveries[0]?.state, "authorized");
    assert.equal(deliveries[0]?.owner_instance_id, null);
  });
});
