# Positive worktree host pair V2

Status: diagnostic-only continuation of the approved positive physical-plus-PostgreSQL ownership contract. The held physical catalog and active-row snapshot exist independently on clean main `f968788d`; two unrelated calls cannot establish that their evidence overlapped in time. The live catalog also reports unresolved physical records, so this slice must not grant cutover or zero-owner authority.

## Decision

Use the physical catalog's existing `betweenPasses` callback to take exactly one active PostgreSQL row snapshot while physical directories are held. The catalog rechecks its held state and Git/process observations after the callback before returning. The new zero-input code-owned observer returns both complete diagnostic objects and a canonical commitment binding them. No database write, migration, physical-directory mutation, service action, V1 census change, owner projection, or cutover transition occurs.

Sequentially reading the catalog and database is rejected because a runtime worktree could change between the calls. Adding durable inode columns to PostgreSQL is deferred until the current host inventory and provenance are understood. The current held-callback design preserves every unresolved catalog blocker; a successful pair means only that both diagnostic observations belong to one held interval.

## Interface and evidence

`observeCodeOwnedPositiveWorktreeHostPairV2()` takes no arguments. It invokes `observeHeldPositiveWorktreePhysicalCatalogV2` with the fixed current account home and canonical Setfarm workspace root. Its callback calls `observeCodeOwnedPositiveWorktreeActiveRowSnapshotV2()` exactly once. A fixture port in the new module substitutes these two external observers for deterministic tests; no caller can supply scope, SQL, ownership assertions, or a zero claim to the production entry point.

The returned frozen object has exact schema `setfarm.internal-production-positive-worktree-host-pair.v2`, `authority: "diagnostic-only"`, `physicalIdentityProvenance: "unverified"`, the full frozen `physicalCatalog` and `databaseSnapshot`, and `pairHash` over those fields. The catalog's `status`, `blockers`, entries, and hashes remain unchanged and visible. The database snapshot's four independent row sets, counts, and hash remain unchanged and visible. No field named zero-owner, eligible, ready, or cutover is emitted. A complete catalog and four empty row sets still do not authorize cutover: other owner categories, controller ownership, journaled transition, and source/build provenance remain separate gates.

The fixture seam rejects a physical observer that does not call the callback exactly once, calls it twice, resolves before awaiting it, or returns malformed top-level catalog/snapshot labels or hashes. Database or physical observer failure rejects the pair; it never substitutes empty rows or a successful catalog. The production catalog's own strict held checks, blocker semantics, and cleanup remain authoritative and unchanged.

## Tests and host check

Verify call order (`physical first pass → database transaction → physical second pass`) through the callback port, exactly one database call, frozen paired evidence, canonical hash, unchanged unresolved blockers, no-callback/double-callback/early-return refusals, malformed labels/hashes, and propagated DB/physical failures. Run focused tests, pure and cutover suites, TypeScript, independent read-only review, exact-head PR review, and normal clean-main build. A read-only host probe may return an unresolved catalog or fail on live metadata drift; neither result is a cutover assertion.

## File map

- `src/internal-production/baseline-positive-worktree-host-pair-v2.ts`: diagnostic pair logic, fixture observer port, zero-input code-owned entry point.
- `tests/internal-production/baseline-positive-worktree-host-pair-v2.test.ts`: callback-order and refusal fixtures at the external observer boundary.
- `package.json`: register the focused suite under `test:internal-production:pure`.
- `docs/superpowers/plans/2026-09-23-positive-worktree-host-pair-v2.md`: RED/GREEN, review, delivery, and host verification plan.
