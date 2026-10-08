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

### Task4e: retained launcher material and private pre32 bridge

Causal File Map: extend existing launcher-observation-v1.ts only with the
separately nominated material path and four V2 exports; add dedicated
tests/internal-production/baseline-dashboard-cutover-launcher-material-v2.test.ts.
Plist material must outlive bootout/start phases; existing V1 idle assertions
cannot span them. Retain original files without pretending material is loaded
phase, Node-path/passive-home or effect authority. Private URL bridge consumes
Task4c scope without exposing credentials or importing generic migrations.

- [x] Independent nomination review before implementation.
- [x] Genuine missing-export RED for strict handle/zero-input, material drift,
  private bridge lifetime, reentry and checked-once reverse cleanup.
- [x] Minimal additive implementation; existing V1 behavior unchanged.
- [x] Focused GREEN plus V1 compatibility/noemit/contracts, independent review.
- [ ] Scoped draft delivery, no host effect or whole-completion claim.

Task4e evidence:12 genuine missing-export RED before source. First source attempt
3PASS9FAIL (cleanup rejection plus original-FD fixture ledger mixing loader FDs)
preserved/uncredited; corrected12 then review-expanded22 GREEN. Reviewer account
reentry flaw reproduced22PASS2FAIL BEFORE pure-state fix; final24 PASS0fail0skip.
Exact final source3f2535ea/test98aa4836. Final V1 compatibility118 PASS0fail0skip,
strict noemit393files0diagnostics/no emission. Initial compatibility117PASS1parent
loader-resolutionFAIL uncredited; corrected earlier118 kept separate from final
revision run. All three source/resource reviewers C0/I0/M0; final raw receipts
saved privately.142 fresh source-fixture cases here;330 distinct across units,
not330fresh or whole npm test/build. Contracts/diff0; final01:15:08UTC gate255
originals/123ancestors40aliases8absences/255once-closes/errors[]. Acquisition keeps
strict loaded-idle config; later material checks do not query launchctl. This
component holds NO Node/passive/typed-phase/actualPG/effect authority. Complete
adapter/controller/entry and restrictive-reader startup remain required.

## Task5: authenticated entry, delivery and qualified dashboard checkpoint

Task4f causal refinement before Task5: restricted core-reader runtime/root fix.
File Map: db-pg.ts; a dedicated private reader/session module and structural
validator only as independently nominated; server/daemon.ts; dashboard.ts closed
dispatch; server/index.html truthful unavailable/error handling; focused reader,
startup/router/UI tests. These recover existing basic data under pre32 without
generic migrations; no unrelated feature or new native barrier. The six named
methods/seven fixed existing SELECT shapes and explicit excluded routes are
recorded in design. Exact lifecycle/provider and actual-host recipe remain pending;
structural and closed-data nominations below do not supply those grants.
Select one fresh private READ ONLY REPEATABLE READ transaction per complete HTTP
operation, including all run/step reads; no cross-request backend continuity or
owner claim. Initially one active request with explicit busy refusal, no queue.
Provider must not transfer Task4c's ended backend or claim reserve/onclose alone
is successful snapshot settlement. Reader preparation does not authorize a public OPEN daemon start;
actual entry/adapter still supplies independently qualified effect authority.

- [x] Task4f.0 RED then permanent ordinary DB/admin/borrowed-TX refusal and
  unqualified dashboard entry refusal, with absent and cleanup compatibility.
- [ ] Qualify exact reader/session genesis/loss/queue/result and structural API.
- [x] RED then extract existing run/observation value projection into a pure
  shared module, preserving public dashboard export and legacy semantics. This
  independent prerequisite neither clears the catalog gate nor starts a reader.
- [ ] Task4f.1 actual closed whole-response reader; exact profile/provider port
  nomination and RED before production. Five response kinds, seven private SELECT
  fragments, original RR transaction and whole-result refusal caps; no Task5 grant.
- [x] Structural-only internal metadata profile:39 missing-module RED, reviewer
  nested-array/parameter-alias7 RED before corrective source, final71 GREEN and
  strict no-emit894/0. Exact3 SQL/104-column fixtures, original OID+metadata hash,
  nested zero-trap refusal, four partial and three non-text index branches.
  An earlier1 source type-overload diagnostic remains uncredited. No actual PG,
  locks, RR/callback/end, schema-writer exclusion, data reader or startup proof.
- [x] Closed original-transaction data operation: exact5 requests/7 SQL, all
  run/step reads together, source row/inert DTO validation, truthful whole-result
  caps and privately branded failure dispositions. RED before implementation;
  original lifecycle/qualification/HTTP/startup remain separate pending work.
  Actual44 missing-module RED; source-fault RED2 private-parent/proxy, RED3
  malformed-overcap precedence, RED1 function-proxy before corrective source.
  Final71 GREEN; seven literal SQL/parameters and third-port no-partial oracle.
  Read-only omitted-WHERE sensitivity70/1 fails the intended exact-SQL assertion,
  not compilation/setup. Three independent current-byte reviews C0/I0/M0.
  Focused profile/projection/data/ordinary-refusal/startup231 GREEN, strict
  existing-toolchain no-emit896/0; version2.3.79, English1953, paths976.
  Earlier8 no-emit diagnostics and async-proxy test-driver assimilation negative
  remain uncredited; corrected typed/request narrowing and synchronous port
  oracle without weakening production checks. Actual255 material preservation,
  original two user-dirty files unchanged. Not full suite/build/live qualification.
- [ ] RED then minimal runtime implementation; preserve generic and Task6A guards.
- [x] Private lifecycle constructor/prepare/read/refuse: one selection/active
  operation, privately captured target, original callback/query/begin/end custody,
  exact RR/utility/locks/qualification/data flow and capacity settlement before
  publication. Actual45 missing-module RED before authoring. Reviewer faults
  produced57/55/2 RED for lazy initiation,61/57/4 RED for late publication and
  unhandled native rejection,64/63/1 RED for pre-cap allocation before fixes.
  Final68 lifecycle cases plus prior262 passed together330/0; strict existing
  toolchain no-emit900/0. Three exact-byte independent reviews C0/I0/M0.
  First43/45 passing attempt exposed two fixture future-read count errors and
  four strict diagnostics; neither is credited as verification. A four-microtask
  late-refusal fixture passed at an earlier boundary and was not credited as
  the publication oracle; five-microtask schedule genuinely reproduced both
  post-execute publication failures before the final pure refusal fence.
  Intrinsic settlement observation uses installed Query's plain Promise species
  without activating its overridden then/handle; query/lazy-getter reentry stays
  zero-activation, rejected originals stay observed. Prepared baseline and final
  initial identities, zero DATA on drift, tagged receiver, detached success and
  rejection, pending query/callback/BEGIN/end, duplicate precedence and checked
  once cleanup have focused fault oracles. Material255 preserved, original two
  user-dirty files unchanged. No public facade, actual PG, schema-writer exclusion,
  HTTP, build, listener/PID or consuming-entry grant. Those remain required.
  Causal delivery follow-up: actual GitGuardian check112614837183 on97aef431
  flags Generic Database Assignment in the inert wrong-pass fixture at test13
  (incident37940663/occurrence301226266). Replace that fictitious assignment
  with an explicit noncredential wrong-type target-option fault; preserve the
  same strict target agreement/refusal oracle. Do not dismiss an incident,
  rotate real credentials, alter scanners/access or rewrite history. After
  fresh focused verification and independent exact-byte review, preserve PR277
  and its failed historical range read-only, then deliver the exact corrected
  reviewed tree through a separately named ordinary branch rooted in actual
  main. The original physical writer worktree is reused; no extra candidate or
  archive and no old branch/worktree removal. Scanner success must be observed
  on the new exact head. This is history-preserving causal delivery refinement,
  not a claim that the old incident was resolved or ignored.
  The v4 aggregate2fd70092 / PR278 also failed actual check112615986682:
  Generic Database Assignment again at test13, incident37940867/301228012.
  Numeric mismatch is therefore uncredited as scanner remediation. The source
  detector documentation describes contextual host/port/user/password assignment
  quadruples; no static fabricated credential is needed by this unit. Retain
  the same-type inequality oracle using a fresh random UUID generated solely
  inside the inert no-network provider, never configured/stored/published, and
  add an independent missing-pass option case. Production stays byte-identical;
  missing-only coverage must not replace the same-type equality test.
  Preserve both historical PR277/278, all refs and incidents unchanged. After
  fresh verification/review, a separately named normal v5 aggregate of the exact
  corrected tree may reuse this same physical worktree and actual-main parent.
  Its new-head scanner result, not detector documentation or prior GREEN, is
  the delivery gate. No source-fault fixtures may reach a real provider.
  The v5 aggregate8143bd50 / PR279 also failed actual check112617364176 at
  test16 (incident37941185/301228552). Ephemeral assignment alone therefore
  receives no scanner-remediation credit. Use conventional public test identity
  consistently in inert provider and positive/remote/NUL target fixtures, with
  no change to same-type UUID/missing-option oracles or production. This marks
  genuinely inert fixture data, not a renamed real credential. The detector's
  [official description](https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/generics/generic_database_assignment)
  distinguishes common test usernames; only actual exact-head scanner success
  can qualify delivery. Preserve PR279, its branch/check and incident too.
  A v6 normal aggregate may follow the same reviewed exact-tree, actual-main
  parent, same-physical-writer and no-history-rewrite delivery requirements.
