# Task2A owned route Slice1 Implementation Plan v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Execution contract:** Root delegates one Source-only writer at a time and independent reviews. Workers never execute project code/tests/runtime or deliver Git changes, and never spawn agents. Root alone executes and delivers.

**Goal:** implement and causally test only the inactive genuine-route reservation plus concrete fixed minimal-child issuer/receiver/original lifecycle boundary.

**Architecture:** extend existing constructor's two closed inventories and pure vector with exactly one mode, but return unconditional unavailability before effects. Reserve/refuse the genuine file in wrapper/isolated runner; independently exercise actual builtin fixed-child framing/current-parent/FD/stream/exit-close code with a real probe. The probe carries no cluster/setup authority and cannot unlock the inactive route.

**Tech Stack:** Node ESM builtins, existing TypeScript transpiler and node:test, fixed Darwin ps observations, current private-constructor test patterns. No application module/PG import in the new helper.

**Spec:** companion `../specs/2026-10-21-manual-orphan-owned-route-slice1-v1.md`. Binding adopted spec/plan remain `docs/superpowers/specs/2026-10-21-manual-orphan-task2a-bootstrap-v1.md` and its Task2A parent-plan slice. Root adopts this finite subplan after the verified60fe8205 preflight checkpoint; the broader v2 setup proposal remains unadopted.

## Global Constraints

- Sole W: `/Users/setrox/ai/setrox/.worktrees/setfarm-dashboard-cutover-controller-20261007-v1`, original checkpoint `f9b94f715e0f3f877b17af9628246aa0b0cd2beb`. Implementation baseline is verified clean60fe8205f49352d4131cd38b6a1406e02c856784 (actualNode26original48945=227/227PASS). Drafting performed no W edits/execution; do not duplicate that correction: Node26 original44991 gave226PASS/1FAIL for suffix actual24 versus literal23, and Root's implementer owns adding existing `v3-predecessor-completion-claim.integration.test.ts` to the suffix literal and package test:after-terminal. Earlier43/39 count boundary was separately fixed. Node22 constructor79PASS/148FAIL is unsupported by existing>=26 guard; do not weaken it. New route inventories13→14 remain distinct from suffix23→24.
- Preserve four production modules/profile, unchanged old T/I5, Task1 pure helper, current component helper, existing Task4/P3 schema and every unrelated ordinary mode/vector/environment.
- No general executor/root/URL/env/module selector or permission field; no production setter, HOME/account/login change, projection/preload/clone-PG substitution, guard bypass or I5 record copy.
- Slice1 mode and genuine vector always refuse before effects; no partial branch starts PG or dispatches a stub. Only a bounded minimal child is newly executable.
- Frame maximum16384 bytes; receipt/output maximum65536 bytes per stream; source16MiB/file, executable512MiB; ancestor count128; fixed ps2000ms/max16384; FD read5000ms; parent observation10000ms. These are the companion specification's finite bounds.
- Original handles, agreeing exit+close, actual stdout/stderr EOF+close, descriptor finish+EOF+close and actual pin closes are required. No signal/adoption/destructive cleanup API.
- External Root original constructor launch/dependency admission stays separate from every private frame. Actual8GiB floor plus factory64MiB margin remains mandatory in future Slice2; this slice creates no cluster/root/password/role.
- Genuine M/T generated-I preparation, old DB positive, full-adapter fixed-T Source drift and fixed-I5 observation remain UNRUN. Component/event/probe results must retain their precise labels.
- No new permission or execution-choice question follows from this draft. Root owns adoption, delivery and later concrete effect gates.

---

## Locked file map and cumulative handoff

Six Slice1 implementation paths:

1. `scripts/run-private-postgres-tests.mjs` — two-inventory/new pure-vector extension and unconditional unavailable main branch.
2. `scripts/__tests__/private-postgres-test-cluster.test.js` — exact14-mode inventory, consumer refusal/effect-order and existing ordinary regressions.
3. `scripts/run-execution-attempt-tests.ts` — reserved filename refusal before requested validation/any dispatch.
4. `scripts/run-isolated-postgres-tests.ts` — exact/near classification and unavailable branch before Task4/P3.
5. `tests/execution-attempts/helpers/manual-control-orphan-bootstrap-child-v1.mjs` — all finite inert interfaces, actual normal probe issuer and direct minimal child.
6. `scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js` — real probe/receiver tests and separately labeled actual-consumer simulations.

