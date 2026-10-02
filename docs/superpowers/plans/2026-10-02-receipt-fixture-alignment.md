# Receipt Fixture Alignment Implementation Plan

> **For agentic workers:** Root implements inline; use TDD, isolation, verification
> and independent read-only review. User sole-writer instruction overrides
> delegated implementation. Unavailable executing-plans skill uses this inline checklist.

**Goal:** Repair the genuine stale receipt fixture boundaries without production changes.
**Architecture:** Existing copied-source fixtures keep exact operations and safety
assertions; align hooks to delivered consume-before-close/drain-all cleanup.
**Tech Stack:** TypeScript, Node26.4.0, tsx/esbuild, isolated fixture roots.
**Spec:** docs/superpowers/specs/2026-10-02-receipt-fixture-alignment-design.md

## Global Constraints

- Root sole source/Git writer; agents read-only; one fix/receipt-fixture-alignment branch.
- Preserve every old root/journal/build/dependency/worktree and user dirty file.
- No application production/package/dependency changes, native/host-service/primary-DB mutation or guard bypass.
- Task9 permits only the existing ordinary private test constructor's fixed receipt mode;
  one fresh owned private cluster requires separate exact-epoch pre-effect review.
- Original outerUNAVAILABLE/ALLUNQUALIFIED never substitutes for current qualification.
- Fixed Node26.4.0, unset ambient PG/admin/NODE_OPTIONS/NODE_PATH on focused tests.
- No protected or host acceptance inferred from copied fixtures or ordinary build.

## File Map

Modify only tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
plus this plan and its spec. Consumers already exist; no production interface changes.
Task9 additionally modifies scripts/run-private-postgres-tests.mjs (fixed mode only)
and scripts/__tests__/private-postgres-test-cluster.test.js (existing boundaries).

## Task 1: Exact export ABI

- [ ] Run genuine P4 preselection and P ABI consumers unchanged; confirm59vs58
  and single diagnostic against empty-filter RED.
- [ ] Update helper: total59; additions = original5 plus one explicit capture;
  require original5 and capture each exactly once; keep historical53/hash literal.
- [ ] Add negative test on actual source inventory: first establish positive
  contract, remove/duplicate/rename capture, append arbitrary extra, swap two
  historical names; each assert.throws(assert.AssertionError).
- [ ] Change P name-filter expected only to literal[capture], retain full filter.
- [ ] Rerun the three focused tests with0fail.

Code shape:
```ts
const capture = "observeInternalProductionTask6aOriginalOwnerReceiptCaptureNoWriteV1";
assert.deepEqual(names.filter(name => name === capture), [capture]);
const historical = names.filter((name): name is string =>
  typeof name === "string" && !additions.includes(name) && name !== capture);
```

## Task 2: Genuine copied-fixture boundaries

- [ ] Run unchanged P4a disposition temp-create/close, Q0 prior/Q4 writer-close,
  resume clean/paired/owner-close and contention selections; record exact RED.
- [ ] P4a replaceOnce unique existing close fault seam:
```ts
const marker = 'exactPoisonRecoveryPublicationFaultV1(phase, ordinal, "close");';
// Keep marker then append p4ExactPoisonRecoveryLeafBoundaryV1("close").
```
- [ ] Q bound full acquire region; require unique full aggregate statement.
  Keep it byte-identical; append existing target-writer-close probe after statement.
- [ ] Resume replace bounded exact rootReader final callback with itself then
  async ordinal recording/fault callback. No firstError reference introduced.
```ts
async () => {
  if (p5cSPostEffectOrdinal !== 0) {
    p5cSPostEffectProbe!.postEffectOwnerCloses.push(p5cSPostEffectOrdinal);
    if (p5cSPostEffectOrdinal === 2 && p5cSPostEffectProbe!.freshCloseFault)
      throw new Error("P5C_S_POST_EFFECT_CLOSE_FAULT");
  }
}
```
- [ ] Contention marker includes literal primaryError declaration before try.
- [ ] Rerun exact existing scenarios; retain all action/frontier/resource/order
  assertions. Any newly exposed RED gets causal source investigation before repair.

