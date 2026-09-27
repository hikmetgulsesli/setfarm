import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createEvidenceBundleV2, computeObservationRef } from "../../src/evidence/evidence-bundle-v2.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  beginOrAdoptInternalProductionOwnerReservationV1,
  bindInternalProductionOwnerReservationV1,
  createInternalProductionWorkflowRunCanonicalOwnerIdentityV1,
  type PgTransactionSql,
} from "../../src/db-pg.js";
import { acquireClaimMutationAuthorityInTransaction } from "../../src/execution/claim-mutation-authority.js";
import {
  insertAndBindInternalProductionClaimBirthV1,
  prepareInternalProductionClaimBirthV1,
  publishLoopClaimRuntime,
} from "../../src/execution/claim-runtime-publication.js";
import { releaseReservedRuntimeSessionInTransaction } from "../../src/execution/runtime-session-repository.js";
import {
  createRunTerminationRepository,
  requestRunTermination,
} from "../../src/execution/run-termination.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { ImplementationSliceV1Schema, type ImplementationSliceV1 } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { createV3RecoveryClaimAuthority } from "../../src/recovery/v3-recovery-claim-authority.js";
import { V3EvidenceOnlyRuntimeError, resolveExactPriorSourceOwner } from "../../src/recovery/v3-evidence-only-runtime.js";
import type { RecoveryCaseRevisionV1, RecoveryRevisionDispatchV1 } from "../../src/recovery/recovery-delivery.js";
import {
  V3RecoveryCoordinatorInputSchema,
  computeMachineEvidenceFingerprintV1,
  computeV3RecoveryCoordinatorEventHashV1,
  createV3RecoveryCoordinator,
} from "../../src/recovery/v3-recovery-coordinator.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
import { seedCanonicalCompilerStoryAdmissionFixture } from "../execution-attempts/helpers/compiler-story-english-admission-fixture.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const COMPILATION_REPORT = "9".repeat(64);
const canonicalAdmissionByRunId = new Map<
  string,
  Awaited<ReturnType<typeof seedCanonicalCompilerStoryAdmissionFixture>>
>();

function source(seed: string): { sha: string; treeHash: string } {
  return { sha: seed.repeat(40), treeHash: seed.toUpperCase().charCodeAt(0).toString(16).slice(-1).repeat(40) };
}

function baseSlice(): ImplementationSliceV1 {
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
  });
}

function sliceHash(label: string): string {
  return hashCanonicalJson({ schema: "setfarm.test-slice-identity.v1", label });
}

function planArtifactHash(plan: ReturnType<typeof compileEvidencePlanV1>): string {
  return hashCanonicalJson({ schema: "setfarm.test-evidence-plan-artifact.v1", plan });
}

function evidenceBundle(input: Readonly<{
  runId: string;
  attemptId: string;
  slice: ImplementationSliceV1;
  sliceHash: string;
  sourceRevision: { sha: string; treeHash: string };
  productVerdict: "pass" | "fail" | "inconclusive";
  semanticSalt: string;
  failedCommandRef?: string;
  clockDate?: string;
  runtimeSessionId?: string;
}>) {
  const clockDate = input.clockDate ?? "2026-07-13";
  const plan = compileEvidencePlanV1({ slice: input.slice, sliceHash: input.sliceHash });
  const flow = plan.flows[0]!;
  const beforeHash = hashCanonicalJson({ salt: input.semanticSalt, artifact: "before" });
  const afterHash = hashCanonicalJson({ salt: input.semanticSalt, artifact: "after" });
  const control = {
    kind: "control" as const,
    owner: "setfarm-orchestrator" as const,
    actionRef: flow.actionRef,
    ...(flow.controlRef ? { controlRef: flow.controlRef } : {}),
    beforeArtifactHash: beforeHash,
    afterArtifactHash: afterHash,
    startedAt: `${clockDate}T10:00:00.000Z`,
    completedAt: `${clockDate}T10:00:01.000Z`,
  };
  const runtimeArtifactHash = hashCanonicalJson({ salt: input.semanticSalt, artifact: "runtime" });
  const runtime = {
    kind: "runtime" as const,
    owner: "setfarm-orchestrator" as const,
    runtimeSessionId: input.runtimeSessionId ?? "runtime-fingerprint-default",
    runtimeArtifactHash,
    stateBeforeHash: beforeHash,
    stateAfterHash: afterHash,
    startedAt: `${clockDate}T10:00:00.000Z`,
    completedAt: `${clockDate}T10:00:01.000Z`,
  };
  const commandData = plan.commands.map((command, index) => {
    const stdoutArtifactHash = hashCanonicalJson({ salt: input.semanticSalt, command: command.commandRef });
    const observation = {
      kind: "command" as const,
      owner: "setfarm-orchestrator" as const,
      commandRef: command.commandRef,
      exitCode: command.commandRef === input.failedCommandRef ? 1 : 0,
      stdoutArtifactHash,
      startedAt: `${clockDate}T10:00:0${index + 2}.000Z`,
      completedAt: `${clockDate}T10:00:0${index + 2}.500Z`,
    };
    return { command, observation, stdoutArtifactHash };
  });
  const productPredicate = input.slice.requiredEvidence[0]!;
  return {
    plan,
    planArtifactHash: planArtifactHash(plan),
    bundle: createEvidenceBundleV2({
      runId: input.runId,
      storyId: input.slice.storyId,
      packetHash: input.slice.packetHash,
      sliceHash: input.sliceHash,
      sourceRevision: input.sourceRevision,
      attemptId: input.attemptId,
      predicates: [
        {
          invariantRef: `INV_${productPredicate.kind.toUpperCase()}`,
          predicateRef: productPredicate.id,
          actionRef: flow.actionRef,
          ...(flow.controlRef ? { controlRef: flow.controlRef } : {}),
          required: true,
          verdict: input.productVerdict,
          observationRefs: [computeObservationRef(control), computeObservationRef(runtime)],
        },
        ...commandData.map(({ command, observation }) => ({
          invariantRef: `INV_COMMAND_${command.kind.toUpperCase()}`,
          predicateRef: `EVID_COMMAND_${command.commandRef}`,
          required: true as const,
          verdict: observation.exitCode === 0 ? "pass" as const : "fail" as const,
          observationRefs: [computeObservationRef(observation)],
        })),
      ],
      observations: [control, runtime, ...commandData.map(({ observation }) => observation)],
      artifacts: [
        { hash: beforeHash, mediaType: "application/json", locator: "evidence/before.json" },
        { hash: afterHash, mediaType: "application/json", locator: "evidence/after.json" },
        { hash: runtimeArtifactHash, mediaType: "application/json", locator: `evidence/${input.runtimeSessionId ?? "runtime-default"}.json` },
        ...commandData.map(({ command, stdoutArtifactHash }) => ({
          hash: stdoutArtifactHash,
          mediaType: "text/plain",
          locator: `evidence/${command.commandRef}.stdout`,
        })),
      ],
      runner: {
        id: "setfarm-test-canonical-runner",
        version: "2.0.0",
        environmentHash: hashCanonicalJson({ runner: "test", salt: input.semanticSalt }),
      },
      startedAt: `${clockDate}T10:00:00.000Z`,
      completedAt: `${clockDate}T10:00:05.000Z`,
    }),
  };
}

