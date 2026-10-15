# Retained cold-pre32 implementation plan

> Agentic workers: use root-only manual execution for this tightly coupled change
> and independent read-only task/whole-diff reviews. Standing single-writer rules
> override implementer delegation; no faster model or workspace cleanup.

**Goal:** Refuse phase drift on the same held pre-cutover backend.
**Architecture:** Shared exact absence body plus retained lazy canonical31 owner;
same genuine reservation/read-only transaction; original rollback/close custody.
**Tech Stack:** TypeScript5.9.3, postgres3.4.8, real private PostgreSQL17.
**Spec:** `../specs/2026-10-11-task6a-retained-cold-pre32-design.md`.

## Global constraints

Execution ordering: queued while root delivers the independent native-close and
revoked-holder lifetime corrections on a separate main-based branch. The
aggregate branch is preserved; neither that source integration nor its standby
build proves this cold-phase task or permits live cutover. Resume this task after
the single-writer handoff, retaining all original custody and review gates.

Root sole writer. Preserve worktrees/protected pair/live ports3080/3333/18789.
Disk floor8GiB. No account/security/grant changes to live host. No31/33 identity
copy, frozen migration-region change, caller-supplied authority, runtime bypass,
timer-induced custody release or stock-build claim from noEmit.

## Task1: One independently reviewed cold-phase composition

### Prerequisite: finite bootstrap source-closure integration

The genuine merged fixture run on 2026-10-12 failed 7/218 cases. Four census
fixtures rejected two real script inputs in the compiler metafile; three healthy
host cases refused the launcher's static adapter import. This root correction is
causally necessary to qualify the aggregate before cold-phase implementation;
it is not a new rollout permission or cold-phase RED result.

File Map: `scripts/deployment-cutover.mjs` adds only the existing adapter to its
Git-authenticated executable closure; `scripts/__tests__/fixtures/deployment-cutover-bootstrap.mjs`
copies that same script and recognizes exactly adapter plus retention in census
metadata, keeping them outside TS-to-dist transformation. New
`scripts/__tests__/deployment-cutover-bootstrap-inputs.test.js` and existing
`scripts/__tests__/deployment-cutover.test.js` cover unchanged
bytes, missing/tampered/foreign adapter edges and actual cross-observer fault
reach. The paired spec and external ledger retain capture identities and limits.
Shared adjacent File Map: `tests/internal-production/cutover-feature-branch-bootstrap-fixture-v1.ts`
adds only the same adapter and existing process-event `.mjs`/`.py` to copying,
without changing the source-build companion's expected stage. Four existing
bootstrap consumer tests are verified; no package command change (ordinary
test:scripts glob already covers the new JS test).

Cold source proof File Map (2026-10-12): the new real-leaf guard test is
`tests/internal-production/task6a-cold-pre32-catalog-readonly-v1.test.ts`;
the modeled retained consumer test remains
`tests/internal-production/task6a-protected-postgres-backend-probe-v1.test.ts`.
The three copied census harnesses bind the real leaf's absolute TypeScript URL
and route only the unchanged cold SQL through their existing modeled query
executor. The authenticated `scripts/__tests__/deployment-cutover.test.js`
census transport copies/compiles the real leaf normally and gives its existing
seven-query transaction the same narrow unsafe route, preserving all counts.
External captures `logs/setfarm-cold-phase-source-check-v1.mjs` and
`logs/setfarm-cold-phase-source-noemit-v1.mjs` retain all tracked source pins,
new leaf/test pins and the independently reviewed101 canonical static inputs;
these source controls are not native ESM/PostgreSQL or stock-build evidence.
Native compiler File Map: new
`tests/execution-attempts/task6a-cold-native-emission-v1.ts` and
`tests/execution-attempts/task6a-cold-native-emission-v1.test.ts` own genuine
split-esbuild emission validation before publication. The spec fixes its
interface and complete-static-closure/actual-emitted-edge checks; native entry
and private fixture must seal and pin every returned chunk, never extend or
borrow the old sealed capsule. Implementation and compiler/native controls are
still pending; static source graph review alone is not emitted laziness proof.
Pure test-utility DATA interface `validateTask6aColdEmissionV1(result,nomination)`
accepts absolute outputDirectory/entrySource/probeSource/canonicalSource only for
genuine tiny compiler controls. The fixed emitter retains its exact actual source
paths/holder-only plugin. Graph validation is not dynamic-load timing proof.
Ignored external emission capture/noemit-v1 nominate both new files and six
sequential originals; preserve earlier source captures without widening them.

