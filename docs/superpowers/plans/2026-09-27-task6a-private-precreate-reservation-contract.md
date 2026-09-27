# Task6A private pre-create reservation contract

## Scope and causal relation

The positive worktree owner cutover cannot count an exact physical root if a
writer can create it before an owner record exists. On clean main `c899dc97`,
ordinary claiming publishes claim/runtime before `createStoryWorktree`, while
V3 recovery creates the worktree before publication. That helper itself can
prune, stash, reset, clean, and remove existing worktrees. A post-create receipt
alone therefore cannot close the owner-birth gap.

This slice adds a private PostgreSQL 17 fixture contract for an immutable,
durable `pending` reservation made before any worktree side effect. It has no
registered migration, service wiring, filesystem writer, admission authority,
or live access-control change. It cannot by itself prove a continuous DB/OS
writer fence or authorize use of the legacy worktree helper.

## Design

- Reserve exact run, story database ID and story ID, dispatch key, owner
  instance, absolute target root, source commit and tree before creation.
- Canonical body SHA-256 is the reservation identity. A unique root and unique
  story ID and run/story/dispatch key prevent competing pending reservations,
  even if both dispatch key and root differ. A committed row is
  insert-once, immutable, and remains pending after a crash; retry succeeds
  only when every field is identical. This fixture intentionally has no
  settlement transition, so another dispatch for that story stays denied;
  reviewed terminal/bound reconciliation must precede any later reuse.
- Own one serializable transaction, lock and compare the linked run/story,
  preserve the exact run/story identity with a composite foreign key,
  reject a missing or terminal run, and return only a diagnostic disposition.
  Ambiguous or failed insert is a refusal, never permission to create.
- Use a private isolated database through migration 33. Test identical retry,
  competing target/dispatch, owner/source drift, transaction rollback,
  immutability and pending census persistence. No test touches preserved or
  live worktrees.
- A later separately reviewed slice must attach this reservation to a
  producer-authenticated physical creation and claim/attempt/session journal
  under continuous DB/OS exclusion. Until then all three existing
  `createStoryWorktree` call paths remain outside positive-owner admission.

## File Map

- `src/internal-production/baseline-positive-worktree-precreate-reservation-contract-v1.ts`:
  import-inert private DDL, strict canonical projection, transaction-owned
  append-only reservation. The fixture test counts pending rows directly; no
  cutover or admission census reads this table yet.
- `tests/execution-attempts/task6a-private-precreate-reservation.integration.test.ts`:
  opt-in isolated PostgreSQL 17 adversarial RED/GREEN coverage.
- `docs/superpowers/plans/2026-09-27-task6a-private-precreate-reservation-contract.md`:
  scope and evidence plan.

## Verification and delivery

Run focused RED before source implementation, then the private PostgreSQL
fixture, TypeScript, pure/cutover/manifest suites, migration digests and clean
build. Obtain independent read-only review and exact-head GitHub reviews;
deliver by scoped PR only. On merge, fast-forward clean main and the preserved
deployment checkout without removing retained worktrees, rerun build and
relevant tests, and record host HTTP/LaunchAgent state. Any failed gate remains
an explicit blocker; do not activate the fixture on the live database.
