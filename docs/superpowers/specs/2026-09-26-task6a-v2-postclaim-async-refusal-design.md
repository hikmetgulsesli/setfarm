# Task6A V2 post-claim async continuation refusal design

## Decision

The found-claim V2 sample precedes later awaited operations in
`spawnAgentNow()`. On the ordinary child-spawn path, awaiting the inline
security-gate selector (which returns false for non-security roles) can
resume into transcript/workspace/wrapper writes, and awaiting
`runtimeSessions.findById()` can resume into `markStarting()` and child
spawn. A fixed current-entry operation or shutdown can appear during either
await.

For the ordinary false branch, resample the existing no-write V2 assertion
and shutdown immediately after the inline selector and before its first
post-claim file effect. Resample again after `findById()` and before
`markStarting()`. On refusal, reuse the exact post-claim retention/unbound
accounting from PR #201, set an explicit refusal flag, and return. The outer
`finally` must remove only the in-memory claiming marker and skip its usual
release/retry/database cleanup for that flag. No child or starting-runtime
state exists at these two boundaries. Do not alter the terminal inline
security branch, which may already have completed a claim before returning
true; it needs a separate authority-safe protocol.

These are sampled checks. Prior handoff/transcript effects, an in-flight
inline gate or `markStarting`, and a fixed operation appearing after the final
sample remain outside their guarantee. No continuous writer fence, positive
ownership, Task6A admission or cutover authority is granted.

## File Map and verification

- `src/spawner.ts`: ordinary false-branch and post-`findById` V2 samples;
  explicit refusal flag suppressing the outer post-claim release `finally`.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  RED/GREEN AST/extracted refusal, permit, shutdown-interleaving and
  no-release ordering tests.
- `docs/superpowers/plans/2026-09-26-task6a-v2-postclaim-async-refusal.md`:
  scoped delivery steps.

Run focused, pure/cutover, relevant spawner, TypeScript/source contracts and
independent read-only review. Root alone writes; preserve historical and
deployment worktrees and selected CLI/dist/link.
