# Guard ordinary dashboard startup before its effects

## Causal scope

The live Task6A operation exists while the deployment-cutover intent directory
is absent. These are separate predicates. Ordinary dashboard entry currently
checks only cutover absence before status/PID/log/process/listener effects.
Its API's default database initialization can attempt database-existence and
connection work before verifying the contract-spine journal. Current Task6A
through33 admission has not been established.

This is the next Setfarm root fix within the approved Task6A startup objective.
Standing owner authorization covers the source change, focused tests and normal
reviewed delivery. No protected service, OS/role/credential transition, native
probe, migration or live run is admitted by this specification.

## Entry design

Use the existing asynchronous
`assertTask6aPreSchemaOrdinaryStartupV2` before ordinary dashboard effects. It
already checks a present operation against a read-only through33 journal and
rechecks the operation identity. Keep the cutover check before it and repeat
that check after its awaited continuation.

Preserve the synchronous `startDashboard` signature and return type for ordinary
installations with no Task6A operation. Add
`assertTask6aPreSchemaSynchronousOrdinaryStartupV3` using the existing workspace
scope and operation observer. It permits only absent operations; a present
operation refuses synchronously without attempting database initialization.

Add `startDashboardWithPreSchemaAdmissionV3`, an asynchronous server entry which
awaits the existing guard, rechecks cutover, then invokes a private server
constructor. The daemon uses this entry. Both public paths reach the same
private HTTP implementation; there is no exported unchecked constructor,
mutable admission latch, caller-supplied proof or bypass option. Making the
existing synchronous API asynchronous would needlessly break its callers.

Check the existing asynchronous guard at the CLI start/auto-start paths before
their status fast paths, at `startDaemon` before status/log/spawn work, and at
the direct daemon before PID publication. Keep the daemon's existing PID-before-
listener order and initial-only cutover semantics. This is not a held absence
epoch or a promise to undo an effect preceding a later independent refusal.

Do not insert a recursive guard in `getSql`: the existing guard uses it. Leave
the distinct restricted/core-reader routes and migration32/33 apply/verify
fences unchanged. Ordinary database initialization must not be used as an
admission probe.

## File Map

- `src/cli/cli.ts`: guard dashboard start and auto-start before status effects.
- `src/server/daemonctl.ts`: guard the parent before PID/log/process effects.
- `src/server/daemon.ts`: guard direct entry before PID publication; use the safe
  asynchronous server entry.
- `src/server/dashboard.ts`: preserve the synchronous API, add the guarded
  asynchronous entry and keep HTTP behavior in a private constructor.
- `src/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.ts`:
  absent-only synchronous refusal using the existing workspace/observer rules.
- `tests/internal-production/baseline-dashboard-cutover-startup-refusal-v2.test.ts`:
  genuine entry wiring with a controlled pre-schema refusal boundary; no actual
  service, database or native calls.
- `tests/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.test.ts`:
  execute the new synchronous guard's real body against scoped presence inputs.
- `tests/deployment-observation-route.test.ts`: explicitly isolate the ordinary
  test workspace from the live Task6A operation while retaining the synchronous
  server API and existing HTTP assertions.
- `scripts/__tests__/deployment-cutover-cli-entry-v4.test.js`: explicitly update
  the reviewed body pin only for the two added guarded CLI paths.
- This specification and its paired implementation plan: scope and evidence.

## Validation and limits

First observe actual RED: forcing pre-schema refusal must prevent status/PID,
log, child and listener effects through every ordinary entry. Then implement
the minimum change and run the complete dashboard refusal fixture, the selected
synchronous guard cases, four HTTP deployment-observation cases, maintained CLI
entry fixtures and existing direct CLI claim/peek invariants. Retain all prior
cutover, malformed, late-OPEN, runtime and output assertions.

Cover existing running and stale PID files before status inspection, and make
cutover become OPEN during a successful awaited admission. A positive async
fixture must reach the listener without re-entering the absent-only sync guard.
HTTP tests capture an owned empty workspace before module initialization.

Fixtures may replace the external pre-schema observation port to test entry
ordering; genuine synchronous guard semantics get separate body execution.
These are ordinary source tests. They do not run or qualify the40 DATA vectors,
native identity acquisition, initial TCB, OS/DB32/33, protected startup,3333 or a
real Setfarm run. A normal clean-main build follows reviewed PR delivery under
the existing build guard. No new dependency or guard-bypass environment flag.
