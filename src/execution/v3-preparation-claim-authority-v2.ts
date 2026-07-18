import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { GitObjectHashSchema, Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import { ImplementationDependencyOutputV2Schema } from "../product-compiler/schemas/implementation-slice-v2.js";

export const V3PreparationDependencyAttemptAuthorityV2Schema =
ImplementationDependencyOutputV2Schema.extend({
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  attemptGeneration: z.number().int().positive(),
  attemptClass: z.enum(["product_implementation", "supervisor_repair"]),
  disposition: z.enum(["produced_delta", "already_satisfied", "verified"]),
}).strict();

const V3PreparationClaimAuthorityPayloadV2Schema = z.object({
  schema: z.literal("setfarm.v3-preparation-claim-authority.v2"),
  authorityVersion: z.literal(2),
  packetSchema: z.literal("setfarm.product-build-packet.v3"),
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
  dependencyAttempts: z.array(V3PreparationDependencyAttemptAuthorityV2Schema).max(5_000),
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

export const V3PreparationClaimAuthorityV2Schema = V3PreparationClaimAuthorityPayloadV2Schema.extend({
  authorityHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { authorityHash: _authorityHash, ...payload } = value;
  if (hashCanonicalJson(payload) !== value.authorityHash) {
    context.addIssue({
      code: "custom",
      path: ["authorityHash"],
      message: "Preparation claim authority hash does not bind its canonical V2 payload",
    });
  }
});

export type V3PreparationDependencyAttemptAuthorityV2 = z.infer<
  typeof V3PreparationDependencyAttemptAuthorityV2Schema
>;
export type V3PreparationClaimAuthorityPayloadV2 = z.infer<
  typeof V3PreparationClaimAuthorityPayloadV2Schema
>;
export type V3PreparationClaimAuthorityV2 = z.infer<
  typeof V3PreparationClaimAuthorityV2Schema
>;

export function authorityHashForV3PreparationClaimV2(input: unknown): string {
  return hashCanonicalJson(V3PreparationClaimAuthorityPayloadV2Schema.parse(input));
}

export function createV3PreparationClaimAuthorityV2(
  input: Omit<
    V3PreparationClaimAuthorityPayloadV2,
    "schema" | "authorityVersion" | "packetSchema"
  >,
): V3PreparationClaimAuthorityV2 {
  const payload = V3PreparationClaimAuthorityPayloadV2Schema.parse({
    ...input,
    schema: "setfarm.v3-preparation-claim-authority.v2",
    authorityVersion: 2,
    packetSchema: "setfarm.product-build-packet.v3",
    projectedDependencyIds: [...input.projectedDependencyIds].sort(),
    dependencyAttempts: [...input.dependencyAttempts]
      .sort((left, right) => left.storyId.localeCompare(right.storyId)),
  });
  return V3PreparationClaimAuthorityV2Schema.parse({
    ...payload,
    authorityHash: authorityHashForV3PreparationClaimV2(payload),
  });
}
