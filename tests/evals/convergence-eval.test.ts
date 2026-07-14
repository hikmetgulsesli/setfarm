import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createAcceptedCandidateV1 } from "../../src/evidence/accepted-candidate-v1.js";
import {
  createV3BuildArtifactV1,
  createV3DeployReceiptV1,
} from "../../src/execution/schemas/v3-deploy-receipt-v1.js";
import { V3ProjectTransferAckV1Schema } from "../../src/execution/schemas/v3-project-transfer-ack-v1.js";
import { computeRunOperationalSnapshotHash } from "../../src/server/run-operational-snapshot.js";
import { RunOperationalSnapshotV1Schema } from "../../src/server/schemas/run-operational-snapshot-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  type ConvergenceArtifactPort,
  type ConvergenceAdmissionPort,
  type ConvergenceClock,
  type ConvergenceHttpPort,
  type ConvergenceProcessPort,
  type ConvergenceRunnerPorts,
  type ConvergenceRunCollection,
  type ConvergenceRunPoll,
  type ConvergenceSqlPort,
  evaluateConvergencePredicateCoverage,
  runConvergenceSuite,
} from "../../src/evals/convergence-runner.js";
import {
  ConvergenceCanonicalEvidenceV1Schema,
  ConvergenceEvalResultV1Schema,
  createConvergenceResult,
} from "../../src/evals/result-schema.js";
import { evaluateConvergenceReleaseGate } from "../../src/evals/release-gate.js";
import { ContentAddressedEvalResultStore } from "../../src/evals/report.js";
import {
  V3ReleaseAdmissionError,
  createV3ReleaseAdmissionRepository,
} from "../../src/execution/v3-release-admission-repository.js";
import { resolveNewRunProtocol } from "../../src/execution/run-protocol.js";
import { persistWorkflowRun } from "../../src/execution/run-persistence.js";
import {
  ProductConvergenceSuiteV1Schema,
  loadConvergenceSuite,
} from "../../src/evals/suite-schema.js";
import {
  evaluateTaskIntentOracleTaskBindingV1,
  taskIntentOracleHashV1,
} from "../../src/evals/task-intent-oracle.js";
import { createIsolatedTestDatabase } from "../execution-attempts/test-database.js";
import { buildNoVolumeRuntimeAuthorityFixture } from "../execution-attempts/fixtures/v3-runtime-authority.js";

const SHA = "a".repeat(40);
const HASH = "b".repeat(64);
const NOW = "2026-07-13T12:00:00.000Z";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function suite(repetitionsPerCase = 1) {
  const loaded = await loadConvergenceSuite(path.resolve("evals/suites/product-convergence-v1.json"));
  const value = ProductConvergenceSuiteV1Schema.parse({ ...loaded.suite, repetitionsPerCase });
  return { suite: value, suiteHash: hashCanonicalJson(value) };
}

function acceptedSnapshotEvidence(runId: string) {
  const sourceRevision = { sha: "8".repeat(40), treeHash: "7".repeat(40) };
  const attemptId = "ATT_00000000-0000-0000-0000-000000000777";
  const sliceHash = "4".repeat(64);
  const evidenceBundleHash = "d".repeat(64);
  const evidenceId = `EVB_${"9".repeat(64)}`;
  const candidate = createAcceptedCandidateV1({
    runId,
    packetHash: "2".repeat(64),
    storyPlanHash: "3".repeat(64),
    sourceRevision,
    storyEvidence: [{
      storyId: "US-001",
      attemptId,
      sliceHash,
      evidencePlanHash: "5".repeat(64),
      evidencePlanArtifactHash: "6".repeat(64),
      evidenceBundleHash,
      evidenceId,
      predicateRefs: ["EVID_ACTION_CONTROL"],
    }],
    acceptor: {
      id: "setfarm-final-tree-acceptor",
      version: "1.0.0",
      codeSha: SHA,
      environmentHash: "c".repeat(64),
    },
  });
  return {
    candidate,
    attempt: {
      ref: `setfarm://execution-attempt/${attemptId}`,
      attemptId,
      runRef: `setfarm://run/${runId}`,
      claimRef: null,
      stepRef: `setfarm://run/${runId}/step/final-test`,
      storyRef: `setfarm://run/${runId}/story/US-001`,
      workflowStepId: "final-test",
      storyId: "US-001",
      generation: 1,
      attemptClass: "evidence_only",
      packetHash: candidate.packetHash,
      compilationReportHash: HASH,
      sliceHash,
      sourceBefore: sourceRevision,
      sourceAfter: sourceRevision,
      findingSetHash: null,
      role: "tester",
      agentId: "feature-dev_tester",
      disposition: "verified",
      outputHash: evidenceBundleHash,
      createdAt: NOW,
      updatedAt: NOW,
    },
    bundle: {
      ref: `setfarm://evidence-bundle/${evidenceBundleHash}`,
      evidenceId,
      evidenceBundleHash,
      runRef: `setfarm://run/${runId}`,
      storyRef: `setfarm://run/${runId}/story/US-001`,
      storyId: "US-001",
      attemptRef: `setfarm://execution-attempt/${attemptId}`,
      attemptId,
      packetHash: candidate.packetHash,
      sliceHash,
      sourceRevision,
      aggregateVerdict: "pass",
      predicateCount: 1,
      observationCount: 1,
      createdAt: NOW,
    },
  };
}

