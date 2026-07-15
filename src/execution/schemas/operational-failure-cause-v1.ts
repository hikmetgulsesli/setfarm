import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";

export const OPERATIONAL_FAILURE_CAUSE_EVIDENCE_KEY = "operationalFailureCause" as const;

export const WorkflowStepIdV1Schema = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);

const BoundarySchema = z.string()
  .min(1)
  .max(160)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);

export const OperationalFailureClassV1Schema = z.enum([
  "contract_invalid",
  "generated_artifact_invalid",
  "retry_delta_missing",
  "platform_authority_invalid",
  "infrastructure_failure",
  "platform_invariant_failed",
  "recovery_exhausted",
]);

export const OperationalFailureCodeV1Schema = z.string()
  .min(3)
  .max(160)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/);

/**
 * Stable producer-owned operational failure identity.
 *
 * Volatile occurrence data (run/story/claim/attempt IDs, paths, timestamps,
 * diagnostics, retry policy) belongs beside this artifact as evidence and is
 * deliberately excluded from the cause hash.
 */
export const OperationalFailureCauseV1Schema = z.object({
  schema: z.literal("setfarm.operational-failure-cause.v1"),
  workflowStepId: WorkflowStepIdV1Schema,
  boundary: BoundarySchema,
  failureClass: OperationalFailureClassV1Schema,
  failureCode: OperationalFailureCodeV1Schema,
}).strict();

export type OperationalFailureCauseV1 = z.infer<typeof OperationalFailureCauseV1Schema>;

export class OperationalFailureCauseError extends Error {
  readonly failureCause: OperationalFailureCauseV1;

  constructor(failureCause: OperationalFailureCauseV1, message: string) {
    super(message);
    this.name = "OperationalFailureCauseError";
    this.failureCause = Object.freeze(OperationalFailureCauseV1Schema.parse(failureCause));
  }
}

export function operationalFailureCauseHashV1(value: unknown): string {
  return hashCanonicalJson(OperationalFailureCauseV1Schema.parse(value));
}

/**
 * Convert only structurally identified producer codes into the canonical
 * reason-code grammar. Arbitrary exception messages and unknown strings are
 * intentionally not normalized into repeatable causes.
 */
export function normalizeOperationalFailureCodeV1(code: string): string | undefined {
  const value = code.trim();
  if (OperationalFailureCodeV1Schema.safeParse(value).success) return value;
  if (/^[0-9A-Z]{5}$/.test(value)) return `SQLSTATE_${value}`;
  if (/^E[A-Z0-9_]{2,120}$/.test(value)) return `ERRNO_${value}`;
  return undefined;
}

export function operationalFailureCauseFromEvidenceV1(
  evidence: Readonly<Record<string, unknown>>,
): OperationalFailureCauseV1 | undefined {
  if (!Object.hasOwn(evidence, OPERATIONAL_FAILURE_CAUSE_EVIDENCE_KEY)) return undefined;
  return OperationalFailureCauseV1Schema.parse(evidence[OPERATIONAL_FAILURE_CAUSE_EVIDENCE_KEY]);
}

export function assertOperationalFailureCauseEvidenceKeyAbsent(
  evidence: Readonly<Record<string, unknown>> | undefined,
): void {
  if (evidence && Object.hasOwn(evidence, OPERATIONAL_FAILURE_CAUSE_EVIDENCE_KEY)) {
    throw new Error("RUN_TERMINATION_FAILURE_CAUSE_RESERVED");
  }
}