- [x] Closed retained qualification snapshot: metadata3/source-journal1/exact
  applied-tail1/cold-census5, private original continuity and fixed refusal;
  dense journal decoding before inherited every/some predicates. Nomination and
  genuine RED before source, no acquisition/lock/lifecycle/start grant.
  Actual30 missing-module RED before authoring; final31 qualification cases plus
  prior231 focused cases passed together262/0. Real retained source validators,
  source checksum identities and a genuine terminal-open finding fixture used;
  no connection-owning/migration helper or fake empty finding inventory. Exact
  dense journal/tail copies reject holes before inherited every/some predicates.
  Three independent final-byte source reviews C0/I0/M0; strict no-emit898/0,
  version2.3.79/English1955/paths977. An earlier apply_patch context mismatch
  changed no files and receives no verification credit. Material255 preserved.
  Callback/queries/commit/end custody and readiness are still pending, not supplied
  by these inert cross-request hash comparisons. No build/live reader/startup.
- [ ] RED exact-method/route denial and no PID/listen on preparation failure.
- [x] Task4f.1e source-only cold public db-pg facade, using the existing private lifecycle:
  source nomination, paired missing-export/fault RED before runtime authoring;
  exact prior cold flags, OPEN intent, raw/config own-data capture, lazy import,
  original work custody and pgClose revocation without resetting history.
  File Map: db-pg.ts; dashboard-core-reader-facade-v2.test.ts; normal pure entry.
  No startup/router/UI/actual-PG authority. Independently review exact source,
  run affected source tests/strict no-emit and preserve actual255 before delivery.
  Nomination reviews: input C0/I1/M1, retention C0/I0/M2, startup C0/I0/M1.
  Amendments pin premature read as permanent refusal, premark refuse before its
  port, and spell exact errors. Unexpected private BUSY is lifecycle failure;
  only facade-owned busy precedence is nonburning. Cold-flag fault fixtures append
  a lexical setter to the loaded module in memory only, never production hooks.
  Paired RED run uses the existing retained dependency-resolution harness and
  actual db-pg plus request/error authority, with inert external-effect ports.
  Example oracle: close during pending import, then settle the original import;
  original preparation must refuse and constructor count remain zero.
  Actual51 missing-export RED before implementation, then51 GREEN; final52 facade
  cases plus prior331 affected cases passed together383/0. The reviewer-added
  unexpected-private-BUSY case covers existing behavior and is not credited with
  retroactive RED. Final strict existing-toolchain no-emit901/0; version2.3.79,
  English1958, paths978. Three final-byte independent reviews C0/I0/M0 at
  db-pg3d015fad / testf2f1906c. Existing startup files/ordinary guard bodies remain
  unchanged. Actual255 held resources preserved with errors[], including both
  original user-dirty files. Original output/commands retained privately outside
  the PR. First fixture syntax error was corrected before genuine RED and receives
  no RED/verification credit. No actual PG/HTTP/build/listener or Task5 entry grant.
  Earlier v6 aggregate9f1c14e8 / PR280 exact-head GitGuardian succeeded at
  2026-10-07T03:36:17Z; earlier failed historical PR ranges/incidents remain intact.
  This facade source change still requires a new-head delivery check.
- [x] Task4f.2 source-only truthful UI error/unavailability, never fake empty data or hidden
  failures. File Map: server/index.html + dashboard-http-availability-v2.test.ts
  and normal pure-suite entry. Actual-inline-script VM RED before authoring:
  non-2xx before json/blob, fixed network/parse failures, per-panel stale state,
  mixed events/observations and both failed, rule-cache filtering, rejected
  save/delete/import/editor preservation, export zero-download and old-selection
  publication refusal. Implement checked transport/section-owned catches and
  retained-data status, preserving successful UI semantics. Run focused VM tests
  then existing affected sources/noemit/contracts/material255; independent exact
  code/test review before normal commit/push. No HTTP/browser/startup authority.
  Actual entire-inline-script VM31 cases:30 genuine RED plus one successful-empty
  control before authoring. Auto-selection review fault32/31/1 RED and collection/
  subpanel/cache review faults41/32/9 RED before corrective source. Distinct action
  status/privacy nomination then46/27/19 RED before its correction. Final51 UI
  cases include five ordinary populated/success controls (not retroactive RED);
  together with prior383 affected source tests434/0. Final strict existing-toolchain
  no-emit902/0; version2.3.79, English1959, paths978. Final exact-byte input,
  retention and startup source reviews C0/I0/M0 at HTML6ca494b1/teste4d927f1.
  Four independent rule-action status owners cannot be masked by newer data GETs;
  malformed collections refuse before empty/cache, rejected rules restore prior
  cache, auto probes and old subpanels cannot replace newer selections. Actual255
  preservation errors[], original two dirty files unchanged. Private original
  outputs/commands retained outside PR. No real browser/HTTP/build/listener or
  authenticated entry; those remain required. Prior facade7be4b392 exact-head
  GitGuardian SUCCESS2026-10-07T03:49:49Z, new UI delivery requires its own check.
### Task4f.3: terminal restricted HTTP source adapter

Spec: Task4f.3 in paired design. This causal root fix is required to consume the
prepared reader without generic SQL/advanced-route fallback; startup stays closed.
Files: create server/dashboard-core-readonly-http-v2.ts,
server/dashboard-core-static-v2.ts and tests/dashboard-core-readonly-http-v2.test.ts;
modify dashboard.ts for shared ordinary material/rules helpers only and package.json
to register the new test in the normal pure suite.

