import { z } from "zod";

import {
  createAcceptedCandidateV1,
  type AcceptedCandidateV1,
} from "../evidence/accepted-candidate-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  createV3BuildArtifactV1,
  createV3DeployReceiptV1,
  type V3DeployReceiptV1,
} from "../execution/schemas/v3-deploy-receipt-v1.js";
import {
  createV3DeploymentObservationV1,
  V3DeploymentObservationV1Schema,
  type V3DeploymentObservationV1,
} from "../execution/schemas/v3-deployment-observation-v1.js";
import {
  V3ProjectTransferAckV1Schema,
  type V3ProjectTransferAckV1,
} from "../execution/schemas/v3-project-transfer-ack-v1.js";
import {
  createOperationalFailureIdentityV2,
  DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
  DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
  STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
} from "../execution/schemas/operational-failure-identity-v2.js";
import {
  createV3RuntimeIsolationAuthorityV1,
  createV3RuntimeIsolationChallengeV1,
  createV3RuntimeVolumeProvisioningV1,
  V3RuntimeIsolationProofV1Schema,
} from "../execution/schemas/v3-runtime-isolation-v1.js";
import { computeRunOperationalSnapshotHash } from "../server/run-operational-snapshot.js";
import {
  RunOperationalSnapshotV1Schema,
  type OperationalAttemptV1,
  type OperationalEvidenceBundleV1,
  type RunOperationalSnapshotV1,
} from "../server/schemas/run-operational-snapshot-v1.js";
import {
  RunOperationalSnapshotV2Schema,
  type RunOperationalSnapshotV2,
} from "../server/schemas/run-operational-snapshot-v2.js";
import {
  computeRunOperationalSnapshotHashV3,
  RunOperationalSnapshotV3Schema,
  type RunOperationalSnapshotV3,
} from "../server/schemas/run-operational-snapshot-v3.js";
import {
  SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1,
  SetfarmOperationalActiveRunStatusV1Schema,
} from "./operational-active-run-status-v1.js";

export const MISSION_CONTROL_CONTRACT_ARTIFACT_DIRECTORY =
  "contracts/generated/mission-control" as const;

export const MISSION_CONTROL_CONTRACT_ARTIFACT_SCHEMA =
  "setfarm.mission-control-contract-compatibility.v1" as const;

export type MissionControlContractName =
  | "setfarm.run-operational-snapshot.v1"
  | "setfarm.run-operational-snapshot.v2"
  | "setfarm.run-operational-snapshot.v3"
  | "setfarm.v3-deployment-observation.v1"
  | "setfarm.v3-project-transfer-ack.v1"
  | "setfarm.operational-active-run-status.v1";

type MissionControlCompatibilityEnvelopeBaseV1 = Readonly<{
  schema: typeof MISSION_CONTROL_CONTRACT_ARTIFACT_SCHEMA;
  producer: Readonly<{ name: "setfarm"; contractVersion: 1 }>;
  jsonSchemaHash: string;
  fixtureHash: string;
  fixture: unknown;
}>;

export type MissionControlOperationalActiveProducerExportsV1 = Readonly<{
  statusesExport: "SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1";
  schemaExport: "SetfarmOperationalActiveRunStatusV1Schema";
  predicateExport: "isSetfarmOperationalActiveRunStatusV1";
}>;

export type MissionControlCompatibilityEnvelopeV1 =
  | Readonly<MissionControlCompatibilityEnvelopeBaseV1 & {
    contract: Exclude<
      MissionControlContractName,
      "setfarm.operational-active-run-status.v1"
    >;
    producerExports?: never;
  }>
  | Readonly<MissionControlCompatibilityEnvelopeBaseV1 & {
    contract: "setfarm.operational-active-run-status.v1";
    producerExports: MissionControlOperationalActiveProducerExportsV1;
  }>;

export type MissionControlContractArtifact = Readonly<{
  relativePath: string;
  value: unknown;
}>;

