import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { IndexedArtifactPublicationResult } from "../product-compiler/indexed-artifact-publisher.js";
import { IndexedArtifactPublisher } from "../product-compiler/indexed-artifact-publisher.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-store.js";
import { createRuntimeArtifactReader, type SealedRuntimePacketV1 } from "../product-compiler/runtime-artifact-reader.js";
import { compileImplementationSlice } from "../product-compiler/slice-compiler.js";
import { ImplementationSliceV1Schema, type ImplementationSliceV1 } from "../product-compiler/schemas/implementation-slice-v1.js";
import type { SemanticArtifactProducerV1 } from "../product-compiler/schemas/common-v1.js";
import { topologyPathAbsenceHash } from "../product-compiler/schemas/build-topology-v1.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";
import type { ExecutionAttemptV1 } from "./schemas/execution-attempt-v1.js";
import { createAttemptRepository, type AttemptReservationResult } from "./attempt-repository.js";
import { captureShadowSourceRevision } from "./shadow-attempt-recorder.js";
import { getSql } from "../db-pg.js";
import { resolveProductArtifactCapacity, resolveProductArtifactDir } from "../runtime-config.js";
import { compileEvidencePlanV1, type EvidencePlanV1 } from "../evidence/evidence-plan-v1.js";
import { produceRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-producer-v1.js";
import { createRecoveryDeliveryRepository } from "../recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../recovery/finding-recovery-repository.js";
import type {
  RecoveryCaseRevisionV1,
  RecoveryRevisionDispatchV1,
} from "../recovery/recovery-delivery.js";
import type { FindingSetV1 } from "../findings/finding-set.js";
import {
  GithubReviewThreadEvidenceV1Schema,
  type GithubReviewThreadEvidenceV1,
} from "../findings/github-review-source.js";
import {
  createV3EvidenceOnlyPublication,
  type V3EvidenceOnlyPreparedPublicationV1,
  type V3EvidenceOnlyPublicationLeaseV1,
} from "../recovery/v3-evidence-only-publication.js";
import {
  createV3DownstreamEvidencePublication,
  type V3DownstreamEvidenceAuthorityV1,
  type V3DownstreamEvidencePreparedAttemptV1,
} from "../recovery/v3-downstream-evidence-publication.js";
import type { V3ImplementationAttemptErrorCode } from "./v3-preparation-decision.js";
import {
  createV3ImplementationClaimHandoffV1,
  createV3ImplementationContextV1,
  V3ImplementationContextCapacityError,
} from "./v3-implementation-handoff.js";

export type V3ReviewEvidenceArtifact = Readonly<{
  artifactHash: string;
  evidence: GithubReviewThreadEvidenceV1;
}>;

export type V3ImplementationAttemptInput = Readonly<{
  runId: string;
  stepId: string;
  storyId: string;
  claimId?: number;
  role: string;
  agentId: string;
  branch: string;
  worktree: string;
  findingSetHash?: string;
  recoveryDelivery?: Readonly<{
    dispatchId: string;
    revisionId: string;
    ownerInstanceId: string;
    leaseToken: string;
  }>;
  /** Non-model evidence-only publication owns claim creation atomically. */
  evidenceOnlyLease?: V3EvidenceOnlyPublicationLeaseV1;
  /** QA/final is only the parent authority; publication creates a story child claim. */
  downstreamEvidenceAuthority?: V3DownstreamEvidenceAuthorityV1;
}>;

export type V3ImplementationAttemptResult = Readonly<{
  attempt: ExecutionAttemptV1;
  artifactProducer: SemanticArtifactProducerV1;
  slice: ImplementationSliceV1;
  sliceHash: string;
  sliceRefKey: string;
  evidencePlan: EvidencePlanV1;
  evidencePlanArtifactHash: string;
  evidencePlanRefKey: string;
  packetHash: string;
  compilationReportHash: string;
  sourceBefore: SourceRevisionV1;
  recovery?: Readonly<{
    revision: RecoveryCaseRevisionV1;
    dispatch: RecoveryRevisionDispatchV1;
    findingSet: FindingSetV1;
    reviewEvidenceArtifacts: readonly V3ReviewEvidenceArtifact[];
  }>;
}>;

type DependencySignature = Readonly<{
  sliceHash: string;
  outputHash?: string;
  sourceAfter: Readonly<{ baseSha: string; treeHash: string }>;
  fileSignatures: readonly Readonly<{
    pathRef: string;
    presence: "present" | "absent";
    contentHash: string;
  }>[];
}>;

type V3CompilerDependencies = Readonly<{
  readPacket(runId: string): Promise<SealedRuntimePacketV1>;
  publish(envelope: unknown): Promise<IndexedArtifactPublicationResult>;
  addRunRef(input: { runId: string; refKey: string; artifactHash: string }): Promise<unknown>;
  reserveAttempt(input: unknown): Promise<AttemptReservationResult>;
  reserveEvidenceOnlyAttempt?(input: Readonly<{
    lease: V3EvidenceOnlyPublicationLeaseV1;
    prepared: V3EvidenceOnlyPreparedPublicationV1;
  }>): Promise<AttemptReservationResult>;
  reserveDownstreamEvidenceAttempt?(input: Readonly<{
    authority: V3DownstreamEvidenceAuthorityV1;
    prepared: V3DownstreamEvidencePreparedAttemptV1;
  }>): Promise<AttemptReservationResult>;
  findAttempt(attemptId: string): Promise<ExecutionAttemptV1 | undefined>;
  readArtifact(hash: string): Promise<Readonly<{
    artifactType: string;
    producer: unknown;
    payload: unknown;
  }>>;
  captureSource(worktree: string): Promise<SourceRevisionV1>;
  readDependencies(input: {
    runId: string;
    stepId: string;
    packetHash: string;
    storyIds: readonly string[];
    sourceWorktree: string;
    requiredFiles: Readonly<Record<string, readonly Readonly<{ pathRef: string; path: string }>[]>>;
  }): Promise<Record<string, DependencySignature>>;
  readRecovery?(input: {
    dispatchId: string;
    revisionId: string;
  }): Promise<Readonly<{
    revision: RecoveryCaseRevisionV1;
    dispatch: RecoveryRevisionDispatchV1;
    findingSet: FindingSetV1;
  }>>;
}>;

export class V3ImplementationAttemptError extends Error {
  readonly code: V3ImplementationAttemptErrorCode;

  constructor(code: V3ImplementationAttemptErrorCode, message: string) {
    super(message);
    this.name = "V3ImplementationAttemptError";
    this.code = code;
  }
}

function sourceFileSnapshot(
  worktree: string,
  relativePath: string,
): Readonly<{ presence: "present" | "absent"; contentHash: string }> {
  const root = path.resolve(worktree);
  const absolute = path.resolve(root, relativePath);
  if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
    throw new V3ImplementationAttemptError(
      "V3_SLICE_SOURCE_PATH_ESCAPE",
      `Topology path escapes the implementation worktree: ${relativePath}`,
    );
  }
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        presence: "absent",
        contentHash: topologyPathAbsenceHash(relativePath),
      };
    }
    throw error;
  }
  if (!stat.isFile()) {
    throw new V3ImplementationAttemptError(
      "V3_SLICE_SOURCE_TYPE_UNSUPPORTED",
      `Topology source path is not a regular file: ${relativePath}`,
    );
  }
  return {
    presence: "present",
    contentHash: createHash("sha256").update(fs.readFileSync(absolute)).digest("hex"),
  };
}