Run command skeleton (exact pattern recorded per invocation):
```sh
env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL -u NODE_OPTIONS -u NODE_PATH /opt/homebrew/Cellar/node/26.4.0/bin/node --import tsx --test --test-concurrency=1 --test-name-pattern='^OA17 zero-input current Setfarm source/build observation (P4 freezes exact-poison preselection literals, prepare ordering, and the final selected-store source map|P5c-P linearizes A/B prepared topology with the common zero fence and preserves selector/publisher choreography|P4a exact-poison recovery leaf retries disposition after (temp-create|close) response loss|P5c-Q-A classifies Q0 with 0 candidates as prior|P5c-Q-A closes the CAS parent guard when the owned target-writer close throws after Q4|P5c-S holds one selected controller through clean, paired-primary, and owner-close resume exits|P4c exact-poison overlay recovery survives response loss and concurrent publication)$' tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
```
Selection is focused evidence only, not full-suite acceptance.
AggregateError/cause/isolation RED exposed after setup remains unresolved and
blocks acceptance/delivery until actual stacks and a separately reviewed refinement.

## Task 3: Review and next causal slice

- [ ] Diff source/production unchanged, no narrowed safety assertions.
- [ ] Independent read-only spec+quality review exact committed range.
- [ ] Record all remaining292original groups and newly exposed failures in ledger;
  map structured cause projection, fresh-child isolation/static exact vector repairs
  into subsequent scoped refinement rather than claim first slice fixes all.
- [ ] Before PR delivery full receipt suite and adjacent tests must pass.
- [ ] Commit scoped conventional changes; clean guarded build; normal PR/review.
- [ ] Fresh merged epoch/per-invocation review before new qualifying whole ALL.

## Preflight self-review

Tasks1/2 share one test file but root runs serially. Task3 consumes both diffs,
does not claim project acceptance. Exact59contract and response-loss-vs-OS-cleanup
distinction agree with spec. No cleanup-latch reset or privileged effect is mapped.

## Execution ledger, 2026-10-02 01:11 UTC

Independent ACTUAL original retirement C0/I0/M0; old epoch remains immutable and
UNQUALIFIED. Independent exact docs/eight-consumer scope review at0d7b89ff C0/I0/M0.
Baseline outer81317 exited1: eight intended RED assertions (36.94s), not env errors.
New negative export test exited1 on59vs58 before helper repair.
Export cycle97300 exited0:3P0F/zero cancel+skip,1339.9065ms.
After hook repair60447 exited1:5P0F among non-Q cases, two Q fixture parse errors.
Root's newly introduced replacement-string expansion of literal $& at source9308
was fixed with an outer replacement callback, not a production change.
Q39629 exited0:2P0F/zero cancel+skip,2108.894084ms, actual assertions reached.
Contention30619 exited0:1P0F/zero cancel+skip,36050.869667ms.
Adjacent capture/actual-body cleanup26476 exited0:132P0F/zero cancel+skip,
1520.570583ms. All output read; no retained FD/process/private cluster assumed.

Independent current first-slice diff C0/I0/M0, testSHA
731e063f2c4fbd6e1ba92b27f6956f4233705da2dabe7a397d63ee9f99bcad9c.
These are nine distinct focused tests across causal cycles, NOT full receipt/ALL
acceptance. Remaining projection/isolation/static RED plus explicit mutation
witnesses are unresolved and block PR delivery/broader acceptance. Source-level
alignment is reviewed; no protected/host/service/DB acceptance follows.

## Task 4: Selected-pass causal projection and fresh physical case isolation

Files: same receipt test and this spec/plan. Production remains unchanged.
Consumes actual selected-owner18286 aggregate and helper5494–5517; produces
test-only phase-labelled recursive error trees and independent physical cases.

- [ ] Reproduce both original selected-pass/paired consumers on b6e60434;
  expect exact nested-sentinel-loss RED, not environment/import failure.
- [ ] In existing selectedPassOpenWrapper add local recursive projector:
```ts
const projectError = (error: unknown): unknown => ({
  message: String(error),
  causes: error instanceof AggregateError ? error.errors.map(projectError) : [],
});
```
- [ ] Every existing operation/owner-close/controller-release catch pushes its
  phase/tree in observation order. Keep legacy message but never drop new tree.
- [ ] Move12fault/2paired invocations to fresh createFixture/configure/seed root
  per input and real child. Keep clean6bindings batched; measure FD0 per faultchild.
- [ ] Assert exact single close aggregate or primary-first paired aggregate and
  exact separate release-uncertainty leaf, plus old reverse/once/unopened checks.
- [ ] Assert six postclosed-method refusals for returned close-fault owners;
  no fabricated postclose owner for acquisition failures. Do not infer diskzero.
- [ ] Rerun both consumers GREEN; no latchreset/controller unlink workaround.
- [ ] Independent exact diff review, then causal slice commit with actual outputs.
  Broader remaining RED/fullreceipt/mutation witnesses still block PR acceptance.