Interface: handleDashboardCoreReadonlyHttpV2(req:IncomingMessage,
res:ServerResponse):Promise<void>; literal readDashboardCoreResponseV2 import,
no preparation or injection. Shared ordinary/required loaders have distinct
zero-argument exports, pure mergeDashboardRulesV2(system,custom,query).
Static source identity is not startup admission.

- [x] Write paired actual-handler route/complete-publication tests before source.
  Example: GET /api/runs?workflow=&include_terminal=YES must invoke exactly
  {kind:"runs",includeTerminal:true}, return complete JSON bytes with exact length;
  POST /api/rules must503 with no reader/material/body ports.
- [x] Run via existing candidate tsx loader and readonly package resolution;
  verify genuine missing-handler RED, retaining full original output.
- [x] Extract shared material/projection/filter helpers via apply_patch; preserve
  ordinary catch behavior, add separate strict required exports. Implement fixed
  handler route classification, awaited actual facade, staged complete4MiB payload.
- [x] Run new tests + existing434 affected source cases, strict noemit and contracts.
  Review exact code/test bytes independently for inputs, retention and startup.
  Preserve actual255 resources. No dirty build bypass or service action.
- [ ] Record original receipts privately, normal scoped commit/push PR280 and
  exact-head scanner check. Real integrated facade/PG/socket/browser/Task5,
  reviewed integration and NEW-revision clean-main rollout remain open.

Source qualification:54 genuine missing-handler RED before source authoring,
then54 GREEN. Review added corrupt required material/ordinary compatibility
controls and four genuine empty-static/invalidHTMLUTF8 RED before correction;
64 GREEN followed. Final69 adapter cases plus434 prior affected tests503/0;
strict readonly noemit905/0, version2.3.79, English1962, paths980. Actual Node
ServerResponse serialization into an owned memory Duplex is framing evidence
only, no socket/parser/browser or integrated facade/PG proof. Three independent
exact-byte reviews C0/I0/M0 at handlerc000291e/catalog51a771c0/test9ac318e1/
dashboard5afe2651. Actual255 preservation04:19:53UTC errors[], both original
dirty files unchanged. MC/gateway200,3333 refused; no host service change.
Private original output and commands remain outside PR. Source adapter delivery
does not complete Task4f.1, Task5, reviewed integration or clean-main/live rollout.
Prior UI615a9356 exact-head GitGuardian SUCCESS2026-10-07T04:06:49Z.

### Task4f.4: whole-reader owned HTTP composition

Spec: paired Task4f.4. Files: create
tests/internal-production/dashboard-core-http-composition-v2.test.ts and
tests/helpers/dashboard-core-http-fixture-v2.ts; register in package.json.
Interface: test utility creates independent readonly metadata/source-journal/
cold-census/historical-row fixtures and tracked inert postgres transport.
Only exact runtime-config/intent observer/postgres substitutions. Actual handler,
facade, lifecycle, qualification/profile/census/journal/response code stays real.

- [x] Before fixture execution, independently review exact owned-child/server/
  provider/original-promise resource recipe; no accepted native/runtime replay.
- [x] Write actual composition assertions using independent literal DTO/port
  expectations. Example: historical failed run appears only with include_terminal;
  response before original end settles must have zero200 publication. Observe
  failures before corrective production code, if any; do not fabricate RED for
  an already-working composition.
- [x] Run owned loopback ephemeral HTTP cases and retain complete original
  output/closure ledger. Separate inert PG/source composition from actual PG.
- [x] Run affected sources/noemit/contracts/preservation255, review actual bytes.
- [ ] Normal draft delivery and exact new-head scanner. No full build, merge or
  live startup by this fixture.

Actual first invocation eight cases passed; no production change or fabricated
RED. Final affected511/0, strict existing-toolchain noemit907/0, version2.3.79,
English1964/paths980. Eight complete original diagnostic ledgers retain exact
statement-role counts, callback/commit/end settlement and zero owned sockets;
BUSY cases peak two client/server sockets. End-rejection occurs after successful
original callback/commit; early-loss callback remains false until owned release
and natural model settlement. All fixture invariantErrors empty. These are real
owned loopback HTTP bytes through actual source modules with inert PostgreSQL,
not installed-PG, launchd, browser, full adapter or startup qualification.
Three independent final-byte reviews C0/I0/M0 at helper83487cc2/test847f06a6/
packageb15f4c3d. Actual255 preservation04:49:53UTC errors[], original two dirty
files unchanged; MC/gateway200,3333 refused. Full receipts remain private.

### Task4f.5: installed private reader on genuine held-launcher target

Spec: paired Task4f.5. Files: launcher-observation source and existing material
V2 test; normal pure suite. One handle-only fixed diagnostic, no public facade or
startup grant. Actual private URL stays inside original authenticated holder.

- [x] Genuine missing-export RED and closed fault fixtures before source.
- [x] Smallest private prepare/fixed-rules diagnostic, retained original custody,
  one lifetime attempt and count-only output; no runtimeConfig/env-loader import.
- [x] Focused affected/noemit/contracts, exact-byte independent review and fresh
  actual255 gate. No accepted native or prior-PG recipe replay.
- [x] Independently nominate exact single fresh installed-PG child recipe before
  invocation: existing idle launcher material, installed real driver, two
  sequential readonly transactions,49 planned app statements, bounded output.
  No nested36SHARE, retries or service changes; failed custody stays unqualified.
- [ ] Retain private originals and normal draft PR delivery/exact-head scanner.

Qualification receipts: thirteen valid missing-export REDs; three syntax-invalid
fixture failures receive no RED credit. Intermediate exact-import-boundary
mapping authoring failures are unqualified, not production faults. Final new23
plus original24 material cases47/0; affected558/0, strict readonly noemit908/0,
version2.3.79/English1964/paths980. Three final source/test reviews C0/I0/M0 at
source30db631e/testa6a46d99. The first host child05:06:38 refused initial file
pins BEFORE source import/material/PG, opened0/no PG credit. Pure metadata found
the installed native esbuild exact two known hardlinks; preserve both, positively
pin exact2+sameinode, do not relax other inputs. Separate revised recipe reviewed
C0/I0/M0, childa51cdabd/parent5ec29b6c. Fresh25505:09:41 errors[] then actual
installedpostgres3.4.8 qualification05:09:42: private preparation+fixed rules
read succeeded, ruleCount0 genuine,49 planned application statements/two original
RR readonly clients,18 selected path pins,7 original material reverse closes+
EBADF, child41705 natural exit0/stderr0, watchdog not expired. No replay.
Natural child exit and reader promise success are not backend/descendant death.
No runtimeConfig/public-facade target match, complete schema-writer exclusion,
all-seven data-query installed qualification, full adapter/entry, browser/build
or actual3333 startup grant. Public OPEN/spawner gates remain closed. Full
original receipts stay private; all preserved worktrees/archives/user dirty files
unchanged. This qualifies Task4f.5 diagnostic only, not whole cutover.

Task4f.4 normal delivery9d4aa12dbe834643f93747ee8dcecf9a8b2eaaec;
exact-head GitGuardian SUCCESS2026-10-07T04:50:46Z, PR280 OPEN DRAFT.

Task5 complete adapter remains required: original genuine owner+reservation+
retirement ROOT and source/build/selector handles, authenticated finite cooperative
producer graph/ROOT-held last-unlink exclusion, retained launcher/private pre32
36-lock scope, exact six changing-phase predicates and durable intent before
once-only effects. Default-context snapshots that release at return or V1 idle/
absence holders cannot supply this capability. No readerREADY/labels/sample
metadata substituted for live startup/exclusion authority.

