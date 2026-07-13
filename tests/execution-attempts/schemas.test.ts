import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ExecutionAttemptReservationV1Schema,
  ExecutionAttemptV1Schema,
} from "../../src/execution/schemas/execution-attempt-v1.js";
import { AttemptOutputEnvelopeV1Schema } from "../../src/execution/schemas/output-envelope-v1.js";
import { computeAttemptDedupeKey } from "../../src/execution/lease-fence.js";
import { validateAttemptOutputEnvelope } from "../../src/execution/output-envelope.js";
import {
  HASH_A,
  HASH_B,
  HASH_C,
  HASH_D,
  SHA_A,
  SHA_B,
  TREE_A,
  TREE_B,
  exactProductReservation,
} from "./fixtures.js";

describe("execution attempt contracts", () => {
  it("computes exact product dedupe only from the approved identity tuple", () => {
    const input = exactProductReservation();
    const first = computeAttemptDedupeKey(input);
    assert.match(first ?? "", /^[a-f0-9]{64}$/);
    assert.equal(computeAttemptDedupeKey({ ...input }), first);

    for (const [field, value] of [
      ["runId", "run-contract-2"],
      ["stepId", "repair"],
      ["storyId", "US-003"],
      ["packetHash", HASH_B],
      ["findingSetHash", HASH_C],
    ] as const) {
      assert.notEqual(computeAttemptDedupeKey({ ...input, [field]: value }), first, field);
    }
    assert.notEqual(
      computeAttemptDedupeKey({ ...input, sourceBefore: { ...input.sourceBefore, sha: SHA_B } }),
      first,
    );
  });

  it("never promotes incomplete or non-product observations into dedupe identity", () => {
    assert.equal(computeAttemptDedupeKey(exactProductReservation({ findingSetHash: undefined })), null);
    assert.equal(computeAttemptDedupeKey(exactProductReservation({ packetHash: undefined, sliceHash: undefined })), null);
    assert.equal(computeAttemptDedupeKey(exactProductReservation({ attemptClass: "evidence_only" })), null);
    assert.equal(computeAttemptDedupeKey(exactProductReservation({ attemptClass: "infrastructure_retry" })), null);
    assert.equal(computeAttemptDedupeKey(exactProductReservation({ attemptClass: "supervisor_repair" })), null);
  });

  it("strictly validates reservation and persisted attempt records", () => {
    assert.equal(ExecutionAttemptReservationV1Schema.safeParse(exactProductReservation()).success, true);
    assert.equal(
      ExecutionAttemptReservationV1Schema.safeParse({ ...exactProductReservation(), proseFinding: "button bad" }).success,
      false,
    );
    assert.equal(
      ExecutionAttemptReservationV1Schema.safeParse(exactProductReservation({ sliceHash: HASH_C, packetHash: undefined })).success,
      false,
    );

    const persisted = {
      schema: "setfarm.execution-attempt.v1",
      attemptId: "ATT_018f0000-0000-7000-8000-000000000001",
      ...exactProductReservation(),
      generation: 1,
      fenceToken: HASH_A,
      dedupeKey: HASH_B,
      lease: {
        acquiredAt: "2026-07-12T00:00:00.000Z",
        expiresAt: "2026-07-12T06:00:00.000Z",
        heartbeatAt: "2026-07-12T00:00:00.000Z",
      },
      disposition: "claimed",
      sourceAfter: undefined,
      outputHash: undefined,
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:00:00.000Z",
    };
    assert.equal(ExecutionAttemptV1Schema.safeParse(persisted).success, true);
    assert.equal(ExecutionAttemptV1Schema.safeParse({ ...persisted, dedupeKey: undefined }).success, false);
    assert.equal(ExecutionAttemptV1Schema.safeParse({ ...persisted, extra: true }).success, false);
  });

  it("validates bounded output envelopes against attempted slice and source identity", () => {
    const envelope = {
      schema: "setfarm.attempt-output-envelope.v1",
      attemptId: "ATT_018f0000-0000-7000-8000-000000000001",
      generation: 2,
      fenceToken: HASH_A,
      packetHash: HASH_B,
      sliceHash: HASH_C,
      sourceBefore: { sha: SHA_A, treeHash: TREE_A },
      sourceAfter: { sha: SHA_B, treeHash: TREE_B },
      disposition: "produced_delta",
      outputs: [
        { kind: "file_change", reference: "PATH_SRC", status: "changed", contentHash: HASH_D },
        { kind: "command", reference: "CMD_BUILD", status: "passed", contentHash: HASH_A },
      ],
      evidenceRefs: ["EVID_BUILD"],
    };
    assert.equal(AttemptOutputEnvelopeV1Schema.safeParse(envelope).success, true);
    assert.equal(AttemptOutputEnvelopeV1Schema.safeParse({ ...envelope, rawTranscript: "..." }).success, false);

    const accepted = validateAttemptOutputEnvelope(envelope, {
      attemptId: envelope.attemptId,
      generation: 2,
      fenceToken: HASH_A,
      packetHash: HASH_B,
      sliceHash: HASH_C,
      sourceBefore: envelope.sourceBefore,
    });
    assert.equal(accepted.status, "accepted");

    const wrongSlice = validateAttemptOutputEnvelope({ ...envelope, sliceHash: HASH_D }, {
      attemptId: envelope.attemptId,
      generation: 2,
      fenceToken: HASH_A,
      packetHash: HASH_B,
      sliceHash: HASH_C,
      sourceBefore: envelope.sourceBefore,
    });
    assert.deepEqual(wrongSlice, { status: "rejected", code: "OUTPUT_SLICE_MISMATCH" });
  });
});
