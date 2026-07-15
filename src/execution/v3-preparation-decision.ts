import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { GitObjectHashSchema, Sha256Schema } from "../product-compiler/schemas/common-v1.js";

export const V3ImplementationAttemptErrorCodeSchema = z.enum([
  "V3_ATTEMPT_CLAIM_ID_REQUIRED",
  "V3_ATTEMPT_CONTEXT_ARTIFACT_MISMATCH",
  "V3_ATTEMPT_CONTEXT_EVIDENCE_PLAN_MISMATCH",
  "V3_ATTEMPT_CONTEXT_EXECUTION_AUTHORITY_MISMATCH",
  "V3_ATTEMPT_CONTEXT_IDENTITY_MISMATCH",
  "V3_ATTEMPT_CONTEXT_INDEX_MISMATCH",
  "V3_ATTEMPT_CONTEXT_PACKET_MISMATCH",
  "V3_ATTEMPT_CONTEXT_RECOVERY_MISMATCH",
  "V3_ATTEMPT_CONTEXT_SLICE_MISMATCH",
  "V3_ATTEMPT_ACTIVE_CONFLICT",
  "V3_ATTEMPT_DUPLICATE_UNCHANGED_SOURCE",
  "V3_ATTEMPT_RESERVATION_BINDING_MISMATCH",
  "V3_DOWNSTREAM_EVIDENCE_PUBLICATION_INPUT_INVALID",
  "V3_EVIDENCE_ONLY_PUBLICATION_INPUT_INVALID",
  "V3_EVIDENCE_PLAN_PUBLICATION_HASH_MISMATCH",
  "V3_EVIDENCE_PUBLICATION_AUTHORITY_CONFLICT",
  "V3_IMPLEMENTATION_CONTEXT_CAPACITY_EXCEEDED",
  "V3_OPERATIONAL_RETRY_AUTHORITY_CONFLICT",
  "V3_OPERATIONAL_RETRY_IDENTITY_MISMATCH",
  "V3_OPERATIONAL_RETRY_PRIOR_ATTEMPT_UNAVAILABLE",
  "V3_OPERATIONAL_RETRY_PRIOR_ATTEMPT_NOT_TERMINAL",
  "V3_OPERATIONAL_RETRY_PUBLICATION_HASH_MISMATCH",
  "V3_RECOVERY_AUTHORIZATION_IDENTITY_MISMATCH",
  "V3_RECOVERY_AUTHORIZATION_NOT_FOUND",
  "V3_RECOVERY_AUTHORIZATION_UNAVAILABLE",
  "V3_RECOVERY_CONTRACT_SLICE_IDENTITY_MISMATCH",
  "V3_RECOVERY_CONTRACT_SLICE_INVALID",
  "V3_RECOVERY_EXECUTION_AUTHORITY_MISMATCH",
  "V3_RECOVERY_FINDING_SET_NOT_FOUND",
  "V3_RECOVERY_FINDING_SET_OVERRIDE_REJECTED",
  "V3_RECOVERY_REVIEW_EVIDENCE_ARTIFACT_INVALID",
  "V3_RECOVERY_REVIEW_EVIDENCE_IDENTITY_MISMATCH",
  "V3_RECOVERY_REVIEW_EVIDENCE_REF_INVALID",
  "V3_RECOVERY_SOURCE_REVISION_MISMATCH",
  "V3_RUNTIME_EVIDENCE_CONTRACT_REJECTED",
  "V3_RUNTIME_EVIDENCE_STACK_UNSUPPORTED",
  "V3_SLICE_COMPILATION_REJECTED",
  "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING",
  "V3_SLICE_DEPENDENCY_ATTEMPT_INVALID",
  "V3_SLICE_DEPENDENCY_COMMIT_INVALID",
  "V3_SLICE_DEPENDENCY_COMMIT_MISMATCH",
  "V3_SLICE_DEPENDENCY_COMMIT_MISSING",
  "V3_SLICE_DEPENDENCY_PATH_INVALID",
  "V3_SLICE_DEPENDENCY_PATH_REF_CONFLICT",
  "V3_SLICE_DEPENDENCY_SOURCE_TYPE_UNSUPPORTED",
  "V3_SLICE_PATH_BINDING_MISSING",
  "V3_SLICE_PUBLICATION_HASH_MISMATCH",
  "V3_SLICE_SHARED_GRANT_MISSING",
  "V3_SLICE_SOURCE_CHANGED_DURING_CAPTURE",
  "V3_SLICE_SOURCE_PATH_ESCAPE",
  "V3_SLICE_SOURCE_TYPE_UNSUPPORTED",
  "V3_SLICE_STORY_NOT_IN_PACKET",
]);