- [ ] Private actual-PG/HTTP qualification and independent source/resource review.

Pure projection prerequisite delivery:27 genuine missing-module RED before
runtime authoring, then29 new GREEN (two reviewer-found compatibility cases) +
3 existing terminal-filter GREEN. Existing OPEN-refusal57 GREEN after extraction;
89 fresh tests total, not a complete suite/build. Final strict existing-toolchain
no-emit892 files/0 diagnostics; an earlier typed test fixture excess-property
diagnostic was fixed without cast/type weakening and receives no passing credit.
The shared projection retains existing spread/reference/JSON fallback behavior;
hostile-row validation remains the future reader's responsibility. Actual original
material gate255 resources/errors[]; MC/gateway HTTP200,3333 refused. No native,
SQL mutation, migration, PID/listener, build/archive deletion or admission effects.
Exact structural3-statement nomination has scoped source review and explicitly
trusted builtin/matched-locale/ACCESS SHARE plus separate schema-writer exclusion
premises; actual provider/host and reader implementation remain open. A proposed
SRE lock recipe was rejected because it conflicts with controller SHARE locks.

Causal delivery refinement: PR276's historical scanner checks still flag a
password-shaped fictitious test canary in an earlier commit, despite the corrected
current source. Another head-only source edit cannot remove that historical scan.
After scoped source verification/review, preserve PR276, its branch, failed gate
and evidence read-only; create a separately named normal delivery branch from the
actual main ancestor with the exact final reviewed tree as one new aggregate
commit. No old ref/history rewrite, force push, incident ignore/resolution,
scanner/access/credential change or branch/worktree deletion. ROOT remains the
sole writer and switches only the active writing branch. Verify exact tree/delta
equivalence and actual new-head scanner result; a new PR is transparent DRAFT,
not a gate bypass, merge or promise that incident association will disappear.
This preserves all development/deployment worktrees and the two original dirty
files; no new build/archive/candidate resources are created by this delivery step.

Task4f.0 source delivery: 35 genuine ordinary-DB refusal REDs +1 absent PASS;
14 genuine startup REDs +1 absent PASS, then reviewer-found CLI running-status
fast-path4 REDs +15 component PASS before its separate fix. Final new38 DB +19
startup/CLI component cases GREEN;41 affected observer/spawner-admission/base
catalog/current-head compatibility PASS. Strict889-file noemit0 diagnostics;
version/English/path contracts pass.98 fresh cases for this slice, not a full
build/test or live checkpoint. Warm original close and rejected-end identity/
no-reconstruction guards added after review; production cleanup unchanged.
Initial fixture-record and dependency-resolution failures remain uncredited.
Normal pure-suite includes the two new test files. Three independent read-only
source/resource reviews; no writer delegation. CLI tests evaluate actual source
components, not a full runtime-guard/loader qualification. Reader provider,
restricted HTTP/UI and authenticated Task5 entry remain required; no source unit
or OPEN-intent refusal grants their admission. Native/S10 diagnostics not replayed.

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

## Task4a.4: remove first-generation publication window

Causal refinement: existing mkdir-then-lock publication permits a prepublication
V1 entrant and therefore still needs a last-unlink drain. The current positively
absent canonical ROOT permits the separately nominated absent-only atomic route.
Use the exact Task4a.4 spec above, not sampled UID equality as completeness.
File Map: atomic-root-v2.py + scripts/__tests__/deployment-dashboard-cutover-
atomic-root-v2.test.js. Existing reservation and native/S10 artifacts unchanged.
No production adapter/startup permission follows from this filesystem leaf.

- [x] Genuine missing-production RED14/0PASS; no native call before input qualification.
- [x] Implement bounded public Darwin syscall/checked-once child FD custody.
- [x] Actual new private-FS GREEN38/0FAIL/0SKIP; affected103/0; three exact-source
  reviews C0/I0/M0. Private originals preserved; no source/build/live admission.
- [ ] Bind finite producer/root/cleanup closure in the consuming adapter; parent
  originals and child settlement must be retained before any live publication.

Task4a.4 receipt: sourcee65e3f49/test4c70e5de, freshFULL38c915aa; affected103
includes38new+65existing, not the earlier558 full reader set. Review found
pre-close observation retry and FIFO blocking: independent26-case23PASS/3FAIL
RED8e4089 before source fixes. Nonblocking owned FIFO and one-shot unknown-state
oracles now pass. Trap-counter/source-variant73 proves zero-port sensitivity.
Every child close position and rejected/lost output retain path evidence, not
rollback; exact native/sync/close counts prove nominated boundaries were reached.
Order controls are deterministic, NOT concurrent-race acceptance. Async fixture
capture drains both EOF without signals and retains all3parent originals after
overflow/error. Early fixture cleanup/positional-offset/capture-wrapper bugs are
preserved as uncredited originals, not production RED claims. Literal native
flags0x34 are qualified only on these owned host fixtures. Existing canonical
ROOT, lock, launchd/listener and PostgreSQL remain untouched. Actual255 original
material gate05:49:42 errors[]/manifest8932f443 unchanged (first wrong-cwd
252-resource diagnostic refused, then correct native-source cwd audit succeeded;
no native/provider replay). Version2.3.79/English1965/path981 pass; unchanged
MC3080/gateway18789 HTTP200,3333 absent. Scoped delivery does not satisfy Task3/4/5.

## Task4a.5: retain the atomic publisher's consuming originals

File Map: first-generation-v2.mjs + matching builtin test, exact nomination in
Task4a.5 spec. Causal need: the filesystem leaf cannot retain a controller's
original descriptors across its asynchronous child or supply a private handle.
Keep old V2 API unchanged; no native/S10 prerequisite or actor census claim.

- [x] Missing-production RED, independently handwritten V2 wire/hash oracle.
- [x] Implement closed input/custody state and original child/FD retention.
- [x] Real private-FS success/refusal, owned boundary faults/reentry, once-close
  and permanent ROOT/lock preservation; independent review before delivery.
- [ ] Consuming adapter authenticates full producer/cleanup/build/OS closure;
  this reservation-only component does not qualify effect or startup admission.

Task4a.5 receipt: genuine missing-module12FAIL/0PASS before source; late-lock
metadata13-case12PASS/1FAIL before published-FULL close fix; short-interpreter
14-case13PASS/1FAIL before exact original-size fix. Final20/0 plus103 affected
existing gives123PASS/0FAIL/0SKIP. Five parent-capture error/overflow/malformed/
missing-EOF cases are supplemental existing-behavior characterization: original
fixed helper runs once and closes naturally before public refusal; all parent
FDs stay live, retry touches zero ports, published paths persist. No capture
fault causes a signal/timeout/cleanup/retry. Closed genuine handle is permanently
spent. Expanded idle/foreign oracle counts account/FS/owner/Python boundaries.
Source19d3035f/testb42e4223 have three read-only C0/I0/M0 reviews. Fresh actual
255-original gate06:16:17UTC errors[]/manifest8932f443 unchanged; uncredited first
shell invocation refused to parse before JS execution, corrected node heredoc
succeeded. Version2.3.79/English1967/path983 pass. MC/gateway200,3333 absent.
Full originals saved privately, not uploaded. This is not a full-suite/build,
producer/OS-loader closure, complete controller or real-host startup acceptance.

## Task4a.6: prevent future generic cleanup from erasing baseline authority

