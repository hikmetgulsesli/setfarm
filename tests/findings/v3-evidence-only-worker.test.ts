import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { computeObservationRef, createEvidenceBundleV2 } from "../../src/evidence/evidence-bundle-v2.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
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
          const claims = await database.sql.unsafe<Array<{ id: number }>>(
            `INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
             VALUES ($1, 'implement', $2, $3)
             RETURNING id::integer AS id`,
            [lease.runId, lease.storyId, agentId],
          );
          const claimId = claims[0]!.id;
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
      hasClaim: rows[0]?.delivery_claim_id !== null,
      hasAttempt: rows[0]?.delivery_attempt_id !== null,
      storyStatus: rows[0]?.story_status,
      storyClaimedBy: rows[0]?.story_claimed_by,
    }, {
      claims: 1,
      attempts: 1,
      deliveryState: "attempt_reserved",
      hasClaim: true,
      hasAttempt: true,
      storyStatus: "failed",
      storyClaimedBy: null,
    });
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

  it("rolls back durable evidence artifacts when terminal attempt publication fails", async () => {
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
           IF NEW.disposition NOT IN ('claimed', 'running', 'superseded')
              AND EXISTS (
                SELECT 1 FROM recovery_dispatch_deliveries delivery
                 WHERE delivery.attempt_id = NEW.attempt_id
                   AND delivery.diagnostic = 'TEST_FAIL_TERMINAL'
              ) THEN
             RAISE EXCEPTION 'TEST_FORCED_TERMINAL_PUBLICATION_FAILURE';
           END IF;
           RETURN NEW;
         END;
         $$ LANGUAGE plpgsql`,
      );
      await database.sql.unsafe(
        `CREATE TRIGGER ${triggerName}
         BEFORE UPDATE ON execution_attempts
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
      await database.sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON execution_attempts`);
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
    const deliveryExpiresAt = new Date(owner.lease.leaseExpiresAt);
    await database.sql.unsafe(
      "UPDATE execution_attempts SET lease_expires_at = $2 WHERE attempt_id = $1",
      [owner.attempt.attemptId, new Date(deliveryExpiresAt.getTime() + 10 * 60_000)],
    );
    const reconciler = createV3RecoveryLifecycleReconciler(database.sql);
    const reconcileAt = new Date(deliveryExpiresAt.getTime() + 1);
    const reports = await Promise.all([
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
      reconciler.reconcileActive({ runId: fixture.runId }, { now: reconcileAt }),
    ]);
    assert.equal(
      reports.reduce((sum, report) => sum + report.counts.blockedExpiredEvidenceAttempts, 0),
      1,
    );
    const attempt = await createAttemptRepository(database.sql).findById(owner.attempt.attemptId);
    assert.equal(attempt?.disposition, "inconclusive");
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
    }, { now: at() });
    assert.ok(result);
    assert.equal(executions, 1);
    assert.equal(result.execution, "executed");
    assert.equal(result.coordinator.status, "resolved");

    const delivery = await createRecoveryDeliveryRepository(database.sql).findDelivery(fixture.dispatch.dispatchId);
    assert.equal(delivery?.state, "succeeded");
    const attempt = await createAttemptRepository(database.sql).findById(result.attemptId);
    assert.equal(attempt?.disposition, "verified");
    assert.deepEqual(attempt?.sourceAfter, SOURCE_REVISION);
    const claims = await database.sql.unsafe<Array<{ outcome: string | null }>>(
      "SELECT outcome FROM claim_log WHERE id = $1",
      [attempt!.claimId!],
    );
    assert.equal(claims[0]?.outcome, "completed");
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
    assert.equal(await worker.acquireNext({
      workflowId: fixture.workflowId,
      ownerInstanceId: "evidence-source-fence-worker",
    }), undefined);
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