The cumulative v2 map stays EIGHT implementation files: Slice2 adds/extends `tests/execution-attempts/helpers/manual-control-orphan-bootstrap-fixture-v1.ts` and `tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts`. No placeholder integration file/owner-set entry now. Root updates adopted docs/plan only at adoption/result boundaries. No package.json or new protocol module is needed.

## Task 1: Causal inactive-route RED and narrow routing implementation

**Files:** modify paths1–4; create classifier/constants portion of path5 and test harness portion of path6. This task makes no active issuer or database path.

**Consumes:** actual current `main()`, `commandArguments()`, wrapper discovery/raw-owner selection and the existing constructor inventory assertion at lines904–920.

**Produces:** immutable `MANUAL_ORPHAN_BASENAME_V1`, `MANUAL_ORPHAN_VECTOR_V1`; pure `mentionsManualOrphanFileV1(cells)` and `classifyManualOrphanVectorV1(cells)` with exact companion-spec semantics. Main actual future mode/vector cannot reach effects.

- [x] Step1 — Add local literal vectors and Source-contained actual-consumer harnesses to path6, and constructor assertions to path2, before the new helper exists. Do not import a nonexistent helper for the initial RED. Tests must run actual current function/branch Source, not test a duplicated classifier.

Test-local harness contracts (not production exports):

```ts
type RouteCapture = {
  thrown: string | null; stderr: string; exitCode: number | undefined;
  calls: {preconditions:number; admin:number; task4:number; projection:number;
          spawn:Array<{args:string[];env:Record<string,string|undefined>}>};
};
runConstructorSourceV1(args: string[], removeUnavailable?: boolean): Promise<RouteCapture>;
runIsolatedSourceV1(vector: string[], removeUnavailable?: boolean): Promise<RouteCapture>;
runWrapperSourceV1(args: string[], discovered: string[]): RouteCapture;
```

Implement these ONLY in test files: read the complete exact existing Source; transpile TS/CommonJS with installed TypeScript; replace exact import.meta.url literals with that file's URL and direct main-entry plumbing with an exposed VM-local main. Require the replaced-site count to equal the expected count. Supply mocked module imports and fake process/stdio; import the REAL new inert helper namespace once it exists and bind it into the VM require table. No app imports execute in the VM. For isolated Source module initialization, `node:fs.realpathSync` is an identity function on the fixed fileURLToPath-derived Source root, `node:os.tmpdir` returns the inert test path, `node:path`/`node:url`/`node:crypto.createHash` are actual pure/builtin bindings, and all other IO members throw counted sentinels. The Task4 import maps only isTask4CommandV1 to a counter returning false; every other export throws if called. postgres is a counted throwing constructor. Constructor journal module exposes only fake terminal mirrors for its pre-effect branch; journal creation and preflight/native/net calls all throw if reached. Wrapper readdir returns only supplied Dirent-shaped records. Reject any unlisted nonbuiltin require, so the harness cannot accidentally import real application modules.

Constructor fake terminal mirror only appends buffers to the capture; fake process uses supplied argv and setters. Replace only the downstream preconditions function binding in VM after evaluating declarations with a sentinel that increments `calls.preconditions` and throws fixed `OBSERVED_PRECONDITIONS`; this is the first downstream boundary and prevents allocation. All fs allocation/password/random/child/SQL bindings also throw and increment a forbidden-effects counter if accidentally reached. Do not rewrite main's branch body. For isolated runner use actual classifier/command grammar/main with Task4 imported function counter and normalizedAdminUrlV1/projection boundary sentinels; the first downstream call is observable. Wrapper mocks only readdir results and spawnSync, records actual vectors/environment; real discovery/classification/control flow executes. Fake process.exit throws a fixed test-local terminal sentinel instead of exiting tests.

For guard-removal calibration, change ONLY the newly inserted unavailable statement in an IN-MEMORY copy, assert exactly one match/replacement, and require the resulting actual main to hit its downstream sentinel. Do not edit W or remove the classifier/other guards. Every simulated assertion is labeled `source-contained`, never original-process evidence.

Initial assertions (literal vectors until helper implementation):