export type V3ImplementationAttemptErrorCode = z.infer<typeof V3ImplementationAttemptErrorCodeSchema>;

export const V3PreparationPhaseV1Schema = z.enum([
  "eligibility",
  "packet",
  "source",
  "reservation",
  "publication",
]);

export const V3PreparationActionV1Schema = z.enum([
  "ready",
  "dependency_wait",
  "packet_amendment",
  "ownership_wait",
  "unchanged_replay",
  "bounded_infra",
  "invariant_failure",
]);

export const V3PreparationDependencyStateV1Schema = z.object({
  storyId: z.string().min(1).max(500),
  state: z.enum(["ready", "missing", "invalid"]),
  attemptId: z.string().min(1).max(500).optional(),
  disposition: z.enum(["produced_delta", "already_satisfied", "verified"]).optional(),
  sourceAfterSha: GitObjectHashSchema.optional(),
  sourceAfterTreeHash: GitObjectHashSchema.optional(),
}).strict().superRefine((value, context) => {
  const bound = value.attemptId !== undefined
    || value.disposition !== undefined
    || value.sourceAfterSha !== undefined
    || value.sourceAfterTreeHash !== undefined;
  if (value.state === "ready" && (
    !value.attemptId
    || !value.disposition
    || !value.sourceAfterSha
    || !value.sourceAfterTreeHash
  )) {
    context.addIssue({
      code: "custom",
      path: ["state"],
      message: "Ready dependency state requires one exact terminal attempt and source revision",
    });
  }
  if (value.state !== "ready" && bound) {
    context.addIssue({
      code: "custom",
      path: ["state"],
      message: "Non-ready dependency state cannot claim a terminal attempt binding",
    });
  }
});

const V3PreparationIdentityCoreV1Schema = z.object({
  schema: z.literal("setfarm.v3-preparation-identity.v1"),
  runId: z.string().min(1).max(500),
  stepId: z.string().min(1).max(500),
  storyId: z.string().min(1).max(500),
  packetHash: Sha256Schema,
  sourceSha: GitObjectHashSchema,
  sourceTreeHash: GitObjectHashSchema,
  phase: V3PreparationPhaseV1Schema,
  errorCode: z.string().min(1).max(500),
  dependencyState: z.array(V3PreparationDependencyStateV1Schema).max(5_000),
}).strict();

export const V3PreparationIdentityV1Schema = V3PreparationIdentityCoreV1Schema.superRefine((value, context) => {
  const storyIds = value.dependencyState.map((dependency) => dependency.storyId);
  const canonical = [...new Set(storyIds)].sort();
  if (
    storyIds.length !== canonical.length
    || storyIds.some((storyId, index) => storyId !== canonical[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependencyState"],
      message: "Preparation dependencies must be unique and canonically sorted",
    });
  }
});

export const V3PreparationDecisionV1Schema = z.object({
  schema: z.literal("setfarm.v3-preparation-decision.v1"),
  action: V3PreparationActionV1Schema,
  phase: V3PreparationPhaseV1Schema,
  errorCode: z.string().min(1).max(500),
  fingerprint: Sha256Schema,
  consumesClaim: z.literal(false),
  dispatchModel: z.literal(false),
}).strict();