Task4 actual ledger01:21UTC: independent requirements C0/I0/M0 (spec66ac99d3,
plan2cd57be7); same exact two-consumer effect review C0/I0/M0. Original replay52867
outer1/0P2F4797.204958ms confirms both expected nested-cause-loss assertions.
After minimal test-only projection/isolation repair98938 outer0/2P0F/zero cancel
or skip31156.020417ms: clean six bindings plus12independent fault roots/children,
and2independent paired roots/children. Exact error phase/cause/order, reverse
close/once/unopened/post-close refusal and each faultchildFD0 all executed.
Independent actual diff C0/I0/M0 at testSHA
f878f1257da5bd3d71ff911f64b5fbc09b19c96acaf896e2d686b4e990461dec.
Only focused Task4 evidence, no full receipt/ALL, diskzero or protected acceptance.
Lost-phase/cause/order and P4/Q before-cleanup mutant witnesses still pending.

## Task 5: Delivered cleanup consumers, exact vectors and inventory

Same File Map; causal necessity is the nine actual static RED consumers at
2f8887e4 (0P9F, outer1,327.953958ms). Root implements; agents only map/review.

- [ ] Read each complete failing assertion region and bounded delivered body.
- [ ] Replace obsolete inline first-error/nested-finalizer assertions with exact
  ordered sync/awaited async callback vectors and construction primary arguments.
- [ ] Inspect sequential drain-all helper bodies, aggregate ordering and sticky
  uncertainty; retain all unrelated authority/ABI/no-write assertions.
- [ ] Fix selected-owner terminal-before-cleanup assertion's vacuous search by
  bounding returned close and acquisition catch separately.
- [ ] Add explicit single diagnostic pinned-chain call-site inventory while
  retaining all nine legacy identifiers and selected-effect graph prohibitions.
- [ ] Run all nine consumers; classify any newly reached RED before repair.
- [ ] Independently review exact diff; actual-body/copied-fixture mutation
  witnesses and remaining runtime failures block broader delivery.

Branch build at2f8887e4 actually refused HEAD!=origin/main. Keep this guard;
qualifying clean-main build follows reviewed PR merge, never an origin/main
repoint, dirty-build flag or direct-main commit.

Task5 actual ledger01:40UTC: original nine static consumers0P9F. First alignment
7P2F exposed nested and retained-next retired finalizers; second7P2F exposed
selected and raw retired finalizers; exact vectors repaired after reading each
actual body. Third actual9P0F/zero cancel+skip outer0,1039.873ms; repeated9P0F
outer0,650.99825ms after helper strengthening. Production stays unchanged.

Independent review found two strictness gaps in unanchored shared-helper fragments
and literal reset counting. New in-memory mutation consumer actually0P1F on
accepted interstitial errors.reverse before repair. Entire bounded helper bodies
are now checked, plus whitespace-tolerant initial-false and exact-three write
site inventories. Mutant failure-message classification was adjusted only for
early-return already caught by adjacency, not to accept the mutant. Subsequent
actual1P0F outer0,895.867041ms. This structural adjunct mutates only in-memory
source, first positively accepts original checkers and rejects uniquely bounded
ownership/cause/await/terminal/inventory regressions for corresponding assertions.
It is not runtime/OS proof; runtime witnesses, remaining failures/fullreceipt and
actual exact-diff review remain required before PR.

Final Task5 independent review C0/I0/M0 at testSHA
77a26af9629750234d82a44eb0f52e63bfb8c08ad69890c8cef04d29c13481d3.
Additional prefix-write and relocated-initializer witnesses each actually RED
before their respective checker repair (outer1,784.830292/785.423916ms).
Final combined nine consumers plus41-case mutation consumer10P0F/zero cancel+
skip outer0,1354.484041ms. This is narrow structural/focused qualification only.

## Task 6: Runtime cause projection, one actual RED group at a time

Same test/spec/plan File Map; start historical P3 consumer. Actual replay outer1:
historical nested-sentinel-loss RED9916.068041ms. Adjacent completed migration-32
receipt/terminal real-owner title passed1452.348792ms; it is not the later
prepared/consumed/current-audit transfer title. Never merge their evidence.

- [ ] Historical child projects exact recursive errorTree alongside message.
- [ ] Close-response-loss asserts exact cleanup aggregate and historical leaf.
- [ ] Add paired locator-ABA/completed-close loss; assert exact primary-first
  acquisition/cleanup tree plus unchanged private-root/FD0 checks.
- [ ] Run RED/GREEN, independent narrow review, then causal commit.
- [ ] Replay each next actual title before refining its projection/isolation.
  No predicted production change from an old line number alone.
- [ ] Actual-body/copied-fixture probe ordering witnesses and full receipt suite
  remain required before PR; ordinary tests never qualify protected cutover.

