# Recovery Reservation Lock Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve one native repair claim through transient reservation lock contention without changing its authority or budget.

**Architecture:** Retry only the existing native reservation SQL BEGIN once after a genuine PostgreSQL55P03 rollback. Keep preparation, immutable publication and post-commit processing outside the retry. Reuse the existing native repair PG fixture for real lock contention and original transaction semantics.

**Tech Stack:** TypeScript ESM, node:test, postgres.js, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-13-recovery-reservation-lock-retry-design.md`

## Global Constraints

- Two reservation SQL transactions maximum; retry only exact PostgreSQL code55P03.
- Preserve original claim, dispatch, source, immutable slice and lease deadline.
- Every fresh BEGIN executes all original owner, custody, lease and commit fences.
- No new privileged callback API, role, timeout change, lease extension, rearm or model budget.
- Root is the sole source writer and delivery owner; current live source stays unchanged during source work.
- Keep all operational records and secrets outside Git; no live DB test writes or providers.

## Task 1: Bounded native reservation retry

**Files:**
- Modify: `src/execution/v3-native-implementation-attempt.ts`, local `reserveRecovery` reservation transaction.
- Modify: `tests/execution-attempts/native-implementation-join.integration.test.ts`, existing `runNativeRepairReviewScenario` and two new cases.
- Modify: `scripts/run-isolated-postgres-tests.ts` and `scripts/__tests__/isolated-postgres-command.test.js`, literal bounded three-case selector registration and its positive/negative tests.

**Interfaces:**
- Consumes the unchanged `reserveRecovery(raw)` input, current `owner` or `options.sql`, original recovery delivery and compiled slice.
- Produces the unchanged `NativeImplementationContextV3` and existing refusal errors. No new production interface.

- [x] **Step 1: Add genuine transient and persistent head contention cases.**

Extend the native repair review mode union with `transient_head_lock` and `persistent_head_lock`. Install the test-only forwarding decorator only around the genuine successor `claimStep`. Its transaction flag arms after this real existing query with the fixture run id:

```sql
SELECT status, protocol FROM runs WHERE id = $1 LIMIT 1 FOR KEY SHARE
```

On the subsequent actual tagged SELECT of the admission-head singleton FOR UPDATE, start the holder using the original `database.sql.begin`, wait for its acquired barrier, apply `SET LOCAL lock_timeout='100ms'` to the tested fixture transaction, then forward the original head query. Do not replace SQL results. Observe the genuine55P03 only at the original BEGIN promise rejection, after rollback. In transient mode release and await the holder there, then rethrow the same error. In persistent mode retain it until finally cleanup. Count only armed reservation transactions, not earlier routing/publication transactions.

Transient assertions:

```typescript
assert.equal(successor.found, true);
assert.equal(reservationTransactions, 2);
assert.equal(realLockTimeouts, 1);
assert.equal(successor.attempt.generation, completed.compiled.attempt.generation + 1);
assert.equal(fresh.claimId, successor.claimId);
assert.equal(fresh.attemptId, successor.attempt.attemptId);
assert.equal(fresh.leaseExpiresAt, originalDeliveryDeadline);
assert.equal(committedSuccessors.length, 1);
```

Also retain the existing exact source revision, slice hash, dispatch and revision assertions. Persistent assertions:

```typescript
assert.equal(successor.found, false);
assert.equal(reservationTransactions, 2);
assert.equal(realLockTimeouts, 2);
assert.equal(committedSuccessors.length, 0);
assert.equal(fresh.attemptId, undefined);
assert.equal(fresh.claimId, undefined);
assert.equal(fresh.leaseExpiresAt, originalDeliveryDeadline);
```

Assert the original preparation observation still records reservation failure and published claim/runtime stay available for the existing lifecycle reconciler. Restore the original pool method and await every holder/call in finally. Do not create fake workers or terminal receipts.

- [x] **Step 2: Commit the test-only candidate and run the focused owned-PG constructor.**

First run the genuine pure command-parser tests with the new literal-vector acceptance assertion and observe its refusal. Add exactly one fixed seven-cell command vector for the two new test names plus the existing `native review R2 reloads after real recovery renewal and refuses expired or crossed owners` test, anchored with `^(name1|name2|name3)$`. Require the pure tests to pass and all changed-cell/pattern/file/extra/no-separator cases to remain refused. Original six-cell grammar and every other command remain unchanged. Then use this code-owned exact three-case selection with the same native owned-PG constructor; no bypass. The previous full file took 2,132,895ms, so repeatedly running all unrelated cases is unnecessary. Record the original PID/session, private log and natural exit. Expected RED: transient successor `found` is false because current code exits after its first actual55P03. Persistent refusal remains fail-closed but its two-transaction assertion also exposes the missing retry. A precondition failure is not RED; preserve it separately.

- [x] **Step 3: Implement the local retry after the qualified RED.**

Replace only the local reservation declaration/BEGIN assignment with this control flow, retaining the entire existing BEGIN callback unchanged:

```typescript
let reservation: ExecutionAttemptV1;
for (let reservationTry = 0; ; reservationTry += 1) {
  try {
    reservation = await (owner?.writeSql ?? options.sql).begin(async transaction => {
const ownerFence=owner?await enterOwnerRecoveryTransactionV1(transaction,owner):undefined;
const ownerResult=await(async()=>{

      await lockAttemptReservationOwnerInTransaction(transaction, input);
      await recheckNativeGitCustodyInTransaction(transaction, gitCustody);
      await pinOwnerRecoveryDeliveryLeaseV1(transaction,{dispatchId:input.recoveryDelivery.dispatchId,revisionId:input.recoveryDelivery.revisionId,
        ownerInstanceId:held.lease.ownerInstanceId,leaseToken:held.lease.leaseToken});
      const result = await reserveAttemptInTransaction(transaction, {
        claimId: input.claimId, runId: input.runId, stepId: input.stepId, storyId: input.storyId,
        attemptClass: authority.handoff.dispatchClass, packetHash: authority.origin.packetHash,
        compilationReportHash: authority.origin.compilationReportHash, sliceHash: assembled.sliceHash,
        sourceBefore: authority.revision.sourceRevision, findingSetHash: authority.findingSet.findingSetHash,
        recoveryCaseRevisionId: authority.revision.revisionId, recoveryDispatchId: authority.dispatch.dispatchId,
        recoveryDeliveryLease: { ownerInstanceId: held.lease.ownerInstanceId, leaseToken: held.lease.leaseToken },
        recoveryExecutionSliceEnvelope: assembled.envelope,
        role: input.role, agentId: input.agentId, branch: input.branch, worktree: input.worktree,
        evidenceRefs: [`setfarm://claim-log/${input.claimId}`, `setfarm://artifact/${assembled.sliceHash}`,
          `setfarm://preparation-authority-v2/${authority.origin.authorityHash}`,
          `setfarm://finding-set/${authority.findingSet.findingSetHash}`,
          `setfarm://recovery-revision/${authority.revision.revisionId}`, `setfarm://recovery-dispatch/${authority.dispatch.dispatchId}`,
          ...authority.reviewEvidenceArtifacts.map(artifact => `setfarm://artifact/${artifact.artifactHash}`),
          ...authority.predecessor.evidenceRefs.filter(ref => ref.startsWith("setfarm://native-git-custody-v1/"))],
      });
      if (result.status !== "reserved") throw new Error("V3_NATIVE_RESERVATION_CONFLICT");
      await pinOwnerRecoveryDeliveryLeaseV1(transaction,{dispatchId:input.recoveryDelivery.dispatchId,revisionId:input.recoveryDelivery.revisionId,
        ownerInstanceId:held.lease.ownerInstanceId,leaseToken:held.lease.leaseToken,attempt:result.attempt});
      await assertOwnerRecoveryMutationLiveIfOwnedV1(transaction);
await transaction.unsafe("INSERT INTO run_artifact_refs(run_id,ref_key,artifact_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [input.runId, assembled.sliceRefKey, assembled.sliceHash]);
      const refs = await transaction.unsafe<Array<{ artifact_hash: string }>>(
        "SELECT artifact_hash FROM run_artifact_refs WHERE run_id=$1 AND ref_key=$2", [input.runId, assembled.sliceRefKey]);
      if (refs[0]?.artifact_hash !== assembled.sliceHash) throw new Error("V3_NATIVE_RESERVATION_REFERENCE_CONFLICT");
      return result.attempt;

})();
if(ownerFence)await assertOwnerRecoveryTransactionBeforeCommitV1(transaction,ownerFence);
return ownerResult;
    });
    break;
  } catch (error) {
    if (reservationTry !== 0 || error === null || typeof error !== "object"
      || !("code" in error) || error.code !== "55P03") throw error;
  }
}
```

The callback above is copied from the current production source without changing its statements. Keep `publisher.put` before the loop, and `compileContext`, `publishContext`, `loadAttemptContext` after it. No sleep, new configuration, exported helper or error-message retry predicate.

- [ ] **Step 4: Verify GREEN, type checking and scope.**

Commit the clean test/code candidate required by the maintained native fixture, run the same owned-PG exact three-case selection once, and require all three selected cases to pass. Verify actual2/1 and2/2 transaction/timeout counts and atomicity/binding/lease assertions. Run `npx tsc --noEmit` for touched TypeScript. Build only from a clean allowed source as required; preserve original process results, never replay because of stream/capacity failure.

- [ ] **Step 5: Independent review and ordinary delivery.**

Review the whole diff and this task's explicit bounds independently. Root pushes only the scoped branch, obtains existing GitHub reviews/checks and performs normal protected PR delivery. Preserve old source and blocked-run evidence. Any clean-main build/installation/cutover and new software run uses existing separate reviewed operations and actual receipts.

## Verification checkpoint

The focused PostgreSQL RED run completed with three selected cases: existing R2 passed, transient contention failed on the actual missing successor, and persistent contention observed one real lock timeout instead of the required two. The owned cluster closed normally. TypeScript checking passed after the local retry implementation; focused GREEN and clean build remain pending.
