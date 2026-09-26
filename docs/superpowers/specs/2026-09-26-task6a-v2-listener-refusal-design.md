# Task6A V2 spawner LISTEN refusal design

## Decision

The spawner's four PostgreSQL LISTEN callbacks can dispatch `step_pending`,
`story_pending`, run termination and runtime completion without the existing
V2 pre-schema check. Poller and maintenance guards do not cover these event
entries. Each notification must sample the no-write V2 assertion after pure
JSON parsing and before invoking any handler or coordinator signal.

Use one private dispatcher for the four callbacks. It parses, awaits the
existing assertion, then awaits the supplied handler; a terminal rejection
handler bounds and redacts diagnostics. Callback registration order, channel
names, synchronous callback return and handler behavior remain unchanged.
Malformed JSON and async handler errors are caught rather than becoming
unhandled rejections. Do not change the recovery coordinator, direct handler
calls or the selected live service.

Exact-head review exposed a shutdown race: while preflight awaits, shutdown
can start, yet the detached continuation could still signal the recovery
coordinator after its join and ownership release. Recheck `shuttingDown`
immediately after the awaited assertion and before handler invocation. This
prevents a newly dispatched event from starting during shutdown without
altering the coordinator's handling of work already started before shutdown.

This is sampled event-entry refusal only. Already-running handlers, direct
processor calls, the OpenClaw cleanup timer and uncooperative writers remain
outside this seam. It grants no owner authority, Task6A admission, or
continuous DB/OS exclusion.

## File Map and verification

- `src/spawner.ts`: private shared parse/preflight/dispatch/rejection helper;
  route all four existing LISTEN callbacks through it. Preserve the existing
  poller's `logStepPendingRejection` call through a thin adapter to the shared
  redacted logger.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  RED/GREEN helper execution and AST route/order coverage for all channels,
  including a preflight-pending shutdown interleaving.
- `tests/claim-log-lifecycle.test.ts`: update the extracted private step
  listener factory and source contract; preserve pair-authentication tests.
- `docs/superpowers/plans/2026-09-26-task6a-v2-listener-refusal.md`:
  delivery sequence.

Run focused, pure/cutover and related spawner tests, TypeScript and source
contracts, then independent read-only review. Root writes alone and keeps
every existing development, historical and deployment worktree visible.
