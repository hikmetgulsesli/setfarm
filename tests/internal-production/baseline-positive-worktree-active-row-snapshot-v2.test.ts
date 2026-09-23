import assert from "node:assert/strict";
import { test } from "node:test";

import { observePositiveWorktreeActiveRowSnapshotWithTransactionV2 } from "../../src/internal-production/baseline-positive-worktree-active-row-snapshot-v2.js";

const emptyCounts = Object.freeze({
  runCount: "0", claimCount: "0", attemptCount: "0", sessionCount: "0",
  oversizedRunCount: "0", oversizedClaimCount: "0",
  oversizedAttemptCount: "0", oversizedSessionCount: "0",
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
  for (const [index, table] of ["runs", "claim_log", "execution_attempts", "runtime_sessions"].entries()) {
    assert.match(statements[index + 1]!, new RegExp(`FROM public\\.${table}`));
    assert.match(statements[index + 1]!, /ORDER BY/);
    assert.match(statements[index + 1]!, /LIMIT 257/);
  }
});
