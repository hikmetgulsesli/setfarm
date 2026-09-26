# Task6A V2 spawner poller refusal plan

1. Confirm clean exact main `14975c71` in an isolated worktree; preserve all
   existing historical, development and deployment trees.
2. Add an AST-based test of the real `pollForPendingWork()` body requiring
   the V2 assertion as the first statement of its `try`, before termination
   processing. Observe RED and refusal/pass-through effect ordering.
3. Insert one awaited assertion in the existing poller `try`. Observe GREEN;
   keep the catch, handlers, intervals and special startup paths unchanged.
4. Run focused/pure/cutover/relevant spawner tests, TypeScript and source
   contracts; get independent read-only review. Treat unavailable isolated
   PostgreSQL credentials as unrun, not passing.
5. Commit/push scoped PR; merge only the exact reviewed head, then build clean
   main in a preserved deployment clone and run sanitized no-write host
   diagnostics. Record separate timer/LISTEN and continuous-fence gaps.
