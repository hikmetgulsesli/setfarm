# Task6A private restricted database-startup rehearsal

## Causal boundary

The approved live writer-fence plan needs a distinct non-owner Setfarm runtime
role. Existing private PostgreSQL tests prove base-schema verify-only and
selected sequence/run-lock grants, but ordinary spawner startup still calls
default `pgMigrate()` after several earlier effects. Worse, `pgClose()` clears
the existing verify-only state, so later `pgQuery()` can implicitly try the
default DDL migration. A restricted service must never regain that path within
the same process.

## Contract

- Add a separate, explicitly invoked `db-pg` private rehearsal initializer.
  It accepts an expected schema owner solely for catalog verification, arms a
  monotonic no-default-migration latch synchronously before its first awaited
  database call, then invokes existing `pgMigrate({baseSchemaMode:"verify",
  expectedSchemaOwner})`. It does not publish owner/admission authority.
- The latch refuses default `pgMigrate()` and `ensureSchemaReady()` fallback
  whenever verification is not ready. `pgClose()` may close the connection
  but must not clear the latch; a fresh private URL still needs a new explicit
  verification before queries can proceed. The current-entry initializer must
  not set readiness before/after its await without that verification. Re-arm
  or arm-after-ordinary-init refuses. Existing ordinary spawner `await pgMigrate()` and V2 default-deny
  controller remain unchanged; there is no environment/CLI switch.
- `getSql()` exposes raw SQL and can bypass the in-process guard, so actual
  restricted PostgreSQL privileges remain the mechanical DDL fence. The
  initializer is a private rehearsal, not live startup admission, continuous
  OS/DB writer exclusion, or proof for guarded32/33.

## RED/GREEN and delivery

Use the explicitly identified private PG17 cluster and isolated fixture DB.
Create a non-superuser, non-owner login with journal SELECT and no CREATE;
prove real `pgMigrate` verify and `SELECT 1` without schema fingerprint drift.
After `pgClose()` and explicit reconfiguration to the same private DB, demand
a fixed refusal from `pgQuery()` and default `pgMigrate()` before any DDL.
Initially RED with the missing initializer; after adding it, independent review
found a post-close current-entry initializer bypass, reproduced RED with its
fixed-error assertion, then closed GREEN. A closing/replaced connection must
also invalidate readiness before the first await, and a late verifier cannot
mark a new connection ready. Test concurrent close/verify on private PG17.
Also test a drifted catalog remains refused, and ordinary startup
source order stays intact. Run TypeScript, focused PostgreSQL, source manifest
and migration digest, independent read-only review, exact-head PR review,
clean-main build, merged-main private PG and host checks.

## File Map

- `src/db-pg.ts`: private opt-in initializer and monotonic no-default-DDL
  latch; no ordinary startup rewiring.
- `tests/execution-attempts/task6a-private-restricted-db-startup.integration.test.ts`:
  actual restricted PostgreSQL17 role, fingerprint, post-close, concurrent
  close/verify, and drift refusal.
- `tests/execution-attempts/base-schema-opt-in.integration.test.ts`: preserve
  the existing verify-only initializer guard and pin the connection-generation
  boundary before a closing connection can report readiness.
- `package.json`: explicit private-cluster opt-in script.
