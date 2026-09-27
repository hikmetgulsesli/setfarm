# Task6A private successor sequence capability

**Goal:** Prove the first actual code-owned Setfarm runtime mutation under a distinct, constrained successor login on a disposable private PostgreSQL 17 fixture: `pgNextRunNumber()` is denied before sequence `USAGE`, then returns increasing safe integers after that single grant while table DML, sequence `UPDATE`, owner reachability, and DDL rights remain absent.

**Why now:** PRs #211/#212 prove old-login INSERT denial on four fixture tables, but not that an intended successor can perform any runtime operation. `src/installer/run.ts` calls `pgNextRunNumber()` and `src/db-pg.ts` implements it through `nextval('runs_run_number_seq'::regclass)`. A raw INSERT grant on four tables would not prove this code path or its minimum privilege. The first positive private run exposed a causal type bug: PostgreSQL `nextval` is `bigint` and the driver returned a string despite `pgNextRunNumber(): Promise<number>`; `runs.run_number` is `INTEGER`, so an explicit checked SQL cast is the smallest aligned fix.

## Boundaries

- Use a new isolated fixture, not the four-table owner-altered fixture: opt-in base verification requires exact public-object ownership by one independently named owner. Preserve the strict data-directory, port, socket, PostgreSQL 17, loopback, and absent ambient `SETFARM_PG_URL` preflight.
- Generated in-memory login credentials only. Grant database CONNECT, schema USAGE, and journal SELECT for `pgMigrate({baseSchemaMode:'verify',expectedSchemaOwner})`; then grant only `USAGE` on `public.runs_run_number_seq`. No live role, credential, service, selected CLI, or filesystem ownership changes.
- Assert distinct login/effective identity, no SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB, no owner MEMBER/SET/direct ADMIN, no database/schema CREATE, no sequence UPDATE, and no INSERT/UPDATE/DELETE on `runs`, `claim_log`, `execution_attempts`, or `runtime_sessions`.
- Sequence increments cannot be rolled back; the fixture database and role must be cleaned up on success/failure. The `INTEGER`-range overflow probe may advance the disposable sequence even when the cast fails. This is a first positive capability probe, not complete successor runtime grants, admission, or a continuous DB/OS writer fence.

## File map and checks

- `tests/execution-attempts/task6a-private-successor-sequence.integration.test.ts`: private preflight, role/fixture, opt-in verification, RED/GREEN sequence and negative table/DDL capability assertions, fixed cleanup.
- `src/db-pg.ts`: cast the `nextval` result to PostgreSQL `integer`, matching `runs.run_number`; the cast yields a JavaScript number and refuses out-of-range values rather than returning an untyped bigint string.
- `package.json`: dedicated private-cluster-only test command, excluded from ambient test suites.
- [x] RED: no sequence grant produced SQLSTATE `42501`; the expected allocation before adding the grant failed with the same code. After adding only USAGE, a second RED showed the returned value was not a JavaScript safe integer, exposing the `bigint` driver conversion bug.
- [x] GREEN: exact `USAGE` grant permitted two increasing safe-integer results, with adjacent `pgQuery` still usable and no broad DML/DDL rights; out-of-range allocation failed closed with SQLSTATE `22003`.
- [x] Focused private test 1/1, TypeScript, source manifest 18/18, migration digest, diff check, and independent read-only review (no Medium+ finding).
- [ ] Exact-head PR review, clean-main build, and merged-main private test before delivery.