Root cause and exact interface/limits are nominated in the paired Task4a.6 spec.
File Map: new installer platform-cleanup-protection-v2.ts + top-level test;
cleanAgentWorkspace and uninstall recursive-delete boundaries; CLI uninstall
caller ordering in src/cli/cli.ts. This bounded
systemic fix is necessary to close the cooperative cleanup part of the monotonic
ROOT premise, but old loaded callbacks still require separate drain evidence.

- [x] Write real owned-path tests before source: target ancestor/baseline/child,
  symlink aliases, absent ROOT, broken-link/unknown ancestry, disjoint workspace,
  invalid zero-port input and finite path bounds; observe genuine missing-module RED.
- [x] Implement the fixed-account physical assertion without caller roots/flags.
- [x] Add consumer refusal REDs before process/delete boundaries; integrate
  preflight plus per-delete checks without running live cleaner/uninstaller.
- [x] Execute the actual AST-selected CLI uninstall branch composed with the
  actual uninstaller body and private physical guard: protected target must
  refuse before daemon/PID inspection or stop. Observe RED against the existing
  early isRunning/stopDaemon block; remove only that redundant caller block.
  Keep ordinary admission, force and active-run checks unchanged; the callee
  retains the one daemon stop after its complete preflight. Positive disjoint
  fixture must reach that stop exactly once after config read, not refuse all.
- [x] Fresh focused33/0 and affected123/0; strict910-file noemit0 diagnostics;
  contracts and three independent exact-source C0/I0/M0 reviews. Save originals
  privately and preserve existing dirty files.
- [x] Normal scoped DRAFT delivery179607d17d0b2a6f948c675aeb7f7dc0ad36825a;
  exact-head GitGuardian SUCCESS completed2026-10-07T07:00:36Z.
- [ ] Adapter separately drains legacy pre-publication/post-terminal/uninstall
  callbacks and retains current config closure; source guard is not their proof.

Task4a.6 receipt: corrected missing-module12FAIL/0PASS before source; namespace/
alias16-case13PASS/3FAIL; corrected consumer19-case16PASS/3FAIL; positive
21-case19PASS/2FAIL exposed accidental arity-overrefusal; indirect-hop/preunlink
27-case24PASS/3FAIL before their fixes. Initial malformed fixtures are retained
but uncredited, as is the first19-GREEN uninstaller oracle. CLI corrected
33-case31PASS/2FAIL exposed premature caller stop; minimal caller removal gives
33PASS/0FAIL/0SKIP. Real actual CLI branch/callee composition is bounded fixture
evidence, not complete import/runtime admission. Four final filesystem cases
characterize existing behavior rather than authoring RED. Fresh affected123/0
and strict910/0/noemit. Guard77168dfe/worktreef8a3cba5/uninstalld357f6b7/
CLI91698dde/testd6eee67e have three read-only C0/I0/M0 reviews. Fresh physical
preservation255/errors[] at06:59:10–11UTC, unchanged manifest8932f443. Version
2.3.79/English1969/path984 pass; MC/gateway200,3333 absent (curl7, not success).
Full originals saved privately, not uploaded. No live cleaner/uninstaller,
canonical ROOT effect, full suite/build, merge, legacy drain or startup grant.

## Task4a.7: central future configuration mutation refusal

Causal source gap from the legacy-drain audit: configuration writers are not
covered by CLI-only guards; Medic install/uninstall also reach cron/config/unit
mutations without ordinary admission. Captured configs can reach the writer
after an earlier async read. Source admission inspects the authentic deployment
intent, not the first-generation retirement reservation. It cannot drain older
loaded writers. Keep that distinction explicit.

File Map: new src/internal-production/baseline-dashboard-cutover-configuration-refusal-v2.ts;
new tests/internal-production/baseline-dashboard-cutover-configuration-refusal-v2.test.ts;
src/installer/openclaw-config.ts writeOpenClawConfig;
src/installer/config-schema.ts atomicWriteSync;
src/medic/medic-cron.ts installMedicCron/uninstallMedicCron; paired docs.

- [x] Missing-module RED22/0PASS for a zero-argument fixed-source ordinary assertion;
  real private OPEN/unknown/absent paths, permanent refusal and swallowed
  reentry. Invalid idle arguments touch no observation ports or caller traps.
- [x] Implement void assertOrdinaryConfigurationDeploymentCutoverAdmissionV2()
  using the existing authentic observer, sticky refusal, active-before-ports
  burn and sanitized DASHBOARD_CUTOVER_ORDINARY_CONFIGURATION_REFUSED error.
  It returns no ownership/exclusion/dispatch grant and exposes no reset.
- [x] Before consumer changes, execute actual AST-extracted writer/atomic/Medic
  bodies with real assertion and private paths. OPEN/unknown must reach zero
  serialization/write/cron/unit ports. Known absent must reach each original
  first port. JSON serialization publishing OPEN must be stopped by the atomic
  writer's last check. Record actual consumer RED, not source-text assertions.
- [x] Add assertion before central writer validation/serialization and before
  atomic write's first filesystem mutation. Medic exports check before first
  cron entry, after that await before config cleanup, and after that await before
  timer entry. No guard bypass or full async helper-graph exclusion claim.
- [x] Run focused22/0 and affected615/0, strict912-file noemit0 diagnostics;
  version2.3.79/English1971/path985 pass; three read-only exact-byte C0/I0/M0
  reviews; fresh preservation255/errors[]07:10:40–41UTC, unchanged8932f443
  manifest and original dirty files. Full originals saved privately.
- [x] Normal scoped DRAFT commit/push9f9542e1; exact new-head GitGuardian
  SUCCESS completed07:13:32UTC. No full build/startup admission.
- [ ] Consuming adapter separately authenticates OPEN-intent genesis, original
  legacy invocation settlement, config/producer closure and phase-aware grants.

Task4a.7 receipt: missing-module22FAIL/0PASS preceded assertion source; first
consumer8PASS/14FAIL contains latent duplicate-declaration and duplicate-publish
fixture errors, uncredited. Corrected consumer9PASS/13FAIL preceded integrations;
five assertion cases and four positive absent first-port controls already pass.
Final22/0 and fresh affected615PASS/0FAIL/0SKIP include33 cleanup plus existing
558 reader/UI/HTTP/material/startup source cases and2 config validation controls.
Installed PostgreSQL remains inert in this affected harness; actual owned Node
HTTP uses ephemeral loopback ports, not3333. No earlier actual-PG/native recipe
is replayed. Private original output was retained in full; large combined tool
display truncated, so omitted middle was read from retained raw output without
re-execution. Strict912/0/noemit; all source/test pins unchanged under three
independent reviews: assertion7f0913c1/writer70a2a57a/schema041897cd/
Medic212a9023/test5efd5ad9. MC/gateway200,3333 absent (curl7, not success).
No actual config/cron/unit mutation, full-suite/build, merge, actor exclusion,
legacy drain or startup acceptance is inferred.

## Task4b.2: retain ordinary CLI contenders in the existing diagnostic

Causal prerequisite: the original V1 classifier omits recognizable ordinary
CLI cleanup/config invocations and matches service group words anywhere in task
arguments. Existing consumers refuse every nonempty family inventory; retain
that behavior without new grants or consumer exemptions.

File Map: src/internal-production/baseline-deployment-cutover-process-observation-v1.ts;
tests/internal-production/baseline-deployment-cutover-process-observation-v1.test.ts;
paired design and plan. Interface/schema remain V1.