function findingSetFor(bundle: ReturnType<typeof evidenceBundle>["bundle"], slice: ImplementationSliceV1) {
  const writable = slice.files
    .filter((file) => file.role === "owned" || file.role === "shared_writable")
    .sort((left, right) => left.path.localeCompare(right.path));
  const locatable = writable.length > 0
    ? writable
    : slice.files.filter((file) => file.role !== "dependency").sort((left, right) => left.path.localeCompare(right.path));
  const bundleHash = hashCanonicalJson(bundle);
  return createFindingSetV1({
    runId: bundle.runId,
    storyId: bundle.storyId,
    packetHash: bundle.packetHash,
    sliceHash: bundle.sliceHash,
    sourceRevision: bundle.sourceRevision,
    findings: bundle.predicates
      .filter((predicate) => predicate.verdict !== "pass")
      .map((predicate) => ({
        origin: predicate.invariantRef.startsWith("INV_COMMAND_BUILD")
          ? "build" as const
          : predicate.invariantRef.startsWith("INV_COMMAND_TEST")
            ? "test" as const
            : "runtime" as const,
        classification: "structured" as const,
        invariantRef: predicate.invariantRef,
        sourceLocators: locatable.map((file) => ({
          path: file.path,
          contentHash: hashCanonicalJson({ source: bundle.sourceRevision, path: file.path }),
        })),
        observedEvidenceRefs: [bundleHash],
        expectedPredicateRef: predicate.predicateRef,
        status: "open" as const,
      })),
  });
}

async function claim(database: TestDatabase, runId: string, agentId: string): Promise<number> {
  return database.sql.begin(async (transaction) => {
    const identities = await transaction.unsafe<Array<{ id: unknown }>>(
      "SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id",
    );
    const birth = await prepareInternalProductionClaimBirthV1(
      transaction as PgTransactionSql,
      "a-claim-loop-runtime-v1",
      identities,
    );
    return insertAndBindInternalProductionClaimBirthV1(transaction as PgTransactionSql, birth, {
      runId,
      workflowStepId: "implement",
      storyId: "US-001",
      claimAgentId: agentId,
      claimedAt: new Date(),
    });
  });
}

