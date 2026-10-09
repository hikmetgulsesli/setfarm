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
- [x] Verify actual paired receipts/PIDs, native traces and exact imports/exports/
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

Task4g.1c delivery:c6e838ee committed/pushed, exact-head GitGuardian SUCCESS
16:46:08UTC, fresh retained PR280 body append387069/36444bytes. Two final
exact-byte C0/I0/M0 reviews independently inspected31 command results and actual
paired receipts. Native-disabled21SKIP is not extra native GREEN. Whole PR is
still OPEN DRAFT; no clean-main build or dashboard3333 acceptance.

## Task4g.1d: retained direct native inputs

Spec: paired Task4g.1d. File Map: new
scripts/dashboard-cutover-native-inputs-v2.mjs, matching builtin test and
scripts/__tests__/helpers/dashboard-cutover-finalized-fixture-v2.js; paired docs.
Consumes genuine own finalized holder and fixed profile/direct files; produces
zero-arg holdDashboardCutoverNativeInputsV2()->frozen{observation,recheck,close}.
Observation authority is direct-inputs-only, never startup or full provider proof.
Root implements; same-model agents independently investigate/review read-only.

Ruling: separate direct-input custody from full builder/loader — actual clang
exceeds existing reader cap and Node/ld have non-system dynamic dependencies;
a whole-buffer shim or filename-only loader would misstate provider evidence.
This slice genuinely holds/hash-checks original files, without compiler/jobs.
Remaining include/dynamic provider/loader obligations stay explicit, not waived.

- [x] Write missing-export/source RED actual consumer tests. Use genuine new
  clean-main/finalized own fixtures, relocated fixed providers only in test copies.
  Literal observation oracle: authority==='direct-inputs-only', ten direct files,
  expected C/file SHA independently computed from original fixture bytes.
- [x] Run `node --test scripts/__tests__/dashboard-cutover-native-inputs-v2.test.js`;
  missing production module must fail before compiler/native effects.
- [x] Implement activity/custody vault, fixed profile, real source/build holder,
  physical original direct files/ancestors and bounded positional streaming.
  Minimal streaming step:
  `readSync(fd,block,0,Math.min(65536,size-position),position)`;
  reject partial/zero/oversized reads, check metadata before/after and hash originals.
- [x] GREEN actual retained fixture cases: invalid arity/profile zero ports;
  cwd/env independence; dirty/nonmain/stale build refusal; symlink/hardlink/mode/
  file-boundary rejection; streaming cap/short-read; file/ancestor ABA; activity
  reentry/active close; sticky refusal and once-close/reusedFD unknown retention.
- [x] Independent exact source/test/spec review before opt-in actual acquisition.
  Run one `SETFARM_DASHBOARD_NATIVE_INPUTS_TEST=1 /opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/dashboard-cutover-native-inputs-v2.test.js`.
  Only NEW owned genuine fixture and real direct-file reads, no compiler, load,
  native/Mach/launchd/PG, .setfarm creation or existing installation change.
- [x] Fresh affected suites/contracts/diff; final independent exact-byte review,
  scoped commit/push/scanner and PR receipt. No normal build/main acceptance claim.
- [ ] Full optional builder/include alias closure, dynamic provider nomination,
  genuine private native loader, capability/freeze/controller/foreground CLI and
  actual3333 acceptance remain separate incomplete obligations.

Task4g.1d actual receipt2026-10-08: missing-source21FAIL before source/fixture
effects. Initial pretty-BUILD_INFO/child syntax/transient-close oracle failures
are UNQUALIFIED setup defects, not provider/native RED. Actual new close-reentry
count6054c0 witnesses64vs1 before per-revocation correction; actual review29b351
threeFAIL witnesses writable CLT intermediate acceptance and reused-FD64vs0.
Root fixed common CLT anchors/upgrades and original-extra-FD preclose identity.
Source/build composite semantics unchanged and explicitly scoped in spec.

RO actualprofile caught /usr/bin/nm/otool nlink78 shim BEFORE actual acquisition;
replace nomination with physical root0755,nlink1 CLTllvm-nm/llvm-otool, not guard
relaxation. Fixture providers now new sibling outsideROOT; broad FS/Git zero-port
spies and preimport cwd/env. Fixture Git environment/config/hooks/fsmonitor fixed.
Three cap supplements earn no new behavior RED; fake512MiB FS size/read ports
exercise real loop without GiB artifact; deep physical directories hit256 cap.
First capsule off-by-one expected248vs249 corrected independently: five own
parents+C+siblingroot=7,256-7=249. No production cap change or hidden failed test.

Final portable444d07+723de2:28PASS/0FAIL/1SKIP15.6682s. Three exact code/recipe
RO reviews before actual, final capsule gates C0/I0/M0. SINGLE nominated actual
ca7efe+40d0c8:29PASS/0FAIL/0SKIP16.9273s. Genuine new fixture
/private/tmp/setfarm-native-inputs-v2.o3EO3d retains real10 direct inputs,
329,011,978 bytes, sourceC228be6c7 and own synchronized/finalized fixture build.
Originals held through await/recheck then once-close;175 tracked opens/closes
include genuine verifier transient reads, NOT175 extra native inputs.
All new roots/provider siblings/previous-fixture-dist/result receipts retained.
Root independent read ed7dc1 agrees10 inputs/source/profile/receipt/status0.
No compiler/native load/Mach/jobs/PG/.setfarm creation, deployment/default build
or current loaded image qualification. Node/@rpath/ld dynamic deps and full
includes still unqualified; actual recipe does not run the oldnativecampaign.

Delivered Task4g.1d: root0a54a099 scoped commit/push, exact GitGuardian SUCCESS
17:29:16UTC86574e; two final exact-byte C0/I0/M0 reviews; PR280 stays OPEN DRAFT.
Append031356 preserved37995byte body, SHA3b8c8bf44e661683f2c8b4d314e0e58491d64e51c9af21111a501d9f35420c6a.

## Task4g.1e: closed compiler discovery and retained headers

Spec: paired Task4g.1e. File Map: new
scripts/dashboard-cutover-native-build-inputs-v2.mjs and matching builtin test;
paired docs only. Consumes genuine direct holder, fixed physical clang and own C;
produces zero-arg async prepareDashboardCutoverNativeBuildInputsV2(), private
frozen observation/recheck/close context. Compiler-dependencies-only DATA, not
build/load/loaded-image/startup authority. Root sole writer, RO reviewers.

- [x] Write actual consumer tests BEFORE production: missing module refuses
  before fixture/compiler; genuine owned source/build, fixed relocated sibling
  providers, original headers across await, declared alias identity; literal
  recipe/source/env oracle; malformed/foreign/duplicate/escaped dependencies,
  second-graph mismatch, writable/symlink/hardlink/short-read/ABA/reentry/unknown
  child/FD close, size/count/output caps and sticky zero-later-spawn refusal.
  Spawn-return reentry oracle: admit original child/pipes before post-spawn burn
  checks, no source pipe write or second spawn after swallowed revocation.
- [x] Run `node --test scripts/__tests__/dashboard-cutover-native-build-inputs-v2.test.js`
  and retain complete missing-source RED output. Production not yet present.
- [x] Implement one private module vault, genuine direct context, bounded own-C
  copy, fixed recipe and once-admitted async child/pipe event ledger. Await
  `discover('provisional')`, hold validated originals with separate512FD cap,
  await `discover('held-validation')`, compare sorted lexicalsets, recheck.
  Reject all unknowns; never kill/destroy/retry or expose raw originals.
- [x] GREEN portable consumer cases; root self-review and independent exact
  source/test/spec/actual recipe reviews before any new real compiler execution.
- [x] Single opt-in actual command:
  `SETFARM_DASHBOARD_BUILD_INPUTS_TEST=1 /opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/dashboard-cutover-native-build-inputs-v2.test.js`.
  New own fixture only; real fixed compiler two planned stdout discoveries, no
  object/addon/native load/launchd/PG/.setfarm/default build/service mutations.
- [ ] Fresh focused affected suites/contracts/diff, actual original receipt
  inspection, final RO exact-byte review, scoped commit/push/scanner/PR receipt.
  No normal build/main/3333 credit. All full capability/freeze/CLI obligations
  remain required by the parent plan after this separately reviewable slice.

Task4g.1e preactual receipt2026-10-08:07fc34 genuine missing-source26FAIL1SKIP
before fixture/compiler effects. Firstportable9e483b+0f1b31+751d0d26PASS/0FAIL/
1SKIP36.551s. Two RO reviews caught killing outer timeout/maxBuffer and absent
raw compiler command/pipe results BEFORE any actual compiler invocation; root
fixed test-only outer runner, no source guard change. New once-admitted actual
intent/returned child/pipes/raw bytes/events are emitted in finally, sibling
result persists before assertions. No-kill/cancellation credit from fixture exit.

Supplemental caps/lifecycle cases were added after initial source and earn no
new behavior RED. Two oracle-error rounds3e68d2+7867e6 and5fd612+f8518c retained
all roots/results: mid-close FD selection allowed14 earlier proven closes;
nochild-close had naturally closed pipes; creation/truncate opens contaminated
acquisition counts; one-root depth remained below512; historical numeric FD
closes included verifier transients. Root corrected independent oracles, active
occurrence spies and384-multi-root graph, never altered source79071e6b/caps.
Fresh fullportable1945c6+daca49:41PASS/0FAIL/1SKIP59.0091s. RO then strengthened
385-path oracle with zero named-header lstat queries so nonexistent files cannot
mask a removed count guard. Focus rerun required; actual invocation still gated.
Version2.3.79/English1979/path993/syntax/diff97eaa7 pass. Original two file SHA
unchanged; MC2d8d73=200/gatewayffdf08=200/333383665d=curl7/000.

Task4g.1e SINGLE actuale194a7+e598ce+bec444 at18:02UTC:42PASS/0FAIL/0SKIP
62.810183292s. Finalcountfocus1b7997=1PASS; valid stdout overflow and stderr
prewatchdog/nochildclose fc91aa+c79444=2PASS/0FAIL2.040475s. Two final preactual
RO gates C0/I0/M0 exact source79071e6b/test4c5a1550/spec10df994a/plan4b6d7cc7.
No actual setup failure/unknown acquisition or compiler retry in this invocation.

Actual new genuine fixture /private/tmp/setfarm-native-inputs-v2.SRoXqu and
sibling.build-inputs-result.json retained (187983B,SHAe8f2a53410c2420fd0eed17ff5341797e3c5e0cda519129ea535db7bf2c74900).
Fixed physical clang produced two24243B stdout originals with identical SHA
11ceabfb32853ea5375de5bc804ce61a084f59f8ed0626076fb7d804d02d4fdc;
zero stderr, actual stdin finish/close, both output end/close, child code0/no
signal/error. Exact C228be6c7 copied to both original stdin occurrences.268
distinct physical header originals2345321B, only declared bootstrap alias;
817opens/817closes INCLUDE genuine verifier transients and direct custody,
NOT817 include pins. Fullactualcase4.1494s; no .setfarm/object/native/Mach/jobs/PG.
Root independent receipt d48900 compares original bytes/graph/events/hash and
source/build tuple38e05378/c36a6088/601826b1; genuine FIXTURE main/origin proof,
NOT production clean-main build. Source/test unchanged; no provider override
in actualfixture. Related direct28/0/1SKIP15.7295s and original-source44/0/0SKIP
18.0735s fresh e9a902+6d4610/d3958b+a3e6c4. WholePR remains draft, no3333 credit.

Delivered4g.1e root358249e4f71a12df0939f3113f52811e861630ed/21cfea, normalpush
015185+0c7dde; two final exact-byte C0/I0/M0 independently parse actualreceipt.
PR425735 appended39947B/SHA8c21c2877deddbb57188042cf8d8d85c18d5afa3254dc9aec806d7fd7584422e,
exact358 GitGuardian SUCCESS18:06:35UTC d2eb18, OPEN DRAFT/reviews[]. No fullbuild.

## Task4g.1f: optional compile/link and inspected terminal sidecar

Spec: paired Task4g.1f; causal continuation of delivered original compiler/header
custody. File Map: new scripts/dashboard-cutover-native-sidecar-v2.mjs and
matching builtin test; paired design/plan. Existing holders/C/helper/package/
dist/CLI/services unchanged. Root sole writer; RO independent reviewers.
Consumes genuine transient own build and genuine async header preparation;
produces zero-arg async prepareDashboardCutoverNativeSidecarV2() frozen
{observation,recheck,close}. DATA only, no loader/startup/wholeprovider certificate.

- [x] Write consumer tests before source with literal recipe/original byte and
  manifestation oracles. NEW genuine finalized own Git fixtures, fixed providers
  relocated only in copied test modules. Missing production module asserts
  before fixture or any build effects. Simulated external children create only
  NEW fixture output; keep real original FS/Git/header guards and stream events.
- [x] Run `node --test scripts/__tests__/dashboard-cutover-native-sidecar-v2.test.js`;
  preserve complete missing-source RED. Do not label malformed fixture setup,
  compiler/link failure or oracle defects authenticated transport RED.
