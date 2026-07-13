import {
  AttemptOutputEnvelopeV1Schema,
  type AttemptOutputEnvelopeV1,
} from "./schemas/output-envelope-v1.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";

export type AttemptOutputExpectation = Readonly<{
  attemptId: string;
  generation: number;
  fenceToken: string;
  packetHash?: string;
  sliceHash?: string;
  sourceBefore: SourceRevisionV1;
}>;

export type AttemptOutputValidation =
  | Readonly<{ status: "accepted"; envelope: AttemptOutputEnvelopeV1 }>
  | Readonly<{ status: "rejected"; code: string }>;

export function validateAttemptOutputEnvelope(
  input: unknown,
  expected: AttemptOutputExpectation,
): AttemptOutputValidation {
  const parsed = AttemptOutputEnvelopeV1Schema.safeParse(input);
  if (!parsed.success) return { status: "rejected", code: "OUTPUT_SCHEMA_INVALID" };
  const value = parsed.data;
  if (value.attemptId !== expected.attemptId) return { status: "rejected", code: "OUTPUT_ATTEMPT_MISMATCH" };
  if (value.generation !== expected.generation) return { status: "rejected", code: "OUTPUT_GENERATION_MISMATCH" };
  if (value.fenceToken !== expected.fenceToken) return { status: "rejected", code: "OUTPUT_FENCE_MISMATCH" };
  if (value.packetHash !== expected.packetHash) return { status: "rejected", code: "OUTPUT_PACKET_MISMATCH" };
  if (value.sliceHash !== expected.sliceHash) return { status: "rejected", code: "OUTPUT_SLICE_MISMATCH" };
  if (value.sourceBefore.sha !== expected.sourceBefore.sha) return { status: "rejected", code: "OUTPUT_SOURCE_SHA_MISMATCH" };
  if (value.sourceBefore.treeHash !== expected.sourceBefore.treeHash) {
    return { status: "rejected", code: "OUTPUT_SOURCE_TREE_MISMATCH" };
  }
  return { status: "accepted", envelope: value };
}
