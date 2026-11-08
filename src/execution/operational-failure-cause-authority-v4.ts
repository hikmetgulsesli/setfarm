import { OperationalFailureCauseV1Schema } from "./schemas/operational-failure-cause-v1.js";
import {
  evaluateOperationalFailureCauseAuthorityV3, evaluateOperationalFailureCauseEvidenceAuthorityV3,
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V3,
  operationalFailureCauseAuthoritySqlPredicateV3, operationalFailureCauseEvidenceAuthoritySqlPredicateV3,
  type OperationalFailureCauseAuthorityV3Result, type OperationalFailureCauseEvidenceAuthorityV3Result,
} from "./operational-failure-cause-authority-v3.js";
import type { OperationalFailureCauseAuthorityBindingV1 } from "./operational-failure-cause-authority-v1.js";

const DESIGN_MCP_BINDING_V4 = Object.freeze({
  requestedBy: "setfarm.step-fail.single", workflowStepIds: Object.freeze(["design"]),
  boundary: "product_compiler.design_source.artifact_download", failureClass: "infrastructure_failure",
  failureCodes: Object.freeze(["STITCH_MCP_ARTIFACT_RETRIEVAL_FAILED"]),
} satisfies OperationalFailureCauseAuthorityBindingV1);

export const OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V4 = Object.freeze([
  ...OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V3, DESIGN_MCP_BINDING_V4,
]);

export function evaluateOperationalFailureCauseAuthorityV4(input: Readonly<{
  requestedBy: string; cause: unknown;
}>): OperationalFailureCauseAuthorityV3Result {
  const previous = evaluateOperationalFailureCauseAuthorityV3(input);
  if (previous.trusted) return previous;
  const parsed = OperationalFailureCauseV1Schema.safeParse(input.cause);
  if (!parsed.success) return Object.freeze({ trusted: false, reasonCode: "STRUCTURE_INVALID" });
  const binding = DESIGN_MCP_BINDING_V4;
  return input.requestedBy === binding.requestedBy
    && binding.workflowStepIds.includes(parsed.data.workflowStepId)
    && parsed.data.boundary === binding.boundary && parsed.data.failureClass === binding.failureClass
    && binding.failureCodes.includes(parsed.data.failureCode)
    ? Object.freeze({ trusted: true, cause: parsed.data }) : previous;
}

export function evaluateOperationalFailureCauseEvidenceAuthorityV4(input: Readonly<{
  requestedBy: string; cause: unknown; evidence: Readonly<Record<string, unknown>>;
}>): OperationalFailureCauseEvidenceAuthorityV3Result {
  return evaluateOperationalFailureCauseAuthorityV3(input).trusted
    ? evaluateOperationalFailureCauseEvidenceAuthorityV3(input)
    : evaluateOperationalFailureCauseAuthorityV4(input);
}

function sqlLiteral(value: string): string { return `'${value.replaceAll("'", "''")}'`; }
export function operationalFailureCauseAuthoritySqlPredicateV4(input: Readonly<{
  requestedBySql: string; causeSql: string;
}>): string {
  const b = DESIGN_MCP_BINDING_V4, c = input.causeSql;
  return `((${operationalFailureCauseAuthoritySqlPredicateV3(input)}) OR (${input.requestedBySql} = ${sqlLiteral(b.requestedBy)} AND ${c}->>'workflowStepId' = 'design' AND ${c}->>'boundary' = ${sqlLiteral(b.boundary)} AND ${c}->>'failureClass' = 'infrastructure_failure' AND ${c}->>'failureCode' = ${sqlLiteral(b.failureCodes[0]!)}))`;
}
export function operationalFailureCauseEvidenceAuthoritySqlPredicateV4(input: Readonly<{
  requestedBySql: string; evidenceSql: string; causeSql: string;
}>): string { return operationalFailureCauseEvidenceAuthoritySqlPredicateV3(input); }
