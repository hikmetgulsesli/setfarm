import { z } from "zod";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { GitObjectHashSchema, Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import { ImplementationDependencyOutputV2Schema } from "../product-compiler/schemas/implementation-slice-v2.js";
import {
  V3PreparationDependencyAttemptAuthorityV1Schema as HistoricalDependencyV1Schema,
  V3PreparationClaimAuthorityV1Schema as HistoricalAuthorityV1Schema,
  createV3PreparationClaimAuthorityV1 as createHistoricalAuthorityV1,
} from "./v3-preparation-claim-authority.js";
import {
  V3PreparationDependencyAttemptAuthorityV2Schema as HistoricalDependencyV2Schema,
  V3PreparationClaimAuthorityV2Schema as HistoricalAuthorityV2Schema,
  createV3PreparationClaimAuthorityV2 as createHistoricalAuthorityV2,
  V3_PREPARATION_CLAIM_AUTHORITY_V2_MAX_CANONICAL_BYTES,
} from "./v3-preparation-claim-authority-v2.js";

export { V3_PREPARATION_CLAIM_AUTHORITY_V2_MAX_CANONICAL_BYTES };

// Runtime nested authority evolution only. Historical migration schemas and
// audits remain immutable and deliberately reject the new verifier variant.
// This DATA contract supplies no claim, lease or durable source-owner authority.
function requireNativeDependency(
  dependencies: readonly { attemptClass: string }[], context: z.RefinementCtx,
): void {
  if (!dependencies.some(dependency => dependency.attemptClass === "evidence_only")) {
    context.addIssue({code: "custom", path: ["dependencyAttempts"],
      message: "Runtime native branch requires an independent evidence refresh"});
  }
}

// A verifier is distinct from its original model source owner. No defaults are
// added to the historical model branch, so its canonical bytes remain unchanged.
export const NativeEvidenceRefreshWitnessV1Schema = z.object({
  kind: z.literal("native_evidence_refresh"),
  sourceOwnerAttemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  sourceOwnerGeneration: z.number().int().positive(),
  sourceOwnerOutputHash: Sha256Schema,
  sourceOwnerClaimOutcome: z.enum(["completed","failed"]),
  initialAuthorityHash: Sha256Schema,
  recoveryCaseId: z.string().regex(/^RCV_[a-f0-9]{64}$/),
  revisionId: z.string().regex(/^RREV_[a-f0-9]{64}$/),
  dispatchId: z.string().regex(/^RDISP_[a-f0-9]{64}$/),
  evidencePlanArtifactHash: Sha256Schema,
  evidenceBundleHash: Sha256Schema,
}).strict();

export const V3PreparationDependencyAttemptAuthorityV1Schema = z.union([
  HistoricalDependencyV1Schema,
  HistoricalDependencyV1Schema.extend({
    attemptClass: z.literal("evidence_only"),
    disposition: z.literal("verified"),
    evidenceRefresh: NativeEvidenceRefreshWitnessV1Schema,
  }).strict(),
]);

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
  requireNativeDependency(value.dependencyAttempts, context);
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

const NativeRuntimeAuthorityV1Schema = V3PreparationClaimAuthorityPayloadV1Schema.safeExtend({
  authorityHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { authorityHash: _authorityHash, ...payload } = value;
  if (hashCanonicalJson(payload) !== value.authorityHash) {
    context.addIssue({
      code: "custom",
      path: ["authorityHash"],
      message: "Preparation claim authority hash does not bind its canonical payload",
    });
  }
});

export const V3PreparationClaimAuthorityV1Schema = z.union([HistoricalAuthorityV1Schema, NativeRuntimeAuthorityV1Schema]);

export type V3PreparationDependencyAttemptAuthorityV1 = z.infer<
  typeof V3PreparationDependencyAttemptAuthorityV1Schema
>;
export type V3PreparationClaimAuthorityV1 = z.infer<typeof V3PreparationClaimAuthorityV1Schema>;
export type V3PreparationClaimAuthorityPayloadV1 = z.infer<
  typeof V3PreparationClaimAuthorityPayloadV1Schema
>;


export const V3PreparationDependencyAttemptAuthorityV2Schema = z.union([
  HistoricalDependencyV2Schema,
  // Extend the original refined dependency contract without overwriting the
  // disjoint model discriminant. safeExtend retains every inherited check.
  ImplementationDependencyOutputV2Schema.safeExtend({
    attemptId: HistoricalDependencyV2Schema.shape.attemptId,
    attemptGeneration: HistoricalDependencyV2Schema.shape.attemptGeneration,
    attemptClass: z.literal("evidence_only"),
    disposition: z.literal("verified"),
    evidenceRefresh: NativeEvidenceRefreshWitnessV1Schema,
  }).strict().superRefine((value, context) => {
    if (value.attemptGeneration !== value.evidenceRefresh.sourceOwnerGeneration + 1) {
      context.addIssue({code: "custom", path: ["attemptGeneration"],
        message: "First evidence refresh must directly follow its original source owner"});
    }
    if (value.outputHash !== value.evidenceRefresh.evidenceBundleHash) {
      context.addIssue({ code: "custom", path: ["outputHash"],
        message: "Nonmodel output hash must identify its canonical evidence bundle" });
    }
  }),
]);

const PreparationIdentityV2Schema = z.string().min(1).max(500).refine(
  (value) => Buffer.byteLength(value, "utf8") <= 500,
  "Preparation authority identity exceeds 500 UTF-8 bytes",
);

function compareCanonicalText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const V3PreparationClaimAuthorityPayloadV2Schema = z.object({
  schema: z.literal("setfarm.v3-preparation-claim-authority.v2"),
  authorityVersion: z.literal(2),
  packetSchema: z.literal("setfarm.product-build-packet.v3"),
  stateVersion: z.number().int().positive(),
  runId: PreparationIdentityV2Schema,
  stepId: PreparationIdentityV2Schema,
  storyId: PreparationIdentityV2Schema,
  packetHash: Sha256Schema,
  compilationReportHash: Sha256Schema,
  baseRevision: z.object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  }).strict(),
  projectedDependencyIds: z.array(z.string().min(1).max(500)).max(5_000),
  dependencyAttempts: z.array(V3PreparationDependencyAttemptAuthorityV2Schema).max(5_000),
}).strict().superRefine((value, context) => {
  requireNativeDependency(value.dependencyAttempts, context);
  const projected = [...new Set(value.projectedDependencyIds)].sort(compareCanonicalText);
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
  const canonicalAttemptStoryIds = [...new Set(attemptStoryIds)].sort(compareCanonicalText);
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
  if (
    Buffer.byteLength(canonicalJsonStringify(value), "utf8")
      > V3_PREPARATION_CLAIM_AUTHORITY_V2_MAX_CANONICAL_BYTES
  ) {
    context.addIssue({
      code: "custom",
      message: "Preparation claim authority exceeds the canonical byte boundary",
    });
  }
});

