import { GithubReviewThreadEvidenceV1Schema, type GithubReviewThreadEvidenceV1 } from "../findings/github-review-source.js";
import type { FindingSetV1 } from "../findings/finding-set.js";
import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-store.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type { SemanticArtifactProducerV1 } from "../product-compiler/schemas/common-v1.js";

export type V3ReviewEvidenceArtifact = Readonly<{ artifactHash: string; evidence: GithubReviewThreadEvidenceV1 }>;
export type V3ReviewEvidenceArtifactReader = (hash: string) => Promise<Readonly<{
  artifactType: string; producer: unknown; payload: unknown;
}>>;
type ReviewEvidenceErrorCode = "V3_RECOVERY_REVIEW_EVIDENCE_REF_INVALID"
  | "V3_RECOVERY_REVIEW_EVIDENCE_ARTIFACT_INVALID" | "V3_RECOVERY_REVIEW_EVIDENCE_IDENTITY_MISMATCH";

export class V3ReviewEvidenceArtifactError extends Error {
  constructor(readonly code: ReviewEvidenceErrorCode, message: string) {
    super(message);
    this.name = "V3ReviewEvidenceArtifactError";
  }
}

/** Immutable DATA loader. Neither facade nor any claim/lease authority is imported. */
export async function loadV3ReviewEvidenceArtifactsV1(input: Readonly<{
  readArtifact: V3ReviewEvidenceArtifactReader;
  producer: SemanticArtifactProducerV1;
  findingSet: FindingSetV1;
}>): Promise<readonly V3ReviewEvidenceArtifact[]> {
  const reviewFindings = input.findingSet.findings.filter(
    (finding) => finding.classification === "unstructured_review",
  );
  const artifacts = new Map<string, V3ReviewEvidenceArtifact>();
  for (const finding of reviewFindings) {
    if (finding.observedEvidenceRefs.length !== 1 || !finding.externalRef || finding.sourceLocators.length !== 1) {
      throw new V3ReviewEvidenceArtifactError(
        "V3_RECOVERY_REVIEW_EVIDENCE_REF_INVALID",
        `Review finding ${finding.findingId} must bind one evidence artifact, external identity, and source locator`,
      );
    }
    const artifactHash = finding.observedEvidenceRefs[0]!;
    let stored: Awaited<ReturnType<V3ReviewEvidenceArtifactReader>>;
    let evidence: GithubReviewThreadEvidenceV1;
    try {
      stored = await input.readArtifact(artifactHash);
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
      throw new V3ReviewEvidenceArtifactError(
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
      throw new V3ReviewEvidenceArtifactError(
        "V3_RECOVERY_REVIEW_EVIDENCE_IDENTITY_MISMATCH",
        `Review evidence ${artifactHash} differs from finding ${finding.findingId} or its exact source revision`,
      );
    }
    artifacts.set(artifactHash, { artifactHash, evidence });
  }
  if (artifacts.size !== reviewFindings.length) {
    throw new V3ReviewEvidenceArtifactError(
      "V3_RECOVERY_REVIEW_EVIDENCE_REF_INVALID",
      "Each unstructured review finding must own a distinct immutable evidence artifact",
    );
  }
  return [...artifacts.values()].sort((left, right) => left.artifactHash.localeCompare(right.artifactHash));
}
