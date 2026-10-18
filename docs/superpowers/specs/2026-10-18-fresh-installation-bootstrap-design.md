# Fresh Setfarm installation alongside preserved legacy data

Status: concrete design for review; implementation and live installation have not started.

## Outcome

Install one working Setfarm instance and connect Mission Control to it. Preserve
the existing `setfarm` database and runtime directories for comparison. Keep
Mission Control on 3080, the Setfarm dashboard on 3333, and the existing gateway
on 18789. A healthy page alone is insufficient: a clean bounded workflow must
advance through the real platform and finish with verifiable database events,
runtime evidence and final outcome.

The owner's current instruction permits a fresh installation and makes a full
working system the priority. The unfinished protected legacy Task6A migration
remains unfinished; this installation must not claim its tests or transition
completed.

## Current evidence

- Sole writer: the existing `setfarm-dashboard-cutover-controller-20261007-v1`
  worktree, starting at `0010a4307a181a66302f9762c0b6ff9794d828ab`.
- PR284 is merged. Its focused 58 tests and clean build were previously
  verified. They do not prove a running installation.
- Mission Control and the gateway return HTTP200. Port3333 refuses connections.
- Dashboard and spawner LaunchAgents retry every60seconds, exiting2. Their
  current configuration points at the legacy database.
- The global CLI symlink points at the older internal-production-bootstrap
  worktree. Repeated service starts cannot correct that selection.
- The existing current-entry operation is retained at
  `data/internal-production-baseline/current-entry-v1/current-entry-operation.json`.
  SHA256: `ebcba187e953fda9e7962a0ce0cf4fc10feed881e9ce69b6d59140a9ef43d7f6`.
  It has no cancellation lifecycle or supported withdrawal command.
- A different environment directory, checkout or database URL does not isolate
  the fixed workspace operation. The runtime verifies the source schema through33;
  the explicit ordinary migrator stops at guarded32 and cannot install33 first.
- A new bootstrap therefore needs its own real provenance. Test fixture evidence
  and fabricated Task6A receipts are not valid installation mechanisms.
- Free disk is approximately9.14GB. The retained8GiB floor leaves approximately
  548MB for new work. Reuse the existing PostgreSQL17 server, Node, dependencies
  and reviewed release; do not copy the whole PostgreSQL cluster or reinstall
  dependencies as part of this change.

## Considered approaches

1. Complete the protected legacy transition first. This preserves that original
   path, but its missing native resource/ownership evidence makes it the wrong
   critical path for the owner's new priority.
2. Withdraw the operation and reuse the old database. There is no supported
   withdrawal command. It also couples recovery to legacy state and risks the
   comparison data.
3. Create a separately named database and private runtime directory, with an
   explicit clean-install bootstrap and independently verifiable origin.
   Recommended. It preserves history and gives new work an unambiguous origin.

## Installation boundary

Use `setfarm installation prepare`, `apply`, `status` and `verify` as the explicit
operator lifecycle. Preparation is read-only; apply alone can provision. The
installer must generate its installation UUID and target name, rather than
accepting an arbitrary existing database as a fresh target. The generated target
name is `setfarm_install_` followed by32 lowercase hexadecimal digits. Never use
`setfarm`, `postgres`, a template database or a test-fixture name as a fresh target.

The installer connects to the existing loopback maintenance endpoint using the
already configured local administrative connection. It must not print credentials.
It records the PostgreSQL system identifier, exact database OID and name, source
SHA and migration digest set. Identity is not just a database-name comparison.
Require a successful exclusive `CREATE DATABASE ... TEMPLATE template0`; a name
collision is refusal, never adoption or an automatic drop/retry.

Create separate newly named schema-owner and runtime roles for this installation.
The schema owner is non-login. The runtime role is non-superuser, cannot create
roles or databases, cannot bypass RLS, and is not a member of the schema-owner
role. Store generated credentials only in the private installation configuration.
Grant the runtime the operations required by the current platform, while keeping
schema migration, origin records and ownership outside runtime authority. Verify
the grants using a real runtime connection before publishing readiness.

The private runtime root is `data/installations/<installation-id>/runtime` in the
canonical workspace. Its plan, effect records and configuration live beside it.
Use a new root with exclusive creation and owner-only access. Do not reuse the
old product artifact store, PID files, singleton locks or installed workflow
state. New runs may reference the existing gateway, but must not inherit old
Setfarm run records or claim state.

## Schema bootstrap and origin

