# Task6A private PostgreSQL receipt SQL proof

Root is the sole writer. PR #219 added a diagnostic DB adapter whose production
URL gate is fixed to local port 5432; fake-driver tests cover that wrapper but
cannot prove PostgreSQL parser behavior or restricted SELECT capability. Add
an opt-in private PG17 test without changing the production URL gate or live DB.

## File Map

- `tests/execution-attempts/task6a-private-receipt-sql.integration.test.ts`:
  require the exact identified `/tmp/setfarm-task6a-pg.*/data` cluster and
  non-5432 loopback admin URL; create an isolated database and random
  non-superuser login. Extract the adapter's exact two private SQL literals
  from its source (no generic raw-row API), seed one linked run/claim/attempt/
  session with a canonical root and source hashes, grant only SELECT on the
  two child tables, and prove exact-root bound SQL returns one matching pair
  in a `REPEATABLE READ READ ONLY` transaction. Outside that transaction,
  prove role/catalog lack of INSERT/UPDATE/DELETE and SQLSTATE 42501. Missing,
  alternate-root, duplicate and terminal conditions must not look positive.
  Keep passwords and raw fence bytes out of output; clean fixture and role.
- `package.json`: include the new opt-in private test in the existing Task6A
  private test selector; no default `npm test` dependency on a private cluster.

Run RED/GREEN private PostgreSQL test, focused pure/source tests, TypeScript,
manifest/digests, independent read-only review, exact-head PR, SHA-bound
merge and clean-main build/test. This proves the exact SQL/privilege slice,
not the production URL wrapper on the private port, source/physical producer
authentication, durable receipt, owner birth or live cutover.
