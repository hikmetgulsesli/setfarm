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

- [x] Write RED asserting all six literal actions and complete/pending prefixes;
  independently hash manually written canonical bodies, not builder expectations.
  Example:
  `assert.equal(history.intents[3].action, "select-new-cli")`;
  `assert.equal(history.authority, "history-only")`.
- [x] Run focused test with existing absolute tsx loader; absence must be genuine
  missing production module/export. No OS effect or compiler fixture required.
- [x] Implement minimal strict grammar. Reject ordinal skips, mismatched previous
  completion, crossed cutover/owner/self hashes, illegal outcome, extra fields,
  proxy/accessor invocation, noncanonical bytes, sparse/oversized array.
- [x] GREEN full finite matrix; old V1 pure grammar suite remains passing.
- [x] Independent source/test review, both seats C0/I0/M0.
- [x] Scoped conventional commit7260883b; no private evidence staged.

Task1 evidence: genuine missing-module RED12fail before source; review-discovered
Buffer prototype-trap regression RED12pass/1fail before fix; final14V2+5V1 tests
19pass/0fail/0skip. Strict isolated noemit for source/tests exits0; diff-check0.
Review also added hostile late-edge relations through ordinal6 and bounded
nonproxy ancestry128accept/129refuse. This is grammar qualification only, not
service dispatch or live takeover. Original outputs retained in private workspace
logs named2026-10-07-dashboard-cutover-v2-*, never committed as runtime artifacts.

Owner tests distinguish legal later-intent/reconciliation-owner changes from a
completion that changes its original dispatch owner. Exact wire literals/bounds/
hash projection/output states are pinned in the spec's Exact Task1 wire section.

## Task2: real durable V2 publication

Files: baseline-dashboard-cutover-store-v2.ts and matching test.
Consumes Task1 canonical bytes; produces observeDashboardCutoverStoreV2,
publishDashboardCutoverIntentV2, publishDashboardCutoverCompletionV2 with expected
observation hash. Fixed namespace and publication rules are in spec.

- [x] RED real private filesystem tests for empty observation without creation,
  all six published pairs, intent without completion refusing next ordinal,
  stale observation/crossed records, symlink/mode/root drift, partial writes,
  sync/link/close faults and intact old V1 namespace.
- [x] Implement using owned nofollow descriptors, immutable stages/links,
  fsync and complete rechecks; preserve pending artifacts and checked-once closes.
- [x] GREEN tests assert actual file bytes/identities/history, not mock presence.
- [x] Independent input and retention reviews C0/I0/M0; no live-root writes.
- [x] Scoped commit a893efc2, normally pushed in incremental DRAFT PR276;
  full controller/adapter/live delivery remains pending under Task5.

Task2 evidence: genuine missing-store-module RED29fail before authoring; final
31 real private-FS tests +14 V2 grammar +5 old V1 grammar pass50/0fail/0skip.
Strict isolated noemit0. Fixed12 records retain12 exact same-inode aliases;
tests independently verify hashes/bytes, recursively frozen observations and
untouched V1 sentinel. Actual close-response loss attempts original close once.
Two real contenders both observe absent root before a bounded IPC barrier,
then publish using those original expected hashes; both settle naturally.
Private fixtures remain retained; no live services or authority roots touched.
Latest exact receipt: workspace logs/2026-10-07-dashboard-cutover-v2-store-barrier-
green-original.json, SHA d85f6278cfdb4804b11abc75459dc3e14ae5fb99d8605b0c2fa292f5e969950f.
Earlier RED/GREEN originals are preserved, not overwritten or replayed.

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

Provider mapping outcome (research only): normal epoch-one lease and cold-genesis
wrapper cannot supply the pre-dashboard mutex. The raw V1 acquisition/release
also repairs/unlinks setup failures and retries ambiguous closes; do not wrap it
as checked-once V2. A separately owned distinct-schema V2 lock at the same fixed
physical transition path could block future V1 direct/cold acquisitions, including
after owner death, because V1 parsing rejects the unknown schema before reclaim.
It still requires independently qualified already-entered/stale cleanup and
queued-contender drain. Existing V1 final lstat then unlink has a TOCTOU window;
an already-entered stale reclaimer could remove a newer V2 pathname. O_EXCL or a
different schema alone is NOT the complete freeze proof. No provider source,
production controller or live effect is admitted by this research observation.

Task4a causal File Map refinement: add the separately nominated reservation-only
scripts/deployment-dashboard-cutover-serialization-v2.mjs and matching builtin
test before Task3. It must use the actual existing maintenance observer/normalizer
closure, own the original same-path V2 lock and checked-once resource ledger, and
refuse every EEXIST without V1 repair/reclaim. Exact proposed interface, wire,
physical rules and release/admission distinction are in the spec. Preserve the
stale-reclaimer interleaving as a negative complete-admission case, not a fixed
race claim. Independent nomination and real owned-fixture RED precede production
authoring. This component alone does NOT satisfy the Task3 provider dependency.

