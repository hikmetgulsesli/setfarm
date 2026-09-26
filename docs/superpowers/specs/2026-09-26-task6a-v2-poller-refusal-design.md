# Task6A V2 spawner poller refusal design

## Decision

The V2 pre-schema check already covers ordinary spawner startup, new agent
spawns and direct CLI claim/peek. An already-running spawner's
`pollForPendingWork()` can still perform termination, runtime completion,
reconciliation, claim maintenance, orphan cleanup, auto-advance and spawn
scheduling before reaching the guarded `spawnAgentNow()` path. A fixed
current-entry operation may appear while the process is running.

Await the existing no-write `assertTask6aPreSchemaOrdinaryStartupV2()` as the
first statement in the poller's existing `try`, before any poll-initiated
effect. The existing catch logs a refusal and ends that poll iteration;
absent operation or exact through-33 journal continues the unchanged poll
path. Preserve special direct/cold startup ordering and all current handlers.

This is sampled poll-iteration refusal only. The separate claim-maintenance
and OpenClaw cleanup timers, LISTEN callbacks, startup effects, and ongoing
sessions remain outside this seam. No continuous DB/OS writer exclusion,
owner authority, Task6A admission or cutover is implied.

## File Map and verification

- `src/spawner.ts`: await the existing V2 assertion at the beginning of
  `pollForPendingWork()`'s effectful `try`.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  extract the real poller AST, prove first-effect ordering, and exercise
  refusal/pass-through against a fake first effect.
- `docs/superpowers/plans/2026-09-26-task6a-v2-poller-refusal.md`:
  RED/GREEN and delivery sequence.

Run focused, pure/cutover, relevant spawner tests, TypeScript and source
contracts, then independent read-only review. Root alone writes; retain all
existing worktrees and the selected historical service build/link.
