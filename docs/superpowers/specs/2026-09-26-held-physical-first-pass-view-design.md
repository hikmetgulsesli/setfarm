# Held physical first-pass view V1

The owner-approved positive physical-plus-PostgreSQL contract needs to compare a real worktree's physical identity with exact active database rows while the physical catalog's file descriptors remain held. The existing V2 catalog already brackets an asynchronous callback between two physical/Git/process observations, but supplies that callback no first-pass candidate identity. Reading the final returned entry after the bracket closes would not establish same-interval evidence.

## Decision

Pass a deeply immutable, ordered first-pass candidate array to the existing `betweenPasses` callback. Build it only after all first-pass entries and listed-outside-scope blockers are collected and `held.assertStable()` succeeds. Each candidate retains the V2 fields and `sourceBuildProvenance: "unverified"`; the view carries no owner, absence, readiness, or cutover claim. The callback may use the view for a read-only database observation. Its return value remains ignored. After it returns, all existing second-pass Git, lsof, directory, and blocker checks still run unchanged before the catalog returns. A failed callback or recheck refuses closed.

This is additive: existing zero-argument callbacks continue to work. The final catalog schema, hash, ordering, blocker semantics, and all V1/V2/V6 guards remain unchanged. Passing a view does not authenticate the callback, source bytes, PostgreSQL rows, a producer receipt, or a writer/process exclusion barrier. The view must never be consumed alone as owner or zero-owner evidence.

## Alternatives rejected

- A new single-root holder would duplicate the catalog's no-follow descriptors, Git topology, lsof, and drift checks, creating a second security implementation before the producer contract is ready.
- A fixture-only receipt simulation could test comparison mechanics but would not authenticate a producer. The existing pure binding candidate already covers self-consistency.
- Returning the final catalog to a later caller loses the held interval and cannot support same-interval matching.

## Verification

A real temporary primary/linked Git worktree fixture must show the callback receives the frozen linked candidate, including the first-pass device, inode, birthtime, and primary root, while the bracket is active; the final entry must match when the second pass is stable. A callback-triggered linked Git-admin churn must remain a final unresolved blocker, proving that first-pass visibility is not authority. Existing no-argument callbacks and the catalog's drift/refusal tests must continue passing. No live service, database, worktree cleanup, selected dist, CLI link, or cutover effect is part of this change.

## File map

- `src/internal-production/baseline-positive-worktree-physical-catalog-v2.ts`: immutable callback view at the existing held boundary.
- `tests/internal-production/baseline-positive-worktree-physical-catalog-v2.test.ts`: RED/GREEN real Git fixture and unresolved-after-callback regression.
- This spec and `docs/superpowers/plans/2026-09-26-held-physical-first-pass-view.md`: decision, test, and delivery record.
