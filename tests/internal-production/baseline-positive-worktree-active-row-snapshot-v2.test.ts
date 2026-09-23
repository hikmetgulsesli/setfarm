import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeActiveOwnerRowPgResultV2, observePositiveWorktreeActiveRowSnapshotWithTransactionV2 } from "../../src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.js";

const emptyCounts = Object.freeze({
  runCount: "0", claimCount: "0", attemptCount: "0", sessionCount: "0",
  oversizedRunCount: "0", oversizedClaimCount: "0",
  oversizedAttemptCount: "0", oversizedSessionCount: "0",
});

async function observeRows(counts: Record<string, string>, rows: readonly (readonly Record<string, unknown>[])[]) {
  let queryIndex = 0;
  return observePositiveWorktreeActiveRowSnapshotWithTransactionV2(async (mode, operation) => {
    assert.equal(mode, "isolation level repeatable read read only");
    return operation(async () => {
      const index = queryIndex++;
      return index === 0 ? [counts] : rows[index - 1]!;
    });
  });
}

test("active rows preserve nullable worktree paths and BIGINT claim IDs without ownership claims", async () => {
  const claimId = "9007199254740993";
  const result = await observeRows({ ...emptyCounts, runCount: "1", claimCount: "1", attemptCount: "1", sessionCount: "1" }, [
    [{ runId: "run-1", status: "running" }],
    [{ claimId, runId: "run-1", stepId: "step-1", storyId: null, agentId: "agent-1" }],
    [{ attemptId: "attempt-1", runId: "run-1", stepId: "step-1", storyId: "",
      claimId, worktreeRoot: null, disposition: "claimed" }],
    [{ sessionId: "session-1", runId: "run-1", claimId, attemptId: "attempt-1",
      worktreeRoot: "/tmp/runtime-worktree", state: "running", ownerInstanceId: "owner-1" }],
  ]);
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.deepEqual(result.counts, { runCount: 1, claimCount: 1, attemptCount: 1, sessionCount: 1 });
  assert.equal(result.openClaims[0]?.claimId, claimId);
  assert.equal(result.activeAttempts[0]?.worktreeRoot, null);
  assert.equal(result.activeSessions[0]?.worktreeRoot, "/tmp/runtime-worktree");
  assert.equal(Object.isFrozen(result.activeSessions[0]), true);
});