### Task4a implemented reservation checkpoint

- [x] Independent interface/resource nomination before authoring.
- [x] Genuine missing-production-module RED27fail, with originals preserved
  before implementation and after independent oracle corrections.
- [x] Implement actual owner observation, strict input/opaque handles, held
  nofollow originals, distinct-schema exclusive lock and sticky checked-once FSM.
- [x] GREEN27 owned-process/filesystem tests; successful release proves every
  returned component-original FD closes exactly once, in reverse order, and EBADF.
- [x] Actual-owner/final-physical drift and swallowed reentry refuse. Setup
  failures preserve lock evidence; an unsealed FD stays retained and unclosed.
- [x] A genuine canonical lock from a naturally exited owner remains unchanged
  on the next process's EEXIST refusal. Stale V1 pathname unlink stays NEGATIVE.
- [x] Three independent final source/resource reviews C0/I0/M0.
- [ ] Scoped incremental delivery; transaction confirmation belongs to the
  private master checkpoint, not an assertion before this commit.

Originals are private workspace logs named2026-10-07-dashboard-cutover-v2-
serialization-*. First implementation exposed test-loader FD-number reuse before
component admission; original failed outputs are retained. The corrected oracle
arms the returned-original ledger after module import, counts closes only for
those actual component originals and still checks ALL of them. No production
resource leak was excused by that correction. Successful reverse close order and
failure-tail unlink/sync tracing remain explicit. Affected ordinary tests:
51 reservation/maintenance-owner/journal +50 V2 store/grammar and old V1 grammar,
all pass,0fail/0skip. Syntax, version, English and path contracts exit0.
This is reservation qualification only: full adapter drain/DB/source proof,
controller, live command, clean-main deployment and dashboard checkpoint remain
pending. It does not authenticate an old-family zero-owner state.

### Task4a.1 causal held empty-history refinement

File Map: same serialization-v2.mjs and matching builtin test. Existing helper
holder requires retirement root absent; logical old helper census alone can
miss unheaded registry artifacts. Add only the independently nominated authentic-
handle empty-retirement-history assertion in the spec. Exact root membership
admits our known original reservation, rejects every other child, holds original
resources across two physical/actual-owner brackets with no new component-owned
returned FD or fs.openSync acquisition; provider internals are not counted.
No settled-history route, process quiescence or full capability is manufactured.

- [x] Independent exact interface/graph nomination.
- [x] Genuine missing-export RED27 priorPASS/14 newFAIL using actual owned V2
  reservation and root, before adding the export.
- [x] Minimal assertion plus real member/drift/reentry/foreign/resource tests.
- [x] GREEN41/41; affected65 maintenance/reservation/history +50 store/grammars,
 0fail/0skip. Three independent reviews C0/I0/M0. A review narrowed no-new-FD
 wording to returned component originals/fs.openSync; provider internals are not
 counted. No membership-sensitive witness is refreshed into acceptance.
- [x] Scoped incremental delivery2c52ceaf, confirmed afterward in private master.

### Task4b.0 causal direct root-FD provider slice

File Map: new scripts/deployment-dashboard-cutover-root-fds-v2.py and matching
builtin test. The narrowed source lemma concerns retained ROOT FDs through an
already-entered last-unlink interval, not whole ordinary lease/helper lifetimes.
Selected writers do not replace/remove the root; full loaded-source graph and
root generation still need authentication. Apple wrapper source confirms its
per-process errors are skipped; do NOT turn proc_listpidspath results into
absence. The new direct requested-PID FD-only report propagates query errors and
remains diagnostic-only, with exact interface/layout/fixture contract in spec.
No parent live transport, global PID discovery, fileport coverage, stale drain,
future-entry capability or live effects are supplied by this component alone.

- [x] Independent exact interface/provider/resource nomination, three C0/I0/M0
 reviews; diagnostic-only, not global absence. Actual recipe exactnom in spec.
- [x] Genuine corrected missing-provider RED9/9, actual privately held root FDs;
 first inherited-fixture readiness UNKNOWN retained separately, not credited.
- [x] Minimal direct typed read-only provider; no silent per-process/FD omission.
- [x] Actual owned Mac fixtures GREEN9/9,0fail/0skip; all natural EOF/custody
 checks pass. Adjacent65+50 pass; total124 distinct focused tests. AST/syntax,
 version/English/path/diff checks pass. Three source/resource reviews C0/I0/M0.
- [x] Scoped incremental DRAFT delivery805c0289; no full build/live-effect admission.

### Task4b.1 causal sampled UID-cohort slice before complete adapter

File Map: new scripts/deployment-dashboard-cutover-account-cohort-v2.py and
matching builtin test; qualified root-fds-v2.py is an unchanged literal source
dependency. Actual account ps sample432 rows precludes a64-PID truncation into
absence. Direct1025-slot UID-discovery diagnostic with strict dual BSD samples
is nominated exactly in spec; no live producer/exclusion certificate. Source
research confines ROOT last-unlink lemma to actual cooperative platform target
bindings, not unused development/archive ownership or arbitrary UI code ability.

