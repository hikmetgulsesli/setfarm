import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import { SourceRevisionV1Schema, type SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";

const BoundedIdentitySchema = z.string().min(1).max(500);
const PlatformFailureCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,80}$/);
const ProviderIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/);
const ModelIdSchema = z.string().min(3).max(300);
const WritablePathSchema = z.string().min(1).max(1_024).superRefine((value, context) => {
  const segments = value.split("/");
  if (value.startsWith("/") || value.includes("\\") || segments.some((part) => part === "" || part === "." || part === "..")) {
    context.addIssue({ code: "custom", message: "Operational retry paths must be normalized relative paths" });
  }
});

export const ModelExecutionProfileV1Schema = z.object({
  schema: z.literal("setfarm.model-execution-profile.v1"),
  providerId: ProviderIdSchema,
  modelId: ModelIdSchema,
  selection: z.enum(["primary", "fallback"]),
}).strict().superRefine((value, context) => {
  if (!value.modelId.startsWith(`${value.providerId}/`)) {
    context.addIssue({
      code: "custom",
      path: ["modelId"],
      message: "Model ID must be qualified by the exact provider ID",
    });
  }
});

export type ModelExecutionProfileV1 = z.infer<typeof ModelExecutionProfileV1Schema>;

const PRIMARY_EXECUTION_PROFILE = Object.freeze({
  schema: "setfarm.model-execution-profile.v1" as const,
  providerId: "minimax",
  modelId: "minimax/MiniMax-M3",
  selection: "primary" as const,
});

const FALLBACK_EXECUTION_PROFILE = Object.freeze({
  schema: "setfarm.model-execution-profile.v1" as const,
  providerId: "kimi",
  modelId: "kimi/kimi-for-coding",
  selection: "fallback" as const,
});

export function resolveV3ExecutionProfile(
  selection: "primary" | "fallback",
): ModelExecutionProfileV1 {
  return ModelExecutionProfileV1Schema.parse(
    selection === "fallback" ? FALLBACK_EXECUTION_PROFILE : PRIMARY_EXECUTION_PROFILE,
  );
}

const OperationalRetryPriorAttemptV1Schema = z.object({
  claimId: z.number().int().positive(),
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  generation: z.number().int().positive(),
  attemptClass: z.literal("product_implementation"),
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceBefore: SourceRevisionV1Schema,
  terminalDisposition: z.enum(["inconclusive", "failed"]),
}).strict();

const OperationalRetryFailureV1Schema = z.object({
  code: PlatformFailureCodeSchema,
  diagnostic: z.string().min(1).max(8_000),
  evidenceHash: Sha256Schema,
}).strict();

const OperationalRetryExpectedDeltaV1Schema = z.object({
  kind: z.literal("bounded_source_implementation"),
  allowedPaths: z.array(WritablePathSchema).min(1).max(20_000),
  requireSourceDelta: z.literal(true),
  authoritativeEvidenceOwner: z.literal("setfarm"),
}).strict().superRefine((value, context) => {
  const canonical = [...new Set(value.allowedPaths)].sort();
  if (
    canonical.length !== value.allowedPaths.length
    || value.allowedPaths.some((item, index) => item !== canonical[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["allowedPaths"],
      message: "Operational retry paths must be unique and canonically sorted",
    });
  }
});

const OperationalRetryDirectiveCoreV1Schema = z.object({
  schema: z.literal("setfarm.operational-retry-directive.v1"),
  runId: BoundedIdentitySchema,
  stepId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  priorAttempt: OperationalRetryPriorAttemptV1Schema,
  failure: OperationalRetryFailureV1Schema,
  nextSourceRevision: SourceRevisionV1Schema,
  expectedDelta: OperationalRetryExpectedDeltaV1Schema,
  retryBudget: z.object({
    ordinal: z.literal(1),
    limit: z.literal(1),
  }).strict(),
  executionProfile: ModelExecutionProfileV1Schema,
}).strict();

