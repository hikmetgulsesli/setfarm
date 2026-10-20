import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";

import { createAcceptedCandidateV1 } from "../../src/evidence/accepted-candidate-v1.js";
import {
  createV3BuildArtifactV1,
  createV3DeployReceiptV1,
} from "../../src/execution/schemas/v3-deploy-receipt-v1.js";
import { V3ProjectTransferAckV1Schema } from "../../src/execution/schemas/v3-project-transfer-ack-v1.js";
import { computeRunOperationalSnapshotHash } from "../../src/server/run-operational-snapshot.js";
import { computeRunOperationalSnapshotHashV3, RunOperationalSnapshotV3Schema } from "../../src/server/schemas/run-operational-snapshot-v3.js";
import { convergenceAcceptedOperationalSnapshotFixtureV1, convergenceOperationalSnapshotV3Fixture } from "./fixtures/convergence-operational-snapshot-v3.js";
import { RunOperationalSnapshotV2Schema } from "../../src/server/schemas/run-operational-snapshot-v2.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  type ConvergenceJobControlV1,
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
  canonicalConvergenceScopedFailureV1,
  createNodeConvergenceProcessPort,
  runConvergenceSuite,
} from "../../src/evals/convergence-runner.js";
import {
  ConvergenceCanonicalEvidenceV1Schema,
  ConvergenceEvalResultV1Schema,
  ConvergenceOwnershipEvidenceV1Schema,
  createConvergenceResult,
} from "../../src/evals/result-schema.js";
import { ConvergenceCanonicalEvidenceV2Schema } from "../../src/evals/result-schema-v2.js";
import { evaluateConvergenceReleaseGate } from "../../src/evals/release-gate.js";
import { ContentAddressedEvalResultStore } from "../../src/evals/report.js";
import {
  V3ReleaseAdmissionError,
  createV3ReleaseAdmissionRepository,
} from "../../src/execution/v3-release-admission-repository.js";
import { resolveNewRunProtocol } from "../../src/execution/run-protocol.js";
import { type PersistWorkflowRunInputV1 } from "../../src/execution/run-persistence.js";
import { createV3DownstreamTerminalOperationalFailureCauseV1 } from "../../src/recovery/v3-downstream-terminal-cause-v1.js";
import {
  ProductConvergenceSuiteV1Schema,
  loadConvergenceSuite,
  type ConvergenceCaseV1,
} from "../../src/evals/suite-schema.js";
import {
  ProductConvergenceSuiteV2Schema,
  type ConvergenceCaseV2,
} from "../../src/evals/suite-schema-v2.js";
import {
  evaluateTaskIntentOracleTaskBindingV1,
  taskIntentOracleHashV1,
} from "../../src/evals/task-intent-oracle.js";
import {
  createTaskIntentOracleEvaluationV2,
  evaluateTaskIntentOracleTaskBindingV2,
  taskIntentOracleHashV2,
} from "../../src/evals/task-intent-oracle-v2.js";
import { assertFreshInstallationSelectionUnchangedV1, freshInstallationSelectionV1 } from "../../src/installation/fresh-installation-selection-v1.js";
import { createIsolatedTestDatabase } from "../execution-attempts/test-database.js";
import { buildNoVolumeRuntimeAuthorityFixture } from "../execution-attempts/fixtures/v3-runtime-authority.js";