- [x] Witness strengthened cross-observer behavioral RED against the unchanged
  authenticated closure; an earlier loader refusal is not fault-arm evidence.
  Natural child56570 code1/null,3 intended-reach assertion failures, raw4745B
  SHA78536c04134dda43b5678505810042b5126060c852ff339cd849aba8f647fc3e;
  root and independent terminal custody audits passed (not test qualification).
- [x] Correct finite source/copy membership without a wildcard resolver allow.
  Focused original58638 code0/null,37/37 pass. Shared-helper original64357
  code1/null,4 wrong-stage assertion failures (source-authentication versus
  source-build), raw6126B SHAa2c2fc1c9774cfeda2fa250960c29d372c17ed4508f44e20efb0642ad95fd762.
  This separate behavioral RED precedes the exact three-member copy fix.
- [x] Verify intended host/census healthy companions, negative source guards,
  permissions and process-event DATA controls; then actual-source strict noEmit.
  Full original65433 code0/null,252/252 pass,0skip/cancel/todo; original21292
  code0/null,actual TypeScript5.9.3 roots852/files1202/diagnostics0/noEmit.
  Root and independent4380 current source/tool/copy pin audits match; exact
  membership2188 and sole dependency binding match. Receipt4569332B
  SHA325d2fc212d105d2b44b88842c6eae9a2dc044d201a1f4400359294f7204093d;
  minimum sampled free10867150848B. This is not stock build or native cold proof.
- [x] Two independent read-only exact-diff reviews before aggregate merge commit.
  FULL19-path binary diff585b71f6ae42013658811986080515fd7079a07db0a3a16f9523479e9ac734c6,
  C0/I0/M0 from both reviewers. This additive terminal record changes only the
  plan after captured source-custody release; no retroactive pin qualification.

Files and interfaces are exactly the spec File Map. Existing
`verifyHeldPre32ContractSpineJournalIdentityV1(query)` remains unchanged, where
`query(statement:string,parameters:readonly number[]):Promise<readonly unknown[]>`.

- [x] Add failing modeled composition/import lifetime controls and real producer
  guard tests; new cold producer must reject nonzero/extra/missing/duplicate rows.
  Example: `await assert.rejects(cold(port([{laterJournalCount:'1',relationCount:'0',functionCount:'0',typeCount:'0',triggerCount:'0'}])))`.
- [x] Run focused RED using actual Node and read-only dependency resolver. Missing
  cold/journal calls must fail behavior assertions, not accidentally pass setup.
- [x] Extract existing tagged absence SQL unchanged into new inert leaf, using
  `transaction.unsafe<Array<Record<string,unknown>>>(literalSql)`. Delegate the
  old census helper; update copied-source tests to bind the real leaf and route
  its unsafe query through their explicitly modeled query boundary.
- [x] Add retained lazy canonical verification after existing owner check:
  `held.recheck(); const loading=import('../db/contract-spine-migrations.js'); originals.push(loading); const owner=await loading; held.recheck(); await owner.verifyHeldPre32ContractSpineJournalIdentityV1(async (sql,parameters)=>await transaction.unsafe(sql,[...parameters])); await requireColdPre32CatalogAbsenceInTransactionV1(transaction);`.
  Keep original import occupied until settlement, even on reporting/refusal.
- [x] Verify focused GREEN, pending import/reentry/refusal and ordinary census
  lock/call-order regressions. Current LY12i3:156tests155PASS/0FAIL/1existing
  descriptor opt-in SKIP; actual strict TS5.9.3/diagnostics0. Root and independent
  4387 input/copy current pin checks passed. Receipt
  c797aee5f0929a9795c7041f68a12a1eb4987d8db2043e1a52c6c3273f7fd372.
  Independent cardinality M1 closed by real44th guard RED then GREEN. These are
  source controls, not native/compiler/admission qualification.