```js
const file='tests/execution-attempts/manual-control-orphan-bootstrap-v1.integration.test.ts';
const vector=['node','--import','tsx','--test','--test-concurrency=1',file];
const c=await runConstructorSourceV1(['manual-orphan-bootstrap']);
assert.equal(c.stderr,'MANUAL_ORPHAN_SLICE2_UNAVAILABLE\n');
assert.equal(c.exitCode,1); assert.equal(c.calls.preconditions,0);
const i=await runIsolatedSourceV1(vector);
assert.equal(i.thrown,'MANUAL_ORPHAN_SLICE2_UNAVAILABLE');
assert.deepEqual([i.calls.task4,i.calls.admin,i.calls.projection],[0,0,0]);
const w=runWrapperSourceV1([file],[file.split('/').at(-1)]);
assert.equal(w.thrown,'MANUAL_ORPHAN_CONSTRUCTOR_REQUIRED');
assert.equal(w.calls.spawn.length,0);
```

- [x] Step2 — Root runs the new focused cases against existing Source. Expected semantic RED: constructor returns existing MODE_INVALID; isolated runner reaches Task4/admin sentinel; wrapper routes the supplied discovered filename raw (or explicit missing filename UNKNOWN), all contrary to the required boundary. Record exact failure and original test-process result. Missing helper/file/export is NOT the accepted RED.

- [x] Step3 — Create inert constants/classifiers in path5, with no module-time IO. Exact algorithm:

```js
const mentions=cells=>cells.some(cell=>cell.toLowerCase().includes(MANUAL_ORPHAN_BASENAME_V1));
// Validate actual Array<string> before these operations.
const same=cells.length===MANUAL_ORPHAN_VECTOR_V1.length
  &&cells.every((cell,i)=>cell===MANUAL_ORPHAN_VECTOR_V1[i]);
return same?'exact':mentions(cells)?'near':'unrelated';
```

Import inert exports into the three consumers. Constructor: append the single new mode to BOTH existing closed arrays and add the pure plan's FIRST test-vector branch `mode==='manual-orphan-bootstrap' ? ['--import','tsx','scripts/run-isolated-postgres-tests.ts','--',...MANUAL_ORPHAN_VECTOR_V1] : existing`. After CLI exact-one-arg/mode validation insert:

```js
if(args[0]==='manual-orphan-bootstrap'){
  mirrors.stderr.write(Buffer.from('MANUAL_ORPHAN_SLICE2_UNAVAILABLE\n'));
  process.exitCode=1;return;
}
```

No literal ready flag/config switch/descriptor makes it active. Extra argv still fails existing MODE_INVALID. Extend existing expected inventory to14 by the one suffix; preserve assertion that there are exactly two inventories with mode/args[0] and exact equal ordered members. Do not remove that regression.

Wrapper: check explicit process.argv.slice(2) mentions before current requested validation; check no-args discovery for reserved basename before any raw/owner launch. Throw fixed CONSTRUCTOR_REQUIRED. Do not register the nonexistent integration file in owner set. Isolated main: retain ambient SETFARM_PG_URL check; classify raw cells after first `--`; near throws ROUTE_REFUSED; parse command through existing commandArguments; exact throws SLICE2_UNAVAILABLE before Task4. Neither branch reads FD4.

- [x] Step4 — Add finite near-match cases: uppercase basename, `./` prefix, absolute prefix, backslash path, suffix `.bak`, extra operand, extra flag, changed concurrency and genuine path in a nonfinal cell. All reserved mentions must refuse before P3. Existing malformed unrelated commands retain their existing grammar failure. Add wrapper no-args discovery containing reserved file; must refuse before even unrelated raw tests execute, without modifying filesystem.

- [x] Step5 — Run Task1 tests and the existing constructor test file. Calibrate both unavailable branches by IN-MEMORY removal → first downstream sentinel becomes reachable. Check a table of all13 prior modes against existing literal vectors and environment recordings; new pure vector is the only extra case. Unknown mode/URL/command-tail/extra argv retains existing rejection. Preserve all existing inventory assertions.

## Task 2: Exact codec, observation and real minimal child

**Files:** implement path5; extend path6 only.

**Consumes:** Task1 constants; builtin fs/crypto/net/child_process/path/url; the small existing Task4 ps/file-pin behavior as read-only implementation reference. Do not import Task4 or its context/schema.