test("an extra active-row field refuses instead of entering the snapshot hash", async () => {
  await assert.rejects(observeRows({ ...emptyCounts, runCount: "1" }, [
    [{ runId: "run-1", status: "running", unexpected: true }], [], [], [],
  ]), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
});

test("text IDs are ordered by PostgreSQL C collation bytes, not JavaScript UTF-16", async () => {
  assert.ok(Buffer.compare(Buffer.from("\uE000"), Buffer.from("\u{10000}")) < 0);
  await assert.rejects(observeRows({ ...emptyCounts, runCount: "2" }, [
    [{ runId: "\u{10000}", status: "running" }, { runId: "\uE000", status: "running" }], [], [], [],
  ]), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
});

test("a numeric claim ID refuses before JavaScript precision can corrupt it", async () => {
  await assert.rejects(observeRows({ ...emptyCounts, claimCount: "1" }, [
    [], [{ claimId: 9007199254740993, runId: "run-1", stepId: "step-1", storyId: null, agentId: "agent-1" }], [], [],
  ]), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
});

test("an oversized raw worktree path refuses even if the SQL preflight is incorrect", async () => {
  await assert.rejects(observeRows({ ...emptyCounts, attemptCount: "1" }, [
    [], [], [{ attemptId: "attempt-1", runId: "run-1", stepId: "step-1", storyId: "",
      claimId: null, worktreeRoot: `/${"x".repeat(2049)}`, disposition: "claimed" }], [],
  ]), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
});

test("a row outside its active predicate refuses instead of appearing active", async () => {
  await assert.rejects(observeRows({ ...emptyCounts, runCount: "1" }, [
    [{ runId: "run-1", status: "completed" }], [], [], [],
  ]), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
});

test("an oversized-field preflight refuses before any raw row query", async () => {
  let queries = 0;
  await assert.rejects(observePositiveWorktreeActiveRowSnapshotWithTransactionV2(async (_mode, operation) =>
    operation(async () => {
      queries += 1;
      return queries === 1 ? [{ ...emptyCounts, oversizedAttemptCount: "1" }] : [];
    })), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
  assert.equal(queries, 1);
});

test("count drift, oversized preflight, and a 257th returned row refuse instead of truncating", async () => {
  await assert.rejects(observeRows({ ...emptyCounts, runCount: "1" }, [[], [], [], []]),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
  await assert.rejects(observeRows({ ...emptyCounts, runCount: "257" }, [
    Array.from({ length: 257 }, (_, index) => ({ runId: `run-${index}`, status: "running" })), [], [], [],
  ]), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
  let rawQueries = 0;
  await assert.rejects(observePositiveWorktreeActiveRowSnapshotWithTransactionV2(async (_mode, operation) =>
    operation(async () => {
      rawQueries += 1;
      return rawQueries === 1 ? [{ ...emptyCounts, runCount: "256" }]
        : Array.from({ length: 257 }, (_, index) => ({ runId: `run-${index}`, status: "running" }));
    })), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
  assert.equal(rawQueries, 2);
});

test("postgres.js Result metadata is removed at the DB boundary without changing rows", async () => {
  class PgResult<T> extends Array<T> {
    constructor(...items: T[]) {
      super(...items);
      for (const key of ["count", "state", "command", "columns", "statement"]) {
        Object.defineProperty(this, key, { value: null, writable: true });
      }
    }
    static get [Symbol.species]() { return Array; }
  }
  const pgCounts = new PgResult(emptyCounts);
  assert.notEqual(Object.getPrototypeOf(pgCounts), Array.prototype);
  let queries = 0;
  const result = await observePositiveWorktreeActiveRowSnapshotWithTransactionV2(async (_mode, operation) =>
    operation(async () => normalizeActiveOwnerRowPgResultV2(queries++ === 0 ? pgCounts : new PgResult())));
  assert.deepEqual(result.counts, { runCount: 0, claimCount: 0, attemptCount: 0, sessionCount: 0 });
  const hidden = new PgResult({ runId: "run-1", status: "running" });
  Object.defineProperty(hidden, Symbol.iterator, { value: function* () {} });
  assert.throws(() => normalizeActiveOwnerRowPgResultV2(hidden),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
  const extra = new PgResult(emptyCounts);
  Object.defineProperty(extra, "unexpected", { value: "row evidence" });
  assert.throws(() => normalizeActiveOwnerRowPgResultV2(extra),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
});

test("duplicate claim IDs and malformed count values refuse", async () => {
  const claim = { claimId: "7", runId: "run-1", stepId: "step-1", storyId: null, agentId: "agent-1" };
  await assert.rejects(observeRows({ ...emptyCounts, claimCount: "2" }, [
    [], [claim, claim], [], [],
  ]), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
  await assert.rejects(observeRows({ ...emptyCounts, claimCount: "02" }, [[], [], [], []]),
    /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
});

test("a transaction rejection does not turn into an empty snapshot", async () => {
  await assert.rejects(observePositiveWorktreeActiveRowSnapshotWithTransactionV2(async () => {
    throw new Error("fixture-transaction-lost");
  }), /fixture-transaction-lost/);
});

test("a sparse row array refuses with the stable snapshot error", async () => {
  const sparse = new Array<Record<string, unknown>>(1);
  await assert.rejects(observeRows({ ...emptyCounts, runCount: "1" }, [
    sparse, [], [], [],
  ]), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
});

test("an empty read-only transaction is diagnostic row evidence, not zero-owner authority", async () => {
  const statements: string[] = [];
  let beginCalls = 0;
  const result = await observePositiveWorktreeActiveRowSnapshotWithTransactionV2(async (mode, operation) => {
    beginCalls += 1;
    assert.equal(mode, "isolation level repeatable read read only");
    return operation(async (statement) => {
      statements.push(statement);
      return statements.length === 1 ? [emptyCounts] : [];
    });
  });
  assert.equal(beginCalls, 1);
  assert.equal(result.schema, "setfarm.internal-production-positive-worktree-active-rows.v2");
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.deepEqual(result.activeRuns, []);
  assert.deepEqual(result.openClaims, []);
  assert.deepEqual(result.activeAttempts, []);
  assert.deepEqual(result.activeSessions, []);
  assert.match(result.snapshotHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.activeAttempts), true);
  assert.equal(statements.length, 5);
  assert.match(statements[0]!, /FROM public\.runs/);
  assert.match(statements[0]!, /FROM public\.claim_log/);
  assert.match(statements[0]!, /FROM public\.execution_attempts/);
  assert.match(statements[0]!, /FROM public\.runtime_sessions/);
  for (const clause of [
    /FROM public\.runs WHERE status IN \('running','resuming','cancelling','failing'\)/,
    /FROM public\.claim_log WHERE outcome IS NULL/,
    /FROM public\.execution_attempts WHERE disposition IN \('claimed','running'\)/,
    /FROM public\.runtime_sessions WHERE state NOT IN \('released','quarantined'\)/,
    /octet_length\(id\)>256/, /octet_length\(status\)>256/,
    /octet_length\(run_id\)>256/, /octet_length\(step_id\)>256/,
    /octet_length\(story_id\),0\)>256/, /octet_length\(agent_id\)>256/,
    /octet_length\(attempt_id\)>256/, /octet_length\(worktree\),0\)>2048/,
    /octet_length\(disposition\)>256/, /octet_length\(session_id\)>256/,
    /octet_length\(state\)>256/, /octet_length\(owner_instance_id\)>256/,
  ]) assert.match(statements[0]!, clause);
  const expectedSelects = [
    /SELECT id AS "runId", status FROM public\.runs\s+WHERE status IN \('running','resuming','cancelling','failing'\) ORDER BY id COLLATE "C" LIMIT 257/,
    /SELECT id::text AS "claimId", run_id AS "runId", step_id AS "stepId",\s+story_id AS "storyId", agent_id AS "agentId" FROM public\.claim_log\s+WHERE outcome IS NULL ORDER BY id LIMIT 257/,
    /SELECT attempt_id AS "attemptId", run_id AS "runId", step_id AS "stepId",\s+story_id AS "storyId", claim_id::text AS "claimId", worktree AS "worktreeRoot",\s+disposition FROM public\.execution_attempts\s+WHERE disposition IN \('claimed','running'\) ORDER BY attempt_id COLLATE "C" LIMIT 257/,
    /SELECT session_id AS "sessionId", run_id AS "runId", claim_id::text AS "claimId",\s+attempt_id AS "attemptId", worktree AS "worktreeRoot", state,\s+owner_instance_id AS "ownerInstanceId" FROM public\.runtime_sessions\s+WHERE state NOT IN \('released','quarantined'\) ORDER BY session_id COLLATE "C" LIMIT 257/,
  ];
  expectedSelects.forEach((pattern, index) => assert.match(statements[index + 1]!, pattern));
});
