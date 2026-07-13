import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { HASH_B, HASH_C, exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

describe("attempt reservation concurrency and lease ownership", () => {
  let database: TestDatabase;
  let repository: ReturnType<typeof createAttemptRepository>;

  before(async () => {
    database = await createIsolatedTestDatabase();
    repository = createAttemptRepository(database.sql);
    await database.insertRun("run-contract-1");
  });

  after(async () => database.cleanup());

  it("allows only one active fence under concurrent reservation", async () => {
    const input = exactProductReservation({
      storyId: "US-CONCURRENT",
      findingSetHash: undefined,
    });
    const results = await Promise.all([
      repository.reserve(input),
      repository.reserve(input),
    ]);
    assert.deepEqual(results.map((item) => item.status).sort(), ["active_conflict", "reserved"]);
    const rows = await database.db.pgQuery<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM execution_attempts WHERE run_id = $1 AND story_id = $2 AND disposition IN ('claimed', 'running')",
      ["run-contract-1", "US-CONCURRENT"],
    );
    assert.equal(rows[0]?.count, "1");
  });

  it("returns active_conflict for an unexpired owner", async () => {
    const now = new Date("2026-07-12T00:00:00.000Z");
    const input = exactProductReservation({
      storyId: "US-ACTIVE",
      findingSetHash: undefined,
    });
    assert.equal((await repository.reserve(input, { now, leaseMs: 60_000 })).status, "reserved");
    assert.equal((await repository.reserve(input, { now: new Date(now.getTime() + 30_000) })).status, "active_conflict");
  });

  it("atomically supersedes an expired owner and rejects its stale fence", async () => {
    const start = new Date("2026-07-12T00:00:00.000Z");
    const first = await repository.reserve(exactProductReservation({
      storyId: "US-EXPIRED",
      findingSetHash: undefined,
    }), { now: start, leaseMs: 1_000 });
    assert.equal(first.status, "reserved");

    const second = await repository.reserve(exactProductReservation({
      storyId: "US-EXPIRED",
      packetHash: HASH_B,
      sliceHash: HASH_C,
      findingSetHash: undefined,
    }), { now: new Date(start.getTime() + 2_000), leaseMs: 1_000 });
    assert.equal(second.status, "reserved");
    assert.equal(second.attempt.generation, first.attempt.generation + 1);

    const prior = await repository.findById(first.attempt.attemptId);
    assert.equal(prior?.disposition, "superseded");
    assert.deepEqual(await repository.heartbeat({
      attemptId: first.attempt.attemptId,
      generation: first.attempt.generation,
      fenceToken: first.attempt.fenceToken,
    }), { status: "stale_fence" });
  });

  it("does not mutate legacy story, step, or claim rows", async () => {
    await database.db.pgRun(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status) VALUES ('step-legacy', $1, 'implement', 'feature-dev', 1, '', '', 'running')",
      ["run-contract-1"],
    );
    await database.db.pgRun(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, status, claimed_by) VALUES ('story-legacy', $1, 1, 'US-LEGACY', 'Legacy', 'running', 'legacy-owner')",
      ["run-contract-1"],
    );
    await database.db.pgRun(
      "INSERT INTO claim_log (run_id, step_id, story_id, agent_id) VALUES ($1, 'implement', 'US-LEGACY', 'legacy-owner')",
      ["run-contract-1"],
    );
    const before = await database.db.pgGet<{ story: string; step: string; claim: string }>(
      "SELECT (SELECT row_to_json(s)::text FROM stories s WHERE id = 'story-legacy') AS story, (SELECT row_to_json(st)::text FROM steps st WHERE id = 'step-legacy') AS step, (SELECT row_to_json(cl)::text FROM claim_log cl WHERE story_id = 'US-LEGACY') AS claim",
    );
    const reserved = await repository.reserve(exactProductReservation({
      storyId: "US-LEGACY",
      findingSetHash: undefined,
    }));
    assert.equal(reserved.status, "reserved");
    await repository.complete({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      disposition: "no_progress",
      evidenceRefs: [],
    });
    const after = await database.db.pgGet<{ story: string; step: string; claim: string }>(
      "SELECT (SELECT row_to_json(s)::text FROM stories s WHERE id = 'story-legacy') AS story, (SELECT row_to_json(st)::text FROM steps st WHERE id = 'step-legacy') AS step, (SELECT row_to_json(cl)::text FROM claim_log cl WHERE story_id = 'US-LEGACY') AS claim",
    );
    assert.deepEqual(after, before);
  });
});