- [x] Implement original activity/effect vault and fixed profile. Sequence:
  `preflight=observeCurrentFinalizedSetfarmSourceBuildV1()`;
  one original async fixed Git check-ignore child (own argv/env, all pipe/child
  events; empty outputs, close0/null); repeat/compare genuine transient preflight
  after Git BEFORE first mkdir; then validate/bootstrap0700ignored parents and
  retain actual bootstrap directory originals BEFORE header await;
  `inputs=await prepareDashboardCutoverNativeBuildInputsV2()`; compare tuple;
  hold six physical link inputs and bounded C; exclusive generation and own
  exclusive0700provider-tmp, command TMPDIR there;
  compile→hold/validate Mach-O and exactdepgraph→nm imports→nm exports→otool deps;
  exclusive original manifest write/fsync→planned0444terminalization→rehash/recheck.
  Record every fsync original FD/phase/intent and returned/unknown disposition.
  Link files root-or-actualUID physical policy, own ROOT/output actualUID only;
  exact bare dyld_stub_binder exception, never arbitrary bare symbol/alias.
  Require provider-tmp original empty at success boundaries and exact generation
  inventory. Validate literal ARM64_ALL subtype0 plus all aligned bounded Mach-O
  load commands and exact traversal. Serialize manifest <=256KiB BEFORE open;
  independent content-binding tests. No defaultbuild or load; four builder children
  PLUS separate Git preflight, sticky unknowns retain admitted/still-present effects.
  Trusted driver delegation/temp cleanup/failure-result removal is not universal
  descendant settlement or custody of provider-removed results; builder never cleans.
- [x] GREEN portable negative/positive consumer cases and independently reviewed
  exact fixed actual recipe. Never soften direct256/include512/source/zero-owner
  runtime gates; additional128FD/512MiB/1GiB link budget separately scoped.
- [x] SINGLE opt-in actual new fixture:
  `SETFARM_DASHBOARD_SIDECAR_TEST=1 /opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/dashboard-cutover-native-sidecar-v2.test.js`.
  One Git preflight plus two header discovery and four builder/inspection children;
  seven composed NEW child occurrences, legacy composite semantics unchanged; installed
  fixed compiler/tool providers only. New ignored private fixture generation,
  no native evaluation/Mach/launchd/PG/service/defaultbuild/install mutations.
  Record original intent/argv/bytes/stream+child results before assertions; raw
  parent results retained outside pinned fixture, no cancellation/retry.
- [x] Fresh focused affected suites, source syntax/version/English/path/diff,
  independent actual receipt/output/source/manifests review; scoped commit/push,
  exact scanner and preserved PR receipt. Keep full loader/authenticated transport/
  freeze/controller/CLI/clean-main/3333 obligations open after this bounded slice.

Task4g.1f verification: missing-source29RED; reviewer-found source/Git-await and
original-bootstrap/header-await REDs before their fixes; narrow ABI/name-only nm
RED before parser fixes. No credit for malformed/oracle/setup failures. Frozen
portable64P0F1skip299.072s; ONE actual65P0F0skip311.197s (actual15.537s), original
7child/pipe close0/null/zeroerrors/stderr,9673BC228be6c7,268headers; terminal
bundle35784B/depfile24243B/manifest91932B all original0444, exact inventory and
original0700empty temp. Affected337P0F2skip475.199s; syntax/contracts/diff pass.
Actual fixture own source/build is not current main or loaded-code authority.
Original receipts and failed fixtures retained privately; delivery/scanner/PR
receipt remains the last checkbox until actual results, not a completion claim.

Delivered4g.1f8cdf0c8da36fadc6a057a26353e77e96dc2bc268, root2a4736 normalpush
6bcf0f→88d6d9; finaltwo exact4fileC0/I0/M0 plus three independent actual reviews.
Preserved PRbody39947→41921B SHA53ced10329cac49dbce61b8e2fe27893334123112dce2d791e059722a434aa0b,
2387c6; exact8cdf GitGuardianSUCCESS19:15:54UTC, OPEN DRAFT/reviews[]. No main/
loader/startup credit. Last checkbox now proven, prior pending text historical.

## Task4g.1g: bounded four-frame native mechanics DATA

Spec: paired Task4g.1g; causal missing distinct-message/live-session root gap.
File Map: modify scripts/dashboard-cutover-mach-peer-v2.c and matching builtin
test; paired docs. Root sole writer; parallel workers RO reviews only. Fixed C
path keeps existing holders' dynamic source hash binding; no selectable fork.
V3-only native API/service explicitly supersedes old echo, old artifacts retained.
No default package/build/CLI/PG/launchd/service/deployment mutation.

Consumes fixed public Node-API8/CLT/SDK, genuine kernel Mach/BSM ports. Produces
receiveControllerHelloV3() -> frozen{bytes,euid,pid,pidversion};
challengeControllerAndReceiveAckV3(bytes) -> same copied DATA;
sendControllerGrantV3(bytes) -> frozen{} terminal DATA;
helloClientAndReceiveChallengeV3(bytes) -> copied peer DATA;
ackClientAndReceiveGrantV3(bytes) -> copied peer DATA, terminal.
All native refusal DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED. No startup capability.

- [x] Add actual compiled pristine consumer before C changes:
  ```js
  for (const [name,args] of [
    ['receiveControllerHelloV3',[null]],
    ['challengeControllerAndReceiveAckV3',[new Uint8Array(0)]],
    ['sendControllerGrantV3',[]],
    ['helloClientAndReceiveChallengeV3',[new Uint8Array(0)]],
    ['ackClientAndReceiveGrantV3',[new Uint8Array(0)]],
  ]) {
    assert.equal(typeof addon[name],'function','missing four-frame native method '+name);
    assert.throws(()=>addon[name](...args),e=>e.message==='DASHBOARD_CUTOVER_MACH_CONTROL_REFUSED');
  }
  ```
  Run ONE nominated initial RED only:
  `SETFARM_DASHBOARD_MACH_PEER_TEST=1 /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='four-frame native consumer' scripts/__tests__/dashboard-cutover-mach-peer-v2.test.js`.
  New pristine fixture only; compile/inspect original source then real Node,
  absent method before any native acquisitions/jobs. Preserve raw originals;
  classify setup/compiler/load/capture failure unqualified, never transport RED.
  Actual1c6c23 initial API RED retained ROOTuxvW35; five original commands,
  missing receiveControllerHelloV3 before invocation. Compiled matrix amended
  old-source REDe80b2a ROOT5Dvz13: five commands, actual two old exports vs five
  required V3 exports before native calls. Prior matrixd0de5f ROOTUbpglz one
  compiler command was test-only indentation setup failure, not RED. All retained.
- [x] Add test-owned Mach/BSM doubles prefix, literal different4payloads,
  exact native boundary traces and separate original buffer addresses. Default
  tests opt-in SKIP, no source-text-only tests or production fixture switches.
  Run compiled actualC/Node-API under doubled kernel ports; require controller
  receive→challenge/send+ack/receive→grant/send+Rclose and client lookup+Qallocate
  →hello/send+challenge/receive→ack/send+grant/receive+Qclose+Sclose. Check first
  copied result unchanged after second exchange, no caller buffer alias, methods
  immutable, wrong-stage/role/reentry/terminal calls zero later kernel ports.
  Malformed second frames and changed pidversion must refuse before final sends.
  Separate SETFARM_DASHBOARD_MACH_CONTROL_PORT_TEST=1 only, one4-command artifact
  plus<=36fresh Node consumers,<=40commands/0jobs. Reject mixed campaign flags
  before effects. Kernel/BSM and one post-success freeze-burn boundary only,
  never claim exhaustive Node-API-failure injection.
  Independent four bounded frame-memory snapshots checked before later kernel
  ports; BSM accessor traces verify admission order. Existing intrinsic NAPI
  forwarding wrappers capture only current synchronous caller input, reset at
  next entry/result freeze, and fake ports mutate it to exercise real preclaim
  copy isolation. Five kernel success-return and one real-success-freeze cases
  call actual ACTIVE controller entry before null-info inspection, clear only
  the test-observed fixed refusal, then return original provider result. No new
  production imports/exports/fixture knobs. Foreign env remains unqualified.
  Reviewer-found intrinsic-unknown root path: nominate one forwarded real
  get_cb_info one-shot generic failure after HELLO within existing36consumers;
  fold invalid-input oracle into positives. Run functional RED before fix;
  same valid continuation must refuse first, not be masked by a wrong-stage
  retry. Split non-napi_ok -> burn from successful invalid shape/arity -> refusal.
- [x] Implement bounded atomic role/stage/original-env vault, four immutable
  frame slots plus original R/Q/S/T_HELLO/T_ACK occurrence states. Typed input
  copy before first CAS; returned effect seal before burn. HELLO/ACK COPY_SEND S
  + MAKE_SEND_ONCE Q; CHALLENGE/GRANT MOVE_SEND_ONCE respective returned T. Keep
  original endpoint custody across JS boundaries, opaque independent length and
  exact header/trailer validation, same original peer tuple twice, terminal
  disposal ordering. Preserve13NAPI imports and two Mach-O registration exports.
  Normal kernel/BSM/post-reservation success-publication ports require ACTIVE;
  preclaim intrinsic input checks and bounded fixed refusal publisher are the
  only explicit exceptions. Refusal exception admits no further kernel work.
- [x] Run focused compiled fake-port GREEN and negative matrices covering each
  acquire/send/receive/close uncertainty and successful-return burn, input shape,
  copied bytes, source-owned stage/publication. No automatic cleanup or retries.
- [x] Review SINGLE new real campaign before invocation: up to3NEW retained
  private jobs (success/controllerACKfault/clientGRANTfault), finite capture/
  mark-only watchdog, each original compiler/Node/launchctl receipt before
  assertions, no cancellation/bootout/reuse. Independent kernel births and
  all4distinct payloads/trace/right states must agree; job bootstrap alone and
  natural child death are not resource/public-service settlement certificates.
  Separate SETFARM_DASHBOARD_MACH_CONTROL_REAL_TEST=1 only,<=31commands including
  the5-command pristine consumer,<=3jobs, unchanged40command ceiling/20s mark-only
  watchdog/2MiBcapture. Never run under initial RED or fake-port flag. Fixed5s
  native timeout remains fail-closed; later phase5 integration must qualify its
  finite timing budget, not skip phase5 after timeout.
- [x] Requalify changed C via ONE fresh genuine closed sidecar fixture with
  unchanged literal providers/guards and alloriginal recipes/bytes/events.
  Focus direct/header/source and purewire regressions; syntax/contracts/diff;
  final independent reviews required before scoped delivery below.
  Keep actual loader/authentication/finite freeze/owner-phase/controller/CLI/
  clean-main/live3333 required outcomes open. Do not borrow old1f C qualification.
- [x] Complete final exact-byte independent reviews, root scoped commit/push,
  exact-head scanner and preserved DRAFT PR delivery receipt. This is not merge
  or whole-goal completion.

Task4g.1g actual qualification: C2d5698bd/teste1fbed5b; APIabsent RED1c6c23/e80b2a
before implementation; setupd0de5f notRED. Held intrinsic unknown revival RED
d945f8 before ARG_PORT fix, failed originals retained. FakeGREENd7df7a→850307
36consumers40commands/0jobs1758.308ms; reala9dbfb→5075c1 4PASS/0FAIL/1SKIP
3344.763ms31commands3new retained jobs, positive33166↔33167/uid501/positive
versions and four different frames; successful-second-receive ACK/GRANT header
faults admit no later native ports. All40/31originalresults independently read
0/null/completecapture/nounknown/watchdog. New-Csidecar1a9202→e8f1f4 ROOTZUoeY7
1PASS14979.014ms,7qualifiedcommands/three13573B2dstdin/268headers, original0444
bundle36008B1a98fa8e/dep24243B11ceabfb/manifest91935Bb2d9f576/exactinventory.
Parent16a038bc andinnerdbd82caforiginals preserved. Fixture source/tree/build
notproductionmain. Focused direct/header8PASS4997.507ms; control-wire29PASS
438.671ms using existing canonical tsx4.22.4 loader, initial absent-local-tsx
setup not product failure. Syntax/version/English/path/diff pass. Finaldelivery
proved in bcf1f84 with exact-head scanner SUCCESS and preserved PR280 body;
no loader/phase6/CLI/clean-main/live3333/full-project credit.

## Task4h.0: source-integrated local invocation admission and drain

Spec: paired Task4h.0 below. Causal need: the existing ordinary OPEN and protected
path assertions cannot retain already-entered new-version invocation originals.
This slice supplies an actual monotonic local gate, not another observed count.
It is independently useful source hardening; legacy, other-process, queued
unregistered, child/backend/effect settlement and full adapter proof remain open.

File Map: create src/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.ts
and tests/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.test.ts;
modify installer/openclaw-config.ts, config-schema.ts, uninstall.ts,
worktree-ops.ts and medic/medic-cron.ts. Update existing configuration-refusal and
platform-cleanup AST-selected consumer fixtures to bind the genuine new module,
not identity wrappers. Preserve full imported consumers and all original guards.

Interfaces: withDashboardCutoverLocalProducerSyncV2(kind,body):T and
withDashboardCutoverLocalProducerAsyncV2(kind,body):Promise<T> are trusted internal
source integration helpers; kind is the closed seven-entry vocabulary in spec.
acquireDashboardCutoverLocalProducerDrainV2():Promise<object> takes no arguments;
assertDashboardCutoverLocalProducerDrainV2(handle):void accepts only its actual
private frozen empty handle. Neither takes caller observation, children, promise
lists, completion flags or reset/release options.

