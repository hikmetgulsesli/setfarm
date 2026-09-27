# Task6A Base Schema Read-only Verification Design

## Decision and scope

The owner approved the Task6A writer-fence transition plan on 2026-09-27.
This slice prepares its least-privilege rehearsal; it does not change live
roles, service credentials, selected CLI, LaunchAgents, admission or the
ordinary runtime default. Current `pgMigrate()` verifies the contract-spine
journal but still connects to a maintenance database and issues base-schema
DDL. A runtime role denied CREATE cannot use that path even if its schema is
already complete. The standalone base-catalog and current-head journal
read-only verifiers were delivered in #206 and #207; this slice binds them
to the opt-in public migration entry point.

Three approaches were considered: switch the default immediately (too broad
for live services and tests), add a standalone verifier (duplicates migration
state), or add explicit `baseSchemaMode: "verify"` to `pgMigrate()` while
preserving the default. Choose the opt-in mode. No caller uses it for live
startup in this PR; wiring follows an isolated role rehearsal and separate
review.

## Contract

`pgMigrate({ baseSchemaMode: "verify", expectedSchemaOwner })` must reject incompatible options
and concurrent migration, never call `ensureDatabaseExists`, and never execute
CREATE, ALTER, DROP, TRUNCATE, GRANT, REVOKE or data mutations. It uses the
target database only. The existing `verifyContractSpineMigrations()` cannot be
reused as a least-privilege read-only verifier: it opens its own transaction
and takes a SHARE table lock requiring more than SELECT on the journal. A
separately reviewed, bounded current-head journal/catalog verification path
must use only read privileges. Existing migration detect/verify hooks also
contain owner-relative checks (`current_user`) and private-table reads that
cannot simply run under a distinct SELECT-only role without changing ACLs.
The new path must use role-neutral `pg_catalog` projections, compare stored
object owners to an independently held expected role identity supplied by the
code-owned caller, and explicitly state
which data invariants remain outside that role's visibility. A privileged,
code-owned current-head verification under a continuous writer fence
immediately before the transition must cover those invariants; the restricted
startup path cannot be called equivalent to the full verifier until
independent review proves parity. The base schema verifier then checks required
tables, columns, defaults, constraints, indexes and sequence in a bounded
repeatable-read read-only transaction. The two checks are sequential samples,
not one atomic snapshot or continuous fence. Within the base schema, required
definitions must be exact while extra contract-spine columns/objects remain
permitted. Duplicate open claim invariants are not visible to the restricted
SELECT-on-journal-only login. They remain a privileged, code-owned
pre-transition obligation under the continuous writer fence, not an implied
assertion of this opt-in path.
The expected owner is mandatory, cannot be the verifier login or a role it can
inherit, and must match every `pg_class` object in `public`, including tables,
indexes, sequences, views and standalone composite types, before readiness.
Quoted PostgreSQL role names are valid inputs; the exact name is bound as a
SQL parameter and compared to `pg_roles.rolname`. Ill-formed UTF-16 is refused
before binding, so encoding replacement cannot change the supplied identity.
It is not learned from the
target database's object owners;
a future live caller must hold it independently. Extra foreign-owned public
objects refuse rather than receive an implicit exemption.
`_schemaReady` becomes true only after all checks succeed; subsequent automatic
`pgQuery`/`pgGet` calls must not silently enter default migration. A missing
database, missing/drifted catalog item, incomplete journal, concurrent mode,
or SQL error refuses without repair. The public result is void; errors expose
no credentials or catalog text.

The opt-in verifier must be complete for the ordinary `pgMigrate()` DDL
surface at current main. It must not substitute a generic `to_regclass`
presence test, query via `pgGet`/`pgQuery` (which recurse into automatic
migration), or infer effective privileges from the Task6A V3 explicit-ACL
inventory. Migration application remains an explicit separate operation.

## Verification

Use a dedicated PostgreSQL 17 cluster with a verified distinct data directory,
port and authentication, not merely a uniquely named database on the live
local cluster. RED integration: after ordinary fixture migration, a role
without database/schema CREATE and without journal MAINTAIN runs opt-in
verification successfully and leaves a before/after schema fingerprint
unchanged; the existing leaf tests confirm read-only transactions, while
source review of the opt-in branch confirms it does not call the
maintenance-database helper. An absent target must remain absent. Missing
sequence, column/default, index,
constraint, table and contract journal each refuse without repair. A missing
target database and concurrent migration also refuse. Existing default
migration tests remain green, proving no implicit runtime switch. A distinct
restricted login must exercise the checks; do not use the object-owner login
as a substitute. No password appears in source, Git history, logs or test
output. This is not a continuous writer
fence, cutover admission, or permission grant by itself.

## File Map

- `src/db-pg.ts`: explicit opt-in branch and state handling only.
- `src/db/base-schema-readonly-verifier-v1.ts` and
  `src/db/contract-spine-readonly-verifier-v1.ts`: existing, separately
  reviewed verifier leaves, reused without weakening their checks.
- `tests/execution-attempts/base-schema-opt-in.integration.test.ts`: real
  private-cluster positive/negative regression at the public `pgMigrate()`
  boundary, with a distinct generated restricted login.
- `tests/internal-production/task-0-source-manifest.test.ts` and the package
  test surface only if a new file must be registered by their existing source
  inventory contract.

## Transition boundary

Only after this opt-in path, a current-head verification parity review, and an
isolated role/OS writer-denial rehearsal pass may a separately reviewed PR
change the runtime startup call site. Live credential, role, service and
selected-build transition still requires the
ordered evidence in `logs/2026-09-26-task6a-live-writer-fence-plan.md`.
