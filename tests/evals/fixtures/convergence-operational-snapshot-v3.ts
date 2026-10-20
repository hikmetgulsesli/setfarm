import { createOperationalFailureIdentityV2 } from "../../../src/execution/schemas/operational-failure-identity-v2.js";
import { canonicalizeProductSpecRejectionV1 } from "../../../src/product-compiler/producers/plan-product-spec-proposal.js";
import { extractTaskRequirementLedgerV1 } from "../../../src/product-compiler/requirements/task-requirements-v1.js";
import { computeRunOperationalSnapshotHashV3, RunOperationalSnapshotV3Schema, type RunOperationalSnapshotV3 } from "../../../src/server/schemas/run-operational-snapshot-v3.js";
import { createAcceptedCandidateV1 } from "../../../src/evidence/accepted-candidate-v1.js";
import { createV3BuildArtifactV1, createV3DeployReceiptV1 } from "../../../src/execution/schemas/v3-deploy-receipt-v1.js";
import { V3ProjectTransferAckV1Schema } from "../../../src/execution/schemas/v3-project-transfer-ack-v1.js";
import { hashCanonicalJson } from "../../../src/product-compiler/canonical-json.js";
import { RunOperationalSnapshotV2Schema, type RunOperationalSnapshotV2 } from "../../../src/server/schemas/run-operational-snapshot-v2.js";
import { buildNoVolumeRuntimeAuthorityFixture } from "../../execution-attempts/fixtures/v3-runtime-authority.js";

// Stage A deliberately contains only strict V2 fixtures. V3 witnesses follow Root's V2 pass.
const SHA = "a".repeat(40);
const HASH = "b".repeat(64);
const NOW = "2026-07-13T12:00:00.000Z";

export function convergenceOperationalSnapshotV2Hash(
  snapshot: Omit<RunOperationalSnapshotV2, "snapshotHash">,
): string {
  const { generatedAt, ...state } = snapshot;
  const invariants = state.invariants.map(({ observedAt, ...item }) => item);
  return hashCanonicalJson({ ...state, invariants });
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
      attemptClass: "evidence_only" as const,
      packetHash: candidate.packetHash,
      compilationReportHash: HASH,
      sliceHash,
      sourceBefore: sourceRevision,
      sourceAfter: sourceRevision,
      findingSetHash: null,
      role: "tester",
      agentId: "feature-dev_tester",
      disposition: "verified" as const,
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
      aggregateVerdict: "pass" as const,
      predicateCount: 1,
      observationCount: 1,
      createdAt: NOW,
    },
  };
}

function transferSnapshotEvidence(runId: string, persistedAt: string) {
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
    persistedAt,
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
    persistedAt,
    projector: { service: "mission-control" as const, protocol: "v3" as const },
  };
  const acknowledgement = V3ProjectTransferAckV1Schema.parse({
    ...ackPayload,
    ackHash: hashCanonicalJson(ackPayload),
  });
  return { receipt, acknowledgement };
}