Task6 precise transfer replay outer1/0P1F3283.231792ms (body3062.13ms): exact
prepared/consumed/current-audit title exposes flattened acquisition+cleanup
aggregate. Scope now includes only this wrapper catch projection and exact four
conditional error trees; existing fresh children, warmup/open1/close1/FD0/tree
checks remain. No passing adjacent-title change or production change.

Task6 actual ledger01:53UTC: historical88561outer0/1P0F11894.298542ms;
combined88343outer0/2P0F15450.04575ms zero cancel+skip. Eight historical
fresh-root/child cases include real paired locator ABA and completed physical
close loss; four transfer children preserve warmup/open1/close1/FD0/tree checks.
Independent combined diff C0/I0/M0 at testSHA
7e0fc8d4eeb4bfe89f4d08848bd242d9676e94d84bf5dd7e4c7c8063b723b23b.
Adjacent actual-body cleanup/capture refresh88742outer0/132P0F1465.303791ms.
Next seven exact-title replay57469outer1/1P6F124036.889167ms: composite
same-realm latch contamination and five cause-flattening groups genuinely RED;
raw owned-child matrix actually passed. No patch to that passing matrix inferred.

## Task 7a: Borrowed raw cleanup cause projection

Same File Map; scope is the existing passRouteWrapper and single close-fault
consumer. Original actual RED57469: cleanup aggregate hides raw sentinel.

- [ ] Assert exact literal recursive cleanup tree before wrapper repair; observe
  missing projection RED, then add child-local projector and catch errorTree.
- [ ] Keep legacy message and status/raw/Q close1 assertions; no physical FD claim.
- [ ] Run focused GREEN and independent exact-diff review before causal commit.
- [ ] Remaining five runtime groups, explicit ordering mutants and fullreceipt
  still block PR delivery; guarded clean-main build follows reviewed merge only.

## Task 7b: Retained NEXT exact cause phases

Same File Map; actual original RED57469 at the retained-child close assertion.

- [ ] Read actual member/parent lifetime helpers and copied physical probes.
- [ ] Assert no errors on valid cases and exact phase/cause trees for all12
  open/stable/close faults; observe missing projection RED before repair.
- [ ] Add local projector and preserve both catches in encounter order.
- [ ] Retain real child per case, exact reverse/once/unopened/FD0/tree and ABA.
- [ ] Focused GREEN and independent exact diff review before causal commit.
  Member close has two aggregate levels; parent close has one. Neither qualifies
  fullreceipt/ALL/host cutover or eliminates pending ordering witnesses.

Task7a actual: assertion-first8325outer1 missing projection; wrapper repair
96764outer0/1P0F1388.299416ms. Requirements M1 clarified: one cause cannot prove
ordering. Task7b assertion-first42161outer1 missing empty error array;
minimal two-catch projection55460outer0/1P0F3920.458333ms. All outputs read;
no cancel/skip. Combined refresh and exact independent review follow before
commit; these two narrow consumers do not qualify broader execution.

Task7a/7b combined59347outer0/2P0F4316.528708ms, zero cancel/skip.
Independent actual diff C0/I0/M0 at testSHA
74ad0a7860681f23d65b2468a07f2642e13572194f7f698a4c6227beced1cced.

## Task 7c: Composite status physical case isolation

Same File Map, actual composite originalRED57469 sticky admission failure.

- [ ] Exact phase/cause assertions first; observe missing projection RED.
- [ ] Enumerate unchanged valid/stable and representative close/open definitions;
  fresh physical ROOT+instrument+existing status seeding+one actual child each.
- [ ] Local projector preserves both catches. Exact reverse-prefix/unopened-zero
  checks join original calls/order/once/stability/FD0 assertions.
- [ ] Run focused GREEN and independent effect review, then causal commit.
  No permanent-latch reset or production change; broader delivery gates remain.

Task7c actual:66099outer1 missing error projection3262.174958ms. Wrapper-only
75150outer1/3299.497791ms retained exact wrong cleanup-uncertain admission leaf
after prior close fault; this separately proves required process isolation.
Fresh physical case repair97973outer0/1P0F37969.132292ms, zero cancel/skip.
Independent requirements C0/I0/M0; actual effect review pending before commit.

Task7c final indentation-only refresh36776outer0/1P0F37734.043709ms,
zero cancel/skip. Independent final exact diff C0/I0/M0 at testSHA
5449a73bb5eb67093f9b4d69a17a8705796fa1e44182a657267d6bfe06a69c59.

## Task 7d: Recovery graph physical case isolation

Same File Map; original actual RED57469 construction aggregate flattening and
source-backed shared-child sticky admission contamination.

