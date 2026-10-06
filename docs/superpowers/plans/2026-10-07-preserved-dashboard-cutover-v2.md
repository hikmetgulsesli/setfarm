# Preserved Dashboard Cutover V2 Implementation Plan

> **For agentic workers:** Root implements inline, sole writer. Parallel workers
> perform read-only investigation/review only; no implementation delegation.

**Goal:** Deliver and qualify the approved dashboard-through-step5 transition.
**Architecture:** Durable V2 operation history/store, live held controller,
qualified real adapter and authenticated entry. History never grants authority.
**Tech Stack:** TypeScript ESM, builtin Node tests, existing tsx toolchain, launchd.
**Spec:** ../specs/2026-10-07-preserved-dashboard-cutover-v2-design.md

## Global constraints

Preserve old installs, both dirty files, all archives and native samples. No
security/credential changes, runtime bypass, direct main commits or assumed
ownership from JSON. Remain at3333; MC3080 and gateway18789 unchanged. Spawner
refusal stays open after dashboard restoration. Native S10 is a separate domain.
Development worktree is linked to the independent native clone's Git directory;
canonical/shared selected Git refs are not fetched or modified. This is not a
deployment clone or a build-capacity workaround. Existing toolchain is consumed
read-only; no new installation is needed for pure TS/builtin tests.

## Task1: complete ordered record grammar

Files: create baseline-dashboard-cutover-records-v2.ts under
src/internal-production; create matching test under tests/internal-production.
Consumes/produces exactly the record interfaces and operation/outcome table in
the spec. Exports createDashboardCutoverIntentV2, encodeDashboardCutoverIntentV2,
createDashboardCutoverCompletionV2, encodeDashboardCutoverCompletionV2,
parseDashboardCutoverHistoryV2. Parser consumes two canonical Buffer arrays.

- [ ] Write RED asserting all six literal actions and complete/pending prefixes;
  independently hash manually written canonical bodies, not builder expectations.
  Example:
  `assert.equal(history.intents[3].action, "select-new-cli")`;
  `assert.equal(history.authority, "history-only")`.
- [ ] Run focused test with existing absolute tsx loader; absence must be genuine
  missing production module/export. No OS effect or compiler fixture required.
- [ ] Implement minimal strict grammar. Reject ordinal skips, mismatched previous
  completion, crossed cutover/owner/self hashes, illegal outcome, extra fields,
  proxy/accessor invocation, noncanonical bytes, sparse/oversized array.
- [ ] GREEN full finite matrix; old V1 pure grammar suite remains passing.
- [ ] Independent source/test review; scoped conventional commit.

Owner tests distinguish legal later-intent/reconciliation-owner changes from a
completion that changes its original dispatch owner. Exact wire literals/bounds/
hash projection/output states are pinned in the spec's Exact Task1 wire section.

## Task2: real durable V2 publication

Files: baseline-dashboard-cutover-store-v2.ts and matching test.
Consumes Task1 canonical bytes; produces observeDashboardCutoverStoreV2,
publishDashboardCutoverIntentV2, publishDashboardCutoverCompletionV2 with expected
observation hash. Fixed namespace and publication rules are in spec.

- [ ] RED real private filesystem tests for empty observation without creation,
  all six published pairs, intent without completion refusing next ordinal,
  stale observation/crossed records, symlink/mode/root drift, partial writes,
  sync/link/close faults and intact old V1 namespace.
- [ ] Implement using owned nofollow descriptors, immutable stages/links,
  fsync and complete rechecks; preserve pending artifacts and checked-once closes.
- [ ] GREEN tests assert actual file bytes/identities/history, not mock presence.
- [ ] Independent retention review; no live authority-root writes; commit.

## Task3: live-capability controller and reconciliation

Files: baseline-dashboard-cutover-controller-v2.ts and matching test.
Consumes qualified opaque adapter capability plus Task2 store; produces serial
runDashboardCutoverV2 and reconcileDashboardCutoverV2 returning only an observed
dashboard checkpoint. Real capability authenticity is supplied by Task4, never
a caller permission flag. Every effect requires its current owner/exclusion.

Do not begin Task3 production authoring before the exact Task4 capability/freeze
contract is mapped and independently nominated. This dependency may require
implementing the provider contract before the controller; no fake test port can
fill the production authenticator. The existing cold-genesis lease requires an
already live/matching dashboard; it is NOT a pre-dashboard cutover mutex.

- [ ] RED each operation requires durable intent before effect; attempts recorded
  before invocation; sealed post-observation before completion; stop on drift,
  reentry, malformed result, unknown effect or pending history. No automatic retry.
- [ ] Implement shared state and checked opaque capability consumption. A later
  recovery owner must prove old-owner death and exact partial state; pending
  dispatch is never repeated solely because completion is missing.
- [ ] GREEN against real Task2 fixture store; independently inspect actual history
  and effects. No live launchd/selector mutation. Review and commit.

## Task4: actual held exclusion and effects adapter

Files: scripts/deployment-dashboard-cutover-adapter-v2.mjs and script test.
Consumes existing authenticated source/build/CLI/launcher/process/positive DB+FS
observers, current owner and direct/cold serialization. Produces nonforgeable
controller capability, once-only exact launchd/process/selector effects and
post-effect observations; enumerate its owned resources under a V2 phase profile.

- [ ] RED real owned fixture adapter boundaries: direct/cold freeze required,
  exact live original tuples, loaded-family/queued-contender drain, authenticated
  absent-dashboard branch, original symlink recheck/atomic selection, unchanged
  launcher restoration, new birth/listener/HTTP identity, response-loss recovery.
- [ ] Map the exact existing lock APIs/receipt inventories before implementing
  this production unit. Record concrete source-map additions in this plan;
  a source file being absent is not an active-owner proof.
- [ ] Implement actual primitives behind immutable authority checks; no source
  bypass, blanket PID kill or generic finally restoring spawner.
- [ ] GREEN owned fixtures and independent source/provider/crash review.
  Lack of adapter qualification keeps live command closed; commit.

## Task5: authenticated entry, delivery and qualified dashboard checkpoint

Files: scripts/deployment-dashboard-cutover-v2.mjs and builtin entry test;
exact consuming inventories/package entries recorded alongside their edits.

- [ ] RED closed entry modes and source/build/loader proof before adapter birth;
  imported/unqualified entry cannot operate live services.
- [ ] Implement authenticated complete closure; run affected ordinary suites,
  noemit/contracts/manifest and owned crash/genuine fixtures serially.
- [ ] Independent final review; normal scoped push/PR, exact-head review/merge.
- [ ] Separately nominate clean-main NEW-revision deployment preparation with
  preserved ae5 candidate/archives; no same-revision retry/capacity shortcut.
- [ ] Fresh held real-host preflight; journaled transition only after every
  owner/fence/adapter condition is proven. Verify3333 and unchanged3080/18789.
- [ ] Record dashboard checkpoint only; keep spawner refusal and whole-cutover/
  Task6A completion unresolved until their separate real acceptance campaigns.