- [x] Prove emitted canonical initialization is lazy and
  newly reachable side effects are only the reviewed canonical owner graph.
- [x] Extend actual private fixture with checksum32/33/catalog phase controls;
  require intended actual journal/cold rows and healthy companions before/after
  restart. Exact owned admin restore must not run on uncertain child completion.
- [x] Capture final exact source/native/strict/adjacent evidence,8GiB reserve,
  original natural close; run version/English/path/migration/MC contracts.
- [x] Two independent read-only final reviews; fix findings and reverify bytes.
- [ ] Root conventional commit/push to existing PR280, evidence checkpoint; keep
  draft until full integration/release gates, and continue remaining safe work.

Self-review: one coherent task shares the bracket/leaf/native interfaces; source31
and cold32/33 absence are complementary, not competing head expectations. No
positive controller, full application grant matrix, genesis or rollout is invented.

## Native observation subtask (same objective, root-only writer)

File Map: new `tests/execution-attempts/task6a-native-baseline-observer-v1.ts`
and `.test.ts` own test-only original ledger; new
`tests/execution-attempts/task6a-native-baseline-observer-bridge-v1.ts` and
`.test.ts` own genuine verifier forwarding. Modify existing native entry and
emitter/test for exact aliases, actual load hook and native source/pin checkpoints.
New `tests/execution-attempts/task6a-native-canonical-load-observer-v1.test.ts`
tests the entry-owned pure load callback with explicitly modeled checkpoint,
event and nextLoad ports; real URL/context/result identity and thrown-value
preservation are unit evidence, not native loading or PG evidence. Entry exports
`createTask6aNativeCanonicalLoadObserverV1(canonicalURL, checkpoint, event)` with
`load`, sticky diagnostic `snapshot()` (requested/returned/failed/failures).
Actual registerHooks installation/lifetime remains inside the native runner;
the later sealed fixture supplies its exact canonical URL. No extra production
API, arbitrary importer alias or source-runtime authority is introduced.
Private protected cluster test later consumes newly validated/sealed ALL chunks;
no prior capsule, producer/checksum semantics or live host policy is modified.
Ordinary execution-attempt test discovery includes the new tests automatically.
Ignored pure compiler profile receives the exact additional source/test pins;
it is not a source-runtime/native-PG/stock qualification substitute.

Interfaces:
```ts
type BaselineRoleV1 = "ACCESS" | "BASE" | "OWNER";
type ObserverOptionsV1 = {
  contextIsCurrent(): boolean;
  checkpoint(): void;
  event(name: string): void;
};
// Inert helper: observe() never throws back after a genuine callee returns.
createTask6aNativeBaselineObserverV1(options: ObserverOptionsV1): {
  observe(role: BaselineRoleV1, original: Promise<void>, transaction: unknown, owner?: string): void;
  canonicalRequested(): void;
  joinOriginals(): Promise<void>;
  snapshot(): { failed: boolean; records: readonly { role: BaselineRoleV1; state: string }[];
    failures: readonly { stage: string; error: unknown }[]; fulfilled: readonly BaselineRoleV1[] };
};
// Entry dispatcher selects current context or sticky orphan observer.
observeTask6aNativeBaselineOriginalV1(role, original, transaction, owner?): void;
```

- [x] Add genuine fixed compiler control before alias implementation:
  `assert.ok(Object.hasOwn(result.metafile.inputs, bridgeSource), "genuine physical baseline bridge input required")`;
  require one positive output contribution for bridge/observer/three real owners,
  then inspect exact probe/bridge imports. Current actual graph should fail the
  first bridge presence assertion, not setup or missing compiler API.
- [x] Add unit tests before helper implementation: pending original prevents
  join; original rejection including undefined is observed; missing context,
  duplicate/out-of-order roles and throwing checkpoint/event remain sticky
  while original result is unchanged and observation reactions safely fulfill.
  Unit native facts/producer ports are explicitly modeled.
- [x] Implement ledger with enrollment before validation/then, safe captured
  occurrence callbacks, SAME transaction and OWNER argument checks. Native
  dispatcher always retains originals, including missing-context path.