function transferSnapshotEvidence(runId: string) {
  const accepted = acceptedSnapshotEvidence(runId);
  const candidate = accepted.candidate;
  const port = 4321;
  const projectId = `eval-${candidate.candidateHash.slice(0, 12)}`;
  const buildArtifact = createV3BuildArtifactV1({
    schema: "setfarm.v3-build-artifact.v1",
    runId,
    outputPaths: ["dist"],
    files: [{ path: "dist/index.html", byteLength: 5, contentHash: "1".repeat(64), executable: false }],
    totalBytes: 5,
  });
  const sealedRuntimeManifestHash = "8".repeat(64);
  const sealedRuntimeManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${runId}/${candidate.candidateHash}/${buildArtifact.artifactHash}/${sealedRuntimeManifestHash}`;
  const process = {
    schema: "setfarm.process-identity.v1" as const,
    pid: port,
    processStartedAt: "2026-07-13T11:59:00.000Z",
    processGroupId: port,
    source: "observed_os" as const,
  };
  const runtimeAuthority = buildNoVolumeRuntimeAuthorityFixture({
    runId,
    projectId,
    candidateHash: candidate.candidateHash,
    buildArtifactHash: buildArtifact.artifactHash,
    ownerProcess: process,
    checkedAt: NOW,
  });
  const receipt = createV3DeployReceiptV1({
    schema: "setfarm.v3-deploy-receipt.v1",
    runId,
    candidateId: candidate.candidateId,
    candidateHash: candidate.candidateHash,
    packetHash: candidate.packetHash,
    project: {
      schema: "setfarm.v3-deploy-project.v1",
      productId: "PROD_EVAL",
      projectId,
      displayName: "Convergence Eval",
      summary: "Canonical convergence transfer evidence.",
    },
    stack: {
      schema: "setfarm.v3-deploy-stack.v1",
      stackPackId: "vite-react-web-app",
      stackPackVersion: "1.1.0",
      stackPackContentHash: "2".repeat(64),
      platform: "web",
      techStack: "vite-react",
    },
    buildCommandId: "CMD_BUILD",
    previewCommandId: "CMD_PREVIEW",
    sourceBefore: candidate.sourceRevision,
    sourceAfter: candidate.sourceRevision,
    buildArtifact,
    runtime: {
      schema: "setfarm.v3-runtime-deployment.v1",
      mode: "local",
      projectId,
      serviceId: `process:${port}`,
      host: "127.0.0.1",
      port,
      healthUrl: `http://127.0.0.1:${port}/`,
      deployUrl: `http://127.0.0.1:${port}/`,
      evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}`,
      buildArtifactHash: buildArtifact.artifactHash,
      buildArtifactEvidenceRef: buildArtifact.evidenceRef,
      sealedRuntimeRef: `setfarm://deploy/sealed-runtime/${runId}/${candidate.candidateHash}/${buildArtifact.artifactHash}`,
      sealedRuntimeManifestHash,
      sealedRuntimeManifestEvidenceRef,
      sealAuthorityHash: runtimeAuthority.sealAuthorityHash,
      sealAuthorityEvidenceRef: runtimeAuthority.sealAuthorityEvidenceRef,
      runtimeDataContractHash: runtimeAuthority.runtimeDataContractHash,
      volumeProvisioning: runtimeAuthority.volumeProvisioning,
      runtimeIsolation: runtimeAuthority.runtimeIsolation,
    },
    health: {
      schema: "setfarm.v3-deploy-health-proof.v1",
      status: "pass",
      httpStatus: 200,
      checkedAt: NOW,
      evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}/health`,
      buildArtifactHash: buildArtifact.artifactHash,
      buildArtifactEvidenceRef: buildArtifact.evidenceRef,
      sealedRuntimeManifestHash,
      sealedRuntimeManifestEvidenceRef,
      listenerOwnership: {
        schema: "setfarm.v3-listener-ownership.v1",
        ownerProcess: process,
        listenerPids: [port],
        listenerProcesses: [process],
        host: "127.0.0.1",
        port,
        checkedAt: NOW,
        evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}/listener/${process.pid}`,
      },
      runtimeIsolation: runtimeAuthority.runtimeIsolationProof,
    },
    terminalProjectProjection: {
      schema: "setfarm.v3-terminal-project-projection.v1",
      owner: "mission-control-terminal-projector",
      state: "pending_terminal_projection",
      runId,
      candidateHash: candidate.candidateHash,
      projectId,
      serviceId: `process:${port}`,
      port,
      healthUrl: `http://127.0.0.1:${port}/`,
      evidenceRef: `setfarm://run/${runId}/deploy-receipt`,
      buildArtifactHash: buildArtifact.artifactHash,
    },
    environmentNames: [],
    completedAt: NOW,
  });
  const projectProjection = {
    id: projectId,
    name: receipt.project.displayName,
    description: receipt.project.summary,
    type: "web" as const,
    ports: { frontend: port },
    deployUrl: receipt.runtime.deployUrl,
    service: receipt.runtime.serviceId,
    serviceStatus: "active" as const,
    status: "active" as const,
    stack: ["vite-react"],
    createdBy: "setfarm-v3-terminal-projector" as const,
    productCompilerProtocol: "v3" as const,
    workflowRunId: runId,
    setfarmRunIds: [runId],
    acceptedCandidateId: candidate.candidateId,
    acceptedCandidateHash: candidate.candidateHash,
    acceptedPacketHash: candidate.packetHash,
    acceptedSourceSha: candidate.sourceRevision.sha,
    acceptedSourceTreeHash: candidate.sourceRevision.treeHash,
    deploymentReceiptHash: receipt.receiptHash,
    deploymentReceiptRef: `setfarm://v3-deploy-receipts/${receipt.receiptHash}`,
    deploymentHealthRef: receipt.health.evidenceRef,
    deploymentHealthUrl: receipt.runtime.healthUrl,
    deployedAt: NOW,
    completedAt: NOW,
  };
  const projectionHash = hashCanonicalJson(projectProjection);
  const projectRecordHash = hashCanonicalJson({
    schema: "mission-control.v3-canonical-project-record.v1",
    projection: projectProjection,
    projectionHash,
    persistedAt: NOW,
  });
  const ackPayload = {
    schema: "setfarm.v3-project-transfer-ack.v1" as const,
    ackVersion: 1 as const,
    runId,
    candidateId: candidate.candidateId,
    candidateHash: candidate.candidateHash,
    packetHash: candidate.packetHash,
    sourceRevision: candidate.sourceRevision,
    deploymentReceiptHash: receipt.receiptHash,
    deploymentReceiptRef: `setfarm://v3-deploy-receipts/${receipt.receiptHash}`,
    sourceSnapshotHash: "0".repeat(64),
    projectId,
    projectProjection,
    projectionHash,
    projectRecordHash,
    projectRecordRef: `mission-control://projects/${projectId}/${projectRecordHash}`,
    persistedAt: NOW,
    projector: { service: "mission-control" as const, protocol: "v3" as const },
  };
  const acknowledgement = V3ProjectTransferAckV1Schema.parse({
    ...ackPayload,
    ackHash: hashCanonicalJson(ackPayload),
  });
  return { receipt, acknowledgement };
}

