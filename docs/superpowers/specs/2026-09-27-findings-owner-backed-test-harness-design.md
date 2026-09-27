# Findings owner-backed test harness design

## Decision and evidence

Clean main `f18aa8cb` builds, but its full `npm test` run fails in the
`test:findings` stage. Direct `node --test tests/findings/*.test.ts` creates
ordinary isolated databases with no activated owner-producer manifest, while
finding/recovery writers now require that authority. The repeated
`INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_UNAVAILABLE` failures are
one fixture-origin cascade, not permission to relax the production guard.
Under the existing P3 projection runner, four of five tests in
`recovery-delivery-repository.test.ts` pass. The remaining test manually
inserts a claim without the now-required canonical recovery claim publication;
its `RECOVERY_ATTEMPT_CLAIM_PUBLICATION_NOT_FOUND` refusal is correct.

Two approaches were considered. Adding a fake activation or a forged
publication to the ordinary fixture would manufacture authority and weaken
the test's meaning. Running each owner-backed file through the existing P3
projected fixture preserves the production contract and isolates its database.
Choose the latter. Keep pure findings tests outside P3; execute owner-backed
files serially because the P3 runner authenticates exactly one test file and
the helpers use process-scoped database selection.

## Contract

The `test:findings` command must discover all findings `.test.ts` files,
reject a stale owner-backed allowlist, run pure files with `node --test`, and
run each owner-backed file through `scripts/run-isolated-postgres-tests.ts`
with `--test-concurrency=1`. It must preserve nonzero child exits and never
fall back to the ambient live `SETFARM_PG_URL`.

Read-only review found two safety refinements. Classify any direct import of
the isolated database fixture module as owner-backed, including its migration
factory. Independently reviewed indirect imports can defeat source-pattern
detection, so explicitly allowlist the eight pure files as well and refuse
every new unclassified findings test before any child starts. Before an owner-backed child starts, require the explicitly named
private Task6A cluster and verify its actual PostgreSQL data directory, port,
and socket directory through a read-only query. A mere localhost admin URL is
not sufficient because it could point to the live local database.

The legacy delivery test must assert that a manually inserted recovery claim
without canonical publication cannot reserve an attempt or advance its leased
delivery. Canonical success and duplicate reservation remain covered by the
current recovery claim/attempt integration tests. No runtime source,
PostgreSQL privilege, migration, admission, live service, or selected CLI is
changed.

The GitHub review authorization integration fixture also predates the
canonical recovery-publication fence. Preserve its success-path coverage by
seeding genuine compiler story admission, then acquire the recovery handoff
and publish the loop claim/runtime through the production API. Do not insert
a repair claim by hand or forge its publication.

The same stale pattern exists in one recovery-first claim-authority test: its
attempt-bound lease replay case must use a genuine compiler story admission and
canonical runtime publication before reserving the attempt. Keep its other
five lease/termination cases minimal and unchanged.

## Verification and boundary

The observed full-suite failure is RED. Run the findings command on the
explicit private PostgreSQL 17 cluster after the change; require zero skips
for owner-backed cases, then run affected pure/script tests, source manifest,
TypeScript and diff checks. If another independent fixture failure appears,
record its source and add a focused test repair; do not hide or skip it.
Deliver only after read-only review and exact-head PR checks. A clean-main
build and host HTTP check remain required, but this test-only slice is not
Task6A cutover admission or live rollout.
