# Task6A Base Schema Read-only Verification Design

## Decision and scope

The owner approved the Task6A writer-fence transition plan on 2026-09-27.
This slice prepares its least-privilege rehearsal; it does not change live
roles, service credentials, selected CLI, LaunchAgents, admission or the
ordinary runtime default. Current `pgMigrate()` verifies the contract-spine
journal but still connects to a maintenance database and issues base-schema
DDL. A runtime role denied CREATE cannot use that path even if its schema is
already complete.

Three approaches were considered: switch the default immediately (too broad
for live services and tests), add a standalone verifier (duplicates migration
state), or add explicit `baseSchemaMode: "verify"` to `pgMigrate()` while
preserving the default. Choose the opt-in mode. No caller uses it for live
startup in this PR; wiring follows an isolated role rehearsal and separate
review.

## Contract

`pgMigrate({ baseSchemaMode: "verify" })` must reject incompatible options,
never call `ensureDatabaseExists`, and never execute CREATE, ALTER, DROP,
TRUNCATE, GRANT, REVOKE or data mutations. It uses the target database only,
starts a bounded repeatable-read read-only transaction, verifies the current
contract spine and the ordinary base schema's required tables, columns,
defaults, constraints, indexes and sequence using PostgreSQL catalogs, then
checks duplicate open claim invariants. `_schemaReady` becomes true only after
all verifications succeed. A missing database, missing/drifted catalog item,
incomplete journal, or SQL error refuses without repair. The public result is
void; errors expose no credentials or catalog text.

The opt-in verifier must be complete for the ordinary `pgMigrate()` DDL
surface at current main. It must not substitute a generic `to_regclass`
presence test, query via `pgGet`/`pgQuery` (which recurse into automatic
migration), or infer effective privileges from the Task6A V3 explicit-ACL
inventory. Migration application remains an explicit separate operation.

## Verification

Use an isolated PostgreSQL 17 cluster, not the live `setfarm` database. RED
integration: after ordinary fixture migration, a role without database/schema
CREATE runs opt-in verification successfully and leaves a before/after schema
fingerprint unchanged; intercepted SQL confirms read-only transaction and no
maintenance-database connection. Missing sequence, column/default, index,
constraint, table and contract journal each refuse without repair. A missing
target database refuses without creating it. Existing default migration tests
remain green, proving no implicit runtime switch. No password appears in
source, Git history, logs or test output. This is not a continuous writer
fence, cutover admission, or permission grant by itself.

## File Map

- `src/db-pg.ts`: explicit opt-in branch and state handling only.
- `src/db/base-schema-readonly-verifier-v1.ts`: focused bounded catalog
  verifier; no migration/DDL methods.
- `tests/execution-attempts/migrations.test.ts`: real isolated-database
  positive/negative regression tests at the public `pgMigrate()` boundary.
- `tests/internal-production/task-0-source-manifest.test.ts` and the package
  test surface only if a new file must be registered by their existing source
  inventory contract.

## Transition boundary

Only after this opt-in path and an isolated role/OS writer-denial rehearsal
pass may a separately reviewed PR change the runtime startup call site. Live
credential, role, service and selected-build transition still requires the
ordered evidence in `logs/2026-09-26-task6a-live-writer-fence-plan.md`.