function sliceRefKey(storyId: string, sliceHash: string): string {
  const story = storyId
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `SLICE_${story}_${sliceHash.slice(0, 16).toUpperCase()}`;
}

function evidencePlanRefKey(storyId: string, artifactHash: string): string {
  const story = storyId
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `EVIDENCE_PLAN_${story}_${artifactHash.slice(0, 16).toUpperCase()}`;
}

function evidencePlanEnvelope(
  packet: SealedRuntimePacketV1,
  plan: EvidencePlanV1,
) {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: "setfarm.evidence-plan.v1",
    producer: packet.producer,
    payload: plan,
  });
}

function sameRevision(left: SourceRevisionV1, right: SourceRevisionV1): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

export function captureDependencyFileSignatures(input: Readonly<{
  sourceWorktree: string;
  commitSha: string;
  files: readonly Readonly<{ pathRef: string; path: string }>[];
}>): readonly Readonly<{
  pathRef: string;
  presence: "present" | "absent";
  contentHash: string;
}>[] {
  const commitSha = input.commitSha.trim().toLowerCase();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commitSha)) {
    throw new V3ImplementationAttemptError(
      "V3_SLICE_DEPENDENCY_COMMIT_INVALID",
      `Dependency terminal commit is not a full object hash: ${input.commitSha}`,
    );
  }
  let commit: string;
  try {
    commit = execFileSync("git", ["rev-parse", "--verify", `${commitSha}^{commit}`], {
      cwd: input.sourceWorktree,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim().toLowerCase();
  } catch {
    throw new V3ImplementationAttemptError(
      "V3_SLICE_DEPENDENCY_COMMIT_MISSING",
      `Dependency terminal commit ${commitSha} is unavailable`,
    );
  }
  if (commit !== commitSha) {
    throw new V3ImplementationAttemptError(
      "V3_SLICE_DEPENDENCY_COMMIT_MISMATCH",
      `Dependency resolved commit ${commit}, expected ${commitSha}`,
    );
  }
  const unique = new Map<string, { pathRef: string; path: string }>();
  for (const file of input.files) {
    if (
      !file.pathRef
      || !file.path
      || path.posix.isAbsolute(file.path)
      || file.path.includes("\\")
      || file.path.includes(":")
      || file.path.split("/").some((part) => part === "" || part === "." || part === "..")
    ) {
      throw new V3ImplementationAttemptError(
        "V3_SLICE_DEPENDENCY_PATH_INVALID",
        `Dependency source path is not a normalized repository file: ${file.path}`,
      );
    }
    const current = unique.get(file.pathRef);
    if (current && current.path !== file.path) {
      throw new V3ImplementationAttemptError(
        "V3_SLICE_DEPENDENCY_PATH_REF_CONFLICT",
        `Dependency path ref ${file.pathRef} resolves to multiple paths`,
      );
    }
    unique.set(file.pathRef, { pathRef: file.pathRef, path: file.path });
  }
  return [...unique.values()]
    .sort((left, right) => left.pathRef.localeCompare(right.pathRef))
    .map((file) => {
      const object = `${commit}:${file.path}`;
      let objectType: string;
      try {
        objectType = execFileSync("git", ["cat-file", "-t", object], {
          cwd: input.sourceWorktree,
          encoding: "utf8",
          timeout: 10_000,
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        return {
          pathRef: file.pathRef,
          presence: "absent" as const,
          contentHash: topologyPathAbsenceHash(file.path),
        };
      }
      if (objectType !== "blob") {
        throw new V3ImplementationAttemptError(
          "V3_SLICE_DEPENDENCY_SOURCE_TYPE_UNSUPPORTED",
          `Dependency source ${file.path} is ${objectType}, expected blob`,
        );
      }
      const bytes = execFileSync("git", ["cat-file", "blob", object], {
        cwd: input.sourceWorktree,
        timeout: 30_000,
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return {
        pathRef: file.pathRef,
        presence: "present" as const,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
      };
    });
}

function compilerRejectionMessage(result: ReturnType<typeof compileImplementationSlice>): string {
  return result.diagnostics
    .map((item) => `${item.code}:${item.reference ?? "$"}:${item.message}`)
    .join(" | ")
    .slice(0, 8_000);
}

function modelRecoveryExecutionAuthority(
  dispatchClass: "product_implementation" | "supervisor_repair",
): Readonly<{ role: "developer" | "supervisor"; owner: "implement" | "supervisor" }> {
  return dispatchClass === "supervisor_repair"
    ? { role: "supervisor", owner: "supervisor" }
    : { role: "developer", owner: "implement" };
}

async function loadReviewEvidenceArtifacts(input: Readonly<{
  dependencies: V3CompilerDependencies;
  producer: SemanticArtifactProducerV1;
  findingSet: FindingSetV1;
}>): Promise<readonly V3ReviewEvidenceArtifact[]> {
  const reviewFindings = input.findingSet.findings.filter(
    (finding) => finding.classification === "unstructured_review",
  );
  const artifacts = new Map<string, V3ReviewEvidenceArtifact>();
  for (const finding of reviewFindings) {
    if (finding.observedEvidenceRefs.length !== 1 || !finding.externalRef || finding.sourceLocators.length !== 1) {
      throw new V3ImplementationAttemptError(
        "V3_RECOVERY_REVIEW_EVIDENCE_REF_INVALID",
        `Review finding ${finding.findingId} must bind one evidence artifact, external identity, and source locator`,
      );
    }
    const artifactHash = finding.observedEvidenceRefs[0]!;
    let stored: Awaited<ReturnType<V3CompilerDependencies["readArtifact"]>>;
    let evidence: GithubReviewThreadEvidenceV1;
    try {
      stored = await input.dependencies.readArtifact(artifactHash);
      if (stored.artifactType !== "setfarm.github-review-thread-evidence.v1") {
        throw new Error(`unexpected artifact type ${stored.artifactType}`);
      }
      evidence = GithubReviewThreadEvidenceV1Schema.parse(stored.payload);
      const envelope = SemanticArtifactEnvelopeV1Schema.parse({
        schema: "setfarm.semantic-artifact-envelope.v1",
        artifactType: stored.artifactType,
        producer: stored.producer,
        payload: evidence,
      });
      if (
        canonicalJsonStringify(envelope.producer) !== canonicalJsonStringify(input.producer)
        || hashCanonicalJson(envelope) !== artifactHash
      ) {
        throw new Error("artifact producer or content hash differs from the sealed packet authority");
      }
    } catch (error) {
      throw new V3ImplementationAttemptError(
        "V3_RECOVERY_REVIEW_EVIDENCE_ARTIFACT_INVALID",
        `Review evidence ${artifactHash} is not an exact indexed semantic artifact: ${String((error as Error)?.message || error)}`,
      );
    }
    const external = finding.externalRef;
    const locator = finding.sourceLocators[0]!;
    const commentIds = new Set(evidence.comments.map((comment) => comment.commentId));
    if (
      evidence.repository.nodeId !== external.repositoryNodeId
      || evidence.prNumber !== external.prNumber
      || evidence.threadId !== external.threadId
      || evidence.headSha !== external.headSha
      || evidence.headSha !== input.findingSet.sourceRevision.sha
      || evidence.bodyRevisionHash !== external.commentRevisionHash
      || (external.commentId !== undefined && !commentIds.has(external.commentId))
      || evidence.path !== locator.path
      || evidence.currentSource.contentHash !== locator.contentHash
    ) {
      throw new V3ImplementationAttemptError(
        "V3_RECOVERY_REVIEW_EVIDENCE_IDENTITY_MISMATCH",
        `Review evidence ${artifactHash} differs from finding ${finding.findingId} or its exact source revision`,
      );
    }
    artifacts.set(artifactHash, { artifactHash, evidence });
  }
  if (artifacts.size !== reviewFindings.length) {
    throw new V3ImplementationAttemptError(
      "V3_RECOVERY_REVIEW_EVIDENCE_REF_INVALID",
      "Each unstructured review finding must own a distinct immutable evidence artifact",
    );
  }
  return [...artifacts.values()].sort((left, right) => left.artifactHash.localeCompare(right.artifactHash));
}

export function createV3ImplementationAttemptCompiler(dependencies: V3CompilerDependencies) {
  return Object.freeze({
    async reserve(input: V3ImplementationAttemptInput): Promise<V3ImplementationAttemptResult> {
      const recoveryEvidenceOnly = input.evidenceOnlyLease !== undefined;
      const downstreamEvidence = input.downstreamEvidenceAuthority !== undefined;
      if (recoveryEvidenceOnly && downstreamEvidence) {
        throw new V3ImplementationAttemptError(
          "V3_EVIDENCE_PUBLICATION_AUTHORITY_CONFLICT",
          "One attempt cannot be both initial downstream evidence and recovery evidence",
        );
      }
      if (!recoveryEvidenceOnly && !downstreamEvidence && (!Number.isSafeInteger(input.claimId) || (input.claimId ?? 0) <= 0)) {
        throw new V3ImplementationAttemptError(
          "V3_ATTEMPT_CLAIM_ID_REQUIRED",
          "Model implementation attempt publication requires its existing exact claim",
        );
      }
      if (
        recoveryEvidenceOnly
        && (
          input.claimId !== undefined
          || !input.recoveryDelivery
          || !dependencies.reserveEvidenceOnlyAttempt
          || input.evidenceOnlyLease!.runId !== input.runId
          || input.evidenceOnlyLease!.storyId !== input.storyId
          || input.evidenceOnlyLease!.dispatchId !== input.recoveryDelivery.dispatchId
          || input.evidenceOnlyLease!.revisionId !== input.recoveryDelivery.revisionId
          || input.evidenceOnlyLease!.ownerInstanceId !== input.recoveryDelivery.ownerInstanceId
          || input.evidenceOnlyLease!.leaseToken !== input.recoveryDelivery.leaseToken
        )
      ) {
        throw new V3ImplementationAttemptError(
          "V3_EVIDENCE_ONLY_PUBLICATION_INPUT_INVALID",
          "Evidence-only compilation requires one exact non-model publication lease and no caller-created claim",
        );
      }
      if (
        downstreamEvidence
        && (
          input.claimId !== undefined
          || input.recoveryDelivery !== undefined
          || input.evidenceOnlyLease !== undefined
          || input.findingSetHash !== undefined
          || !dependencies.reserveDownstreamEvidenceAttempt
          || input.downstreamEvidenceAuthority!.runId !== input.runId
          || input.downstreamEvidenceAuthority!.storyId !== input.storyId
          || input.downstreamEvidenceAuthority!.workflowStepId !== input.stepId
        )
      ) {
        throw new V3ImplementationAttemptError(
          "V3_DOWNSTREAM_EVIDENCE_PUBLICATION_INPUT_INVALID",
          "Initial downstream evidence requires one exact QA/final parent authority and no model claim or recovery identity",
        );
      }
      const packet = await dependencies.readPacket(input.runId);
      const story = packet.storyPlan.stories.find((item) => item.id === input.storyId);
      if (!story) {
        throw new V3ImplementationAttemptError(
          "V3_SLICE_STORY_NOT_IN_PACKET",
          `Story ${input.storyId} is absent from run ${input.runId}'s sealed packet`,
        );
      }
      const runtimeEvidenceProduction = produceRuntimeEvidenceContractV1({
        productSpec: packet.productSpec,
        buildTopology: packet.buildTopology,
      });
      if (runtimeEvidenceProduction.status === "rejected") {
        throw new V3ImplementationAttemptError(
          "V3_RUNTIME_EVIDENCE_CONTRACT_REJECTED",
          `Sealed packet cannot produce an exact runtime evidence contract: ${runtimeEvidenceProduction.rejectionCode}`,
        );
      }
      if (runtimeEvidenceProduction.status === "unsupported") {
        throw new V3ImplementationAttemptError(
          "V3_RUNTIME_EVIDENCE_STACK_UNSUPPORTED",
          `Sealed stack ${runtimeEvidenceProduction.stackPackId} has no authoritative runtime evidence contract producer`,
        );
      }

      const recoveryAuthorization = input.recoveryDelivery
        ? await dependencies.readRecovery?.({
            dispatchId: input.recoveryDelivery.dispatchId,
            revisionId: input.recoveryDelivery.revisionId,
          })
        : undefined;
      if (input.recoveryDelivery && !recoveryAuthorization) {
        throw new V3ImplementationAttemptError(
          "V3_RECOVERY_AUTHORIZATION_UNAVAILABLE",
          `Recovery dispatch ${input.recoveryDelivery.dispatchId} could not be loaded`,
        );
      }
      if (recoveryAuthorization) {
        const { revision, dispatch, findingSet } = recoveryAuthorization;
        if (
          dispatch.dispatchId !== input.recoveryDelivery!.dispatchId
          || dispatch.revisionId !== input.recoveryDelivery!.revisionId
          || revision.revisionId !== dispatch.revisionId
          || revision.recoveryCaseId !== dispatch.recoveryCaseId
          || revision.runId !== input.runId
          || revision.storyId !== input.storyId
          || dispatch.runId !== input.runId
          || dispatch.storyId !== input.storyId
          || revision.packetHash !== packet.packetHash
          || dispatch.packetHash !== packet.packetHash
          || revision.findingSetHash !== dispatch.findingSetHash
          || findingSet.findingSetHash !== dispatch.findingSetHash
          || findingSet.packetHash !== packet.packetHash
          || findingSet.sliceHash !== revision.contractSliceHash
          || findingSet.sourceRevision.sha !== revision.sourceRevision.sha
          || findingSet.sourceRevision.treeHash !== revision.sourceRevision.treeHash
          || dispatch.sourceRevision.sha !== revision.sourceRevision.sha
          || dispatch.sourceRevision.treeHash !== revision.sourceRevision.treeHash
          || (
            recoveryEvidenceOnly
              ? dispatch.dispatchClass !== "evidence_only"
              : !["product_implementation", "supervisor_repair"].includes(dispatch.dispatchClass)
          )
        ) {
          throw new V3ImplementationAttemptError(
            "V3_RECOVERY_AUTHORIZATION_IDENTITY_MISMATCH",
            `Recovery dispatch ${dispatch.dispatchId} does not bind the exact run/story/packet/finding/source revision`,
          );
        }
        if (!recoveryEvidenceOnly) {
          const authority = modelRecoveryExecutionAuthority(
            dispatch.dispatchClass as "product_implementation" | "supervisor_repair",
          );
          if (revision.owner !== authority.owner || input.role !== authority.role) {
            throw new V3ImplementationAttemptError(
              "V3_RECOVERY_EXECUTION_AUTHORITY_MISMATCH",
              `Recovery ${dispatch.dispatchClass} requires ${authority.owner}/${authority.role} authority`,
            );
          }
        }
        if (input.findingSetHash && input.findingSetHash !== findingSet.findingSetHash) {
          throw new V3ImplementationAttemptError(
            "V3_RECOVERY_FINDING_SET_OVERRIDE_REJECTED",
            "Caller-provided finding set differs from the durable recovery authorization",
          );
        }
        const contractSliceEnvelope = await dependencies.readArtifact(revision.contractSliceHash);
        if (contractSliceEnvelope.artifactType !== "setfarm.implementation-slice.v1") {
          throw new V3ImplementationAttemptError(
            "V3_RECOVERY_CONTRACT_SLICE_INVALID",
            `Recovery contract slice ${revision.contractSliceHash} is not an implementation slice`,
          );
        }
        const contractSlice = ImplementationSliceV1Schema.parse(contractSliceEnvelope.payload);
        if (contractSlice.packetHash !== packet.packetHash || contractSlice.storyId !== input.storyId) {
          throw new V3ImplementationAttemptError(
            "V3_RECOVERY_CONTRACT_SLICE_IDENTITY_MISMATCH",
            `Recovery contract slice ${revision.contractSliceHash} does not bind the exact packet/story`,
          );
        }
      }

      const recovery = recoveryAuthorization
        ? {
            ...recoveryAuthorization,
            reviewEvidenceArtifacts: await loadReviewEvidenceArtifacts({
              dependencies,
              producer: packet.producer,
              findingSet: recoveryAuthorization.findingSet,
            }),
          }
        : undefined;

      const sourceBefore = await dependencies.captureSource(input.worktree);
      if (recovery && !sameRevision(sourceBefore, recovery.dispatch.sourceRevision)) {
        throw new V3ImplementationAttemptError(
          "V3_RECOVERY_SOURCE_REVISION_MISMATCH",
          `Recovery worktree source differs from dispatch ${recovery.dispatch.dispatchId}`,
        );
      }
      const pathById = new Map(packet.buildTopology.pathBindings.map((binding) => [binding.id, binding]));
      const grantById = new Map(packet.buildTopology.sharedGrants.map((grant) => [grant.id, grant]));
      const requiredPathRefs = new Set(story.ownedPathRefs);
      for (const grantRef of story.sharedGrantRefs) {
        const grant = grantById.get(grantRef);
        if (!grant) {
          throw new V3ImplementationAttemptError(
            "V3_SLICE_SHARED_GRANT_MISSING",
            `Story ${story.id} references absent topology grant ${grantRef}`,
          );
        }
        grant.pathRefs.forEach((pathRef) => requiredPathRefs.add(pathRef));
      }
      const fileSnapshots: Record<string, { presence: "present" | "absent"; contentHash: string }> = {};
      for (const pathRef of [...requiredPathRefs].sort()) {
        const binding = pathById.get(pathRef);
        if (!binding) {
          throw new V3ImplementationAttemptError(
            "V3_SLICE_PATH_BINDING_MISSING",
            `Story ${story.id} references absent topology path ${pathRef}`,
          );
        }
        fileSnapshots[pathRef] = sourceFileSnapshot(input.worktree, binding.path);
      }
      const sourceAfterSnapshot = await dependencies.captureSource(input.worktree);
      if (!sameRevision(sourceBefore, sourceAfterSnapshot)) {
        throw new V3ImplementationAttemptError(
          "V3_SLICE_SOURCE_CHANGED_DURING_CAPTURE",
          `Worktree ${input.worktree} changed while the implementation slice was captured`,
        );
      }

      const dependencySignatures = await dependencies.readDependencies({
        runId: input.runId,
        stepId: input.stepId,
        packetHash: packet.packetHash,
        storyIds: story.dependsOn,
        sourceWorktree: input.worktree,
        requiredFiles: Object.fromEntries(story.dependsOn.map((dependencyStoryId) => {
          const owner = packet.buildTopology.owners.find(
            (candidate) => candidate.kind === "story" && candidate.storyRef === dependencyStoryId,
          );
          const files = owner
            ? story.sharedGrantRefs.flatMap((grantRef) => {
              const grant = grantById.get(grantRef);
              if (!grant || grant.fromOwnerRef !== owner.id) return [];
              return grant.pathRefs.flatMap((pathRef) => {
                const binding = pathById.get(pathRef);
                return binding ? [{ pathRef, path: binding.path }] : [];
              });
            })
            : [];
          return [
            dependencyStoryId,
            [...new Map(files.map((file) => [file.pathRef, file])).values()]
              .sort((left, right) => left.pathRef.localeCompare(right.pathRef)),
          ];
        })),
      });
      const compiled = compileImplementationSlice({
        packetHash: packet.packetHash,
        packet: packet.packet,
        productSpec: packet.productSpec,
        designGraph: packet.designGraph,
        buildTopology: packet.buildTopology,
        storyPlan: packet.storyPlan,
        storyId: input.storyId,
        sourceRevision: sourceBefore,
        producer: packet.producer,
        fileSnapshots,
        dependencySignatures,
        runtimeEvidence: runtimeEvidenceProduction.contract,
        ...(recovery && !recoveryEvidenceOnly
          ? {
              recovery: {
                schema: "setfarm.implementation-recovery-directive.v1" as const,
                recoveryCaseRevisionId: recovery.revision.revisionId,
                recoveryDispatchId: recovery.dispatch.dispatchId,
                dispatchClass: recovery.dispatch.dispatchClass as "product_implementation" | "supervisor_repair",
                findingSetHash: recovery.findingSet.findingSetHash,
                findingIds: recovery.revision.findingIds,
                contractSliceHash: recovery.revision.contractSliceHash,
                sourceRevision: {
                  baseSha: recovery.revision.sourceRevision.sha,
                  treeHash: recovery.revision.sourceRevision.treeHash,
                },
                expectedDelta: recovery.revision.expectedDelta,
                allowedPaths: recovery.revision.allowedPaths,
                ...(recovery.revision.evidencePlanArtifactHash
                  ? { evidencePlanArtifactHash: recovery.revision.evidencePlanArtifactHash }
                  : {}),
              },
            }
          : {}),
      });
      if (compiled.status !== "compiled" || !compiled.slice || !compiled.sliceHash || !compiled.envelope) {
        throw new V3ImplementationAttemptError(
          "V3_SLICE_COMPILATION_REJECTED",
          compilerRejectionMessage(compiled),
        );
      }
      const evidencePlan = compileEvidencePlanV1({
        slice: compiled.slice,
        sliceHash: compiled.sliceHash,
      });
      const planEnvelope = evidencePlanEnvelope(packet, evidencePlan);
      const expectedPlanArtifactHash = hashCanonicalJson(planEnvelope);
      if (!recoveryEvidenceOnly && !downstreamEvidence) {
        // Refuse before CAS publication and attempt reservation. The unknown
        // durable IDs use their schema maxima, so any later real handoff is no
        // larger than this exact pretty-serialized context estimate.
        const attemptClass = recovery?.dispatch.dispatchClass ?? "product_implementation";
        const executionAuthority = attemptClass === "supervisor_repair"
          ? { role: "supervisor" as const, attemptClass: "supervisor_repair" as const }
          : { role: "developer" as const, attemptClass: "product_implementation" as const };
        try {
          const capacityHandoff = createV3ImplementationClaimHandoffV1({
            schema: "setfarm.v3-implementation-claim-handoff.v1",
            protocol: "v3",
            runId: input.runId,
            stepId: "S".repeat(500),
            storyId: input.storyId,
            storyDbId: "D".repeat(500),
            claimId: input.claimId!,
            attemptId: `ATT_${"A".repeat(160)}`,
            attemptGeneration: Number.MAX_SAFE_INTEGER,
            branch: input.branch,
            workdir: input.worktree,
            packetHash: packet.packetHash,
            compilationReportHash: packet.refs.compilationReport,
            sliceHash: compiled.sliceHash,
            sliceRef: sliceRefKey(input.storyId, compiled.sliceHash),
            evidencePlanHash: evidencePlan.planHash,
            evidencePlanArtifactHash: expectedPlanArtifactHash,
            evidencePlanRef: evidencePlanRefKey(input.storyId, expectedPlanArtifactHash),
            executionAuthority,
            sourceBefore,
            artifactProducer: packet.producer,
            implementationSlice: compiled.slice,
            evidencePlan,
            ...(recovery
              ? {
                  findingSet: recovery.findingSet,
                  reviewEvidenceArtifacts: [...recovery.reviewEvidenceArtifacts],
                }
              : {}),
          });
          createV3ImplementationContextV1({ handoff: capacityHandoff });
        } catch (error) {
          if (error instanceof V3ImplementationContextCapacityError) {
            throw new V3ImplementationAttemptError(
              "V3_IMPLEMENTATION_CONTEXT_CAPACITY_EXCEEDED",
              error.message,
            );
          }
          throw error;
        }
      }
      const publication = await dependencies.publish(compiled.envelope);
      if (publication.hash !== compiled.sliceHash) {
        throw new V3ImplementationAttemptError(
          "V3_SLICE_PUBLICATION_HASH_MISMATCH",
          `CAS published ${publication.hash}, compiler produced ${compiled.sliceHash}`,
        );
      }
      const planPublication = await dependencies.publish(planEnvelope);
      if (planPublication.hash !== expectedPlanArtifactHash) {
        throw new V3ImplementationAttemptError(
          "V3_EVIDENCE_PLAN_PUBLICATION_HASH_MISMATCH",
          `CAS published ${planPublication.hash}, evidence planner produced ${expectedPlanArtifactHash}`,
        );
      }
      const refKey = sliceRefKey(input.storyId, publication.hash);
      const planRefKey = evidencePlanRefKey(input.storyId, planPublication.hash);
      await dependencies.addRunRef({
        runId: input.runId,
        refKey,
        artifactHash: publication.hash,
      });
      await dependencies.addRunRef({
        runId: input.runId,
        refKey: planRefKey,
        artifactHash: planPublication.hash,
      });

      const durableEvidenceRefs = [
        `setfarm://artifact/${packet.packetHash}`,
        `setfarm://artifact/${packet.refs.compilationReport}`,
        `setfarm://artifact/${publication.hash}`,
        `setfarm://artifact/${planPublication.hash}`,
        ...(recovery
          ? [
              `setfarm://finding-set/${recovery.findingSet.findingSetHash}`,
              `setfarm://recovery-revision/${recovery.revision.revisionId}`,
              `setfarm://recovery-dispatch/${recovery.dispatch.dispatchId}`,
              ...recovery.reviewEvidenceArtifacts.map(
                (artifact) => `setfarm://artifact/${artifact.artifactHash}`,
              ),
            ]
          : []),
      ];
      const reservation = recoveryEvidenceOnly
        ? await dependencies.reserveEvidenceOnlyAttempt!({
            lease: input.evidenceOnlyLease!,
            prepared: {
              compilationReportHash: packet.refs.compilationReport,
              sliceHash: publication.hash,
              sliceRefKey: refKey,
              evidencePlanArtifactHash: planPublication.hash,
              evidencePlanRefKey: planRefKey,
              worktree: input.worktree,
              ...(input.branch ? { branch: input.branch } : {}),
              role: input.role,
              agentId: input.agentId,
              evidenceRefs: durableEvidenceRefs,
            },
          })
        : downstreamEvidence
          ? await dependencies.reserveDownstreamEvidenceAttempt!({
              authority: input.downstreamEvidenceAuthority!,
              prepared: {
                runId: input.runId,
                stepId: input.stepId as "qa-test" | "final-test",
                storyId: input.storyId,
                attemptClass: "evidence_only",
                packetHash: packet.packetHash,
                compilationReportHash: packet.refs.compilationReport,
                sliceHash: publication.hash,
                sourceBefore,
                role: "downstream-evidence-orchestrator",
                agentId: "setfarm-downstream-evidence-orchestrator",
                ...(input.branch ? { branch: input.branch } : {}),
                worktree: input.worktree,
                evidenceRefs: durableEvidenceRefs,
              },
            })
          : await dependencies.reserveAttempt({
            claimId: input.claimId!,
            runId: input.runId,
            stepId: input.stepId,
            storyId: input.storyId,
            attemptClass: recovery?.dispatch.dispatchClass ?? "product_implementation",
            packetHash: packet.packetHash,
            compilationReportHash: packet.refs.compilationReport,
            sliceHash: publication.hash,
            sourceBefore,
            ...(recovery
              ? {
                  findingSetHash: recovery.findingSet.findingSetHash,
                  recoveryCaseRevisionId: recovery.revision.revisionId,
                  recoveryDispatchId: recovery.dispatch.dispatchId,
                  recoveryDeliveryLease: {
                    ownerInstanceId: input.recoveryDelivery!.ownerInstanceId,
                    leaseToken: input.recoveryDelivery!.leaseToken,
                  },
                }
              : input.findingSetHash ? { findingSetHash: input.findingSetHash } : {}),
            role: input.role,
            agentId: input.agentId,
            branch: input.branch,
            worktree: input.worktree,
            evidenceRefs: [
              `setfarm://claim-log/${input.claimId!}`,
              ...durableEvidenceRefs,
            ],
            });
      const replayableDownstreamAttempt = downstreamEvidence
        && reservation.status === "duplicate"
        && !["claimed", "running", "superseded"].includes(reservation.attempt.disposition);
      if (reservation.status !== "reserved" && !replayableDownstreamAttempt) {
        throw new V3ImplementationAttemptError(
          reservation.status === "duplicate"
            ? "V3_ATTEMPT_DUPLICATE_UNCHANGED_SOURCE"
            : "V3_ATTEMPT_ACTIVE_CONFLICT",
          `Attempt reservation for ${input.runId}/${input.storyId} returned ${reservation.status}`,
        );
      }
      if (
        reservation.attempt.packetHash !== packet.packetHash
        || reservation.attempt.sliceHash !== publication.hash
        || reservation.attempt.compilationReportHash !== packet.refs.compilationReport
        || !sameRevision(reservation.attempt.sourceBefore, sourceBefore)
        || (downstreamEvidence && reservation.attempt.attemptClass !== "evidence_only")
      ) {
        throw new V3ImplementationAttemptError(
          "V3_ATTEMPT_RESERVATION_BINDING_MISMATCH",
          `Reserved attempt ${reservation.attempt.attemptId} does not equal the compiled slice identity`,
        );
      }
      return {
        attempt: reservation.attempt,
        artifactProducer: packet.producer,
        slice: compiled.slice,
        sliceHash: publication.hash,
        sliceRefKey: refKey,
        evidencePlan,
        evidencePlanArtifactHash: planPublication.hash,
        evidencePlanRefKey: planRefKey,
        packetHash: packet.packetHash,
        compilationReportHash: packet.refs.compilationReport,
        sourceBefore,
        ...(recovery ? { recovery } : {}),
      };
    },

    async loadAttemptContext(input: Readonly<{
      runId: string;
      storyId: string;
      attemptId: string;
    }>): Promise<V3ImplementationAttemptResult> {
      const [packet, attempt] = await Promise.all([
        dependencies.readPacket(input.runId),
        dependencies.findAttempt(input.attemptId),
      ]);
      if (!attempt || attempt.runId !== input.runId || attempt.storyId !== input.storyId) {
        throw new V3ImplementationAttemptError(
          "V3_ATTEMPT_CONTEXT_IDENTITY_MISMATCH",
          `Attempt ${input.attemptId} does not own ${input.runId}/${input.storyId}`,
        );
      }
      if (!attempt.sliceHash || attempt.packetHash !== packet.packetHash) {
        throw new V3ImplementationAttemptError(
          "V3_ATTEMPT_CONTEXT_PACKET_MISMATCH",
          `Attempt ${input.attemptId} is not bound to the run's sealed packet and slice`,
        );
      }
      const envelope = await dependencies.readArtifact(attempt.sliceHash);
      if (
        envelope.artifactType !== "setfarm.implementation-slice.v1"
        || canonicalJsonStringify(envelope.producer) !== canonicalJsonStringify(packet.producer)
      ) {
        throw new V3ImplementationAttemptError(
          "V3_ATTEMPT_CONTEXT_ARTIFACT_MISMATCH",
          `Attempt ${input.attemptId} slice artifact identity is invalid`,
        );
      }
      const slice = ImplementationSliceV1Schema.parse(envelope.payload);
      if (
        slice.packetHash !== packet.packetHash
        || slice.storyId !== input.storyId
        || slice.sourceRevision.baseSha !== attempt.sourceBefore.sha
        || slice.sourceRevision.treeHash !== attempt.sourceBefore.treeHash
      ) {
        throw new V3ImplementationAttemptError(
          "V3_ATTEMPT_CONTEXT_SLICE_MISMATCH",
          `Attempt ${input.attemptId} slice payload differs from the attempt fence`,
        );
      }
      const evidencePlan = compileEvidencePlanV1({ slice, sliceHash: attempt.sliceHash });
      const planEnvelope = evidencePlanEnvelope(packet, evidencePlan);
      const planArtifactHash = hashCanonicalJson(planEnvelope);
      const storedPlanEnvelope = await dependencies.readArtifact(planArtifactHash);
      if (canonicalJsonStringify(storedPlanEnvelope) !== canonicalJsonStringify(planEnvelope)) {
        throw new V3ImplementationAttemptError(
          "V3_ATTEMPT_CONTEXT_EVIDENCE_PLAN_MISMATCH",
          `Attempt ${input.attemptId} evidence plan artifact differs from the exact slice-derived plan`,
        );
      }
      const recoveryAuthorization = attempt.recoveryDispatchId && attempt.recoveryCaseRevisionId
        ? await dependencies.readRecovery?.({
            dispatchId: attempt.recoveryDispatchId,
            revisionId: attempt.recoveryCaseRevisionId,
          })
        : undefined;
      const recovery = recoveryAuthorization
        ? {
            ...recoveryAuthorization,
            reviewEvidenceArtifacts: await loadReviewEvidenceArtifacts({
              dependencies,
              producer: packet.producer,
              findingSet: recoveryAuthorization.findingSet,
            }),
          }
        : undefined;
      if (attempt.recoveryDispatchId) {
        const evidenceOnlyAttempt = attempt.attemptClass === "evidence_only";
        if (
          !recovery
          || (evidenceOnlyAttempt
            ? slice.recovery !== undefined || recovery.dispatch.dispatchClass !== "evidence_only"
            : slice.recovery?.recoveryDispatchId !== attempt.recoveryDispatchId
              || slice.recovery.recoveryCaseRevisionId !== attempt.recoveryCaseRevisionId
              || slice.recovery.dispatchClass !== recovery.dispatch.dispatchClass)
          || recovery.dispatch.findingSetHash !== attempt.findingSetHash
          || recovery.dispatch.packetHash !== attempt.packetHash
          || recovery.dispatch.sourceRevision.sha !== attempt.sourceBefore.sha
          || recovery.dispatch.sourceRevision.treeHash !== attempt.sourceBefore.treeHash
        ) {
          throw new V3ImplementationAttemptError(
            "V3_ATTEMPT_CONTEXT_RECOVERY_MISMATCH",
            `Attempt ${input.attemptId} recovery authorization differs from its durable attempt fence`,
          );
        }
        if (!evidenceOnlyAttempt && recovery) {
          const authority = modelRecoveryExecutionAuthority(
            recovery.dispatch.dispatchClass as "product_implementation" | "supervisor_repair",
          );
          if (
            attempt.attemptClass !== recovery.dispatch.dispatchClass
            || attempt.role !== authority.role
            || recovery.revision.owner !== authority.owner
          ) {
            throw new V3ImplementationAttemptError(
              "V3_ATTEMPT_CONTEXT_EXECUTION_AUTHORITY_MISMATCH",
              `Attempt ${input.attemptId} role is not authorized by its recovery dispatch`,
            );
          }
        }
      }
      return {
        attempt,
        artifactProducer: packet.producer,
        slice,
        sliceHash: attempt.sliceHash,
        sliceRefKey: sliceRefKey(input.storyId, attempt.sliceHash),
        evidencePlan,
        evidencePlanArtifactHash: planArtifactHash,
        evidencePlanRefKey: evidencePlanRefKey(input.storyId, planArtifactHash),
        packetHash: packet.packetHash,
        compilationReportHash: packet.refs.compilationReport,
        sourceBefore: attempt.sourceBefore,
        ...(recovery ? { recovery } : {}),
      };
    },
  });
}

let defaultCompiler: ReturnType<typeof createV3ImplementationAttemptCompiler> | undefined;

function createDefaultCompiler() {
  const sql = getSql();
  const reader = createRuntimeArtifactReader({
    sql,
    artifactRoot: resolveProductArtifactDir(),
    artifactLimits: resolveProductArtifactCapacity(),
  });
  const publisher = new IndexedArtifactPublisher({
    index: reader.index,
    store: reader.store,
    ownerInstanceId: `v3-slice-compiler:${process.pid}`,
  });
  const attempts = createAttemptRepository(sql);
  const evidenceOnlyPublication = createV3EvidenceOnlyPublication(sql);
  const downstreamEvidencePublication = createV3DownstreamEvidencePublication(sql);
  const recoveryDeliveries = createRecoveryDeliveryRepository(sql);
  const findingRecovery = createFindingRecoveryRepository(sql);
  return createV3ImplementationAttemptCompiler({
    readPacket: (runId) => reader.readSealedPacket(runId),
    publish: (envelope) => publisher.put(envelope),
    addRunRef: (input) => reader.index.addRunArtifactRef(input),
    reserveAttempt: (input) => attempts.reserve(input),
    reserveEvidenceOnlyAttempt: async ({ lease, prepared }) => ({
      status: "reserved" as const,
      attempt: await evidenceOnlyPublication.reserve(lease, prepared),
    }),
    reserveDownstreamEvidenceAttempt: ({ authority, prepared }) =>
      downstreamEvidencePublication.reserve(authority, prepared),
    findAttempt: (attemptId) => attempts.findById(attemptId),
    readArtifact: async (hash) => {
      const [indexed, stored] = await Promise.all([
        reader.index.getArtifact(hash),
        reader.store.get(hash),
      ]);
      if (
        !indexed
        || indexed.artifactType !== stored.envelope.artifactType
        || indexed.byteLength !== stored.bytes.byteLength
        || canonicalJsonStringify(indexed.producer) !== canonicalJsonStringify(stored.envelope.producer)
      ) {
        throw new V3ImplementationAttemptError(
          "V3_ATTEMPT_CONTEXT_INDEX_MISMATCH",
          `Artifact ${hash} differs between the immutable index and CAS`,
        );
      }
      return stored.envelope;
    },
    captureSource: (worktree) => captureShadowSourceRevision(worktree),
    readDependencies: async (input) => {
      const result: Record<string, DependencySignature> = {};
      for (const storyId of input.storyIds) {
        const rows = await sql.unsafe<Array<{
          slice_hash: string | null;
          output_hash: string | null;
          source_after_sha: string | null;
          source_after_tree_hash: string | null;
        }>>(
          `SELECT slice_hash, output_hash, source_after_sha, source_after_tree_hash
             FROM execution_attempts
            WHERE run_id = $1
              AND step_id = $2
              AND story_id = $3
              AND packet_hash = $4
              AND attempt_class IN ('product_implementation', 'supervisor_repair')
              AND disposition IN ('produced_delta', 'already_satisfied', 'verified')
              AND slice_hash IS NOT NULL
            ORDER BY generation DESC
            LIMIT 1`,
          [input.runId, input.stepId, storyId, input.packetHash],
        );
        const row = rows[0];
        if (!row?.slice_hash || !row.source_after_sha || !row.source_after_tree_hash) {
          throw new V3ImplementationAttemptError(
            "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING",
            `Dependency ${storyId} has no terminal packet-bound implementation attempt`,
          );
        }
        result[storyId] = {
          sliceHash: row.slice_hash,
          ...(row.output_hash ? { outputHash: row.output_hash } : {}),
          sourceAfter: {
            baseSha: row.source_after_sha,
            treeHash: row.source_after_tree_hash,
          },
          fileSignatures: captureDependencyFileSignatures({
            sourceWorktree: input.sourceWorktree,
            commitSha: row.source_after_sha,
            files: input.requiredFiles[storyId] ?? [],
          }),
        };
      }
      return result;
    },
    readRecovery: async (input) => {
      const [revision, dispatch] = await Promise.all([
        recoveryDeliveries.findRevision(input.revisionId),
        recoveryDeliveries.findDispatch(input.dispatchId),
      ]);
      if (!revision || !dispatch || dispatch.revisionId !== revision.revisionId) {
        throw new V3ImplementationAttemptError(
          "V3_RECOVERY_AUTHORIZATION_NOT_FOUND",
          `Recovery dispatch ${input.dispatchId}/${input.revisionId} is unavailable`,
        );
      }
      const findingSet = await findingRecovery.findFindingSet(dispatch.findingSetHash);
      if (!findingSet) {
        throw new V3ImplementationAttemptError(
          "V3_RECOVERY_FINDING_SET_NOT_FOUND",
          `Recovery finding set ${dispatch.findingSetHash} is unavailable`,
        );
      }
      return { revision, dispatch, findingSet };
    },
  });
}

function runtimeCompiler() {
  defaultCompiler ??= createDefaultCompiler();
  return defaultCompiler;
}

export function reserveV3ImplementationAttempt(
  input: V3ImplementationAttemptInput,
): Promise<V3ImplementationAttemptResult> {
  return runtimeCompiler().reserve(input);
}

export function reserveV3EvidenceOnlyImplementationAttempt(input: Readonly<{
  lease: V3EvidenceOnlyPublicationLeaseV1;
  worktree: string;
  branch: string;
}>): Promise<V3ImplementationAttemptResult> {
  return runtimeCompiler().reserve({
    runId: input.lease.runId,
    stepId: "implement",
    storyId: input.lease.storyId,
    role: "evidence-orchestrator",
    agentId: "setfarm-evidence-orchestrator",
    branch: input.branch,
    worktree: input.worktree,
    recoveryDelivery: {
      dispatchId: input.lease.dispatchId,
      revisionId: input.lease.revisionId,
      ownerInstanceId: input.lease.ownerInstanceId,
      leaseToken: input.lease.leaseToken,
    },
    evidenceOnlyLease: input.lease,
  });
}

export function reserveV3DownstreamEvidenceAttempt(input: Readonly<{
  authority: V3DownstreamEvidenceAuthorityV1;
  worktree: string;
  branch: string;
}>): Promise<V3ImplementationAttemptResult> {
  return runtimeCompiler().reserve({
    runId: input.authority.runId,
    stepId: input.authority.workflowStepId,
    storyId: input.authority.storyId,
    role: "downstream-evidence-orchestrator",
    agentId: "setfarm-downstream-evidence-orchestrator",
    branch: input.branch,
    worktree: input.worktree,
    downstreamEvidenceAuthority: input.authority,
  });
}

export function loadV3ImplementationAttemptContext(input: Readonly<{
  runId: string;
  storyId: string;
  attemptId: string;
}>): Promise<V3ImplementationAttemptResult> {
  return runtimeCompiler().loadAttemptContext(input);
}
