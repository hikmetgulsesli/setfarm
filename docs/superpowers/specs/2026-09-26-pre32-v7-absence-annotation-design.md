# Exact-journal pre32 absent Git-record annotation

PR #177's V7 host pair holds the exact migration-1-through-31 journal, zero census and binding rows inside one physical two-pass interval. The existing absent Git-record annotation uses the older V6 pair. Reusing a V6 absence result beside V7 would not prove that both observations belonged to the same held interval.

Add a separate V2 annotation that wraps the unchanged V7 pair. After that pair returns, apply the existing strict prunable-absence witness only to its own held physical catalog. Partition every physical blocker into witnessed absent Git records and remaining blockers without dropping or reclassifying any record. The witness must cite that exact held pair and physical catalog hash; the V2 annotation includes the complete V7 pair, witness, both blocker lists and a canonical hash. Duplicate source blockers remain duplicate records. A prunable path is witnessed only if its direct parent was an absent base during this interval.

Expose this via a distinct authenticated no-write `inspect-pre32-absence-annotation-v2 --json` verb with exact `diagnostic-only` and `physicalIdentityProvenance:unverified` labels, nested hashes, and the existing V7 finite refusal/cleanup handling. V1 and V7 outputs and code paths do not change. The observation does not turn witnessed absence into positive ownership, prove continuous absence, classify retained trees as nonowners, relax any gate, or authorize cutover.

RED tests cover same-interval callback order; an exact V7 snapshot and journal label; absent/direct-child witness versus unmatched prunable, non-Git and churn blockers; duplicate blocker preservation; V7 hash/authority mismatch; physical second-pass and DB failures; bootstrap authority/hash/extra-argv refusal. GREEN verification uses focused annotation/host/bootstrap tests, pure/cutover/scripts suites, TypeScript and source contracts. A reviewed PR is followed by a normal guarded clean-main build and authenticated no-write host probe; no selected CLI or service switch occurs.

## File Map

- `src/internal-production/baseline-positive-worktree-pre32-absence-annotation-v2.ts`: V7-only diagnostic wrapper.
- `tests/internal-production/baseline-positive-worktree-pre32-absence-annotation-v2.test.ts`: RED/GREEN held interval and partition tests.
- `scripts/deployment-cutover.mjs` and `scripts/__tests__/deployment-cutover.test.js`: separate authenticated V2 verb.
- `package.json`: register the pure test.
- `docs/superpowers/plans/2026-09-26-pre32-v7-absence-annotation.md`: implementation and verification record.