- [x] Add child-isolated builtin tests importing the actual module: pending
  original promise with nested sync work; new-root denial; independently retained
  detached registered invocation; ended ancestry; self-drain; rejected original;
  wrong arity/foreign/proxy handles; reentrant acquisition burns. Literal ordering
  assertions, e.g. `["entered","sealed","nested","returned","held"]`.
- [x] Execute genuine missing-export/module RED before production source. Capture
  natural child exit, both pipe EOF and close, no signal/watchdog/cleanup.
- [x] Implement private AsyncLocalStorage records/Set, synchronous registration,
  monotonic close-before-await, independent original-promise settlement and
  WeakMap handle. No OS/DB/service/resource authority is minted.
- [x] Wrap the seven actual public consumer bodies before any parameter read,
  await or mutation; retain nested existing guards and original return/error
  semantics. Entire sync cleanup wrapper stays outside its best-effort catches.
- [x] Test actual AST-selected seven consumers composed with genuine registry;
  held gate reaches zero body effects/getters. Pause admitted Medic before its
  first await and returned timer promise; prove no intermediate handle, and
  nested config/atomic remains possible subject to unchanged OPEN refusal.
- [x] GREEN focused new + configuration refusal + cleanup consumer suites, strict
  noemit using existing read-only toolchain, syntax/version/English/path/diff.
- [x] Fresh independent source and contract/evidence review; record exact local
  claim only. Scoped commit/push/scanner/preserved DRAFT PR delivery, no merge or
  live admission from this slice alone.

Task4h.0 implementation receipt: amended missing-module19FAIL/0PASS
0f3d51→010d75 capture1289.002ms (retained exact tool
receipt in private logs); initial17FAIL1209.972ms had truncated outer reporting,
not full-original credit. First implementation17PASS/2 latent AST fixture parse
failures1272.017ms; corrected lexical factory scope/importMeta setup, no production
guard weakening. First combined85PASS2337.467ms; supplemental held/wrong-instance
and4full-imported closed-consumer controls91PASS2568.299ms.

Fresh source review found native Promise await-adoption could release a pending
original on constructor metadata error or spoofed own then. Three genuine
functionalRED e4ed5b (0PASS/3FAIL402.609ms) demonstrate missing expected drain
rejection, premature held state and wrong observer-error publication BEFORE the
intrinsic settlement fix. Preserve originals, no reset/revert. Implementation
observes actual native settlement via retained intrinsic then into its own
terminal Promise; constructor/species observer uncertainty burns with original
record retained and fixed refusal. The callback's own then never grants drain.

```ts
// Accounting follows intrinsic settlement, not `await original` metadata.
observeOriginal(original,
  value => { finish(record); fulfill(value); },
  reason => { finish(record); reject(reason); });
```

Current sourceca2e9d2e/test1775a146:26new local cases plus37configuration and
33cleanup =96PASS/0FAIL/0SKIP2602.332ms (6d3d39→205c76). Supplemental business
throw/non-native tests are additional branch coverage, not new pre-source RED.
Full strict noemit1189source/test/dependencyfiles0diagnostics actual045086; seven
AST body-equivalence comparisons931b53 prove preserved original body statements
including guards/order. Fresh version2.3.79/English1983/path996/diff-check pass.
No full build on dirty source, native/provider/PG/services or user cleanup effects.
Final exact-byte reviews/delivery pending; no child/effect/legacy/globalfreeze,
controller, clean-main or live3333 qualification from this receipt.

Final continuation: independent review found a known-burned pending acquisition
could remain waiting on a deliberately retained unknown descendant record.
FunctionalRED8ded74 (0PASS/1FAIL330.489ms) observes missing fixed refusal after
the original outer body terminates. Added shared burn notification: wake only
the acquisition so it rejects, without removing any unknown record, canceling
operations or reopening. Temporal spec wording now distinguishes initial RED,
causal later REDs and supplemental coverage correctly.

Current frozen sourceebdd0de2/test17d69ac4:27local+37config+33cleanup97PASS/0FAIL/
0SKIP2477.044ms actualc76c8b→d66994. Strict1189files0diagnostics16d3c3; all seven
original AST bodies unchangedb8ac8b; version2.3.79/English1983/path996/diff3cfa5a.
These fresh originals are included in the private evidence ledger, superseding
the earlier reviewer-unavailable AST/contract originals. No native campaign,
provider, PG, service, selector, ROOT or user cleanup mutation. Current HTTP:
MC3080/api/projects200, gateway18789200, dashboard3333000/curl7. Final two-seat
exact-byte review and scoped delivery remain pending.

Task4h.0 delivery supersedes the historical pending text above: final two-seat
source/evidence review C0/I0/M0, commit038fec6, normal push and exact-head
GitGuardian SUCCESS, preserved PR280 DRAFT appendix. See the private original
ledger and current handoff for complete receipts. No merge or whole-goal credit.

## Task4h.1: original gateway CLI failure settlement

Causal relation: Medic removal and uninstall await gateway cron promises; the
discarded async runCli executor can leave those registered originals pending.
Paired spec chooses the smallest async-function/synchronous-executor correction.
Root sole writer, research/review agents read-only.

File Map: modify src/installer/gateway-api.ts and tests/gateway-api-model.test.ts;
create tests/helpers/gateway-api-safe-consumer.ts and
tests/gateway-api-cli-settlement-v2.test.ts; update this plan and paired spec.
Public API unchanged. No new authority, native/PG/cron/launchd effects or timeout.

- [x] Add inert full-import fixture and genuine public-call lookup-throw and
  post-await invocation-throw regressions; run functional RED before production.
- [x] Make runCli async and use synchronous execFile Promise executor. Preserve
  all binary/argument/timeout/HTTP/disabled/error semantics.
- [x] Add configured/PATH/npx, callback error, disabled zero CLI/binary-discovery-port and HTTP-success
  controls; convert old model cases to full-import safe consumers, asserting
  exact model forwarding and removing real-job creation/deletion possibility.
- [x] Focused GREEN plus affected local/config/cleanup suites; strict noemit and
  contracts. This is source verification, not clean-main build or host cutover.
- [x] Fresh independent source and evidence review; scoped commit/push/scanner
  and preserved DRAFT PR delivery only after exact qualifications pass.

Task4h.1 receipts: actual functional RED1b35c3 BEFORE production edit, 0PASS/2FAIL
248.455625ms, both actual deleteCronJob calls still unsettled at checkpoints.
No import/setup failure or watchdog; fixtures end naturally. Initial patch
attempts rejected before any mutation are editing errors, not test REDs.
Source08fbb20c + testb654182f/helper2ced19b1/modeltestfc251e0f: focused14PASS
655.004584ms1cbc66. Initial affected command701c99 silently omitted a nonexistent
cleanup test path (78PASS2551.599417ms), so NO cleanup coverage credit from it.
Corrected actual command01b963 includes tests/platform-cleanup-protection-v2.test.ts:
111PASS/0FAIL/0SKIP2566.933916ms, 14gateway+27local+37config+33cleanup.
Strict noemit870915→73bf59:1189files0diagnostics. Version96d3b0:2.3.79,
English5ff5a6:1985files, paths8d0c51:996files; diff7a14a2 clean.
These are source/fixture receipts only, not clean-main build, original subprocess
termination, remote effect settlement, controller completion or live3333.

Task4h.1 delivered in b59d4b06: final independent source/evidence C0/I0/M0,
normal push, exact-head GitGuardian SUCCESS21:38:06UTC and preserved PR280 DRAFT
appendix. Previous47596B body remains an exact prefix;49185B new body matches
reviewed private file. No whole-project/merge/clean-main/live3333 credit.

## Task4h.2: retain deferred run-cron teardown originals

Causal relation: scheduleRunCronTeardown is entered after terminal transitions
but drops its nested five-minute grace/deletion Promise. The local drain must
retain the actual registered original queue, not infer completion from DB state.

File Map: src/installer/cleanup-ops.ts (schedule only),
src/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.ts
(one closed kind), its existing test file (AST factory bindings plus regression
matrix), paired spec and this plan. No actual agent-cron grace/policy edits.
Root sole writer, read-only agents independently nominate/review.

- [x] Actual AST-selected function + genuine registry: pending lookup and pending
  nested teardown functional RED before production changes, natural child exit.
- [x] Register before lookup, adopt entire teardown, preserve public void and
  logging/error distinctions, observe wrapper rejection after closed denial.
- [x] Cover no-work, lookup/teardown rejection, already-held and closing zero-work
  denial, and detached parent retention; every synthetic gate ends naturally.
- [x] Focused GREEN + gateway/config/cleanup affected matrix, strict noemit,
  contracts and diff. No real PG, cron, gateway, grace timer or native campaign.
- [ ] Fresh independent source/evidence reviews, scoped root commit/push/scanner
  and preserved DRAFT PR appendix. No global/legacy/child/effect/startup grant.

Task4h.2 actual receipts: two genuine full-function AST functionalRED BEFORE
production, bccf81:0PASS/2FAIL441.286125ms, held=true while lookup/nested teardown
remain pending; originals retained and synthetic gates settled in finally.
InitialGREENae28a0:2PASS392.525833ms. Six supplementary controls added afterward,
not claimed as pre-source RED. Current cleanup44129934/local7890a3a7/test06791fcc:
e0bb7a119PASS/0FAIL/0SKIP2733.342375ms =35local+14gateway+37config+33cleanup.
Strictfcdd7f→25e5a4:1190files0diagnostics. Versionc834e0:2.3.79, Englishcb3a4a:
1985files, pathsbdb614:996files, diff77ad57 pass. No actual cleanup-ops PG import,
timer/cron/gateway/native/ROOT/job/user-configuration effects; no dirty build.
Local queue body termination only, not original children or remote effects.

Task4h.2 delivery: final independent source/evidence C0/I0/M0, ae741547
normal push, exact-head scanner SUCCESS and preserved DRAFT PR280 appendix;
the historical unchecked delivery item above is superseded by this receipt.

## Task4i.0: approved fixed dashboard-job transport mechanics

Spec: paired Task4i. User approved the narrow launcher addition on 2026-10-09;
no repeated permission question. Root remains sole writer; agents read-only.

File Map: create scripts/dashboard-cutover-mach-job-peer-v4.c and
scripts/__tests__/dashboard-cutover-mach-job-peer-v4.test.js. Update paired spec
and this plan; private receipts/current handoff live outside tracked source.
Do not modify V3 C/tests, V1/V2 material grammar or existing job definitions.

Interfaces: five native methods named exactly in Task4i.0, frozen DATA-only
results. Closed service names and four header profiles are spec constants.
Internal acquire/send_frame/receive_frame/dispose mechanics have no permission
arguments beyond their closed role/frame indices. No authority handle export.

- [x] Write one opt-in compiled-C fixture campaign with an explicit pre-source
  baseline mode selecting the unchanged V3 source ONLY for functional RED.
  Call actual acquire/receive/send/dispose functions with inert external ports.
  Client must check in job endpoint first; controller must independently look
  up job endpoint and use that same send occurrence twice. Assert exact traces.
- [x] Run baseline functional RED before new production source. The test must
  fail on old anonymous-port/routing behavior, not missing compiler/import.
  Retain originals and natural exit/EOF/close; do not replay baseline later.
- [x] Implement distinct V4 C with these literal profile choices:
  ```c
  /* HELLO and GRANT: COPY_SEND, no local right. */
  /* CHALLENGE: COPY_SEND, MAKE_SEND_ONCE from original controller receive. */
  /* ACK: MOVE_SEND_ONCE of the retained CHALLENGE reply, no local right. */
  ```
  Keep every before/after admission, immutable frame, atomic state, intrinsic
  input/publication rule. Replace anonymous allocation with job check-in.
- [x] Qualify both success roles and uncertainty at check-in/lookup, four
  send/receive boundaries, tuple mismatch, malformed header/right/padding,
  and endpoint/send disposal. Require no later port dispatch after harness-set
  burn; production step() failure-to-burn is separately reviewed, not credited
  as dynamically qualified by these direct internal-helper calls.
  Compile once per source campaign; fixed maximum 32 commands, zero jobs.
  Fixed 20-second watchdog marks only, never kills or authorizes retry.
- [ ] Strict compile and focused mechanics GREEN; syntax/contracts/diff plus
  fresh independent exact-byte source and evidence review. No native kernel,
  Node-API publication, job/source authentication or listener credit.
- [ ] Scoped root commit/push/scanner and preserved DRAFT PR280 appendix after
  reviews. Continue held derivative material, installed-host/job negatives,
  sidecar/actual adapter/foreground and child/legacy closure obligations next;
  clean-main build and live3333 are required before whole-goal completion.

Task4i.0 original receipts: V3 baseline1bca4f 0PASS/1FAIL943.860083ms;
two actual old-C route expectations fail, not compiler/import setup. V4
95390a1PASS/0FAIL541.727167ms contains24cases/26commands/zerojobs, all natural
status0/signalnull/bothEOF+close/no watchdog. Original directories53aakP/aCzsCG
and private ledger logs/2026-10-09-dashboard-cutover-job-v4-mechanics-original.md
retain exact command intents/results/builds. C64fc0322/test2640804d. Real-source
strict -fsyntax-only e3b7380diagnostics; diff a89c5e passes. Port doubles establish
mechanics/post-harness-burn denial only, not production step() burn/publication,
native job/domain/source/build/phase/startup qualification. No live jobs or old
campaign replay; all original material remains. Final review/delivery pending.