async function initialInput(input: Readonly<{
  database: TestDatabase;
  runId: string;
  productVerdict: "pass" | "fail" | "inconclusive";
  failureClass: "product" | "infrastructure";
  semanticSalt: string;
  failedCommandRef?: string;
}>) {
  const slice = baseSlice();
  const releaseSha = "d".repeat(40);
  const canonical = await seedCanonicalCompilerStoryAdmissionFixture(input.database, {
    runId: input.runId,
    releaseSha,
    packetHash: slice.packetHash,
  });
  await input.database.sql.begin(async (transaction) => {
    const identity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(input.runId);
    const reservation = await beginOrAdoptInternalProductionOwnerReservationV1(
      transaction as PgTransactionSql,
      { producerImplementationId: "a-runtime-run-v1", ownerKey: identity.ownerKey },
    );
    await bindInternalProductionOwnerReservationV1(transaction as PgTransactionSql, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      canonicalOwnerIdentity: identity,
    });
  });
  canonicalAdmissionByRunId.set(input.runId, canonical);
  const story = canonical.stories.find((candidate) => candidate.storyId === slice.storyId);
  assert.ok(story);
  await input.database.sql.unsafe(
    "UPDATE stories SET status = 'running' WHERE id = $1 AND run_id = $2",
    [story.id, input.runId],
  );
  const exactSliceHash = sliceHash(`${input.runId}:initial`);
  const plan = compileEvidencePlanV1({ slice, sliceHash: exactSliceHash });
  const exactPlanArtifactHash = planArtifactHash(plan);
  const claimId = await claim(input.database, input.runId, "initial-implement-agent");
  const attemptRepository = createAttemptRepository(input.database.sql);
  const reserved = await attemptRepository.reserve({
    claimId,
    runId: input.runId,
    stepId: "implement",
    storyId: slice.storyId,
    attemptClass: "product_implementation",
    packetHash: slice.packetHash,
    compilationReportHash: COMPILATION_REPORT,
    sliceHash: exactSliceHash,
    sourceBefore: { sha: slice.sourceRevision.baseSha, treeHash: slice.sourceRevision.treeHash },
    role: "developer",
    agentId: "initial-implement-agent",
    evidenceRefs: [
      `setfarm://claim-log/${claimId}`,
      `setfarm://artifact/${exactPlanArtifactHash}`,
    ],
  }, { now: new Date("2026-07-13T09:59:00.000Z") });
  assert.equal(reserved.status, "reserved");
  const candidate = source(input.productVerdict === "fail" ? "3" : "4");
  const recorded = await attemptRepository.recordCandidateSource({
    attemptId: reserved.attempt.attemptId,
    generation: reserved.attempt.generation,
    fenceToken: reserved.attempt.fenceToken,
    sourceAfter: candidate,
  });
  assert.equal(recorded.status, "candidate");
  const evidence = evidenceBundle({
    runId: input.runId,
    attemptId: reserved.attempt.attemptId,
    slice,
    sliceHash: exactSliceHash,
    sourceRevision: candidate,
    productVerdict: input.productVerdict,
    semanticSalt: input.semanticSalt,
    ...(input.failedCommandRef ? { failedCommandRef: input.failedCommandRef } : {}),
  });
  assert.equal(evidence.planArtifactHash, exactPlanArtifactHash);
  const bundleHash = hashCanonicalJson(evidence.bundle);
  const completed = await attemptRepository.complete({
    attemptId: reserved.attempt.attemptId,
    generation: reserved.attempt.generation,
    fenceToken: reserved.attempt.fenceToken,
    disposition: "produced_delta",
    sourceAfter: candidate,
    evidenceRefs: [`setfarm://evidence-bundle/${bundleHash}`],
  });
  assert.equal(completed.status, "completed");
  await input.database.sql`UPDATE claim_log SET outcome = 'completed' WHERE id = ${claimId}`;
  await input.database.sql`
    UPDATE stories SET status = 'failed' WHERE id = ${story.id}
  `;
  return {
    kind: "initial_evidence" as const,
    slice,
    sliceHash: exactSliceHash,
    evidencePlan: evidence.plan,
    evidencePlanArtifactHash: exactPlanArtifactHash,
    evidenceBundle: evidence.bundle,
    findingSet: findingSetFor(evidence.bundle, slice),
    failureClass: input.failureClass,
  };
}

