import { createHash } from "node:crypto";
import path from "node:path";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";

export const V3_STAGE_PREVIOUS_OUTPUT_MAX_BYTES = 4 * 1024 * 1024;
export const V3_STAGE_FAILURE_MAX_BYTES = 24 * 1024;
export const V3_STAGE_FAILURE_TRANSPORT_MAX_BYTES = 60 * 1024;
export const V3_STAGE_FAILURE_TRANSPORT_PREFIX = "V3_STAGE_FAILURE_V1:";

const BoundedIdentitySchema = z.string().min(1).max(500);
const AbsolutePathSchema = z.string().min(1).max(4_000).refine(
  (value) => path.isAbsolute(value),
  "Stage retry paths must be absolute",
);

export const V3StageFailureDiagnosticV1Schema = z.object({
  code: z.string().min(1).max(500),
  path: z.string().max(4_000),
  message: z.string().min(1).max(4_000),
  reference: z.string().min(1).max(500).optional(),
}).strict();

const V3StageFailureShapeV1Schema = z.object({
  schema: z.literal("setfarm.v3-stage-failure.v1"),
  workflowStepId: BoundedIdentitySchema,
  kind: z.enum([
    "output_contract_invalid",
    "output_semantics_invalid",
    "stage_contract_conflict",
    "unstructured_legacy_failure",
  ]),
  diagnostics: z.array(V3StageFailureDiagnosticV1Schema).min(1).max(20),
  failureHash: Sha256Schema,
}).strict();

function failurePayload(
  value: z.infer<typeof V3StageFailureShapeV1Schema>,
): Record<string, unknown> {
  const { failureHash: _failureHash, ...payload } = value;
  return payload;
}

export const V3StageFailureV1Schema = V3StageFailureShapeV1Schema.superRefine(
  (value, context) => {
    if (hashCanonicalJson(failurePayload(value)) !== value.failureHash) {
      context.addIssue({
        code: "custom",
        path: ["failureHash"],
        message: "Stage failure hash must bind the exact canonical diagnostics",
      });
    }
    if (Buffer.byteLength(canonicalJsonStringify(value), "utf8") > V3_STAGE_FAILURE_MAX_BYTES) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "Stage failure exceeds its bounded retry-context capacity",
      });
    }
  },
);

export type V3StageFailureDiagnosticV1 = z.infer<typeof V3StageFailureDiagnosticV1Schema>;
export type V3StageFailureV1 = z.infer<typeof V3StageFailureV1Schema>;

export function createV3StageFailureV1(input: Readonly<{
  workflowStepId: string;
  kind: V3StageFailureV1["kind"];
  diagnostics: readonly V3StageFailureDiagnosticV1[];
}>): V3StageFailureV1 {
  let diagnostics = input.diagnostics.slice(0, 20).map((diagnostic) => ({
    code: String(diagnostic.code).slice(0, 500) || "V3_STAGE_FAILURE",
    path: String(diagnostic.path).slice(0, 4_000),
    message: String(diagnostic.message).slice(0, 4_000) || "Stage failure diagnostic unavailable",
    ...(diagnostic.reference
      ? { reference: String(diagnostic.reference).slice(0, 500) }
      : {}),
  }));
  if (diagnostics.length === 0) {
    diagnostics = [{
      code: "V3_STAGE_FAILURE",
      path: "",
      message: "Stage failure diagnostic unavailable",
    }];
  }
  let payload = {
    schema: "setfarm.v3-stage-failure.v1" as const,
    workflowStepId: input.workflowStepId,
    kind: input.kind,
    diagnostics,
  };
  let candidate = {
    ...payload,
    failureHash: hashCanonicalJson(payload),
  };
  if (Buffer.byteLength(canonicalJsonStringify(candidate), "utf8") > V3_STAGE_FAILURE_MAX_BYTES) {
    diagnostics = diagnostics.map((diagnostic) => ({
      code: diagnostic.code.slice(0, 48),
      path: diagnostic.path.slice(0, 48),
      message: diagnostic.message.slice(0, 48),
      ...(diagnostic.reference ? { reference: diagnostic.reference.slice(0, 48) } : {}),
    }));
    payload = { ...payload, diagnostics };
    candidate = { ...payload, failureHash: hashCanonicalJson(payload) };
  }
  return V3StageFailureV1Schema.parse(candidate);
}

export function serializeV3StageFailureDiagnostic(
  humanCode: string,
  failure: V3StageFailureV1,
): string {
  const parsed = V3StageFailureV1Schema.parse(failure);
  const summary = parsed.diagnostics
    .slice(0, 20)
    .map((diagnostic) => `${diagnostic.code}:${diagnostic.path}`)
    .join(";");
  const transport = `${humanCode}: ${summary}\n${V3_STAGE_FAILURE_TRANSPORT_PREFIX}${canonicalJsonStringify(parsed)}`;
  if (Buffer.byteLength(transport, "utf8") > V3_STAGE_FAILURE_TRANSPORT_MAX_BYTES) {
    throw new Error("V3_STAGE_FAILURE_TRANSPORT_CAPACITY_EXCEEDED");
  }
  return transport;
}

