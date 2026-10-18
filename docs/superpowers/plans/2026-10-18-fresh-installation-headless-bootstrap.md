# Fresh Installation Headless Bootstrap Implementation Plan

> **For agentic workers:** Execute sequentially in the existing sole writer. Use read-only parallel review; implementation agents must not write or deliver this repository.

**Goal:** Create a genuinely new database and atomically initialize its real base schema and all33 registered migrations with distinct, database-bound fresh-install provenance.

**Architecture:** A provisioning controller exclusively creates the database and roles and privately owns their SQL handles. Only transactions registered by that controller may enter the canonical fresh initializer. The new origin is a strict alternate genesis; existing Task6A application validation remains strict. This headless stage publishes `schema-committed`, never operational `ready`.

**Tech Stack:** Existing TypeScript ESM, Node22+, postgres.js, PostgreSQL17, node:test and tsx. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-fresh-installation-bootstrap-design.md`

## Global Constraints

- Existing sole writer and branch `fix/fresh-installation-bootstrap-v1`; root alone edits, stages and delivers.
- Preserve legacy `setfarm` database, operation JSON, existing roles/ACLs, launchers and runtime artifacts.
- Keep8GiB free disk; serialize database/build producers. Reuse the existing PostgreSQL server; do not copy a cluster or dependencies.
- No Native experiment execution, budget reset, test reclassification, guard skip, invented Task6A evidence or source-chain rewrite.
- Create database names `setfarm_install_` plus32 lowercase UUID hex digits, using `TEMPLATE template0`; refuse collisions and existing/nonempty targets.
- Newly named NOLOGIN owner and restricted LOGIN runtime roles. Never output passwords or raw connection errors/URLs.
- One transaction covers ordinary base DDL, registered1–33 schema, fresh genesis/provenance and object grants. Rollback must leave no partial public schema.
- Preserve migration1–31 semantic digests. Regenerate and inspect only affected32/33 entries.
- Every success assertion requires actual command output. This stage does not prove service startup or a real workflow.

## File Map

- Create `src/db/ordinary-base-schema-v1.ts`: extract the52 ordered existing SQL calls; no transaction management.
- Modify `src/db-pg.ts`: import/call the helper in exactly the old position, retaining caller-owned readiness and old semantics.
- Create `src/installation/fresh-installation-origin-v1.ts`: strict origin/application union member, hashes and actual database identity validation.
- Create `src/installation/fresh-installation-catalog-v1.ts`: read-only catalog fingerprint of the schema actually verified inside bootstrap; exclude lifecycle data and changing planner statistics.
- Create `src/installation/fresh-installation-v1.ts`: private creation/transaction registry, exclusive provisioning, private effect records, initializer and restricted-runtime verification.
- Create `src/installation/fresh-installation-source-v1.ts`: derive the actual executing clean source checkout or finalized compiled release, with no caller-selected source authority.
- Create `src/installation/fresh-installation-records-v1.ts`: bounded private record publication/readback, physical installation identity and pinned creation records; credentials remain internal.
- Create `src/installation/fresh-installation-runtime-v1.ts`: read-only schema reopen and explicit acknowledgment reconciliation against actual source, database, role OIDs/policy and canonical catalog; no rebootstrap.
- Modify `src/db/contract-spine-migrations.ts`: new authenticated empty-database initializer, both genesis/current origin verifiers, actual all33 journal verification.
- Modify `src/internal-production/owner-admission-head-v1.ts`: strict legacy-or-fresh application validation and unchanged ancestry propagation.
- Modify migration source-integrity manifest/generated digests only for dependencies/regions affected by32/33.
- Create `tests/installation/fresh-installation-origin.test.ts`, `fresh-installation-bootstrap.integration.test.ts` and `fresh-installation-source-integrity.test.ts`: actual parser behavior, real PostgreSQL and mutation-based source binding; no default test-fixture bypass.
- Create `tests/installation/fresh-source-checkout-fixture.ts`: one bounded committed copy of actual production source for source-mode integration tests; reuse installed dependencies and delete only that suite-owned temporary directory.
- Create `tests/installation/commit-ack-proxy.ts`: test-owned bounded loopback proxy that loses one actual server COMMIT response, without parsing/logging frontend statements or credentials.
- Retarget the existing lifecycle-source boundary test in `tests/spawner-gateway-recovery.test.ts` to the extracted helper, preserving its current no-repair assertions.

## Task1: Atomic fresh database initialization

**Interfaces:**

```ts
type FreshInstallationOptionsV1 = Readonly<{
  adminUrl: string; // loopback maintenance database postgres only
  baseDirectory: string; // private existing parent; child UUID is exclusive
  sourceSha: string; // full Git object identity, not deployment readiness
}>;
type FreshInstallationV1 = Readonly<{
  installationId: string;
  directory: string;
  databaseName: string;
  ownerRole: string;
  runtimeRole: string;
  initialize(): Promise<FreshInstallationOriginV1>;
  verifyRuntime(): Promise<void>;
  close(): Promise<void>; // closes owned connections, never drops databases
}>;
export function createFreshInstallationV1(
  options: FreshInstallationOptionsV1,
): Promise<FreshInstallationV1>;
```

The controller generates UUID, target and role names. It creates a private child
directory and immutable intent before effects, then records exact created role
OIDs/database OID/system identifier. Runtime credentials stay in a0600 private
file. A failure preserves owned effects and a redacted failure record. No
production cleanup method is added merely for tests.

The fresh application contains schema, validated origin, evidence hash and
application hash. The origin binds installation UUID, system identifier, exact
database OID/name, owner/runtime identities, source SHA, creation operation ID
and ordered33 migration identities. A structural/hash match does not by itself
authorize initialization; only the controller's exact registered transaction does.

- [x] **Step1: Establish RED before production changes.** Call the existing
  `validateOwnerAdmissionMigrationApplicationV1` with a hand-built valid fresh
  origin/application and require acceptance. Current code refuses the new schema.
  Reject altered hash, unknown keys, wrong derived database name and missing
  migration identities. Add the real initializer integration contract; a missing
  API must fail as a clear assertion rather than disappear as a skipped test.

```ts
const parsed = validateOwnerAdmissionMigrationApplicationV1(application, hash);
assert.equal(parsed.schema, "setfarm.fresh-installation-schema-application.v1");
```

Run `node --import tsx --test tests/installation/fresh-installation-origin.test.ts`.
Capture the failing assertion and its natural exit before implementation.

- [x] **Step2: Extract existing base DDL without changing its semantics.** Move
  exactly the block from `CREATE SEQUENCE IF NOT EXISTS runs_run_number_seq`
  through both unique open-claim indexes to the helper. Preserve the52 calls,
  all SQL/error literals/order, duplicate-owner SELECTs and no lifecycle DML.
  Leave `_schemaReady = true`, migrations and database creation in the caller.
  The helper accepts the common callable query port so an actual transaction can
  use it without an implicit nested transaction.

- [x] **Step3: Implement strict fresh origin and application validation.** Keep
  legacy keys, schema, reference and hash rules unchanged. The fresh variant
  validates UUID/name/roles, bounded exact migration identities and both hashes.
  Current SQL verifiers additionally compare the origin to the actual database
  system identifier/OID/name/owner. Apply that check to both genesis-only and
  evolved-head current provenance consumers.

- [x] **Step4: Implement exclusive provisioning and authenticated bootstrap.**

```sql
CREATE ROLE <new_owner> NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE <new_runtime> LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOBYPASSRLS PASSWORD <private_generated_password>;
CREATE DATABASE <new_database> WITH TEMPLATE template0 OWNER <new_owner>;
```

Quote validated generated identifiers and password values using postgres.js
escaping. Do not use shell commands or interpolate caller-controlled SQL.
The maintenance connection never connects to the legacy database.

Inside one target transaction, verify identity/emptiness, set bounded lock and
statement timeouts, take the canonical advisory lock and `SET LOCAL ROLE` to
the new owner. Compose the actual migration apply callbacks where present,
not a copied/fake schema. The internal through32 core may be used through its
savepoint facade to preserve1–31 behavior; guarded32 itself is initialized by
the separate fresh controller route. Install33 only after exact32 provenance.
Verify all33 complete journal rows explicitly; the existing through32 source
chain helper alone cannot establish33.

The registered transaction must be removed from its private WeakMap in `finally`.
An arbitrary SQL handle, cloned receipt or reused initializer must be refused.
Use immutable stage records: `planned`, `database-created`, `schema-committed`;
failures retain the last proven stage. Commit acknowledgment loss is reconciled
by exact database/origin verification; never rebootstrap an existing database.

- [x] **Step5: Give the runtime only this stage's verified permissions.** Grant
  schema usage, required catalog-function metadata access and SELECT for schema
  verification. No runtime DDL, journal mutation or provenance-column writes.
  Base workflow DML and advanced owner-producer permissions belong to the later
  actual activation stage and must not be implied by headless verification.
  In particular, never use blanket table UPDATE to make a row lock succeed.

- [x] **Step6: Run genuine isolated PostgreSQL checks.** Call the production
  controller against the configured loopback maintenance database; initialize
  a newly generated target, then run ordinary through33/base-schema verification
  as the restricted runtime. Verify owner/runtime roles and no legacy mutation.
  For rollback, hold the target's canonical advisory lock from another session
  so bounded lock failure rolls the schema transaction back. Assert no public
  schema objects and no committed-stage record remain. Create a foreign relation
  before initialization to prove nonempty refusal. After successful initialization,
  call it again to prove no rebootstrap; forge a copied SQL handle to prove no
  admission. Tests clean only resources they created and whose recorded OIDs,
  owners and generated names still match. Preserve failures and refuse unknowns.

Run `node --import tsx --test --test-concurrency=1 tests/installation/*.test.ts`.
Run the affected owner-admission/lifecycle/digest tests by exact file or name.
Never invoke the owner-closed PM2 diagnostic through a wildcard script suite.

- [ ] **Step7: Inspect semantic changes and review the whole task.** Run the
  existing digest generator, compare1–31 to the base commit, then run
  `npm run check:migration-digests`. Resolve type errors with `npx tsc --noEmit`.
  Request read-only review against the complete diff and actual test receipts.
  Address findings, repeat only affected checks, then commit scoped source/tests.
  A clean build follows on the committed worktree; no dirty-build override.

## Following installation stages

After this independently testable headless unit, create the next execution plan
for actual source/build and manifest-A activation, instance-scoped configuration,
PID/log/process ownership, service readiness and Mission Control selection.
The known ordinary running-single-step application validator in `step-ops.ts`
must consume the same strict origin union. The exact legacy recovery bootstrap
parser remains legacy-specific until a separately justified fresh composition
uses it. Final delivery still requires3080/3333/18789 health, a real spawner
heartbeat and one bounded clean workflow through its actual gates.

## Progress

- Design approved by the owner's instruction: “sorunları gier ve devam”.
- RED: existing owner-admission parser refused valid fresh genesis (tool70105f,
  1failed/4passed); missing production initializer failed3 explicit assertions
  (723dce). Neither result is a completed integration run.
- GREEN: actual new initializer and restricted-runtime checks9passed/0failed/
  0skipped, including real PostgreSQL schema, nonempty refusal, mid-migration
  rollback, privilege denials, catalog drift and unchanged legacy parser
  contract (8400a4). Compilation/review/build/delivery remain separate gates.

## Evidence-driven implementation refinements

- Preserve actual ordinary ordering: canonical1–31, then52-call ordinary base
  helper, then fresh32/33. The real initial attempt proved base-first makes
  migration5 detect a partial `run_observations` schema (4d9996). Nothing in the
  registered1–31 definitions is changed to accommodate the new path.
- The rollback fixture holds the v27 installation lock `(1397117251,127)`;
  this fails after migrations1–26 executed inside the outer transaction and
  proves those earlier objects/journal do not escape rollback.
- Existing full migration verifiers contain destructive capability probes;
  runtime READ ONLY correctly rejected `DROP TABLE` with25006 (1499cf).
  Keep these full canonical checks inside the privileged bootstrap transaction.
  After all checks and grants, capture the complete public schema catalog hash
  in that same transaction, then compare it from the restricted runtime in a
  READ ONLY transaction. Include relations, columns/defaults, indexes,
  constraints, routines, triggers, sequence definitions, policies, rules,
  inheritance and types; omit lifecycle values and planner statistics.
  This preserves drift detection without granting runtime DDL or claiming a
  Native/OS ownership fence. The private committed record binds the hash to the
  same actual installation origin; a caller-supplied hash is not startup authority.
- The exact legacy finding-inventory receipt parser now explicitly refuses
  the fresh application variant before accessing legacy authorization fields.
  It does not interpret a fresh origin as a completed Task6A transition.
- Whole-task review found missing column ACLs, standalone namespace objects,
  source binding of the current-origin verifier and dense array validation.
  Genuine RED5058f2 proved both database defects; RED165a7f and22317a proved
  parser and source-binding defects. Fixes include `attacl`, public namespace
  dependency census/fingerprint, explicit32/33 semantic regions and dense own
  data entries without caller-controlled array methods. The rollback assertion
  now requires the exact `MIGRATION_LOCK_TIMEOUT` code. GREENd1f9e0 passed all13
  fresh tests, including that exact rollback reason. Typecheck7201ad exited0.
  A final combined rerun follows the strengthened foreign-enum retention check.
- PR285 review identified two additional root defects: caller-supplied release
  SHA and unverified cluster-level role policy. RED2fecb0 proved both before
  correction. Derive source identity from the code-relative clean checkout,
  verify every live source blob/mode and reject ignored extras or Git redirection;
  compiled mode requires the existing actual finalized clean-main build observer.
  The caller SHA is only an expected value, checked before provisioning effects
  and again around schema installation. Source-mode evidence is a checkout
  identity, not an activated release. Positive tests execute an exact production
  source copy committed into a temporary Git checkout, without a production flag
  or bypass. Verify actual owner/runtime role OIDs, all privilege flags, exact
  runtime session identity and zero unexpected role memberships. Keep legacy
  database ACLs untouched. A test-fixture ignore-pattern error73007c was corrected
  before rerunning; it was not a platform failure or a passing database test.
- Re-review exposed a mutable-input race. REDc8c025 produced a false all-zero
  origin SHA by changing the caller object during provisioning and restoring it
  before initialization. Capture all three validated own data properties before
  the first await, reject accessors/proxies/extra fields, and use one immutable
  actually derived SHA for all records and checks. GREENa598ec passed51 focused
  tests, zero failures/skips; final no-emit587c2f and digest checka26620 passed.
  Both scoped reviews approved patch9487a671…315a5 as C0/I0/M0. The source reader
  prechecks declared sizes and bounds every read;64MiB is a source-data cap,
  not a CPU or aggregate-request bound. Clean-main build follows PR integration.
- The second PR review found incoming owner-role grants were not checked.
  RED928a63 proved a separate new login could receive the owner role without
  runtime verification refusing. Check membership edges in both directions for
  owner/runtime roles. The real GRANT/REVOKE regression also checks incoming
  runtime-role grants, restored verification and exact grantee-OID teardown.
  GREEN0781c8 passed52 tests with zero failures/skips; no-emitbe6792 passed.
- The next review found database-level CREATE/TEMP grants escaped verification
  and a lost COMMIT response could strand a committed database without an
  acknowledgment. REDfefee2 proved the missing privilege rejection; RED4a874a
  proved no durable prepared record existed. Persist/fsync the exact origin,
  catalog and creation-record pins before COMMIT. Reconciliation reads private
  bounded records, verifies the actual source/DB/33-row journal/role policy and
  catalog, then may publish only the missing acknowledgment. Normal reopen is
  read-only and requires acknowledgment. No adoption or repeated initialization
  is introduced. Include database ACLs in the catalog fingerprint and explicitly
  require CONNECT without CREATE/TEMPORARY. GREEN09e6b2 passed the genuine server
  COMMIT-response interruption, concurrent acknowledgment recovery and unsafe
  private-file refusals (3passed/0failed/0skipped). No-emitb9c72a passed. The
  combined run9fe436 completed72 cases:70passed, with two stale exact source
  manifest expectations failing. Update those expectations to include the actual
  fresh regions/dependencies while preserving all mutation and historical digest
  assertions. Affected rerunc6a48c passed all15 digest cases. Thus all72 distinct
  selected cases have passing current-source results across those runs, not a
  claimed single72-pass run. Independent private-record/runtime and network-test
  reviews both returned C0/I0/M0. PR re-review and clean-main build remain gates.
- Review4306825507 found extra system/non-public ACL grants were still omitted.
  REDa3d9ba proved a real additional routine grant escaped verification. Inventory
  normalized relevant ACLs on non-public grantable objects, system parameters,
  tablespaces, default privileges and direct grants on other databases. Allow
  owner/runtime outside-public grants only for non-grantable EXECUTE on the exact
  zero-argument `pg_catalog.pg_control_system()`. Existing PUBLIC access on other
  databases is excluded: this verifies the selected installation and its explicit
  role grants, not a host-wide or cross-database PUBLIC-access fence. Internal
  TOAST/index relations are not ordinary grant targets and are excluded from
  default owner-grant refusal. Real tests change/restore runtime, owner and PUBLIC
  routine grants, reject grant-option escalation, and prove an unexpected grant
  before bootstrap rolls back without prepared/committed records. They never
  invoke a file-reading routine. GREEN86f4b6 completed all74 selected cases in one
  run:74passed/0failed/0skipped/0cancelled,67.564738s. No-emitd142d1 and digest
  checkebe694 passed. Scoped SQL/test review664943/61128d returned C0/I0/M0.
- The independent review then identified the implicit `pg_database_owner`
  principal. RED3dd100 proved its routine grant was missed. Include it in the
  relevant grant principals while retaining the exact two concrete role identity
  check; the intentional function exception remains restricted to those concrete
  roles. Affected GREEN6af1a3 passed4/4 with zero failures/skips, including the
  new implicit-role grant/refusal/restoration, complete schema, pre-bootstrap
  rollback and genuine COMMIT loss. No-emit2cf1e9 and digests11b461 passed.
  The earlier74-case run predates only this final principal-list refinement;
  report it separately from the affected current-source rerun.
