# Task6A V2 spawner LISTEN refusal plan

1. Confirm isolated clean main `f652d083`; preserve other worktrees and
   selected old service build/link.
2. Add failing tests for shared parse/preflight/dispatch refusal and all four
   exact LISTEN channel routes before handler/coordinator effects. Observe RED.
3. Add one private dispatcher, route four callbacks through it, and update the
   existing extracted step-listener test factory. Retain the poller's existing
   rejection logger via a thin shared-logger adapter. Observe GREEN. Preserve
   callback registration order and existing recovery semantics.
4. Address exact-head shutdown-race review with RED for shutdown beginning
   while preflight is pending, then recheck `shuttingDown` after await and
   before handler invocation. Re-run tests and obtain exact-head re-review.
5. Run focused/pure/cutover/related tests, TypeScript and source contracts;
   obtain independent read-only review. Treat unavailable isolated PostgreSQL
   credentials as unrun.
6. Commit/push scoped PR, merge only exact reviewed head, then build clean
   main and run sanitized no-write host diagnostic. Record remaining direct,
   in-flight, OpenClaw and continuous writer-fence gaps.
