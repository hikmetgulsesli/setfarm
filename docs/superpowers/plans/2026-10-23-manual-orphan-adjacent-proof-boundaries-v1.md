# Manual Orphan Adjacent Proof Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Root owns all execution and delivery.

**Goal:** Reduce duplicate complete Source observations at fixed mechanical entry and acquisition acceptance boundaries while retaining full material checks before imports, DB effects and accepted results.

**Architecture:** Task1 shares proofs at three fixed mechanical entry boundaries. Task2 qualifies each privately registered point observer inside its existing complete acquisition check and places fixed private Source DATA validation before the final two-observer acceptance proof. Keep every local guard, actual await, post-call proof, reconciliation, close and clock; no general skip or reusable success token.

**Tech Stack:** Existing Node26.4 ESM H helper and Node test/VM component fixtures; no dependency or compiled/T change.

**Spec:** `/Users/setrox/ai/setrox/logs/2026-10-21-controls-current-evidence-v1/task7e-fixed-mechanical-read-unit-design-v1.md`,12104B,SHA256 `c455ed2dce31a41a870ad4c10ce62566f548bcfea28a0f816cf17d0d70e96a18`. Count/clock audit: `task7e-source-floor-count-and-clock-audit-v1.md`,11909B,SHA256 `0a92c4bd7038ad136b120a0d3c333bd9cb4485dce4a336d238ebaed016cbc960` in the same evidence directory. Root read both in full.

## Cause and limits

PR308 normally merged64c6c48d. Its actual Source point60682 acquired in39886ms, checked3648ms and closed3646ms. A separately captured29-request/120s diagnostic72140 completed22 checks and closed at124308ms; this is a measured workload overrun, not a universal timing lower bound or actual private phase result. Actual CPU acquisitions19379 and check92073 are closed/qualified but instrumented. Two low-FD readers16635/16636 closed0/0 in2184.710667ms with no demonstrated speedup; no production parallel topology adopted.

The verifier is NOT FS-only: fixed T opens a postgres pool, executes a read-only transaction, invokes its own Source checks and awaits pool end. The rejected two-proof proposal cannot preserve the pre-DB boundary. This plan admits only the narrower four-proof mechanical sequence and two no-await old-entry pairs. It refines the earlier Task1 exact listed schedule for these named sites; all other contracts remain. A proof is shared at the same required material boundary, not reused later. Different transient failure sampling is explicitly not claimed equivalent. No deadline fit is predicted.

## File Map

| File | Responsibility |
|---|---|
| `tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs` (H) | Task1 two private lexical functions and exact call sites; Task2 fixed observer acquisition suffix only. |
| `scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js` (J) | Actual private-body phase and acquisition orchestration tests, controlled dependency faults, exact full/local proof and effect order. |
| This plan | Root scope, provenance, acceptance and verified progress. |

K/F, other tests, compiled Source observers, raw retention scripts, profile hashes and fixed T are unchanged. No generated runtime artifacts or new public exports.

## Global Constraints

- Sole writer W=`/Users/setrox/ai/setrox/.worktrees/setfarm-dashboard-cutover-controller-20261007-v1`; branch `fix/manual-orphan-adjacent-proof-20261023`; base64c6c48d03d8f9ba2e6599ed1e53d067dd264b4a/treee8ef378ca3fa86848e70365e7cd2cda631b635e6. Preserve all ignored workspaces/evidence.
- H base188537B/SHA256abaa3a28d94c6e4f6322dbaacd1fc3bb3594eb57a420500c71980778046784e5; J base760348B/SHA2567b8dfb7dc8864d18bde0c5c12bde4e47dd755d70e4764801bf9b5122562d9f4b. Read root/W AGENTS before writing.
- No timeout widening/reset or moving proof outside its budget. Provision300000,activation180000,old/new120000,integration300000,runner840000,server960000; operations5000/cleanup30000 remain exact. Parent and child clocks/joins remain.
- Source owner public frozen zeroarg API, its full check composition/custody/FDs and M/T independent observers remain unchanged. Task2 preserves the progressive complete-check observer sets0→1→1→2 and both post-import proofs; only its named duplicate acquisition samples/final adjacent check are refined. No fake whole-Source success, cache of observation, caller selector, local/skip API, extra retained FD or global/prototype mutation.
- Never remove the immediate full proof after actual verifier settlement, final mechanical reconciliation proof, actual old preparation calls/assertions, database-close/terminal Source proofs or original failed/UNKNOWN cleanup.
- All original test registrations and safety assertions remain. Change a trace fixture only for a specifically mapped shared boundary; document every old expectation change. Do not turn a failing safety control into an accepted case or drop coverage to reach green.
- Root alone runs Node/parsers/tests/builds/HTTP/native/DB/provider, stages/commits/pushes/PRs. Agents are source/test authors or static reviewers only, never delivery. No worker subagents. No secrets/cache/credential/ACL/service/installation/private phase effects.
- Tests use controlled dependencies only for component orchestration; they never certify genuine SQL, actual Source, process/native/current-material, full8 or rollout gates. Keep13UNKNOWN families/d7561of8/T161/I5 unchanged.