**Produces:** ALL companion-spec signatures: `encodeManualOrphanProbeFrameV1`, `decodeManualOrphanProbeFrameV1`, `observeManualOrphanProcessV1`, `pinManualOrphanProbeSourcesV1`, `observeManualOrphanOriginalChildV1`, `readManualOrphanProbeFd4V1`, zero-argument `runManualOrphanLifecycleProbeV1`. Types and exact field/key orders are fully defined in companion spec; no additional public export or setup schema is needed.

- [x] Step1 — Write codec semantic tests using a hand-derived fixed ProcessPin and explicit ordered expected bytes. The concrete fixture below is shape data, not a real process:

```js
const p={pid:123,ppid:122,uid:501,pgid:122,
  startedAtUTC:'2026-10-21T00:00:00.000Z',executable:'/usr/bin/node',
  executableSha256:'a'.repeat(64),commandSha256:'b'.repeat(64)};
const f={schema:'setfarm.manual-orphan-lifecycle-probe.v1',nonce:'c'.repeat(64),
  parent:{...p,pid:122,ppid:121},child:p,
  source:{helperSha256:'d'.repeat(64),issuerTestSha256:'e'.repeat(64)}};
assert.deepEqual(encodeManualOrphanProbeFrameV1(f),Buffer.from(JSON.stringify(f)+'\n'));
for(const bytes of [Buffer.from('\ufeff'+JSON.stringify(f)+'\n'),
  Buffer.from(JSON.stringify(f)+'\r\n'),Buffer.from(JSON.stringify({...f,permission:true})+'\n'),
  Buffer.from(JSON.stringify(f)+'\n{}\n'),Buffer.from([0xff,0x0a])]){
  assert.throws(()=>decodeManualOrphanProbeFrameV1(bytes),/MANUAL_ORPHAN_FRAME_REFUSED/);
}
```

Also assert duplicate top-level/inner keys, alternate key order/escapes, missing final LF, zero-length,16385 bytes, unsafe integers, wrong timestamp weekday/month round-trip in process parser, arrays/null/accessors and wrong source field all refuse. Nonce-only shape-valid changes are accepted by the codec; parent's digest correlation is a separate test.

- [x] Step2 — Write the independent codec assertions first. Capture absent-contract/minimal-stub failures as incremental new-code TDD, without existing-regression credit; then implement the missing ordered fresh reconstruction/fatal UTF-8/byte-equality/deep-freeze behavior and rerun. Never remove working code or introduce a deliberate defect to manufacture RED. Record which actual assertion failed and its exact scope.

- [x] Step3 — Implement stable fixed Source pins and ps-before/comm/ps-after observations. Use absolute `/bin/ps`, fixed env/args/caps and exact date validation from spec. Pin only code-derived fixed helper and issuer test paths. No root input, package inventory, Git operation or target import. File read/recheck/close has one owner; cleanup uncertainty is sticky. Test malformed process OUTPUT through a test-contained consumer harness of the actual parser; label these parse simulations. Actual process observation is exercised by the live probe in Step6.

- [ ] Step4 — Write the actual lifecycle event-consumer tests before filling its settlement predicates. A fake original object is EventEmitter with PassThrough stdout/stderr/fd4. Drive exact sequences; assertions:

```js
const witness=observeManualOrphanOriginalChildV1(fake);
fake.emit('exit',0,null);
assert.equal(witness.snapshot().state,'pending');
// stdout/stderr end+close alone still leave fd4/child close pending.
// A finish-only fd4 must not settle observed.
// Agreeing close and all three stream closures are necessary.
```

Cover missing/duplicate/conflicting exit/close, spawn/stream error, data after EOF,65537-byte overflow, fd4 inbound bytes, fd4 finish without end/close and deadline. Final predicate is a conjunction of actual observed events; unknown must never return observed after later good events. These fake events are explicitly components, not genuine original child proof.

- [ ] Step5 — Implement fixed child and normal issuer. Child direct entry accepts only its exact derived helper path/zero flags/cwd/three-key environment, reads only FD4, validates actual self/immediate parent and Source hashes, closes descriptor/pins, emits exact receipt, exits. Its imports are builtins only. Normal issuer validates current caller's fixed test-file path, pins Source, spawns exact same helper with physical current Node and fixed env/stdio, immediately attaches witness, observes original parent/child, encodes/sends its own frame, and requires exact digest/receipt from the witness bounded `output()` bytes plus original settlement and parent pin close. No frame/case/env callback is accepted by the normal issuer. Keep errors sanitized; do not leak process command/env or paths.

