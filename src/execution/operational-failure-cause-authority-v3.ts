import {
  OperationalFailureCauseV1Schema,
} from "./schemas/operational-failure-cause-v1.js";
import {
  evaluateOperationalFailureCauseAuthorityV2,
  evaluateOperationalFailureCauseEvidenceAuthorityV2,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2,
  operationalFailureCauseAuthoritySqlPredicateV2,
  operationalFailureCauseEvidenceAuthoritySqlPredicateV2,
  type OperationalFailureCauseAuthorityV2Result,
  type OperationalFailureCauseEvidenceAuthorityV2Result,
} from "./operational-failure-cause-authority-v2.js";
import type { OperationalFailureCauseAuthorityBindingV1 } from "./operational-failure-cause-authority-v1.js";

const SETUP_BUILD_PACKET_BINDING_V3 = Object.freeze({
  requestedBy: "setfarm.step-fail.single",
  workflowStepIds: Object.freeze(["setup-build"]),
  boundary: "product_compiler.setup_build_packet",
  failureClass: "contract_invalid",
  failureCodes: Object.freeze([
    "SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED",
    "SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED",
    "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED",
  ]),
} satisfies OperationalFailureCauseAuthorityBindingV1);

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V3 = Object.freeze([
  ...OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2,
  SETUP_BUILD_PACKET_BINDING_V3,
]);

export type OperationalFailureCauseAuthorityV3Result = OperationalFailureCauseAuthorityV2Result;
export type OperationalFailureCauseEvidenceAuthorityV3Result =
  OperationalFailureCauseEvidenceAuthorityV2Result;

export function evaluateOperationalFailureCauseAuthorityV3(input: Readonly<{
  requestedBy: string;
  cause: unknown;
}>): OperationalFailureCauseAuthorityV3Result {
  const parsed = OperationalFailureCauseV1Schema.safeParse(input.cause);
  if (!parsed.success) return Object.freeze({ trusted: false, reasonCode: "STRUCTURE_INVALID" });
  const requesterBindings = OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V3
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

export function evaluateOperationalFailureCauseEvidenceAuthorityV3(input: Readonly<{
  requestedBy: string;
  cause: unknown;
  evidence: Readonly<Record<string, unknown>>;
}>): OperationalFailureCauseEvidenceAuthorityV3Result {
  const v2Authority = evaluateOperationalFailureCauseAuthorityV2(input);
  return v2Authority.trusted
    ? evaluateOperationalFailureCauseEvidenceAuthorityV2(input)
    : evaluateOperationalFailureCauseAuthorityV3(input);
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function operationalFailureCauseAuthoritySqlPredicateV3(input: Readonly<{
  requestedBySql: string;
  causeSql: string;
}>): string {
  const v2Predicate = operationalFailureCauseAuthoritySqlPredicateV2(input);
  const binding = SETUP_BUILD_PACKET_BINDING_V3;
  const v3Predicate = `(${input.requestedBySql} = ${sqlLiteral(binding.requestedBy)} AND ${input.causeSql}->>'workflowStepId' = ${sqlLiteral(binding.workflowStepIds[0]!)} AND ${input.causeSql}->>'boundary' = ${sqlLiteral(binding.boundary)} AND ${input.causeSql}->>'failureClass' = ${sqlLiteral(binding.failureClass)} AND ${input.causeSql}->>'failureCode' IN (${binding.failureCodes.map(sqlLiteral).join(", ")}))`;
  return `((${v2Predicate}) OR ${v3Predicate})`;
}

export function operationalFailureCauseEvidenceAuthoritySqlPredicateV3(input: Readonly<{
  requestedBySql: string;
  evidenceSql: string;
  causeSql: string;
}>): string {
  return operationalFailureCauseEvidenceAuthoritySqlPredicateV2(input);
}
