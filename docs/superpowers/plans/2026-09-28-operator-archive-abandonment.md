# Operator archive abandonment implementation plan

> Root is the sole writer. Other agents perform read-only research/review.

**Goal:** Dispose of the eight drifted historical archives through an
auditable code-owned operation, then restore the existing selected clean-main
Setfarm installation without changing the fixed CLI selector.

**Spec:** `docs/superpowers/specs/2026-09-28-operator-archive-abandonment-design.md`

## File map

- `scripts/build-generation-retention.mjs`: immutable rotation chain,
  physical census, zero-reference proof, maintenance lock, quarantine,
  erase journal, receipts, and terminal dispositions; add a separately
  versioned discard path without relaxing ordinary retention.
- `scripts/write-build-info.mjs`: strict writer-side ledger scanner; recognize
  only an authenticated v2 terminal disposition, with active drift unchanged.
- `scripts/build-generation-device-drift-diagnostic.mjs`: advisory classifier
  is evidence only, never dispatch authority.
- `scripts/__tests__/build-generation-retention.test.js` and
  `scripts/__tests__/build-generation-device-drift-diagnostic.test.js`:
  private host-shaped RED/GREEN lifecycle and non-device rejection.
- `scripts/__tests__/build-generation-operator-inventory-relation.test.js`:
  strict historical/current inventory relation, including same-device
  post-build cleanup; the new read-only `inspect-operator-archives` command
  observes all active generations across three whole-tree passes without
  granting dispatch authority.
- `scripts/__tests__/write-build-info.test.js` (or existing writer suite):
  partial batch refusal and fully disposed ledger acceptance.
- `logs/2026-09-27-task6a-writer-boundary-matrix.md`: exact host evidence and
  owner decision; do not erase prior observations.

## Steps

1. Add RED private tests for eight authentic active completions with uniform
   device-only drift, no reference, and an explicit operator-discard command.
   Cover refusal on one changed inode/content/mode/link, unknown extra archive,
   crossed completion, active reference, wrong checkout, and drift changing
   between observations. Include last-two and final-one disposal.
2. Implement immutable-chain authentication separate from active physical
   equality. Keep existing `inspect`, `prepare`, and writer paths unchanged.
   Bind a compact immutable batch commitment to the exact eight ordered
   completion pairs/paths; each candidate operation binds only its own fresh
   current inventory to stay under the 1 MiB authority-record cap. Reuse
   bounded no-follow inventory and zero-reference observers.
3. Extend the durable quarantine/erase transaction for a distinct versioned
   operator action. Test crash windows before/after rename, each unlink,
   root removal, receipt, and disposition; reject ambiguous replay.
4. Add a v2 terminal disposition parser and complete closure validator to
   the retention scanner, with a matching writer projection. Authenticate
   the immutable batch commitment, each candidate index and operation, current
   erase identity, receipt and complete erase chain. Preserve historical
   completion values separately. Partial/mixed dispositions must not permit a
   build; all eight permit a normal ordinal-14 rotation. Regression-test
   ordinary retention's newest-two guard.
5. Run focused tests, broad applicable suites, TypeScript/source contracts,
   independent review, reviewed PR and exact-head GitHub gates. Implement and
   privately qualify a separate durable Setfarm service-quiescence/recovery
   controller before touching the selected `dist`: exact launcher bootout,
   process drain, continuous old/new ordinary-start refusal through crash and
   retry, and zero DB/OS owners. Include exact-host-shaped full rebuild and
   handoff tests plus prebuild checks for selected `dist`, disk/ordinal
   capacity, source/ref state and contract/compile inputs. Sync the selected
   clean-main checkout, verify
   ledger and candidate, then execute only the exact code-owned host
   operation. Run official build, dispose the newly rotated stale `dist` with
   a fresh zero-reference proof, and verify `BUILD_INFO`, fixed CLI link, both
   Setfarm LaunchAgents, HTTP 3333, DB and old/new writer absence. Preserve
   all development/deployment worktrees.

No live archive operation occurs during steps 1–4. If resource health,
closure, references, or an unrecoverable ambiguity fails, leave the archive
and service state visible and fail closed; do not manually delete or rewrite.

## Current delivery slice

Only the advisory inventory relation, three-pass `inspect-operator-archives`
command, and inventory identity-race fixes are implemented in this PR slice.
The command returns `authority:false`. The operator-discard transaction,
v2 terminal closure, service-quiescence controller, selected rebuild, and
live restoration remain unimplemented; this slice must not be interpreted as
permission to mutate an archive.