export function recoverV3StageFailureV1(input: Readonly<{
  workflowStepId: string;
  diagnostic: string;
}>): V3StageFailureV1 {
  const diagnostic = String(input.diagnostic || "").trim();
  const marker = diagnostic.indexOf(V3_STAGE_FAILURE_TRANSPORT_PREFIX);
  if (marker >= 0) {
    const encoded = diagnostic.slice(marker + V3_STAGE_FAILURE_TRANSPORT_PREFIX.length);
    try {
      const parsed = V3StageFailureV1Schema.parse(JSON.parse(encoded));
      if (parsed.workflowStepId === input.workflowStepId) return parsed;
    } catch {
      // A malformed transport is retained below as exact unstructured evidence.
    }
  }
  return createV3StageFailureV1({
    workflowStepId: input.workflowStepId,
    kind: "unstructured_legacy_failure",
    diagnostics: [{
      code: "V3_STAGE_PREVIOUS_FAILURE_UNSTRUCTURED",
      path: "",
      message: diagnostic.slice(0, 4_000) || "Previous stage failure diagnostic was unavailable",
    }],
  });
}

const V3StageRetrySourceShapeV1Schema = z.object({
  schema: z.literal("setfarm.v3-stage-retry-source.v1"),
  retryOrdinal: z.number().int().positive(),
  maxRetries: z.number().int().positive(),
  previousClaimId: z.number().int().positive(),
  previousInstruction: z.object({
    artifactHash: Sha256Schema,
    byteLength: z.number().int().positive().max(192 * 1024),
  }).strict(),
  previousOutput: z.object({
    artifactHash: Sha256Schema,
    byteLength: z.number().int().positive().max(V3_STAGE_PREVIOUS_OUTPUT_MAX_BYTES),
    content: z.string().min(1).max(V3_STAGE_PREVIOUS_OUTPUT_MAX_BYTES),
  }).strict(),
  failure: V3StageFailureV1Schema,
}).strict();

export const V3StageRetrySourceV1Schema = V3StageRetrySourceShapeV1Schema.superRefine(
  (value, context) => {
    if (value.retryOrdinal > value.maxRetries) {
      context.addIssue({
        code: "custom",
        path: ["retryOrdinal"],
        message: "Stage retry ordinal cannot exceed the bounded retry budget",
      });
    }
    const outputBytes = Buffer.from(value.previousOutput.content, "utf8");
    if (outputBytes.length !== value.previousOutput.byteLength) {
      context.addIssue({
        code: "custom",
        path: ["previousOutput", "byteLength"],
        message: "Previous stage output byte length differs from the exact artifact",
      });
    }
    const outputHash = createHash("sha256").update(outputBytes).digest("hex");
    if (outputHash !== value.previousOutput.artifactHash) {
      context.addIssue({
        code: "custom",
        path: ["previousOutput", "artifactHash"],
        message: "Previous stage output hash differs from the exact artifact bytes",
      });
    }
  },
);

export type V3StageRetrySourceV1 = z.infer<typeof V3StageRetrySourceV1Schema>;

export function createV3StageRetrySourceV1(input: Readonly<{
  workflowStepId: string;
  retryOrdinal: number;
  maxRetries: number;
  previousClaimId: number;
  previousInstructionContent: string;
  previousOutputContent: string;
  diagnostic: string;
}>): V3StageRetrySourceV1 {
  const previousInstruction = Buffer.from(input.previousInstructionContent, "utf8");
  const previousOutput = Buffer.from(input.previousOutputContent, "utf8");
  return V3StageRetrySourceV1Schema.parse({
    schema: "setfarm.v3-stage-retry-source.v1",
    retryOrdinal: input.retryOrdinal,
    maxRetries: input.maxRetries,
    previousClaimId: input.previousClaimId,
    previousInstruction: {
      artifactHash: createHash("sha256").update(previousInstruction).digest("hex"),
      byteLength: previousInstruction.length,
    },
    previousOutput: {
      artifactHash: createHash("sha256").update(previousOutput).digest("hex"),
      byteLength: previousOutput.length,
      content: input.previousOutputContent,
    },
    failure: recoverV3StageFailureV1({
      workflowStepId: input.workflowStepId,
      diagnostic: input.diagnostic,
    }),
  });
}

const V3StageRetryDirectiveShapeV1Schema = z.object({
  schema: z.literal("setfarm.v3-stage-retry-directive.v1"),
  owner: z.literal("stage_agent"),
  retryOrdinal: z.number().int().positive(),
  maxRetries: z.number().int().positive(),
  previousClaimId: z.number().int().positive(),
  sourceState: z.object({
    disposition: z.enum(["instruction_unchanged", "instruction_changed"]),
    previousInstructionHash: Sha256Schema,
    currentInstructionHash: Sha256Schema,
  }).strict(),
  previousOutput: z.object({
    artifactHash: Sha256Schema,
    byteLength: z.number().int().positive().max(V3_STAGE_PREVIOUS_OUTPUT_MAX_BYTES),
    mediaType: z.literal("text/plain; charset=utf-8"),
    path: AbsolutePathSchema,
  }).strict(),
  failure: V3StageFailureV1Schema,
  expectedDelta: z.object({
    kind: z.literal("repair_previous_output"),
    baseOutputHash: Sha256Schema,
    mustChangeOutputHash: z.literal(true),
    resolveFailureHash: Sha256Schema,
    preserveInstructionHash: Sha256Schema,
  }).strict(),
  dedupeKey: Sha256Schema,
}).strict();

