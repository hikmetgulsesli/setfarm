import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  GitObjectHashSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";
import {
  ConvergenceCanonicalEvidenceV1Schema,
  ConvergenceEvalResultV1Schema,
  ConvergenceEvalRunResultV1Schema,
  ConvergenceGitHubEvidenceV1Schema,
  ConvergenceOwnershipEvidenceV1Schema,
  ConvergencePreflightV1Schema,
  ConvergenceProjectionEvidenceV1Schema,
  createConvergenceResult,
  createConvergenceRunResult,
  type ConvergenceEvalResultV1,
  type ConvergenceEvalRunResultV1,
} from "./result-schema.js";
import {
  ConvergenceProductClassV1Schema,
  ConvergenceRuntimeAdapterV1Schema,
  ConvergenceStackPackV1Schema,
} from "./suite-schema.js";
import {
  TaskIntentOracleEvaluationV2Schema,
  type TaskIntentOracleEvaluationV2,
} from "./task-intent-oracle-v2.js";

const TimestampSchema = z.string().datetime({ offset: true });
const SlugSchema = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const ReasonCodeSchema = z.string().min(3).max(160).regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/);

export const ConvergenceCanonicalEvidenceV2Schema = ConvergenceCanonicalEvidenceV1Schema.extend({
  oracle: TaskIntentOracleEvaluationV2Schema,
}).strict();

const ConvergenceEvalRunPayloadV2BaseSchema = z.object({
  schema: z.literal("setfarm.product-convergence-run-result.v2"),
  suiteId: SlugSchema,
  suiteVersion: z.literal(2),
  suiteHash: Sha256Schema,
  caseId: SlugSchema,
  caseHash: Sha256Schema,
  productClass: ConvergenceProductClassV1Schema,
  repetition: z.number().int().min(1).max(2),
  runId: z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  runNumber: z.number().int().positive(),
  protocol: z.literal("v3"),
  releaseSha: GitObjectHashSchema,
  taskHash: Sha256Schema,
  oracleHash: Sha256Schema,
  expectedDecision: z.enum(["accepted_candidate", "typed_rejection"]),
  expectedProviderHash: Sha256Schema,
  expectedModelHash: Sha256Schema,
  expectedStackHash: Sha256Schema,
  runnerHash: Sha256Schema,
  environmentHash: Sha256Schema,
  expectedStackPackId: ConvergenceStackPackV1Schema.nullable(),
  actualStackPackId: ConvergenceStackPackV1Schema.nullable(),
  runtimeAdapter: ConvergenceRuntimeAdapterV1Schema.nullable(),
  startedAt: TimestampSchema,
  finishedAt: TimestampSchema,
  disposition: z.enum(["completed", "failed", "cancelled", "timeout", "invalidated"]),
  passed: z.boolean(),
  rootCauseHash: Sha256Schema.nullable(),
  canonical: ConvergenceCanonicalEvidenceV2Schema,
  projection: ConvergenceProjectionEvidenceV1Schema,
  ownership: ConvergenceOwnershipEvidenceV1Schema,
  github: ConvergenceGitHubEvidenceV1Schema,
}).strict();

type ConvergenceEvalRunPayloadV2Base = z.infer<typeof ConvergenceEvalRunPayloadV2BaseSchema>;

function projectOracleEvaluationV2ToV1(value: TaskIntentOracleEvaluationV2) {
  const { evaluationHash: _evaluationHash, rejectionContract: _rejectionContract, ...rest } = value;
  const payload = {
    ...rest,
    schema: "setfarm.task-intent-oracle-evaluation.v1" as const,
  };
  return {
    ...payload,
    evaluationHash: hashCanonicalJson(payload),
  };
}

function projectRunPayloadV2ToV1(value: ConvergenceEvalRunPayloadV2Base): ConvergenceEvalRunResultV1 {
  return createConvergenceRunResult({
    ...value,
    schema: "setfarm.product-convergence-run-result.v1",
    suiteVersion: 1,
    canonical: {
      ...value.canonical,
      oracle: projectOracleEvaluationV2ToV1(value.canonical.oracle),
    },
  });
}