Add one production clean-install initializer. Its capability is created inside
the provisioning controller only after that controller has created and identified
the new database. A caller-supplied object, a parsed JSON receipt or a hash does
not authorize DDL. Reject supplied or cloned SQL handles and capabilities.

The initializer applies the canonical registered schema definitions, including
the32 and33 objects, under an explicitly different clean-install genesis. It
does not invoke a test fixture or mint the legacy guarded32 evidence purpose.
Schema writes occur with the new owner role. Verify canonical checksums, complete
catalog shape, ownership, source chain and owner-admission genesis before commit.
Bootstrap can only proceed from the empty database created by this operation.
Nonempty, partial, unknown and already-used databases are refused.

One transaction must contain the ordinary base schema currently embedded in
`pgMigrate`, the registered schema1–33, fresh genesis/application provenance and
transactional object grants. Factor and reuse the actual base DDL; the registered
migration list alone is not the whole platform schema. Verify all of those
components before that single commit. Creation of the database and roles occurs
outside it and is recorded separately; none of those effects means schema-ready.

The new origin has schema `setfarm.fresh-installation-origin.v1`. It contains the
installation ID, PostgreSQL system identifier, database OID/name, source SHA,
ordered migration identities, schema owner, runtime role and provisioning
operation identity. Its application schema is
`setfarm.fresh-installation-schema-application.v1`. These are distinct from the
Task6A guarded-migration application schema. Both migration verification and
owner-admission ancestry must validate this exact alternate origin and retain
the existing legacy checks. A hash match is necessary but not sufficient: verify
the origin against the actual connected database and the published installation.

Existing semantic migration regions cover the provenance verifier. Any affected
semantic digests must be regenerated through the existing source-integrity
tooling and reviewed explicitly. Do not relabel old journal rows or update the
legacy database to match new source. Compatibility tests must prove the old
origin retains its exact validation behavior and old source-chain mismatches
remain refusals.

## Runtime admission and service integration

An explicit installation selection locates a private, installer-published record.
It is a locator, not an allow/skip flag. At runtime, resolve the selected release,
connect as its restricted runtime role, verify database identity and installation
origin, and perform the ordinary current-schema verification. Only then can this
independent installation enter normal startup.

Before any real V3 claim, register and verify this installation's actual reviewed
source/build, owner-producer set and manifest-A activation/admission. Add a fresh
installation composition for these real prerequisites; genesis and schema33
alone do not activate them. It may consume only this installation's verified
origin, current release and producers. Never manufacture a legacy Task6A sealed
spawner, migration receipt or owner-transition record to satisfy this stage.
Activation must be required by the real claim path and tested there, with absent,
foreign and stale source/build or manifest records rejected.

The existing protected Task6A controller, original operation, default legacy
startup guards and any separate deployment-cutover guard remain in force. A
missing, incomplete, foreign, copied or modified installation record refuses
before PID/log/singleton/listener/worker effects. Selecting the old database with
a fresh record must fail. New-instance admission cannot discharge a legacy
operation, authorize a legacy migration or publish Task6A completion.

Bind all runtime paths consistently: `SETFARM_ENV_DIR`, `SETFARM_PG_URL`,
`SETFARM_DIR`, `OPENCLAW_STATE_DIR`, `SETFARM_PLATFORM_ROOT`, product artifacts,
projects and the CLI executable. Mission Control must read the same selected
database and invoke the same selected release as dashboard and spawner.
Preserve the old configuration bytes privately for comparison and rollback.

After source review, tests and a clean build, unload the two failing legacy
LaunchAgents serially; preserve their plist bytes. Do not run old and new
spawners together. Configure the replacement services and CLI to use the verified
release and selected installation. Start dashboard first, then spawner, then
switch Mission Control after its new database path has passed smoke checks.
The gateway stays on its current port and configuration.

Mission Control must identify the active installation. Old failed projects stay
discoverable through an explicit legacy comparison view or a separately invoked
read-only export; they must not appear to be runs from the new database. No
silent deletion or success reclassification is part of this installation.

## Failure handling

Record provisioning intent before effects and individual completed effects as
they happen. If a process ends after database creation or schema commit, keep
the new database and a failed/incomplete installation record. Resume may inspect
and reconcile only that same owned installation. It must never adopt a database
identified only by name, repair an unknown catalog or drop an uncertain target.
Readiness publication is the final installation step after actual verification.

