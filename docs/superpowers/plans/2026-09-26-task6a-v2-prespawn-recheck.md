# Task6A V2 prespawn continuation recheck plan

1. Start isolated clean main `87defa51`; preserve all existing worktrees.
2. Add failing tests for the three awaited continuation boundaries, including
   fixed-operation refusal and shutdown after an await. Observe RED.
3. Insert existing V2 no-write assertions and shutdown rechecks at the three
   boundaries. Observe GREEN without changing ordinary pass-through behavior.
4. Run focused, pure/cutover, relevant spawner, TypeScript and source-contract
   verification; obtain independent read-only review.
5. Commit/push scoped PR, review exact head, SHA-condition merge, build clean
   main and run sanitized no-write host probe. Record residual continuous
   writer-fence and direct/in-flight gaps.
