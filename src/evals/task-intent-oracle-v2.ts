import { createHash } from "node:crypto";

import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { ProductSpecRejectionV1Schema } from "../product-compiler/producers/plan-product-spec-proposal.js";
import {
  RequirementIdSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";
import {
  AcceptedDecisionV1Schema,
  OracleClauseV1Schema,
  RejectionCodeSchema,
  TaskIntentExpectationV1Schema,
  TaskIntentOracleEvaluationV1Schema,
  TaskIntentOracleV1Schema,
  evaluateTaskIntentOracleTaskBindingV1,
  evaluateTaskIntentOracleV1,
  type TaskIntentOracleActualV1,
  type TaskIntentOracleEvaluationV1,
  type TaskIntentOracleV1,
} from "./task-intent-oracle.js";

const SlugSchema = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const ReasonCodeSchema = z.string().min(3).max(160).regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/);
const LocaleSchema = z.string().min(2).max(35).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);

const RejectionCodeListSchema = z.array(RejectionCodeSchema).min(1).max(4).refine(hasUniqueStrings, {
  message: "Oracle rejection reason codes must be unique",
});

export const OracleReasonRequirementV2Schema = z.object({
  reasonCode: RejectionCodeSchema,
  clauseRefs: z.array(SlugSchema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Oracle reason clause refs must be unique",
  }),
}).strict();

const RejectionDecisionV2Schema = z.object({
  kind: z.literal("typed_rejection"),
  requiredReasonCodes: RejectionCodeListSchema,
  allowedReasonCodes: RejectionCodeListSchema,
  reasonRequirements: z.array(OracleReasonRequirementV2Schema).min(1).max(4),
}).strict();

const TaskIntentOracleV2BaseSchema = z.object({
  schema: z.literal("setfarm.task-intent-oracle.v2"),
  oracleId: SlugSchema,
  oracleVersion: z.literal(2),
  locale: LocaleSchema,
  cohort: z.enum(["baseline", "holdout", "negative"]),
  variant: z.enum(["direct", "paraphrase", "multilingual", "ambiguous", "unsupported"]),
  expectedDecision: z.discriminatedUnion("kind", [AcceptedDecisionV1Schema, RejectionDecisionV2Schema]),
  clauses: z.array(OracleClauseV1Schema).min(1).max(1_000),
  expectations: z.array(TaskIntentExpectationV1Schema).max(2_000),
}).strict();

type TaskIntentOracleV2Base = z.infer<typeof TaskIntentOracleV2BaseSchema>;

function canonicalStrings<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort();
}

function exactStrings(left: readonly string[], right: readonly string[]): boolean {
  const canonicalLeft = canonicalStrings(left);
  const canonicalRight = canonicalStrings(right);
  return canonicalLeft.length === canonicalRight.length
    && canonicalLeft.every((value, index) => value === canonicalRight[index]);
}

function projectParsedOracleV2ToV1(value: TaskIntentOracleV2Base): TaskIntentOracleV1 {
  return TaskIntentOracleV1Schema.parse({
    ...value,
    schema: "setfarm.task-intent-oracle.v1",
    oracleVersion: 1,
    expectedDecision: value.expectedDecision.kind === "typed_rejection"
      ? { kind: "typed_rejection", reasonCodes: value.expectedDecision.requiredReasonCodes }
      : value.expectedDecision,
  });
}

