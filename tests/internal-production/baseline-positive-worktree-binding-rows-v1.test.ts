import assert from "node:assert/strict";
import { test } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { observePositiveWorktreeBindingRowsInTransactionV1 } from "../../src/internal-production/baseline-positive-worktree-binding-rows-v1.js";

const fenceToken = "c".repeat(64);
const attempt = Object.freeze({ attemptId: "ATT_1234567890abcdef", runId: "run-1", claimId: "7",
  generation: 3, fenceToken, sourceSha: "a".repeat(40), sourceTreeHash: "b".repeat(40),
  worktreeRoot: "/runtime/story-worktrees/us-1", disposition: "running" });
const session = Object.freeze({ sessionId: "RTS_1234567890abcdef", runId: "run-1", claimId: "7",
  attemptId: attempt.attemptId, ownerInstanceId: "owner-1", worktreeRoot: attempt.worktreeRoot,
  state: "running" });

async function observe(counts: Record<string, unknown>, attempts: readonly Record<string, unknown>[],
  sessions: readonly Record<string, unknown>[]) {
  const statements: string[] = [];
  let index = 0;
  const result = await observePositiveWorktreeBindingRowsInTransactionV1(async (statement) => {
    statements.push(statement);
    return [[counts], attempts, sessions][index++]!;
  });
  assert.equal(index, 3);
  return { result, statements };
}

test("real active attempt and session fields remain diagnostic and redact the fence token", async () => {
  const { result, statements } = await observe({ attemptCount: "1", sessionCount: "1",
    oversizedAttemptCount: "0", oversizedSessionCount: "0" }, [attempt], [session]);
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.deepEqual(result.counts, { attemptCount: 1, sessionCount: 1 });
  assert.equal(result.activeAttempts[0]?.fenceTokenHash, hashCanonicalJson({
    schema: "setfarm.internal-production-positive-worktree-fence-commitment.v1",
    attemptId: attempt.attemptId, generation: attempt.generation, fenceToken,
  }));
  assert.equal(result.activeAttempts[0]?.sourceSha, attempt.sourceSha);
  assert.equal(result.activeSessions[0]?.ownerInstanceId, session.ownerInstanceId);
  assert.equal(Object.isFrozen(result.activeAttempts[0]), true);
  assert.equal(result.snapshotHash, hashCanonicalJson({ schema: result.schema,
    authority: result.authority, physicalIdentityProvenance: result.physicalIdentityProvenance,
    activeAttempts: result.activeAttempts, activeSessions: result.activeSessions, counts: result.counts }));
  assert.equal(JSON.stringify(result).includes(fenceToken), false);
  assert.match(statements[1]!, /FROM public\.execution_attempts/);
  assert.match(statements[2]!, /FROM public\.runtime_sessions/);
  assert.match(statements[1]!, /ORDER BY attempt_id COLLATE "C" LIMIT 257/);
});

test("empty active rows are explicit, not a zero-owner authority", async () => {
  const { result } = await observe({ attemptCount: "0", sessionCount: "0",
    oversizedAttemptCount: "0", oversizedSessionCount: "0" }, [], []);
  assert.deepEqual(result.activeAttempts, []);
  assert.deepEqual(result.activeSessions, []);
  assert.equal(result.authority, "diagnostic-only");
});

test("incomplete and oversized snapshots fail closed", async () => {
  for (const counts of [
    { attemptCount: "1", sessionCount: "0", oversizedAttemptCount: "0", oversizedSessionCount: "0" },
    { attemptCount: "0", sessionCount: "0", oversizedAttemptCount: "1", oversizedSessionCount: "0" },
    { attemptCount: "257", sessionCount: "0", oversizedAttemptCount: "0", oversizedSessionCount: "0" },
  ]) {
    await assert.rejects(observe(counts, [], []), /POSITIVE_WORKTREE_BINDING_ROWS_INVALID/);
  }
  let queries = 0;
  await assert.rejects(observePositiveWorktreeBindingRowsInTransactionV1(async () => {
    queries += 1;
    return [{ attemptCount: "0", sessionCount: "0", oversizedAttemptCount: "1",
      oversizedSessionCount: "0" }];
  }), /POSITIVE_WORKTREE_BINDING_ROWS_INVALID/);
  assert.equal(queries, 1);
});

test("crossed, malformed and extra row fields fail closed", async () => {
  const counts = { attemptCount: "1", sessionCount: "1",
    oversizedAttemptCount: "0", oversizedSessionCount: "0" };
  for (const badAttempt of [
    { ...attempt, fenceToken: "bad" },
    { ...attempt, generation: 0 },
    { ...attempt, sourceSha: "a".repeat(39) },
    { ...attempt, unexpected: true },
    { ...attempt, disposition: "verified" },
  ]) await assert.rejects(observe(counts, [badAttempt], [session]), /POSITIVE_WORKTREE_BINDING_ROWS_INVALID/);
  await assert.rejects(observe(counts, [attempt], [{ ...session, runId: "run-2" }]),
    /POSITIVE_WORKTREE_BINDING_ROWS_INVALID/);
  await assert.rejects(observe(counts, [attempt], [{ ...session, claimId: 7 }]),
    /POSITIVE_WORKTREE_BINDING_ROWS_INVALID/);
});

test("orphan active attempts and sessions stay visible for downstream unresolved classification", async () => {
  const counts = { attemptCount: "1", sessionCount: "0",
    oversizedAttemptCount: "0", oversizedSessionCount: "0" };
  const { result } = await observe(counts, [{ ...attempt, claimId: null, worktreeRoot: null }], []);
  assert.equal(result.activeAttempts.length, 1);
  assert.equal(result.activeAttempts[0]?.worktreeRoot, null);
  const orphanSession = await observe({ attemptCount: "0", sessionCount: "1",
    oversizedAttemptCount: "0", oversizedSessionCount: "0" }, [], [session]);
  assert.equal(orphanSession.result.activeSessions.length, 1);
});

test("duplicate, unsorted, sparse and over-limit row arrays refuse", async () => {
  const count = { attemptCount: "2", sessionCount: "0",
    oversizedAttemptCount: "0", oversizedSessionCount: "0" };
  for (const attempts of [
    [attempt, attempt],
    [{ ...attempt, attemptId: "z" }, attempt],
  ]) await assert.rejects(observe(count, attempts, []), /POSITIVE_WORKTREE_BINDING_ROWS_INVALID/);
  const sparse: Record<string, unknown>[] = new Array(1);
  await assert.rejects(observe({ ...count, attemptCount: "1" }, sparse, []),
    /POSITIVE_WORKTREE_BINDING_ROWS_INVALID/);
  let index = 0;
  await assert.rejects(observePositiveWorktreeBindingRowsInTransactionV1(async () => {
    return [[{ ...count, attemptCount: "256" }], Array.from({ length: 257 }, () => attempt), []][index++]!;
  }), /POSITIVE_WORKTREE_BINDING_ROWS_INVALID/);
  assert.equal(index, 2);
});