## Task4i.0b: actual Node publication and failure-to-burn consumer

File Map: extend scripts/__tests__/dashboard-cutover-mach-job-peer-v4.test.js
with a distinct mutually exclusive actual-addon mode; paired docs. Remove the
single trailing blank line from the new C only (64fc0322→875ab97c); no behavior
change or V3 edit. Preserve original Task4i.0 receipts as original64fc bytes.

Interfaces: use the exact five V4 exported methods from Task4i.0, not direct
helpers. Actual real NAPI layer plus doubled Mach/BSM ports, DATA-only outputs.

- [x] Add the independently pinned actual-addon fixture; remove ONLY the static
  module-registration override, no direct-helper main. Role/fault initialization
  lives only in fixture_check; inject invalid received disposition in fixture.
  ```js
  const first = controller ? a.receiveControllerHelloV4()
    : a.helloClientAndReceiveChallengeV4(Buffer.from('hello'));
  const second = controller
    ? a.challengeControllerAndReceiveAckV4(Buffer.from('challenge'))
    : a.ackClientAndReceiveGrantV4(Buffer.from('ack'));
  if (controller) a.sendControllerGrantV4(Buffer.from('grant'));
  // All five methods must subsequently refuse without further kernel traces.
  ```
- [x] One closed32-command campaign: strict fixture compile, exact13NAPI import
  inventory, two module exports, libSystem/libbsm dependencies,28freshconsumers.
  Literal traces and exact frozen DATA records; retain alloriginals/naturalclose.
- [ ] Strict final realCsyntax, syntax/contracts/diff, fresh independent source
  and original-evidence reviews. InjectedNAPIerror/reentry and realkernelAUTH stay
  excluded. Black-box refusal does not uniquely identify private lifecycle;
  exact failure-to-BURNED transition earns source-review credit only.
  No production behavior change without a newly witnessed RED.
- [ ] Forward reviewed commit/push/scanner/preservedPRdelivery, no amend/force.
  Continue held derivative material/currenthost/sidecar/adapter/foreground and
  child+legacyclosure; clean-main/live3333 remain required, not claimed here.

Delivery sequencing correction: root's cached diff2d86ba found new C trailing
blank line but root mistakenly proceeded to 5b514935 commit808b83 before reading
that failure. No push occurred. This is an orchestration error, not test RED.
Keep that commit and all original64fc evidence; fix only new EOF with apply_patch
and qualify final875ab bytes here, then use normal forward commit. No rewrite.

Task4i.0b original c84265→8220f0 GREEN1PASS/0FAIL/1SKIP1446.282375ms,
28freshconsumers/32commands/zerojobs. The skip is direct-mechanics mode, NOT an
unexecuted case in the28. NewfixtureeMblAz/source875ab97c/fixtureda695d7e/addonbd440ab2
retain exact originals; readback4ff79f verifies32naturalstatus0/signalnull/bothEOF+
close/no unknown/watchdog. Exact13NAPIimports,2exports and2dylibs inspected.
StrictrealC14f7660diagnostics;testf50a8d/version83ef72/English246e37/path4ba288/
diffccf98f all0. No oldcampaignreplay; original64fc receipts remain historical.
ActualnormalNodepublication and persistentpublicrefusal only, not private-state
oracle/injectedNAPIerror/reentry/kernel/job/source/phase/startup AUTH. Freshfinal
source/evidence review and forwarddelivery remain pending.

Task4i.0/0b delivery supersedes pending text above: independent final exact-byte
source/evidence C0/I0/M0, normal forward fdfbccfc after preserved5b514935,
48fdec→519812 push ae→fdf, PR280 OPEN DRAFT exactfdf with originalbody prefix
preserved and serverbodyexactprivate53579B SHA172822370488cf330701e39259e2a66ac338946ff6255a183187fbd0fa8337ac.
ExactheadGitGuardianSUCCESS2026-10-08T23:42:11Z; reviews[]/inlinecomments[].
No merge, clean-mainbuild, installedjobAUTH or live3333 credit. Original two
dirty files remain exacta1fff41c/4cd12cde; all qualified fixtures retained.

## Task4h.3: original nominated child/pipes custody (implementation pending)

Spec: paired Task4h.3. Scope refinement is causally necessary for actual
producer termination before full adapter composition, not unrelated process
management. Existing JS-only capability meaning and business paths stay.

File Map: modify src/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.ts,
src/installer/gateway-api.ts and src/medic/medic-cron.ts; create
tests/internal-production/baseline-dashboard-cutover-local-child-drain-v3.test.ts
and tests/medic-owned-child-consumer-v3.test.ts plus
tests/gateway-api-child-custody-v3.test.ts. Update existing gateway helper/
CLI-settlement/model tests and existing local-producer test only as needed to
bind genuine registry; enroll the new pure test in package.json. Paired docs.
Root sole writer, implementation inline; read-only nomination/final reviews.

Interfaces: callback void execFileDashboardCutoverLocalChildV3 with original
callback argument shapes; async execFileDashboardCutoverLocalChildAsyncV3 returns
the builtin stdout/stderr result without exposing the original child;
acquireDashboardCutoverLocalChildDrainV3(jsDrainHandle):Promise<object> and
assertDashboardCutoverLocalChildDrainV3(childDrainHandle):void. Literal same-
instance V2 handle, private child Set and source-owned dispatch only.

- [ ] Independently review exact paired typed overloads, original Node
  execFile/promisify ports and prepend-before-business observers before source
  changes. Four-port child fence does not cover whole JS/HTTP/legacy lifetime.
- [ ] Add actual-module missing-export RED and actual consumer regressions:
  ```ts
  // Inside a registered producer, dispatch a finite original child then return.
  const js = await acquireDashboardCutoverLocalProducerDrainV2();
  const childHeld = acquireDashboardCutoverLocalChildDrainV3(js);
  // The original child's exit AND output EOF/close, not the JS return, settle it.
  ```
  Include callback and builtin-promisified paths, nonzero natural exit, live
  nesting during closure, ended/fresh/status denial, outside-ancestry OPEN
  business compatibility with actual child retention,
  foreign/duplicate/self handles, fake-return business compatibility and burn
  notification. V2 burn while V3 pending promptly refuses, retains original
  custody, and V2 burn after V3 mint invalidates V3; child-only burn leaves V2
  valid. Literal output/order assertions; no public child-attach oracle.
- [ ] Run actual functional/missing-export RED before implementation, capture
  natural test process/child exit/EOF/close; no timeout-kill fixture or old replay.
- [ ] Implement private reserve-before-dispatch, genuine original return/pipes,
  separate childburn/wake/WeakMap and once-only acquisition.
  Retain/revalidate the genuine original V2 handle before/after wait/pre-mint/on
  assertion; JS burn notifies child wait, without reciprocal JS invalidation.
  Preserve ordinary callback/promise results without custody waiting or new
  cancellation. Closed
  admission alone denies fresh launch, not a pre-closure child-authority burn.
- [ ] Replace exactly gateway which/CLI and Medic two systemctl helpers; remove
  only obsolete direct import/promisifier. Preserve four literal arguments,
  timeout30000, error precedence, PATH/npx/cache and complete systemd environment.
  Test actual selected/full-imported consumers with inert external ports.
- [ ] Focused child/source/JS/config/cleanup matrix and strict noemit/contracts;
  classify synthetic refusal separately from real natural child qualification.
  No full build on dirty worktree or provider/PG/cron/systemctl effects.
- [ ] Fresh independent exact-byte source/evidence reviews; scoped root normal
  commit/push/scanner and preserved DRAFT PR append. Child cap remains nominated
  originals only; full adapter/legacy/remote/held derivative/currenthost/sidecar/
  foreground and clean-main/live3333 obligations remain required.

Task4h.3 design chooses all-four-port child launch fencing at actual JS closure
over the earlier untracked outside-ancestry proposal. This is necessary for
stable child-only termination, not a new JS kind or whole HTTP/legacy/global
freeze claim. Actual Node source confirms callback errors may precede close and
native spawn precedes fallible pipe setup. Diagnostics-channel/prototype/manual
event mutation is outside the trusted closed-loaded-code profile, not an ignored
universal threat. Implementation/evidence receipts are recorded below.

### Task4h.3 implementation qualification, 2026-10-09/00:07UTC

Actual missing-export RED fb7359:0P6F442.301083ms before source; original
retained six intent/results. Actual full-module gateway RED1312a0:0P2F and
Medic REDe92140:0P2F before respective source ports changed. Initial source
six GREENc9730f; synthetic never-spawned ChildProcess RED324f58 then positive
original PID sanity guard. PID is not source/owner/birth AUTH.

Independent review found I1 ordinary memory retention after one global child
burn. Actual finite child WeakRef/GC RED228c0f fails known-original collectibility;
retain its complete original fixture W2WKs9 (tool text was truncated). Minimal
per-occurrence uncertainty fix + WeakMap original identity preserves permanent
authority burn while releasing independently known natural completed originals.
GREENde4c03. Unknown original occurrences stay retained, ordinary OPEN dispatch
and fallback unchanged. This is causally necessary ordinary resource safety,
not a relaxation of the drain gate.

Final matrix146b49→85f8db:143PASS/0FAIL/0SKIP10689.779375ms:35localJS,
14existinggateway,2newgateway,14child,8Medic,37configuration,33cleanup.
Actual finite child positives earn natural original closure credit; constructed
object/output-destroy negatives earn refusal only. Medic systemctl/FS and gateway
CLI/HTTP are inert external doubles exercising actual full imported consumers;
not host effects or their child qualification. Strict81c4df→72d064:1190files,
0diagnostics including new test files; versionccdf0a/English248dc0/pathe104d1/
diff60f24e all0. No dirty build/guard bypass or old native campaign replay.

Source35cc9436, gateway81959cb7, Medicbb91eb6c; new child84718104,
gatewaycff7a823, Medica093b9ec, package730a45bf. Explicit pure enrollment uses
test:dashboard-local-custody; no automated real systemctl/provider/PG/cron.
Private complete original ledger:logs/2026-10-09-dashboard-cutover-local-child-original.md.
Final two-seat reviewed delivery pending; full six-effect adapter/legacy/current
job qualification/held derivative/sidecar/foreground/clean-main/live3333 remain.

Gateway receipt-only helper refinement d93e700c persists actual intent/result
and explicitly observes both pipe close. Separate16post-refinement actual
gateway consumers5fbff6→d06063:16PASS/0FAIL/0SKIP1191.949666ms; earlier143
matrix retains its original snapshot, no relabelling. Refreshed strict also
includes this imported helper. Ten-file scoped delivery nomination; no production
change after143 matrix. Final reviewers independently read all retained14child,
8Medic and refreshed16gateway programs/results, not merely aggregate prose.

### Task4h.3 delivered, 2026-10-09/00:14UTC

Two ten-file exact source/evidence RO reviews C0/I0/M0; root commit6cf45c56,
normalpushfdfbccfc→6cf45c56; CLEAN. PR280 exact6cf OPEN DRAFT, scannerSUCCESS
00:12:37UTC. Priorbody exactprefix preserved and body exactprivatefile55956B,
SHA9473d66e1f5b532a9c4294be2317df6e972b38696568c2bb1e316529bb201e28.
Fresh GitHub reviews[]/inlinecomments[]; no invented external reviews/merge.
Ledger logs/2026-10-09-dashboard-cutover-local-child-original.md includes all
original delivery receipts. Full clean-main/build/live3333 goal remains open.

## Task4i.1: held approved definition V4 (nomination)

Spec: paired Task4i.1. Root writer only; read-only design/source/evidence reviews.
Existing material provider owns private parsed values; no new raw-material
accessor or launchctl/PG/startup effect. Approved ONE fixed job.v4 entry only.

File Map: modify src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts;
create tests/internal-production/baseline-dashboard-cutover-approved-definition-v4.test.ts;
modify package.json explicit pure enrollment and paired docs. Existing V1/V2
material tests may change only test loader/retention where required, not guards.
No controller/executor/launchctl command or existing launcher file changes.

Interfaces: exact branded opaque hold/assert/close signatures in spec. Internally
configuration closure renders only its private original dashboard tree and owns
lease path/bytes/FDs. Public V4 WeakMap borrows genuine original V2 state; same
activity/reentry guard. One derivation attempt, no replacement or retry.
Private factory signature within that closure:
createApprovedDefinitionV4(checkOriginal:()=>void):{check():void;close():void}.
Its path/bytes remain closure-private, not properties of that returned lease.
Later executor composition must remain inside this provider, never adding an
arbitrary-path/raw-material getter to satisfy a consumer.
Factory registers its private attempt inside retained configuration before any
render/FS work; a returned lease variable alone cannot retain partial acquisition.
XMLCR uses &#13; to preserve values through independent parsing. Private renderer
mechanics are distinct from genuine material-holder tests for values the old
loaded parser cannot accept. Cleanup-after-invalid-borrow exception checks genuine
derivative/idle/once-only FD custody, not restored material validity.

- [x] Independently review paired typed contracts, fixed sibling namespace,
  original resource lifetime, idle-versus-pre32 guard and close-loss behavior.