Code shape for the normal issuer's only spawn (bindings are locally derived/observed):

```js
const child=spawn(nodePhysical,[helperPhysical],{
  cwd:sourceRoot,argv0:nodePhysical,shell:false,detached:false,
  env:{PATH:path.dirname(nodePhysical)+':/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
  stdio:['ignore','pipe','pipe','ignore','pipe']
});
const witness=observeManualOrphanOriginalChildV1(child); // immediately; retain child first
// Pin/observe actual parent+child, construct exact frame, writer.end(bytes).
// Await actual receiver receipt, original settlement and every owned close.
```

`observeManualOrphanOriginalChildV1` is an observation primitive, not a capability mint; it can be fed simulated events in tests and must never grant spawn/signal/SQL rights. The actual normal issuer's retained original handle supplies ownership in a live run. No constructor/PG frame is implemented in this slice.

- [ ] Step6 — Run real positive `await runManualOrphanLifecycleProbeV1()` from the exact test file. Assert receipt schema/digest shape/current pid relationship and actual normal exit0/close/streams/FD4; implementation resolves only after parent pins close. Run under the actual admitted local Node first; record Node version/platform explicitly. Source suffix/preload refusal is not accepted as this positive. Do not label it M/T/bootstrap admission.

- [ ] Step7 — Add real receiver negatives in test file, manually spawning only that same helper/vector/env and binding the real witness immediately. Build otherwise current frames from actual observeProcess/sourcePins functions. Cases: wrong parent PID/pin, wrong child birth/pin, wrong helper hash, extra property, duplicate JSON key, invalid UTF-8, truncated bytes, read timeout without EOF, and replay of a completed earlier child frame. Keep writer/stream closure ownership; no kill. For missing EOF, the receiver's own5000ms deadline causes actual refusal; await original exit+close. Use no real intentionally permanent hang; missing terminal tests remain event simulations.

For shape-preserving nonce change: record issuer's original expected frame digest, deliver changed bytes from negative test writer, and assert PARENT comparison rejects the differing receipt; do not claim the child independently authenticated the nonce. A copied frame must be rejected by current child/parent binding, not merely a formatting/preload issue. Assert every real negative has empty stdout or the specifically expected changed-frame receipt, fixed stderr/outcome and complete actual process lifecycle.

- [ ] Step8 — Test pin-close uncertainty in a SOURCE-CONTAINED helper harness that replaces only fs.closeSync with a one-shot throwing binding for its own fake FD; actual normal-issuer finally must reject UNKNOWN rather than return receipt. No production/test env switch or child Source patch. Label this a close-consumer simulation. Do not claim actual DB/journal/client closure tests: those consumers belong to Slice2.

## Task 3: Proportional verification, review and exact handoff

**Files:** six scoped files only; Root-owned adopted docs/plan and session handoff updated after verified phase boundary.

**Consumes:** actual Task1/2 implementation and observed test results, unchanged ordinary-mode inventory and routing; no PG setup.

**Produces:** independently reviewable inactive route/lifecycle slice, with exact remaining gates.

- [ ] Step1 — Root uses existing required repo status checks and confirms its verified clean successor and sole writer before edits/delivery. Do not duplicate or overwrite the separate preflight test/package correction or write W while its baseline/correction owner is active. Preserve any newly discovered dirty file; do not create a competing writer or overwrite concurrent changes.

- [ ] Step2 — Focused test commands (planned, NOT executed by this drafting task), from W with the already admitted explicit Node environment:

```sh
/opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-concurrency=1 scripts/__tests__/manual-orphan-bootstrap-owned-route-v1.test.js
/opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-concurrency=1 scripts/__tests__/private-postgres-test-cluster.test.js
/opt/homebrew/Cellar/node/26.4.0/bin/node --import tsx --test tests/execution-attempts/manual-control-orphan-maintenance-v1.test.ts
```

