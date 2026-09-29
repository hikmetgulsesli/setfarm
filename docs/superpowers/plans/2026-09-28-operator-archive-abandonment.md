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
- A new code-owned service-quiescence controller and versioned v3 effect
  journal: durably exclude old/new ordinary starts before destructive archive
  effects or selected build rotation; bind every effect to a held owner,
  current zero-reference evidence, and exact target identity. Existing
  historical service-effect records are storage grammar, not this controller.
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
- `scripts/__tests__/build-info-version.test.js` and the existing retention suite:
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
   build; all eight remove the archive-capacity refusal but do not authorize
   selected rotation. Regression-test
   ordinary retention's newest-two guard.
5. Run focused tests, broad applicable suites, TypeScript/source contracts,
   independent review, reviewed PR and exact-head GitHub gates; build the
   clean merged `main` only in an isolated/private clone. The previously
   proposed live selected `npm run build`/ordinal-14 rotation is superseded by
   the 2026-09-29 audit below. Do not touch selected `dist` or run live archive
   disposal until a separately reviewed exclusion and selected-build/promotion
   protocol passes exact-host-shaped private tests and fresh owner preflight.
   Then verify `BUILD_INFO`, fixed CLI, both Setfarm LaunchAgents, HTTP 3333,
   database, and old/new writer absence. Preserve all development/deployment
   worktrees.

No live archive operation occurs during steps 1–4. If resource health,
closure, references, or an unrecoverable ambiguity fails, leave the archive
and service state visible and fail closed; do not manually delete or rewrite.

## Current delivery slice

PR #240 merged the advisory inventory relation, three-pass
`inspect-operator-archives` command, and inventory identity-race fixes. The
command returns `authority:false`. An unmerged isolated branch now has a
private-fixture v3 prepare/resume path, eight-member batch continuity, a v2
terminal disposition reader, and writer-side v2 shape/projection support.
The private eight-disposition lifecycle passes, as does a late-reference
refusal before the first erase. These tests do **not** authorize live erasure:
the v3 path still lacks a durable continuously held old/new start exclusion,
versioned per-effect proof journal, and no-follow syscall-level target hold.
The selected build and live restoration remain pending. Do not deploy or run
the current v3 `resume` on the host.

The separate selected-`dist` rotation has a stricter boundary than a
launchd-only drain. The old selected dashboard daemon and direct `node
dist/...` entrypoints do not consult a durable cutover fence; the runtime
guard is bypassable. Normal `npm run build` rotates the old `dist` in prebuild
and exposes a partial new `dist` during TypeScript compilation. A temporary
guarded CLI symlink would not cover those direct entrypoints and would change
the fixed selector. Consequently no current code-only, unchanged-selector
path proves continuous old/new ordinary-start exclusion through crash and
reboot. Keep the host unchanged at this boundary; a separate, explicit
OS-level execution/access-control or redesigned atomic staged-build
authorization is required before selected rotation.

## 2026-09-29 fence audit and revised delivery order

No safe implementation of the approved temporary fence has been proven with
the current writer and evaluated same-UID controls. Read/traversal denial
blocks its old-`dist` inspection, and
ordinary direct Node starts are not covered by `launchctl`. The fixed CLI is
beneath writable home ancestors; a protected leaf does not seal its pathname.
The old PostgreSQL role can still write as superuser. Do not run live
`prepare-discard`, `resume`, or selected `npm run build` under this design.

1. Specify and review a versioned capability split: independently protected
   deployment/authority roots, old/new OS and database identities, a promoter,
   and persistent old-writer denial. Preserve the fixed CLI pathname only as
   a convenience alias unless its whole ancestor chain is protected. Specify
   how the stricter ordinary-start prohibition is enforced; write denial by
   itself is not that proof.
2. In private fixtures, prove old CLI/direct Node/direct SQL denial, old
   process drain, restart/reboot persistence, and fail-closed recovery. Adapt
   the selected-build observer and physical-identity receipts without
   weakening source, output, owner, or runtime gates.
3. Complete the operator transaction's versioned per-effect journal and
   no-follow target hold under the same durable exclusion, then deliver it
   through reviewed PR and a clean-main build.
4. Only after independently verified live exclusion and fresh zero-owner
   evidence, dispose the exact eight old archives, promote a fully finalized
   selected build by the reviewed protocol, account for the old selected
   `dist` through an explicit disposition, restore Setfarm, and verify
   CLI/HTTP/DB/launchers. Preserve every development and deployment worktree.

The 2026-09-30 explicit reaffirmation and the earlier Task6A approval authorize
the scoped role/credential/OS transition. Step 4 still requires concrete
reviewed code, private qualification and fresh host evidence before effects.

## Next bounded slice: exclusion lifetime

Files: `scripts/build-generation-retention.mjs` and
`scripts/__tests__/build-generation-retention.test.js`.

- [x] Add a real fixture lifecycle test showing that an unavailable exclusion
  refuses v3 prepare/resume without archive, quarantine or authority effects.
- [x] Run the test RED, then add an internal host bridge that defaults deny.
  The disposable fixture can inject its own holder by replacing that bridge
  in copied fixture source; production exposes no bypass switch or caller port.
- [x] Hold the exclusion from before prepare publication or resume mutation
  through completion. Recheck before rename, erase, response-loss adoption,
  receipt and disposition. Use `try/finally` to close observation handles on
  every path, without releasing the future durable OS/DB fence.
- [x] Add RED cases for late exclusion loss at rename, later erase and terminal
  publication, then implement the missing rechecks. Add response-loss adoption
  regressions. Verify exact preserved files and no false terminal disposition.
- [x] Require independent historical terminal exclusion verification before
  accepting any v2 operator disposition. The initial production verifier
  defaults deny; eight coherent self-hashed records must not authorize writer
  rotation. A RED/GREEN eight-member lifecycle covers the strict reader; its
  expanded actual `write-build-info.mjs --prepare` check passed with unchanged
  `dist`, ledger and retention-store snapshots and a released maintenance lock.
- [x] Run focused operator tests and the existing full retention suite,
  syntax/contracts and independent read-only review. Record the still-default
  denied live bridge before scoped PR delivery.

Independent review found that the producer-side acquisition gate alone did not
protect terminal readers: coherent self-hashed operation/index/erase/receipt
records plus present absence are not proof that exclusion was historically
held. The shared strict closure now invokes a separate internal historical
verifier, refusing with `BUILD_GENERATION_OPERATOR_TERMINAL_EXCLUSION_UNVERIFIED`.
It must eventually resolve independently protected durable evidence, never
acquire a fresh live holder as a substitute for past proof. This causally
necessary root fix belongs to the same discard objective and the file map above.

Verification on 2026-09-30: `npm run test:scripts` passed all 952 script tests
and all 43 genuine cutover tests. The affected writer/maintenance/inventory
subset passed 145 tests, and the expanded eight-member actual-writer check
passed independently. Syntax, TypeScript `--noEmit`, English/path/version
contracts, migration digests, 12 Mission Control contract artifacts and
`git diff --check` passed. Independent review found no remaining code blocker
for this default-denied scaffold. Exact-head GitHub review/status gates and
the clean merged-main standby build are separate delivery steps; neither
implies that live exclusion, discard or selected restoration is complete.