### Task 1: Three fixed shared proof boundaries

**Files:** Modify H and J only. Root updates this plan/ledger after verified gates.

**Interfaces:** Consume existing zeroarg check/localPhaseCheck, loadNamespaceLocal(key), effect(start), qualifyMechanical, moduleCache, directory/frame/qualified/selectionMade and closeDatabase. Introduce private `verifyMechanicalActivation()` and `prepareOldEntryTwice()`, both zeroarg async lexical functions inside runManualOrphanOwnedPhaseV1. Expose only `prepareOldEntryTwice` on its already-private phase object for the fixed old handler. No serializer/codec/public API field changes. Existing phase.load/effect elsewhere remain unchanged.

- [x] **Step 1: Tests only; stop for Root RED.** Read TDD/writing-good-tests. Add component tests using the actual current private H bodies and existing J fixtures. Test full/local/event order; inject Source/local/import/qualified/verifier/record/assert/clock/close faults at the required boundaries. Cover both old/new mechanical consumers, actual pending verifier settlement (no next API/result/cleanup abandonment), verifier rejection, post-verifier failure before reconciliation, final reconciliation fault before select, and unchanged exact namespace/method receiver/arguments. For old, test unprepared/getSql/first assertions faults prevent the corresponding prepare, both actual prepares settle on the same client, second post-call/final database close preserved, both earlier local guard pairs preserved, and no intervening await/callback/selector. A fault at the later shared Source proof must prevent the next actual call.

Use a finite test matrix, with a meaningful semantic RED reaching actual component behavior; missing fixture plumbing/undefined fake methods alone is not sufficient RED. Existing component deps can be controlled, but do not emulate successful whole Source or claim genuine authority. Make existing production behavior fail at least the new shared-boundary budget/order assertion. Test code should assert actual effect permission/order, e.g.:

```js
assert.equal(trace.filter(x=>x==='verifier:start').length,0); // Source drift at shared pre-call proof
assert.equal(trace.includes('reconcile:start'),false); // immediate post-verifier proof fails
assert.deepEqual(trace.filter(x=>x.startsWith('prepare:')),['prepare:1','prepare:2']);
```

Use actual existing fixture ledger names in J rather than a disconnected demonstration. Preserve each original registration and assert. Write task report with test names, fault-to-material-boundary mapping and old expectation changes; no test execution. Root runs RED before H release.

- [x] **Step 2: Root RED gate.** Freeze all current source hashes and task test delta. Run the exact previously qualified safe three-suite command below, recovered from original35122, with controlled fixtures. Never use a wildcard, execute native PM scalar tests or private constructors.

```bash
/opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js scripts/__tests__/private-postgres-test-cluster.test.js scripts/__tests__/path-contract-fixed-host-policy.test.js
``` Capture the original process/complete stdout+stderr/exit+both EOF/close and stable Source; qualify semantic failures independently. No H implementation before Root release.

- [x] **Step 3: Minimal H implementation after Root release.** Add this private lexical unit (all names already in actual enclosing runManualOrphanOwnedPhaseV1):

```js
const verifyMechanicalActivation=async()=>{
  check();
  const activation=await loadNamespaceLocal('activation');
  localPhaseCheck();localPhaseCheck();
  check();require(qualified);let verified;
  try{verified=await activation.verifyFreshInstallationActivationV1(directory);}
  catch{burn();throw ownedTransportUnknownV1();}
  check();return verified;
};
```

In qualifyMechanical, preserve paired prepared/activation reading, endpoint, qualify and actual closeQualification. Replace only `const activation=await load('activation');const verified=await effect(()=>activation.verifyFreshInstallationActivationV1(directory));` with `const verified=await verifyMechanicalActivation();`. Keep the entire following reconciliation/order and final check unchanged. B's two local guards remain above the shared C full proof, no await or untrusted access intervenes between C/qualified gate and actual invocation. A/C/D plus existing E yield four complete proofs. Method receiver, actual promise await, catch/burn and post-return await boundary remain.