- [ ] Assert exact ordered phase/cause trees first, observe missing projection RED.
- [ ] Fresh physical fixture ROOT/seed and one actual child per each14definition.
- [ ] Local wrapper projector preserves operation/owner-close errors; no latchreset.
- [ ] Retain exact graph ABI/hash/binding/mutation/tree/domain/release/FD0 checks;
  exact ENOENT primary target and both nested cleanup sentinels replace flattening.
- [ ] Focused GREEN and independent exact-diff review before causal commit.
  Remaining runtime groups/probe mutants/fullreceipt still block delivery.

Task7d reached-fence refinement: isolated3816outer1/5371.938875ms genuinely
rejects visibility ABA at root-inventory change caused by fixture backup. Move
that member backup outside observed root but within its fresh private fixture;
assert equal bytes/different inode/unchanged inventory before exact pointer
generation refusal. Preserve physical restore/tree/FD0. Root-only test change.

Task7d actual ledger:7322outer1 missing projection1537.945667ms; wrapper-only
10566outer1 obsolete flat regex1533.075583ms after exact paired tree passed;
71245outer1 visibility mutation not applied1535.042333ms proves sticky shared
realm contamination. Fresh14root replay3816 reached inventory confound RED;
unconfounded pointer ABA repair90009outer0/1P0F11680.734667ms, zero cancel/skip.
Exact primary OS ENOENT target, ordered aggregates, refusal dictionary, real
mutation, canonical graph/binding/restore/release/domain/FD0 checks executed.
Independent final effect review and exact repeat remain pending before commit.

Task7d repeat76686outer0/1P0F11204.078625ms, then explicit out-of-inventory
backup-absent witness final65924outer0/1P0F11698.028459ms, zero cancel/skip.
Independent entire exact diff C0/I0/M0 at testSHA
0b612367c584504dd6b3a11660179be2b7fb3fd124544dbaffaab30df7749071.

## Task 7e: Raw recovery fanout diagnostic phases

Same File Map, actual originalRED57469 cleanup sentinel hidden by raw aggregate.

- [ ] Exact errors assertions and paired crossing/close case first; missing
  recursive/ordered diagnostics must genuinely RED before wrapper repair.
- [ ] Raw-route wrapper preserves both catches; derived wrapper forwards all
  route errors then appends selection/post-raw/owner-close trees in encounter order.
- [ ] Retain21 cases plus one paired case alone after final fault batch; exact
  raw outcome/calls/borrowed fences/applicability/reverse/once/FD0 stay enforced.
- [ ] Focused GREEN, independent actual diff review, causal commit. No broader
  cleanup/build/host qualification from these test-only projections.

Task7e actual71914outer1 missing diagnostic2393.461958ms; local wrappers
84380outer0/1P0F2355.505083ms, zero cancel/skip. All22cases including exact
post-raw primary then owner-close secondary, paired resultnull/closeCount1,
borrowed fences, raw outcomes/calls/recovery close-last/once/FD0 executed.
Independent actual diff review and focused adjacent refresh pending.

Task7e adjacent43930outer0/3P0F6457.614916ms, zero cancel/skip. Includes
unchanged raw-owner matrix and manifest/loaded-runtime binder consumer alongside
fanout. Independent actual diff C0/I0/M0 at testSHA
b1002f5b3830ef7e5cd4ed59d0011e736bec846428784b7031b586aa1ee33f5c.

## Task 7f: Exact pre-schema member callback and cause tree

Same File Map; original actualRED57469 plus source-backed semicolon hook defect.

- [ ] Narrow actual two-case inventory/FD/tree regression first; old hook must
  genuinely RED on missing completed member callbacks before seam repair.
- [ ] Unique bounded member callback replacement after real close only, record
  immediate EBADF and ordinal; leave guards/directory callbacks untouched.
- [ ] Assert exact paired cleanup trees before wrapper projection; missing trees
  must RED, then preserve both existing catches and all causes/phase order.
- [ ] Align full existing history consumer with exact paired error trees and
  count16/7, valid[] and fourth-authority-call leaf. Preserve fresh case roots,
  all original inventory/generation/value/FD/tree requirements.
- [ ] Narrow/full consumer GREEN, relevant adjacent refresh, independent exact
  diff review, causal commit; remaining resume/probe/full-suite gates stay open.