- [x] Implement non-async real-owner bridge:
  `const original = Reflect.apply(actual, this, args); observe("ACCESS",original,args[0]); return original;`.
  Fidelity tests assert exact original/receiver/argument references for all three
  wrappers and synchronous producer throw propagation without fabricated Promise.
- [x] Add only exact probe-qualified three aliases, preserving holder alias and
  canonical edge. Verify genuine bridge-positive compiler GREEN and all existing
  lazy/eager/shared/computed/loader guards before any native publication.
- [x] Install actual entry load hook, capture exact sealed canonical URL request
  and genuine nextLoad return separately. Wrong timing only records sticky
  failure; never throw from sensor. Use actual wire BEGIN/latestT and five held
  FD identities for checkpoint. Join SAME probe import/probe/native close and
  every ledger original/observer before deregistration/restoration.
- [x] Extend native exact refusal prefixes and actual journal/cold RowDescriptions
  to the16modes x before/after restart32case cohort. Canary restore is exact and
  forbidden under uncertain child termination. No native qualification until
  all real row/use/timing/close/snapshot witnesses and healthy companions pass.

Current finite compiler H0Vqdo26/26PASS/root+two independent C0/I0/M0,
receipt95f82743017155bd10ce0e6e68c6e0f56baff628020a8dda5f142a3a91ddec7d.
This authenticates compiler DATA/portability/binding only; native hook/PG/stock
milestones above remain unchecked.

2026-10-12 Tzunk6 finite compiler/unit slice51/51PASS0SKIP; root full2208-pin
audit +independent full capture audit and code review C0/I0/M0. No native target
was evaluated. 3HVeah strict source/test TS5.9.3 roots859/files1208/diagnostics0,
noEmit true with stock skipLibCheck preserved; root+independent full2209-pin
audit. HOME/TMP historical root tuples were not retained; this limitation is
disclosed, not retroactively manufactured. Native cohort/stock remain pending.


## 2026-10-13 resumed native phase cohort

The previous thread ended with upstream Codex capacity/stream failures; source
and custody records survived. Fresh root and independent full audits of
logs/setfarm-cold-native-closed-check-MbsACG passed before source release:
2209 current inputs, exact logical index/HEAD/binding, retained fixture membership,
original73154 code0/null,16 old-mode cases across restart, actual31 journal rows
and five zero counters in each healthy companion, native close before all5 FDs.
Receipt b5c4f9c2529c96f04ace832569eb28ee4d31be67168454756d5c81a536a1e6a5.
The row-recording RED is retained in NQCUUK; MbsACG is its native GREEN.
This releases only this source slice, not stock/production/admission authority.

Remaining test-only File Map: existing native entry accepts eight phase modes;
existing protected-cluster fixture creates/restores each exact private canary and
snapshots function/type/trigger catalogs as well as journal/relations/ACL/defaults.
No production owner, canonical migration or runtime gate changes are needed.
Modes are phase-checksum, phase-journal32, phase-journal33, phase-table,
phase-index, phase-function, phase-type and phase-trigger. Every phase refusal
must show all3 baseline originals fulfilled, canonical load1 and actual31 journal
DataRows; checksum refusal must precede the cold query, other modes must show
the exact expected nonzero five-count row. All refuse before the second lifetime
query, perform same-reservation rollback, join native close, close5 original FDs,
and preserve the perturbed snapshot. Restore only after certain natural child
completion; restored baseline must equal its original snapshot exactly.

- [x] Implement the eight diagnostic-only mode expectations and private canaries.
- [x] Recheck actual strict source types and compiler/unit controls with captures.
- [x] Run and fully audit all16 modes before/after restart (32 cases).
- [x] Obtain independent whole-diff/current terminal audit before scoped delivery.

Ignored fixed capture logs/setfarm-cold-native-closed-check-v1.mjs retains the
same inputs/reserve/custody and nominates the enlarged32-case diagnostic scope.
It remains excluded-UID/privatePG evidence, not a fixed production namespace,
full native dependency freeze, stock build or live cutover qualification.


## Final current-source qualification, 2026-10-13

