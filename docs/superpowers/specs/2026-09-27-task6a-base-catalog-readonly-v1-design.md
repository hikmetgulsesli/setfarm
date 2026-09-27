# Task6A Base Catalog Read-only V1 Design

## Scope

This is the first, independently testable slice of the broader Task6A
`baseSchemaMode: "verify"` design. Add a standalone code-owned base-schema
catalog verifier. Do not call it from `pgMigrate()`, `ensureSchemaReady()`, a
LaunchAgent, or any live startup path in this slice. It neither verifies the
contract spine nor grants Task6A admission or writer exclusion.

The isolated PostgreSQL 17 role rehearsal proved that ordinary `pgMigrate()`
requires journal SHARE-lock privilege and later ordinary DDL, so a distinct
non-CREATE login needs a separate path. The current full contract-spine
verifier also has owner-relative/private-data checks; this slice cannot
silently replace it.

## Catalog contract

Export `verifyOrdinaryBaseSchemaCatalogReadOnlyV1(sql)` from a new focused
module in `src/db/`. It accepts the raw target-database `postgres.Sql`, opens
one bounded `REPEATABLE READ READ ONLY` transaction, and returns `void` only
after all required base objects match a static source-owned manifest. It must
not connect to `postgres`, call `ensureDatabaseExists()`, run base DDL, use
`pgGet`/`pgQuery`, or repair a mismatch. Any missing, altered, ambiguous,
inaccessible or timed-out catalog state refuses with a fixed error code that
does not include connection URLs, credentials or full private catalog text.

The source manifest covers seven required public ordinary tables (`runs`,
`steps`, `stories`, `claim_log`, `rules`, `medic_checks`, `run_observations`),
their required base columns with exact type/typmod/nullability/default/collation or
absent default, seven named primary keys, three named run foreign keys,
twelve named ordinary indexes, three FKs' enabled internal enforcement-trigger
groups on both sides, and two required sequences. The explicit
`runs_run_number_seq` remains standalone; the implicit `claim_log_id_seq`
is owned by `claim_log.id`. Sequence parameters and default dependencies
matter; mutable sequence values do not. Required table definitions are exact
but additional contract-spine columns, constraints and indexes are allowed.
The restricted login must not be a member of any required base table, index,
or sequence owner role; denied schema CREATE alone does not deny owner DDL.
Required ordinary base tables must have no rewrite rules, since an INSERT
`DO INSTEAD NOTHING` rule would change runtime writes without changing columns.
Their table access method must be PostgreSQL's source-created `heap`; an
alternate registered handler changes the storage contract without changing
the table kind or column projection.
The canonical PG17 fixture uses `default_table_access_method=heap`; a
non-heap default environment intentionally refuses pending a reviewed contract
change.
Both required table and associated TOAST `reloptions` must be unset; source
DDL does not opt out of automatic maintenance or set storage parameters.
Required base columns must have neither fast-default `atthasmissing` nor
`attmissingval`; a later-added column can otherwise expose stale logical
values after its visible default is removed.
Required text columns retain source-created `EXTENDED` storage; fixed-size
columns retain `PLAIN`, so a large value cannot be refused by a later
`SET STORAGE PLAIN` drift.
Required explicit indexes remain standalone and immediate; adopting one as a
deferred unique constraint must not silently postpone uniqueness enforcement.
An added foreign key may reference a required unique index without owning it;
only primary, unique or exclusion constraint ownership is refused here.
Before any live admission, audit the target catalog read-only: a historical
column created by an ordinary ALTER fallback may legitimately carry a fast
default and will fail this strict check until separately reviewed recovery.
`claim_log.run_id` deliberately has no base foreign key. A canonical
`runs.run_number` is NOT NULL; a legacy nullable fallback is intentionally
rejected until a separately reviewed recovery resolves it.

Use `pg_class`, `pg_namespace`, `pg_attribute`, `pg_attrdef`, `pg_constraint`,
`pg_index`, `pg_am`, `pg_trigger`, `pg_sequence`, and `pg_depend`, not privilege-filtered
`information_schema`. Reject relkind, partitioning, persistence, inheritance
edges in either direction, RLS enablement, forced RLS, dropped
columns, identity/generated-column drift, invalid/not-ready indexes, unexpected index expressions or INCLUDE
keys, wrong predicate, FK action, disabled enforcement triggers, deferrability, validation or ownership
dependency. Compare PostgreSQL 17 deparsed defaults/predicates against frozen
reviewed source-derived literals under a fixed `search_path`; do not generate
expected values from the target catalog at verification time.
Use `pg_catalog.set_config` as the first transaction statement to set the
transaction-local search path to `pg_catalog, public, pg_temp`, then set bounded
timeouts through qualified calls. A caller-supplied connection may enter with
`public` ahead of `pg_catalog` and a same-signature spoof function. Then
qualify every catalog relation and regclass constant with `pg_catalog` so a
reused session's `pg_temp` objects cannot shadow catalog reads or deparse names.
Sequence ownership must
also point to the `public` owner table schema, even though ordinary PostgreSQL
DDL already requires same-schema `OWNED BY`.

## Verification and delivery boundary

Use the separately verified PostgreSQL 17 cluster at a distinct data directory
and port, not merely a new database in the local live cluster. First observe
RED for missing verifier and one drift. Then run positive verification as a
distinct restricted LOGIN with no database/schema CREATE and no journal
MAINTAIN. Owner fixture setup and mutations may occur only in isolated
databases; the restricted verifier leaves a before/after catalog fingerprint
unchanged. Negative cases cover missing table/column/default/constraint/index/
sequence, wrong column type, nullability or collation, enabled RLS,
inherited child tables, disabled FK triggers on either side, and
role-denied access. Same-session public function and temporary catalog-name
shadows must not
turn an ordinary fixture into a mismatch. Fixed
transaction mode and bounded timeouts are unit-tested; full existing migration
tests, semantic digest check, typecheck and independent review remain gates.

This slice is not a production startup switch. Later PRs must independently
add the role-neutral contract journal/catalog check, resolve its parity with
owner-relative full verification, wire the opt-in `pgMigrate` mode, and prove
isolated DB/OS writer-denial before any live role/service/build transition.
This required-member verifier deliberately does not certify the absence or
semantics of additional user triggers, constraints or indexes
introduced by later migrations. That exact-extra surface belongs to the
current-head contract-spine check; accepting this standalone result alone as
runtime admission would be unsafe.

## File map

- `src/db/base-schema-readonly-verifier-v1.ts`: static expected base manifest,
  bounded catalog reads and fail-closed comparison; no DDL or application path.
- `tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts`:
  real isolated-database restricted-role positive/negative verification and
  no-write fingerprints. It runs only with an explicit private-cluster
`data_directory` preflight; generic P3 projection strips that environment.
The explicit `npm run test:base-schema-catalog:isolated` command is the gated
path for this case. It requires `SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY` and a
matching `SETFARM_TEST_PG_ADMIN_URL`; without the former, the integration case
skips and cannot be counted as a passing restricted-role gate.
- `tests/internal-production/base-schema-readonly-verifier-v1.test.ts`: pure
  SQL/transaction/error redaction and exact manifest-shape tests; included in
  the ordinary `test:internal-production:pure` command.
- `package.json`: keeps that pure registration in `npm test`, while the
  restricted-login integration retains its explicit private-cluster gate.
- `tests/internal-production/task-0-source-manifest.test.ts` and test runner
  registration only if their existing source inventory requires new file
  registration.
