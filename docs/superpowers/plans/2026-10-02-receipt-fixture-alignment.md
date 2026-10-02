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
- No production/package/dependency changes, native/service/DB mutation or guard bypass.
- Original outerUNAVAILABLE/ALLUNQUALIFIED never substitutes for current qualification.
- Fixed Node26.4.0, unset ambient PG/admin/NODE_OPTIONS/NODE_PATH on focused tests.
- No protected or host acceptance inferred from copied fixtures or ordinary build.

## File Map

Modify only tests/internal-production/baseline-post-handoff-receipt-v1.test.ts
plus this plan and its spec. Consumers already exist; no production interface changes.

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
