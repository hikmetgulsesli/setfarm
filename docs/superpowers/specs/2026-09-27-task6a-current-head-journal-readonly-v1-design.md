# Task6A Current-Head Journal Read-only V1 Design

## Scope and decision

This is the next independently testable slice of the approved Task6A
least-privilege rehearsal. PR #206 delivered a standalone ordinary base-catalog
verifier; this slice adds a standalone, source-bound verifier for the exact
current migration journal (versions 1–33) and its own catalog shape. It does
not wire `pgMigrate`, change runtime startup, create roles, grant privileges,
switch credentials, run guarded migration 32, or authorize admission.

Three paths were considered: duplicate 33 identity literals in a second
manifest (fragile when migration source changes), reuse the current full
verifier (requires journal SHARE lock, owner-relative checks and private data
reads), or narrowly export immutable expected identities from the existing
source-owned `completeMigrations` and independently inspect the journal with
catalog SQL. Choose the third. The export contains only version, name,
checksum and migration class; no apply/detect/verify hooks or SQL handle.

## Contract

`verifyContractSpineCurrentHeadJournalReadOnlyV1(sql)` receives the raw
connection to the already-existing target database. It starts one bounded
`REPEATABLE READ READ ONLY` transaction, first sets the transaction-local
`search_path` to `pg_catalog, public, pg_temp`, then sets bounded lock,
statement and idle-in-transaction timeouts through `pg_catalog.set_config`.
It also sets `quote_all_identifiers=off` transaction-locally before exact
textual definition comparisons, so a user/database/session deparser default
cannot turn an unchanged source catalog into a false mismatch.
No maintenance-database connection, advisory lock, explicit table lock,
DDL, DML, repair or `pgGet`/`pgQuery` is allowed. Any missing, extra,
inaccessible, timed-out or malformed state reduces to one fixed redacted
error code; successful result is `void`.

The expected source identity is exactly 33 contiguous rows, versions 1–33.
For each row compare version, name and source-computed checksum; version 32
must have state `applied`, while every ordinary version may be `applied` or
`adopted`. No version 34 or unknown row is accepted. The verifier must not
read or compare mutable release/verification timestamps as identities.

The required `public.setfarm_schema_migrations` relation is a permanent,
ordinary, unpartitioned table with source-created heap access method,
default storage options/tablespace and replica identity, no inheritance edge,
RLS, rewrite rule, user trigger, policy or incoming FK. Its exact eight
columns, defaults, types, nullability, storage/collation and source-stable
order are checked using `pg_catalog`, not privilege-filtered
`information_schema`. The exact seven named constraints and two btree
supporting indexes must have source definitions, valid/immediate state,
normal default tablespace/options and no extra journal-owned constraints or
indexes. Explicitly reject unexpected dependencies on non-catalog functions
or operators in required CHECK constraints. The restricted login must have
SELECT on the journal but no journal MAINTAIN, database/schema CREATE or
ownership membership. Catalog queries are schema-qualified and resistant to
same-signature `public` functions and temporary catalog-name shadows.
The login must have no membership in another role: a NOINHERIT membership
can conceal a journal-writer grant from immediately effective privilege
checks, while SET permits switching roles and ADMIN permits self-granting
SET. This is an explicit fail-closed rehearsal restriction, not a runtime
grant or role change.
Its own role profile must be LOGIN and exclude SUPERUSER, CREATEROLE,
CREATEDB, BYPASSRLS and REPLICATION; the fixture creator flags alone do not
prove the verifier enforces that restricted profile.

This certifies only the current-head journal and its own catalog, not the
objects or private data supposedly installed by migrations 1–33. In
particular, migration-32 owner-admission provenance and migration-33 recovery
publication rows are not visible to the restricted role. Full current-head
parity needs separate source-pinned object projections plus privileged data
verification under a continuous DB/OS writer fence. The standalone result
must never be interpreted as Task6A admission or a runtime-ready signal.

## Verification

Use only the explicit private PostgreSQL 17 cluster already preflighted by
exact `data_directory`, non-live port and socket directory. With an isolated
fully migrated fixture, create a distinct random LOGIN without superuser,
CREATE, MAINTAIN, BYPASSRLS or owner membership. Grant only database CONNECT,
schema USAGE and journal SELECT. Positive verification must leave a before/
after catalog fingerprint unchanged. Negative fixture resets cover missing,
extra or edited journal row, wrong guarded state, revoked SELECT, altered
column/default/constraint/index, rewrite rule, user trigger, RLS and incoming
FK. Pure tests verify the transaction mode, first search-path statement,
bounded timeouts, fixed error sanitization and absence of write/strong-lock
SQL. Distinct private-cluster roles and databases are removed in a guarded
`finally`; cleanup failures fail the test. Existing migration tests,
semantic digest check, TypeScript and internal-production pure/manifest gates
remain mandatory before PR review and delivery.
An isolated NOINHERIT login with a SET-able or ADMIN-only journal-writer
membership must also be rejected even though its directly effective journal
write privilege is false.
Isolated ALTER ROLE negative cases must reject each privileged role attribute
and restore it before the next case.
The positive fixture must also pass with session `quote_all_identifiers=on`
without changing its session setting or catalog fingerprint.

## File map

- `src/db/contract-spine-migrations.ts`: one narrow frozen identity export
  derived from `completeMigrations`, outside frozen semantic migration regions.
- `src/db/contract-spine-readonly-verifier-v1.ts`: standalone transaction and
  exact journal/catalog verification; no startup or migration application.
- `tests/internal-production/contract-spine-readonly-verifier-v1.test.ts`:
  source identity, transaction, read-only SQL and redacted failure tests.
- `tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts`:
  restricted-role private-cluster positive/negative and no-write proof.
- `package.json` and the exact source manifest only where registration is
  required by existing test inventory.
