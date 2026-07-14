import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseOperationalActionArguments } from "../../src/cli/operational-action-arguments.js";

describe("operational action CLI arguments", () => {
  const hash = "a".repeat(64);

  it("requires exactly one canonical expected snapshot hash", () => {
    assert.deepEqual(
      parseOperationalActionArguments(["workflow", "resume", "RUN_1", "--expected-snapshot-hash", hash]),
      { expectedSnapshotHash: hash, forceConsent: false },
    );
    assert.throws(
      () => parseOperationalActionArguments(["workflow", "resume", "RUN_1"]),
      /RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_REQUIRED/,
    );
    assert.throws(
      () => parseOperationalActionArguments([
        "workflow", "resume", "RUN_1",
        "--expected-snapshot-hash", hash,
        "--expected-snapshot-hash", hash,
      ]),
      /RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_DUPLICATE/,
    );
    assert.throws(
      () => parseOperationalActionArguments(["workflow", "resume", "RUN_1", "--expected-snapshot-hash", "A".repeat(64)]),
      /RUN_OPERATIONAL_ACTION_EXPECTED_SNAPSHOT_HASH_INVALID/,
    );
  });

  it("treats force as consent only and rejects every other trailing bypass", () => {
    assert.deepEqual(
      parseOperationalActionArguments(["workflow", "stop", "RUN_1", "--force", "--expected-snapshot-hash", hash]),
      { expectedSnapshotHash: hash, forceConsent: true },
    );
    assert.throws(
      () => parseOperationalActionArguments([
        "workflow", "stop", "RUN_1", "--force", "--expected-snapshot-hash", hash, "--skip-cas",
      ]),
      /RUN_OPERATIONAL_ACTION_ARGUMENT_INVALID/,
    );
  });
});