export const TaskIntentOracleV2Schema = TaskIntentOracleV2BaseSchema.superRefine((value, context) => {
  const projected = TaskIntentOracleV1Schema.safeParse({
    ...value,
    schema: "setfarm.task-intent-oracle.v1",
    oracleVersion: 1,
    expectedDecision: value.expectedDecision.kind === "typed_rejection"
      ? { kind: "typed_rejection", reasonCodes: value.expectedDecision.requiredReasonCodes }
      : value.expectedDecision,
  });
  if (!projected.success) {
    projected.error.issues.forEach((issue) => context.addIssue({
      code: "custom",
      path: issue.path,
      message: `V1-compatible oracle contract failed: ${issue.message}`,
    }));
  }

  if (value.expectedDecision.kind !== "typed_rejection") return;
  const decision = value.expectedDecision;
  const allowed = new Set(decision.allowedReasonCodes);
  decision.requiredReasonCodes.forEach((reasonCode, index) => {
    if (!allowed.has(reasonCode)) {
      context.addIssue({
        code: "custom",
        path: ["expectedDecision", "requiredReasonCodes", index],
        message: `Required rejection code is not allowed: ${reasonCode}`,
      });
    }
  });
  if (decision.allowedReasonCodes.length >= RejectionCodeSchema.options.length) {
    context.addIssue({
      code: "custom",
      path: ["expectedDecision", "allowedReasonCodes"],
      message: "Typed-negative oracle must remain selective; allowing every rejection code is forbidden",
    });
  }

  const declaredCodes = decision.reasonRequirements.map((item) => item.reasonCode);
  if (!hasUniqueStrings(declaredCodes)) {
    context.addIssue({
      code: "custom",
      path: ["expectedDecision", "reasonRequirements"],
      message: "Oracle reason requirement ownership must declare each code once",
    });
  }
  if (!exactStrings(declaredCodes, decision.allowedReasonCodes)) {
    context.addIssue({
      code: "custom",
      path: ["expectedDecision", "reasonRequirements"],
      message: "Oracle reason requirement ownership must cover exactly the allowed reason codes",
    });
  }

  const clauseIds = new Set(value.clauses.map((clause) => clause.clauseId));
  const ownedClauseIds = new Set<string>();
  decision.reasonRequirements.forEach((item, itemIndex) => {
    item.clauseRefs.forEach((clauseRef, clauseIndex) => {
      if (!clauseIds.has(clauseRef)) {
        context.addIssue({
          code: "custom",
          path: ["expectedDecision", "reasonRequirements", itemIndex, "clauseRefs", clauseIndex],
          message: `Oracle reason requirement references absent clause ${clauseRef}`,
        });
      } else {
        ownedClauseIds.add(clauseRef);
      }
    });
  });
  if ([...clauseIds].some((clauseId) => !ownedClauseIds.has(clauseId))) {
    context.addIssue({
      code: "custom",
      path: ["expectedDecision", "reasonRequirements"],
      message: "Typed-negative oracle must assign every source clause to at least one declared reason",
    });
  }
});

export type TaskIntentOracleV2 = z.infer<typeof TaskIntentOracleV2Schema>;
export type TaskIntentOracleActualV2 = TaskIntentOracleActualV1;

export const TaskIntentOracleVersionedSchema = z.union([
  TaskIntentOracleV1Schema,
  TaskIntentOracleV2Schema,
]);
export type TaskIntentOracleVersioned = z.infer<typeof TaskIntentOracleVersionedSchema>;

export function readTaskIntentOracleVersioned(value: unknown): TaskIntentOracleVersioned {
  return TaskIntentOracleVersionedSchema.parse(value);
}

export function projectTaskIntentOracleV2ToV1(value: unknown): TaskIntentOracleV1 {
  return projectParsedOracleV2ToV1(TaskIntentOracleV2Schema.parse(value));
}

export function evaluateTaskIntentOracleTaskBindingV2(task: string, rawOracle: unknown) {
  return evaluateTaskIntentOracleTaskBindingV1(task, projectTaskIntentOracleV2ToV1(rawOracle));
}

export function taskIntentOracleHashV2(task: string, rawOracle: unknown): string {
  const oracle = TaskIntentOracleV2Schema.parse(rawOracle);
  const taskSourceHash = createHash("sha256").update(Buffer.from(task, "utf8")).digest("hex");
  return hashCanonicalJson({
    schema: "setfarm.task-intent-oracle-identity.v2",
    taskSourceHash,
    oracle,
  });
}

const ReasonRequirementEvidenceV2Schema = z.object({
  reasonCode: RejectionCodeSchema,
  requirementRefs: z.array(RequirementIdSchema).max(1_000).refine(hasUniqueStrings, {
    message: "Oracle reason requirement evidence refs must be unique",
  }),
}).strict();

export const TaskIntentTypedRejectionEvaluationV2Schema = z.object({
  requiredReasonCodes: RejectionCodeListSchema,
  allowedReasonCodes: RejectionCodeListSchema,
  actualReasonCodes: z.array(RejectionCodeSchema).max(4).refine(hasUniqueStrings, {
    message: "Actual rejection reason code set must be unique",
  }),
  declaredReasonRequirements: z.array(ReasonRequirementEvidenceV2Schema).min(1).max(4),
  actualReasonRequirements: z.array(ReasonRequirementEvidenceV2Schema).max(100),
}).strict().superRefine((value, context) => {
  if (value.requiredReasonCodes.some((code) => !value.allowedReasonCodes.includes(code))) {
    context.addIssue({ code: "custom", path: ["requiredReasonCodes"], message: "Required reason codes must be allowed" });
  }
  const declaredCodes = value.declaredReasonRequirements.map((item) => item.reasonCode);
  if (!hasUniqueStrings(declaredCodes) || !exactStrings(declaredCodes, value.allowedReasonCodes)) {
    context.addIssue({
      code: "custom",
      path: ["declaredReasonRequirements"],
      message: "Declared reason requirements must own exactly the allowed reason code set",
    });
  }
  const actualCodes = canonicalStrings(value.actualReasonRequirements.map((item) => item.reasonCode));
  if (!exactStrings(actualCodes, value.actualReasonCodes)) {
    context.addIssue({
      code: "custom",
      path: ["actualReasonCodes"],
      message: "Actual reason code set must reduce actual reason requirement evidence",
    });
  }
});

