# Task6A V2 direct CLI peek refusal plan

1. Confirm clean exact main `0cbaf1c6` and isolated worktree; preserve all
   other worktrees and selected old build/link.
2. Add a focused test extracting the real `step peek` route and proving the
   V2 check is immediately before `peekStep()` and any output. Observe RED.
3. Insert the one awaited assertion using the existing CLI import. Observe
   GREEN and leave shared peek/recovery behavior unchanged.
4. Run focused/pure/cutover tests, TypeScript, source contracts, and
   independent read-only review. Record unavailable isolated PostgreSQL
   credentials as unrun, never as a pass.
5. Commit and push the scoped branch, deliver reviewed PR, SHA-condition any
   merge, then clean-main build and sanitized no-write host check. Record
   poller/listener/maintenance and continuous writer-exclusion gaps.