type LoadedCase = Awaited<ReturnType<typeof suite>>["suite"]["cases"][number];

function oracleEvaluation(evalCase: LoadedCase, pass: boolean) {
  const payload = {
    schema: "setfarm.task-intent-oracle-evaluation.v1" as const,
    oracleHash: taskIntentOracleHashV1(evalCase.task, evalCase.oracle),
    expectedDecision: evalCase.oracle.expectedDecision.kind,
    actualDecision: pass ? evalCase.oracle.expectedDecision.kind : "unavailable" as const,
    contractComplete: pass,
    decisionEvidenceVerified: pass,
    matchedIntentIds: pass && evalCase.oracle.expectedDecision.kind === "accepted_candidate"
      ? evalCase.oracle.expectations.map((expectation) => expectation.intentId).sort()
      : [],
    requiredEvidenceRefs: pass && evalCase.oracle.expectedDecision.kind === "accepted_candidate"
      ? ["EVID_ACTION_CONTROL"]
      : [],
    mismatchCodes: pass ? [] : ["ORACLE_FAKE_FAILURE"],
  };
  return { ...payload, evaluationHash: hashCanonicalJson(payload) };
}

function canonical(
  runId: string,
  evalCase: LoadedCase,
  pass = true,
  missingPredicate = false,
): ConvergenceRunCollection["canonical"] {
  const rejected = evalCase.oracle.expectedDecision.kind === "typed_rejection";
  const stackPackId = rejected ? null : evalCase.oracle.expectedDecision.stackPackId;
  const packet = {
    stateHash: "1".repeat(64), packetHash: pass && !rejected ? "2".repeat(64) : null,
    casAuditHash: "a".repeat(64), casDeepVerified: pass && !rejected,
    sealedStackPackId: pass && !rejected ? stackPackId : null,
    packetRows: pass && !rejected ? 1 : 0, artifactRefs: pass && !rejected ? 6 : 0,
    missingRequiredRefs: pass || rejected ? 0 : 1, missingArtifacts: 0, invalidBindings: 0,
  };
  const attempts = {
    stateHash: "3".repeat(64), attempts: pass && !rejected ? 1 : 0, active: 0,
    duplicateActiveTuples: 0, staleOwnership: 0, incompleteBindings: 0,
  };
  const findings = {
    stateHash: "4".repeat(64), findingSets: 0, openFindings: 0, invalidBindings: 0,
  };
  const recovery = {
    stateHash: "5".repeat(64), cases: 0, activeCases: 0,
    activeDeliveries: 0, overBudget: 0, invalidBindings: 0,
  };
  const evidence = {
    stateHash: "6".repeat(64), predicateCoverageHash: "0".repeat(64),
    bundles: pass && !rejected ? 1 : 0, passing: pass && !rejected ? 1 : 0,
    nonPassing: 0, missingAttemptEvidence: 0, invalidBindings: 0,
    missingExpectedPredicates: missingPredicate && !rejected ? 1 : 0,
    unexpectedProductPredicates: 0,
    missingInvariantRefs: 0,
    nonPassingRequiredPredicates: 0,
  };
  const accepted = acceptedSnapshotEvidence(runId);
  const acceptance = {
    stateHash: "f".repeat(64), candidateHash: pass && !rejected ? accepted.candidate.candidateHash : null,
    candidates: pass && !rejected ? 1 : 0, storyEvidence: pass && !rejected ? 1 : 0,
    sourceSha: pass && !rejected ? "8".repeat(40) : null,
    sourceTreeHash: pass && !rejected ? "7".repeat(40) : null,
    invalidBindings: 0,
  };
  const oracle = oracleEvaluation(evalCase, pass);
  const payload = {
    packet, attempts, findings, recovery, evidence, acceptance, oracle,
    invariantCodes: pass ? [] : rejected ? ["EVAL_TASK_INTENT_ORACLE_MISMATCH"] : ["EVAL_PACKET_HASH_MISSING"],
  };
  return ConvergenceCanonicalEvidenceV1Schema.parse({ ...payload, stateHash: hashCanonicalJson(payload) });
}