async function recoveryInput(input: Readonly<{
  database: TestDatabase;
  runId: string;
  dispatch: RecoveryRevisionDispatchV1;
  revision: RecoveryCaseRevisionV1;
  productVerdict: "pass" | "fail" | "inconclusive";
  failureClass?: "product" | "infrastructure";
  semanticSalt: string;
  candidateSeed: string;
}>) {
  const deliveries = createRecoveryDeliveryRepository(input.database.sql);
  const modelHandoff = input.dispatch.dispatchClass === "evidence_only"
    ? undefined
    : await createV3RecoveryClaimAuthority(input.database.sql).acquireRecoveryClaim({
        ownerInstanceId: `${input.dispatch.dispatchClass}-worker`,
        runId: input.runId,
        storyId: input.dispatch.storyId,
        leaseMs: 60_000,
      }, { now: new Date("2026-07-13T10:10:00.000Z") });
  const evidenceLease = modelHandoff ? undefined : await deliveries.leaseNext({
    ownerInstanceId: `${input.dispatch.dispatchClass}-worker`,
    runId: input.runId,
    storyId: input.dispatch.storyId,
    leaseMs: 60_000,
  }, { now: new Date("2026-07-13T10:10:00.000Z") });
  const lease = modelHandoff?.lease ?? evidenceLease;
  assert.ok(lease);
  assert.equal(modelHandoff?.dispatchId ?? evidenceLease?.dispatchId, input.dispatch.dispatchId);
  const base = baseSlice();
  const slice = ImplementationSliceV1Schema.parse({
    ...base,
    sourceRevision: {
      baseSha: input.dispatch.sourceRevision.sha,
      treeHash: input.dispatch.sourceRevision.treeHash,
    },
    files: base.files.map((file) => ({
      ...file,
      knownContentHash: hashCanonicalJson({ dispatch: input.dispatch.dispatchId, path: file.path }),
    })),
    ...(input.dispatch.dispatchClass === "evidence_only"
      ? { recovery: undefined }
      : {
          recovery: {
            schema: "setfarm.implementation-recovery-directive.v1",
            recoveryCaseRevisionId: input.revision.revisionId,
            recoveryDispatchId: input.dispatch.dispatchId,
            dispatchClass: input.dispatch.dispatchClass,
            findingSetHash: input.dispatch.findingSetHash,
            findingIds: input.dispatch.findingIds,
            contractSliceHash: input.dispatch.contractSliceHash,
            sourceRevision: {
              baseSha: input.dispatch.sourceRevision.sha,
              treeHash: input.dispatch.sourceRevision.treeHash,
            },
            expectedDelta: input.revision.expectedDelta,
            allowedPaths: input.revision.allowedPaths,
            ...(input.revision.evidencePlanArtifactHash
              ? { evidencePlanArtifactHash: input.revision.evidencePlanArtifactHash }
              : {}),
          },
        }),
  });
  const recoveryExecutionSliceEnvelope = modelHandoff ? {
    schema: "setfarm.semantic-artifact-envelope.v1" as const,
    artifactType: "setfarm.implementation-slice.v1",
    producer: {
      pass: "v3-recovery-coordinator-test",
      codeSha: "d".repeat(40),
      toolVersions: { setfarm: "test" },
    },
    payload: slice,
  } : undefined;
  const exactSliceHash = recoveryExecutionSliceEnvelope
    ? hashCanonicalJson(recoveryExecutionSliceEnvelope)
    : input.dispatch.contractSliceHash;
  const plan = compileEvidencePlanV1({ slice, sliceHash: exactSliceHash });
  const exactPlanArtifactHash = planArtifactHash(plan);
  const agentId = `${input.dispatch.dispatchClass}-agent`;
  let runtime: Readonly<{ sessionId: string; ownerInstanceId: string }> | undefined;
  let claimId: number;
  if (modelHandoff) {
    const canonical = canonicalAdmissionByRunId.get(input.runId);
    assert.ok(canonical);
    const story = canonical.stories.find((candidate) => candidate.storyId === slice.storyId);
    assert.ok(story);
    const publication = await publishLoopClaimRuntime(input.database.sql, {
      runId: input.runId,
      stepDbId: canonical.implementStepDbId,
      workflowStepId: "implement",
      storyDbId: story.id,
      storyId: story.storyId,
      claimAgentId: agentId,
      parallelLimit: 1,
      recoveryHandoff: modelHandoff,
      storyAdmissionProof: canonical.storyAdmissionProof,
      runtimeIntent: {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: `RTS_${hashCanonicalJson({ runId: input.runId, dispatchId: input.dispatch.dispatchId }).slice(0, 32)}`,
        runtimeAgentId: agentId,
        runtimeKind: "local_process",
        ownerInstanceId: modelHandoff.lease.ownerInstanceId,
      },
      now: new Date("2026-07-13T10:10:00.500Z"),
    });
    assert.ok(publication?.runtime);
    claimId = publication.claimId;
    runtime = publication.runtime;
  } else {
    claimId = await claim(input.database, input.runId, agentId);
  }
  const attemptRepository = createAttemptRepository(input.database.sql);
  const reserved = await attemptRepository.reserve({
    claimId,
    runId: input.runId,
    stepId: "implement",
    storyId: slice.storyId,
    attemptClass: input.dispatch.dispatchClass,
    packetHash: slice.packetHash,
    compilationReportHash: COMPILATION_REPORT,
    sliceHash: exactSliceHash,
    ...(recoveryExecutionSliceEnvelope ? { recoveryExecutionSliceEnvelope } : {}),
    sourceBefore: input.dispatch.sourceRevision,
    findingSetHash: input.dispatch.findingSetHash,
    recoveryCaseRevisionId: input.revision.revisionId,
    recoveryDispatchId: input.dispatch.dispatchId,
    recoveryDeliveryLease: {
      ownerInstanceId: lease.ownerInstanceId!,
      leaseToken: lease.leaseToken!,
    },
    role: input.dispatch.dispatchClass === "supervisor_repair" ? "supervisor" : "developer",
    agentId,
    branch: `fixture/${input.dispatch.dispatchClass}/${input.runId}`,
    worktree: process.cwd(),
    evidenceRefs: [
      `setfarm://claim-log/${claimId}`,
      `setfarm://artifact/${exactPlanArtifactHash}`,
    ],
  }, { now: new Date("2026-07-13T10:10:01.000Z") });
  assert.equal(reserved.status, "reserved");
  await attemptRepository.markRunning({
    attemptId: reserved.attempt.attemptId,
    generation: reserved.attempt.generation,
    fenceToken: reserved.attempt.fenceToken,
  });
  await deliveries.markRunning({
    dispatchId: input.dispatch.dispatchId,
    revisionId: input.revision.revisionId,
    attemptId: reserved.attempt.attemptId,
  });
  const candidate = input.dispatch.dispatchClass === "evidence_only"
    ? input.dispatch.sourceRevision
    : source(input.candidateSeed);
  const recorded = await attemptRepository.recordCandidateSource({
    attemptId: reserved.attempt.attemptId,
    generation: reserved.attempt.generation,
    fenceToken: reserved.attempt.fenceToken,
    sourceAfter: candidate,
  });
  assert.equal(recorded.status, "candidate");
  const evidence = evidenceBundle({
    runId: input.runId,
    attemptId: reserved.attempt.attemptId,
    slice,
    sliceHash: exactSliceHash,
    sourceRevision: candidate,
    productVerdict: input.productVerdict,
    semanticSalt: input.semanticSalt,
  });
  assert.equal(evidence.planArtifactHash, exactPlanArtifactHash);
  const bundleHash = hashCanonicalJson(evidence.bundle);
  const completed = await attemptRepository.complete({
    attemptId: reserved.attempt.attemptId,
    generation: reserved.attempt.generation,
    fenceToken: reserved.attempt.fenceToken,
    disposition: "produced_delta",
    sourceAfter: candidate,
    evidenceRefs: [`setfarm://evidence-bundle/${bundleHash}`],
  });
  assert.equal(completed.status, "completed");
  await input.database.sql`UPDATE claim_log SET outcome = 'completed' WHERE id = ${claimId}`;
  if (runtime) {
    await input.database.sql.begin((transaction) => releaseReservedRuntimeSessionInTransaction(transaction, {
      sessionId: runtime.sessionId,
      claimId,
      ownerInstanceId: runtime.ownerInstanceId,
      diagnostic: "coordinator test model runtime never spawned",
    }));
    await input.database.sql.unsafe(
      "UPDATE stories SET status = 'failed' WHERE run_id = $1 AND story_id = $2",
      [input.runId, slice.storyId],
    );
  }
  return {
    kind: "recovery_evidence" as const,
    recoveryCaseId: input.dispatch.recoveryCaseId,
    revisionId: input.revision.revisionId,
    dispatchId: input.dispatch.dispatchId,
    attemptId: reserved.attempt.attemptId,
    slice,
    sliceHash: exactSliceHash,
    evidencePlan: evidence.plan,
    evidencePlanArtifactHash: exactPlanArtifactHash,
    evidenceBundle: evidence.bundle,
    ...(input.productVerdict === "pass" ? {} : { findingSet: findingSetFor(evidence.bundle, slice) }),
    ...(input.productVerdict === "pass" ? {} : { failureClass: input.failureClass! }),
  };
}