Task7f actual5359outer1 oldhook0vs16callbacks2407.583958ms;34156outer0
callback/count/EBADF-only1P0F4182.096083ms; exactcause85410outer1missingtree
2446.769833ms; wrapper61943outer0/1P0F4210.991083ms. Independent unique-boundary
M1 fixed. Full+narrow92123outer0/2P0F137561.880916ms zero cancel/skip;
adjacent34103outer0/132P0F1736.313292ms. Independent ordinary-message/empty-
aggregate M1 remains: assertion checker adjunct RED first then strict full
transport validation and repeat. Source/guards/old artifacts unchanged.

Resume replay75193outer1/7P2F36892.906959ms zero cancel/skip: nine actually
selected titles, NOT19. Two fresh-close/paired-material-close cases reach nested
cause-flattening RED after setup repair; other seven pass. Their repair is next,
not inferred from historical19setup failures or included in current GREEN claim.

Task7f final51782outer0/3P0F135356.578458ms, zero cancel/skip/todo:
ordinary-refusal checker33.298833ms, actual member-callback narrow3557.489417ms,
full physical history131527.240041ms. Checker adjunct genuinely RED first
670.993083ms on accepted wrong/missing message or hidden empty aggregate, then
GREEN668.132ms with strict projection consistency; this is not runtime proof.
Independent entire exact diff C0/I0/M0 at testSHA
fdd836585030180710aa15d3a972385847c56beb01b3bbc970861f33e7900cc3.
Root read entire actual test diff; no source, guard, old artifact or host changes.
Remaining two resume RED cases, actual ordering mutants, full receipt, PR and
clean-main/host gates still pending; focused runs do not qualify whole ALL.

## Task 7g: Resume recursive primary and independent release phases

Same File Map; causal actual RED75193 two cases, not a new production defect.

- [ ] Assert exact outer trees first and observe missing-projection RED.
- [ ] Minimal child-local recursive projection, unchanged legacy message and
  every existing physical publication/generation/call/order/FD check.
- [ ] Assert separate ordered caught phases first; actual bounded copied public
  resume catches only, retaining all assignments/??=/rethrows unchanged.
- [ ] Observe encompassing resume-pass and controller-release independently;
  do not duplicate inner propagation or mislabel the encompassing catch.
- [ ] Focused nine-consumer GREEN, relevant adjacent refresh, independent entire
  diff review and causal commit. Uncertain controller artifacts are not disk-zero;
  final ordering witnesses/full receipt/PR/clean-main/host gates remain pending.

Task7g actual31604outer1/5P4F35267.782334ms missing projection; projection-only
52732outer1/7P2F35305.598333ms exposed expected cleanup aggregate message typo
(actual/source `: receipt cleanup uncertain`, distinct from release leaf
`:Task6A receipt cleanup uncertain`). Literal correction96686outer0/9P0F
35148.378459ms. Phase assertion16907outer1/2P3F13164.33875ms missing caught
diagnostics; minimal bounded observer2366outer0/9P0F35317.973ms, zero cancel,
skip or todo. Independent entire actual diff C0/I0/M0 at testSHA
b722b628d7bb984796b17aa8f25d5f6e38bc441ed43c66a810d08367c1fe316d.
Root read complete test diff; adjacent refresh pending before causal commit.

Task7g adjacent56284outer0/3P0F2660.542792ms, zero cancel/skip/todo: blocked
status no-controller runtime plus awaited cleanup and retained CAS-order consumers.
No ready-controller title matched this command; do not invent that coverage.
Shared additive output shape compatibility still requires complete receipt run.

## Task 8a: Actual P4 and Q response-boundary closure witnesses

Same File Map, pending first-slice review requirement; no production changes.

- [ ] Existing seven P4 close consumers and Q3 close consumer require immediate
  physical closure snapshot first; genuinely RED before hook repair.
- [ ] P4 records consumed temp slot plus exact EBADF before response fault;
  child wrapper transports snapshot and warmed actual FD0.
- [ ] Q records heldClosed, exact EBADF, successful guard.close completion;
  preserve target restriction and original helper/primary semantics.
- [ ] Fresh fixture/actual child per after/before variant, all seven P4 phases
  plus Q3/no-temp. Exact sentinels and final FD0 both variants; only immediate
  closure predicate rejects before-cleanup, not an import/leak/setup failure.
- [ ] Actual GREEN and independent exact-diff review before scoped commit.
  Resume await/order/multi-cause mutants and full receipt remain pending.