function snapshot(runId: string, rejected: boolean, snapshotHash?: string) {
  const accepted = acceptedSnapshotEvidence(runId);
  const transfer = rejected ? null : transferSnapshotEvidence(runId);
  const hashable: Parameters<typeof computeRunOperationalSnapshotHash>[0] = {
    schema: "setfarm.run-operational-snapshot.v1",
    generatedAt: NOW,
    source: {
      database: "postgres",
      projection: "complete",
      migrationVersions: [1],
      verifiedReleaseSha: SHA,
      capabilities: {
        attempts: true,
        claimBinding: true,
        runtimeOwnership: true,
        managerCompletion: true,
        effectLedger: true,
        findingRecovery: true,
        evidenceLedger: true,
        acceptedCandidate: true,
        deploymentReceipt: true,
        projectTransferAck: true,
      },
    },
    run: {
      ref: `setfarm://run/${runId}`,
      id: runId,
      runNumber: 1,
      protocol: "v3",
      status: rejected ? "failed" : "completed",
      terminal: true,
      updatedAt: NOW,
    },
    summary: {
      lifecycleState: "terminal",
      health: "ok",
      activeClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      openCompletions: 0,
      mandatoryEffectsPending: 0,
      unpublishedOutbox: 0,
      invariantViolations: 0,
      operatorActions: {
        stop: { allowed: false, reasonCode: "RUN_ALREADY_TERMINAL", stateHash: hashCanonicalJson({ runId, action: "stop" }) },
        resume: { allowed: false, reasonCode: "RUN_ALREADY_TERMINAL", stateHash: hashCanonicalJson({ runId, action: "resume" }) },
      },
    },
    claims: [],
    attempts: rejected ? [] : [accepted.attempt],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [],
    outbox: [],
    invariants: [],
    findingSets: [],
    evidenceBundles: rejected ? [] : [accepted.bundle],
    recoveryCases: [],
    recoveryDispatches: [],
    acceptedCandidate: rejected
      ? null
      : {
        ref: `setfarm://accepted-candidate/${accepted.candidate.candidateHash}`,
        candidate: accepted.candidate,
        createdAt: NOW,
      },
    deploymentReceipt: transfer
      ? {
          ref: `setfarm://v3-deploy-receipts/${transfer.receipt.receiptHash}`,
          receipt: transfer.receipt,
          createdAt: NOW,
        }
      : null,
    projectTransferAck: transfer
      ? {
          ref: `setfarm://v3-project-transfer-acks/${transfer.acknowledgement.ackHash}`,
          acknowledgement: transfer.acknowledgement,
          createdAt: NOW,
        }
      : null,
  };
  return RunOperationalSnapshotV1Schema.parse({
    ...hashable,
    snapshotHash: snapshotHash ?? computeRunOperationalSnapshotHash(hashable),
  });
}

type HarnessOptions = Readonly<{
  activeAtPreflight?: boolean;
  pass?: boolean;
  repeatedRoot?: boolean;
  manualMutation?: boolean;
  projectionMismatch?: boolean;
  projectionWrongRun?: boolean;
  predicateCoverageFailure?: boolean;
  neverTerminal?: boolean;
  releaseDriftBeforeStart?: boolean;
}>;

