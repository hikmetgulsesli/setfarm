import { z } from "zod";

import {
  OperationalFailureCauseV1Schema,
  type OperationalFailureCauseV1,
} from "../execution/schemas/operational-failure-cause-v1.js";

/**
 * Immutable v1 vocabulary. Adding a reason requires a new artifact/authority
 * version and migration; changing this list would rewrite migration 21.
 */
export const V3_RECOVERY_TERMINAL_REASON_CODES_V1 = [
  "specification_incomplete",
  "evidence_inconclusive",
  "budget_exhausted",
  "source_superseded",
  "upstream_recompile_required",
  "operator_required",
] as const;

export const V3_RECOVERY_TERMINAL_REASON_CARDINALITY_V1 =
  V3_RECOVERY_TERMINAL_REASON_CODES_V1.length;

export const V3RecoveryTerminalReasonCodeV1Schema = z.enum(
  V3_RECOVERY_TERMINAL_REASON_CODES_V1,
);

export type V3RecoveryTerminalReasonCodeV1 = z.infer<
  typeof V3RecoveryTerminalReasonCodeV1Schema
>;

export type V3DownstreamTerminalCauseBindingV1 = Readonly<{
  reasons: readonly V3RecoveryTerminalReasonCodeV1[];
  failureClass: OperationalFailureCauseV1["failureClass"];
  failureCode: string;
}>;

const SINGLE_REASON_BINDINGS: Readonly<Record<
  V3RecoveryTerminalReasonCodeV1,
  Pick<V3DownstreamTerminalCauseBindingV1, "failureClass" | "failureCode">
>> = Object.freeze({
  specification_incomplete: {
    failureClass: "contract_invalid",
    failureCode: "V3_DOWNSTREAM_SPECIFICATION_INCOMPLETE",
  },
  evidence_inconclusive: {
    failureClass: "platform_authority_invalid",
    failureCode: "V3_DOWNSTREAM_EVIDENCE_INCONCLUSIVE",
  },
  budget_exhausted: {
    failureClass: "recovery_exhausted",
    failureCode: "V3_DOWNSTREAM_RECOVERY_BUDGET_EXHAUSTED",
  },
  source_superseded: {
    failureClass: "retry_delta_missing",
    failureCode: "V3_DOWNSTREAM_SOURCE_SUPERSEDED",
  },
  upstream_recompile_required: {
    failureClass: "contract_invalid",
    failureCode: "V3_DOWNSTREAM_UPSTREAM_RECOMPILE_REQUIRED",
  },
  operator_required: {
    failureClass: "platform_authority_invalid",
    failureCode: "V3_DOWNSTREAM_OPERATOR_REQUIRED",
  },
});

const FAILURE_CLASS_PRECEDENCE: readonly Readonly<{
  reason: V3RecoveryTerminalReasonCodeV1;
  failureClass: OperationalFailureCauseV1["failureClass"];
}>[] = Object.freeze([
  { reason: "specification_incomplete", failureClass: "contract_invalid" },
  { reason: "upstream_recompile_required", failureClass: "contract_invalid" },
  { reason: "source_superseded", failureClass: "retry_delta_missing" },
  { reason: "budget_exhausted", failureClass: "recovery_exhausted" },
  { reason: "evidence_inconclusive", failureClass: "platform_authority_invalid" },
  { reason: "operator_required", failureClass: "platform_authority_invalid" },
]);

const reasonRank = new Map(
  V3_RECOVERY_TERMINAL_REASON_CODES_V1.map((reason, index) => [reason, index]),
);

export function canonicalV3RecoveryTerminalReasonCodesV1(
  input: readonly unknown[],
): readonly V3RecoveryTerminalReasonCodeV1[] {
  const parsed = z.array(V3RecoveryTerminalReasonCodeV1Schema)
    .min(1)
    .max(V3_RECOVERY_TERMINAL_REASON_CARDINALITY_V1)
    .parse(input);
  if (new Set(parsed).size !== parsed.length) {
    throw new Error("V3_RECOVERY_TERMINAL_REASON_DUPLICATE");
  }
  return Object.freeze([...parsed].sort(
    (left, right) => reasonRank.get(left)! - reasonRank.get(right)!,
  ));
}

function aggregateFailureCode(
  reasons: readonly V3RecoveryTerminalReasonCodeV1[],
): string {
  const mask = reasons.reduce(
    (value, reason) => value | (1 << reasonRank.get(reason)!),
    0,
  );
  return `V3_DOWNSTREAM_TERMINAL_REASON_SET_${mask.toString(16).toUpperCase().padStart(2, "0")}`;
}

function bindingForReasons(
  input: readonly unknown[],
): V3DownstreamTerminalCauseBindingV1 {
  const reasons = canonicalV3RecoveryTerminalReasonCodesV1(input);
  if (reasons.length === 1) {
    return Object.freeze({ reasons, ...SINGLE_REASON_BINDINGS[reasons[0]!] });
  }
  const primary = FAILURE_CLASS_PRECEDENCE.find(({ reason }) => reasons.includes(reason));
  if (!primary) throw new Error("V3_RECOVERY_TERMINAL_REASON_PRIMARY_MISSING");
  return Object.freeze({
    reasons,
    failureClass: primary.failureClass,
    failureCode: aggregateFailureCode(reasons),
  });
}

/** Every non-empty set in the six-value v1 vocabulary has one exact cause. */
export const V3_DOWNSTREAM_TERMINAL_CAUSE_BINDINGS_V1: readonly V3DownstreamTerminalCauseBindingV1[] =
  Object.freeze(Array.from(
    { length: (1 << V3_RECOVERY_TERMINAL_REASON_CARDINALITY_V1) - 1 },
    (_, offset) => {
      const mask = offset + 1;
      return bindingForReasons(V3_RECOVERY_TERMINAL_REASON_CODES_V1.filter(
        (_reason, index) => (mask & (1 << index)) !== 0,
      ));
    },
  ));

export function v3DownstreamTerminalCauseBindingForReasonCodesV1(
  input: readonly unknown[],
): V3DownstreamTerminalCauseBindingV1 {
  return bindingForReasons(input);
}

export function createV3DownstreamTerminalOperationalFailureCauseV1(input: Readonly<{
  workflowStepId: "qa-test" | "final-test";
  terminalReasonCodes: readonly unknown[];
}>): OperationalFailureCauseV1 {
  const binding = bindingForReasons(input.terminalReasonCodes);
  return OperationalFailureCauseV1Schema.parse({
    schema: "setfarm.operational-failure-cause.v1",
    workflowStepId: input.workflowStepId,
    boundary: "product_compiler.downstream_recovery",
    failureClass: binding.failureClass,
    failureCode: binding.failureCode,
  });
}
