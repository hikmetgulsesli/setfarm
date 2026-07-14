import type postgres from "postgres";
import { z } from "zod";

import {
  EvidenceBundleV2Schema,
  computeEvidenceBundleHash,
  type EvidenceBundleV2,
} from "../evidence/evidence-bundle-v2.js";
import {
  loadV3ImplementationAttemptContext,
  type V3ImplementationAttemptResult,
} from "../execution/v3-implementation-attempt.js";
import { FindingSetV1Schema, type FindingSetV1 } from "../findings/finding-set.js";
import {
  GithubReviewResolutionObservationAuthorityV1Schema,
  type GithubReviewResolutionEvidenceV1,
  type GithubReviewResolutionObservationAuthorityV1,
} from "../findings/github-review-resolution-evidence.js";
import { createGithubReviewResolutionEvidenceRepository } from "../findings/github-review-resolution-evidence-repository.js";
import {
  createDefaultGithubReviewSourcePort,
  createGithubReviewSource,
} from "../findings/github-review-source.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  RuntimeCompletionContinuationV1Schema,
  RuntimeCompletionPlanDescriptorV1Schema,
  RuntimeCompletionSubjectV1Schema,
  type RuntimeCompletionPlanDescriptorV1,
} from "../execution/schemas/runtime-completion-plan-v1.js";
import { createFindingRecoveryRepository } from "./finding-recovery-repository.js";
import {
  createV3RecoveryCoordinator,
  type V3GithubReviewResolutionCoordinatorResult,
  type V3RecoveryCoordinatorResult,
} from "./v3-recovery-coordinator.js";

type Sql = postgres.Sql;

const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);

export const V3RecoveryEffectPayloadV1Schema = z.object({
  schema: z.literal("setfarm.v3-recovery-effect.v1"),
  runId: z.string().min(1).max(500),
  storyId: z.string().min(1).max(500),
  attemptId: AttemptIdSchema,
  sliceHash: Sha256Schema,
  evidencePlanArtifactHash: Sha256Schema,
  evidenceBundleHash: Sha256Schema,
  findingSetHash: Sha256Schema.optional(),
  failureClass: z.enum(["product", "infrastructure"]).optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.findingSetHash) !== Boolean(value.failureClass)) {
    context.addIssue({
      code: "custom",
      path: ["findingSetHash"],
      message: "findingSetHash and failureClass must be present or absent together",
    });
  }
});

export type V3RecoveryEffectPayloadV1 = z.infer<typeof V3RecoveryEffectPayloadV1Schema>;

export function classifyV3EvidenceFailure(
  raw: EvidenceBundleV2,
): "product" | "infrastructure" | undefined {
  const bundle = EvidenceBundleV2Schema.parse(raw);
  if (bundle.aggregateVerdict === "pass") return undefined;
  if (bundle.aggregateVerdict === "incomplete") {
    throw new Error("V3_RECOVERY_EFFECT_INCOMPLETE_EVIDENCE_FORBIDDEN");
  }
  // A fail is an observed counterexample to a sealed predicate. An
  // inconclusive result means the evidence plane could not decide and is owned
  // by bounded non-model recovery, never by speculative product edits.
  return bundle.aggregateVerdict === "fail" ? "product" : "infrastructure";
}

function sameRevision(
  left: Readonly<{ sha: string; treeHash: string }>,
  right: Readonly<{ sha: string; treeHash: string }>,
): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

function assertFindingIdentity(input: Readonly<{
  findingSet: FindingSetV1;
  bundle: EvidenceBundleV2;
  bundleHash: string;
}>): void {
  const { findingSet, bundle, bundleHash } = input;
  if (
    findingSet.runId !== bundle.runId
    || findingSet.storyId !== bundle.storyId
    || findingSet.packetHash !== bundle.packetHash
    || findingSet.sliceHash !== bundle.sliceHash
    || !sameRevision(findingSet.sourceRevision, bundle.sourceRevision)
    || findingSet.findings.some((finding) => !finding.observedEvidenceRefs.includes(bundleHash))
  ) {
    throw new Error("V3_RECOVERY_EFFECT_FINDING_IDENTITY_MISMATCH");
  }
}