Task8a actual13591outer1/0P8F14764.146334ms missing immediate snapshots;
minimal witnesses84399outer0/8P0F26868.87475ms. Counterexample assertion-first
75409outer1/0P2F5463.562708ms: unchanged actual sentinels/FD0 reached, but no-op
timing scaffold still captured true instead of nominated false. Exact bounded
response-only moves18699outer0/2P0F30508.028959ms, fourteen P4 physical roots /
children plus two Q roots/children. Final combined88339outer0/10P0F56145.542292ms,
zero cancel/skip/todo. All seven existing P4 close-response retries and Q close
consumer retain existing physical/frontier/canonical/identity/overlay/FD checks;
new before variants reject immediate closure while eventual FD0 still passes.
Root read entire actual test diff. Independent entire effect review pending;
testSHA195d332be66b12f44090bb59088d6b308f576bdcdb24f0de92964406034c75cd.

Task8a independent entire exact diff C0/I0/M0 at the same SHA. Commit only this
test/spec/plan slice; full receipt compatibility and resume mutants remain open.

## Task 8b: Resume awaited physical cleanup and paired cause witnesses

Same File Map. Independent source design separates ordinal2 fresh caller from
ordinal1 public caller; each case owns its fresh physical root/actual child.

- [ ] Extend existing five-case setup with separately titled gated ordinal1,
  ordinal2 and paired earlier-root-close variants; missing handshake must RED.
- [ ] Callback completion observer follows actual awaited Q/raw/status/directory/
  root releases. Final snapshot requires consumed closed=true and exact sequence.
- [ ] Deferred entry/release child driver races settlement, crosses setImmediate,
  proves UNSETTLED while held, releases finally, awaits actual original promises.
- [ ] Paired root-after-real-close and final response fault must preserve exact
  ordered two-cause cleanup aggregate and separate controller-release failure.
- [ ] Four bounded copied runtime mutants after prepare/instrument: omit tail,
  move before ROOT, remove public caller await, remove helper per-release await.
  Actual nominated witness rejection plus eventual FD0/status/publication remain.
- [ ] Focused GREEN, exact adjacent repeat, independent review and causal commit;
  full receipt shape compatibility/PR/clean-main/qualifying ALL remain pending.

Task8b actual61756outer1/0P3F8624.753292ms missing gated handshake; minimal
actual callback/child handshake9311outer0/3P0F8513.710416ms (original, fresh,
paired root-after-real-close plus final response). Four counterexamples35677
outer1/0P4F11167.327042ms with no-op arrangement; bounded real mutations17119
outer1/3P1F13209.939ms expose helper no-await snapshot[]; source-backed expectation
refinement65306outer1/3P1F13160.634208ms exposes exact final-probe[1,2] rather
than baseline[2,1]. These are nominated timing consequences, not unrelated setup
errors. Final four4705outer0/4P0F13040.916375ms, zero cancel/skip/todo; baseline
order stays strict, helper counterexample requires exact entry[]/early settlement,
eventual unordered exactly-once five closes and exact inverted[1,2].

Independent review C0/I0/M1 requested containment watchdog. Assertion-first
37225outer1/0P1F3361.846958ms missing expiry; fresh physical containment1550
outer0/1P0F3315.079167ms. Withheld notification expires, releases actual gate,
drains real successful operation/closures/FD0/exact14publications/adjacent status,
then fails harness with exact watchdog leaf, never qualifies altered source.
Normal gates/mutants require expiryfalse. Final17-title67500 and exact-diff review
in progress at testSHAc2e94010622c7fc50e135a762e9912f024a94dff41bd48b2edb6f76ee6ad4440.

Candidate combined67500outer0/17P0F58666.92375ms, zero cancel/skip/todo;
independent C0/I1/M0 finds controlled short timer could expire before actual
gate entry. This candidate is not final qualification. New at-expiry assertion
44238outer1/0P1F3403.576709ms missing exact witness. Minimal repair arms the
short containment timer only at actual suppressed entry; normal5s containment
still starts before invocation. Exact at-expiry closed/full-five snapshot and
operation still unsettled (operationSettled:false), then actual drain68046outer0/
1P0F3359.336625ms. Final refreshed17-consumer run/review pending at testSHA
696f2d50ec2ba11d56856464361d8b5ff522ba2f0e0635c33fe63768010cb8ec.

Task8b final84237outer0/17P0F58164.281083ms, zero cancel/skip/todo.
Independent entire exact diff C0/I0/M0 at that same SHA; root read complete
actual test diff. Both gated owner lifetimes, paired cause order, four honest
counterexamples and causal watchdog containment executed alongside original nine
resume consumers. Adjacent refresh pending before commit; not full receipt/ALL.

Task8b adjacent88706outer0/3P0F2669.745625ms, zero cancel/skip/todo: blocked
runtime no-controller and awaited/retained-order contracts. Same final testSHA.

## Task 8c: Runtime phase/cause/order transport counterexamples

Same File Map; closes explicit first-slice review gap, not a production change.

