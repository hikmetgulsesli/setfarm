# Task6A V2 ongoing spawn refusal plan

1. Confirm linked isolated worktree, branch status, and focused baseline tests.
   Keep the original and deployment worktrees untouched.
2. Add a failing test in
   `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`
   that requires the V2 assertion to be the first `spawnAgentNow()` statement
   and shows refusal before the following effect boundary. Observe RED.
3. Add one awaited call at the start of `src/spawner.ts` `spawnAgentNow()`.
   Observe GREEN; do not modify the shared `claimStep()` or live hosts.
4. Run focused/pure/cutover checks, `npm run build`, source-contract checks,
   and independent read-only review. Repair only causal failures.
5. Commit on the scoped branch, push, deliver a reviewed PR, then synchronize
   and build clean main on the preserved deployment worktree. Verify exact
   source/build identity and sanitized host evidence. Record remaining direct
   claim, poller, and continuous writer-fence gaps without granting admission.