export function createV3RecoveryCompletionPlanDescriptor(input: Readonly<{
  context: V3ImplementationAttemptResult;
  evidenceBundle: EvidenceBundleV2;
  findingSet?: FindingSetV1;
  failureClass?: "product" | "infrastructure";
  continuation: z.input<typeof RuntimeCompletionContinuationV1Schema>;
  subject: z.input<typeof RuntimeCompletionSubjectV1Schema>;
}>): RuntimeCompletionPlanDescriptorV1 {
  const bundle = EvidenceBundleV2Schema.parse(input.evidenceBundle);
  const findingSet = input.findingSet ? FindingSetV1Schema.parse(input.findingSet) : undefined;
  const bundleHash = computeEvidenceBundleHash(bundle);
  if (
    input.context.attempt.attemptId !== bundle.attemptId
    || input.context.attempt.runId !== bundle.runId
    || input.context.attempt.storyId !== bundle.storyId
    || input.context.packetHash !== bundle.packetHash
    || input.context.sliceHash !== bundle.sliceHash
    || input.context.evidencePlanArtifactHash.length !== 64
  ) {
    throw new Error("V3_RECOVERY_EFFECT_CONTEXT_IDENTITY_MISMATCH");
  }
  if (bundle.aggregateVerdict === "pass") {
    if (findingSet || input.failureClass) {
      throw new Error("V3_RECOVERY_EFFECT_PASS_FAILURE_PAYLOAD_FORBIDDEN");
    }
  } else {
    if (bundle.aggregateVerdict === "incomplete" || !findingSet || !input.failureClass) {
      throw new Error("V3_RECOVERY_EFFECT_FAILURE_PAYLOAD_REQUIRED");
    }
    assertFindingIdentity({ findingSet, bundle, bundleHash });
  }
  const payload = V3RecoveryEffectPayloadV1Schema.parse({
    schema: "setfarm.v3-recovery-effect.v1",
    runId: bundle.runId,
    storyId: bundle.storyId,
    attemptId: input.context.attempt.attemptId,
    sliceHash: input.context.sliceHash,
    evidencePlanArtifactHash: input.context.evidencePlanArtifactHash,
    evidenceBundleHash: bundleHash,
    ...(findingSet ? { findingSetHash: findingSet.findingSetHash } : {}),
    ...(input.failureClass ? { failureClass: input.failureClass } : {}),
  });
  const continuation = RuntimeCompletionContinuationV1Schema.parse(input.continuation);
  const subject = RuntimeCompletionSubjectV1Schema.parse(input.subject);
  return RuntimeCompletionPlanDescriptorV1Schema.parse({
    kind: "story_completion",
    continuation,
    subject,
    effects: [{
      effectKey: `v3-recovery/${input.context.attempt.attemptId}`.toLowerCase(),
      ordinal: 0,
      effectType: "v3.recovery.coordinate",
      mandatory: true,
      payload,
    }],
  });
}

export type V3RecoveryEffectDependencies = Readonly<{
  loadAttemptContext(input: Readonly<{
    runId: string;
    storyId: string;
    attemptId: string;
  }>): Promise<V3ImplementationAttemptResult>;
  findEvidenceBundle(hash: string): Promise<EvidenceBundleV2 | undefined>;
  findFindingSet(hash: string): Promise<FindingSetV1 | undefined>;
  coordinate(input: unknown): Promise<V3RecoveryCoordinatorResult>;
  observeGithubReviewResolution?(input: Readonly<{
    authority: GithubReviewResolutionObservationAuthorityV1;
  }>): Promise<GithubReviewResolutionEvidenceV1>;
  putGithubReviewResolution?(evidence: GithubReviewResolutionEvidenceV1): Promise<Readonly<{
    evidence: GithubReviewResolutionEvidenceV1;
  }>>;
  coordinateGithubReviewResolution?(input: Readonly<{
    evidenceHash: string;
  }>): Promise<V3GithubReviewResolutionCoordinatorResult>;
}>;

