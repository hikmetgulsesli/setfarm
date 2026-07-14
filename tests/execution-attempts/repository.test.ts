import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import {
  HASH_B,
  HASH_C,
  SHA_B,
  TREE_B,
  exactBoundProductReservation,
  exactProductReservation,
} from "./fixtures.js";
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
    const input = await exactBoundProductReservation(database.sql);
    const first = await repository.reserve(input, { now });
    assert.equal(first.status, "reserved");
    const duplicate = await repository.reserve(input, { now });
    assert.equal(duplicate.status, "duplicate");
    assert.equal(duplicate.attempt.attemptId, first.attempt.attemptId);

    const otherRun = await repository.reserve(await exactBoundProductReservation(database.sql, {
      runId: "run-contract-2",
    }), { now });
    assert.equal(otherRun.status, "reserved");
    assert.notEqual(otherRun.attempt.dedupeKey, first.attempt.dedupeKey);
  });

  it("records a rejected packet without packet, slice, finding, or dedupe", async () => {
    const rejected = await repository.reserve(await exactBoundProductReservation(database.sql, {
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
    const reserved = await repository.reserve(await exactBoundProductReservation(database.sql, {
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

  it("attests one exact candidate source before terminal completion", async () => {
    const reserved = await repository.reserve(await exactBoundProductReservation(database.sql, {
      storyId: "US-CANDIDATE",
      packetHash: HASH_B,
      sliceHash: HASH_C,
    }));
    assert.equal(reserved.status, "reserved");

    const candidate = await repository.recordCandidateSource({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      sourceAfter: { sha: SHA_B, treeHash: TREE_B },
    });
    assert.equal(candidate.status, "candidate");
    assert.deepEqual(candidate.attempt.sourceAfter, { sha: SHA_B, treeHash: TREE_B });

    const replay = await repository.recordCandidateSource({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      sourceAfter: { sha: SHA_B, treeHash: TREE_B },
    });
    assert.equal(replay.status, "candidate");
    assert.deepEqual(await repository.recordCandidateSource({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      sourceAfter: { sha: "9".repeat(40), treeHash: "8".repeat(40) },
    }), { status: "stale_fence" });

    const completed = await repository.complete({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      disposition: "produced_delta",
      sourceAfter: { sha: SHA_B, treeHash: TREE_B },
      evidenceRefs: ["setfarm://evidence/EVB_candidate"],
    });
    assert.equal(completed.status, "completed");
    assert.deepEqual(completed.attempt.sourceAfter, { sha: SHA_B, treeHash: TREE_B });
  });

  it("retains attempt evidence after the legacy run is hard-deleted", async () => {
    await database.insertRun("run-delete-test");
    const reserved = await repository.reserve(await exactBoundProductReservation(database.sql, {
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

  it("rejects reservations without an active compiler run owner", async () => {
    await database.db.pgRun(
      "INSERT INTO runs (id, workflow_id, task, status) VALUES ($1, 'feature-dev', 'legacy', 'running')",
      ["run-attempt-legacy-owner"],
    );
    await database.insertRun("run-attempt-terminal-owner");
    await database.db.pgRun(
      "UPDATE runs SET status = 'completed' WHERE id = $1",
      ["run-attempt-terminal-owner"],
    );
    try {
      for (const runId of ["run-attempt-legacy-owner", "run-attempt-terminal-owner"]) {
        await assert.rejects(
          repository.reserve(exactProductReservation({ runId, storyId: `US-${runId}` })),
          /ATTEMPT_RUN_NOT_ACTIVE_COMPILER_OWNER/,
        );
      }
    } finally {
      await database.db.pgRun(
        "DELETE FROM runs WHERE id IN ($1, $2)",
        ["run-attempt-legacy-owner", "run-attempt-terminal-owner"],
      );
    }
  });

  it("requires and validates one exact relational claim owner", async () => {
    await assert.rejects(
      repository.reserve(exactProductReservation({ storyId: "US-NO-CLAIM" })),
      /ATTEMPT_CLAIM_ID_REQUIRED/,
    );
    const claimId = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES ('run-contract-1', 'implement', 'US-BOUND', 'feature-dev')
      RETURNING id::integer AS id
    `;
    await assert.rejects(
      repository.reserve(exactProductReservation({
        claimId: claimId[0]!.id,
        storyId: "US-DIFFERENT",
        evidenceRefs: [`setfarm://claim-log/${claimId[0]!.id}`],
      })),
      /ATTEMPT_CLAIM_BINDING_INVALID/,
    );
  });
});
