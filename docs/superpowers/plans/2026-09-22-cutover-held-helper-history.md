# Held absent helper history implementation plan

Root executes inline as sole writer; independent agents review read-only.

**Goal:** Bind the observed absent helper journal to the full default-owner epoch.
**Architecture:** A zero-input holder pins the physical nearest ancestor of the
fixed retirement root and its absence metadata, then cross-checks the existing
helper census. Default owner retains this holder through sampling and census.
**Tech stack:** TypeScript ESM, Node filesystem descriptors, node:test.
**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`

## Scope and evidence

PR140/141 are delivered and clean main is cd11d6e4. The authorized selected-source
sync preserved the historical CLI/dist. The prior host epoch succeeded, but
default owner still lacks held helper/physical/phase proof. Fresh metadata audit
finds the fixed retirement root absent. This slice supports that exact absent
profile; an existing root, including settled history, refuses this new holder.
The standalone helper observer retains its existing settled-history behavior.
Do not claim complete filesystem/phase zero ownership or remove any existing
default-owner blocker. In particular, receipt physical inventory counts developer
worktrees and assumes a running dashboard; it cannot simply be reused here.

## File map and contract

- `baseline-deployment-cutover-helper-observation-v1.ts`: add zero-argument async
  `holdDeploymentCutoverAbsentHelperHistoryV1`, returning frozen observation,
  synchronous recheck and consume-once close. Use the fixed workspace authority
  resolver and actual account; no ambient runtime config or caller roots.
  Pin every existing physical directory; record home-to-nearest-parent mtime/ctime to
  reject appearance/disappearance ABA. Only ENOENT is absence. Bound traversal.
  Recheck before and after helper census; require absent cold/pre-schema history
  and zero helper count. Drift permanently invalidates the holder; successful
  drain after drift must not masquerade as close loss. Actual close loss poisons
  new acquisition and carries literal cutoverCleanupFailed=true. Opaque legacy
  census failures cannot certify nested cleanup: poison reacquisition and retain
  literal null (unknown), unless directly witnessed outer close loss overrides it.
- Existing helper test file: real temporary filesystem lifecycle, appearance,
  ABA, parent replacement, malformed path/access errors, input refusal and close
  response loss with a reused descriptor. All mutations are fixture-owned.
- Default owner and its tests: acquire helper before qualification, cross-bind
  accountHome/UID/GID, recheck with other holders; include helper observation;
  cleanup remains reverse-order. Add finite acquire-helper/helper diagnostics
  to bootstrap validation and tests. Preserve all three remaining blockers.
- Composed integration: real holder acquisition, absence drift refusal before
  census, ordinary success and cleanup failure contracts.

## Execution

- [x] RED physical holder tests; verified missing API failure.
- [x] GREEN bounded holder; existing snapshot tests unchanged (23/23).
- [x] RED/GREEN owner/bootstrap/composed binding and drift tests (55 owner,
  two new bootstrap diagnostics, three focused composed cases).
- [x] Focused suites, cutover354, owner/bootstrap141, helper23, build-authority47,
  serial genuine41, noemit, English1569/path892/MC12 and migration contracts.
- [x] Independent read-only review; all findings resolved.
- [ ] Scoped PR, review on delivered head, merge.
- [ ] Independent clean-main build and bounded host verification as warranted.

Delivery must not fetch the old shared remote-tracking main merely to start a
branch. Use already present base objects. Future delivered-main synchronization
of selected source uses the user's explicit authorization, with historical dist
and CLI evidence before/after, without rebuilding the selected installation.

Early independent review found two causally necessary fixes: restored ancestor
ABA above the nearest parent, and opaque nested census cleanup provenance.
Both were reproduced RED and fixed with regression tests before integration.
Final review also caught account fields outside the snapshot hash: retain the
explicit snapshot hash and recompute the complete held observation commitment.
The full-body hash regression failed RED and passed after the correction.