export type V3RecoveryEffectCoordinateResult =
  | V3RecoveryCoordinatorResult
  | V3GithubReviewResolutionCoordinatorResult;

function sameSourceRevision(
  left: Readonly<{ sha: string; treeHash: string }>,
  right: Readonly<{ sha: string; treeHash: string }>,
): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

export function githubReviewResolutionAuthorityForAttempt(
  context: V3ImplementationAttemptResult,
  evidenceBundle: EvidenceBundleV2,
): GithubReviewResolutionObservationAuthorityV1 | undefined {
  const recovery = context.recovery;
  if (!recovery) return undefined;
  const reviewFindings = recovery.findingSet.findings.filter(
    (finding) => finding.classification === "unstructured_review",
  );
  if (reviewFindings.length === 0) return undefined;
  if (reviewFindings.length !== recovery.findingSet.findings.length) {
    throw new Error("V3_RECOVERY_EFFECT_MIXED_GITHUB_REVIEW_FINDINGS_FORBIDDEN");
  }
  const attempt = context.attempt;
  if (
    recovery.dispatch.dispatchClass !== "supervisor_repair"
    || attempt.attemptClass !== "supervisor_repair"
    || !attempt.sourceAfter
    || ["claimed", "running", "superseded"].includes(attempt.disposition)
    || evidenceBundle.aggregateVerdict !== "pass"
    || !sameSourceRevision(evidenceBundle.sourceRevision, attempt.sourceAfter)
    || !sameSourceRevision(recovery.findingSet.sourceRevision, context.sourceBefore)
  ) {
    throw new Error("V3_RECOVERY_EFFECT_GITHUB_REVIEW_TERMINAL_AUTHORITY_INVALID");
  }
  const artifacts = new Map(recovery.reviewEvidenceArtifacts.map((artifact) => [artifact.artifactHash, artifact]));
  if (artifacts.size !== reviewFindings.length) {
    throw new Error("V3_RECOVERY_EFFECT_GITHUB_REVIEW_ARTIFACT_SET_MISMATCH");
  }
  let repository: Readonly<{ nodeId: string; owner: string; name: string }> | undefined;
  let prNumber: number | undefined;
  const threads = reviewFindings.map((finding) => {
    const external = finding.externalRef;
    const artifactHash = finding.observedEvidenceRefs.length === 1
      ? finding.observedEvidenceRefs[0]
      : undefined;
    const artifact = artifactHash ? artifacts.get(artifactHash) : undefined;
    if (
      !external
      || !artifactHash
      || !artifact
      || artifact.evidence.threadId !== external.threadId
      || artifact.evidence.repository.nodeId !== external.repositoryNodeId
      || artifact.evidence.prNumber !== external.prNumber
      || artifact.evidence.headSha !== external.headSha
      || artifact.evidence.headSha !== recovery.findingSet.sourceRevision.sha
      || artifact.evidence.bodyRevisionHash !== external.commentRevisionHash
    ) {
      throw new Error("V3_RECOVERY_EFFECT_GITHUB_REVIEW_ORIGINAL_AUTHORITY_MISMATCH");
    }
    const currentRepository = artifact.evidence.repository;
    if (
      (repository && (
        repository.nodeId !== currentRepository.nodeId
        || repository.owner !== currentRepository.owner
        || repository.name !== currentRepository.name
      ))
      || (prNumber !== undefined && prNumber !== artifact.evidence.prNumber)
    ) {
      throw new Error("V3_RECOVERY_EFFECT_GITHUB_REVIEW_PR_IDENTITY_MISMATCH");
    }
    repository = currentRepository;
    prNumber = artifact.evidence.prNumber;
    return {
      findingId: finding.findingId,
      threadId: external.threadId,
      originalEvidenceArtifactHash: artifactHash,
      originalBodyRevisionHash: external.commentRevisionHash,
    };
  });
  if (!repository || prNumber === undefined) {
    throw new Error("V3_RECOVERY_EFFECT_GITHUB_REVIEW_AUTHORITY_MISSING");
  }
  return GithubReviewResolutionObservationAuthorityV1Schema.parse({
    schema: "setfarm.github-review-resolution-observation-authority.v1",
    runId: attempt.runId,
    storyId: attempt.storyId,
    packetHash: context.packetHash,
    contractSliceHash: context.sliceHash,
    recoveryCaseId: recovery.revision.recoveryCaseId,
    recoveryCaseRevisionId: recovery.revision.revisionId,
    recoveryDispatchId: recovery.dispatch.dispatchId,
    attemptId: attempt.attemptId,
    findingSetHash: recovery.findingSet.findingSetHash,
    repository,
    prNumber,
    originalHeadSha: recovery.findingSet.sourceRevision.sha,
    originalSourceRevision: recovery.findingSet.sourceRevision,
    observedHeadSha: attempt.sourceAfter.sha,
    observedSourceRevision: attempt.sourceAfter,
    threads,
  });
}