const OracleEvaluationPayloadV2BaseSchema = z.object({
  schema: z.literal("setfarm.task-intent-oracle-evaluation.v2"),
  oracleHash: Sha256Schema,
  expectedDecision: z.enum(["accepted_candidate", "typed_rejection"]),
  actualDecision: z.enum(["accepted_candidate", "typed_rejection", "unavailable"]),
  contractComplete: z.boolean(),
  decisionEvidenceVerified: z.boolean(),
  matchedIntentIds: z.array(SlugSchema).max(2_000).refine(hasUniqueStrings),
  requiredEvidenceRefs: z.array(z.string().regex(/^EVID_[A-Z0-9]+(?:_[A-Z0-9]+)*$/)).max(10_000).refine(hasUniqueStrings),
  rejectionContract: TaskIntentTypedRejectionEvaluationV2Schema.nullable(),
  mismatchCodes: z.array(ReasonCodeSchema).max(10_000).refine(hasUniqueStrings),
}).strict();

type OracleEvaluationPayloadV2Base = z.infer<typeof OracleEvaluationPayloadV2BaseSchema>;

function validateOracleEvaluationPayloadV2(
  value: OracleEvaluationPayloadV2Base,
  context: z.RefinementCtx,
): void {
  if ((value.expectedDecision === "typed_rejection") !== (value.rejectionContract !== null)) {
    context.addIssue({
      code: "custom",
      path: ["rejectionContract"],
      message: "Only typed-negative evaluations carry a rejection contract",
    });
  }
  const contract = value.rejectionContract;
  if (!contract) return;
  const actualCodes = new Set(contract.actualReasonCodes);
  const declaredByCode = new Map(contract.declaredReasonRequirements
    .map((item) => [item.reasonCode, item.requirementRefs] as const));
  const actualCodeRows = contract.actualReasonRequirements.map((item) => item.reasonCode);
  const reasonContractClean = value.actualDecision === "typed_rejection"
    && contract.requiredReasonCodes.every((code) => actualCodes.has(code))
    && contract.actualReasonCodes.every((code) => contract.allowedReasonCodes.includes(code))
    && hasUniqueStrings(actualCodeRows)
    && contract.declaredReasonRequirements.every((item) => item.requirementRefs.length > 0)
    && contract.actualReasonRequirements.every((item) => {
      const declared = declaredByCode.get(item.reasonCode);
      return Boolean(declared && item.requirementRefs.length > 0 && exactStrings(declared, item.requirementRefs));
    });
  if ((value.contractComplete || value.decisionEvidenceVerified) && !reasonContractClean) {
    context.addIssue({
      code: "custom",
      path: ["rejectionContract"],
      message: "Passing typed-negative evidence must satisfy required, allowed, unique, and exact requirement ownership semantics",
    });
  }
}

const OracleEvaluationPayloadV2Schema = OracleEvaluationPayloadV2BaseSchema.superRefine(
  validateOracleEvaluationPayloadV2,
);

export const TaskIntentOracleEvaluationV2Schema = OracleEvaluationPayloadV2BaseSchema.extend({
  evaluationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { evaluationHash, ...payload } = value;
  validateOracleEvaluationPayloadV2(payload, context);
  if (evaluationHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["evaluationHash"], message: "Oracle evaluation hash mismatch" });
  }
  const passed = value.mismatchCodes.length === 0 && value.contractComplete && value.decisionEvidenceVerified;
  if (!passed && value.mismatchCodes.length === 0) {
    context.addIssue({ code: "custom", path: ["mismatchCodes"], message: "Non-passing oracle evaluation requires a reason" });
  }
});

export type TaskIntentOracleEvaluationV2 = z.infer<typeof TaskIntentOracleEvaluationV2Schema>;

