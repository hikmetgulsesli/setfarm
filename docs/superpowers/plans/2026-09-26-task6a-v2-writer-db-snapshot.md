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
3. Add adapter tests before adapter code: import-inertness, missing/ambient/remote/port/query/multihost URL refusal before driver import; fake parsed-target mismatch; one read-only repeatable-read transaction, two local timeouts, one fixed query, close on success/query/close failure, URL/session-role match, and no private string in results/errors. Run RED.
4. Implement adapter with a caller-held URL only, no ambient DB import. Lazy-load postgres.js after strict URL validation; verify parsed target; run projector inside bounded transaction; always close; map all failures to one stable sanitized error. Repeat focused tests to GREEN.
5. Run pure internal-production, cutover, migration-digest and manifest suites, TypeScript noEmit, source/path/version contracts, then commit and run guarded clean-worktree build. Request independent read-only review and resolve findings.
6. Push scoped branch, deliver reviewed PR without direct main commit; synchronize preserved clean-main deployment clone and verify guarded build/HTTP/read-only host diagnostics. Record remaining unproven writer-fence and positive-owner work explicitly.

## Guardrails

No live database call in this PR test path; no credential logging; no `SETFARM_ALLOW_DIRTY_BUILD` or runtime-guard bypass; no generated artifact edit; no destructive worktree action. A catalog snapshot plus `pg_stat_activity` sample is non-atomic and never proves absence of future writers.
