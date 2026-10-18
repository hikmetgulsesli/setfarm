# Fresh running-single claim authority reads

Status: outside preparation only, against clean Source6f9bc76e999033aa8941a825d70768634ceb48a1. Root is the sole W writer, test/effect owner and delivery owner. No inspected Source/test import or execution, database, provider or service operation occurred during preparation.

## Actual defect and root

Actual compiled QA4 reached its public pending claim successfully, then the same-intent public running reauthentication failed with PostgreSQL42501 on internal_production_owner_admission_authorities_v1 (original child capture1042B/7f4f204335b9909af31c1218d003ae9b41ed851483dd1863dfcf6d9c724c94da). It ended normally with cleanupCompleted true, not a timeout or a passing qualification.

The running path already parses fresh origin and authenticates genuine fresh owner sidecars. The table's historical name does not mean the fresh path should skip owner authority. The defect is two FOR SHARE clauses on an append-only authority table: PostgreSQL requires UPDATE privilege for the row lock, although runtime SELECT is already granted. Do not grant immutable UPDATE or bypass ancestry/source/activation/identity validation.

## File Map before candidates

1. `src/installer/step-ops.ts`: in authenticateRunningSingleStepOwnerSidecarsV1, change only the reservationAuthorities and bindingAuthorities query lock tails to the existing fixed selectedFreshInstallationRootV1 selector. Selected uses plain SELECT; unselected keeps the original FOR SHARE. Preserve all selected entry, source/build/activated client, migration application, full head/ancestry, reservation, binding and exact runtime-intent checks. Preserve head/reservation/claim/runtime row locks and every query column/parameter/order. The selection function asserts captured mode unchanged; no caller boolean or fallback.
2. `tests/installation/fresh-installation-running-step-authority-locks.test.ts`: exact Source bodies with genuine pure validators and DATA SQL transaction rows; model42501 on immutable FOR SHARE, verify both selected lookups, unchanged mutable locks, legacy lock path, exact same-intent result and typed absent/refused/invalid-ID/owner/binding/fence negatives. These are components, not installation/owner readiness.
3. `tests/installation/fresh-installation-immutable-locks.integration.test.ts`: add two SQL cases scoped to the exact declaration variable inside the same function, so identical reservation/binding SQL cannot accidentally be treated as unique. Use the existing genuinely restricted fresh runtime fixture and exact production expressions. Prove selected plain SELECT succeeds and unchanged legacy FOR SHARE refuses42501; verify canonical immutable function/trigger metadata and runtime UPDATE/DELETE/TRUNCATE denial. Existing22 query cases and mutable-lock assertions remain.
4. This plan at `docs/plans/2026-10-18-fresh-running-single-authority-reads.md`. No migration, semantic digest, grant, source authority, activation, public API or Native artifact change.

## Immutability and adjacency evidence

Canonical migration32 (`src/db/bootstrap-main-claim-handoff-v1-migration.ts:343-362`) installs setfarm_forbid_internal_production_owner_admission_authority_mutation, unconditionally raising55000; row UPDATE/DELETE and statement TRUNCATE triggers use it. Fresh runtime holds SELECT/INSERT authority rights but no immutable UPDATE/DELETE/TRUNCATE. Actual activation verifier calls readFreshInstallationCatalogHashV1; its complete public function and trigger definitions/enabled states are bound to the prepared catalog before runtime admission. Runtime has no schema/role/replication bypass rights. The public claimStep entry still calls the actual fixed operational assertion before work.

The narrow census found exactly two authority FOR SHARE queries in StepOps, both in this helper. The helper is used for normal running single-step reissue and the shared V3 terminal-platform preclaim reauthentication. Shared owner-admission-head/db-pg authority reads already use nonlocking SELECT. No adjacent mutable lock is removed.

## Root TDD and qualification

The original actual compiled QA4 failure is preserved. Root applies tests only and captures genuine old-Source component/real-PG RED, then applies independently reviewed Source. Rerun same tests, existing running-step fresh/legacy application parser/ancestry suite, no-emit and maintained contracts. The real PG component is not a forged operational activation; it owns only its isolated schema fixture.

After normal reviewed delivery/stock clean-main build, actual restricted QA5 must repeat the real public sequence: pending claim, exact running reissue with the same claim/runtime identity, wrong session/owner/agent/kind refusals with unchanged actual row snapshots, and the existing withdrawal/cleanup assertions. No actual successful running reauthentication or complete Unit3 runtime is claimed by this Source preparation. Old failure captures and original migrations remain untouched.
