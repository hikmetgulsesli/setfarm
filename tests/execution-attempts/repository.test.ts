import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { HASH_B, HASH_C, SHA_B, TREE_B, exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

describe("revision-fenced attempt repository", () => {
  let database: TestDatabase;
  let repository: ReturnType<typeof createAttemptRepository>;

  before(async () => {
    database = await createIsolatedTestDatabase();
    repository = createAttemptRepository(database.sql);
    await database.insertRun("run-contract-1");
    await database.insertRun("run-contract-2");
  });

  after(async () => {
    await database.cleanup();
    assert.equal(database.operations.some((item) => item === "CREATE DATABASE setfarm"), false);
    assert.equal(database.operations.some((item) => item === "DROP DATABASE setfarm"), false);
  });

  it("returns duplicate for the same exact tuple and separates different runs", async () => {
    const now = new Date("2026-07-12T00:00:00.000Z");
    const first = await repository.reserve(exactProductReservation(), { now });
    assert.equal(first.status, "reserved");
    const duplicate = await repository.reserve(exactProductReservation(), { now });
    assert.equal(duplicate.status, "duplicate");
    assert.equal(duplicate.attempt.attemptId, first.attempt.attemptId);

    const otherRun = await repository.reserve(exactProductReservation({ runId: "run-contract-2" }), { now });
    assert.equal(otherRun.status, "reserved");
    assert.notEqual(otherRun.attempt.dedupeKey, first.attempt.dedupeKey);
  });

  it("records a rejected packet without packet, slice, finding, or dedupe", async () => {
    const rejected = await repository.reserve(exactProductReservation({
      runId: "run-contract-1",
      storyId: "US-REJECTED",
      packetHash: undefined,
      sliceHash: undefined,
      findingSetHash: undefined,
    }));
    assert.equal(rejected.status, "reserved");
    assert.equal(rejected.attempt.packetHash, undefined);
    assert.equal(rejected.attempt.sliceHash, undefined);
    assert.equal(rejected.attempt.findingSetHash, undefined);
    assert.equal(rejected.attempt.dedupeKey, undefined);
  });

  it("fences completion and accepts exactly one terminal update", async () => {
    const reserved = await repository.reserve(exactProductReservation({
      storyId: "US-COMPLETE",
      packetHash: HASH_B,
      sliceHash: HASH_C,
    }));
    assert.equal(reserved.status, "reserved");

    const stale = await repository.complete({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: "0".repeat(64),
      disposition: "produced_delta",
      sourceAfter: { sha: SHA_B, treeHash: TREE_B },
      evidenceRefs: ["EVID_BUILD"],
    });
    assert.deepEqual(stale, { status: "stale_fence" });

    const completed = await repository.complete({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      disposition: "produced_delta",
      sourceAfter: { sha: SHA_B, treeHash: TREE_B },
      evidenceRefs: ["EVID_BUILD"],
    });
    assert.equal(completed.status, "completed");
    assert.equal(completed.attempt.disposition, "produced_delta");

    assert.deepEqual(await repository.complete({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      disposition: "verified",
      sourceAfter: { sha: SHA_B, treeHash: TREE_B },
      evidenceRefs: [],
    }), { status: "stale_fence" });
  });

  it("retains attempt evidence after the legacy run is hard-deleted", async () => {
    await database.insertRun("run-delete-test");
    const reserved = await repository.reserve(exactProductReservation({
      runId: "run-delete-test",
      storyId: "US-DELETE",
    }));
    assert.equal(reserved.status, "reserved");
    await database.db.pgRun("DELETE FROM runs WHERE id = $1", ["run-delete-test"]);
    const rows = await database.db.pgQuery<{ attempt_id: string }>(
      "SELECT attempt_id FROM execution_attempts WHERE attempt_id = $1",
      [reserved.attempt.attemptId],
    );
    assert.equal(rows.length, 1);
  });
});