function harness(loaded: Awaited<ReturnType<typeof suite>>, options: HarnessOptions = {}) {
  let time = Date.parse(NOW);
  let starts = 0;
  let releaseInspections = 0;
  const runCases = new Map<string, (typeof loaded.suite.cases)[number]>();
  const artifacts: Array<{ schema: string; hash: string }> = [];
  const canaryCreations: Parameters<ConvergenceAdmissionPort["createCanary"]>[0][] = [];
  const promotions: Parameters<ConvergenceAdmissionPort["promoteReleaseGo"]>[0][] = [];
  const clock: ConvergenceClock = {
    now: () => new Date(time),
    sleep: async (milliseconds) => { time += milliseconds; },
  };
  const sql: ConvergenceSqlPort = {
    inspectPlatform: async () => ({
      migrationVerified: true,
      attestedReleaseSha: SHA,
      activeRuns: options.activeAtPreflight ? 1 : 0,
      openClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      activeRecoveryDeliveries: 0,
    }),
    readRun: async (runId): Promise<ConvergenceRunPoll> => {
      const evalCase = runCases.get(runId)!;
      const accepted = evalCase.oracle.expectedDecision.kind === "accepted_candidate";
      return {
        runId,
        runNumber: Number(runId.replace("run-", "")),
        status: options.neverTerminal ? "running" : accepted && options.pass !== false ? "completed" : "failed",
        terminal: options.neverTerminal !== true,
        protocol: "v3",
        compilerReleaseSha: SHA,
        actualStackPackId: accepted ? evalCase.oracle.expectedDecision.stackPackId : null,
        projectLocator: accepted ? "/private/eval-project" : null,
        ownership: { openClaims: 0, activeAttempts: 0, activeRuntimes: 0, activeRecoveryDeliveries: 0 },
      };
    },
    collectRun: async (runId): Promise<ConvergenceRunCollection> => {
      const evalCase = runCases.get(runId)!;
      const accepted = evalCase.oracle.expectedDecision.kind === "accepted_candidate";
      return {
        canonical: canonical(
          runId,
          evalCase,
          options.pass !== false,
          options.predicateCoverageFailure === true,
        ),
        rootCauseHash: options.repeatedRoot ? "9".repeat(64) : null,
        pullRequests: accepted
          ? [{ url: "https://github.com/example/project/pull/1", mergeStatus: "merged" }]
          : [],
      };
    },
  };
  const processPort: ConvergenceProcessPort = {
    inspectRelease: async () => ({
      headSha: options.releaseDriftBeforeStart && ++releaseInspections > 1 ? "f".repeat(40) : SHA,
      clean: true,
      runnerHash: "c".repeat(64),
      environmentHash: "d".repeat(64),
      providerId: "minimax",
      modelId: "minimax/MiniMax-M3",
      cliReady: true,
      v3ActivationEnabled: true,
    }),
    startRun: async ({ task, admission }) => {
      starts += 1;
      const evalCase = loaded.suite.cases.find((candidate) => candidate.task === task)!;
      assert.equal(admission.taskHash, hashCanonicalJson(task));
      assert.equal(admission.caseHash, hashCanonicalJson(evalCase));
      const runId = `run-${starts}`;
      runCases.set(runId, evalCase);
      return { runId, runNumber: starts };
    },
    inspectProject: async () => ({
      manualProjectMutationDetected: options.manualMutation === true,
      sourceHeadMatchesCanonical: options.manualMutation !== true,
      projectHeadSha: "8".repeat(40),
      projectTreeHash: "7".repeat(40),
      canonicalHeadSha: options.manualMutation === true ? "6".repeat(40) : "8".repeat(40),
      canonicalTreeHash: options.manualMutation === true ? "5".repeat(40) : "7".repeat(40),
    }),
    inspectGitHub: async (pullRequests) => ({
      stateHash: "e".repeat(64), pullRequests: pullRequests.length, unverified: 0, open: 0,
    }),
  };
  const http: ConvergenceHttpPort = {
    health: async (service) => ({ ok: true, evidenceHash: hashCanonicalJson({ service, ok: true }) }),
    operationalSnapshot: async (service, runId) => {
      const rejected = runCases.get(runId)?.oracle.expectedDecision.kind === "typed_rejection";
      const projected = snapshot(
        options.projectionWrongRun ? "different-run" : runId,
        rejected,
        options.projectionMismatch && service === "mission_control" ? "f".repeat(64) : undefined,
      );
      if (!options.projectionMismatch && !options.projectionWrongRun) {
        const { snapshotHash, ...hashable } = projected;
        assert.equal(computeRunOperationalSnapshotHash(hashable), snapshotHash);
      }
      return projected;
    },
    syncProject: async (runId) => ({
      ok: true,
      evidenceHash: hashCanonicalJson({ runId, synchronized: true }),
    }),
  };
  const artifactPort: ConvergenceArtifactPort = {
    prepare: async () => {},
    put: async (value) => {
      const hash = value.schema === "setfarm.product-convergence-release-gate.v1"
        ? value.gateHash
        : value.resultHash;
      artifacts.push({ schema: value.schema, hash });
      return { hash, locator: `sha256/${hash.slice(0, 2)}/${hash}.json`, created: true };
    },
  };
  const admissions: ConvergenceAdmissionPort = {
    createCanary: async (input) => {
      canaryCreations.push(input);
      const admissionHash = hashCanonicalJson(input);
      return {
        contexts: input.slots.map((slot) => ({
          schema: "setfarm.internal-convergence-admission.v1" as const,
          admissionHash,
          slotHash: hashCanonicalJson({ admissionHash, ...slot }),
          caseHash: slot.caseHash,
          taskHash: slot.taskHash,
          repetition: slot.repetition,
          slotToken: slot.slotToken,
        })),
      };
    },
    promoteReleaseGo: async (input) => { promotions.push(input); },
  };
  const ports: ConvergenceRunnerPorts = {
    sql,
    process: processPort,
    http,
    artifacts: artifactPort,
    admissions,
    clock,
  };
  return {
    ports,
    starts: () => starts,
    artifacts,
    canaryCreations,
    promotions,
  };
}

describe("product convergence suite contract", () => {
  it("loads independent baseline, holdout, multilingual, and negative oracle cases", async () => {
    const loaded = await suite();
    assert.equal(loaded.suite.cases.length, 8);
    assert.deepEqual(Object.fromEntries(["utility", "operations", "game", "negative"].map((productClass) => [
      productClass,
      loaded.suite.cases.filter((item) => item.productClass === productClass).length,
    ])), { utility: 2, operations: 2, game: 2, negative: 2 });
    assert.ok(loaded.suite.cases.some((item) => item.oracle.variant === "paraphrase"));
    assert.ok(loaded.suite.cases.some((item) => item.oracle.variant === "multilingual"));
    assert.deepEqual(
      loaded.suite.cases.filter((item) => item.productClass === "negative").map((item) => item.oracle.variant).sort(),
      ["ambiguous", "unsupported"],
    );
    for (const item of loaded.suite.cases) {
      assert.deepEqual(evaluateTaskIntentOracleTaskBindingV1(item.task, item.oracle).mismatchCodes, [], item.caseId);
      assert.match(taskIntentOracleHashV1(item.task, item.oracle), /^[a-f0-9]{64}$/);
    }
    const serialized = JSON.stringify(loaded.suite);
    assert.equal(serialized.includes("requiredPredicateRefs"), false);
    assert.equal(serialized.includes("EVID_REFRESH_STATUS_CONTROL"), false);
  });

  it("rejects unknown fields, host paths, existing repo flags, and incomplete class coverage", async () => {
    const loaded = await suite();
    assert.equal(ProductConvergenceSuiteV1Schema.safeParse({ ...loaded.suite, extra: true }).success, false);
    const unsafe = structuredClone(loaded.suite);
    unsafe.cases[0]!.task += " --repo /Users/example/project";
    assert.equal(ProductConvergenceSuiteV1Schema.safeParse(unsafe).success, false);
    const duplicate = structuredClone(loaded.suite);
    duplicate.cases[2] = structuredClone(duplicate.cases[0]!);
    assert.equal(ProductConvergenceSuiteV1Schema.safeParse(duplicate).success, false);
  });

  it("requires the exact product predicate set and every declared canonical invariant", () => {
    const exact = evaluateConvergencePredicateCoverage({
      requiredPredicateRefs: ["EVID_ACTION_CONTROL", "EVID_ACTION_STATE"],
      invariantRefs: ["INV_COMMAND_BUILD", "INV_CONTROL_ACTION", "INV_STATE_TRANSITION"],
      predicates: [
        { predicateRef: "EVID_ACTION_CONTROL", invariantRef: "INV_CONTROL_ACTION", required: true, verdict: "pass" },
        { predicateRef: "EVID_ACTION_STATE", invariantRef: "INV_STATE_TRANSITION", required: true, verdict: "pass" },
        { predicateRef: "EVID_COMMAND_BUILD_MAIN", invariantRef: "INV_COMMAND_BUILD", required: true, verdict: "pass" },
      ],
    });
    assert.deepEqual({
      missingExpectedPredicates: exact.missingExpectedPredicates,
      unexpectedProductPredicates: exact.unexpectedProductPredicates,
      missingInvariantRefs: exact.missingInvariantRefs,
      nonPassingRequiredPredicates: exact.nonPassingRequiredPredicates,
    }, {
      missingExpectedPredicates: 0,
      unexpectedProductPredicates: 0,
      missingInvariantRefs: 0,
      nonPassingRequiredPredicates: 0,
    });

    const drift = evaluateConvergencePredicateCoverage({
      requiredPredicateRefs: ["EVID_ACTION_CONTROL", "EVID_ACTION_STATE"],
      invariantRefs: ["INV_COMMAND_BUILD", "INV_CONTROL_ACTION", "INV_STATE_TRANSITION"],
      predicates: [
        { predicateRef: "EVID_ACTION_CONTROL", invariantRef: "INV_CONTROL_ACTION", required: true, verdict: "fail" },
        { predicateRef: "EVID_UNDECLARED_PRODUCT", invariantRef: "INV_RUNTIME", required: true, verdict: "pass" },
      ],
    });
    assert.deepEqual({
      missingExpectedPredicates: drift.missingExpectedPredicates,
      unexpectedProductPredicates: drift.unexpectedProductPredicates,
      missingInvariantRefs: drift.missingInvariantRefs,
      nonPassingRequiredPredicates: drift.nonPassingRequiredPredicates,
    }, {
      missingExpectedPredicates: 2,
      unexpectedProductPredicates: 1,
      missingInvariantRefs: 3,
      nonPassingRequiredPredicates: 1,
    });
  });
});

