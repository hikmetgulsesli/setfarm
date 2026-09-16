# Cutover Helper History Implementation Plan

> **Execution:** Primary-owner inline TDD with parallel read-only review. One
> writing branch, no live mutations. Standing owner scope refinement applies.

**Goal:** Expose an authenticated read-only helper-history diagnostic using the
existing cold-bootstrap and restart-helper census implementations unchanged.

**Architecture:** An import-inert zero-input wrapper dynamically loads the
existing retirement module. Observe cold/helper/helper/cold, require stable
complete projections and existing settled-helper predicates, return frozen
state/count/hash commitments only. An explicit bootstrap mode authenticates
compiled bytes and dependencies; unsupported history paths fail closed.

**Tech Stack:** TypeScript ESM, existing physical journal observers, authenticated
bootstrap loader, real temporary files and genuine package fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Constraints and File Map

Preserve old install, eight archives, CLI, services and ports3080/3333/18789.
No SQL, environment mutation, receipt publication, helper startup, history repair
or cleanup. Do not load runtime-config/db-pg from the wrapper. Existing retirement
observers may reject unsupported settled histories; never broaden dependency
authority merely to permit them. This is helper-history-only evidence, not full
phase zero, effective runtime environment, database zero or controller ownership.

- New `src/internal-production/baseline-deployment-cutover-helper-observation-v1.ts`:
  `observeDeploymentCutoverHelperHistoryV1()` returns frozen schema/scope,
  coldState, preSchemaHelperState, registered/terminal counts, cold/helper census
  hashes, explicit remaining blockers, observationHash. No history records.
- Matching `tests/internal-production/baseline-deployment-cutover-helper-observation-v1.test.ts`;
  real fixed-root observers under fixture identity, no caller root API.
- `tests/internal-production/baseline-restart-authority-retirement-v1.test.ts`:
  reuse real terminal/live/ambiguous census fixtures through the new wrapper;
  keep production retirement semantics unchanged.
- `scripts/deployment-cutover.mjs`: `inspect-helpers --json` explicit mode.
- `scripts/__tests__/deployment-cutover.test.js` and bootstrap fixture: finalized
  actual retirement static closure, genuine package bytes, absent positive and
  incomplete/unsafe/tampered negative histories. Do not stub census return values
  for the integration gate or replace the real underlying validators.
- Spec File Map and this plan; no retirement semantics changes intended.

## Task1: wrapper and physical qualification

- [x] Missing-module RED with an actual absent fixed helper root.
- [x] Implement exact acceptance and bracketing:

```typescript
const coldBefore = retirement.observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
const helperBefore = await retirement.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
const helperAfter = await retirement.observeInternalProductionBaselineServiceRestartHelperJournalCensusV1();
const coldAfter = retirement.observeInternalProductionColdSpawnerBootstrapJournalCensusV1();
// Require canonical before/after equality, cold absent/settled + incomplete0,
// helper absent/terminal, registered==terminal, live0, ambiguous0.
```

- [x] Assert no writes, network, process effects or env mutation, and no full
  settlement output. Fixed refusal `DEPLOYMENT_CUTOVER_HELPER_OBSERVATION_INVALID`.
- [x] Real partial cold/pre-schema/registry history, unsafe ancestry, absence
  changes and close failure must refuse and preserve physical evidence.
- [x] Reuse narrowly selected existing retirement census regression cases for
  real registered/live/ambiguous/terminal semantics; no broad adjacent DB tests.

## Task2: compiled authenticated mode

- [x] Genuine unknown-mode RED before bootstrap changes.
- [x] Add inspect-helpers mode, authenticated import, hash-only output, explicit
  filesystem-phase/effective-env/database/controller blockers and final source
  fence. Other inspection modes unchanged.
- [x] Test actual absent history and incomplete/tampered compiled input refusal
  with sockets forbidden. Static closure must be authenticated before evaluation.
- [x] Run focused and invoked cutover, full bootstrap/genuine, noemit/contracts
  and independent review. Physical11/11, existing real census2/2, invoked
  cutover266/266, bootstrap/owner/dependencies116/116, manifest18/18 passed.
  Review caught partial-history fixture ancestry0755 masking record validation;
  corrected to0700 and exact genuine case1/1 passed separately.
- [ ] Scoped PR and normal independent clean-main build, then real read-only
  inspect-helpers observation. No live transition effects in this slice.

## Remaining after this slice

Fresh composition across DB awaits, physical phase producer/runtime authority
absence, effective default environment profile, already-absent-dashboard entry,
controller-owned journaled service/link effects and sealed ready handoff. None
is implied by a standalone successful helper observation.