- [x] Author fresh actual-source private FS fixture and missing-export RED:
  ```ts
  const original = module.holdDashboardCutoverLauncherMaterialV2();
  const definition = module.holdDashboardCutoverApprovedDefinitionV4(original);
  assert.equal(Object.getPrototypeOf(definition), null);
  assert.deepEqual(Reflect.ownKeys(definition), []);
  // Inspect ONLY test-owned FS write/read-back instrumentation, not a public getter.
  assert.deepEqual(parsedDerivative, {
    Label: 'com.setrox.setfarm-dashboard',
    ProgramArguments: [home+'/.local/bin/setfarm','dashboard','start','--port','3333'],
    EnvironmentVariables: {PATH:'/usr/local/bin:/usr/bin:/bin',
      SETFARM_PG_URL:'postgresql://fixture_PG_SENTINEL@localhost/setfarm',
      SETFARM_OPERATIONAL_WRITE_TOKEN:'TOKEN_SENTINEL'},
    RunAtLoad:true, StartInterval:60,
    StandardOutPath:home+'/.openclaw/logs/setfarm-dashboard.watch.log',
    StandardErrorPath:home+'/.openclaw/logs/setfarm-dashboard.watch.err.log',
    MachServices:{'com.setrox.setfarm.dashboard-cutover.job.v4':{ResetAtClose:true}}
  });
  ```
  Fresh actual outer Node source import; inert exact launchctl-print responses;
  allow genuine finite plutil on private fixture input only. Deny every bootstrap/
  job/PG/provider/systemctl/native/CLI port. Retain programs/result directories
  and original natural outer exit/null signal/both output EOF/close.
- [x] Run nominated RED before production:
  node --import tsx --test --test-concurrency=1
  tests/internal-production/baseline-dashboard-cutover-approved-definition-v4.test.ts.
  Expected missing source-owned V4 export, not setup/import/compiler failure.
- [x] Add minimal private configuration derivative factory + V4 state/WeakMap:
  ```ts
  // Registered original attempt BEFORE any fallible renderer/FS port.
  originalState.approvedDefinitionSelectedV4 = true;
  const lease = originalState.configuration.createApprovedDefinitionV4(checkOriginal);
  checkOriginal(); lease.check(); checkOriginal();
  // Empty handle publishes only after full durable write/private read-back.
  ```
  No public factory/getter/path parameter. Required workspace/data/baseline;
  fresh0700 collection/UUID directory and0600 exclusive file. Original returned
  descriptors registered before fstat. Fixed private XML escape/boundary validation,
  complete write and file/directory fsync, no old parent modification or deletion.
- [x] Expand actual behavior controls: copied/proxy/wrong-instance/arity zero
  caller traps/ports; V1/V2 continue rejecting MachServices/Sockets; XML escaping/
  Unicode/control refusal; unchanged original bytes/inodes/spawner; no launchctl
  after acquire; original/account/ancestor/derivative inode/byte drift sticky;
  second derive; swallowed hold/assert/close reentry; partial-write/sync refusal;
  derivative close checked-once reverse FDs and original still usable; original
  close invalidates derivative; close response loss no retry; active pending
  pre32 refuses V4 calls with zero closes, retaining original callback.
- [x] Focused V4 + material/V1 tests and strict noemit/contracts. Source-fault
  fixtures get FS/material behavior credit ONLY, not current-host job/source/
  control/adapter qualification. No dirty build or old native campaign replay.
- [ ] Fresh two-seat exact source/evidence review; root normal commit/push and
  preserved DRAFT PR append/scanner. Proceed to host endpoint/source qualification
  and genuine adapter; derivative hold alone cannot dispatch/bootstrap or complete
  ordinal5. Full owner/phase/legacy/foreground/clean-main/live3333 requirements stay.

Task4i.1 actual qualification: initial missing-export REDdfce18 0P3F before
production; first3P107b79. Independent I2/M1 and I1/M1 findings reproduced
4RED3cb989 then7GREEN258e94/37295e: each new noncleanup port brackets original
activity, partial writes validate original staged full metadata/bytes before
later ports, fsync cannot adopt drifted timestamps, exact private modes07777.
Two revised source RO reviews C0/I0/M0 atddf8955b (not final delivery reviews).
Strict065b71/9763da caught one TS narrowing error plus two incorrectly named
test roots; root explicit return in refusal branch changed no runtime gate.
Corrected noemitf7b28a/35ab8d1193files/0diagnostics strict=true/noEmit=true.
Actual final matrixd61142/1fa9c8:197P0F0SKIP29249.032125ms,32V4 +47materialV2
+118launcherV1. Exact old-test changes are loader selection and newly owned
fixture intent/result retention only; no guard changes, no old native replay.
Pure entry explicitly nominates new V4 file; no PG/provider/service effects.
Private renderer copied-source mechanics cover malformed surrogates/CR separately
from genuine unchanged V2 loaded-material inputs. Actual failed32 expansion
804700/464621 was fixture duplicate identifier setup error31P1F, never source
RED; corrected fixture name before final197. Earlier14/20 failed expansions
were test-only FD tracking/builtin export synchronization, recorded unchanged.
Original receipt ledger logs/2026-10-09-dashboard-cutover-approved-definition-original.md;
all private owned originals retained. No full build/clean-main/source-host/job/
owner/control/phase/adapter/foreground/live3333 qualification is claimed.

Task4i.1 delivered dcec316d4dddf901aaae7c50e4165474ef6cb526 with two independent
seven-exact-file source/evidence C0/I0/M0 reviews. Normal forward push/PR280
OPEN DRAFT, exactheadGitGuardianSUCCESS2026-10-09T00:46:34Z; original55956B
PRbodyprefix preserved, new58007B privatebody exactserver. Reviews[] andinline
comments[] are not Copilot/Gemini completion. Final strict1193/0 and direct
migration/shared-dependency MC12 check passed; ordinarynpmchecks missing local
dependencies and no fullbuild/main/cutover credit remain explicit.

## Task4i.2: fixed retained V4 native source/dependency/sidecar binding

Causal prerequisite: existing direct inputs153, build inputs16 and sidecar21
still nominate scripts/dashboard-cutover-mach-peer-v2.c (V3). Reviewed job V4 C
cannot be used by the eventual source-owned foreground/control consumer until
that SAME actual V4 byte occurrence/dependency graph/terminal output is retained.
Task4i.1 material succeeds without proving any addon or endpoint.

File Map: existing scripts/dashboard-cutover-native-inputs-v2.mjs,
dashboard-cutover-native-build-inputs-v2.mjs, dashboard-cutover-native-sidecar-v2.mjs;
their three existing scripts/__tests__ files; paired design/plan. Pure-script
enrollment already includes those files, no new runtime entry or public CLI.
Keep root single writer, agents independent RO design/source/evidence only.

Select private literal V2/V4 bindings inside the same existing providers, sharing
one original attempt/activity/uncertainty vault per provider. Alternative three
duplicated V4 modules would duplicate delicate FD/child/cleanup rules and force
new source inventories; caller-selected generic profiles would expose unsafe
selection. Fixed zero-argument exported V4 entry points add no caller factory.
Preserve original V2 literal paths/schemas/namespace/custody and behavior.

Exact interfaces: holdDashboardCutoverNativeInputsV4(),
prepareDashboardCutoverNativeBuildInputsV4(), prepareDashboardCutoverNativeSidecarV4().
All return existing frozen DATA-only observation/recheck/close holder shape.
No source/profile/path/bytes/permission/addon-load callback argument or getter.
Distinct V4 schemas and fixed .setfarm/dashboard-cutover-native-v4 namespace
are in paired spec. Internal V4 downstream composition rejects a V2 schema,
source locator/hash/length mismatch, crossed profile and dependency graph before
later compiler/publication ports. Existing V2 checks remain at least as strict.

- [x] Independently review fixed bindings, shared original activity/one attempt,
  V2 compatibility, source-build constraints and no-evaluation boundary.
- [x] Author actual missing-V4-export RED through each existing source fixture
  BEFORE production. Fresh private finalized-source/Git/FS fixtures retained;
  only relocated fixed provider literals and inert external command ports.
  Missing API must fail before V4 FS/compiler dispatch, not old-export-list/setup.
- [x] Add minimal private literal selection + three fixed zero-input V4 exports;
  same retained original resource/once-only cleanup rules, no new generic API.
- [x] Qualify actual V4 source/hash/byte occurrence, double dependency discovery,
  terminal V4 manifest/outputs; V3 retained unchanged. Negatives: crossed V2/V4
  schema/source, source/ancestor/dependency drift, V4 namespace collision,
  shared cross-profile swallowed reentry, partial acquisition and close loss.
- [ ] Run focused source-fault matrix + old V2 controls excluding previously
  retained actual-native campaigns. Strict/contracts/diff checks; two final RO
  reviews; root scoped normal commit/push/preserved DRAFT append/scanner.
- [ ] Nominate fresh actual V4 compiler qualification separately only after
  finalized source/build constraints are proven. No addon evaluation/bootstrap/
  job mutation or old campaign replay in this source-only slice. All host birth,
  foreground, six effects/controller, owner/phase/legacy and clean-main/live3333
  requirements remain; observations cannot substitute for genuine capabilities.

Task4i.2 test-only refinement: two exact source-fault fixture copies replace
the private V4 downstream call with genuine V2 before the final private source commit/finalization;
no fabricated authoritative holder or production selector. Actual initial
3P GREEN; shared-vault expansion16P2F was fixture lexical mod scope only, fixed
without production change. Equivalent graph-order test actually RED c64ff8,
then minimal removal of unnecessary raw output equality GREEN925c93. Canonical
graphs remain compared twice by genuine build provider and against compile
depfile; no graph/security guard was relaxed.

Task4i.2 frozen final verification: generic Node22 mechanical181tests178P0F3SKIP,
383222.1685ms; explicit fixed Node26.4.0 focused45P0F0SKIP94681.370125ms.
Three actual-native campaign flags explicitly removed in the full matrix;
neither matrix executes real compiler/Mach or authenticates production build.
Root independent9c3cb8 readback all223 retained fixture results,0faults; full
root/result/tool-output index logs/2026-10-09-dashboard-cutover-native-v4-frozen-matrix-index.json.
Direct/build/sidecar counts full40/57/81 and fixed26focused12/16/17. Strictfd12e9
1193files0diagnostics; syntaxb6232e0, migrationdcab940, version/English/path0.
Both independent source seats C0/I0/M0; final complete-original evidence review
still pending. No staged/commit/push/clean-main/fullbuild/host/foreground credit.

Task4i.2 delivered5b377ee582df7e2a1307ded878c6030a18e50595. Both independent
eight-byte-pin source/evidence/doc seats C0/I0/M0, all223 originals/492 provider
copies/223jobCcopies/98sidecar snapshots checked. Normalpush/PR280OPEN DRAFT
exactheadGitGuardianSUCCESS01:22:18UTC; exact59728Bbody prior58007Bprefix intact.
Original2dirty unchanged. No real compiler/mainbuild/job/foreground/cutover credit.

## Task4i.3: opaque SAME original V4 sidecar lifetime

Paired spec Task4i.3. Before spending a genuine finalized compiler generation,
retain the same private original context behind an opaque lease; DATA path/
manifest adoption cannot repair one-attempt custody after closure. Do not run
actual:true synthetic-build fixtures as production-build qualification.

File Map: scripts/dashboard-cutover-native-sidecar-v2.mjs and its existing
scripts/__tests__/dashboard-cutover-native-sidecar-v2.test.js; paired spec/plan.
Pure-script enrollment already present. Only root writes/delivers; independent
RO design/source/evidence review. No loader/controller/CLI/launchd/PG change.

Interfaces: zero-input async holdDashboardCutoverNativeSidecarLeaseV4;
exact-one-input assertHeldDashboardCutoverNativeSidecarLeaseV4 and close counterpart.
Empty frozen null-prototype WeakMap-original handles; mint INSIDE original
terminal publication, not around a supplied public DATA holder. Same original
activity/one-attempt/burn/closed state and checked-once cleanup, no new source
selector/getter/callback/evaluation. Existing V2/V4 DATA behavior preserved.

- [x] Independently review exact interfaces, original lifetime, shared activity,
  unknown child/pipe custody and source-only/no-evaluation qualification.
- [x] Actual missing opaque-export RED BEFORE production edits through existing
  retained sidecar fixture; zero commands/effects before missing API assertion.
- [x] Implement smallest private original WeakMap + fixed opaque return branch
  in existing provider, not public generic mode or path/observation adoption.
- [x] Prove opacity/original identity, wrong arity/proxy/foreign/copy/instance,
  public DATA/path/manifest rejection, healthy assert/once-close, shared V2/V4
  attempted/active/pending cleanup refusal, original/source/ancestor/output drift,
  partial acquisition/unknown children/close response loss and reused FD.
- [ ] Focused fixed26 source-fault tests + proportional old DATA controls,
  strict/contracts/diff; two final exact-byte independent reviews, normal scoped
  delivery. Genuine production-build/compiler/loader/native/job/foreground and
  all six effects/owner/phase/legacy/live3333 remain excluded here.

