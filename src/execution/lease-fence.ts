import { randomBytes, randomUUID } from "node:crypto";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  ExecutionAttemptReservationV1Schema,
  type ExecutionAttemptReservationV1,
} from "./schemas/execution-attempt-v1.js";

export const DEFAULT_ATTEMPT_LEASE_MS = 6 * 60 * 60 * 1_000;

export function computeAttemptDedupeKey(input: unknown): string | null {
  const parsed = ExecutionAttemptReservationV1Schema.parse(input);
  if (
    parsed.attemptClass !== "product_implementation"
    || !parsed.packetHash
    || !parsed.findingSetHash
  ) {
    return null;
  }
  return hashCanonicalJson({
    schema: "setfarm.execution-attempt-dedupe.v1",
    runId: parsed.runId,
    stepId: parsed.stepId,
    storyId: parsed.storyId,
    packetHash: parsed.packetHash,
    sourceBeforeSha: parsed.sourceBefore.sha,
    findingSetHash: parsed.findingSetHash,
  });
}

export type AttemptIdentityFactory = Readonly<{
  attemptId(): string;
  fenceToken(): string;
}>;

export const defaultAttemptIdentityFactory: AttemptIdentityFactory = {
  attemptId: () => `ATT_${randomUUID()}`,
  fenceToken: () => randomBytes(32).toString("hex"),
};

export function leaseWindow(
  now: Date,
  leaseMs = DEFAULT_ATTEMPT_LEASE_MS,
): Readonly<{ acquiredAt: Date; expiresAt: Date; heartbeatAt: Date }> {
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0 || leaseMs > 24 * 60 * 60 * 1_000) {
    throw new Error("ATTEMPT_LEASE_INVALID");
  }
  const acquiredAt = new Date(now);
  if (!Number.isFinite(acquiredAt.getTime())) throw new Error("ATTEMPT_LEASE_TIME_INVALID");
  return {
    acquiredAt,
    expiresAt: new Date(acquiredAt.getTime() + leaseMs),
    heartbeatAt: acquiredAt,
  };
}

export function parseAttemptReservation(input: unknown): ExecutionAttemptReservationV1 {
  return ExecutionAttemptReservationV1Schema.parse(input);
}
