import { z } from "zod";

import {
  ExecutionAttemptReservationV1Schema,
  type ExecutionAttemptReservationV1,
} from "./schemas/execution-attempt-v1.js";
import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-envelope.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { LegacyImplementationSliceV2Schema, type LegacyImplementationSliceV2 }
  from "../product-compiler/schemas/implementation-slice-v2-legacy.js";
import {
  ImplementationSliceV1Schema,
  type ImplementationRecoveryDirectiveV1,
} from "../product-compiler/schemas/implementation-slice-v1.js";

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
  recoveryExecutionSliceAuthority?: Readonly<{
    kind?: never;
    executionSliceHash: string;
    recovery: ImplementationRecoveryDirectiveV1;
  }> | Readonly<{
    kind: "native";
    executionSliceHash: string;
    slice: LegacyImplementationSliceV2;
  }>;
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
  const { predecessorAttempt, recoveryExecutionSliceEnvelope, ...baseRaw } = raw;
  const base = ExecutionAttemptReservationV1Schema.parse(baseRaw);
  let parsedRecoveryExecutionSliceAuthority:
    | OperationalRetryAwareAttemptReservation["recoveryExecutionSliceAuthority"]
    | undefined;
  if (recoveryExecutionSliceEnvelope !== undefined) {
    const envelope = SemanticArtifactEnvelopeV1Schema.parse(recoveryExecutionSliceEnvelope);
    if (envelope.artifactType === "setfarm.implementation-slice.v2") {
      const slice = LegacyImplementationSliceV2Schema.parse(envelope.payload);
      if (hashCanonicalJson(envelope) !== base.sliceHash
        || hashCanonicalJson(envelope.producer) !== hashCanonicalJson(slice.producer)
        || slice.packetHash !== base.packetHash || slice.storyId !== base.storyId
        || slice.sourceRevision.sha !== base.sourceBefore.sha
        || slice.sourceRevision.treeHash !== base.sourceBefore.treeHash || !slice.recovery
        || slice.recovery.findingSet.runId !== base.runId
        || slice.recovery.findingSet.findingSetHash !== base.findingSetHash
        || !base.recoveryCaseRevisionId || !base.recoveryDispatchId
        || (base.attemptClass !== "product_implementation" && base.attemptClass !== "supervisor_repair")
        || base.role !== (base.attemptClass === "supervisor_repair" ? "supervisor" : "developer")) {
        throw new Error("ATTEMPT_RECOVERY_EXECUTION_SLICE_AUTHORITY_INVALID");
      }
      parsedRecoveryExecutionSliceAuthority = Object.freeze({
        kind: "native", executionSliceHash: base.sliceHash!, slice,
      });
    } else {
    const slice = ImplementationSliceV1Schema.parse(envelope.payload);
    if (
      envelope.artifactType !== "setfarm.implementation-slice.v1"
      || hashCanonicalJson(envelope) !== base.sliceHash
      || slice.packetHash !== base.packetHash
      || slice.storyId !== base.storyId
      || slice.sourceRevision.baseSha !== base.sourceBefore.sha
      || slice.sourceRevision.treeHash !== base.sourceBefore.treeHash
      || !slice.recovery
    ) {
      throw new Error("ATTEMPT_RECOVERY_EXECUTION_SLICE_AUTHORITY_INVALID");
    }
    parsedRecoveryExecutionSliceAuthority = Object.freeze({
      executionSliceHash: base.sliceHash!,
      recovery: slice.recovery,
    });
    }
  }
  if (parsedRecoveryExecutionSliceAuthority && parsedRecoveryExecutionSliceAuthority.kind !== "native") {
    if (
      !base.recoveryDispatchId
      || base.attemptClass === "evidence_only"
      || parsedRecoveryExecutionSliceAuthority.recovery.recoveryCaseRevisionId !== base.recoveryCaseRevisionId
      || parsedRecoveryExecutionSliceAuthority.recovery.recoveryDispatchId !== base.recoveryDispatchId
      || parsedRecoveryExecutionSliceAuthority.recovery.dispatchClass !== base.attemptClass
      || parsedRecoveryExecutionSliceAuthority.recovery.findingSetHash !== base.findingSetHash
    ) {
      throw new Error("ATTEMPT_RECOVERY_EXECUTION_SLICE_AUTHORITY_INVALID");
    }
  }
  if (base.attemptClass !== "infrastructure_retry") {
    if (predecessorAttempt !== undefined) {
      throw new Error("ATTEMPT_PREDECESSOR_FENCE_FORBIDDEN");
    }
    return parsedRecoveryExecutionSliceAuthority
      ? { ...base, recoveryExecutionSliceAuthority: parsedRecoveryExecutionSliceAuthority }
      : base;
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