function snapshot(runId: string, rejected: boolean, persistedAt = NOW) {
  const accepted = acceptedSnapshotEvidence(runId);
  const transfer = rejected ? null : transferSnapshotEvidence(runId, persistedAt);
  const hashable: Omit<RunOperationalSnapshotV2, "snapshotHash"> = {
    schema: "setfarm.run-operational-snapshot.v2",
    generatedAt: NOW,
    source: {
      database: "postgres",
      projection: "complete",
      migrationVersions: [19],
      verifiedReleaseSha: SHA,
      capabilities: {
        attempts: true,
        claimBinding: true,
        runtimeOwnership: true,
        managerCompletion: true,
        implementationSubmissionEvidence: true,
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
    snapshotHash: convergenceOperationalSnapshotV2Hash(hashable),
  });
}

export function convergenceOperationalSnapshotV2Fixture(runId: string): RunOperationalSnapshotV2 {
  return snapshot(runId, true);
}

export function convergenceAcceptedOperationalSnapshotFixtureV1(input: Readonly<{
  runId: string;
  version: "v2" | "v3";
  persistedAt?: string;
}>): RunOperationalSnapshotV2 | RunOperationalSnapshotV3 {
  const accepted = snapshot(input.runId, false, input.persistedAt);
  if (input.version === "v2") return accepted;
  const hashable = {
    ...accepted,
    schema: "setfarm.run-operational-snapshot.v3" as const,
    source: {
      ...accepted.source,
      migrationVersions: [19, 22],
      capabilities: { ...accepted.source.capabilities, operationalFailureAuthority: true },
    },
    operationalFailure: null,
  };
  return RunOperationalSnapshotV3Schema.parse({
    ...hashable,
    snapshotHash: computeRunOperationalSnapshotHashV3(hashable),
  });
}

// Stage B: full canonical V3 refusal evidence, added after Root's V2 compatibility pass.
export function convergenceOperationalSnapshotV3Fixture(
  runId: string,
  reasonCode: "PRODUCT_SPEC_TASK_AMBIGUOUS" | "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
): RunOperationalSnapshotV3 {
  const base = convergenceOperationalSnapshotV2Fixture(runId);
  const task = "Create a web application whose requested runtime authority is unspecified.";
  const ledger = extractTaskRequirementLedgerV1(task);
  const rejection = canonicalizeProductSpecRejectionV1({
    task,
    rejection: {
      schema: "setfarm.product-spec-rejection.v1",
      sourceTaskHash: ledger.sourceHash,
      reasons: [{
        code: reasonCode,
        requirementRefs: ledger.requirements.map(item => item.id),
        message: "The exact requested runtime authority cannot be determined.",
      }],
    },
  });
  const requestedBy = "setfarm.product-compiler.plan-refusal";
  const evidenceSchema = "setfarm.v3-plan-clarification-termination.v1";
  const cause = {
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: "plan",
    boundary: "product_compiler.plan_refusal",
    failureClass: "contract_invalid",
    failureCode: "V3_PLAN_CLARIFICATION_REQUIRED",
  } as const;
  const reasonCodes = [...new Set(rejection.reasons.map(reason => reason.code))].sort();
  const requirementRefs = [...new Set(rejection.reasons.flatMap(reason => reason.requirementRefs))].sort();
  const requestId = `${runId}-plan-refusal`;
  const requestRef = `setfarm://run-termination/${requestId}`;
  const hashable = {
    ...base,
    schema: "setfarm.run-operational-snapshot.v3" as const,
    source: {
      ...base.source,
      migrationVersions: [19, 22],
      capabilities: { ...base.source.capabilities, operationalFailureAuthority: true },
    },
    terminationRequests: [{
      ref: requestRef,
      requestId,
      runRef: base.run.ref,
      targetStatus: "failed",
      state: "terminalized",
      requestedBy,
      diagnostic: `V3_PLAN_CLARIFICATION_REQUIRED:${reasonCodes.join(",")}:${requirementRefs.join(",")}`,
      evidence: {
        schema: evidenceSchema,
        terminalFailure: true,
        owner: "compiler",
        rejectionHash: hashCanonicalJson(rejection),
        sourceTaskHash: rejection.sourceTaskHash,
        reasonCodes,
        requirementRefs,
        modelRedispatchBudget: 0,
        operationalFailureCause: cause,
      },
      requestedAt: NOW,
      drainedAt: NOW,
      terminalizedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    }],
    operationalFailure: {
      terminationRequestRef: requestRef,
      failureIdentity: createOperationalFailureIdentityV2({
        requestedBy, evidenceSchema, operationalCause: cause, exactFailure: null,
      }),
    },
  };
  return RunOperationalSnapshotV3Schema.parse({
    ...hashable,
    snapshotHash: computeRunOperationalSnapshotHashV3(hashable),
  });
}