- [x] Independent exact input/ABI/source/resource/interface nomination.
- [x] Genuine missing-provider RED4/4 before source; separately reviewed recipe.
- [x] Minimal actual typed read-only sampled cohort provider; whole-report refusal.
- [x] Actual fresh native GREEN4/4,0fail0skip; two naturally settled holders.
 Fresh adjacent65+50 pass, contracts/AST/syntax/noemit/diff0. Unchanged ROOT9
 remain prior qualified evidence, not rerun;128 distinct focused tests passed
 across the units. Three independent source/resource reviews C0/I0/M0.
- [x] Scoped incremental DRAFT delivery76c0ef8c; no full adapter/Task3/Task5 admission.

### Task4c: retained ordinary-dashboard pre32 transaction bridge

Causal File Map: extend baseline-legacy-database-census-v1.ts with an additional
V2 continuation export and opaque-scope recheck; add tests/internal-production/
baseline-dashboard-cutover-pre32-continuation-v2.test.ts. Existing V1/V7 behavior stays
unchanged. The next launcher/phase-V2 consuming provider is separately required;
no caller URL, callback, census or opaque PG scope is service-effect authority.
This corrects released-at-return snapshots across the physical second pass.

- [x] Independently nominate exact scope/lifetime/recheck/failure contract.
- [x] Genuine missing-export RED before implementation, using read-only driver
  fault fixtures; no fixture result is production credential/freeze authority.
- [x] Hold actual private transaction through callback; exact pre32 locks/journal,
  opaque same-instance scope, bounded rechecks, sticky reentry/query failure,
  revoke BEFORE callback leaves transaction. Never return SQL/URL.
- [x] GREEN source fault matrix plus unchanged census snapshots. Real private PG
  qualification and phase-aware launcher composition remain separate gates.
- [x] Review scoped source/test diff and record exact evidence before delivery.
  Delivereddda5fe70 in OPEN DRAFT PR276; actual PG/adapter admission stays closed.

Task4c evidence:16 genuine missing-export REDs before source; first16 GREEN,
review-expanded final20 source-fault cases PASS0fail0skip. Legacy7 PASS with an
explicit read-only existing dependency-resolution harness; initial1PASS6missing-
dependency FAIL attempt is not credited. No install/symlink or build bypass.
Fresh adjacent65JS+50TS pass; strict noemit378files0diagnostics; contracts/diff0.
Source1fcdc6a7/test28a16e2c have three independent C0/I0/M0 reviews. Final raw
outputs/harnesses preserved privately.142 fresh cases for this slice; native9+4
remain unchanged prior evidence,155 distinct across units, NOT155fresh. No actual
PG backend/credential/phase/owner qualification or live admission by fixtures.

### Task4d: genuine owner-handle bound labels for the future adapter

Causal File Map: scripts/deployment-cutover-owner.mjs and its existing builtin
scripts/__tests__/deployment-cutover-owner.test.js. Adapter must bind its actual
owner handle to the same maintenance/claim hashes; returning labels from trusted
private custody avoids substituting history JSON for that handle. Exact additive
export/guard/binding-only semantics are nominated in spec. Original owner/build
authenticator and native work remain unchanged; source fixture BUILD is mocked.

- [x] Independently nominate strict opaque-handle projection/reentry contract.
- [x] Add missing-export RED with exact on-disk fixture labels/hostile handles,
  drift/sticky refusal and swallowed reentry; old owner tests unchanged.
- [x] Minimal additive private-handle projection; no owner or effect grant.
- [x] GREEN focused owner suite and source/resource review; scoped draft delivery.

Task4d evidence: old24 PASS/new7 genuine missing-export FAIL before source;
first31 GREEN. Review expanded both original/proxy reentry into the second
assertion (actual observer call3); final33 PASS0fail0skip. Source d86ec813/test
3cc3dadd; readonly existing-candidate resolver, no install/symlink. Fixture
clean-main BUILD is mocked; actual private FS/history/process only, not actual
production build, consuming adapter, complete freeze or live admission. Two
trusted assertions retain their existing bounded FS/process resources; no
per-internal-query abort claim. Original and final outputs preserved privately.
Three final independent reviewers C0/I0/M0. Adjacent65 PASS freshly; Node syntax,
version/English/path/diff checks pass. No TypeScript production changed in this
slice; prior noemit evidence remains prior.98 fresh source-fixture cases here;
188 distinct across the units includes historical native13, NOT188fresh. Final
preservation255 originals/123ancestors40aliases8absences/255once-closes/errors[].

Next causal File Map pending reader nomination: db-pg.ts, server/daemon.ts,
server/dashboard.ts, closed reader/bootstrap modules and tests as required by
actual GET statement inventory. Generic full-head migration cannot authenticate
pre32 DB-backed dashboard reads. This is an in-goal startup root fix, NOT new
features or Task6A/native prerequisite. No runtime/role/catalog guard bypass.

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