export function createV3StageRetryDedupeKeyV1(input: Readonly<{
  workflowStepId: string;
  previousInstructionHash: string;
  currentInstructionHash: string;
  previousOutputHash: string;
  failureHash: string;
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.v3-stage-retry-dedupe-tuple.v1",
    workflowStepId: input.workflowStepId,
    previousInstructionHash: Sha256Schema.parse(input.previousInstructionHash),
    currentInstructionHash: Sha256Schema.parse(input.currentInstructionHash),
    previousOutputHash: Sha256Schema.parse(input.previousOutputHash),
    failureHash: Sha256Schema.parse(input.failureHash),
  });
}

export const V3StageRetryDirectiveV1Schema = V3StageRetryDirectiveShapeV1Schema.superRefine(
  (value, context) => {
    if (value.retryOrdinal > value.maxRetries) {
      context.addIssue({
        code: "custom",
        path: ["retryOrdinal"],
        message: "Stage retry ordinal cannot exceed the bounded retry budget",
      });
    }
    const expectedDisposition = value.sourceState.previousInstructionHash
      === value.sourceState.currentInstructionHash
      ? "instruction_unchanged"
      : "instruction_changed";
    if (value.sourceState.disposition !== expectedDisposition) {
      context.addIssue({
        code: "custom",
        path: ["sourceState", "disposition"],
        message: "Stage retry source disposition must reflect exact instruction hashes",
      });
    }
    if (
      value.expectedDelta.baseOutputHash !== value.previousOutput.artifactHash
      || value.expectedDelta.resolveFailureHash !== value.failure.failureHash
      || value.expectedDelta.preserveInstructionHash !== value.sourceState.currentInstructionHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedDelta"],
        message: "Expected stage delta must bind the exact output, failure, and instruction",
      });
    }
    const expectedDedupeKey = createV3StageRetryDedupeKeyV1({
      workflowStepId: value.failure.workflowStepId,
      previousInstructionHash: value.sourceState.previousInstructionHash,
      currentInstructionHash: value.sourceState.currentInstructionHash,
      previousOutputHash: value.previousOutput.artifactHash,
      failureHash: value.failure.failureHash,
    });
    if (expectedDedupeKey !== value.dedupeKey) {
      context.addIssue({
        code: "custom",
        path: ["dedupeKey"],
        message: "Stage retry dedupe key must bind the complete canonical directive",
      });
    }
  },
);

export type V3StageRetryDirectiveV1 = z.infer<typeof V3StageRetryDirectiveV1Schema>;

export function createV3StageRetryDirectiveV1(input: Readonly<{
  source: V3StageRetrySourceV1;
  currentInstructionContent: string;
  workdir: string;
  currentClaimId: number;
}>): V3StageRetryDirectiveV1 {
  const source = V3StageRetrySourceV1Schema.parse(input.source);
  const currentInstructionHash = createHash("sha256")
    .update(Buffer.from(input.currentInstructionContent, "utf8"))
    .digest("hex");
  const previousOutputPath = path.join(
    path.resolve(input.workdir),
    ".setfarm",
    "stage-executions",
    `claim-${input.currentClaimId}`,
    "previous-output.txt",
  );
  const payload = {
    schema: "setfarm.v3-stage-retry-directive.v1" as const,
    owner: "stage_agent" as const,
    retryOrdinal: source.retryOrdinal,
    maxRetries: source.maxRetries,
    previousClaimId: source.previousClaimId,
    sourceState: {
      disposition: source.previousInstruction.artifactHash === currentInstructionHash
        ? "instruction_unchanged" as const
        : "instruction_changed" as const,
      previousInstructionHash: source.previousInstruction.artifactHash,
      currentInstructionHash,
    },
    previousOutput: {
      artifactHash: source.previousOutput.artifactHash,
      byteLength: source.previousOutput.byteLength,
      mediaType: "text/plain; charset=utf-8" as const,
      path: previousOutputPath,
    },
    failure: source.failure,
    expectedDelta: {
      kind: "repair_previous_output" as const,
      baseOutputHash: source.previousOutput.artifactHash,
      mustChangeOutputHash: true as const,
      resolveFailureHash: source.failure.failureHash,
      preserveInstructionHash: currentInstructionHash,
    },
  };
  return V3StageRetryDirectiveV1Schema.parse({
    ...payload,
    dedupeKey: createV3StageRetryDedupeKeyV1({
      workflowStepId: source.failure.workflowStepId,
      previousInstructionHash: source.previousInstruction.artifactHash,
      currentInstructionHash,
      previousOutputHash: source.previousOutput.artifactHash,
      failureHash: source.failure.failureHash,
    }),
  });
}
