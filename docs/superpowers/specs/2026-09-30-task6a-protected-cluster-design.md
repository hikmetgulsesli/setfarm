# Task6A private protected-cluster rehearsal

## Purpose and authority

The approved Task6A OS/PostgreSQL identity split requires independent evidence
before any live transition. PR #241 closes producer and historical-reader gaps
by default denial; it does not supply that exclusion. This small next deliverable
tests the OS/HBA boundary with actual PostgreSQL, not a capability-shaped fake.
The owner explicitly approved isolated OS/role/access rehearsal on 2026-09-27
and reaffirmed continuation; root remains the sole writer and delivery owner.

## Alternatives and decision

Use a private peer-authenticated cluster under a root-owned temporary ancestor.
It exercises the relevant macOS identity boundary without modifying shared
PostgreSQL, which also hosts ownpilot. SQL-only role demotion on the existing
trust-authenticated cluster cannot prove independent exclusion. Moving the live
cluster first is larger and introduces unreviewed drain/rollback hazards.

## Boundary

- macOS only; PostgreSQL 17; Node >=22; no new dependencies.
- Explicit opt-in `SETFARM_TASK6A_TEST_PROTECTED_PG_FIXTURE=1`; default discovery
  skips without sudo, filesystem effects or database access.
- No ambient DB harness/imports, URLs, PG environment or live 5432 connections.
- Existing `_postgres` server, `_www` scoped client and `nobody` old identities;
  no host account/group membership or sudo policy changes.
- Unique real `/private/tmp/setfarm-task6a-protected-pg.*` root; pinned dev/inode,
  root-owned 0711 ancestor, `_postgres` data 0700, protected configuration/HBA/
  ident root-owned 0444. Socket directory `_postgres:_www` 0710; socket mode 0777
  with no socket-group setting; no TCP listen addresses. The directory grants
  client search, not directory mutation; peer/ident restricts SQL impersonation.
- Disposable `task6a_admin`, non-login `task6a_owner`, and scoped login
  `task6a_runtime`. Only `_postgres` maps to admin and `_www` maps to runtime.
- Admin creates the probe schema. Runtime can SELECT/INSERT but cannot obtain
  owner/admin, DDL, destructive SQL, role administration or ALTER SYSTEM.
- Old UID cannot connect, mutate files/ancestors or inherit sudo. Client cannot
  impersonate admin, alter protected files, mutate socket directory or sudo.
- The driving admin UID is trusted and already root-capable. Homebrew executable
  ancestors are writable by that UID, not by the excluded nobody/_www actors.
  This fixture does not claim protected deployment authority against its driver.
  The server UID must also fail non-interactive sudo escalation.

## Lifecycle and evidence

Every command has an absolute executable, scrubbed environment and bounded
timeout. Every psql invocation explicitly selects socket, non-5432 port, role
and disposable database. Confirm actual server settings/HBA/ident, filesystem
owners/modes and PID/UID/start time/command/data identity. Stop only the captured
fixture process after those identities still agree, restart on the same protected
config, and repeat positive and negative SQL probes.

Cleanup never guesses a target or uses a wildcard/killall. Verify the exact
temporary root and a bounded no-symlink same-device tree, prove the fixture
postmaster is stopped, then remove only that disposable tree with root-controlled
system executables. Never run Homebrew Node as root or recursively chown paths.
Any
ambiguous lifecycle leaves the fixture for explicit recovery and fails the test.
This proves restart, not reboot/launchd persistence, old open-FD drain, production
grants, generated-agent isolation, broker handoffs or durable discard provenance.
Production Task6A/discard gates remain unchanged and closed.

## Tests

The regression catches allowing a scoped client to connect as fixture admin.
A controlled trust-HBA predecessor is unsafe on this shared host because SQL
superuser can execute as the server OS identity. It is never executed. Instead,
a pure launch-policy regression must fail when a missing guard admits that HBA,
then pass with the guard, before any ownership/server effect. The real peer/ident
configuration must pass negative SQL assertions including after restart. Default skip,
missing opt-in refusal and real privileged run are separately observed. No trust
mode or authentication override ships in the committed fixture.

## File map

- `tests/execution-attempts/task6a-private-protected-cluster.integration.test.ts`:
  self-contained disposable lifecycle and OS/HBA/SQL negative probes.
- `tests/execution-attempts/task6a-protected-cluster-policy.ts` and `.test.ts`:
  test-only pre-startup configuration guard and independent unsafe-input tests.
- `package.json`: one explicit isolated opt-in test command.
- `docs/superpowers/plans/2026-09-30-task6a-protected-cluster.md`: execution and
  exact evidence, review and delivery gates.

No runtime, selected build, live database, archive or service changes belong to
this deliverable. Source review and clean-main build precede further transition.
