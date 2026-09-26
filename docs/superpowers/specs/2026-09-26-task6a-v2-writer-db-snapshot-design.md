# Task6A V2 writer database snapshot design

## Context and decision

The merged Task6A V2 writer-topology preflight is deliberately caller-fed and never grants admission. A future authenticated host observation needs actual PostgreSQL role, database-owner, and existing-session facts without loading ambient Setfarm configuration or publishing its private connection URL. The live host currently has three launchers using the superuser/database-owner role `setrox`; application-only admission cannot fence it.

Considered paths: querying through `db-pg.ts` would inherit the ordinary runtime pool and ambient URL; extending the current V7 host result in place would couple new role facts to its frozen diagnostic schema; a separate import-inert read-only DB snapshot with a transaction-local projector can be composed later under held launchers and physical checks. Select the third path. This is a smaller independently reviewed DB seam, not the full source-authenticated host adapter or a role transition.

## Contract

Add one pure transaction-local projector and one private-URL adapter. The projector accepts only a query callback, executes one fixed SQL statement, validates exactly one plain PostgreSQL row, and returns a frozen canonical-hashed diagnostic. Its row fields are `databaseName`, `databaseOwnerRole`, `sessionRole`, `effectiveRole`, `login`, `superuser`, `bypassRls`, `createRole`, `createDatabase`, and `otherSessionCountText`. All role names use the V2 preflight grammar; booleans remain booleans; count is canonical nonnegative decimal text within JavaScript's safe-integer range. Require `databaseName:"setfarm"`, `effectiveRole === sessionRole`, and a nonempty database owner. A missing, duplicate, extra-field, proxy, accessor, malformed, or crossed row refuses with a stable sanitized error. The count covers every other backend for the exact database and `session_user` role, including idle sessions, by matching `pg_stat_activity.datid` to `pg_database.oid` and `usesysid` to `pg_roles.oid`, excluding `pg_backend_pid()`. It is a live sample, not continuous exclusion.

The adapter accepts exactly one caller-held `postgresql://` or `postgres://` URL for localhost/127.0.0.1 port 5432 and database `setfarm`, no query, fragment, multiple host, or ambient `PG*` option. It lazily imports postgres.js, requires the driver's parsed target to match the URL, sets connection-startup statement/lock/idle-transaction timeouts before `BEGIN`, opens one `REPEATABLE READ READ ONLY` transaction under a wall-clock deadline, sets local statement/lock timeouts, executes the projector through the current connection, and closes on every path. It independently requires the returned session role to equal the decoded URL username. No URL, password, backend PID, SQL query text from `pg_stat_activity`, token, or raw driver error may enter result or error. Connection/query/close failures refuse, not an empty snapshot.

The output always carries `authority:"diagnostic-only"`, `temporalScope:"catalog-snapshot-and-live-session-sample"`, `cutoverAdmission:"not-granted"`, and `physicalIdentityProvenance:"unverified"`. `REPEATABLE READ` gives a catalog MVCC snapshot, while `pg_stat_activity` is sampled live; the two are not an atomic census. It can supply validated DB facts to a later held-launcher composer, but it cannot authenticate any launcher, prove role membership or object grants, exclude future sessions/writers, produce V2 zero-owner authority, apply migration 32, or switch services. V1, V7, the pure preflight, migration32/33, current database, plists, worktrees, and selected historical CLI remain unchanged.

## Test and File Map

- `src/internal-production/baseline-task6a-writer-database-snapshot-v2.ts`: fixed SQL, strict transaction-local projector, canonical hash, import-inert private-URL adapter.
- `tests/internal-production/baseline-task6a-writer-database-snapshot-v2.test.ts`: RED/GREEN row parser, superuser and least-privilege samples, malformed/crossed rows, import/URL/driver refusal, one read-only transaction and bounded close through a fake driver, no secret output.
- `package.json`: add the focused test to the pure internal-production suite.
- `docs/superpowers/plans/2026-09-26-task6a-v2-writer-db-snapshot.md`: exact implementation and verification record.

No live 5432 call is part of this PR's test path. Use fake-driver tests, the pure/cutover/migration-digest/manifest suites, TypeScript and source contracts, independent read-only review, PR delivery and a clean-main guarded build. A separately versioned authenticated host verb must later hold and recheck the third Mission Control plist alongside the two Setfarm plists; Mission Control must not be appended to their idle-launcher array.
