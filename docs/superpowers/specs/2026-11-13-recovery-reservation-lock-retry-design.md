# Recovery reservation lock contention

## Goal and evidence

Keep one transient PostgreSQL reservation lock timeout from stranding an already published native model-repair claim. A real run completed its generated candidate and produced a genuine TypeScript failure. Its native source-repair reservation then failed with PostgreSQL SQLSTATE `55P03` while acquiring `internal_production_owner_admission_head_v1`. No attempt or model worker was born. The existing reconciler later closed the expired prebirth claim and blocked the delivery. The original competing transaction is unknown; this change does not claim to identify or fix lock ordering.

This is causally required for Setfarm's existing generate, verify and repair objective. Generated source remains model-owned. Existing failed runs, claims, evidence and namespaces are preserved.

## Design

In `createNativeV3ImplementationContextService().reserveRecovery`, allow one additional execution of the existing reservation SQL transaction after its first rejected BEGIN promise has completed rollback with exact error code `55P03`. The upper limit is two SQL transactions total. Both transactions use the same prepared authority, published slice, claim, dispatch, source revision and original delivery lease. No delay, timeout setting, lease renewal, new dispatch, new claim, retry budget or privileged API is introduced.

The retry catch surrounds only `(owner?.writeSql ?? options.sql).begin(...)`. It excludes artifact publication and the post-commit context compilation/publication/loading calls. Every fresh BEGIN retains the original owner entry, reservation locks, Git custody recheck, delivery pin, attempt reservation and before-commit fences. A stale lease, changed custody, authority refusal or any non-55P03 error is immediately refused. The second lock timeout retains the existing refusal path.

The transaction already provides atomic reservation and replay semantics. A rejected SQL transaction leaves no committed attempt or admission sidecar. The successful second transaction must commit at most one attempt bound to the original claim, dispatch and immutable slice. Original lease deadlines must not change.

## Alternatives considered

A lock-order change requires the competing path, which current evidence does not identify. Increasing lock timeouts or renewing/rearming failed work would change existing limits or authority and is outside this fix. The bounded rollback retry addresses the demonstrated reservation failure while retaining those limits.

## File map

- `src/execution/v3-native-implementation-attempt.ts`: one local bounded retry around native recovery reservation BEGIN; all existing callback statements remain in the same order.
- `tests/execution-attempts/native-implementation-join.integration.test.ts`: two real PostgreSQL head-contention cases using the existing native repair fixture and genuine successor claim path.
- `scripts/run-isolated-postgres-tests.ts` and `scripts/__tests__/isolated-postgres-command.test.js`: one literal seven-cell selector for the two new cases and the existing R2 expired/crossed-owner case; original six-cell grammar and all other selectors remain unchanged.
- This spec and its implementation plan: scope, verification and delivery boundaries.

## Verification

First add the transient and persistent contention cases without production changes. The transient case must fail against the current code because no successor attempt is returned after the real PostgreSQL timeout. The persistent case must retain existing fail-closed behavior.

Use a test-only forwarding transaction decorator around the existing serial native repair fixture. Arm contention only after the exact reservation run KEY SHARE is observed, so prior delivery and claim publication remain genuine. A separate fixture connection holds the actual admission-head row. A short test-only `lock_timeout` makes the real contention deterministic; production timeout values remain untouched. The transient holder is released only after postgres.js has rejected and rolled back the first actual transaction. The persistent holder spans both tries.

Assert exactly two reservation transactions on successful recovery, one committed successor attempt, original claim/dispatch/source/slice bindings and unchanged delivery lease deadline. Persistent contention must leave no attempt, no bound delivery and the normal preparation refusal. Forward every real SQL call; do not fabricate query rows or verdicts. The existing native replay, expired/crossed owner and lease renewal cases remain required.

The previous complete native file took 2,132,895ms. Register the exact closed three-case vector with positive/negative parser tests, then run that owned-PG selection for RED and GREEN, followed by TypeScript checking and a clean stock build as applicable. No arbitrary pattern, file, extra flag or bypass becomes accepted. Do not run unrelated suites or provider probes.

## Delivery and limits

Root remains the sole source writer and delivery owner. Use the existing writer checkout and a scoped PR branch based on the reviewed live main source. Apply standing continuation authority for this necessary root fix and ordinary reviewed delivery. Existing bounded Task6A role, credential and service authority remains unchanged. No SQL repair, generated-code edit, manual claim rearm, force closure, new OS role, secret exposure or safety-gate bypass is permitted.

The current blocked generated run is unqualified. Any later run admission or service transition requires its own actual receipts and existing runtime guards; source tests and a PR are not software qualification.
