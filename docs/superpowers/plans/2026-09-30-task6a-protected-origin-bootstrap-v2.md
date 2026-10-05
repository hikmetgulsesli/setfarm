# Task6A Protected Source-Entry Bootstrap v2 Implementation Plan

## Ordinary native NAME identity viability implementation subplan

**Goal:** Determine actual ordinary own-Node NAME/audit binding support without
CONTROL, target VM mutation or protected-origin authority.
**Architecture:** One fixed C parent owns its actual Node child, private pipes,
exclusive reap and one NAME right. Compare opaque audits while child is live;
then definitely close protocol, child and original right. Keep bootstrap refused.
**Spec:** docs/superpowers/specs/2026-09-30-task6a-protected-origin-bootstrap-v2-design.md,
section Ordinary native NAME identity viability slice.
**Tech:** C11/Darwin NAME APIs, existing builtin Node entry, ordinary Node tests.
**Status:** Ordinary implementation and the finite current-source 22-case
host matrix are verified in separate closed batches. Final independent review,
reviewed PR delivery and a new clean-main build remain open. No exhaustive
uncertainty/root-UID coverage, protected/P2 or cutover admission.

The pre-effect recipes below are retained historical design records, not new
execution instructions. Their dated receipts supersede prospective source
versions and open-control wording. Do not replay closed historical invocations.

File Map:
- Create scripts/task6a-origin-native-name-v2.c: private fixed ordinary parent.
- Create scripts/__tests__/task6a-origin-native-name-v2.test.js: real CLI/protocol/
  identity/closure behavior using owned ordinary fixtures and compiled source.
- Modify the existing named protected spec and this plan only.
- No edits to bootstrap/entry/map/native helpers, packages, DB, services or old roots.

### N1: Reviewed source contract and test-support RED

- [x] Independently review exact spec/plan and causal File Map; root self-review
  rejects any positive authority, ambiguous after-exit audit or caller selection.
- [x] Stage/commit only these reviewed docs on the new isolated ordinary branch.
- [x] Write the first behavior test for actual compiled CLI refusal of an extra
  argument, exact exit2/empty stdout/canonical stderr and no entry-start witness.
  Derive literal expectations independently; do not grep C source.
  A missing new C program yields an unavailable test-support result before
  compiler execution; it is not a semantic native/kernel witness.
- [x] Execute this one test and capture expected failing assertion before C code.
  Label it test-support RED, never P2/native RED.

First consumer expectation:
```javascript
const actual = await invokeOwnedProbe(['unexpected']);
assert.equal(actual.code, 2);
assert.equal(actual.stdout, '');
assert.equal(actual.stderr, 'TASK6A_NATIVE_NAME_PROBE_REFUSED\n');
assert.equal(actual.entryStarted, false);
```
invokeOwnedProbe is test-only support: read the fixed C source, return unavailable
when absent, otherwise use only the separately admitted compiler/owned fixture.
It never supplies a public production PID/path/callback.

N1 actual receipt (do not replay): docs commit90247896; test-support RED555c47
naturally exit1, source-unavailable/null versus required2, no compiler/native
effect. Minimal C67897663 only unconditionally prints refusal and returns2;
it does not yet discriminate argc/UID or own a child/NAME right. Strict TDD
ruling: implement only this refusal until further real behavior tests fail.

Reviewed test77705235 uses fresh private same-source fixture, separately
calibrated identical startup-witness entry bytes, fixed held tools/SDK settings/
libSystem stub, separate no-default-config object/link recipes, explicit linker
`-Z`/absolute stub, natural exit+close/both EOF and ordered original/cleanup
failures. No auto-kill or hard wall-clock guarantee. All fixture artifacts stay.
Root fresh534571/bb7fb2 matched source/tools/originals; memory59% free, throttle0.
One bf1312/session32440 → da5447 naturally CLOSED0: 1PASS, zero other statuses,
1415.473417ms; compile/link0, witness2, original C2/canonical refusal/no entry
marker. Original descriptors checked and closed before the test could pass.
Ordinary fixture `/private/tmp/setfarm-native-name-test.EdrKBA` object70fc8c2d/
binaryb9b27940; calibration `/private/tmp/setfarm-native-name-witness.HngQYi`.
This is actual ordinary refusal evidence, NOT NAME/protected/P2 acceptance.
Independent post-run8c0365/4005bc0/b97b6a0 C0/I0/M0 confirmed exact artifact
bytes, no refusal-fixture startup marker, original tool/source/dirty-file/journal
preservation; current private directory identities were observed, not invented
as cross-epoch equalities. No compiler/test/native replay occurred in that audit.

### N2: Minimal fixed parent implementation, no invocation before effect review

Next test refinement: the broad `test:scripts` glob includes this new file, so
native/compiler effects require the explicit test-only
`SETFARM_TASK6A_NATIVE_NAME_TEST=1` opt-in. Absence means visibly skipped native
tests, never acceptance. Every spawned environment omits that variable. Only
the test's closed argv set []/['unexpected'] is admitted, not a C caller selector.
The [] fixture uses held, exact delivered entrybbcf752e bytes without prepending
callbacks or mutating production entry. Its literal consumer contract is one
bounded JSON line with schemasetfarm.task6a-native-name-diagnostic.v2 and
outcome supportedNAME/unqualified; NAME/audit/challenge/reap/EOF/disposition
fields must demonstrate complete ordinary success, with all three authority
flags false. Refusal or actual NAME denial MUST fail the nominal assertion,
never become GREEN/skip/fallback. Historical sourceC67897663 unconditionally
refused; the narrowly reviewed [] test supplied semantic consumer RED first.
This test-only opt-in causal refinement does not alter bootstrap/native policy.

- [x] Add C main with argc/ordinary-UID refusal before pipes/spawn; no public
  options. Fixed Node and source-adjacent entry, explicit scrubbed child env.
- [x] Add checked pipe/file-action setup and closed inherited descriptors;
  require non-autoreaping SIGCHLD and own exactly one PID.
- [x] Implement bounded READY/challenge/PONG loop and original child state.
  Native operations use only local retained birth, not message-reported identity.
- [x] Implement the single original NAME acquisition/PID/audit checks:
```c
mach_port_t name = MACH_PORT_NULL;
audit_token_t first = {0}, second = {0};
mach_msg_type_number_t count = TASK_AUDIT_TOKEN_COUNT;
/* child is the locally captured, still-unreaped direct spawn PID */
kern_return_t rc = task_name_for_pid(mach_task_self(), child, &name);
/* require rc success, valid original owned send right before PID/token calls */
rc = task_info(name, TASK_AUDIT_TOKEN, (task_info_t)&first, &count);
/* require exact count; compare full second token after PONG3 BEFORE END */
```
  This excerpt is a source obligation, not an executable native recipe.
- [x] Implement sticky burn, checked partial writes/drains, END/input close,
  exact exit/reap/no-after-reap signals and once-only NAME disposal with primary
  and cleanup failures retained. No exit-after-uncertain-child positive result.
- [x] Default result schema never permits production/native/protected authority.

### N3: Exact compiler/test effect review and ordinary behavior GREEN

Post-reap test-copy control design (root-only, before new effects):
- Preserve production C5db27 unchanged. Insert wrappers after all SDK headers
  and before the unique ordinary-diagnostic comment; define real wrapper bodies
  before redirect macros. Closed modes: baseline/post-reap-kill/post-reap-audit.
- Record actual successful fixed spawn birth and matching real waitpid reap
  before returning. Preserve errno; never synthesize a live/reaped task. Reject
  target calls after reap/uncertainty before kernel delegation, before inspecting
  a consumed NAME. Permit original local NAME disposal exactly once.
- Retain bounded primitive ordered events in memory; trace only after settle
  and the optional mutant. Create the source-adjacent trace exclusively,
  no-follow/CLOEXEC/mode0600, checked writes and one checked original close.
  No identifiers/audit values are exported; no trace FD enters the child.
- Parent holds final trace bytes after natural close/EOF. Baseline independently
  requires one spawn/NAME/type/PID, two live audits, actual reap, six original
  pipe closes and one successful disposal with no faults/blocked calls.
  Each injected-after-settle control requires exactly one blocked attempt after
  actual reap, zero native/signal delegation thereafter and the same lifecycle.
- These are post-reap attempt-injection controls, not real post-reap syscalls,
  exhaustive uncertainty evidence, compiler authority or protected/P2 closure.
  Exact instrumentation and effect review remains mandatory before compilation.

Actual control receipt5d35d0/session76873→b18a6a CLOSED0, 2026-10-05:
3PASS/zeroFAIL/CANCEL/SKIP/TODO2216.354125ms; corrected test8ecaecce/C5db27
paired pre-effect C0/I0/M0. Real baseline acquired NAME, queried type/PID/two
audits, closed all six original pipe FDs, actually reaped then disposed NAME.
Two distinct fresh test copies injected kill/audit after settle; their traces
contain exactly one blocked attempt after reap/dispose and no delegation. The
independent baseline oracle rejects each mutant trace. MBiUZB/j9jAsr/dXXIz6 and
their three calibration roots are retained. This does not establish exhaustive
uncertainty handling, actual post-reap syscalls, protected origin or P2 closure.

Next closed result-fault matrix, before effects: PID mismatch, first/second
audit count, second opaque audit drift and disposal response failure. Each
test-copy wrapper first requires genuine successful matching native output,
then alters only that returned result and records exactly one nomination.
Disposition must actually consume the original right before reporting synthetic
failure. No real-kernel-denial claim, fake reap, NAME leak or fallback. Require
source exit2/empty success output/nominated cause, expected native prefix,
six closes, actual reap and one genuine disposition. Pre-reap cleanup signals
may be visible; target calls after reap never delegate. A sixth fresh copy
retains second-token drift but omits only the comparison: otherwise nominal
success must be rejected by the same independent negative oracle. This is
semantic mutation control, not a source-string acceptance test. Review all
literal transforms and new effect pattern before any compiler/native execution.

Actual returned-result receiptccd039/session11438→07b5cb CLOSED0:
6PASS/zeroFAIL/CANCEL/SKIP/TODO4170.087666ms; test153cd1a3/C5db27 paired
effect review and fresh8d0572 gate. PID/first-count/second-count/drift/disposal
response each refused; actual real-call prefix, nomination, six closes, exact
reap and genuine original disposal were required. Full settled C channels
preserved primary and secondary causes in the external raw receipt. The sixth
comparison-omission copy actually succeeded despite injected drift; the same
negative oracle rejected it. These are synthetic result faults/semantic control,
not genuine kernel denial, an actual stable-token mutant or protected/P2 credit.

Causal root refinement before remaining lifecycle matrix: review found settle
breaks on reap+bothEOF before its cleanup-final expiry check. A late-returning
genuine reap can omit cleanup-deadline-unqualified while protocol3s still holds.
Add one closed quiet wrong-READY test copy: omit only its fixed refusal stderr
write; require all6 actual WRONG bytes consumed before settle, zero child stderr
and one genuine EOF read per output channel. This avoids buffered stderr making
the old loop incomplete and recording expiry for an unrelated scheduling path.
Instrument entry into settle, latch actual
kernel reap independently, then delay that already-reaped return1500ms. Nominate
only if measured cleanup elapsed exceeds1350ms while protocol is below3s.
No fabricated status or PID/native calls during/after delay. Require the cleanup
expiry cause alongside existing refusal/once-only closure. Capture causal RED
against C5db27 before changing source; then move the existing expiry check before
the completed-loop break, preserving budgets/signals/guard/ownership. Same four
File Map files only; this is necessary to this owner's advertised deadline
failure attribution, not permission for hard syscall bounds or protected origin.
Re-review corrected bytes and run affected closure plus a fresh genuine nominal
witness on changed source, rather than replaying historical C5db27 evidence.

Actual causalREDe85388/session47693→b80078 CLOSED1, 1FAIL2505.287959ms:
test15d3137d/C5db27 paired exact review and freshbd0106 gate. Six original
closes, zero child stderr, both actual EOFs, genuine reap and measured exact
cleanup expiry below3s all passed before the final assertion. C emitted only
protocol-frame/child-lifecycle and omitted cleanup-deadline-unqualified.
CDYPBM/0BVTJG artifacts retained; no NAME acquired. This demonstrates omission,
not an actual positive result or late kernel exit. Source repair follows RED.

Actual repairGREEN323f15/session12141→0d3032 CLOSED0:
2PASS/zeroFAIL/CANCEL/SKIP/TODO3053.312208ms C0e6b37/test7b46b400, paired
exact-delta reviews and fresh75734c gate. New-byte genuine nominal Fo2t1d
passed; quiet late-reap1z1cj2 retained expiry alongside primary/lifecycle causes
and excluded UNSETTLED after actual complete closure. All original artifacts
retained. This repairs observed budget attribution, not a hard kernel deadline.

Final finite lifecycle matrix design (C stays0e6b37): real stdout reads/input
writes capped1 with positive-call/byte totals220/229; partial READY READ followed
by stdout EOF while stdin/timer remain live; wrong final ENX4; final END+X;
valid protocol followed by actual exit7; and suppressed stdin-end response with
TERM handler installed before READY, requiring actual TERM/KILL success and
actual SIGKILL reap. All copied entries and trace wrappers remain test-only.
Record real IO totals/EOF, exit7/SIGKILL status and original six closes/reap/
applicable disposition. Extra output rejects by protocol-frame or extra-stdout,
depending actual read grouping. Escalation proves owned settlement, not expiry
or a hard bound; late-return RED/GREEN separately covers expiry attribution.
No descendants/external pipe holders, fabricated reap or new original C change.
Exact literal/effect review precedes the six-case pattern; keep artifacts.

Actual firstIO79949a/session46361→de4908 CLOSED1:5PASS/1FAIL10265.337708ms
C0e6b37/test15d2d876. Fragmentation220/229, wrong END, extra byte, actualexit7
and successful TERM/KILL +SIGKILL-reap passed; partialREADY4 instead observed
protocol-deadline because Writable.end did not physically close stdout. Correct
only that test copy to builtin fs.writeSync(1,READ)/closeSync(1), retaining
stdin/timer. This is fixture refinement, no production fix/oracle relaxation.
One changed-fixture rerun after exact review; do not replay the five passed.

Actual changedpartiale5f5d2 CLOSED0 1PASS838.082833ms C0e6/test19297813:
paired tiny-delta reviews and freshe889df gate. Genuine READ4/physicalEOF occurred
before input-close/reap; C refused early-stdout-eof, with secondary causes kept.
Original six closes/EOF2/reap/custody passed; ZO44hx/0wpkFx retained. No C change,
NAME acquisition or replay of five passed IO cases. Final14 earlier cases
requalified changedC0e6 (argv4entry3boundary5result1semantic), excluding already
verified genuine nominal/late-reap/IO and compile-only; no old-source replay.

Actual final14c7538a/session73105→2a8e22 CLOSED0:
14PASS/zeroFAIL/CANCEL/SKIP/TODO11949.473792ms C0e6/test19297813 after paired
14-case gates and fresh994f27. CurrentC aggregate2+5+1+14=22 native cases,
not one22-test run, exhaustive uncertainty/root-UID coverage or full npm/DB
suite. No old ALL/privatePG/build replay. Native compile occurs in each fixture;
separate pure compile-only current-C run is unnecessary. Reviewed PR delivery,
clean-main build and host verification remain open; no protected/P2 admission.

First actual nominal receipt eb7047 naturally CLOSED0 (do not replay):
source5db27dcb/test1185aefe, strict positive1PASS/zeroFAIL/CANCEL/SKIP/TODO,
884.766167ms. Paired full source/effect C0 and freshd7c48f/root resources gates
preceded the ONE experiment. Original C owns fixed ordinary Node; actual READY,
NAME/type/PID, first full audit,3challenge/PONG, second audit BEFORE END,
END/EOF/exact exit0/reap and original NAME disposition met the literal consumer
contract. This is ordinary NAME feasibility only, not protected/P2 acceptance.
Held fixture `/private/tmp/setfarm-native-name-test.Vdl2Se` objectb2f11ab1/
binary551967a9; calibration `/private/tmp/setfarm-native-name-witness.2QrQZ3`.
Independent post aea7e4/11b3a9/46143a C0 checked retained bytes, all2091 untouched
existing files, original two/backups/journal/tools/selectors. Process-onlyd12af0
found no cwd bound to these fixtures, NOT exact historical-generation absence.

Next four CLOSED owned entry-copy fixtures (C remains exact5db27dcb): replace
READY with WRONG -> protocol-frame; guaranteed different PONGnonce ->
protocol-frame; Q on stderr -> child-stderr; suppress READY -> protocol-deadline.
Require actual exit2/empty stdout/nominated cause and complete original close/
EOF/custody. Extra causes remain visible. These are owned mutated-entry tests,
never the genuine delivered entry witness. Review exact bytes/effects before
running. Fragmentation/no-after-reap mutation controls and remaining lifecycle
matrix still block qualification/delivery; JSON alone cannot prove native order.

Actual compiler-only receipt b67e24 naturally CLOSED0 (do not replay):
source5db27dcb/test1185aefe, 1PASS/zeroFAIL/CANCEL/SKIP/TODO625.325625ms.
Fresh owned fixture `/private/tmp/setfarm-native-name-test.FeU5Uv` contains only
exact C, exact delivered entry and object067888cc; linked:false and
nativeProgramExecuted:false. Fixed clang -c completed with empty outputs;
original exit+close/both EOF and common directory/SDK/held-file/all-close
finalizers passed. No calibration, linker, binary, target or Mach operation.
Compiler mode is the closed test-only opt-in value `compile`, separate from
the native value1; every child environment omits it. This is ordinary compile
evidence, not native behavior. ONE nominal native effect gate is separate and
still requires paired exact-source review and fresh root checks.

- [x] Independently inspect complete source/test delta and each real dependency
  effect. Save exact source/tool/SDK/output pins, compile/link argv/env, private
  directory identities and resource floor before any compiler run.
- [x] Review compiler-only object recipe first: fixed CLT clang, no default
  configs, arm64 SDK26.5/resource21, integrated assembly, no modules/LTO/ambient
  headers, -std=c11 -O0 -Wall -Wextra -Werror; output only fresh owned private path.
- [x] Separately fix/review linker path/search/dependencies and automatic local
  ad-hoc signature; no external signing/notarization or provenance admission.
- [x] Only after exact compiler/native effect C0, run one actual argument GREEN.
- [x] Add/run the finite reviewed matrix: no entry on argv refusal; wrong
  READY/PONG, suppressed READY, fragmented IO, partial READY/EOF, malformed END,
  excess final output, stderr, nonzero exit, protocol expiry and owned cleanup.
  This is finite coverage, not every malformed frame/uncertainty/UID branch.
  Each test names the broken branch/side effect it catches.
  Preserve unavailable/synthetic support separately from actual kernel evidence.
- [x] Test actual default source+entry NAME path once after exact effect review:
  outcome supportedNAME/unqualified or explicit NAME/identity/protocol/cleanup
  refusal, complete raw exit/close/EOF and final original input/retention checks.
  Zero success credit for counts/path/PID alone; no CONTROL/map inference.

### N4: Scoped reviewed delivery, separate acceptance

- [x] Focused current-source matrix and default opt-out/static contracts:
  1bfbdc23SKIP/0PASS46.313958ms;119137 version2.3.79, English1932files,
  paths967files and diff-check exit0. Skips are not native acceptance.
- [ ] Proportional clean committed-source build checks; do not replay frozen
  full ALL or old build/test sessions.
- [ ] Independent complete diff review, ordinary scoped commits/push/PR with
  exact-head bot feedback, normal SHA-bound merge only.
- [ ] New independent clean-main build and artifact/host/retention verification,
  preserving every old source/build/worktree and original two files.
- [ ] Record actual narrow outcome; P2 protected owner/control/maps/root invocation,
  P3/P4/P5/cutover/B/C/D/E remain independently gated.



> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Root executes inline as the only writer; agents inspect/review read-only.

**Goal:** Prove a genuine delivered protected private MJS entry, official vendor Node and actual parent-owned unprivileged execution without granting production authority.

**Architecture:** Explicitly owner-admitted Apple system Perl retains the root source/vendor/physical/process holder and directly forks/drops credentials/execs one protected entry. Pure bounded archive/native helpers are authenticated before import. A separate actual rehearsal runs only after reviewed delivery and exact pre-effect clearance.

**Tech Stack:** Apple Perl5.34.1 with fixed SIP core/XS search, Apple curl, builtin-only Node22.23.1 entry, node:test, isolated explicitly opted-in macOS rehearsal.

**Spec:** `docs/superpowers/specs/2026-09-30-task6a-protected-origin-bootstrap-v2-design.md`

## Global Constraints

- Root sole writer; preserve all old worktrees/branches, failed fixtures and dirty19.
- Initial owner admission is explicit and independent; generic rootcopy/hash/JSON is not origin.
- Zero runtime caller selection; fixed system tools/source policy/GitHub/official Node routes.
- Actual entry first refuses with zero modules; declaration-only memory tests retain exactly the two ordered SIP5.34 roots before imports, scrub external env and use -f. No default Library/Network/Updates/Extras modules or production cold-gate opening.
- Compressed128MiB/expanded512MiB/members20000/selectedNode128MiB bounds; no unrelated archive extraction, root Node, npm, Git or generated installer execution.
- No source/vendor download or privileged effect until separately reviewed exact delivered package and invocation; no unmerged feature called delivered.
- Private diagnostics only, productionAuthorityfalse. No compiler/fence/genesis/32/33/admission/live-selector effect or guard bypass.
- Actual parent PID/private pipes/definite reap, not child JSON, determines lifetime and cleanup. Uncertainty preserves exact fresh fixture.

## Cold-entry root fix: bounded implementation plan, 2026-10-04

**Goal:** Make the already closed real bootstrap refuse before its first
candidate module resolution; do not manufacture a positive P2 receipt.

**Causal refinement:** Current first-BEGIN sets `@INC` but imports execute before
final-main refusal. The actual entry must not load the yet-unadmitted PM/XS
closure merely to refuse. Downstream manifest/capsule checks cannot fix this.

**File Map:** Modify only bootstrap, its existing test, named spec and this plan.
No entry/helper/map/observer/package/lock/source-policy/creator/launcher changes.
Root alone writes/delivers; independent agents read/review. Preserve every old
root/build/cache/branch and the original two files. Start from delivered
c886bebd49b2961359d7289515cd540e0296f259 in the independent clone
`.worktrees/setfarm-cold-entry-refusal-20261005-v1`, branch
`fix/task6a-cold-entry-refusal-v2`. No installs are needed for these builtin
Node/system-Perl tests. Build preparation/delivery is a separate reviewed gate.

**Interfaces:** No new production callable interface. Real-file invocation is
fixed `/usr/bin/perl -f scripts/task6a-protected-origin-bootstrap-v2.pl` with
zero extra arguments, ordinary UID and `{PATH:/usr/bin:/bin,LANG:C,LC_ALL:C}`.
It emits canonical refusal and exits2. Existing `systemObject` retains its
signature and memory-only declaration role; it additionally removes the unique
prefix cold block before removing the unique final main call.

Steps1–5 below retain the completed pre-execution recipe, including its historical
test-data-only and expected-RED wording. The execution receipt records actual
installed source and outcomes; do not replay those closed invocations. Step6
remains prospective until its delivery evidence is recorded externally.

- [x] **Step 1: Add the behavioral RED test before changing production.**

In the existing test, add the literal cold block and probe below. The block is
test data at this step, not installed into production. Put the function with
the other test helpers and the test inside the existing ordinary-host branch.

```javascript
const COLD_ENTRY_GUARD=String.raw`# Cold entry stays closed before any candidate PM/XS import.
BEGIN {
    CORE::print STDERR "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
    CORE::exit(2);
}
`;
function coldEntryProbe(source) {
  assert.ok(ordinaryHost(),'cold entry probe requires ordinary macOS UID');
  const candidate=replaceOnce(source,
    "    @INC=('/System/Library/Perl/5.34/darwin-thread-multi-2level',\n        '/System/Library/Perl/5.34');",
    String.raw`    @INC=(sub {CORE::print STDOUT "TEST_FORBIDDEN_IMPORT\n";
        CORE::die "TEST_FORBIDDEN_IMPORT\n";});`);
  assert.ok(Buffer.byteLength(candidate)<=131072,'cold probe source bound');
  const r=spawnSync('/usr/bin/perl',['-f','-e',
    'binmode STDIN; local $/; my $source=<STDIN>; eval $source; if($@){print STDERR $@;exit 64;}exit 0;'],{
    input:candidate,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
    timeout:3000,maxBuffer:65536,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
}
test('cold bootstrap refuses before first module resolution',()=>{
  const r=coldEntryProbe(readFileSync(BOOTSTRAP,'utf8'));
  assert.equal(r.status,2,'entry reached candidate imports before refusal: '+r.stdout+r.stderr);
  assert.equal(r.stdout.length,0);
  assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n');
});
```

- [x] **Step 2: Run the one RED and read its complete natural terminal.**

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^cold bootstrap refuses before first module resolution$' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Expected: assertion failure, actual64 versus required2, and actual forbidden
module-resolution witness. An anchor/compile/timeout error is not the RED.

- [x] **Step 3: Install the minimal production cold block, then adapt declarations.**

Prefix the bootstrap with exactly `COLD_ENTRY_GUARD` above. In `systemObject`,
replace the existing single source/main-removal assignment with:

```javascript
  const original=sourceOverride??readFileSync(BOOTSTRAP,'utf8');
  assert.ok(original.startsWith(COLD_ENTRY_GUARD),'cold entry must be source prefix');
  let source=replaceOnce(original,COLD_ENTRY_GUARD,'');
  source=replaceOnce(source,'\ntask6a_origin_main();\n','\n');
```

The real-disk default refusal test now loops over `[]` and `['-c']` before the
fixed filename and requires exact `r.status===2` instead of merely nonzero; its
exact stdout/stderr assertions remain unchanged. No other
declarations, ports, predicates, queues or positive diagnostic expectations change.

- [x] **Step 4: Add and execute two semantic mutation controls.**

```javascript
for(const mode of ['omitted','after-first-import'])
  test('cold bootstrap exposes '+mode+' guard mutant',()=>{
    let source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),COLD_ENTRY_GUARD,'');
    if(mode==='after-first-import')
      source=replaceOnce(source,'use strict;\n','use strict;\n'+COLD_ENTRY_GUARD);
    const r=coldEntryProbe(source);
    assert.equal(r.status,64);
    assert.equal(r.stdout.toString(),'TEST_FORBIDDEN_IMPORT\n');
    assert.match(r.stderr.toString(),/^TEST_FORBIDDEN_IMPORT\n/);
    assert.doesNotMatch(r.stderr.toString(),/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
  });
```

Run the Step2 command with pattern
`^(cold bootstrap |ordinary system supervisor refuses before source acquisition or private staging$)`.
Expected four PASS, zero failures/skips; original entry never resolves a candidate
module and both coherent mutants demonstrably do. No mutation writes a file.

Add one separate compile-only declaration test; it removes ONLY the prefix
guard, keeps final main, and uses STDIN without writing a source copy:

```javascript
test('cold bootstrap declarations retain separate syntax verification',()=>{
  const original=readFileSync(BOOTSTRAP,'utf8');
  assert.ok(original.startsWith(COLD_ENTRY_GUARD));
  const source=replaceOnce(original,COLD_ENTRY_GUARD,'');
  const r=spawnSync('/usr/bin/perl',['-f','-c'],{
    input:source,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
    timeout:3000,maxBuffer:65536,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0);
  assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'- syntax OK\n');
});
```

The focused pattern above now requires five PASS. This ordinary compile-only
check can import the fixed SIP modules but does not run top-level clock/main or
runtime external operations. It does not admit privileged module/native trust.

- [x] **Step 5: Proportionally verify the complete ordinary declaration suite.**

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
git diff --check
```

Read every output chunk through natural exit/close; zero failures/skips required.
This is a new source epoch, not replay of prior closed sessions. Ordinary existing
owned-child/synthetic external ports remain the same; no real native observer,
privileged invocation, SQL, services or private ALL. Syntax-check the Node test
with fixed Node `--check`. The actual disk Perl `-c` intentionally refuses;
the separate guard-stripped STDIN `-c` test and full ordinary memory-only suite
verify declaration compilation, not the disk refusal exit.

- [ ] **Step 6: Independent exact-diff review, normal PR and clean-main build.**

Use requesting-code-review and verification-before-completion. Review the four
files against c886, source hashes, actual RED/GREEN/raw complete terminals and
memory-only removal; resolve C/I findings before delivery. Root alone stages the
four mapped files, makes a conventional fix commit, pushes without force and
opens a normal PR to main. Request existing review integrations once, read actual
feedback/security checks and use SHA-bound normal merge with no admin/delete.
Preserve the branch/clone. Freeze delivered source; separately admit a fresh
clean-main build recipe with owned cache/tmp/empty-env directories and unchanged
source/dependency/npm/retention guards before executing it. Do not reuse old
managed sessions, invoke native/private ALL or select a service. Host verification
records HTTP3080/18789 and3333 truth, original-two hashes and preservation.
Completion here means only cold-entry fix delivery, never P2/native/cutover.

### Cold-entry execution receipt, 2026-10-04 22:05 UTC

Executed spec589cf50e and pre-execution planc7034ecf were independently reviewed
C0/I0/M0 before effects. Baseline5637df closed0/1PASS. ONE actual old-source
RED e6acf3 closed1: assertion64!=2 and actual TEST_FORBIDDEN_IMPORT stdout/stderr;
source434a6a7c/testd8268bf2, complete output read. Pre/postb44c0e/d808b8 full2093
inputs unchanged. No anchor, timeout or setup failure was credited as the RED.
Minimal source15dce34f51dc2ffdf7c07b2890c6c53d96791d55bef6360ffd0f0e2c61d051f1
and test6dafb2cb9df8cabe22be73dea4765b5fc62bacc461f4351597c43d4f4395e369
passed independent actual-delta reviews. ONE focus e9ce2f closed0:5PASS/zero
FAIL/CANCEL/SKIP/TODO112.099792ms, including real disk normal/-c refusal,
separate guard-stripped syntax and actual omitted/late import controls.

ONE unfiltered ordinary suite cdf10b/session92132 -> natural33d0d3 CLOSED0:
1393PASS/zeroFAIL/CANCEL/SKIP/TODO115955.504833ms. All four raw chunks retained
before rendering; complete121544UTF8B/118740characters/1403splitlines bind SHA256
4045f2aff5a1c766bc59f7b59e6ae7bb7dd08258aae5a17518a07192a17da1fb.
All1393pass lines/8footer lines and the single existing actual FD-rebinding
diagnostic were individually classified; zero unknown/truncation markers.
Initial read-only analyzer rejected an assumed8 informational-line count because
the existing diagnostic makes9; corrected classification, not a test failure or
test replay. Rootpostb7eee7 at22:04:41 C0 matches full2093/70062057B/physicalb3bbdd,
source/test/tools exact and no deps/dist/.setfarm/environment files.
Nodechecka05cc6/diff460d44 C0; versiona9c77d2.3.79/Englishc047c31931/pathc6bc89966
C0. No protected invocation/native-observer/privateALL/DB/live-service effect or
native qualification. Ordinary module compilation may load SIP XS code.
NOREPOLL92132/NOREPLAY.
This receipt changes only plan progress/evidence, not the executed recipe.
Step6 review/PR/clean-main-build/host delivery remains open until actually proven.

## File Map and interfaces

- Create `scripts/task6a-origin-archive-v2.pm`, package `Task6aOriginArchiveV2`, pure `extract_node_v2($gzip_bytes)` returning exact selected member bytes or `TASK6A_ORIGIN_ARCHIVE_REFUSED`. Input/output are bytes, not origin authority. Use fixed SIP IO::Uncompress::Gunzip; no disk writes/exec/network/UID changes.
- Create `scripts/task6a-origin-native-v2.pm`, package `Task6aOriginNativeV2`, pure `assert_node_native_v2($bytes)` returning diagnostic native details or `TASK6A_ORIGIN_NATIVE_REFUSED`. No process/tool invocation or admission authority.
- Create `scripts/task6a-origin-map-v2.pm`, package `Task6aOriginMapV2`, pure
  `parse_map_v2($raw_bytes,$captured_pid)` returning complete interleaved grammar
  diagnostic/regions or `TASK6A_ORIGIN_MAP_REFUSED`. No process/FS effects or
  admission. Bounds1MiB/8192lines/4096regions/64summarycategories/32malloczones;
  exact bound PID/full sections, canonical numeric ranges/paths/known labels,
  all current/max permissions and complete metric/footer rows. Final reviewed
  literal source blob is added to authentic publisher policy before import.
- Create `scripts/task6a-protected-origin-entry-v2.mjs`, builtin-only zero-extra-argument child: READY, fresh parent CHALLENGE/PONG exchange, END/EOF and fixed20s deadline. No child-reported identity or arbitrary eval/paths/imports.
- Create `scripts/task6a-protected-origin-bootstrap-v2.pl`: fixed zero-argument root system supervisor; source/vendor authentic retrieval, protected staging, held direct child/lifetime and exact cleanup. Helpers are imported only after fixed Git byte-policy authentication.
- Create `scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`: invoke actual fixed system Perl and helpers under scrubbed environment, actual child entry and parent contract. Default no privileged effects.
- Create `scripts/task6a-origin-observer-recon-v2.mjs`: ordinary-only zero-arg
  controlled owned-child map-format exploration, mandatory exact review before
  observer execution. No privileged/source/vendor/DB effects; not origin proof.
- Create `scripts/__tests__/fixtures/task6a-origin-vmmap-interleaved-v2.txt`:
  sanitized complete actual ordinary own-child map fixture for strict pure-parser
  grammar tests only, never production/native-origin evidence.
- Create `tests/execution-attempts/task6a-private-protected-origin.integration.test.ts`: actual independent owner-install invocation/entry/private fixture, explicitly opt-in and gated on delivered package/exact pre-effect clearance. Register only safe default tests; a new opt-in package command is allowed only if needed and source/tests/spec map includes it.
- Spec/this plan and external checkpoints. No V1/dirty19/default production entry changes.

### Ordinary P2a delta (four existing files only)

Modify only `scripts/task6a-protected-origin-bootstrap-v2.pl`,
`scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`, this plan and
its named existing spec. Do not alter entry/helper/map/import-policy/native/
observer/package/lock/launcher/production main or generated runtime artifacts.
The source base is delivered main d40fa6b9d517bdbb9e466585c86fbd1471c4dfc0;
old main/worktrees/dirty2 remain preserved. The ordinary MC telemetry delivery
has its own PR33/merge5c9e/clean-main-build proof; it admits no live cutover.
Root alone writes/delivers; parallel reviewers do not execute project tests.

Ruling: separate immutable original custody, initially absent admission and
irreversible lifecycle state, rather than one mutable record or public factory.
Reason: altered admission cannot redirect disposal or create execution authority.
Cost if wrong: ordinary interface/test rework, never a protected-effect waiver.
The detailed ordinary contract is the spec's new declaration-only section;
the protected Task2/Task3 checkboxes below remain separate and incomplete.

### Task 1: Archive and static native denial primitives

**Consumes:** Raw gzip and Node image bytes from the later trusted publisher, never caller provenance. **Produces:** The two exact pure Perl interfaces above.

- [ ] Write Node test fixtures assembling literal ustar headers/checksums/padding and gzip bytes independently with node:zlib. Run actual `/usr/bin/perl -f` with first-BEGIN fixed SIP search and local reviewed helper `require` as an ordinary test UID. Test-side local paths are not production selection.
- [ ] Positive fixture contains unrelated symlink/npm metadata plus exactly one regular fixed bin/node; assert only literal selected bytes return. Negative fixtures: duplicate selected name, selected symlink/hardlink, missing member, wrong checksum/octal/size, truncated header/body/padding, missing double-zero EOF, nonzero tail, overbound declared node/total/member count, effective path substitution through local PAX/GNU name, ambiguous or malformed extension and gzip CRC/trailing/concatenated stream. Reject unsupported effective paths rather than guessing.

```js
assert.ok(fs.existsSync(new URL('../../scripts/task6a-origin-archive-v2.pm',import.meta.url)),
  'archive implementation missing');
const actual=runActualSystemPerlArchive(literalGzipFixture);
assert.deepEqual(actual,Buffer.from('literal selected bytes'));
```

- [ ] Run focused tests, observe expected missing-implementation assertion RED, fix harness defects separately. Implement streaming128MiB compressed/512MiB expanded/20000member bounds, checksum and size parsing, PAX/GNU effective path state, exact regular uniqueness, selected128MiB bound and complete EOF/CRC. No filesystem extraction.
- [ ] Add independently built thin arm64 Mach-O vectors: exact executable/header/reserved/table/count/size, mandatory one `/usr/lib/dyld`, complete loader strings, only canonical `/usr/lib/` or `/System/Library/` dependencies. Reject wrong CPU/filetype, unknown/path-affecting command, duplicate linker, RPATH, DYLD_ENVIRONMENT, external/relative/@rpath path, crossing offsets, malformed terminator and truncated table. Observe native helper missing RED, then minimal GREEN.
- [ ] Assert pure helper error sanitization and no writes/child tools. In-memory invalid command/path/duplicate-member mutants must miss real refusal consumers; never rewrite source for mutants. Actual default npm graph must select this suite and dispatch a bounded real leaf.

### Task 2: Fixed entry and system supervisor

**Consumes:** Pure helpers only after actual admitted delivery. **Produces:** Fixed actual source/vendor/physical/direct-child held diagnostic, not a serialized capability.

Current evidence: Task1 pure helpers independently reviewed at archive blob
da1fd458fcaba775be5ba09ef88157b5ee48dbda and native blob
59e1ae8de38cf2083a0294c55454083840eb47f1;110tests passed. Two genuine review
findings (empty pending PAX and8byte segment command) each reproduced RED then
fixed;25 additional structural command/platform REDs fixed. Actual20000/20001
tar-member and4096/4097command bounds tested with coherent complete fixtures.
Read-request observer isolates selected-size denial before body reads; lowered
in-memory test limits exercise compressed/expanded branches without allocating
128/512MiB. These are pure-byte diagnostics, not vendor/admission evidence.

Entry16missing-source AssertionRED then16GREEN; final-END broken output exposed
real exit0bug, independently RED and fixed by checking its end callback error.
Open-input replay consumer prevents premature EOF from masking missing replay
checks. Embedded Perl Git framing31missing-source AssertionRED then31GREEN;
main remains unconditionally fail-closed while publisher/held origin are absent.
Its SIP B scalar flags preserve parsed numeric-vs-string field typing; full root
PM/XS closure admission must include B before any privileged execution.

Current transport evidence: helper lifecycle independently reviewed after actual
FD200 closure, partial-readdir EIO, undefined POSIX calls/waitpid and sticky
uncertainty consumers. Actual full suite224PASS/0SKIP before later additions.
Metadata38 plus missing-route-guard exec-edge mutant1PASS independently reviewed;
only external capture/clock is replaced in tests, preserving UTF8/JSON/body/depth,
timers and all ten Git framing/source joins. Post-decode expiration was genuinely
accepted in two RED tests before the new final clock check. Vendor16 protocol
tests now pass with coherent synthetic gzip/pin substitution IN MEMORY only:
no real archive, vendor-positive or source-origin claim. Canonical unrelated
relative manifest names are inert, never URL/extraction selections. Actual full
v22.23.1 manifest has not been acquired by the bootstrap; primary web reader was
unavailable, so the Windows-row compatibility fixture is explicitly synthetic.
Main remains unconditionally refused. Stage/UID drop/held origin are absent.

Current physical-holder fragment:20 missing-implementation REDs then20GREEN;
16 ACL REDs then16GREEN;13 ancestry REDs then13GREEN. Actual ordinary read of
fixed root-owned Perl retains nofollow/CLOEXEC FD, raw SHA256 and identity checks;
private ledgers—not returned diagnostic fields—drive all rechecks/release. Actual
directory descriptors and complete fixed ls ACL rows are held/sampled; only exact
rootwheel/private/tmp01777 sticky ancestry is allowed writable. Directory checks
hold dev/inode/mode/uid/gid, NOT changing contents/mtime or a descendant/ABA fence.
Review exposed root/non-mac registration escape:3 JS-only simulated host REDs
with forbidden-child sentinel then moved registration and real/effective UID
gate GREEN. Actual ordinary FIFO with controlled pre-open regular snapshot
blocked500ms RED, fixed O_NONBLOCK yields ~20ms refusal. Private lifecycle6 tests
exercise actual4FD release, restored drift/failed hold stay burned, release/reopen
refusal and missing-burn in-memory mutant. Throwing close left3FDs RED; per-handle
guard continues completeclose and burns. Fresh full312PASS/0FAIL/0SKIP46752.522ms.
These are fragments, not protected-stage/native/entry/cleanup authority. Exact
independent physical-fragment review cleared bootstrap f9d37de5...fac64 and
tests981a1508...a73d; reviewer independently reran59PASS/0SKIP. The close-fault
port actually closes before injecting uncertainty: complete attempts and sticky
denial are proven, not native uncertain-close leak freedom.

### Task2 physical composition refinement (2026-10-01)

This closes the causally necessary gap between the already-delivered physical
fragments; it does NOT enable main or claim protected/native execution. Root is
the sole writer at .worktrees/setfarm-task6a-composed-physical-v2 on
fix/task6a-composed-physical-v2, base0185aaee631341d057c79e855e5ab9b51e9d402a.
The old private-test tree remains immutable2b6b3031 while interrupted descendants
settle; standby stays immutable4cdb88dd. Only one branch is written at a time.
All old trees/archives/failed footprints/user changes remain preserved.

**Files (exactly four modified):**
- scripts/task6a-protected-origin-bootstrap-v2.pl: private fixed composition and
  raw-capture/close ownership guard, no new imports or main behavior.
- scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js: ordinary real
  system-Perl consumers; only external ACL/stat/close fault ports in memory.
- docs/superpowers/specs/2026-09-30-task6a-protected-origin-bootstrap-v2-design.md.
- This plan. Source-helper/entry/vendor/native pins and production paths unchanged.

**Interfaces:** hold/recheck/release_system_perl_physical, each prefixed
task6a_origin_ and zero-argument. Fixed rootwheel0755/nlink1 /usr/bin/perl,
SHA256abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0,
max1048576 bytes; exactly three retained ancestry directories. Private state and
record references drive recheck, never copied diagnostics.

- [x] Verify new isolated clean baseline with unchanged dependencies:
  `node --test --test-name-pattern='retained|ACL sample' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`
  Actual57PASS0FAIL0SKIP1345.173ms, exit0. No PG/native/privileged fixture effect.
- [x] Commit reviewed causal design/File Map before implementation (4f15bf5d).
  External
  source-only design review found release-before-raw-close and ownership/state
  pitfalls; canonical spec includes the fixes, not invented execution clearance.
- [x] Add test-only systemObject kind composed-physical, load actual declarations
  with sole final main removed IN MEMORY. Missing-interface assertion RED first:
  ```js
  const r=systemObject('composed-physical',{mode:'success'},'');
  assert.equal(r.status,0,r.stderr.toString());
  const out=JSON.parse(r.stdout);
  assert.equal(out.scope,'composed-system-perl-physical-candidate-diagnostic-only');
  assert.equal(out.productionAuthority,false);
  assert.equal(out.ownedCount,4);assert.equal(out.leakedCount,0);
  assert.equal(out.releasedRefused,true);assert.equal(out.reopenRefused,true);
  ```
- [x] Extend the same real consumer with exact leaf ACL fault AFTER healthy
  fixed baseline, preserving actual file metadata/hash and ancestor rows. Added
  row/plus marker/stderr/nonzero/unknown reap each refuses; restoration after
  caught recheck still refuses. @ xattr alone is not an ACL entry. Expected
  refusal is exactly TASK6A_ORIGIN_BOOTSTRAP_REFUSED, not generic harness failure.
- [x] Test post-capture ancestor drift; close fault counts actual descriptor
  attempts; helper failure plus definite reap cannot revive; partial initial
  capture attempts owned closure. Prior raw contamination is refused without
  closing its original descriptor; raw owner can still clean its own FD.
  Duplicate/arguments/recheck-before-start/release/reopen/raw additions refuse.
- [x] Implement minimal private new/starting/active/burned/released state,
  exclusive initially-empty ledgers, private internal capture/cleanup flag and
  exact record pins. Capture ancestry -> leaf ACL -> fixed retained file ->
  full composed recheck. Recheck privately authenticates state/counts/references,
  settlement/deadline, ancestry/file, leaf ACL, file/ancestry and final settlement.
  Any failure burns and attempts owned cleanup once; cleanup never depends on
  still-valid origin. Independent review found live-ledger cleanup could adopt
  a replacement and leak the original FD: actual ledger removal/replacement
  consumers each observed 1 leaked original FD (2 semantic REDs,187.694ms).
  Seal actual handles immediately after successful open and before fallible
  checks, including partial starts; the private cleanup loop owns release and
  ignores contaminated raw ledgers. Original/raw-owner behavior is unchanged.
  The repaired consumers plus old lifecycle tests passed21/0/0,1232.154ms.
  Actual curl nonzero-but-definitely-reaped operation also revived the epoch
  (1 semantic RED,163.046ms); burn at the captor's final failed-operation edge,
  AFTER its own settlement attempt. The fixed consumer passed1/0/0,124.881ms.
- [x] Run `node --test --test-name-pattern='composed physical|retained|ACL sample' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`
  Observe genuine GREEN for every earlier RED, and original fragment regressions.
  Run coherent in-memory missing-leaf-ACL/post-ancestry/sticky-state mutants:
  literal independent consumer expectations must reject mutants, not source text.
  Initial missing-interface13RED ->13GREEN plus6 old lifecycle GREEN. Focused
  original57 plus initial13 passed70/0/0,2163.677ms. Expanded composition24/0/0,
  1889.127ms:22 modes and2 coherent mutant consumers. Partial capture records
  actual4FD ownership at the external real-file seek edge before denial;
  missing registration mutant exposes all4 leaked FDs. Post-leaf ancestry
  omission actually reaches forbidden acceptance; leaf-ACL omission accepts
  the added row; missing lifecycle burn revives restored actual file validity.
  Real helper clock loss is independently reaped only by its test owner and
  cannot revive helper/composed state. Prior raw FD remains untouched until its
  original owner's explicit close. These are ordinary read-only diagnostics.
- [ ] Fresh whole bootstrap/default host contract suite with actualmacOS zero
  skips; noemit/version/English/path/check-only frozen digests/MC/diff/credential
  gates. Independent exact four-file source/test/spec/plan review; root scoped
  conventional commits and normal reviewed SHA-bound PR delivery only. No main
  commit, history rewrite, guard bypass, root/native/PG/network/selector effect.
- [ ] Synchronize/build only a separately proven clean inactive standby; do not
  change a source tree with unknown surviving children. No fullnpm/Task6A success
  without fresh complete respective evidence. Lost daemon sessions are unverified,
  not passes or authority to signal/adopt/clean old private fixtures.

Native grammar next slice:ordinary reviewed recon5ae16d... completed actual
265region/54path format diagnostic; no raw map was retained. Existing V1 cache
scanner does not parse all rows, can miss anonymous executable regions and uses
split sections incompatible with fixed interleaved args. Root will first add
mapText diagnostic through a real output-preservation RED/GREEN, then request
exact read-only recon pre-effect review before another ordinary own-child run.
Keep map only in orchestration memory; root uses apply_patch for sanitized full
grammar fixture and writes pure parser tests before code. Full protection census
must always classify current OR maximum executable rows; unknown anonymous/JIT/
trampoline rows refuse until exact independent runtime policy exists. No root
observer admission or automatic runtime-flag relaxation follows.

Second exact reviewed dc719fa6... ordinary own-child recon completed0.607s,
actualPID25774,bothdefclose true; independentps absence exit1. Complete raw42583
characters retained in orchestrationmemory only. Root applied mapped337LF-line
fixture after substituting PID77777,parent42424,dates2000-01-01 and stripping
36formatter-padding line endings; full region grammar/counts preserved. Full
fixture has265rows (one kernel pseudo-row),47currentexec,63currentORmaxexec and
13anonymous maxexec even for ApplePerl. Native region policy remains unresolved:
never treat labels as code origin or silently admit anonymous potential code.
The fixture has338 split items including its terminal empty item, not338
LF-terminated lines. Pure-parser28 missing-implementation ASSERT REDs thenGREEN;
seven accepted-bad-input semantic REDs thenGREEN bind details/types, header image
path/load start and exact per-zone region counts. Full44focusedPASS/0SKIP,
independently reviewed at mapSHA256cbbb00600be897bffa2e3a9460dc81c5c225a8ea5a7fc0588cf9d80c25ebe201
and tests99ac8225...b197. Current/max classifiers never exempt unused/cache/guard/
kernel rows; unused paths are separate from image paths. Coherent actual
1MiB/+1bytes with missing-bound in-memory mutant,4096/4097regions,64/65categories
and32/33zones tested. The8192-line defense is structurally redundant under other
caps; a clearly scaled337/338 in-memory consumer exercises that exact branch.
Fresh full357PASS/0FAIL/0SKIP47469.747ms before later publisher-pin refinement.
Mapblob9719bf4f3676b43b7858e3cabe3cee3e679120f8 is now literal source policy:
two exact-four-source publisher REDs thenGREEN, eleven fixed responses and a
fully coherently framed replacement map helper refused. Current57map/source
focusedPASS/0SKIP1131.419ms. No helper import, privilege or publisher network
effect. Parser success means format only; no observerTCB/process/native/source
authority. Full bootstrap stage/drop/held-entry/cleanup remains unimplemented.

Native observer decision/review gates (same File Map):
- [ ] Independently prove vmmap-only literal DT_NO_RESPAWN=1, absent DT_FORCE,
  scrubbed other env, exact byte drift refusal; never DT_NO_RESPAWN_TO_DT.
  Static direct branch proves no developer respawn for observed9e2b3e... bytes;
  no full transitive/target-effect or privilege clearance follows.
- [ ] Prove default VMUTask analysis/corpse/live-target behavior. Document
  peeking/suspension as an explicit owned-private-child lifecycle effect, not a
  globally read-only observation. Never probe live services/foreign PIDs.
- [ ] Review separate ordinary own-child exploratory script and timeout/kill/
  definite reap before any observer invocation. Fixed args -w/-noCoalesce/
  -interleaved/actualPID; do not use-v/allSplitLibs/unverified modes/output files.
  Implement script first through missing-source default-denial tests; ordinary
  invocation with extra argv refuses before spawn. Script must hash/read/check
  nonsymlink rootwheel0755/nlink1 exact system vmmap/perl before either exec,
  then parent captures Perl READY/PID/privatepipes and no caller selection.
  Spawn vmmap with literal env DT_NO_RESPAWN=1 and no DT_FORCE/DYLD/otherenv;
  actualpid args only. Collect complete close/output within10s/8MiB. Close
  target input and require definite both-helper-and-target close, exactPID-only
  bounded shutdown on failure. Print small ordinary diagnostic only after both
  settle; refuse unknown close/reap/signal status. Independent review each file
  and plan then explicit ordinary script invocation; preserve raw maps only in
  memory, no filesystem artifacts or protected-origin claims.
- [ ] After cleared ordinary format/closure evidence, root TDD exact system-tool
  env/byte pins/loaded current+max protections and helper/target failure/reap.
  Keep default main and privileged invocation closed until complete delivery.

- [ ] Write actual unprivileged entry tests before source: exact stdout READY/PONG/END behavior, missing/bad/replayed nonce, extra args, wrong/partial/overbound messages, input EOF, parent loss, fixed deadline and definite close. Spawn ordinary test Node only for protocol evidence; never label it vendor/protected origin.
- [ ] Implement builtin-only child with parent protocol and fixed20s total timer, no renewal/caller options, exit on EOF/invalid input/uncertain stream error. Supply no PID/source facts to parent.
- [ ] Write root-supervisor default denial test: ordinary real system Perl invocation refuses before network/staging/fork. Stub only external effects in a test-only harness where necessary; retain actual program branches, canonical route/source/tree framing, native helper and parent state machine. No production dependency-injection or special test argv.
- [ ] Implement first-BEGIN fixed system module roots and root/exact-zero-argument refusal. Core modules include POSIX/JSON::PP/IO::Select/Digest::SHA/Time::HiRes/MIME::Base64/Encode/Gunzip; root independently inventories/protects full PM/XS/libperl closure, not only initial five bundles. No unchecked default modules.
- [ ] Implement fixed scrubbed Applecurl via direct exec, no shell/config/proxy/redirect/credentials/API-returned routes. Shared monotonic bootstrap180s bound, per metadataGET10s/connect5s/body4MiB; archiveGET60s/128MiB; no retries/renewal. Own helper subprocess PIDs/EOF/reap; uncertainty refuses before execution/cleanup. Actual HTTP200/UTF8/JSON/route/output bounds are required.
- [ ] Port strict signed-merge/tree/blob framing from delivered PR251 semantics into authentic system publisher, test golden ASCII/UTF8 bytes and coherent denials. Join real merged PR/base/main/repo/head/second parent and sampled main endpoint agreement. Do not substitute plutil/verdict-only checks for object identity or call this independent GPG verification.
- [ ] Source helper/entry policy uses actual literal blob identities computed after their final byte review:

```bash
git hash-object --no-filters scripts/task6a-origin-archive-v2.pm
git hash-object --no-filters scripts/task6a-origin-native-v2.pm
git hash-object --no-filters scripts/task6a-origin-map-v2.pm
git hash-object --no-filters scripts/task6a-protected-origin-entry-v2.mjs
```

Insert exact literals with apply_patch before final review; source identities come from reviewed files and actual delivered Git graph, never runtime arguments. Bootstrap own delivered blob is bound by independent owner-install invocation after merge, outside its own self-hash.
- [ ] Implement fresh root-private stage with exclusive/no-follow regular files and retained complete identities/ACL-free protected ancestry. Verify official fixed Node HTTPS checksum against literal ef28d8...fa953, then complete bounded archive scanner and native policy BEFORE any Node execution. Recheck source/vendor physical identities and selected byte hashes.
- [ ] Fork with exact parent-owned PID; child closes unrelated inherited FDs, resets supplementary groups using checked Perl core `$)` assignment (POSIX::setgroups unavailable), checked setgid/setuid, verifies real/effective IDs/groups, then fixed-list `exec {fixedNode} fixedNode,fixedEntry`. Preserve only exact protocol pipes and CLOEXEC setup-error channel; no wrapper or caller code.
- [ ] Parent uses exact waitpid(pid,WNOHANG) before/after READY/native/source samples and bounded three fresh challenges. Parent owns all identity, immutable source/vendor/native metadata and lifetime; no child JSON authority. Burn on ECHILD/exit/EOF/error/drift/timeout/uncertainclose. Never signal reaped PID or use global child reaper. Actual loaded-image observations must account for readonly logging-cache mapped data without executable/writable exceptions.
- [ ] End child, wait definite exact reap, recheck full fixture root/descent and cleanup with narrowly scoped validated code; uncertainty retains new fixture. Keep every old fixture/tree untouched. Output private diagnostics, productionAuthorityfalse; no origin token persists after parent releases.

### Task 2a: Ordinary private parent consumer (not protected execution)

**Consumes:** reviewed actual bootstrap declarations; existing actual now/poll/
shutdown routines; ordinary finite external ports only in the test process.
**Produces:** zero-argument `task6a_origin_consume_entry_protocol()` returning
the exact seven-field counts-only diagnostic from the spec after settlement.
No production initializer exists. `task6a_origin_parent_require_unburned()` is
the actual consumer-used zero-argument no-effect permanent-invalid guard.

- [x] **Step 1: Review design and isolate the sole writer.** Verify fresh clean
  main d40fa/treecb513, own.git/no alternates, initial four-file SHA agreement,
  no .env/node_modules/dist, ordinary UID and old-pin/resource preservation.
  Create scoped branch `fix/task6a-ordinary-parent-protocol-v2` in a separate
  own clone; no old root rebuild or dependency reuse. Independently review this
  exact spec/plan refinement and commit the docs before source changes.

- [x] **Step 2: First missing-feature RED.** Put the named test inside existing
  ordinary-host registration. Assert declaration BEFORE any initializer injection:

```js
test('Perl parent protocol completes exact bounded transcript',()=>{
  const source=readFileSync(BOOTSTRAP,'utf8');
  assert.match(source,/^sub task6a_origin_consume_entry_protocol\s*\{/m,
    'ordinary parent consumer declaration missing');
  const r=systemObject('parent-protocol',{mode:'success'},'');
  assert.equal(r.status,0,r.stderr.toString());
  assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);
  assert.deepEqual(out.consumer,{scope:'parent-entry-protocol-diagnostic-only',
    productionAuthority:false,challengeCount:3,inputBytes:229,outputBytes:220,
    handlesClosed:5,reaped:true});
  assert.deepEqual(out.writes,[`CHALLENGE ${'1'.repeat(64)}\n`,
    `CHALLENGE ${'2'.repeat(64)}\n`,`CHALLENGE ${'3'.repeat(64)}\n`,'END\n']);
  assert.equal(out.harnessFault,null);
});
```

  Run fixed Node with scrubbed environment, no loader/dependencies:

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^Perl parent protocol completes exact bounded transcript$' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

  Expected exactly the missing declaration assertion. Record actual exit/footer.
  This is not later mutation/security evidence. Undefined function/anchor/syntax/
  queue exceptions cannot substitute for this RED or a semantic mutant kill.

- [x] **Step 3: Make external ports trustworthy before consumer GREEN.** Extend
  existing `systemObject` with parent-only startup/runtime sticky fault state.
  Keep sole final-main removal and install CORE overrides before source eval.
  Fix exact prototypes and caller alias behavior with independent self-witnesses:
  actual caller sysopen handle; actual sysread buffer/raw/count/errno; exact
  syswrite payload/request/offset/count; binary configuration; fcntl `0 but true` success; raw exact
  readiness timeout-versus-error/throw and pipe-read undef/EINTR/EAGAIN contracts;
  synthetic waitpid `$?`; fake-PID wait/signal never CORE. Harness independently
  owns ordinary real pipes and closes every extra end. Use finite literal queues.
  Latch unexpected errors BEFORE throw and inspect after EVERY catch/eval before
  translating exact refusal or success. Check eval's independent success sentinel
  and immediately captured `$@`. Unknown factory/primitive/queue/argument cases
  are loud harness failures, not expected status64. Nominated throws require
  literal primitive+ordinal and actual reachability. Trace records strictly
  increasing seq/op/original-role/slot/invocation/request/return/errno/bytes/raw
  wait status; fixture cleanup attempts/definite closes are separate facts.

- [x] **Step 4: Clock RED/GREEN.** Add actual-validator consumers for undefined,
  reference, string-numeric, dual POK/numeric, throw, negative, backward, over1e12,
  numeric NaN and Inf; allow zero/equal/fraction and inclusive1e12. Construct
  POSIX numeric factories and inspect public B flags/classification before
  returning samples; never stringify them first. Add unexpected factory and
  exhausted-clock harness-fault controls. Preserve actual validator in every
  parent/transport test. Observe genuine invalid-scalar acceptance RED, then:

```perl
sub task6a_origin_now {
    task6a_origin_refuse() unless @_==0;
    my $now;
    my $ok=eval {$now=Time::HiRes::clock_gettime(Time::HiRes::CLOCK_MONOTONIC());1;};
    task6a_origin_refuse() unless $ok&&defined($now)&&!ref($now);
    my $flags=B::svref_2object(\$now)->FLAGS;
    task6a_origin_refuse() if $flags&B::SVf_POK();
    task6a_origin_refuse() unless $flags&(B::SVf_IOK()|B::SVf_NOK());
    task6a_origin_refuse() if $now!=$now||$now<0||$now<$last_clock||$now>1e12;
    $last_clock=$now;return $now;
}
```

Ruling: recheck the admission at every epoch/settlement; inspect both copied PID
scalars before coercion and bind1..2147483647 to actual target signed32 pid_t
(SDK sys/_types.h:84 and sys/_types/_pid_t.h:31). Authenticated pre-first-poll
failure gets one original-only cleanup poll, then unchanged known-live shutdown.
Reason: initial-only checks permit record drift, and clock failure cannot strand
an authenticated child. Cost if wrong: ordinary interface/test rework, never a
native gate waiver. Require drift, PID type/range and early-failure settlement
denials before completing the slice; the initial missing-feature RED was observed.

- [x] **Step 5: Private state and once-only ownership.** Beside current private
  declarations define absent admission+retained HASH reference, copied original
  PID, five originals, phase/permanent-invalid/cleanup flags, close-attempted/
  definite-close arrays, immutable start/deadline and independent frame/EOF/
  reap facts exactly as spec. Add no setter. Pin the unique in-memory test
  initializer after literal review; test originals before injecting their copied
  admission. Configure/recheck only original live slots; retained closed slots
  never become live again or close reused numeric FDs. Entropy acquisition is
  recorded before configuration. Failure burns before original-only disposal.
  Preserve raw binary rootwheel entropy and exact pre/opened/post-read lstat/
  fstat identity/flags/count32/buffer32. Live pipe identity uses stable fields0..6,
  not transient size/timestamps; retain complete captures for diagnostics.
  Each attempted flag precedes the call, false/throw never retries, remaining
  originals still close. Unknown/unauthed/uncertain/reaped PID never signals.

- [x] **Step 6: Actual FSM GREEN.** Implement setup-empty-EOF+definite-close,
  buffered READY acceptance, literal owned entropy, three32byte unique challenges,
  matching current PONG, entropy definite close before challenge3, full END,
  definite input close before ending, final END/drain/allEOF/exactrawzero/all5
  definite closes before settled. Parse full chunks before successor effects.
  Requests/totals/partial buffers/deadlines are the spec's exact literals; no
  generic runner/captor rewrite. Actual IO::Select construction/membership stay
  real; external readiness may be substituted. Clear `$!` before readiness;
  empty+zero errno is timeout only, throw/nonzero errno/unknown or duplicate
  ready handles refuses. Pipe read undef/throw/EINTR/EAGAIN refuses without retry;
  zero alone is EOF, count equals raw buffer length and lies within request.
  Bracket every readiness/read/nonterminal-write (including entropy) with actual
  exact-PID poll and original-deadline checks before/after. Treat final full
  END-write/definite-input-close/enter-ending as one compound operation checked
  before END and after ending, with no intervening poll. Any observed reap before
  definite input close refuses. This samples lifetime, not an exact kernel-exit
  timestamp or continuous proof; do not infer that from synthetic wait events.
  Return only the literal diagnostic in Step2 after irreversible settled state.
  Allow eventual clock progress, not an invented fixed poll-attempt cap.

- [x] **Step 7: Denials and six honest semantic mutants.** Fresh fixture for
  each absent/forged/arity/alias/replaced original, every fragment boundary,
  coalesced future/replay/extra/CRLF/NUL/uppercase/63or65hex/partial EOF/221byte
  stdout, one stderr/setup byte, each missing EOF/reap/close, partial write,
  entropy device/flags/path drift/31or33bytes/duplicate/throw, early/nonzero/
  undefined/ECHILD/foreign reap, deadline44->46/bootstrap expiry and restored
  burn/repeat. Original decisions stay real. Inject mutations only after unique
  actual literal anchor review. Wrong nonce/nonzero reap/deadline renewal must
  reach otherwise coherent forbidden diagnostics; burn omission must admit the
  actual used guard after refusal+disposal with zero new events; remove all and
  only reaped signal exclusions for postreap forbidden synthetic signal witness.
  Input-close omission must show actual final-END acceptance via observer inserted
  immediately AFTER its assignment in test-copy bytes; read delivery is not
  acceptance, even if final all-close check later refuses. Require positive
  baseline closure and sticky harnessFaultnull before crediting each semantic kill.

- [x] **Step 8: Adjacent and full ordinary verification.** Run exact new parent
  and clock consumers, existing metadata-clock tests, child entry, helper captor,
  physical-holder, unsupported-host and actual default-graph leaf consumers.
  Then full actual bootstrap test suite with zero macOS skips, bounded fixed
  command/output and explicit terminal evidence. Source syntax/version/English/
  path/diff gates must pass. No repeat ALL/native/protected probe is needed.

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
git diff --check
git diff --stat d40fa6b9d517bdbb9e466585c86fbd1471c4dfc0
```

- [x] **Step 9: Ordinary reviewed delivery.** Exact four-file independent source/
  test/spec/plan review; record actual RED/GREEN/mutant counts and source pins.
  Scoped conventional commit/normal push/PR; full paginated actual current-head
  comments/review/security/threads, normal SHA-bound merge, no bypass/deletion.
  Fresh own clean-main dependency/build admission and guarded build (never dirty
  bypass), exact source/build binding and independent old-pin/host preservation.
  This closes only ordinary P2a. No installation/root/native/service/DB/fence/
  genesis/32/33/A–E/M1/M2 claim; retain all worktrees/branches/evidence.

Ordinary execution ledger, 2026-10-03:

- Ordinary P2a Steps1–9 closed at exact source04393cce/test28176bc. Full1118 and
  adjacent895 actual PASS/0FAIL/0SKIP, complete outputs and natural terminal0
  observed. Final independent exact four-file reviews C0/I0/M0. PR267 exacthead
  88f1aa315566a202781a783b5624a9a91047df85 delivered normally; current-head Codex
  Completed plus actual bot +1 supports no findings, not formal approval;
  GitGuardian SUCCESS/zero annotations and full paginated feedback clear.
  Optional Copilot/Gemini approval was not observed or inferred.
- Normal SHA-bound merge ca86623fb13d29a01a3e45c27a0cf7d315b32276 has exact
  parents d40fa6b9/88f1aa3 and reviewed treea9c62512. Separate full own clean-main
  clone, one locked ignore-scripts install, independently admitted fresh source/
  tools/dependencies/preservation, then ONE normal pre/build/post guarded build.
  Actual npmEXIT0/CLOSE0/null/spawnErrorfalse and outer0 observed; full terminal
  output read. Display2.3.79+ca86623f, input660d06e3f6306ea98e3de825b0692ae81f37feb759ad302fb998688d293e9f14,
  outputTree033a76deae2fce44ca3f5df9492582ddcffd5da5c8bd26eaebff899964217f73.
  Independent complete858-output/three-artifact/source binding and old-pin/host
  preservation C0/I0/M0. All roots/branches/evidence retained; no old ALL rerun,
  main direct commit, native/SQL/credential/service/fence/cutover admission.

- Reviewed exact specbd7fa279/plan981482ef promoted in scoped docs commit
  bf96cf3d2a42ff1cfb3626ab29dc46a1dad4cc71; two independent C0/I0/M0 reviews.
- First consumer RED a6af00 CLOSED1:1FAIL/0SKIP/50.926792ms, actual missing
  declaration assertion before any initializer. First consumer GREEN is recorded
  in the superseding11:27UTC ledger below; full Step7 remains pending.
- Independently reviewed clock-only harness preserved actual validator; genuine
  2706f8 CLOSED1:16tests/10PASS/6FAIL/0SKIP/379.744334ms. Actual string/dual/
  reference acceptance, undefined warnings, escaped nominated throw and arity
  acceptance; four sticky harness-fault controls passed, not false refusals.
- Minimal reviewed actual-now change then a62441 CLOSED0:16PASS/0SKIP/
  371.066417ms. No imports/main/launcher change. This is only the clock slice.
- Fresh resume/source/preservation/resource audit before adjacent invocation
  26360 naturally CLOSED0/af0b15:121PASS/0FAIL/0SKIP/31183.4575ms, all actual
  clock/metadata/source/vendor/entry/captor/default-graph selected consumers.
  Full bootstrap suite was NOT selected; the still-missing parent test excluded.
- Parent pipe/entropy/ready/prototype harness self-witnesses, real FSM, six
  coherent mutants, full ordinary review/delivery/build remain pending.
  No native/protected/service/SQL/P2/P2a/M1/M2 acceptance is implied.

11:00UTC superseding candidate ledger:
- Foundation10/17/27/30 focusedcases each actual CLOSED0/0SKIP; latest05788b
  30PASS/0FAIL/0SKIP/482.285708ms. Runtime bridge errors were harness faults,
  not semantic refusal/mutation evidence; exact prototypes/aliases now witnessed.
- First actualprivateparent FSM candidate implemented but UNEXECUTED; source
  review corrected initial-only admission checks and pre-first-poll settlement.
  RawtypedPID signed32 ruling above refines the same four-file causal contract.
- Compile-only face33 CLOSED0 syntaxOK; JSsyntax/diffcheck0. Actualsuccess
  initializer/finiteexternalport fixture remains under independent pre-effect
  review before the first real consumer invocation. No firstconsumerGREEN yet.
- Denials, fragmentmatrix, six coherent mutants, full verification, reviewedPR
  and clean-main delivery still required. Main/native/production gates unchanged.

11:27UTC superseding actual-consumer ledger:
- Actualconsumer bb226e CLOSED0:1PASS/0FAIL/0SKIP84.175291ms; foundation+consumer
  983654 CLOSED0:31PASS/0FAIL/0SKIP672.770291ms; sixunauthenticateddenials
  3cafe0 CLOSED0:6PASS/0FAIL/0SKIP200.539334ms.
- Independent reviews found raw256 closeassertions counted fixturefinalizer;
  root corrected to pre-finalizer consumerEvents, exact five original attempts/
  definite results. Corrected testbde95960...f385/source04393cc...8d9 C0/I0/M0;
  focused8d05e0 CLOSED0:10PASS/0FAIL/0SKIP361.56175ms. Raw256 refusal, otherwise
  complete rawzero-mutant diagnostic and actual burn-mutant guard acceptance
  after refusal/disposal observed. No syntax/queue/harnesserror counted as kill.
- Finite wait lifetime chooses live32 or closed-input1 only from independently
  CORE-confirmed physical originalinput closure, never copiedphase/result.
  Latest test4982f2e...06a adds wrongnonce baseline+actualactive-onlyprefix mutant,
  UNEXECUTED pending exact review. Four other controls, fault/fragment/ownership
  matrices, full ordinary suite/review/PR/clean-main remain. No native/protected/
  service/DB/fence/A-E/P2a/M1/M2 completion implied.

11:55UTC superseding executed-matrix ledger:
- All six required semanticcontrols observed at exacttestd7e87fed...bdcd/source
  04393cc...8d9:64babb/15f5c1 CLOSED0:46PASS/0FAIL/0SKIP1239.656875ms.
  Wrongnonce/raw256/deadline mutants reach complete forbidden diagnostics;
  burnedguard mutant accepts actual usedguard after refusal/disposal; postreap
  mutant sends one synthetic TERM only after exactreap/five definitecloses;
  inputclose mutant records actual END acceptance with physicallylive original
  input, then stillrefuses/burns/disposes/reaps at the originaldeadline.
- Failedpostreap791a1a/650c80 were NOT kills. JS stringreplacement corrupted
  literal Perl$$; TESTONLY callback replacements preserve exactbytes now, with
  bounded changedshutdown and byte-identicalactualpoll checks. Independent
  C0/I0/M0 before freshpassing46case run; no productionwaiver/fix.
- Fullordinarybootstrap4504dc/5faf6a CLOSED0:444PASS/0FAIL/0SKIP52134.245875ms,
  completeoutput/footerread at d7e87fed. No projectALL/native/privileged claim.
- Reviewed ac886ccd...78b7 then215nonemptytwochunkboundarycases b05734/1867e0
  CLOSED0:215PASS/0FAIL/0SKIP5937.17875ms: READY5, PONG1-3 each69, END3;
  actualpipebytes, fullfinitequeue drainage, exactdiagnostic/closes/counters.
  No arbitrarymultichunk/native/timing inference.
- Latesttest7b45dd33...86cf adds11malformed/partialEOF/sidechannelbyte denials,
  UNEXECUTED pending exactreview. Source04393 unchanged. Remainingownership/
  error/entropy/reap/deadline matrices and freshfullordinaryreview/delivery/
  build stillrequired. Step7/8/9 remain open; protected/main gates unchanged.

12:10UTC superseding verification ledger:
- Exactsource04393ccef9795a0d78f3c9dd96bbb2bdc045e32dfb9505acdfe8711972aac8d9
  and test9f19726fbe15cd4d050b23de86bba24bfba3e012b0e2faecfdc4056dbcd328b4:
  fullordinary005e66/1ec3d8/b6ad7d CLOSED0,675PASS/0FAIL/0CANCEL/0SKIP/0TODO,
  58648.633541ms. Terminal0/finalfooter observed; middle first output chunk
  outer-display truncated, no full per-line-read claim. Parentfd868b/f98be8
  CLOSED0:277PASS/0FAIL/0SKIP7610.195791ms, completeoutput/footerread.
- Reviewed malformed/partialEOF/sidechannel825164 CLOSED0:11P0F0S358.418916ms;
  earlywait4 and clockC2throw8b2da3 CLOSED0:5P0F0S183.596167ms. Earlier pending/
  running statements are historical. No managed test session currently running.
- Step7 remains open for admission/restoration/alias, primitive/entropy errors,
  all229 partialwrite nominations, missingEOF/reap/uncertainclose and bootstrap
  expiry/framing matrices. Portselfwitnesses do not replace actualconsumer
  denials. Step8/9 and delivery/native/service/DB/fence/A-E remain open.

Resumed Step7 admission candidate (not yet executed):
- Fresh get_goal returned null; standing owner protocol continues the same
  bounded objective, not a historical blocked lock. Root alone writes.
- Test940ab35d188365cf645151cdc55cbef8fed31321327460b5a000a85034a4f675 adds
  25 initial and25 C3-drift cases: four aliases/four owned-peer replacements,
  five missing keys/extra key, nine PID values/types, copied HASH/absent record.
  Source04393 unchanged. Independent exact review precedes execution.
- Ruling: nominate admission-only mutation after external clock C3, restore
  only its original HASH/fields after consumer disposal and before the repeat
  baseline. Reason: next actual epoch must reject while cleanup retains sealed
  originals/PID. Cost if wrong: ordinary fixture rework, no native effect.
- Original custody snapshots retain record/FH/FD/all13stat values, checked
  without consulting closed descriptors; no phase/latch/close facts reset.
  Expected initial0 protocol/PID effects; C3 two consumer clocks/12stat/20fcntl,
  one sealed live poll plus cleanup raw-zero reap after four definite closes.
  Restoration must not revive actual consumer/usedguard; repeat effects0.
  These are proposed coverage, not new production RED/GREEN or Step7 closure.

13:27UTC Step7 admission execution and write candidate:
- Test940ab35d...f675/source04393 reviewed C0/I0/M0 twice;16d8e6/63d7f6
  CLOSED0:50PASS/0FAIL/0CANCEL/0SKIP/0TODO1383.909833ms, fulloutput/footerread.
  Earlier admission UNEXECUTED statement is historical. All50actual denials/
  originalcustody disposal/restored-record burnedrepeat requirements observed.
- Test308a1c91d93659468fb403e7cb37ae17980703fbbcc34eaa156c2617d5bdf152 adds
  all229shortwrite outcomes, six firstwrite undefined/throw/EINTR/EAGAIN/EIO/
  fullcompletion+freshEIO outcomes. UNEXECUTED pending independent exactreview.
  Preserve fullcaller75/END4request; nominate physicalCOREshort count, independently
  read only expected peerprefix, forbidretry/successor; no spontaneousOSfault claim.
  Fullcompletion+errno distinguishes physicalcompletion from accepted return.
  All queues are finite independently counted literals. Remaining Step7/8/9 open.

Step7 write execution and primitive candidate:
- Exacttest308a1c91...f152/source04393 reviewed C0/I0/M0 twice;68c5f8/3ef4e3
  CLOSED0:235PASS/0FAIL/0CANCEL/0SKIP/0TODO6641.4355ms, fulloutput/footerread.
  All229short/zero completions and6firstwrite fault outcomes observed at actual
  consumer. Physical CORE writes are controlled nominations, not spontaneous
  kernel shortwrite/error evidence. Zero cases do not prove peerbuffer absence.
- Test463dd414c693ec8099c1d5640eb605b299b2998efe2518679337054ae69e1c06 adds
  10read/5readiness/10close-response-fault cases UNEXECUTED underexactreview.
  Physical close precedes false/throw nomination; never a cleanup-complete claim.
  Late stderr/stdout close cases explicitly require their closes AFTER already
  observed exactreap; other rows preserve all-close-before-cleanup-reap ordering.
  Scope unchanged; Step7/8/9 and native/service/DB/fence/A-E remain open.

13:43UTC Step7 primitive/framing verification:
- Test463dd414...e1c06/source04393:7757e3 CLOSED0,25P0F0S775.21875ms,
  fulloutput/footerread. Independent C0/I0/M0; secondC0/I0/M1 timeouttitle
  corrected to distinguish healthyemptyreadiness from subsequentdeadlineexpiry.
- Testa2e2a3b2fbc3295f04a8d0baf5397c1d4b907e4e83e4fc35964a42d2c3b4ab88
  adds17framecases; independentC0/I0/M0 then55258d CLOSED0:18P0F0S586.545208ms
  (includes correctedtimeout). Actual replay/future/initialcoalescedprefix,
  END-extra/after-END actual221 bytes, malformedEND,5READY/3END actualprefixEOF.
  Current further exactreview pending. No full Step7/8/9/native qualification.

Step7 finish and remaining configuration port:
- Exacttest768f9507...4279/source04393 reviewed C0/I0/M0 twice;10ffe1 CLOSED0:
  9PASS/0FAIL/0SKIP349.059584ms, fulloutput/footerread. Four successful order
  permutations, three missingEOF denials, protocol-deadline missingreap followed
  by original-only cleanupreap, bootstrap179->180 clipping observed. Reap-last
  proves after END bytes/before stdoutEOF, not continuous kernel lifetime.
- Ruling: extend the existing finite external ports with binmode rather than
  mock the consumer configuration or add a separate runner. Reason: spec already
  requires binary/configuration denial, but initial portlist omitted its seam.
  Cost if wrong: ordinary fixture rework; no new production knob/native authority.
  Existing four-file File Map remains exact. Root f2384e CLOSED0 independently
  observes fixed-system CORE::binmode prototype `*;$` before hook installation.
- Configuration adapter TDD: first add ordinary selfwitness for actual owned
  input binary configuration, expect missing-adapter failure before adding hook.
  Then install caller-FH-preserving prototype-checked CORE-delegating port;
  false/throw only after actual configuration, literal nomination event before
  response. Fixture setup remains CORE::binmode and is outside consumer traces.
  Run three adapter selfwitnesses, then ten false/throw actualconsumer cases.
  Original index0..3:8stat/2consumerclock/2wait/fcntl0,5,10,15; entropy35stat/
  8consumerclock/8wait/20fcntl. All acquire original custody before configuration,
  burn, close every genuine original once, then effect-free repeat. Remaining
  entropy/physicaldrift and fullverification/delivery requirements stay open.

Configuration adapter evidence:
- Exactfb41dd90...3aa3 independently reviewed RED-only C0/I0/M0. Roota91c90
  CLOSED1:1FAIL/0SKIP84.859833ms; missingadapter mode produced fixedharness
  fault255 rather than expected0. This is missing-test-adapter RED, NOT semantic
  security refusal or a production mutant kill. All acquired fixtureends cleaned.
- Candidatea3680e7167631369470de6071c5d08675f1be41d907fb2afe59241b5b3c723ef
  adds literalprototype native/installed checks, ownedFH CORE-delegating binary
  port, postconfiguration false/throw noms and three selfwitnesses. UNEXECUTED
  underexactindependentreview; source04393/main unchanged. Need adapterGREEN,
  healthy actualparent regression then tenconsumerconfiguration denials before
  claiming coverage. Step7/8/9 still open.

14:19UTC superseding configuration evidence and entropy candidate:
- Reviewed a3680e/source04393:1f3b9a CLOSED0,4P0F0S158.501542ms; three
  adapter selfwitnesses and healthy actualconsumer regression. Earlier adapter
  UNEXECUTED statement historical. Reviewed b92f19d/source04393:1a435f/4529d4
  CLOSED0,38P0F0C0S0TODO1100.650209ms, fulloutput/footerread. Ten config false/
  throw and28 original observed-stat drift cases qualify ordinary decisions,
  never actual native FD replacement. No production source change.
- Candidate d530704c9e028dabc8c8d6ead538741171593fbde00bf34871653ed430f2f61e
  adds53 actualconsumer entropy/flags cases UNEXECUTED pending exact reviews.
  Preidentity4/open3/identity21/read9/flags16. Actual successful CORE config/flag
  operations precede synthetic false/throw/undefined/bit corruption nominations.
  Entropy read31 is physical31; reported33 is synthetic after witnessedCORE32,
  never claimed native read33. Duplicate second raw32 must reject before a second
  challenge. Fixed synthetic entropy tuples remain ordinary fixtures only.
- Finite per-role fcntl queues now validate all23 healthy consumer operations;
  rerun positive/Foundation and semantic controls to catch regressions. Tuple
  shape and coherent actual retained-FD replacement coverage/acceptance ruling
  remain required before Step7 closure; Step8/9 also open.

Remaining Step7 shape/rebinding design refinement:
- Root uses writing-plans to refine the same approved four-file map. Choose an
  actual owned input-pipe FD rebinding over a fake fileno port or silent coverage
  waiver. Cost if wrong: ordinary fixture rework only. No production API/effect.
- First add a missing-adapter selfwitness for `fd-rebinding` and literal actual
  consumer shape cases. Exact read-only review precedes missing-adapter RED;
  never count that harness fault as semantic refusal or production mutant kill.
- Existing stat/lstat ports retain independently captured13-field actual/synthetic
  tuples, then nominate copied12/14-field returns at original-input second stat
  or entropy pre/opened/postpath/posthandle seams. Consumer must refuse, burn,
  once-dispose original custody and settle only sealed PID with repeat effects0.
- For actual rebinding, duplicate only the live owned input writer with fixed
  `CORE::open(my $hold,'>&',$input)`, immediately register it in the fixture
  ledger before inspection; then acquire/register both ends of one fresh pipe.
  Fixture owns11 ends total. Require independent old/hold identities to match
  and replacement writer's actual stable identity to differ. If not distinguishable,
  refuse the fixture; no synthetic inode or alternate filesystem target.
- A bounded fixture closure at nominated clock C3 performs fixed system
  `POSIX::dup2(replacement_writer_fd, original_input_fd)` once. Require defined
  return and fresh errno0 plus independent actual original/hold/replacement
  stat/fileno checks; do not assume success truthiness or documented C return.
  Selfwitness records actual return shape before consumer credit. Retained FH,
  FD, admission and all13 captured custody fields remain unchanged. No restore,
  reopen, closeflag reset or new production custody acquisition.
- Expected actualconsumer rebinding denial:2consumer clocks/5stats/2sealed waits,
  no configuration/readiness/read/write/entropy/signals, original closes input/
  stdout/stderr/setup once before cleanuprawzero. Fixture old-preservation and
  replacement-source handles must remain live with unchanged FD/stable identity
  after consumer and burnedrepeat; fixturefinalizer alone closes those handles.
  Disposing original FH necessarily closes current replacement binding: spec
  makes this observable boundary explicit, not a weakened validation gate.
- Independent design/code review and actual selfwitness/consumer execution still
  required; no Step7 checkbox or native/Task3 admission follows from this plan.

14:46UTC final ordinary Step7/8 evidence, superseding pending statements:
- Bootstrap04393ccef9795a0d78f3c9dd96bbb2bdc045e32dfb9505acdfe8711972aac8d9
  and final test28176bc303369e284eef3810a939c197e98cf5bab527071ae32a3afb6f0a9bfa.
  No production source change during all recent entropy/flags/shape/rebinding/
  settled-repeat additions. Source/spec/refined plan independently reviewed.
- Entropy/flags53:2fe923/7748a4 CLOSED0,53P0F0C0S0TODO1628.629333ms;
  Foundation/healthy/sixsemantic controls40:1e4b6c/cf8b31 CLOSED0,40P0F0C0S0TODO
  1213.600458ms at d530704c. Complete outputs/footer read. Earlier UNEXECUTED
  candidate annotations are historical, not current pending work.
- Shape/rebinding missing-adapter19660349 RED9ac778 CLOSED1:11F0P0S320.384334ms,
  fixed harness fault only, not semantic security RED. Reviewed140910c4 GREEN
  b5a632 CLOSED0:1P0F0S94.673292ms actual SIP POSIX dup2 return4/prototypeNULL,
  real stable identity difference; c8a6a9 CLOSED0:11P0F0C0S0TODO398.969917ms,
  actual consumer rebinding and shape10 denials. No custody/reset/native claim.
- Source-only checklist I1 identified missing settled repetition coverage.
  Reviewed405ce39c adapter REDb43cda CLOSED1:1F0P0S89.982417ms missing mode,
  not semantic RED. Reviewed28176bc GREEN8002f9 CLOSED0:1P0F0S100.751083ms;
  preserves first exact seven-field diagnostic, actual repeated consumer/guard
  refuse and burn, no new events/reinitialization/reopened handle.
- Fresh exact source/isolation/resource admission confirms sole mapped writer,
  own full Git/canonical origin/ordinary UID/no source changes. Independent
  14:43–14:44 preservation C0/I0/M0 matches admitted own-clone and retained
  source/build/dependency/output, requested two-file, backup/journal and MC pins.
  Resources remain healthy. Detailed host/physical measurements stay in the
  external execution ledgers; this is not global zero-owner or loaded-host proof.
- Adjacent403950/cbae46 CLOSED0:895P0F0C0S0TODO57100.26ms; full7f3053/6169b9
  CLOSED0:1118P0F0C0S0TODO73898.952958ms. Both entire outputs read in memory
  chunks without truncation; natural terminal0/footer observed. All215fragment
  boundaries/all229partial writes/sixsemantic controls/current matrices rechecked
  on final exact bytes. No old project ALL rerun/native/protected/SQL effect.
- Fixed Perl syntaxc6ec67, final JS syntaxd1e4f2, version1d90c3(2.3.79),
  English82d429(1931), paths5a4911(966), diffeccb45 all CLOSED0. After these
  evidence-only plan marks, rerun cheap doc/source gates before commit.
- Steps3/5/7/8 now ordinary-qualified only. Step9 exact reviewed delivery/PR/
  clean-main build remains open. Protected Task2/Task3/native/M1/M2/fence/DB/
  service/A–E gates remain unchanged and incomplete; all worktrees retained.

### Task 2b.1: Ordinary actual captor foundation (test-only)

**Goal:** Prove a bounded lower-port bridge through the existing real ACL, captor, FD parser, clock and helper-lifecycle decisions before implementing any staged custody declaration.

**Architecture:** One closed test kind owns four real pipe pairs and one read-only directory handle. It injects finite synthetic clock, PID/wait, readiness and directory-entry samples but uses real pipe bytes, binary mode, CLOEXEC and definite original closure. It never simulates a successful captor DTO or executes an external helper.

**Tech Stack:** Existing Node builtins, fixed Apple system Perl and existing fixed SIP core/XS modules. No dependency/package/lock changes.

**Spec:** Staged source/vendor custody section in `docs/superpowers/specs/2026-09-30-task6a-protected-origin-bootstrap-v2-design.md`.

**Files and interfaces:**

- Modify only this plan, its existing spec for causally required clarification and `scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`.
- Bootstrap remains source SHA25604393ccef9795a0d78f3c9dd96bbb2bdc045e32dfb9505acdfe8711972aac8d9. The existing callback-based `replaceOnce` removes its sole final main call in memory. Only this closed captor kind additionally maps the unique external child-exec syntax site to the unconditional denying port specified below; no other source bytes change.
- Add `STAGED_CAPTOR_PORT_PROGRAM` before `PARENT_PORT_PROGRAM`, handling only `kind:'staged-captor-ports'` and a closed `{mode}` record. Interpolate it before the parent program in `systemObject`.
- `stagedCaptorPorts(mode='healthy')` invokes only that closed kind. Old parent/composed/source/vendor modes remain unchanged. No production initializer, staged declaration, path/hash setter, callback, tool allowlist expansion or native launcher.

**Global constraints for this task:**

Root is the sole writer/poller/delivery owner; agents perform read-only review. Preserve all original worktrees/branches/requested two/evidence/cache. No direct main commit, reset/revert/history rewrite/worktree deletion, new ALL, native observer, real fork/exec/wait/kill, protected/root/SQL/credential/ACL/service effects or production-main opening.

Ruling: acquire one own read-only DIR handle on literal `/dev/fd` instead of a fresh empty directory. This preserves real directory acquisition/parser/closure while removing fixture pathname creation/deletion/selection. All enumerated names are synthetic; no actual CORE readdir or host-census proof. If wrong, the ordinary bridge needs rework; no protected authority follows.

Explicit delegates are only four CORE pipe pairs, CORE stat/fileno on sealed owned originals, binary mode, one setup CLOEXEC fcntl, bounded stdout-writer fixture preload, real queued sysreads, once-only original close and one read-only CORE opendir/closedir. Real IO::Select construction/membership/count/removal stay active; only readiness is nominated. Source-side other listed file/process/socket/signal ports deny before delegation. CORE::GLOBAL hooks are not a general Perl sandbox; qualified/compiled bypasses must not be introduced into the reviewed candidate. Perl cannot parse the block form `exec {$tool} $tool,@$args;` as an overridden ordinary sub. Map exactly that one memory-copy external site to `CORE::GLOBAL::exec($tool,$tool,@$args);`, retaining both operands but always denying delegation. Real child exec syntax/argv/dispatch equivalence is expressly unqualified; positive-PID parent cases never enter it.

H1 waits are live0/live0/live0/exact424242 with raw0 or256; no kernel fork/wait/kill. Two readiness rounds, four reads, eight pipe closes plus one closedir. Seven clocks include startup; raw256 uses six because it refuses before the final successful clock. Census refusals/inspection and partial pair faults use three clocks and no fork/wait/readiness/read.

Literal synthetic census: `.`/`..`, std0/1/2, eight live original pipe FDs and its own live FD, then errno0 EOF: 15 readdir calls. Duplicate ordinal7, noncanonical ordinal6 and EIO ordinal6 refuse before fork. Actual fds removes its own FD and sorts the remaining11. No borrowed descriptor is closed.

Event cap8192; each canonical UTF8 event <=512B; metadata <=16384B; complete pre-print UTF8 JSON <=8388608B. Event validation/serialization/overflow latches nonthrowingly. Already-owned cleanup bypasses queue/sticky validity checks. maxBuffer8388608 applies only to this closed kind; old65536 and every timeout remain unchanged. No generic retry/quota increase.

Source gap stays visible: capture close loop797–798 and fds closedir696 are outside their respective evals. Throwing close can escape before shared/helper accounting. This foundation does not fix or conceal it. Later throwing-close RED needs its own mapped causal source/test/spec/plan refinement, distinguishing consumer closure from fixture finalization.

- [x] **Step 1: Add only the helper and first healthy test from the literal JS block.** Its `typeof STAGED_CAPTOR_PORT_PROGRAM` assertion executes before systemObject/new fixture child. Missing adapter must fail with `staged captor adapter missing`, not syntax/anchor/queue failure. This is adapter RED only, not a claim of missing production ACL/capture behavior.
- [x] **Step 2: Two exact candidate read-only reviews, then ONE focused RED.** Review source/env/host/interception/closure recipe before any focused execution. Root observes natural terminal and reads all output.

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged captor foundation retains actual ACL capture and original closure$' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

- [x] **Step 3: After observed RED add the exact lower-port adapter.** The following is the complete Perl payload for `const STAGED_CAPTOR_PORT_PROGRAM=String.raw` plus a JS template literal. Preserve dollar/backslash bytes with callback-based replacement. No production edit.

```perl
    if($q->{kind} eq 'staged-captor-ports') {
      require Fcntl; require IO::Select; require POSIX; require Time::HiRes;
      require B; require Errno; require Digest::SHA; require Encode;
      my $fault='';my @owned;my %roles;my @events;my %calls;
      my $mode=$q->{record}{mode};
      my %modes=map {$_=>1} qw(healthy malformed extra-row raw256 census-duplicate census-noncanonical census-eio partial-pipe inspection-fault forbidden forbidden-exec caught-fault overflow);
      die "TEST_STAGED_CAPTOR_HARNESS_FAULT\n" unless ref($q->{record}) eq 'HASH'
        &&join(',',sort keys %{$q->{record}}) eq 'mode'&&defined($mode)&&!ref($mode)&&$modes{$mode};
      my $self=$mode=~/\A(?:partial-pipe|inspection-fault|forbidden|forbidden-exec|caught-fault|overflow)\z/;
      my $latch=sub {$fault='TEST_STAGED_CAPTOR_HARNESS_FAULT';return 0;};
      my $fail=sub {$latch->();die "$fault\n";};
      my $check=sub {die "$fault\n" if length($fault);};
      my $event=sub {
        return 0 if length($fault);
        my $ok=eval {
          $fail->() if @events>=8192||@_%2;
          my %e=(seq=>1+@events,@_);
          for my $k(keys %e) {
            $fail->() unless $k=~/\A[a-zA-Z][a-zA-Z0-9]{0,31}\z/;
            my $v=$e{$k};$fail->() unless defined($v)&&!ref($v);
            if($k eq 'op'||$k eq 'role') {
              $fail->() unless $v=~/\A[A-Za-z0-9_.-]+\z/&&length($v)<=($k eq 'op'?32:96);
            } else {$fail->() unless $v=~/\A[0-9]+\z/&&$v<=2000000000000;}
          }
          my $encoded=JSON::PP->new->canonical->utf8->encode(\%e);
          $fail->() if length($encoded)>512;push @events,\%e;1;
        };
        $latch->() unless $ok;return $ok?1:0;
      };
      my @pipe_roles=(['in-r','in-w'],['out-r','out-w'],['err-r','err-w'],['setup-r','setup-w']);
      my @clock=(0)x($mode eq 'raw256'?6:$mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow'?3:7);
      my @wait=([0,0],[0,0],[0,0],[424242,$mode eq 'raw256'?256:0]);
      @wait=() if $mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow';
      my @ready=(['out-r','err-r','setup-r'],['out-r']);
      @ready=() if $mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow';
      my %read=( 'out-r'=>[1,0], 'err-r'=>[0], 'setup-r'=>[0] );
      my @census;my $census;my $census_built=0;my $loaded=0;my $selector;
      my ($captured,$enumerated);my $load_complete=0;my $setup_error='';
      my $identify=sub {
        my ($fh)=@_;$fail->() unless defined($fh)&&ref($fh);
        for my $r(@owned) {
          next unless $r->{fh}==$fh;
          $fail->() if $r->{attempted}||$r->{closed}||!defined(fileno($fh))
            ||fileno($fh)!=$r->{fd};
          my @s=CORE::stat($fh);$fail->() unless @s==13;
          for my $i(0..6) {$fail->() unless $s[$i]==$r->{identity}[$i];}
          return $r;
        }
        $fail->();
      };
      my $register=sub {
        my @records=@_;
        # Alias rejection precedes registration; all distinct acquisitions are
        # retained together before any fallible fileno/stat/configuration.
        for my $r(@records) {
          for my $other(@owned,@records) {
            next if $r==$other;$fail->() if $r->{fh}==$other->{fh};
          }
        }
        push @owned,@records;
        $fail->() if $mode eq 'inspection-fault'&&@owned==2;
        for my $r(@records) {
          $r->{fd}=fileno($r->{fh});$fail->() unless defined($r->{fd})&&$r->{fd}>=3;
          for my $other(@owned) {
            next if $other==$r;
            $fail->() if !$other->{closed}&&defined($other->{fd})&&$other->{fd}==$r->{fd};
          }
          $r->{identity}=[CORE::stat($r->{fh})];$fail->() unless @{$r->{identity}}==13;
          $r->{metadataReady}=1;
          $roles{$r->{role}}=$r;
          $event->(op=>'acquire',role=>$r->{role},fd=>$r->{fd});
        }
      };
      my $dispose=sub {
        my ($r,$owner)=@_;return 0 if $r->{attempted};
        $r->{attempted}=1;$r->{closer}=$owner;
        # Raw successful CORE acquisitions are private originals before metadata.
        # Never make their cleanup depend on admission or fallible inspection.
        if($r->{metadataReady}) {
          my @s=CORE::stat($r->{fh});
          unless(defined(fileno($r->{fh}))&&fileno($r->{fh})==$r->{fd}&&@s==13) {
            $latch->();return 0;
          }
          for my $i(0..6) {if($s[$i]!=$r->{identity}[$i]) {$latch->();return 0;}}
        } else {
          unless(!$r->{exposed}&&defined($r->{fh})&&ref($r->{fh})&&defined(fileno($r->{fh}))) {
            $latch->();return 0;
          }
        }
        $event->(op=>'close-attempt',role=>$r->{role},owner=>$owner);
        $!=0;my $ok=eval {$r->{directory}?CORE::closedir($r->{fh}):CORE::close($r->{fh})};
        my $error=$@;my $errno=0+$!;
        $r->{closed}=1 if $ok&&!length($error)&&!defined(fileno($r->{fh}));
        $event->(op=>'close-result',role=>$r->{role},owner=>$owner,result=>$ok?1:0,
          definite=>$r->{closed},errno=>$errno);
        $latch->() unless $r->{closed};return $ok;
      };
      my $deny=sub {$event->(op=>'denied',role=>'external');$fail->();};
      {
        no warnings qw(redefine once);
        local *CORE::GLOBAL::pipe=sub (**) {
          $check->();$fail->() unless @_==2&&@pipe_roles&&!defined($_[0])&&!defined($_[1]);
          my $names=shift @pipe_roles;
          CORE::pipe(my $a,my $b) or $fail->();
          $register->({fh=>$a,role=>$names->[0],attempted=>0,closed=>0},
            {fh=>$b,role=>$names->[1],attempted=>0,closed=>0});
          $_[0]=$a;$_[1]=$b;$roles{$names->[0]}{exposed}=1;$roles{$names->[1]}{exposed}=1;
          ++$calls{pipe};
          if($names->[0] eq 'out-r') {
            my $row="-r--r--r-- 1 root wheel 16 Jan 1 2026 /stage/entry.mjs\n";
            $row="invalid ACL row\n" if $mode eq 'malformed';
            $row.=" 0: user:ordinary allow read\n" if $mode eq 'extra-row';
            $!=0;my $n=CORE::syswrite($_[1],$row,length($row));
            $fail->() unless defined($n)&&$n==length($row)&&!$!;
            $event->(op=>'fixture-preload',role=>'out-w',length=>$n);
          }
          if($mode eq 'partial-pipe'&&$calls{pipe}==2) {$fail->();}
          if($mode eq 'overflow'&&$calls{pipe}==3) {
            for(1..8193) {$event->(op=>'overflow',role=>'fixture');}$check->();
          }
          return 1;
        };
        local *CORE::GLOBAL::binmode=sub (*;$) {
          $check->();$fail->() unless @_==1;my $r=$identify->($_[0]);
          $fail->() if $r->{binary}++;++$calls{binmode};
          my $ok=CORE::binmode($_[0]);$fail->() unless $ok;
          $event->(op=>'binmode',role=>$r->{role});return $ok;
        };
        local *CORE::GLOBAL::fcntl=sub (*$$) {
          $check->();$fail->() unless @_==3;my $r=$identify->($_[0]);
          $fail->() unless $r->{role} eq 'setup-w'&&!$calls{fcntl}++
            &&$_[1]==Fcntl::F_SETFD()&&$_[2]==Fcntl::FD_CLOEXEC();
          $!=0;my $v=CORE::fcntl($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&!$!;
          $event->(op=>'fcntl',role=>$r->{role});return $v;
        };
        local *CORE::GLOBAL::opendir=sub (*$) {
          $check->();$fail->() unless @_==2&&!defined($_[0])&&!ref($_[1])&&$_[1] eq '/dev/fd'
            &&!defined($census)&&@owned==8;
          # Read-only opening of the fixed system directory acquires only this
          # directory handle. readdir output below is synthetic, not OS census.
          CORE::opendir(my $directory,'/dev/fd') or $fail->();
          $census={fh=>$directory,role=>'census',directory=>1,attempted=>0,closed=>0};
          $register->($census);$_[0]=$directory;$census->{exposed}=1;++$calls{opendir};return 1;
        };
        local *CORE::GLOBAL::readdir=sub (*) {
          $check->();$fail->() unless @_==1&&!wantarray;
          my $r=$identify->($_[0]);$fail->() unless $r==$census;
          unless($census_built) {
            my %seen;
            for my $original(@owned) {
              $identify->($original->{fh});$fail->() if $seen{$original->{fd}}++;
            }
            @census=('.', '..','0','1','2',map {"$_->{fd}"} @owned);
            $census[6]=$census[5] if $mode eq 'census-duplicate';
            $census[5]='03' if $mode eq 'census-noncanonical';
            $census_built=1;
          }
          my $ordinal=++$calls{readdir};$event->(op=>'readdir',role=>'census',ordinal=>$ordinal);
          if($mode eq 'census-eio'&&$ordinal==6) {$!=Errno::EIO();return undef;}
          $!=0;return shift @census;
        };
        local *CORE::GLOBAL::closedir=sub (*) {
          $fail->() unless @_==1;my $r=$identify->($_[0]);$fail->() unless $r==$census;
          ++$calls{closedir};return $dispose->($r,0);
        };
        local *CORE::GLOBAL::fork=sub () {
          $check->();$fail->() unless @_==0&&!$calls{fork}++&&defined($census)&&$census->{closed};
          $event->(op=>'fork',role=>'synthetic',pid=>424242);return 424242;
        };
        local *CORE::GLOBAL::waitpid=sub ($$) {
          $check->();$fail->() unless @_==2&&$_[0]==424242&&$_[1]==POSIX::WNOHANG()&&@wait;
          my $v=shift @wait;++$calls{wait};
          $event->(op=>'wait',role=>'synthetic',pid=>424242,result=>$v->[0],raw=>$v->[1]);
          $?=$v->[1];return $v->[0];
        };
        local *CORE::GLOBAL::close=sub (;*) {
          $fail->() unless @_==1;my $r=$identify->($_[0]);
          $fail->() if $r->{directory};++$calls{close};return $dispose->($r,0);
        };
        local *CORE::GLOBAL::sysread=sub (*\$$;$) {
          $check->();$fail->() unless @_==3&&ref($_[1]) eq 'SCALAR'&&$_[2]==65536;
          my $buffer_ref=$_[1];$fail->() unless !ref($$buffer_ref)&&$$buffer_ref eq '';
          my $r=$identify->($_[0]);my $queue=$read{$r->{role}};
          $fail->() unless ref($queue) eq 'ARRAY'&&@$queue;
          my $nomination=shift @$queue;
          $fail->() unless $roles{$r->{role}=~s/-r\z/-w/r}{closed};
          $!=0;my $n=CORE::sysread($_[0],$$buffer_ref,$_[2]);
          $fail->() unless defined($n)&&!$!&&!utf8::is_utf8($$buffer_ref)&&$n==length($$buffer_ref);
          $fail->() unless $nomination?$n>0:$n==0;
          ++$calls{read};$event->(op=>'read',role=>$r->{role},count=>$n,request=>65536);
          return $n;
        };
        local *IO::Select::can_read=sub {
          $check->();$fail->() unless @_==2&&ref($_[0]) eq 'IO::Select'&&$_[1]==0.01&&@ready;
          $selector=$_[0] unless defined($selector);$fail->() unless $_[0]==$selector;
          my $want=shift @ready;my @members=$_[0]->handles;my %members;
          $fail->() unless @members==@$want&&$_[0]->count==@$want;
          for my $fh(@members) {my $r=$identify->($fh);$fail->() if $members{$r->{role}}++;}
          my @answer;
          for my $role(@$want) {$fail->() unless $members{$role};push @answer,$roles{$role}{fh};}
          ++$calls{ready};$event->(op=>'ready',role=>'selector',count=>scalar(@answer));return @answer;
        };
        local *Time::HiRes::clock_gettime=sub (;$) {
          $check->();$fail->() unless @_==1&&$_[0]==Time::HiRes::CLOCK_MONOTONIC()&&@clock;
          ++$calls{clock};my $v=shift @clock;
          my $flags=B::svref_2object(\$v)->FLAGS;
          $fail->() unless $flags&(B::SVf_IOK()|B::SVf_NOK())&&!($flags&B::SVf_POK());
          $event->(op=>'clock',role=>'monotonic');return $v;
        };
        local *CORE::GLOBAL::exec=sub {$event->(op=>'denied-exec',role=>'external');$fail->();};
        local *CORE::GLOBAL::system=$deny;
        local *CORE::GLOBAL::readpipe=sub (_) {$deny->();};
        local *CORE::GLOBAL::kill=sub (@) {$deny->();};
        local *CORE::GLOBAL::open=sub (*;$@) {$deny->();};
        local *CORE::GLOBAL::sysopen=sub (*$$;$) {$deny->();};
        local *CORE::GLOBAL::syswrite=sub (*$;$$) {$deny->();};
        local *CORE::GLOBAL::chdir=sub (;$) {$deny->();};
        local *CORE::GLOBAL::unlink=sub (@) {$deny->();};
        local *CORE::GLOBAL::mkdir=sub (_;$) {$deny->();};
        local *CORE::GLOBAL::rmdir=sub (_) {$deny->();};
        local *CORE::GLOBAL::rename=sub ($$) {$deny->();};
        local *CORE::GLOBAL::stat=sub (;*) {$deny->();};
        local *CORE::GLOBAL::lstat=sub (;*) {$deny->();};
        local *CORE::GLOBAL::seek=sub (*$$) {$deny->();};
        local *CORE::GLOBAL::sysseek=sub (*$$) {$deny->();};
        local *CORE::GLOBAL::truncate=sub ($$) {$deny->();};
        local *CORE::GLOBAL::socket=sub (*$$$) {$deny->();};
        local *CORE::GLOBAL::socketpair=sub (**$$$) {$deny->();};
        local *CORE::GLOBAL::connect=sub (*$) {$deny->();};
        local *CORE::GLOBAL::accept=sub (**) {$deny->();};
        local *IO::Select::can_write=$deny;local *IO::Select::has_exception=$deny;
        local *Time::HiRes::sleep=$deny;local *POSIX::dup2=$deny;
        local *POSIX::close=$deny;local *POSIX::_exit=$deny;
        my %prototypes=(pipe=>'**',opendir=>'*$',readdir=>'*',closedir=>'*',
          fork=>'',waitpid=>'$$',sysread=>'*\\$$;$',binmode=>'*;$',fcntl=>'*$$',close=>';*');
        for my $op(sort keys %prototypes) {
          my $expected=$prototypes{$op};
          my $installed='CORE::GLOBAL'->can($op);$fail->() unless defined($installed)&&ref($installed) eq 'CODE';
          my $core=prototype('CORE::'.$op);my $hook=prototype($installed);
          $fail->() unless defined($core)&&defined($hook)&&$core eq $expected&&$hook eq $expected;
        }
        for my $op('exec','system') {
          my $installed='CORE::GLOBAL'->can($op);
          $fail->() unless defined($installed)&&ref($installed) eq 'CODE';
          $fail->() if defined(prototype($installed));
        }
        my $source=MIME::Base64::decode_base64($ARGV[0]);
        my $ok=eval {$loaded=eval($source."\n1;\n");$setup_error=$@;
          $check->();$fail->() unless $loaded&&!length($setup_error);$load_complete=1;
          my $capture=\&task6a_origin_capture;my $fds=\&task6a_origin_fds;
          local *main::task6a_origin_fds=sub {
            $check->();$fail->() unless @_==0;
            $enumerated=$fds->();return $enumerated;
          };
          local *main::task6a_origin_capture=sub {
            $check->();$fail->() unless @_==4&&$_[0] eq '/bin/ls'&&ref($_[1]) eq 'ARRAY'
              &&@{$_[1]}==2&&$_[1][0] eq '-lde'&&$_[1][1] eq '/stage/entry.mjs'
              &&$_[2]==2&&$_[3]==4096;
            ++$calls{capture};$event->(op=>'capture',role=>'acl');
            $captured=$capture->(@_);return $captured;
          };
          my $diagnostic=eval {task6a_origin_acl_free('/stage/entry.mjs')};my $primary=$@;
          if($mode eq 'forbidden') {eval {CORE::GLOBAL::system('/bin/false')};}
          if($mode eq 'forbidden-exec') {eval {CORE::GLOBAL::exec('/bin/false','/bin/false')};}
          if($mode eq 'caught-fault') {eval {$fail->()};}
          $check->();
          my $refused=!defined($diagnostic)&&$primary eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
          $fail->() unless (!length($primary)&&ref($diagnostic) eq 'HASH')||$refused;
          $out={accepted=>defined($diagnostic)?JSON::PP::true:JSON::PP::false,
            refused=>$refused?JSON::PP::true:JSON::PP::false,diagnostic=>$diagnostic,
            captured=>$captured,enumerated=>$enumerated,
            helpersSettled=>task6a_origin_helpers_settled()};$check->();
          1;
        };my $primary=$@;
        # Independent fixture finalizer: never mutable producer ledgers/receipts.
        # Already-attempted uncertain originals are not retried.
        for my $r(@owned) {
          next if $r->{attempted};
          my $closed=eval {$dispose->($r,1)};my $error=$@;
          $latch->() unless $closed&&!length($error)&&$r->{closed};
          ++$calls{fixtureClose};
        }
        my $definite=grep {$_->{closed}&&!defined(fileno($_->{fh}))} @owned;
        $latch->() unless $definite==@owned;
        unless($load_complete) {die length($setup_error)?$setup_error:"$fault\n";}
        if(length($fault)) {
          die "$fault\n" unless $self&&$primary eq "$fault\n";
          $out={accepted=>JSON::PP::false,refused=>JSON::PP::false,diagnostic=>undef,
            harnessFault=>$fault};
        } else {
          die $primary unless $ok;
          $check->();$fail->() if @clock;
          unless($mode=~/\Acensus-/) {$fail->() if @wait||@ready;}
          $out->{harnessFault}=undef;
        }
        $out->{calls}=\%calls;$out->{events}=\@events;
        $out->{ownedCount}=scalar(@owned);$out->{definitelyClosed}=$definite;
        $out->{consumerClosed}=scalar(grep {$_->{closed}&&$_->{closer}==0} @owned);
        $out->{fixtureClosed}=scalar(grep {$_->{closed}&&$_->{closer}==1} @owned);
        $out->{syntheticCensus}=JSON::PP::true;
        $out->{productionAuthority}=JSON::PP::false;
        my $metadata=JSON::PP->new->canonical->utf8->encode({map {$_=>$out->{$_}} grep {$_ ne 'events'} keys %$out});
        die "TEST_STAGED_CAPTOR_HARNESS_FAULT\n" if length($metadata)>16384;
        my $json=JSON::PP->new->canonical->utf8->encode($out);
        die "TEST_STAGED_CAPTOR_HARNESS_FAULT\n" if length($json)>8388608;
        print $json;exit 0;
      }
    }
```

- [x] **Step 4: Wire the closed branch and literal matrix.** In systemObject, immediately after existing sole-main removal, add the exact closed-kind mapping `if(kind==='staged-captor-ports') source=replaceOnce(source,'exec {$tool} $tool,@$args;','CORE::GLOBAL::exec($tool,$tool,@$args);');`. Then insert `${STAGED_CAPTOR_PORT_PROGRAM}` immediately before `${PARENT_PORT_PROGRAM}`. Change only that function's spawn `maxBuffer:65536` to `maxBuffer:kind==='staged-captor-ports'?8388608:65536`. Keep exact source removal, scrubbed env, fixed Apple Perl, ordinary-host refusal, cwd and timeout. Tests below live in the existing ordinary-host else block; Step1 initially adds only helper/first test.

```javascript
function stagedCaptorPorts(mode='healthy') {
  assert.equal(typeof STAGED_CAPTOR_PORT_PROGRAM,'string','staged captor adapter missing');
  const r=systemObject('staged-captor-ports',{mode},'');
  assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);assert.equal(out.productionAuthority,false);
  assert.equal(out.syntheticCensus,true);return out;
}
test('staged captor foundation retains actual ACL capture and original closure',()=>{
  const out=stagedCaptorPorts();
  assert.equal(out.harnessFault,null);assert.equal(out.accepted,true);assert.equal(out.refused,false);
  assert.deepEqual(out.diagnostic,{scope:'acl-sample-diagnostic-only',productionAuthority:false});
  assert.deepEqual(out.captured,{out:'-r--r--r-- 1 root wheel 16 Jan 1 2026 /stage/entry.mjs\n',
    err:'',status:0,pid:424242,reaped:true});
  assert.equal(out.helpersSettled,true);
  assert.equal(out.ownedCount,9);assert.equal(out.definitelyClosed,9);
  assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
  assert.deepEqual(out.calls,{capture:1,pipe:4,binmode:8,fcntl:1,opendir:1,
    readdir:15,closedir:1,clock:7,fork:1,close:8,ready:2,read:4,wait:4});
  const waits=out.events.filter(e=>e.op==='wait');
  assert.deepEqual(waits.map(e=>[e.pid,e.result,e.raw]),[[424242,0,0],[424242,0,0],
    [424242,0,0],[424242,424242,0]]);
  const acquired=out.events.filter(e=>e.op==='acquire');
  assert.deepEqual(acquired.map(e=>e.role),['in-r','in-w','out-r','out-w','err-r','err-w','setup-r','setup-w','census']);
  const own=acquired.find(e=>e.role==='census').fd;
  assert.equal(out.enumerated.includes(own),false);
  const pipes=acquired.filter(e=>e.role!=='census').map(e=>e.fd);
  assert.deepEqual(out.enumerated,[0,1,2,...pipes].sort((a,b)=>a-b));
  assert.deepEqual(out.events.filter(e=>e.op==='read').map(e=>[e.role,e.count,e.request]),
    [['out-r',55,65536],['err-r',0,65536],['setup-r',0,65536],['out-r',0,65536]]);
  assert.deepEqual(out.events.filter(e=>e.op==='close-attempt').map(e=>[e.role,e.owner]),
    [['census',0],['in-r',0],['in-w',0],['out-w',0],['err-w',0],['setup-w',0],
      ['err-r',0],['setup-r',0],['out-r',0]]);
});
for(const mode of ['malformed','extra-row','raw256']) {
  test('staged captor foundation refuses '+mode+' through actual consumer',()=>{
    const out=stagedCaptorPorts(mode);
    assert.equal(out.harnessFault,null);assert.equal(out.accepted,false);assert.equal(out.refused,true);
    assert.equal(out.diagnostic,null);assert.equal(out.helpersSettled,true);
    assert.equal(out.ownedCount,9);assert.equal(out.definitelyClosed,9);
    assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
    assert.equal(out.calls.clock,mode==='raw256'?6:7);assert.equal(out.calls.wait,4);
    assert.equal(out.calls.close,8);assert.equal(out.calls.closedir,1);
    if(mode==='raw256') {
      assert.equal(out.captured,null);
      const last=out.events.filter(e=>e.op==='wait').at(-1);
      assert.deepEqual([last.pid,last.result,last.raw],[424242,424242,256]);
    } else {assert.equal(out.captured.reaped,true);assert.equal(out.captured.status,0);}
  });
}
for(const [mode,count] of [['census-duplicate',7],['census-noncanonical',6],['census-eio',6]]) {
  test('staged captor foundation refuses '+mode+' before synthetic fork',()=>{
    const out=stagedCaptorPorts(mode);
    assert.equal(out.harnessFault,null);assert.equal(out.accepted,false);assert.equal(out.refused,true);
    assert.equal(out.captured,null);assert.equal(out.enumerated,null);assert.equal(out.helpersSettled,false);
    assert.equal(out.calls.readdir,count);assert.equal(out.calls.clock,3);
    assert.equal(out.calls.fork,undefined);assert.equal(out.calls.wait,undefined);
    assert.equal(out.calls.read,undefined);assert.equal(out.calls.ready,undefined);
    assert.equal(out.ownedCount,9);assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
    assert.equal(out.definitelyClosed,9);
  });
}
for(const [mode,owned,consumer,fixture] of [['inspection-fault',2,0,2],['partial-pipe',4,2,2],['overflow',6,4,2],
    ['forbidden',9,9,0],['forbidden-exec',9,9,0],['caught-fault',9,9,0]]) {
  test('staged captor foundation classifies '+mode+' as harness fault with original containment',()=>{
    const out=stagedCaptorPorts(mode);
    assert.equal(out.harnessFault,'TEST_STAGED_CAPTOR_HARNESS_FAULT');
    assert.equal(out.accepted,false);assert.equal(out.refused,false);assert.equal(out.diagnostic,null);
    assert.equal(out.ownedCount,owned);assert.equal(out.definitelyClosed,owned);
    assert.equal(out.consumerClosed,consumer);assert.equal(out.fixtureClosed,fixture);
    if(mode==='overflow') {assert.equal(out.events.length,8192);}
    if(mode==='forbidden') {assert.equal(out.events.filter(e=>e.op==='denied').length,1);}
    if(mode==='forbidden-exec') {assert.equal(out.events.filter(e=>e.op==='denied-exec').length,1);}
  });
}

```

- [x] **Step 5: Exact candidate review before GREEN/negative execution.** Two independent reviewers inspect native/installed prototypes, caller aliases, real buffer/count agreement, immediate pair/DIR ownership, finite queues, zero-but-true fcntl return, deny-before-effect delegates, raw wait status, synthetic census, preserved actual source/helper decisions, budgets and original containment. Producer/finalizer credit stays separate. Syntax/anchor/prototype/queue/alias/sticky fault is harness failure, not semantic RED. Source SHA remains unchanged. Resolve load-bearing findings before execution. Declaration load-complete is set only after successful eval/sticky checks; incomplete load is fatal before self-mode classification, preserving setup error without contained-success JSON. Direct denied-exec self-witness must latch the fixed harness fault with no delegation.
- [x] **Step 6: Run the reviewed 13-test foundation, read complete output and observe natural terminal.** Record actual pass/fail/filter counts; name filtering does not qualify unsupported hosts. Healthy and real source refusals have zero fixture-finalizer credit. Inspection/partial/overflow faults independently close exactly two originals through the finalizer. No real child-helper/native uncertain-close qualification.

```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged captor foundation ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

- [x] **Step 7: Record this foundation's exact boundary.** Save the observed missing-adapter RED, H1 actual-composition results and all13 outcomes with source/test hashes, full output and natural terminals. Record inspection-fault as two raw unexposed acquisitions with consumer0/fixture2 closure; partial-pipe as4/2/2; overflow as6/4/2. Do not implement or execute staged-owner/shared-holder/throwing-close/mutation recipes in this task. Those require separately literal reviewed subplans before their effects; this foundation alone is not full staged/native admission.
- [x] **Step 8: Adjacent verification and scoped delivery.** Complete fresh bootstrap suite on exact final source/test, diff/English/path gates, independent whole-branch review, scoped conventional commit, normal push/PR/current-head feedback/SHA-bound merge and separately admitted own clean-main normal guarded build. No new ALL or staged owner implementation. Record proof in the two existing external ledgers and preserve all roots.

**Preflight consistency:** P2a consumes unchanged source04393 and leaves main refused. This task changes only test ports/docs and cannot initialize the proposed staged owner. A later staged task consumes this bridge only after complete admission; future H42 math cannot substitute for H1. Fixture closes in inspection/partial/overflow are never credited to consumer cleanup. Staged ownership, shared throwing-cleanup regression/fix, native/protected origin/compiler/DB fence/loaded service/A–E remain separately gated.

Ordinary foundation execution ledger, 2026-10-03:

- Two exact candidate RED reviews C0/I0/M0; a657c7 naturally CLOSED1,
  1FAIL/0SKIP/65.381833ms, exact missing-adapter assertion before any fixture.
  This is adapter RED, not a production security failure. All output read.
- Initial c18721 naturally CLOSED1, 12FAIL/0SKIP/436.411417ms: one shared
  setup/compile cascade from overriding Perl's native exec-block syntax.
  No semantic refusal or containment credit. Before another execution, the
  uniquely anchored closed-kind denied-port mapping and fatal incomplete-load
  guard were documented, implemented and independently reviewed C0/I0/M0.
- Exact testc51fc0a23da60166cbad51cab4e24ababafee018597a639f54f85880d5b8ffa3,
  unchanged bootstrap04393; focused117816 naturally CLOSED0,13PASS/0FAIL/0SKIP/
  551.532833ms. Full output read. Actual H1, source refusals and all fixture
  self-cases passed, with consumer versus finalizer closure kept distinct.
- Two exact unfiltered-recipe reviews C0/I0/M0; ONE full bootstrap752f69/485b97,
  managed83894 naturally CLOSED0,1131PASS/0FAIL/0SKIP/76220.743583ms. All1141
  output lines read. Existing ordinary owned-child/synthetic-observer effects
  remained their previously admitted case-specific scope; this was not an
  effect-free suite or native/protected probe. Post-run source/test/spec/plan
  pins unchanged. English1931/path966 checks passed. No new ALL.
- Steps1–8 qualify after two whole-branch reviews C0/I0/M0 and PR268/head99a961fc
  normal SHA-bound merge d4049110769061889ac7c5327151f18d5766ed54/treee52e8de.
  Current-head Codex completed/no major findings; GitGuardian success/zero
  annotations; paginated reviews/inline/threads empty. No formal approval or
  Copilot/Gemini result inferred. ONE separate own clean-main normal build
  naturally CLOSED0, actual npm EXIT+CLOSE0/null/spawnErrorfalse and5661 held
  original inputs revalidated; full output read. Independent postbuild C0/I0/M0
  all2093 source, locked dependencies/tools, three terminal authorities and
  all858 outputs/input-output commitments/preservation match. No new ALL.
  No staged owner, throwing/shared-cleanup repair, native origin, compiler/DB
  fence/loaded-service/cutover/A–E result is inferred.


### Task 2b.2: Ordinary captor throwing-cleanup root regression

**Causal refinement:** Delivered foundation P2b.1 exposes a source gap: an
exception in capture's final descriptor close loop escapes before helper
shutdown/accounting and shared physical-failure routing. ACL normalizes the
exception to refusal, hiding missed original cleanup. This blocks trustworthy
staged custody, so the smallest root fix is within the same cutover objective.
The direct fds closedir exception is different: capture already catches it;
do not include a direct-enumerator normalization change in this repair.

**File Map:** Exactly existing bootstrap/test/this plan/named spec. Base delivered
main d4049110769061889ac7c5327151f18d5766ed54/treee52e8de. Root is sole writer in
the new independent cleanup branch; every old root/cache/build stays preserved.
No source entry, publisher, native module, package/lock, main-opening, staged
initializer, SQL/fence/service or generated-artifact edit.

**Decision:** Catch each final fileno/close evaluation independently, preserve a
false/throw as close failure, continue remaining originals and the unchanged
shutdown/accounting/refusal chain. Never reinterpret a throwing close as definite
closure. Actual helper settlement must not publish; permanent burn must happen.
This is a closure-continuation repair, not a changed PID/deadline/signal policy.

The new closed mode physically closes in-r then returns false at body cleanup.
At final cleanup it physically closes in-w then throws exactly
TEST_STAGED_CAPTOR_NOMINATED_CLOSE_THROW. Both nominations happen only AFTER the
independent fixture dispose proves definite CORE closure. They are producer
failure stimuli, not sticky harness faults. Any actual fixture fault remains
fatal and cannot be credited as source refusal.

Own four CORE pipe pairs and one read-only CORE opendir remain unchanged.
Complete synthetic census15, numeric-zero clocks4, synthetic fork424242, exactly
one available wait424242/raw0, no readiness/sysread samples, no real process,
signal, sleep, path creation/deletion, native, SQL or external tool delegation.
Out-w preload55B remains admitted but unread; ordinary fixture finalization
closes remaining originals independently. No host FD census qualification.

Historical pre-execution design predictions (not execution evidence):
consumer pipe2 + census1 = consumerClosed3,
fixtureClosed6, pendingOriginals6, wait0/pendingWait1, private helper burnedfalse,
registered1/settled0/unsettled1, helpersSettledfalse; inner nominated exception.
Expected repair: consumer pipe8+census1=9, fixture0, pendingOriginals0, wait1/
pendingWait0, burnedtrue with the same un-settled record and helpersSettledfalse;
inner fixed TASK6A_ORIGIN_BOOTSTRAP_REFUSED. Four clocks in either case. Event
close order is census,in-r,in-w,out-r,out-w,err-r,err-w,setup-r,setup-w on repair.
A genuine assertion RED qualifies only after actual old-source execution and
full terminal/output review. A remaining diagnostic wait sample is allowed only in this exact mode before
the JS RED assertion, so an old-source missed cleanup is not hidden by queue
fault. The repaired test still asserts zero remaining waits. All read/ready
queues are empty; unexpected samples/sticky faults/compile errors remain fatal.

Only this mode inserts a zero-argument, uniquely anchored MEMORY-COPY private
helper observer. It reports bounded counts/JSON booleans, never record/FH/PID
references or setters. Observe twice before finalizer and require equality.
Actual ACL/capture/fds/poll/helper decisions stay active. The capture observer
records and rethrows the original inner exception transparently; other modes
retain their original observer path. Existing denied-exec mapping remains
documented and is not execution-equivalence proof.

- [x] **Step 1: Review and commit this mapped causal design before effects.**
  Two exact read-only reviews of literal test/source deltas and the ordinary
  invocation below. At this design checkpoint, no source/test implementation,
  child or new native effect had occurred.
- [x] **Step 2: Apply ONLY the literal test delta, keep bootstrap04393 unchanged.**
  Review exact actual candidate before ONE focused old-source invocation. Require
  ordinary darwin real/effective UID501, fixed Node26.4 SHA59cd4f, fixed Apple Perl,
  unchanged source and fully read natural terminal. Expect actual JS assertion
  consumerClosed3 versus9, not setup/compile/queue/harness failure.
- [x] **Step 3: After causal RED, apply ONLY the literal production delta.**
  Independently review exact source/test before ONE same focused invocation.
  Require all repaired original closure, wait, burn and refusal witnesses.
- [x] **Step 4: Adjacent verification and delivery.** Fresh complete bootstrap
  suite on exact source/test, cheap diff/English/path checks, independent whole
  branch review, scoped conventional commits, normal push/PR/current-head
  cloud/security/paginated feedback/SHA-bound merge, separately admitted own
  clean-main normal guarded build, independent artifact/preservation/HTTP
  evidence. No new ALL/staged/native/SQL/service qualification. Save exact
  RED/GREEN hashes/terminal/fulloutput in the two existing external ledgers.

ONE focused command (root owns launch/poll/natural closure/full output):
```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged captor cleanup throw closes remaining originals and burns helper$' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Historical pre-execution candidate deltas, preserved as the reviewed design
snapshot. Their subsequent application and execution are recorded below;
test-only application preceded actual causal RED and then the source delta.

```diff
*** Begin Patch
*** Update File: scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
@@
-      my %modes=map {$_=>1} qw(healthy malformed extra-row raw256 census-duplicate census-noncanonical census-eio partial-pipe inspection-fault forbidden forbidden-exec caught-fault overflow);
+      my %modes=map {$_=>1} qw(healthy malformed extra-row raw256 census-duplicate census-noncanonical census-eio partial-pipe inspection-fault forbidden forbidden-exec caught-fault overflow cleanup-close-throw);
@@
       my $self=$mode=~/\A(?:partial-pipe|inspection-fault|forbidden|forbidden-exec|caught-fault|overflow)\z/;
+      my $cleanup_throw=$mode eq 'cleanup-close-throw';
@@
       my @clock=(0)x($mode eq 'raw256'?6:$mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow'?3:7);
+      @clock=(0)x4 if $cleanup_throw;
@@
       @wait=() if $mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow';
+      @wait=([424242,0]) if $cleanup_throw;
@@
       @ready=() if $mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow';
+      @ready=() if $cleanup_throw;
@@
       my %read=( 'out-r'=>[1,0], 'err-r'=>[0], 'setup-r'=>[0] );
+      $read{$_}=[] for grep {$cleanup_throw} keys %read;
@@
       my ($captured,$enumerated);my $load_complete=0;my $setup_error='';
+      my $capture_error='';
@@
         local *CORE::GLOBAL::close=sub (;*) {
           $fail->() unless @_==1;my $r=$identify->($_[0]);
-          $fail->() if $r->{directory};++$calls{close};return $dispose->($r,0);
+          $fail->() if $r->{directory};++$calls{close};my $closed=$dispose->($r,0);
+          if($cleanup_throw&&($r->{role} eq 'in-r'||$r->{role} eq 'in-w')) {
+            $check->();$fail->() unless $closed&&$r->{closed};
+            $event->(op=>$r->{role} eq 'in-r'?'nominated-false':'nominated-throw',role=>$r->{role});
+            return 0 if $r->{role} eq 'in-r';
+            die "TEST_STAGED_CAPTOR_NOMINATED_CLOSE_THROW\n";
+          }
+          return $closed;
@@
             ++$calls{capture};$event->(op=>'capture',role=>'acl');
-            $captured=$capture->(@_);return $captured;
+            if($cleanup_throw) {
+              my $value=eval {$capture->(@_)};my $error=$@;$capture_error=$error;
+              die $error if length($error);$captured=$value;return $captured;
+            }
+            $captured=$capture->(@_);return $captured;
@@
             captured=>$captured,enumerated=>$enumerated,
             helpersSettled=>task6a_origin_helpers_settled()};$check->();
+          if($cleanup_throw) {
+            $out->{helpersObservation}=test_observe_helpers();$check->();
+            $out->{helpersObservationRepeat}=test_observe_helpers();$check->();
+            $out->{captureError}=$capture_error;
+            $out->{remainingWaits}=scalar(@wait);
+            $out->{originalsPendingBeforeFinalizer}=scalar(grep {!$_->{attempted}&&!$_->{directory}} @owned);
+          }
@@
-          unless($mode=~/\Acensus-/) {$fail->() if @wait||@ready;}
+          unless($mode=~/\Acensus-/||$cleanup_throw) {$fail->() if @wait||@ready;}
+          if($cleanup_throw) {$fail->() if @ready||@wait>1||grep {@$_} values %read;}
@@
   if(kind==='staged-captor-ports') {
@@
     source=replaceOnce(source,'exec {$tool} $tool,@$args;','CORE::GLOBAL::exec($tool,$tool,@$args);');
+    if(record.mode==='cleanup-close-throw') {
+      source=replaceOnce(source,'sub task6a_origin_helpers_settled {',[
+        'sub test_observe_helpers {',
+        '    task6a_origin_refuse() unless @_==0;',
+        '    my $settled=scalar(grep {$_->{settled}} @helper_ledger);',
+        '    return {burned=>$helper_lifecycle_burned?JSON::PP::true:JSON::PP::false,',
+        '        registered=>scalar(@helper_ledger),settled=>$settled,',
+        '        unsettled=>scalar(@helper_ledger)-$settled};',
+        '}',
+        'sub task6a_origin_helpers_settled {',
+      ].join('\n'));
+    }
@@
 function stagedCaptorPorts(mode='healthy') {
@@
   assert.equal(out.syntheticCensus,true);return out;
 }
+test('staged captor cleanup throw closes remaining originals and burns helper',()=>{
+  const out=stagedCaptorPorts('cleanup-close-throw');
+  assert.equal(out.harnessFault,null);assert.equal(out.accepted,false);assert.equal(out.refused,true);
+  assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
+  assert.equal(out.ownedCount,9);assert.equal(out.definitelyClosed,9);
+  assert.equal(out.originalsPendingBeforeFinalizer,0);assert.equal(out.remainingWaits,0);
+  assert.equal(out.captureError,'TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n');
+  assert.equal(out.helpersSettled,false);
+  assert.deepEqual(out.helpersObservation,{burned:true,registered:1,settled:0,unsettled:1});
+  assert.deepEqual(out.helpersObservationRepeat,out.helpersObservation);
+  assert.deepEqual(out.calls,{capture:1,pipe:4,binmode:8,fcntl:1,opendir:1,
+    readdir:15,closedir:1,clock:4,fork:1,close:8,wait:1});
+  assert.deepEqual(out.events.filter(e=>e.op==='nominated-false'||e.op==='nominated-throw')
+    .map(e=>[e.op,e.role]),[['nominated-false','in-r'],['nominated-throw','in-w']]);
+  assert.deepEqual(out.events.filter(e=>e.op==='wait')
+    .map(e=>[e.pid,e.result,e.raw]),[[424242,424242,0]]);
+  assert.deepEqual(out.events.filter(e=>e.op==='close-attempt')
+    .map(e=>[e.role,e.owner]),[['census',0],['in-r',0],['in-w',0],['out-r',0],
+      ['out-w',0],['err-r',0],['err-w',0],['setup-r',0],['setup-w',0]]);
+});
 test('staged captor foundation retains actual ACL capture and original closure',()=>{
*** End Patch
```

After actual RED only:

```diff
*** Begin Patch
*** Update File: scripts/task6a-protected-origin-bootstrap-v2.pl
@@
     my $close_ok=1;
-    for my $fh(@handles) {if(defined(fileno($fh))) {$close_ok=0 unless close($fh);}}
+    for my $fh(@handles) {
+        my $closed=eval {!defined(fileno($fh))||close($fh)};
+        $close_ok=0 unless $closed&&!$@;
+    }
*** End Patch
```

Ordinary cleanup execution ledger, 2026-10-03:

- Two corrected design reviews C0/I0/M0; docs-only design commitc7b3939d before
  implementation. Two exact actual test8ec78703/source04393 reviews C0/I0/M0.
- Fresh b97fee/217fa9 ordinary darwin501/501, Node26.4 SHA59cd4f, actual fixed
  Apple Perl SHAabda2bfd and exact source/test/spec/plan pins; diffcheck0.
- ONE e65546 naturally CLOSED1,1FAIL/0PASS/0CANCEL/0SKIP/114.609875ms;
  complete output read. Genuine actual consumerClosed3 versus9 assertion RED,
  after acceptedfalse/refusedtrue/harnessFaultnull checks. No compile/setup/
  queue fault. Other unexposed old-source predicted fields are NOT credited.
- Only then apply the reviewed per-handle final eval source delta. Two exact
  repair source4aaececb/test8ec78703 reviews C0/I0/M0; fresh061108 pins MATCH,
  diff0. ONE e3d1e4 naturally CLOSED0,1PASS/0FAIL/0SKIP/102.803792ms, complete
  output read. All assertions executed: consumer9/fixture0/definite9/pending0,
  one exact synthetic reap, four clocks, permanent helper burn, registered1/
  settled0/unsettled1, repeated private observations equal, helpersSettledfalse,
  fixed inner refusal and exact nomination/close-order events. Ordinary repair
  focused GREEN only.
- ONE unfiltered bootstrap invocation8f58f6/managed8719 naturally CLOSED0
  (terminal566904):1132PASS/0FAIL/0CANCEL/0SKIP/0TODO/76352.48175ms.
  Complete95081B/1142-line output read through EOF. Source4aaececb,
  test8ec78703, spec24555153 and plan6cfaa51c remained frozen throughout;
  root post-run hashes MATCH. No repeat invocation or poll after closure.
  This includes ordinary owned-child cases, not an effect-free/native run.
- Whole-branch reviewers' historical-wording M1 is resolved by labeling the
  original predictions and candidate deltas as pre-execution snapshots.
  Only consumerClosed3 was exposed by actual old-source RED; no other old
  predicted field is promoted to observed evidence.
  PR/build and staged/shared-holder/native/loaded-service/cutover proof remain
  pending.

Superseding ordinary delivery checkpoint, 2026-10-03 21:23 UTC:

- Two final whole-branch reviews C0/I0/M0, cheap English1931/path966/diff0;
  scoped head3a60ea46333510125c02053073ff26ba75622723, tree8898e4bd.
- PR269 normal exact-head merge284f9a431e6da2059e943a8f2ead940aec9aa2f5
  at21:09:23Z, parentsd404911+3a60ea/tree8898e4bd, GitHubverifiedvalid.
  Codex actual no-major-issues comment5973490273/exacthead and completed
  summary5973462532; not formal APPROVED. Security111292829843SUCCESS,
  zero annotations; paginated reviews/inline/thread checks empty.
  Copilot request returned no assigned reviewer, Gemini gave no qualified
  review; neither is credited as approval.
- Separate own clean-main clone, one locked ci0/16packages2s with scripts
  disabled for dependency installation only; no tool upgrade.
  ONE normal guarded build2dd182/81c345/d2ffd7 naturally CLOSED0, actual
  npm EXIT+CLOSE0/null/no spawn error21:18:54.580Z. All5661 held source/
  dependency/npm/tool originals revalidated through terminal closure;
  outer original-descriptor finalizer0. Complete output read, no repeat.
- Build0271e2bf-305b-43eb-9b19-95a5353e6b5f, built21:18:32.440Z,
  display2.3.79+284f9a43. Root postsource/artifact reads and independent
  actual postbuild audit21:22–21:23 match2093 source files, all dependencies/
  npm,858 outputs/21,874,207B/47dirs/exact861 regular files including three
  immutable authorities, converter and empty standard retention ledgers.
  Input7dbf306c8d8224c5771db9a721b4e57c98af15068fb56a1b96e46dc0d66ff498;
  output0eebde7c3c71d8b28e24bb75a3cedb691243147b2a56577864be17cdc49b647e.
- Separate fresh preservation audit21:20:37–21:21:09 matches old SF/MC/P2a/
  PR268 builds, original two files/backups and final journal. HTTP3080/
  18789200;3333 still refused. Ordinary Task2b.2 only is delivered.
  Staged/shared/protected/native/loaded-service/final cutover remain OPEN.

The next isolated branch starts at delivered284f9a43 with source4aaececb/
test8ec78703 unchanged. Its first design refinement is the spec's ordinary
read-only seekable-file/directory port foundation. No new source/test effects
are admitted by that design alone; an exact literal executable subplan and
pre-effect review still precede every new test invocation.

### Task 2b.3: Ordinary read-only seekable-file/DIR port foundation

**Goal and causal relation:** The proposed six-leaf stage owner needs real
seekable-file/DIR ports, while the delivered captor fixture denies those
operations. First prove this lower bridge independently, without invoking or
implementing a production staged consumer. It is a test-support prerequisite,
not protected acquisition, authentic creator admission or H42 evidence.

**File Map:** Existing test, this plan and named spec only; bootstrap4aaececb,
entry/helpers/map/publisher/launcher/package/lock/native/runtime stay unchanged.
Base delivered284f9a431e6da2059e943a8f2ead940aec9aa2f5/tree8898e4bd.
Root sole writer and effect owner; all parallel agents read/review only.
Retain every prior root/cache/artifact and original two files.

**Interfaces:** Private test helper stagedFilePorts(mode='healthy') consumes
only the closed literal mode matrix below and existing map-helper/scripts-DIR
fixture locators derived from import.meta.url. The fixed ordinary Apple Perl
program reads that helper as DATA, never imports/evaluates it or bootstrap.
JSON is fixture-only, productionAuthorityfalse/consumerInvokedfalse/
consumerClosed0; no handle, FD, PID, path, byte/hash identity or private owner
record is returned. Node supplies a private independently computed fixture
digest, not an authentic source or publisher receipt.

**Effects:** One ordinary fixed Perl per selected test; actual read-only
CORE sysopen O_RDONLY|O_NOFOLLOW|O_NONBLOCK of existing map data, readonly
CORE opendir of its existing scripts directory, bounded CORE metadata/seek/
read/fcntl/binmode and once-only original close/closedir. No fixture creation,
write/delete/chmod/ACL modification, readdir census, helper fork/wait/signal,
external exec/system, source eval/import, native/SQL or service effect.
No synthetic root:wheel projection. Raw distinct acquisitions are registered
before inspection/trace; pre-acquisition alias nomination is fixture evidence
only, NOT the future consumer's unresolved raw-success/alias contract.

The following limits, effect-step descriptions and literal deltas preserve the
admitted PRE-EXECUTION design checkpoint. Their prediction/pending wording is
historical, not current status; the actual ordinary evidence below supersedes
it. The literal snapshots are retained for test-first provenance, not replays.

**Limits and predicted counts:** Current selected map-data leaf11684B.
Read requests65536, finite actual reads11684/0/11684 with two zero seeks.
Healthy selected port counts in the literal11-key order are
1,1,1,4,4,4,2,3,1,1,1; explicit CORE acquisition/registry-metadata/closure
counts1,1,2,1,1. This is not a count of every kernel syscall or incidental
CORE fileno identity check. Healthy25 trace events; cap96 events and512B
per event; source/helper/native clocks/captures/census are absent, not H42.
Literal failure counts are in the table below, not derived from actual output.
All counts/prototype compatibility remain predictions until actual execution.

File identity comparison excludes read-induced atime; use existing held-file
identity fields0,1,2,3,4,5,7,9,10 and directory fields0,1,2,4,5. Actual thirteen
stat fields are captured, not sparse fake tuples. A real fixture fault or
compile/prototype failure is fatal, not a mode's semantic success. A nominated
self-fault is credited only when its exact nomination/primary witness matches
and every acquired original is physically definitely closed. For close-false/
throw and post-close inspection throw, nomination occurs AFTER independent
CORE closure proof; it proves fault containment, never uncertain-native-close
leak freedom or producer custody. Fixture finalization ignores sticky faults/
queues, marks each attempt before effects and continues all originals.

- [x] **Step 1: Commit this exact mapped design before effects.**
  Two exact read-only reviews of both literal deltas, mode/count/trace matrix
  and commands. No source/test implementation or new Perl invocation yet.
- [x] **Step 2: Apply ONLY the first test delta below.**
  Fresh ordinary darwin501/501, fixed Node26.4 SHA59cd4f/ApplePerl SHAabda2bfd,
  source4aa unchanged, selected map file11684B and actual candidate review.
  ONE exact healthy command below must naturally fail with the genuine JS
  AssertionError `staged readonly file adapter missing` (undefined vs string).
  The first guard precedes fixture reading and Perl spawn. This is missing
  test-adapter RED only; no production/staged-consumer RED is claimed.
- [x] **Step 3: After actual fully read RED, apply ONLY the program delta.**
  Review actual adapter/test before ONE13-case focused command. Require the
  actual literal prototype/IO/registry/alias/closed-queue/trace/closure witnesses,
  zero unexpected harness/compile faults and complete natural exit/output.
  Correct unexpected setup failures without promoting them to semantic RED.
- [x] **Step 4: Verify and deliver this ordinary prerequisite.**
  Fresh unfiltered bootstrap group on exact source/test, cheap diff/English/
  path checks, independent whole branch review, scoped conventional commit,
  normal push/PR/exact-head cloud/security/paginated feedback and merge.
  Separately owned clean-main normal guarded build and independent artifacts/
  preservation/HTTP checks. No new ALL or staged/protected/native/SQL/service
  qualification. Record actual outcomes in the two existing external ledgers.

Actual ordinary evidence, 2026-10-03: mapped design commit53aae093 after two
exact corrected-literal reviews; first test-only candidate4ff39f27 produced
natural exit1 with the genuine missing-adapter assertion (undefined vs string)
before fixture reads/Perl spawn. Only then the reviewed adapter was applied.
Exact resulting test3df7bd08/source4aaececb passed13 focused cases (exit0,
220.773833ms). The separately invoked unfiltered adjacent group naturally
closed with1145PASS/0FAIL/0CANCEL/0SKIP/0TODO in76548.866667ms; complete output
was read and source/test/spec/plan pins rechecked unchanged. Two independent
whole-branch static reviews found C0/I0/M0. All new closure/IO credit remains
fixture-only; production main still refuses. Step4 was open at that checkpoint.

Step4 actual completion, 2026-10-03: PR270 delivered exact head a8a4275b after
two independent whole-branch reviews and exact-head Codex no-major-issues/
GitGuardian success evidence. Normal merge42c57386 has valid signature,
parents284f9a43/a8a4275b and tree69fa9f51. A separate own clean-main clone
fast-forwarded to that merge; one normal guarded build naturally exited and
closed0 at22:30:08.941Z, with all5661 held inputs revalidated and all original
closes successful. Build33bfa825-f18d-490d-840c-5050d72be83d produced858 outputs
and three immutable authority files. Two independent postaudits matched all
2093 sources, dependencies/npm, exact861-file/47-directory topology, authority
physical/content pins, converter and empty archive/ledger. Separate original
files/backups/journal/predecessor preservation and HTTP evidence matched.
These receipts complete only this ordinary prerequisite; no staged owner,
authentic creator, protected/native, SQL, service or final cutover is admitted.

ONE first-stage exact focused command:
```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged readonly file ports retain seekable data and definite original closure$' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

ONE repaired-foundation focused13-case command:
```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged readonly file ports ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

ONE adjacent command after reviewed focused success:
```bash
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

The following two literal deltas are PRE-EXECUTION reviewed candidates only.
Apply the test first; the program comes only after actual causal adapter RED.

```diff
*** Begin Patch
*** Update File: scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
@@
-function stagedCaptorPorts(mode='healthy') {
+function stagedFilePorts(mode='healthy') {
+  assert.equal(typeof STAGED_FILE_PORT_PROGRAM,'string','staged readonly file adapter missing');
+  const bytes=readFileSync(MAP);assert.equal(bytes.length,11684,'fixed ordinary map-data fixture changed');
+  const directory=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
+  const digest=createHash('sha256').update(bytes).digest('hex');
+  const r=spawnSync('/usr/bin/perl',['-f','-e',STAGED_FILE_PORT_PROGRAM,fileURLToPath(MAP),directory,digest,mode],{
+    cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:10000,maxBuffer:131072,
+  });
+  assert.equal(r.error,undefined);assert.equal(r.signal,null);
+  assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
+  const out=JSON.parse(r.stdout);assert.equal(out.scope,'ordinary-staged-file-ports-fixture-only');
+  assert.equal(out.productionAuthority,false);assert.equal(out.consumerInvoked,false);
+  assert.equal(out.consumerClosed,0);assert.equal(out.portsReady,true);return out;
+}
+const STAGED_FILE_CALL_KEYS=['sysopen','opendir','binmode','fcntl','stat','lstat','sysseek','sysread','fileno','close','closedir'];
+const STAGED_FILE_CORE_KEYS=['fileOpen','directoryOpen','metadata','fileClose','directoryClose'];
+test('staged readonly file ports retain seekable data and definite original closure',()=>{
+  const out=stagedFilePorts();
+  assert.equal(out.harnessFault,null);assert.equal(out.nominatedFault,null);
+  assert.equal(out.containedSelfFault,false);assert.equal(out.dataMatched,true);assert.equal(out.aliasWitness,false);
+  assert.equal(out.primaryError,'');assert.deepEqual(out.cleanupErrors,[]);
+  assert.deepEqual([out.firstLength,out.eofLength,out.secondLength],[11684,0,11684]);
+  assert.deepEqual(STAGED_FILE_CALL_KEYS.map(k=>out.calls[k]),[1,1,1,4,4,4,2,3,1,1,1]);
+  assert.deepEqual(STAGED_FILE_CORE_KEYS.map(k=>out.core[k]),[1,1,2,1,1]);
+  assert.deepEqual([out.ownedCount,out.definitelyClosed,out.fixtureClosed],[2,2,2]);
+  assert.deepEqual(out.closeOrder,['file','directory']);
+  assert.deepEqual(out.remaining,{fcntl:0,stat:0,lstat:0,seek:0,read:0});
+  assert.equal(out.events.length,25);
+  assert.deepEqual(out.events.filter(e=>e.op==='close-attempt').map(e=>e.role),['file','directory']);
+});
+for(const [mode,owned,core,calls,events,matched,alias,primary] of [
+  ['partial-acquisition',1,[1,0,1,1,0],[1,1,0,0,0,0,0,0,0,0,0],1,false,false,'fault'],
+  ['inspection-fault',1,[1,0,0,1,0],[1,0,0,0,0,0,0,0,0,0,0],1,false,false,'fault'],
+  ['alias',2,[1,1,2,1,1],[2,1,0,0,0,0,0,0,0,0,0],3,false,true,'fault'],
+  ['forbidden-path',2,[1,1,2,1,1],[2,1,0,0,0,0,0,0,0,0,0],3,false,false,'fault'],
+  ['forbidden-flags',2,[1,1,2,1,1],[2,1,0,0,0,0,0,0,0,0,0],3,false,false,'fault'],
+  ['forbidden-exec',2,[1,1,2,1,1],[1,1,0,0,0,0,0,0,0,0,0],3,false,false,'fault'],
+  ['caught-fault',2,[1,1,2,1,1],[1,1,0,0,0,0,0,0,0,0,0],2,false,false,'fault'],
+  ['exhausted-read',2,[1,1,2,1,1],[1,1,1,4,4,4,2,3,1,0,0],21,true,false,'fault'],
+  ['overflow',2,[1,1,2,1,1],[1,1,0,0,0,0,0,0,0,0,0],96,false,false,'fault'],
+  ['close-false',2,[1,1,2,1,1],[1,1,1,4,4,4,2,3,1,1,0],23,true,false,'fault'],
+  ['close-throw',2,[1,1,2,1,1],[1,1,1,4,4,4,2,3,1,1,0],23,true,false,'close'],
+  ['post-close-inspection-throw',2,[1,1,2,1,1],[1,1,1,4,4,4,2,3,1,1,0],23,true,false,'inspection'],
+]) test('staged readonly file ports contain '+mode+' as fixture-only evidence',()=>{
+  const out=stagedFilePorts(mode);
+  assert.equal(out.containedSelfFault,true);assert.equal(out.harnessFault,'TEST_STAGED_FILE_PORT_HARNESS_FAULT');
+  assert.equal(out.nominatedFault,mode);assert.equal(out.dataMatched,matched);assert.equal(out.aliasWitness,alias);
+  assert.deepEqual([out.ownedCount,out.definitelyClosed,out.fixtureClosed],[owned,owned,owned]);
+  assert.deepEqual(STAGED_FILE_CORE_KEYS.map(k=>out.core[k]),core);
+  assert.deepEqual(STAGED_FILE_CALL_KEYS.map(k=>out.calls[k]),calls);
+  assert.deepEqual(out.closeOrder,owned===1?['file']:['file','directory']);
+  assert.equal(out.events.length,events);assert.deepEqual(out.cleanupErrors,[]);
+  assert.equal(out.primaryError,primary==='close'?'TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n'
+    :primary==='inspection'?'TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n':'TEST_STAGED_FILE_PORT_HARNESS_FAULT\n');
+  assert.deepEqual(out.remaining,matched?{fcntl:0,stat:0,lstat:0,seek:0,read:0}:{fcntl:4,stat:4,lstat:4,seek:2,read:3});
+  assert.deepEqual([out.firstLength,out.eofLength,out.secondLength],matched?[11684,0,11684]:[null,null,null]);
+});
+function stagedCaptorPorts(mode='healthy') {
*** End Patch
```

After actual RED only, second literal delta:

```diff
*** Begin Patch
*** Update File: scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
@@
-const STAGED_CAPTOR_PORT_PROGRAM=String.raw`
+const STAGED_FILE_PORT_PROGRAM=String.raw`
+
+    BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); }
+    use strict; use warnings; use Fcntl (); use JSON::PP (); use Digest::SHA ();
+    my ($file_path,$directory_path,$digest,$mode)=@ARGV;
+    my %modes=map {$_=>1} qw(healthy partial-acquisition inspection-fault alias forbidden-path forbidden-flags forbidden-exec caught-fault exhausted-read overflow close-false close-throw post-close-inspection-throw);
+    die "TEST_STAGED_FILE_PORT_HARNESS_FAULT\n" unless @ARGV==4&&$<!=0&&$<==$>
+      &&defined($mode)&&$modes{$mode}&&defined($directory_path)&&$directory_path=~m{\A/[^\r\n\0]+\z}
+      &&defined($file_path)&&$file_path eq $directory_path.'/task6a-origin-map-v2.pm'
+      &&defined($digest)&&$digest=~/\A[a-f0-9]{64}\z/;
+    my ($fault,$nominated)=('','');my $alias_witness=0;my @owned;my %roles;my @events;my @close_order;
+    my %calls=map {$_=>0} qw(sysopen opendir binmode fcntl stat lstat sysseek sysread fileno close closedir);
+    my %core=(fileOpen=>0,directoryOpen=>0,metadata=>0,fileClose=>0,directoryClose=>0);
+    my @fcntl=([Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],[Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]);
+    my @stat=qw(file directory file directory);my @lstat=@stat;my @seek=(0,0);my @read=(11684,0,11684);
+    my ($first_length,$eof_length,$second_length)=(undef,undef,undef);my $matched=0;
+    my $latch=sub {$fault='TEST_STAGED_FILE_PORT_HARNESS_FAULT';};
+    my $fail=sub {$latch->();die "$fault\n";};
+    my $check=sub {die "$fault\n" if length($fault);};
+    my $nominate=sub {
+      my ($kind)=@_;$fail->() unless $kind eq $mode&&!length($nominated);
+      $nominated=$kind;$fail->();
+    };
+    my $event=sub {
+      return 0 if length($fault);
+      if(@events>=96) {$latch->();return 0;}
+      my ($op,$role)=@_;my $e={seq=>1+@events,op=>$op,role=>$role};
+      unless(defined($op)&&defined($role)&&$op=~/\A[a-z-]{1,32}\z/
+        &&$role=~/\A[a-z-]{1,32}\z/&&length(JSON::PP->new->canonical->encode($e))<=512) {$latch->();return 0;}
+      push @events,$e;return 1;
+    };
+    my $register=sub {
+      my ($fh,$role,$directory)=@_;
+      # Raw actual acquisition is owned before metadata or trace can fail.
+      for my $r(@owned) {$fail->() if $r->{fh}==$fh;}
+      my $r={fh=>$fh,role=>$role,directory=>$directory,attempted=>0,closed=>0};
+      push @owned,$r;$roles{$role}=$r;$event->('acquire',$role);$check->();
+      $nominate->('inspection-fault') if $mode eq 'inspection-fault'&&$role eq 'file';
+      my $fd=CORE::fileno($fh);my @s=CORE::stat($fh);++$core{metadata};
+      $fail->() unless defined($fd)&&$fd>=3&&@s==13&&$s[4]==$<
+        &&($directory?Fcntl::S_ISDIR($s[2]):Fcntl::S_ISREG($s[2])&&$s[3]==1);
+      for my $other(@owned) {next if $other==$r;$fail->() if defined($other->{fd})&&$other->{fd}==$fd;}
+      $r->{fd}=$fd;$r->{identity}=[@s];return $r;
+    };
+    my $lookup=sub {
+      my ($fh,$allow_closed)=@_;$fail->() unless defined($fh)&&ref($fh);
+      for my $r(@owned) {
+        next unless $r->{fh}==$fh;
+        unless($allow_closed) {$fail->() if $r->{attempted}||$r->{closed}
+          ||!defined(CORE::fileno($fh))||CORE::fileno($fh)!=$r->{fd};}
+        return $r;
+      }
+      $fail->();
+    };
+    my $identity=sub {
+      my ($r,$s)=@_;$fail->() unless ref($s) eq 'ARRAY'&&@$s==13&&ref($r->{identity}) eq 'ARRAY';
+      for my $i($r->{directory}?(0,1,2,4,5):(0,1,2,3,4,5,7,9,10)) {
+        $fail->() unless defined($s->[$i])&&$s->[$i]==$r->{identity}[$i];
+      }
+    };
+    my $dispose=sub {
+      my ($r)=@_;return 0 if $r->{attempted};
+      $r->{attempted}=1;push @close_order,$r->{role};$event->('close-attempt',$r->{role});
+      $!=0;my $ok=eval {$r->{directory}?CORE::closedir($r->{fh}):CORE::close($r->{fh})};my $error=$@;my $errno=0+$!;
+      ++$core{$r->{directory}?'directoryClose':'fileClose'};
+      my $end;my $inspected=eval {$end=CORE::fileno($r->{fh});1;};my $inspection_error=$@;
+      $r->{closed}=1 if $ok&&!length($error)&&!$errno&&$inspected&&!length($inspection_error)&&!defined($end);
+      $event->('close-result',$r->{role});$fail->() unless $r->{closed};
+      if($r->{role} eq 'file'&&$mode=~/\A(?:close-false|close-throw|post-close-inspection-throw)\z/) {
+        $nominated=$mode;$latch->();
+        return 0 if $mode eq 'close-false';
+        die "TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n" if $mode eq 'close-throw';
+        die "TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n";
+      }
+      return 1;
+    };
+    my $deny=sub {
+      $event->('denied','external');
+      $nominate->('forbidden-exec') if $mode eq 'forbidden-exec';
+      $fail->();
+    };
+    my ($body_ok,$primary);my @cleanup_errors;my $ports_ready=0;
+    {
+      no warnings qw(redefine once);
+      local *CORE::GLOBAL::sysopen=sub (*$$;$) {
+        $check->();++$calls{sysopen};
+        $fail->() unless @_==3&&!defined($_[0])&&!ref($_[1])&&!ref($_[2]);
+        if($_[1] ne $file_path) {$event->('denied','path');$nominate->('forbidden-path') if $mode eq 'forbidden-path';$fail->();}
+        my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK();
+        if($_[2]!=$flags) {$event->('denied','flags');$nominate->('forbidden-flags') if $mode eq 'forbidden-flags';$fail->();}
+        if(defined($roles{file})) {
+          if($mode eq 'alias') {my $candidate=$roles{file}{fh};my $r=$lookup->($candidate,0);
+            $fail->() unless $r==$roles{file}&&CORE::fileno($candidate)==$r->{fd};
+            $alias_witness=1;$event->('alias','file');$nominate->('alias');}
+          $fail->();
+        }
+        CORE::sysopen(my $fh,$file_path,$flags) or $fail->();++$core{fileOpen};
+        $register->($fh,'file',0);$_[0]=$fh;return 1;
+      };
+      local *CORE::GLOBAL::opendir=sub (*$) {
+        $check->();++$calls{opendir};$fail->() unless @_==2&&!defined($_[0])&&!ref($_[1])
+          &&$_[1] eq $directory_path&&!defined($roles{directory})&&defined($roles{file});
+        $nominate->('partial-acquisition') if $mode eq 'partial-acquisition';
+        CORE::opendir(my $fh,$directory_path) or $fail->();++$core{directoryOpen};
+        $register->($fh,'directory',1);$_[0]=$fh;return 1;
+      };
+      local *CORE::GLOBAL::binmode=sub (*;$) {
+        $check->();$fail->() unless @_==1&&$calls{binmode}++==0;
+        my $r=$lookup->($_[0],0);$fail->() unless $r->{role} eq 'file';
+        CORE::binmode($_[0]) or $fail->();$event->('binmode','file');return 1;
+      };
+      local *CORE::GLOBAL::fcntl=sub (*$$) {
+        $check->();$fail->() unless @_==3&&@fcntl;my $r=$lookup->($_[0],0);
+        my $want=shift @fcntl;$fail->() unless $r->{role} eq 'file'&&$_[1]==$want->[0]&&$_[2]==$want->[1];
+        $!=0;my $v=CORE::fcntl($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&!$!;
+        ++$calls{fcntl};$event->('fcntl','file');return $v;
+      };
+      local *CORE::GLOBAL::stat=sub (;*) {
+        $check->();$fail->() unless @_==1&&wantarray&&@stat;my $r=$lookup->($_[0],0);
+        $fail->() unless $r->{role} eq shift(@stat);my @s=CORE::stat($_[0]);$identity->($r,\@s);
+        ++$calls{stat};$event->('stat',$r->{role});return @s;
+      };
+      local *CORE::GLOBAL::lstat=sub (;*) {
+        $check->();$fail->() unless @_==1&&wantarray&&@lstat&&!ref($_[0]);
+        my $role=shift @lstat;my $r=$roles{$role};$fail->() unless defined($r)
+          &&$_[0] eq ($role eq 'file'?$file_path:$directory_path);
+        my @s=CORE::lstat($_[0]);$identity->($r,\@s);
+        ++$calls{lstat};$event->('lstat',$role);return @s;
+      };
+      local *CORE::GLOBAL::sysseek=sub (*$$) {
+        $check->();$fail->() unless @_==3&&@seek;my $r=$lookup->($_[0],0);
+        my $want=shift @seek;$fail->() unless $r->{role} eq 'file'&&$_[1]==$want&&$_[2]==0;
+        my $v=CORE::sysseek($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&$v==0;
+        ++$calls{sysseek};$event->('seek','file');return $v;
+      };
+      local *CORE::GLOBAL::sysread=sub (*\$$;$) {
+        $check->();$fail->() unless @_==3&&ref($_[1]) eq 'SCALAR'&&$_[2]==65536;
+        my $r=$lookup->($_[0],0);$fail->() unless $r->{role} eq 'file';
+        unless(@read) {$nominate->('exhausted-read') if $mode eq 'exhausted-read';$fail->();}
+        my $want=shift @read;my $buffer=$_[1];$fail->() unless !ref($$buffer)&&$$buffer eq '';
+        $!=0;my $n=CORE::sysread($_[0],$$buffer,$_[2]);$fail->() unless defined($n)&&!$!
+          &&$n==$want&&length($$buffer)==$n&&!utf8::is_utf8($$buffer);
+        ++$calls{sysread};$event->('read','file');return $n;
+      };
+      local *CORE::GLOBAL::fileno=sub (*) {
+        $check->();$fail->() unless @_==1;my $r=$lookup->($_[0],0);
+        ++$calls{fileno};$event->('fileno',$r->{role});return CORE::fileno($_[0]);
+      };
+      local *CORE::GLOBAL::close=sub (;*) {
+        $fail->() unless @_==1;my $r=$lookup->($_[0],1);$fail->() if $r->{directory};
+        ++$calls{close};return $dispose->($r);
+      };
+      local *CORE::GLOBAL::closedir=sub (*) {
+        $fail->() unless @_==1;my $r=$lookup->($_[0],1);$fail->() unless $r->{directory};
+        ++$calls{closedir};return $dispose->($r);
+      };
+      local *CORE::GLOBAL::exec=$deny;local *CORE::GLOBAL::system=$deny;
+      local *CORE::GLOBAL::open=sub (*;$@) {$deny->();};local *CORE::GLOBAL::syswrite=sub (*$;$$) {$deny->();};
+      local *CORE::GLOBAL::readdir=sub (*) {$deny->();};local *CORE::GLOBAL::pipe=sub (**) {$deny->();};
+      local *CORE::GLOBAL::fork=sub () {$deny->();};local *CORE::GLOBAL::waitpid=sub ($$) {$deny->();};
+      local *CORE::GLOBAL::kill=sub (@) {$deny->();};local *CORE::GLOBAL::readpipe=sub (_) {$deny->();};
+      local *CORE::GLOBAL::unlink=sub (@) {$deny->();};local *CORE::GLOBAL::mkdir=sub (_;$) {$deny->();};
+      local *CORE::GLOBAL::rmdir=sub (_) {$deny->();};local *CORE::GLOBAL::rename=sub ($$) {$deny->();};
+      local *CORE::GLOBAL::chdir=sub (;$) {$deny->();};local *CORE::GLOBAL::truncate=sub ($$) {$deny->();};
+      local *CORE::GLOBAL::socket=sub (*$$$) {$deny->();};local *CORE::GLOBAL::socketpair=sub (**$$$) {$deny->();};
+      local *CORE::GLOBAL::connect=sub (*$) {$deny->();};local *CORE::GLOBAL::accept=sub (**) {$deny->();};
+      my %prototypes=(sysopen=>'*$$;$',opendir=>'*$',
+        binmode=>'*;$',fcntl=>'*$$',stat=>';*',lstat=>';*',sysseek=>'*$$',
+        sysread=>'*\$$;$',fileno=>'*',close=>';*',closedir=>'*');
+      for my $op(sort keys %prototypes) {
+        my $port='CORE::GLOBAL'->can($op);my $actual=prototype('CORE::'.$op);
+        $fail->() unless defined($port)&&ref($port) eq 'CODE'&&defined($actual)
+          &&$actual eq $prototypes{$op}&&defined(prototype($port))&&prototype($port) eq $actual;
+      }
+      for my $op(qw(exec system)) {my $port='CORE::GLOBAL'->can($op);
+        $fail->() unless defined($port)&&ref($port) eq 'CODE'&&!defined(prototype($port));}
+      $ports_ready=1;
+      $body_ok=eval q{
+        my ($file,$directory);my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK();
+        sysopen($file,$file_path,$flags) or $fail->();
+        opendir($directory,$directory_path) or $fail->();
+        if($mode eq 'alias') {my $other;sysopen($other,$file_path,$flags);$fail->();}
+        if($mode eq 'forbidden-path') {my $other;sysopen($other,$file_path.'/unselected',$flags);$fail->();}
+        if($mode eq 'forbidden-flags') {my $other;sysopen($other,$file_path,Fcntl::O_WRONLY());$fail->();}
+        if($mode eq 'forbidden-exec') {CORE::GLOBAL::exec('/bin/false');$fail->();}
+        if($mode eq 'caught-fault') {eval {$nominate->('caught-fault');};$check->();}
+        if($mode eq 'overflow') {for(1..97) {$event->('overflow','fixture');}
+          $nominated='overflow';$check->();}
+        binmode($file) or $fail->();
+        my $fl=fcntl($file,Fcntl::F_GETFL(),0);
+        $fail->() unless defined($fl)&&($fl&Fcntl::O_ACCMODE())==Fcntl::O_RDONLY()&&($fl&Fcntl::O_NONBLOCK());
+        my $fd_flags=fcntl($file,Fcntl::F_GETFD(),0);$fail->() unless defined($fd_flags);
+        fcntl($file,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or $fail->();
+        $fd_flags=fcntl($file,Fcntl::F_GETFD(),0);$fail->() unless defined($fd_flags)&&($fd_flags&Fcntl::FD_CLOEXEC());
+        my $fd=fileno($file);$fail->() unless defined($fd)&&$fd>=3;
+        my @s=stat($file);@s=lstat($file_path);@s=stat($directory);@s=lstat($directory_path);
+        my $position=sysseek($file,0,0);$fail->() unless defined($position)&&$position==0;
+        my $bytes='';$first_length=sysread($file,$bytes,65536);
+        $fail->() unless Digest::SHA::sha256_hex($bytes) eq $digest;
+        $bytes='';$eof_length=sysread($file,$bytes,65536);
+        $position=sysseek($file,0,0);$fail->() unless defined($position)&&$position==0;
+        $bytes='';$second_length=sysread($file,$bytes,65536);
+        $fail->() unless Digest::SHA::sha256_hex($bytes) eq $digest;$matched=1;
+        @s=stat($file);@s=lstat($file_path);@s=stat($directory);@s=lstat($directory_path);
+        if($mode eq 'exhausted-read') {$bytes='';sysread($file,$bytes,65536);$fail->();}
+        close($file) or $check->();closedir($directory) or $check->();
+        1;
+      };
+      $primary=$@;
+      # Fixture-only finalizer bypasses sticky faults and operation queues.
+      for my $r(@owned) {
+        next if $r->{attempted};my $ok=eval {$dispose->($r)};my $error=$@;
+        unless($ok&&!length($error)&&$r->{closed}) {
+          $latch->();push @cleanup_errors,length($error)?$error:"TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_FALSE\n";
+        }
+      }
+    }
+    my $closed=grep {$_->{closed}} @owned;
+    my $self=$mode ne 'healthy';
+    my $expected_primary=$mode eq 'close-throw'?"TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n"
+      :$mode eq 'post-close-inspection-throw'?"TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n"
+      :"TEST_STAGED_FILE_PORT_HARNESS_FAULT\n";
+    die "TEST_STAGED_FILE_PORT_HARNESS_FAULT\n" unless $ports_ready&&$closed==@owned
+      &&($self?($nominated eq $mode&&$fault eq 'TEST_STAGED_FILE_PORT_HARNESS_FAULT'
+        &&($body_ok||$primary eq $expected_primary))
+        :($body_ok&&!length($primary)&&!length($fault)&&!@cleanup_errors
+          &&!@fcntl&&!@stat&&!@lstat&&!@seek&&!@read));
+    my $out={scope=>'ordinary-staged-file-ports-fixture-only',productionAuthority=>JSON::PP::false,
+      consumerInvoked=>JSON::PP::false,consumerClosed=>0,fixtureClosed=>0+$closed,
+      ownedCount=>scalar(@owned),definitelyClosed=>0+$closed,portsReady=>JSON::PP::true,
+      harnessFault=>length($fault)?$fault:undef,nominatedFault=>length($nominated)?$nominated:undef,
+      containedSelfFault=>$self?JSON::PP::true:JSON::PP::false,
+      dataMatched=>$matched?JSON::PP::true:JSON::PP::false,
+      firstLength=>$first_length,eofLength=>$eof_length,secondLength=>$second_length,
+      aliasWitness=>$alias_witness?JSON::PP::true:JSON::PP::false,primaryError=>$primary,
+      calls=>\%calls,core=>\%core,closeOrder=>\@close_order,events=>\@events,
+      cleanupErrors=>\@cleanup_errors,remaining=>{fcntl=>scalar(@fcntl),stat=>scalar(@stat),lstat=>scalar(@lstat),seek=>scalar(@seek),read=>scalar(@read)}};
+    print JSON::PP->new->canonical->utf8->encode($out);exit 0;
+`;
+const STAGED_CAPTOR_PORT_PROGRAM=String.raw`
*** End Patch
```

### Task 2b.4: Ordinary directory-FH bridge (test-only)

**Goal and causal relation:** Actual ancestry uses sysopen(O_DIRECTORY)/close,
not opendir/closedir. The delivered thirteen stream/file cases do not prove this
port type. Extend the private fixture bridge first; bootstrap4aaececb and
unconditional main refusal remain unchanged. This is ordinary fixture evidence,
not staged-consumer RED/GREEN, protected ownership, H42 or native admission.

**File Map:** Exactly existing test, this plan and named spec. No production,
dependency, root owner, ACL, account, service or SQL change. Current sole writer
root is `/Users/setrox/ai/setrox/.worktrees/setfarm-staged-directory-fh-20261004-v1`, branch
`fix/task6a-staged-directory-fh-v2`, base42c5738678b69945bae051e1edc2bc4dcfee3f61.
Original two files and all predecessor roots/cache/evidence stay visible.

**Architecture:** Reuse the existing finite standalone file bridge. New closed
directory-fh prefix selects two actual user-owned FHs, map then scripts directory.
Directory metadata kind is separate from original disposal kind. Raw acquired
original FH and immutable lexical disposal captures enter the private registry
before metadata/configuration/events can fail. Both FH types use CORE::close;
old DIR streams use CORE::closedir. No mutable admission/diagnostic field chooses
the original disposal primitive. All eleven supported prototypes, sticky fault,
bounded trace and catch-each-original finalizer remain fail-closed. Directory
FH uses exact O_RDONLY|O_NOFOLLOW|O_DIRECTORY and verified FD_CLOEXEC; no directory
read/seek/readdir or root:wheel projection. Alias nomination uses the already-held
directory FH before another actual acquisition, with no second close obligation.
This does not resolve future pending-raw/returned-alias ownership.

**Literal closed matrix:** Test patch below independently freezes all fourteen
new profiles, eleven port counts, six CORE counts, original closure order,
remaining five queues, read lengths, nomination/primary error and exact trace.
Healthy trace29 and all queues0. Early finalizer runs acquisition order file,
directory; healthy and late directory-close nominations run directory,file.
Exhausted-read is dataMatched true but still pre-close: file,directory. Partial
second acquisition owns only file. Configuration-fault is nominated after actual
directory F_SETFD, with seven fcntl calls, ten events, one fcntl remaining. Old
thirteen profiles stay unchanged and additionally require zero directory-FH opens.
The fcntl queue is four file tuples followed by four directory tuples. Stat and
lstat each have file,directory,file,directory; seek0,0; reads11684,0,11684.
Caps96events/512UTF8B per event; overflow includes two acquisitions and94 events.
False/throw/post-close-inspection nominations occur ONLY after actual physical
closure: fault containment, not leak freedom under uncertain native close.
No FH/FD/PID/path/hash/owner-record authority is exported; authorityfalse,
consumerInvokedfalse and consumerClosed0 remain mandatory.

**Historical pre-effect candidate checkpoint, superseded by the actual execution
checkpoint below; do not replay its commands.**

**Draft byte identities at that checkpoint (not then observed execution):** Program 17450B
SHA256c8f20b39812b35350c2bcb59cd8fdba578984d3659f53a727ebdfbc8917df0c2; test-only addition
5477B SHA2565b3f1a60c9ec672aee6d9f9d9509072258c0a8331ec532ff5254763e72bb337d.
Two initial read-only literal comparators failed: the first boundary selection
was wrong and the second omitted the retained initial blank line. Actual source
and test stayed unchanged. The draft now preserves both initial blank lines;
no test/prototype execution or source repinning is credited.
Pre-effect contract review found two Important recipe issues: ambient environment
in the three commands and delimiter newlines incorrectly rendered as physical
patch lines. Both are corrected here before any commit/test/source effect:
all commands use the prior env-i fixed PATH/LANG/LC_ALL; the program patch removes
and adds physical lines only, preserving one initial blank line and no artificial
trailing blank. Program bytes/hash stay unchanged. Two independent reviewers
must admit this corrected exact recipe before effects.
Setup/prototype/compile failure is never semantic or staged-consumer RED.

- [x] **Step 1 — literal admission/design commit.** Two exact pre-effect C0
  reviews, root source/test/doc/tool/preservation check, git diff --check.
  Commit only these two reviewed design docs, no main commit or cleanup.
- [x] **Step 2 — test-only RED.** Apply the first literal patch only. Fixed Node
  --check and diff --check; two actual-delta reviews. Run ONCE:
  `env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged directory FH ports retain actual directory handles and close original FH types$' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`
  cwd is the fixed branch root above. Expected genuine JS AssertionError:
  "staged directory FH adapter missing", undefined vs function, BEFORE map read
  or Perl spawn. Naturally terminal exit1 and full output must be read. This is
  missing-fixture-adapter RED only; no producer/staged consumer credit.
- [x] **Step 3 — minimal bridge GREEN.** After causal RED, apply the second
  literal patch. Syntax/diff checks and two actual-delta reviews; then ONCE:
  `env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged (directory FH|readonly file) ports ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`
  Expected27PASS/0FAIL/CANCEL/SKIP/TODO, fourteen new plus thirteen prior profiles.
  Then ONCE adjacent unfiltered:
  `env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js`
  Poll only live sessions to natural closure and read every output chunk. Do not
  rerun predecessor tests/builds or invent observations from literal expectations.
- [x] **Step 4 — reviewed delivery and own clean-main build.** Record actual
  outputs and terminal states; source/test/spec/plan full review and cheapest
  English/path/diff contracts. Scoped conventional commits, normal push/PR,
  exact-head cloud/security/full paginated comments/threads/reviews gate, optional
  Copilot/Gemini once, normal SHA-bound merge without bypass/deletion. Own normal
  HTTPS clean-main clone and isolated owner cache; freeze actual merged source,
  npm/tool/dependency/physical pins. Two independently reviewed exact ci/build
  wrappers before each new effect, normal npm run build with all guards intact.
  Actual npm exit+close, retained original revalidation, artifact verification
  and independent post-build/source/HTTP/resource preservation audit required.
  No ordinary build receipt admits protected/native/loaded service or cutover.

#### Step 2 literal test-only patch

```diff
*** Begin Patch
*** Update File: /Users/setrox/ai/setrox/.worktrees/setfarm-staged-directory-fh-20261004-v1/scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
@@
+const STAGED_DIRECTORY_FH_CORE_KEYS=['fileOpen','directoryOpen','directoryFhOpen','metadata','fileClose','directoryClose'];
+const STAGED_DIRECTORY_FH_HEALTHY_TRACE=[
+  'acquire:file','acquire:directory','binmode:file',
+  'fcntl:file','fcntl:file','fcntl:file','fcntl:file',
+  'fcntl:directory','fcntl:directory','fcntl:directory','fcntl:directory','fileno:file',
+  'stat:file','lstat:file','stat:directory','lstat:directory',
+  'seek:file','read:file','read:file','seek:file','read:file',
+  'stat:file','lstat:file','stat:directory','lstat:directory',
+  'close-attempt:directory','close-result:directory','close-attempt:file','close-result:file',
+];
+function assertDirectoryFhTrace(out,want) {
+  assert.deepEqual(out.events.map(e=>e.op+':'+e.role),want);
+  assert.deepEqual(out.events.map(e=>e.seq),want.map((_,i)=>i+1));
+  for(const e of out.events) {
+    assert.deepEqual(Object.keys(e).sort(),['op','role','seq']);
+    assert.ok(Buffer.byteLength(JSON.stringify(e))<=512);
+  }
+}
+test('staged directory FH ports retain actual directory handles and close original FH types',()=>{
+  assert.equal(typeof stagedDirectoryFhPorts,'function','staged directory FH adapter missing');
+  const out=stagedDirectoryFhPorts();
+  assert.equal(out.directoryFhProfile,true);assert.equal(out.harnessFault,null);assert.equal(out.nominatedFault,null);
+  assert.equal(out.containedSelfFault,false);assert.equal(out.dataMatched,true);assert.equal(out.aliasWitness,false);
+  assert.equal(out.primaryError,'');assert.deepEqual(out.cleanupErrors,[]);
+  assert.deepEqual([out.firstLength,out.eofLength,out.secondLength],[11684,0,11684]);
+  assert.deepEqual(STAGED_FILE_CALL_KEYS.map(k=>out.calls[k]),[2,0,1,8,4,4,2,3,1,2,0]);
+  assert.deepEqual(STAGED_DIRECTORY_FH_CORE_KEYS.map(k=>out.core[k]),[1,0,1,2,2,0]);
+  assert.deepEqual([out.ownedCount,out.definitelyClosed,out.fixtureClosed],[2,2,2]);
+  assert.deepEqual(out.closeOrder,['directory','file']);
+  assert.deepEqual(out.remaining,{fcntl:0,stat:0,lstat:0,seek:0,read:0});
+  assertDirectoryFhTrace(out,STAGED_DIRECTORY_FH_HEALTHY_TRACE);
+});
+for(const [mode,owned,core,calls,trace,matched,alias,primary,closeOrder,remainingFcntl] of [
+  ['partial-acquisition',1,[1,0,0,1,1,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file'],false,false,'fault',['file'],8],
+  ['inspection-fault',2,[1,0,1,1,2,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory'],false,false,'fault',['file','directory'],8],
+  ['alias',2,[1,0,1,2,2,0],[3,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory','alias:directory'],false,true,'fault',['file','directory'],8],
+  ['forbidden-path',2,[1,0,1,2,2,0],[3,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory','denied:path'],false,false,'fault',['file','directory'],8],
+  ['forbidden-flags',2,[1,0,1,2,2,0],[3,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory','denied:flags'],false,false,'fault',['file','directory'],8],
+  ['forbidden-exec',2,[1,0,1,2,2,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory','denied:external'],false,false,'fault',['file','directory'],8],
+  ['caught-fault',2,[1,0,1,2,2,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory'],false,false,'fault',['file','directory'],8],
+  ['configuration-fault',2,[1,0,1,2,2,0],[2,0,1,7,0,0,0,0,0,0,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,10),false,false,'fault',['file','directory'],1],
+  ['exhausted-read',2,[1,0,1,2,2,0],[2,0,1,8,4,4,2,3,1,0,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,25),true,false,'fault',['file','directory'],0],
+  ['overflow',2,[1,0,1,2,2,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory',...Array(94).fill('overflow:fixture')],false,false,'fault',['file','directory'],8],
+  ['close-false',2,[1,0,1,2,2,0],[2,0,1,8,4,4,2,3,1,1,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,27),true,false,'fault',['directory','file'],0],
+  ['close-throw',2,[1,0,1,2,2,0],[2,0,1,8,4,4,2,3,1,1,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,27),true,false,'close',['directory','file'],0],
+  ['post-close-inspection-throw',2,[1,0,1,2,2,0],[2,0,1,8,4,4,2,3,1,1,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,27),true,false,'inspection',['directory','file'],0],
+]) test('staged directory FH ports contain '+mode+' without borrowing or leaking original handles',()=>{
+  assert.equal(typeof stagedDirectoryFhPorts,'function','staged directory FH adapter missing');
+  const out=stagedDirectoryFhPorts(mode);
+  assert.equal(out.directoryFhProfile,true);assert.equal(out.containedSelfFault,true);
+  assert.equal(out.harnessFault,'TEST_STAGED_FILE_PORT_HARNESS_FAULT');assert.equal(out.nominatedFault,mode);
+  assert.equal(out.dataMatched,matched);assert.equal(out.aliasWitness,alias);
+  assert.deepEqual([out.ownedCount,out.definitelyClosed,out.fixtureClosed],[owned,owned,owned]);
+  assert.deepEqual(STAGED_DIRECTORY_FH_CORE_KEYS.map(k=>out.core[k]),core);
+  assert.deepEqual(STAGED_FILE_CALL_KEYS.map(k=>out.calls[k]),calls);
+  assert.deepEqual(out.closeOrder,closeOrder);assert.deepEqual(out.cleanupErrors,[]);
+  assert.equal(out.primaryError,primary==='close'?'TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n'
+    :primary==='inspection'?'TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n':'TEST_STAGED_FILE_PORT_HARNESS_FAULT\n');
+  assert.deepEqual(out.remaining,{fcntl:remainingFcntl,stat:matched?0:4,lstat:matched?0:4,seek:matched?0:2,read:matched?0:3});
+  assert.deepEqual([out.firstLength,out.eofLength,out.secondLength],matched?[11684,0,11684]:[null,null,null]);
+  assertDirectoryFhTrace(out,trace);
+});
 function stagedFilePorts(mode='healthy') {
*** End Patch
```

#### Step 3 literal private bridge patch

```diff
*** Begin Patch
*** Update File: /Users/setrox/ai/setrox/.worktrees/setfarm-staged-directory-fh-20261004-v1/scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
@@
 const STAGED_FILE_PORT_PROGRAM=String.raw`
-
-    BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); }
-    use strict; use warnings; use Fcntl (); use JSON::PP (); use Digest::SHA ();
-    my ($file_path,$directory_path,$digest,$mode)=@ARGV;
-    my %modes=map {$_=>1} qw(healthy partial-acquisition inspection-fault alias forbidden-path forbidden-flags forbidden-exec caught-fault exhausted-read overflow close-false close-throw post-close-inspection-throw);
-    die "TEST_STAGED_FILE_PORT_HARNESS_FAULT\n" unless @ARGV==4&&$<!=0&&$<==$>
-      &&defined($mode)&&$modes{$mode}&&defined($directory_path)&&$directory_path=~m{\A/[^\r\n\0]+\z}
-      &&defined($file_path)&&$file_path eq $directory_path.'/task6a-origin-map-v2.pm'
-      &&defined($digest)&&$digest=~/\A[a-f0-9]{64}\z/;
-    my ($fault,$nominated)=('','');my $alias_witness=0;my @owned;my %roles;my @events;my @close_order;
-    my %calls=map {$_=>0} qw(sysopen opendir binmode fcntl stat lstat sysseek sysread fileno close closedir);
-    my %core=(fileOpen=>0,directoryOpen=>0,metadata=>0,fileClose=>0,directoryClose=>0);
-    my @fcntl=([Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],[Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]);
-    my @stat=qw(file directory file directory);my @lstat=@stat;my @seek=(0,0);my @read=(11684,0,11684);
-    my ($first_length,$eof_length,$second_length)=(undef,undef,undef);my $matched=0;
-    my $latch=sub {$fault='TEST_STAGED_FILE_PORT_HARNESS_FAULT';};
-    my $fail=sub {$latch->();die "$fault\n";};
-    my $check=sub {die "$fault\n" if length($fault);};
-    my $nominate=sub {
-      my ($kind)=@_;$fail->() unless $kind eq $mode&&!length($nominated);
-      $nominated=$kind;$fail->();
-    };
-    my $event=sub {
-      return 0 if length($fault);
-      if(@events>=96) {$latch->();return 0;}
-      my ($op,$role)=@_;my $e={seq=>1+@events,op=>$op,role=>$role};
-      unless(defined($op)&&defined($role)&&$op=~/\A[a-z-]{1,32}\z/
-        &&$role=~/\A[a-z-]{1,32}\z/&&length(JSON::PP->new->canonical->encode($e))<=512) {$latch->();return 0;}
-      push @events,$e;return 1;
-    };
-    my $register=sub {
-      my ($fh,$role,$directory)=@_;
-      # Raw actual acquisition is owned before metadata or trace can fail.
-      for my $r(@owned) {$fail->() if $r->{fh}==$fh;}
-      my $r={fh=>$fh,role=>$role,directory=>$directory,attempted=>0,closed=>0};
-      push @owned,$r;$roles{$role}=$r;$event->('acquire',$role);$check->();
-      $nominate->('inspection-fault') if $mode eq 'inspection-fault'&&$role eq 'file';
-      my $fd=CORE::fileno($fh);my @s=CORE::stat($fh);++$core{metadata};
-      $fail->() unless defined($fd)&&$fd>=3&&@s==13&&$s[4]==$<
-        &&($directory?Fcntl::S_ISDIR($s[2]):Fcntl::S_ISREG($s[2])&&$s[3]==1);
-      for my $other(@owned) {next if $other==$r;$fail->() if defined($other->{fd})&&$other->{fd}==$fd;}
-      $r->{fd}=$fd;$r->{identity}=[@s];return $r;
-    };
-    my $lookup=sub {
-      my ($fh,$allow_closed)=@_;$fail->() unless defined($fh)&&ref($fh);
-      for my $r(@owned) {
-        next unless $r->{fh}==$fh;
-        unless($allow_closed) {$fail->() if $r->{attempted}||$r->{closed}
-          ||!defined(CORE::fileno($fh))||CORE::fileno($fh)!=$r->{fd};}
-        return $r;
-      }
-      $fail->();
-    };
-    my $identity=sub {
-      my ($r,$s)=@_;$fail->() unless ref($s) eq 'ARRAY'&&@$s==13&&ref($r->{identity}) eq 'ARRAY';
-      for my $i($r->{directory}?(0,1,2,4,5):(0,1,2,3,4,5,7,9,10)) {
-        $fail->() unless defined($s->[$i])&&$s->[$i]==$r->{identity}[$i];
-      }
-    };
-    my $dispose=sub {
-      my ($r)=@_;return 0 if $r->{attempted};
-      $r->{attempted}=1;push @close_order,$r->{role};$event->('close-attempt',$r->{role});
-      $!=0;my $ok=eval {$r->{directory}?CORE::closedir($r->{fh}):CORE::close($r->{fh})};my $error=$@;my $errno=0+$!;
-      ++$core{$r->{directory}?'directoryClose':'fileClose'};
-      my $end;my $inspected=eval {$end=CORE::fileno($r->{fh});1;};my $inspection_error=$@;
-      $r->{closed}=1 if $ok&&!length($error)&&!$errno&&$inspected&&!length($inspection_error)&&!defined($end);
-      $event->('close-result',$r->{role});$fail->() unless $r->{closed};
-      if($r->{role} eq 'file'&&$mode=~/\A(?:close-false|close-throw|post-close-inspection-throw)\z/) {
-        $nominated=$mode;$latch->();
-        return 0 if $mode eq 'close-false';
-        die "TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n" if $mode eq 'close-throw';
-        die "TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n";
-      }
-      return 1;
-    };
-    my $deny=sub {
-      $event->('denied','external');
-      $nominate->('forbidden-exec') if $mode eq 'forbidden-exec';
-      $fail->();
-    };
-    my ($body_ok,$primary);my @cleanup_errors;my $ports_ready=0;
-    {
-      no warnings qw(redefine once);
-      local *CORE::GLOBAL::sysopen=sub (*$$;$) {
-        $check->();++$calls{sysopen};
-        $fail->() unless @_==3&&!defined($_[0])&&!ref($_[1])&&!ref($_[2]);
-        if($_[1] ne $file_path) {$event->('denied','path');$nominate->('forbidden-path') if $mode eq 'forbidden-path';$fail->();}
-        my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK();
-        if($_[2]!=$flags) {$event->('denied','flags');$nominate->('forbidden-flags') if $mode eq 'forbidden-flags';$fail->();}
-        if(defined($roles{file})) {
-          if($mode eq 'alias') {my $candidate=$roles{file}{fh};my $r=$lookup->($candidate,0);
-            $fail->() unless $r==$roles{file}&&CORE::fileno($candidate)==$r->{fd};
-            $alias_witness=1;$event->('alias','file');$nominate->('alias');}
-          $fail->();
-        }
-        CORE::sysopen(my $fh,$file_path,$flags) or $fail->();++$core{fileOpen};
-        $register->($fh,'file',0);$_[0]=$fh;return 1;
-      };
-      local *CORE::GLOBAL::opendir=sub (*$) {
-        $check->();++$calls{opendir};$fail->() unless @_==2&&!defined($_[0])&&!ref($_[1])
-          &&$_[1] eq $directory_path&&!defined($roles{directory})&&defined($roles{file});
-        $nominate->('partial-acquisition') if $mode eq 'partial-acquisition';
-        CORE::opendir(my $fh,$directory_path) or $fail->();++$core{directoryOpen};
-        $register->($fh,'directory',1);$_[0]=$fh;return 1;
-      };
-      local *CORE::GLOBAL::binmode=sub (*;$) {
-        $check->();$fail->() unless @_==1&&$calls{binmode}++==0;
-        my $r=$lookup->($_[0],0);$fail->() unless $r->{role} eq 'file';
-        CORE::binmode($_[0]) or $fail->();$event->('binmode','file');return 1;
-      };
-      local *CORE::GLOBAL::fcntl=sub (*$$) {
-        $check->();$fail->() unless @_==3&&@fcntl;my $r=$lookup->($_[0],0);
-        my $want=shift @fcntl;$fail->() unless $r->{role} eq 'file'&&$_[1]==$want->[0]&&$_[2]==$want->[1];
-        $!=0;my $v=CORE::fcntl($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&!$!;
-        ++$calls{fcntl};$event->('fcntl','file');return $v;
-      };
-      local *CORE::GLOBAL::stat=sub (;*) {
-        $check->();$fail->() unless @_==1&&wantarray&&@stat;my $r=$lookup->($_[0],0);
-        $fail->() unless $r->{role} eq shift(@stat);my @s=CORE::stat($_[0]);$identity->($r,\@s);
-        ++$calls{stat};$event->('stat',$r->{role});return @s;
-      };
-      local *CORE::GLOBAL::lstat=sub (;*) {
-        $check->();$fail->() unless @_==1&&wantarray&&@lstat&&!ref($_[0]);
-        my $role=shift @lstat;my $r=$roles{$role};$fail->() unless defined($r)
-          &&$_[0] eq ($role eq 'file'?$file_path:$directory_path);
-        my @s=CORE::lstat($_[0]);$identity->($r,\@s);
-        ++$calls{lstat};$event->('lstat',$role);return @s;
-      };
-      local *CORE::GLOBAL::sysseek=sub (*$$) {
-        $check->();$fail->() unless @_==3&&@seek;my $r=$lookup->($_[0],0);
-        my $want=shift @seek;$fail->() unless $r->{role} eq 'file'&&$_[1]==$want&&$_[2]==0;
-        my $v=CORE::sysseek($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&$v==0;
-        ++$calls{sysseek};$event->('seek','file');return $v;
-      };
-      local *CORE::GLOBAL::sysread=sub (*\$$;$) {
-        $check->();$fail->() unless @_==3&&ref($_[1]) eq 'SCALAR'&&$_[2]==65536;
-        my $r=$lookup->($_[0],0);$fail->() unless $r->{role} eq 'file';
-        unless(@read) {$nominate->('exhausted-read') if $mode eq 'exhausted-read';$fail->();}
-        my $want=shift @read;my $buffer=$_[1];$fail->() unless !ref($$buffer)&&$$buffer eq '';
-        $!=0;my $n=CORE::sysread($_[0],$$buffer,$_[2]);$fail->() unless defined($n)&&!$!
-          &&$n==$want&&length($$buffer)==$n&&!utf8::is_utf8($$buffer);
-        ++$calls{sysread};$event->('read','file');return $n;
-      };
-      local *CORE::GLOBAL::fileno=sub (*) {
-        $check->();$fail->() unless @_==1;my $r=$lookup->($_[0],0);
-        ++$calls{fileno};$event->('fileno',$r->{role});return CORE::fileno($_[0]);
-      };
-      local *CORE::GLOBAL::close=sub (;*) {
-        $fail->() unless @_==1;my $r=$lookup->($_[0],1);$fail->() if $r->{directory};
-        ++$calls{close};return $dispose->($r);
-      };
-      local *CORE::GLOBAL::closedir=sub (*) {
-        $fail->() unless @_==1;my $r=$lookup->($_[0],1);$fail->() unless $r->{directory};
-        ++$calls{closedir};return $dispose->($r);
-      };
-      local *CORE::GLOBAL::exec=$deny;local *CORE::GLOBAL::system=$deny;
-      local *CORE::GLOBAL::open=sub (*;$@) {$deny->();};local *CORE::GLOBAL::syswrite=sub (*$;$$) {$deny->();};
-      local *CORE::GLOBAL::readdir=sub (*) {$deny->();};local *CORE::GLOBAL::pipe=sub (**) {$deny->();};
-      local *CORE::GLOBAL::fork=sub () {$deny->();};local *CORE::GLOBAL::waitpid=sub ($$) {$deny->();};
-      local *CORE::GLOBAL::kill=sub (@) {$deny->();};local *CORE::GLOBAL::readpipe=sub (_) {$deny->();};
-      local *CORE::GLOBAL::unlink=sub (@) {$deny->();};local *CORE::GLOBAL::mkdir=sub (_;$) {$deny->();};
-      local *CORE::GLOBAL::rmdir=sub (_) {$deny->();};local *CORE::GLOBAL::rename=sub ($$) {$deny->();};
-      local *CORE::GLOBAL::chdir=sub (;$) {$deny->();};local *CORE::GLOBAL::truncate=sub ($$) {$deny->();};
-      local *CORE::GLOBAL::socket=sub (*$$$) {$deny->();};local *CORE::GLOBAL::socketpair=sub (**$$$) {$deny->();};
-      local *CORE::GLOBAL::connect=sub (*$) {$deny->();};local *CORE::GLOBAL::accept=sub (**) {$deny->();};
-      my %prototypes=(sysopen=>'*$$;$',opendir=>'*$',
-        binmode=>'*;$',fcntl=>'*$$',stat=>';*',lstat=>';*',sysseek=>'*$$',
-        sysread=>'*\$$;$',fileno=>'*',close=>';*',closedir=>'*');
-      for my $op(sort keys %prototypes) {
-        my $port='CORE::GLOBAL'->can($op);my $actual=prototype('CORE::'.$op);
-        $fail->() unless defined($port)&&ref($port) eq 'CODE'&&defined($actual)
-          &&$actual eq $prototypes{$op}&&defined(prototype($port))&&prototype($port) eq $actual;
-      }
-      for my $op(qw(exec system)) {my $port='CORE::GLOBAL'->can($op);
-        $fail->() unless defined($port)&&ref($port) eq 'CODE'&&!defined(prototype($port));}
-      $ports_ready=1;
-      $body_ok=eval q{
-        my ($file,$directory);my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK();
-        sysopen($file,$file_path,$flags) or $fail->();
-        opendir($directory,$directory_path) or $fail->();
-        if($mode eq 'alias') {my $other;sysopen($other,$file_path,$flags);$fail->();}
-        if($mode eq 'forbidden-path') {my $other;sysopen($other,$file_path.'/unselected',$flags);$fail->();}
-        if($mode eq 'forbidden-flags') {my $other;sysopen($other,$file_path,Fcntl::O_WRONLY());$fail->();}
-        if($mode eq 'forbidden-exec') {CORE::GLOBAL::exec('/bin/false');$fail->();}
-        if($mode eq 'caught-fault') {eval {$nominate->('caught-fault');};$check->();}
-        if($mode eq 'overflow') {for(1..97) {$event->('overflow','fixture');}
-          $nominated='overflow';$check->();}
-        binmode($file) or $fail->();
-        my $fl=fcntl($file,Fcntl::F_GETFL(),0);
-        $fail->() unless defined($fl)&&($fl&Fcntl::O_ACCMODE())==Fcntl::O_RDONLY()&&($fl&Fcntl::O_NONBLOCK());
-        my $fd_flags=fcntl($file,Fcntl::F_GETFD(),0);$fail->() unless defined($fd_flags);
-        fcntl($file,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or $fail->();
-        $fd_flags=fcntl($file,Fcntl::F_GETFD(),0);$fail->() unless defined($fd_flags)&&($fd_flags&Fcntl::FD_CLOEXEC());
-        my $fd=fileno($file);$fail->() unless defined($fd)&&$fd>=3;
-        my @s=stat($file);@s=lstat($file_path);@s=stat($directory);@s=lstat($directory_path);
-        my $position=sysseek($file,0,0);$fail->() unless defined($position)&&$position==0;
-        my $bytes='';$first_length=sysread($file,$bytes,65536);
-        $fail->() unless Digest::SHA::sha256_hex($bytes) eq $digest;
-        $bytes='';$eof_length=sysread($file,$bytes,65536);
-        $position=sysseek($file,0,0);$fail->() unless defined($position)&&$position==0;
-        $bytes='';$second_length=sysread($file,$bytes,65536);
-        $fail->() unless Digest::SHA::sha256_hex($bytes) eq $digest;$matched=1;
-        @s=stat($file);@s=lstat($file_path);@s=stat($directory);@s=lstat($directory_path);
-        if($mode eq 'exhausted-read') {$bytes='';sysread($file,$bytes,65536);$fail->();}
-        close($file) or $check->();closedir($directory) or $check->();
-        1;
-      };
-      $primary=$@;
-      # Fixture-only finalizer bypasses sticky faults and operation queues.
-      for my $r(@owned) {
-        next if $r->{attempted};my $ok=eval {$dispose->($r)};my $error=$@;
-        unless($ok&&!length($error)&&$r->{closed}) {
-          $latch->();push @cleanup_errors,length($error)?$error:"TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_FALSE\n";
-        }
-      }
-    }
-    my $closed=grep {$_->{closed}} @owned;
-    my $self=$mode ne 'healthy';
-    my $expected_primary=$mode eq 'close-throw'?"TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n"
-      :$mode eq 'post-close-inspection-throw'?"TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n"
-      :"TEST_STAGED_FILE_PORT_HARNESS_FAULT\n";
-    die "TEST_STAGED_FILE_PORT_HARNESS_FAULT\n" unless $ports_ready&&$closed==@owned
-      &&($self?($nominated eq $mode&&$fault eq 'TEST_STAGED_FILE_PORT_HARNESS_FAULT'
-        &&($body_ok||$primary eq $expected_primary))
-        :($body_ok&&!length($primary)&&!length($fault)&&!@cleanup_errors
-          &&!@fcntl&&!@stat&&!@lstat&&!@seek&&!@read));
-    my $out={scope=>'ordinary-staged-file-ports-fixture-only',productionAuthority=>JSON::PP::false,
-      consumerInvoked=>JSON::PP::false,consumerClosed=>0,fixtureClosed=>0+$closed,
-      ownedCount=>scalar(@owned),definitelyClosed=>0+$closed,portsReady=>JSON::PP::true,
-      harnessFault=>length($fault)?$fault:undef,nominatedFault=>length($nominated)?$nominated:undef,
-      containedSelfFault=>$self?JSON::PP::true:JSON::PP::false,
-      dataMatched=>$matched?JSON::PP::true:JSON::PP::false,
-      firstLength=>$first_length,eofLength=>$eof_length,secondLength=>$second_length,
-      aliasWitness=>$alias_witness?JSON::PP::true:JSON::PP::false,primaryError=>$primary,
-      calls=>\%calls,core=>\%core,closeOrder=>\@close_order,events=>\@events,
-      cleanupErrors=>\@cleanup_errors,remaining=>{fcntl=>scalar(@fcntl),stat=>scalar(@stat),lstat=>scalar(@lstat),seek=>scalar(@seek),read=>scalar(@read)}};
-    print JSON::PP->new->canonical->utf8->encode($out);exit 0;
+
+    BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); }
+    use strict; use warnings; use Fcntl (); use JSON::PP (); use Digest::SHA ();
+    my ($file_path,$directory_path,$digest,$mode)=@ARGV;
+    my $directory_fh=defined($mode)&&$mode=~s/\Adirectory-fh-//?1:0;
+    my %modes=map {$_=>1} qw(healthy partial-acquisition inspection-fault alias forbidden-path forbidden-flags forbidden-exec caught-fault exhausted-read overflow close-false close-throw post-close-inspection-throw);
+    die "TEST_STAGED_FILE_PORT_HARNESS_FAULT\n" unless @ARGV==4&&$<!=0&&$<==$>
+      &&defined($mode)&&($modes{$mode}||($directory_fh&&$mode eq 'configuration-fault'))&&defined($directory_path)&&$directory_path=~m{\A/[^\r\n\0]+\z}
+      &&defined($file_path)&&$file_path eq $directory_path.'/task6a-origin-map-v2.pm'
+      &&defined($digest)&&$digest=~/\A[a-f0-9]{64}\z/;
+    my ($fault,$nominated)=('','');my $alias_witness=0;my @owned;my %roles;my @events;my @close_order;
+    my %calls=map {$_=>0} qw(sysopen opendir binmode fcntl stat lstat sysseek sysread fileno close closedir);
+    my %core=(fileOpen=>0,directoryOpen=>0,directoryFhOpen=>0,metadata=>0,fileClose=>0,directoryClose=>0);
+    my @fcntl=map {['file',@$_]} ([Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],[Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]);
+    push @fcntl,map {['directory',@$_]} ([Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],[Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]) if $directory_fh;
+    my @stat=qw(file directory file directory);my @lstat=@stat;my @seek=(0,0);my @read=(11684,0,11684);
+    my ($first_length,$eof_length,$second_length)=(undef,undef,undef);my $matched=0;
+    my $latch=sub {$fault='TEST_STAGED_FILE_PORT_HARNESS_FAULT';};
+    my $fail=sub {$latch->();die "$fault\n";};
+    my $check=sub {die "$fault\n" if length($fault);};
+    my $nominate=sub {
+      my ($kind)=@_;$fail->() unless $kind eq $mode&&!length($nominated);
+      $nominated=$kind;$fail->();
+    };
+    my $event=sub {
+      return 0 if length($fault);
+      if(@events>=96) {$latch->();return 0;}
+      my ($op,$role)=@_;my $e={seq=>1+@events,op=>$op,role=>$role};
+      unless(defined($op)&&defined($role)&&$op=~/\A[a-z-]{1,32}\z/
+        &&$role=~/\A[a-z-]{1,32}\z/&&length(JSON::PP->new->canonical->encode($e))<=512) {$latch->();return 0;}
+      push @events,$e;return 1;
+    };
+    my $register=sub {
+      my ($fh,$role,$directory,$disposal)=@_;
+      # Raw actual acquisition is owned before metadata or trace can fail.
+      for my $r(@owned) {$fail->() if $r->{fh}==$fh;}
+      # Original disposal type and FH are private lexical captures, not admission metadata.
+      my $r={fh=>$fh,role=>$role,directory=>$directory,attempted=>0,closed=>0,
+        originalKind=>sub {$disposal;},originalClose=>sub {
+          ++$core{$disposal eq 'dir-stream'?'directoryClose':'fileClose'};
+          return $disposal eq 'dir-stream'?CORE::closedir($fh):CORE::close($fh);
+        }};
+      push @owned,$r;$roles{$role}=$r;$event->('acquire',$role);$check->();
+      $nominate->('inspection-fault') if $mode eq 'inspection-fault'&&$role eq ($directory_fh?'directory':'file');
+      my $fd=CORE::fileno($fh);my @s=CORE::stat($fh);++$core{metadata};
+      $fail->() unless defined($fd)&&$fd>=3&&@s==13&&$s[4]==$<
+        &&($directory?Fcntl::S_ISDIR($s[2]):Fcntl::S_ISREG($s[2])&&$s[3]==1);
+      for my $other(@owned) {next if $other==$r;$fail->() if defined($other->{fd})&&$other->{fd}==$fd;}
+      $r->{fd}=$fd;$r->{identity}=[@s];return $r;
+    };
+    my $lookup=sub {
+      my ($fh,$allow_closed)=@_;$fail->() unless defined($fh)&&ref($fh);
+      for my $r(@owned) {
+        next unless $r->{fh}==$fh;
+        unless($allow_closed) {$fail->() if $r->{attempted}||$r->{closed}
+          ||!defined(CORE::fileno($fh))||CORE::fileno($fh)!=$r->{fd};}
+        return $r;
+      }
+      $fail->();
+    };
+    my $identity=sub {
+      my ($r,$s)=@_;$fail->() unless ref($s) eq 'ARRAY'&&@$s==13&&ref($r->{identity}) eq 'ARRAY';
+      for my $i($r->{directory}?(0,1,2,4,5):(0,1,2,3,4,5,7,9,10)) {
+        $fail->() unless defined($s->[$i])&&$s->[$i]==$r->{identity}[$i];
+      }
+    };
+    my $dispose=sub {
+      my ($r)=@_;return 0 if $r->{attempted};
+      $r->{attempted}=1;push @close_order,$r->{role};$event->('close-attempt',$r->{role});
+      $!=0;my $ok=eval {$r->{originalClose}->()};my $error=$@;my $errno=0+$!;
+      my $end;my $inspected=eval {$end=CORE::fileno($r->{fh});1;};my $inspection_error=$@;
+      $r->{closed}=1 if $ok&&!length($error)&&!$errno&&$inspected&&!length($inspection_error)&&!defined($end);
+      $event->('close-result',$r->{role});$fail->() unless $r->{closed};
+      if($r->{role} eq ($directory_fh?'directory':'file')&&$mode=~/\A(?:close-false|close-throw|post-close-inspection-throw)\z/) {
+        $nominated=$mode;$latch->();
+        return 0 if $mode eq 'close-false';
+        die "TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n" if $mode eq 'close-throw';
+        die "TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n";
+      }
+      return 1;
+    };
+    my $deny=sub {
+      $event->('denied','external');
+      $nominate->('forbidden-exec') if $mode eq 'forbidden-exec';
+      $fail->();
+    };
+    my ($body_ok,$primary);my @cleanup_errors;my $ports_ready=0;
+    {
+      no warnings qw(redefine once);
+      local *CORE::GLOBAL::sysopen=sub (*$$;$) {
+        $check->();++$calls{sysopen};
+        $fail->() unless @_==3&&!defined($_[0])&&!ref($_[1])&&!ref($_[2]);
+        my $role=$_[1] eq $file_path?'file':$directory_fh&&$_[1] eq $directory_path?'directory':'';
+        unless(length($role)) {$event->('denied','path');$nominate->('forbidden-path') if $mode eq 'forbidden-path';$fail->();}
+        my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()
+          |($role eq 'directory'?Fcntl::O_DIRECTORY():Fcntl::O_NONBLOCK());
+        if($_[2]!=$flags) {$event->('denied','flags');$nominate->('forbidden-flags') if $mode eq 'forbidden-flags';$fail->();}
+        if(defined($roles{$role})) {
+          if($mode eq 'alias') {my $candidate=$roles{$role}{fh};my $r=$lookup->($candidate,0);
+            $fail->() unless $role eq ($directory_fh?'directory':'file')
+              &&$r==$roles{$role}&&CORE::fileno($candidate)==$r->{fd};
+            $alias_witness=1;$event->('alias',$role);$nominate->('alias');}
+          $fail->();
+        }
+        if($role eq 'directory') {
+          $fail->() unless defined($roles{file});
+          $nominate->('partial-acquisition') if $mode eq 'partial-acquisition';
+        } else {$fail->() if @owned;}
+        CORE::sysopen(my $fh,$_[1],$flags) or $fail->();
+        ++$core{$role eq 'directory'?'directoryFhOpen':'fileOpen'};
+        $register->($fh,$role,$role eq 'directory'?1:0,'fh');$_[0]=$fh;return 1;
+      };
+      local *CORE::GLOBAL::opendir=sub (*$) {
+        $check->();++$calls{opendir};$fail->() if $directory_fh;$fail->() unless @_==2&&!defined($_[0])&&!ref($_[1])
+          &&$_[1] eq $directory_path&&!defined($roles{directory})&&defined($roles{file});
+        $nominate->('partial-acquisition') if $mode eq 'partial-acquisition';
+        CORE::opendir(my $fh,$directory_path) or $fail->();++$core{directoryOpen};
+        $register->($fh,'directory',1,'dir-stream');$_[0]=$fh;return 1;
+      };
+      local *CORE::GLOBAL::binmode=sub (*;$) {
+        $check->();$fail->() unless @_==1&&$calls{binmode}++==0;
+        my $r=$lookup->($_[0],0);$fail->() unless $r->{role} eq 'file';
+        CORE::binmode($_[0]) or $fail->();$event->('binmode','file');return 1;
+      };
+      local *CORE::GLOBAL::fcntl=sub (*$$) {
+        $check->();$fail->() unless @_==3&&@fcntl;my $r=$lookup->($_[0],0);
+        my $want=shift @fcntl;$fail->() unless $r->{role} eq $want->[0]&&$_[1]==$want->[1]&&$_[2]==$want->[2];
+        $!=0;my $v=CORE::fcntl($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&!$!;
+        ++$calls{fcntl};$event->('fcntl',$r->{role});
+        $nominate->('configuration-fault') if $directory_fh&&$mode eq 'configuration-fault'
+          &&$r->{role} eq 'directory'&&$_[1]==Fcntl::F_SETFD();
+        return $v;
+      };
+      local *CORE::GLOBAL::stat=sub (;*) {
+        $check->();$fail->() unless @_==1&&wantarray&&@stat;my $r=$lookup->($_[0],0);
+        $fail->() unless $r->{role} eq shift(@stat);my @s=CORE::stat($_[0]);$identity->($r,\@s);
+        ++$calls{stat};$event->('stat',$r->{role});return @s;
+      };
+      local *CORE::GLOBAL::lstat=sub (;*) {
+        $check->();$fail->() unless @_==1&&wantarray&&@lstat&&!ref($_[0]);
+        my $role=shift @lstat;my $r=$roles{$role};$fail->() unless defined($r)
+          &&$_[0] eq ($role eq 'file'?$file_path:$directory_path);
+        my @s=CORE::lstat($_[0]);$identity->($r,\@s);
+        ++$calls{lstat};$event->('lstat',$role);return @s;
+      };
+      local *CORE::GLOBAL::sysseek=sub (*$$) {
+        $check->();$fail->() unless @_==3&&@seek;my $r=$lookup->($_[0],0);
+        my $want=shift @seek;$fail->() unless $r->{role} eq 'file'&&$_[1]==$want&&$_[2]==0;
+        my $v=CORE::sysseek($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&$v==0;
+        ++$calls{sysseek};$event->('seek','file');return $v;
+      };
+      local *CORE::GLOBAL::sysread=sub (*\$$;$) {
+        $check->();$fail->() unless @_==3&&ref($_[1]) eq 'SCALAR'&&$_[2]==65536;
+        my $r=$lookup->($_[0],0);$fail->() unless $r->{role} eq 'file';
+        unless(@read) {$nominate->('exhausted-read') if $mode eq 'exhausted-read';$fail->();}
+        my $want=shift @read;my $buffer=$_[1];$fail->() unless !ref($$buffer)&&$$buffer eq '';
+        $!=0;my $n=CORE::sysread($_[0],$$buffer,$_[2]);$fail->() unless defined($n)&&!$!
+          &&$n==$want&&length($$buffer)==$n&&!utf8::is_utf8($$buffer);
+        ++$calls{sysread};$event->('read','file');return $n;
+      };
+      local *CORE::GLOBAL::fileno=sub (*) {
+        $check->();$fail->() unless @_==1;my $r=$lookup->($_[0],0);
+        ++$calls{fileno};$event->('fileno',$r->{role});return CORE::fileno($_[0]);
+      };
+      local *CORE::GLOBAL::close=sub (;*) {
+        $fail->() unless @_==1;my $r=$lookup->($_[0],1);$fail->() unless $r->{originalKind}->() eq 'fh';
+        ++$calls{close};return $dispose->($r);
+      };
+      local *CORE::GLOBAL::closedir=sub (*) {
+        $fail->() unless @_==1;my $r=$lookup->($_[0],1);$fail->() unless $r->{originalKind}->() eq 'dir-stream';
+        ++$calls{closedir};return $dispose->($r);
+      };
+      local *CORE::GLOBAL::exec=$deny;local *CORE::GLOBAL::system=$deny;
+      local *CORE::GLOBAL::open=sub (*;$@) {$deny->();};local *CORE::GLOBAL::syswrite=sub (*$;$$) {$deny->();};
+      local *CORE::GLOBAL::readdir=sub (*) {$deny->();};local *CORE::GLOBAL::pipe=sub (**) {$deny->();};
+      local *CORE::GLOBAL::fork=sub () {$deny->();};local *CORE::GLOBAL::waitpid=sub ($$) {$deny->();};
+      local *CORE::GLOBAL::kill=sub (@) {$deny->();};local *CORE::GLOBAL::readpipe=sub (_) {$deny->();};
+      local *CORE::GLOBAL::unlink=sub (@) {$deny->();};local *CORE::GLOBAL::mkdir=sub (_;$) {$deny->();};
+      local *CORE::GLOBAL::rmdir=sub (_) {$deny->();};local *CORE::GLOBAL::rename=sub ($$) {$deny->();};
+      local *CORE::GLOBAL::chdir=sub (;$) {$deny->();};local *CORE::GLOBAL::truncate=sub ($$) {$deny->();};
+      local *CORE::GLOBAL::socket=sub (*$$$) {$deny->();};local *CORE::GLOBAL::socketpair=sub (**$$$) {$deny->();};
+      local *CORE::GLOBAL::connect=sub (*$) {$deny->();};local *CORE::GLOBAL::accept=sub (**) {$deny->();};
+      my %prototypes=(sysopen=>'*$$;$',opendir=>'*$',
+        binmode=>'*;$',fcntl=>'*$$',stat=>';*',lstat=>';*',sysseek=>'*$$',
+        sysread=>'*\$$;$',fileno=>'*',close=>';*',closedir=>'*');
+      for my $op(sort keys %prototypes) {
+        my $port='CORE::GLOBAL'->can($op);my $actual=prototype('CORE::'.$op);
+        $fail->() unless defined($port)&&ref($port) eq 'CODE'&&defined($actual)
+          &&$actual eq $prototypes{$op}&&defined(prototype($port))&&prototype($port) eq $actual;
+      }
+      for my $op(qw(exec system)) {my $port='CORE::GLOBAL'->can($op);
+        $fail->() unless defined($port)&&ref($port) eq 'CODE'&&!defined(prototype($port));}
+      $ports_ready=1;
+      $body_ok=eval q{
+        my ($file,$directory);my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK();
+        sysopen($file,$file_path,$flags) or $fail->();
+        my $directory_flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY();
+        if($directory_fh) {sysopen($directory,$directory_path,$directory_flags) or $fail->();}
+        else {opendir($directory,$directory_path) or $fail->();}
+        if($mode eq 'alias') {my $other;sysopen($other,$directory_fh?$directory_path:$file_path,
+          $directory_fh?$directory_flags:$flags);$fail->();}
+        if($mode eq 'forbidden-path') {my $other;sysopen($other,$file_path.'/unselected',$flags);$fail->();}
+        if($mode eq 'forbidden-flags') {my $other;sysopen($other,$file_path,Fcntl::O_WRONLY());$fail->();}
+        if($mode eq 'forbidden-exec') {CORE::GLOBAL::exec('/bin/false');$fail->();}
+        if($mode eq 'caught-fault') {eval {$nominate->('caught-fault');};$check->();}
+        if($mode eq 'overflow') {for(1..97) {$event->('overflow','fixture');}
+          $nominated='overflow';$check->();}
+        binmode($file) or $fail->();
+        my $fl=fcntl($file,Fcntl::F_GETFL(),0);
+        $fail->() unless defined($fl)&&($fl&Fcntl::O_ACCMODE())==Fcntl::O_RDONLY()&&($fl&Fcntl::O_NONBLOCK());
+        my $fd_flags=fcntl($file,Fcntl::F_GETFD(),0);$fail->() unless defined($fd_flags);
+        fcntl($file,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or $fail->();
+        $fd_flags=fcntl($file,Fcntl::F_GETFD(),0);$fail->() unless defined($fd_flags)&&($fd_flags&Fcntl::FD_CLOEXEC());
+        if($directory_fh) {
+          my $directory_fl=fcntl($directory,Fcntl::F_GETFL(),0);
+          $fail->() unless defined($directory_fl)&&($directory_fl&Fcntl::O_ACCMODE())==Fcntl::O_RDONLY();
+          my $directory_fd_flags=fcntl($directory,Fcntl::F_GETFD(),0);
+          $fail->() unless defined($directory_fd_flags);
+          fcntl($directory,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or $fail->();
+          $directory_fd_flags=fcntl($directory,Fcntl::F_GETFD(),0);
+          $fail->() unless defined($directory_fd_flags)&&($directory_fd_flags&Fcntl::FD_CLOEXEC());
+        }
+        my $fd=fileno($file);$fail->() unless defined($fd)&&$fd>=3;
+        my @s=stat($file);@s=lstat($file_path);@s=stat($directory);@s=lstat($directory_path);
+        my $position=sysseek($file,0,0);$fail->() unless defined($position)&&$position==0;
+        my $bytes='';$first_length=sysread($file,$bytes,65536);
+        $fail->() unless Digest::SHA::sha256_hex($bytes) eq $digest;
+        $bytes='';$eof_length=sysread($file,$bytes,65536);
+        $position=sysseek($file,0,0);$fail->() unless defined($position)&&$position==0;
+        $bytes='';$second_length=sysread($file,$bytes,65536);
+        $fail->() unless Digest::SHA::sha256_hex($bytes) eq $digest;$matched=1;
+        @s=stat($file);@s=lstat($file_path);@s=stat($directory);@s=lstat($directory_path);
+        if($mode eq 'exhausted-read') {$bytes='';sysread($file,$bytes,65536);$fail->();}
+        if($directory_fh) {close($directory) or $check->();close($file) or $check->();}
+        else {close($file) or $check->();closedir($directory) or $check->();}
+        1;
+      };
+      $primary=$@;
+      # Fixture-only finalizer bypasses sticky faults and operation queues.
+      for my $r(@owned) {
+        next if $r->{attempted};my $ok=eval {$dispose->($r)};my $error=$@;
+        unless($ok&&!length($error)&&$r->{closed}) {
+          $latch->();push @cleanup_errors,length($error)?$error:"TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_FALSE\n";
+        }
+      }
+    }
+    my $closed=grep {$_->{closed}} @owned;
+    my $self=$mode ne 'healthy';
+    my $expected_primary=$mode eq 'close-throw'?"TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n"
+      :$mode eq 'post-close-inspection-throw'?"TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n"
+      :"TEST_STAGED_FILE_PORT_HARNESS_FAULT\n";
+    die "TEST_STAGED_FILE_PORT_HARNESS_FAULT\n" unless $ports_ready&&$closed==@owned
+      &&($self?($nominated eq $mode&&$fault eq 'TEST_STAGED_FILE_PORT_HARNESS_FAULT'
+        &&($body_ok||$primary eq $expected_primary))
+        :($body_ok&&!length($primary)&&!length($fault)&&!@cleanup_errors
+          &&!@fcntl&&!@stat&&!@lstat&&!@seek&&!@read));
+    my $out={scope=>'ordinary-staged-file-ports-fixture-only',productionAuthority=>JSON::PP::false,
+      consumerInvoked=>JSON::PP::false,consumerClosed=>0,
+      directoryFhProfile=>$directory_fh?JSON::PP::true:JSON::PP::false,fixtureClosed=>0+$closed,
+      ownedCount=>scalar(@owned),definitelyClosed=>0+$closed,portsReady=>JSON::PP::true,
+      harnessFault=>length($fault)?$fault:undef,nominatedFault=>length($nominated)?$nominated:undef,
+      containedSelfFault=>$self?JSON::PP::true:JSON::PP::false,
+      dataMatched=>$matched?JSON::PP::true:JSON::PP::false,
+      firstLength=>$first_length,eofLength=>$eof_length,secondLength=>$second_length,
+      aliasWitness=>$alias_witness?JSON::PP::true:JSON::PP::false,primaryError=>$primary,
+      calls=>\%calls,core=>\%core,closeOrder=>\@close_order,events=>\@events,
+      cleanupErrors=>\@cleanup_errors,remaining=>{fcntl=>scalar(@fcntl),stat=>scalar(@stat),lstat=>scalar(@lstat),seek=>scalar(@seek),read=>scalar(@read)}};
+    print JSON::PP->new->canonical->utf8->encode($out);exit 0;
 `;
@@
+function stagedDirectoryFhPorts(mode='healthy') {
+  const out=stagedFilePorts('directory-fh-'+mode);
+  assert.equal(out.directoryFhProfile,true);return out;
+}
 function stagedFilePorts(mode='healthy') {
@@
-  assert.equal(out.consumerClosed,0);assert.equal(out.portsReady,true);return out;
+  assert.equal(out.consumerClosed,0);assert.equal(out.portsReady,true);
+  if(!mode.startsWith('directory-fh-')) {
+    assert.equal(out.directoryFhProfile,false);assert.equal(out.core.directoryFhOpen,0);
+  }
+  return out;
*** End Patch
```

#### Actual Task2b.4 execution checkpoint and transport refinement

Design26e54ba76f8940e5d663a95013f362d5f2e16abf/treef7c34.
Test-onlyb008/306322B and fullbridgeb7a3/308982B both exactly matched literal
predictions and two independent actual-delta C0 reviews. Source4aa/spec8e9
unchanged. Syntax/diff3d970c/49daaa0. ONEactualhealthyREDbdb2a4 naturallyCLOSED1,
full output read: genuine missing-adapter JS AssertionError2335 before helper
IO/Perl. This is fixture-adapter RED only. ONEfocus752385 naturallyCLOSED0,
all output read:27PASS0FAIL/CANCEL/SKIP/TODO380.007917ms. Immediate roote848de/
b7ebff all2093outside-mapped-test Git exact/npm166c6/fixedtools/Perl/MAP/absence
matched. English/path8a0631 naturally0:1931/966files.

First unfiltered invocation0e8380→e74bb3→42af5b managed91281 naturallyCLOSED0:
1159PASS0FAIL/CANCEL/SKIP/TODO76707.188125ms. No test failure observed.
However e74bb3 raw tool output was truncated by327tokens inside the parent
write-short-completion cases. Its other1031line head/tail and terminal tail
were retained, but missing bytes cannot be invented or called fully read.
This invocation is NOT qualified for the complete-output-read gate.
Do not poll91281 again or rerun any predecessor tests/builds.

Causal transport refinement: one replacement verification invocation of the SAME
scrubbed unfiltered command above is admitted only after two exact reviews and
fresh source/tools/preservation/resource preflight. This is necessary because
the first terminal-success transcript is incomplete, not a product fix or
semantic RED. No source/test or expected-result change. Root sets BOTH nested
exec_command/write_stdin max_output_tokens50000, preserves each raw result in
session memory, and emits only small metadata initially. Then root reads each
complete preserved output in bounded slices through EOF; outer rendering
truncation cannot erase the preserved raw bytes. If a raw result contains the
tool truncation marker, do not credit complete output or blindly retry.
Root alone polls the new live session to natural closure. No rerun of oldclosed
sessions, no new logs/fixture files, no native/DB/service/credential effects.
After actual complete-read positive, record its distinct invocation identity and
terminal evidence; only that complete transcript satisfies Step3 delivery gate.

Actual replacement08b2f7→fba6bd→fc96f0 managed32974 naturallyCLOSED0:
1159PASS0FAIL/CANCEL/SKIP/TODO76848.938208ms. Both nonempty raw chunks were
preserved before rendering; neither contains a tool truncation marker. Root read
first1031event/diagnostic lines in six bounded pages, then all terminal137lines
through EOF. Complete joined transcript100117UTF8B/1168lines includes1159actual
pass events, one existing diagnostic and eight summary lines. NOPOLL32974 and
NORETEST after closure. Independent pre-effect transport C0 reviews and fresh
inventory23:12:39–42/root7bab1423:13:06 source/tools/fixture/npm/absence passed.
Postfull2d657f23:15:01 all2093outside-two-mapped-files Git exact/testb7a3/spec8e9/
bootstrap4aa/npm166c6/tools/Perl/MAP/absence unchanged. Steps1–3 complete only;
Step4 remained open at that checkpoint. Its later actual ordinary completion is
recorded below; this does not close any staged/protected/native/operational gate.

Step4 actual completion: exact head d6f649ec was delivered through PR271 after
two independent whole-branch C0 reviews, complete actual Codex no-major-issues
feedback and successful GitGuardian zero-annotation checks. Normal SHA-bound
merge3e94dad9 has valid signature, parents42c57386/d6f649ec and tree2a449c2d.
A separate owned clean-main clone fast-forwarded to that exact merge. One scoped
locked ignore-scripts CI naturally closed0; sixteen installed versions matched
the lock and platform-incompatible optional packages remained correctly absent.
Two independent reviews of the exact build wrapper and fresh preservation/resource/
source/dependency/tool gates admitted one normal guarded build. Actual npm exit
AND close0/null occurred at2026-10-03T23:39:50.713Z; all5661 held originals were
revalidated and outer finalization closed without errors. Build
ead4c226-5f4b-4e89-a108-2bc15d41d4aa produced858 outputs/47directories/exact861
regular files including three immutable authority files. Independent master and
inventory postaudits reproduced source, dependencies/npm, all output bytes/modes,
authority physical pins, Git-derived input and actual output commitments, converter and
empty archive/ledgers. Original two files, prior roots/cache/builds and journal
remained preserved; HTTP3080/18789 were200 while3333 retained its known refusal.
Closed test/build sessions were not rerun or repolled. This completes Task2b.4
only. Actual staged declarations, authentic creator/publisher, complete core/XS,
native, SQL, service and final cutover retain separate uncompleted gates.

### Task 2b.5: Actual staged owner — literal preparation checkpoint

**Goal:** Implement the three private zero-argument staged operations, not a
second adapter, while leaving the production admission absent and main refused.

**Files:** Existing bootstrap, its existing test, this plan and its named spec.
Base ordinary merge3e94dad9; committed design3ea41372. Preserve all earlier
roots, builds, caches, journal and the original two files. Root is the only writer.

**Interfaces:** `task6a_origin_hold_staged_custody()`,
`task6a_origin_recheck_staged_custody()` and
`task6a_origin_release_staged_custody()` consume no arguments and export only
the diagnostic fields fixed by the spec. No producer, initializer, callback,
path/hash setter, returned descriptor or production entry is added.

This checkpoint is source-only preparation, NOT an executable subplan admission.
The complete source literal, combined dispatcher, finite queues, exact initializer
and negative-prefix witnesses must receive two independent reviews before any
new test or declaration execution. Do not interpret the counts below as observed
runtime results or replay any closed predecessor invocation.

- [x] Read actual validators/capture/FD parser and the existing test dispatch.
- [x] Obtain two independent read-only contract/count investigations.
- [ ] Freeze complete source/test/initializer/trace literals and self-review.
- [ ] Two independent exact-candidate reviews and fresh preservation preflight.
- [ ] Observe genuine missing-actual-declarations RED before fixture setup.
- [ ] Implement the actual consumer, then positive/negative/mutation GREEN.
- [ ] Whole branch review, complete-output tests, normal PR delivery/own-main
  build and two preservation/artifact postaudits. No protected or service effect.

#### Source-derived healthy accounting

Select six nonempty ordinary fixture leaves, each at most65536B. Do not silently
change this premise when selecting backing files. New guards are exactly hold
entry, hold completion, recheck entry and recheck completion; all compare the
unchanged bootstrap deadline. Release has zero validity clocks/helpers. Existing
held-file validation runs once during acquisition and twice in each complete
hold/recheck epoch: five validations per leaf. Directory validation runs once
immediately after each acquisition and twice in each complete epoch: five per
directory. These are validator invocations, not atomic snapshot claims.

| Operation | Hand-derived healthy count | Scope |
| --- | ---: | --- |
| Startup clock | 1 | Existing bootstrap initialization |
| Captor clocks | 252 | 42 helpers times6 |
| Directory-validator clocks | 60 | 30 checks times2 |
| Held-file-validator clocks | 90 | 30 checks times3, one-chunk nonempty leaves |
| New boundary clocks | 4 | Hold/recheck entry/completion only |
| Whole clocks | 407 | Conditional on the exact literals above |
| Staged sysopen | 12 | Six directory FHs then six file FHs |
| Pipe acquisitions | 168 | 42 helpers times4 pairs;336 FHs |
| Census DIR acquisitions | 42 | One per helper; not a directory FH |
| Owned originals | 390 | 12+336+42; hidden rescue accounted separately |
| Census readdir | 1083 | Sum(15+S), S=1..6 then36 times12 |
| Synthetic waits/readiness/forks | 168/84/42 | Never kernel child actions |
| Actual pipe reads | 168 | Data,stderrEOF,setupEOF,stdoutEOF per helper |
| Validator stat/lstat | 120/120 | Acquisition inspections are additional |
| File seeks/reads | 30/60 | Actual seek/data/EOF; no nominated byte receipt |

Do not count acquisition metadata twice or infer its final totals before the
actual source literal is fixed. Four fcntls per staged original would contribute
48 to the42 existing setup fcntls, hence90; six staged binary modes plus336 pipe
modes would give342. Six directory and six file pre-open lstat calls would give
132 total lstat. These three totals remain conditional on the selected exact
configuration/acquisition implementation, not independently observed facts.
For larger leaves, add five clocks per additional65536B chunk per leaf. More
retained originals change every helper census; the ordinary positive initializes
no old parent/file/directory/Perl owner. A foreign-owner negative must explicitly
account for its extra original and must not inherit the positive counts.

#### Combined dispatcher placement and ownership rules

Select one new closed `staged-custody` branch/constant beside the existing captor
program, interpolated before competing branches in `systemObject`. Preserve old
standalone constants and old kinds. Extend the8MiB output allowance only for this
closed kind; keep scrubbed environment, Apple Perl, ordinary UID refusal, sole
main removal and timeout unchanged. Apply only the uniquely anchored denied-exec
memory syntax mapping already admitted for captor tests. Do not nest CORE hooks,
replace `acl_free`/capture outcomes, or execute the old adapter as a child.

The dispatcher has one independent original registry for staged FHs, current
helper pipes, current census DIR and fixture-only hidden acquisitions. Before
each helper, initialize its four pipe-pair roles, four waits, two readiness
rounds, read queues, selector, census entries and setup-fcntl ordinal. All queues
are finite and typed. Retain closed history for accounting but enumerate only
currently live originals and the current census DIR. Verify selector membership
using actual IO::Select handles/count/removal. Primitive fixture lookups use
CORE::fileno internally; the ported source fileno wrapper must also recognize
known definitely closed originals during the existing final close loop.

Do not reuse `@owned==8`, single-fork or single-fcntl assertions from the old
one-helper program. Its ordinary register/lookup currently performs value and
fileno operations before any B guard; malformed-handle nominations therefore
need a callback-free pre-value branch, not a blind copy of that lookup.

Acquisition nominees distinguish: distinct exposed success; exposed false;
exposed throw; same-reference alias; known live-FD alias; unknown/tied/magical/
overloaded binding; ordinary undefined output; and raw CORE success hidden
before output assignment. Seal every distinct exposed native original before
metadata/configuration/trace. Hidden originals stay in the fixture rescue
registry and never increase consumerClosed. A failed acquisition burns even
when an exposed native original is definitely cleaned up. Unknown ownership
never grants positive release or leak-freedom. No borrowed alias receives its
own close obligation.

#### Admission and callback-free guard implementation requirements

B-check the original scalar cell before accessing its value. For containers,
require a plain reference cell, then native unblessed/unmagical PVHV/PVAV before
keys/indexing; validate exact keys and every nested scalar cell before coercion.
For a pending FH, a plain undefined cell means no exposed original. Otherwise
require B::IV with ROK, native B::GV and native B::IO. Cell/GV reject mask
0x00f00000; IO rejects0x00e00000 and all MAGIC. Native IO's object bit alone is
legitimate. No candidate methods, indirect names, tied lookup or caller classifier.
Only then may CORE::fileno and native-reference/live-FD comparisons run.

Check the admitted object/array/row references as well as exact key sets,
ordered roles, root path, creation identity and byte strings. Copy expectations
once independently after initial guarded validation; never regenerate hashes
from mutable admission during recheck. Four source bytes join the unchanged Git
blob pins via literal blob framing. Vendor bytes join the unchanged official
SHA256 pin. Selected archiveRef joins the original vendor object; actual selected
byte derivation still belongs to a later authentic private producer.

Alias checks must include already retained staged originals and known other
bootstrap owners. The exact set is `@parent_originals` (including entropy slot4),
`@physical_owned_handles`, and actual FH bindings from `@file_ledger` and
`@directory_ledger`, with overlaps deduplicated. Never use `$parent_admission`,
stored FD/identity/path/hash values, historical closed FD numbers or caller
census entries as ownership. Validate the actual bindings before comparison and
inspect actual live FDs through CORE. A contaminated or uninspectable known-owner
registry refuses before a new acquisition. Freeze its reference set for this
owner; retain strong references but acquire no borrowed disposal obligation.

The current captor's pipe `@handles` is invocation-local, not in
`@helper_ledger`; that ledger supplies PID/settlement facts only. Require actual
helpers settled before stage acquisition and prohibit reentrant acquisition
during a capture. The ordinary positive initializes no such older owner; a
negative foreign-owner fixture is separately bounded and must preserve its own
owner's cleanup obligation.

A plain native FH is not proof of arbitrary foreign ownership. Trusted native
sysopen provenance and lower-port corruption remain distinct. The independent
dispatcher records actual CORE acquisition/exposure/hiding as fixture-integrity
evidence, never as a producer token. Representation plus fileno cannot classify
an arbitrary unknown native FH nominated by a corrupted primitive as newly
owned. Do not claim generic resistance to arbitrary Perl-op replacement or a
global ownership census. Known other-owner reference/live-FD aliases refuse
without staged close; unknown provenance remains uncertain/nonpositive. Cleanup
closes its lexically captured original/primitive, never a mutable metadata FH.
Mark attempt before close, catch each failure and continue. If an original has
become magical, record uncertainty rather than invoke a tied callback; all other
sealed originals still receive their attempt. Close plus actual undefined
CORE::fileno is necessary for a positive definite-close fact. Release bypasses
validity clocks, admission, helpers and deadline but never this ownership guard.

Required negative witnesses include tied output cell, tied GV/IO, blessed or
overloaded binding, indirect handle name, plain non-FH reference, exposed alias,
exposed false/throw and hidden raw rescue. Each malformed binding must prove zero
candidate callbacks, rather than merely observing a final refusal. Known-native
positive must pass so an always-refusing guard cannot satisfy the suite.

#### Literal callback-free shape predicates — unexecuted candidate

Place the following private predicates immediately before the current private
parent-admission declaration. They are a component of the forthcoming complete
source literal, not a standalone adapter deliverable or permission to execute.
Their closures receive references manufactured by this private implementation,
never caller-provided classifier callbacks. Shape rejection uses the existing
canonical refusal. The enclosing pending-acquisition handler must separately
retain classification uncertainty; catching this refusal alone is insufficient.

```perl
my $staged_plain_cell=sub {
    my ($cell)=@_;
    my $sv=B::svref_2object($cell);
    task6a_origin_refuse() if $sv->FLAGS & 0x00f00000;
    # No candidate value has been accessed yet. B object dispatch is on the
    # installed introspection object, never on the candidate.
    return $sv;
};
my $staged_scalar=sub {
    my ($cell)=@_;
    my $sv=$staged_plain_cell->($cell);
    task6a_origin_refuse() if $sv->FLAGS & B::SVf_ROK();
    task6a_origin_refuse() unless defined($$cell);
    return $$cell;
};
my $staged_container=sub {
    my ($cell,$kind)=@_;
    my $sv=$staged_plain_cell->($cell);
    task6a_origin_refuse() unless ref($sv) eq 'B::IV'
        &&($sv->FLAGS & B::SVf_ROK());
    my $rv=$sv->RV;
    task6a_origin_refuse() unless ref($rv) eq $kind;
    task6a_origin_refuse() if $rv->FLAGS & 0x00f00000;
    my $magic=$rv->MAGIC;
    task6a_origin_refuse() if defined($magic);
    return $$cell;
};
my $staged_vector=sub {
    my ($reference)=@_;
    # reference is manufactured privately with \@vector. Inspect the original
    # AV before length/index/iteration; taking its reference does not FETCH it.
    my $av=B::svref_2object($reference);
    task6a_origin_refuse() unless ref($av) eq 'B::AV';
    task6a_origin_refuse() if $av->FLAGS & 0x00f00000;
    my $magic=$av->MAGIC;
    task6a_origin_refuse() if defined($magic);
};
my $staged_native_fh=sub {
    my ($cell,$allow_empty)=@_;
    my $sv=$staged_plain_cell->($cell);
    unless($sv->FLAGS & B::SVf_ROK()) {
        return 0 if $allow_empty&&!defined($$cell);
        task6a_origin_refuse();
    }
    task6a_origin_refuse() unless ref($sv) eq 'B::IV';
    my $gv=$sv->RV;
    task6a_origin_refuse() unless ref($gv) eq 'B::GV';
    task6a_origin_refuse() if $gv->FLAGS & 0x00f00000;
    my $gv_magic=$gv->MAGIC;
    task6a_origin_refuse() if defined($gv_magic);
    my $io=$gv->IO;
    task6a_origin_refuse() unless ref($io) eq 'B::IO';
    # Ordinary native IO has SVs_OBJECT. Magic, not that bit, admits FILENO
    # callbacks; the scalar and GV object bits were already rejected above.
    task6a_origin_refuse() if $io->FLAGS & 0x00e00000;
    my $io_magic=$io->MAGIC;
    task6a_origin_refuse() if defined($io_magic);
    return 1;
};
```

These literals deliberately do not call candidate `ref`, comparisons, FILENO,
methods or stringification before the shape gate. Scalar/container operations
after the gate still need real negative callback counters. Do not claim the
single previous native diagnostic proved `SVf_ROK`, empty-cell handling,
container MAGIC handling or these complete predicates. In particular the guard
is not provenance: a plain native foreign FH can satisfy this predicate and must
still be rejected by the private native acquisition/known-owner alias contract.

The complete source candidate must add an absent admission, independently
retained references/scalars/byte commitments, pending-output handling, sealed
cleanup closures, known other-owner alias checks, six ancestry/six-leaf
acquisition, actual epoch validators and all three zero-argument declarations.
Do not insert these predicates alone into production or call this slice GREEN.

#### Literal private admission reader — unexecuted candidate

Append this component after the shape predicates. Runtime class arguments are
`B::HV`/`B::AV`, not C SV-type names. The fixed ordered roles are
`archive-helper`, `native-helper`, `map-helper`, `entry`. The future private
producer and the memory-only fixture must both use these exact inert role labels.
The reader does not authenticate selected-member derivation or acquire any FH.

```perl
my $staged_admission;
my $staged_snapshot;
my $staged_phase='absent';
my ($staged_invalid,$staged_uncertain,$staged_disposal_started)=(0,0,0);
my (@staged_files,@staged_directories,@staged_originals,@staged_foreign,@staged_pending);
my @staged_policy=(
    ['archive-helper','source/task6a-origin-archive-v2.pm',
        'da1fd458fcaba775be5ba09ef88157b5ee48dbda',0400],
    ['native-helper','source/task6a-origin-native-v2.pm',
        '59e1ae8de38cf2083a0294c55454083840eb47f1',0400],
    ['map-helper','source/task6a-origin-map-v2.pm',
        '9719bf4f3676b43b7858e3cabe3cee3e679120f8',0400],
    ['entry','source/task6a-protected-origin-entry-v2.mjs',
        'e53be63cdcdf286dc89adbec9770668b1fdb9cc7',0444],
);
my $staged_vendor_pin='ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953';
my $staged_keys=sub {
    my ($hash,$literal)=@_;
    task6a_origin_refuse() unless join(',',sort keys %$hash) eq $literal;
};
my $staged_bytes=sub {
    my ($cell,$limit)=@_;
    my $sv=$staged_plain_cell->($cell);
    task6a_origin_refuse() unless ($sv->FLAGS & B::SVf_POK())
        &&!($sv->FLAGS & B::SVf_ROK());
    my $bytes=$staged_scalar->($cell);
    task6a_origin_refuse() if utf8::is_utf8($bytes);
    task6a_origin_refuse() unless length($bytes)>0&&length($bytes)<=$limit;
    return $bytes;
};
my $staged_read_admission=sub {
    my $admit=$staged_container->(\$staged_admission,'B::HV');
    $staged_keys->($admit,'creator,selected,sources,vendor');
    my $creator=$staged_container->(\($admit->{creator}),'B::HV');
    $staged_keys->($creator,'creationIdentity,rootPath');
    my $root=$staged_scalar->(\($creator->{rootPath}));
    task6a_origin_refuse() unless !utf8::is_utf8($root)&&length($root)<=1024
        &&$root =~ m{\A/private/tmp/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\z};
    my $creation=$staged_container->(\($creator->{creationIdentity}),'B::AV');
    task6a_origin_refuse() unless @$creation==13;
    my @creation;
    for my $index(0..12) {
        my $cell=\($creation->[$index]);
        my $sv=$staged_plain_cell->($cell);
        task6a_origin_refuse() if $sv->FLAGS & (B::SVf_ROK()|B::SVf_POK());
        task6a_origin_refuse() unless $sv->FLAGS & B::SVf_IOK();
        my $value=$staged_scalar->($cell);
        task6a_origin_refuse() unless $value>=0&&$value<=9223372036854775807;
        push @creation,$value;
    }
    task6a_origin_refuse() unless Fcntl::S_ISDIR($creation[2])
        &&$creation[4]==0&&$creation[5]==0;
    my $sources=$staged_container->(\($admit->{sources}),'B::AV');
    task6a_origin_refuse() unless @$sources==4;
    my @refs=($admit,$creator,$creation,$sources);
    my @values=($root,@creation);
    my @bytes;
    for my $index(0..3) {
        my $row=$staged_container->(\($sources->[$index]),'B::HV');
        $staged_keys->($row,'bytes,gitBlobSha,relativePath,role');
        my $role=$staged_scalar->(\($row->{role}));
        my $path=$staged_scalar->(\($row->{relativePath}));
        my $sha=$staged_scalar->(\($row->{gitBlobSha}));
        task6a_origin_refuse() unless $role eq $staged_policy[$index][0]
            &&$path eq $staged_policy[$index][1]&&$sha eq $staged_policy[$index][2];
        my $body=$staged_bytes->(\($row->{bytes}),2097152);
        push @refs,$row;push @values,$role,$path,$sha,$body;push @bytes,$body;
    }
    my $vendor=$staged_container->(\($admit->{vendor}),'B::HV');
    $staged_keys->($vendor,'bytes,filename');
    my $filename=$staged_scalar->(\($vendor->{filename}));
    task6a_origin_refuse() unless $filename eq 'node-v22.23.1-darwin-arm64.tar.gz';
    my $archive=$staged_bytes->(\($vendor->{bytes}),134217728);
    my $selected=$staged_container->(\($admit->{selected}),'B::HV');
    $staged_keys->($selected,'archiveRef,bytes,memberName');
    my $archive_ref=$staged_container->(\($selected->{archiveRef}),'B::HV');
    task6a_origin_refuse() unless $archive_ref==$vendor;
    my $member=$staged_scalar->(\($selected->{memberName}));
    task6a_origin_refuse() unless $member eq 'node-v22.23.1-darwin-arm64/bin/node';
    my $native=$staged_bytes->(\($selected->{bytes}),134217728);
    push @refs,$vendor,$selected,$archive_ref;
    push @values,$filename,$archive,$member,$native;
    push @bytes,$archive,$native;
    return {refs=>\@refs,values=>\@values,root=>$root,creation=>\@creation,bytes=>\@bytes};
};
my $staged_check_admission=sub {
    my $now=$staged_read_admission->();
    task6a_origin_refuse() unless defined($staged_snapshot)
        &&@{$now->{refs}}==@{$staged_snapshot->{refs}}
        &&@{$now->{values}}==@{$staged_snapshot->{values}};
    for my $index(0..$#{$now->{refs}}) {
        # A retained original may have been mutated after current admission
        # replaced it. Validate both sides before any reference comparison.
        my $kind=($index==2||$index==3)?'B::AV':'B::HV';
        $staged_container->(\($staged_snapshot->{refs}[$index]),$kind);
        task6a_origin_refuse() unless $now->{refs}[$index]==$staged_snapshot->{refs}[$index];
    }
    for my $index(0..$#{$now->{values}}) {
        $staged_scalar->(\($staged_snapshot->{values}[$index]));
        task6a_origin_refuse() unless $now->{values}[$index] eq $staged_snapshot->{values}[$index];
    }
};
my $staged_freeze_admission=sub {
    task6a_origin_refuse() if defined($staged_snapshot);
    my $now=$staged_read_admission->();
    for my $index(0..3) {
        my $bytes=$now->{bytes}[$index];
        task6a_origin_refuse() unless Digest::SHA::sha1_hex(
            'blob '.length($bytes)."\0".$bytes) eq $staged_policy[$index][2];
    }
    task6a_origin_refuse() unless Digest::SHA::sha256_hex($now->{bytes}[4]) eq $staged_vendor_pin;
    # Capture expectations once; later read_admission validates current values
    # against these copies, never regenerating the record's expected hashes.
    $staged_snapshot={refs=>[@{$now->{refs}}],values=>[@{$now->{values}}],
        root=>$now->{root},creation=>[@{$now->{creation}}],files=>[]};
    my @relative=(map {$_->[1]} @staged_policy);
    push @relative,'vendor/node-v22.23.1-darwin-arm64.tar.gz','vendor/node';
    my @modes=(map {$_->[3]} @staged_policy);
    push @modes,0400,0555;
    for my $index(0..5) {
        my $bytes=$now->{bytes}[$index];
        push @{$staged_snapshot->{files}},{path=>$now->{root}.'/'.$relative[$index],
            mode=>$modes[$index],size=>length($bytes),sha256=>Digest::SHA::sha256_hex($bytes)};
    }
};
```

No body is parsed/executed/imported here. Source/vendor/native authenticity is
conditional on the later actual private producer; this reader enforces literal
pins and retained joins, not producer custody. Ordinary fixtures substitute only
the new uniquely anchored staged vendor-pin constant in memory and explicitly
back selected bytes with inert ordinary data. Do not describe a synthetic member
label as real gzip extraction or official-native derivation.

Pre-execution review found two causal gaps and the literals above address both:
byte fields require original-cell POK before any length/coercion, and retained
reference shapes are revalidated even after current admission replaces them.
Required witnesses add integer byte-data rejection and replace-current plus
bless/magic the retained original with zero candidate callbacks. These are not
already executed negative results.

#### Literal original-owner and disposal component — unexecuted candidate

Place this component after the existing parent protocol declarations and before
`task6a_origin_helpers_settled`; this makes the existing private parent custody
lexicals available without changing that protocol. No closure below is exported.
Native output classification is representation/live-alias exclusion under the
trusted native-open premise, not a global arbitrary-primitive provenance proof.

```perl
my $staged_freeze_foreign=sub {
    task6a_origin_refuse() if @staged_foreign;
    my @bindings;
    for my $records(\@parent_originals,\@file_ledger,\@directory_ledger) {
        $staged_vector->($records);
        for my $index(0..$#$records) {
            my $cell=\($records->[$index]);
            my $sv=$staged_plain_cell->($cell);
            next unless defined($$cell);
            my $row=$staged_container->($cell,'B::HV');
            task6a_origin_refuse() unless exists($row->{fh});
            my $binding=\($row->{fh});
            my $present=$staged_native_fh->($binding,1);
            push @bindings,$$binding if $present;
        }
    }
    $staged_vector->(\@physical_owned_handles);
    for my $index(0..$#physical_owned_handles) {
        my $cell=\($physical_owned_handles[$index]);
        $staged_native_fh->($cell,0);
        push @bindings,$$cell;
    }
    for my $fh(@bindings) {
        $staged_native_fh->(\$fh,0);
        next if grep {$_->{fh}==$fh} @staged_foreign;
        my $fd=CORE::fileno($fh);
        push @staged_foreign,{fh=>$fh,fd=>$fd};
    }
};
my $staged_seal=sub {
    my ($cell)=@_;
    my ($present,$fh,$fd);my $proven_alias=0;
    my $classified=eval {
        $present=$staged_native_fh->($cell,1);
        if($present) {
            # Copy/fileno only after the original-cell native shape guard.
            $fh=$$cell;$fd=CORE::fileno($fh);
            task6a_origin_refuse() unless defined($fd)&&$fd>=3;
            for my $foreign(@staged_foreign) {
                my $original=$foreign->{fh};
                $staged_native_fh->(\$original,0);
                my $live=CORE::fileno($original);
                if($fh==$original||(defined($live)&&$live==$fd)) {
                    $proven_alias=1;task6a_origin_refuse();
                }
                task6a_origin_refuse() if defined($live)&&defined($foreign->{fd})
                    &&$live!=$foreign->{fd};
            }
            for my $sealed(@staged_originals) {
                my ($original,$original_fd,$attempted,$closed)=$sealed->('binding');
                $staged_native_fh->(\$original,0);
                my $live=CORE::fileno($original);
                if($fh==$original||(defined($live)&&$live==$fd)) {
                    $proven_alias=1;task6a_origin_refuse();
                }
                task6a_origin_refuse() if defined($live)&&$live!=$original_fd;
            }
        }
        1;
    };
    my $classification_error=$@;
    unless($classified&&!length($classification_error)) {
        # Incomplete classification is not a proven borrowed alias. Never
        # independently close that uncertain pending boundary.
        $staged_uncertain=1 unless $proven_alias;
        task6a_origin_refuse();
    }
    return undef unless $present;
    my ($attempted,$closed)=(0,0);
    # The primitive is selected and captured now. No mutable record chooses
    # the FH, disposal kind or primitive at cleanup time.
    my $original_close=sub {close($fh)};
    my $sealed=sub {
        my ($op)=@_;
        return ($fh,$fd,$attempted,$closed) if $op eq 'binding';
        return $closed if $op eq 'closed';
        task6a_origin_refuse() unless $op eq 'dispose'&&!$attempted;
        $attempted=1;
        my $safe=eval {
            $staged_native_fh->(\$fh,0);
            my $live=CORE::fileno($fh);
            task6a_origin_refuse() unless defined($live)&&$live==$fd;
            1;
        };my $safety_error=$@;
        return 0 unless $safe&&!length($safety_error);
        my $ok=eval {$original_close->()};my $close_error=$@;
        my $end;
        my $inspected=eval {$staged_native_fh->(\$fh,0);$end=CORE::fileno($fh);1;};
        my $inspection_error=$@;
        $closed=1 if $ok&&!length($close_error)&&$inspected
            &&!length($inspection_error)&&!defined($end);
        return $closed;
    };
    # Register before any config/stat/hash/clock/ACL/trace operation.
    push @staged_originals,$sealed;
    return $sealed;
};
my $staged_dispose=sub {
    return 0 if $staged_disposal_started;
    $staged_disposal_started=1;
    my $all=1;
    for my $sealed(@staged_originals) {
        my $ok=eval {$sealed->('dispose')};my $error=$@;
        $all=0 unless $ok&&!length($error);
    }
    $staged_uncertain=1 unless $all;
    return $all&&!$staged_uncertain;
};
my $staged_burn=sub {
    $staged_invalid=1;$staged_phase='burned';
    unless($staged_disposal_started) {
        my $ok=eval {$staged_dispose->()};my $error=$@;
        $staged_uncertain=1 unless $ok&&!length($error);
    }
    task6a_origin_refuse();
};
```

This component is still incomplete as an executable candidate: freeze_foreign
requires independently reviewed binding retention/failure ordering, and the
combined dispatcher must prove exposed-native/alias/hidden cases without
inventing a producer token. Foreign records own no new close obligation.
Unknown pending shapes mark uncertainty; stage burn attempts all already sealed
originals once. A later physically closed but false/throwing nominee yields no
definite consumer close and no positive release. `closed` facts are private,
never used instead of actual live FD inspection during alias exclusion.

#### Literal acquisition, epochs and three operations — unexecuted candidate

Append these private closures and declarations immediately after the preceding
owner/disposal component. Do not insert any initializer or change production
main. The four boundary clock sites are explicit below; release calls none.
The entire candidate still requires the combined test literal and exact review.

Executable-registry boundary: `@staged_originals`, `@staged_record_checks`,
`@staged_foreign` and `@staged_pending` are private implementation custody/
expectation registries, not mutable caller admission or metadata. Production
exports neither their references nor their executable entries. Fixture mutation
helpers may modify only the admitted record graph and `@staged_files`/
`@staged_directories` metadata and retained graph objects specified in the
negative matrix. They must not replace/tie these executable registries or sealed
closure entries, mutate their captured expectation values, or replace cleanup
primitives. Such a rewrite is a source/harness mutation, not a runtime metadata
contamination negative. No resistance to arbitrary private Perl-op/closure
replacement is claimed. The independent fixture finalizer retains its own
sealed registry and remains unaffected by any admitted metadata mutation.

Burn/dispose never gates original cleanup on metadata-vector validity. Tied
files/directories are rejected before traversal by the validity path; all sealed
original disposal closures are still attempted independently. A safety test may
not obtain success by mutating the private disposal traversal itself. Any future
proposal that makes a custody registry externally reachable changes this
boundary and requires a separate immutable-original implementation/refinement.

Mid-port metadata mutation has a precise scope: the fixture may tie/bless/replace
admission or metadata containers/scalar cells, including a metadata FH cell
replacement. It may not tie/bless/magic the SHARED sealed original GV/IO while
an unchanged validator is already executing. Fresh views intentionally retain
that actual native FH, not an equivalent second handle. Arbitrary port callbacks
that mutate its native IO during clock/stat/read are outside the trusted native
primitive boundary and cannot be called a zero-callback source witness. Pending
tied/overloaded nominations use no actual native FD. A sealed original becoming
uninspectable at a guard/disposal boundary remains uncertainty, never a positive
release; do not claim native leak-freedom for it. Any future in-validator original
GV/IO mutation test needs a separate source-native-operation refinement and real
rescue/preservation design before admission, not a silent validator mock.

```perl
my @staged_record_checks;
my $staged_guard_partial=sub {
    task6a_origin_refuse() if $staged_invalid||$staged_uncertain||$staged_disposal_started;
    $staged_vector->(\@staged_directories);$staged_vector->(\@staged_files);
    $staged_vector->(\@staged_originals);$staged_vector->(\@staged_record_checks);
};
my $staged_configure=sub {
    my ($fh,$directory)=@_;
    $staged_native_fh->(\$fh,0);
    my $flags=fcntl($fh,Fcntl::F_GETFL(),0);
    task6a_origin_refuse() unless defined($flags)&&!ref($flags)
        &&($flags & Fcntl::O_ACCMODE())==Fcntl::O_RDONLY();
    task6a_origin_refuse() unless $directory||($flags & Fcntl::O_NONBLOCK());
    my $before=fcntl($fh,Fcntl::F_GETFD(),0);
    task6a_origin_refuse() unless defined($before)&&!ref($before)
        &&($before & ~Fcntl::FD_CLOEXEC())==0;
    my $set=fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC());
    task6a_origin_refuse() unless defined($set)&&$set;
    my $after=fcntl($fh,Fcntl::F_GETFD(),0);
    task6a_origin_refuse() unless defined($after)&&!ref($after)
        &&$after==Fcntl::FD_CLOEXEC();
    binmode($fh) or task6a_origin_refuse() unless $directory;
};
my $staged_acquire=sub {
    my ($path,$flags)=@_;
    my $pending;
    # Retain the ORIGINAL cell before opening, including unknown/magical output
    # boundaries. Dropping a last native reference must not become implicit
    # disposal after classification failed. Never read this slot via a callback.
    push @staged_pending,\$pending;
    my $returned;
    my $open_ok=eval {$returned=sysopen($pending,$path,$flags);1;};
    my $open_error=$@;
    # Preserve return/exception before any clock, trace or metadata callback.
    # Classify the actual output even after false or an exposed assignment/throw.
    my $sealed=$staged_seal->(\$pending);
    $staged_plain_cell->(\$returned);
    task6a_origin_refuse() unless $open_ok&&!length($open_error)
        &&defined($returned)&&!ref($returned)&&$returned&&defined($sealed);
    return $sealed;
};
my $staged_record=sub {
    my ($sealed,$path,$identity,$hash,$directory)=@_;
    my ($fh,$fd)=$sealed->('binding');
    my @expected=@$identity;
    my $original_identity=[@expected];
    my $record={path=>$path,identity=>$original_identity,fh=>$fh};
    $record->{sha256}=$hash unless $directory;
    my $check=sub {
        my ($cell)=@_;
        my $now=$staged_container->($cell,'B::HV');
        $staged_container->(\$record,'B::HV');
        task6a_origin_refuse() unless $now==$record;
        $staged_keys->($now,$directory?'fh,identity,path':'fh,identity,path,sha256');
        my $actual_path=$staged_scalar->(\($now->{path}));
        task6a_origin_refuse() unless $actual_path eq $path;
        unless($directory) {
            my $actual_hash=$staged_scalar->(\($now->{sha256}));
            task6a_origin_refuse() unless $actual_hash eq $hash;
        }
        $staged_native_fh->(\($now->{fh}),0);
        $staged_native_fh->(\$fh,0);
        task6a_origin_refuse() unless $now->{fh}==$fh
            &&defined(CORE::fileno($fh))&&CORE::fileno($fh)==$fd;
        my $tuple=$staged_container->(\($now->{identity}),'B::AV');
        $staged_container->(\$original_identity,'B::AV');
        task6a_origin_refuse() unless $tuple==$original_identity&&@$tuple==13;
        for my $index(0..12) {
            my $tuple_cell=\($tuple->[$index]);
            my $sv=$staged_plain_cell->($tuple_cell);
            task6a_origin_refuse() unless ($sv->FLAGS & B::SVf_IOK())
                &&!($sv->FLAGS & (B::SVf_ROK()|B::SVf_POK()));
            my $value=$staged_scalar->($tuple_cell);
            task6a_origin_refuse() unless $value==$expected[$index];
        }
        # Validators get a fresh immutable-expectation view, not mutable
        # admission/record fields that a later port callback could change.
        my $view={path=>$path,identity=>[@expected],fh=>$fh};
        $view->{sha256}=$hash unless $directory;
        return $view;
    };
    push @staged_record_checks,$check;
    return $record;
};
my $staged_require_live=sub {
    task6a_origin_refuse() if $staged_invalid||$staged_uncertain||$staged_disposal_started;
    $staged_vector->(\@staged_directories);$staged_vector->(\@staged_files);
    $staged_vector->(\@staged_originals);$staged_vector->(\@staged_record_checks);
    task6a_origin_refuse() unless task6a_origin_helpers_settled();
    $staged_check_admission->();
    task6a_origin_refuse() unless @staged_directories==6&&@staged_files==6
        &&@staged_originals==12&&@staged_record_checks==12;
    for my $index(0..5) {
        $staged_record_checks[$index]->(\($staged_directories[$index]));
        $staged_record_checks[$index+6]->(\($staged_files[$index]));
    }
};
my $staged_epoch=sub {
    $staged_require_live->();
    for my $index(0..5) {
        $staged_require_live->();
        my $view=$staged_record_checks[$index]->(\($staged_directories[$index]));
        task6a_origin_check_directory($view);
    }
    for my $index(0..5) {
        $staged_require_live->();
        my $view=$staged_record_checks[$index+6]->(\($staged_files[$index]));
        task6a_origin_check_held_file($view);
        $staged_require_live->();
        $view=$staged_record_checks[$index+6]->(\($staged_files[$index]));
        task6a_origin_acl_free($view->{path});
        $staged_require_live->();
        $view=$staged_record_checks[$index+6]->(\($staged_files[$index]));
        task6a_origin_check_held_file($view);
    }
    for my $index(0..5) {
        $staged_require_live->();
        my $view=$staged_record_checks[$index]->(\($staged_directories[$index]));
        task6a_origin_check_directory($view);
    }
    $staged_require_live->();
};
my $staged_diagnostic=sub {
    return {scope=>'staged-source-vendor-custody-diagnostic-only',
        productionAuthority=>JSON::PP::false,fileCount=>6,directoryCount=>6};
};
sub task6a_origin_hold_staged_custody {
    my $ok=eval {
        task6a_origin_refuse() unless @_==0&&$staged_phase eq 'absent'
            &&!$staged_invalid&&!$staged_disposal_started;
        $staged_phase='capturing';
        # Boundary guard1: hold entry; do not renew bootstrap_deadline.
        task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
        task6a_origin_refuse() unless task6a_origin_helpers_settled();
        $staged_freeze_admission->();$staged_freeze_foreign->();
        my $root=$staged_snapshot->{root};
        my @paths=('/','/private','/private/tmp',$root,$root.'/source',$root.'/vendor');
        for my $index(0..5) {
            $staged_guard_partial->();
            my $path=$paths[$index];my @before=lstat($path);
            task6a_origin_refuse() unless @before==13&&Fcntl::S_ISDIR($before[2])
                &&$before[4]==0&&$before[5]==0;
            my $mode=$before[2]&07777;
            task6a_origin_refuse() unless $index==2?$mode==01777
                :$index==3?$mode==0711:$index>=4?$mode==0555
                :($mode==0755||$mode==0711||$mode==0700||$mode==0555);
            if($index==3) {
                for my $field(0,1,4,5) {
                    task6a_origin_refuse() unless $before[$field]==$staged_snapshot->{creation}[$field];
                }
            }
            my $sealed=$staged_acquire->($path,
                Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY());
            my ($fh)=$sealed->('binding');$staged_configure->($fh,1);
            $staged_guard_partial->();
            my $record=$staged_record->($sealed,$path,\@before,undef,1);
            $staged_guard_partial->();
            push @staged_directories,$record;
            $staged_guard_partial->();
            my $view=$staged_record_checks[$index]->(\($staged_directories[$index]));
            task6a_origin_check_directory($view);
            $staged_guard_partial->();
        }
        for my $expected(@{$staged_snapshot->{files}}) {
            $staged_guard_partial->();
            my $path=$expected->{path};my @before=lstat($path);
            task6a_origin_refuse() unless @before==13&&Fcntl::S_ISREG($before[2])
                &&($before[2]&07777)==$expected->{mode}&&$before[3]==1
                &&$before[4]==0&&$before[5]==0&&$before[7]==$expected->{size};
            my $sealed=$staged_acquire->($path,
                Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK());
            my ($fh)=$sealed->('binding');$staged_configure->($fh,0);
            $staged_guard_partial->();
            my $record=$staged_record->($sealed,$path,\@before,$expected->{sha256},0);
            $staged_guard_partial->();
            push @staged_files,$record;
            $staged_guard_partial->();
            my $index=$#staged_files;
            my $view=$staged_record_checks[$index+6]->(\($staged_files[$index]));
            task6a_origin_check_held_file($view);
            $staged_guard_partial->();
        }
        $staged_epoch->();
        # Boundary guard2: hold completion, after actual helper settlement.
        task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
        $staged_require_live->();$staged_phase='active';1;
    };my $primary=$@;
    $staged_burn->() unless $ok&&!length($primary);
    return $staged_diagnostic->();
}
sub task6a_origin_recheck_staged_custody {
    my $ok=eval {
        task6a_origin_refuse() unless @_==0&&$staged_phase eq 'active';
        $staged_require_live->();
        # Boundary guard3: recheck entry.
        task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
        $staged_epoch->();
        # Boundary guard4: recheck completion.
        task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
        $staged_require_live->();1;
    };my $primary=$@;
    $staged_burn->() unless $ok&&!length($primary);
    return $staged_diagnostic->();
}
sub task6a_origin_release_staged_custody {
    # No validity/admission/helper/deadline operation in release.
    unless(@_==0&&$staged_phase eq 'active'&&!$staged_invalid
        &&!$staged_uncertain&&!$staged_disposal_started) {$staged_burn->();}
    $staged_phase='released';
    my $ok=eval {$staged_dispose->()};my $primary=$@;
    $staged_burn->() unless $ok&&!length($primary)&&@staged_originals==12
        &&!grep {!$_->('closed')} @staged_originals;
    my $diagnostic=$staged_diagnostic->();$diagnostic->{handlesClosed}=12;
    return $diagnostic;
}
```

Mandatory review includes Perl precedence at the mode ternary and conditional
binmode, native positive post-close IO shape, every failed/throwing open with
assigned output, all private-record replacement/magic cases and the absence of
any production initializer. Record metadata guards above validate retained
original containers before reference comparison just as admission guards do.
This candidate is not yet cleared for insertion or compilation. Any source
refinement updates the exact literal and its counts before executable review.

#### Fixed fixture mapping and independently derived epoch prefixes

The literal combined dispatcher will use these existing, distinct, one-link,
nonempty, one-chunk backing files. No fixture file or directory is created:

| Logical leaf | Existing backing file | Exact bytes |
| --- | --- | ---: |
| source/task6a-origin-archive-v2.pm | scripts/task6a-origin-archive-v2.pm | 5864 |
| source/task6a-origin-native-v2.pm | scripts/task6a-origin-native-v2.pm | 3347 |
| source/task6a-origin-map-v2.pm | scripts/task6a-origin-map-v2.pm | 11684 |
| source/task6a-protected-origin-entry-v2.mjs | scripts/task6a-protected-origin-entry-v2.mjs | 1933 |
| vendor/node-v22.23.1-darwin-arm64.tar.gz | package.json | 22734 |
| vendor/node | README.md | 7454 |

The last two are inert SYNTHETIC archive/selected data, not gzip/Mach-O or real
member derivation. Source bytes retain their actual unchanged Git frame pins.
The private staged vendor constant alone is substituted in memory with the
SHA256 of the ordinary package bytes. The selected archiveRef is the same
fixture vendor object; no authentic producer result is invented.

Logical root is the fixed inert `/private/tmp/task6a-staged-memory-fixture`.
Its path is never actually opened. The dispatcher maps it to the already owned
capsule source root; logical source/vendor map to its existing scripts/docs
directories. Literal `/`, `/private`, `/private/tmp` map to themselves. Physical
file/ancestry geometry of this ordinary fixture is not a protected tree join:
vendor backing files are outside its mapped docs directory. Projected logical
ancestry, owner and modes are explicitly synthetic. Actual ordinary physical
identities, seekable file bytes/FHs, reads, seeks, pipe reads and close results
remain real. Do not attribute protected ancestry or official byte authenticity
to this fixture.

Freeze and verify backing identities/hashes before the complete reviewed
invocation. Node must assert actual three-declaration presence before reading
any backing bytes, constructing this initializer or spawning Perl. Thus missing
declarations yield a genuine setup-independent missing-consumer RED; after
implementation the actual three calls, not text presence, carry the acceptance
and state/cleanup assertions. Missing source anchor, compile, prototype, queue
or JSON failure remains fatal, not a nominated semantic refusal.

Healthy ported counts add source fileno1110 (42 times25 plus60 validator calls),
staged/pipe close348, closedir42, fcntl90, binmode342, stat120, lstat132,
sysseek30, sysread228, pipes168, opendir42, readdir1083, fork42, wait168,
readiness84, sysopen12 and clock407. `CORE::fileno` inside private shape/owner
checks and preloaded IO::Select is NOT part of the1110 ported count; never label
it whole-program fileno. No actual CORE readdir, kernel fork/wait/kill or external
helper runs. Event cap8192 remains conditional on the exact event encoding:
ported operations total4448 before acquire/preload/disposal instrumentation;
full source/event trace must be bounded explicitly before execution.

Hand-derived clock prefixes, independent of actual implementation execution:

| Boundary | Cumulative clock calls | Completed helpers | Acquired originals |
| --- | ---: | ---: | ---: |
| Startup and hold entry | 2 | 0 | 0 |
| Six immediate ancestor samples | 50 | 6 | 60 |
| Six initial leaf validators | 68 | 6 | 66 |
| Hold leading ancestry bracket | 116 | 12 | 120 |
| Hold six leaf brackets | 188 | 18 | 174 |
| Hold trailing ancestry bracket | 236 | 24 | 228 |
| Hold completion | 237 | 24 | 228 |
| Recheck entry | 238 | 24 | 228 |
| Recheck leading ancestry bracket | 286 | 30 | 282 |
| Recheck six leaf brackets | 358 | 36 | 336 |
| Recheck trailing ancestry bracket | 406 | 42 | 390 |
| Recheck completion | 407 | 42 | 390 |

Each helper contributes9 original obligations already disposed by the real
captor/parser path, while stage originals remain held until release/burn. Hold
completion therefore has216 helper originals plus12 staged; the full sequence
has378 plus12. A release adds twelve source close calls, zero clocks/helpers.
An expiry at237 refuses before hold publication; expiry at238 refuses before
the recheck epoch; expiry at407 refuses before successful recheck publication.
After failure or successful release, retries must add no validity/open/helper
effects. Restoration is a nomination only, never renewed owner authority.

#### Combined harness validity grammar — unexecuted literal queue candidate

Independent read-only count investigations agree on the following actual-port
grammar. This fixes ordering and source-prefix expectations; it is not the
complete dispatcher/initializer or an execution admission. Queue construction
is independent of runtime trace/outcome. No expectation is regenerated from
events observed from the consumer.

`Vdir(i)` emits ported `fileno,clock,stat,lstat,H(i),stat,lstat,clock`.
`Vfile(i)` emits `fileno,stat,lstat,sysseek(0),clock,sysread(data),clock,
sysread(EOF),stat,lstat,clock`. These definitions depend on the fixed nonempty
one-chunk bytes above. All physical reads remain actual CORE reads; a nomination
cannot fabricate returned data or an accepted captor DTO.

Each H uses a fresh current batch and the exact capture grammar:

```text
clock,clock
pipe(in),pipe(stdout),pipe(stderr),pipe(setup)
eight [binmode,fileno] in pair-acquisition order
fcntl(setup-w,F_SETFD,FD_CLOEXEC)
opendir(census),fileno(census),readdir repeated15+liveStage,closedir(census)
fileno(setup-w),clock,fork(synthetic positive424242)
close(in-r),close(in-w),close(stdout-w),close(stderr-w),close(setup-w)
fileno(stdout-r),fileno(stderr-r),fileno(setup-r)
wait(0),clock,readiness(stdout-r,stderr-r,setup-r)
fileno(stdout-r),sysread(data)
fileno(stderr-r),sysread(EOF),close(stderr-r)
fileno(setup-r),sysread(EOF),close(setup-r)
wait(0)
wait(0),clock,readiness(stdout-r)
fileno(stdout-r),sysread(EOF),close(stdout-r)
wait(424242,raw0),clock
eight final-cleanup filenos in original acquisition order
```

No final-close call is repeated for already closed pipes. Those final source
filenos must return actual undefined values for known closed originals. All
queue lookup/classification internals use CORE inspection, not their own port
hooks. IO::Select members/count/removal remain real, while only readiness and
positive PID/wait samples are nominated. Neither fork nor wait reaches the
kernel. Census uses currently live originals plus its own DIR; closed historical
FD reuse is legitimate and must not trip an alias assertion.

The whole healthy grammar is startup, hold-entry, six directory acquisitions
with immediate Vdir, six file acquisitions with immediate Vfile, epoch,
hold-completion, recheck-entry, epoch, recheck-completion, twelve staged closes.
Epoch is six Vdir, six Vfile/H/Vfile, six Vdir. Validity queues and original
disposal are separate: sticky faults may forbid further validity delegation
but never prevent the independent original finalizer from attempting its known
sealed originals. A caught harness fault remains fatal after source eval/calls/
cleanup/repeat. Actual source canonical refusal alone cannot contain an unknown
operation, prototype/load failure, exhausted queue or trace overflow.

For an exposed DISTINCT real native FH followed by false at one-based open N,
freeze the following JS table as the independent expected prefix. Throw after
the same exposed assignment has identical ordinary port counts. No later config
or validator runs on the failed Nth original; all N stage originals are disposed.

```javascript
const STAGED_EXPOSED_OPEN_PREFIXES=[
  // N,clocks,helpers,stage closes,all originals,total ported operations
  [1,2,0,1,1,5],
  [2,10,1,2,11,100],
  [3,18,2,3,21,196],
  [4,26,3,4,31,293],
  [5,34,4,5,41,391],
  [6,42,5,6,51,490],
  [7,50,6,7,61,590],
  [8,53,6,8,62,609],
  [9,56,6,9,63,628],
  [10,59,6,10,64,647],
  [11,62,6,11,65,666],
  [12,65,6,12,66,685],
];
```

For detailed prefix assertions, d=min(N-1,6), f=max(N-7,0) hand-derive:
fileno26d+f; close8d+N; closedir/opendir/fork d; fcntl4(N-1)+d;
binmode8d+f; stat2(d+f); lstatN+2(d+f); seek f; read4d+2f;
pipe4d; readdir15d+d(d+1)/2; wait4d; readiness2d; sysopenN.
These formulas describe nominated source ports including burn's original
disposal, not unported CORE inspections, fixture construction or implicit
destruction. Undefined/malformed/alias outputs add NO Nth staged disposal
obligation. Hidden successful raw acquisition adds a fixture-only obligation,
not consumerClosed. Borrowed-alias survival must be measured independently.

#### Closed mandatory witness families — still no execution admission

The complete initializer/dispatcher and each case's nomination/trace must be
fixed before invocation. Select a closed family matrix, not a Cartesian product
or a catch-all intentional-failure mode. A harness fault is never product RED.

| Family | Required witnesses | Observable requirement |
| --- | --- | --- |
| Entry/positive | Missing actual3 declarations; healthy hold/recheck/release; each repeat after release; early recheck/release; nonzero arity; second hold while active | RED before backing reads/initializer/Perl; exact diagnostics; irreversible consumption; no repeated effects |
| Admission | Container/key/order/role/path/creation joins; reference copy/replacement; numeric bytes; source/archive commitment; selected archiveRef; retained-original magic after replacement | Zero callbacks, copied expectations unchanged, no acquisition after initial rejection |
| Acquisition | All12 undefined outputs, exposed false and exposed throw | Exact frozen prefixes; all distinct exposed native originals sealed before failure |
| Ownership | Same staged original; each known foreign-owner registry; genuine live-FD alias | No second/borrowed close; borrowed original still live; no false fileno nomination |
| Unknown shape | Tied output cell, tied unopened glob, blessed/overloaded binding, indirect name and non-FH references | Permanent uncertainty, zero consumer candidate callbacks, no positive release |
| Hidden raw | CORE acquisition hidden before output assignment | Independent fixture rescue; consumerClosed excludes hidden native FH |
| Config/identity | Access mode, CLOEXEC, binmode, pre/open/post identity/tuple, size/hash and actual ACL/captor refusal | Exact nominated failure, no suppressed real validator outcome |
| Metadata | Partial/full tied files/directories; record/tuple/path/hash/FH-cell replacement; retained-object magic | No PUSH/FETCH/FETCHSIZE/overload; validation views isolated; disposal unaffected |
| Budget/shared | Expiry237,238,407; actual captor refusal/throwing cleanup/unsettled helper | No publication past boundary; all sealed staged attempts continue |
| Disposal | False and throw at each of12 stage originals | Twelve attempts, no retry, no false/throw definite-close diagnostic |
| Restoration | Restore denied admission/metadata then repeat | Canonical refusal, zero new validity/open/helper/disposal effects |

Malformed first-open constructors create no native descriptor: memory-only tied
scalar, tied unopened private glob, blessed unopened glob/plain reference,
indirect name or plain array/hash/scalar/coderef. Fixture TIESCALAR/TIEHANDLE
construction counters are separate from consumer callback counters. Independently
inspect each nominee's actual B shape before exposing it; do not assume tied
magic resides in a particular GV/IO slot. Snapshot FETCH/STORE/FILENO/CLOSE/READ/
overload counters BEFORE fixture untie/destruction: all consumer counters must
be zero. No open/sysopen/pipe/socket constructs a malformed nominee.

Output keeps canonical accepted/refused operation, sticky harnessFault,
actual/exposed/hidden acquisitions, stage/helper attempts and definite closes,
borrowed survival, pre-finalizer callbacks/live originals, fixture rescue and
repeat-effect delta separate. A zero final FD count after fixture rescue is not
consumer cleanup proof. Semantic mutants must have coherent finite queues and
actual forbidden-acceptance/effect witnesses; compile/load/queue failures do not
kill a mutant. Minimum independent mutation targets are shape rejection,
metadata-vector guard, a byte check, an ACL/epoch sample and original once-only
disposal. Their complete exact anchors/candidate queues remain part of the
uncompleted literal harness gate, not already satisfied mutation evidence.

#### Combined consumer recipe: first executable TDD cycle (not admitted yet)

The mandatory witness matrix above remains the delivery gate. Implement it in
test-first cycles rather than claiming an adapter is a consumer. This first
cycle contains the complete combined harness, the actual three operations,
healthy/absent/arity/premature/repeat behavior, and every undefined/exposed-false/
exposed-throw acquisition slot. No source insertion, compile or child execution
is admitted until two exact reviews of this literal cycle and a fresh
preservation check. Later metadata/alias/magic/deadline/close and coherent-mutant
cycles remain mandatory BEFORE commit/push/PR/build of the implementation.

The combined harness consumes an independently constructed finite operation
grammar. Each operation carries its fixed role; wrong order, argument,
unregistered FH, queue underflow, incomplete queue, setup failure, or sticky
fault is fatal. An expected semantic refusal never contains a harness fault.
No operation expectation is derived from the observed trace. The first-cycle
negative grammar is the exact acquisition prefix plus disposal, not a healthy
trace accepted with arbitrary unused operations.

The following JavaScript helper is added to the existing ordinary-host test
block. Extend the existing fs import with lstatSync. Declaration assertions
precede every backing-byte read, initializer construction and Perl child.
The source passed to systemObject is the full production declarations, NOT a
standalone capsule replacement. Root remains the only writer.

```javascript
const STAGED_CUSTODY_BACKINGS=[
  ['source/task6a-origin-archive-v2.pm','scripts/task6a-origin-archive-v2.pm',5864,'da1fd458fcaba775be5ba09ef88157b5ee48dbda'],
  ['source/task6a-origin-native-v2.pm','scripts/task6a-origin-native-v2.pm',3347,'59e1ae8de38cf2083a0294c55454083840eb47f1'],
  ['source/task6a-origin-map-v2.pm','scripts/task6a-origin-map-v2.pm',11684,'9719bf4f3676b43b7858e3cabe3cee3e679120f8'],
  ['source/task6a-protected-origin-entry-v2.mjs','scripts/task6a-protected-origin-entry-v2.mjs',1933,'e53be63cdcdf286dc89adbec9770668b1fdb9cc7'],
  ['vendor/node-v22.23.1-darwin-arm64.tar.gz','package.json',22734,null],
  ['vendor/node','README.md',7454,null],
];
function stagedCustody(mode='healthy',slot=0,{sourceOverride}={}) {
  const source=sourceOverride??readFileSync(BOOTSTRAP,'utf8');
  for(const name of ['hold','recheck','release']) {
    assert.equal(source.split('sub task6a_origin_'+name+'_staged_custody {').length,2,
      'staged custody consumer missing: '+name);
  }
  const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
  const backings=STAGED_CUSTODY_BACKINGS.map(([logical,relative,size,blob])=>{
    const path=root+'/'+relative;
    const before=lstatSync(path,{bigint:true});
    assert.ok(before.isFile()&&!before.isSymbolicLink());
    assert.equal(before.nlink,1n);assert.equal(before.size,BigInt(size));
    const bytes=readFileSync(path);const after=lstatSync(path,{bigint:true});
    for(const key of ['dev','ino','mode','nlink','uid','gid','size','mtimeNs','ctimeNs'])
      assert.equal(after[key],before[key]);
    if(blob!==null) assert.equal(createHash('sha1')
      .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),blob);
    return {logical,path,size,dev:String(before.dev),ino:String(before.ino),
      sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.toString('base64')};
  });
  assert.equal(backings[4].sha256,'bf6cedd405c26f5f933e45436d8ec84b2780297377bb44f40deb6c44a91f6a6e');
  const actual=systemObject('staged-custody',{mode,slot,root,backings},undefined,{sourceOverride:source});
  assert.equal(actual.status,0,actual.stderr.toString());
  assert.equal(actual.stderr.length,0);const value=JSON.parse(actual.stdout.toString());
  assert.equal(value.harnessFault,null);assert.equal(value.productionAuthority,false);
  assert.equal(value.remainingOperations,0);assert.equal(value.fixtureClosed,0);
  assert.equal(value.definitelyClosed,value.ownedCount);
  assert.equal(value.repeatEffectDelta,0);return value;
}
test('staged custody actual consumer holds, rechecks and releases twelve originals',()=>{
  const r=stagedCustody();
  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',
    productionAuthority:false,fileCount:6,directoryCount:6};
  assert.deepEqual(r.hold,diagnostic);assert.deepEqual(r.recheck,diagnostic);
  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});
  assert.equal(r.refused,false);assert.equal(r.ownedCount,390);
  assert.equal(r.stageClosed,12);assert.equal(r.helperClosed,378);
  assert.deepEqual(r.calls,{binmode:342,clock:407,close:348,closedir:42,fcntl:90,
    fileno:1110,fork:42,lstat:132,opendir:42,pipe:168,read:228,readdir:1083,
    ready:84,seek:30,stat:120,sysopen:12,wait:168});
});
for(const mode of ['absent','arity','premature-recheck','premature-release'])
  test('staged custody actual consumer refuses '+mode+' without acquisition',()=>{
    const r=stagedCustody(mode);assert.equal(r.refused,true);
    assert.equal(r.ownedCount,0);assert.equal(r.calls.clock,mode==='absent'?2:1);
  });
for(const mode of ['open-undefined','open-false','open-throw'])
  for(const [slot,clocks,helpers,stageCloses,allOriginals,portedTotal] of STAGED_EXPOSED_OPEN_PREFIXES)
    // Independent literal prefix table; not the consumer's trace builder.
    for(const want of [{slot,clocks,helpers,stageCloses,allOriginals,portedTotal}])
    test('staged custody actual consumer disposes '+mode+' slot '+want.slot,()=>{
      const r=stagedCustody(mode,want.slot);assert.equal(r.refused,true);
      assert.equal(r.calls.sysopen,want.slot);assert.equal(r.calls.clock,want.clocks);
      assert.equal(r.helpers,want.helpers);
      const exposed=mode!=='open-undefined';
      assert.equal(r.stageClosed,want.stageCloses-(exposed?0:1));
      assert.equal(r.ownedCount,want.allOriginals-(exposed?0:1));
      if(exposed) assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),want.portedTotal);
    });
```

The package hash above must be checked against the fixed existing backing
BEFORE review admission; a transcription discrepancy is a plan defect, not an
excuse to accept caller-provided commitments. This literal is not executed.

#### Combined consumer dispatcher literal — grammar and private originals

Add this as STAGED_CUSTODY_PROGRAM=String.raw followed by a template literal,
and interpolate it before STAGED_CAPTOR_PORT_PROGRAM in systemObject. This is
one dispatcher, not nested lower-port adapters. All text remains unexecuted.

```perl
    if($q->{kind} eq 'staged-custody') {
      require Fcntl;require B;require IO::Select;require POSIX;require Time::HiRes;
      require Digest::SHA;require Encode;require Errno;
      my $fault='';my (@grammar,@jobs,@owned,@events);my (%roles,%calls);
      my $latch=sub {$fault='TEST_STAGED_CUSTODY_HARNESS_FAULT';return 0;};
      my $fail=sub {$latch->();die "$fault\n";};
      my $check=sub {die "$fault\n" if length($fault);};
      my $r=$q->{record};
      $fail->() unless ref($r) eq 'HASH'
        &&join(',',sort keys %$r) eq 'backings,mode,root,slot';
      my ($mode,$slot,$root)=@$r{qw(mode slot root)};
      my %modes=map {$_=>1} qw(healthy absent arity premature-recheck premature-release open-undefined open-false open-throw);
      $fail->() unless defined($mode)&&!ref($mode)&&$modes{$mode}
        &&defined($slot)&&!ref($slot)&&$slot>=0&&$slot<=12&&$slot==int($slot)
        &&($mode=~/\Aopen-/ ? $slot>=1 : $slot==0)
        &&defined($root)&&!ref($root)&&$root=~m{\A/[A-Za-z0-9._/-]+\z};
      my $logical='/private/tmp/task6a-staged-memory-fixture';
      my @directory_paths=('/','/private','/private/tmp',$logical,$logical.'/source',$logical.'/vendor');
      my @actual_dirs=('/','/private','/private/tmp',$root,$root.'/scripts',$root.'/docs');
      my @leaf_rel=qw(source/task6a-origin-archive-v2.pm source/task6a-origin-native-v2.pm source/task6a-origin-map-v2.pm source/task6a-protected-origin-entry-v2.mjs vendor/node-v22.23.1-darwin-arm64.tar.gz vendor/node);
      my @backing_rel=qw(scripts/task6a-origin-archive-v2.pm scripts/task6a-origin-native-v2.pm scripts/task6a-origin-map-v2.pm scripts/task6a-protected-origin-entry-v2.mjs package.json README.md);
      my @sizes=(5864,3347,11684,1933,22734,7454);
      my @permissions=(0400,0400,0400,0444,0400,0555);
      my @blobs=qw(da1fd458fcaba775be5ba09ef88157b5ee48dbda 59e1ae8de38cf2083a0294c55454083840eb47f1 9719bf4f3676b43b7858e3cabe3cee3e679120f8 e53be63cdcdf286dc89adbec9770668b1fdb9cc7);
      my (%paths,@bodies,%physical_seen);
      $fail->() unless ref($r->{backings}) eq 'ARRAY'&&@{$r->{backings}}==6;
      for my $index(0..5) {
        my $path=$directory_paths[$index];my $actual=$actual_dirs[$index];
        my @s=CORE::lstat($actual);$fail->() unless @s==13&&Fcntl::S_ISDIR($s[2]);
        my $permission=$index==2?01777:$index==3?0711:$index>=4?0555:($s[2]&07777);
        $paths{$path}={actual=>$actual,identity=>[@s],directory=>1,permission=>$permission,role=>'d'.$index};
      }
      for my $index(0..5) {
        my $b=$r->{backings}[$index];
        $fail->() unless ref($b) eq 'HASH'
          &&join(',',sort keys %$b) eq 'bytes,dev,ino,logical,path,sha256,size'
          &&$b->{logical} eq $leaf_rel[$index]&&$b->{path} eq $root.'/'.$backing_rel[$index]
          &&$b->{size}==$sizes[$index]&&!ref($b->{bytes})&&!ref($b->{sha256})
          &&$b->{sha256}=~/\A[a-f0-9]{64}\z/;
        my @s=CORE::lstat($b->{path});
        $fail->() unless @s==13&&Fcntl::S_ISREG($s[2])&&$s[3]==1
          &&"$s[0]" eq $b->{dev}&&"$s[1]" eq $b->{ino}&&$s[7]==$sizes[$index]
          &&!$physical_seen{"$s[0]:$s[1]"}++;
        my $body=MIME::Base64::decode_base64($b->{bytes});
        $fail->() unless MIME::Base64::encode_base64($body,'') eq $b->{bytes}
          &&length($body)==$sizes[$index]&&!utf8::is_utf8($body)
          &&Digest::SHA::sha256_hex($body) eq $b->{sha256};
        if($index<4) {$fail->() unless Digest::SHA::sha1_hex('blob '.length($body)."\0".$body) eq $blobs[$index];}
        $paths{$logical.'/'.$leaf_rel[$index]}={actual=>$b->{path},identity=>[@s],
          directory=>0,permission=>$permissions[$index],role=>'f'.$index,body=>$body};
        push @bodies,$body;
      }
      $fail->() unless Digest::SHA::sha256_hex($bodies[4]) eq 'bf6cedd405c26f5f933e45436d8ec84b2780297377bb44f40deb6c44a91f6a6e'
        &&Digest::SHA::sha256_hex($bodies[5]) eq '14a6a8f44d6531560feca82404d64d46ff259585fd74b7ea7d9d2b3ae62efd0e';
      my $project=sub {
        my ($p,$s)=@_;$fail->() unless ref($s) eq 'ARRAY'&&@$s==13;
        my @result=@$s;$result[2]=($result[2]&~07777)|$p->{permission};
        $result[4]=0;$result[5]=0;return \@result;
      };
      my $creation=$project->($paths{$logical},$paths{$logical}{identity});
      $creation->[2]=($creation->[2]&~07777)|0700;
      my @source_roles=qw(archive-helper native-helper map-helper entry);
      my $vendor={filename=>'node-v22.23.1-darwin-arm64.tar.gz',bytes=>$bodies[4]};
      my $fixture_admission={creator=>{rootPath=>$logical,creationIdentity=>$creation},
        sources=>[map {+{role=>$source_roles[$_],relativePath=>$leaf_rel[$_],
          gitBlobSha=>$blobs[$_],bytes=>$bodies[$_]}} (0..3)],
        vendor=>$vendor,selected=>{archiveRef=>$vendor,
          memberName=>'node-v22.23.1-darwin-arm64/bin/node',bytes=>$bodies[5]}};
      my $emit=sub {push @grammar,[@_];};
      my $h=0;my $stage_count=0;
      my $helper_grammar=sub {
        my ($path)=@_;my $prefix='h'.(++$h);
        push @jobs,{prefix=>$prefix,path=>$path,stageCount=>$stage_count};
        $emit->('clock',$prefix) for 1..2;
        $emit->('pipe',$prefix.'.'.$_) for qw(in out err setup);
        for my $name(qw(in-r in-w out-r out-w err-r err-w setup-r setup-w)) {
          $emit->('binmode',$prefix.'.'.$name);$emit->('fileno',$prefix.'.'.$name);
        }
        $emit->('fcntl',$prefix.'.setup-w');
        $emit->('opendir',$prefix.'.census');$emit->('fileno',$prefix.'.census');
        $emit->('readdir',$prefix.'.census') for 1..(15+$stage_count);
        $emit->('closedir',$prefix.'.census');$emit->('fileno',$prefix.'.setup-w');
        $emit->('clock',$prefix);$emit->('fork',$prefix);
        $emit->('close',$prefix.'.'.$_) for qw(in-r in-w out-w err-w setup-w);
        $emit->('fileno',$prefix.'.'.$_) for qw(out-r err-r setup-r);
        $emit->('wait',$prefix);$emit->('clock',$prefix);$emit->('ready',$prefix);
        for my $name(qw(out-r err-r setup-r)) {
          $emit->('fileno',$prefix.'.'.$name);$emit->('read',$prefix.'.'.$name);
          $emit->('close',$prefix.'.'.$name) unless $name eq 'out-r';
        }
        $emit->('wait',$prefix);$emit->('wait',$prefix);
        $emit->('clock',$prefix);$emit->('ready',$prefix);
        $emit->('fileno',$prefix.'.out-r');$emit->('read',$prefix.'.out-r');
        $emit->('close',$prefix.'.out-r');$emit->('wait',$prefix);$emit->('clock',$prefix);
        $emit->('fileno',$prefix.'.'.$_) for qw(in-r in-w out-r out-w err-r err-w setup-r setup-w);
      };
      my $dir_grammar=sub {
        my ($i)=@_;my $role='d'.$i;
        $emit->('fileno',$role);$emit->('clock','stage');$emit->('stat',$role);$emit->('lstat',$role);
        $helper_grammar->($directory_paths[$i]);
        $emit->('stat',$role);$emit->('lstat',$role);$emit->('clock','stage');
      };
      my $file_grammar=sub {
        my ($i)=@_;my $role='f'.$i;
        $emit->('fileno',$role);$emit->('stat',$role);$emit->('lstat',$role);$emit->('seek',$role);
        $emit->('clock','stage');$emit->('read',$role);$emit->('clock','stage');$emit->('read',$role);
        $emit->('stat',$role);$emit->('lstat',$role);$emit->('clock','stage');
      };
      my $epoch_grammar=sub {
        $dir_grammar->($_) for 0..5;
        for my $i(0..5) {$file_grammar->($i);$helper_grammar->($logical.'/'.$leaf_rel[$i]);$file_grammar->($i);}
        $dir_grammar->($_) for 0..5;
      };
      $emit->('clock','startup');
      if($mode eq 'absent') {$emit->('clock','stage');}
      elsif($mode eq 'healthy'||$mode=~/\Aopen-/) {
        $emit->('clock','stage');
        for my $n(1..12) {
          my $role=$n<=6?'d'.($n-1):'f'.($n-7);
          $emit->('lstat',$role);$emit->('sysopen',$role);
          if($mode=~/\Aopen-/&&$n==$slot) {++$stage_count unless $mode eq 'open-undefined';last;}
          ++$stage_count;$emit->('fcntl',$role) for 1..4;
          if($n<=6) {$dir_grammar->($n-1);}
          else {$emit->('binmode',$role);$file_grammar->($n-7);}
        }
        if($mode eq 'healthy') {
          $epoch_grammar->();$emit->('clock','stage');$emit->('clock','stage');
          $epoch_grammar->();$emit->('clock','stage');
        }
        for my $n(1..$stage_count) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
      my $take=sub {
        my ($op,$role)=@_;$check->();$fail->() unless @grammar;
        my $want=shift @grammar;$fail->() unless $want->[0] eq $op&&$want->[1] eq $role;
        ++$calls{$op};
        $fail->() if @events>=8192;
        my $event={seq=>1+@events,op=>$op,role=>$role};
        $fail->() if length(JSON::PP->new->canonical->utf8->encode($event))>512;
        push @events,$event;
      };
      my $same_physical=sub {
        my ($old,$now,$kind)=@_;$fail->() unless @$old==13&&@$now==13;
        $fail->() unless $kind eq 'file'||$kind eq 'directory'||$kind eq 'pipe';
        my @fields=$kind eq 'pipe'?(0..6):$kind eq 'directory'?(0,1,2,4,5):(0,1,2,3,4,5,7,9,10);
        for my $i(@fields) {$fail->() unless $old->[$i]==$now->[$i];}
      };
      my $register=sub {
        my ($fh,$role,$dir_stream,$path)=@_;
        # Retain the actual raw acquisition BEFORE fallible metadata.
        my $o={fh=>$fh,role=>$role,dirStream=>$dir_stream,path=>$path,attempted=>0,closed=>0,
          originalClose=>sub {$dir_stream?CORE::closedir($fh):CORE::close($fh)}};
        push @owned,$o;
        my $fd=CORE::fileno($fh);$fail->() unless defined($fd)&&$fd>=3;
        for my $other(@owned) {
          next if $other==$o;$fail->() if $other->{fh}==$fh
            ||(!$other->{closed}&&defined($other->{fd})&&$other->{fd}==$fd);
        }
        $o->{fd}=$fd;$o->{identity}=[CORE::stat($fh)];$fail->() unless @{$o->{identity}}==13;
        $roles{$role}=$o;return $o;
      };
      my $lookup=sub {
        my ($cell,$closed_allowed)=@_;
        # Inspect the ORIGINAL operand cell before candidate FETCH/comparison.
        my $sv=B::svref_2object($cell);
        $fail->() if $sv->FLAGS&0x00f00000;
        $fail->() unless ref($sv) eq 'B::IV'&&($sv->FLAGS&B::SVf_ROK());
        my $gv=$sv->RV;$fail->() unless ref($gv) eq 'B::GV';
        $fail->() if $gv->FLAGS&0x00f00000;
        my $gm=$gv->MAGIC;$fail->() if defined($gm);
        my $io=$gv->IO;$fail->() unless ref($io) eq 'B::IO';
        $fail->() if $io->FLAGS&0x00e00000;
        my $im=$io->MAGIC;$fail->() if defined($im);
        my $fh=$$cell;
        for my $o(@owned) {
          next unless $o->{fh}==$fh;my $fd=CORE::fileno($fh);
          if($o->{closed}) {$fail->() unless $closed_allowed&&!defined($fd);return $o;}
          $fail->() if $o->{attempted}||!defined($fd)||$fd!=$o->{fd};
          my $kind=$o->{path}?($o->{path}{directory}?'directory':'file'):($o->{dirStream}?'directory':'pipe');
          $same_physical->($o->{identity},[CORE::stat($fh)],$kind);
          return $o;
        }
        $fail->();
      };
      my $dispose=sub {
        my ($o,$fixture)=@_;return 0 if $o->{attempted};
        $o->{attempted}=1;$o->{fixture}=$fixture;
        $!=0;my $ok=eval {$o->{originalClose}->()};
        my $error=$@;my $errno=0+$!;
        $o->{closed}=1 if $ok&&!length($error)&&!$errno&&!defined(CORE::fileno($o->{fh}));
        $latch->() unless $o->{closed};return $o->{closed};
      };
      my ($job,$selector,$census);my (@pipe_names,@wait,@ready,@census_names);my %reads;
      my $helper_enter=sub {
        my ($path)=@_;$check->();$fail->() unless @jobs&&!defined($job);
        $job=shift @jobs;$fail->() unless $job->{path} eq $path;
        @pipe_names=qw(in out err setup);@wait=([0,0],[0,0],[0,0],[424242,0]);
        @ready=(['out-r','err-r','setup-r'],['out-r']);
        %reads=('out-r'=>[1,0],'err-r'=>[0],'setup-r'=>[0]);
        $selector=undef;$census=undef;@census_names=();
      };
      my $helper_leave=sub {
        $check->();$fail->() if @pipe_names||@wait||@ready||@census_names||grep {@$_} values %reads;
        $fail->() unless defined($job)&&defined($census)&&$census->{closed};
        for my $name(qw(in-r in-w out-r out-w err-r err-w setup-r setup-w)) {
          my $o=$roles{$job->{prefix}.'.'.$name};$fail->() unless defined($o)&&$o->{closed}&&!defined(CORE::fileno($o->{fh}));
        }
        $job=undef;
      };
      my $deny=sub {$latch->();die "$fault\n";};
```

#### Combined consumer dispatcher literal — sole port layer and execution

Continue the SAME template literal directly after the previous block:

```perl
      my ($loaded,$setup_error,$body_ok,$primary);my $load_complete=0;my $outcomes={};
      my $open_ordinal=0;my $helpers=0;my $repeat_delta;
      {
        no warnings qw(redefine once);
        local *CORE::GLOBAL::sysopen=sub (*$$;$) {
          $check->();$fail->() unless @_==3&&!defined($_[0])&&!ref($_[1])&&!ref($_[2]);
          my $p=$paths{$_[1]};$fail->() unless defined($p);
          my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()
            |($p->{directory}?Fcntl::O_DIRECTORY():Fcntl::O_NONBLOCK());
          $fail->() unless $_[2]==$flags&&!exists($roles{$p->{role}});
          $take->('sysopen',$p->{role});++$open_ordinal;
          return 0 if $mode eq 'open-undefined'&&$open_ordinal==$slot;
          CORE::sysopen(my $fh,$p->{actual},$flags) or $fail->();
          my $o=$register->($fh,$p->{role},0,$p);
          $same_physical->($p->{identity},$o->{identity},$p->{directory}?'directory':'file');
          $o->{fcntlQueue}=[[Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],
            [Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]];
          $_[0]=$fh;$o->{exposed}=1;
          return 0 if $mode eq 'open-false'&&$open_ordinal==$slot;
          die "TEST_STAGED_NOMINATED_OPEN_THROW\n" if $mode eq 'open-throw'&&$open_ordinal==$slot;
          return 1;
        };
        local *CORE::GLOBAL::pipe=sub (**) {
          $check->();$fail->() unless @_==2&&!defined($_[0])&&!defined($_[1])
            &&defined($job)&&@pipe_names;
          my $name=shift @pipe_names;my $prefix=$job->{prefix}.'.'.$name;
          $take->('pipe',$prefix);
          CORE::pipe(my $a,my $b) or $fail->();
          # Both originals survive a failure while registering either member.
          my $oa={fh=>$a,role=>$prefix.'-r',dirStream=>0,attempted=>0,closed=>0,
            originalClose=>sub {CORE::close($a)}};
          my $ob={fh=>$b,role=>$prefix.'-w',dirStream=>0,attempted=>0,closed=>0,
            originalClose=>sub {CORE::close($b)}};
          push @owned,$oa,$ob;
          for my $o($oa,$ob) {
            $o->{fd}=CORE::fileno($o->{fh});$o->{identity}=[CORE::stat($o->{fh})];
            $fail->() unless defined($o->{fd})&&$o->{fd}>=3&&@{$o->{identity}}==13
              &&Fcntl::S_ISFIFO($o->{identity}[2]);
            for my $other(@owned) {
              next if $other==$o;$fail->() if $other->{fh}==$o->{fh}
                ||(!$other->{closed}&&defined($other->{fd})&&$other->{fd}==$o->{fd});
            }
            $roles{$o->{role}}=$o;
          }
          $_[0]=$a;$_[1]=$b;$oa->{exposed}=1;$ob->{exposed}=1;
          if($name eq 'out') {
            my $row="-r--r--r-- 1 root wheel 16 Jan 1 2026 ".$job->{path}."\n";
            $!=0;my $n=CORE::syswrite($b,$row,length($row));
            $fail->() unless defined($n)&&$n==length($row)&&!$!;
          }
          return 1;
        };
        local *CORE::GLOBAL::binmode=sub (*;$) {
          $check->();$fail->() unless @_==1;my $o=$lookup->(\($_[0]),0);
          $take->('binmode',$o->{role});$fail->() if $o->{binary}++;
          CORE::binmode($o->{fh}) or $fail->();return 1;
        };
        local *CORE::GLOBAL::fcntl=sub (*$$) {
          $check->();$fail->() unless @_==3;my $o=$lookup->(\($_[0]),0);
          $take->('fcntl',$o->{role});
          if($o->{path}) {
            $fail->() unless @{$o->{fcntlQueue}};my $want=shift @{$o->{fcntlQueue}};
            $fail->() unless $_[1]==$want->[0]&&$_[2]==$want->[1];
          } else {
            $fail->() unless defined($job)&&$o->{role} eq $job->{prefix}.'.setup-w'
              &&!$o->{configured}++&&$_[1]==Fcntl::F_SETFD()&&$_[2]==Fcntl::FD_CLOEXEC();
          }
          $!=0;my $v=CORE::fcntl($o->{fh},$_[1],$_[2]);
          $fail->() unless defined($v)&&!$!;return $v;
        };
        local *CORE::GLOBAL::stat=sub (;*) {
          $check->();$fail->() unless @_==1&&wantarray;my $o=$lookup->(\($_[0]),0);
          $fail->() unless $o->{path};$take->('stat',$o->{role});
          my @s=CORE::stat($o->{fh});$same_physical->($o->{path}{identity},\@s,$o->{path}{directory}?'directory':'file');
          return @{$project->($o->{path},\@s)};
        };
        local *CORE::GLOBAL::lstat=sub (;*) {
          $check->();$fail->() unless @_==1&&wantarray&&!ref($_[0]);
          my $p=$paths{$_[0]};$fail->() unless defined($p);$take->('lstat',$p->{role});
          my @s=CORE::lstat($p->{actual});$same_physical->($p->{identity},\@s,$p->{directory}?'directory':'file');
          return @{$project->($p,\@s)};
        };
        local *CORE::GLOBAL::sysseek=sub (*$$) {
          $check->();$fail->() unless @_==3;my $o=$lookup->(\($_[0]),0);
          $fail->() unless $o->{path}&&!$o->{path}{directory}&&$_[1]==0&&$_[2]==0;
          $take->('seek',$o->{role});$fail->() if $o->{readQueue}&&@{$o->{readQueue}};
          $o->{readQueue}=[length($o->{path}{body}),0];
          my $v=CORE::sysseek($o->{fh},0,0);$fail->() unless defined($v)&&$v==0;return $v;
        };
        local *CORE::GLOBAL::sysread=sub (*\$$;$) {
          $check->();$fail->() unless @_==3&&ref($_[1]) eq 'SCALAR'&&$_[2]==65536;
          my $buffer=$_[1];$fail->() unless !ref($$buffer)&&$$buffer eq '';
          my $o=$lookup->(\($_[0]),0);$take->('read',$o->{role});
          my ($want,$pipe_read);
          if($o->{path}) {
            $fail->() unless !$o->{path}{directory}&&$o->{readQueue}&&@{$o->{readQueue}};
            $want=shift @{$o->{readQueue}};
          } else {
            $fail->() unless defined($job)&&$o->{role}=~/\A\Q$job->{prefix}\E\.(out-r|err-r|setup-r)\z/;
            my $name=$1;my $queue=$reads{$name};$fail->() unless ref($queue) eq 'ARRAY'&&@$queue;
            $want=shift @$queue;$pipe_read=1;
            my $write=$name=~s/-r\z/-w/r;
            $fail->() unless $roles{$job->{prefix}.'.'.$write}{closed};
          }
          $!=0;my $n=CORE::sysread($o->{fh},$$buffer,65536);
          $fail->() unless defined($n)&&!$!&&!utf8::is_utf8($$buffer)&&$n==length($$buffer);
          $fail->() unless $pipe_read?($want?$n>0:$n==0):$n==$want;
          return $n;
        };
        local *CORE::GLOBAL::fileno=sub (*) {
          $check->();$fail->() unless @_==1;my $o=$lookup->(\($_[0]),1);
          $take->('fileno',$o->{role});return CORE::fileno($o->{fh});
        };
        local *CORE::GLOBAL::close=sub (;*) {
          $fail->() unless @_==1;my $o=$lookup->(\($_[0]),0);
          $fail->() if $o->{dirStream};$take->('close',$o->{role});return $dispose->($o,0);
        };
        local *CORE::GLOBAL::opendir=sub (*$) {
          $check->();$fail->() unless @_==2&&!defined($_[0])&&!ref($_[1])
            &&$_[1] eq '/dev/fd'&&defined($job)&&!defined($census)&&!@pipe_names;
          my $role=$job->{prefix}.'.census';$take->('opendir',$role);
          CORE::opendir(my $fh,'/dev/fd') or $fail->();
          $census=$register->($fh,$role,1,undef);$_[0]=$fh;$census->{exposed}=1;
          my @live=grep {!$_->{closed}} @owned;
          $fail->() unless @live==$job->{stageCount}+9;
          my %fds;
          for my $o(@live) {$lookup->(\($o->{fh}),0);$fail->() if $fds{$o->{fd}}++;}
          @census_names=('.', '..','0','1','2',map {"$_->{fd}"} @live);
          return 1;
        };
        local *CORE::GLOBAL::readdir=sub (*) {
          $check->();$fail->() unless @_==1&&!wantarray&&defined($census);
          my $o=$lookup->(\($_[0]),0);$fail->() unless $o==$census;
          $take->('readdir',$o->{role});$!=0;return shift @census_names;
        };
        local *CORE::GLOBAL::closedir=sub (*) {
          $fail->() unless @_==1;my $o=$lookup->(\($_[0]),0);
          $fail->() unless $o->{dirStream}&&defined($census)&&$o==$census&&!@census_names;
          $take->('closedir',$o->{role});return $dispose->($o,0);
        };
        local *CORE::GLOBAL::fork=sub () {
          $check->();$fail->() unless @_==0&&defined($job)&&defined($census)&&$census->{closed};
          $take->('fork',$job->{prefix});return 424242;
        };
        local *CORE::GLOBAL::waitpid=sub ($$) {
          $check->();$fail->() unless @_==2&&$_[0]==424242&&$_[1]==POSIX::WNOHANG()
            &&defined($job)&&@wait;
          $take->('wait',$job->{prefix});my $v=shift @wait;$?=$v->[1];return $v->[0];
        };
        local *IO::Select::can_read=sub {
          $check->();$fail->() unless @_==2&&ref($_[0]) eq 'IO::Select'&&$_[1]==0.01&&defined($job)&&@ready;
          $take->('ready',$job->{prefix});$selector=$_[0] unless defined($selector);
          $fail->() unless $_[0]==$selector;my $want=shift @ready;my @members=$_[0]->handles;
          $fail->() unless @members==@$want&&$_[0]->count==@$want;my %members;
          for my $fh(@members) {my $o=$lookup->(\$fh,0);$fail->() if $members{$o->{role}}++;}
          my @answer;
          for my $name(@$want) {
            my $role=$job->{prefix}.'.'.$name;$fail->() unless $members{$role};push @answer,$roles{$role}{fh};
          }
          return @answer;
        };
        local *Time::HiRes::clock_gettime=sub (;$) {
          $check->();$fail->() unless @_==1&&$_[0]==Time::HiRes::CLOCK_MONOTONIC();
          my $role=defined($job)?$job->{prefix}:!$calls{clock}?'startup':'stage';
          $take->('clock',$role);return 0;
        };
        local *CORE::GLOBAL::exec=$deny;local *CORE::GLOBAL::system=$deny;
        local *CORE::GLOBAL::open=sub (*;$@) {$deny->();};local *CORE::GLOBAL::syswrite=sub (*$;$$) {$deny->();};
        local *CORE::GLOBAL::readpipe=sub (_) {$deny->();};local *CORE::GLOBAL::kill=sub (@) {$deny->();};
        local *CORE::GLOBAL::chdir=sub (;$) {$deny->();};local *CORE::GLOBAL::unlink=sub (@) {$deny->();};
        local *CORE::GLOBAL::mkdir=sub (_;$) {$deny->();};local *CORE::GLOBAL::rmdir=sub (_) {$deny->();};
        local *CORE::GLOBAL::rename=sub ($$) {$deny->();};local *CORE::GLOBAL::seek=sub (*$$) {$deny->();};
        local *CORE::GLOBAL::truncate=sub ($$) {$deny->();};local *CORE::GLOBAL::socket=sub (*$$$) {$deny->();};
        local *CORE::GLOBAL::socketpair=sub (**$$$) {$deny->();};local *CORE::GLOBAL::connect=sub (*$) {$deny->();};
        local *CORE::GLOBAL::accept=sub (**) {$deny->();};
        local *IO::Select::can_write=$deny;local *IO::Select::has_exception=$deny;
        local *Time::HiRes::sleep=$deny;local *POSIX::dup2=$deny;local *POSIX::close=$deny;local *POSIX::_exit=$deny;
        my %prototypes=(sysopen=>'*$$;$',pipe=>'**',binmode=>'*;$',fcntl=>'*$$',stat=>';*',
          lstat=>';*',sysseek=>'*$$',sysread=>'*\\$$;$',fileno=>'*',close=>';*',
          opendir=>'*$',readdir=>'*',closedir=>'*',fork=>'',waitpid=>'$$');
        for my $op(sort keys %prototypes) {
          my $port='CORE::GLOBAL'->can($op);my $core=prototype('CORE::'.$op);
          $fail->() unless defined($port)&&ref($port) eq 'CODE'&&defined($core)
            &&$core eq $prototypes{$op}&&defined(prototype($port))&&prototype($port) eq $core;
        }
        for my $op(qw(exec system)) {my $port='CORE::GLOBAL'->can($op);
          $fail->() unless defined($port)&&ref($port) eq 'CODE'&&!defined(prototype($port));}
        my $source=MIME::Base64::decode_base64($ARGV[0]);
        $body_ok=eval {
          $loaded=eval($source."\n1;\n");$setup_error=$@;$check->();
          $fail->() unless $loaded&&!length($setup_error);$load_complete=1;
          my $capture=\&task6a_origin_capture;
          local *main::task6a_origin_capture=sub {
            $check->();$fail->() unless @_==4&&$_[0] eq '/bin/ls'
              &&ref($_[1]) eq 'ARRAY'&&@{$_[1]}==2&&$_[1][0] eq '-lde'
              &&$_[2]==2&&$_[3]==4096;
            $helper_enter->($_[1][1]);++$helpers;
            my $value=$capture->(@_);$check->();$helper_leave->();return $value;
          };
          my $operation=$mode eq 'premature-recheck'?'recheck':$mode eq 'premature-release'?'release':'hold';
          my %operations=(hold=>\&task6a_origin_hold_staged_custody,
            recheck=>\&task6a_origin_recheck_staged_custody,release=>\&task6a_origin_release_staged_custody);
          my $value=eval {$mode eq 'arity'?$operations{$operation}->(1):$operations{$operation}->()};
          my $error=$@;$check->();
          my $refused=!defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
          $fail->() unless $refused||(!length($error)&&ref($value) eq 'HASH');
          $outcomes->{refused}=$refused?JSON::PP::true:JSON::PP::false;
          $outcomes->{$operation}=$value;
          if($mode eq 'healthy') {
            $fail->() if $refused;$outcomes->{recheck}=$operations{recheck}->();
            $outcomes->{release}=$operations{release}->();$check->();
          } else {$fail->() unless $refused;}
          my $before=scalar(@events);
          for my $name(qw(hold recheck release)) {
            my $again=eval {$operations{$name}->()};my $again_error=$@;$check->();
            $fail->() unless !defined($again)&&$again_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
          }
          $repeat_delta=scalar(@events)-$before;$fail->() if $repeat_delta;
          $fail->() if @grammar||@jobs||defined($job);1;
        };
        $primary=$@;
        # Separate fixture rescue never creates consumer definite-close evidence.
        for my $o(@owned) {next if $o->{attempted};eval {$dispose->($o,1)};$latch->() if $@;}
        die length($setup_error)?$setup_error:"$fault\n" unless $load_complete;
        $check->();die $primary unless $body_ok;
      }
      my $definite=grep {$_->{closed}&&!defined(CORE::fileno($_->{fh}))} @owned;
      my $fixture_closed=grep {$_->{closed}&&$_->{fixture}} @owned;
      $fail->() unless $definite==@owned&&!$fixture_closed;
      my $stage_closed=grep {$_->{closed}&&$_->{path}} @owned;
      my $out={%$outcomes,harnessFault=>undef,productionAuthority=>JSON::PP::false,
        scope=>'ordinary-staged-custody-consumer-fixture-only',
        syntheticGeometry=>JSON::PP::true,syntheticVendorAndSelected=>JSON::PP::true,
        helpers=>$helpers,ownedCount=>scalar(@owned),definitelyClosed=>0+$definite,
        stageClosed=>0+$stage_closed,helperClosed=>$definite-$stage_closed,
        fixtureClosed=>0+$fixture_closed,remainingOperations=>scalar(@grammar),
        repeatEffectDelta=>$repeat_delta,calls=>\%calls,events=>\@events};
      my $metadata=JSON::PP->new->canonical->utf8->encode({map {$_=>$out->{$_}} grep {$_ ne 'events'} keys %$out});
      $fail->() if length($metadata)>16384;
      my $json=JSON::PP->new->canonical->utf8->encode($out);$fail->() if length($json)>8388608;
      print $json;exit 0;
    }
```

#### Combined consumer memory mapping and invocation bounds

Extend only systemObject's closed-kind source mapping and payload interpolation.
Do not change its ordinary-host/root refusal, sole-main removal, scrubbed env,
fixed Apple Perl, cwd or timeout. The memory-only admission assignment is not an
exported initializer or production setter:

```javascript
if(kind==='staged-custody') {
  source=replaceOnce(source,'exec {$tool} $tool,@$args;',
    'CORE::GLOBAL::exec($tool,$tool,@$args);');
  source=replaceOnce(source,
    "my $staged_vendor_pin='ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953';",
    "my $staged_vendor_pin='bf6cedd405c26f5f933e45436d8ec84b2780297377bb44f40deb6c44a91f6a6e';");
  source=replaceOnce(source,'sub task6a_origin_hold_staged_custody {',String.raw`
if($mode ne 'absent') {$staged_admission=$fixture_admission;}
sub task6a_origin_hold_staged_custody {`);
}
```

In program interpolate STAGED_CUSTODY_PROGRAM immediately before the current
STAGED_CAPTOR_PORT_PROGRAM interpolation. Before the existing spawn, replace
the current source-argument construction with the following shared construction;
the byte limit and stdin bound apply ONLY to the new closed kind:

```javascript
const argv=['-f','-e',program,Buffer.from(source).toString('base64')];
const env={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
const input=JSON.stringify({kind,record,expected});
if(kind==='staged-custody') {
  // Observed host ARG_MAX is 1048576. Reserve 262144 bytes for kernel/pointer
  // overhead; count ACTUAL final UTF8 argv/env strings, not source estimates.
  const byteTotal=Buffer.byteLength('/usr/bin/perl')+1
    +argv.reduce((n,v)=>n+Buffer.byteLength(v)+1,0)
    +Object.entries(env).reduce((n,[k,v])=>n+Buffer.byteLength(k+'='+v)+1,0);
  assert.ok(byteTotal<=786432,'staged custody argv budget exceeded');
  assert.ok(Buffer.byteLength(input)<=262144,'staged custody stdin budget exceeded');
}
const r=spawnSync('/usr/bin/perl',argv,{
  input,cwd:'/',env,timeout:record?.fifoRace?500:10000,
  maxBuffer:['staged-captor-ports','staged-custody'].includes(kind)?8388608:65536,
});
```

First-cycle execution order (each child consumes only its own frozen grammar):

- [ ] Two exact independent pre-effect reviews; resolve C/I findings.
- [ ] Fresh preservation/tool/source/test checks; confirm ARG_MAX1048576.
- [ ] Add only fs import, literal prefix table/helper and first healthy test.
  Run fixed Node with --test-name-pattern selecting EXACT first test.
  Expect the JavaScript assertion "staged custody consumer missing: hold".
  No Perl, backing-byte read, initializer, lower port or fixture acquisition.
- [ ] After observed causal RED, add combined constant/mapping/bounds and actual
  production capsule from the four source blocks. Keep final main unchanged.
- [ ] Add the remaining first-cycle test registrations. Check syntax/diff and
  review the ACTUAL source/test delta before the first Perl child.
- [ ] Run all tests matching "staged custody actual consumer", read complete
  output and natural terminal. Healthy407/H42/390 and 36 exact failed-open
  profiles are expectations until that run, NOT existing results.
- [ ] Continue the remaining mandatory negative/mutation cycles BEFORE any
  implementation delivery. No protected staging/native/loaded/cutover claim.

Exact first-cycle commands (run from
/Users/setrox/ai/setrox/.worktrees/setfarm-staged-custody-capsule-20261004-v1):

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --check scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody actual consumer holds, rechecks and releases twelve originals$' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody actual consumer ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

The second command is the single causal RED BEFORE source insertion; the third
is the41-case first-cycle verification AFTER actual source/test review. Preserve
all raw outputs/natural terminals. Use no build/runtime-guard bypass or ambient
Node/Perl fallback. Do not rerun closed predecessor invocations.

Source-only self-review: code steps have literal content and stable anchors;
first-cycle queues are defined by the four grammar productions and exact
prefix cut; the source insertion joins parent custody lexicals and leaves main
refusal unchanged; old vendor transport uses its causal unique-policy anchor.
Initial package-pin transcription was corrected against actual shasum to
bf6cedd405c26f5f933e45436d8ec84b2780297377bb44f40deb6c44a91f6a6e.
This correction was docs-only and preceded all execution. No setup failure
counts as RED. Later matrix literals remain unfinished and prevent delivery,
not safe first-cycle progress.

#### First actual consumer cycle — observed, closed, no replay

Actual RED5c77e8 CLOSED1 was the missing hold assertion before fixtures/Perl.
After both exact actual-delta C0/I0/M0 reviews, root0212de CLOSED0 preflight
01:48:06 preserved all2093 inputs/tools/npm and all old roots. ONE approved
41-profile invocation0089e6 yielded managed87334; root alone polled it once:
b86dbf naturallyCLOSED0, full836-token output,41PASS/0FAIL/CANCEL/SKIP/TODO,
2609.491375ms. NO further poll87334/replay of this first invocation.
Actual healthy assertions proved407 clocks/H42 port grammar,390 physical
originals/12 stage+378 helper definite closes, full queue drain and repeat0.
All12 undefined,12 exposed-false and12 exposed-throw prefixes passed separately.
Rootpost4390fa CLOSED0 01:49:34 source434a6a/testca826/spec1f26/planf576,
all2093/69713582B/physical26b7d17e4a90f2167af8fad52e6d502ad71b5405d6baedefbe39be38942a5170.
Independent post01:51:20–01:52:13 C0/I0/M0 allretained/cacheidentities/
originaltwo/backups/journal/canonicalclean; disk8358316KiBfree97%,62%memoryfree,
no thermalwarning; HTTP3080/18789200,3333knownrefused. No native/protected or
service qualification. Implementation remains uncommitted until full matrix.

#### Next closed cycle: malformed first-open nominees and real callback mutant

This is an UNEXECUTED candidate test-only delta. Production434a6a stays unchanged.
Add exactly nine closed mode names to the combined dispatch mode list:
unknown-cell, unknown-handle, unknown-blessed-glob, unknown-overloaded,
unknown-indirect, unknown-scalar-ref, unknown-array, unknown-hash, unknown-coderef.
They retain slot0 and use exactly FOUR operations: startup clock, hold clock,
lstat d0, sysopen d0. No CORE file/pipe/DIR acquisition constructs a nominee,
and no close/config/helper/readiness/wait follows. This is not native leak-freedom
for a malformed real-FD object. Node backing-byte preflight is separate ordinary
read-only fixture IO, not a nominee FD acquisition.

Preload fixed Symbol and overload ONLY inside the new closed branch before
hook installation. Main independently read installed Symbol.pm101–107 and
perltie.pod903–908: gensym makes an anonymous GLOB without IO; tie *glob differs
from tying its scalar reference. Do not use geniosym, select, open, pipe, socket,
fileno or close to manufacture or finalize these nominees.

Append this literal after the combined branch's existing deny closure and before
the local port layer. Classes are trusted fixture-only bytes, never production
declarations or caller-provided code. Class compilation/load failure is fatal:

```perl
      my $open_ordinal=0;
      require Symbol;require overload;
      my %callbacks=map {$_=>0} qw(FETCH STORE FILENO CLOSE READ PRINT PRINTF WRITE READLINE GETC SEEK TELL EOF BINMODE CALL string numeric bool compare);
      my %factory=(scalar=>0,handle=>0);
      my %finalization=(untie=>0,destroy=>0);
      my $counts={callbacks=>\%callbacks,factory=>\%factory,finalization=>\%finalization};
      my ($nominee_cell,$nominee_glob,$nominee_shape,$before_callbacks,$after_finalization);
      my $classes=<<'TEST_STAGED_CLASSES';
package TestStagedScalar;
sub TIESCALAR {my ($class,$counts)=@_;++$counts->{factory}{scalar};bless {counts=>$counts},$class;}
sub deny {my ($self,$name)=@_;++$self->{counts}{callbacks}{$name};die "TEST_STAGED_CANDIDATE_CALLBACK\n";}
sub FETCH {$_[0]->deny('FETCH');}
sub STORE {$_[0]->deny('STORE');}
sub UNTIE {++$_[0]{counts}{finalization}{untie};}
sub DESTROY {++$_[0]{counts}{finalization}{destroy};}
package TestStagedHandle;
sub TIEHANDLE {my ($class,$counts)=@_;++$counts->{factory}{handle};bless {counts=>$counts},$class;}
sub deny {my ($self,$name)=@_;++$self->{counts}{callbacks}{$name};die "TEST_STAGED_CANDIDATE_CALLBACK\n";}
sub FILENO {$_[0]->deny('FILENO');}
sub CLOSE {$_[0]->deny('CLOSE');}
sub READ {$_[0]->deny('READ');}
sub PRINT {$_[0]->deny('PRINT');}
sub PRINTF {$_[0]->deny('PRINTF');}
sub WRITE {$_[0]->deny('WRITE');}
sub READLINE {$_[0]->deny('READLINE');}
sub GETC {$_[0]->deny('GETC');}
sub SEEK {$_[0]->deny('SEEK');}
sub TELL {$_[0]->deny('TELL');}
sub EOF {$_[0]->deny('EOF');}
sub BINMODE {$_[0]->deny('BINMODE');}
sub UNTIE {++$_[0]{counts}{finalization}{untie};}
sub DESTROY {++$_[0]{counts}{finalization}{destroy};}
package TestStagedOverloaded;
use overload
    '""'=>sub {++$_[0]{counts}{callbacks}{string};die "TEST_STAGED_CANDIDATE_CALLBACK\n";},
    '0+'=>sub {++$_[0]{counts}{callbacks}{numeric};die "TEST_STAGED_CANDIDATE_CALLBACK\n";},
    'bool'=>sub {++$_[0]{counts}{callbacks}{bool};die "TEST_STAGED_CANDIDATE_CALLBACK\n";},
    '=='=>sub {++$_[0]{counts}{callbacks}{compare};die "TEST_STAGED_CANDIDATE_CALLBACK\n";},
    fallback=>0;
sub DESTROY {++$_[0]{counts}{finalization}{destroy};}
package main;
1;
TEST_STAGED_CLASSES
      my $classes_ok=eval $classes;my $classes_error=$@;
      $fail->() unless $classes_ok&&!length($classes_error);
      my $shape=sub {
        my ($cell)=@_;my $sv=B::svref_2object($cell);
        my $out={cellClass=>ref($sv),cellFlags=>0+$sv->FLAGS};
        if($sv->FLAGS&B::SVf_ROK()) {
          my $rv=$sv->RV;$out->{rvClass}=ref($rv);$out->{rvFlags}=0+$rv->FLAGS;
          if(ref($rv) eq 'B::GV') {
            my $magic=$rv->MAGIC;$out->{gvMagic}=defined($magic)?1:0;
            my $io=$rv->IO;$out->{ioClass}=ref($io);
            if(ref($io) eq 'B::IO') {
              $out->{ioFlags}=0+$io->FLAGS;my $im=$io->MAGIC;$out->{ioMagic}=defined($im)?1:0;
            }
          }
        }
        return $out;
      };
      my $nominate=sub {
        my ($cell)=@_;$fail->() unless $open_ordinal==1&&!defined($nominee_cell)&&!@owned;
        $nominee_cell=$cell; # retain ORIGINAL pending cell before nomination
        if($mode eq 'unknown-cell') {
          tie $$cell,'TestStagedScalar',$counts;
          # No candidate VALUE access after tying this original alias.
        } elsif($mode eq 'unknown-handle'||$mode eq 'unknown-blessed-glob') {
          my $g=Symbol::gensym();$nominee_glob=$g;
          if($mode eq 'unknown-handle') {tie *$g,'TestStagedHandle',$counts;}
          else {bless $g,'TestStagedBlessedGlob';}
          $$cell=$g;
        } elsif($mode eq 'unknown-overloaded') {$$cell=bless {counts=>$counts},'TestStagedOverloaded';}
        elsif($mode eq 'unknown-indirect') {$$cell='TEST_STAGED_UNOPENED_HANDLE';}
        elsif($mode eq 'unknown-scalar-ref') {my $value=0;$$cell=\$value;}
        elsif($mode eq 'unknown-array') {$$cell=[];}
        elsif($mode eq 'unknown-hash') {$$cell={};}
        elsif($mode eq 'unknown-coderef') {$$cell=sub {++$callbacks{CALL};die "TEST_STAGED_CANDIDATE_CALLBACK\n";};}
        else {$fail->();}
        $nominee_shape=$shape->($cell);
        $fail->() unless ref($nominee_shape) eq 'HASH';
        $fail->() if grep {$_} values %callbacks;
        if($mode eq 'unknown-cell') {
          $fail->() unless $factory{scalar}==1&&($nominee_shape->{cellFlags}&0x00e00000);
        } elsif($mode eq 'unknown-handle') {
          $fail->() unless $factory{handle}==1&&$nominee_shape->{rvClass} eq 'B::GV'
            &&($nominee_shape->{gvMagic}||($nominee_shape->{ioFlags}//0)&0x00e00000||$nominee_shape->{ioMagic});
        }
        return 1;
      };
```

The existing following-layer line is replaced EXACTLY from
`my $open_ordinal=0;my $helpers=0;my $repeat_delta;` to
`my $helpers=0;my $repeat_delta;`. The ordinal is now initialized once before
the fixture constructor closures; no duplicate lexical shadows it.
In grammar, immediately after absent branch and before healthy/open branch add:

```perl
      elsif($mode=~/\Aunknown-/) {
        $emit->('clock','stage');$emit->('lstat','d0');$emit->('sysopen','d0');
      }
```

In sysopen, immediately after take('sysopen',role) and ++open_ordinal, BEFORE
undefined nomination/CORE acquisition, add:

```perl
          if($mode=~/\Aunknown-/) {$nominate->(\($_[0]));return 1;}
```

After actual refusal/repeat checks and complete queue drain, BEFORE fixture FD
finalization, add the following memory-only finalizer. Never serialize a nominee
or B object, never call nominee fileno/close, and snapshot consumer callbacks
before untie/destruction. Memory finalization is not source definite-close:

```perl
          if($mode=~/\Aunknown-/) {
            $fail->() unless defined($nominee_cell)&&defined($nominee_shape)&&!@owned;
            $before_callbacks={%callbacks};
            if($mode eq 'unknown-cell') {untie $$nominee_cell;}
            elsif($mode eq 'unknown-handle') {untie *$nominee_glob;}
            $after_finalization={%finalization};
            $outcomes->{nomineeShape}={%$nominee_shape};
            $outcomes->{candidateCallbacksBeforeFinalizer}=$before_callbacks;
            $outcomes->{factoryCounts}={%factory};
            $outcomes->{memoryFinalizationCounts}=$after_finalization;
          }
```

Do NOT reject nonzero callbacks inside this harness's final output: that would
turn the coherent source mutant into a harness fault. Node's semantic assertion
below owns that verdict. Constructor-time callbacks remain a factory/setup fault.

Append these ten tests in the ordinary-host branch. The regression target is
original-cell magic access before value, not a source-text change detector:

```javascript
const STAGED_CALLBACK_ZERO={FETCH:0,STORE:0,FILENO:0,CLOSE:0,READ:0,PRINT:0,PRINTF:0,
  WRITE:0,READLINE:0,GETC:0,SEEK:0,TELL:0,EOF:0,BINMODE:0,CALL:0,string:0,numeric:0,bool:0,compare:0};
for(const mode of ['unknown-cell','unknown-handle','unknown-blessed-glob','unknown-overloaded',
  'unknown-indirect','unknown-scalar-ref','unknown-array','unknown-hash','unknown-coderef'])
  test('staged custody malformed nominee rejects '+mode+' without callback or FD',()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,true);assert.equal(r.ownedCount,0);assert.equal(r.stageClosed,0);
    assert.equal(r.helperClosed,0);assert.equal(r.helpers,0);
    assert.deepEqual(r.calls,{clock:2,lstat:1,sysopen:1});
    assert.deepEqual(r.candidateCallbacksBeforeFinalizer,STAGED_CALLBACK_ZERO);
    assert.deepEqual(r.factoryCounts,{scalar:mode==='unknown-cell'?1:0,handle:mode==='unknown-handle'?1:0});
  });
test('staged custody malformed nominee catches removal of pre-value cell magic guard',()=>{
  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),
    '    task6a_origin_refuse() if $sv->FLAGS & 0x00f00000;','');
  const r=stagedCustody('unknown-cell',0,{sourceOverride:source});
  assert.equal(r.refused,true);assert.equal(r.ownedCount,0);assert.equal(r.helpers,0);
  assert.deepEqual(r.calls,{clock:2,lstat:1,sysopen:1});
  assert.deepEqual(r.candidateCallbacksBeforeFinalizer,{...STAGED_CALLBACK_ZERO,FETCH:1});
  assert.throws(()=>assert.deepEqual(r.candidateCallbacksBeforeFinalizer,STAGED_CALLBACK_ZERO),
    {code:'ERR_ASSERTION'});
});
```

Exact next-cycle command, same fixed cwd as the first cycle:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody malformed nominee ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Two exact pre-effect reviews, actual test-delta review, syntax/diff and fresh
preservation gates precede this new ten-profile invocation. Compile/setup/shape/
queue faults never count as negative success or mutant kill. Production stays
434a6a; if actual evidence finds a production gap, write a causal RED before its
smallest source fix. No replay87334, no implementation delivery before fullmatrix.

#### Malformed nominee cycle — observed terminal and preserved inputs

ONE reviewed malformed focusa2ec3c naturallyCLOSED0, full274-token output:
10PASS/0FAIL/CANCEL/SKIP/TODO605.665292ms. Nine candidates refused without
callbacks/FD; guard removal yielded real FETCH1, canonical refusal/four ports.
No replay. Root5ece92 CLOSED0 02:11:10 all2093/69732297B/
physical00ebe0f38ce0a02694a66a5e6fe536113cf794f737c12b40881463a08b5ae90f;
source434/test0f64/planb7a/spec1f26/tools/npm unchanged. Independentpre02:09:50–
02:10:25 C0/I0/M0 retainedcomparators/originaltwo/journal/canonicalclean.
Ordinary fixture behavior only; no native/protected/service admission.

#### Next closed cycle: all twelve false/throw stage-close responses

UNEXECUTED test-only candidate. Production434 unchanged. Adds24 baseline cases
and TWO coherent sealed-close mutants. No new files/production setters/exports.
Physically close each original using captured CORE primitive and check closure
BEFORE nominating false/exception; only one selected STAGE role. Helpers retain
successful responses. Sticky faults remain for physical/grammar failures.
Full healthy407 clocks/H42/390 originals/4448 operations: hold, recheck, twelve
stage closes in acquisition order, no release clocks. Regression target: response
uncertainty mistaken for definite closure, disposal early exit or resurrection.
Two mutants remove only return/exception prerequisite for private definite
closure, retaining post-close inspection, then falsely publish release success.
Driver exposes outcome to Node, not a harness fault.

File: scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js only.
Extend closed mode list with close-false close-throw. Replace slot validation:

```perl
        &&($mode=~/\A(?:open|close)-/ ? $slot>=1 : $slot==0)
```

Replace grammar outer healthy/open condition and inner healthy condition:

```perl
      elsif($mode eq 'healthy'||$mode=~/\A(?:open|close)-/) {
```

```perl
        if($mode eq 'healthy'||$mode=~/\Aclose-/) {
```

Replace combined close port body exactly (same ;* prototype):

```perl
        local *CORE::GLOBAL::close=sub (;*) {
          $fail->() unless @_==1;my $o=$lookup->(\($_[0]),0);
          $fail->() if $o->{dirStream};$take->('close',$o->{role});
          my $closed=$dispose->($o,0);
          if($mode=~/\Aclose-/&&defined($o->{path})) {
            my $n=$o->{role}=~/\Ad([0-5])\z/?1+$1:$o->{role}=~/\Af([0-5])\z/?7+$1:0;
            $fail->() unless $n>=1&&$n<=12&&$closed&&$o->{closed}
              &&$o->{attempted}&&!defined(CORE::fileno($o->{fh}));
            if($n==$slot) {
              $fail->() if exists($outcomes->{nominatedClose});
              $outcomes->{nominatedClose}={role=>''.$o->{role},slot=>0+$n,
                kind=>''.$mode,physicallyClosedBeforeResponse=>JSON::PP::true};
              return 0 if $mode eq 'close-false';
              die "TEST_STAGED_NOMINATED_CLOSE_THROW\n";
            }
          }
          return $closed;
        };
```

Extend EXISTING unique hold-declaration memory replacement: after admission
assignment, before restored hold declaration, insert this observer. Only fresh
primitive scalar/array copies escape; no FH/FD/CV/ledger reference or mutation.

```perl
  sub test_observe_staged_custody {
    task6a_origin_refuse() unless @_==0;
    $staged_vector->(\@staged_originals);
    my ($attempted,$closed)=(0,0);my @closed_flags;
    for my $sealed(@staged_originals) {
      my @binding=$sealed->('binding');
      $attempted+=($binding[2]?1:0);$closed+=($binding[3]?1:0);
      push @closed_flags,$binding[3]?1:0;
    }
    return {phase=>''.$staged_phase,invalid=>0+$staged_invalid,
      uncertain=>0+$staged_uncertain,disposalStarted=>0+$staged_disposal_started,
      sealedClosureCount=>0+scalar(@staged_originals),
      attemptedCount=>0+$attempted,privateClosedCount=>0+$closed,closedFlags=>\@closed_flags};
  }
```

Replace combined driver's healthy-only block. Canonical release refusal is
asserted by Node; coherent false-success remains observable. Setup/initialhold/
recheck faults remain fatal. Snapshot BEFORE repeats can themselves burn:

```perl
          if($mode eq 'healthy') {
            $fail->() if $refused;$outcomes->{recheck}=$operations{recheck}->();
            $outcomes->{release}=$operations{release}->();$check->();
          } elsif($mode=~/\Aclose-/) {
            $fail->() if $refused;$outcomes->{recheck}=$operations{recheck}->();$check->();
            $outcomes->{sourceBeforeRelease}=test_observe_staged_custody();
            my $release=eval {$operations{release}->()};my $release_error=$@;$check->();
            my $release_refused=!defined($release)&&$release_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $fail->() unless $release_refused||(!length($release_error)&&ref($release) eq 'HASH');
            $outcomes->{releaseRefused}=$release_refused?JSON::PP::true:JSON::PP::false;
            $outcomes->{release}=$release;
            $outcomes->{sourceAfterRelease}=test_observe_staged_custody();
          } else {$fail->() unless $refused;}
```

After existing repeat delta assertion, before queue drain, insert:

```perl
          if($mode=~/\Aclose-/) {$outcomes->{sourceAfterRepeats}=test_observe_staged_custody();}
```

Append26 ordinary-host tests. Independent literal counts/flags, acquisition order,
primitive physical-first witness. Common wrapper requires complete queue and
no fixture retry. Mutants memory-only, production on-disk434 unchanged:

```javascript
const STAGED_CLOSE_CALLS={binmode:342,clock:407,close:348,closedir:42,fcntl:90,
  fileno:1110,fork:42,lstat:132,opendir:42,pipe:168,read:228,readdir:1083,
  ready:84,seek:30,stat:120,sysopen:12,wait:168};
const STAGED_CLOSE_ROLES=['d0','d1','d2','d3','d4','d5','f0','f1','f2','f3','f4','f5'];
function assertStagedClosePhysical(r,mode,slot) {
  assert.equal(r.refused,false);
  assert.deepEqual(r.calls,STAGED_CLOSE_CALLS);
  assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],[390,12,378]);
  assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
    STAGED_CLOSE_ROLES);
  assert.deepEqual(r.nominatedClose,{role:STAGED_CLOSE_ROLES[slot-1],slot,kind:mode,
    physicallyClosedBeforeResponse:true});
  assert.deepEqual(r.sourceBeforeRelease,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
    sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:[0,0,0,0,0,0,0,0,0,0,0,0]});
}
function assertStagedCloseUncertain(r,slot) {
  assert.equal(r.releaseRefused,true);assert.equal(r.release,null);
  const flags=[1,1,1,1,1,1,1,1,1,1,1,1];flags[slot-1]=0;
  assert.deepEqual(r.sourceAfterRelease,{phase:'burned',invalid:1,uncertain:1,disposalStarted:1,
    sealedClosureCount:12,attemptedCount:12,privateClosedCount:11,closedFlags:flags});
  assert.deepEqual(r.sourceAfterRepeats,r.sourceAfterRelease);
}
for(const mode of ['close-false','close-throw'])
  for(let slot=1;slot<=12;slot++)
    test('staged custody uncertain close attempts all originals for '+mode+' slot '+slot,()=>{
      const r=stagedCustody(mode,slot);
      assertStagedClosePhysical(r,mode,slot);assertStagedCloseUncertain(r,slot);
    });
for(const mode of ['close-false','close-throw'])
  test('staged custody uncertain close catches false definite-closure mutant for '+mode,()=>{
    const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),
      '$closed=1 if $ok&&!length($close_error)&&$inspected',
      '$closed=1 if $inspected');
    const r=stagedCustody(mode,1,{sourceOverride:source});
    assertStagedClosePhysical(r,mode,1);
    assert.equal(r.releaseRefused,false);
    assert.deepEqual(r.release,{scope:'staged-source-vendor-custody-diagnostic-only',
      productionAuthority:false,fileCount:6,directoryCount:6,handlesClosed:12});
    assert.deepEqual(r.sourceAfterRelease,{phase:'released',invalid:0,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:[1,1,1,1,1,1,1,1,1,1,1,1]});
    assert.throws(()=>assertStagedCloseUncertain(r,1),{code:'ERR_ASSERTION'});
  });
```

ONE next command after both literal/actualreviews, syntax/diff/fresh source/tool/
retention/resource gates, fixed ownroot cwd:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody uncertain close ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Setup/compile/grammar/census/cleanup faults earn no semantic credit. No native/
protected-owner/cutover qualification. Remaining matrix blocks sourcecommit/
PR/build/delivery. No replay first41/malformed10. One first draft orchestration
SyntaxError occurred before any nested tool; no file mutation/effect/testcredit.

#### Close response cycle — observed terminal and preserved inputs

ONE reviewed focus5c36a6 yielded9192; rootpoll1fd3b4 naturallyCLOSED0/full658tokens,
26PASS/0FAIL/CANCEL/SKIP/TODO5197.2295ms. NOPOLL9192/no replay. Baselines all12
attempts/12physical stagecloses/11private definite flags; release burns before
repeats. Two coherent mutants exposed positiveDTO/private12 flags and Nodekill.
Rootpost7b67f1 CLOSED0 02:21:32 same2093/69745948B/
physicalbd1cebb9e4c0611f944a99534ad1b6b25306fbc334261c739325abfda80b8530.
Independentpre02:20:45–48 C0/I0/M0 retainedcomparators/originaltwo/journal/
canonicalclean. Source434/teste8e/planfaa1/spec1f26 unchanged.
Ordinary behavioral qualification only. Fullmatrix stillunfinished.

#### Next closed cycle: twenty plain admission negatives before any stage open

UNEXECUTED test-only delta; production434 stays unchanged. Fresh fixture graph
ONLY: do not mutate actual backing files, source pins, snapshots, registries,
grammar expectations or stickyfault. All20 slot0, canonical hold refusal with
startupclock+holdclock ONLY; zero lstat/sysopen/helper/config/read/close/FD.
Decline selected-content bitflip: no initial independent native-member commitment.
Creation dev/ino physical join and snapshot drift/tied-admission are later cycles.
No mutant in this cycle: removing early guard with only2clock continuation would
be a harness kill, not coherent semantic kill.

Extend combined closed modes with the following exact twenty names:

```perl
admission-undef admission-array admission-extra admission-missing-creator admission-root admission-creation-short admission-creation-string admission-creation-owner admission-creation-type admission-source-count admission-source-order admission-source-numeric admission-source-policy admission-source-bytes-0 admission-source-bytes-1 admission-source-bytes-2 admission-source-bytes-3 admission-vendor-bytes admission-selected-detached admission-selected-member
```

After fresh fixture_admission construction, BEFORE my $emit, insert:

```perl
      if($mode=~/\Aadmission-/) {
        my $a=$fixture_admission;
        if($mode eq 'admission-undef') {$fixture_admission=undef;}
        elsif($mode eq 'admission-array') {$fixture_admission=[];}
        elsif($mode eq 'admission-extra') {$a->{extra}=0;}
        elsif($mode eq 'admission-missing-creator') {delete $a->{creator};}
        elsif($mode eq 'admission-root') {$a->{creator}{rootPath}='/private/tmp//bad';}
        elsif($mode eq 'admission-creation-short') {pop @{$a->{creator}{creationIdentity}};}
        elsif($mode eq 'admission-creation-string') {
          $a->{creator}{creationIdentity}[4]='0';
          my $sv=B::svref_2object(\($a->{creator}{creationIdentity}[4]));
          $fail->() unless ($sv->FLAGS&B::SVf_POK())&&!($sv->FLAGS&B::SVf_IOK());
        }
        elsif($mode eq 'admission-creation-owner') {$a->{creator}{creationIdentity}[4]=1;}
        elsif($mode eq 'admission-creation-type') {
          $a->{creator}{creationIdentity}[2]=($a->{creator}{creationIdentity}[2]&07777)|0100000;
        }
        elsif($mode eq 'admission-source-count') {pop @{$a->{sources}};}
        elsif($mode eq 'admission-source-order') {@{$a->{sources}}[0,1]=@{$a->{sources}}[1,0];}
        elsif($mode eq 'admission-source-numeric') {$a->{sources}[0]{bytes}=1;}
        elsif($mode eq 'admission-source-policy') {$a->{sources}[0]{gitBlobSha}='0'x40;}
        elsif($mode=~/\Aadmission-source-bytes-([0-3])\z/) {
          my $i=0+$1;my $body=\($a->{sources}[$i]{bytes});
          substr($$body,0,1)=chr(ord(substr($$body,0,1))^1);
        }
        elsif($mode eq 'admission-vendor-bytes') {
          my $body=\($a->{vendor}{bytes});substr($$body,0,1)=chr(ord(substr($$body,0,1))^1);
        }
        elsif($mode eq 'admission-selected-detached') {$a->{selected}{archiveRef}={%{$a->{vendor}}};}
        elsif($mode eq 'admission-selected-member') {$a->{selected}{memberName}='node-v22.23.1-darwin-arm64/bin/not-node';}
        else {$fail->();}
      }
```

Replace combined grammar absent condition with:

```perl
      if($mode eq 'absent'||$mode=~/\Aadmission-/) {$emit->('clock','stage');}
```

After first outcomes hold value assignment, BEFORE healthy/close branch, insert:

```perl
          if($mode=~/\Aadmission-/) {$outcomes->{sourceAfterAdmissionRefusal}=test_observe_staged_custody();}
```

After repeat delta assertion, before complete queue drain (in addition to existing
close observer), insert:

```perl
          if($mode=~/\Aadmission-/) {$outcomes->{sourceAfterAdmissionRepeats}=test_observe_staged_custody();}
```

Append twenty ordinary-host tests. Named realistic break: relaxed plain shape,
numeric provenance, source Git-frame/body pin, vendor body pin or detached archive
reference passes early admission. Literal2clock profile is independent of source.
Setup/compile/factory/queue failure gets no negative credit:

```javascript
for(const mode of ['admission-undef','admission-array','admission-extra','admission-missing-creator',
  'admission-root','admission-creation-short','admission-creation-string','admission-creation-owner',
  'admission-creation-type','admission-source-count','admission-source-order','admission-source-numeric',
  'admission-source-policy','admission-source-bytes-0','admission-source-bytes-1','admission-source-bytes-2',
  'admission-source-bytes-3','admission-vendor-bytes','admission-selected-detached','admission-selected-member'])
  test('staged custody admission negative rejects '+mode+' before any stage open',()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,true);assert.equal(r.hold,null);
    assert.deepEqual(r.calls,{clock:2});
    assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed,r.helpers],[0,0,0,0]);
    assert.deepEqual(r.sourceAfterAdmissionRefusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:0,attemptedCount:0,privateClosedCount:0,closedFlags:[]});
    assert.deepEqual(r.sourceAfterAdmissionRepeats,r.sourceAfterAdmissionRefusal);
  });
```

Exact ONE next command fixed ownroot cwd after two literal/actual reviews and
syntax/diff/fresh source/tool/preservation/resource gates:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody admission negative ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Only source/test/plan mappedchanges; no sourcecommit/PR/build before fullmatrix,
no native/protected origin/member/globalowner/service qualification. Preserve
alloldroots/evidence and twooriginaldirtyfiles. No oldtest/build replay.

#### Admission cycle — closed; next boundary clock cycle

Admission20 cee7f2→fef7fd managed57549 naturallyCLOSED0/full554tokens:
20PASS/0FAIL/CANCEL/SKIP/TODO1143.973042ms. NOPOLL57549/no replay.
Roota63c4d CLOSED0 02:28:08 same2093/69756437B/
physical5a8d751fd5d5a758d0dd2e41241c55ba1892c3ea71a34b102f43a654589d08e2.
Independentpre02:27:14–17 C0/I0/M0 allretainedcomparators; source434/test3321/
plan43ac/spec1f26 unchanged. Ordinary behavioral qualification only.

#### Next closed cycle: eight boundary expiry/clock exceptions

UNEXECUTED test-only delta, production434 unchanged. Add these eight names to
combined closed mode enum. After valid fixture admission, before grammar emit,
insert the fixed independent boundary table (clock,completedhelpers,stagecount):

```perl
      my %boundary=(
        'boundary-expiry-hold-entry'=>[2,0,0],
        'boundary-expiry-hold-complete'=>[237,24,12],
        'boundary-expiry-recheck-entry'=>[238,24,12],
        'boundary-expiry-recheck-complete'=>[407,42,12],
        'boundary-throw-hold-entry'=>[2,0,0],
        'boundary-throw-hold-complete'=>[237,24,12],
        'boundary-throw-recheck-entry'=>[238,24,12],
        'boundary-throw-recheck-complete'=>[407,42,12],
      );
```

Extend outer grammar healthy/open/close condition with
||exists($boundary{$mode}); extend its inner healthy/close full-epoch condition
with the same existence condition. BEFORE my $take, construct the predetermined
prefix below. Never discard grammar/jobs after observing source refusal:

```perl
      if(exists($boundary{$mode})) {
        my ($target,$helpers,$stage)=@{$boundary{$mode}};
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';
          last if $clocks==$target;
        }
        $fail->() unless $clocks==$target&&@jobs==42;
        @grammar=@prefix;splice @jobs,$helpers;
        for my $n(1..$stage) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
```

Replace the combined clock port's unique take-and-return0 line with:

```perl
          $take->('clock',$role);
          if(exists($boundary{$mode})&&$calls{clock}==$boundary{$mode}[0]) {
            $fail->() unless $role eq 'stage'&&!defined($job)
              &&!exists($outcomes->{boundaryNomination});
            $outcomes->{boundaryNomination}={clock=>0+$calls{clock},mode=>''.$mode};
            die "TEST_STAGED_NOMINATED_CLOCK_THROW\n" if $mode=~/\Aboundary-throw-/;
            return 180;
          }
          return 0;
```

Startup remains0: actual bootstrap deadline180. Nominated numeric180 is equality,
not later time; no renewed deadline. Add this driver elsif between close and
existing else-refused. Initial hold may be refused only for hold-boundary modes;
for recheck modes require actual hold success then canonical recheck refusal.
Snapshot failed-operation state BEFORE repeats; preserve no positive recheck:

```perl
          } elsif(exists($boundary{$mode})) {
            if($mode=~/-recheck-/) {
              $fail->() if $refused;
              my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
              $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
              $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            } else {$fail->() unless $refused;}
            $outcomes->{sourceAfterBoundary}=test_observe_staged_custody();
```

This literal ends before the existing final } else {$fail->() unless $refused;};
keep that closing line, making one closed elsif chain. After repeat assertion,
before queue drain add:

```perl
          if(exists($boundary{$mode})) {$outcomes->{sourceAfterBoundaryRepeats}=test_observe_staged_custody();}
```

Append eight ordinary-host tests with independent literal vectors. Regression:
deadline equality or thrown clock accepted, deadline renewed or helper activity
during disposal. Counts below independently derived BEFORE execution. No mutant
claim: guard removal with this closed prefix would be setup/queue fault.

```javascript
const STAGED_HALF_BOUNDARY_CALLS={binmode:198,clock:237,close:204,closedir:24,fcntl:72,
  fileno:636,fork:24,lstat:84,opendir:24,pipe:96,read:132,readdir:597,
  ready:48,seek:18,stat:72,sysopen:12,wait:96};
for(const kind of ['expiry','throw'])
  for(const [part,clock,helpers,stage,originals,total] of [
    ['hold-entry',2,0,0,0,2],['hold-complete',237,24,12,228,2574],
    ['recheck-entry',238,24,12,228,2575],['recheck-complete',407,42,12,390,4448]])
    test('staged custody boundary refuses '+kind+' at '+part,()=>{
      const mode='boundary-'+kind+'-'+part,r=stagedCustody(mode);
      assert.deepEqual(r.boundaryNomination,{clock,mode});
      assert.equal(r.helpers,helpers);
      assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],[originals,stage,originals-stage]);
      const calls=clock===2?{clock:2}:clock===407?STAGED_CLOSE_CALLS:{...STAGED_HALF_BOUNDARY_CALLS,clock};
      assert.deepEqual(r.calls,calls);
      assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),total);
      if(part.startsWith('hold-')) {assert.equal(r.refused,true);assert.equal(r.hold,null);}
      else {assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);}
      assert.deepEqual(r.sourceAfterBoundary,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
        sealedClosureCount:stage,attemptedCount:stage,privateClosedCount:stage,
        closedFlags:stage?[1,1,1,1,1,1,1,1,1,1,1,1]:[]});
      assert.deepEqual(r.sourceAfterBoundaryRepeats,r.sourceAfterBoundary);
    });
```

ONE next command fixed ownroot cwd after both literal/actual reviews and fresh
syntax/diff/source/tool/retention/resource gates:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody boundary ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Remaining metadata/foreign/config/ACL/captor/coherentmutants matrix prevents
delivery; no authentic native/protectedowner/member/cutover claim. No replay
closed invocations; preserve alloldroots/originaldirtytwo. Root only writer.

#### Boundary cycle — observed closed terminal

ONE boundary focus2ce9b2 naturallyCLOSED0/full178tokens8PASS/0FAIL/CANCEL/SKIP/
TODO1068.192584ms, no managedsession/no replay. Rootpostf81d66 CLOSED0
02:38:22 all2093/69766424B/physical2094e2d0f0d80d4f58e163091d24b5f12f1a5f566d9e023c63f10b4fffbe4b37,
source434/test3cf2/plan02a904/spec1f26/tools/npm/absences unchanged.
Independentpre02:37:30–33 C0/I0/M0 allretainedcomparators. Resourceaudit02:39:
~7.76GiBfree; shortsessionlogs+8KiB/workspacelogs+data+ownclone sizes unchanged,
earlier191220KiBdrop UNATTRIBUTED. Test-only continuation with monitoring;
no newclone/CI/build admission/cleanup from this observation.

#### Next closed cycle: fourteen plain metadata corruptions and restoration

UNEXECUTED test-only delta. Source434 unchanged. Add fourteen names below to
closed combined enum. Only public @staged_directories/@staged_files/record fields
change after actual successfulhold. Never mutate nativeGV/IO, sealed originals,
private checkers, snapshots/admission/expectation/cleanup registries. Saved public
records exist only in trusted test memory and never escape. No tied/callback/
partial-acquisition proof in this cycle; no coherentmutantkill credit.

```perl
metadata-dir-short metadata-file-short metadata-dir-record-copy metadata-file-record-copy metadata-dir-tuple-copy metadata-file-tuple-copy metadata-dir-path metadata-file-path metadata-file-tuple-value metadata-file-hash metadata-dir-fh-empty metadata-file-fh-empty metadata-dir-fh-alias metadata-file-fh-alias
```

After fixture admission assignment, BEFORE existing observer, insert these
memory-only helpers. Guard fixture construction, report only primitive witnesses;
restore only the same public graph after refusal, never source state/registries:

```perl
  my @test_metadata_saved;my ($test_metadata_changed,$test_metadata_restored)=(0,0);
  sub test_change_staged_metadata {
    $fail->() unless @_==0&&$staged_phase eq 'active'&&!$test_metadata_changed;
    my %allowed=map {$_=>1} qw(metadata-dir-short metadata-file-short metadata-dir-record-copy metadata-file-record-copy metadata-dir-tuple-copy metadata-file-tuple-copy metadata-dir-path metadata-file-path metadata-file-tuple-value metadata-file-hash metadata-dir-fh-empty metadata-file-fh-empty metadata-dir-fh-alias metadata-file-fh-alias);
    $fail->() unless $allowed{$mode}&&@staged_directories==6&&@staged_files==6;
    @test_metadata_saved=map {
      [map {+{record=>$_,fields=>{%$_},tuple=>[@{$_->{identity}}]}} @$_]
    } (\@staged_directories,\@staged_files);
    my $rows=$mode=~/\Ametadata-dir-/ ? \@staged_directories:\@staged_files;
    my $old=$rows->[0];my $change;
    if($mode=~/-short\z/) {pop @$rows;$change=@$rows==5;}
    elsif($mode=~/-record-copy\z/) {
      $rows->[0]={%$old};$change=$rows->[0]!=$old&&$rows->[0]{fh}==$old->{fh};
    }
    elsif($mode=~/-tuple-copy\z/) {
      my $tuple=$old->{identity};$old->{identity}=[@$tuple];
      $change=$old->{identity}!=$tuple&&@{$old->{identity}}==13;
    }
    elsif($mode=~/-path\z/) {$old->{path}='/private/tmp/metadata-wrong';$change=$old->{path} eq '/private/tmp/metadata-wrong';}
    elsif($mode eq 'metadata-file-tuple-value') {
      my $was=$old->{identity}[1];++$old->{identity}[1];$change=$old->{identity}[1]==$was+1;
    }
    elsif($mode eq 'metadata-file-hash') {$old->{sha256}='0'x64;$change=$old->{sha256} eq '0'x64;}
    elsif($mode=~/-fh-empty\z/) {$old->{fh}=undef;$change=!defined($old->{fh});}
    elsif($mode=~/-fh-alias\z/) {$old->{fh}=$rows->[1]{fh};$change=$old->{fh}==$rows->[1]{fh};}
    else {$fail->();}
    $fail->() unless $change;$test_metadata_changed=1;
    return {mode=>''.$mode,changed=>JSON::PP::true};
  }
  sub test_restore_staged_metadata {
    $fail->() unless @_==0&&$test_metadata_changed&&!$test_metadata_restored
      &&$staged_phase eq 'burned'&&@test_metadata_saved==2;
    my @rows=(\@staged_directories,\@staged_files);
    for my $i(0..1) {
      $fail->() unless @{$test_metadata_saved[$i]}==6;
      @{$rows[$i]}=map {$_->{record}} @{$test_metadata_saved[$i]};
      for my $saved(@{$test_metadata_saved[$i]}) {
        %{$saved->{record}}=%{$saved->{fields}};
        @{$saved->{record}{identity}}=@{$saved->{tuple}};
      }
    }
    $test_metadata_restored=1;return {restored=>JSON::PP::true};
  }
```

Extend outer grammar healthy/open/close/boundary condition with
||$mode=~/\Ametadata-/; extend inner full-epoch condition likewise. The following
prefix helper is inserted BEFORE my $take, AFTER boundary-prefix block. Build a
fixed237clock/H24 prefix BEFOREeffects, followed twelve closes. Admission and
metadata expectation records never derive from mutation results:

```perl
      if($mode=~/\Ametadata-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
```

Insert this elsif BETWEEN boundary driver block and retained final else-refused.
Actual recheck validates metadata BEFORE reading its entry clock (source793).
Snapshot immediately after refusal; restore public graph; source state must remain
burned before repeats. No test setter for invalid/uncertain/disposal/source phase:

```perl
          } elsif($mode=~/\Ametadata-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeMetadata}=test_observe_staged_custody();
            $outcomes->{metadataMutation}=test_change_staged_metadata();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            $outcomes->{sourceAfterMetadataRefusal}=test_observe_staged_custody();
            $outcomes->{metadataRestoration}=test_restore_staged_metadata();
            $outcomes->{sourceAfterMetadataRestoration}=test_observe_staged_custody();
```

Keep existing final } else line. After existing repeat delta assertion insert:

```perl
          if($mode=~/\Ametadata-/) {$outcomes->{sourceAfterMetadataRepeats}=test_observe_staged_custody();}
```

Append fourteen ordinary-host cases. Breaks caught: record/tuple/ledger continuity,
immutable path/hash/tuple/FH expectations relaxed or public restoration resurrects
source state. Independent hold237/H24 profile2574ops/228originals below:

```javascript
for(const mode of ['metadata-dir-short','metadata-file-short','metadata-dir-record-copy','metadata-file-record-copy',
  'metadata-dir-tuple-copy','metadata-file-tuple-copy','metadata-dir-path','metadata-file-path',
  'metadata-file-tuple-value','metadata-file-hash','metadata-dir-fh-empty','metadata-file-fh-empty',
  'metadata-dir-fh-alias','metadata-file-fh-alias'])
  test('staged custody metadata corruption burns irreversibly for '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
    assert.deepEqual(r.metadataMutation,{mode,changed:true});assert.deepEqual(r.metadataRestoration,{restored:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.equal(r.helpers,24);assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],[228,12,216]);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),STAGED_CLOSE_ROLES);
    assert.deepEqual(r.sourceBeforeMetadata,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:[0,0,0,0,0,0,0,0,0,0,0,0]});
    assert.deepEqual(r.sourceAfterMetadataRefusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:[1,1,1,1,1,1,1,1,1,1,1,1]});
    assert.deepEqual(r.sourceAfterMetadataRestoration,r.sourceAfterMetadataRefusal);
    assert.deepEqual(r.sourceAfterMetadataRepeats,r.sourceAfterMetadataRefusal);
  });
```

ONE next command only after both literal/actualreviews and syntax/diff/fresh
source/tool/preservation/resource gates, same ownroot cwd:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody metadata corruption ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

No sourcecommit/PR/build/delivery before remainingmatrix. No authentic native/
protected origin/hostACL/globalowner/member/service proof. Preserve oldroots/
originaldirtytwo; no replay closed invocations. Root solewriter/no modelchange.

#### Next closed cycle: partial tied public AV regression and placement mutants

Current-source audit at exact source434 disproves the proposed missing-guard
hypothesis: directory post-configure/pre-push guards754/756 and file772/774
already exist; guard_partial603 inspects original AVs with B before access.
No production edit, duplicate guard, genuine source RED or regression claim
is warranted. Four UNEXECUTED test-only cases: actual dir/file baselines and
two explicit uniquely anchored in-memory placement mutants. Causal relation:
complete the mandatory partial-acquisition callback exclusion matrix of Task2b.5,
not a new feature or protected/native execution claim.

Closed enum additions; slot remains0:
```perl
partial-tied-dir partial-tied-file
```

Before existing healthy/open/close/boundary/metadata grammar branch, insert
this independently predetermined partial prefix. No grammar learned from effects:
```perl
      elsif($mode eq 'partial-tied-dir'||$mode eq 'partial-tied-file') {
        my $target=$mode eq 'partial-tied-dir'?1:7;
        $emit->('clock','stage');
        for my $n(1..$target) {
          my $role=$n<=6?'d'.($n-1):'f'.($n-7);
          $emit->('lstat',$role);$emit->('sysopen',$role);
          ++$stage_count;$emit->('fcntl',$role) for 1..4;
          if($n==$target) {$emit->('binmode',$role) if $n>6;last;}
          $dir_grammar->($n-1);
        }
        for my $n(1..$stage_count) {$emit->('close','d'.($n-1)) if $n<=6;$emit->('close','f0') if $n==7;}
      }
```

Before existing callbacks declaration, insert separate counters (does not alter
existing malformed nominees' factory/callback schemas):
```perl
      my $partial_counts={factory=>0,untie=>0,destroy=>0,callbacks=>{
        map {$_=>0} qw(FETCHSIZE FETCH STORE STORESIZE EXTEND PUSH POP SHIFT UNSHIFT CLEAR EXISTS DELETE)}};
      my $partial_nominated=0;
```

Before TestStagedOverloaded package, insert this memory-only TIEARRAY class.
Constructor, callbacks and finalization count separately; callback increments
precede throw. No candidate callback may run under unchanged source434.
```perl
package TestStagedPartialArray;
sub TIEARRAY {my ($class,$counts)=@_;++$counts->{factory};bless {counts=>$counts},$class;}
sub deny {my ($self,$name)=@_;++$self->{counts}{callbacks}{$name};die "TEST_STAGED_PARTIAL_CALLBACK\n";}
sub FETCHSIZE {$_[0]->deny('FETCHSIZE');}
sub FETCH {$_[0]->deny('FETCH');}
sub STORE {$_[0]->deny('STORE');}
sub STORESIZE {$_[0]->deny('STORESIZE');}
sub EXTEND {$_[0]->deny('EXTEND');}
sub PUSH {$_[0]->deny('PUSH');}
sub POP {$_[0]->deny('POP');}
sub SHIFT {$_[0]->deny('SHIFT');}
sub UNSHIFT {$_[0]->deny('UNSHIFT');}
sub CLEAR {$_[0]->deny('CLEAR');}
sub EXISTS {$_[0]->deny('EXISTS');}
sub DELETE {$_[0]->deny('DELETE');}
sub UNTIE {++$_[0]{counts}{untie};}
sub DESTROY {++$_[0]{counts}{destroy};}
```

Replace only unique fcntl port success-return line with the following. Actual
CORE::fcntl happens first, unchanged return value reaches source. Only last
F_GETFD at d0/f0 hooks. No public AV access from binmode or port:
```perl
          $fail->() unless defined($v)&&!$!;
          if(($mode eq 'partial-tied-dir'&&$o->{role} eq 'd0'
              ||$mode eq 'partial-tied-file'&&$o->{role} eq 'f0')
              &&$o->{path}&&!@{$o->{fcntlQueue}}) {
            $fail->() unless $_[1]==Fcntl::F_GETFD()&&!$partial_nominated++;
            test_tie_staged_partial();
          }
          return $v;
```

Insert memory-only functions before existing observer. They may tie only actual
public AV, never private custody/checkers/CVs/snapshot. Inspect original AV
through B only. Untie only after burned-state and pre-finalizer witnesses:
```perl
  sub test_tie_staged_partial {
    $fail->() unless @_==0&&$staged_phase eq 'capturing'&&$partial_nominated==1
      &&!$partial_counts->{factory};
    my $rows;
    if($mode eq 'partial-tied-dir') {$rows=\@staged_directories;}
    elsif($mode eq 'partial-tied-file') {$rows=\@staged_files;}
    else {$fail->();}
    tie @$rows,'TestStagedPartialArray',$partial_counts;
    my $av=B::svref_2object($rows);my $magic=$av->MAGIC;
    $fail->() unless ref($av) eq 'B::AV'&&$partial_counts->{factory}==1
      &&(($av->FLAGS&0x00f00000)||defined($magic));
  }
  sub test_untie_staged_partial {
    $fail->() unless @_==0&&$partial_nominated==1&&$partial_counts->{factory}==1
      &&!$partial_counts->{untie}&&$staged_phase eq 'burned';
    if($mode eq 'partial-tied-dir') {untie @staged_directories;}
    elsif($mode eq 'partial-tied-file') {untie @staged_files;}
    else {$fail->();}
    $fail->() unless $partial_counts->{untie}==1;
  }
```

Immediately after operation result and existing admission-refusal observation:
```perl
          if($mode eq 'partial-tied-dir'||$mode eq 'partial-tied-file') {
            $fail->() unless $refused&&$partial_nominated==1&&$partial_counts->{factory}==1;
            $outcomes->{sourceAfterPartialRefusal}=test_observe_staged_custody();
            $outcomes->{partialCallbacksBeforeRepeats}={%{$partial_counts->{callbacks}}};
          }
```

Immediately after repeat-delta assertion, before other repeat observations:
```perl
          if($mode eq 'partial-tied-dir'||$mode eq 'partial-tied-file') {
            $outcomes->{sourceAfterPartialRepeats}=test_observe_staged_custody();
            $outcomes->{partialCallbacksBeforeFinalizer}={%{$partial_counts->{callbacks}}};
            $outcomes->{partialFactoryCount}=0+$partial_counts->{factory};
            test_untie_staged_partial();
            $outcomes->{partialFinalization}={untie=>0+$partial_counts->{untie},destroy=>0+$partial_counts->{destroy}};
            $outcomes->{partialCallbacksAfterFinalizer}={%{$partial_counts->{callbacks}}};
          }
```

Insert tests before STAGED_DIRECTORY_FH_CORE_KEYS:
```javascript
const STAGED_PARTIAL_CALLBACK_ZERO={FETCHSIZE:0,FETCH:0,STORE:0,STORESIZE:0,EXTEND:0,
  PUSH:0,POP:0,SHIFT:0,UNSHIFT:0,CLEAR:0,EXISTS:0,DELETE:0};
function assertStagedPartialPhysical(r,part) {
  const stage=part==='dir'?1:7;
  assert.equal(r.refused,true);assert.equal(r.hold,null);
  assert.equal(r.partialFactoryCount,1);
  assert.deepEqual(r.partialFinalization,{untie:1,destroy:1});
  const calls=part==='dir'?{clock:2,lstat:1,sysopen:1,fcntl:4,close:1}:
    {binmode:49,clock:50,close:55,closedir:6,fcntl:34,fileno:156,fork:6,
      lstat:19,opendir:6,pipe:24,read:24,readdir:111,ready:12,stat:12,sysopen:7,wait:24};
  assert.deepEqual(r.calls,calls);
  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),part==='dir'?9:595);
  assert.equal(r.helpers,part==='dir'?0:6);
  assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],part==='dir'?[1,1,0]:[61,7,54]);
  assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
    STAGED_CLOSE_ROLES.slice(0,stage));
  assert.deepEqual(r.sourceAfterPartialRefusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:stage,attemptedCount:stage,privateClosedCount:stage,closedFlags:Array(stage).fill(1)});
  assert.deepEqual(r.sourceAfterPartialRepeats,r.sourceAfterPartialRefusal);
  assert.deepEqual(r.partialCallbacksBeforeRepeats,r.partialCallbacksBeforeFinalizer);
  assert.deepEqual(r.partialCallbacksAfterFinalizer,r.partialCallbacksBeforeFinalizer);
}
for(const part of ['dir','file']) {
  test('staged custody partial tied array refuses '+part+' before public-vector access',()=>{
    const r=stagedCustody('partial-tied-'+part);assertStagedPartialPhysical(r,part);
    assert.deepEqual(r.partialCallbacksBeforeFinalizer,STAGED_PARTIAL_CALLBACK_ZERO);
  });
  test('staged custody partial tied array detects misplaced '+part+' guard mutant',()=>{
    const configure=part==='dir'?'1':'0',expected=part==='dir'?'undef,1':'$expected->{sha256},0';
    const old='            my ($fh)=$sealed->(\'binding\');$staged_configure->($fh,'+configure+');\n'
      +'            $staged_guard_partial->();\n'
      +'            my $record=$staged_record->($sealed,$path,\\@before,'+expected+');\n'
      +'            $staged_guard_partial->();';
    const next='            my ($fh)=$sealed->(\'binding\');$staged_configure->($fh,'+configure+');\n'
      +'            my $record=$staged_record->($sealed,$path,\\@before,'+expected+');';
    const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),old,next);
    const r=stagedCustody('partial-tied-'+part,0,{sourceOverride:source});
    assertStagedPartialPhysical(r,part);
    assert.deepEqual(r.partialCallbacksBeforeFinalizer,{...STAGED_PARTIAL_CALLBACK_ZERO,PUSH:1});
    assert.throws(()=>assert.deepEqual(r.partialCallbacksBeforeFinalizer,STAGED_PARTIAL_CALLBACK_ZERO),
      {code:'ERR_ASSERTION'});
  });
}
```

One exact planned focus after both literal and actual-delta independent reviews,
Node check/diff check and fresh root/independent retention/resource/HTTP admission:
```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody partial tied array ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Expected dir vector9ports/clock2/H0/native1; file595ports/clock50/H6/native61
(7staged+54helper). Private closure state before untie/repeats must be
burned/invalid1/uncertain0/disposal1, attempted+closed1 or7; fixtureClosed0;
all queues drain and repeats have zero effects. Unchanged baseline callback0.
Each placement mutant removes ONLY BOTH post-configure/pre-push guard calls at
one unique path, retains all other guards, actually reaches tied PUSH1, then
canonical refusal. Node callback-zero assertion must detect the violation;
compile/prototype/queue faults are not semantic evidence. No source-on-disk edits,
B guard weakening, original handle mutation, fd-number disposal, new files,
external helper/kernel fork/wait/signals, DB/native/service/cutover effects.
All previous terminals stay closed; no replay/poll.

#### Partial tied AV cycle — observed closed terminal

ONE focus26719a naturallyCLOSED0/full117tokens4PASS/0FAIL/CANCEL/SKIP/TODO
330.119541ms; no managedsession/no replay. Both literals+actualdelta reviews
C0/I0/M0. Actualsource434 baselines callback0; both scoped memoryplacement
mutants actualPUSH1 detected by Node semantic assertion, no harnessFault.
Nativeoriginals1/61 allclosed; privateburn invalid1/uncertain0/disposal1,
repeatszero/stateunchanged; source434 unchanged. Rootpre24143e03:17:46 and
post e7d6fa03:18:39 same2093/69797679B/physicalb021aed391c442a1bf7e3c645c0384e791efc3dfb47dd4f977cedd73bb0d9cce,
planb976/testa129/spec1f26/tools/npm/absences exact. Independentpre03:17:59–
03:18:02C0 allretainedcomparators, disk8337116KiBfree97%,61%memory,
HTTP3080/18789200/3333knownrefused. Thisresume82focusedpasses(78+4), NOT
fullsuite/fullmatrix/native/origin/cutovercomplete; no sourcefix/commit/PR/build.

#### Next closed cycle: H7 actual ACL and raw-status refusals

UNEXECUTED test-only two-case delta under unchanged source434. H7 is first
hold-epoch ACL helper for / after all twelve staged originals. Real owned stdout
pipe carries literal plus/normal row; actual CORE sysread returns bytes unchanged.
No source DTO fabrication, external helper, kernel fork/wait/signal or production
authority. Raw wait nomination only [424242,256] at H7 fourth finite wait.
Both still require complete helper cleanup before transparent wrapper rethrows;
lifecycle settlement is independently observed, not native execution proof.

Append closed enum names (slot0):
```perl
h7-acl-plus h7-raw256
```

Extend BOTH existing full healthy grammar conditions to include these exact two
names, then insert this prefix before my $take (construct before effects):
```perl
      if($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256') {
        my @prefix;my ($end,$success_clock)=(0,0);
        for my $g(@grammar) {
          if($mode eq 'h7-raw256'&&$g->[0] eq 'clock'&&$g->[1] eq 'h7') {
            ++$success_clock;next if $success_clock==6;
          }
          push @prefix,$g;
          if($g->[0] eq 'fileno'&&$g->[1] eq 'h7.setup-w') {last if ++$end==3;}
        }
        $fail->() unless $end==3&&@jobs==42
          &&($mode ne 'h7-raw256'||$success_clock==6);
        @grammar=@prefix;splice @jobs,7;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
```

Replace only existing pipe row construction with:
```perl
            my $marker=$mode eq 'h7-acl-plus'&&$job->{prefix} eq 'h7'?'+':'';
            my $row="-r--r--r--".$marker." 1 root wheel 16 Jan 1 2026 ".$job->{path}."\n";
            if(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&$job->{prefix} eq 'h7') {
              $fail->() unless $job->{path} eq '/'&&!exists($outcomes->{h7PipeRow});
              $outcomes->{h7PipeRow}={bytes=>0+length($row),row=>''.$row};
            }
```

Insert after actual sysread and its existing expected byte/EOF checks, before
return$n. Actual bytes, including EOF, are witnessed; no nominated read output:
```perl
          if(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&defined($job)
              &&$job->{prefix} eq 'h7'&&$o->{role} eq 'h7.out-r') {
            push @{$outcomes->{h7ActualReads}}, {bytes=>0+$n,body=>''.$$buffer};
          }
```

Replace only exact combined wait take/status/return line:
```perl
          $take->('wait',$job->{prefix});my $v=shift @wait;
          if($mode eq 'h7-raw256'&&$job->{prefix} eq 'h7'&&!@wait) {
            $fail->() unless $v->[0]==424242&&$v->[1]==0&&!exists($outcomes->{h7StatusNomination});
            $outcomes->{h7StatusNomination}={pid=>424242,rawStatus=>256};
            $v=[424242,256];
          }
          $?=$v->[1];return $v->[0];
```

Replace only transparent capture wrapper invocation after existing validated
arguments/helper_enter. Catch source captor error, independently validate/drain
all finite queues/actual originals before clearing job, then rethrow unchanged.
Every unplanned error remains harnessFault—not canonical expected-case credit.
```perl
            my $value;my $ok=eval {$value=$capture->(@_);1;};my $error=$@;$check->();
            if(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&$helpers==7) {
              $fail->() unless defined($job)&&$job->{prefix} eq 'h7'&&$job->{path} eq '/';
              if($mode eq 'h7-raw256') {
                $fail->() unless !$ok&&!defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
              } else {
                $fail->() unless $ok&&!length($error)&&ref($value) eq 'HASH'
                  &&$value->{out} eq "-r--r--r--+ 1 root wheel 16 Jan 1 2026 /\n"
                  &&$value->{err} eq ''&&$value->{status}==0&&$value->{pid}==424242
                  &&JSON::PP::is_bool($value->{reaped})&&$value->{reaped};
              }
              $outcomes->{h7CaptorOutcome}={returned=>$ok?JSON::PP::true:JSON::PP::false,
                canonicalRefusal=>$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n"?JSON::PP::true:JSON::PP::false};
            } else {$fail->() unless $ok&&!length($error)&&ref($value) eq 'HASH';}
            $helper_leave->();$check->();
            if(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&$helpers==7) {
              $outcomes->{h7Drain}={jobCleared=>!defined($job)?JSON::PP::true:JSON::PP::false,
                helpersSettled=>task6a_origin_helpers_settled()};
            }
            die $error unless $ok;return $value;
```

Immediately after existing admission-refusal observation:
```perl
          if($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256') {
            $fail->() unless $refused&&$helpers==7;
            $outcomes->{sourceAfterH7Refusal}=test_observe_staged_custody();
          }
```

Immediately after repeat-delta assertion:
```perl
          if($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256') {
            $outcomes->{sourceAfterH7Repeats}=test_observe_staged_custody();
          }
```

Before STAGED_DIRECTORY_FH_CORE_KEYS:
```javascript
const STAGED_H7_CALLS={binmode:62,clock:75,close:68,closedir:7,fcntl:55,fileno:188,
  fork:7,lstat:37,opendir:7,pipe:28,read:40,readdir:138,ready:14,seek:6,stat:25,sysopen:12,wait:28};
for(const mode of ['h7-acl-plus','h7-raw256'])
  test('staged custody h7 refusal drains actual captor for '+mode,()=>{
    const r=stagedCustody(mode),plus=mode==='h7-acl-plus';
    assert.equal(r.refused,true);assert.equal(r.hold,null);
    assert.deepEqual(r.calls,{...STAGED_H7_CALLS,clock:plus?75:74});
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),plus?797:796);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[7,75,12,63]);
    const row='-r--r--r--'+(plus?'+':'')+' 1 root wheel 16 Jan 1 2026 /\n';
    assert.deepEqual(r.h7PipeRow,{bytes:plus?41:40,row});
    assert.deepEqual(r.h7ActualReads,[{bytes:plus?41:40,body:row},{bytes:0,body:''}]);
    assert.deepEqual(r.h7CaptorOutcome,{returned:plus,canonicalRefusal:!plus});
    assert.deepEqual(r.h7Drain,{jobCleared:true,helpersSettled:true});
    if(plus) assert.equal(r.h7StatusNomination,undefined);
    else assert.deepEqual(r.h7StatusNomination,{pid:424242,rawStatus:256});
    assert.deepEqual(r.sourceAfterH7Refusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)});
    assert.deepEqual(r.sourceAfterH7Repeats,r.sourceAfterH7Refusal);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
  });
```

ONE exact future focus only after two literal+actual reviews, syntax/diff,
fresh root all-source/tools and independent preservation/resource/HTTP admission:
```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody h7 refusal ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Independent expected vectors797/796ports, clock75/74,H7,75physical originals
=12stage+63helper. Both actualhold refuse, burn invalid1/uncertain0/disposal1,
all12 private originals attempted/closed; repeatszero and stateunchanged.
ACL-plus actualcaptor success unchangedDTO must then fail source ACLregex.
Raw256 actualcaptor canonicalrefusal occurs before only H7 sixth(success)clock;
all8 cleanup filenos still occur, helperrecord settled true/lifecycle notburned.
No mutationkill/native/lifecycle-uncertainty/admission/fullmatrix completion credit.

#### H7 ACL/captor cycle — observed closed terminal

ONE focusa5753e naturallyCLOSED0/full69tokens2PASS/0FAIL/CANCEL/SKIP/TODO
222.120792ms; no managedsession/no replay. Both literal+actualreviewsC0.
Actualpipe/read41/40bytes+EOF; ACLplus unchangedactualcaptorDTOsuccess then
sourceACLrefusal; raw256 actualcaptorcanonicalrefusal beforeonlyH7successclock.
Both completehelperdrain/actualhelpersSettledtrue; no lifecycleuncertainty claim.
Vectors797/796ports/C75/74/H7/75physicaloriginals(12stage+63helper)allclosed,
privateburn invalid1/uncertain0/disposal1/12attempted+closed/repeatzero.
Rootpre73705e03:22:21/postc277e9CLOSED0 03:23:51 same2093/69811070B/
physical8cc8a034d7574f9a931fe5b1bc283092b74d281f45d1e099f3c21878d0ed3979,
source434/test2e512/planacaa/spec1f26/tools/npm/absences exact.
Independentpre03:22:51–54C0 allretainedcomparators/originaltwo/canonicalclean,
8330972KiBfree97%,61%memory/HTTP3080+18789200/3333knownrefused.
Thisresume84newfocusedpasses(78+4+2), NOT fullcurrent-suite/fullmatrix/native/
origin/cutovercomplete; no sourcefix/commit/PR/build/rollout. Config25 next
UNEXECUTED literal; prior focus receipts closed/no replay/poll.

#### Next closed cycle: twenty-five original configuration refusals

UNEXECUTED test-only delta, source434 unchanged. Causal relation: complete required
configuration/CLOEXEC/binmode denial part of Task2b.5 actual staged-consumer matrix.
Only first d0/f0 responses nominated AFTER successful actual CORE configuration.
All acquisition/sealing/original cleanup code stays actual. No fd-number close,
new syscall delegation, native/protected authority, guard bypass or source edit.

Append these exact25 names to closed mode enum; slot0:
```perl
config-dir-getfl-undefined config-dir-getfl-throw config-dir-getfl-access config-dir-prefd-undefined config-dir-prefd-throw config-dir-prefd-extra config-dir-setfd-false config-dir-setfd-throw config-dir-postfd-undefined config-dir-postfd-throw config-dir-postfd-missing config-file-getfl-undefined config-file-getfl-throw config-file-getfl-access config-file-getfl-nonblock config-file-prefd-undefined config-file-prefd-throw config-file-prefd-extra config-file-setfd-false config-file-setfd-throw config-file-postfd-undefined config-file-postfd-throw config-file-postfd-missing config-file-binmode-false config-file-binmode-throw
```

Before existing boundary table, insert this fixed mode map and planned selected
fcntl queues. Queue prefix chosen BEFORE any fixture acquisition/effect; other
staged originals retain existing four commands. Zero valid GETFL/GETFD values
are NOT false-result denials. Selectedfile NONBLOCK absence is distinct from
wrong access and final CLOEXEC absence:
```perl
      my %configuration=(
        'config-dir-getfl-undefined'=>['d0','getfl',1,'undefined'],
        'config-dir-getfl-throw'=>['d0','getfl',1,'throw'],
        'config-dir-getfl-access'=>['d0','getfl',1,'access'],
        'config-dir-prefd-undefined'=>['d0','prefd',2,'undefined'],
        'config-dir-prefd-throw'=>['d0','prefd',2,'throw'],
        'config-dir-prefd-extra'=>['d0','prefd',2,'extra'],
        'config-dir-setfd-false'=>['d0','setfd',3,'false'],
        'config-dir-setfd-throw'=>['d0','setfd',3,'throw'],
        'config-dir-postfd-undefined'=>['d0','postfd',4,'undefined'],
        'config-dir-postfd-throw'=>['d0','postfd',4,'throw'],
        'config-dir-postfd-missing'=>['d0','postfd',4,'missing'],
        'config-file-getfl-undefined'=>['f0','getfl',1,'undefined'],
        'config-file-getfl-throw'=>['f0','getfl',1,'throw'],
        'config-file-getfl-access'=>['f0','getfl',1,'access'],
        'config-file-getfl-nonblock'=>['f0','getfl',1,'nonblock'],
        'config-file-prefd-undefined'=>['f0','prefd',2,'undefined'],
        'config-file-prefd-throw'=>['f0','prefd',2,'throw'],
        'config-file-prefd-extra'=>['f0','prefd',2,'extra'],
        'config-file-setfd-false'=>['f0','setfd',3,'false'],
        'config-file-setfd-throw'=>['f0','setfd',3,'throw'],
        'config-file-postfd-undefined'=>['f0','postfd',4,'undefined'],
        'config-file-postfd-throw'=>['f0','postfd',4,'throw'],
        'config-file-postfd-missing'=>['f0','postfd',4,'missing'],
        'config-file-binmode-false'=>['f0','binmode',4,'false'],
        'config-file-binmode-throw'=>['f0','binmode',4,'throw'],
      );
      my $configuration_profile=$configuration{$mode};
      my @configuration_queue;
      if(defined($configuration_profile)) {
        my @all=([Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],
          [Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]);
        @configuration_queue=map {[@$_]} @all[0..$configuration_profile->[2]-1];
      }
```

Before existing partial-tied grammar branch:
```perl
      elsif(defined($configuration_profile)) {
        my $target=$configuration_profile->[0] eq 'd0'?1:7;
        $emit->('clock','stage');
        for my $n(1..$target) {
          my $role=$n<=6?'d'.($n-1):'f'.($n-7);
          $emit->('lstat',$role);$emit->('sysopen',$role);++$stage_count;
          $emit->('fcntl',$role) for 1..($n==$target?$configuration_profile->[2]:4);
          if($n==$target) {$emit->('binmode',$role) if $configuration_profile->[1] eq 'binmode';last;}
          $dir_grammar->($n-1);
        }
        for my $n(1..$stage_count) {$emit->('close',$n<=6?'d'.($n-1):'f0');}
      }
```

After existing newly registered stage fcntlQueue initialization, before exposing
FH through caller original cell:
```perl
          if(defined($configuration_profile)&&$p->{role} eq $configuration_profile->[0]) {
            $o->{fcntlQueue}=[map {[@$_]} @configuration_queue];
          }
```

After successful actual CORE::fcntl check, before existing partial tied hook:
```perl
          if(defined($configuration_profile)&&$o->{role} eq $configuration_profile->[0]
              &&!@{$o->{fcntlQueue}}&&$configuration_profile->[1] ne 'binmode') {
            my ($role,$cut,$ordinal,$kind)=@$configuration_profile;
            $fail->() if exists($outcomes->{configurationNomination});
            $outcomes->{configurationNomination}={role=>''.$role,cut=>''.$cut,ordinal=>0+$ordinal,
              kind=>''.$kind,actualCoreCompleted=>JSON::PP::true};
            return undef if $kind eq 'undefined';
            die "TEST_STAGED_NOMINATED_CONFIGURATION_THROW\n" if $kind eq 'throw';
            return 0 if $kind eq 'false'||$kind eq 'missing';
            return ($v&~Fcntl::O_ACCMODE())|Fcntl::O_WRONLY() if $kind eq 'access';
            return $v&~Fcntl::O_NONBLOCK() if $kind eq 'nonblock';
            return $v|(Fcntl::FD_CLOEXEC()<<1) if $kind eq 'extra';
            $fail->();
          }
```

Replace combined binmode port final CORE+return line only:
```perl
          CORE::binmode($o->{fh}) or $fail->();
          if(defined($configuration_profile)&&$configuration_profile->[1] eq 'binmode'
              &&$o->{role} eq $configuration_profile->[0]) {
            $fail->() unless !@{$o->{fcntlQueue}}&&!exists($outcomes->{configurationNomination});
            my ($role,$cut,$ordinal,$kind)=@$configuration_profile;
            $outcomes->{configurationNomination}={role=>''.$role,cut=>''.$cut,ordinal=>0+$ordinal,
              kind=>''.$kind,actualCoreCompleted=>JSON::PP::true};
            die "TEST_STAGED_NOMINATED_CONFIGURATION_THROW\n" if $kind eq 'throw';
            $fail->() unless $kind eq 'false';return 0;
          }
          return 1;
```

Immediately after existing admission-refusal observation:
```perl
          if(defined($configuration_profile)) {
            $fail->() unless $refused&&exists($outcomes->{configurationNomination});
            $outcomes->{sourceAfterConfigurationRefusal}=test_observe_staged_custody();
            my $o=$roles{$configuration_profile->[0]};
            $fail->() unless defined($o)&&!@{$o->{fcntlQueue}};
            $outcomes->{configurationQueueRemaining}=0+@{$o->{fcntlQueue}};
          }
```

Immediately after repeat-delta assertion:
```perl
          if(defined($configuration_profile)) {
            $outcomes->{sourceAfterConfigurationRepeats}=test_observe_staged_custody();
          }
```

Before STAGED_DIRECTORY_FH_CORE_KEYS:
```javascript
const STAGED_CONFIGURATION_CASES=[
  ['config-dir-getfl-undefined','dir','getfl',1,'undefined'],
  ['config-dir-getfl-throw','dir','getfl',1,'throw'],
  ['config-dir-getfl-access','dir','getfl',1,'access'],
  ['config-dir-prefd-undefined','dir','prefd',2,'undefined'],
  ['config-dir-prefd-throw','dir','prefd',2,'throw'],
  ['config-dir-prefd-extra','dir','prefd',2,'extra'],
  ['config-dir-setfd-false','dir','setfd',3,'false'],
  ['config-dir-setfd-throw','dir','setfd',3,'throw'],
  ['config-dir-postfd-undefined','dir','postfd',4,'undefined'],
  ['config-dir-postfd-throw','dir','postfd',4,'throw'],
  ['config-dir-postfd-missing','dir','postfd',4,'missing'],
  ['config-file-getfl-undefined','file','getfl',1,'undefined'],
  ['config-file-getfl-throw','file','getfl',1,'throw'],
  ['config-file-getfl-access','file','getfl',1,'access'],
  ['config-file-getfl-nonblock','file','getfl',1,'nonblock'],
  ['config-file-prefd-undefined','file','prefd',2,'undefined'],
  ['config-file-prefd-throw','file','prefd',2,'throw'],
  ['config-file-prefd-extra','file','prefd',2,'extra'],
  ['config-file-setfd-false','file','setfd',3,'false'],
  ['config-file-setfd-throw','file','setfd',3,'throw'],
  ['config-file-postfd-undefined','file','postfd',4,'undefined'],
  ['config-file-postfd-throw','file','postfd',4,'throw'],
  ['config-file-postfd-missing','file','postfd',4,'missing'],
  ['config-file-binmode-false','file','binmode',4,'false'],
  ['config-file-binmode-throw','file','binmode',4,'throw'],
];
for(const [mode,part,cut,k,kind] of STAGED_CONFIGURATION_CASES)
  test('staged custody configuration denial disposes '+mode,()=>{
    const r=stagedCustody(mode),stage=part==='dir'?1:7,bin=cut==='binmode';
    assert.equal(r.refused,true);assert.equal(r.hold,null);
    assert.deepEqual(r.configurationNomination,{role:part==='dir'?'d0':'f0',cut,ordinal:k,kind,
      actualCoreCompleted:true});
    assert.equal(r.configurationQueueRemaining,0);
    const calls=part==='dir'?{clock:2,lstat:1,sysopen:1,fcntl:k,close:1}:
      {binmode:bin?49:48,clock:50,close:55,closedir:6,fcntl:30+k,fileno:156,fork:6,
        lstat:19,opendir:6,pipe:24,read:24,readdir:111,ready:12,stat:12,sysopen:7,wait:24};
    assert.deepEqual(r.calls,calls);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),part==='dir'?5+k:590+k+(bin?1:0));
    assert.equal(r.helpers,part==='dir'?0:6);
    assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],part==='dir'?[1,1,0]:[61,7,54]);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES.slice(0,stage));
    assert.deepEqual(r.sourceAfterConfigurationRefusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:stage,attemptedCount:stage,privateClosedCount:stage,closedFlags:Array(stage).fill(1)});
    assert.deepEqual(r.sourceAfterConfigurationRepeats,r.sourceAfterConfigurationRefusal);
  });

```

One future focus only after both literal+actual reviews, syntax/diff and fresh
root/alltools/independent preservation/resource/HTTP gates:
```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody configuration denial ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Independent expected dir6/7/8/9ports; file591/592/593/594/595ports, H0/H6,
physical1/61(7stage+54helper), privateattempted/closed1/7. Consumerpermanent
burn invalid1/uncertain0/disposal1 precedes repeats; no positiveholdDTO. All finite
queues empty, fixture0, sourceclosealloriginals; repeatzero/stateunchanged.
Unexpected CORE/setup/prototype/grammar failure is sticky harnessFault, never
semantic denial credit. No leftoverqueue deletion after refusal or nominee learned
from run. No coherentguardmutationkill claim (prefix harnesskill is unqualified).

#### Configuration cycle — observed closed terminal

ONE focus4c3ee7→590fec managed80050 naturallyCLOSED0/full578tokens25PASS/
0FAIL/CANCEL/SKIP/TODO1639.35825ms. NOPOLL80050/NOREPLAY. Literal+actual
reviewsbothC0, Node57c59a/diffda8450CLOSED0. Firstpatch453755 atomicverification
failure frombackwardhunkorder; correctedreadonlyextractor7b1f79 same10blocks
beforeactualapply. Diagnostic only/no semanticRED/replay.
Actual25 wrong/undefined/false/throw config nominees all canonicalholdrefusal;
CORE effects occur first. Originalprivate1/7 allattempted+closed, native1/61,
finitequeuesdrained withoutpost-refusaldeletion, permanentburn/zero repeats.
Rootprebaf2b7 03:31:04/postccf7ce CLOSED0 03:32:02 same2093/69831670B/
physicalf939126684a073131ff613837e668be150cdfe67fce6be3bae77ebf9e562cf92,
source434/testaa502/plan41e5/spec1f26/tools/npm/absences exact.
Independentpre03:31:31–34C0 allretainedcomparators/originaltwo/journal/canonical,
8327592KiBfree97%,61%memory/HTTP3080+18789200/3333knownrefused.
Thisresume109newfocusedpasses(78+4+2+25), NOT fullcurrent-suite/fullmatrix/
origin/native/cutovercomplete; no sourcefix/commit/PR/build/rollout. Nextsafe
readonlyresearch: active/retainedmetadata magic + coherentactualbyte/hashmutant.

#### Next closed cycle: actual read byte denial and coherent digest mutant

UNEXECUTED test-only two-case delta; source434 unchanged. Causal relation:
required file-byte/hash negative + coherent guard-removal evidence for Task2b.5.
This is corrupt consumer-visible byte nomination AFTER real CORE read, NOT
physical backing corruption; no filewrite or protected/native authority.

Closed enum additions slot0:
```perl
file-byte-xor-denied file-byte-xor-mutant
```

Extend BOTH existing full healthy grammar conditions with these exact names.
After other prefix constructors, before my $take, baseline only:
```perl
      if($mode eq 'file-byte-xor-denied') {
        my @prefix;my $reads=0;
        for my $g(@grammar) {
          push @prefix,$g;
          last if $g->[0] eq 'read'&&$g->[1] eq 'f0'&&++$reads==2;
        }
        $fail->() unless $reads==2&&@jobs==42;
        @grammar=@prefix;splice @jobs,6;
        for my $n(1..7) {$emit->('close',$n<=6?'d'.($n-1):'f0');}
      }
```

After actual CORE::sysread and BOTHexistingactualcount/expected-byte-EOF checks,
BEFORE H7readwitness and return$n, insert this closed nominee. First positivef0
actualreadordinal25/5864bytes equals independently pinned archive bytes; exactly
byte0 XOR1, allremainingbytes/count/length unchanged. Never mutate backing/expectation
or helperpipe output; subsequentread/EOF/recheckreads remain actual unchanged:
```perl
          if(($mode eq 'file-byte-xor-denied'||$mode eq 'file-byte-xor-mutant')
              &&$o->{role} eq 'f0'&&!exists($outcomes->{byteNomination})) {
            $fail->() unless !defined($job)&&!$pipe_read&&$calls{read}==25
              &&$n==5864&&$$buffer eq $bodies[0]&&ord(substr($$buffer,0,1))==112;
            my $before=Digest::SHA::sha256_hex($$buffer);
            substr($$buffer,0,1)=chr(ord(substr($$buffer,0,1))^1);
            $fail->() unless length($$buffer)==$n&&substr($$buffer,1) eq substr($bodies[0],1)
              &&ord(substr($$buffer,0,1))==113;
            $outcomes->{byteNomination}={role=>'f0',readOrdinal=>25,bytes=>0+$n,
              beforeFirstByte=>112,afterFirstByte=>113,beforeSha256=>$before,
              afterSha256=>Digest::SHA::sha256_hex($$buffer),
              actualCoreRead=>JSON::PP::true,remainderUnchanged=>JSON::PP::true};
          }
```

Extend actual driver's healthy branch ONLY to file-byte-xor-mutant as well, so
actualpositiveDTO/recheck/release are exposed—not killed by expectedrefusal.
After existing driver branches, before my $before=scalar(@events):
```perl
          if($mode eq 'file-byte-xor-denied'||$mode eq 'file-byte-xor-mutant') {
            $fail->() unless exists($outcomes->{byteNomination});
            $outcomes->{sourceAfterByteOperation}=test_observe_staged_custody();
          }
```

Immediately after repeat-delta assertion:
```perl
          if($mode eq 'file-byte-xor-denied'||$mode eq 'file-byte-xor-mutant') {
            $outcomes->{sourceAfterByteRepeats}=test_observe_staged_custody();
          }
```

Before STAGED_DIRECTORY_FH_CORE_KEYS:
```javascript
function assertStagedByteNomination(r) {
  assert.deepEqual(r.byteNomination,{
    role:'f0',readOrdinal:25,bytes:5864,beforeFirstByte:112,afterFirstByte:113,
    beforeSha256:'85d8949dbcee9687b1d3f554edb6e39003394cb2fb125d64c50964daa1a04ff0',
    afterSha256:'ad8d8e9c43ebc67036de34379ea2e12658bbe2027314bd523fe29e942e633055',actualCoreRead:true,remainderUnchanged:true});
  assert.match(r.byteNomination.afterSha256,/^[a-f0-9]{64}$/);
  assert.notEqual(r.byteNomination.afterSha256,r.byteNomination.beforeSha256);
}
test('staged custody byte hash rejects altered consumer-visible actual read',()=>{
  const r=stagedCustody('file-byte-xor-denied');assertStagedByteNomination(r);
  assert.equal(r.refused,true);assert.equal(r.hold,null);
  assert.deepEqual(r.calls,{binmode:49,clock:52,close:55,closedir:6,fcntl:34,fileno:157,
    fork:6,lstat:20,opendir:6,pipe:24,read:26,readdir:111,ready:12,seek:1,stat:13,sysopen:7,wait:24});
  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),603);
  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[6,61,7,54]);
  assert.deepEqual(r.sourceAfterByteOperation,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:7,attemptedCount:7,privateClosedCount:7,closedFlags:Array(7).fill(1)});
  assert.deepEqual(r.sourceAfterByteRepeats,r.sourceAfterByteOperation);
});
test('staged custody byte hash detects coherent digest-comparison removal',()=>{
  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),
    '    task6a_origin_refuse() unless $length==$record->{identity}[7]&&$digest->hexdigest eq $record->{sha256};',
    '    task6a_origin_refuse() unless $length==$record->{identity}[7];');
  const r=stagedCustody('file-byte-xor-mutant',0,{sourceOverride:source});assertStagedByteNomination(r);
  assert.equal(r.refused,false);assert.deepEqual(r.calls,STAGED_CLOSE_CALLS);
  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[42,390,12,378]);
  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',
    productionAuthority:false,fileCount:6,directoryCount:6};
  assert.deepEqual(r.hold,diagnostic);assert.deepEqual(r.recheck,diagnostic);
  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});
  assert.deepEqual(r.sourceAfterByteOperation,{phase:'released',invalid:0,uncertain:0,disposalStarted:1,
    sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)});
  assert.deepEqual(r.sourceAfterByteRepeats,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)});
  assert.throws(()=>assert.equal(r.refused,true),{code:'ERR_ASSERTION'});
});
```

One future exact focus after literal+actual independentreviews/syntax/diff/fresh
rootallsource/tools + independentpreservation/resource/HTTP admission:
```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody byte hash ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Independent baseline vector603ports/C52/H6/61originals(7stage+54helper).
Prefix cuts AFTERf0secondreadEOF, NOTbefore atclock52. All7privateoriginals
attempted/closed; burnedinvalid1/uncertain0/disposal1/repeatszero/fixture0.
Mutant removesONLY uniquely anchored actual held-file digest comparison, retains
length/digestaccumulation/prepostidentity/deadlines. Separate fullfinitegrammar
407clocks/42helpers/390originals/4448ports must complete actualpositivehold/recheck/
release and cleanup; Node semantic acceptance assertion detects violation.
No compile/prototype/prefix-harnessfail/mutant-positiveDTO can confer authority.
Pure readonly95a837 CLOSED0 before-effect hash witness:
5864byte archive112→113, SHA85d8949dbcee9687b1d3f554edb6e39003394cb2fb125d64c50964daa1a04ff0
→ad8d8e9c43ebc67036de34379ea2e12658bbe2027314bd523fe29e942e633055.
Allpriorcyclesclosed/no replay/poll; active/retainedmetadata16 remains nextresearch,
no new sourcecommit/PR/build/DB/native/service/cutover effect here.

#### Byte/hash cycle — observed closed terminal

ONE focus9fd284 naturallyCLOSED0/full73tokens2PASS/0FAIL/CANCEL/SKIP/TODO
334.632917ms; no managedsession/no replay. FirstedddliteralsBOTHC0/I1/M0:
sharedstateequality incorrectlycoveredreleasedmutant. Corrected003abafliteral
BEFOREtestpatch/effects; bothcorrectedliteral+actualb0f799reviewsC0.
ActualCOREreadthen112→113XOR witnessed5864B/original85d894/changedad8d8e hash;
backingunchanged. BaselineEOFcut603/C52/H6/61originals allclosed/private7burn.
Coherentdigest-onlymutant actualpositivehold/recheck/release full4448/C407/H42/
390originals allclosed, forbiddenacceptanceNodeoracle detected. Releasedstate
before repeats preservedasreceipt; repeat changesphaseburned/invalid1 butzero
new effects/all12closebindingsstilldefinite. No harnesskill/sourcefix/nativeclaim.
Rootpre44bd34 03:42:01/poste0fe70 CLOSED0 03:43:56 same2093/69844717B/
physicalc7d3a584b77238ca8c79202e968fd48708ba293dbf82ca7130e55f490841dbf2,
source434/testb0f799/plan003abaf/spec1f26/tools/npm/absences exact.
Independentpre03:42:27–30C0 allretainedcomparators/originaltwo/journal/canonical,
8333288KiBfree97%,61%memory/HTTP3080+18789200/3333knownrefused.
Thisresume111newfocusedpasses(78+4+2+25+2), NOT fullcurrent-suite/fullmatrix/
origin/native/cutovercomplete; no sourcecommit/PR/build/rollout. Next16metadata
magic cases UNEXECUTED test-only literal; allprevioussessionsclosed/no replay.

#### Next closed cycle: sixteen active and retained metadata magic denials

UNEXECUTED test-only delta; unchanged source434. Causal relation: required
original/retained metadata magic and restoration coverage of Task2b.5. Only
previously public AV/HV/scalar/tuple references may be tied; private sealedoriginals,
nativeGV/IO, checkers/CVs, snapshot and admission remain untouched. No newsourcefix,
isolatedmutantkill, native/protected/production authority or wholematrix claim.

Append closed16 mode names, slot0:
```perl
magic-dir-array magic-dir-record magic-dir-tuple magic-dir-path magic-dir-fh magic-dir-retained-record magic-dir-retained-tuple magic-file-array magic-file-record magic-file-tuple magic-file-path magic-file-fh magic-file-retained-record magic-file-retained-tuple magic-file-hash magic-file-element
```

Before TestStagedOverloaded package in existing combined memoryclass heredoc,
insert these closed scalar/hash classes. They inherit separate counter/deny/
UNTIE/DESTROY and shared named callbacks from existing TestStagedPartialArray;
array uses that existing class directly with its OWN new counts. No tiedobject
reference is retained, candidate callbacks increment BEFOREthrow:
```perl
package TestStagedMetadataHash;
our @ISA=('TestStagedPartialArray');
sub TIEHASH {my ($class,$counts)=@_;++$counts->{factory};bless {counts=>$counts},$class;}
sub FIRSTKEY {$_[0]->deny('FIRSTKEY');}
sub NEXTKEY {$_[0]->deny('NEXTKEY');}
sub SCALAR {$_[0]->deny('SCALAR');}
package TestStagedMetadataScalar;
our @ISA=('TestStagedPartialArray');
sub TIESCALAR {my ($class,$counts)=@_;++$counts->{factory};bless {counts=>$counts},$class;}
```

In source-memory-only initializer, BEFORE existing test_tie_staged_partial,
insert these helper declarations. Save ALL public fields/tuples/strongFH refs
BEFOREtie; manufacture targetreferences and plain replacements while stillplain.
Retainedrecord/tuple cases replacepublicslot first, then tie previously public
originalHV/AV so actual retained-container guard must reject BEFOREcomparison.
Originalfieldties targetscalarcell, never nativeGV/IO. Originalarray/hash
contents may vanish on tying but savedpublicgraph holds originals/values and
nativeFH custody remains private. Never traverse target aftertie. BFLAGS inspect
originaltarget only; trustedfixture observation returns primitive counters only.
Untie EXACTtarget after refusal and while-tied repeats/callbacksnapshots, then
existing restoration copies savedpublicgraph; no phase/closure reset:
```perl
  my ($test_magic_target,$test_magic_kind);
  my $test_magic_counts={factory=>0,untie=>0,destroy=>0,callbacks=>{
    map {$_=>0} qw(FETCHSIZE FETCH STORE STORESIZE EXTEND PUSH POP SHIFT UNSHIFT CLEAR EXISTS DELETE FIRSTKEY NEXTKEY SCALAR)}};
  sub test_change_staged_magic {
    $fail->() unless @_==0&&$staged_phase eq 'active'&&!$test_metadata_changed
      &&!defined($test_magic_target)&&!$test_magic_counts->{factory};
    my %allowed=map {$_=>1} qw(magic-dir-array magic-dir-record magic-dir-tuple magic-dir-path magic-dir-fh magic-dir-retained-record magic-dir-retained-tuple magic-file-array magic-file-record magic-file-tuple magic-file-path magic-file-fh magic-file-retained-record magic-file-retained-tuple magic-file-hash magic-file-element);
    $fail->() unless $allowed{$mode}&&@staged_directories==6&&@staged_files==6;
    # Prepare all strong native FH/container/value references before any tie.
    @test_metadata_saved=map {
      [map {+{record=>$_,fields=>{%$_},tuple=>[@{$_->{identity}}]}} @$_]
    } (\@staged_directories,\@staged_files);
    my $rows=$mode=~/\Amagic-dir-/ ? \@staged_directories:\@staged_files;
    my $old=$rows->[0];my $target;my $kind;
    if($mode=~/-array\z/) {$target=$rows;$kind='array';}
    elsif($mode=~/-retained-record\z/) {
      $rows->[0]={%$old};$target=$old;$kind='hash';
    }
    elsif($mode=~/-retained-tuple\z/) {
      $target=$old->{identity};$old->{identity}=[@$target];$kind='array';
    }
    elsif($mode=~/-record\z/) {$target=$old;$kind='hash';}
    elsif($mode=~/-tuple\z/) {$target=$old->{identity};$kind='array';}
    elsif($mode=~/-path\z/) {$target=\($old->{path});$kind='scalar';}
    elsif($mode=~/-fh\z/) {$target=\($old->{fh});$kind='scalar';}
    elsif($mode eq 'magic-file-hash') {$target=\($old->{sha256});$kind='scalar';}
    elsif($mode eq 'magic-file-element') {$target=\($old->{identity}[0]);$kind='scalar';}
    else {$fail->();}
    $test_magic_target=$target;$test_magic_kind=$kind;$test_metadata_changed=1;
    if($kind eq 'array') {tie @$target,'TestStagedPartialArray',$test_magic_counts;}
    elsif($kind eq 'hash') {tie %$target,'TestStagedMetadataHash',$test_magic_counts;}
    else {tie $$target,'TestStagedMetadataScalar',$test_magic_counts;}
    my $sv=B::svref_2object($target);
    $fail->() unless $test_magic_counts->{factory}==1&&($sv->FLAGS&0x00f00000);
    return {mode=>''.$mode,changed=>JSON::PP::true};
  }
  sub test_observe_staged_magic {
    $fail->() unless @_==0;
    return {factory=>0+$test_magic_counts->{factory},untie=>0+$test_magic_counts->{untie},
      destroy=>0+$test_magic_counts->{destroy},callbacks=>{%{$test_magic_counts->{callbacks}}}};
  }
  sub test_restore_staged_magic {
    $fail->() unless @_==0&&$staged_phase eq 'burned'&&defined($test_magic_target)
      &&$test_magic_counts->{factory}==1&&!$test_magic_counts->{untie};
    if($test_magic_kind eq 'array') {untie @$test_magic_target;}
    elsif($test_magic_kind eq 'hash') {untie %$test_magic_target;}
    elsif($test_magic_kind eq 'scalar') {untie $$test_magic_target;}
    else {$fail->();}
    $fail->() unless $test_magic_counts->{untie}==1&&$test_magic_counts->{destroy}==1;
    $test_magic_target=undef;
    return test_restore_staged_metadata();
  }
```

Extend BOTH full healthy grammar conditions with this exact Perl clause:
```perl
$mode=~/\Amagic-/
```
BEFORE my $take, independently predetermined completedhold prefix:
```perl
      if($mode=~/\Amagic-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
```

BEFORE existing outer driver final }else{$failunlessrefused} + my$before line,
insert this branch (following original }else closes it). Realhold succeeds,
actualrecheck must refuse; snapshot BEFOREuntie, repeat whiletied withzeroeffects,
then untie/restoration and unchangedsourceburn observation:
```perl
          } elsif($mode=~/\Amagic-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeMagic}=test_observe_staged_custody();
            $outcomes->{magicMutation}=test_change_staged_magic();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            $outcomes->{sourceAfterMagicRefusal}=test_observe_staged_custody();
            $outcomes->{magicAfterRefusal}=test_observe_staged_magic();
            my $before=scalar(@events);
            for my $name(qw(hold recheck release)) {
              my $again=eval {$operations{$name}->()};my $error=$@;$check->();
              $fail->() unless !defined($again)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            }
            $outcomes->{magicTiedRepeatDelta}=scalar(@events)-$before;
            $fail->() if $outcomes->{magicTiedRepeatDelta};
            $outcomes->{sourceAfterMagicTiedRepeats}=test_observe_staged_custody();
            $outcomes->{magicBeforeUntie}=test_observe_staged_magic();
            $outcomes->{magicRestoration}=test_restore_staged_magic();
            $outcomes->{sourceAfterMagicRestoration}=test_observe_staged_custody();
            $outcomes->{magicAfterUntie}=test_observe_staged_magic();
```

Immediately after common repeat-delta assertion (the second repeat group occurs
AFTERrestore; no metadata fixture callbacks permitted at either group):
```perl
          if($mode=~/\Amagic-/) {
            $outcomes->{sourceAfterMagicRepeats}=test_observe_staged_custody();
            $outcomes->{magicAfterRestoredRepeats}=test_observe_staged_magic();
          }
```

Before STAGED_DIRECTORY_FH_CORE_KEYS:
```javascript
const STAGED_METADATA_MAGIC_MODES=[
  'magic-dir-array',
  'magic-dir-record',
  'magic-dir-tuple',
  'magic-dir-path',
  'magic-dir-fh',
  'magic-dir-retained-record',
  'magic-dir-retained-tuple',
  'magic-file-array',
  'magic-file-record',
  'magic-file-tuple',
  'magic-file-path',
  'magic-file-fh',
  'magic-file-retained-record',
  'magic-file-retained-tuple',
  'magic-file-hash',
  'magic-file-element',
];
const STAGED_METADATA_MAGIC_ZERO={FETCHSIZE:0,FETCH:0,STORE:0,STORESIZE:0,EXTEND:0,
  PUSH:0,POP:0,SHIFT:0,UNSHIFT:0,CLEAR:0,EXISTS:0,DELETE:0,FIRSTKEY:0,NEXTKEY:0,SCALAR:0};
for(const mode of STAGED_METADATA_MAGIC_MODES)
  test('staged custody metadata magic rejects original graph for '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
    assert.deepEqual(r.magicMutation,{mode,changed:true});assert.deepEqual(r.magicRestoration,{restored:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[24,228,12,216]);
    assert.equal(r.magicTiedRepeatDelta,0);
    assert.deepEqual(r.sourceBeforeMagic,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:Array(12).fill(0)});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)};
    for(const state of ['sourceAfterMagicRefusal','sourceAfterMagicTiedRepeats',
      'sourceAfterMagicRestoration','sourceAfterMagicRepeats']) assert.deepEqual(r[state],burned);
    const tied={factory:1,untie:0,destroy:0,callbacks:STAGED_METADATA_MAGIC_ZERO};
    assert.deepEqual(r.magicAfterRefusal,tied);assert.deepEqual(r.magicBeforeUntie,tied);
    const untied={factory:1,untie:1,destroy:1,callbacks:STAGED_METADATA_MAGIC_ZERO};
    assert.deepEqual(r.magicAfterUntie,untied);assert.deepEqual(r.magicAfterRestoredRepeats,untied);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
  });

```

ONE future exactfocus after both literal+actual independentreviews/syntax/diff/
freshrootallsource+tools+independentpreservation/resource/HTTP admission:
```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody metadata magic ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Independentexpected C237/H24/2574ports/228originals(12stage+216helper), no recheck
clock because actualrequire_live checks originals first. All12 privateoriginals
attempted+closed; burn invalid1/uncertain0/disposal1 BEFOREuntie/repeats. Exactly
factory1/candidatecallback0 whiletied; UNTIE1/DESTROY1 onlyfixturefinalization.
Restoration and bothrepeatgroups zero effects/no resurrection; fixtureClosed0.
Any compile/prototype/queue/factory/setup/cleanupfault remains harnessFault, no
semanticdenial credit. Previouslycompletedordinary/native distinction unchanged.

#### Metadata magic cycle — observed closed terminal

ONE focus9670cc→cc4820 managed55270 naturallyCLOSED0/full407tokens16PASS/
0FAIL/CANCEL/SKIP/TODO2130.242583ms. NOPOLL55270/NOREPLAY. Initiald443 master
C0/I1/M0 doubled-backslashgrammarprose; contractC0missedit. CorrectedBEFORE
patch/effects through06a thenexplicitfenced8c809literal; BOTHcorrectedliteral
+actual3718reviewsC0. Actualsource434 unchanged; callback0 whiletied/refused/
whiletiedrepeat; factory1 then exacttargetUNTIE1/DESTROY1; savedpublicgraph
restoration didnotresetprivateburn/closedbindings; secondrepeatgroupzeroeffects.
All16C237/H24/2574ports/228originals(12stage+216helper), all12privateattempted+
closed/burninvalid1/uncertain0/disposal1/fixture0. No sourcefix/isolatedmutantclaim.
Freshuserresume10:25UTCget_goalnull (no inferrednewgoal), canonicalreposclean,
stalehistorynotblock; noeffectsbetween03:43byte2 andfresh10:31magic16. Root
freshliteralpre7e3e32/alltools/2093proof; actualpref29357 10:31:02/post418fc3
CLOSED0 10:31:53 same2093/69866126B/physical632f3524a39afd9f8119968d17ba70591b99690a5e4b6add25ed9bc47a6115b6,
source434/test3718/plan8c809/spec1f26/tools/npm/absences exact.
Independentactualpre10:31:02–05C0 allretainedcomparators/originaltwo/journal/
canonical;7755772KiBfree97%,59%memory/HTTP3080+18789200/3333knownrefused.
Postgap583516KiBdiskdropUNATTRIBUTED; selectedworkspace/session/log sizeaudit
shortstableexceptsessions+4KiB, notwholevolume explanation. No cleanup/deletion.
Thisresume127newfocusedpasses(78+4+2+25+2+16), 49newcasesinthislogicalturn;
NOT fullcurrent-suite/fullmatrix/origin/native/cutovercomplete. Sourceuncommitted/
noPR/build/rollout. Nextsafe readonlyresearch: admissiondrift/refcontinuity/
retainedmagic, foreignactualsameFH/hiddenCore/genuineFDaliasconstructor, actual
pre-postidentity andcoherentmetadata/ACL/onceclose mutants. Allsessionsclosed.

#### Next closed cycle: twenty plain admission drift and continuity denials

UNEXECUTED test-only delta, source434 unchanged. Required Task2b.5 admission
drift/ref-continuity/restoration coverage; currentoriginalpublicinput graph only.
No private snapshot/expectation/checker/nativeGVIO/original-custody mutation.
Ten equalcopies, detachedarchivejoin, validroot/rawintegerinode changes, six
same-length byteXORs andextrakey. No isolatedguardmutationkill/nativeauthority.

Append exact20 closedmode names (slot0):
```perl
drift-copy-admission drift-copy-creator drift-copy-creation drift-copy-sources drift-copy-source-0 drift-copy-source-1 drift-copy-source-2 drift-copy-source-3 drift-copy-vendor drift-copy-selected drift-selected-detached drift-root drift-creation-inode drift-source-bytes-0 drift-source-bytes-1 drift-source-bytes-2 drift-source-bytes-3 drift-vendor-bytes drift-selected-bytes drift-extra
```

Source-memory initializer: BEFORE existing test_tie_staged_partial, insert these
trustedfixture declarations. Capture wholeoriginal graph/fields/rawbytes/numbers/
members/refs beforemutation. Topcopy nominates current $staged_admission binding
ONLY in reviewed memorytest—no production setter. Vendorcopy repairs current
selected.archiveRef to copiedvendor so currentjoin succeeds; snapshotreference
comparison must reject. Restore originalbinding/allfields/arrays afterburn and
independently compare restored refs/values against savedpublicgraph, not source
snapshot. No expected-hash regeneration or privatephase/custody reset:
```perl
  my ($test_drift_admission,$test_drift_creation,$test_drift_sources);
  my (@test_drift_hashes,@test_drift_creation_values,@test_drift_source_members);
  my ($test_drift_changed,$test_drift_restored)=(0,0);
  sub test_change_staged_admission {
    $fail->() unless @_==0&&$staged_phase eq 'active'&&!$test_drift_changed;
    my %allowed=map {$_=>1} qw(drift-copy-admission drift-copy-creator drift-copy-creation drift-copy-sources drift-copy-source-0 drift-copy-source-1 drift-copy-source-2 drift-copy-source-3 drift-copy-vendor drift-copy-selected drift-selected-detached drift-root drift-creation-inode drift-source-bytes-0 drift-source-bytes-1 drift-source-bytes-2 drift-source-bytes-3 drift-vendor-bytes drift-selected-bytes drift-extra);
    $fail->() unless $allowed{$mode};
    my $a=$staged_admission;my $creator=$a->{creator};my $sources=$a->{sources};
    $test_drift_admission=$a;$test_drift_creation=$creator->{creationIdentity};
    $test_drift_sources=$sources;
    @test_drift_creation_values=@$test_drift_creation;
    @test_drift_source_members=@$sources;
    @test_drift_hashes=map {+{record=>$_,fields=>{%$_}}}
      ($a,$creator,@$sources,$a->{vendor},$a->{selected});
    my $changed;
    if($mode eq 'drift-copy-admission') {$staged_admission={%$a};$changed=$staged_admission!=$a;}
    elsif($mode eq 'drift-copy-creator') {$a->{creator}={%$creator};$changed=$a->{creator}!=$creator;}
    elsif($mode eq 'drift-copy-creation') {
      $creator->{creationIdentity}=[@$test_drift_creation];
      $changed=$creator->{creationIdentity}!=$test_drift_creation;
    }
    elsif($mode eq 'drift-copy-sources') {$a->{sources}=[@$sources];$changed=$a->{sources}!=$sources;}
    elsif($mode=~/\Adrift-copy-source-([0-3])\z/) {
      my $i=0+$1;my $old=$sources->[$i];$sources->[$i]={%$old};$changed=$sources->[$i]!=$old;
    }
    elsif($mode eq 'drift-copy-vendor') {
      my $old=$a->{vendor};$a->{vendor}={%$old};$a->{selected}{archiveRef}=$a->{vendor};
      $changed=$a->{vendor}!=$old&&$a->{selected}{archiveRef}==$a->{vendor};
    }
    elsif($mode eq 'drift-copy-selected') {
      my $old=$a->{selected};$a->{selected}={%$old};$changed=$a->{selected}!=$old;
    }
    elsif($mode eq 'drift-selected-detached') {
      $a->{selected}{archiveRef}={%{$a->{vendor}}};$changed=$a->{selected}{archiveRef}!=$a->{vendor};
    }
    elsif($mode eq 'drift-root') {
      $creator->{rootPath}='/private/tmp/task6a-staged-other';
      $changed=$creator->{rootPath} ne $logical;
    }
    elsif($mode eq 'drift-creation-inode') {
      ++$test_drift_creation->[1];$changed=$test_drift_creation->[1]==$test_drift_creation_values[1]+1;
    }
    elsif($mode=~/\Adrift-source-bytes-([0-3])\z/) {
      my $cell=\($sources->[0+$1]{bytes});my $before=ord(substr($$cell,0,1));
      substr($$cell,0,1)=chr($before^1);$changed=ord(substr($$cell,0,1))==($before^1);
    }
    elsif($mode eq 'drift-vendor-bytes'||$mode eq 'drift-selected-bytes') {
      my $row=$mode eq 'drift-vendor-bytes'?$a->{vendor}:$a->{selected};
      my $cell=\($row->{bytes});my $before=ord(substr($$cell,0,1));
      substr($$cell,0,1)=chr($before^1);$changed=ord(substr($$cell,0,1))==($before^1);
    }
    elsif($mode eq 'drift-extra') {$a->{extra}=1;$changed=exists($a->{extra});}
    else {$fail->();}
    $fail->() unless $changed;$test_drift_changed=1;
    return {mode=>''.$mode,changed=>JSON::PP::true};
  }
  sub test_restore_staged_admission {
    $fail->() unless @_==0&&$staged_phase eq 'burned'&&$test_drift_changed
      &&!$test_drift_restored&&@test_drift_hashes==8&&@test_drift_source_members==4
      &&@test_drift_creation_values==13;
    $staged_admission=$test_drift_admission;
    for my $saved(@test_drift_hashes) {%{$saved->{record}}=%{$saved->{fields}};}
    @$test_drift_sources=@test_drift_source_members;
    @$test_drift_creation=@test_drift_creation_values;
    $fail->() unless $staged_admission==$test_drift_admission;
    for my $saved(@test_drift_hashes) {
      my $now=$saved->{record};my $old=$saved->{fields};
      $fail->() unless join(',',sort keys %$now) eq join(',',sort keys %$old);
      for my $key(keys %$old) {
        $fail->() unless ref($old->{$key})?$now->{$key}==$old->{$key}:$now->{$key} eq $old->{$key};
      }
    }
    $fail->() unless @$test_drift_sources==4&&@$test_drift_creation==13;
    for my $i(0..3) {$fail->() unless $test_drift_sources->[$i]==$test_drift_source_members[$i];}
    for my $i(0..12) {$fail->() unless $test_drift_creation->[$i]==$test_drift_creation_values[$i];}
    $test_drift_restored=1;return {restored=>JSON::PP::true};
  }
```

Extend BOTH full healthy grammar conditions with this exact Perl clause:
```perl
$mode=~/\Adrift-/
```

BEFORE my$take, fixedcompletedhold prefix chosen beforeeffects:
```perl
      if($mode=~/\Adrift-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
```

BEFORE existing outerfinal }else{$failunlessrefused}, insert branch below,
retainingoriginal }else closingline afterwards. Realhold then nomination;
actualrecheck canonicalrefusal BEFOREentryclock, privateobserver BEFORErestore,
savedgraphrestore then sameburnobserver:
```perl
          } elsif($mode=~/\Adrift-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeAdmissionDrift}=test_observe_staged_custody();
            $outcomes->{admissionDriftMutation}=test_change_staged_admission();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            $outcomes->{sourceAfterAdmissionDrift}=test_observe_staged_custody();
            $outcomes->{admissionDriftRestoration}=test_restore_staged_admission();
            $outcomes->{sourceAfterAdmissionDriftRestore}=test_observe_staged_custody();
```

Immediately after common repeat-delta assertion:
```perl
          if($mode=~/\Adrift-/) {
            $outcomes->{sourceAfterAdmissionDriftRepeats}=test_observe_staged_custody();
          }
```

BEFORE STAGED_DIRECTORY_FH_CORE_KEYS:
```javascript
const STAGED_ADMISSION_DRIFT_MODES=[
  'drift-copy-admission',
  'drift-copy-creator',
  'drift-copy-creation',
  'drift-copy-sources',
  'drift-copy-source-0',
  'drift-copy-source-1',
  'drift-copy-source-2',
  'drift-copy-source-3',
  'drift-copy-vendor',
  'drift-copy-selected',
  'drift-selected-detached',
  'drift-root',
  'drift-creation-inode',
  'drift-source-bytes-0',
  'drift-source-bytes-1',
  'drift-source-bytes-2',
  'drift-source-bytes-3',
  'drift-vendor-bytes',
  'drift-selected-bytes',
  'drift-extra',
];
for(const mode of STAGED_ADMISSION_DRIFT_MODES)
  test('staged custody admission drift rejects changed graph for '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
    assert.deepEqual(r.admissionDriftMutation,{mode,changed:true});
    assert.deepEqual(r.admissionDriftRestoration,{restored:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[24,228,12,216]);
    assert.deepEqual(r.sourceBeforeAdmissionDrift,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:Array(12).fill(0)});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)};
    for(const state of ['sourceAfterAdmissionDrift','sourceAfterAdmissionDriftRestore',
      'sourceAfterAdmissionDriftRepeats']) assert.deepEqual(r[state],burned);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
  });

```

ONE future exactfocus only after BOTHliteral+actualreviews/syntax/diff/fresh
root+tools and independentpreservation/resource/HTTP admission. No replay of
closedoldfocusedruns and no clone/CI/build whilediskdiagnosis unresolved:
```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody admission drift ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

All20 expected C237/H24/2574ports/228originals(12stage+216helper)alreadyclosed;
private12attempted/closed/burninvalid1/uncertain0/disposal1/fixture0. Restoration
cannot resurrect; threerepeatszeroeffects and unchangedsourceburn. Copies are
equal plain containers, so no candidatecallbacks in this batch; admissionmagic
current/retained10targets+10copies remains subsequentUNEXECUTED work.
Any helper/prototype/queue/setup/cleanupfault remains harnessFault, no REDcredit.
Physicalbackings/sourcepins unchanged; modifiedadmission bytes are notphysical
filecorruption. No sourcecommit/PR/build/native/DB/service/cutover outcome here.

#### Closed twenty plain admission drift cases, 2026-10-04 11:01 UTC

Root applied only reviewed test blocks after BOTH literal C0/I0/M0; source434
unchanged. Syntax24ba3b/diffdc51c3 CLOSED0; actual test
b6dbba1398f2611b3229bbd2bb90a6dc984a6b9e51c5cc33250e1a5edd258766,
408145B. BOTH actual-delta reviews C0/I0/M0; exact reverse-in-memory review
recovered prior3718, no unrelated change. ONE prescribed focus af3313 naturally
CLOSED0/full505tokens20PASS/0FAIL/CANCEL/SKIP/TODO2634.53075ms; no managed
session and NOREPLAY. Setup/grammar faults were not represented as semantic RED.

Root pre58fd1b11:01:56/postc5424e11:01:59 CLOSED0:
2093tracked/69887017B/physical
32375b4cdc75d24f182647798bbd48b180d983ab53d5471cf3903bc485d00555;
plan3d458/source434/testb6 exact, npm1957 files/tools pinned, no ownroot
deps/dist/.setfarm/config residue. Independent inventory10:56:52–55 C0:
all retained comparators/original two/backups/journal/tool pins matched;
2090 other tracked files Git-exact. Disk7737316KiBfree97%, memory59%free,
no thermal warning; root refresh10:57 available7736944KiB/memory60%;
HTTP3080/18789200,3333knownrefused. Root11:00 original two SHA pins matched.
Preservation/resource evidence is not production behavior qualification.

All20 actual rechecks refuse before C238 at C237/H24/2574ports/228physical
originals; private12attempted/12closed, fixture0. Equal copies preserve the
vendor join where required, so reference continuity—not a broken archive join—
is exercised. Saved original public graph is independently restored, not private
expectations/snapshot; phase remains burned invalid1/uncertain0/disposal1.
Three actual repeats create zero effects and cannot resurrect custody.

Closed disjoint resume focuses now total147passes (prior78 +new69), not a
current full-suite/current combined-run claim. This cycle adds20; no source
commit/push/PR/build/native/DB/service/cutover qualification. All original
files/retained worktrees/evidence remain visible and untouched.

#### Next closed cycle: twenty current and retained admission magic denials

This ordinary test-only cycle follows closed drift20. Exact source434 and all
private captured expectations/original closures stay unchanged. Each of ten
unique original public admission containers is nominated once as current and
once after its current public position receives a byte/value-equal plain copy:
admissionHV, creatorHV, creationIdentityAV, sourcesAV, four sourceHV, vendorHV,
selectedHV. archiveRef is the same vendor identity, not an eleventh target.
The retained vendor copy repairs selected.archiveRef to the current vendor so
the current graph remains joined. A retained top admission copy changes only
the trusted memory helper's current staged_admission binding, not merely the
fixture binding; no production setter is added.

Helpers are source-memory-only additions before test_tie_staged_partial,
after the already admitted public restoration helper. Save original references,
eight hashes/fields/bytes, four source members and thirteen numeric creation
values BEFORE any tie. No private snapshot/expectation/checker/closure/original
mutation or regeneration. A separate flat primitive callback ledger uses the
already reviewed closed tied AV/HV classes. Exactly one target tie/factory;
no candidate traversal after tie. Only the guarded actual consumer decides.

Closed mode inventory addition:

```perl
amagic-current-admission amagic-current-creator amagic-current-creation amagic-current-sources amagic-current-source-0 amagic-current-source-1 amagic-current-source-2 amagic-current-source-3 amagic-current-vendor amagic-current-selected amagic-retained-admission amagic-retained-creator amagic-retained-creation amagic-retained-sources amagic-retained-source-0 amagic-retained-source-1 amagic-retained-source-2 amagic-retained-source-3 amagic-retained-vendor amagic-retained-selected
```

Memory helpers:

```perl
  my ($test_admission_magic_target,$test_admission_magic_kind);
  my $test_admission_magic_counts={factory=>0,untie=>0,destroy=>0,callbacks=>{
    map {$_=>0} qw(FETCHSIZE FETCH STORE STORESIZE EXTEND PUSH POP SHIFT UNSHIFT CLEAR EXISTS DELETE FIRSTKEY NEXTKEY SCALAR)}};
  sub test_change_staged_admission_magic {
    $fail->() unless @_==0&&$staged_phase eq 'active'&&!$test_drift_changed
      &&!defined($test_admission_magic_target)&&!$test_admission_magic_counts->{factory};
    my %allowed=map {$_=>1} qw(amagic-current-admission amagic-current-creator amagic-current-creation amagic-current-sources amagic-current-source-0 amagic-current-source-1 amagic-current-source-2 amagic-current-source-3 amagic-current-vendor amagic-current-selected amagic-retained-admission amagic-retained-creator amagic-retained-creation amagic-retained-sources amagic-retained-source-0 amagic-retained-source-1 amagic-retained-source-2 amagic-retained-source-3 amagic-retained-vendor amagic-retained-selected);
    $fail->() unless $allowed{$mode};
    # Save the entire original public graph before tying any current or retained cell.
    my $a=$staged_admission;my $creator=$a->{creator};my $sources=$a->{sources};
    $test_drift_admission=$a;$test_drift_creation=$creator->{creationIdentity};
    $test_drift_sources=$sources;
    @test_drift_creation_values=@$test_drift_creation;
    @test_drift_source_members=@$sources;
    @test_drift_hashes=map {+{record=>$_,fields=>{%$_}}}
      ($a,$creator,@$sources,$a->{vendor},$a->{selected});
    $fail->() unless $mode=~/\Aamagic-(current|retained)-(.+)\z/;
    my ($which,$part)=($1,$2);my ($target,$kind);
    if($part eq 'admission') {
      $target=$a;$kind='hash';$staged_admission={%$a} if $which eq 'retained';
    } elsif($part eq 'creator') {
      $target=$creator;$kind='hash';$a->{creator}={%$creator} if $which eq 'retained';
    } elsif($part eq 'creation') {
      $target=$test_drift_creation;$kind='array';
      $creator->{creationIdentity}=[@$target] if $which eq 'retained';
    } elsif($part eq 'sources') {
      $target=$sources;$kind='array';$a->{sources}=[@$sources] if $which eq 'retained';
    } elsif($part=~/\Asource-([0-3])\z/) {
      my $i=0+$1;$target=$sources->[$i];$kind='hash';
      $sources->[$i]={%$target} if $which eq 'retained';
    } elsif($part eq 'vendor') {
      $target=$a->{vendor};$kind='hash';
      if($which eq 'retained') {$a->{vendor}={%$target};$a->{selected}{archiveRef}=$a->{vendor};}
    } elsif($part eq 'selected') {
      $target=$a->{selected};$kind='hash';$a->{selected}={%$target} if $which eq 'retained';
    } else {$fail->();}
    $test_admission_magic_target=$target;$test_admission_magic_kind=$kind;
    $test_drift_changed=1;
    if($kind eq 'array') {tie @$target,'TestStagedPartialArray',$test_admission_magic_counts;}
    elsif($kind eq 'hash') {tie %$target,'TestStagedMetadataHash',$test_admission_magic_counts;}
    else {$fail->();}
    my $sv=B::svref_2object($target);
    $fail->() unless $test_admission_magic_counts->{factory}==1&&($sv->FLAGS&0x00f00000);
    return {mode=>''.$mode,changed=>JSON::PP::true};
  }
  sub test_observe_staged_admission_magic {
    $fail->() unless @_==0;
    return {factory=>0+$test_admission_magic_counts->{factory},
      untie=>0+$test_admission_magic_counts->{untie},destroy=>0+$test_admission_magic_counts->{destroy},
      callbacks=>{%{$test_admission_magic_counts->{callbacks}}}};
  }
  sub test_restore_staged_admission_magic {
    $fail->() unless @_==0&&$staged_phase eq 'burned'&&defined($test_admission_magic_target)
      &&$test_admission_magic_counts->{factory}==1&&!$test_admission_magic_counts->{untie};
    if($test_admission_magic_kind eq 'array') {untie @$test_admission_magic_target;}
    elsif($test_admission_magic_kind eq 'hash') {untie %$test_admission_magic_target;}
    else {$fail->();}
    $fail->() unless $test_admission_magic_counts->{untie}==1&&$test_admission_magic_counts->{destroy}==1;
    $test_admission_magic_target=undef;
    return test_restore_staged_admission();
  }
```

Append this exact clause to both existing full healthy grammar predicates;
no generic mode admission or queue fallback:

```perl
$mode=~/\Aamagic-/
```

The predetermined prefix is fixed BEFORE acquisitions: healthy grammar through
completed hold C237/H24, then all twelve stage closes. No runtime queue erasure
after a refusal. Insert before my take=sub:

```perl
      if($mode=~/\Aamagic-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
```

Insert this driver branch immediately before the final ordinary refusal branch.
Actual hold succeeds, target tie happens, actual recheck must canonically refuse
before C238. Capture private burn and flat callbacks, repeat all three actual
consumers WHILE STILL TIED with zero effects/callbacks; only then untie the exact
target. Verify UNTIE1/DESTROY1, restore the original public graph via the already
reviewed independently validated public restoration (no private state reset),
and observe the same burn:

```perl
          } elsif($mode=~/\Aamagic-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeAdmissionMagic}=test_observe_staged_custody();
            $outcomes->{admissionMagicMutation}=test_change_staged_admission_magic();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            $outcomes->{sourceAfterAdmissionMagicRefusal}=test_observe_staged_custody();
            $outcomes->{admissionMagicAfterRefusal}=test_observe_staged_admission_magic();
            my $before=scalar(@events);
            for my $name(qw(hold recheck release)) {
              my $again=eval {$operations{$name}->()};my $error=$@;$check->();
              $fail->() unless !defined($again)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            }
            $outcomes->{admissionMagicTiedRepeatDelta}=scalar(@events)-$before;
            $fail->() if $outcomes->{admissionMagicTiedRepeatDelta};
            $outcomes->{sourceAfterAdmissionMagicTiedRepeats}=test_observe_staged_custody();
            $outcomes->{admissionMagicBeforeUntie}=test_observe_staged_admission_magic();
            $outcomes->{admissionMagicRestoration}=test_restore_staged_admission_magic();
            $outcomes->{sourceAfterAdmissionMagicRestoration}=test_observe_staged_custody();
            $outcomes->{admissionMagicAfterUntie}=test_observe_staged_admission_magic();
```

After common zero-effect hold/recheck/release repeats observe:

```perl
          if($mode=~/\Aamagic-/) {
            $outcomes->{sourceAfterAdmissionMagicRepeats}=test_observe_staged_custody();
            $outcomes->{admissionMagicAfterRestoredRepeats}=test_observe_staged_admission_magic();
          }
```

All twenty actual guarded cases have C237/H24/2574 ports, physical228 originals
(12 stage +216 helper), private12 attempts/12 definite closes, fixture0,
burned invalid1/uncertain0/disposal1. Constructor1; all15 callbacks zero before
refusal, while-tied repeats, untie and restored repeats. These are actual guarded
consumer tests, not isolated magic mutants/native/privileged provenance proof.
Existing source/plain-cell/vector mutants retain their separate receipts.

Insert exact Node oracles before STAGED_DIRECTORY_FH_CORE_KEYS:

```javascript
const STAGED_ADMISSION_MAGIC_MODES=[
  'amagic-current-admission',
  'amagic-current-creator',
  'amagic-current-creation',
  'amagic-current-sources',
  'amagic-current-source-0',
  'amagic-current-source-1',
  'amagic-current-source-2',
  'amagic-current-source-3',
  'amagic-current-vendor',
  'amagic-current-selected',
  'amagic-retained-admission',
  'amagic-retained-creator',
  'amagic-retained-creation',
  'amagic-retained-sources',
  'amagic-retained-source-0',
  'amagic-retained-source-1',
  'amagic-retained-source-2',
  'amagic-retained-source-3',
  'amagic-retained-vendor',
  'amagic-retained-selected',
];
for(const mode of STAGED_ADMISSION_MAGIC_MODES)
  test('staged custody admission magic rejects original graph for '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
    assert.deepEqual(r.admissionMagicMutation,{mode,changed:true});
    assert.deepEqual(r.admissionMagicRestoration,{restored:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[24,228,12,216]);
    assert.equal(r.admissionMagicTiedRepeatDelta,0);
    assert.deepEqual(r.sourceBeforeAdmissionMagic,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:Array(12).fill(0)});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)};
    for(const state of ['sourceAfterAdmissionMagicRefusal','sourceAfterAdmissionMagicTiedRepeats',
      'sourceAfterAdmissionMagicRestoration','sourceAfterAdmissionMagicRepeats'])
      assert.deepEqual(r[state],burned);
    const tied={factory:1,untie:0,destroy:0,callbacks:STAGED_METADATA_MAGIC_ZERO};
    assert.deepEqual(r.admissionMagicAfterRefusal,tied);assert.deepEqual(r.admissionMagicBeforeUntie,tied);
    const untied={factory:1,untie:1,destroy:1,callbacks:STAGED_METADATA_MAGIC_ZERO};
    assert.deepEqual(r.admissionMagicAfterUntie,untied);
    assert.deepEqual(r.admissionMagicAfterRestoredRepeats,untied);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
  });
```

Single focused execution only AFTER both literal and actual-delta C0 reviews,
syntax/diff and fresh exact-source/Git/npm/tools/retained-tree/resource/HTTP gates:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody admission magic ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Natural complete terminal output and exact rootpost are required. Setup/compile/
queue faults are not semantic RED. No partial delivery/build/native/service/DB
qualification; retain every prior closed receipt and original dirty file.

#### Closed twenty current and retained admission magic cases, 2026-10-04 11:06 UTC

Root applied the exact eight-fence plan7f44 after BOTH literal C0/I0/M0.
Syntax88e4b4/diff029d94 CLOSED0. Actual test
c8b96c045d78dab026f07437c054983dff0bc3bef4f35840e75a34bd771c2c27,
417326B; BOTH actual-delta C0 reviews reversed only additions in memory and
recovered testb6 exactly. Source434 remains unchanged.

ONE prescribed focus6409b8 naturallyCLOSED0/full535tokens20PASS/0FAIL/CANCEL/
SKIP/TODO2647.553875ms; no managed session/NOREPLAY. Rootpre8949fa11:06:39/
post3e874d11:06:43 same2093/69910953B/physical
a4715153f1954a2487534d895bb17615574731778f3def06dce658514f26d15e;
plan7f/testc8/source434/spec1f26/tools/npm/absences exact.
Independent boundedgate11:06:04–05 C0 all current/originaltwo/backups/journal/
canonical/tools matched; prior10:56 full retained comparison remains prior,
not falsely retimestamped. Disk7731260KiBfree97%,memory59%free/throttled0/
no thermal warning; HTTP3080+18789200,3333knownrefused.

All20actualrechecks reject current or retained magical original containers
before C238: C237/H24/2574ports/228physicaloriginals/12privateattempted+closed/
fixture0. Tied repeats have callback0/effect0; factory1 followed exacttarget
UNTIE1/DESTROY1. Independently saved public graph restores original bindings,
bytes/fields/members/creation values without regenerating private expectations.
Private phase remains burned invalid1/uncertain0/disposal1 after both repeat
groups. No isolated-mutant/native/originalGVIOmutation claim.

Closed disjoint resume focuses total167passes=prior78+new89, not current
combined-suite/fullmatrix. This cycle adds20; no commit/push/PR/build/native/DB/
service/cutover effect or qualification. Every retained worktree/evidence and
original file is preserved.

#### Finite remaining ordinary capsule matrix audit

Independent read-only review traced remaining requirements to this approved
plan3685–3724 and spec774–874. After drift20 and admissionmagic20, do NOT expand
to a slots x fields x phases Cartesian suite. Remaining distinct requirements:
foreign same-FH parent/physical/file/directory inputs plus hidden raw original;
same staged-original alias; genuine live-FD alias with separately reviewed safe
wrapper retirement; second hold while active and active recheck/release arity;
representative staged pre/open/post stat/lstat identity/tuple/size failures;
shared captor throwing-cleanup/unsettled invalidation; ACL/epoch and once-only
original disposal semantic controls. Parent/entropy tests do not certify staged
identity validators; current definite-close mutants are not once-only controls.
A same-FD wrapper candidate via documented CORE open '<&=' is preparation only:
no alias experiment is admitted without one physical obligation, no allocation/
reuse window and independently reviewed exact cleanup/self-witness.

Authentic creator/staging writes/downloads/official extraction/credential-drop/
child/native execution/protected cleanup remain subsequent separate gates.
No current ordinary test receipt authorizes those effects. Complete mandatory
ordinary matrix then full verification/reviews/delivery; no partial delivery.

#### Next closed cycle: four foreign same-FH denials and one hidden acquisition

Root-only test changes; source434 stays unchanged. Four foreign profiles nominate
ONE actual readonly MAP FH into exactly one existing public owner-input registry
(parent/physical/file/directory) in the memory-only source initializer, then
the first sysopen exposes the SAME borrowed native FH without a second physical
acquisition. These registries are fixture inputs, not authenticated complete
parent/physical owners. Hidden profile actually CORE opens first d0, immediately
registers the raw original as fixture-only, keeps caller cell undefined and
returns0. No native exec, real child, writes, duplication, POSIX integer close,
descriptor reassignment or borrowed original disposal is admitted.

All profiles slot0, existing finite mode validation remains. Append names to
the exact mode allowlist; insert inventory/strong references immediately after
mode validation before logical paths:

```perl
foreign-parent foreign-physical foreign-file foreign-directory hidden-open-undefined
```

```perl
      my %fixture_modes=map {$_=>1} qw(foreign-parent foreign-physical foreign-file foreign-directory hidden-open-undefined);
      my ($fixture_original,$fixture_record);my $raw_acquisitions=0;
```

Replace only the unknown grammar predicate with
unknown OR fixture_modes, or insert this exact branch after it. Both forms emit
the fixed four-operation startup clock/stage clock/lstatd0/sysopend0 prefix;
no helper jobs or source closes. Use the separate exact branch below:

```perl
      elsif($fixture_modes{$mode}) {
        $emit->('clock','stage');$emit->('lstat','d0');$emit->('sysopen','d0');
      }
```

Replace the register header through initial push with this exact beginning. Caller arguments are only fixed primitive0/default or1, never candidate-supplied; attribution is captured in an inaccessible lexical closure along with original CORE disposer. No validation or fallible metadata between successful acquisition and raw registry push. Existing fd/stat/role checks follow unchanged; rescue traverses already-pushed raw registry even if register fails before returning its record:

```perl
      my $register=sub {
        my ($fh,$role,$dir_stream,$path,$fixture_only)=@_;
        $fixture_only=defined($fixture_only)?$fixture_only:0;
        # Retain raw acquisition, immutable attribution and disposer before inspection.
        my $o={fh=>$fh,role=>$role,dirStream=>$dir_stream,path=>$path,attempted=>0,closed=>0,
          fixtureOnly=>sub {$fixture_only},
          originalClose=>sub {$dir_stream?CORE::closedir($fh):CORE::close($fh)}};
        push @owned,$o;
```

Replace the dispose argument/attempt header. Fixture-only consumer routing is denied BEFORE delegation; this is harness containment, not a semantic mutant oracle. Old pipe records without attribution remain default consumer originals:

```perl
        my ($o,$fixture)=@_;
        $fail->() if exists($o->{fixtureOnly})&&$o->{fixtureOnly}->()&&!$fixture;
        return 0 if $o->{attempted};
```

Insert sysopen branch after unknown nomination but BEFORE ordinary open-undefined/CORE acquisition. Existing op/flags/path checks and event are unchanged; exactly firstd0 is admitted. Hidden metadata inspection happens only after raw record with original disposer has been pushed:

```perl
          if($fixture_modes{$mode}) {
            $fail->() unless $open_ordinal==1&&$p->{role} eq 'd0';
            if($mode eq 'hidden-open-undefined') {
              CORE::sysopen(my $raw,$p->{actual},$flags) or $fail->();
              ++$raw_acquisitions;
              $fixture_record=$register->($raw,'fixture-hidden',0,$p,1);
              $fixture_original=$raw;
              $same_physical->($p->{identity},$fixture_record->{identity},'directory');
              $fail->() if defined($_[0]);return 0;
            }
            $fail->() unless defined($fixture_original)&&defined($fixture_record)
              &&$raw_acquisitions==1&&$fixture_record->{fixtureOnly}->();
            $_[0]=$fixture_original;return 1;
          }
```

Insert constructor INSIDE body_ok eval immediately before source eval, never outside its rescue coverage. Selected MAP metadata/mode/class checked BEFORE CORE acquisition. Source loading, helper initialization or post-register inspection faults still reach preserved fixture rescue and remain failures, not semantic RED:

```perl
          if($fixture_modes{$mode}&&$mode ne 'hidden-open-undefined') {
            my $p=$paths{$logical.'/'.$leaf_rel[2]};
            $fail->() unless defined($p)&&$p->{role} eq 'f2'&&!@owned&&!$raw_acquisitions;
            my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK();
            CORE::sysopen(my $raw,$p->{actual},$flags) or $fail->();
            ++$raw_acquisitions;
            $fixture_record=$register->($raw,'fixture-foreign',0,$p,1);
            $fixture_original=$raw;
            $same_physical->($p->{identity},$fixture_record->{identity},'file');
          }
```

Insert these memory-only nominations immediately after staged_admission assignment. No other source owner registry is edited and no actual owner authority is inferred:

```perl
  if($mode eq 'foreign-parent') {push @parent_originals,{fh=>$fixture_original};}
  elsif($mode eq 'foreign-physical') {push @physical_owned_handles,$fixture_original;}
  elsif($mode eq 'foreign-file') {push @file_ledger,{fh=>$fixture_original};}
  elsif($mode eq 'foreign-directory') {push @directory_ledger,{fh=>$fixture_original};}
```

After initial actual hold refusal/outcome assignment, record source private observer state without exporting FH/FD/CV. Existing final ordinary-refusal branch and common actual three repeats remain unchanged:

```perl
          if($fixture_modes{$mode}) {
            $fail->() unless $refused;
            $outcomes->{sourceAfterFixtureRefusal}=test_observe_staged_custody();
          }
```

After common repeats/queue check/unknown finalization, immediately before body success1, witness original still live with captured actual CORE fd and independent physical identity; zero attempted/closed counts. Metadata inspection failure still goes through rescue and fails the harness:

```perl
          if($fixture_modes{$mode}) {
            $fail->() unless @owned==1&&$raw_acquisitions==1&&defined($fixture_record)
              &&$owned[0]==$fixture_record&&$fixture_record->{fixtureOnly}->()
              &&!$fixture_record->{attempted}&&!$fixture_record->{closed}
              &&defined($fixture_original)&&$fixture_original==$fixture_record->{fh};
            my $live=CORE::fileno($fixture_original);
            $fail->() unless defined($live)&&$live==$fixture_record->{fd};
            my $kind=$mode eq 'hidden-open-undefined'?'directory':'file';
            $same_physical->($fixture_record->{identity},[CORE::stat($fixture_original)],$kind);
            $outcomes->{fixtureOwnerBeforeRescue}={live=>JSON::PP::true,sameFd=>JSON::PP::true,
              sameIdentity=>JSON::PP::true,attempted=>0,closed=>0};
            $outcomes->{rawAcquisitions}=0+$raw_acquisitions;
            $outcomes->{sourceAfterFixtureRepeats}=test_observe_staged_custody();
          }
```

The existing finalizer's once-only original CORE disposer stays unchanged. Replace
footer definite/fixture/stage checks with this exact block. Hidden path truthiness
MUST NOT create stageClosed credit. Raw fixture-only classification is captured
before inspection and consulted independently of mutable staged/parent metadata.

```perl
      $fail->() unless $definite==@owned;
      if($fixture_modes{$mode}) {
        $fail->() unless @owned==1&&$raw_acquisitions==1&&$fixture_closed==1
          &&defined($outcomes->{fixtureOwnerBeforeRescue})&&$outcomes->{fixtureOwnerBeforeRescue}{live}
          &&$helpers==0&&defined($repeat_delta)&&$repeat_delta==0&&!@grammar;
      } else {$fail->() if $fixture_closed;}
      my $stage_closed=grep {$_->{closed}&&$_->{path}
        &&!(exists($_->{fixtureOnly})&&$_->{fixtureOnly}->())} @owned;
      if($fixture_modes{$mode}) {
        $fail->() if $stage_closed||$definite-$stage_closed-$fixture_closed;
        $outcomes->{consumerClosed}=0+($definite-$fixture_closed);
      }
```

In the output change ONLY helperClosed arithmetic to exclude fixture closures:

```perl
helperClosed=>$definite-$stage_closed-$fixture_closed,
```

Replace the Node wrapper's remainingOperations/fixtureClosed assertions with
this exact five-name exception. All old profiles retain fixtureClosed0; no
prefix matcher, generic positive cleanup tolerance or census-only proof:

```javascript
  assert.equal(value.remainingOperations,0);
  if(['foreign-parent','foreign-physical','foreign-file','foreign-directory','hidden-open-undefined'].includes(mode)) {
    assert.equal(slot,0);
    assert.deepEqual([value.rawAcquisitions,value.ownedCount,value.definitelyClosed,value.fixtureClosed,
      value.consumerClosed,value.stageClosed,value.helperClosed],[1,1,1,1,0,0,0]);
    assert.deepEqual(value.fixtureOwnerBeforeRescue,{live:true,sameFd:true,sameIdentity:true,
      attempted:0,closed:0});
  } else assert.equal(value.fixtureClosed,0);
```

Insert these tests before STAGED_DIRECTORY_FH_CORE_KEYS:

```javascript
const STAGED_FIXTURE_ONLY_MODES=[
  'foreign-parent','foreign-physical','foreign-file','foreign-directory','hidden-open-undefined',
];
for(const mode of STAGED_FIXTURE_ONLY_MODES)
  test('staged custody fixture ownership rejects borrower or hidden original '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,true);assert.equal(r.hold,null);
    assert.deepEqual(r.calls,{clock:2,lstat:1,sysopen:1});
    assert.equal(r.events.length,4);
    assert.deepEqual(r.events.map(e=>e.op+':'+e.role),
      ['clock:startup','clock:stage','lstat:d0','sysopen:d0']);
    assert.deepEqual([r.helpers,r.rawAcquisitions,r.ownedCount,r.definitelyClosed,
      r.fixtureClosed,r.consumerClosed,r.stageClosed,r.helperClosed],[0,1,1,1,1,0,0,0]);
    assert.deepEqual(r.fixtureOwnerBeforeRescue,{live:true,sameFd:true,sameIdentity:true,
      attempted:0,closed:0});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:0,attemptedCount:0,privateClosedCount:0,closedFlags:[]};
    assert.deepEqual(r.sourceAfterFixtureRefusal,burned);
    assert.deepEqual(r.sourceAfterFixtureRepeats,burned);
    assert.equal(r.repeatEffectDelta,0);assert.equal(r.remainingOperations,0);
  });
```

Each actual hold canonically refuses; source zero sealed/attempted/closed handles,
burnedinvalid1/uncertain0/disposal1, repeats zero effects. Immediately before
fixture rescue the original is still live/unattempted/unclosed; after natural
rescue rawAcquisitions=ownedCount=definitelyClosed=fixtureClosed=1, all consumer/
stage/helper close counts0. Definite fixture closure is not consumer closure,
native qualification or hidden-original leak-freedom claim. Constructor, compile,
shape/prototype/queue/inspection faults fail closed, never behavioral passes.

One exact focus only after both literal and actual-delta reviews C0, syntax/diff
and fresh Git/all-source/npm/tools/retained/originals/resource/HTTP gates:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody fixture ownership ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Read full natural terminal and exact rootpost; no repeated old sessions/tests.
Genuine distinct-GV same-live-FD alias/staged-original alias remain separate
unadmitted work. No partial delivery/build/native/credential/DB/service effect.

#### Closed foreign same-FH4 and hidden raw1, 2026-10-04 11:18 UTC

BOTH literal956 C0/I0/M0. Initial apply atomically refused a partial source-load
line anchor; hash754ffe confirmed priorc8 untouched. This was neither mutation
nor semantic RED. Corrected read-only extractor97bfb5 enforces complete-line
anchors, retains load/setup/check suffix, and root applies exact fifteen fences.
Syntax38b965/diff02e9e3 CLOSED0. Actualtest
50301c40f56d8dbd41391f73f7d3678f8bdce32683ef889eb300146fd7dc7a41,
423071B. BOTH actual C0 reviews reverse exact changes/separator to priorc8.

ONE prescribed focus269860 naturallyCLOSED0/full159tokens5PASS/0FAIL/CANCEL/
SKIP/TODO398.436708ms; no managedsession/NOREPLAY. Rootpre1cd36c11:18:22/
post1a71cd11:18:23 same2093/69931624B/physical
7836fb6a32d36549aa5dfdfc98b83db1ed141ae1bcab0cf35bc28d65e4fe01d1;
source434/test503/plan956/spec1f26/npm/tools/absences exact.
Independent boundedgate11:15:03–04C0 current/originaltwo/backups/journal/
canonical/tool keypins matched; disk7729884KiBfree97%,memory60%free/throttled0/
no thermal warning; HTTP3080+18789200,3333knownrefused. Prior10:56 full
historical comparison not replayed/retimestamped.

All five actual hold refusals consume clock2/lstat1/sysopen1, fourevents/H0/
sourceclose0/private0sealed/0attempted/0closed, burninvalid1uncertain0disposal1.
Before fixture rescue ONE raw original remains actually live, same actual CORE
FD and independently checked physicalidentity, attempted0closed0. Three actual
repeats have zeroeffects and sameburn. Exactly once original CORE fixture rescue
definitely closes ONE: rawAcquisitions=ownedCount=definitelyClosed=fixtureClosed=1;
consumerClosed=stageClosed=helperClosed=0. Hidden path truthiness produces no
stage credit. Old profiles retain fixtureClosed0. No hidden-rescue consumer/native/
leak-freedom claim, duplicate-FD constructor, integer close or real child.

Closed disjoint resume172focusedpasses=prior78+new94, not full currentcombined
suite/fullmatrix. No commit/push/PR/build/native/DB/service/cutover effect.
Same staged-original/genuine live-FD aliases remain mandatory subsequent cases;
IO-only distinct-GV/shared-IO construction is documented research only, unexecuted.

#### Next closed cycle: three active entry misuse denials

Root-only test extension; source434 unchanged. Complete healthy actual hold
then nominate a zero-argument second hold WHILE ACTIVE or a one-argument active
recheck/release. Existing initial hold(1)/premature tests do not cover these
three distinct entry paths. No fixture mutation/port-fault/private reset.

Append only these exact names to finite mode inventory:

```perl
active-hold-again active-recheck-arity active-release-arity
```

Append this exact clause to both healthy grammar predicates:

```perl
$mode=~/\Aactive-/
```

Predetermine completed hold C237/H24 plus twelve closes before any effect:

```perl
      if($mode=~/\Aactive-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
```

Insert before final ordinary refusal driver branch; call actual consumer, catch
canonical refusal, inspect private burn. No replacement operation or fake DTO:

```perl
          } elsif($mode=~/\Aactive-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeActiveMisuse}=test_observe_staged_custody();
            my %nominees=('active-hold-again'=>['hold',0],
              'active-recheck-arity'=>['recheck',1],'active-release-arity'=>['release',1]);
            my $nominee=$nominees{$mode};$fail->() unless defined($nominee);
            my $value=eval {$nominee->[1]?$operations{$nominee->[0]}->(1):$operations{$nominee->[0]}->()};
            my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{activeMisuse}={operation=>''.$nominee->[0],arity=>0+$nominee->[1],
              refused=>JSON::PP::true};
            $outcomes->{sourceAfterActiveMisuse}=test_observe_staged_custody();
```

After common three zero-effect actual repeats observe sameburn:

```perl
          if($mode=~/\Aactive-/) {
            $outcomes->{sourceAfterActiveMisuseRepeats}=test_observe_staged_custody();
          }
```

Insert exact Node checks before STAGED_DIRECTORY_FH_CORE_KEYS:

```javascript
for(const [mode,operation,arity] of [
  ['active-hold-again','hold',0],['active-recheck-arity','recheck',1],['active-release-arity','release',1],
])
  test('staged custody active entry refuses '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);
    assert.deepEqual(r.activeMisuse,{operation,arity,refused:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[24,228,12,216]);
    assert.deepEqual(r.sourceBeforeActiveMisuse,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:Array(12).fill(0)});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)};
    assert.deepEqual(r.sourceAfterActiveMisuse,burned);
    assert.deepEqual(r.sourceAfterActiveMisuseRepeats,burned);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
    assert.equal(r.repeatEffectDelta,0);
  });
```

All three C237/H24/2574ports/228originals/12privateattempted+closed/fixture0.
Second hold and both arity errors must burn before disposition; no recheck
entry C238/helper/native operation; common repeats cannot resurrect custody.

Single exact focus after BOTH literal+actual C0 reviews, syntax/diff and fresh
all-source/Git/tools/npm/preservation/resource/HTTP gates:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody active entry ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Full natural terminal and exact postgate required; setup/queue/compile faults
are not semanticRED. No partial delivery/build/native/DB/service cutover claim.

#### Closed three active entry misuse cases, 2026-10-04 11:22 UTC

BOTH literaleeca C0/I0/M0, exact readonlyextractor6780ee sevenfences/rootapply.
Syntax20d3e8/diff20a702 CLOSED0. Actualtest
734b5aebe9d3476b55f477e2bb4857cab51a2c737a3cf5ccce255d3ad806db82,
425738B. BOTH actual reviews C0 reverse exact additions/separator to prior503.
Source434 unchanged.

ONE prescribed focus2760cb naturallyCLOSED0/full85tokens3PASS/0FAIL/CANCEL/
SKIP/TODO460.559792ms/no managedsession/NOREPLAY.
Rootpre73be2f11:22:43/postb8b32c11:22:44 same2093/69940870B/physical
b6ffbebc1f3ad1cc800b5db362d428ae9eb649cb7b427cfda8c67cb9912d20a8;
planeeca/test734/source434/spec1f26/npm/tools/absences exact.
Independent boundedgate11:22:06–07C0 current/originaltwo/backups/journal/
canonical/toolkeypins matched; disk7742532KiBfree97%,memory60%free/throttled0/
no thermal warning; HTTP3080+18789200,3333knownrefused. Prior10:56fullretained
comparison stays prior, not retimestamped.

Healthy actual hold followed by hold()again/recheck(1)/release(1) all canonically
refuse before C238 at C237/H24/2574ports/228originals/12privateattempted+closed/
fixture0. Phaseburnedinvalid1uncertain0disposal1 persists, actual repeatszero.
Closed disjoint resume175focusedpasses=prior78+new97, not currentcombinedsuite/
fullmatrix. This cycle adds3. No commit/push/PR/build/native/DB/service/cutover
effect or qualification; all retained worktrees/evidence/originalfiles preserved.

#### Safe alias constructor research, unexecuted

Main read installed Symbol.pm1–115, perlref.pod230–276, perlmod.pod144–181
and perlfunc.pod4795–4835 after independent read-only research. IO-slot-only
assignment into Symbol::gensym's genuine distinct anonymous GV references the
existing IO rather than using fdopen '<&=' or full-glob synonym. Candidate:
Symbol::gensym then *alias = *original{IO}. This is SOURCE INFERENCE ONLY.
No constructor run, B predicate proof, FD alias run or cleanup proof yet.

The next reviewed literal must independently establish native original/alias
cell→GV→IO callback-free guard; distinct GV refs and false same-reference
comparison; identical actual IO and equal still-live COREfileno≥3; one raw
physical acquisition/no alias registration or second close obligation; borrowed
original remains live through source refusal/repeats; exactly one captured
original COREclose makes BOTH actualfilenos undefined while strong references
remain retained. No descriptor allocation/rebinding/reuse window, integer close,
borrowed close, destructor-as-cleanup or private checker replacement. Source
uncertain0/private0sealed plus distinct-reference/equal-FD witness distinguishes
the actual same-FD alias denial from malformed/same-FH refusal. Failure of any
independent self-witness fails fixture, not semanticRED/nativequalification.

#### Next closed cycle: two actual live alias denials

Source434 unchanged; root-only test extension. Local primary installed docs and
independent static count review support the candidate but prove no runtime facts.
One new profile returns a distinct genuine Symbol::gensym GV whose IO-only slot
references the existing actual MAP IO (NOT full-glob synonym, '<&=' fdopen,
dup/dup2, integerclose or rebinding). One profile returns an already sealed d0
FH unchanged at second staged sysopen. Both have only ONE staged/foreign physical
obligation for the aliased FD; neither creates a second original/disposer.

Append these exact names to global finite mode inventory:

```perl
foreign-fd-alias staged-reference-alias
```

Only foreign-fd-alias is added to exact fixture-only classification and its Node
exception. Replace those two exact allowlists from five names with six names,
never a prefix/fallback. Extend the existing fixture lexical declaration only:

```perl
my %fixture_modes=map {$_=>1} qw(foreign-parent foreign-physical foreign-file foreign-directory hidden-open-undefined foreign-fd-alias);
my ($fixture_original,$fixture_record,$fixture_alias);my $raw_acquisitions=0;
```

Insert this independent native-shape helper after shape and before nominate. It uses installed B introspection, no candidate method/fileno/comparison until exact scalar/GV/IO mask/magic checks have succeeded. It never exports or replaces source private checkers:

```perl
      my $alias_native=sub {
        my ($cell)=@_;my $s=$shape->($cell);
        $fail->() unless $s->{cellClass} eq 'B::IV'&&($s->{cellFlags}&B::SVf_ROK())
          &&!($s->{cellFlags}&0x00f00000)&&$s->{rvClass} eq 'B::GV'
          &&!($s->{rvFlags}&0x00f00000)&&!$s->{gvMagic}
          &&$s->{ioClass} eq 'B::IO'&&!($s->{ioFlags}&0x00e00000)&&!$s->{ioMagic};
        return 1;
      };
```

Insert grammar branch after fixture-only grammar and before configuration branch. Fixed second-open alias prefix: C10/H1/99ports, actual10 originals=1stage+8pipes+1DIR; no second acquisition/register. One original stage close and no fixture close:

```perl
      elsif($mode eq 'staged-reference-alias') {
        $emit->('clock','stage');$emit->('lstat','d0');$emit->('sysopen','d0');
        ++$stage_count;$emit->('fcntl','d0') for 1..4;$dir_grammar->(0);
        $emit->('lstat','d1');$emit->('sysopen','d1');$emit->('close','d0');
      }
```

Insert this sysopen nomination after the unknown nomination and before fixture-only branch. First d0 uses ordinary physical acquisition/capture; second d1 output receives that exact still-live original, without new CORE call or registration:

```perl
          if($mode eq 'staged-reference-alias'&&$open_ordinal==2) {
            my $old=$roles{'d0'};$fail->() unless defined($old)&&$p->{role} eq 'd1'
              &&!$old->{attempted}&&!$old->{closed};
            $alias_native->(\($old->{fh}));
            my $live=CORE::fileno($old->{fh});$fail->() unless defined($live)&&$live==$old->{fd};
            $_[0]=$old->{fh};
            $alias_native->(\($_[0]));$fail->() unless $_[0]==$old->{fh};
            $outcomes->{stagedAliasNomination}={sameRef=>JSON::PP::true,sameFd=>JSON::PP::true,
              newRawAcquisition=>JSON::PP::false};
            return 1;
          }
```

In the existing fixture-only sysopen branch replace ONLY the final
original assignment/return with this exact selection; existing first-d0/record
validation stays unchanged:

```perl
$_[0]=$mode eq 'foreign-fd-alias'?$fixture_alias:$fixture_original;
return 1;
```

Inside body_ok eval AFTER the existing protected raw foreign constructor and BEFORE source load, insert this exact IO-slot constructor/self-witness. Hold both strong GV references through original rescue and post-close inspection. B IO objects are installed introspection objects; their scalar referent pointers are compared internally, never emitted or rounded in Node:

```perl
          if($mode eq 'foreign-fd-alias') {
            $fail->() unless defined($fixture_original)&&defined($fixture_record)&&$raw_acquisitions==1;
            $fixture_alias=Symbol::gensym();
            *{$fixture_alias}=*{$fixture_original}{IO};
            $alias_native->(\$fixture_original);$alias_native->(\$fixture_alias);
            $fail->() if $fixture_alias==$fixture_original;
            my $old_io=B::svref_2object(\$fixture_original)->RV->IO;
            my $new_io=B::svref_2object(\$fixture_alias)->RV->IO;
            $fail->() unless $$old_io==$$new_io;
            my $original_fd=CORE::fileno($fixture_original);my $alias_fd=CORE::fileno($fixture_alias);
            $fail->() unless defined($original_fd)&&$original_fd>=3&&defined($alias_fd)
              &&$alias_fd==$original_fd&&$original_fd==$fixture_record->{fd};
            $same_physical->($fixture_record->{identity},[CORE::stat($fixture_alias)],'file');
            $outcomes->{fdAliasBeforeConsumer}={nativeShapes=>JSON::PP::true,
              distinctGv=>JSON::PP::true,sameIo=>JSON::PP::true,sameFd=>JSON::PP::true,
              sameRef=>JSON::PP::false,rawAcquisitions=>0+$raw_acquisitions};
          }
```

Append one memory initializer elseif after foreign-directory nomination. Only the existing raw original is nominated as physical-owner input; alias is NOT separately registered. This is a fixture input, not authentic complete owner authority:

```perl
  elsif($mode eq 'foreign-fd-alias') {push @physical_owned_handles,$fixture_original;}
```

After initial actual hold outcome, inspect private source state for staged-reference alias. Actual canonical refusal/observed uncertainty0 plus distinctref/equalFD facts identify alias denial; malformed shapes cannot earn this oracle:

```perl
          if($mode eq 'staged-reference-alias') {
            $fail->() unless $refused&&exists($outcomes->{stagedAliasNomination});
            $outcomes->{sourceAfterStagedAliasRefusal}=test_observe_staged_custody();
          }
```

After common three actual zero-effect repeats, observe same burn for staged-reference case:

```perl
          if($mode eq 'staged-reference-alias') {
            $outcomes->{sourceAfterStagedAliasRepeats}=test_observe_staged_custody();
          }
```

In existing pre-rescue fixture witness, after original live/identity proof and before body success, add this exact foreign-FD peer witness. Both must remain live after source refusal and repeats, no independent alias close:

```perl
            if($mode eq 'foreign-fd-alias') {
              $alias_native->(\$fixture_original);$alias_native->(\$fixture_alias);
              $fail->() if $fixture_alias==$fixture_original;
              my $other=CORE::fileno($fixture_alias);
              $fail->() unless defined($other)&&$other==$live;
              $same_physical->($fixture_record->{identity},[CORE::stat($fixture_alias)],'file');
              $outcomes->{fdAliasBeforeRescue}={bothLive=>JSON::PP::true,
                distinctGv=>JSON::PP::true,sameFd=>JSON::PP::true};
            }
```

After source-body/rescue block and BEFORE footer definite count, inspect both retained GVs after EXACTLY ONE original captured COREclose. Shared IO must make both actual filenos undefined. Any failed self-witness fails fixture, not semanticRED/positiveprovenance:

```perl
      if($mode eq 'foreign-fd-alias') {
        $alias_native->(\$fixture_original);$alias_native->(\$fixture_alias);
        $fail->() if defined(CORE::fileno($fixture_original))||defined(CORE::fileno($fixture_alias));
        $outcomes->{fdAliasAfterRescue}={bothUndefined=>JSON::PP::true,
          originalAttempts=>0+$fixture_record->{attempted},
          rawAcquisitions=>0+$raw_acquisitions};
      }
```

Node wrapper's exact named exception becomes:

```javascript
['foreign-parent','foreign-physical','foreign-file','foreign-directory','hidden-open-undefined','foreign-fd-alias'].includes(mode)
```

Existing raw/owned/definite/fixture1 and consumer/stage/helper0 tuple plus pre-rescue
identity witness remains unchanged. All other old profiles retain fixture0.
Foreign-FD case has C2/H0/fourports/onefixture-original/private0sealed/attempted/
closed/burninvalid1uncertain0disposal1. Actualsame-reference expression is false;
actualFD equal and sharedB IOpointer/actualphysicalidentity checked independently.
No sourcebranch/checker modification is needed: uncertainty0 and untouched
source seal logic establish proven known alias rather than shape failure.

Insert exact two oracles before STAGED_DIRECTORY_FH_CORE_KEYS:

```javascript
test('staged custody live fd alias rejects distinct GV without a second owner',()=>{
  const r=stagedCustody('foreign-fd-alias');
  assert.equal(r.refused,true);assert.equal(r.hold,null);
  assert.deepEqual(r.fdAliasBeforeConsumer,{nativeShapes:true,distinctGv:true,sameIo:true,
    sameFd:true,sameRef:false,rawAcquisitions:1});
  assert.deepEqual(r.fdAliasBeforeRescue,{bothLive:true,distinctGv:true,sameFd:true});
  assert.deepEqual(r.fdAliasAfterRescue,{bothUndefined:true,originalAttempts:1,rawAcquisitions:1});
  assert.deepEqual(r.calls,{clock:2,lstat:1,sysopen:1});assert.equal(r.events.length,4);
  assert.deepEqual([r.helpers,r.rawAcquisitions,r.ownedCount,r.definitelyClosed,
    r.fixtureClosed,r.consumerClosed,r.stageClosed,r.helperClosed],[0,1,1,1,1,0,0,0]);
  const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:0,attemptedCount:0,privateClosedCount:0,closedFlags:[]};
  assert.deepEqual(r.sourceAfterFixtureRefusal,burned);
  assert.deepEqual(r.sourceAfterFixtureRepeats,burned);
  assert.equal(r.repeatEffectDelta,0);
});
test('staged custody live fd alias rejects an already sealed original reference',()=>{
  const r=stagedCustody('staged-reference-alias');
  assert.equal(r.refused,true);assert.equal(r.hold,null);
  assert.deepEqual(r.stagedAliasNomination,{sameRef:true,sameFd:true,newRawAcquisition:false});
  assert.deepEqual(r.calls,{binmode:8,clock:10,close:9,closedir:1,fcntl:5,fileno:26,
    fork:1,lstat:4,opendir:1,pipe:4,read:4,readdir:16,ready:2,stat:2,sysopen:2,wait:4});
  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),99);
  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],[1,10,1,9,0]);
  const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:1,attemptedCount:1,privateClosedCount:1,closedFlags:[1]};
  assert.deepEqual(r.sourceAfterStagedAliasRefusal,burned);
  assert.deepEqual(r.sourceAfterStagedAliasRepeats,burned);
  assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role))
    .map(e=>e.role),['d0']);
  assert.equal(r.repeatEffectDelta,0);
});
```

Fixed staged alias call vector is independent literal static review:
binmode8 clock10 close9 closedir1 fcntl5 fileno26 fork1 lstat4 opendir1
pipe4 read4 readdir16 ready2 stat2 sysopen2 wait4 =99.
Source private stage count1/attempt1/closed1; helper9/fixture0; no second
obligation. Foreign raw physical obligation1 stays fixture-only, originalclose1
invalidates both GVs. Runtimeconstructor/shape/close facts are still UNPROVEN.

Single exact focus only AFTER BOTH literal+actual C0 reviews, syntax/diff and
fresh all-source/Git/npm/tools/retention/resource/HTTP gates:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody live fd alias ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Full natural terminal and rootpost required. Failure is retained; no fallback
constructor/duplicate close/borrowed source cleanup/fixture-credit relaxation/
nativeeffects are authorized. No prior closed fiveprofile replay or partial
delivery/PR/build/service/DB/nativequalification here.

#### Closed two actual live alias cases, 2026-10-04 11:36 UTC

BOTH literal a246 C0/I0/M0; read-onlyextractor1b5088 exact15fences/rootapply.
Syntax4e7947/diffa25b05 CLOSED0. Actualtest
9fcc940d2917e074deeb7781f02fd3a8b53c0af2a5c8c58e7d9cef1e828815f0,
431981B. BOTH actualdelta reviews C0 reverse exact additions/replacements/
separator to prior734. Source434 unchanged.

ONE prescribed focus489cc3 naturallyCLOSED0/full75tokens2PASS/0FAIL/CANCEL/
SKIP/TODO202.529042ms/no managedsession/NOREPLAY.
Rootpref005ee11:36:31/posta34fdb11:36:32 same2093/69961744B/physical
efa9de3284952d952fa88ec4b8177bcde2603c75d0f479c5ad918222210e91b7;
plana246/test9fcc/source434/spec1f26/npm/tools/absences exact.
Independent boundedgate11:35:37–38 C0 current/originaltwo/backups/journal/
canonical/toolkeypins exact;disk7727188KiBfree97%,memory60%free/throttled0/
no thermal warning; HTTP3080+18789200,3333knownrefused. Prior10:56 full
historical comparison not replayed or retimestamped.

Foreign-FD actual self-witness qualified ordinary constructor facts: original/
distinctgensymGV bothpass exactindependent B cell/GV/IO guards, actualsameRef
false/sharedB IOpointer/equalCOREliveFD/actualphysicalidentity. Sourceprivate
uncertain0/0sealed/0attempted/0closed distinguishes proven FDalias denial
rather than malformed/ref-equal refusal. Both peers remain live through source
refusal/repeats; ONE captured fixture-original COREclose makes BOTH actualfilenos
undefined with strong GVrefs stillheld. raw/owned/definite/fixture1, consumer/
stage/helper0; C2/H0/fourports. No fdopen/dup/dup2/rebind/integerclose/aliasregister/
second-disposer/destructor-credit. This is ordinary sharedIO constructor and
consumer FD-comparison qualification, NOT distinctIO/staleFD/privilegedproof.

Second staged sysopen actually returns existing sealed d0 without acquisition/
registration. C10/H1/exact99vector; 10physicaloriginals=1stage+8pipes+1DIR,
private1attempted/closed; sourceonlyclosesd0 once, helper9/fixture0, burnt
invalid1uncertain0disposal1. Commonactualrepeatszeroeffects forboth profiles.

Closed disjointresume177focusedpasses=prior78+new99, not currentcombinedsuite/
fullmatrix. This cycleadds2; no commit/push/PR/build/native/DB/service/cutover
effect/qualification. All retained worktrees/originalfiles/evidence preserved.
Both ordinary alias requirements now have closed focused evidence; identity6,
unsettled/sharedcleanup, ACL/epoch and original once-only semanticcontrols remain.

#### Next closed cycle: six staged identity tuple and size denials

Root-only tests/source434 unchanged. Six fixed representatives exercise staged
pre/open/post validator paths, not parent/entropy contracts, actual filesystem
drift, or a fields x phases x slots expansion. Only a fresh projected COPY of
actual verified thirteen-field CORE metadata is nominated; physical registry,
backing bytes, private expectations and original tuples remain unchanged.

Append exact names to closed mode inventory:

```perl
identity-dir-pre-shape identity-file-pre-type identity-dir-open-owner identity-file-open-inode identity-dir-post-device identity-file-post-size
```

Insert profile table before healthy grammar construction; all modes retain slot0:

```perl
      my %identity_profiles=(
        'identity-dir-pre-shape'=>['lstat','d0',1,0,0,'shape'],
        'identity-file-pre-type'=>['lstat','f0',1,6,6,'type'],
        'identity-dir-open-owner'=>['stat','d0',1,0,1,'owner'],
        'identity-file-open-inode'=>['stat','f0',1,6,7,'inode'],
        'identity-dir-post-device'=>['stat','d0',2,1,1,'device'],
        'identity-file-post-size'=>['stat','f0',5,13,12,'size'],
      );
      my $identity_profile=$identity_profiles{$mode};
```

Append ONLY this predicate to both complete healthy grammar clauses:

```perl
defined($identity_profile)
```

Before effects, trim the constructed finite healthy grammar at exact selected
operation/role/ordinal, retain fixed0/6/0/6/1/13 helper jobs, then append fixed
0/6/1/7/1/12 source-original closes. No after-refusal queue erasure:

```perl
      if(defined($identity_profile)) {
        my @prefix;my $ordinal=0;
        for my $g(@grammar) {
          push @prefix,$g;
          if($g->[0] eq $identity_profile->[0]&&$g->[1] eq $identity_profile->[1]) {
            ++$ordinal;last if $ordinal==$identity_profile->[2];
          }
        }
        $fail->() unless $ordinal==$identity_profile->[2]&&@jobs==42;
        @grammar=@prefix;splice @jobs,$identity_profile->[3];
        for my $n(1..$identity_profile->[4]) {
          $emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));
        }
      }
```

Insert helper after helpers/repeat_delta declaration, before override block.
Actual stat/lstat and independent physical tuple checks run BEFORE this helper.
It changes a fresh projected copy and exports only primitive metadata witnesses.
Post-helper d0 stat2 requires H1 settled; f0 stat5 requires H13 settled. f0stat2
is post-read, NOT after-helper and cannot substitute for required stat5 case:

```perl
      my %identity_seen;
      my $identity_project=sub {
        my ($op,$p,$physical)=@_;my $copy=$project->($p,$physical);
        return $copy unless defined($identity_profile);
        my $ordinal=++$identity_seen{$op.':'.$p->{role}};
        return $copy unless $op eq $identity_profile->[0]&&$p->{role} eq $identity_profile->[1]
          &&$ordinal==$identity_profile->[2];
        $fail->() if exists($outcomes->{identityNomination});
        $fail->() unless @$physical==13&&@$copy==13;
        if($mode eq 'identity-dir-post-device'||$mode eq 'identity-file-post-size') {
          $fail->() unless !defined($job)&&$helpers==$identity_profile->[3]
            &&task6a_origin_helpers_settled();
        }
        my ($field,$before,$after);
        if($identity_profile->[5] eq 'shape') {
          $field='length';$before=scalar(@$copy);pop @$copy;$after=scalar(@$copy);
        } elsif($identity_profile->[5] eq 'type') {
          $field='type';$before=$copy->[2];
          $fail->() unless Fcntl::S_ISREG($before);
          $copy->[2]=($before&07777)|0040000;$after=$copy->[2];
          $fail->() unless Fcntl::S_ISDIR($after);
        } else {
          my %fields=(owner=>4,inode=>1,device=>0,size=>7);
          my $index=$fields{$identity_profile->[5]};$fail->() unless defined($index);
          $field=$identity_profile->[5];$before=$copy->[$index];
          ++$copy->[$index];$after=$copy->[$index];
        }
        $outcomes->{identityNomination}={op=>''.$op,role=>''.$p->{role},ordinal=>0+$ordinal,
          field=>''.$field,before=>0+$before,after=>0+$after,
          actualTupleLength=>0+scalar(@$physical),returnedTupleLength=>0+scalar(@$copy),
          settledHelpers=>0+$helpers,actualCoreMetadata=>JSON::PP::true};
        return $copy;
      };
```

Replace only the final projected return lines within the uniquely bounded
staged stat and lstat overrides respectively; actual CORE metadata and
same_physical checks remain unchanged:

```perl
return @{$identity_project->('stat',$o->{path},\@s)};
return @{$identity_project->('lstat',$p,\@s)};
```

After initial hold outcome and canonical refusal inspect private state:

```perl
          if(defined($identity_profile)) {
            $fail->() unless $refused&&exists($outcomes->{identityNomination});
            $outcomes->{sourceAfterIdentityRefusal}=test_observe_staged_custody();
          }
```

After existing actual zero-effect repeats observe same private burn:

```perl
          if(defined($identity_profile)) {
            $outcomes->{sourceAfterIdentityRepeats}=test_observe_staged_custody();
          }
```

Independent source-derived literal prefix table:
dirpre tuple13→12 C2/H0/stage0/owned0/ports3;
filepre REG→DIR C50/H6/stage6/owned60/ports588;
diropen UID0→1 C3/H0/stage1/owned1/ports12;
fileopen inode+1 C50/H6/stage7/owned61/ports597;
dirpostH1 device+1 C9/H1/stage1/owned10/ports95;
filepostH13 size+1 C125/H13/stage12/owned129/ports1400.
Last full vector110binmode/125clock/116close/13closedir/61fcntl/345fileno/
13fork/50lstat/13opendir/52pipe/66read/300readdir/26ready/7seek/39stat/
12sysopen/52wait. Prefix derives from acquisition689/C68 +leadingdir594/C48
+firstf0check11/C3 +H13helper92/C6 +posthelperfileno/stat2 +12closes.

Insert exact Node assertions before STAGED_DIRECTORY_FH_CORE_KEYS:

```javascript
const STAGED_IDENTITY_DENIALS=[
  ['identity-dir-pre-shape','lstat','d0',1,'length',2,0,0,0,3],
  ['identity-file-pre-type','lstat','f0',1,'type',50,6,6,60,588],
  ['identity-dir-open-owner','stat','d0',1,'owner',3,0,1,1,12],
  ['identity-file-open-inode','stat','f0',1,'inode',50,6,7,61,597],
  ['identity-dir-post-device','stat','d0',2,'device',9,1,1,10,95],
  ['identity-file-post-size','stat','f0',5,'size',125,13,12,129,1400],
];
for(const [mode,op,role,ordinal,field,clock,helpers,stage,owned,ports] of STAGED_IDENTITY_DENIALS)
  test('staged custody identity refuses projected drift '+mode,()=>{
    const r=stagedCustody(mode);assert.equal(r.refused,true);assert.equal(r.hold,null);
    const n=r.identityNomination;
    assert.deepEqual(Object.keys(n).sort(),['op','role','ordinal','field','before','after',
      'actualTupleLength','returnedTupleLength','settledHelpers','actualCoreMetadata'].sort());
    assert.deepEqual([n.op,n.role,n.ordinal,n.field,n.actualTupleLength,n.settledHelpers,
      n.actualCoreMetadata],[op,role,ordinal,field,13,helpers,true]);
    assert.equal(n.returnedTupleLength,field==='length'?12:13);
    if(field==='length') assert.deepEqual([n.before,n.after],[13,12]);
    else if(field==='type') assert.deepEqual([n.before&0o170000,n.after&0o170000],[0o100000,0o40000]);
    else {
      assert.ok(Number.isSafeInteger(n.before)&&Number.isSafeInteger(n.after));
      assert.equal(n.after,n.before+1);if(field==='owner') assert.deepEqual([n.before,n.after],[0,1]);
    }
    assert.equal(r.calls.clock,clock);
    assert.equal(Object.values(r.calls).reduce((v,n)=>v+n,0),ports);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],
      [helpers,owned,stage,helpers*9,0]);
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:stage,attemptedCount:stage,privateClosedCount:stage,
      closedFlags:Array(stage).fill(1)};
    assert.deepEqual(r.sourceAfterIdentityRefusal,burned);
    assert.deepEqual(r.sourceAfterIdentityRepeats,burned);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role))
      .map(e=>e.role),STAGED_CLOSE_ROLES.slice(0,stage));
    assert.equal(r.repeatEffectDelta,0);
    if(field==='size') assert.deepEqual(r.calls,{binmode:110,clock:125,close:116,closedir:13,
      fcntl:61,fileno:345,fork:13,lstat:50,opendir:13,pipe:52,read:66,readdir:300,ready:26,
      seek:7,stat:39,sysopen:12,wait:52});
  });
```

Actual canonical refusal yields burnedinvalid1uncertain0disposal1; private
sealed/attempted/closed count equals selected stage count, physical originals
all closed, fixture0 and actual repeats0. No DTO can stand in for metadata.

Single exact focus after BOTH literal+actual C0 reviews, syntax/diff and fresh
all-source/Git/npm/tools/retention/resource/HTTP checks:

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody identity ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

Read natural full terminal and rootpost. Setup/compile/queue faults notsemanticRED;
no current combinedsuite/fullmatrix/delivery/native/protectedorigin/cutover claim.

#### Closed six staged identity cases, 2026-10-04 11:49 UTC

BOTH literal9929 C0/I0/M0; extractor4fd791/rootapply exacttenfences.
Syntax787623/diff7b5945 CLOSED0. Actualtest
9b9af5603ab400b382b933d3edd7fe60778d4e06a77b19777b214c0b027bb809,
437882B; BOTH actualdelta reviews C0 reverse exact changes/separator to9fcc.
Source434 unchanged.

ONE prescribed focusbefb7e naturallyCLOSED0/full163tokens6PASS/0FAIL/CANCEL/
SKIP/TODO515.462333ms/no managedsession/NOREPLAY.
Rootpre2ad48211:49:38/post6e1db211:49:39 same2093/69979284B/physical
8f7a495c675835a36fa44493880b3cb8a6bb04489c2982b5c7628355d97a7f37;
plan9929/test9b9/source434/spec1f26/npm/tools/absences exact.
Independent boundedgate11:48:39–40C0 current/originaltwo/backups/journal/
canonical/toolkeypins matched;7728924KiBfree97%,memory60%free/throttled0/
no thermal warning; HTTP3080+18789200,3333knownrefused. Prior10:56fullretained
comparison stays prior, not repeated/retimestamped.

Actual CORE+physical metadata remains valid; only fresh projected copies change.
Six exact pre/open/post role/ordinal denials matched fixed prefixes and actual
private cleanup; postH1d0stat2 andpostH13f0stat5 require clearedjob+settledhelpers.
Filepostfullvector1400 matched. All physical originals definitelyclosed,
fixture0/private attempted+closed selected0/6/1/7/1/12, burnedinvalid1uncertain0/
disposal1, actual repeatszero. Copied-response denial is not filesystemdrift,
native/protected or credential proof.

Closed disjointresume183focusedpasses=prior78+new105; this latest continuation
56newcases. NOT currentcombinedsuite/fullmatrix. No commit/push/PR/build/native/
DB/service/cutovereffects; allretained/originalfiles/evidence preserved.
Remaining ordinary distinct requirements: sharedhelper throwingcleanup/unsettled
state and actual badstate acceptancecontrol; ACL/epochcontrol; original captured
primitive-call-once control. Optional isolated disposal-started/attempted guard
removal is NOT silently claimed by primitive-call control.

#### Next closed cycle: shared unsettled helper baseline and coherent guard mutant

UNEXECUTED exact source-derived recipe. Root sole writer; no disk production source
change. Current test9b9/source434/plan293a are predecessor pins. No new fullmatrix claim.

After actual healthy hold C237/H24, invoke actual captor H25 with its real pipe and
census acquisitions. Its first parent in-r close throws AFTER real CORE closure;
cleanup in-w close also throws AFTER real CORE closure. Remaining six pipes close
normally. Immediate exact-PID/raw0 synthetic reap drains the helper without clock,
selector/readiness/read/signal effects. Physical closure cannot settle the source
registry: before24/24/0 clear; after25/24/1 burned. Preserve source canonical refusal
through catch/drain/rethrow. No private reset, fake success or fixture rescue.

Baseline actual recheck refuses before its entry clock. Vector2647/C240/H25/237
originals includes all12stage+225helper definitely closed; private12closed/burned.
Memory-only mutant removes solely the helpers_settled clause from the uniquely
anchored staged_require_live prefix, keeping hold-entry and every other guard.
Actual recheck returns while registry43/42/1 remains burned. Vector4521/C410/H43/
399originals includes12stage+387helper, all closed by subsequent actual release.
Observe bad registry before release; release is cleanup-only, not badstate oracle.
Node requires actual returned diagnostic and catches forbidden acceptance, not
compile/queue/setup failure. Both actual repeat misuse paths burn with zero effects.
No native/protectedowner/credential/realPID/production authority qualification.

The following readonly extractor is the complete executable candidate recipe.
It pins the prior test and requires unique complete-line ordered anchors for13
hunks. It only emits a patch; root applies that literal using apply_patch after
BOTH independent literal C0/I0/M0 reviews. JSON-escaped snippets are exact bytes.

```javascript
import fs from 'node:fs';import crypto from 'node:crypto';
const root="/Users/setrox/ai/setrox/.worktrees/setfarm-staged-custody-capsule-20261004-v1";
const test=fs.readFileSync(root+'/scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js','utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
if(hash(test)!=='9b9af5603ab400b382b933d3edd7fe60778d4e06a77b19777b214c0b027bb809')throw Error('test pin');
const b={
  "specialGrammar": "      my $unsettled_grammar=sub {\n        $fail->() unless $h==24&&$stage_count==12;\n        my $prefix='h'.(++$h);\n        push @jobs,{prefix=>$prefix,path=>'/',stageCount=>12,cleanup=>1};\n        $emit->('clock',$prefix) for 1..2;\n        $emit->('pipe',$prefix.'.'.$_) for qw(in out err setup);\n        for my $name(qw(in-r in-w out-r out-w err-r err-w setup-r setup-w)) {\n          $emit->('binmode',$prefix.'.'.$name);$emit->('fileno',$prefix.'.'.$name);\n        }\n        $emit->('fcntl',$prefix.'.setup-w');\n        $emit->('opendir',$prefix.'.census');$emit->('fileno',$prefix.'.census');\n        $emit->('readdir',$prefix.'.census') for 1..27;\n        $emit->('closedir',$prefix.'.census');$emit->('fileno',$prefix.'.setup-w');\n        $emit->('clock',$prefix);$emit->('fork',$prefix);\n        $emit->('close',$prefix.'.in-r');\n        for my $name(qw(in-r in-w out-r out-w err-r err-w setup-r setup-w)) {\n          $emit->('fileno',$prefix.'.'.$name);\n          $emit->('close',$prefix.'.'.$name) unless $name eq 'in-r';\n        }\n        $emit->('wait',$prefix);\n      };",
  "prefix": "      if($mode eq 'shared-unsettled-baseline') {\n        my @prefix;my $found=0;\n        for my $g(@grammar) {\n          push @prefix,$g;\n          if($g->[0] eq 'wait'&&$g->[1] eq 'h25') {$found=1;last;}\n        }\n        $fail->() unless $found&&@jobs==43;\n        @grammar=@prefix;splice @jobs,25;\n        $emit->('close',$_) for qw(d0 d1 d2 d3 d4 d5 f0 f1 f2 f3 f4 f5);\n      }",
  "enter": "        if($job->{cleanup}) {\n          $fail->() unless $mode=~/\\Ashared-unsettled-(?:baseline|mutant)\\z/\n            &&$job->{prefix} eq 'h25'&&$job->{path} eq '/'&&$job->{stageCount}==12;\n          @wait=([424242,0]);@ready=();%reads=();\n        }",
  "close": "          if($mode=~/\\Ashared-unsettled-(?:baseline|mutant)\\z/\n              &&($o->{role} eq 'h25.in-r'||$o->{role} eq 'h25.in-w')) {\n            $fail->() unless defined($job)&&$job->{cleanup}&&$closed&&$o->{closed}\n              &&$o->{attempted}&&!defined(CORE::fileno($o->{fh}));\n            $outcomes->{sharedCloseNominations}//=[];\n            push @{$outcomes->{sharedCloseNominations}},{role=>''.$o->{role},\n              physicallyClosedBeforeThrow=>JSON::PP::true};\n            die \"TEST_STAGED_SHARED_CLOSE_THROW\\n\";\n          }",
  "capture": "            if($mode=~/\\Ashared-unsettled-(?:baseline|mutant)\\z/&&$helpers==25) {\n              $fail->() unless defined($job)&&$job->{cleanup}&&$job->{prefix} eq 'h25'\n                &&!$ok&&!defined($value)&&$error eq \"TASK6A_ORIGIN_BOOTSTRAP_REFUSED\\n\";\n              $outcomes->{sharedCaptorOutcome}={returned=>JSON::PP::false,\n                canonicalRefusal=>JSON::PP::true};\n            } elsif(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&$helpers==7) {",
  "driver": "          } elsif($mode=~/\\Ashared-unsettled-(?:baseline|mutant)\\z/) {\n            $fail->() if $refused;\n            $outcomes->{sharedBeforeFailure}=test_observe_staged_helpers();\n            my $extra=eval {task6a_origin_capture('/bin/ls',['-lde','/'],2,4096)};\n            my $extra_error=$@;$check->();\n            $fail->() unless !defined($extra)&&$extra_error eq \"TASK6A_ORIGIN_BOOTSTRAP_REFUSED\\n\"\n              &&!defined($job)&&$helpers==25;\n            $outcomes->{sharedAfterFailure}=test_observe_staged_helpers();\n            $outcomes->{sharedStageAfterFailure}=test_observe_staged_custody();\n            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();\n            my $denied=!defined($value)&&$error eq \"TASK6A_ORIGIN_BOOTSTRAP_REFUSED\\n\";\n            $fail->() unless $denied||(!length($error)&&ref($value) eq 'HASH');\n            $outcomes->{recheck}=$value;\n            $outcomes->{recheckRefused}=$denied?JSON::PP::true:JSON::PP::false;\n            $outcomes->{sharedAfterRecheck}=test_observe_staged_helpers();\n            $outcomes->{sharedStageAfterRecheck}=test_observe_staged_custody();\n            if(!$denied) {$outcomes->{release}=$operations{release}->();$check->();}\n            $outcomes->{sharedAfterCleanup}=test_observe_staged_custody();",
  "observer": "  sub test_observe_staged_helpers {\n    task6a_origin_refuse() unless @_==0;\n    my $settled=scalar(grep {$_->{settled}} @helper_ledger);\n    return {burned=>$helper_lifecycle_burned?JSON::PP::true:JSON::PP::false,\n      registered=>0+scalar(@helper_ledger),settled=>0+$settled,\n      unsettled=>0+scalar(@helper_ledger)-$settled,\n      helpersSettled=>task6a_origin_helpers_settled(),\n      physicalOwnsLedgers=>$physical_owns_ledgers?JSON::PP::true:JSON::PP::false};\n  }",
  "tests": "\nfunction stagedSharedRegistry(registered,settled,burned) {\n  return {burned,registered,settled,unsettled:registered-settled,\n    helpersSettled:!burned&&registered===settled,physicalOwnsLedgers:false};\n}\nfunction stagedSharedState(phase,invalid,closed) {\n  return {phase,invalid,uncertain:0,disposalStarted:closed?1:0,sealedClosureCount:12,\n    attemptedCount:closed?12:0,privateClosedCount:closed?12:0,closedFlags:Array(12).fill(closed?1:0)};\n}\nfunction assertStagedSharedEvidence(r,mutant) {\n  assert.equal(r.refused,false);\n  assert.deepEqual(r.sharedBeforeFailure,stagedSharedRegistry(24,24,false));\n  assert.deepEqual(r.sharedAfterFailure,stagedSharedRegistry(25,24,true));\n  assert.deepEqual(r.sharedCaptorOutcome,{returned:false,canonicalRefusal:true});\n  assert.deepEqual(r.sharedCloseNominations,[\n    {role:'h25.in-r',physicallyClosedBeforeThrow:true},\n    {role:'h25.in-w',physicallyClosedBeforeThrow:true}]);\n  assert.deepEqual(r.sharedStageAfterFailure,stagedSharedState('active',0,false));\n  assert.deepEqual(r.sharedAfterRecheck,stagedSharedRegistry(mutant?43:25,mutant?42:24,true));\n  assert.deepEqual(r.sharedStageAfterRecheck,stagedSharedState(mutant?'active':'burned',mutant?0:1,!mutant));\n  assert.deepEqual(r.sharedAfterCleanup,stagedSharedState(mutant?'released':'burned',mutant?0:1,true));\n  assert.deepEqual(r.sharedAfterRepeats,stagedSharedState('burned',1,true));\n  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],\n    mutant?[43,399,12,387,0]:[25,237,12,225,0]);\n  assert.deepEqual(r.calls,mutant?\n    {binmode:350,clock:410,close:356,closedir:43,fcntl:91,fileno:1128,fork:43,lstat:132,\n      opendir:43,pipe:172,read:228,readdir:1110,ready:84,seek:30,stat:120,sysopen:12,wait:169}:\n    {binmode:206,clock:240,close:212,closedir:25,fcntl:73,fileno:654,fork:25,lstat:84,\n      opendir:25,pipe:100,read:132,readdir:624,ready:48,seek:18,stat:72,sysopen:12,wait:97});\n  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),mutant?4521:2647);\n}\ntest('staged custody shared unsettled refuses a physically drained burned helper',()=>{\n  const r=stagedCustody('shared-unsettled-baseline');assertStagedSharedEvidence(r,false);\n  assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);\n});\ntest('staged custody shared unsettled detects coherent settlement-guard removal',()=>{\n  const old=String.raw`my $staged_require_live=sub {\n    task6a_origin_refuse() if $staged_invalid||$staged_uncertain||$staged_disposal_started;\n    $staged_vector->(\\@staged_directories);$staged_vector->(\\@staged_files);\n    $staged_vector->(\\@staged_originals);$staged_vector->(\\@staged_record_checks);\n    task6a_origin_refuse() unless task6a_origin_helpers_settled();\n    $staged_check_admission->();`;\n  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),old,\n    old.replace('    task6a_origin_refuse() unless task6a_origin_helpers_settled();\\n',''));\n  const r=stagedCustody('shared-unsettled-mutant',0,{sourceOverride:source});\n  assertStagedSharedEvidence(r,true);\n  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',\n    productionAuthority:false,fileCount:6,directoryCount:6};\n  assert.deepEqual(r.recheck,diagnostic);\n  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});\n  assert.throws(()=>assert.equal(r.recheckRefused,true),{code:'ERR_ASSERTION'});\n});\n"
};
let patch='*** Begin Patch\n*** Update File: '+root+'/scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js\n';let last=-1;
function hunk(old,next){if(test.split(old).length!==2||!test.includes('\n'+old+'\n'))throw Error('unique complete:'+old);const p=test.indexOf(old);if(p<=last)throw Error('order');last=p;patch+='@@\n-'+old.replaceAll('\n','\n-')+'\n+'+next.replaceAll('\n','\n+')+'\n';}
function line(prefix){const a=test.split('\n').filter(x=>x.startsWith(prefix));if(a.length!==1)throw Error('line count');return a[0];}
const modes=line('      my %modes=map {$_=>1} qw(healthy absent arity premature-recheck');
hunk(modes,modes.slice(0,-2)+' shared-unsettled-baseline shared-unsettled-mutant);');
const dir='      my $dir_grammar=sub {';
hunk(dir,b.specialGrammar+'\n'+dir);
const full=line("      elsif($mode eq 'healthy'||$mode=~/\\A(?:open|close)-/");
hunk(full,full.slice(0,-3)+"||$mode=~/\\Ashared-unsettled-(?:baseline|mutant)\\z/) {");
const again=line("        if($mode eq 'healthy'||$mode=~/\\Aclose-/");
hunk(again,again.slice(0,-3)+"||$mode=~/\\Ashared-unsettled-(?:baseline|mutant)\\z/) {");
const epoch="          $epoch_grammar->();$emit->('clock','stage');$emit->('clock','stage');";
hunk(epoch,"          $epoch_grammar->();$emit->('clock','stage');\n          $unsettled_grammar->() if $mode=~/\\Ashared-unsettled-(?:baseline|mutant)\\z/;\n          $emit->('clock','stage');");
const boundary='      if(exists($boundary{$mode})) {\n        my ($target,$helpers,$stage)=@{$boundary{$mode}};';
hunk(boundary,b.prefix+'\n'+boundary);
const enter="        %reads=('out-r'=>[1,0],'err-r'=>[0],'setup-r'=>[0]);";
hunk(enter,enter+'\n'+b.enter);
const close='          my $closed=$dispose->($o,0);';
hunk(close,close+'\n'+b.close);
const capture="            if(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&$helpers==7) {";
const capturePair=capture+"\n              $fail->() unless defined($job)&&$job->{prefix} eq 'h7'&&$job->{path} eq '/';";
hunk(capturePair,b.capture+"\n              $fail->() unless defined($job)&&$job->{prefix} eq 'h7'&&$job->{path} eq '/';");
const active="          } elsif($mode=~/\\Aactive-/) {";
hunk(active,b.driver+'\n'+active);
const repeat='          $repeat_delta=scalar(@events)-$before;$fail->() if $repeat_delta;';
hunk(repeat,repeat+"\n          if($mode=~/\\Ashared-unsettled-(?:baseline|mutant)\\z/) {\n            $outcomes->{sharedAfterRepeats}=test_observe_staged_custody();\n          }");
const observer='  sub test_tie_staged_partial {';
hunk(observer,b.observer+'\n'+observer);
const testAnchor="const STAGED_DIRECTORY_FH_CORE_KEYS=['fileOpen','directoryOpen','directoryFhOpen','metadata','fileClose','directoryClose'];";
hunk(testAnchor,b.tests.trim()+'\n\n'+testAnchor);
patch+='*** End Patch\n';
console.log(JSON.stringify({patch,sha256:hash(patch),hunks:13,oldTest:hash(test)}));
```

After exact rootapply: syntax/diff, BOTH actualdelta C0 reviews, fresh all-source/
Git/npm/tools/retention/resource/HTTP prechecks, then ONE focus below. Read natural
full terminal and exact postchecks before any completion assertion. No replay.

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody shared unsettled ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

#### Closed shared unsettled helper pair, 2026-10-04 12:11 UTC

BOTH corrected literal1a0 C0/I0/M0 and BOTH actualdelta C0 exactreverse13hunks
to9b9. Readonlyextract71c805 patch74f8/rootapply once; syntax/diffd00d10 CLOSED0.
Preliminary readonlyextractc4681d stopped on substringcount before testmutation/
effects; complete-line anchor corrected, no semanticRED/replay claimed.
Actualtest92d47e7dc3e01cb5564029996560bd51ef4b3cf7d0ac21eff9bdec1c38522a57,
446048B/source434 unchanged.

ONE exactfocusb1e54c naturallyCLOSED0/full75tokens2PASS/0FAIL/CANCEL/SKIP/TODO
421.343ms/no managedsession/NOREPLAY. Rootpre9f7b4e12:11:48.714/
post04af6812:11:49.535 same2093/70003366B/physical
40e7aefe205a8c0349d8e3d23b5b33b1dadf308500317f513188d2f933747aa1.
Exact plan1a0/test92d/source434/spec1f26/npm/tools/absences matched.

Independent bounded appliedgate12:11:10–11 C0 pins/originaltwo/backups/journal/
canonical/BigIntSIPPerl/npm/toolkeys matched;7707828KiBfree97%,memory60%/
throttled0/no recordedthermalwarning. HTTP3080+18789200;3333separateexit7 known
refusal, not successfulHTTP. Prior10:56fullretainedcomparison remains historical.

Actual paired postphysicalclose throws preserved canonical captor refusal and
finite physical queue drain. Registry25/24/1 stayed burned despite9helper
originals closed. Baseline actualrecheck refused before entryclock C241;
C240/H25/2647/237orig, private12attempt+closed/burn/repeats0.
Only uniquely anchored stagedhelpers_settled clause removed in memory:
actualpositive recheck reached Node with registry43/42/1 stillburned, thenactual
release closed12; C410/H43/4521/399orig/private12/released→burned/repeats0.
Forbiddenacceptance caught independent Nodeexpectedrefusalassertion; notqueuekill,
cleanup-onlyrelease DTO, fixture rescue or physicalclosure-as-settlement credit.
No sourcefix/native/protectedowner/production/fullmatrix authority claimed.

Closed disjointresume185focusedpasses=prior78+new107; latest continuation58newcases.
Remaining finite ordinary matrix: ACL/epochcontrol and capturedoriginal primitive
call-oncecontrol; optional isolated disposal/attemptguard removal NOTclaimed.

#### Next closed cycle: actual epoch ACL plus row baseline and coherent predicate mutant

UNEXECUTED exact recipe. Root solewriter; disk source434 unchanged. Test92d is
predecessor. Actual healthyhold C237/H24; only first genuine recheck helperH25
at '/' gets41B row "-r--r--r--+ 1 root wheel 16 Jan 1 2026 /\n" in its actual
stdoutpipe. Witness actual COREread41 andEOF0, unchanged captor rawstatus0/
stderr empty/reapedtrue; record helper_leave cleared+settled before ACLvalidator.

Baseline actualACLpredicate refuses before directorypoststat: C245/H25/2671ports/
237originals=12stage+225helper, all closed; private12closed/burned/repeats0.
Memory-only uniquely anchored ACL regexp permits '+' only; no epochguard/captor/
rawstatus/path/fullrow/native/digest change. Actualpositive recheck diagnostic
reaches Node before naturalrelease; unchanged healthy C407/H42/4448/390originals.
Nodeexpectedrefusal oracle catches semanticbadrow acceptance after valid cleanup.
Released→burned on repeats is recorded honestly. Not actualfilesystemACL, native,
protectedowner, credentialdrop or production authority qualification.

Complete readonly candidate extractor below emits11ordered unique complete-line
hunks after predecessorhash check. Root applies exactoutput only after BOTH
independent literal C0/I0/M0; then syntax/diff, BOTHactualdelta reviews andfresh
allsource/Git/npm/tools/retention/resources/HTTP checks precede ONEexactfocus.
No sharedpair replay; no currentcombinedsuite/fullmatrix/delivery claims.

```javascript
import fs from 'node:fs';import crypto from 'node:crypto';
const root="/Users/setrox/ai/setrox/.worktrees/setfarm-staged-custody-capsule-20261004-v1";
const test=fs.readFileSync(root+'/scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js','utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
if(hash(test)!=='92d47e7dc3e01cb5564029996560bd51ef4b3cf7d0ac21eff9bdec1c38522a57')throw Error('test pin');
const b={
  "prefix": "      if($mode eq 'epoch-acl-baseline') {\n        my @prefix;my $end=0;\n        for my $g(@grammar) {\n          push @prefix,$g;\n          last if $g->[0] eq 'fileno'&&$g->[1] eq 'h25.setup-w'&&++$end==3;\n        }\n        $fail->() unless $end==3&&@jobs==42;\n        @grammar=@prefix;splice @jobs,25;\n        $emit->('close',$_) for qw(d0 d1 d2 d3 d4 d5 f0 f1 f2 f3 f4 f5);\n      }",
  "pipe": "            if($mode=~/\\Aepoch-acl-(?:baseline|mutant)\\z/&&$job->{prefix} eq 'h25') {\n              $fail->() unless $job->{path} eq '/'&&length($row)==41\n                &&!exists($outcomes->{epochAclPipeRow});\n              $outcomes->{epochAclPipeRow}={bytes=>0+length($row),row=>''.$row};\n            }",
  "read": "          if($mode=~/\\Aepoch-acl-(?:baseline|mutant)\\z/&&defined($job)\n              &&$job->{prefix} eq 'h25'&&$o->{role} eq 'h25.out-r') {\n            push @{$outcomes->{epochAclActualReads}}, {bytes=>0+$n,body=>''.$$buffer};\n          }",
  "capture": "            if($mode=~/\\Aepoch-acl-(?:baseline|mutant)\\z/&&$helpers==25) {\n              $fail->() unless $ok&&!length($error)&&defined($job)&&$job->{prefix} eq 'h25'\n                &&$job->{path} eq '/'&&ref($value) eq 'HASH'\n                &&$value->{out} eq \"-r--r--r--+ 1 root wheel 16 Jan 1 2026 /\\n\"\n                &&$value->{err} eq ''&&$value->{status}==0&&$value->{pid}==424242\n                &&JSON::PP::is_bool($value->{reaped})&&$value->{reaped};\n              $outcomes->{epochAclCaptorOutcome}={returned=>JSON::PP::true,\n                out=>''.$value->{out},err=>''.$value->{err},status=>0+$value->{status},\n                reaped=>$value->{reaped}};\n            }",
  "drain": "            if($mode=~/\\Aepoch-acl-(?:baseline|mutant)\\z/&&$helpers==25) {\n              $outcomes->{epochAclDrain}={jobCleared=>!defined($job)?JSON::PP::true:JSON::PP::false,\n                helpersSettled=>task6a_origin_helpers_settled()};\n            }",
  "driver": "          } elsif($mode=~/\\Aepoch-acl-(?:baseline|mutant)\\z/) {\n            $fail->() if $refused;\n            $outcomes->{epochAclBeforeRecheck}=test_observe_staged_custody();\n            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();\n            my $denied=!defined($value)&&$error eq \"TASK6A_ORIGIN_BOOTSTRAP_REFUSED\\n\";\n            $fail->() unless $denied||(!length($error)&&ref($value) eq 'HASH');\n            $outcomes->{recheck}=$value;\n            $outcomes->{recheckRefused}=$denied?JSON::PP::true:JSON::PP::false;\n            $outcomes->{epochAclAfterRecheck}=test_observe_staged_custody();\n            if(!$denied) {$outcomes->{release}=$operations{release}->();$check->();}\n            $outcomes->{epochAclAfterCleanup}=test_observe_staged_custody();",
  "tests": "\nfunction assertStagedEpochAclEvidence(r,mutant) {\n  const row=\"-r--r--r--+ 1 root wheel 16 Jan 1 2026 /\\n\";\n  assert.equal(r.refused,false);\n  assert.deepEqual(r.epochAclPipeRow,{bytes:41,row});\n  assert.deepEqual(r.epochAclActualReads,[{bytes:41,body:row},{bytes:0,body:''}]);\n  assert.deepEqual(r.epochAclCaptorOutcome,{returned:true,out:row,err:'',status:0,reaped:true});\n  assert.deepEqual(r.epochAclDrain,{jobCleared:true,helpersSettled:true});\n  assert.deepEqual(r.epochAclBeforeRecheck,stagedSharedState('active',0,false));\n  assert.deepEqual(r.epochAclAfterRecheck,stagedSharedState(mutant?'active':'burned',mutant?0:1,!mutant));\n  assert.deepEqual(r.epochAclAfterCleanup,stagedSharedState(mutant?'released':'burned',mutant?0:1,true));\n  assert.deepEqual(r.epochAclAfterRepeats,stagedSharedState('burned',1,true));\n  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],\n    mutant?[42,390,12,378,0]:[25,237,12,225,0]);\n  assert.deepEqual(r.calls,mutant?STAGED_CLOSE_CALLS:\n    {binmode:206,clock:245,close:212,closedir:25,fcntl:73,fileno:662,fork:25,lstat:85,\n      opendir:25,pipe:100,read:136,readdir:624,ready:50,seek:18,stat:73,sysopen:12,wait:100});\n  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),mutant?4448:2671);\n}\ntest('staged custody epoch ACL rejects actual captured plus row during recheck',()=>{\n  const r=stagedCustody('epoch-acl-baseline');assertStagedEpochAclEvidence(r,false);\n  assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);\n});\ntest('staged custody epoch ACL detects coherent plus-accepting predicate mutant',()=>{\n  const old=String.raw`    task6a_origin_refuse() unless $r->{out} =~ /\\A[d-][rwxStTs-]{9}\\@?[ ]+`;\n  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),old,\n    old.replace(String.raw`\\@?`,String.raw`[\\@+]?`));\n  const r=stagedCustody('epoch-acl-mutant',0,{sourceOverride:source});\n  assertStagedEpochAclEvidence(r,true);\n  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',\n    productionAuthority:false,fileCount:6,directoryCount:6};\n  assert.deepEqual(r.recheck,diagnostic);\n  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});\n  assert.throws(()=>assert.equal(r.recheckRefused,true),{code:'ERR_ASSERTION'});\n});\n"
};
let patch='*** Begin Patch\n*** Update File: '+root+'/scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js\n';let last=-1,count=0;
function hunk(old,next){if(test.split(old).length!==2||!test.includes('\n'+old+'\n'))throw Error('unique complete:'+old);const p=test.indexOf(old);if(p<=last)throw Error('order');last=p;++count;patch+='@@\n-'+old.replaceAll('\n','\n-')+'\n+'+next.replaceAll('\n','\n+')+'\n';}
function line(prefix){const a=test.split('\n').filter(x=>x.startsWith(prefix));if(a.length!==1)throw Error('line count');return a[0];}
const modes=line('      my %modes=map {$_=>1} qw(healthy absent arity premature-recheck');
hunk(modes,modes.slice(0,-2)+' epoch-acl-baseline epoch-acl-mutant);');
const full=line("      elsif($mode eq 'healthy'||$mode=~/\\A(?:open|close)-/");
hunk(full,full.slice(0,-3)+"||$mode=~/\\Aepoch-acl-(?:baseline|mutant)\\z/) {");
const again=line("        if($mode eq 'healthy'||$mode=~/\\Aclose-/");
hunk(again,again.slice(0,-3)+"||$mode=~/\\Aepoch-acl-(?:baseline|mutant)\\z/) {");
const boundary='      if(exists($boundary{$mode})) {\n        my ($target,$helpers,$stage)=@{$boundary{$mode}};';
hunk(boundary,b.prefix+'\n'+boundary);
const marker="            my $marker=$mode eq 'h7-acl-plus'&&$job->{prefix} eq 'h7'?'+':'';";
hunk(marker,"            my $marker=(($mode eq 'h7-acl-plus'&&$job->{prefix} eq 'h7')\n              ||($mode=~/\\Aepoch-acl-(?:baseline|mutant)\\z/&&$job->{prefix} eq 'h25'))?'+':'';");
const pipe="            $!=0;my $n=CORE::syswrite($b,$row,length($row));";
hunk(pipe,b.pipe+'\n'+pipe);
const read="          if(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&defined($job)\n              &&$job->{prefix} eq 'h7'&&$o->{role} eq 'h7.out-r') {";
hunk(read,b.read+'\n'+read);
const leave='            $helper_leave->();$check->();';
hunk(leave,b.capture+'\n'+leave+'\n'+b.drain);
const active="          } elsif($mode=~/\\Aactive-/) {";
hunk(active,b.driver+'\n'+active);
const repeat='          $repeat_delta=scalar(@events)-$before;$fail->() if $repeat_delta;';
hunk(repeat,repeat+"\n          if($mode=~/\\Aepoch-acl-(?:baseline|mutant)\\z/) {\n            $outcomes->{epochAclAfterRepeats}=test_observe_staged_custody();\n          }");
const testAnchor="const STAGED_DIRECTORY_FH_CORE_KEYS=['fileOpen','directoryOpen','directoryFhOpen','metadata','fileClose','directoryClose'];";
hunk(testAnchor,b.tests.trim()+'\n\n'+testAnchor);
if(count!==11)throw Error('hunks');patch+='*** End Patch\n';
console.log(JSON.stringify({patch,sha256:hash(patch),hunks:count,oldTest:hash(test)}));
```

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody epoch ACL ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

#### Closed actual epoch ACL pair, 2026-10-04 20:28 UTC

BOTH literal5b2d and BOTH actualdelta0824 C0/I0/M0; reverseexact11hunks to92d.
Readonlyextract8d971c patchc051/rootapply once; syntax/diff788597 CLOSED0.
Actualtest0824da1d82a1090e768f7a7be00ecea1c38549cb5ae460d21a74ded438ba0085,
451327B/source434 unchanged.
ONE exactfocus6eb538 naturallyCLOSED0/full75tokens2PASS/0FAIL/CANCEL/SKIP/TODO
442.528833ms/no managedsession/NOREPLAY. Rootpre38834020:28:14.585/
post9dbc8820:28:15.418 same2093/70020691B/physical
f6c6c189f61eb05d0d98b8ed87e7f8b2008e967055062a20161378827d9ed615.
Exact executedplan5b2d/test0824/source434/spec1f26/npm/tools/absences matched.

Wallclockgap12:14→20:27 is NOT continuouswork/preservation proof. Freshroot
2d524d20:27:27 andindependentboundedgate20:27:39–40 C0 pins/originaltwo/backups/
journal/canonical/BigIntSIPPerl/npm/toolkeys matched;7689248KiBfree97%,
memory58%/throttled0/no recordedthermalwarning;HTTP3080+18789200/3333separate
exit7knownrefusal. Prior10:56fullhistoricalcomparison remains prior.

Actual H25stdout COREread41 plus EOF0/captor status0/stderr empty/reapedtrue and
sourcehelpersettled before ACLdecision were independently witnessed. Baseline
C245/H25/2671/237originals/private12closed burned refused; only uniquely anchored
optionalACLmarker changed in memory thenactualpositive recheck reached Node,
C407/H42/4448/390originals/private12closed byactualrelease, released→burned
repeatszero. Nodeexpectedrefusal assertion caught forbidden ACLplusacceptance.
No realfilesystemACL/native/credential/protectedowner/production qualification.

Closed disjointresume187focuspasses=prior78+new109; continuation60newcases.
Remaining finite ordinary matrix: capturedoriginal primitive-call-once2; optional
isolated attempt/disposal-startedguard mutants NOT silently qualified.

#### Next closed cycle: captured original primitive-call-once baseline and mutant

UNEXECUTED finite final ordinary-matrix pair. Root solewriter; currenttest0824/
source434 are predecessor. Baselineactualhealthyhold/recheck/release unchanged:
C407/H42/4448ports/390originals/private12attempt+closed, stagedprimitive12.

Memory-only uniquely anchored original_close capture site choosesfirstd0 CV,
calls actual port twice and returnsfirsttrue result; no attempt/disposalguard
removal or on-disk sourcechange. Predetermined grammar admits exactlyone extra
ADJACENT close:d0 ONLYmutant. Closedoperand branch available ONLYmutant; existing
native cell/GV/IO lookup retainsoriginal and requires definitefirstphysicalclose/
attempt+actualCOREfilenoundef. Require390owned/H42/nojob/jobs, priorclose:d0 and
no prior one-use nomination; consumeallowance BEFOREdelegation. No reacquisition,
FDnumberclose/fdopen/alias/neworiginal/privateattemptreset/fixturecredit.

Second call invokes actualcaptured COREdisposer, not guardeddispose. Capture
actualfalse result/error/fresherrno andfilenoundef; physicalclosecount stays12.
Local __WARN__ hook ONLYaround this one call admits0or1 boundedplain≤256B exact
documented unopened diagnostic+fixed -e location; allotherwarnings stickyfatal.
Installed perldiag1708–1710 andperlvar638–645 read byroot419c6c. Warningemission/
errno value are observations, not mandatorydocs-derivedoracle or autolearning.
Source releaseactuallyreturns12 while primitiveevents13. IndependentNodeonce
oracle specificallyrejects13 AFTERphysicalcleanup; notqueue/compilefailure.
Mutant4449ports differsONLYclose349vs348; C407/H42/390physicaloriginals unchanged.
Repeatreleased→burned honest/zeroeffects. This qualifiescapturedprimitivecall-once
control, NOT isolatedattempt/disposal-startedguard removal, native/protectedowner/
credentials/realPID/production authority/fullmatrix combinedexecution.

Readonly complete extractor emits9ordered unique complete-line hunks afterpin.
BOTH independent literal C0/I0/M0 thenrootapplyexactoutput; syntax/diff+BOTHactual
delta reviews+freshallsource/Git/npm/tools/retention/resources/HTTP precedeONEfocus.
No replayofclosedshared/ACLpairs. Thenordinarymatrixinventory/combinedverification/
fullreview/filemap/delivery remain distinct mandatory steps.

```javascript
import fs from 'node:fs';import crypto from 'node:crypto';
const root="/Users/setrox/ai/setrox/.worktrees/setfarm-staged-custody-capsule-20261004-v1";
const test=fs.readFileSync(root+'/scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js','utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
if(hash(test)!=='0824da1d82a1090e768f7a7be00ecea1c38549cb5ae460d21a74ded438ba0085')throw Error('test pin');
const b={
  "grammar": "      if($mode eq 'once-primitive-mutant') {\n        my @next;my $found=0;\n        for my $g(@grammar) {\n          push @next,$g;\n          if($g->[0] eq 'close'&&$g->[1] eq 'd0') {\n            $fail->() if $found++;push @next,['close','d0'];\n          }\n        }\n        $fail->() unless $found==1&&@jobs==42;@grammar=@next;\n      }",
  "close": "          my $o=$lookup->(\\($_[0]),$mode eq 'once-primitive-mutant'?1:0);\n          if($mode eq 'once-primitive-mutant'&&$o->{closed}) {\n            $fail->() unless $o->{role} eq 'd0'&&$o==$roles{d0}&&!$o->{dirStream}\n              &&$o->{attempted}&&!defined(CORE::fileno($o->{fh}))\n              &&@owned==390&&$helpers==42&&!defined($job)&&!@jobs\n              &&@events&&$events[-1]{op} eq 'close'&&$events[-1]{role} eq 'd0'\n              &&!exists($outcomes->{duplicatePrimitive});\n            $outcomes->{duplicatePrimitive}={role=>'d0',allowanceConsumed=>JSON::PP::true};\n            $take->('close','d0');\n            my @warnings;my ($second,$ok,$error,$errno);\n            {\n              local $SIG{__WARN__}=sub {\n                $fail->() unless @_==1&&!ref($_[0])&&!utf8::is_utf8($_[0])\n                  &&length($_[0])<=256&&@warnings==0\n                  &&$_[0]=~/\\Aclose\\(\\) on unopened filehandle [^\\x00-\\x1f\\x7f]{1,96} at -e line [1-9][0-9]{0,5}\\.\\n\\z/;\n                push @warnings,''.$_[0];\n              };\n              $!=0;$ok=eval {$second=$o->{originalClose}->();1;};\n              $error=$@;$errno=0+$!;\n            }\n            $check->();$fail->() unless $ok&&!length($error)&&!$second\n              &&$o->{attempted}&&$o->{closed}&&!defined(CORE::fileno($o->{fh}));\n            @{$outcomes->{duplicatePrimitive}}{qw(actualCoreReturnedFalse filenoUndefined\n              firstPhysicalClosed warningCount errno)}=(JSON::PP::true,JSON::PP::true,\n              JSON::PP::true,0+scalar(@warnings),$errno);\n            $outcomes->{duplicatePrimitive}{warnings}=\\@warnings;\n            return $second;\n          }",
  "snapshot": "          if($mode=~/\\Aonce-primitive-(?:baseline|mutant)\\z/) {\n            $outcomes->{onceAfterCleanup}=test_observe_staged_custody();\n          }",
  "repeat": "          if($mode=~/\\Aonce-primitive-(?:baseline|mutant)\\z/) {\n            $outcomes->{onceAfterRepeats}=test_observe_staged_custody();\n          }",
  "tests": "\nfunction assertStagedPrimitivePhysical(r,mutant) {\n  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',\n    productionAuthority:false,fileCount:6,directoryCount:6};\n  assert.equal(r.refused,false);assert.deepEqual(r.hold,diagnostic);assert.deepEqual(r.recheck,diagnostic);\n  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});\n  assert.deepEqual(r.calls,{...STAGED_CLOSE_CALLS,close:mutant?349:348});\n  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),mutant?4449:4448);\n  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],[42,390,12,378,0]);\n  assert.deepEqual(r.onceAfterCleanup,stagedSharedState('released',0,true));\n  assert.deepEqual(r.onceAfterRepeats,stagedSharedState('burned',1,true));\n  const roles=r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role);\n  assert.deepEqual(roles,mutant?['d0',...STAGED_CLOSE_ROLES]:STAGED_CLOSE_ROLES);\n  return roles.length;\n}\ntest('staged custody primitive once closes each captured original exactly once',()=>{\n  const r=stagedCustody('once-primitive-baseline');\n  assert.equal(assertStagedPrimitivePhysical(r,false),12);\n  assert.equal(Object.hasOwn(r,'duplicatePrimitive'),false);\n});\ntest('staged custody primitive once detects coherent double-call captured primitive',()=>{\n  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),\n    '    my $original_close=sub {close($fh)};',\n    String.raw`    my $test_double_close=!@staged_originals;\n    my $original_close=sub {\n        my $first=close($fh);close($fh) if $test_double_close;return $first;\n    };`);\n  const r=stagedCustody('once-primitive-mutant',0,{sourceOverride:source});\n  const actual=assertStagedPrimitivePhysical(r,true);\n  const n=r.duplicatePrimitive;\n  assert.deepEqual(Object.keys(n).sort(),['role','allowanceConsumed','actualCoreReturnedFalse',\n    'filenoUndefined','firstPhysicalClosed','warningCount','errno','warnings'].sort());\n  assert.deepEqual([n.role,n.allowanceConsumed,n.actualCoreReturnedFalse,n.filenoUndefined,n.firstPhysicalClosed],\n    ['d0',true,true,true,true]);\n  assert.ok(Number.isSafeInteger(n.errno)&&n.errno>=0);\n  assert.ok(n.warningCount===0||n.warningCount===1);assert.equal(n.warnings.length,n.warningCount);\n  for(const w of n.warnings) {\n    assert.ok(Buffer.byteLength(w)<=256);\n    assert.match(w,/^close\\(\\) on unopened filehandle [^\\x00-\\x1f\\x7f]{1,96} at -e line [1-9][0-9]{0,5}\\.\\n$/);\n  }\n  assert.equal(actual,13);\n  assert.throws(()=>assert.equal(actual,12),{code:'ERR_ASSERTION'});\n});\n"
};
let patch='*** Begin Patch\n*** Update File: '+root+'/scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js\n';let last=-1,count=0;
function hunk(old,next){if(test.split(old).length!==2||!test.includes('\n'+old+'\n'))throw Error('unique complete:'+old);const p=test.indexOf(old);if(p<=last)throw Error('order');last=p;++count;patch+='@@\n-'+old.replaceAll('\n','\n-')+'\n+'+next.replaceAll('\n','\n+')+'\n';}
function line(prefix){const a=test.split('\n').filter(x=>x.startsWith(prefix));if(a.length!==1)throw Error('line count');return a[0];}
const modes=line('      my %modes=map {$_=>1} qw(healthy absent arity premature-recheck');
hunk(modes,modes.slice(0,-2)+' once-primitive-baseline once-primitive-mutant);');
const full=line("      elsif($mode eq 'healthy'||$mode=~/\\A(?:open|close)-/");
hunk(full,full.slice(0,-3)+"||$mode=~/\\Aonce-primitive-(?:baseline|mutant)\\z/) {");
const again=line("        if($mode eq 'healthy'||$mode=~/\\Aclose-/");
hunk(again,again.slice(0,-3)+"||$mode=~/\\Aonce-primitive-(?:baseline|mutant)\\z/) {");
const boundary='      if(exists($boundary{$mode})) {\n        my ($target,$helpers,$stage)=@{$boundary{$mode}};';
hunk(boundary,b.grammar+'\n'+boundary);
const close='          $fail->() unless @_==1;my $o=$lookup->(\\($_[0]),0);\n          $fail->() if $o->{dirStream};$take->(\'close\',$o->{role});';
hunk(close,'          $fail->() unless @_==1;\n'+b.close+'\n          $fail->() if $o->{dirStream};$take->(\'close\',$o->{role});');
const driver="          if($mode eq 'healthy'||$mode eq 'file-byte-xor-mutant') {";
hunk(driver,driver.slice(0,-3)+"||$mode=~/\\Aonce-primitive-(?:baseline|mutant)\\z/) {");
const snapshot="          if($mode eq 'file-byte-xor-denied'||$mode eq 'file-byte-xor-mutant') {\n            $fail->() unless exists($outcomes->{byteNomination});";
hunk(snapshot,b.snapshot+'\n'+snapshot);
const repeat='          $repeat_delta=scalar(@events)-$before;$fail->() if $repeat_delta;';
hunk(repeat,repeat+'\n'+b.repeat);
const testAnchor="const STAGED_DIRECTORY_FH_CORE_KEYS=['fileOpen','directoryOpen','directoryFhOpen','metadata','fileClose','directoryClose'];";
hunk(testAnchor,b.tests.trim()+'\n\n'+testAnchor);
if(count!==9)throw Error('hunks');patch+='*** End Patch\n';
console.log(JSON.stringify({patch,sha256:hash(patch),hunks:count,oldTest:hash(test)}));
```

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody primitive once ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
```

#### Closed captured original primitive-call-once pair, 2026-10-04 20:35 UTC

BOTH literal799e and BOTH actualdelta7077 C0/I0/M0; reverseexact9hunks to0824.
Readonlyextracta6d1b1 patchdadc/rootapply once; syntax/diff4651fb CLOSED0.
Actualtest7077a597bff1760c68872744453835edd970815b93d5f90c7ae0461721d41b7a,
456326B/source434 unchanged.
ONE exactfocus257571 naturallyCLOSED0/full76tokens2PASS/0FAIL/CANCEL/SKIP/TODO
488.477208ms/no managedsession/NOREPLAY. Rootpre924d2e20:35:29.645/
post97c89520:35:30.570 same2093/70037900B/physical
49be02dd419ec15f4fb6f8b0791581af77d11db73fdef23efbe5c376430f3d81.
Exact executedplan799e/test7077/source434/spec1f26/npm/tools/absences matched.

Independent bounded20:34:54–55gateC0 originals/backups/journal/canonical/toolpins
includingBigIntSIPPerl/npm exact;7484344KiBfree97%,memory58%/throttled0/no
recordedthermalwarning. Disk204904KiB below20:27 in7min, attributionUNKNOWN;
this admits boundednondiskpair only, NOTclone/CI/build. HTTP3080+18789200;
3333separateexit7knownrefusal. Historicalfullretention10:56 stays historical.

Actualhealthybaseline C407/H42/4448/390physicaloriginals/private12closed had12
stagedprimitiveevents. Memoryonlycapturedfirstd0 CVdoublecalls actualport and
returnsfirsttrue; strictone-useadjacentclosednativeGV actuallyinvoked original
COREdisposer secondfalse withfilenoundef. Privateattempts/physicalstageclosure
still12; actualrelease returned12 whileprimitiveevents13. IndependentNode
expected12 assertion caught extraeffect afterrealcleanup. Mutant4449differsonly
close349vs348; scopedwarningobservations valid0/1; repeatszero/released→burned.
No fixture/alias/reusedFD/isolatedattemptguard/native/production credit.

Independentfiniteinventory foundall11requiredfamilies and5minimumsemantic
targets represented; once2nowhasactualreceipt. Disjointresume189focusedpasses=
prior78+new111; originalfirstcycle41 separate; arithmetic230custodycases.
NOT currentcombined230/unfiltered/fullmatrix/delivery/native/cutover proof.

#### Current-source ordinary matrix closure and verification gate

File Map remains exactly existing bootstrap/test/thisplan/namedspec. Source adds
only threezeroarg diagnosticcapsule operations andprivate immutablecustody/
admission/burn/disposal internals; productionmain still unconditionalrefusal and
no initializer exported. TestsyntheticVendorSource selects uniquely bound old
transportpolicy site so secondlegitimateofficialcapsulepin doesnotcreate
setupcollision. No entry/helper/map/import-policy/native/observer/package/lock/
launcher/TS/runtime/DB/service change. Scopedbranch/source remains solewriter.
This relationship is causally necessary for eventualpositiveworktreeownership
cutover; ordinarydiagnostics are not installedowner authority.

Finiteinventory source-derived case counts (notruntimeproof):
entry/acquisition41; malformed10; uncertainclose26; admission20; boundary8;
metadata14; partialtied4; H7captor2; configuration25; byte2; metadatamagic16;
admissiondrift20; admissionmagic20; foreign+hidden5; active3; livealias2;
identity6; shared2; epochACL2; capturedprimitive2. Total230.
Minimumsemanticmutants shapeactualFETCH1, metadatavectoractualPUSH1, bytebadread
acceptance, ACLplusactualrecheckacceptance, primitiveextraactualclose arepresent.
Optionalisolatedattempt/disposal-startedguard removal is explicitly notclaimed.
No newCartesianvariants/taskscope are introduced.

Recorded pre-execution gate (closed by the receipt below): TWO independent exactcurrentallfourfile reviews
(source/test/spec/plan+base3e94/head d5bc), syntax/diff andfresh source/Git/npm/tools/
originaltwo/retention/resource/HTTP preflight precede commandsbelow. Resourcegate
must usecurrenttime; externaldiskgrowth unknown, no cleanup or stalebuildcredit.
RunONE current-source combined230 first, readnaturalcompleteoutput/footer and
exactpostchecks. ThenONE current-source unfiltered bootstrapfile (predicted1389
from prior1159+new230; runtimefooterauthoritative) includesadjacentpure/vendor/
parent/captor regressions. This is newintegrationverification, not replaying old
closedinvocations orrequalifyingtheirhistoricalreceipts. Combined230 uses readonly
originalFHs/pipes plus synthetic helperPID, no helperexec. Unfiltered retains
existing case-specific owned ordinary fixtures: one tinyowned FIFO/tmpdir with
exactmember/nonrecursivecleanup; fixedallowlistedls/curl--version/invalid-option
and ownedPerl probes; own actualordinarychild and syntheticPerlobserver output
substitution at deniedvmmapedge; boundedsignals/TERM/STOP/KILL only within each
testcase's own retainedprocess tree (target/helper andfixtureparent cancellation),
with original actualwait/close invariants preserved.
Those effects are not realvmmap/nativeobserver/protectedowner/live-service proof.
No npmtest/privateDB/credential/protectedfixture/genuinevmmapobserver/live-service
effects are admitted bythesecommands; no signal to foreign/existing servicePID.

Transport: root sets nestedexec_command ANDwrite_stdin max_output_tokens50000,
preserves everyrawresult infunctions store BEFORErendering, emitsonlysmallmetadata,
thenreads complete preservedrawoutput inboundedpages throughEOF. No rawtool
truncation marker credited. Rootalonepolls only NEW live session to naturalclosed;
doNOTpollpriorclosed sessions. Each toolwait≤30s; commentary≤60s. No transcript
fixture/filewrite needed. Ifunexpectedtest/transport/harness failure occurs,
preserveactualevidence andclassify; no silentretry/autoqueuelearning.
Aftereachnaturalcomplete-readC0, exactrootpostchecks; recorddistinctinvocation,
rawUTF8length/hash/line/passcounts/footer. Completeoutputbeforecompletionassertion.

Thendefaultversion/English/path checks, safe fixedSIPPerl+Node syntax anddiff.
SourceTS/frozenmigration/MC-contract checks require separatelyadmitted locked
ignore-scriptsCI/deps/freshstoragebudget afterscopedcommit. Unchanged build guard
requires clean branchmain withHEAD==origin/main; no pre-merge featurebuild is
admitted. PR/cloud/security/threadchecks, normalSHAmerge, post-merge cleanmain
guardedbuild/actualhostproof remain subsequentseparate gates. No dirtybuildoverride,
branchselector substitution or runtimeguardbypass.

```sh
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test --test-name-pattern='^staged custody ' scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --test scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node --check scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node scripts/check-version-contract.mjs
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node scripts/check-english-contract.mjs
env -i PATH=/opt/homebrew/Cellar/node/26.4.0/bin:/usr/bin:/bin LANG=C LC_ALL=C /opt/homebrew/Cellar/node/26.4.0/bin/node scripts/check-path-contract.mjs
env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C /usr/bin/perl -f -c scripts/task6a-protected-origin-bootstrap-v2.pl
git diff --check
```

#### Current-source ordinary matrix actually closed, 2026-10-04 20:56 UTC

The admitted four-file review and command recipe above were executed once.
Both independent whole-file reviews bound source434a6a7c, test7077a597,
spec1f26f90d and executed plan3c871aa0 to base3e94dad9/head d5bc1fa8;
no source/test/spec change followed those reviews or either matrix invocation.

Combined invocation153b39/session30263 naturally closed b0854e exit0:
230PASS, zeroFAIL/CANCEL/SKIP/TODO, 25418.905083ms. Complete output was read
through EOF: 21267UTF8bytes, 238lines, 230actual pass events, SHA256
3d14d518ec2bbc0a312d4f22ed739979ff2b9d4284f49bac8d12a6ae1556ca4a.
Root pre365bb7/post1377b2 matched all2093inputs/70045279bytes/physicalpin
9d25d39551bd8a0d5bf78c27bd2f7cf881d9f4cbfa22e653128db2eebb8d4908.

Unfiltered invocationfbdcf0/session1660 returned dfb5dc plus natural terminal
f5e88e exit0: 1389PASS, zeroFAIL/CANCEL/SKIP/TODO, 116021.034292ms.
Both complete raw chunks were retained before rendering and read through EOF:
121289UTF8bytes, 1398lines, 1389actual pass events, SHA256
472a6b707ed6938337664f760f8001715af66549b98dd9c4f7ff7f68345f5221.
No tool truncation marker occurred; four test titles contain the word
"truncated" as an intentional input-denial case, not missing tool output.
Root pre0e43fa/post754f02 at20:56:42.749UTC matched the same exact all-source
physical pin, selected hashes, root/Git identities, npm/tool pins and absence
of node_modules/dist/.setfarm. Neither closed session may be polled/replayed.

Node syntax/diff and scrubbed fixed-SIP Perl syntax were exit0 (636328);
versioncontract2.3.79 (ef4e20), English1931files (d881a5) and path966files
(da7079) were exit0. These are scoped ordinary verification, not default
npmtest/private-DB, protected owner, actual vmmap or live rollout evidence.
This receipt-only plan change requires a final independent delta review before
the scoped commit. Locked ignore-scripts dependency admission, TS/frozen/MC
checks, exact-head PR gates, normal merge and separate clean-main build remain.
The unchanged builder main/clean/origin guard remains mandatory.


#### Causal existing vendor-test anchor refinement

The private capsule will carry the same official archive pin already used by
`get_vendor`. Existing `syntheticVendorSource` uses bare-hash `replaceOnce`, so a
second legitimate policy occurrence would fail setup before the real vendor
consumer. Keep old production policy and all expectations unchanged. Select this
exact test-only replacement before adding the new policy occurrence:

```javascript
function syntheticVendorSource() {
  // Ordinary test only: replace the existing transport's exact policy site.
  // A distinct staged-owner policy occurrence must retain its official pin.
  const source=readFileSync(BOOTSTRAP,'utf8');
  const site=`my $pin='${VENDOR_PIN}';`;
  return replaceOnce(source,site,`my $pin='${SYNTHETIC_VENDOR_HASH}';`);
}
```

This is not a weakening of unique-anchor checks: the complete transport policy
site remains required exactly once. The capsule fixture's synthetic archive pin
must use a different uniquely anchored private constant and disclose synthetic
archive/selected bytes. No broad replaceAll, policy fallback or on-disk fixture.
Run existing vendor positives/denials under their unchanged byte/parser path
after the reviewed complete recipe, not as a substitute for actual staged RED.

### Task 3: Reviewed delivery and actual protected rehearsal

- [ ] Run full focused pure/protocol tests, sourceTS/syntax/version/English/path/frozen migration/MC/diff contracts. Independent exact all-source/test/spec/plan review. Ordinary feature build obeys unchanged main guard.
- [ ] Conventional scoped commits, normal push/PR, fresh exact-head available cloud/security/full paginated review/comments/threads gate; optional Copilot/Gemini once. Normal SHA-bound merge, no bypass/deletion.
- [ ] Fast-forward clean standby main, ordinary build/compiled observer and merged focused tests. Independently inspect actual GitHub merge/source/review/security identities for the owner-install selection. Freeze exact bootstrap/entry/helper blobs/bytes and actual invocation literal; independently review again BEFORE privileges.
- [ ] Actual opt-in trusted-owner installation uses only fixed system tools: fetch the actual admitted bootstrap blob to a newly root-owned private stage, check typed base64/size and framed Git identity against the independently admitted delivered blob, then execute exact protected system Perl program. Never root-execute the user-owned test Node/local mutable file or derive authority from a receipt DTO.
- [ ] Run actual private vendor/source/native/credential-drop/direct-PID/private-pipe/held-byte/lifetime positives and wrong-entry/argv-title spoof/replay/foreignPID/source-native replacement/parent-loss/cleanup-uncertainty denials. Only delivered source and real official archive count; fakes prove protocol only. Capture actual child UID/groups/start/maps and exact root/source/vendor identities, definite cleanup or preserved failure evidence.
- [ ] Independent post-run PID/root absence or exact preserved-tree validation, then PG31/HTTP/selector/namespace read-only checks. Standby unselected and all live guards unchanged. Record exact remaining compiler/fence/genesis/32/33/admission/live handoff outcomes without claiming Task6A completion.