The effect journal has explicit stages: `planned`, `database-created`,
`schema-committed`, `activated` and `ready`, with an error disposition retaining
the last proven stage. Before `schema-committed`, an aborted schema transaction
leaves the owned database uninitialized. A missing acknowledgment is reconciled
against the exact connected database identity and origin, never guessed from
the local stage alone. After a committed bootstrap, resume can verify, activate
the actual producer set and publish configuration/readiness only. It cannot
apply the empty-database bootstrap again, overwrite genesis or remint the
controller capability from a receipt. Any drift at that boundary refuses.

Application target binding and PostgreSQL access privileges are separate checks.
The fresh controller and runtime reject the legacy endpoint/database identity
before using it as a target. Do not infer that the new role cannot even connect
to the old database: existing PUBLIC privileges may permit that. Preserve the
old database ACLs, verify the new database's required restrictions, and report
the exact tested privileges without claiming an adversarial host/cluster fence.

Use the existing disk capacity policy with an8GiB free-space floor. Budget new
database, WAL, configuration, build and run artifacts together before each heavy
producer. If headroom is insufficient, inspect eligible caches or seek a smaller
bounded verification; do not discard retained build/runtime evidence. Keep
failed installation records truthful and runnable originals available for review.

## File map

- `src/installation/fresh-installation-plan-v1.ts`: read-only plan, generated
  target identity, path and capacity checks, redacted operator output.
- `src/installation/fresh-installation-origin-v1.ts`: strict alternate-origin
  types, parsing, hashing and connected-database identity binding.
- `src/installation/fresh-installation-store-v1.ts`: exclusive private records,
  provisioning effect journal and final readiness publication.
- `src/installation/fresh-installation-v1.ts`: new-database/role provisioning,
  controller-owned capability, source bootstrap and runtime-grant verification.
- `src/installation/fresh-installation-admission-v1.ts`: installed-record and
  connected-runtime verification before startup effects.
- `src/db/contract-spine-migrations.ts`: canonical fresh schema composition and
  distinct-origin verification without legacy evidence fabrication.
- `src/db-pg.ts`: connect/verify the selected installation without auto-repair.
- `src/internal-production/owner-admission-head-v1.ts`: preserve ancestry with
  the strictly validated legacy-or-fresh application union.
- Existing source/build and owner-producer activation modules: add the fresh
  origin composition required for real manifest-A admission, while retaining
  their actual claim-time checks and legacy receipt semantics.
- `src/cli/cli.ts`: exact installation lifecycle dispatch and operator output.
- `src/runtime-config.ts`, `src/installer/paths.ts`: consistent selected-instance
  database, state, artifact and workflow roots.
- `src/spawner.ts`, `src/server/daemon.ts`, `src/server/daemonctl.ts`,
  `src/server/spawnerctl.ts`: verified independent startup, ready acknowledgment
  and cleanup before any visible ready result.
- `mission-control/server/config.ts`, `server/utils/setfarm-db.ts`,
  `server/utils/setfarm.ts`: same installation/release selection; read-only legacy
  comparison stays explicit. Modify these only after the Setfarm interface is
  settled, with one writer per repository.
- Focused installation tests under `tests/installation/`, existing migration and
  owner-admission suites, and startup child-process lifecycle tests.

## Verification and delivery

1. A genuine failing integration test first: current code has no production
   empty-database path through33 with independent installation origin.
2. Unit tests for malformed/foreign/copied records, secret redaction, database
   identity mismatch, reused target, capacity failure and collision refusal.
3. Isolated real PostgreSQL integration: create a new target; install canonical
   schema; verify through33 and origin using the runtime role; prove the runtime
   cannot DDL or mutate provenance; prove application target binding rejects
   the legacy database without claiming a new old-database ACL. Preserve the legacy
   fixture byte/data fingerprint before and after.
4. Failure injection around target creation, schema transaction, grants,
   configuration and final publication. No partial record can start services.
5. Legacy provenance/Task6A refusal and current-source digest tests remain in
   the affected test set. No selected Native case is counted or reclassified.
6. Child-process startup tests prove malformed, partial or wrong-database
   selection causes zero listen/worker/PID effects; accepted selection sends
   genuine ready acknowledgment and terminates owned children on failure.
7. Independent source review, scoped branch delivery, clean build and release
   identity verification before the live installation.
8. Live HTTP checks on3080,3333,18789; actual spawner ready/heartbeat and correct
   database/release identity; one clean bounded workflow through real gates.
   Record any provider/quota failure as infrastructure, never as a passed run.

Complete means that last verification succeeds. The design, passing unit tests,
a merged PR or a rendered dashboard alone does not complete the owner's goal.