const NOW = "2026-07-14T00:00:00.000Z";
const RUN_ID = "contract-run-0001";
const PROJECT_ID = "contract-web-app";
const PROCESS_ID = 43_210;
const PACKET_HASH = "b".repeat(64);
const BUILD_ARTIFACT_CONTENT_HASH = "c".repeat(64);
const MANIFEST_HASH = "d".repeat(64);
const SEAL_AUTHORITY_HASH = "e".repeat(64);
const RUNTIME_DATA_CONTRACT_HASH = "f".repeat(64);
const SOURCE_REVISION = { sha: "1".repeat(40), treeHash: "2".repeat(40) } as const;

type AcceptanceFixture = Readonly<{
  candidate: AcceptedCandidateV1;
  attempt: OperationalAttemptV1;
  bundle: OperationalEvidenceBundleV1;
}>;

function createAcceptanceFixture(): AcceptanceFixture {
  const attemptId = "ATT_00000000-0000-0000-0000-000000000001";
  const sliceHash = "4".repeat(64);
  const evidenceBundleHash = "5".repeat(64);
  const evidenceId = `EVB_${"6".repeat(64)}`;
  const candidate = createAcceptedCandidateV1({
    runId: RUN_ID,
    packetHash: PACKET_HASH,
    storyPlanHash: "3".repeat(64),
    sourceRevision: SOURCE_REVISION,
    storyEvidence: [{
      storyId: "US-001",
      attemptId,
      sliceHash,
      evidencePlanHash: "7".repeat(64),
      evidencePlanArtifactHash: "8".repeat(64),
      evidenceBundleHash,
      evidenceId,
      predicateRefs: ["EVID_ACTION_CONTROL"],
    }],
    acceptor: {
      id: "setfarm-final-tree-acceptor",
      version: "1.0.0",
      codeSha: "9".repeat(40),
      environmentHash: "a".repeat(64),
    },
  });
  return {
    candidate,
    attempt: {
      ref: `setfarm://execution-attempt/${attemptId}`,
      attemptId,
      runRef: `setfarm://run/${RUN_ID}`,
      claimRef: null,
      stepRef: `setfarm://run/${RUN_ID}/step/final-test`,
      storyRef: `setfarm://run/${RUN_ID}/story/US-001`,
      workflowStepId: "final-test",
      storyId: "US-001",
      generation: 1,
      attemptClass: "evidence_only",
      packetHash: candidate.packetHash,
      compilationReportHash: "0".repeat(64),
      sliceHash,
      sourceBefore: SOURCE_REVISION,
      sourceAfter: SOURCE_REVISION,
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
      runRef: `setfarm://run/${RUN_ID}`,
      storyRef: `setfarm://run/${RUN_ID}/story/US-001`,
      storyId: "US-001",
      attemptRef: `setfarm://execution-attempt/${attemptId}`,
      attemptId,
      packetHash: candidate.packetHash,
      sliceHash,
      sourceRevision: SOURCE_REVISION,
      aggregateVerdict: "pass",
      predicateCount: 1,
      observationCount: 1,
      createdAt: NOW,
    },
  };
}

