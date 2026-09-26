# Task6A V2 claim-maintenance refusal design

## Decision

The merged poller check does not cover the separate timer that calls
`runClaimMaintenance()` every bounded interval. That function can reap,
reconcile and requeue claims. Put the existing no-write V2 pre-schema
assertion inside the function, after its no-work fast return but before its
existing catch and before setting `claimMaintenanceInFlight`. A refusal must
propagate to the poller's catch; it must not be swallowed by maintenance's
ordinary-error catch, after which the poller could continue other effects.

The assertion awaits I/O, so recheck shutdown and in-flight state after it
before claiming the in-flight flag. Keep the five maintenance operations,
their order and existing ordinary-error handling unchanged. The detached
timer must catch a rejected maintenance promise and log a bounded refusal,
preventing an unhandled rejection. Poller calls already sit inside its
existing catch. Preserve the timer interval and special startup ordering.

This is sampled maintenance-entry refusal, not a continuous lease. Work
already in flight can continue after the sample; LISTEN callbacks, the
OpenClaw cleanup timer and other writers remain independent gaps. No owner
authority, Task6A admission or cutover is granted.

## File Map and verification

- `src/spawner.ts`: assert before the maintenance catch and effects; recheck
  lifecycle after await; catch the separate timer's rejection.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  AST/extracted RED/GREEN effect-order, propagation and timer rejection tests.
- `tests/spawner-gateway-recovery.test.ts`: update the pinned timer shape
  without loosening the required separate maintenance interval.
- `docs/superpowers/plans/2026-09-26-task6a-v2-maintenance-refusal.md`:
  implementation and delivery sequence.

Run focused, pure/cutover, spawner/recovery, TypeScript and source contracts;
obtain independent read-only review. Root alone writes; preserve all existing
worktrees and selected historical service build/link.
