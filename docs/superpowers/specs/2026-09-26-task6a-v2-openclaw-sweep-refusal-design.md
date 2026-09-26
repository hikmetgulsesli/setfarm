# Task6A V2 OpenClaw stale-sweep refusal design

## Decision

An already-running spawner's OpenClaw interval bypasses the V2 poller and
maintenance guards. Its stale sweep can remove transcript locks, rewrite
session indexes and update the OpenClaw task SQLite database, then restart the
gateway. `restartGatewayAfterOpenClawCleanup()` may run a second sweep after
an awaited restart, when the current-entry operation could have appeared.

At interval entry, await the existing no-write V2 pre-schema assertion before
the first cleanup, recheck shutdown after the await, and catch/log a bounded
rejection from the detached callback. In the shared restart helper, only when
a restart succeeded, recheck the same assertion and shutdown immediately
before the post-restart sweep. The helper is also awaited by startup and
prespawn paths, so a late operation there must likewise refuse the second
sweep. Preserve the existing cooldown, restart and cleanup semantics when
the assertion permits ordinary work; do not alter direct/cold bootstrap.

These are sampled effect-boundary checks, not a continuous lock. An in-flight
cleanup/restart remains outside this guarantee, as do direct recovery
processors and uncooperative writers. No owner, admission, service switch or
Task6A cutover authority is granted.

## File Map and verification

- `src/spawner.ts`: guard the OpenClaw interval's first cleanup and the
  restart helper's post-await resweep, with shutdown rechecks and a detached
  rejection handler.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  RED/GREEN source-extracted timer refusal/pass-through and post-restart
  resweep ordering/interleaving tests.
- `tests/spawner-gateway-recovery.test.ts`: retain existing stale cleanup and
  restart source contracts; extend them for the new guard ordering if needed.
- `docs/superpowers/plans/2026-09-26-task6a-v2-openclaw-sweep-refusal.md`:
  delivery sequence.

Run focused, pure/cutover, spawner tests, TypeScript and source contracts and
independent read-only review. Root writes alone; preserve existing worktrees
and selected historical service build/link.