Task4i.3 actual receipts: fixed26 initial missing-export RED0P1F258.606ms,
expanded0P3F688.234ms BEFORE production. Initial3GREEN17349.115ms.
First expanded test66e3bff0 yielded18P22F246594.997ms from TEST-ONLY aggregate
temporary-reader close counts and transient preflight opening attribution;
production never changed for those failures. Corrected retained-sidecar original
tracking/opening3GREEN2088.096ms; final test8039c763/sourcef81deacf.
Focused active24P0F134312.181ms and passive16P0F118898.154ms. The third group's
negative CLI filter actually included all cases: full122tests121P0F1SKIP,
628261.345ms (d64802), including repeated40 opaque cases. Do NOT sum as unique
tests or claim disjoint groups. All three actual-native flags removed.
Root independently read all161 retained result/program/command originals with
zero faults; full raw receipt/root and result SHA indices in logs:
2026-10-09-dashboard-cutover-native-v4-opaque-frozen-index.json and
2026-10-09-dashboard-cutover-native-v4-opaque-result-index.json. Old diagnostic
failure tool output is truncated; intact private originals retained. Synthetic
command byte counters are not native capture authority. Strict1193files0diag,
syntax/contracts/diff0. Two source/new40-case RO seats C0/I0/M0; final full-run
evidence/docs clearance pending. No native compiler/production build/evaluation/
job/foreground/clean-main/live3333 credit; no Task4i.3 delivery yet.

Task4i.3 delivered212001d444435531b38e1d5b398349781a38113c; two final source/
all161-original evidence/doc seats C0/I0/M0. Normalpush/scannerSUCCESS01:52:24Z,
PR280OPEN DRAFT exacthead61533Bbody prior59728Bprefix intact. Writer clean,
original2dirty unchanged. Historical pending lines above superseded; no genuine
compiler/loading/mainbuild/job/foreground/wholegoal credit.

## Task4i.4: functional private held-bundle loading (delivered a1ae81a2)

Spec: paired Task4i.4. Causal path to actual six-effect adapter: retain genuine
native provider privately, rather than publishing another DATA-only conjunction.
Selected smaller functional sidecar-only fence; alternative joint definition
composition needs a separately nominated cross-module original-operation fence,
not public idle assertion while launcher active or before/after-await snapshots.

File Map: existing scripts/dashboard-cutover-native-sidecar-v2.mjs and
scripts/__tests__/dashboard-cutover-native-sidecar-v2.test.js; this plan/paired
spec. No new module/enrollment/package, C, launcher, PG, CLI or service changes.
Root only writer/delivery; parallel agents RO design/source/evidence reviewers.

Interfaces: holdDashboardCutoverLoadedJobPeerV4(originalSidecarLease):Promise<object>;
assertHeldDashboardCutoverLoadedJobPeerV4(originalLoaded):void;
closeHeldDashboardCutoverLoadedJobPeerV4(originalLoaded):void. Each exactly1.
Empty frozen null-prototype original handle; private fixed require of same held
bundle, exact require/cache/module/exports/five-method occurrences retained.
No public methods/paths/bytes/getters/callbacks or supplied loader. Existing five
exports remain; shared vault active guard first, one retained load attempt before
fallible loader work, pending mint before sealing, genuine idle once-close.

- [x] Independently review fixed APIs, loaded lifetime/cache ownership, original
  shared activity, one trusted require boundary and no joint/startup authority.
- [x] Actual missing-loader-export RED BEFORE production through existing
  retained source fixture; no native image/compiler/Mach method evaluated.
- [x] Implement minimal private same-vault load/WeakMap path using fixed
  createRequire; retain originals before uncertainty, never cache adoption/retry.
  Independent RO review produced causal REDs for post-terminal assertion cache
  drift and post-seal publication drift (47d8ff), pre-load cache arrival (fff5a0),
  pre-load cache binding drift and creation reentry before seal (d7376e). Root
  sibling-original readbacks precede each smallest source correction. Focused
  GREEN2 fb5016 and GREEN3 93a868 are not the final frozen matrix. Final admission
  repeats SAME require/cache binding and own-entry absence after terminal FS;
  retained mint gets alive before sealing; post-seal and final assert cache checks.
- [x] Qualify zero-load/zero-trap foreign/proxy/arity/DATA/path refusal, genuine
  private load with zero method calls, exact cache/module/exports/descriptor
  custody, preexisting cache rejection, load response loss/malformed exports,
  shared active reentry, source/build/terminal/cache drift, unpublished seal loss,
  original/loaded cross-close, response loss and reused FD. All evidence retained.
  Fixed26 final disjoint source-fault campaigns: malformed20P0F358265
  189702.939209ms; corrected lifecycle23P0Ffecbd4 227502.352292ms; old
  DATA/opaque/shared controls15P0F9eb033 94973.069792ms. Total58 distinct passed
  case programs, no native image or method evaluation. Earlier lifecycle20P1F
  30f724 retained: EACCES writing sealed readonly bundle was test SETUP, not
  production RED; corrected to recoverable rename/return ABA with source unchanged.
  Malformed20/control15 generated at teste4f5d712; lifecycle23 at testd5600b82.
  Root9b9020 reconstructed exact earlier e4 bytes from revised d560: only one
  setup/name correction and two added tests; all prior helpers/35 bodies unchanged.
  Rootf98305 independently read58 original result/program/command records:
  377 inert commands,173 exact provider relocations+one declared crossed V2,
  four intentionally unsettled original command snapshots in old reentry
  negatives remain unknown, NOT child-close/compiler qualification. No other
  index faults. Strict1193/0/noEmit, syntax/version/English/paths/migration0.
  Normal artifact check lacked writer zod; readonly explicit shared dependency
  resolver verifies12artifacts, NOT writer dependency closure or full build.
  Private frozen/result indices ece7031e/364807d1; original two passive-home
  file bytes preserved, current stopped-retention worktree clean, no root reset.
- [x] Focused source-fault RED/GREEN + proportional old DATA/opaque controls,
  strict/contracts/diff; two final exact-byte source/evidence/doc reviews and
  normal scoped delivery. Do not describe overlapping test selection as unique.
  Final two independent original-evidence reviews C0/I0/M0. Rootstage725811,
  normal commita129d7 a1ae81a26e0c0765dd7bf4b8f35123a47a976b83, pusha2087d;
  writer clean72caf4. PR280 OPEN DRAFT exactnewhead27f1be and GitGuardianSUCCESS
  02:30:56Z; appendonly63488B prior61533prefixpreserved, SHAa94ff9b9. No merge,
  actual native loading, full build or live3333 claim.
- [ ] Separately nominate joint original-operation fence/actual adapter use and
  genuine finalized compiler/loading qualification. No actual:true synthesis,
  native campaign replay, cache deletion/unload, owner/phase/startup substitution
  or clean-main guard bypass in this slice. All six effects/controller/entry,
  legacy cohort/foreground/clean-main/live3333 obligations remain.

## Task4i.5: fixed bilateral original-operation qualifier (source qualified)

Goal: execute genuine loaded/definition original checks under jointly held
participant activity, without exposing provider methods or granting effects.
Architecture: adapter owns private token, preparation/import occurrences
and serial enrollment/check/settlement stages. Existing providers consult the same
trap-free revocation identity around their admitted outer ports; existing nested
source/configuration calls remain explicitly trusted composites.
Tech: fixed Node26 ESM/builtins, existing TS launcher, adjacent .d.mts declaration.
Spec: paired Task4i.5; existing Task4 effect contract and Task3 dependency unchanged.
Root only writer/delivery. RO agents research/design/source/evidence review only.

File Map (one bounded testable feature):
- Create scripts/deployment-dashboard-cutover-adapter-v2.mjs: fixed qualifier,
  private source/import/token/operation custody and fixed liveness/revoke helpers.
- Create scripts/deployment-dashboard-cutover-adapter-v2.d.mts: exact object/void/
  Promise<void> signatures; no any, callback or generic permission types.
- Create scripts/__tests__/deployment-dashboard-cutover-adapter-v2.test.js:
  actual copied provider qualification, inert loader/native commands only.
- Modify scripts/dashboard-cutover-native-sidecar-v2.mjs and existing test:
  original loaded operation scopes, shared token liveness and nonthrowing burn notice.
- Modify src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts
  and tests/internal-production/baseline-dashboard-cutover-approved-definition-v4.test.ts:
  private definition operation scope while retaining material original activity.
- Modify package.json: explicit builtin/pure test enrollment; no dependency install.
- Modify this plan and paired spec. Existing source/build closure differences must
  be named and independently reviewed before adding another production dependency.

Interfaces: copy exact two-input qualifier, seven adapter token helpers and seven
provider scope functions from paired spec. All fixed arity. Token mint private;
source/compiled provider import literals fixed to same ROOT. Foreign ordinary
objects may trigger readonly preparation/import proof BEFORE compiled WeakMap
authentication, but never participant scopes/effects; do not promise zero FS there.
Preparation custody and joint-operation attempt are distinct. Existing healthy
participant handles survive invalid identity qualification.
Coordinator active-first precedes ALL input parsing, including while imports are
pending: bad-arity/proxy reentry burns original preparation/token, new ports0,
traps0, no settlement/disposal. Only idle input validation follows the stated order.
Authenticate through existing fixed idle assertions (loaded then definition) after
fixed imports, never direct WeakMap access. Before mint/enrollment both assertions
and source proof pass. Settlement needs pending0 AND every separately registered
enrollment response recovered/published AND no unknown enrollment/settlement;
a synchronous response-loss must not enter SETTLING via finally.
RO source investigation found a serial settlement gap: keep each settled local
activity fenced until both settlement responses are recovered at the coordinator's
terminal stage. Two fixed release-token assertions authenticate that metadata
only; next public idle entry clears activity without FD/resource ports. No extra
production file or effect scope, but this causal lifecycle refinement must be
reviewed before implementation.
Second causal refinement: raw module/cache mutation in the last definition FS
pass does not notify a provider burn. Nominate exact-one native cache-only scope
assertion after ALL source/definition/FS passes and before settlement. Reuses
private cache identity checks, no FS/upstream/native methods; explicit trusted
intrinsic cutpoint, not simultaneous atomic disk/cache authority. Same File Map.
Original scope responses require immediate fixed-provider authentication before
the next enrollment, not merely non-null return. RO proposal became causal RED
cb0c9f/6c9db0: dropped original scope WeakMap registration admitted a second mint.
Retain returned response first; failed fixed scope assertion quarantines unknown
custody and prevents the second begin. Enrollment authentication is explicitly
separate from later bilateral checks; no fake scope holder or new public API.

- [x] Step1: RO nomination review resolves exact import identity, source-closure
  enrollment, preparation versus operation attempt, pending work/settlement and
  trusted-composite port accounting before production. Self-review all interfaces
  against paired spec; do not treat this qualifier as full adapter capability.
  Three refreshed independent RO seats C0/I0/M0 on spec e9b4358e and plan
  88c4c7c2, source HEAD a1ae81a2 unchanged. Design gate only, not source,
  evidence, cached executing image or complete Task4 qualification.
- [x] Step2: author source-only actual-provider fixtures and missing-export RED
  before code. Retain each generated program, natural exit/signal/EOF and originals.
  Example missing-module assertion:
  assert.equal(typeof adapter.qualifyHeldDashboardCutoverJointOriginalOperationV4,
    'function','MISSING_FIXED_JOINT_ORIGINAL_OPERATION');
  Genuine participant fixture must obtain definition from the FIXED compiled
  provider instance and loaded original from the actual copied sidecar, not mocks
  returning fabricated handles. A declared exact source-loader/transpile bridge
  may supply compiled-path test code, but never genuine clean-main/build credit.
  Use a LOCAL finite finalized-output builder in this test, leaving the shared
  four-output helper unchanged. Literal TS→JS map is launcher-observation,
  node-path, process-observation under internal-production and product-compiler/
  canonical-json; preserve relative .js/fixed adapter imports, record original/
  translated hashes and canonical URLs, and declare manual fixture-only metadata.
- [x] Step3: implement minimal coordinator and scope paths after RED:
  const tokenRecord = { originalLoaded, originalDefinition, stage:'enrolling',
    revoked:false, pending:new Set(), nativeScope:null, definitionScope:null };
  // Register private original before sealing; no token factory/public output.
  // Retain each returned scope BEFORE fallible post-entry checks.
  // For every direct admitted participant port:
  assertBoundJointToken(); const originalResult = ownedPort(); assertBoundJointToken();
  // burn marks token revoked normally, then existing local refusal/settlement.
  // Scope settlement is permitted ONLY at genuine settled/settling stage.
  // Distinct settlement helpers allow genuine pending0 revoked scope release,
  // never restored validity, effect permission or FD disposal.
  Fixed operation performs both original full checks with both activities held;
  it returns void only after actual original work settlement. No native method call.
- [x] Step4: qualify concrete faults with actual provider originals:
  burn native during a direct definition FD read -> next direct definition port0;
  burn definition during a direct native bundle read -> next direct native port0;
  public acquire/assert/close reentry wrong-arity/foreign/proxy -> traps0/disposals0;
  foreign/copied/query-instance token or scope -> traps0/outer resource ports0;
  failed second enrollment retains first scope and refuses premature settlement;
  pending import original/consumer response loss -> no participant settlement;
  cache/module/definition bytes/material/source drift -> sticky revocation/no retry;
  captured unpublished mint/seal loss -> no authenticated scope;
  reverse once-close/response loss/reused descriptor -> no duplicate disposal;
  successful fixed qualifier returns undefined, exports no token/path/method/callback.
  Explicitly distinguish trusted nested composite work from direct port counters;
  an internal port after opposite burn earns no universal inhibition claim.
- [x] Step5a: affected native/definition/material controls, strict1193+new files
  noEmit with shared deps, syntax/contracts/diff. Full build remains clean-main only.