- [x] Existing isolated selected-pass helper gains optional copied-wrapper
  transport variant after seed; default unchanged. Assertion-first real-child RED.
- [x] Four paired q/open+status/close roots/children: baseline, drop-phase,
  drop-nested-cause, reverse-primary. Exact hand-derived shape and unchanged
  baseline-checker rejection; physical reverse/once/unopened/post-close/FD0 remain.
- [x] Two status/close roots/children: baseline and phase-drop; exact owner-close
  and release trees, reverse four/once and six post-close refusals remain.
- [x] Source-bound exact-one wrapper anchors; callback replacements only, never
  mutate parent DTOs/actual catches/guards/cleanup/latch or reset uncertainty.
- [x] Actual GREEN, relevant adjacent refresh and independent review, commit;
  then complete receipt verification before PR and guarded clean-main build.

Task8c actual RED90606outer1/0P2F9119.757916ms missing phase mutation;
phase-only19657outer1/1P1F12074.730167ms missing nested-cause mutation;
phase+nested7999outer1/1P1F14469.942667ms missing reversed-primary mutation.
All failed on nominated exact diagnostic-shape assertions after actual physical
cleanup; no setup/import failure qualified. Implemented each copied projection
only after its RED. Initial GREEN91526outer0/2P15020.541959ms.

Independent M1: last-declaration region selector alone did not prove uniqueness.
Added exact wrapper declaration count1 and whole-source region occurrence1,
retaining exact-one mutation anchor. Final98998outer0/2P0F15064.421833ms;
adjacent87533outer0/2P0F31620.821458ms; both zero cancel/skip/todo.
Independent entire diff C0/I0/M0 at testSHA
e22d2a81efe7df81290024a7c0adf8c5b40830b4a134252052f6302f1ea74791.
Root entire test/docs diff read and git diff --check0. Not full receipt/ALL.

## Task 9: Fixed complete receipt mode, before private invocation

Same root writer/branch; causal relation and four-path refinement in spec.
Consumes planPrivatePostgresTestsV1({root,port,mode}) and existing wrapper CLI.
Produces receipt mode's immutable exact isolated-runner vector, no new API.

- [x] Add literal planned receipt vector test; retain other vectors/initdb/server.
  Add receipt to controlled wrapper boundary cases and independent literal argv:
  `['--import','tsx','scripts/run-isolated-postgres-tests.ts','--','node',
  '--import','tsx','--test','--test-concurrency=1',
  'tests/internal-production/baseline-post-handoff-receipt-v1.test.ts']`.
- [x] Add receipt extra/argument/alias negative CLI tests. Actual RED must be
  missing fixed mode/dispatch, never loader/setup failure.
- [x] Minimal implementation: add receipt to both closed mode sets and fixed
  planner branch; no main lifecycle/capability/PG/default graph changes.
- [x] Run Node26 script cluster and journal suites; controlled normal/nonzero/
  journal-loss/retained-DB scenarios prove unchanged fail-closed lifecycle.
- [x] Independent exact diff review, root full diff/read/contracts/diff check;
  commit scoped changes. No full receipt qualification yet.
- [ ] Fresh clean HEAD/tree/dependency/host/resource/primary-readonly preflight,
  independent per-invocation review of ONE receipt mode; root executes:
  `/opt/homebrew/Cellar/node/26.4.0/bin/node scripts/run-private-postgres-tests.mjs receipt`
  with scrubbed PG/Node ambient environment, never a test flag/loader injection.
- [ ] Track actual outer handle and complete strict journal; require entire
  receipt suite exit0 plus initdb/test/server exit+close, six EOF, ordered two
  quiescence samples/admin end/server close and actual outer0. Retain root.
  Nonzero/new RED gets causal investigation; no focused stitching or adoption.

Task9 RED actualouter1/0P3F117.713ms: exact planner missing-mode refusal and
both normal/nonzero actual CLI missing-mode refusals, no loader failure.
Minimal fixed-mode implementation after RED. Full cluster+journal47715outer0/
150P0F12273.224583ms, zero cancel/skip/todo, entire output read. Adjacent package
90562outer0/4P0F1279.269875ms; tsc59972outer0/no output; version/path/English0.
Independent design31d3d765 C0/I0/M0 and entire code/test diff C0/I0/M0:
constructorSHAd968955600c477cec87c572ecbe1986bb4f531b29346224de5dd6fb1ead209bd,
testSHA909a0ef67a731cef4b1ef54b0ea49595b639ed6ceac0e57ba3225984faaab36d.
Root complete changed diff read/diffcheck0. Real private receipt not yet invoked;
clean exact epoch and separate one-invocation clearance still required.