The32-case JxmMox original87006 naturally closed0/null. Exact16 ordered modes
before/after restart include healthy/delayed companions, six early baseline
refusals and eight phase-only refusals. The latter keep ACCESS/BASE/OWNER fulfilled
and canonical load1; actual31 journal rows and the precise intended cold counters
are recorded. Checksum drift stops before cold SQL. Each probe preserves the
perturbed private snapshot, joins same-reservation rollback/native close before
five original FD closes, and restores the exact original sampled baseline.
In the sealed six-member graph, the canonical owner contribution is outside the
complete static entry/probe closures; native load and subsequent journal use
prove timing separately.
The unchanged canonical owner and its101 nominated static sources remain exact.

Native receipt fd0fc5a2e9018309b818cdf59df8fc396072eb267336ea3e5fab547ad820203b;
raw119366B SHA0c661c33b3dbbabc6a625f4cedd9882ca6e9f72a34415c462a9ee0b8cc56cb4b.
Root and independent FULL current2209-input/physical/binding/inventory/terminal
32-case audits passed. Descriptor/privatePG exact cleanup passed; original is
ESRCH. Minimum sampled free10636472320B; owned capture reserve8939066B<16MiB.
PrivatePG total artifact/quota and full dependency/native images remain unqualified.

rMo2bJ actual58 compiler/ledger/bridge/load controls PASS0FAIL0SKIP; receipt
08f785b5a776f286e09e703dadd9353d292a0ddbc7d6d45efe94718d5f99a2e5.
XZfu3I actual strict TS5.9.3 roots861/files1214/diagnostics0/noEmit, receipt
c0bcd09e65eaf629c0946d76149f63a377a29af8e7a2556b74e6076fc882dea8.
Independent FULL three-capture audit40901 assertions0; no historical root tuple,
stock skipLibCheck/full dependency freeze or native evaluation overclaim.

Fresh KDmBUv five-source-control originals naturally0/null:44 leaf,71 consumer/
producer,17 census/journal,24 adjacent =156tests155PASS0FAIL1 existing privileged
opt-in SKIP; source strict852/1201/0. Root/independent FULL2197 inputs/2190 copies/
15artifact audit0; receipt38dcd46c6d187e8d3aa4abeeba80bb262e17a0a6930c271f107dc684d0144c76.
Its source copy excludes seven native helpers, which are covered by the separately
current audited captures above; its strict check uses the actual writer source.
Historical HOME/TMP/shortTmp inventory is not retroactively claimed.

The changed deployment-cutover JS census transport was separately freshly run:
all four trusted database-inspection controls PASS0FAIL0SKIP, original19830
natural0/null; raw/terminal retained in /private/tmp/sf-census-focused.lDNRNy.
This is ordinary focused test execution, not a full material-freeze capture.
Final version2.3.79/English2026/path1009, frozen semantic migration digests,
all12 Mission Control contract artifacts and diff checks passed separately.

Two independent complete19-path source reviews C0/I0/M0, reviewed pre-evidence snapshot
21bc0de994fc97f97ac94dd3f35239908acb06a902bffd4af5a6ea8510422aaa.
All captured source custody released before this additive evidence-only update.
Normal scoped checkpoint delivery remains DRAFT: full aggregate integration,
authentic protected source/controller/backend genesis, fixed namespace/admission,
clean-main stock build and live3333 are independent outstanding gates.


Final staging exposed one extra EOF blank LF in the previously untracked cold
leaf, which unstaged tracked-only diff checking had not included. Root compared
it against KDmBUv's exact captured source copy and removed only that final LF.
Leaf SHA changed3857ac1e… to88b093d52c25c6321474239cece45ef2fee2c5c8350a0dc56a7536c264dc2a0a;
all other production/test bytes remain independently reviewed. Fresh actual44
leaf controls passed0FAIL0SKIP. The genuine fixed emitter produced exactly the
same five output filenames and full SHA hashes as the JxmMox sealed native JS
graph. This is emitted byte equivalence, not a new native run or source-pin
relabeling. Original capture source hashes/physical tuples remain historical.
First equivalence command used the workspace cwd and refused module resolution
before compilation; corrected writer cwd and full actual comparison passed.
The ordinary strict/config/native claims above retain their declared scopes.
