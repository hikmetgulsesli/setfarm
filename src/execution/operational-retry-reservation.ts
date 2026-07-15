import { z } from "zod";

import {
  ExecutionAttemptReservationV1Schema,
  type ExecutionAttemptReservationV1,
} from "./schemas/execution-attempt-v1.js";

export const OperationalRetryPredecessorFenceV1Schema = z.object({
  attemptId: z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/),
  generation: z.number().int().positive(),
  terminalDisposition: z.enum(["inconclusive", "failed"]),
}).strict();

export type OperationalRetryPredecessorFenceV1 = z.infer<
  typeof OperationalRetryPredecessorFenceV1Schema
>;

export type OperationalRetryAwareAttemptReservation = ExecutionAttemptReservationV1 & Readonly<{
  predecessorAttempt?: OperationalRetryPredecessorFenceV1;
}>;

/**
 * Adds the v3 operational predecessor fence without mutating the immutable
 * execution-attempt.v1 schema that is sealed into contract-spine migration 11.
 */
export function parseOperationalRetryAwareAttemptReservation(
  input: unknown,
): OperationalRetryAwareAttemptReservation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return ExecutionAttemptReservationV1Schema.parse(input);
  }
  const raw = input as Record<string, unknown>;
  const { predecessorAttempt, ...baseRaw } = raw;
  const base = ExecutionAttemptReservationV1Schema.parse(baseRaw);
  if (base.attemptClass !== "infrastructure_retry") {
    if (predecessorAttempt !== undefined) {
      throw new Error("ATTEMPT_PREDECESSOR_FENCE_FORBIDDEN");
    }
    return base;
  }
  if (predecessorAttempt === undefined) {
    throw new Error("ATTEMPT_PREDECESSOR_FENCE_REQUIRED");
  }
  if (
    base.findingSetHash
    || base.recoveryCaseRevisionId
    || base.recoveryDispatchId
    || base.recoveryDeliveryLease
  ) {
    throw new Error("ATTEMPT_OPERATIONAL_RECOVERY_AUTHORITY_CONFLICT");
  }
  return {
    ...base,
    predecessorAttempt: OperationalRetryPredecessorFenceV1Schema.parse(predecessorAttempt),
  };
}
