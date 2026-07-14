import { z } from "zod";

import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";
import {
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
  StoryIdSchema,
} from "../product-compiler/schemas/common-v1.js";
import {
  createFindingSetV1,
  type FindingSetV1,
} from "./finding-set.js";

const BoundedIdentitySchema = z.string().min(1).max(500);

/**
 * Exact metadata already selected as actionable by the GitHub review boundary.
 * Deliberately excludes comment prose: this adapter records an unstructured
 * review input and never derives a product invariant from natural language.
 */
export const GithubActionableReviewCommentV1Schema = z
  .object({
    repositoryNodeId: z.string().min(1).max(500),
    prNumber: z.number().int().positive(),
    threadId: z.string().min(1).max(500),
    commentId: z.string().min(1).max(500),
    headSha: GitObjectHashSchema,
    bodyRevisionHash: Sha256Schema,
    currentSource: z
      .object({
        path: NormalizedRelativeLocatorSchema,
        contentHash: Sha256Schema,
      })
      .strict(),
  })
  .strict();

export type GithubActionableReviewCommentV1 = z.infer<
  typeof GithubActionableReviewCommentV1Schema
>;

export const GithubReviewFindingSetInputV1Schema = z
  .object({
    schema: z.literal("setfarm.github-review-finding-input.v1"),
    runId: BoundedIdentitySchema,
    storyId: StoryIdSchema,
    packetHash: Sha256Schema,
    sliceHash: Sha256Schema,
    sourceRevision: SourceRevisionV1Schema,
    evidenceArtifactHash: Sha256Schema,
    comment: GithubActionableReviewCommentV1Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.comment.headSha !== value.sourceRevision.sha) {
      context.addIssue({
        code: "custom",
        path: ["comment", "headSha"],
        message: "GitHub review head must equal the current source revision",
      });
    }
  });

export type GithubReviewFindingSetInputV1 = z.infer<
  typeof GithubReviewFindingSetInputV1Schema
>;

export const GithubReviewFindingSetBatchInputV1Schema = z.object({
  schema: z.literal("setfarm.github-review-finding-set-input.v1"),
  runId: BoundedIdentitySchema,
  storyId: StoryIdSchema,
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  reviews: z.array(z.object({
    evidenceArtifactHash: Sha256Schema,
    comment: GithubActionableReviewCommentV1Schema,
  }).strict()).min(1).max(100),
}).strict().superRefine((value, context) => {
  const threadIds = value.reviews.map((review) => review.comment.threadId);
  const artifactHashes = value.reviews.map((review) => review.evidenceArtifactHash);
  if (new Set(threadIds).size !== threadIds.length || new Set(artifactHashes).size !== artifactHashes.length) {
    context.addIssue({
      code: "custom",
      path: ["reviews"],
      message: "Review threads and evidence artifacts must be unique",
    });
  }
  value.reviews.forEach((review, index) => {
    if (review.comment.headSha !== value.sourceRevision.sha) {
      context.addIssue({
        code: "custom",
        path: ["reviews", index, "comment", "headSha"],
        message: "Every GitHub review head must equal the current source revision",
      });
    }
  });
});

export function ingestGithubReviewThreadsV1(input: unknown): FindingSetV1 {
  const exact = GithubReviewFindingSetBatchInputV1Schema.parse(input);

  return createFindingSetV1({
    runId: exact.runId,
    storyId: exact.storyId,
    packetHash: exact.packetHash,
    sliceHash: exact.sliceHash,
    sourceRevision: exact.sourceRevision,
    findings: exact.reviews.map((review) => ({
      origin: "review" as const,
      classification: "unstructured_review" as const,
      externalRef: {
        platform: "github" as const,
        repositoryNodeId: review.comment.repositoryNodeId,
        prNumber: review.comment.prNumber,
        threadId: review.comment.threadId,
        commentId: review.comment.commentId,
        headSha: review.comment.headSha,
        commentRevisionHash: review.comment.bodyRevisionHash,
      },
      invariantRef: "INV_UNSTRUCTURED_REVIEW",
      sourceLocators: [review.comment.currentSource],
      observedEvidenceRefs: [review.evidenceArtifactHash],
      status: "open" as const,
    })),
  });
}

export function ingestGithubReviewCommentV1(input: unknown): FindingSetV1 {
  const exact = GithubReviewFindingSetInputV1Schema.parse(input);
  return ingestGithubReviewThreadsV1({
    schema: "setfarm.github-review-finding-set-input.v1",
    runId: exact.runId,
    storyId: exact.storyId,
    packetHash: exact.packetHash,
    sliceHash: exact.sliceHash,
    sourceRevision: exact.sourceRevision,
    reviews: [{
      evidenceArtifactHash: exact.evidenceArtifactHash,
      comment: exact.comment,
    }],
  });
}