const NativeRuntimeAuthorityV2Schema = V3PreparationClaimAuthorityPayloadV2Schema.safeExtend({
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

export const V3PreparationClaimAuthorityV2Schema = z.union([HistoricalAuthorityV2Schema, NativeRuntimeAuthorityV2Schema]);

export type V3PreparationDependencyAttemptAuthorityV2 = z.infer<
  typeof V3PreparationDependencyAttemptAuthorityV2Schema
>;
export type V3PreparationClaimAuthorityPayloadV2 = z.infer<
  typeof V3PreparationClaimAuthorityPayloadV2Schema
>;
export type V3PreparationClaimAuthorityV2 = z.infer<
  typeof V3PreparationClaimAuthorityV2Schema
>;

export function createV3PreparationClaimAuthorityV1(
  input: Omit<V3PreparationClaimAuthorityPayloadV1, "schema" | "authorityVersion">,
): V3PreparationClaimAuthorityV1 {
  if (!input.dependencyAttempts.some(dependency => dependency.attemptClass === "evidence_only")) {
    return createHistoricalAuthorityV1({ ...input,
      dependencyAttempts: input.dependencyAttempts.map(dependency => HistoricalDependencyV1Schema.parse(dependency)),
    });
  }
  const payload = V3PreparationClaimAuthorityPayloadV1Schema.parse({ ...input,
    schema: "setfarm.v3-preparation-claim-authority.v1", authorityVersion: 1,
    projectedDependencyIds: [...input.projectedDependencyIds].sort(),
    dependencyAttempts: [...input.dependencyAttempts].sort((left, right) => left.storyId.localeCompare(right.storyId)),
  });
  return NativeRuntimeAuthorityV1Schema.parse({ ...payload, authorityHash: hashCanonicalJson(payload) });
}

export function createV3PreparationClaimAuthorityV2(
  input: Omit<V3PreparationClaimAuthorityPayloadV2, "schema" | "authorityVersion" | "packetSchema">,
): V3PreparationClaimAuthorityV2 {
  if (!input.dependencyAttempts.some(dependency => dependency.attemptClass === "evidence_only")) {
    return createHistoricalAuthorityV2({ ...input,
      dependencyAttempts: input.dependencyAttempts.map(dependency => HistoricalDependencyV2Schema.parse(dependency)),
    });
  }
  const payload = V3PreparationClaimAuthorityPayloadV2Schema.parse({ ...input,
    schema: "setfarm.v3-preparation-claim-authority.v2", authorityVersion: 2,
    packetSchema: "setfarm.product-build-packet.v3",
    projectedDependencyIds: [...input.projectedDependencyIds].sort(compareCanonicalText),
    dependencyAttempts: [...input.dependencyAttempts].sort((left, right) => compareCanonicalText(left.storyId, right.storyId)),
  });
  return NativeRuntimeAuthorityV2Schema.parse({ ...payload, authorityHash: hashCanonicalJson(payload) });
}

/** Pure scheduling projection; the witness retains the independent verifier. */
export function projectV3PreparationRuntimeAuthorityV1(raw: V3PreparationClaimAuthorityV2): V3PreparationClaimAuthorityV1 {
  const authority = V3PreparationClaimAuthorityV2Schema.parse(raw);
  return createV3PreparationClaimAuthorityV1({
    stateVersion: authority.stateVersion, runId: authority.runId, stepId: authority.stepId,
    storyId: authority.storyId, packetHash: authority.packetHash, baseRevision: authority.baseRevision,
    projectedDependencyIds: [...authority.projectedDependencyIds],
    dependencyAttempts: authority.dependencyAttempts.map(dependency => V3PreparationDependencyAttemptAuthorityV1Schema.parse({
      storyId: dependency.storyId, attemptId: dependency.attemptId, attemptClass: dependency.attemptClass,
      disposition: dependency.disposition, sourceRevision: dependency.sourceAfter,
      ...(dependency.attemptClass === "evidence_only" ? { evidenceRefresh: dependency.evidenceRefresh } : {}),
    })),
  });
}
