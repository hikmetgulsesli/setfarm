# Task6A restricted startup to first database write — private rehearsal

## Causal boundary

PR #236 proves the opt-in no-DDL startup and post-close latch with a real
restricted PostgreSQL 17 login, but exercises only `SELECT 1`. The first
actual database mutation in `runWorkflow` is `pgNextRunNumber()`; an earlier
private successor fixture proves sequence USAGE only after a separate plain
verify-only call, not after the new restricted startup arm. Connect those
seams without treating sequence allocation as run birth or owner admission.

## Contract and RED/GREEN

Extend the existing exact-private-cluster fixture. With only journal SELECT,
prove `prepareTask6aRestrictedSpawnerDatabaseV1(owner)` succeeds and
`pgNextRunNumber()` is denied by SQLSTATE 42501 for the run-number sequence,
not by implicit DDL. Grant only USAGE on that sequence in the disposable
fixture; prove two safe monotone allocations and no UPDATE sequence right,
no runs/steps/claim/attempt/session INSERT/UPDATE/DELETE, no journal UPDATE,
no database/schema CREATE, and unchanged schema fingerprint. Direct table
INSERT and DDL remain denied after the grant. Produce a deliberate RED for
the missing scoped grant, then GREEN. Keep all credentials in memory and all
created roles/databases confined to the existing private fixture cleanup.

The test does not wire the live spawner, Mission Control, CLI, V2 admission,
role/credential/service identity, guarded 32/33 or physical owner path. The
ordinary spawner still calls bare `pgMigrate()` after earlier effects; live
restricted launch requires a separate reviewed entry before those effects.

## Delivery

Run focused private PostgreSQL 17 test, TypeScript, existing successor and
base-schema opt-in fixtures, source manifest and digest checks, independent
read-only review, exact-head GitHub review, SHA-bound PR merge, clean-main
build, merged-main private test and read-only host checks.

## File Map

- `tests/execution-attempts/task6a-private-restricted-db-startup.integration.test.ts`:
  restricted initializer → exact first mutation, scoped USAGE and denial matrix.
- This plan: explicit boundary and delivery evidence expectations.