// ESM dependencies load before these hooks. Root's unchanged eager-import
// no-log/no-event-write audit remains an execution prerequisite. Runtime error
// paths resolve logger/events from this marker for the entire admitted file.
const previousLogEventDbPath = process.env.SETFARM_DB_PATH;
let ownedLogEventRoot: string | undefined;
before(async () => {
  // Never serialize the credential-bearing captured selection in an assertion.
  assert.equal(freshInstallationSelectionV1 === null, true, "isolated whole-file tests require no captured fresh installation");
  assertFreshInstallationSelectionUnchangedV1();
  ownedLogEventRoot = await mkdtemp(path.join(tmpdir(), "setfarm-task3-eval-log-events-"));
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

const SHA = "a".repeat(40);
const HASH = "b".repeat(64);
const REPEATED_OPERATIONAL_CAUSE = {
  schema: "setfarm.operational-failure-cause.v1" as const,
  workflowStepId: "setup-build",
  boundary: "stitch.converter.generated_tsx",
  failureClass: "generated_artifact_invalid",
  failureCode: "V3_OBSERVABLE_REF_INVALID",
};
const REPEATED_OPERATIONAL_CAUSE_HASH = hashCanonicalJson(REPEATED_OPERATIONAL_CAUSE);
const REPEATED_MULTI_REASON_OPERATIONAL_CAUSE =
  createV3DownstreamTerminalOperationalFailureCauseV1({
    workflowStepId: "qa-test",
    terminalReasonCodes: ["specification_incomplete", "operator_required"],
  });
const REPEATED_MULTI_REASON_OPERATIONAL_CAUSE_HASH = hashCanonicalJson(
  REPEATED_MULTI_REASON_OPERATIONAL_CAUSE,
);
// Admission expiry is a live lease fence checked by run persistence. Anchor
// the deterministic suite clock to this process instead of an absolute date
// that eventually turns the positive release-GO fixture into an expired canary.
const NOW = new Date().toISOString();
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function suite(repetitionsPerCase = 1) {
  const loaded = await loadConvergenceSuite(path.resolve("evals/suites/product-convergence-v1.json"));
  const value = ProductConvergenceSuiteV1Schema.parse({ ...loaded.suite, repetitionsPerCase });
  return { suite: value, suiteHash: hashCanonicalJson(value) };
}

async function suiteV2(repetitionsPerCase = 1) {
  const raw = JSON.parse(await readFile(path.resolve("evals/suites/product-convergence-v1.json"), "utf8"));
  const value = ProductConvergenceSuiteV2Schema.parse({
    ...raw,
    schema: "setfarm.product-convergence-suite.v2",
    suiteId: "product-convergence-v2-runner",
    suiteVersion: 2,
    repetitionsPerCase,
    cases: raw.cases.map((item: any) => ({
      ...item,
      oracle: {
        ...item.oracle,
        schema: "setfarm.task-intent-oracle.v2",
        oracleVersion: 2,
        expectedDecision: item.oracle.expectedDecision.kind === "typed_rejection"
          ? {
              kind: "typed_rejection",
              requiredReasonCodes: item.oracle.expectedDecision.reasonCodes,
              allowedReasonCodes: item.oracle.expectedDecision.reasonCodes,
              reasonRequirements: item.oracle.expectedDecision.reasonCodes.map((reasonCode: string) => ({
                reasonCode,
                clauseRefs: item.oracle.clauses.map((clause: any) => clause.clauseId),
              })),
            }
          : item.oracle.expectedDecision,
      },
    })),
  });
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

type LoadedCase = ConvergenceCaseV1 | ConvergenceCaseV2;

function oracleEvaluation(evalCase: LoadedCase, pass: boolean) {
  if (evalCase.oracle.schema === "setfarm.task-intent-oracle.v2") {
    const binding = evaluateTaskIntentOracleTaskBindingV2(evalCase.task, evalCase.oracle);
    const decision = evalCase.oracle.expectedDecision;
    const declaredReasonRequirements = decision.kind === "typed_rejection"
      ? decision.reasonRequirements.map((item) => ({
          reasonCode: item.reasonCode,
          requirementRefs: item.clauseRefs
            .map((clauseRef) => binding.requirementIdsByClause.get(clauseRef))
            .filter((value): value is string => Boolean(value))
            .sort(),
        })).sort((left, right) => left.reasonCode.localeCompare(right.reasonCode))
      : [];
    const actualReasonRequirements = pass && decision.kind === "typed_rejection"
      ? declaredReasonRequirements.filter((item) => decision.requiredReasonCodes.includes(item.reasonCode))
      : [];
    return createTaskIntentOracleEvaluationV2({
      schema: "setfarm.task-intent-oracle-evaluation.v2",
      oracleHash: taskIntentOracleHashV2(evalCase.task, evalCase.oracle),
      expectedDecision: decision.kind,
      actualDecision: pass ? decision.kind : "unavailable",
      contractComplete: pass,
      decisionEvidenceVerified: pass,
      matchedIntentIds: pass && decision.kind === "accepted_candidate"
        ? evalCase.oracle.expectations.map((expectation) => expectation.intentId).sort()
        : [],
      requiredEvidenceRefs: pass && decision.kind === "accepted_candidate"
        ? ["EVID_ACTION_CONTROL"]
        : [],
      rejectionContract: decision.kind === "typed_rejection"
        ? {
            requiredReasonCodes: decision.requiredReasonCodes,
            allowedReasonCodes: decision.allowedReasonCodes,
            actualReasonCodes: actualReasonRequirements.map((item) => item.reasonCode),
            declaredReasonRequirements,
            actualReasonRequirements,
          }
        : null,
      mismatchCodes: pass ? [] : ["ORACLE_FAKE_FAILURE"],
    });
  }
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
  const value = { ...payload, stateHash: hashCanonicalJson(payload) };
  return evalCase.oracle.schema === "setfarm.task-intent-oracle.v2"
    ? ConvergenceCanonicalEvidenceV2Schema.parse(value)
    : ConvergenceCanonicalEvidenceV1Schema.parse(value);
}

function snapshot(
  runId: string,
  rejected: boolean,
  snapshotHash?: string,
  implementationSubmissionEvidence = true,
) {
  const accepted = acceptedSnapshotEvidence(runId);
  const transfer = rejected ? null : transferSnapshotEvidence(runId);
  const hashable: Parameters<typeof computeRunOperationalSnapshotHash>[0] = {
    schema: "setfarm.run-operational-snapshot.v2",
    generatedAt: NOW,
    source: {
      database: "postgres",
      projection: implementationSubmissionEvidence ? "complete" : "partial",
      migrationVersions: [19],
      verifiedReleaseSha: SHA,
      capabilities: {
        attempts: true,
        claimBinding: true,
        runtimeOwnership: true,
        managerCompletion: true,
        implementationSubmissionEvidence,
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
  return RunOperationalSnapshotV2Schema.parse({
    ...hashable,
    snapshotHash: snapshotHash ?? computeRunOperationalSnapshotHash(hashable),
  });
}

type HarnessOptions = Readonly<{
  projectionVersion?: "v3";
  activeAtPreflight?: boolean;
  artifactIndexUnready?: boolean;
  pass?: boolean;
  repeatedRoot?: boolean;
  repeatedMultiReasonRoot?: boolean;
  scopedRoot?: boolean;
  manualMutation?: boolean;
  provisionalIdentity?: boolean;
  projectionMismatch?: boolean;
  projectionWrongRun?: boolean;
  submissionEvidenceCapabilityUnavailable?: boolean;
  predicateCoverageFailure?: boolean;
  neverTerminal?: boolean;
  releaseDriftBeforeStart?: boolean;
  releaseDriftAfterStart?: boolean;
}>;

type LoadedSuiteFixture = Awaited<ReturnType<typeof suite>> | Awaited<ReturnType<typeof suiteV2>>;

function harness(loaded: LoadedSuiteFixture, options: HarnessOptions = {}) {
  let time = Date.parse(NOW);
  let starts = 0;
  let releaseInspections = 0;
  const runCases = new Map<string, LoadedCase>();
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
      artifactIndexReady: options.artifactIndexUnready !== true,
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
        operationalFailureCause: options.repeatedMultiReasonRoot
          ? REPEATED_MULTI_REASON_OPERATIONAL_CAUSE
          : options.repeatedRoot
            ? REPEATED_OPERATIONAL_CAUSE
            : null,
        scopedFailure: options.scopedRoot ? {
          workflowStepId: "setup-build",
          phase: "building",
          kind: "step",
        } : null,
        pullRequests: accepted
          ? [{ url: "https://github.com/example/project/pull/1", mergeStatus: "merged" }]
          : [],
      };
    },
  };
  const processPort: ConvergenceProcessPort = {
    inspectRelease: async () => ({
      headSha: (options.releaseDriftBeforeStart && ++releaseInspections > 1)
        || (options.releaseDriftAfterStart && starts > 0)
        ? "f".repeat(40)
        : SHA,
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
    inspectProject: async () => options.provisionalIdentity
      ? {
          projectIdentityState: "provisional" as const,
          workingTreeDirty: true,
          manualProjectMutationDetected: false,
          sourceHeadMatchesCanonical: false,
          projectHeadSha: "8".repeat(40),
          projectTreeHash: "7".repeat(40),
          canonicalHeadSha: null,
          canonicalTreeHash: null,
        }
      : {
          projectIdentityState: options.manualMutation ? "invalid" as const : "verified" as const,
          workingTreeDirty: options.manualMutation === true,
          manualProjectMutationDetected: options.manualMutation === true,
          sourceHeadMatchesCanonical: options.manualMutation !== true,
          projectHeadSha: "8".repeat(40),
          projectTreeHash: "7".repeat(40),
          canonicalHeadSha: options.manualMutation === true ? "6".repeat(40) : "8".repeat(40),
          canonicalTreeHash: options.manualMutation === true ? "5".repeat(40) : "7".repeat(40),
        },
    inspectGitHub: async (pullRequests) => ({
      stateHash: "e".repeat(64), pullRequests: pullRequests.length, unverified: 0, open: 0,
    }),
  };
  const http: ConvergenceHttpPort = {
    health: async (service) => ({ ok: true, evidenceHash: hashCanonicalJson({ service, ok: true }) }),
    operationalSnapshot: async (service, runId) => {
      const rejected = runCases.get(runId)?.oracle.expectedDecision.kind === "typed_rejection";
      if (options.projectionVersion === "v3") {
        const decision = runCases.get(runId)!.oracle.expectedDecision;
        return decision.kind === "typed_rejection"
          ? convergenceOperationalSnapshotV3Fixture(runId,
              runCases.get(runId)!.caseId === "negative-ambiguous-product"
                ? "PRODUCT_SPEC_TASK_AMBIGUOUS" : "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED")
          : convergenceAcceptedOperationalSnapshotFixtureV1({ runId, version: "v3" });
      }
      const projected = snapshot(
        options.projectionWrongRun ? "different-run" : runId,
        rejected,
        options.projectionMismatch && service === "mission_control" ? "f".repeat(64) : undefined,
        options.submissionEvidenceCapabilityUnavailable !== true,
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
  it("loads independent baseline, holdout, compositional, and negative oracle cases", async () => {
    const loaded = await suite();
    assert.equal(loaded.suite.cases.length, 8);
    assert.deepEqual(Object.fromEntries(["utility", "operations", "game", "negative"].map((productClass) => [
      productClass,
      loaded.suite.cases.filter((item) => item.productClass === productClass).length,
    ])), { utility: 2, operations: 2, game: 2, negative: 2 });
    assert.ok(loaded.suite.cases.some((item) => item.oracle.variant === "paraphrase"));
    assert.deepEqual(
      loaded.suite.cases.filter((item) => item.oracle.variant === "compositional").map((item) => item.caseId).sort(),
      ["game-restart-compositional", "utility-preference-compositional"],
    );
    assert.deepEqual([...new Set(loaded.suite.cases.map((item) => item.oracle.locale))], ["en"]);
    assert.deepEqual(
      loaded.suite.cases.filter((item) => item.productClass === "negative").map((item) => item.oracle.variant).sort(),
      ["ambiguous", "unsupported"],
    );
    for (const item of loaded.suite.cases) {
      assert.deepEqual(evaluateTaskIntentOracleTaskBindingV1(item.task, item.oracle).mismatchCodes, [], item.caseId);
      assert.match(taskIntentOracleHashV1(item.task, item.oracle), /^[a-f0-9]{64}$/);
      for (const clause of item.oracle.clauses) {
        assert.equal(item.task.slice(clause.source.startOffset, clause.source.endOffset), clause.source.normalizedClause);
      }
    }
    const preference = loaded.suite.cases.find((item) => item.caseId === "utility-preference-compositional")!;
    assert.equal(preference.oracle.oracleId, preference.caseId);
    assert.equal(preference.oracle.clauses[0]!.source.endOffset, preference.task.length);
    assert.deepEqual(preference.oracle.expectations.map((item) => item.intentId).sort(), [
      "preference-state", "preference-storage", "preferences-route", "preferences-surface", "ready-preference-action",
    ]);
    const game = loaded.suite.cases.find((item) => item.caseId === "game-restart-compositional")!;
    assert.equal(game.oracle.oracleId, game.caseId);
    assert.equal(game.oracle.clauses[0]!.source.endOffset, game.task.length);
    assert.deepEqual(game.oracle.expectations.map((item) => item.intentId).sort(), [
      "arena-canvas", "arena-game-state", "arena-route", "arena-score-storage", "restart-round-action",
    ]);
    const serialized = JSON.stringify(loaded.suite);
    assert.equal(serialized.includes("multilingual"), false);
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

  it("uses only stable step scope for a non-repeatable fallback and ignores the run wrapper", () => {
    assert.deepEqual(canonicalConvergenceScopedFailureV1([
      { step_id: "plan", story_id: "", phase: "planning" },
      { step_id: "setup-build", story_id: "US_RUN_LOCAL_2039", phase: "building" },
      { step_id: "run", story_id: "", phase: "operations" },
    ]), {
      workflowStepId: "setup-build",
      phase: "building",
      kind: "story",
    });
  });

  it("keeps historical v1 ownership evidence readable while emitting explicit identity state now", () => {
    const historical = ConvergenceOwnershipEvidenceV1Schema.parse({
      stateHash: "a".repeat(64),
      openClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      activeRecoveryDeliveries: 0,
      manualProjectMutationDetected: false,
      sourceHeadMatchesCanonical: true,
      projectHeadSha: "b".repeat(40),
      projectTreeHash: "c".repeat(40),
      canonicalHeadSha: "b".repeat(40),
      canonicalTreeHash: "c".repeat(40),
    });
    assert.equal(historical.projectIdentityState, undefined);
    assert.equal(historical.workingTreeDirty, undefined);
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

    const artifactIndexDown = harness(loaded, { artifactIndexUnready: true });
    const indexBlocked = await runConvergenceSuite(
      loaded,
      { releaseSha: SHA, execute: true },
      artifactIndexDown.ports,
    );
    const indexCheck = indexBlocked.result.preflight.checks.find((check) => check.id === "result_store");
    assert.equal(indexCheck?.status, "fail");
    assert.equal(indexCheck?.code, "EVAL_PRODUCT_ARTIFACT_INDEX_UNREADY");
    assert.equal(indexBlocked.result.status, "blocked");
    assert.equal(artifactIndexDown.starts(), 0);
    assert.equal(artifactIndexDown.canaryCreations.length, 0);
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

  it("executes a v2 suite with v2 run/result authority and unchanged canonical case semantics", async () => {
    const loaded = await suiteV2();
    const fake = harness(loaded);
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);

    assert.equal(output.result.schema, "setfarm.product-convergence-result.v2");
    assert.equal(output.result.suiteVersion, 2);
    assert.equal(output.result.suiteHash, loaded.suiteHash);
    assert.equal(output.result.releaseSha, SHA);
    assert.equal(output.result.preflight.status, "pass");
    assert.equal(output.result.status, "pass");
    assert.deepEqual(output.result.rootCauseCounts, []);
    assert.equal(output.result.runs.length, 8);
    assert.ok(output.result.runs.every((run) =>
      run.schema === "setfarm.product-convergence-run-result.v2"
      && run.suiteVersion === 2
      && run.suiteHash === loaded.suiteHash
      && run.releaseSha === SHA
      && run.caseHash === hashCanonicalJson(loaded.suite.cases.find((item) => item.caseId === run.caseId))
      && run.canonical.oracle.schema === "setfarm.task-intent-oracle-evaluation.v2"
      && run.canonical.oracle.oracleHash === run.oracleHash
      && run.passed));
    assert.ok(output.result.runs
      .filter((run) => run.expectedDecision === "accepted_candidate")
      .every((run) => run.canonical.evidence.missingExpectedPredicates === 0));
    assert.equal(output.gate.decision, "go");
    assert.equal(fake.promotions.length, 1);
    assert.equal(fake.artifacts.filter((item) => item.schema === "setfarm.product-convergence-run-result.v2").length, 8);
    assert.equal(fake.artifacts.at(-2)?.schema, "setfarm.product-convergence-result.v2");
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
    assert.equal(output.result.stoppedOnRepeatedRootCause, REPEATED_OPERATIONAL_CAUSE_HASH);
    assert.deepEqual(output.result.rootCauseCounts, [{ rootCauseHash: REPEATED_OPERATIONAL_CAUSE_HASH, count: 3 }]);
  });

  it("stops repeated two-reason terminal matrices on their exact aggregate cause", async () => {
    const loaded = await suite(2);
    const fake = harness(loaded, { pass: false, repeatedMultiReasonRoot: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(fake.starts(), 3);
    assert.equal(output.result.stoppedOnRepeatedRootCause, REPEATED_MULTI_REASON_OPERATIONAL_CAUSE_HASH);
    assert.deepEqual(output.result.rootCauseCounts, [{
      rootCauseHash: REPEATED_MULTI_REASON_OPERATIONAL_CAUSE_HASH,
      count: 3,
    }]);
  });

  it("never stops on identical scoped failures without a typed producer cause", async () => {
    const loaded = await suite(2);
    const fake = harness(loaded, { pass: false, scopedRoot: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(fake.starts(), 16);
    assert.equal(output.result.status, "fail");
    assert.equal(output.result.stoppedOnRepeatedRootCause, null);
    assert.equal(output.result.rootCauseCounts.length, 16);
    assert.ok(output.result.rootCauseCounts.every((item) => item.count === 1));
  });

  it("keeps measuring a cleanly settled pre-candidate failure with provisional source identity", async () => {
    const loaded = await suite(2);
    const fake = harness(loaded, {
      pass: false,
      repeatedRoot: true,
      provisionalIdentity: true,
    });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);

    assert.equal(fake.starts(), 3);
    assert.equal(output.result.runs.every((run) =>
      run.ownership.projectIdentityState === "provisional"
      && run.ownership.workingTreeDirty
      && !run.ownership.manualProjectMutationDetected), true);
    assert.equal(output.result.blockerCodes.includes("EVAL_RUN_IDENTITY_INVALIDATED"), false);
    assert.equal(output.result.stoppedOnRepeatedRootCause, REPEATED_OPERATIONAL_CAUSE_HASH);
  });

  it("keeps an absolute pre-candidate non-repository provisional in the live process adapter", async () => {
    const project = await mkdtemp(path.join(tmpdir(), "setfarm-convergence-pre-candidate-"));
    roots.push(project);
    const processPort = createNodeConvergenceProcessPort();

    const provisional = await processPort.inspectProject({
      projectLocator: project,
      canonicalSourceRevision: null,
    });
    assert.deepEqual(provisional, {
      projectIdentityState: "provisional",
      workingTreeDirty: false,
      manualProjectMutationDetected: false,
      sourceHeadMatchesCanonical: false,
      projectHeadSha: null,
      projectTreeHash: null,
      canonicalHeadSha: null,
      canonicalTreeHash: null,
    });

    const invalid = await processPort.inspectProject({
      projectLocator: project,
      canonicalSourceRevision: { sha: "8".repeat(40), treeHash: "7".repeat(40) },
    });
    assert.equal(invalid.projectIdentityState, "invalid");
    assert.equal(invalid.sourceHeadMatchesCanonical, false);
    assert.equal(invalid.canonicalHeadSha, "8".repeat(40));
    assert.equal(invalid.canonicalTreeHash, "7".repeat(40));
  });

  it("invalidates a manually mutated generated project and does not start another case", async () => {
    const loaded = await suite();
    const fake = harness(loaded, { manualMutation: true, repeatedRoot: true });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(fake.starts(), 1);
    assert.equal(output.result.runs[0]!.passed, false);
    assert.equal(output.result.runs[0]!.ownership.manualProjectMutationDetected, true);
    assert.ok(output.result.blockerCodes.includes("EVAL_RUN_IDENTITY_INVALIDATED"));
    assert.equal(output.result.stoppedOnRepeatedRootCause, null);
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

  it("reverifies the release after execution before counting a repeatable root", async () => {
    const loaded = await suite(2);
    const fake = harness(loaded, {
      pass: false,
      repeatedRoot: true,
      releaseDriftAfterStart: true,
    });
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, fake.ports);
    assert.equal(fake.starts(), 1);
    assert.ok(output.result.blockerCodes.includes("EVAL_RELEASE_IDENTITY_DRIFT"));
    assert.equal(output.result.stoppedOnRepeatedRootCause, null);
    assert.deepEqual(output.result.rootCauseCounts, [{
      rootCauseHash: REPEATED_OPERATIONAL_CAUSE_HASH,
      count: 1,
    }]);
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

  it("rejects v2 projections that cannot expose implementation submission evidence", async () => {
    const loaded = await suite();
    const fake = harness(loaded, { submissionEvidenceCapabilityUnavailable: true });
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
    const seedConvergenceRun = async (input: PersistWorkflowRunInputV1): Promise<void> => {
      await database.sql.begin(async (sql) => {
        await sql.unsafe(
          `INSERT INTO runs
             (id,run_number,workflow_id,task,status,context,notify_url,protocol,
              protocol_version,compiler_release_sha,activation_preflight_hash,
              release_admission_hash,created_at,updated_at)
           VALUES ($1,$2,$3,$4,'running',$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
          [input.run.id,input.run.runNumber,input.run.workflowId,input.run.task,
            input.run.context,input.run.notifyUrl,input.run.protocol.mode,
            input.run.protocol.version,input.run.protocol.compilerReleaseSha,
            input.run.protocol.activationPreflightHash,input.run.protocol.releaseAdmissionHash,
            input.run.createdAt],
        );
        const canary = input.run.protocol.canaryAdmission;
        if (canary) {
          const consumed = await sql.unsafe<Array<{ slot_hash: string }>>(
            `UPDATE v3_canary_admission_claims
                SET run_id=$1,consumed_at=$2
              WHERE slot_hash=$3 AND admission_hash=$4
                AND run_id IS NULL AND consumed_at IS NULL
            RETURNING slot_hash`,
            [input.run.id,input.run.createdAt,canary.slotHash,input.run.protocol.releaseAdmissionHash],
          );
          assert.equal(consumed.length, 1);
        }
      });
    };
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
            await seedConvergenceRun({
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
            });
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
      assert.equal(output.gate.decision, "go", JSON.stringify({
        gate: output.gate,
        status: output.result.status,
        blockers: output.result.blockerCodes,
        runs: output.result.runs.map((run) => ({
          caseId: run.caseId,
          passed: run.passed,
          disposition: run.disposition,
          invariantCodes: run.canonical.invariantCodes,
        })),
      }, null, 2));
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
      await seedConvergenceRun({
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
      });
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

function controlHarness(overrides: Partial<ConvergenceJobControlV1> = {}): ConvergenceJobControlV1 {
  return {
    beforeCase: async () => {}, onRunStarted: async () => {}, onRunResult: async () => {},
    cancellationRequested: async () => false, requestOwnedRunStop: async () => "requested",
    onPhase: async () => {}, onPublication: async () => {}, beforeFinalization: async () => "continue",
    ...overrides,
  };
}

describe("manual control runner boundaries", () => {
  for (const version of [1, 2]) {
    it(`retains all actual v${version} runs and immutable candidate when cancellation wins finalization`, async () => {
      const loaded = version === 1 ? await suite() : await suiteV2();
      const h = harness(loaded);
      const publications: any[] = [];
      const control = controlHarness({
        onPublication: async value => { publications.push(value); },
        beforeFinalization: async value => { assert.equal(value.gateDecision, "go"); return "cancel"; },
      });
      const output = await runConvergenceSuite(loaded, {releaseSha: SHA, execute: true, control}, h.ports);
      assert.equal(output.result.status, "blocked");
      assert.equal(output.result.runs.length, 8);
      assert.equal(output.result.runs.every(run => run.passed), true);
      assert.deepEqual(output.result.blockerCodes, ["EVAL_CANCEL_REQUESTED"]);
      assert.equal(output.gate.decision, "no_go");
      assert.deepEqual(output.gate.codes, ["CONVERGENCE_CANCEL_REQUESTED"]);
      assert.equal(output.gate.resultHash, output.result.resultHash);
      assert.equal(h.promotions.length, 0);
      assert.deepEqual(publications.map(value => value.stage), ["candidate", "cancelled_final"]);
      assert.notEqual(publications[0].resultHash, output.result.resultHash);
      assert.ok(h.artifacts.some(value => value.hash === publications[0].resultHash));
    });
  }
  it("suppresses canary and run starts when cancelled before preflight", async () => {
    const loaded = await suite(); const h = harness(loaded);
    const output = await runConvergenceSuite(loaded, {releaseSha: SHA, execute: true,
      control: controlHarness({cancellationRequested: async () => true})}, h.ports);
    assert.equal(output.result.status, "blocked");
    assert.ok(output.result.blockerCodes.includes("EVAL_CANCEL_REQUESTED"));
    assert.equal(h.canaryCreations.length, 0); assert.equal(h.starts(), 0);
    assert.equal(output.result.preflight.checks.length, 8);
  });
  it("stops between stored case results without fabricating the remaining seven", async () => {
    const loaded = await suite(); const h = harness(loaded); let cancelled = false;
    const output = await runConvergenceSuite(loaded, {releaseSha: SHA, execute: true,
      control: controlHarness({cancellationRequested: async () => cancelled,
        onRunResult: async value => { assert.ok(h.artifacts.some(a => a.hash === value.resultHash)); cancelled = true; }})}, h.ports);
    assert.equal(output.result.runs.length, 1); assert.equal(h.starts(), 1);
    assert.equal(output.result.status, "blocked"); assert.equal(h.promotions.length, 0);
  });
  it("does not call any awaited hook between continue boundary and promotion", async () => {
    const loaded = await suite(); const h = harness(loaded); const events: string[] = [];
    h.ports.admissions.promoteReleaseGo = async () => { events.push("promote"); };
    const output = await runConvergenceSuite(loaded, {releaseSha: SHA, execute: true,
      control: controlHarness({ beforeFinalization: async () => { events.push("boundary"); return "continue"; },
        onPublication: async value => {events.push(value.stage);},
        cancellationRequested: async () => {events.push("cancel_check"); return false;} })}, h.ports);
    assert.equal(output.result.status, "pass");
    assert.deepEqual(events.slice(events.indexOf("boundary")), ["boundary", "promote", "promotion_confirmed"]);
  });
});

describe("manual control polling and fatal boundaries",()=>{
  it("uses the committed fixed codex full8 suite without changing its budgets",async()=>{
    const {loadConvergenceSuiteVersioned}=await import("../../src/evals/suite-schema-v2.js");
    const loaded=await loadConvergenceSuiteVersioned(path.resolve("evals/suites/product-convergence-codex-v1.json"));
    assert.deepEqual(loaded.suite.cases.map(c=>c.caseId),["utility-status-baseline","utility-preference-compositional","operations-work-baseline","operations-queue-paraphrase","game-start-baseline","game-restart-compositional","negative-ambiguous-product","negative-unsupported-kernel"]);
    assert.equal(loaded.suite.repetitionsPerCase,1);assert.equal(loaded.suite.protocol,"v3");assert.equal(loaded.suite.rootCauseRepeatLimit,3);assert.deepEqual(loaded.suite.timeout,{runMs:21600000,pollMs:15000});
    const h=harness(loaded);
    const inspect=h.ports.process.inspectRelease;
    h.ports.process.inspectRelease=async()=>({...await inspect(),...loaded.suite.cases[0]!.executionProfile});
    const result=await runConvergenceSuite(loaded,{releaseSha:SHA,execute:true,control:controlHarness()},h.ports);
    assert.equal(result.result.schema,"setfarm.product-convergence-result.v1");assert.equal(result.result.runs.length,8);assert.equal(result.result.status,"pass");
  });
  it("requests exactly one owned stop during polling and preserves the real terminal run",async()=>{
    const loaded=await suite();const h=harness(loaded);let requested=false,polls=0;const stops:string[]=[];
    const read=h.ports.sql.readRun;
    h.ports.sql.readRun=async runId=>{polls++;const value=await read(runId);return {...value,status:requested?"cancelled":"running",terminal:requested};};
    const output=await runConvergenceSuite(loaded,{releaseSha:SHA,execute:true,control:controlHarness({cancellationRequested:async()=>polls>0,requestOwnedRunStop:async value=>{stops.push(value.runId);requested=true;return "requested";}})},h.ports);
    assert.deepEqual(stops,["run-1"]);assert.equal(h.starts(),1);assert.equal(output.result.runs.length,1);assert.equal(output.result.runs[0]!.disposition,"cancelled");assert.equal(output.result.status,"blocked");
  });
  it("propagates source-owned journal failures instead of manufacturing admission or start blockers",async()=>{
    const {ControlWorkerFatalErrorV1}=await import("../../src/execution/schemas/manual-control-worker-channel-v1.js");
    for(const boundary of ["createCanary","startRun"] as const) {
      const loaded=await suite();const h=harness(loaded);const error=new ControlWorkerFatalErrorV1("CONTROL_JOURNAL_FAILED");
      if(boundary==="createCanary") h.ports.admissions.createCanary=async()=>{throw error;};else h.ports.process.startRun=async()=>{throw error;};
      await assert.rejects(()=>runConvergenceSuite(loaded,{releaseSha:SHA,execute:true,control:controlHarness()},h.ports),value=>value===error);
      assert.equal(h.promotions.length,0);assert.equal(h.artifacts.length,0);
    }
  });
  it("stops project synchronization after cancellation arrives during the first sync",async()=>{
    const loaded=await suite();const h=harness(loaded,{projectionMismatch:true});let cancelled=false,syncs=0;
    const sync=h.ports.http.syncProject;
    h.ports.http.syncProject=async id=>{syncs++;cancelled=true;return sync(id);};
    await assert.rejects(()=>runConvergenceSuite(loaded,{releaseSha:SHA,execute:true,control:controlHarness({cancellationRequested:async()=>cancelled})},h.ports),/CONTROL_SETTLEMENT_UNCERTAIN/);
    assert.equal(syncs,1);assert.equal(h.starts(),1);assert.equal(h.artifacts.length,0);
  });
});

for (const failure of ["promotion", "confirmed_journal", "cancelled_result", "cancelled_gate"] as const) it(`manual final publication ${failure} uncertainty never retries or returns a final pair`, async () => {
  const loaded=await suite(), h=harness(loaded), publications:string[]=[];
  let promotions=0, afterBoundary=false, writesAfterBoundary=0;
  const put=h.ports.artifacts.put;
  h.ports.artifacts.put=async value=>{if(afterBoundary && failure.startsWith("cancelled_")){writesAfterBoundary++;if(writesAfterBoundary===(failure==="cancelled_result"?1:2))throw new Error("final storage uncertain");}return put(value);};
  h.ports.admissions.promoteReleaseGo=async()=>{promotions++;if(failure==="promotion")throw new Error("promotion output uncertain");};
  const {ControlWorkerFatalErrorV1}=await import("../../src/execution/schemas/manual-control-worker-channel-v1.js");
  await assert.rejects(()=>runConvergenceSuite(loaded,{releaseSha:SHA,execute:true,control:controlHarness({beforeFinalization:async()=>{afterBoundary=true;return failure.startsWith("cancelled_")?"cancel":"continue";},onPublication:async value=>{publications.push(value.stage);if(failure==="confirmed_journal"&&value.stage==="promotion_confirmed")throw new ControlWorkerFatalErrorV1("CONTROL_JOURNAL_FAILED");}})},h.ports), /uncertain|CONTROL_JOURNAL_FAILED/);
  assert.equal(promotions,failure.startsWith("cancelled_")?0:1);
  assert.deepEqual(publications,failure==="confirmed_journal"?["candidate","promotion_confirmed"]:["candidate"]);
  assert.equal(h.starts(),8);
});
it("refused canonical owned stop escapes evaluator without final artifacts or promotion",async()=>{
  const loaded=await suite(),h=harness(loaded);let polls=0,stops=0;
  const read=h.ports.sql.readRun;
  h.ports.sql.readRun=async id=>{polls++;return {...await read(id),status:"running",terminal:false};};
  await assert.rejects(()=>runConvergenceSuite(loaded,{releaseSha:SHA,execute:true,control:controlHarness({cancellationRequested:async()=>polls>0,requestOwnedRunStop:async()=>{stops++;return "refused";}})},h.ports),/CONTROL_SETTLEMENT_UNCERTAIN/);
  assert.equal(stops,1);assert.equal(h.starts(),1);assert.equal(h.promotions.length,0);assert.equal(h.artifacts.length,0);
});

for (const version of [1, 2] as const) it(`cancelled v${version} observes ordinary terminal outbox drain before final publication without sync or a second stop`, async () => {
  const loaded = version === 1 ? await suite() : await suiteV2();
  const h = harness(loaded); let polls = 0, stopped = false, observations = 0, syncs = 0, stops = 0;
  const read = h.ports.sql.readRun, project = h.ports.http.operationalSnapshot;
  h.ports.sql.readRun = async id => { polls++; return { ...await read(id), status: stopped ? "cancelled" : "running", terminal: stopped }; };
  h.ports.http.syncProject = async () => { syncs++; throw new Error("cancelled sync"); };
  h.ports.http.operationalSnapshot = async (service, id) => {
    const value = RunOperationalSnapshotV2Schema.parse(await project(service, id));
    observations++;
    if (observations <= 4) {
      value.summary.unpublishedOutbox = 1;
      value.outbox = [{ref:"setfarm://outbox/terminal",outboxId:"terminal",requestRef:null,eventKey:"terminal",eventType:"run_terminal",aggregateType:"run",aggregateId:id,state:"pending",attemptCount:0,publishedAt:null,createdAt:NOW,updatedAt:NOW}];
    }
    const {snapshotHash: _hash, ...hashable} = value;
    return {...hashable, snapshotHash:computeRunOperationalSnapshotHash(hashable)};
  };
  const output = await runConvergenceSuite(loaded, {releaseSha:SHA,execute:true,control:controlHarness({
    cancellationRequested:async()=>polls>0,
    requestOwnedRunStop:async()=>{stops++;stopped=true;return "requested";},
    onPublication:async()=>{assert.ok(observations>=6,"publication preceded canonical drain observation");},
  })}, h.ports);
  assert.equal(output.result.runs[0]!.projection.operationalSettled,true);
  assert.equal(output.result.status,"blocked");assert.equal(h.starts(),1);assert.equal(stops,1);assert.equal(syncs,0);assert.equal(h.promotions.length,0);
});

for (const state of ["pending", "quarantined", "wrong_run", "malformed", "late_mismatch"] as const) it(`cancelled terminal ${state} retains uncertainty without release eligibility or extra effects`,async()=>{
  const loaded=await suite(),h=harness(loaded);let polls=0,stops=0,observations=0,sleeps=0;
  const read=h.ports.sql.readRun,project=h.ports.http.operationalSnapshot;
  h.ports.sql.readRun=async id=>{polls++;return {...await read(id),status:stops?"cancelled":"running",terminal:stops>0};};
  const sleep=h.ports.clock.sleep;h.ports.clock.sleep=async ms=>{sleeps++;await sleep(ms);};
  h.ports.http.syncProject=async()=>{throw new Error("unexpected sync");};
  h.ports.http.operationalSnapshot=async(service,id)=>{
    observations++;const value=RunOperationalSnapshotV2Schema.parse(await project(service,id));
    if(state==="late_mismatch" && observations>24){
      value.summary.unpublishedOutbox=0;value.outbox=[];value.run.status=service==="mission_control"?"failed":"completed";
      const {snapshotHash:_hash,...hashable}=value;return {...hashable,snapshotHash:computeRunOperationalSnapshotHash(hashable)};
    }
    if(state==="malformed")return {};
    if(state==="wrong_run")value.run.id="wrong-run";
    value.summary.unpublishedOutbox=1;value.outbox=[{ref:"setfarm://outbox/terminal",outboxId:"terminal",requestRef:null,eventKey:"terminal",eventType:"run_terminal",aggregateType:"run",aggregateId:id,state:state==="quarantined"?"quarantined":"pending",attemptCount:0,publishedAt:null,createdAt:NOW,updatedAt:NOW}];
    const {snapshotHash:_hash,...hashable}=value;return {...hashable,snapshotHash:computeRunOperationalSnapshotHash(hashable)};
  };
  await assert.rejects(()=>runConvergenceSuite(loaded,{releaseSha:SHA,execute:true,control:controlHarness({cancellationRequested:async()=>polls>0,requestOwnedRunStop:async()=>{stops++;return "requested";}})},h.ports),/CONTROL_SETTLEMENT_UNCERTAIN/);
  assert.equal(stops,1);assert.equal(h.starts(),1);assert.equal(h.artifacts.length,0);assert.equal(h.promotions.length,0);
  assert.equal(observations,["pending","late_mismatch"].includes(state)?26:2);assert.equal(sleeps,["pending","late_mismatch"].includes(state)?13:1);
});

it("default start awaits its original actual child after private proof publication refuses",async()=>{
  const root=await mkdtemp(path.join(tmpdir(),"default-start-owned-"));
  const {mkdir}=await import("node:fs/promises");
  try {
    await mkdir(path.join(root,"dist/cli"),{recursive:true});
    const marker=path.join(root,"exited.json");
    await writeFile(path.join(root,"dist/cli/cli.js"),`const fs=require('node:fs');setTimeout(()=>{fs.writeFileSync(${JSON.stringify(marker)},'one');process.stdout.write('Run: #1 (owned)');},50);`);
    const port=createNodeConvergenceProcessPort(root);
    await assert.rejects(()=>port.startRun({workflowId:"feature-dev",task:"owned test",releaseSha:SHA,admission:{schema:"setfarm.internal-convergence-admission.v1",admissionHash:"a".repeat(64),slotHash:"b".repeat(64),caseHash:"c".repeat(64),taskHash:"d".repeat(64),repetition:1,slotToken:"t".repeat(32)},startChild:{reservation:{} as never,journal:{revision:1,hash:"e".repeat(64)}}}),/CONTROL_START_UNRESOLVED/);
    assert.equal(await readFile(marker,"utf8"),"one");
  } finally {await rm(root,{recursive:true,force:true});}
});


// These are explicit in-memory HTTP/process/admission fixtures. The real suite
// runner and its private collector execute; no live HTTP/provider qualification
// is implied by the eight harness runs below. Accepted V2 controls stay above.
describe("strict V3 runner HTTP-port projection wiring", () => {
  const capabilities = ["attempts", "claimBinding", "runtimeOwnership", "managerCompletion",
    "effectLedger", "findingRecovery", "evidenceLedger", "acceptedCandidate",
    "deploymentReceipt", "projectTransferAck"].sort();

  async function firstCase(caseId: string) {
    const original = await suite();
    const selected = original.suite.cases.find(item => item.caseId === caseId)!;
    const value = ProductConvergenceSuiteV1Schema.parse({ ...original.suite,
      cases: [selected, ...original.suite.cases.filter(item => item.caseId !== caseId)] });
    return { suite: value, suiteHash: hashCanonicalJson(value) };
  }

  it("accepts complete accepted V3 with exact transfer identities and both strict refusals", async () => {
    const loaded = await suite(), h = harness(loaded, { projectionVersion: "v3" });
    const bodies = new Map<string, ReturnType<typeof RunOperationalSnapshotV3Schema.parse>>();
    const project = h.ports.http.operationalSnapshot;
    let syncs = 0;
    h.ports.http.syncProject = async () => { syncs++; return { ok: true, evidenceHash: HASH }; };
    h.ports.http.operationalSnapshot = async (service, id) => {
      const body = RunOperationalSnapshotV3Schema.parse(await project(service, id));
      assert.equal(body.summary.operatorActions.stop.allowed, false);
      assert.equal(body.summary.operatorActions.resume.allowed, false);
      bodies.set(`${service}/${id}`, body);
      return body;
    };
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true }, h.ports);
    assert.equal(output.result.status, "pass");
    assert.equal(output.result.runs.length, 8);
    assert.equal(syncs, 6, "accepted-only initial synchronization remains mandatory");
    for (const run of output.result.runs) {
      const body = bodies.get(`setfarm/${run.runId}`)!;
      assert.equal(run.passed, true);
      assert.equal(run.projection.setfarmProjection, "complete");
      assert.equal(run.projection.missionControlProjection, "complete");
      assert.equal(run.projection.exactHashMatch, true);
      assert.equal(run.projection.operationalSettled, true);
      assert.deepEqual(Object.keys(run.projection.capabilities).sort(), capabilities);
      assert.ok(Object.values(run.projection.capabilities).every(value => value === true));
      assert.equal(run.projection.setfarmSnapshotHash, body.snapshotHash);
      assert.equal(run.projection.missionControlSnapshotHash, bodies.get(`mission_control/${run.runId}`)!.snapshotHash);
      if (run.expectedDecision === "accepted_candidate") {
        assert.equal(body.operationalFailure, null);
        assert.equal(run.projection.transferAcknowledged, true);
        assert.equal(run.projection.projectTransferAckHash, body.projectTransferAck!.acknowledgement.ackHash);
        assert.equal(run.projection.projectRecordHash, body.projectTransferAck!.acknowledgement.projectRecordHash);
      } else {
        assert.ok(body.operationalFailure);
        assert.equal(body.terminationRequests.length, 1);
        assert.equal(body.terminationRequests[0]!.state, "terminalized");
        assert.equal(body.terminationRequests[0]!.evidence.modelRedispatchBudget, 0);
        assert.equal(run.projection.transferAcknowledged, false);
        assert.equal(run.projection.projectTransferAckHash, null);
        assert.equal(run.projection.projectRecordHash, null);
        assert.deepEqual(run.canonical.invariantCodes, []);
        assert.deepEqual(run.canonical.oracle.mismatchCodes, []);
        assert.equal(run.canonical.evidence.missingExpectedPredicates, 0);
      }
    }
    assert.deepEqual(output.result.runs.filter(run => run.expectedDecision === "typed_rejection")
      .map(run => run.caseId).sort(), ["negative-ambiguous-product", "negative-unsupported-kernel"]);
  });

  it("keeps individually valid unequal V3 acknowledgements unequal through accepted-only synchronization", async () => {
    const loaded = await firstCase("utility-status-baseline"), h = harness(loaded, { projectionVersion: "v3" });
    let syncs = 0, reads = 0, cancelled = false;
    const sleep = h.ports.clock.sleep;
    const sleeps: number[] = [];
    h.ports.clock.sleep = async ms => { sleeps.push(ms); await sleep(ms); };
    h.ports.http.syncProject = async () => { syncs++; return { ok: true, evidenceHash: HASH }; };
    h.ports.http.operationalSnapshot = async (service, runId) => {
      reads++;
      return RunOperationalSnapshotV3Schema.parse(convergenceAcceptedOperationalSnapshotFixtureV1({
        runId, version: "v3", persistedAt: service === "mission_control" ? "2026-07-13T12:00:01.000Z" : undefined,
      }));
    };
    const output = await runConvergenceSuite(loaded, { releaseSha: SHA, execute: true,
      control: controlHarness({ onRunResult: async () => { cancelled = true; },
        cancellationRequested: async () => cancelled }) }, h.ports);
    const projection = output.result.runs[0]!.projection;
    assert.equal(projection.operationalSettled, true);
    assert.equal(projection.exactHashMatch, false);
    assert.equal(projection.transferAcknowledged, false);
    assert.equal(projection.projectTransferAckHash, null);
    assert.equal(projection.projectRecordHash, null);
    assert.equal(reads, 26);
    assert.equal(syncs, 4);
    assert.equal(sleeps.length, 12);
    assert.ok(sleeps.every(ms => ms >= 250 && ms <= 5000));
    assert.equal(h.starts(), 1);
    assert.equal(h.promotions.length, 0);
    assert.equal(output.gate.decision, "no_go");
  });

  for (const boundary of ["rejected_read", "pending_drain", "cancel_pending", "cancel_malformed"] as const) {
    it(`retains V3 ${boundary} polling and cancellation policy through the private collector`, async () => {
      const loaded = await firstCase("negative-ambiguous-product"), h = harness(loaded, { projectionVersion: "v3" });
      let observations = 0, polls = 0, stops = 0, syncs = 0, cancelled = false;
      const sleeps: number[] = [], sleep = h.ports.clock.sleep, read = h.ports.sql.readRun;
      const duringCancellation = boundary.startsWith("cancel_");
      h.ports.clock.sleep = async ms => { sleeps.push(ms); await sleep(ms); };
      h.ports.sql.readRun = async id => {
        polls++;
        const value = await read(id);
        return duringCancellation ? { ...value, status: stops ? "failed" : "running", terminal: stops > 0 } : value;
      };
      h.ports.http.syncProject = async () => { syncs++; throw new Error("unexpected refusal synchronization"); };
      h.ports.http.operationalSnapshot = async (service, id) => {
        observations++;
        if (boundary === "rejected_read" && service === "mission_control") throw new Error("fixture HTTP-port failure");
        if (boundary === "cancel_malformed") return {};
        const value = convergenceOperationalSnapshotV3Fixture(id, "PRODUCT_SPEC_TASK_AMBIGUOUS");
        if (boundary === "cancel_pending" || (boundary === "pending_drain" && observations <= 4)) {
          value.summary.unpublishedOutbox = 1;
          value.outbox = [{ ref: "setfarm://outbox/fixture-terminal", outboxId: "fixture-terminal", requestRef: null,
            eventKey: "fixture-terminal", eventType: "run_terminal", aggregateType: "run", aggregateId: id,
            state: "pending", attemptCount: 0, publishedAt: null, createdAt: NOW, updatedAt: NOW }];
        }
        return RunOperationalSnapshotV3Schema.parse({ ...value, snapshotHash: computeRunOperationalSnapshotHashV3(value) });
      };
      const execute = () => runConvergenceSuite(loaded, { releaseSha: SHA, execute: true, control: controlHarness({
        cancellationRequested: async () => duringCancellation ? polls > 0 : cancelled,
        requestOwnedRunStop: async () => { stops++; return "requested"; },
        onRunResult: async () => { cancelled = true; },
      }) }, h.ports);
      if (duringCancellation) {
        await assert.rejects(execute, /CONTROL_SETTLEMENT_UNCERTAIN/);
        assert.equal(stops, 1);
        assert.equal(observations, boundary === "cancel_pending" ? 26 : 2);
        assert.equal(sleeps.length, boundary === "cancel_pending" ? 13 : 1);
        assert.equal(h.artifacts.length, 0);
      } else {
        const output = await execute(), projection = output.result.runs[0]!.projection;
        assert.equal(projection.operationalSettled, boundary === "pending_drain");
        assert.equal(projection.exactHashMatch, boundary === "pending_drain");
        assert.equal(projection.setfarmProjection, boundary === "pending_drain" ? "complete" : "unavailable");
        assert.equal(observations, boundary === "pending_drain" ? 6 : 26);
        assert.equal(sleeps.length, boundary === "pending_drain" ? 2 : 12);
        assert.equal(stops, 0);
        assert.equal(output.result.status, "blocked");
        assert.equal(output.gate.decision, "no_go");
      }
      assert.equal(h.starts(), 1);
      assert.equal(h.promotions.length, 0);
      assert.equal(syncs, 0);
      if (duringCancellation) {
        // The initial ordinary run poll uses the suite interval; only later
        // canonical-projection settlement polls use the bounded interval.
        assert.equal(sleeps[0], loaded.suite.timeout.pollMs);
        const projectionSleeps = sleeps.slice(1);
        const projectionPollMs = Math.min(5000, Math.max(250, loaded.suite.timeout.pollMs));
        assert.deepEqual(projectionSleeps, Array.from({ length: boundary === "cancel_pending" ? 12 : 0 }, () => projectionPollMs));
        assert.ok(projectionSleeps.every(ms => ms >= 250 && ms <= 5000));
      } else {
        assert.ok(sleeps.every(ms => ms >= 250 && ms <= 5000));
      }
    });
  }
});