Run the already established repository noEmit command unchanged as an adjacent src-only check. Its include is src/**/*.ts: it does not typecheck the two TS routing scripts or MJS helper. Exercise their actual TypeScript transpilation and real helper namespace imports/exports in the stated test scope; do not claim scripts typechecking. Add no tsconfig relaxation, suppression, guessed bare compilation/dist copy or dirty-build workaround. A complete stock build remains Root's clean-main delivery gate; do not claim it from focused tests or noEmit.

- [ ] Step3 — Inspect actual original test-process exit/close/stdout/stderr completion, counts and assertions. Record evidence in three separate groups: actual live minimal probe/receiver results; pure codec/event-consumer results; Source-contained routing/close simulations. Constructor real exact-mode invocation may separately establish its refusal encoding, but source-contained preconditions counters do not prove a runtime original launch. Missing/cancelled captures remain unknown; a model/thread failure is not a project test failure.

- [ ] Step4 — Independently review exact six-file diff: fixed8-total map, no production/profile/Task1/Task4/P3 changes; two matching14-member mode arrays; old13 vectors/env unchanged; no inactive-mode bypass; no raw route; exact codec; actual immediate owner observations; finite bounded reads; listener registration before fallible work; descriptor/event/pin close handling; no permission data or generic executor. Review must distinguish observed file fingerprints from finalized Source/build authority.

- [ ] Step5 — Root records verified Source milestone using normal scoped branch/review delivery authority and the existing sole writer. If commit is appropriate, stage exactly these six implementation paths and only adopted in-scope docs; a conventional subject is `test: bound manual orphan owned route`. No direct-main commit or build/effect claim follows. Do not use this plan as permission to bypass failed checks or merge without actual required review.

- [ ] Step6 — Handoff to Slice2 states precisely: constructor pure plan knows the one fixed vector, but actual mode and isolated exact branch remain unconditionally unavailable; normal minimal-child issuer/receiver and lifecycle are implemented and tested; no PG setup issuer exists yet. Slice2 must add distinct strict runner setup schema with compact authenticated summaries and finite file pins (never inline complete inventories under16KiB), independently re-admit full Source/build/package closures, and create the two deferred fixture/integration paths. Complete live constructor ownership/setup/cleanup path must exist before removing unavailability guards. Preserve wrapper refusal and add OWNER_BACKED_TESTS entry only with the real integration file.

Slice2 retains actual current Root setup/cluster/role/credential/cleanup and original-launch gates,8GiB+64MiB floor, actual unchanged T APIs and Source/build guards. Its generated-I positive never substitutes for fixed-I5 production noarg positive or the unresolved independently owned exact-layout full-adapter T Source-drift topology/phase observation. All remain UNRUN in this slice's delivery notes.

## Acceptance checklist and draft status

- [x] Current consumer semantic RED captured; missing file/export alone not counted.
- [x] Actual two closed inventories remain asserted, now exactly14 members; all13 prior vectors/env unchanged.
- [x] Exact inactive constructor/isolated route always refuses before downstream effects; near matches never reach P3; wrapper cannot raw-dispatch genuine file.
- [ ] Normal issuer has only its fixed minimal child, no caller selectors or setup/permission data.
- [ ] Exact canonical frame and independently observed immediate parent/self/source files enforced; nonce role correctly limited to correlation.
- [ ] Real positive and real receiver negatives include actual original exit+close, streams and FD4 close; event/VM simulations separately labeled.
- [ ] All actual Source pins close or UNKNOWN overrides; no orphan signal/cleanup behavior added.
- [ ] Root required focused tests/noEmit/review observed; no PG/build/bootstrap/publication credit inferred.

Root adopts this finite Slice1 subplan. No missing implementation input is left behind a placeholder issuer. Task1 is implemented and verified as recorded below; Task2 codec/minimal-child implementation and Task3 final slice verification remain pending. Actual generated-I/PG setup and later Task2A gates remain UNRUN by design.

## Verified Task1 checkpoint (2026-10-21)

Root observed current-consumer RED: original70132 exit1,283 tests,256 pass/27 expected failures (24 consumer routing mismatches plus3 new inventory/plan contracts). The subsequent frozen six-file implementation passed285/285 on admitted Node26, original85425 exit0,0failed/skipped/cancelled; this includes231 constructor contracts and54 source-contained route/guard-calibration cases. Both original stdout/stderr reached EOF and closed;2415 Source pins were unchanged. Adjacent Node22 src-only noEmit original85426 exited0 with empty output; it does not typecheck scripts/MJS.