function createDeploymentFixture(candidate: AcceptedCandidateV1): Readonly<{
  receipt: V3DeployReceiptV1;
  observation: V3DeploymentObservationV1;
}> {
  const buildArtifact = createV3BuildArtifactV1({
    schema: "setfarm.v3-build-artifact.v1",
    runId: RUN_ID,
    outputPaths: ["dist"],
    files: [{
      path: "dist/index.html",
      byteLength: 128,
      contentHash: BUILD_ARTIFACT_CONTENT_HASH,
      executable: false,
    }],
    totalBytes: 128,
  });
  const volumeProvisioning = createV3RuntimeVolumeProvisioningV1({
    schema: "setfarm.v3-runtime-volume-provisioning.v1",
    runId: RUN_ID,
    projectId: PROJECT_ID,
    runtimeDataContractHash: RUNTIME_DATA_CONTRACT_HASH,
    writableVolumes: [],
    scratch: { kind: "none" },
  });
  const isolationAuthority = createV3RuntimeIsolationAuthorityV1({
    schema: "setfarm.v3-runtime-isolation-authority.v1",
    adapterId: "darwin-sandbox-exec",
    adapterVersion: "1.0.0",
    runId: RUN_ID,
    projectId: PROJECT_ID,
    candidateHash: candidate.candidateHash,
    buildArtifactHash: buildArtifact.artifactHash,
    policyHash: "3".repeat(64),
    profileHash: "4".repeat(64),
    wrapperArtifactHash: "5".repeat(64),
    runtimeDataContractHash: RUNTIME_DATA_CONTRACT_HASH,
    volumeProvisioningHash: volumeProvisioning.volumeProvisioningHash,
  });
  const processIdentity = {
    schema: "setfarm.process-identity.v1" as const,
    pid: PROCESS_ID,
    processStartedAt: NOW,
    processGroupId: PROCESS_ID,
    source: "observed_os" as const,
  };
  const challenge = createV3RuntimeIsolationChallengeV1({
    schema: "setfarm.v3-runtime-isolation-challenge.v1",
    nonce: "6".repeat(64),
    authorityHash: isolationAuthority.authorityHash,
    wrapperProcessIdentity: processIdentity,
    deniedRootProbes: [
      { rootId: "sealed-runtime", outcome: "denied" },
      { rootId: "state-authority", outcome: "denied" },
    ],
    deniedReadProbes: [
      { authorityId: "launch-agents", outcome: "denied" },
      { authorityId: "mission-control-config", outcome: "denied" },
      { authorityId: "setfarm-config", outcome: "denied" },
    ],
    deniedNetworkProbes: [{ authorityId: "all-outbound", outcome: "denied" }],
    deniedProcessExecProbes: [{ executableId: "launchctl", outcome: "denied" }],
    deniedSignalProbes: [{ authorityId: "control-sentinel", outcome: "denied" }],
    allowedVolumeProbes: [],
    challengedAt: NOW,
  });
  const isolationProof = V3RuntimeIsolationProofV1Schema.parse({
    ...isolationAuthority,
    schema: "setfarm.v3-runtime-isolation-proof.v1",
    challenge,
    checkedAt: NOW,
    checks: { runtimeIsolation: "pass" },
  });
  const runtimeEvidenceRef = `setfarm://deploy/runtime/${RUN_ID}/${PROJECT_ID}`;
  const manifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${RUN_ID}/${candidate.candidateHash}/${buildArtifact.artifactHash}/${MANIFEST_HASH}`;
  const sealAuthorityEvidenceRef = `setfarm://deploy/seal-authority/${RUN_ID}/${candidate.candidateHash}/${buildArtifact.artifactHash}/${SEAL_AUTHORITY_HASH}`;
  const runtime = {
    schema: "setfarm.v3-runtime-deployment.v1" as const,
    mode: "local" as const,
    projectId: PROJECT_ID,
    serviceId: `process:${PROCESS_ID}`,
    host: "127.0.0.1" as const,
    port: PROCESS_ID,
    healthUrl: `http://127.0.0.1:${PROCESS_ID}/`,
    deployUrl: `http://127.0.0.1:${PROCESS_ID}/`,
    evidenceRef: runtimeEvidenceRef,
    buildArtifactHash: buildArtifact.artifactHash,
    buildArtifactEvidenceRef: buildArtifact.evidenceRef,
    sealedRuntimeRef: `setfarm://deploy/sealed-runtime/${RUN_ID}/${candidate.candidateHash}/${buildArtifact.artifactHash}`,
    sealedRuntimeManifestHash: MANIFEST_HASH,
    sealedRuntimeManifestEvidenceRef: manifestEvidenceRef,
    sealAuthorityHash: SEAL_AUTHORITY_HASH,
    sealAuthorityEvidenceRef,
    runtimeDataContractHash: RUNTIME_DATA_CONTRACT_HASH,
    volumeProvisioning,
    runtimeIsolation: isolationAuthority,
  };
  const listenerOwnership = {
    schema: "setfarm.v3-listener-ownership.v1" as const,
    ownerProcess: processIdentity,
    listenerPids: [PROCESS_ID],
    listenerProcesses: [processIdentity],
    host: "127.0.0.1",
    port: PROCESS_ID,
    checkedAt: NOW,
    evidenceRef: `${runtimeEvidenceRef}/listener/${PROCESS_ID}`,
  };
  const receipt = createV3DeployReceiptV1({
    schema: "setfarm.v3-deploy-receipt.v1",
    runId: RUN_ID,
    candidateId: candidate.candidateId,
    candidateHash: candidate.candidateHash,
    packetHash: candidate.packetHash,
    project: {
      schema: "setfarm.v3-deploy-project.v1",
      productId: "PROD_CONTRACT",
      projectId: PROJECT_ID,
      displayName: "Setfarm Contract Fixture",
      summary: "Canonical Mission Control compatibility fixture.",
    },
    stack: {
      schema: "setfarm.v3-deploy-stack.v1",
      stackPackId: "vite-react-web-app",
      stackPackVersion: "1.4.0",
      stackPackContentHash: "7".repeat(64),
      platform: "web",
      techStack: "vite-react",
    },
    buildCommandId: "CMD_BUILD",
    previewCommandId: "CMD_PREVIEW",
    sourceBefore: SOURCE_REVISION,
    sourceAfter: SOURCE_REVISION,
    buildArtifact,
    runtime,
    health: {
      schema: "setfarm.v3-deploy-health-proof.v1",
      status: "pass",
      httpStatus: 200,
      checkedAt: NOW,
      evidenceRef: `${runtimeEvidenceRef}/health`,
      buildArtifactHash: buildArtifact.artifactHash,
      buildArtifactEvidenceRef: buildArtifact.evidenceRef,
      sealedRuntimeManifestHash: MANIFEST_HASH,
      sealedRuntimeManifestEvidenceRef: manifestEvidenceRef,
      listenerOwnership,
      runtimeIsolation: isolationProof,
    },
    terminalProjectProjection: {
      schema: "setfarm.v3-terminal-project-projection.v1",
      owner: "mission-control-terminal-projector",
      state: "pending_terminal_projection",
      runId: RUN_ID,
      candidateHash: candidate.candidateHash,
      projectId: PROJECT_ID,
      serviceId: `process:${PROCESS_ID}`,
      port: PROCESS_ID,
      healthUrl: runtime.healthUrl,
      evidenceRef: `setfarm://run/${RUN_ID}/deploy-receipt`,
      buildArtifactHash: buildArtifact.artifactHash,
    },
    environmentNames: [],
    completedAt: NOW,
  });
  const deploymentStateHash = "8".repeat(64);
  const leaseIdentityHash = "9".repeat(64);
  const observation = createV3DeploymentObservationV1({
    schema: "setfarm.v3-deployment-observation.v1",
    observationVersion: 1,
    runId: RUN_ID,
    deploymentReceiptHash: receipt.receiptHash,
    receiptCompletedAt: receipt.completedAt,
    candidateHash: candidate.candidateHash,
    packetHash: candidate.packetHash,
    projectId: PROJECT_ID,
    buildArtifactHash: buildArtifact.artifactHash,
    sealedRuntimeManifestHash: MANIFEST_HASH,
    sealedRuntimeManifestEvidenceRef: manifestEvidenceRef,
    sealAuthorityHash: SEAL_AUTHORITY_HASH,
    sealAuthorityEvidenceRef,
    runtime,
    listenerOwnership,
    runtimeIsolation: isolationProof,
    deploymentStateHash,
    deploymentStateEvidenceRef: `setfarm://deploy/runtime-state/${RUN_ID}/${PROJECT_ID}/${deploymentStateHash}`,
    controlBindingHash: "0".repeat(64),
    leaseIdentityHash,
    leaseIdentityEvidenceRef: `setfarm://deploy/runtime-lease/${RUN_ID}/${PROJECT_ID}/${leaseIdentityHash}`,
    httpProof: {
      schema: "setfarm.v3-runtime-http-proof.v1",
      healthUrl: runtime.healthUrl,
      httpStatus: 200,
      checkedAt: NOW,
      evidenceRef: `${runtimeEvidenceRef}/http/${receipt.receiptHash}`,
    },
    checks: {
      receiptIdentity: "pass",
      processIdentity: "pass",
      listenerOwnership: "pass",
      runtimeHttp: "pass",
      sealedRuntime: "pass",
      runtimeIsolation: "pass",
    },
    observedAt: NOW,
  });
  return { receipt, observation };
}

