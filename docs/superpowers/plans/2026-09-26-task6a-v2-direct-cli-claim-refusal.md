# Task6A V2 direct CLI claim refusal plan

1. Confirm exact clean main `fe2dccf7` and linked isolated worktree. Preserve
   all other worktrees and selected historical build/link.
2. Add a failing focused test that extracts the `step claim` route and proves
   the V2 assertion runs before `claimStep()` and either output. Observe RED.
3. Add the one import and awaited assertion in `src/cli/cli.ts`. Observe GREEN;
   leave shared `claimStep()` and live services unchanged.
4. Apply the exact-head P1 review correction to the shared V2 assertion: first
   prove RED for a noncanonical installation with no fixed workspace, then
   prove descriptor-held stable absence only for an external checkout while
   keeping present, malformed and canonical cases fail-closed. Update the File
   Map and all focused cases before a new exact-head review.
5. Run focused/pure/cutover tests, TypeScript, source contracts, and independent
   read-only review. Treat missing isolated PostgreSQL test credentials as an
   unrun test, never a pass or reason to bypass a guard.
6. Commit/push scoped branch, deliver reviewed PR, SHA-condition merge, then
   synchronize/build clean main in a preserved deployment clone and take a
   sanitized no-write host observation. Record remaining peek/poller and
   continuous writer-fence gaps explicitly.
