# Task6A V2 writer database snapshot plan

## Goal and safety boundary

Supply authenticated, caller-private database role and same-role session facts for a later held-launcher Task6A V2 composer. The observed `setrox` superuser/database-owner role and idle session make caller-supplied topology alone insufficient. This is a diagnostic prerequisite, not a migration, writer fence, positive physical owner receipt, or cutover admission. Keep V1/V7, frozen migration digests, live services, PostgreSQL roles, and preserved worktrees untouched.

## File Map

- `docs/superpowers/specs/2026-09-26-task6a-v2-writer-db-snapshot-design.md`: approved narrow design.
- `src/internal-production/baseline-task6a-writer-database-snapshot-v2.ts`: fixed SQL, strict one-row projector, canonical hash, and private local URL/driver adapter.
- `tests/internal-production/baseline-task6a-writer-database-snapshot-v2.test.ts`: RED/GREEN pure and fake-driver refusal/success coverage, including all-state other-session count and no secret output.
- `package.json`: enroll focused test in the pure internal-production suite.

## Execution

1. Add pure projector tests before source: exact fixed query, one valid blocked-role row, least-privilege row, canonical hash, all result fields frozen, malformed row/array/proxy/accessor/extra key and crossed role refusals. Query failure must become a stable sanitized error. Run focused test and record RED.
2. Implement projector. Its fixed query joins `pg_database` and `pg_roles` by OID for current database and `session_user`, returns owner/session/effective role and five role flags, and counts `pg_stat_activity` for `datid = database oid`, `usesysid = session role oid`, `pid <> pg_backend_pid()` without a state filter. Validate exactly one plain record, canonical count text, role grammar, flags, database `setfarm`, and `effectiveRole = sessionRole`; hash only validated public fields. Repeat focused tests to GREEN.
3. Add adapter tests before adapter code: import-inertness, missing/ambient/remote/port/query/multihost URL refusal before driver import; fake parsed-target mismatch; one read-only repeatable-read transaction, startup and two local timeouts, a hung `BEGIN`, one exact fixed query, close on success/query/close failure, URL/session-role match, and no private string in results/errors. Run RED.
4. Implement adapter with a caller-held URL only, no ambient DB import. Lazy-load postgres.js after strict URL validation; verify parsed target; apply startup statement/lock/idle-transaction timeouts before `BEGIN`, run projector inside a wall-clock-bounded transaction; always close; map all failures to one stable sanitized error. Repeat focused tests to GREEN.
5. Run pure internal-production, cutover, migration-digest and manifest suites, TypeScript noEmit, source/path/version contracts, then commit. Request independent read-only review and resolve findings. The guarded build requires `HEAD = origin/main`, so run it only after PR delivery on clean main; never bypass the guard on the feature branch.
6. Push scoped branch, deliver reviewed PR without direct main commit; synchronize preserved clean-main deployment clone and verify guarded build/HTTP/read-only host diagnostics. Record remaining unproven writer-fence and positive-owner work explicitly.

## Verification record

The focused test was RED on a missing module, then GREEN at 23/23; the reviewer-found stalled-`BEGIN` case was independently RED before the startup/deadline fix and GREEN after it. Post-fix pure 218/218, cutover 424/424, manifest 18/18, migration digests, TypeScript noEmit, version/English/path/Mission Control contracts passed. The independent read-only re-review found no remaining Critical or Important issue. A feature-branch `npm run build` refused at the expected `HEAD does not equal origin/main` guard; the clean-main build remains a post-merge step.

## Guardrails

No live database call in this PR test path; no credential logging; no `SETFARM_ALLOW_DIRTY_BUILD` or runtime-guard bypass; no generated artifact edit; no destructive worktree action. A catalog snapshot plus `pg_stat_activity` sample is non-atomic and never proves absence of future writers.
