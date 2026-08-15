import {
  OperationalFailureCauseV1Schema,
} from "./schemas/operational-failure-cause-v1.js";
import {
  evaluateOperationalFailureCauseAuthorityV1,
  evaluateOperationalFailureCauseEvidenceAuthorityV1,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1,
  operationalFailureCauseAuthoritySqlPredicateV1,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV1,
  type OperationalFailureCauseAuthorityBindingV1,
  type OperationalFailureCauseAuthorityV1Result,
  type OperationalFailureCauseEvidenceAuthorityV1Result,
} from "./operational-failure-cause-authority-v1.js";

const DESIGN_SEMANTIC_CLOSURE_BINDING_V2 = Object.freeze({
  requestedBy: "setfarm.step-fail.single",
  workflowStepIds: Object.freeze(["design"]),
  boundary: "product_compiler.design_source.semantic_closure",
  failureClass: "contract_invalid",
  failureCodes: Object.freeze(["DESIGN_SOURCE_SEMANTIC_CLOSURE_REJECTED"]),
} satisfies OperationalFailureCauseAuthorityBindingV1);

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2 = Object.freeze([
  ...OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1,
  DESIGN_SEMANTIC_CLOSURE_BINDING_V2,
]);

export type OperationalFailureCauseAuthorityV2Result = OperationalFailureCauseAuthorityV1Result;
export type OperationalFailureCauseEvidenceAuthorityV2Result =
  OperationalFailureCauseEvidenceAuthorityV1Result;

export function evaluateOperationalFailureCauseAuthorityV2(input: Readonly<{
  requestedBy: string;
  cause: unknown;
}>): OperationalFailureCauseAuthorityV2Result {
  const parsed = OperationalFailureCauseV1Schema.safeParse(input.cause);
  if (!parsed.success) return Object.freeze({ trusted: false, reasonCode: "STRUCTURE_INVALID" });
  const requesterBindings = OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2
    .filter((binding) => binding.requestedBy === input.requestedBy);
  if (requesterBindings.length === 0) {
    return Object.freeze({ trusted: false, reasonCode: "REQUESTER_UNKNOWN" });
  }
  const trusted = requesterBindings.some((binding) =>
    binding.workflowStepIds.includes(parsed.data.workflowStepId)
    && binding.boundary === parsed.data.boundary
    && binding.failureClass === parsed.data.failureClass
    && binding.failureCodes.includes(parsed.data.failureCode));
  return trusted
    ? Object.freeze({ trusted: true, cause: parsed.data })
    : Object.freeze({ trusted: false, reasonCode: "PRODUCER_TUPLE_UNAUTHORIZED" });
}

export function evaluateOperationalFailureCauseEvidenceAuthorityV2(input: Readonly<{
  requestedBy: string;
  cause: unknown;
  evidence: Readonly<Record<string, unknown>>;
}>): OperationalFailureCauseEvidenceAuthorityV2Result {
  const v1Authority = evaluateOperationalFailureCauseAuthorityV1(input);
  if (v1Authority.trusted) {
    return evaluateOperationalFailureCauseEvidenceAuthorityV1(input);
  }
  return evaluateOperationalFailureCauseAuthorityV2(input);
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function operationalFailureCauseAuthoritySqlPredicateV2(input: Readonly<{
  requestedBySql: string;
  causeSql: string;
}>): string {
  const v1Predicate = operationalFailureCauseAuthoritySqlPredicateV1(input);
  const binding = DESIGN_SEMANTIC_CLOSURE_BINDING_V2;
  const v2Predicate = `(${input.requestedBySql} = ${sqlLiteral(binding.requestedBy)} AND ${input.causeSql}->>'workflowStepId' = ${sqlLiteral(binding.workflowStepIds[0]!)} AND ${input.causeSql}->>'boundary' = ${sqlLiteral(binding.boundary)} AND ${input.causeSql}->>'failureClass' = ${sqlLiteral(binding.failureClass)} AND ${input.causeSql}->>'failureCode' = ${sqlLiteral(binding.failureCodes[0]!)})`;
  return `((${v1Predicate}) OR ${v2Predicate})`;
}

export function operationalFailureCauseEvidenceAuthoritySqlPredicateV2(input: Readonly<{
  requestedBySql: string;
  evidenceSql: string;
  causeSql: string;
}>): string {
  return operationalFailureCauseEvidenceAuthoritySqlPredicateV1(input);
}