function createProjectTransferAckFixture(
  candidate: AcceptedCandidateV1,
  receipt: V3DeployReceiptV1,
): V3ProjectTransferAckV1 {
  const projectProjection = {
    id: PROJECT_ID,
    name: receipt.project.displayName,
    description: receipt.project.summary,
    type: "web" as const,
    ports: { frontend: PROCESS_ID },
    deployUrl: receipt.runtime.deployUrl,
    service: receipt.runtime.serviceId,
    serviceStatus: "active" as const,
    status: "active" as const,
    stack: ["vite-react"],
    createdBy: "setfarm-v3-terminal-projector" as const,
    productCompilerProtocol: "v3" as const,
    workflowRunId: RUN_ID,
    setfarmRunIds: [RUN_ID],
    runNumber: 1,
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
  const payload = {
    schema: "setfarm.v3-project-transfer-ack.v1" as const,
    ackVersion: 1 as const,
    runId: RUN_ID,
    candidateId: candidate.candidateId,
    candidateHash: candidate.candidateHash,
    packetHash: candidate.packetHash,
    sourceRevision: candidate.sourceRevision,
    deploymentReceiptHash: receipt.receiptHash,
    deploymentReceiptRef: `setfarm://v3-deploy-receipts/${receipt.receiptHash}`,
    sourceSnapshotHash: "0".repeat(64),
    projectId: PROJECT_ID,
    projectProjection,
    projectionHash,
    projectRecordHash,
    projectRecordRef: `mission-control://projects/${PROJECT_ID}/${projectRecordHash}`,
    persistedAt: NOW,
    projector: { service: "mission-control" as const, protocol: "v3" as const },
  };
  return V3ProjectTransferAckV1Schema.parse({ ...payload, ackHash: hashCanonicalJson(payload) });
}

function createRunOperationalSnapshotV1Fixture(input: Readonly<{
  acceptance: AcceptanceFixture;
  receipt: V3DeployReceiptV1;
  acknowledgement: V3ProjectTransferAckV1;
}>): RunOperationalSnapshotV1 {
  const state = {
    schema: "setfarm.run-operational-snapshot.v1" as const,
    generatedAt: NOW,
    source: {
      database: "postgres" as const,
      projection: "complete" as const,
      migrationVersions: Array.from({ length: 18 }, (_value, index) => index + 1),
      verifiedReleaseSha: "9".repeat(40),
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
      ref: `setfarm://run/${RUN_ID}`,
      id: RUN_ID,
      runNumber: 1,
      protocol: "v3" as const,
      status: "completed",
      terminal: true,
      updatedAt: NOW,
    },
    summary: {
      lifecycleState: "terminal" as const,
      health: "ok" as const,
      activeClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      openCompletions: 0,
      mandatoryEffectsPending: 0,
      unpublishedOutbox: 0,
      invariantViolations: 0,
      operatorActions: {
        stop: {
          allowed: false,
          reasonCode: "RUN_ALREADY_TERMINAL",
          stateHash: hashCanonicalJson({ runId: RUN_ID, action: "stop" }),
        },
        resume: {
          allowed: false,
          reasonCode: "RUN_ALREADY_TERMINAL",
          stateHash: hashCanonicalJson({ runId: RUN_ID, action: "resume" }),
        },
      },
    },
    claims: [],
    attempts: [input.acceptance.attempt],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [],
    outbox: [],
    invariants: [],
    findingSets: [],
    evidenceBundles: [input.acceptance.bundle],
    recoveryCases: [],
    recoveryDispatches: [],
    acceptedCandidate: {
      ref: `setfarm://accepted-candidate/${input.acceptance.candidate.candidateHash}`,
      candidate: input.acceptance.candidate,
      createdAt: NOW,
    },
    deploymentReceipt: {
      ref: `setfarm://v3-deploy-receipts/${input.receipt.receiptHash}`,
      receipt: input.receipt,
      createdAt: NOW,
    },
    projectTransferAck: {
      ref: `setfarm://v3-project-transfer-acks/${input.acknowledgement.ackHash}`,
      acknowledgement: input.acknowledgement,
      createdAt: NOW,
    },
  };
  return RunOperationalSnapshotV1Schema.parse({
    ...state,
    snapshotHash: computeRunOperationalSnapshotHash(state),
  });
}

function createRunOperationalSnapshotV2Fixture(input: Readonly<{
  acceptance: AcceptanceFixture;
  receipt: V3DeployReceiptV1;
  acknowledgement: V3ProjectTransferAckV1;
}>): RunOperationalSnapshotV2 {
  const v1 = createRunOperationalSnapshotV1Fixture(input);
  const { snapshotHash: _v1SnapshotHash, ...v1State } = v1;
  const requestId = "RCR_contract-implementation-0001";
  const claimId = "1";
  const claimRef = `setfarm://claim-log/${claimId}`;
  const runtimeSessionId = "RTS_contract-implementation-0001";
  const runtimeSessionRef = `setfarm://runtime-session/${runtimeSessionId}`;
  const sourceProposalHash = "6".repeat(64);
  const canonicalOutputHash = "a".repeat(64);
  const state = {
    ...v1State,
    schema: "setfarm.run-operational-snapshot.v2" as const,
    source: {
      ...v1State.source,
      migrationVersions: [...v1State.source.migrationVersions, 19],
      capabilities: {
        ...v1State.source.capabilities,
        implementationSubmissionEvidence: true,
      },
    },
    claims: [{
      ref: claimRef,
      id: claimId,
      runRef: `setfarm://run/${RUN_ID}`,
      stepRef: `setfarm://run/${RUN_ID}/step/implement`,
      storyRef: `setfarm://run/${RUN_ID}/story/US-001`,
      workflowStepId: "implement",
      storyId: "US-001",
      agentId: "feature-dev_developer",
      state: "closed" as const,
      outcome: "completed",
      claimedAt: NOW,
      abandonedAt: null,
    }],
    runtimeSessions: [{
      ref: runtimeSessionRef,
      sessionId: runtimeSessionId,
      runRef: `setfarm://run/${RUN_ID}`,
      claimRef,
      attemptRef: null,
      stepRef: `setfarm://run/${RUN_ID}/step/implement`,
      storyRef: `setfarm://run/${RUN_ID}/story/US-001`,
      workflowStepId: "implement",
      storyId: "US-001",
      runtimeKind: "openclaw_session" as const,
      state: "released" as const,
      stateVersion: 5,
      startedAt: NOW,
      heartbeatAt: NOW,
      drainRequestedAt: NOW,
      drainedAt: NOW,
      releasedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    }],
    completionRequests: [{
      ref: `setfarm://runtime-completion/${requestId}`,
      requestId,
      runRef: `setfarm://run/${RUN_ID}`,
      runtimeSessionRef,
      claimRef,
      attemptRef: null,
      stepRef: `setfarm://run/${RUN_ID}/step/implement`,
      storyRef: `setfarm://run/${RUN_ID}/story/US-001`,
      workflowStepId: "implement",
      storyId: "US-001",
      outputHash: canonicalOutputHash,
      implementationSubmissionEvidence: {
        receipt: {
          schema: "setfarm.runtime-completion-submission-evidence.v1" as const,
          compiler: "setfarm.v3-implementation-output-compilation.v1" as const,
          sourceSchema: "setfarm.v3-implementation-agent-proposal.v1" as const,
          sourceProposalHash,
          canonicalOutputHash,
          ignoredFieldPaths: ["/providerAnnotation"],
        },
        sourceProposalRef: `setfarm://runtime-completion/${requestId}/source-proposal/${sourceProposalHash}`,
      },
      applyPhase: "effects_committed" as const,
      claimOutcome: "completed",
      completionPlanHash: null,
      state: "accepted" as const,
      requestedAt: NOW,
      drainedAt: NOW,
      processingAt: NOW,
      acceptedAt: NOW,
      rejectedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
      effects: [],
    }],
  };
  return RunOperationalSnapshotV2Schema.parse({
    ...state,
    snapshotHash: computeRunOperationalSnapshotHash(state),
  });
}

function createRunOperationalSnapshotV3Fixture(
  snapshotV2: RunOperationalSnapshotV2,
): RunOperationalSnapshotV3 {
  const { snapshotHash: _snapshotV2Hash, ...snapshotV2State } = snapshotV2;
  const operationalCause = {
    schema: "setfarm.operational-failure-cause.v1" as const,
    workflowStepId: "design",
    boundary: "product_compiler.design_candidate_authority",
    failureClass: "generated_artifact_invalid" as const,
    failureCode: "V3_DESIGN_CANDIDATE_AUTHORITY_UNRESOLVED",
  };
  const exactFailure = {
    schema: "setfarm.operational-exact-failure-identity.v2" as const,
    kind: "stitch_target_candidate_selection" as const,
    refKey: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_REF_KEY_V2,
    artifactType: STITCH_TARGET_CANDIDATE_SELECTION_FAILURE_ARTIFACT_TYPE_V2,
    failureArtifactHash: "3".repeat(64),
    failureFingerprint: "4".repeat(64),
    candidateSelectionHash: "5".repeat(64),
  };
  const failureIdentity = createOperationalFailureIdentityV2({
    requestedBy: DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
    evidenceSchema: DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
    operationalCause,
    exactFailure,
  });
  const terminationRequestRef = "setfarm://run-termination/RTR_contract-design-0001";
  const state = {
    ...snapshotV2State,
    schema: "setfarm.run-operational-snapshot.v3" as const,
    source: {
      ...snapshotV2State.source,
      migrationVersions: [...snapshotV2State.source.migrationVersions, 22],
      capabilities: {
        ...snapshotV2State.source.capabilities,
        operationalFailureAuthority: true,
      },
    },
    run: {
      ...snapshotV2State.run,
      status: "failed",
      terminal: true,
    },
    summary: {
      ...snapshotV2State.summary,
      lifecycleState: "terminal" as const,
      health: "blocked" as const,
      activeClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      openCompletions: 0,
      mandatoryEffectsPending: 0,
      unpublishedOutbox: 0,
    },
    claims: [],
    attempts: [],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [{
      ref: terminationRequestRef,
      requestId: "RTR_contract-design-0001",
      runRef: `setfarm://run/${RUN_ID}`,
      targetStatus: "failed" as const,
      state: "terminalized" as const,
      requestedBy: DESIGN_CANDIDATE_AUTHORITY_REQUESTER_V2,
      diagnostic: "Typed design authority refused before packet sealing",
      evidence: {
        schema: DESIGN_CANDIDATE_AUTHORITY_EVIDENCE_SCHEMA_V2,
        terminalFailure: true as const,
        owner: "compiler" as const,
        outcome: "candidate_authority_unresolved" as const,
        failureRefKey: exactFailure.refKey,
        failureArtifactType: exactFailure.artifactType,
        failureArtifactHash: exactFailure.failureArtifactHash,
        failureFingerprint: exactFailure.failureFingerprint,
        candidateSelectionHash: exactFailure.candidateSelectionHash,
        modelRedispatchBudget: 0 as const,
        operationalFailureCause: operationalCause,
      },
      requestedAt: NOW,
      drainedAt: NOW,
      terminalizedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    }],
    outbox: [],
    invariants: [],
    findingSets: [],
    evidenceBundles: [],
    recoveryCases: [],
    recoveryDispatches: [],
    acceptedCandidate: null,
    deploymentReceipt: null,
    projectTransferAck: null,
    operationalFailure: {
      terminationRequestRef,
      failureIdentity,
    },
  };
  return RunOperationalSnapshotV3Schema.parse({
    ...state,
    snapshotHash: computeRunOperationalSnapshotHashV3(state),
  });
}

function jsonSchemaFor(contract: MissionControlContractName, schema: z.ZodType): unknown {
  return {
    $id: `https://contracts.setfarm.dev/mission-control/${contract}.schema.json`,
    ...z.toJSONSchema(schema, { io: "input" }),
  };
}

type ArtifactPairBaseInput = Readonly<{
  stem: string;
  schema: z.ZodType;
  fixture: unknown;
}>;

type ArtifactPairInput =
  | Readonly<ArtifactPairBaseInput & {
    contract: Exclude<
      MissionControlContractName,
      "setfarm.operational-active-run-status.v1"
    >;
    producerExports?: never;
  }>
  | Readonly<ArtifactPairBaseInput & {
    contract: "setfarm.operational-active-run-status.v1";
    producerExports: MissionControlOperationalActiveProducerExportsV1;
  }>;

function artifactPair(input: ArtifactPairInput): readonly MissionControlContractArtifact[] {
  const jsonSchema = jsonSchemaFor(input.contract, input.schema);
  const envelopeBase: MissionControlCompatibilityEnvelopeBaseV1 = {
    schema: MISSION_CONTROL_CONTRACT_ARTIFACT_SCHEMA,
    producer: { name: "setfarm", contractVersion: 1 },
    jsonSchemaHash: hashCanonicalJson(jsonSchema),
    fixtureHash: hashCanonicalJson(input.fixture),
    fixture: input.fixture,
  };
  const envelope: MissionControlCompatibilityEnvelopeV1 = input.contract ===
    "setfarm.operational-active-run-status.v1"
    ? {
        ...envelopeBase,
        contract: input.contract,
        producerExports: input.producerExports,
      }
    : {
        ...envelopeBase,
        contract: input.contract,
      };
  return [
    {
      relativePath: `${MISSION_CONTROL_CONTRACT_ARTIFACT_DIRECTORY}/${input.stem}.compatibility.json`,
      value: envelope,
    },
    {
      relativePath: `${MISSION_CONTROL_CONTRACT_ARTIFACT_DIRECTORY}/${input.stem}.schema.json`,
      value: jsonSchema,
    },
  ];
}

export function createMissionControlContractArtifacts(): readonly MissionControlContractArtifact[] {
  const acceptance = createAcceptanceFixture();
  const deployment = createDeploymentFixture(acceptance.candidate);
  const acknowledgement = createProjectTransferAckFixture(acceptance.candidate, deployment.receipt);
  const snapshotV1 = createRunOperationalSnapshotV1Fixture({
    acceptance,
    receipt: deployment.receipt,
    acknowledgement,
  });
  const snapshotV2 = createRunOperationalSnapshotV2Fixture({
    acceptance,
    receipt: deployment.receipt,
    acknowledgement,
  });
  const snapshotV3 = createRunOperationalSnapshotV3Fixture(snapshotV2);

  RunOperationalSnapshotV1Schema.parse(snapshotV1);
  RunOperationalSnapshotV2Schema.parse(snapshotV2);
  RunOperationalSnapshotV3Schema.parse(snapshotV3);
  V3DeploymentObservationV1Schema.parse(deployment.observation);
  V3ProjectTransferAckV1Schema.parse(acknowledgement);

  return [
    ...artifactPair({
      contract: "setfarm.run-operational-snapshot.v1",
      stem: "run-operational-snapshot.v1",
      schema: RunOperationalSnapshotV1Schema,
      fixture: snapshotV1,
    }),
    ...artifactPair({
      contract: "setfarm.run-operational-snapshot.v2",
      stem: "run-operational-snapshot.v2",
      schema: RunOperationalSnapshotV2Schema,
      fixture: snapshotV2,
    }),
    ...artifactPair({
      contract: "setfarm.run-operational-snapshot.v3",
      stem: "run-operational-snapshot.v3",
      schema: RunOperationalSnapshotV3Schema,
      fixture: snapshotV3,
    }),
    ...artifactPair({
      contract: "setfarm.v3-deployment-observation.v1",
      stem: "deployment-observation.v1",
      schema: V3DeploymentObservationV1Schema,
      fixture: deployment.observation,
    }),
    ...artifactPair({
      contract: "setfarm.v3-project-transfer-ack.v1",
      stem: "project-transfer-ack.v1",
      schema: V3ProjectTransferAckV1Schema,
      fixture: acknowledgement,
    }),
    ...artifactPair({
      contract: "setfarm.operational-active-run-status.v1",
      stem: "operational-active-run-status.v1",
      schema: SetfarmOperationalActiveRunStatusV1Schema,
      fixture: SetfarmOperationalActiveRunStatusV1Schema.parse(
        SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1[0],
      ),
      producerExports: {
        statusesExport: "SETFARM_OPERATIONAL_ACTIVE_RUN_STATUSES_V1",
        schemaExport: "SetfarmOperationalActiveRunStatusV1Schema",
        predicateExport: "isSetfarmOperationalActiveRunStatusV1",
      },
    }),
  ];
}
