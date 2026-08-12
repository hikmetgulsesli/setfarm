import { Buffer } from "node:buffer";

import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { inspectEnglishTextV1 } from "../product-compiler/english-text-contract-v1.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import { GitObjectHashSchema } from "../product-compiler/schemas/common-v1.js";

export const V3_SUPERVISOR_RETRY_DIRECTIVE_ARTIFACT_TYPE_V1 =
  "setfarm.v3-supervisor-retry-directive.v1" as const;
export const V3_SUPERVISOR_RETRY_DIRECTIVE_MAX_BYTES_V1 = 32 * 1024;

const BoundedIdentitySchema = z.string().min(1).max(500);
const SafePositiveIntegerSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const SupervisorRetryFeedbackSchema = z.string().min(1).max(6_000).superRefine((value, context) => {
  if (value.trim() !== value) {
    context.addIssue({
      code: "custom",
      message: "Supervisor retry feedback must not contain leading or trailing whitespace",
    });
  }
  const violation = inspectEnglishTextV1(value, 6_000);
  if (violation) {
    context.addIssue({
      code: "custom",
      message: `Supervisor retry feedback must satisfy the English text contract: ${violation.code}`,
    });
  }
});

const V3SupervisorRetryDirectiveCoreV1Schema = z.object({
  schema: z.literal(V3_SUPERVISOR_RETRY_DIRECTIVE_ARTIFACT_TYPE_V1),
  runId: BoundedIdentitySchema,
  storyDbId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  storyClaimGeneration: SafePositiveIntegerSchema,
  supervisorClaimId: SafePositiveIntegerSchema,
  runtimeSessionId: BoundedIdentitySchema,
  outputHash: Sha256Schema,
  sourceRevision: z.object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  }).strict(),
  decision: z.literal("retry"),
  feedback: SupervisorRetryFeedbackSchema,
  retryOrdinal: SafePositiveIntegerSchema,
  maxRetries: SafePositiveIntegerSchema,
  expectedDelta: z.object({
    kind: z.literal("resolve_supervisor_feedback"),
    requireSourceDelta: z.literal(true),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.retryOrdinal > value.maxRetries) {
    context.addIssue({
      code: "custom",
      path: ["retryOrdinal"],
      message: "Supervisor retry ordinal cannot exceed its exact story retry budget",
    });
  }
});

export const V3SupervisorRetryDirectiveV1Schema = V3SupervisorRetryDirectiveCoreV1Schema.extend({
  directiveHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { directiveHash, ...core } = value;
  if (directiveHash !== hashCanonicalJson(core)) {
    context.addIssue({
      code: "custom",
      path: ["directiveHash"],
      message: "Supervisor retry hash must bind the exact canonical directive",
    });
  }
});

export type V3SupervisorRetryDirectiveV1 = z.infer<typeof V3SupervisorRetryDirectiveV1Schema>;

export function createV3SupervisorRetryDirectiveV1(
  input: Omit<z.input<typeof V3SupervisorRetryDirectiveCoreV1Schema>, "schema" | "expectedDelta">,
): V3SupervisorRetryDirectiveV1 {
  const core = V3SupervisorRetryDirectiveCoreV1Schema.parse({
    schema: V3_SUPERVISOR_RETRY_DIRECTIVE_ARTIFACT_TYPE_V1,
    ...input,
    expectedDelta: {
      kind: "resolve_supervisor_feedback",
      requireSourceDelta: true,
    },
  });
  return V3SupervisorRetryDirectiveV1Schema.parse({
    ...core,
    directiveHash: hashCanonicalJson(core),
  });
}

export function serializeV3SupervisorRetryDirectiveV1(
  input: V3SupervisorRetryDirectiveV1,
): string {
  const serialized = canonicalJsonStringify(V3SupervisorRetryDirectiveV1Schema.parse(input));
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > V3_SUPERVISOR_RETRY_DIRECTIVE_MAX_BYTES_V1) {
    throw new Error(
      `Canonical supervisor retry directive is ${bytes} UTF-8 bytes; maximum is ${V3_SUPERVISOR_RETRY_DIRECTIVE_MAX_BYTES_V1}`,
    );
  }
  return serialized;
}

export function hashV3SupervisorRetryDirectiveV1(
  input: V3SupervisorRetryDirectiveV1,
): string {
  return V3SupervisorRetryDirectiveV1Schema.parse(input).directiveHash;
}

/**
 * Ordinary story output is not retry evidence. Only this exact schema is
 * parsed; malformed lookalikes throw instead of silently becoming an initial
 * implementation attempt.
 */
export function parseV3SupervisorRetryDirectiveStoryOutputV1(
  output: string | null | undefined,
): V3SupervisorRetryDirectiveV1 | undefined {
  const raw = output?.trim() ?? "";
  if (!raw) return undefined;
  const mentionsSchema = raw.includes(V3_SUPERVISOR_RETRY_DIRECTIVE_ARTIFACT_TYPE_V1);
  if (Buffer.byteLength(raw, "utf8") > V3_SUPERVISOR_RETRY_DIRECTIVE_MAX_BYTES_V1) {
    if (mentionsSchema) {
      throw new Error("Supervisor retry directive story output exceeds its bounded capacity");
    }
    return undefined;
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch (error) {
    if (mentionsSchema) throw error;
    return undefined;
  }
  if (
    !candidate
    || typeof candidate !== "object"
    || Array.isArray(candidate)
    || (candidate as Record<string, unknown>).schema
      !== V3_SUPERVISOR_RETRY_DIRECTIVE_ARTIFACT_TYPE_V1
  ) {
    return undefined;
  }
  const directive = V3SupervisorRetryDirectiveV1Schema.parse(candidate);
  serializeV3SupervisorRetryDirectiveV1(directive);
  return directive;
}