async function dispatchedIdentity(database: TestDatabase, result: Awaited<ReturnType<ReturnType<typeof createV3RecoveryCoordinator>["coordinate"]>>) {
  assert.equal(result.status, "dispatched");
  if (result.status !== "dispatched") throw new Error("expected dispatch");
  const deliveries = createRecoveryDeliveryRepository(database.sql);
  const [dispatch, revision] = await Promise.all([
    deliveries.findDispatch(result.dispatchId),
    deliveries.findRevision(result.revisionId),
  ]);
  assert.ok(dispatch);
  assert.ok(revision);
  return { result, dispatch, revision };
}

describe("V3 recovery coordinator", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => {
    canonicalAdmissionByRunId.clear();
    await database.cleanup();
  });

  it("ignores volatile artifact identity on semantic replay but changes for a typed outcome delta", () => {
    const slice = baseSlice();
    const stable = evidenceBundle({
      runId: "run-v3-fingerprint",
      attemptId: "ATT_fingerprint-stable-0001",
      slice,
      sliceHash: sliceHash("fingerprint-stable"),
      sourceRevision: source("1"),
      productVerdict: "inconclusive",
      semanticSalt: "first-clock-session-and-artifact-set",
      clockDate: "2026-07-13",
      runtimeSessionId: "runtime-session-first",
    }).bundle;
    const volatileReplay = evidenceBundle({
      runId: "run-v3-fingerprint",
      attemptId: "ATT_fingerprint-replay-0002",
      slice,
      sliceHash: sliceHash("fingerprint-stable"),
      sourceRevision: source("1"),
      productVerdict: "inconclusive",
      semanticSalt: "different-clock-session-and-artifact-set",
      clockDate: "2026-07-14",
      runtimeSessionId: "runtime-session-replay",
    }).bundle;
    const semanticDelta = evidenceBundle({
      runId: "run-v3-fingerprint",
      attemptId: "ATT_fingerprint-delta-0003",
      slice,
      sliceHash: sliceHash("fingerprint-stable"),
      sourceRevision: source("1"),
      productVerdict: "fail",
      semanticSalt: "different-clock-session-and-artifact-set",
      clockDate: "2026-07-14",
      runtimeSessionId: "runtime-session-delta",
    }).bundle;
    assert.notDeepEqual(
      stable.artifacts.map((artifact) => artifact.hash),
      volatileReplay.artifacts.map((artifact) => artifact.hash),
    );
    assert.equal(
      computeMachineEvidenceFingerprintV1(stable),
      computeMachineEvidenceFingerprintV1(volatileReplay),
    );
    assert.notEqual(
      computeMachineEvidenceFingerprintV1(stable),
      computeMachineEvidenceFingerprintV1(semanticDelta),
    );
  });

  it("rejects caller-controlled path authority at the production boundary", () => {
    assert.equal(V3RecoveryCoordinatorInputSchema.safeParse({
      kind: "initial_evidence",
      slice: {},
      sliceHash: "a".repeat(64),
      evidencePlan: {},
      evidencePlanArtifactHash: "b".repeat(64),
      evidenceBundle: {},
      allowedPaths: ["src/escape.ts"],
    }).success, false);
  });

  it("converges concurrent initial failure publication to one product repair dispatch", async () => {
    const input = await initialInput({
      database,
      runId: "run-v3-coordinator-concurrent",
      productVerdict: "fail",
      failureClass: "product",
      semanticSalt: "concurrent-initial",
    });
    const coordinator = createV3RecoveryCoordinator(database.sql);
    const [first, raced] = await Promise.all([
      coordinator.coordinate(input, { now: new Date("2026-07-13T10:01:00.000Z") }),
      coordinator.coordinate(input, { now: new Date("2026-07-13T10:01:00.000Z") }),
    ]);
    assert.equal(first.status, "dispatched");
    assert.equal(raced.status, "dispatched");
    if (first.status !== "dispatched" || raced.status !== "dispatched") throw new Error("expected dispatches");
    assert.equal(first.dispatchId, raced.dispatchId);
    assert.equal(first.dispatchClass, "product_implementation");
    assert.equal(first.modelDispatch, true);
    const rows = await database.sql<Array<{ dispatches: number; deliveries: number; used: number }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM recovery_revision_dispatches WHERE recovery_case_id = ${first.recoveryCaseId}) AS dispatches,
        (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries WHERE recovery_case_id = ${first.recoveryCaseId}) AS deliveries,
        (SELECT used_implement FROM recovery_cases WHERE recovery_case_id = ${first.recoveryCaseId}) AS used
    `;
    assert.deepEqual(rows[0], { dispatches: 1, deliveries: 1, used: 1 });
  });

  it("serializes terminal run settlement against new recovery publication", async () => {
    const runId = "run-v3-coordinator-terminal-race";
    const input = await initialInput({
      database,
      runId,
      productVerdict: "fail",
      failureClass: "product",
      semanticSalt: "terminal-race",
    });
    const claims = await database.sql<Array<{ id: number; agent_id: string }>>`
      SELECT id::integer, agent_id
        FROM claim_log
       WHERE run_id = ${runId} AND story_id = ${input.evidenceBundle.storyId} AND outcome IS NULL
    `;
    if (claims[0]) await database.sql.begin(async (transaction) => {
      await acquireClaimMutationAuthorityInTransaction(transaction, {
        claimId: claims[0]!.id,
        runId,
        workflowStepId: "implement",
        storyId: input.evidenceBundle.storyId,
        claimAgentId: claims[0]!.agent_id,
      });
      await transaction.unsafe(
        "UPDATE claim_log SET outcome = 'completed', completed_at = clock_timestamp() WHERE id = $1 AND outcome IS NULL",
        [claims[0]!.id],
      );
    });
    const [coordinated, requested] = await Promise.allSettled([
      createV3RecoveryCoordinator(database.sql).coordinate(input, {
        now: new Date("2200-01-01T00:00:00.000Z"),
      }),
      requestRunTermination(database.sql, {
        runId,
        targetStatus: "failed",
        requestedBy: "terminal-race-test",
        diagnostic: "TEST_TERMINAL_RECOVERY_SERIALIZATION",
        evidence: { terminalFailure: true },
        now: new Date("1900-01-01T00:00:00.000Z"),
      }),
    ]);
    assert.equal(requested.status, "fulfilled");
    if (requested.status !== "fulfilled" || requested.value.status === "already_terminal") {
      throw new Error("expected one durable termination request");
    }
    if (coordinated.status === "rejected") {
      assert.match(
        String(coordinated.reason),
        /V3_RECOVERY_(RUN_NOT_ACTIVE|TERMINATION_PENDING)/,
      );
    }
    const terminations = createRunTerminationRepository(database.sql);
    const owned = await terminations.claim({
      requestId: requested.value.request.requestId,
      ownerInstanceId: "terminal-race-owner",
      now: new Date("2200-01-01T00:00:00.000Z"),
    });
    assert.equal(owned?.state, "draining");
    await terminations.markDrained({
      requestId: requested.value.request.requestId,
      ownerInstanceId: "terminal-race-owner",
      evidence: { noRuntimeSessions: true },
      now: new Date("1900-01-01T00:00:00.000Z"),
    });
    await terminations.terminalize({
      requestId: requested.value.request.requestId,
      now: new Date("2200-01-01T00:00:00.000Z"),
    });
    const rows = await database.sql<Array<{
      run_status: string;
      active_deliveries: number;
      active_cases: number;
    }>>`
      SELECT run.status AS run_status,
             (SELECT COUNT(*)::integer
                FROM recovery_dispatch_deliveries delivery
               WHERE delivery.run_id = ${runId}
                 AND delivery.state IN ('authorized', 'leased', 'attempt_reserved', 'running')) AS active_deliveries,
             (SELECT COUNT(*)::integer
                FROM recovery_cases recovery
               WHERE recovery.run_id = ${runId}
                 AND recovery.status IN ('open', 'repairing', 'evidencing')) AS active_cases
        FROM runs run
       WHERE run.id = ${runId}
    `;
    assert.deepEqual({ ...rows[0]! }, {
      run_status: "failed",
      active_deliveries: 0,
      active_cases: 0,
    });
  });

  it("carries every synthetic command predicate into the bounded recovery evidence plan", async () => {
    const input = await initialInput({
      database,
      runId: "run-v3-coordinator-command",
      productVerdict: "pass",
      failedCommandRef: "CMD_BUILD",
      failureClass: "product",
      semanticSalt: "command-failure",
    });
    assert.equal(input.evidenceBundle.aggregateVerdict, "fail");
    assert.deepEqual(input.findingSet.findings.map((finding) => finding.expectedPredicateRef), [
      "EVID_COMMAND_CMD_BUILD",
    ]);
    const result = await createV3RecoveryCoordinator(database.sql).coordinate(input, {
      now: new Date("2026-07-13T10:01:00.000Z"),
    });
    const identity = await dispatchedIdentity(database, result);
    assert.equal(identity.result.dispatchClass, "product_implementation");
    assert.deepEqual(identity.dispatch.evidencePlan, [
      "EVID_COMMAND_CMD_BUILD",
      "EVID_COMMAND_CMD_TEST",
      "EVID_SAVE_RELOAD",
    ]);
  });

  it("bounds product failure to one same-case supervisor repair and blocks its failure", async () => {
    const coordinator = createV3RecoveryCoordinator(database.sql);
    const initial = await initialInput({
      database,
      runId: "run-v3-coordinator-bounded",
      productVerdict: "fail",
      failureClass: "product",
      semanticSalt: "bounded-initial",
    });
    const product = await dispatchedIdentity(database, await coordinator.coordinate(initial, {
      now: new Date("2026-07-13T10:01:00.000Z"),
    }));
    const productFailure = await recoveryInput({
      database,
      runId: "run-v3-coordinator-bounded",
      dispatch: product.dispatch,
      revision: product.revision,
      productVerdict: "fail",
      failureClass: "product",
      semanticSalt: "bounded-product-failure",
      candidateSeed: "5",
    });
    // Simulate a process crash after immutable evidence/finding publication and
    // atomic delivery terminalization, but before revision advancement.
    const findingRepository = createFindingRecoveryRepository(database.sql);
    await findingRepository.putEvidenceBundle(productFailure.evidenceBundle);
    await findingRepository.putFindingSet(productFailure.findingSet);
    const crashedBundleHash = hashCanonicalJson(productFailure.evidenceBundle);
    const crashedEventHash = computeV3RecoveryCoordinatorEventHashV1({
      kind: productFailure.kind,
      recoveryCaseId: productFailure.recoveryCaseId,
      revisionId: productFailure.revisionId,
      dispatchId: productFailure.dispatchId,
      attemptId: productFailure.attemptId,
      evidenceBundleHash: crashedBundleHash,
      findingSetHash: productFailure.findingSet.findingSetHash,
      failureClass: productFailure.failureClass,
    });
    const crashedDelivery = await createRecoveryDeliveryRepository(database.sql).completeDelivery({
      dispatchId: productFailure.dispatchId,
      revisionId: productFailure.revisionId,
      attemptId: productFailure.attemptId,
      state: "failed",
      terminalResult: {
        schema: "setfarm.v3-recovery-coordinator-result.v1",
        eventHash: crashedEventHash,
        evidenceBundleHash: crashedBundleHash,
        attemptId: productFailure.attemptId,
        verdict: "fail",
        failureClass: "product",
      },
    }, { now: new Date("2026-07-13T10:10:30.000Z") });
    assert.equal(crashedDelivery?.state, "failed");
    const [supervisorFirst, supervisorReplay] = await Promise.all([
      coordinator.coordinate(productFailure, { now: new Date("2026-07-13T10:11:00.000Z") }),
      coordinator.coordinate(productFailure, { now: new Date("2026-07-13T10:11:00.000Z") }),
    ]);
    const supervisor = await dispatchedIdentity(database, supervisorFirst);
    assert.equal(supervisor.result.dispatchClass, "supervisor_repair");
    assert.equal(supervisor.result.recoveryCaseId, product.result.recoveryCaseId);
    assert.equal(supervisor.revision.revisionNumber, 2);
    const openingIdentity = await database.sql<Array<{
      case_finding_set_hash: string;
      case_slice_hash: string;
      case_source_sha: string;
      case_source_tree_hash: string;
      case_finding_ids: string[];
      opening_revision_id: string;
      opening_finding_ids: string[];
    }>>`
      SELECT recovery_case.finding_set_hash AS case_finding_set_hash,
             recovery_case.slice_hash AS case_slice_hash,
             recovery_case.source_sha AS case_source_sha,
             recovery_case.source_tree_hash AS case_source_tree_hash,
             recovery_case.finding_ids AS case_finding_ids,
             opening.revision_id AS opening_revision_id,
             opening.finding_ids AS opening_finding_ids
        FROM recovery_cases recovery_case
        JOIN recovery_case_revisions opening
          ON opening.recovery_case_id = recovery_case.recovery_case_id
         AND opening.revision_number = 1
       WHERE recovery_case.recovery_case_id = ${product.result.recoveryCaseId}
    `;
    assert.equal(openingIdentity.length, 1);
    assert.equal(openingIdentity[0]!.case_finding_set_hash, product.revision.findingSetHash);
    assert.equal(openingIdentity[0]!.case_slice_hash, product.revision.contractSliceHash);
    assert.equal(openingIdentity[0]!.case_source_sha, product.revision.sourceRevision.sha);
    assert.equal(openingIdentity[0]!.case_source_tree_hash, product.revision.sourceRevision.treeHash);
    assert.deepEqual(openingIdentity[0]!.opening_finding_ids, openingIdentity[0]!.case_finding_ids);
    assert.notEqual(supervisor.revision.findingSetHash, openingIdentity[0]!.case_finding_set_hash);
    assert.notEqual(supervisor.revision.contractSliceHash, openingIdentity[0]!.case_slice_hash);
    assert.notEqual(supervisor.revision.sourceRevision.sha, openingIdentity[0]!.case_source_sha);
    await assert.rejects(
      database.sql.unsafe(
        "UPDATE recovery_case_revisions SET finding_ids = '[]'::jsonb WHERE revision_id = $1",
        [openingIdentity[0]!.opening_revision_id],
      ),
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    const retainedOpening = await database.sql<Array<{ finding_ids: string[] }>>`
      SELECT finding_ids FROM recovery_case_revisions
       WHERE revision_id = ${openingIdentity[0]!.opening_revision_id}
    `;
    assert.deepEqual(retainedOpening[0]?.finding_ids, openingIdentity[0]!.opening_finding_ids);
    assert.equal(supervisorReplay.status, "dispatched");
    if (supervisorReplay.status === "dispatched") assert.equal(supervisorReplay.dispatchId, supervisor.result.dispatchId);

    const supervisorFailure = await recoveryInput({
      database,
      runId: "run-v3-coordinator-bounded",
      dispatch: supervisor.dispatch,
      revision: supervisor.revision,
      productVerdict: "fail",
      failureClass: "product",
      semanticSalt: "bounded-supervisor-failure",
      candidateSeed: "6",
    });
    const blocked = await coordinator.coordinate(supervisorFailure, { now: new Date("2026-07-13T10:21:00.000Z") });
    assert.equal(blocked.status, "blocked");
    if (blocked.status !== "blocked") throw new Error("expected blocked");
    assert.equal(blocked.reasonCode, "budget_exhausted");
    const replay = await coordinator.coordinate(supervisorFailure, { now: new Date("2026-07-13T10:22:00.000Z") });
    assert.equal(replay.status, "blocked");
    const budget = await database.sql<Array<{
      used_implement: number;
      used_supervisor_repair: number;
      used_evidence_only: number;
      dispatches: number;
    }>>`
      SELECT used_implement, used_supervisor_repair, used_evidence_only,
             (SELECT COUNT(*)::integer FROM recovery_revision_dispatches dispatch
               WHERE dispatch.recovery_case_id = recovery_cases.recovery_case_id) AS dispatches
        FROM recovery_cases
       WHERE recovery_case_id = ${product.result.recoveryCaseId}
    `;
    assert.deepEqual(budget[0], {
      used_implement: 1,
      used_supervisor_repair: 1,
      used_evidence_only: 0,
      dispatches: 2,
    });
  });

  it("selects a revised evidence-only source owner from its terminal parent dispatch", async () => {
    const coordinator = createV3RecoveryCoordinator(database.sql);
    const initial = await initialInput({
      database,
      runId: "run-v3-coordinator-revised-evidence-owner",
      productVerdict: "fail",
      failureClass: "product",
      semanticSalt: "revised-owner-initial",
    });
    const product = await dispatchedIdentity(database, await coordinator.coordinate(initial));
    const parentFailure = await recoveryInput({
      database,
      runId: initial.findingSet.runId,
      dispatch: product.dispatch,
      revision: product.revision,
      productVerdict: "inconclusive",
      failureClass: "infrastructure",
      semanticSalt: "revised-owner-parent",
      candidateSeed: "9",
    });
    const evidenceOnly = await dispatchedIdentity(database, await coordinator.coordinate(parentFailure));
    assert.equal(evidenceOnly.result.dispatchClass, "evidence_only");
    assert.equal(evidenceOnly.revision.revisionNumber, 2);
    assert.notEqual(evidenceOnly.revision.sourceRevision.sha, product.revision.sourceRevision.sha);
    const refs = await database.sql<Array<{ prior_attempt_refs: string[] }>>`
      SELECT prior_attempt_refs FROM recovery_cases
       WHERE recovery_case_id = ${product.result.recoveryCaseId}
    `;
    assert.equal(refs.length, 1);
    assert.equal(refs[0]!.prior_attempt_refs.includes(parentFailure.attemptId), false);
    const leaseIdentity = {
      recoveryCaseId: evidenceOnly.revision.recoveryCaseId,
      revisionId: evidenceOnly.revision.revisionId,
      runId: evidenceOnly.revision.runId,
      storyId: evidenceOnly.revision.storyId,
      packetHash: evidenceOnly.revision.packetHash,
      contractSliceHash: evidenceOnly.revision.contractSliceHash,
      findingSetHash: evidenceOnly.revision.findingSetHash,
      sourceRevision: evidenceOnly.revision.sourceRevision,
    };
    assert.deepEqual(await resolveExactPriorSourceOwner(database.sql, leaseIdentity), {
      branch: `fixture/product_implementation/${initial.findingSet.runId}`,
      worktree: process.cwd(),
    });
    await assert.rejects(
      resolveExactPriorSourceOwner(database.sql, {
        ...leaseIdentity,
        sourceRevision: { sha: "0".repeat(40), treeHash: "0".repeat(40) },
      }),
      (error: unknown) => error instanceof V3EvidenceOnlyRuntimeError
        && error.code === "V3_EVIDENCE_ONLY_SOURCE_OWNER_MISSING",
    );
  });

  it("resolves only exact passing attempt evidence and accepts the canonical evidence URI", async () => {
    const coordinator = createV3RecoveryCoordinator(database.sql);
    const initial = await initialInput({
      database,
      runId: "run-v3-coordinator-resolve",
      productVerdict: "fail",
      failureClass: "product",
      semanticSalt: "resolve-initial",
    });
    const product = await dispatchedIdentity(database, await coordinator.coordinate(initial, {
      now: new Date("2026-07-13T10:01:00.000Z"),
    }));
    const passing = await recoveryInput({
      database,
      runId: "run-v3-coordinator-resolve",
      dispatch: product.dispatch,
      revision: product.revision,
      productVerdict: "pass",
      semanticSalt: "resolve-pass",
      candidateSeed: "7",
    });
    const resolved = await coordinator.coordinate(passing, { now: new Date("2026-07-13T10:31:00.000Z") });
    assert.equal(resolved.status, "resolved");
    const replay = await coordinator.coordinate(passing, { now: new Date("2026-07-13T10:32:00.000Z") });
    assert.equal(replay.status, "resolved");
  });

  it("uses one non-model evidence delivery and blocks unchanged inconclusive evidence without model promotion", async () => {
    const coordinator = createV3RecoveryCoordinator(database.sql);
    const initial = await initialInput({
      database,
      runId: "run-v3-coordinator-inconclusive",
      productVerdict: "inconclusive",
      failureClass: "infrastructure",
      semanticSalt: "volatile-replay-with-different-artifacts",
    });
    const evidenceOnly = await dispatchedIdentity(database, await coordinator.coordinate(initial, {
      now: new Date("2026-07-13T10:01:00.000Z"),
    }));
    assert.equal(evidenceOnly.result.dispatchClass, "evidence_only");
    assert.equal(evidenceOnly.result.modelDispatch, false);
    const repeatedEvidence = await recoveryInput({
      database,
      runId: "run-v3-coordinator-inconclusive",
      dispatch: evidenceOnly.dispatch,
      revision: evidenceOnly.revision,
      productVerdict: "inconclusive",
      failureClass: "infrastructure",
      semanticSalt: "stable-inconclusive",
      candidateSeed: "8",
    });
    assert.equal(
      computeMachineEvidenceFingerprintV1(initial.evidenceBundle),
      computeMachineEvidenceFingerprintV1(repeatedEvidence.evidenceBundle),
    );
    const blocked = await coordinator.coordinate(repeatedEvidence, { now: new Date("2026-07-13T10:41:00.000Z") });
    assert.equal(blocked.status, "blocked");
    if (blocked.status !== "blocked") throw new Error("expected blocked");
    assert.equal(blocked.reasonCode, "evidence_inconclusive");
    const rows = await database.sql<Array<{
      used_implement: number;
      used_supervisor_repair: number;
      used_evidence_only: number;
      dispatches: number;
    }>>`
      SELECT used_implement, used_supervisor_repair, used_evidence_only,
             (SELECT COUNT(*)::integer FROM recovery_revision_dispatches dispatch
               WHERE dispatch.recovery_case_id = recovery_cases.recovery_case_id) AS dispatches
        FROM recovery_cases
       WHERE recovery_case_id = ${evidenceOnly.result.recoveryCaseId}
    `;
    assert.deepEqual(rows[0], {
      used_implement: 0,
      used_supervisor_repair: 0,
      used_evidence_only: 1,
      dispatches: 1,
    });
  });
});
