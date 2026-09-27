# Task6A private owner-head capability probe

**Goal:** Identify and prove the next restricted-role privilege boundary after the V31 insertion fence, without claiming an owner or workflow-run birth.

## Causal evidence and design

- Clean main `71718566` passes the private sequence and read-only-journal V31 fence test. The next production call, `beginOrAdoptInternalProductionOwnerReservationV1`, first locks `internal_production_owner_admission_head_v1` with `SELECT ... FOR UPDATE` before producer resolution and owner writes.
- Extend the existing disposable PostgreSQL 17 fixture test before its intentional V31 drift stage. Under the restricted successor, call the real owner-begin entry after the V31 fence. Expect SQLSTATE `42501` with no head rights and with head `SELECT` only.
- Grant `UPDATE` on only the head table's `head_version` column in the fixture. Hold its singleton row from an admin transaction and require a bounded SQLSTATE `55P03` from the successor's production call. This proves reachability of the exact head lock; it does not grant other head-column UPDATE, reservation/authority/run/step DML, or complete owner admission.
- Assert unchanged journal read-only status, no `runs` or owner reservation rows, and head identity unchanged. Use transaction-local timeout and robust holder release/cleanup.
- Do not change live roles, credentials, selected CLI, services, guarded migrations, or any deployment worktree. The existing private fixture creates and drops its own temporary role/database only.

## File map and verification

- `tests/execution-attempts/task6a-private-successor-sequence.integration.test.ts`: append the denied-first and narrow head-lock probe before the destructive V31 fixture check.
- `docs/superpowers/plans/2026-09-27-task6a-private-owner-head-capability.md`: scope and evidence.
- Run the private PostgreSQL test, adjacent opt-in test, TypeScript, source manifest/digests, independent read-only review, exact-head PR review, clean-main build, and merged-main private test.

## Recorded result before delivery

- RED: expecting lock timeout without owner-head rights failed with SQLSTATE `42501` on `internal_production_owner_admission_head_v1` at the production owner-begin entry.
- GREEN: no rights and SELECT-only both fail `42501`; fixture-only `UPDATE(head_version)` permits the call to wait on an admin-held exact head row and fail by bounded SQLSTATE `55P03`. `head_hash` and table-wide UPDATE remain denied; journal UPDATE and reservation/authority/run/step INSERT remain denied. Head identity, owner reservation count, and run count remain unchanged.
- Private fixture 1/1, adjacent opt-in 2/2, TypeScript, source manifest 18/18, migration digests, and diff check passed. Independent read-only re-review found no Medium+ issue. Exact-head PR and clean-main checks remain pending.

Full positive owner-backed run persistence additionally requires validated manifest activation, physical spawner readiness, exact scoped owner/readiness and run/step rights, and continuous DB/OS old-writer exclusion. None is inferred from this probe.
