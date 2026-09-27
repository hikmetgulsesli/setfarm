# Task6A read-only-journal run insertion fence

**Goal:** Let a restricted, opt-in verified runtime role enter the production V31 run-insertion fence without journal `UPDATE`, while preserving transaction-long serialization with migration apply/rollback and the privileged migration32 pre-stage window.

**Causal blocker:** PR #213 proved the first positive runtime mutation (`pgNextRunNumber`) with only sequence `USAGE`. The next production step, `lockInternalProductionWorkflowRunInsertionFenceV1`, uses `SELECT ... FOR UPDATE` on `setfarm_schema_migrations`. PostgreSQL 17 requires journal `UPDATE` for that lock, conflicting with the verified journal read-only role. Raw run/step INSERT grants or journal UPDATE would not solve the safety contract.

## Boundaries and design

- Runtime transaction takes the existing exported `contractSpineMigrationLockKey` **exclusively** via `pg_advisory_xact_lock` before a plain exact V31 journal read/identity check. Exclusive rather than shared is required to serialize runtime run births with each other as well as with migration paths.
- Inspected contract-spine apply/rollback paths acquire this exact advisory key before their journal locks. Do not change frozen migration statements or semantic digests.
- The current-entry migration32 opener also calls the runtime fence today. It must retain an exact V31 `FOR UPDATE` row lock after the advisory lock and revalidate the row under that lock, preserving the privileged held pre-stage interval. No restricted runtime role may take that branch.
- Remain fail-closed for absent/drifted V31, lock timeout, any SQL error, or ambiguous outcome. No live role/grant/credential/selected CLI/service changes, no guard bypass, no cutover admission claim.
- Older binaries or ad hoc SQL that lock only the V31 journal row do not participate in this advisory-lock protocol. Therefore this primitive cannot substitute for continuous old-writer exclusion at live cutover.

## File map and TDD

- `src/db-pg.ts`: share exact V31 row validation; runtime advisory + read-only journal path; privileged migration32 opener advisory + row-lock validation.
- `tests/execution-attempts/task6a-private-successor-sequence.integration.test.ts` (or a dedicated adjacent private test if cleaner): RED under a verified restricted role at the real exported fence; GREEN without journal UPDATE. Prove both-direction advisory blocking and absent/drift refusal on the disposable PG17 fixture, with cleanup.
- `tests/internal-production/owner-admission-v1.test.ts`: preserve migration32's exact held row-lock assertion and require advisory-before-row-lock order in its fake transaction.
- `tests/execution-attempts/run-terminal-transition.test.ts`: update the existing multi-lifecycle serialization holder to the shared advisory key. The adjacent `run-protocol.test.ts` source ABI check remains unchanged and is run as a regression.
- [x] RED: the restricted role's real exported run-insertion fence failed SQLSTATE `42501` at journal `FOR UPDATE`. A retained migration32 fake test initially failed when the SQL path split, ensuring its exact row-lock interval needed deliberate preservation.
- [x] GREEN: exclusive advisory serialization and plain exact-row runtime verification; private PostgreSQL fixture proved runtime→migration32 and migration32→runtime waiting, bounded SQLSTATE `55P03` lock timeout, post-fence journal UPDATE still denied, and checksum drift/absent V31 refusal. The migration32 fake test confirms advisory-before-row-lock order. The source/run lifecycle serialization and run-persistence ABI regressions passed.
- [x] Adjacent private base-schema opt-in test (2/2), private successor fence test (1/1), focused fake migration32 row-lock, lifecycle, and run-persistence ABI tests, TypeScript, source manifest (18/18), migration digests, and diff check passed. Independent review found an unbounded test-side lock wait; both restricted test acquisitions now have transaction-local timeouts and both sides are settled during cleanup. Focused re-review found no remaining Medium+ issue.
- [ ] Exact-head PR review and delivery, clean-main build, and merged-main private test.

This is only a privilege-compatible fence primitive. Full owner-backed run persistence still needs exact scoped owner-head/reservation/authority and run/step rights, current manifest activation, physical spawner readiness, and continuous DB/OS writer exclusion.
