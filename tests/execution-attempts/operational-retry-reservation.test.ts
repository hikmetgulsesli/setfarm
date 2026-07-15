import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseOperationalRetryAwareAttemptReservation } from "../../src/execution/operational-retry-reservation.js";
import { exactProductReservation } from "./fixtures.js";

const predecessorAttempt = Object.freeze({
  attemptId: "ATT_018f0000-0000-7000-8000-000000000000",
  generation: 1,
  terminalDisposition: "inconclusive" as const,
});

function operationalReservation() {
  return {
    ...exactProductReservation({
      attemptClass: "infrastructure_retry",
      findingSetHash: undefined,
    }),
    predecessorAttempt,
  };
}

describe("operational retry reservation fence", () => {
  it("keeps ordinary v1 reservations compatible and requires one predecessor only for infrastructure retry", () => {
    assert.equal(parseOperationalRetryAwareAttemptReservation(exactProductReservation()).attemptClass, "product_implementation");
    assert.throws(
      () => parseOperationalRetryAwareAttemptReservation({
        ...operationalReservation(),
        predecessorAttempt: undefined,
      }),
      /ATTEMPT_PREDECESSOR_FENCE_REQUIRED/,
    );
    assert.throws(
      () => parseOperationalRetryAwareAttemptReservation({
        ...exactProductReservation(),
        predecessorAttempt,
      }),
      /ATTEMPT_PREDECESSOR_FENCE_FORBIDDEN/,
    );
  });

  it("rejects mixed FindingSet authority and parses the exact operational predecessor", () => {
    assert.throws(
      () => parseOperationalRetryAwareAttemptReservation({
        ...operationalReservation(),
        findingSetHash: "a".repeat(64),
      }),
      /ATTEMPT_OPERATIONAL_RECOVERY_AUTHORITY_CONFLICT/,
    );
    const parsed = parseOperationalRetryAwareAttemptReservation(operationalReservation());
    assert.equal(parsed.attemptClass, "infrastructure_retry");
    assert.deepEqual(parsed.predecessorAttempt, predecessorAttempt);
  });
});