- [x] Step5b: final reviewed delivery, not whole-branch completion:
  Two final exact-byte source/evidence reviews. Root stages only File Map, normal
  scoped commit/push and append-only PR delivery (body capacity currently2048B;
  use a normal evidence comment if necessary, never truncate prior evidence).

Qualification checkpoint (2026-10-09, before delivery): final adapter96a3d441,
nativee50a2a26, launchera1f3bb0c and declarationfe02b166. Four causal REDs
preceded fixes: Set construction swallowed preparation burn (54f39a/AelZlF),
last definition FD pass changed cache (5b5dc7/54OFmA), liveToken stage includes
swallowed revocation admitted one direct port (99fbf4/A0yhGL), and unrecovered
scope identity admitted the second begin (cb0c9f/uAoiyo). Fixes respectively
recheck preparation after allocation, validate cache after all resource work,
recheck sticky liveness after includes, and authenticate retained scope response
before next enrollment. Missing cache-only interface also RED f42a32/uoZBRx.

Final four disjoint campaigns:6+5+10+3 =24 distinct cases,0F; one API-only repeat
after normalizing the test's TypeScript package lookup is NOT a25th case.
Historical test pins d45bae7b/9f83671d/410bdd38/e7bc04c7 reconstruct exactly from
final cbc48ee5; shared helpers and earlier bodies unchanged except explicit
absolute-to-normal dependency lookup correction. Finite compiled-path fixture
uses shared TypeScript5.9.3/transpileModule, not a production build. Root readback
fedbbb verifies25 original intent/result/snapshot receipts,147 inert commands,
63 exact C stdin blocks/native methods0. Direct88,935 versus trusted composite
6,136,365 recorded FS rows are classification, NOT complete Task4 per-port proof.
Resource-case stdout has one additional diagnostic-file composite close after
the original snapshot; both hashes/delta are retained, not silently conflated.
Thirteen affected native controls pass (4337e0/4b432f).
First5 native controls used earlier adapter046aaa80, next8 final96a3d441;
nativee50 unchanged, exact delta touches only joint enrollment paths absent from
those5 original programs. Per-case copied adapter pins are in controls index;
do not claim all13 used the final complete graph.
Approved-definition full32 pass (1e2110). Earlier approved test31P1F was a missing private renderer import
rebase, not production RED; first path-contract refusal was a testhost absolute
TypeScript require, corrected to ordinary package resolution. Explicit readonly
NODE_PATH/sharedtsx qualification does NOT establish writer dependency closure.
Strict1194/0 noEmit342c4e, version/English33bd24 and path999/migration7da4d4 pass.

Original evidence and limits:
logs/2026-10-09-dashboard-cutover-joint-original-operation.md,
logs/2026-10-09-dashboard-cutover-joint-original-final-index.json and
logs/2026-10-09-dashboard-cutover-joint-original-controls-index.json in canonical
workspace. No entire npm suite, genuine compiler/native image, full build,
main synchronization, merge or live3333 credit. Step6 is still the complete
Task4 six-effect adapter/controller/legacy-owner-pre32-phase-intent/foreground
closure followed by reviewed integration, genuine clean-main build and host proof.

Task4i.5 delivery verified: root ordinary ten-file commit8f816103/forwardpush;
two final C0/I0/M0 independent all25joint/13native/32approved original gates.
PR280 remains OPEN DRAFT exacthead, scannerSUCCESS04:04:20UTC. Append-only
comment6074026030 exact2762B/02d32fbf; previous63488B/a94ff9b9 body intact.
No main synchronization or whole-branch completion clearance.

## Task4i.6: hold real pre32 transaction inside bilateral original work

Goal: qualify original database custody that every later effect requires, not
return another DATA conjunction or grant a service/native capability.
Architecture: fixed second coordinator route reuses original preparation/token/
enrollment machinery; operation-scoped launcher privately enters the existing
real pre32 provider. Its continuation is fixed source code, not caller work.
Spec: paired Task4i.6 section. Tech: existing Node26 ESM/TS and readonly PG provider.
Root only writer/delivery; independent readers perform design/evidence review.
Standing authority covers this causal in-goal resource composition. Preserve all
previous source-only limits, original worktrees/files and same service ports.

File Map, exactly six paths:
- scripts/deployment-dashboard-cutover-adapter-v2.mjs: fixed pre32 route and
  original scope/query/operation occurrence custody; no caller mode/callback.
- scripts/deployment-dashboard-cutover-adapter-v2.d.mts: exact three signatures.
- scripts/__tests__/deployment-dashboard-cutover-adapter-v2.test.js: local finite
  fifth TS→JS census bridge; bounded event/counter receipts for the new cases,
  actual compiled census module with private WeakMaps, driver/journal/finding
  boundaries explicitly doubled. Preserve all historical receipts and old helpers.
- src/internal-production/baseline-deployment-cutover-launcher-observation-v1.ts:
  fixed operation-scoped pre32 continuation, callback/outer original custody and
  settlement refusal on unresolved/unknown original work.
- This plan and paired spec. No PG-provider/C/native/CLI/service/package changes.

Interfaces (all fixed arity):
qualifyHeldDashboardCutoverJointPre32OperationV4(loaded:object,definition:object):Promise<void>;
runHeldDashboardCutoverApprovedDefinitionOperationPre32V4(scope:object):Promise<void>;
executeDashboardCutoverJointPre32AssertionsV4(token:object,definition:object,scope:object):Promise<void>.
Keep existing no-PG qualifier behavior and same shared once-only attempt; route
is a source literal chosen by fixed exports, never a caller flag. Actual scope
authentication is the canonical compiled census module's existing assertion.

- [x] Step1: independent exact interface/lifetime nomination before code. Resolve
  pending original import/callback/query/outer response, scope authentication,
  active-first reentry and revoked-but-known cleanup. No presumed driver death.
  Two independent C0/I0/M0 at spec19a82e6d/plan9d9255a3; explicit hidden-final-
  query rejection staysUNKNOWN and fourth causal timing case required.
- [x] Step2: one genuine missing-interface RED before production, resources0:
  assert.equal(typeof adapter.qualifyHeldDashboardCutoverJointPre32OperationV4,
    'function','MISSING_FIXED_JOINT_PRE32_OPERATION');
  assert.equal(typeof adapter.executeDashboardCutoverJointPre32AssertionsV4,
    'function','MISSING_FIXED_JOINT_PRE32_ASSERTIONS');
  assert.equal(typeof definition.runHeldDashboardCutoverApprovedDefinitionOperationPre32V4,
    'function','MISSING_FIXED_DEFINITION_PRE32_OPERATION');
  Retain actual program/intent/result, natural0-or1/signal/EOF/close and exactpins.
  Actual4265950P1F380.735958ms/a16tTQ; all3undefined in one deep literal assertion.
  Rootc7977f verifies1/null/errornull/EOFclose and0commands/ports/native,5bridges/
  9manualoutputs. Source96a3/a1f3 unchanged; test5a9ae9b0. API-only RED, notPG.
- [x] Step3: minimal fixed resource implementation after RED. Register original
  occurrences before invocation and retain returned native promises before await:
  occurrence.intent=true; pending.add(occurrence);
  occurrence.promise=fixedSourceOwnedOperation();
  // Unrecovered original/response is unknown, never synthesized settled.
  await occurrence.promise;
  // Only actual settlement observer removes the original pending occurrence.
  Private launcher callback retains its ORIGINAL work before body observation;
  driver rejection burns first, notifies shared token and does NOT settle callback.
  Final source/definition/native-cache cutpoint follows actual settled originals.
  Definition settlement additionally refuses unresolved/unknown pre32 custody.
  ANY invoked pre32 bridge rejection/lost response is sticky UNKNOWN at local
  definition AND coordinator: the provider's final post-continuation query is
  hidden custody without a public completion witness. No SETTLING on failure,
  even after visible callback/query settles; no retry/guessed resource release.
- [x] Step4: three actual-resource GREEN/fault cases with independently literal
  expectations, not fake PG scope. Healthy: original READ COMMITTED READ ONLY,
  exact36 SHARE statements, original scope authentication, bilateral assertions
  while transaction held, actual callback+outer settlement before scope release.
  Fault: suspend one genuine assertion query, lose outer driver response, prove
  both activities retained/FDdisposal0/normal subsequent directports0; release
  that SAME original query and observe actual rejection/settlement, permanent
  refusal/no retry. Add only causal negatives found by independent review.
  Second causal timing window: our helper/callback has returned, suspend the
  actual census provider's final query and lose outer driver response. Prove
  both participant fences/FDdisposal0 even though our callback is already settled;
  release SAME original final query, retain unknown composite/no retry forever.
  Bounded selected events/counters/hashes, not millions of duplicated FS rows.
  Final7P0F145120.07425ms includes API, three resource cases and three causal
  review corrections. Short synchronous checks cover initial/configuration/
  final; original promises remain in append-only private history after pending
  removal. Genuine REDs OpRfMf/lMYBFm/81xjdp; unarmed11JaIf is setup failure.
  Final source adaptere0685287/launcher32384f38/d.mts950de098/testdea600da;
  earlier4P0F at e7afe4c1/e42dbec9 is historical, not final-graph credit.
- [x] Step5: affected no-PG joint API/healthy custody controls, approved/pre32
  controls, strict noEmit/shared tools, syntax/contracts/diff and two independent
  exact-file/original-evidence gates. Only proportional focused cases; disk7.1GiB.
  Shared fixed-route factoring may relocate record allocation: rebase existing
  Set-construction fault oracle to actual source-owned frame and rerun it. Preserve
  no-PG behavior, no census import/PGopening on old fixed route; no caller mode.
  Ordinary scoped commit/push and append-only PR evidence. Full build still only
  genuine clean main; no source fixture is a native/backend/host proof.
  Verification checkpoint: no-PG6P0F63387.798584ms, approved32 plus pre32
  harness20=52P0F9034.30075ms, strict1194/0/noEmit; syntax/version2.3.79/
  English1992/path999/migration/diff. Explicit readonly shared dependencies,
  not writer dependency closure. Root reread all final7+old-route6 originals
  (program/intent/result/snapshot) and32 approved child receipts. Final7 have
  42 inert child commands/18 exact V4 C inputs and five literal translations/
  nine manual outputs. Old-route6 have four translations/eight manual outputs,
  absent census bridge,21 inert commands/nine exact C inputs. EOF/close natural,
  actual:false/native0. Final6 bounded snapshots differ from printed stdout only
  by one diagnostic trusted-composite close counter; old3 resource snapshots
  similarly have one diagnostic close row. All nominated six direct counters
  unchanged in both loss windows; not universal composite inhibition. Final
  provider query timing is source-derived, not private-settlement telemetry.
  Durable private indices in canonical logs:
  2026-10-09-dashboard-cutover-joint-pre32-final-index.json and
  2026-10-09-dashboard-cutover-joint-pre32-controls-index.json. Two correction
  source gates and focused evidence gate C0/I0/M0; final exact-six-file delivery
  gates and scoped commit/push were pending at this checkpoint. Both final gates
  C0/I0/M0 followed; normal6-file delivery826ff24e and exact-head PR280 security
  SUCCESS04:50:10Z. Commit/body/evidence comment6074500557 confirmed afterward
  in private ledger. No whole Task4/host/build qualification.

Remaining route after this resource bridge: true reservation/current owner and
finite cooperative legacy/queued/stale-unlink exclusion, selected-build/selector
originals, changing V2 phase and durable ordinal intents, all six fixed effect
dispatches, Task3 controller/reconciliation and Task5 authenticated foreground
entry. Then reviewed whole delivery, genuine clean-main build, current declaring
job/native/control/birth and3333 listener/HTTP acceptance. Do not relax V1 idle/
absence predicates or invent a global-hostile-runtime prerequisite.
- [ ] Step6: qualify complete Task4 actual capability separately before Task3:
  no owner/legacy/pre32/phase/intents/selector/restoration/control/foreground
  predicates may be replaced by this operation token or a fixture boolean.

## Task4i.7: retain owner-bound actual ROOT reservation under pre32

Goal: perform existing absent-only first-generation ROOT publication inside
genuine bilateral pre32 work, bound to actual owner/OPEN intent; retain originals,
not return a DATA conjunction or grant six-effect authority. Architecture: one
fixed new adapter route, owner-private authentic metadata/occurrence record and
same actual first-generation parent check/child machinery. Spec: paired Task4i.7.
Tech: existing Node26 ESM, shared readonly TS fixture translation, existing atomic
Python leaf. Root only writer/delivery; readers nominate and independently review.
Standing delegated design choice applies; no user reconfirmation or live entry.

File Map exactly nine:
- scripts/deployment-dashboard-cutover-adapter-v2.mjs: fixed3-input route,
  canonical owner/provider imports, originalOwner/token assertion, invocation
  between two actual PG assertions and retained original promise.
- scripts/deployment-dashboard-cutover-adapter-v2.d.mts: adapter exact signatures.
- scripts/__tests__/deployment-dashboard-cutover-adapter-v2.test.js: retained
  original fixture coupling, finite extra owner translation closure, bounded
  actual wire/child/fence counters and precise doubled boundaries.
- scripts/deployment-cutover-owner.mjs: fixed owner-owned operation deriving
  actual OPEN cutover hash, resource-free immutable-input identity assertion,
  original import/acquisition/returned handle retention and active-first legacy
  wrappers; no canonical published history or existing source guard bypass.
