import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { GitObjectHashSchema, Sha256Schema } from "../product-compiler/schemas/common-v1.js";

export const V3PreparationDependencyAttemptAuthorityV1Schema = z.object({
  storyId: z.string().min(1).max(500),
  attemptId: z.string().min(1).max(500),
  attemptClass: z.enum(["product_implementation", "supervisor_repair"]),
  disposition: z.enum(["produced_delta", "already_satisfied", "verified"]),
  sourceRevision: z.object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  }).strict(),
}).strict();

const V3PreparationClaimAuthorityPayloadV1Schema = z.object({
  schema: z.literal("setfarm.v3-preparation-claim-authority.v1"),
  authorityVersion: z.literal(1),
  stateVersion: z.number().int().positive(),
  runId: z.string().min(1).max(500),
  stepId: z.string().min(1).max(500),
  storyId: z.string().min(1).max(500),
  packetHash: Sha256Schema,
  baseRevision: z.object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  }).strict(),
  projectedDependencyIds: z.array(z.string().min(1).max(500)).max(5_000),
  dependencyAttempts: z.array(V3PreparationDependencyAttemptAuthorityV1Schema).max(5_000),
}).strict().superRefine((value, context) => {
  const projected = [...new Set(value.projectedDependencyIds)].sort();
  if (
    projected.length !== value.projectedDependencyIds.length
    || projected.some((storyId, index) => storyId !== value.projectedDependencyIds[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["projectedDependencyIds"],
      message: "Projected dependency IDs must be unique and canonically sorted",
    });
  }
  const attemptStoryIds = value.dependencyAttempts.map((attempt) => attempt.storyId);
  const canonicalAttemptStoryIds = [...new Set(attemptStoryIds)].sort();
  if (
    canonicalAttemptStoryIds.length !== attemptStoryIds.length
    || canonicalAttemptStoryIds.some((storyId, index) => storyId !== attemptStoryIds[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependencyAttempts"],
      message: "Dependency attempts must be unique by story and canonically sorted",
    });
  }
  if (
    projected.length !== canonicalAttemptStoryIds.length
    || projected.some((storyId, index) => storyId !== canonicalAttemptStoryIds[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependencyAttempts"],
      message: "Every projected dependency must bind exactly one terminal attempt",
    });
  }
});

export const V3PreparationClaimAuthorityV1Schema = V3PreparationClaimAuthorityPayloadV1Schema.extend({
  authorityHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { authorityHash: _authorityHash, ...payload } = value;
  if (authorityHashForV3PreparationClaim(payload) !== value.authorityHash) {
    context.addIssue({
      code: "custom",
      path: ["authorityHash"],
      message: "Preparation claim authority hash does not bind its canonical payload",
    });
  }
});

export type V3PreparationDependencyAttemptAuthorityV1 = z.infer<
  typeof V3PreparationDependencyAttemptAuthorityV1Schema
>;
export type V3PreparationClaimAuthorityV1 = z.infer<typeof V3PreparationClaimAuthorityV1Schema>;
export type V3PreparationClaimAuthorityPayloadV1 = z.infer<
  typeof V3PreparationClaimAuthorityPayloadV1Schema
>;

export class V3PreparationClaimAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "V3PreparationClaimAuthorityError";
    this.code = code;
  }
}

export function authorityHashForV3PreparationClaim(input: unknown): string {
  const payload = V3PreparationClaimAuthorityPayloadV1Schema.parse(input);
  return hashCanonicalJson(payload);
}

export function createV3PreparationClaimAuthorityV1(
  input: Omit<V3PreparationClaimAuthorityPayloadV1, "schema" | "authorityVersion">,
): V3PreparationClaimAuthorityV1 {
  const payload = V3PreparationClaimAuthorityPayloadV1Schema.parse({
    ...input,
    schema: "setfarm.v3-preparation-claim-authority.v1",
    authorityVersion: 1,
    projectedDependencyIds: [...input.projectedDependencyIds].sort(),
    dependencyAttempts: [...input.dependencyAttempts]
      .sort((left, right) => left.storyId.localeCompare(right.storyId)),
  });
  return V3PreparationClaimAuthorityV1Schema.parse({
    ...payload,
    authorityHash: authorityHashForV3PreparationClaim(payload),
  });
}

export function v3PreparationStoryLockIdentity(input: Readonly<{
  runId: string;
  stepId: string;
  storyId: string;
}>): string {
  // Keep the original v16 preparation-block lock identity so block, ready and
  // claim state transitions serialize on one advisory lock.
  return hashCanonicalJson({
    schema: "setfarm.v3-preparation-block-lock.v1",
    runId: input.runId,
    stepId: input.stepId,
    storyId: input.storyId,
  });
}