Add the second private lexical unit:

```js
const prepareOldEntryTwice=async()=>{
  require(frame.purpose==='old_entry_positive'&&selectionMade);
  const database=moduleCache.get('targetDatabase'),entry=moduleCache.get('targetEntry');
  unprepared(database);
  localPhaseCheck();localPhaseCheck();
  await effect(()=>entry.prepareFreshInstallationOperationalEntryV1());
  const first=database.getSql();
  require(first!==null&&(typeof first==='function'||typeof first==='object'));
  entry.assertFreshInstallationOperationalEntryV1();database.assertSelectedFreshInstallationOperationalDatabaseV1();
  require(database.getSql()===first);
  localPhaseCheck();localPhaseCheck();
  await effect(()=>entry.prepareFreshInstallationOperationalEntryV1());
  entry.assertFreshInstallationOperationalEntryV1();database.assertSelectedFreshInstallationOperationalDatabaseV1();
  require(database.getSql()===first);check();
};
```

The private phase object supplies prepareOldEntryTwice. In oldEntryManualOrphanOwnedPhaseV1 preserve qualifyMechanical and the actual select(false); then `await phase.prepareOldEntryTwice();` replaces only original unprepared/prepare/assertion sequence. Keep actual closeDatabase, its following phase.check and the exact result unchanged. The closure's namespaces are the literal actual selected target cache slots, never supplied by a caller. Its two earlier pairs retain both original local guards and use the later existing effect opening full check. All effect post checks stay. Do not broaden other helpers.

- [x] **Step 4: Root GREEN and focused checks.** Same original safe-suite selection and complete capture as RED, all original names retained plus new finite controls; source stable throughout. Run `/opt/homebrew/Cellar/node/26.4.0/bin/node --check tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs` and `/opt/homebrew/Cellar/node/26.4.0/bin/node scripts/check-path-contract.mjs`. Existing K/F strict checks passed before; unchanged K/F do not require repeating them for this H/J change. No dirty build. If existing tests fail, repair production root cause or approved fixture plumbing only; retain safety assertions and explain every changed old expectation. An unknown capture/stream/display error is not a test verdict.

- [x] **Step 5: Independent task spec/quality review.** Root supplies exact complete diff/base/new Source hashes/RED+GREEN evidence and immutable spec references. Require C0/I0; rule on minor findings in ledger. Reviewer does not rerun tests or deliver. Fix loops use the same author for rounds1–3 and scoped re-review; no silent scope expansion. Record normal Source schedules24/29/27/24 incl close only after static actual-flow confirmation, not n×C performance claims.

- [x] **Step 6: Root Source-only checkpoint.** After independent Task1 approval, commit this task normally on the scoped branch. Shared final whole-branch review, PR and clean build occur after Task2; preserve this independent checkpoint. Rebind exact H/J/plan/build/Source pins; fresh actual Source point and separately admitted relevant real-Source deadline components. No overall completion, private rehearsal/native/full8/service rollout authority from these source tests or count reductions. If performance is still insufficient, continue a new evidence-backed proof-preserving hypothesis without widening guards.

## Root preflight rulings

Ruling: Adopt only mechanical5→4 and two old-entry adjacent pairs from the pinned design; broader two-proof import/verifier grouping is rejected because actual DB/native effects intervene — complete Source predicates remain at each required boundary — cost if wrong: revert the scoped branch refinement and re-review/retest before any actual private admission.

Ruling: The previous29-request/120s record remains a measured diagnostic overrun, not a universal floor or activation180s failure — exact Source clocks and interleaving matter — cost if wrong: repeat only a separately admitted meaningful component measurement, never relabel old evidence.

Ruling: Preserve all historical ignored SDD/evidence directories instead of generic workspace deletion — user continuity and non-destructive evidence rules take precedence — cost if wrong: bounded extra disk use, inventoried before any later authorized cleanup.


### Task 2: First observer qualification at complete acquisition boundaries

**Spec:** `/Users/setrox/ai/setrox/logs/2026-10-21-controls-current-evidence-v1/task7e-acquisition-first-observer-qualification-design-v1.md`,10764B,SHA256 `3d4334f89cb9e84a2dc6cb79a5c77b1b8a2ad81d987299c27f43dc7afe79026d`. Root read the complete report. This is a separately scoped causal refinement for the same measured acquisition/deadline cost, not a speed claim. It changes repeated transient sampling/failure ordering, while retaining the complete predicates at every distinct import and acceptance boundary.