- [x] Add literal ordinary workflow/uninstall/step/Medic/unknown-route cases;
  actual exported observer must retain them with ambiguous-contender and null
  executable/entrypoint/checkoutPath. Add incidental task-word, options/wrapper,
  duplicated-entry and late/reused contender cases. External ps/lsof only are
  inert, source classifier/bracket/hash remain actual. Observe genuine RED.
- [x] Change early omission to exclude only rows with no daemon OR CLI token.
  Service CLI labels require one recognized entry at position0, or position1
  immediately after Node, plus immediate group. All other CLI rows ambiguous.
  Keep original daemon and listener authentication/refusal unchanged.
- [x] Actual focused76/0; fresh affected process/default-launcher195/0 after
  supplemental self-retention oracle; strict927-file readonly noemit0 diagnostics.
  Version2.3.79/English1971/path985 pass. Three independent source/test reviews
  C0/I0/M0; review M1 self-retention gap addressed with existing-behavior test,
  not new RED credit. Preservation255/errors[]07:32:32–33UTC, unchanged
  8932f443 manifest and original user-dirty files. MC/gateway200;3333 absent.
- [x] Normal scoped commit/push08d42876 to existing DRAFT PR280; exact-head
  GitGuardian SUCCESS completed07:37:37UTC. No startup admission.
- [ ] Original legacy process settlement, loaded-source/argv authentication and
  continuous exclusion remain separate adapter obligations. No live startup.

Task4b.2 receipt: original76 cases49PASS/27FAIL before the production change;
15 dropped ordinary routes,8 misplaced/incidental service labels and4 missing
ordinary bracket refusals. One both-service-word ambiguity control and2 direct
starter controls already pass. Original RED tool output was truncated; preserve
the exact as-returned fragment, but do not claim full-original RED custody.
Initial GREEN76/0 and affected194/0 are full original outputs. Final195/0 adds
the observer's own recognizable CLI invocation and preserves its visibility.
External ps/lsof/native/DB observation ports remain inert in these owned source
fixtures; original source classifier and bracket are actual. Real private plutil
conversions do not alter installed launchers. This does not qualify whole
default bootstrap, live process death, actor drain, clean-main build or startup.
Final source0ca4ed07/test20ba341c; strict927/0 after the final test delta.

## Task4a.7.1: qualify actual configuration consumer imports

File Map: existing baseline-dashboard-cutover-configuration-refusal-v2.test.ts;
paired spec/plan. No production edit is nominated. Close the existing AST-body
qualification limit with actual complete consumer imports, not a new behavior.

- [x] Add8 denied full-module cases: writer/atomic/Medic install/uninstall under
  real private OPEN and unknown. Only bare JSON5 resolves to existing installed
  dependency bytes. Real guard/observer and consumer imports remain unchanged.
  Mutation, cron reads, child commands and network traps must stay untouched;
  writer/atomic caller proxies must remain unobserved.
- [x] Add2 known-absent actual writer/atomic controls creating new owned private
  files and asserting literal bytes. Add real-module serialization publishes
  OPEN and reaches zero atomic mutation. Retain private files; no host paths.
- [x] Focused33/0 and fresh proportional configuration/validation35/0/0SKIP;
  strict927-file readonly noemit0 diagnostics; version2.3.79/English1971/path985.
  Three independent exact-byte C0/I0/M0 reviews. Fresh preservation255/errors[]
  07:47:02UTC, unchanged8932f443 material manifest and original dirty files.
  Supplemental existing behavior, no missing-module/consumer RED credited again.
- [x] Scoped DRAFT test-only commit/push770bb2bb and exact-head GitGuardian
  SUCCESS completed07:50:49UTC. No actual Medic
  systemd/gateway, build, process control, PG or authenticated startup effects.

Task4b.2 delivery receipt:08d42876 committed/pushed clean to DRAFT PR280;
exact-head GitGuardian SUCCESS completed07:37:37UTC. Existing Task4b.2 delivery
checkbox is satisfied by this subsequent receipt; history is not rewritten.

Task4a.7.1 receipt: all11 added cases pass on first execution, as supplemental
qualification of unchanged production behavior. Full consumer modules and their
shared guard/observer/cache are real; only bare JSON5 resolves through the
existing installed dependency. Child-command/network traps are installed before
imports; filesystem mutation/private-cron traps before calls, not loader-cache
exclusion. Positive actual writer/atomic files have literal bytes and remain
private. Fresh35/0 includes2 existing validation controls; this test-only change
does not repeat the prior615-case reader/HTTP campaign or accepted PG/native
recipes. Initial33/0, final35/0 and strict927/0 original outputs retained in full.
Testb1c669c0; no production pin changes or full CLI/source-build/startup grant.

## Task4b.2.1: correct process-title bare alias false positives

Causal prerequisite: fresh actual source diagnostic incorrectly retains a real
PostgreSQL backend whose process-title metadata names the setfarm database.
Read-only comm/cwd/text metadata identifies the backend; no PG query or signal.
Choose a narrow generic title grammar, not a PID/PG blacklist or broad wrapper
allowlist. Unknown non-title wrappers and every strong path remain contenders.
This does not promote diagnostic absence into authenticated actor exclusion.

File Map: existing process-observation-v1.ts and its test; paired design/plan.

- [x] Add observed and generic title bare-alias negatives; actual exported
  observer must retain no extra family or disclose private metadata. Preserve
  bare direct/Node/options/env/shell/unknown-wrapper candidates and strong paths
  under title/unknown prefixes. Title changing to a real CLI must refuse bracket.
  Observe genuine RED before touching production.
- [x] Suppress later bare aliases only under the finite first-token title label
  grammar with no preceding nominated execution prefix. Use one cumulative
  pass; keep original starter promotion, daemon checks, schema and hash formulas.
- [x] Fresh affected process/launcher tests, strict existing-toolchain noemit,
  contracts, preservation255 and three independent exact-byte read-only reviews.
- [x] Normal scoped commit/push820776b4 to existing DRAFT PR280; exact-head
  GitGuardian SUCCESS completed08:13:06UTC;
  real informational rescan only, never loaded-source/drain/startup authority.
- [ ] Full authenticated transport/controller, original actor settlement,
  reviewed integration, clean-main build and real-host3333 acceptance remain.

Task4b.2.1 receipt: genuine110-case RED100PASS/10FAIL before production, each
failure an invented fourth family from bare title metadata rather than setup.
Full original40075-byte RED output retained; UI combined rendering truncation
was reread from the original result without rerunning. Initial GREEN110/0.
Reviewer bare unknown-wrapper gap closed with supplemental existing-behavior
case, no new RED credit. Fresh final process111+launcher118=229PASS/0FAIL/0SKIP;
strict927-file readonly noemit0 diagnostics. Version2.3.79/English1971/path985.
Three independent exact source/test/spec reviews C0/I0/M0; receipt-only plan
annotation follows. Source081c26ec/testa56e511b/spec ca3a8a34. Fresh original255
preservation08:10:20–21UTC errors[], material8932f443 and both dirty files
unchanged. Actual informational source rescan families[]/listener null, not
authenticated actor absence. MC/gateway200;3333 absent. No signal, PG query,
native replay, build, launcher/selector/ROOT effect or startup acceptance.

Task4b.2.1 delivery receipt:820776b4 committed/pushed clean to DRAFT PR280;
exact-head GitGuardian SUCCESS completed08:13:06UTC. PR receipt appended without
overwriting preceding body. This subsequent receipt satisfies its delivery box;
full adapter/controller/integration/startup obligations remain open.

