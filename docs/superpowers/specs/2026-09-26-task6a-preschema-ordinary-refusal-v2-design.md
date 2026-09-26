# Task6A pre-schema ordinary-spawner refusal V2 design

## Boundary

The normal spawner startup currently reaches cold-startup-file reclamation, singleton/PID publication, startup claims and only then its V1 pre-schema gate and `pgMigrate()`. A current-entry operation may already exist while migration 32 is still pending; in that case an ordinary launch must refuse before those effects. The two authenticated direct/cold child paths run first and retain their existing behavior. Migration 32 pending by itself is the normal pre-cutover v31 state and must not trigger refusal.

Add a narrow, no-write V2 observation of the fixed current-entry operation, followed only when it is present by a bounded read-only transaction inspecting the exact migration journal. The observer uses the code-owned workspace anchor and fixed path, descriptor/no-follow identity checks, bounded canonical bytes, and the existing operation's exact schema, ref and body hash. This is a self-consistent fixed-file presence discriminator, not recursive operation authority. Missing fixed ancestors or operation produce only a sampled `absent`; malformed, crossed, raced or uncertain cleanup refuses. Do not call the broad V1 current-entry or pre-schema observers: their successor selector can `fsync` a parent and is not an effect-free preflight. Do not use the generic migration planner: its detection hooks can attempt DDL even when merely planning, as a live read-only-transaction probe demonstrated and PostgreSQL refused.

With a fixed operation present, any journal without an exact applied/adopted 1–33 prefix refuses ordinary startup. The prefix remains valid when a future migration definition exists but has not yet been applied; any later journal rows must match known definitions too. A valid prefix passes this *additional* gate and then still encounters all existing V1 readiness/cutover gates, which must validate actual schema and readiness. Journal equality alone is not a complete schema proof. Any malformed/unrecognized/drift journal refuses. Absence passes to existing startup rules, not to a new admission. Reobserve the fixed operation around the journal transaction; this is still sampled evidence, not a continuous writer lease.

This backstop is deliberately not Task6A admission, a positive owner, DB/OS writer exclusion, or approval to run V1 current-entry. It does not change the selected old spawner, and the current live superuser/physical blockers remain. A later positive V2 authority chain must prevent concurrent writers and cover every effect.

## File map and tests

- New `src/internal-production/baseline-task6a-preschema-ordinary-refusal-v2.ts`: fixed no-write operation probe, strict journal-result classifier, zero-input spawner preflight.
- `src/db/contract-spine-migrations.ts`: additive read-only-transaction exact journal inspection export, without invoking migration detect/verify hooks or changing definitions and the ordinary apply path.
- `src/spawner.ts`: one awaited preflight immediately after direct/cold startup returns and before ordinary reclamation, lock/PID, claims or migration.
- New focused internal-production tests and existing spawner startup qualification tests: absent operation retains ordinary path, present+not-through33 refuses before effects, exact through33 prefix reaches existing gate even when migration 34 is defined, malformed operation or journal refuses, direct/cold ordering unchanged. A source-extracted startup-prefix fixture and source-order assertion cover the seam; the live read-only probe covers the actual journal helper's negative path. Keep frozen V1 gates unchanged.
- `package.json`: enroll focused tests. This design and implementation plan document the deliberately narrow causal scope.
