import assert from "node:assert/strict";
import { test } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { normalizeActiveOwnerRowPgResultV2 } from "../../src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.js";
import { observePositiveWorktreeActiveBindingSnapshotWithTransactionV1 } from "../../src/internal-production/baseline-positive-worktree-active-binding-snapshot-v1.js";

const activeCounts = { runCount: "1", claimCount: "1", attemptCount: "1", sessionCount: "1",
  oversizedRunCount: "0", oversizedClaimCount: "0", oversizedAttemptCount: "0", oversizedSessionCount: "0" };
const bindingCounts = { attemptCount: "1", sessionCount: "1",
  oversizedAttemptCount: "0", oversizedSessionCount: "0" };
const root = "/runtime/story-worktrees/us-1";
const attemptId = "ATT_1234567890abcdef";
const sessionId = "RTS_1234567890abcdef";
const activeAttempt = { attemptId, runId: "run-1", stepId: "step-1", storyId: "story-1",
  claimId: "7", worktreeRoot: root, disposition: "running" };
const activeSession = { sessionId, runId: "run-1", claimId: "7", attemptId,
  worktreeRoot: root, state: "running", ownerInstanceId: "owner-1" };
const bindingAttempt = { attemptId, runId: "run-1", claimId: "7", generation: 3,
  fenceToken: "c".repeat(64), sourceSha: "a".repeat(40), sourceTreeHash: "b".repeat(40),
  worktreeRoot: root, disposition: "running" };
const bindingSession = { sessionId, runId: "run-1", claimId: "7", attemptId,
  ownerInstanceId: "owner-1", worktreeRoot: root, state: "running" };

function rows(overrides: Partial<{ activeCounts: Record<string, unknown>;
  activeAttempts: readonly Record<string, unknown>[]; activeSessions: readonly Record<string, unknown>[];
  bindingCounts: Record<string, unknown>; bindingAttempts: readonly Record<string, unknown>[];
  bindingSessions: readonly Record<string, unknown>[] }> = {}) {
  return [[overrides.activeCounts ?? activeCounts], [{ runId: "run-1", status: "running" }],
    [{ claimId: "7", runId: "run-1", stepId: "step-1", storyId: "story-1", agentId: "agent-1" }],
    overrides.activeAttempts ?? [activeAttempt], overrides.activeSessions ?? [activeSession],
    [overrides.bindingCounts ?? bindingCounts], overrides.bindingAttempts ?? [bindingAttempt],
    overrides.bindingSessions ?? [bindingSession]];
}

async function observe(resultRows: readonly (readonly Record<string, unknown>[])[]) {
  let begins = 0, queries = 0;
  const snapshot = await observePositiveWorktreeActiveBindingSnapshotWithTransactionV1(async (mode, operation) => {
    begins += 1;
    assert.equal(mode, "isolation level repeatable read read only");
    return operation(async () => resultRows[queries++]!);
  });
  assert.equal(begins, 1);
  assert.equal(queries, 8);
  return snapshot;
}

test("one read-only transaction retains positive attempt/session binding rows without physical authority", async () => {
  const result = await observe(rows());
  assert.equal(result.authority, "diagnostic-only");
  assert.equal(result.physicalIdentityProvenance, "unverified");
  assert.deepEqual(result.activeRows.counts, { runCount: 1, claimCount: 1, attemptCount: 1, sessionCount: 1 });
  assert.deepEqual(result.bindingRows.counts, { attemptCount: 1, sessionCount: 1 });
  assert.equal(result.bindingRows.activeAttempts[0]?.generation, 3);
  assert.equal(result.bindingRows.activeSessions[0]?.sessionId, sessionId);
  assert.equal(JSON.stringify(result).includes(bindingAttempt.fenceToken), false);
  assert.equal(Object.isFrozen(result), true);
  const { snapshotHash, ...body } = result;
  assert.equal(snapshotHash, hashCanonicalJson(body));
});

test("crossed count and identity refuse before a combined snapshot exists", async () => {
  for (const scenario of [
    rows({ bindingCounts: { ...bindingCounts, attemptCount: "0" }, bindingAttempts: [] }),
    rows({ bindingAttempts: [{ ...bindingAttempt, runId: "crossed" }],
      bindingSessions: [{ ...bindingSession, runId: "crossed" }] }),
    rows({ bindingSessions: [{ ...bindingSession, ownerInstanceId: "crossed" }] }),
  ]) await assert.rejects(observe(scenario), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_BINDING_SNAPSHOT_INVALID/);
});

test("nullable half-links and orphan sessions remain visible, not zero or nonowner", async () => {
  const nullable = await observe(rows({ activeAttempts: [{ ...activeAttempt, claimId: null, worktreeRoot: null }],
    bindingAttempts: [{ ...bindingAttempt, claimId: null, worktreeRoot: null }],
    activeSessions: [{ ...activeSession, attemptId: null, worktreeRoot: null }],
    bindingSessions: [{ ...bindingSession, attemptId: null, worktreeRoot: null }] }));
  assert.equal(nullable.bindingRows.activeAttempts[0]?.worktreeRoot, null);
  assert.equal(nullable.bindingRows.activeSessions[0]?.attemptId, null);
  assert.equal(nullable.authority, "diagnostic-only");
});

test("real postgres.js Result metadata is normalized at the query boundary", async () => {
  class PgResult<T> extends Array<T> {
    constructor(...items: T[]) {
      super(...items);
      for (const key of ["count", "state", "command", "columns", "statement"])
        Object.defineProperty(this, key, { value: null });
    }
  }
  let index = 0;
  const fixture = rows();
  const result = await observePositiveWorktreeActiveBindingSnapshotWithTransactionV1(async (mode, operation) => {
    assert.equal(mode, "isolation level repeatable read read only");
    return operation(async () => normalizeActiveOwnerRowPgResultV2(new PgResult(...fixture[index++]!)));
  });
  assert.equal(index, 8);
  assert.equal(result.bindingRows.counts.attemptCount, 1);
});

test("malformed postgres.js Result metadata refuses before any row is accepted", async () => {
  class PgResult<T> extends Array<T> {
    constructor(...items: T[]) {
      super(...items);
      for (const key of ["count", "state", "command", "columns", "statement"])
        Object.defineProperty(this, key, { value: null });
    }
  }
  const malformed = new PgResult(activeCounts);
  Object.defineProperty(malformed, "extra", { value: "PRIVATE_SENTINEL" });
  let queries = 0;
  await assert.rejects(observePositiveWorktreeActiveBindingSnapshotWithTransactionV1(async (_mode, operation) =>
    operation(async () => {
      queries += 1;
      return normalizeActiveOwnerRowPgResultV2(malformed);
    })), /INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_ROW_SNAPSHOT_INVALID/);
  assert.equal(queries, 1);
});