/**
 * Resolve one immutable completion-effect payload into the coordinator's full
 * input. Recovery identity and path authority are loaded from the attempt and
 * revision ledgers; the caller can provide only content-addressed references.
 */
export async function coordinateV3RecoveryEffect(
  raw: unknown,
  dependencies: V3RecoveryEffectDependencies,
): Promise<V3RecoveryEffectCoordinateResult> {
  const payload = V3RecoveryEffectPayloadV1Schema.parse(raw);
  const [context, storedBundle, storedFindingSet] = await Promise.all([
    dependencies.loadAttemptContext({
      runId: payload.runId,
      storyId: payload.storyId,
      attemptId: payload.attemptId,
    }),
    dependencies.findEvidenceBundle(payload.evidenceBundleHash),
    payload.findingSetHash
      ? dependencies.findFindingSet(payload.findingSetHash)
      : Promise.resolve(undefined),
  ]);
  if (!storedBundle) throw new Error("V3_RECOVERY_EFFECT_EVIDENCE_BUNDLE_NOT_FOUND");
  const evidenceBundle = EvidenceBundleV2Schema.parse(storedBundle);
  const bundleHash = computeEvidenceBundleHash(evidenceBundle);
  if (
    bundleHash !== payload.evidenceBundleHash
    || context.attempt.attemptId !== payload.attemptId
    || context.attempt.runId !== payload.runId
    || context.attempt.storyId !== payload.storyId
    || context.sliceHash !== payload.sliceHash
    || context.evidencePlanArtifactHash !== payload.evidencePlanArtifactHash
    || evidenceBundle.attemptId !== payload.attemptId
    || evidenceBundle.runId !== payload.runId
    || evidenceBundle.storyId !== payload.storyId
    || evidenceBundle.packetHash !== context.packetHash
    || evidenceBundle.sliceHash !== context.sliceHash
  ) {
    throw new Error("V3_RECOVERY_EFFECT_DURABLE_IDENTITY_MISMATCH");
  }

  let findingSet: FindingSetV1 | undefined;
  if (evidenceBundle.aggregateVerdict === "pass") {
    if (payload.findingSetHash || payload.failureClass || storedFindingSet) {
      throw new Error("V3_RECOVERY_EFFECT_PASS_FAILURE_PAYLOAD_FORBIDDEN");
    }
  } else {
    if (
      evidenceBundle.aggregateVerdict === "incomplete"
      || !payload.findingSetHash
      || !payload.failureClass
      || !storedFindingSet
    ) {
      throw new Error("V3_RECOVERY_EFFECT_FAILURE_PAYLOAD_REQUIRED");
    }
    findingSet = FindingSetV1Schema.parse(storedFindingSet);
    if (findingSet.findingSetHash !== payload.findingSetHash) {
      throw new Error("V3_RECOVERY_EFFECT_FINDING_HASH_MISMATCH");
    }
    assertFindingIdentity({ findingSet, bundle: evidenceBundle, bundleHash });
  }

  const common = {
    slice: context.slice,
    sliceHash: context.sliceHash,
    evidencePlan: context.evidencePlan,
    evidencePlanArtifactHash: context.evidencePlanArtifactHash,
    evidenceBundle,
    ...(findingSet ? { findingSet } : {}),
    ...(payload.failureClass ? { failureClass: payload.failureClass } : {}),
  };
  if (context.recovery) {
    if (
      context.attempt.recoveryCaseRevisionId !== context.recovery.revision.revisionId
      || context.attempt.recoveryDispatchId !== context.recovery.dispatch.dispatchId
    ) {
      throw new Error("V3_RECOVERY_EFFECT_ATTEMPT_RECOVERY_IDENTITY_MISMATCH");
    }
    const reviewAuthority = githubReviewResolutionAuthorityForAttempt(context, evidenceBundle);
    if (reviewAuthority) {
      if (
        !dependencies.observeGithubReviewResolution
        || !dependencies.putGithubReviewResolution
        || !dependencies.coordinateGithubReviewResolution
      ) {
        throw new Error("V3_RECOVERY_EFFECT_GITHUB_REVIEW_RESOLUTION_OWNER_MISSING");
      }
      const observed = await dependencies.observeGithubReviewResolution({ authority: reviewAuthority });
      const stored = await dependencies.putGithubReviewResolution(observed);
      if (stored.evidence.evidenceHash !== observed.evidenceHash) {
        throw new Error("V3_RECOVERY_EFFECT_GITHUB_REVIEW_RESOLUTION_PUBLICATION_MISMATCH");
      }
      return dependencies.coordinateGithubReviewResolution({ evidenceHash: observed.evidenceHash });
    }
    return dependencies.coordinate({
      kind: "recovery_evidence",
      recoveryCaseId: context.recovery.revision.recoveryCaseId,
      revisionId: context.recovery.revision.revisionId,
      dispatchId: context.recovery.dispatch.dispatchId,
      attemptId: context.attempt.attemptId,
      ...common,
    });
  }
  if (context.attempt.recoveryCaseRevisionId || context.attempt.recoveryDispatchId) {
    throw new Error("V3_RECOVERY_EFFECT_RECOVERY_CONTEXT_MISSING");
  }
  return dependencies.coordinate({ kind: "initial_evidence", ...common });
}

export function createPostgresV3RecoveryEffectHandler(sql: Sql) {
  const findings = createFindingRecoveryRepository(sql);
  const coordinator = createV3RecoveryCoordinator(sql);
  const reviewResolutions = createGithubReviewResolutionEvidenceRepository(sql);
  const github = createGithubReviewSource(createDefaultGithubReviewSourcePort());
  return Object.freeze({
    coordinate: (payload: unknown) => coordinateV3RecoveryEffect(payload, {
      loadAttemptContext: loadV3ImplementationAttemptContext,
      findEvidenceBundle: (hash) => findings.findEvidenceBundle(hash),
      findFindingSet: (hash) => findings.findFindingSet(hash),
      coordinate: (input) => coordinator.coordinate(input),
      observeGithubReviewResolution: (input) => github.readResolution(input),
      putGithubReviewResolution: (evidence) => reviewResolutions.put(evidence),
      coordinateGithubReviewResolution: (input) => coordinator.coordinateGithubReviewResolution(input),
    }),
    payloadFingerprint: (payload: unknown) => hashCanonicalJson(V3RecoveryEffectPayloadV1Schema.parse(payload)),
  });
}