export const TaskIntentOracleEvaluationVersionedSchema = z.union([
  TaskIntentOracleEvaluationV1Schema,
  TaskIntentOracleEvaluationV2Schema,
]);
export type TaskIntentOracleEvaluationVersioned = z.infer<typeof TaskIntentOracleEvaluationVersionedSchema>;

export function readTaskIntentOracleEvaluationVersioned(value: unknown): TaskIntentOracleEvaluationVersioned {
  return TaskIntentOracleEvaluationVersionedSchema.parse(value);
}

function declaredReasonRequirements(
  oracle: TaskIntentOracleV2,
  requirementIdsByClause: ReadonlyMap<string, string>,
): z.infer<typeof ReasonRequirementEvidenceV2Schema>[] {
  if (oracle.expectedDecision.kind !== "typed_rejection") return [];
  return oracle.expectedDecision.reasonRequirements.map((declaration) => ({
    reasonCode: declaration.reasonCode,
    requirementRefs: canonicalStrings(declaration.clauseRefs
      .map((clauseRef) => requirementIdsByClause.get(clauseRef))
      .filter((requirementRef): requirementRef is string => Boolean(requirementRef))),
  })).sort((left, right) => left.reasonCode.localeCompare(right.reasonCode));
}

function canonicalReasonRequirements(
  values: readonly z.infer<typeof ReasonRequirementEvidenceV2Schema>[],
): z.infer<typeof ReasonRequirementEvidenceV2Schema>[] {
  return values.map((item) => ({
    reasonCode: item.reasonCode,
    requirementRefs: canonicalStrings(item.requirementRefs),
  })).sort((left, right) => {
    const byCode = left.reasonCode.localeCompare(right.reasonCode);
    return byCode || left.requirementRefs.join("\0").localeCompare(right.requirementRefs.join("\0"));
  });
}

export function createTaskIntentOracleEvaluationV2(
  payload: z.input<typeof OracleEvaluationPayloadV2Schema>,
): TaskIntentOracleEvaluationV2 {
  const parsed = OracleEvaluationPayloadV2Schema.parse({
    ...payload,
    matchedIntentIds: canonicalStrings(payload.matchedIntentIds),
    requiredEvidenceRefs: canonicalStrings(payload.requiredEvidenceRefs),
    rejectionContract: payload.rejectionContract
      ? {
          ...payload.rejectionContract,
          requiredReasonCodes: canonicalStrings(payload.rejectionContract.requiredReasonCodes),
          allowedReasonCodes: canonicalStrings(payload.rejectionContract.allowedReasonCodes),
          actualReasonCodes: canonicalStrings(payload.rejectionContract.actualReasonCodes),
          declaredReasonRequirements: canonicalReasonRequirements(payload.rejectionContract.declaredReasonRequirements),
          actualReasonRequirements: canonicalReasonRequirements(payload.rejectionContract.actualReasonRequirements),
        }
      : null,
    mismatchCodes: canonicalStrings(payload.mismatchCodes),
  });
  return TaskIntentOracleEvaluationV2Schema.parse({
    ...parsed,
    evaluationHash: hashCanonicalJson(parsed),
  });
}

function projectEvaluationV1ToV2(
  evaluation: TaskIntentOracleEvaluationV1,
  oracleHash: string,
  rejectionContract: z.infer<typeof TaskIntentTypedRejectionEvaluationV2Schema> | null,
): TaskIntentOracleEvaluationV2 {
  return createTaskIntentOracleEvaluationV2({
    schema: "setfarm.task-intent-oracle-evaluation.v2",
    oracleHash,
    expectedDecision: evaluation.expectedDecision,
    actualDecision: evaluation.actualDecision,
    contractComplete: evaluation.contractComplete,
    decisionEvidenceVerified: evaluation.decisionEvidenceVerified,
    matchedIntentIds: evaluation.matchedIntentIds,
    requiredEvidenceRefs: evaluation.requiredEvidenceRefs,
    rejectionContract,
    mismatchCodes: evaluation.mismatchCodes,
  });
}

function rejectionContractEvidence(
  oracle: TaskIntentOracleV2,
  binding: ReturnType<typeof evaluateTaskIntentOracleTaskBindingV1>,
  actualReasonRequirements: readonly z.infer<typeof ReasonRequirementEvidenceV2Schema>[],
): z.infer<typeof TaskIntentTypedRejectionEvaluationV2Schema> | null {
  if (oracle.expectedDecision.kind !== "typed_rejection") return null;
  return {
    requiredReasonCodes: canonicalStrings(oracle.expectedDecision.requiredReasonCodes),
    allowedReasonCodes: canonicalStrings(oracle.expectedDecision.allowedReasonCodes),
    actualReasonCodes: canonicalStrings(actualReasonRequirements.map((item) => item.reasonCode)),
    declaredReasonRequirements: declaredReasonRequirements(oracle, binding.requirementIdsByClause),
    actualReasonRequirements: canonicalReasonRequirements(actualReasonRequirements),
  };
}

