# Task6A restricted run producer Manifest A read

**Goal:** Let the restricted `a-runtime-run-v1` owner-begin/bind path authenticate the current Manifest A without `UPDATE` on the manifest-current row, while leaving activation publication serialization unchanged.

## Causal blocker and design

- PR #215 proved the production owner-head lock can be reached by a private restricted role with only fixture `UPDATE(head_version)`. The next `resolveActiveOwnerProducerV1` call currently defaults to `SELECT ... FOR UPDATE` on `internal_production_owner_producer_manifest_set_current_v1`; that forces a manifest-current write privilege solely to read an immutable, authenticated activation.
- Production currently publishes only phase A from null to A, using the current row's `FOR UPDATE` and a null→A CAS update. Keep that writer path and all non-run callers unchanged. For only `a-runtime-run-v1`, call the existing chain resolver in nonlocking mode. A read before activation commit sees null and rejects; an A read is validated against immutable activation/ancestry and physical readiness. Any future additional activation phase requires renewed concurrency proof.
- In the private PostgreSQL 17 fixture, after proving owner-head lock rights, grant only the exact SELECT relations needed to reach manifest-current, never manifest-current UPDATE. RED must fail SQLSTATE `42501` on the current row. GREEN must pass that SQL privilege barrier and fail closed on unavailable Manifest A/readiness, with no owner/run writes or head change. Keep journal UPDATE denied.
- No live grants, credentials, selected CLI, services, guarded migrations, or physical cutover state changes.

## File map and verification

- `src/db-pg.ts`: narrow `resolveActiveOwnerProducerV1` runtime-run manifest-current read mode.
- `tests/execution-attempts/task6a-private-successor-sequence.integration.test.ts`: actual restricted-role RED/GREEN privilege path and unchanged negative rights/state.
- `docs/superpowers/plans/2026-09-27-task6a-run-manifest-readonly.md`: rationale and evidence.
- Run private successor and adjacent opt-in tests, focused owner-admission/manifest regressions, TypeScript, source manifest/digests, independent read-only review, exact-head PR review, clean-main build, merged-main private test.

This is a read privilege root fix, not a positive owner-backed run or physical host receipt.

## Recorded result before delivery

- RED source contract: `resolveActiveOwnerProducerV1` still called the manifest-current resolver with its default row lock. Private PG17 SQL proved plain SELECT succeeds while `FOR UPDATE` fails SQLSTATE `42501` without manifest-current UPDATE; production owner-begin masked its internal SQL error to the existing fail-closed admission identity error.
- GREEN: only `a-runtime-run-v1` passes nonlocking mode; activation writer's explicit row lock and null→A CAS stay unchanged. Private fixture with revision zero rejects owner-begin as `RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID` without changing manifest current, owner reservations, or runs. This tests absence/privilege behavior, not an active A chain.
- Private successor 1/1, adjacent opt-in 2/2, source test 1/1, focused future-phase/readiness tests 2/2, TypeScript, source manifest 18/18, migration digests, and diff check passed. Independent read-only review found no Medium+ issue. PR/clean-main delivery pending.