Independent Task1 spec and quality review approved the six-file package, C0/I0/M1. Minor deferred: direct malformed-array coverage of both pure classifier exports; carry into the next test group. Root confirmed all four production/profile hashes unchanged against their recorded freeze; no protected-surface edit is present in this Task1 diff. Live oldT/I5 were not modified by this Source work.

Task1 evidence is inactive-route/pure/Source-contained verification only. No minimal child has been implemented or launched, no PG setup issuer exists, both unavailability guards remain unconditional, and genuine M/T/generated-I/fixed-I5/full-adapter drift/full8 gates remain unrun. GitHub automated review previously failed account quota and provides no approval; no merge, stock build or rollout follows from this checkpoint.

## Verified Task2 codec subphase (2026-10-21)

The helper now adds the two pure canonical codec exports while retaining inert imports and all four prior exports. No process, source-pin, FD4, lifecycle, probe or PG-setup implementation exists yet. Actual original94548 recorded the honest incremental missing-contract phase:191 tests,74 controls passed and117 absent-codec-method failures. This supplies no existing-regression credit. Initial implementation original99396 passed191/191, but independent review found the encoder's missing total frame-size check under JSON escape expansion.

Five independent boundary tests then exposed the actual omission: original3502 exited1 with193 passing and3 encoder-overflow failures; exact16383/16384-byte frames and all191 prior controls passed. The smallest encoder fix measures complete serialized bytes including LF and refuses above16384. Original5094 then exited0 with196/196PASS,0failed/skipped/cancelled, empty stderr and no diagnostics; both original streams ended/closed and2415 Source pins were unchanged. These196 comprise122 codec cases,20 pure classifier cases and54 source-contained route cases.

The independent fix review closed I1 and approved this codec subphase C0/I0/M0. Root rechecked the exact two-file Source scope, frozen consumer/constructor hashes and four unchanged production/profile hashes. Task1's minor classifier-input coverage is now present. No src change occurred; prior adjacent src-only noEmit is not relabeled as scripts/MJS typechecking. Full Task2 and Slice1 remain incomplete: process/file checks, original event/FD4 consumers, real minimal probe/receiver positives and negatives, close-uncertainty composition and final proportional verification are next. Both future-route unavailability guards stay unconditional; genuine M/T/PG, fixed-I5, full-adapter drift, stock build, rollout and full8 receive no credit.

## Verified Task2 process/file subphase (2026-10-21)

Only observeManualOrphanProcessV1(pid) and zero-argument pinManualOrphanProbeSourcesV1 plus their private support are added. Their Source test phase preserved196 prior cases and added64 Source-contained process/file cases plus2 actual local observation cases. Initial original17288 exited1 with196 passing and66 absent-observation-export failures; this is honest incremental scaffolding without semantic-regression credit.

After implementation original24729 exited0 with262/262PASS,0failed/skipped/cancelled and no diagnostics. Both original output streams reached EOF/closed,2415 Source pins remained unchanged. The two actual local positives read the current Node26.4.0 Darwin arm64 process and the fixed public helper/issuer Source pair;64 other new cases are explicitly Source-contained ps/file simulations. Independent spec/quality review approved this subphase C0/I0/M0. Root rechecked the complete196-case prefix, all six prior helper exports, frozen routing/constructor hashes and four unchanged production/profile hashes.

Root resolves the observation error-map ambiguity: invalid PID, ps/parse/binding and non-close file/identity/content/check-after-known-close refusals use fresh MANUAL_ORPHAN_OWNER_REFUSED. Any actually owned FD close uncertainty overrides results as sticky fresh MANUAL_ORPHAN_CHILD_UNKNOWN; it is never retried. Existing codec FRAME_REFUSED remains unchanged. This is a closed-code clarification, with no new permission or selector.

The helper has eight exports and remains inert on import. No original-child event witness, FD4 reader, minimal child/direct entry, normal probe issuer, PG setup or route activation exists yet. Local file fingerprints are not finalized Source/build admission. Full Task2/Slice1, real child lifecycle, PG/genuine M/T/fixed-I5/full-adapter drift/full8 and rollout remain pending.
