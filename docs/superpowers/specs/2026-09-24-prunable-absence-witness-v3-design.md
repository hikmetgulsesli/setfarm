# Prunable absence witness V3

Status: diagnostic-only continuation of the positive physical-plus-PostgreSQL ownership contract. The current held V2 catalog reports 263 prunable Git worktree blockers among 268 total blockers. These records must remain visible; Git prune or blocker removal is not authorized by physical absence.

## Decision

Project a separate, immutable V3 sidecar from one trusted V2 host pair. Do not modify either V2 producer, their hashes, catalog `status`, blocker list, or database rows. For each `prunable-git-worktree` blocker whose root is an immediate child of a catalog `absentBases` directory, emit a witness linking the exact blocker root to that absent base. The V2 catalog held the base's parent, checked the base missing before and after its PostgreSQL callback, and checked held directory identity and mutation around that callback. The witness says only that the base was observed absent at both V2 checks bracketing the DB snapshot, under those held-parent checks. It does not prove continuous absence at every instant, that the root is still absent now, that Git metadata may be pruned, or that any owner/cutover gate passed.

All other prunable blockers remain in the unchanged V2 blocker list without a witness. A direct-child relationship is required; a lexical prefix is insufficient. The sidecar has a separate schema and hash binding the source `pairHash`, `catalogHash`, all witnesses, and the count of prunable blockers left unwitnessed. No zero-owner, eligible, ready, or cutover claim is emitted. `authority` stays `diagnostic-only` and `temporalScope` is `v2-bracketed-two-pass`.

## Boundary and validation

The production entry point accepts no caller scope and invokes `observeCodeOwnedPositiveWorktreeHostPairV2()` once. A pure fixture projection accepts an unknown V2 pair for tests, but refuses non-frozen/proxy/accessor/cyclic evidence, wrong exact top-level V2 schemas and labels, malformed or false V2 pair/catalog/database hashes, malformed paths or blocker records, duplicate absent bases, and over-capacity collections. Only canonical absolute POSIX paths enter witnesses. Sort witnesses by UTF-8 bytes and deduplicate repeated blocker roots; repeated rows stay visible in the original V2 pair. Cap the blocker scan independently at 1,024; V2's 256-entry cap does not bound Git prunable records. Refuse rather than truncate overflow. Preserve the full V2 pair by object identity in the sidecar so all unresolved evidence remains inspectable.

The pure function cannot authenticate the physical producer against a fabricated, internally consistent fixture; it is diagnostic-only and has no authority transition. Production authenticity comes from the code-owned V2 observer. Its transient held bracket has already closed when the projection runs; do not perform a second unheld stat and call it the same evidence.

## Tests and delivery

RED fixtures cover direct-child witnesses across sorted/deduped blockers, non-direct and wrong-reason blockers, absent-base boundary, malformed/corrupted/falsely rehashed pair inputs, frozen output and preserved V2 evidence, cap 1,024/1,025, and import inertness. Run focused/pure/cutover tests, TypeScript, contracts, independent read-only review, exact-head PR review, clean-main build, and one evidence-based host probe. A live V2 metadata-drift refusal or unresolved result is not cutover success.

## File map

- `src/internal-production/baseline-positive-worktree-prunable-absence-witness-v3.ts`: pure diagnostic projection and zero-input code-owned wrapper.
- `tests/internal-production/baseline-positive-worktree-prunable-absence-witness-v3.test.ts`: RED/GREEN boundary fixtures.
- `package.json`: register focused suite under the pure internal-production tests.
- `docs/superpowers/plans/2026-09-24-prunable-absence-witness-v3.md`: implementation and delivery sequence.