const V3BlockingPreparationActionV1Schema = z.enum([
  "dependency_wait",
  "packet_amendment",
  "ownership_wait",
  "bounded_infra",
  "invariant_failure",
]);

export const V3PreparationBlockV1Schema = z.object({
  schema: z.literal("setfarm.v3-preparation-block.v1"),
  blockId: z.string().regex(/^VPB_[a-f0-9]{64}_[1-9][0-9]*$/),
  fingerprint: Sha256Schema,
  occurrence: z.number().int().positive(),
  runId: z.string().min(1).max(500),
  stepId: z.string().min(1).max(500),
  storyId: z.string().min(1).max(500),
  packetHash: Sha256Schema,
  sourceSha: GitObjectHashSchema,
  sourceTreeHash: GitObjectHashSchema,
  phase: V3PreparationPhaseV1Schema,
  errorCode: z.string().min(1).max(500),
  action: V3BlockingPreparationActionV1Schema,
  dependencyState: z.array(V3PreparationDependencyStateV1Schema).max(5_000),
  detail: z.string().min(1).max(8_000),
  evidenceRefs: z.array(z.string().min(1).max(1_000)).max(1_000),
  openedAt: z.string().datetime({ offset: true }),
  resolvedAt: z.string().datetime({ offset: true }).optional(),
  resolutionFingerprint: Sha256Schema.optional(),
}).strict().superRefine((value, context) => {
  if (value.blockId !== `VPB_${value.fingerprint}_${value.occurrence}`) {
    context.addIssue({ code: "custom", path: ["blockId"], message: "Block ID must bind its fingerprint and occurrence" });
  }
  if (Boolean(value.resolvedAt) !== Boolean(value.resolutionFingerprint)) {
    context.addIssue({
      code: "custom",
      path: ["resolutionFingerprint"],
      message: "Resolution timestamp and exact delta fingerprint must be paired",
    });
  }
  if (value.resolutionFingerprint === value.fingerprint) {
    context.addIssue({
      code: "custom",
      path: ["resolutionFingerprint"],
      message: "An unchanged fingerprint cannot resolve a preparation block",
    });
  }
  const evidenceRefs = [...new Set(value.evidenceRefs)].sort();
  if (
    evidenceRefs.length !== value.evidenceRefs.length
    || value.evidenceRefs.some((reference, index) => reference !== evidenceRefs[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidenceRefs"],
      message: "Preparation evidence refs must be unique and canonically sorted",
    });
  }
  const dependencyStoryIds = value.dependencyState.map((dependency) => dependency.storyId);
  const canonicalDependencyStoryIds = [...new Set(dependencyStoryIds)].sort();
  if (
    dependencyStoryIds.length !== canonicalDependencyStoryIds.length
    || dependencyStoryIds.some((storyId, index) => storyId !== canonicalDependencyStoryIds[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependencyState"],
      message: "Preparation block dependencies must be unique and canonically sorted",
    });
  }
});

export type V3PreparationPhaseV1 = z.infer<typeof V3PreparationPhaseV1Schema>;
export type V3PreparationActionV1 = z.infer<typeof V3PreparationActionV1Schema>;
export type V3PreparationDependencyStateV1 = z.infer<typeof V3PreparationDependencyStateV1Schema>;
export type V3PreparationIdentityV1 = z.infer<typeof V3PreparationIdentityV1Schema>;
export type V3PreparationDecisionV1 = z.infer<typeof V3PreparationDecisionV1Schema>;
export type V3PreparationBlockV1 = z.infer<typeof V3PreparationBlockV1Schema>;

const dependencyWaitCodes = new Set<V3ImplementationAttemptErrorCode>([
  "V3_SLICE_DEPENDENCY_ATTEMPT_MISSING",
]);

const ownershipWaitCodes = new Set<V3ImplementationAttemptErrorCode>([
  "V3_SLICE_DEPENDENCY_COMMIT_MISSING",
  "V3_SLICE_SOURCE_CHANGED_DURING_CAPTURE",
]);