**Files:** Modify H `tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs` only in the suffix beginning with the fixed two-release full-observer import loop through ready/return. Extend J `scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js` only for bounded actual-body acquisition controls. Root updates this plan/ledger. No T/M/raw/compiled/profile/public-check/closer/clock changes.

**Interfaces:** Consume the actual private `check`, `observers`, `ownedSourceEqualBuildV1`, `ownedSourcesV1`, `ownedSourceRequireV1`, `ownedSourceRefusalV1`, `ownedSourceHashV1`, `ownedSourceCleanupUncertainV1`, maintenance/target expected snapshots, profileBytes and comparisonFiles. Keep exact namespace `api.observeCurrentInternalProductionCleanSetfarmSourceBuildV1()` zeroarg method receiver and opaque invocation catch. Return the identical frozen public owner/source shape. No new public export or generic registration helper.

- [x] **Step 1: Tests only, then freeze for Root RED.** A fresh author reads TDD/writing-good-tests and implements a bounded fixture around the ACTUAL H acquisition suffix and ACTUAL H `check`/`close` declarations (AST/TS/VM seams already exist in J). Permit controlled dependencies for import/owner/pins/identity/context/codec and error injection; identify them as component controls, never successful whole Source. Include source DATA/codec/ready/return through the real final acceptance order. Existing actual package/import-order fixture stays intact; do not replace it with copied orchestration. All1995 current registrations and assertions remain.

The fixture `task7eAcquisitionObserverSuffixV1(options={})` is private J only and must expose `run()`, `events`, `reads()`, `observerSets()`, `finish()` so assertions observe real operations. For new H, success must produce:

```js
const f=task7eAcquisitionObserverSuffixV1();
const owner=await f.run();
assert.deepEqual(f.reads(),['M','M','M','T']);
assert.deepEqual(f.observerSets(),[[],['M'],['M'],['M','T']]);
assert.equal(Object.isFrozen(owner),true);
assert.equal(Object.isFrozen(owner.source),true);
owner.check();
assert.deepEqual(f.reads().slice(-2),['M','T']);
await f.finish(); // actual successful close also reads M/T exactly once
```

Establish meaningful preimplementation RED on extra first observations/final duplicate check and first actual call occurring outside complete-check custody. Missing fixture fields/undefined/parser faults are not valid RED. Preserve both package gates before first import via existing actual fixture. New controls must cover both roots' post-import guard before API inspection; wrong API/type/arity; the first actual invocation inside complete-check two pin bookends; six equality fields (branch,clean,originMainSha,sha,treeHash,buildHash); actual invocation throw sticky UNKNOWN; independent M/T snapshots/receiver/zero arguments; final first-pin/second-pin/context/raw-owner/identity/observer fault preventing publication; source DATA shape/codec fault before T read preventing publication without inventing an unstarted UNKNOWN; nested actual check invalidation; reverse retained cleanup, close failure and no retry; and unchanged later public check/close read order/composition. Use finite representative rows where existing unchanged controls already cover general closure behavior; document exact coverage rather than duplicating every matrix.

Report all new finite names, actual-body extraction boundaries, all controlled dependencies, fault-to-acceptance mapping, and any old expectation change. No H edit or execution until Root releases it. No provider/DB/native/private constructor.

- [x] **Step 2: Root semantic RED.** Pin the entire current Source and exact Task1 checkpoint before original safe3-suite execution. Use the SAME fixed argv:

```bash
/opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js scripts/__tests__/private-postgres-test-cluster.test.js scripts/__tests__/path-contract-fixed-host-policy.test.js
```

Capture original process/complete streams/natural exit/bothEOF+close, no Source mutation. Verify all1995 prior names pass, finite new semantic failures reach actual acquisition order/count and old opaque read behavior stays honest. Root alone qualifies and then explicitly releases H. No wildcard/PM scalar/native test.

- [x] **Step 3: Minimal fixed H suffix.** Keep preceding complete package/resolution gates, both imports and their immediate post-import checks, exact API/arity gates, read closure/catch/branch-clean-origin validation byte-for-byte. Make source private before the loop, register its unchanged `{read,expected}` before the first actual read, and use existing complete `check()` as first qualification. For only the literal final target iteration, build/freeze/validate fixed Source DATA BEFORE that existing T-registration full check. Remove only standalone `ownedSourceEqualBuildV1(read(),expected)` and the now-adjacent final duplicate initialization check. The actual code shape is:

```js
let source;
for(const [root,expected] of [[maintenanceRoot,maintenance.expected],[targetRoot,target.expected]]){
  const api=await import(pathToFileURL(path.join(root,ownedObserverV1)).href);check();
  ownedSourceRequireV1(typeof api.observeCurrentInternalProductionCleanSetfarmSourceBuildV1==='function'
    &&api.observeCurrentInternalProductionCleanSetfarmSourceBuildV1.length===0);
  const read=()=>{
    let value;
    try{value=api.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();}
    catch{
      ownedSourceCleanupUncertainV1=true;throw ownedSourceRefusalV1();
    }
    ownedSourceRequireV1(value?.branch==='main'&&value.clean===true&&value.originMainSha===expected.sha);return value;
  };
  observers.push({read,expected});
  if(root===targetRoot){
    source=Object.freeze({maintenance:maintenance.expected,target:target.expected,
      profileSha256:ownedSourceHashV1(profileBytes),files:Object.freeze(comparisonFiles)});
    // Validate exact private DATA before the terminal complete acceptance proof.
    ownedSourcesV1(source);
  }
  check();
}
ready=true;
return Object.freeze({source,check(){ownedSourceRequireV1(ready);check();},close});
```

Preserve the existing explanatory opaque-catch comment. Push/assignment grant no authority; ready/public return occur only after final complete proof checks M AND T. No imported/getter/await/external work between that proof and publication. First actual read now runs under unchanged check.active, both pin passes, full owners/raw M/anchor/identity/context and unchanged six-field equality. Expected snapshots never refresh. Success suffix M5/T3→M3/T1; no successful counts promised on failed paths. A started throwing read still burns sticky uncertainty; an unstarted T read after codec/earlier guard refusal must not fabricate it. Outer acquisition invalidation, reverse closers and successful Source.close complete proof remain unchanged. No skip/cached predicate/early ready/new FD/callback mode.

- [x] **Step 4: Root GREEN and focused checks.** Repeat original safe3-suite selection on exact fixed Source, preserve all1995 prior names plus finite new names, require allPASS/0skip/cancel/todo with complete stable capture. Run exact H `node --check` and `node scripts/check-path-contract.mjs` above. No dirty build; K/F remain unchanged. Repair actual defects/fixture plumbing with same author and fresh capture namespaces, never weaken old safety controls. No performance inference from controlled events.

- [ ] **Step 5: Independent task spec/quality review and normal checkpoint.** Root sends full Task2 diff from Task1 checkpoint, immutable brief/report/spec and RED/GREEN pins. Require C0/I0; ledger minor findings and controller-resolve items. Fresh reviewer, no execution/delivery/subagents. Root alone normal commit after approval; preserve Task1 checkpoint. Task2 changes acquisition only, not phase schedules24/29/27/24 or subsequent public Source check/close composition.

## Shared Root delivery and runtime verification

- [ ] **Step 1: Final whole-branch review.** After BOTH task gates and normal commits, fresh most-capable independent reviewer reads full64c→HEAD diff, both specs and all task rulings. Resolve C/I findings; no second broad review per task. Preserve all SDD/evidence directories.
- [ ] **Step 2: Normal reviewed Source delivery and clean stock build.** Root pushes scoped branch, opens/updates normal PR, inspects actual review/check state and uses ordinary reviewed merge under standing authorization. No directmain/force/admin/history rewrite. Create a NEW physical clean main release, stock npmci/build with exact provenance and complete capture. Never build or patch fixed T/current live release/dirty W.
- [ ] **Step 3: Fresh actual Source point and relevant real-Source deadline experiment.** Rebind exact new main/H/J/plan/build/source pins. Root independently validates Source DATA, full original process/stream/FD/close custody. Admit a separately scoped meaningful actual-Source phase-component experiment under unchanged120/180/300 clocks; do not turn synthetic n×C into universal floor/fit or call controlled SQL genuine. Native/current-material/initialTCB/OS/continuousDB/genuine/full8/rollout gates remain open until their own actual records pass. If cost still insufficient, continue evidence-backed proof-preserving hypotheses, never widen clocks or omit required guards.

Ruling: Add acquisition qualification as Task2 before shared final delivery — actual A39886ms and CPU attribution show acquisition remains a causal cost, and static inspection identifies duplicate samples without a distinct import/effect/acceptance boundary — cost if wrong: keep Task1 checkpoint, revert only Task2 on this scoped branch, re-review/retest before any actual private admission. Repeated transient sampling equivalence and elapsed speedup are not claimed.