describe("convergence runner", () => {
  it("keeps its canonical projection fixtures valid at both terminal outcomes", () => {
    assert.doesNotThrow(() => snapshot("run-fixture-positive", false));
    assert.doesNotThrow(() => snapshot("run-fixture-negative", true));
  });

  it("defaults to read-only preflight and starts no run", async () => {
    const loaded = await suite();
    const fake = harness(loaded);
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA }, fake.ports);
    assert.equal(output.result.executionMode, "preflight");
    assert.equal(output.result.status, "planned");
    assert.equal(output.result.runs.length, 0);
    assert.equal(fake.starts(), 0);
    assert.equal(fake.canaryCreations.length, 0);
    assert.equal(fake.artifacts.length, 2, "aggregate result and NO-GO preflight gate are persisted");
    assert.equal(output.gate.decision, "no_go");
  });

  it("binds both service health checks and result-store preparation independently", async () => {
    const loaded = await suite();
    const missionControlDown = harness(loaded);
    const healthCalls: string[] = [];
    const unavailable = await runConvergenceSuite(loaded, { releaseSha: SHA }, {
      ...missionControlDown.ports,
      http: {
        ...missionControlDown.ports.http,
        async health(service) {
          healthCalls.push(service);
          return {
            ok: service === "setfarm",
            evidenceHash: hashCanonicalJson({ service, ok: service === "setfarm" }),
          };
        },
      },
    });
    assert.deepEqual(healthCalls, ["setfarm", "mission_control"]);
    assert.equal(unavailable.result.preflight.checks.find((check) => check.id === "setfarm_health")?.status, "pass");
    assert.equal(unavailable.result.preflight.checks.find((check) => check.id === "mission_control_health")?.status, "fail");
    assert.equal(unavailable.result.preflight.checks.find((check) => check.id === "result_store")?.status, "pass");
    assert.equal(unavailable.result.status, "blocked");

    const storeDown = harness(loaded);
    const unprepared = await runConvergenceSuite(loaded, { releaseSha: SHA }, {
      ...storeDown.ports,
      artifacts: {
        ...storeDown.ports.artifacts,
        async prepare() { throw new Error("store unavailable"); },
      },
    });
    assert.equal(unprepared.result.preflight.checks.find((check) => check.id === "setfarm_health")?.status, "pass");
    assert.equal(unprepared.result.preflight.checks.find((check) => check.id === "mission_control_health")?.status, "pass");
    assert.equal(unprepared.result.preflight.checks.find((check) => check.id === "result_store")?.status, "fail");
    assert.equal(unprepared.result.status, "blocked");
  });

  it("executes eight clean positive and typed-rejection cases sequentially on one exact release", async () => {
    const loaded = await suite();
    const fake = harness(loaded);
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(output.result.status, "pass", JSON.stringify(output.result.runs.map((run) => ({
      caseId: run.caseId,
      passed: run.passed,
      disposition: run.disposition,
      projection: run.projection,
      canonicalCodes: run.canonical.invariantCodes,
    })), null, 2));
    assert.equal(fake.starts(), 8);
    assert.equal(fake.canaryCreations.length, 1);
    assert.equal(fake.canaryCreations[0]?.slots.length, 8);
    assert.equal(output.result.runs.length, 8);
    assert.deepEqual(output.result.runs.map((item) => item.productClass), [
      "utility", "utility", "operations", "operations", "game", "game", "negative", "negative",
    ]);
    assert.ok(output.result.runs.every((item) => item.releaseSha === SHA && item.passed));
    assert.equal(fake.artifacts.length, 10, "each run, aggregate, and release gate are persisted append-only");
    assert.equal(output.gate.decision, "go");
    assert.equal(fake.promotions.length, 1);
    assert.equal(fake.promotions[0]?.gateHash, output.gate.gateHash);
    assert.equal(evaluateConvergenceReleaseGate(output.result).gateHash, output.gate.gateHash);
    assert.equal(fake.artifacts.at(-1)!.schema, "setfarm.product-convergence-release-gate.v1");
  });

  it("fails closed before execution when live ownership is active", async () => {
    const loaded = await suite();
    const fake = harness(loaded, { activeAtPreflight: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(output.result.status, "blocked");
    assert.equal(fake.starts(), 0);
    assert.equal(fake.canaryCreations.length, 0);
    assert.ok(output.result.blockerCodes.includes("EVAL_PREFLIGHT_BLOCKED"));
  });

  it("rechecks the exact release immediately before every start", async () => {
    const loaded = await suite();
    const fake = harness(loaded, { releaseDriftBeforeStart: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(fake.starts(), 0);
    assert.equal(output.result.status, "blocked");
    assert.ok(output.result.blockerCodes.includes("EVAL_RELEASE_IDENTITY_DRIFT"));
  });

  it("stops after the third observation of the same canonical root cause", async () => {
    const loaded = await suite(2);
    const fake = harness(loaded, { pass: false, repeatedRoot: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(fake.starts(), 3);
    assert.equal(output.result.plannedRuns, 16);
    assert.equal(output.result.status, "blocked");
    assert.equal(output.result.stoppedOnRepeatedRootCause, "9".repeat(64));
    assert.deepEqual(output.result.rootCauseCounts, [{ rootCauseHash: "9".repeat(64), count: 3 }]);
  });

  it("invalidates a manually mutated generated project and does not start another case", async () => {
    const loaded = await suite();
    const fake = harness(loaded, { manualMutation: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(fake.starts(), 1);
    assert.equal(output.result.runs[0]!.passed, false);
    assert.equal(output.result.runs[0]!.ownership.manualProjectMutationDetected, true);
    assert.ok(output.result.blockerCodes.includes("EVAL_RUN_IDENTITY_INVALIDATED"));
  });

  it("bounds polling, records timeout, and leaves the active run untouched", async () => {
    const loaded = await suite();
    const fake = harness(loaded, { neverTerminal: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(fake.starts(), 1);
    assert.equal(output.result.runs[0]!.disposition, "timeout");
    assert.equal(output.result.status, "blocked");
    assert.ok(output.result.blockerCodes.includes("EVAL_RUN_TIMEOUT_ACTIVE_OWNERSHIP"));
  });

  it("records a Mission Control hash mismatch as failure instead of trusting prose", async () => {
    const loaded = await suite();
    const fake = harness(loaded, { projectionMismatch: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(output.result.status, "fail");
    assert.ok(output.result.runs.every((item) => !item.passed && !item.projection.exactHashMatch));
    assert.equal(evaluateConvergenceReleaseGate(output.result).decision, "no_go");
  });

  it("rejects equal snapshot hashes when both projections identify the wrong run", async () => {
    const loaded = await suite();
    const fake = harness(loaded, { projectionWrongRun: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(output.result.status, "fail");
    assert.ok(output.result.runs.every((item) =>
      !item.passed
      && item.projection.setfarmProjection === "unavailable"
      && item.projection.missionControlProjection === "unavailable"));
  });

  it("fails when a declared product predicate lacks exact passing canonical evidence", async () => {
    const loaded = await suite();
    const fake = harness(loaded, { predicateCoverageFailure: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(output.result.status, "fail");
    const positives = output.result.runs.filter((item) => item.expectedDecision === "accepted_candidate");
    const negatives = output.result.runs.filter((item) => item.expectedDecision === "typed_rejection");
    assert.ok(positives.every((item) => item.canonical.evidence.missingExpectedPredicates === 1 && !item.passed));
    assert.ok(negatives.every((item) => item.canonical.evidence.missingExpectedPredicates === 0 && item.passed), JSON.stringify(negatives, null, 2));
  });
});

describe("content-addressed convergence results", () => {
  it("writes append-only artifacts, reuses identical bytes, and never embeds host paths", async () => {
    const loaded = await suite();
    const fake = harness(loaded);
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA }, fake.ports);
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-convergence-results-"));
    roots.push(root);
    const store = new ContentAddressedEvalResultStore(root);
    const first = await store.put(output.result);
    const second = await store.put(output.result);
    const gate = await store.put(output.gate);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.locator.startsWith("sha256/"), true);
    assert.equal(gate.hash, output.gate.gateHash);
    assert.deepEqual(await store.getResult(output.result.resultHash), output.result);
    assert.deepEqual(await store.getReleaseGate(output.gate.gateHash), output.gate);
    const bytes = await readFile(path.join(root, first.locator), "utf8");
    assert.equal(bytes.includes("/Users/"), false);
    assert.equal(bytes.includes("postgresql://"), false);
    await writeFile(path.join(root, first.locator), "tampered\n", "utf8");
    await assert.rejects(() => store.put(output.result), /EVAL_RESULT_HASH_COLLISION/);
    await assert.rejects(() => store.getResult(output.result.resultHash));
  });

  it("rejects absolute host paths at the strict result boundary", async () => {
    const loaded = await suite();
    const fake = harness(loaded);
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA }, fake.ports);
    const unsafe = structuredClone(output.result);
    unsafe.runs = [];
    assert.equal(ConvergenceEvalResultV1Schema.safeParse({ ...unsafe, unknown: "/Users/private" }).success, false);
    assert.throws(() => createConvergenceResult({ ...unsafe, resultHash: undefined }));
    assert.equal(ConvergenceEvalResultV1Schema.safeParse({
      ...output.result,
      resultHash: "f".repeat(64),
    }).success, false);
  });

  it("promotes only a deep-verified execute/full-pass GO and reuses its exact immutable authority", async () => {
    const loaded = await suite();
    const database = await createIsolatedTestDatabase();
    const root = await mkdtemp(path.join(tmpdir(), "setfarm-convergence-release-go-"));
    roots.push(root);
    const store = new ContentAddressedEvalResultStore(root);
    const admissions = createV3ReleaseAdmissionRepository(database.sql, store, {
      now: () => new Date(NOW),
    });
    try {
      const unconsumed = harness(loaded);
      await assert.rejects(
        runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, {
          ...unconsumed.ports,
          artifacts: store,
          admissions,
        }),
        (error: unknown) => error instanceof V3ReleaseAdmissionError
          && error.code === "V3_RELEASE_ADMISSION_ARTIFACT_INVALID",
      );
      const absent = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count FROM v3_release_admissions
         WHERE kind = 'release_go' AND release_sha = ${SHA}
      `;
      assert.equal(absent[0]?.count, 0);

      const fake = harness(loaded);
      const output = await runConvergenceSuite(loaded, {
        releaseSha: SHA,
        execute: true,
      }, {
        ...fake.ports,
        process: {
          ...fake.ports.process,
          async startRun(input) {
            const started = await fake.ports.process.startRun(input);
            const admissionRows = await database.sql<Array<{ preflight_hash: string }>>`
              SELECT payload->>'preflightHash' AS preflight_hash
                FROM v3_release_admissions
               WHERE admission_hash = ${input.admission.admissionHash}
            `;
            const protocol = resolveNewRunProtocol({
              requestedMode: "v3",
              compilerReleaseSha: SHA,
              env: { SETFARM_V3_ACTIVATION: "enabled" },
              activationPreflight: {
                status: "pass",
                hash: admissionRows[0]!.preflight_hash,
                stored: true,
              },
              releaseAdmission: {
                admissionHash: input.admission.admissionHash,
                kind: "convergence_canary",
                releaseSha: SHA,
                canary: input.admission,
              },
            });
            await database.sql.begin((sql) => persistWorkflowRun(sql, {
              run: {
                id: started.runId,
                runNumber: started.runNumber,
                workflowId: loaded.suite.workflowId,
                task: input.task,
                context: "{}",
                notifyUrl: null,
                createdAt: NOW,
                protocol,
              },
              steps: [],
            }));
            const evalCase = loaded.suite.cases.find((item) => item.task === input.task)!;
            const status = evalCase.oracle.expectedDecision.kind === "accepted_candidate"
              ? "completed"
              : "failed";
            await database.sql`UPDATE runs SET status = ${status} WHERE id = ${started.runId}`;
            return started;
          },
        },
        artifacts: store,
        admissions,
      });
      assert.equal(output.gate.decision, "go");
      const rows = await database.sql<Array<{
        admission_hash: string;
        result_hash: string;
        gate_hash: string;
      }>>`
        SELECT admission_hash, result_hash, gate_hash
          FROM v3_release_admissions
         WHERE kind = 'release_go' AND release_sha = ${SHA}
      `;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.result_hash, output.result.resultHash);
      assert.equal(rows[0]?.gate_hash, output.gate.gateHash);
      const first = await admissions.requireReleaseGo(SHA);
      assert.equal(first.admissionHash, rows[0]?.admission_hash);
      const protocol = resolveNewRunProtocol({
        requestedMode: "v3",
        compilerReleaseSha: SHA,
        env: { SETFARM_V3_ACTIVATION: "enabled" },
        activationPreflight: {
          status: "pass",
          hash: output.result.preflight.preflightHash,
          stored: true,
        },
        releaseAdmission: first,
      });
      await database.sql.begin((sql) => persistWorkflowRun(sql, {
        run: {
          id: "release-go-normal-v3-run",
          runNumber: 501,
          workflowId: "feature-dev",
          task: "a normal v3 run authorized by the promoted release",
          context: "{}",
          notifyUrl: null,
          createdAt: new Date(NOW).toISOString(),
          protocol,
        },
        steps: [],
      }));
      const persisted = await database.sql<Array<{ release_admission_hash: string }>>`
        SELECT release_admission_hash FROM runs WHERE id = 'release-go-normal-v3-run'
      `;
      assert.equal(persisted[0]?.release_admission_hash, first.admissionHash);
      await database.sql`UPDATE runs SET status = 'completed'
                          WHERE id = 'release-go-normal-v3-run'`;

      const promotion = {
        releaseSha: SHA,
        suiteHash: loaded.suiteHash,
        resultHash: output.artifact.hash,
        resultRef: output.artifact.locator,
        gateHash: output.gateArtifact.hash,
        gateRef: output.gateArtifact.locator,
      };
      const repeated = await Promise.all([
        admissions.promoteReleaseGo(promotion),
        admissions.promoteReleaseGo(promotion),
      ]);
      assert.equal(repeated[0].admissionHash, repeated[1].admissionHash);
      assert.equal(repeated[0].admissionHash, first.admissionHash);

      await writeFile(path.join(root, output.gateArtifact.locator), "tampered\n", "utf8");
      await assert.rejects(
        admissions.requireReleaseGo(SHA),
        (error: unknown) => error instanceof V3ReleaseAdmissionError
          && error.code === "V3_RELEASE_ADMISSION_ARTIFACT_INVALID",
      );
    } finally {
      await database.cleanup();
    }
  });
});