const packetAmendmentCodes = new Set<V3ImplementationAttemptErrorCode>([
  "V3_IMPLEMENTATION_CONTEXT_CAPACITY_EXCEEDED",
  "V3_RUNTIME_EVIDENCE_CONTRACT_REJECTED",
  "V3_RUNTIME_EVIDENCE_STACK_UNSUPPORTED",
  "V3_SLICE_COMPILATION_REJECTED",
  "V3_SLICE_DEPENDENCY_PATH_INVALID",
  "V3_SLICE_DEPENDENCY_PATH_REF_CONFLICT",
  "V3_SLICE_DEPENDENCY_SOURCE_TYPE_UNSUPPORTED",
  "V3_SLICE_PATH_BINDING_MISSING",
  "V3_SLICE_SHARED_GRANT_MISSING",
  "V3_SLICE_SOURCE_PATH_ESCAPE",
  "V3_SLICE_SOURCE_TYPE_UNSUPPORTED",
  "V3_SLICE_STORY_NOT_IN_PACKET",
]);

const transientInfrastructureCodes = new Set([
  "40001",
  "40P01",
  "55P03",
  "57014",
  "EAI_AGAIN",
  "EBUSY",
  "ECONNRESET",
  "EMFILE",
  "ENFILE",
  "ENOSPC",
  "ETIMEDOUT",
]);

function structuralErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : undefined;
}

export function classifyV3PreparationFailure(error: unknown): Readonly<{
  action: Exclude<V3PreparationActionV1, "ready" | "unchanged_replay">;
  errorCode: string;
}> {
  const code = structuralErrorCode(error) ?? "V3_PREPARATION_UNTYPED_FAILURE";
  const implementationCode = V3ImplementationAttemptErrorCodeSchema.safeParse(code);
  if (implementationCode.success) {
    if (dependencyWaitCodes.has(implementationCode.data)) {
      return { action: "dependency_wait", errorCode: implementationCode.data };
    }
    if (ownershipWaitCodes.has(implementationCode.data)) {
      return { action: "ownership_wait", errorCode: implementationCode.data };
    }
    if (packetAmendmentCodes.has(implementationCode.data)) {
      return { action: "packet_amendment", errorCode: implementationCode.data };
    }
    return { action: "invariant_failure", errorCode: implementationCode.data };
  }
  if (code === "RUNTIME_PACKET_NOT_ACTIVE") {
    return { action: "ownership_wait", errorCode: code };
  }
  if (code.startsWith("RUNTIME_")) {
    return { action: "invariant_failure", errorCode: code };
  }
  if (transientInfrastructureCodes.has(code)) {
    return { action: "bounded_infra", errorCode: code };
  }
  return { action: "invariant_failure", errorCode: code };
}

export function createV3PreparationFingerprint(input: unknown): string {
  const raw = V3PreparationIdentityCoreV1Schema.parse(input);
  const identity = V3PreparationIdentityV1Schema.parse({
    ...raw,
    dependencyState: [...raw.dependencyState]
      .sort((left, right) => left.storyId.localeCompare(right.storyId)),
  });
  return hashCanonicalJson(identity);
}

export function decideV3PreparationFailure(input: Readonly<{
  identity: Omit<V3PreparationIdentityV1, "schema" | "errorCode">;
  error: unknown;
  existingOpenFingerprint?: string;
}>): V3PreparationDecisionV1 {
  const classified = classifyV3PreparationFailure(input.error);
  const fingerprint = createV3PreparationFingerprint({
    ...input.identity,
    schema: "setfarm.v3-preparation-identity.v1",
    errorCode: classified.errorCode,
  });
  return V3PreparationDecisionV1Schema.parse({
    schema: "setfarm.v3-preparation-decision.v1",
    action: input.existingOpenFingerprint === fingerprint
      ? "unchanged_replay"
      : classified.action,
    phase: input.identity.phase,
    errorCode: classified.errorCode,
    fingerprint,
    consumesClaim: false,
    dispatchModel: false,
  });
}
