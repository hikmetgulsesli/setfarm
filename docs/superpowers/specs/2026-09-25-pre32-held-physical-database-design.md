# Held physical and pre32 database diagnostic pair

Status: bounded follow-on to the approved positive physical-plus-PostgreSQL ownership design. This pair is diagnostic evidence, not an owner certificate or cutover authority.

## Problem and decision

PR #154 makes the thirteen pre32 owner/effect counts and four V2 active row sets one PostgreSQL repeatable-read/read-only snapshot. The physical catalog already holds descriptors around one async callback, but the existing V2 host pair obtains only the active rows from ambient `db-pg` configuration. It cannot demonstrate that the pre32 census, active rows, and physical catalog occupied one held interval, and ambient configuration is not cutover-local authority.

Add a V4 diagnostic pair using the existing V2 held-pair callback guard. The DB callback obtains the entire frozen/hash-bound V4 pre32 snapshot exactly once, validates it before projecting its unchanged V2 `activeRows` to the V2 pair, and binds the full V4 snapshot and V2 pair into a new frozen/hash-bound envelope. Require identical active-row object identity across the two results. Preserve every V2 physical entry and blocker; do not change V3 prunable absence or V2 schemas.

Derive the database URL only from both matching, held launcher configurations. Extend their existing private census closure with one fixed combined observer; do not expose URL, credentials, callback, SQL, raw rows, or caller zero assertions. The default launcher holder must retain its qualification/idle/recheck gates for both census methods and serialize them. The zero-input V4 host diagnostic acquires the default launcher, qualifies passive home, performs the held physical/V4 DB pair, rechecks launcher state, and closes in `finally`. Errors remain non-secret and fail closed. The result does not prove continuous absence, physical-to-row identity, source/build provenance, controller fencing, journaled effects, or permission to alter services.

## File map

- `src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts`: private shared URL validation and new combined census method on held launcher contexts; no credential publication.
- `src/internal-production/baseline-positive-worktree-host-pair-v2.ts`: preserve V2 exports; add exact V4 diagnostic projection and zero-input host observer.
- `tests/internal-production/baseline-deployment-cutover-launcher-observation-v1.test.ts`: RED/GREEN same held URL, qualification, drift/refusal and close behavior.
- `tests/internal-production/baseline-positive-worktree-host-pair-v2.test.ts`: RED/GREEN exact-once held callback, V4 shape/hash, blocker retention and fail-closed cases.
- `docs/superpowers/plans/2026-09-25-pre32-held-physical-database.md`: implementation and delivery evidence.

No DB write, migration, runtime guard, physical exclusion, worktree cleanup, service relink, or cutover effect is in this slice.