## Task4g.0: closed transport-message data grammar before authenticator

File Map: create src/internal-production/baseline-dashboard-cutover-control-wire-v2.ts;
extend tests/internal-production/baseline-dashboard-cutover-records-v2.test.ts
(existing tests were NOT in the normal pure command); package.json explicit
test:internal-production:pure enrollment of existing records/store tests;
paired design/plan. Preserve all previous command entries and runtime guards.
Consumers: future actual authenticated native control channel; no live consumer
or fake authenticator is wired by this independently testable pure codec.
Interfaces: encodeDashboardCutoverControlMessageV2(unknown): Buffer;
decodeDashboardCutoverControlMessageV2(unknown): DashboardCutoverControlMessageV2.
Exact four-kind shapes and1..1024 byte/canonical rules are in Task4g.0 spec.

- [x] Write failing actual-code tests: each of four literal messages roundtrips
  to independent hand-derived canonical bytes/frozen inert data. Reject malformed
  kind/schema/scalars/field sets and caller record proxies/accessors. Ignore own
  Buffer properties; reject proxied Buffer/ancestry; test128/129 ancestry bound,
  deeper proxy chain and detached original bytes with fixed errors. Reject
  duplicate/noncanonical/malformed/oversized wire with fixed secret-free errors.
  Example oracle: decoded HELLO kind==='HELLO', exact5fields; no phase/owner grant.
- [x] Run the existing records test through readonly installed tsx; observe the
  new missing-module RED, not a fabricated native/provider qualification.
- [x] Implement descriptor-first closed record validation and owned bounded
  Buffer copy; canonical comparison on decode. Minimal encoder:
  `Buffer.from(canonicalJsonStringify(validatedData)+'\n','utf8')`.
  Never export a permission/capability, caller serializer or generic dispatch.
- [x] Fresh focused/affected record+store suites; strict readonly noemit, normal
  contracts, preservation255 and three independent current-byte reviews.
- [x] Normal scoped commit/push to existing DRAFT PR280; exact-head scanner.
- [ ] Native endpoint/peer/replay/resource-custody profile and foreground
  positive observation remain separate actual provider obligations, not codec
  success. No launchctl, Mach registration, native compilation, PG, selector,
  PID/listener or ROOT mutation; no clean-main build/startup admission.

Task4g.0 receipt: actual missing-module RED41cases14PASS/27FAIL before source;
all27 are the nominated missing control-wire module, not another dependency.
Full51647-byte original retained privately. Initial GREEN41/0. Review requested
explicit ancestry128 bound and new128/129/deeper-proxy/detached-storage controls;
two supplemental existing-behavior cases add no new RED credit. Initial fresh
affected74/0, strict931-file noemit3 typing diagnostics (uncredited). Correct
only the explicit never function annotation and test JSON record types; no
runtime validation or oracle changes. Fresh final affected74PASS/0FAIL/0SKIP,
strict931/0, version2.3.79/English1972/path986. Three final exact-byte independent
reviews C0/I0/M0, receipt-only annotation follows. Source9f7a40e9/testba3ee311/
specdd8aac3f. Preservation255/errors[]08:28:27–28UTC, unchanged8932f443 material
manifest and both original dirty files. Decoded GRANT remains inert DATA; no
native protocol/endpoint, replay/freshness, phase, exclusion or startup credit.

Causal enrollment correction: actual package inspection disproved the earlier
already-enrolled assumption. Normal npm test delegates to internal-production,
then to its explicit pure command, which omits BOTH existing records/store
files. Append those two paths without altering earlier entries or launching the
unqualified full campaign. Their real focused/affected74/0 is the proportional
execution check; inspecting command enrollment is not an extra production RED.
This root refinement is source/test delivery work in the same approved goal.

Final enrollment receipt:package26c13305/spec45329049 reviewed independently by
all three reviewers C0/I0/M0; source/test pins unchanged. Exact actual command
prefix retained, only two paths appended. Run those package-selected paths with
the actual Node --test runner and readonly existing loader/dependency resolution:
74PASS/0FAIL/0SKIP, original subprocess status0/signal null/error null. The full
unqualified campaign remains unexecuted. This does not promote the pure codec
into transport, endpoint, replay, peer-birth or startup authority.

Task4g.0 delivery3015845d3bfd9d1587d1f07b4ecd86030389dee7 pushed; exact-head
GitGuardian SUCCESS08:37:23UTC, writer clean, PR280 OPEN DRAFT. Fresh precommit
preservation255/errors[]08:37:17UTC unchanged8932f443 and both dirty originals.
Actual freshly fetched PR body appended (31311bytes), not overwritten. No goal
currently stored (fresh get_goal null); no fake complete/blocked status.

## Task4g.1a: actual closed local audit mechanics

Spec: paired Task4g.1a. File Map: new scripts/dashboard-cutover-mach-audit-v2.c
and scripts/__tests__/dashboard-cutover-mach-audit-v2.test.js; paired docs only.
Consumes copied1..1024 Uint8Array bytes, installed public Node-API8/SDK/BSM;
produces frozen DATA from observeLocalMachAuditV2(bytes), not a capability.
No independent implementation writer; root implements, three agents RO review.

- [x] Write actual native addon behavior tests first. Missing nominated source
  must fail independently of CLT/setup; no fabricated peer/owner qualification.
  Literal payloads1/2/3/4/1024 must return equal copied bytes and actual current
  process.pid/euid plus positive pidversion. Invalid0/1025/nonbyte/shared/proxy
  inputs must cause zero native acquisitions; valid input after invalid succeeds.
- [x] Observe missing-source RED before production C authoring. Then implement
  one closed local operation: input copy, atomic attempt, retained R/S occurrences,
  one simple send, one audit receive, validate trailer, once-drop S then R, output.
  Example invariant: close S unknown => no close R and no second allocation.
- [x] Build fresh private test artifacts using fixed public compiler argv and
  individually nominated -U NAPI imports; actual linked imports inspected.
  Run SETFARM_DASHBOARD_MACH_AUDIT_TEST=1 node --test
  scripts/__tests__/dashboard-cutover-mach-audit-v2.test.js. Normal script glob
  only skips this separate native qualification; no default build changed.
- [x] Test-owned actual-call wrappers inject malformed header/trailer, receive
  result loss, S/R close uncertainty and swallowed concurrent burn; zero later
  admissions after witnessed unknown/burn. An already-admitted call may finish
  and seal; no instantaneous OS revocation or general worker proof. Retain
  full outputs and new private artifacts. Mark-only watchdog, no runner kill.
  Actual setter RED must independently observe trap count, not generic refusal.
- [ ] Independent exact-byte code/provider/custody review; focused suites,
  source contracts, preservation255, scoped commit/push/scanner and draft receipt.
- [ ] Remote native endpoint/peer birth/source/build/replay/phase authentication,
  real controller/foreground CLI and host3333 acceptance remain unqualified.
  This local diagnostic does not grant live effects or change existing services.