export const OperationalRetryDirectiveV1Schema = OperationalRetryDirectiveCoreV1Schema.extend({
  directiveHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { directiveHash, ...core } = value;
  if (directiveHash !== hashCanonicalJson(core)) {
    context.addIssue({
      code: "custom",
      path: ["directiveHash"],
      message: "Operational retry hash must bind the exact canonical directive",
    });
  }
  if (
    value.failure.evidenceHash !== hashCanonicalJson({
      schema: "setfarm.operational-retry-failure-evidence.v1",
      code: value.failure.code,
      diagnostic: value.failure.diagnostic,
    })
  ) {
    context.addIssue({
      code: "custom",
      path: ["failure", "evidenceHash"],
      message: "Failure evidence hash must bind the exact platform diagnostic",
    });
  }
  if (
    value.nextSourceRevision.sha !== value.priorAttempt.sourceBefore.sha
    || value.nextSourceRevision.treeHash !== value.priorAttempt.sourceBefore.treeHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["nextSourceRevision"],
      message: "Operational retry must resume from the exact reset source-before revision",
    });
  }
  if (value.executionProfile.selection !== "fallback") {
    context.addIssue({
      code: "custom",
      path: ["executionProfile", "selection"],
      message: "Operational retry must select the bounded fallback profile",
    });
  }
  const fallbackProfile = resolveV3ExecutionProfile("fallback");
  if (
    value.executionProfile.providerId !== fallbackProfile.providerId
    || value.executionProfile.modelId !== fallbackProfile.modelId
  ) {
    context.addIssue({
      code: "custom",
      path: ["executionProfile"],
      message: "Operational retry must use the canonical Kimi fallback profile",
    });
  }
});

export type OperationalRetryDirectiveV1 = z.infer<typeof OperationalRetryDirectiveV1Schema>;

export function createOperationalRetryDirectiveV1(input: Readonly<{
  runId: string;
  stepId: string;
  storyId: string;
  priorAttempt: Readonly<{
    claimId: number;
    attemptId: string;
    generation: number;
    attemptClass: "product_implementation";
    packetHash: string;
    sliceHash: string;
    sourceBefore: SourceRevisionV1;
    terminalDisposition: "inconclusive" | "failed";
  }>;
  failure: Readonly<{ code: string; diagnostic: string }>;
  nextSourceRevision: SourceRevisionV1;
  allowedPaths: readonly string[];
  executionProfile?: ModelExecutionProfileV1;
}>): OperationalRetryDirectiveV1 {
  const failure = {
    code: input.failure.code,
    diagnostic: input.failure.diagnostic,
    evidenceHash: hashCanonicalJson({
      schema: "setfarm.operational-retry-failure-evidence.v1",
      code: input.failure.code,
      diagnostic: input.failure.diagnostic,
    }),
  };
  const core = OperationalRetryDirectiveCoreV1Schema.parse({
    schema: "setfarm.operational-retry-directive.v1",
    runId: input.runId,
    stepId: input.stepId,
    storyId: input.storyId,
    priorAttempt: input.priorAttempt,
    failure,
    nextSourceRevision: input.nextSourceRevision,
    expectedDelta: {
      kind: "bounded_source_implementation",
      allowedPaths: [...new Set(input.allowedPaths)].sort(),
      requireSourceDelta: true,
      authoritativeEvidenceOwner: "setfarm",
    },
    retryBudget: { ordinal: 1, limit: 1 },
    executionProfile: input.executionProfile ?? resolveV3ExecutionProfile("fallback"),
  });
  return OperationalRetryDirectiveV1Schema.parse({
    ...core,
    directiveHash: hashCanonicalJson(core),
  });
}

export function serializeOperationalRetryDirectiveV1(
  input: OperationalRetryDirectiveV1,
): string {
  return canonicalJsonStringify(OperationalRetryDirectiveV1Schema.parse(input));
}

/**
 * Legacy story output is not retry authority. Only the exact schema is parsed;
 * a malformed lookalike throws so callers cannot silently downgrade it to an
 * initial product attempt.
 */
export function parseOperationalRetryDirectiveStoryOutput(
  output: string | null | undefined,
): OperationalRetryDirectiveV1 | undefined {
  const raw = String(output ?? "").trim();
  if (!raw) return undefined;
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch (error) {
    if (raw.includes("setfarm.operational-retry-directive.v1")) throw error;
    return undefined;
  }
  if (
    !candidate
    || typeof candidate !== "object"
    || Array.isArray(candidate)
    || (candidate as Record<string, unknown>).schema !== "setfarm.operational-retry-directive.v1"
  ) {
    return undefined;
  }
  return OperationalRetryDirectiveV1Schema.parse(candidate);
}