- scripts/__tests__/deployment-cutover-owner.test.js: new retained original
  missing-interface/foreign/mismatched-OPEN cases; no lost RED via old cleanup.
- scripts/deployment-dashboard-cutover-first-generation-v2.mjs: same atomic
  parent with private joint fence/lifetime, original public legacy guards,
  exact bracketed one-lock-member physical integrity; no Python mutation.
- scripts/__tests__/deployment-dashboard-cutover-first-generation-v2.test.js:
  genuine sibling acceptance RED and new fixed-interface/retained-child controls.
- This paired plan/spec. No launcher/PG/Python/C/CLI/service/package edits.

Interfaces: fixed3-input reserveHeldDashboardCutoverJointFirstGenerationV4;
adapter assertDashboardCutoverJointOwnerTokenV4(token,owner); owner fixed2-input
reserveDeploymentCutoverFirstGenerationWithOwnerV4(owner,token) returning void
and assertDeploymentCutoverJointReservationMetadataV4(token,input); provider
fixed2-input acquireFirstGenerationDashboardCutoverJointReservationV4(input,token)
returns its actual private opaque handle internally, and fixed1-input
assertFirstGenerationDashboardCutoverJointReservationV4(token). Exact types and
lifetimes in spec. No caller callback/mode/hashes/URL/path or returned capability.

- [x] Step1: root self-review and two independent exact nomination gates before
  implementation. Canonical source/private WeakMaps, old route lazy-import
  compatibility, true cutover-vs-maintenance hash, child composite and unknown
  retention must be explicit. Preserve approved bounded scope and no live entry.
- [x] Step2: missing fixed interfaces RED before resources; retained original:
  assert.equal(typeof adapter.reserveHeldDashboardCutoverJointFirstGenerationV4,
    'function','MISSING_OWNER_BOUND_ROOT_RESERVATION');
  Also original old provider sibling fault (not missing API):
  const h=await provider.acquireFirstGenerationDashboardCutoverReservationV2(input);
  fs.writeFileSync(root+'/unexpected-sibling','evidence',{flag:'wx',mode:0o600});
  assert.throws(()=>provider.assertFirstGenerationDashboardCutoverReservationV2(h),
    /DASHBOARD_FIRST_GENERATION_RESERVATION_REFUSED/);
  Run each new focused pattern with fixedNode26/sharedNODE_PATH; keep original
  program/intent/result/source pins and naturalEOFclose before source edits.
- [x] Step3: implement smallest fixed original producer after RED. Retain actual
  provisional owner operation BEFORE first import or owner/source/OPEN composite,
  then immutable input BEFORE acquisition; owner checks actual
  OPEN relation rather than two hash labels. Private input identity authenticates:
  if(record.input!==input||record.token!==token||!record.held.valid)refuse();
  Record actual returned reservation handle before assertion/fallible observation:
  record.promise=provider.acquireFirstGenerationDashboardCutoverJointReservationV4(input,token);
  record.reservation=await record.promise;record.returned=true;
  // A lost return is UNKNOWN; never guessed settled or closed.
  Every parent check consults resource-free original owner/token guards; public
  legacy reentry burns before parsing, while internal fixed checks remain usable.
  No arbitrary callback/per-port recursive source/PG read or source guard bypass.
  Causally required refinement after original import-window RED CLaQL0: the
  coordinator embargoes both participant live-token ports while the original
  owner operation is pending, including before its canonical adapter response.
  Owner/provider guards stay resource-free and usable. Only successful original
  owner return lifts this embargo; rejection/unknown cannot. Same nine-file map;
  no static legacy import, new callback/export or weakened guard. Actual copied
  scope assertions dispatched FS in the RED despite local owner burn; preserve
  that receipt separately from API-only missing-interface failures.
- [x] Step4: healthy actual owner/OPEN/claim/provider/scope fixture wire proves
  actual cutoverIntentHash (not maintenanceIntentHash), publication while PGheld,
  exact one-member ROOT and same original reservation; zero six-effect calls.
  Suspend SAME original child, lose original PG driver or burn owner, snapshot
  all nominated parent counters/disposals, then release child and prove late
  original settlement/publication cannot retry/release/close. Wrong actual owner
  namespace and mismatched OPEN maintenance must precede reservation dispatch.
  Swallowed wrong-arity/proxy legacy reentry during actual OPEN/source preflight
  must burn without traps and prevent subsequent reservation dispatch; trusted
  observer interiors are not falsely claimed as joint-inhibited.
  Compare wire to independent actual OPEN bytes/durable claim, and prove actual
  cutover/maintenance/plan hashes distinct. Source-fault spread-copy at genuine
  owner-to-provider call must fail with SAME token/owner before first parentport;
  authenticate original identity separately from provider snapshot value copy.
  Suspend child BEFORE publication (not merely exit); model later publication
  explicitly if doubled, with external oracle reads excluded from parent counters.
  Add complementary child-success→actual hidden-final-PG-query loss case, then
  release SAME query and show legacy invalid/proxy calls remain refused with no
  parent ports/traps/disposals. Existing owner import initialization reads are
  distinct from owner acquisition/PG/ROOT; never claim all loader FS0.
  Retain all original receipts; real vs doubled Python authority kept separate.
- [x] Step5: affected old-route custody, current52 approved/pre32 controls,
  owner/first-generation proportional controls and strict noEmit/syntax/contracts/
  diff. Bound resource snapshots; do not replay large old native campaigns.
  Two independent exact-nine-file/all-original gates; normal scoped delivery
  and append-only PR evidence. Genuine fullbuild only after whole reviewed main.

Task4i.7 pre-delivery evidence: final11P0F300376.200916ms (API, actual owner/
OPEN control, healthy reservation, wrong namespace/crossed OPEN/swallowed owner
preflight, original-input COPY, first import embargo, untouched child/final loss
and separate pending reentry). Canonical private owner-root-final-index.json;
262 copied pins/104 literal TS bridges/148 manual outputs/67 inert or explicitly
doubled commands/27 exact decoded C inputs/nativeCalls0. Root independently
read all originals, actual canonical OPEN/claim/ROOT bytes and12 retained live
parent FDs. One COPY counterfactual source graph is not healthy production
qualification. Owner-source first import causal RED CLaQL0 preceded embargo
fix; current GREEN denies both captured genuine scopes with identical counters.
Old joint/pre3213P0F221545.019ms; actual no-joint Python controls22P0F2022.273167ms;
owner34P0F4186.178334ms; approved+pre32 harness52P0F8323.222959ms. Seventy-nine
current retained original receipts independently read; legacy owner/harness
aggregate controls do not invent child receipts. strict1194/0noEmit and contracts
pass; no real build/native image/real PostgreSQL/backend death/host clearance.
Step5 delivered c6e93fb19b2733b0c679883b72fd1f0c9143fcc8 after two independent
exact-nine-file/all79-original C0/I0/M0 gates and fresh strict/syntax/contracts.
PR280 exact-head security SUCCESS; comment6075321816 exact readback3558UTF8B
SHA c006b116c58d0f2dea8bfb59fa8f93bfb7f927383ae5efbd8e0bb0b95ada4150.
OPEN DRAFT/reviews empty, not whole-branch merge or live/build clearance.

After this slice: positive execution-owner PG+physical coupling and finite
cooperative legacy/root-monotonicity, selected-build+selector, changing V2 phase
and actual durable intents, complete six-effect adapter, controller/reconciliation,
authenticated foreground, reviewed integration/clean-main build/current3333 proof.
No source-only reservation test can replace those outcomes.

### Task4i.8: actual canonical local JS and child drain before pre32

Goal: prevent the owner-bound reservation route entering PG/ROOT while this
canonical registry still owns a producer or nominated execFile child. In-goal
causal requirement: uninstall/teardown writers may need PG writes, so acquiring
pre32 SHARE locks before draining their originals can deadlock the cutover.
Other original/pre32 routes stay unchanged; no full legacy freeze authority.

File Map (exact four files):
- Modify scripts/deployment-dashboard-cutover-adapter-v2.mjs: reservation-only
  canonical lazy import; private draining stage and original JS/child custody;
  resource-free genuine-handle checks before subsequent nominated cuts.
- Test scripts/__tests__/deployment-dashboard-cutover-adapter-v2.test.js: one
  finite registry TS bridge in owner fixtures; actual held-producer ordering,
  unknown-child refusal, finite owned real-child control and pending reentry.
- This paired plan and docs/superpowers/specs/2026-10-07-preserved-dashboard-cutover-v2-design.md.
No registry/owner/provider/launcher/PG/native/Python/CLI/package/service edits.

Interfaces consumed (canonical existing compiled module only):
acquireDashboardCutoverLocalProducerDrainV2():Promise<object>;
assertDashboardCutoverLocalProducerDrainV2(handle:object):void;
acquireDashboardCutoverLocalChildDrainV3(jsHandle:object):Promise<object>;
assertDashboardCutoverLocalChildDrainV3(handle:object):void.
No new public interfaces or caller-supplied module/promise/handle/ports.

- [x] Step1: root inline spec/plan self-review and independent nomination gates.
  Exact fixed URL ROOT+'/dist/internal-production/baseline-dashboard-cutover-local-producer-drain-v2.js';
  authenticate bilateral scopes, then enter private draining stage before JS
  acquisition. Genuine participant live-token ports reject this stage. Retain
  original native promises and fulfilled handles BEFORE fallible post-checks.
- [x] Step2: actual ordering RED before production edits. Register an async
  producer with a held original native promise in SAME canonical module:
  let finish;const original=new Promise(resolve=>{finish=resolve});
  const producer=local.withDashboardCutoverLocalProducerAsyncV2('workflow-uninstall',()=>original);
  const reservation=adapter.reserveHeldDashboardCutoverJointFirstGenerationV4(loaded,approved,actualOwner);
  // Observe actual fresh-entry refusal OR actual first PG open, not timer success.
  // Snapshot BEFORE releasing same original; always settle it before assertions.
  assert.equal(before.open,0);assert.equal(before.reservationSpawns,0);
  assert.equal(before.freshEntryRefused,true);
  Explicit unknown execFile return must refuse before PG/ROOT after JS settles;
  do not claim a process double as executed-child authority. Retain all original
  program/intent/result/pins/EOF-close records; setup failures are separate.
  Run fixed Node26 builtin test with shared NODE_PATH and literal esbuild loader:
  node --test --test-name-pattern='local drain' scripts/__tests__/deployment-dashboard-cutover-adapter-v2.test.js
- [x] Step3: minimal source after genuine RED. Prepare canonical registry only
  for reservation; after enrollment set stage='draining'. For each fixed JS then
  child occurrence retain intent, same native promise and actual fulfillment
  value before validation; child consumes SAME authentic JS handle. Authenticate
  both with canonical assertions before marking ready/working or invoking pre32.
  checkOperation resource-free checks ready handles; failures burn and retain
  unknown originals, no cleanup/refresh/retry. No asynchronous checking flag or
  new generic callback exported to production callers.
- [ ] Step4: fresh focused GREEN plus old original/pre32/reservation controls,
  existing local drain consumer regressions, strict noEmit/syntax/contracts/diff.
  Real owned Node child must naturally complete original exit+close and both
  streams; no signal/cancel or unobserved timeout counted as drained. Pending
  drain reentry must deny before proxy traps/PG/ROOT and keep sticky lifetime.
  Root and two independent reviewers read exact changed bytes and retained
  original evidence. Actual build is still not replaced by manual TS/noEmit.
- [ ] Step5: normal scoped commit/push and append-only PR exact-head evidence;
  update private handoff. Continue remaining positive execution-owner coupling,
  finite cooperative old-process/root exclusion, phase/effects/controller/entry
  and reviewed clean-main+native/current-host proof, not Task6A.

Task4i.8 evidence before final delivery: baseline source5005b836 five genuine
ordering/unknown-child/ready-generation controls0P5F189136.438459ms, root-read
originals KqmplK/RAVJAr/y1h5vA/8WJoDE/p7gkZm. Corrected actual-child original
gcHRSg0P1F38953.840292ms includes natural exit/close/stdin/stdout/stderr closure;
earlier y1h5vA snapshot was partial, not equivalent leaf qualification.
Current adapter91747147 fiveGREEN5P0F161481.350333ms plus two supplementary
GREEN2P0F55195.146292ms: genuine captured pending scopes (zero direct-port
deltas) and actual intrinsic observer installed then response loss (SAME native
promise later fulfills, authentic original handle retained, unknown sticky,
child intent false, PG/ROOT0). Two literal source-fault test graphs first prove
the supplementary oracles: working-before-drain and dropping fulfillment fields,
0P2F71029.859917ms; no production reset/revert or healthy graph credit for them.
Exactly7current retained originals independently read:182copied source pins/
77literal TS bridges/105manualoutput entries, one actual owned Node child leaf;
PG/Python/native doubles remain explicit. Private local-drain-final-index.json.
Old-route/currentpre32/owner13P0F340319.549208ms original readback;
existing localJS/child/Medic/gateway59P0F2223.755875ms aggregate with retained
original children only where actual harness wrote them. Strict1194/0noEmit and
contracts2.3.79/English1992/paths999 pass, not actual build. Final exact-four-file
independent review/fresh gates/normal delivery still pending; no whole Task4,
positive execution-owner coupling, finite legacy freeze, six-effect/entry/host
or3333 authority. Same four-file map; no new public production API.