export function evaluateTaskIntentOracleV2(input: Readonly<{
  task: string;
  oracle: unknown;
  actual: TaskIntentOracleActualV2;
}>): TaskIntentOracleEvaluationV2 {
  const oracle = TaskIntentOracleV2Schema.parse(input.oracle);
  const projectedOracle = projectParsedOracleV2ToV1(oracle);
  const oracleHash = taskIntentOracleHashV2(input.task, oracle);
  const binding = evaluateTaskIntentOracleTaskBindingV1(input.task, projectedOracle);

  if (input.actual.kind !== "typed_rejection") {
    const evaluation = evaluateTaskIntentOracleV1({
      task: input.task,
      oracle: projectedOracle,
      actual: input.actual,
    });
    return projectEvaluationV1ToV2(
      evaluation,
      oracleHash,
      rejectionContractEvidence(oracle, binding, []),
    );
  }

  const mismatches = new Set<string>(binding.mismatchCodes);
  const expectedDecision = oracle.expectedDecision.kind;
  if (expectedDecision !== "typed_rejection") mismatches.add("ORACLE_DECISION_MISMATCH");
  const parsedRejection = ProductSpecRejectionV1Schema.safeParse(input.actual.rejection);
  const actualReasonRequirements: z.infer<typeof ReasonRequirementEvidenceV2Schema>[] = [];
  if (!parsedRejection.success) {
    mismatches.add("ORACLE_TYPED_REJECTION_INVALID");
  } else {
    const sourceTaskHash = createHash("sha256").update(Buffer.from(input.task, "utf8")).digest("hex");
    if (parsedRejection.data.sourceTaskHash !== sourceTaskHash) mismatches.add("ORACLE_TASK_HASH_MISMATCH");
    parsedRejection.data.reasons.forEach((reason) => actualReasonRequirements.push({
      reasonCode: reason.code,
      requirementRefs: canonicalStrings(reason.requirementRefs),
    }));

    if (oracle.expectedDecision.kind === "typed_rejection") {
      const decision = oracle.expectedDecision;
      const actualCodes = canonicalStrings(actualReasonRequirements.map((item) => item.reasonCode));
      if (decision.requiredReasonCodes.some((code) => !actualCodes.includes(code))) {
        mismatches.add("ORACLE_REJECTION_REQUIRED_CODE_MISSING");
      }
      if (actualCodes.some((code) => !decision.allowedReasonCodes.includes(code))) {
        mismatches.add("ORACLE_REJECTION_CODE_NOT_ALLOWED");
      }
      if (actualReasonRequirements.length !== actualCodes.length) {
        mismatches.add("ORACLE_REJECTION_REASON_DUPLICATE");
      }
      const declaredByCode = new Map(
        declaredReasonRequirements(oracle, binding.requirementIdsByClause)
          .map((item) => [item.reasonCode, item.requirementRefs] as const),
      );
      actualReasonRequirements.forEach((actual) => {
        const declared = declaredByCode.get(actual.reasonCode);
        if (declared && !exactStrings(declared, actual.requirementRefs)) {
          mismatches.add("ORACLE_REJECTION_REQUIREMENT_OWNERSHIP_MISMATCH");
        }
      });
    }
  }
  if (input.actual.owner !== "compiler") mismatches.add("ORACLE_REJECTION_OWNER_INVALID");
  if (input.actual.modelRedispatchBudget !== 0) mismatches.add("ORACLE_REJECTION_REDISPATCH_NOT_ZERO");
  const mismatchCodes = canonicalStrings([...mismatches]);
  return createTaskIntentOracleEvaluationV2({
    schema: "setfarm.task-intent-oracle-evaluation.v2",
    oracleHash,
    expectedDecision,
    actualDecision: "typed_rejection",
    contractComplete: mismatchCodes.length === 0,
    decisionEvidenceVerified: mismatchCodes.length === 0,
    matchedIntentIds: [],
    requiredEvidenceRefs: [],
    rejectionContract: rejectionContractEvidence(oracle, binding, actualReasonRequirements),
    mismatchCodes,
  });
}