function validateRunPayloadV2(
  value: ConvergenceEvalRunPayloadV2Base,
  context: z.RefinementCtx,
): void {
  try {
    projectRunPayloadV2ToV1(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      path: [],
      message: `V1-compatible run result contract failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export const ConvergenceEvalRunPayloadV2Schema = ConvergenceEvalRunPayloadV2BaseSchema.superRefine(
  validateRunPayloadV2,
);

export const ConvergenceEvalRunResultV2Schema = ConvergenceEvalRunPayloadV2BaseSchema.extend({
  resultHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { resultHash, ...payload } = value;
  if (resultHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["resultHash"], message: "Run result hash mismatch" });
  }
  validateRunPayloadV2(payload, context);
});

export type ConvergenceEvalRunResultV2 = z.infer<typeof ConvergenceEvalRunResultV2Schema>;
export type ConvergenceEvalRunPayloadV2 = z.infer<typeof ConvergenceEvalRunPayloadV2Schema>;

const RootCauseCountV2Schema = z.object({
  rootCauseHash: Sha256Schema,
  count: z.number().int().min(1).max(3),
}).strict();

const ConvergenceEvalResultPayloadV2BaseSchema = z.object({
  schema: z.literal("setfarm.product-convergence-result.v2"),
  suiteId: SlugSchema,
  suiteVersion: z.literal(2),
  suiteHash: Sha256Schema,
  releaseSha: GitObjectHashSchema,
  runnerHash: Sha256Schema,
  environmentHash: Sha256Schema,
  executionMode: z.enum(["preflight", "execute"]),
  startedAt: TimestampSchema,
  finishedAt: TimestampSchema,
  plannedRuns: z.number().int().min(8).max(16),
  status: z.enum(["planned", "pass", "fail", "blocked"]),
  preflight: ConvergencePreflightV1Schema,
  runs: z.array(ConvergenceEvalRunResultV2Schema).max(16),
  rootCauseCounts: z.array(RootCauseCountV2Schema).max(16),
  stoppedOnRepeatedRootCause: Sha256Schema.nullable(),
  blockerCodes: z.array(ReasonCodeSchema).max(100).refine(hasUniqueStrings, {
    message: "Blocker codes must be unique",
  }),
}).strict();

type ConvergenceEvalResultPayloadV2Base = z.infer<typeof ConvergenceEvalResultPayloadV2BaseSchema>;

function projectResultPayloadV2ToV1(value: ConvergenceEvalResultPayloadV2Base): ConvergenceEvalResultV1 {
  return createConvergenceResult({
    ...value,
    schema: "setfarm.product-convergence-result.v1",
    suiteVersion: 1,
    runs: value.runs.map(({ resultHash: _resultHash, ...run }) => projectRunPayloadV2ToV1(run)),
  });
}

function validateResultPayloadV2(
  value: ConvergenceEvalResultPayloadV2Base,
  context: z.RefinementCtx,
): void {
  try {
    projectResultPayloadV2ToV1(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      path: [],
      message: `V1-compatible suite result contract failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export const ConvergenceEvalResultPayloadV2Schema = ConvergenceEvalResultPayloadV2BaseSchema.superRefine(
  validateResultPayloadV2,
);

export const ConvergenceEvalResultV2Schema = ConvergenceEvalResultPayloadV2BaseSchema.extend({
  resultHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { resultHash, ...payload } = value;
  if (resultHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["resultHash"], message: "Suite result hash mismatch" });
  }
  validateResultPayloadV2(payload, context);
});

export type ConvergenceEvalResultV2 = z.infer<typeof ConvergenceEvalResultV2Schema>;
export type ConvergenceEvalResultPayloadV2 = z.infer<typeof ConvergenceEvalResultPayloadV2Schema>;

export const ConvergenceEvalRunResultVersionedSchema = z.union([
  ConvergenceEvalRunResultV1Schema,
  ConvergenceEvalRunResultV2Schema,
]);
export type ConvergenceEvalRunResultVersioned = z.infer<typeof ConvergenceEvalRunResultVersionedSchema>;

export const ConvergenceEvalResultVersionedSchema = z.union([
  ConvergenceEvalResultV1Schema,
  ConvergenceEvalResultV2Schema,
]);
export type ConvergenceEvalResultVersioned = z.infer<typeof ConvergenceEvalResultVersionedSchema>;

export function readConvergenceEvalRunResultVersioned(value: unknown): ConvergenceEvalRunResultVersioned {
  return ConvergenceEvalRunResultVersionedSchema.parse(value);
}

export function readConvergenceEvalResultVersioned(value: unknown): ConvergenceEvalResultVersioned {
  return ConvergenceEvalResultVersionedSchema.parse(value);
}

export function createConvergenceRunResultV2(input: unknown): ConvergenceEvalRunResultV2 {
  const payload = ConvergenceEvalRunPayloadV2Schema.parse(input);
  return ConvergenceEvalRunResultV2Schema.parse({ ...payload, resultHash: hashCanonicalJson(payload) });
}

export function createConvergenceResultV2(input: unknown): ConvergenceEvalResultV2 {
  const payload = ConvergenceEvalResultPayloadV2Schema.parse(input);
  return ConvergenceEvalResultV2Schema.parse({ ...payload, resultHash: hashCanonicalJson(payload) });
}
