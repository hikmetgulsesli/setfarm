import { z } from "zod";

import {
  RecoveryDispatchDeliveryV1Schema,
  type RecoveryDispatchDeliveryV1,
} from "./recovery-delivery.js";

const TimestampSchema = z.string().datetime({ offset: true });
const BoundedIdentitySchema = z.string().min(1).max(500);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const RecoveryDispatchDeliveryV2Schema = z.object({
  schema: z.literal("setfarm.recovery-dispatch-delivery.v2"),
  dispatchId: RecoveryDispatchIdSchema,
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionId: RecoveryRevisionIdSchema,
  runId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  state: z.enum([
    "authorized",
    "leased",
    "attempt_reserved",
    "running",
    "succeeded",
    "failed",
    "blocked",
    "superseded",
  ]),
  ownerInstanceId: BoundedIdentitySchema.optional(),
  leaseToken: z.string().min(16).max(500).optional(),
  leaseExpiresAt: TimestampSchema.optional(),
  attemptId: AttemptIdSchema.optional(),
  claimId: z.number().int().positive().optional(),
  executionSliceHash: Sha256Schema.optional(),
  attemptCount: z.number().int().nonnegative(),
  terminalResult: z.record(z.string(), z.unknown()),
  diagnostic: z.string().max(10_000).optional(),
  authorizedAt: TimestampSchema,
  startedAt: TimestampSchema.optional(),
  terminalAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  const leaseFields = [value.ownerInstanceId, value.leaseToken, value.leaseExpiresAt].filter(Boolean).length;
  const active = ["leased", "attempt_reserved", "running"].includes(value.state);
  const terminal = ["succeeded", "failed", "blocked", "superseded"].includes(value.state);
  if (
    (value.state === "authorized" && leaseFields !== 0)
    || (active && leaseFields !== 3)
    || (terminal && leaseFields !== 0 && leaseFields !== 3)
  ) {
    context.addIssue({
      code: "custom",
      path: ["leaseToken"],
      message: "Active delivery lease identity must be complete; terminal history may retain all or none",
    });
  }
  if (Boolean(value.attemptId) !== Boolean(value.claimId)) {
    context.addIssue({
      code: "custom",
      path: ["attemptId"],
      message: "Delivery attempt and claim identities must be paired",
    });
  }
  const requiresAttempt = ["attempt_reserved", "running", "succeeded", "failed"].includes(value.state);
  if (requiresAttempt && (!value.attemptId || !value.executionSliceHash)) {
    context.addIssue({
      code: "custom",
      path: ["attemptId"],
      message: "Attempt delivery state requires attempt and execution slice",
    });
  }
  if (terminal !== Boolean(value.terminalAt)) {
    context.addIssue({
      code: "custom",
      path: ["terminalAt"],
      message: "Terminal delivery state requires an exact terminal timestamp",
    });
  }
});

export type RecoveryDispatchDeliveryV2 = z.infer<typeof RecoveryDispatchDeliveryV2Schema>;
export type RecoveryDispatchDeliveryRecord = RecoveryDispatchDeliveryV1 | RecoveryDispatchDeliveryV2;

/**
 * V1 remains the immutable migration-11 contract. V2 is emitted only when a
 * terminal row has relinquished its live lease identity under migration 20;
 * all active and legacy-terminal records retain their exact V1 shape.
 */
export function parseRecoveryDispatchDeliveryRecord(
  raw: Readonly<Record<string, unknown>>,
): RecoveryDispatchDeliveryRecord {
  const state = typeof raw.state === "string" ? raw.state : "";
  const terminal = ["succeeded", "failed", "blocked", "superseded"].includes(state);
  const hasLeaseIdentity = raw.ownerInstanceId !== undefined
    || raw.leaseToken !== undefined
    || raw.leaseExpiresAt !== undefined;
  if (terminal && !hasLeaseIdentity) {
    return RecoveryDispatchDeliveryV2Schema.parse({
      ...raw,
      schema: "setfarm.recovery-dispatch-delivery.v2",
    });
  }
  return RecoveryDispatchDeliveryV1Schema.parse({
    ...raw,
    schema: "setfarm.recovery-dispatch-delivery.v1",
  });
}