Task4g.1a actual receipt: missing-source12/0PASS before C authoring; first native
attempts macro collision, symbol-parser digits and omitted SDK-fortified memcpy
symbol are UNQUALIFIED setup failures, no native protocol RED. Correct only
test-copy wrapper/parser and nominate the public libSystem fortified symbol from
installed SDK secure/_string.h and libsystem_c.tbd. Keep those artifacts/originals.
Fresh real native behavior15cases12PASS/3FAIL: two inherited-setter trap counts1
versus0 (result after all6native events; export zeroMach); frame-burn extra send.
Minimal own napi_define_properties and fresh ACTIVE operation admissions fix;
fresh15/0 GREEN. Two supplemental uninstrumented-source and getter-offset controls
add no new RED credit. Final fresh17PASS/0FAIL/0SKIP, including actual pristine
production C bytes compiled/loaded;8instrumented+pristine owned fresh artifacts.
Exact2NAPIexports,2libSystem/libbsm dependencies and finite public imports checked;
264postcompile include records per artifact are diagnostic, NOT pre-held closure.
Native C warning-as-error build is the proportional actual build/smoke here;
no default npm build, optional production builder or selected CLI build credited.
Fresh related record/store74PASS/0FAIL/0SKIP; normal native-disabled runner skips17
with zeroCLT/native use (not a GREEN claim). Contracts2.3.79/English1973/path987.
Three final exact-byte independent reviews C0/I0/M0 on C760f57c4/test66167c99/
specbfa5956b/planf4840159 before this receipt-only annotation. Postnative fresh
preservation255/errors[]09:14:06UTC unchanged8932f443, originaldirtyfiles and
acceptedTask6A/PG evidence. No bootstrap/launchd/selector/ROOT/PID/listener/PG
mutation; local diagnostic only. Full remote adapter/controller/startup pending.

## Task4g.1b: retain own-generation finalized source/build proof

Spec: paired Task4g.1b. File Map: scripts/build-generation-retention.mjs;
scripts/__tests__/build-generation-retention.test.js; paired design/plan.
Consumes the private holdFinalizedSetfarmSourceBuildAtRootV1(root,true).
Produces zero-argument holdCurrentFinalizedSetfarmSourceBuildV1() -> frozen
{observation,recheck,close}, with the exact existing filesystem proof/semantics.
It supplies the own-generation retained input needed before native sidecar work;
it does not qualify sidecar, loaded runtime, ownership or live startup.

- [x] Add export inventory and actual-fixture behavior tests before the export:
  held originals through await, independent own root, zero ports for invalid
  arguments, sticky source/output drift and once-close loss safety. Use existing
  createFixture/writeFinalizedRuntimeDist and independently expected hashes.
- [x] Run `node --test --test-name-pattern='current finalized|held current|imports the operator' scripts/__tests__/build-generation-retention.test.js`.
  Missing export must cause assertion failures, not unrelated fixture errors.
- [x] Implement only the zero-input bridge:

  ```js
  export function holdCurrentFinalizedSetfarmSourceBuildV1() {
    if (arguments.length) fail("current finalized source/build holder takes no arguments");
    return holdFinalizedSetfarmSourceBuildAtRootV1(repositoryRootV1(), true);
  }
  ```

- [x] Run affected current/selected holder tests, syntax/version/English/path/
  diff checks. No native tools, deployment build or historical recipe replay.
- [x] Independent read-only exact-source/test/docs review; resolve findings,
  rerun affected checks, scoped commit/push and fresh exact-head PR scanner audit.
  Record receipts without claiming whole PR, clean-main or dashboard acceptance.

Task4g.1b actual2026-10-08 receipt: before export,21cases12PASS9FAIL
(eight public missing-export consumer assertions plus exact export inventory).
First21/0 GREEN. Independent review found a supplemental preimport cwd/env test
gap; root moved those inputs before actual import without new RED credit.
Fresh broader current/selected source/build44PASS0FAIL0SKIP18.1407s; syntax,
version2.3.79/English1973/path987/diff checks pass. New own-holder private fixtures
remain retained. Full tool originals saved outside Git in root logs; no raw PG
or accepted native recipe read/replay. Normal build/package/default runtime and
all existing deployments/services remain unchanged. Native builder/loader,
remote transport, controller/freeze and real dashboard startup remain pending.

Task4g.1b delivered0ae28dcb6011046886e07f8fd717c2504f9999a3; final supplemental
guarded-dist44/0 actual18.2191s and two final exact-byte C0/I0/M0 reviews.
Exact-head GitGuardian SUCCESS16:24:02UTC; fresh PR280 body append6e2dca34654bytes,
OPEN DRAFT. Own-generation source proof delivered, not clean-main/live acceptance.

## Task4g.1c: actual closed two-birth Mach echo mechanics

Spec: paired Task4g.1c, including3new-job maximum and retained diagnostic scope.
File Map: scripts/dashboard-cutover-mach-peer-v2.c; its builtin JS test; paired
docs. Input is copied intrinsic bytes1..1024 only. Two native exports
observeControllerMachPeerV2(bytes), observeClientMachPeerV2(bytes) -> frozen
DATA{bytes,euid,pid,pidversion}. No effect/startup grant. Actual provider is the
separately owned declared MachService, not ambient registration or socket metadata.

- [x] Add opt-in actual tests: pristine invalid-input zero-port control, crossed
  original-PID positive pair/copy/once-only controls, server/client malformed-header
  refusal and literal no-later-port traces. Compile new copies only; owned scripts
  publish only fixed receipts. No historical native fixture or live job used.
- [x] Run opt-in missing-source assertions before C authoring; missing C must
  refuse before compiler/job effects. Setup/import errors do not earn behavior RED.
- [x] Implement bounded C11 vault/FSM, fixed-service check-in/lookup, header reply
  SEND_ONCE exchange, checked kernel audit and occurrence-specific disposal.
  Use the existing local audit's actual intrinsic-validation/public ABI pattern,
  but do not reuse its self-peer qualification as remote proof.
- [x] Exact source/runner/recipe independent RO review BEFORE new actual jobs.
  Fix findings, then one separately reviewed opt-in invocation:
  `SETFARM_DASHBOARD_MACH_PEER_TEST=1 node --test scripts/__tests__/dashboard-cutover-mach-peer-v2.test.js`.
  At most3newjobs; no retry/kill/bootout. Retain partial/unknown job/artifacts.
- [ ] Verify actual paired receipts/PIDs, native traces and exact imports/exports/
  deps. Run affected portable tests/contracts; independent final review and scoped
  PR delivery. Native echo GREEN is not source/build/owner/freeze/controller or
  real3333 acceptance. Sidecar builder/loader and full adapter remain next work.

Task4g.1c actual first invocation2026-10-08T16:40UTC: missing-source assertions
4FAIL0PASS before any compiler/job. Three initial RO reviews; one found command
retention, timeout-satisfiable fault oracle and inherited job-environment gaps.
All fixed BEFORE actual native/job invocation and exact updated recipe approved.
Native4PASS0FAIL0SKIP3.9767s; no setup failures/retry. Pristine production C bytes
compiled/loaded zero-service-input control. Actual pair67120<->67121/uid501,
positive pidversions and1024 copied bytes, literal native traces. Each malformed
header test has explicit post-SUCCESS injection witness and no later native call;
client-fault server receipt succeeds and cross-binds client PID.
Six fresh binaries/exact2NAPIexports+2libSystem/libbsm paths checked. All four
private directories and three newly owned launchd job intents/receipts retained;
no bootout/kill/restart/existing-job change. Native own occurrence settlement is
scoped to successful DATA; no job/ad/exclusion/unknown-fault disposal certificate.

Preservation audit separately found the historical private PG transcript.journal
absent at its recorded path (its parent/data remains). No deletion/recovery/replay
was performed or provenance inferred. Do NOT credit the old255 gate as current.
Both original dirty files' bytes/inodes and selected CLI link remain unchanged.
This historical Task6A receipt gap is not a universal prerequisite or permission
for the new independent closed echo recipe; full Task6A/live acceptance stays open.
