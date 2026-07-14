import { z } from "zod";

import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  GitObjectHashSchema,
  Sha256Schema,
  StoryIdSchema,
} from "../product-compiler/schemas/common-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);
const FindingIdSchema = z.string().regex(/^FIND_[a-f0-9]{64}$/);

const GithubRepositoryIdentityV1Schema = z.object({
  nodeId: BoundedIdentitySchema,
  owner: BoundedIdentitySchema,
  name: BoundedIdentitySchema,
}).strict();

const GithubReviewResolutionThreadAuthorityV1Schema = z.object({
  findingId: FindingIdSchema,
  threadId: BoundedIdentitySchema,
  originalEvidenceArtifactHash: Sha256Schema,
  originalBodyRevisionHash: Sha256Schema,
}).strict();

const GithubReviewResolutionThreadEvidenceV1Schema = GithubReviewResolutionThreadAuthorityV1Schema.extend({
  status: z.enum(["RESOLVED", "OUTDATED"]),
}).strict();

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalThreads<T extends Readonly<{ threadId: string }>>(threads: readonly T[]): T[] {
  return [...threads].sort((left, right) => lexical(left.threadId, right.threadId));
}

function validateCanonicalThreads(
  threads: readonly Readonly<{
    findingId: string;
    threadId: string;
    originalEvidenceArtifactHash: string;
  }>[],
  context: z.RefinementCtx,
): void {
  const expected = canonicalThreads(threads);
  if (threads.some((thread, index) => thread.threadId !== expected[index]!.threadId)) {
    context.addIssue({
      code: "custom",
      path: ["threads"],
      message: "Review resolution threads must be canonically ordered by thread ID",
    });
  }
  for (const [field, values] of [
    ["findingId", threads.map((thread) => thread.findingId)],
    ["threadId", threads.map((thread) => thread.threadId)],
    ["originalEvidenceArtifactHash", threads.map((thread) => thread.originalEvidenceArtifactHash)],
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: "custom",
        path: ["threads"],
        message: `Review resolution ${field} values must be unique`,
      });
    }
  }
}

const ResolutionIdentityCore = {
  runId: BoundedIdentitySchema,
  storyId: StoryIdSchema,
  packetHash: Sha256Schema,
  contractSliceHash: Sha256Schema,
  recoveryCaseId: RecoveryCaseIdSchema,
  recoveryCaseRevisionId: RecoveryRevisionIdSchema,
  recoveryDispatchId: RecoveryDispatchIdSchema,
  attemptId: AttemptIdSchema,
  findingSetHash: Sha256Schema,
  repository: GithubRepositoryIdentityV1Schema,
  prNumber: z.number().int().positive(),
  originalHeadSha: GitObjectHashSchema,
  originalSourceRevision: SourceRevisionV1Schema,
  observedHeadSha: GitObjectHashSchema,
  observedSourceRevision: SourceRevisionV1Schema,
} as const;

export const GithubReviewResolutionObservationAuthorityV1Schema = z.object({
  schema: z.literal("setfarm.github-review-resolution-observation-authority.v1"),
  ...ResolutionIdentityCore,
  threads: z.array(GithubReviewResolutionThreadAuthorityV1Schema).min(1).max(100),
}).strict().superRefine((value, context) => {
  validateCanonicalThreads(value.threads, context);
  if (value.observedHeadSha !== value.observedSourceRevision.sha) {
    context.addIssue({
      code: "custom",
      path: ["observedHeadSha"],
      message: "Observed GitHub head must equal the terminal recovery attempt source",
    });
  }
  if (value.originalHeadSha !== value.originalSourceRevision.sha) {
    context.addIssue({
      code: "custom",
      path: ["originalHeadSha"],
      message: "Original GitHub head must equal the original recovery source",
    });
  }
});

export type GithubReviewResolutionObservationAuthorityV1 = z.infer<
  typeof GithubReviewResolutionObservationAuthorityV1Schema
>;

const GithubReviewResolutionEvidenceCoreV1Schema = z.object({
  schema: z.literal("setfarm.github-review-resolution-evidence.v1"),
  evidenceHash: Sha256Schema,
  ...ResolutionIdentityCore,
  prState: z.enum(["OPEN", "CLOSED", "MERGED"]),
  threads: z.array(GithubReviewResolutionThreadEvidenceV1Schema).min(1).max(100),
}).strict();

export type GithubReviewResolutionEvidenceV1 = z.infer<
  typeof GithubReviewResolutionEvidenceCoreV1Schema
>;

function withoutEvidenceHash(
  value: GithubReviewResolutionEvidenceV1,
): Omit<GithubReviewResolutionEvidenceV1, "evidenceHash"> {
  const { evidenceHash: _evidenceHash, ...identity } = value;
  return identity;
}

export function computeGithubReviewResolutionEvidenceHashV1(
  value: GithubReviewResolutionEvidenceV1,
): string {
  return hashCanonicalJson(withoutEvidenceHash(value));
}

export const GithubReviewResolutionEvidenceV1Schema = GithubReviewResolutionEvidenceCoreV1Schema
  .superRefine((value, context) => {
    validateCanonicalThreads(value.threads, context);
    if (value.observedHeadSha !== value.observedSourceRevision.sha) {
      context.addIssue({
        code: "custom",
        path: ["observedHeadSha"],
        message: "Observed GitHub head must equal the terminal recovery attempt source",
      });
    }
    if (value.originalHeadSha !== value.originalSourceRevision.sha) {
      context.addIssue({
        code: "custom",
        path: ["originalHeadSha"],
        message: "Original GitHub head must equal the original recovery source",
      });
    }
    if (value.evidenceHash !== computeGithubReviewResolutionEvidenceHashV1(value)) {
      context.addIssue({
        code: "custom",
        path: ["evidenceHash"],
        message: "Resolution evidence hash must bind the exact GitHub and recovery identity",
      });
    }
  });

export function createGithubReviewResolutionEvidenceV1(input: Readonly<
  Omit<GithubReviewResolutionEvidenceV1, "schema" | "evidenceHash" | "threads">
  & { threads: readonly z.input<typeof GithubReviewResolutionThreadEvidenceV1Schema>[] }
>): GithubReviewResolutionEvidenceV1 {
  const draft = GithubReviewResolutionEvidenceCoreV1Schema.omit({
    schema: true,
    evidenceHash: true,
  }).parse({
    ...input,
    threads: canonicalThreads(input.threads),
  });
  const withoutHash = {
    schema: "setfarm.github-review-resolution-evidence.v1" as const,
    ...draft,
  };
  return GithubReviewResolutionEvidenceV1Schema.parse({
    ...withoutHash,
    evidenceHash: hashCanonicalJson(withoutHash),
  });
}

export function githubReviewResolutionTerminalResultV1(
  evidence: GithubReviewResolutionEvidenceV1,
): Readonly<Record<string, unknown>> {
  const exact = GithubReviewResolutionEvidenceV1Schema.parse(evidence);
  return Object.freeze({
    schema: "setfarm.github-review-resolution-result.v1",
    evidenceHash: exact.evidenceHash,
    recoveryCaseId: exact.recoveryCaseId,
    revisionId: exact.recoveryCaseRevisionId,
    dispatchId: exact.recoveryDispatchId,
    attemptId: exact.attemptId,
    observedSourceRevision: exact.observedSourceRevision,
    threads: exact.threads.map((thread) => ({
      threadId: thread.threadId,
      status: thread.status,
    })),
  });
}
