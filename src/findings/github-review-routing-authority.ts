import { z } from "zod";

import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";
import {
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  Sha256Schema,
  StoryIdSchema,
} from "../product-compiler/schemas/common-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);

/**
 * Exact operational authority held by the v3 verify step when a current
 * unresolved GitHub review thread is routed into bounded supervisor repair.
 * Comment prose is deliberately absent: it is carried only by the immutable
 * semantic evidence artifact named here.
 */
export const V3GithubReviewDispatchAuthorityV1Schema = z.object({
  schema: z.literal("setfarm.v3-github-review-dispatch-authority.v1"),
  runId: BoundedIdentitySchema,
  verifyStepDbId: BoundedIdentitySchema,
  workflowStepId: z.literal("verify"),
  parentClaimId: z.number().int().positive(),
  storyId: StoryIdSchema,
  storyDbId: BoundedIdentitySchema,
  packetHash: Sha256Schema,
  implementationAttemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  contractSliceHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  reviews: z.array(z.object({
    evidenceArtifactHash: Sha256Schema,
    repositoryNodeId: z.string().min(1).max(500),
    prNumber: z.number().int().positive(),
    threadId: z.string().min(1).max(500),
    commentId: z.string().min(1).max(500).optional(),
    headSha: GitObjectHashSchema,
    bodyRevisionHash: Sha256Schema,
    path: NormalizedRelativeLocatorSchema,
    sourceContentHash: Sha256Schema,
  }).strict()).min(1).max(100),
}).strict().superRefine((value, context) => {
  const threadIds = value.reviews.map((review) => review.threadId);
  const artifactHashes = value.reviews.map((review) => review.evidenceArtifactHash);
  if (
    new Set(threadIds).size !== threadIds.length
    || new Set(artifactHashes).size !== artifactHashes.length
    || value.reviews.some((review, index) => index > 0 && review.threadId < value.reviews[index - 1]!.threadId)
  ) {
    context.addIssue({
      code: "custom",
      path: ["reviews"],
      message: "Review authorities must be unique and canonically ordered by thread",
    });
  }
  value.reviews.forEach((review, index) => {
    if (review.headSha !== value.sourceRevision.sha) {
      context.addIssue({
        code: "custom",
        path: ["reviews", index, "headSha"],
        message: "Every review head must equal the exact implementation source revision",
      });
    }
  });
});

export type V3GithubReviewDispatchAuthorityV1 = z.infer<
  typeof V3GithubReviewDispatchAuthorityV1Schema
>;
