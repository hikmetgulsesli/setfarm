# Task6A owned-child raw Mach diagnostic implementation plan

> **For agentic workers:** Root executes inline using test-driven-development;
> independent agents are read-only reviewers. No implementation delegation.

**Goal:** Obtain bounded original-task recursive permission diagnostics from only
an ordinary directly owned Apple Perl child, without granting native authority.

**Architecture:** A zero-argument isolated CLT Python program owns its test child,
uses a fixed typed read-port/Mach bridge, and feeds a pure packed76-byte decoder
and bounded recursive walk. Diagnostic output waits for definite port/child/FD
settlement. Default tests never perform actual native queries.

**Tech Stack:** Existing Apple CLT Python3.9/ctypes and SIP Perl5.34, Node tests.

**Spec:** docs/superpowers/specs/2026-10-01-task6a-owned-mach-region-recon-v2-design.md

## Global constraints

- Root sole writer; no reset/revert/stash/deletion, main commit or force push.
- No root/live target, credentials, runtime selector, source policy or DB changes.
- Exact real CLT application with -I -S -E -B; scrubbed fixed environment.
- pack4/v2 length76/count19; address bound exclusive281474976710656.
- Native calls4096, depth64, readiness5s, native epoch10s, output1MiB.
- Always false completeNativeClosure/productionAuthority; sampled enumeration.
- All-source independent pre-effect review before one ordinary native invocation.

## File map

Create scripts/task6a-origin-mach-recon-v2.py and
scripts/__tests__/task6a-origin-mach-recon-v2.test.js, plus this plan/spec.
Modify tests/execution-attempts/migrations.test.ts only for the three historically
stale source/generated-file/33 literals described in Task2. Production migration
files and digests remain byte-identical; no default guard or source policy change.
Default test:scripts already selects scripts/__tests__/*.test.js.

## Task 1: Pure decoder and census with lazy native/owned-child edges

**Interfaces:** decode_region(raw,address,size,query,requested_depth,depth,count)
returns preserved finite diagnostic region. walk_regions(query,alive,clock,deadline=None)
calls query(address,depth) -> (kr,address,size,depth,count,raw) and returns bounded
region/submap enumeration. run() has no arguments and refuses unqualified hosts
before external effects. NativeReadPort owns only its captured child's read right.

- [x] Write Node tests loading Python source in memory under a non-main name.
  Use a hand-packed vector `struct.pack('<iiiQIIIIIIHBBiiiHHIQ', ...)` with
  protection3/max7/offset0xfedcba9876543210 and exact literal expected fields.
  `assert d['offsetHex']=='fedcba9876543210'` catches wrong native offsets and
  float truncation. Missing file assertion is expected initial RED.
- [x] Run `node --test scripts/__tests__/task6a-origin-mach-recon-v2.test.js`.
  Observe missing implementation RED; no real native library/target queries.
- [x] Implement decode with exact type/length/count/range/depth/field guards.
  Implement walk with fresh count19 per query, submap descent, leaf progression,
  strict error handling and nonrenewing liveness/time/budget checks.
- [x] Add independent literal nested replies: submap(0x1000,0x4000,depth0),
  leaf(0x1000,0x1000,depth1), leaf(0x3000,0x1000,depth1),
  leaf(0x6000,0x1000,depth0), terminal1. Assert actual query trace
  `[(0,0),(4096,1),(8192,1),(16384,1),(28672,0)]` and all leaf masks retained.
  Failure tests replace terminal1 with error5, initial1, cycle, malformed count,
  byte suffix, depth65, lost child and advanced clock. No synthetic mock-only
  approval: doubles drive the actual decoder/walk/lifecycle implementations.
- [x] Add lazy fixed native bridge and parent-owned lifecycle only after RED
  tests for refused host, read-port denial, deallocation failure and child loss.
  Test system boundaries with exact doubles; no production test-only overrides.
- [x] Exercise real controlled Perl child readiness/EOF/definite close without
  native query through test-local fake read bridge. Capture all failure results.
- [x] Run GREEN, in-memory guard mutants, existing358+62 safe suites, noemit and
  version/English/path/migration/diff checks. No overlapping genuine host fixtures
  while the separate full npm test chain runs on the clean standby.
- [x] Request independent all-source review and remediate findings with RED/GREEN.
  Record exact source hashes and pre-effect invocation clearance separately.
- [x] Only then run one guarded ordinary own-child native diagnostic; retain
  raw map only in orchestration memory and log sanitized aggregates or refusal.
- [ ] Commit exact mapped files with reviewed evidence, push scoped PR, inspect
  security and available exact-head cloud findings, merge by verified head SHA.
- [ ] After the running full npm chain closes, ff-only independent clean main,
  run normal guarded build and merged focused tests/CLI/PG31/HTTP verification.
  No selected runtime switch; later privileged/native/compiler/fence gates remain.

## Initial evidence

Base is reviewed PR254 merge794bea6854ef6ab290c672ab39777cc3fca80996.
At planning time, the independent standby remained clean47e7f8ef while its full
npm chain owned that checkout. Do not synchronize/build a test-owned checkout
until the chain definitively closes. That historical chain is now closed.
The Python startup research is static and unadmitted; no Python execution or
Mach query occurred during that research. task_read_for_pid policy denial is
new diagnostic evidence, never grounds to change permissions or add root mode.

## Task 2: Restore reviewed migration test provenance, not migration semantics

**File:** tests/execution-attempts/migrations.test.ts. This causally necessary
root test fix restores the same Task6A broad-verification gate after reviewed
held31/recovery additions. No production code, generated digest or SQL effects.

- [x] Reproduce existing RED with both PG URLs unset:
  `node --import tsx --test --test-name-pattern='^P4 guarded stage uses held savepoint without changing v32 digest$' tests/execution-attempts/migrations.test.ts`.
  Actual whole-source fb5b79ae differs from stale e11be19c; generated4b8e3078
  differs from stale d61009ae. Migration32file1f5b1f1c remains identical.
- [x] Independently read current hashes and Git97a111f6/562a2760/d42342df
  provenance. Current33 eb75ce31 was delivered by reviewed PR209;32 remains
  8cbaab0c. Canonical check reports current without regeneration.
- [x] Replace only expected source with
  fb5b79aed2d9477e1fded8ee4f2d4cead37dbe1a9a20e49e0973a6d1741cb9b9,
  expected generated file with
  4b8e307863fbd9ce07e9612c969701d5732840bdbac3ec620cf006505b1d2c69,
  and historical33 expectation with
  eb75ce31cd8715590e31a9c64b6e701c84a947fbb1f2ff67b540d1b658dd1f79.
- [x] Rerun the exact P4 leaf and `npm run check:migration-digests` (check-only).
  Confirm no changes to32/33 implementation/generated sources with git diff.
- [ ] Independent read-only review of this narrow diff plus scoped diagnostic;
  rerun execution-attempts and remaining broad stages on reviewed clean main.
  Do not call the partially repeated graph an entire fresh npm-test pass.

## Current verification evidence

Root initial missing implementation56RED then56GREEN; review findings reproduced
unsigned object-ID/native-epoch/cleanup RED, then64GREEN; actual fixed native
adapter count/right release coverage67GREEN; bounded refusal stages70GREEN;
default-graph consumer71GREEN. Additional combined uncertain-acquire/release
characterization exercises the real adapter with an exact native-boundary double:
read-port-close/emptydetails/one release,72PASS/0FAIL/0SKIP4327.713ms.
Coherent missing-length/protection mutants run in memory, never on disk.
Prior combined bootstrap358+BSD62+Mach71 gave491PASS/0FAIL/0SKIP48388.139ms.
No privileged native calls occur in those suites.

Independent narrow three-literal P4 review cleared with fresh1PASS/0SKIP791ms;
root exact P4 RED then GREEN667ms and check-only migration-digests0. Broader
execution stage on old clean main had1103PASS/1FAIL/56opt-in SKIP, solely the
now-corrected test pins; a corrected broad rerun remains required. Product
Compiler full1383PASS after ordinary offline repair of exact installed esbuild
tree. No source/hash policy change or whole fresh npm-test success is inferred.

Delivery review found SDK-undefined shareMode0 was accepted. Actual SDK SM_*1..8
inspected; literal0 refusal test RED (unsafe accepted), minimal lower bound1,
then73PASS/0FAIL/0SKIP4381.308ms. Independent final73PASS/0SKIP4533.138ms,
no critical/important findings. PythonSHA256
d283e7d9626107aa11ca3966c78c7b3366262dae64e44201452353b381c0b8d7;
testSHA2569840f2383693b41e5bd44eefda325b1788467177ea0d0716635d9464c8f30dae.
Fresh combined selected five bootstrap/transport/Git-object/BSD/Mach suites
556PASS/0FAIL/0SKIP47710.133ms; full migrations54PASS/0FAIL/0SKIP152332.266ms,
own exact test database dropped. Version/English1899/path957/MC12/canonical
migration-digests/noemit/diff checks0. Ordinary feature not built by bypass;
unselected independent clean main794bea normal guarded build already passed.

Exactly one reviewed PREDECESSOR ordinary invocation used sourcea407685d,
testd54f6680, guardian literal11c305bc (documentb3225f55); returned bounded
diagnostic-refused/read-port-acquire/-1/fresherrno1(EPERM)77.376ms, Python84405
definitely closed. No region query/map/native admission or definite Perl cleanup
witness. Initial caller confused code/document digest and refused BEFORE spawn;
independent byte agreement preceded the corrected one invocation. Current
share-mode-tightened source has NOT been natively invoked. Do not retry equivalent
denial, escalate to root, change port policy or add task-control fallback.

Remaining broad verification on clean794bea: default findings refuses its missing
private cluster before connection; supported eight pure finding files41PASS.
Evidence104tests/103PASS/1FAIL: accepted-candidate terminal fixture lacks the
required execution-attempt positive owner sidecar (under separate diagnosis,
not weakened here). Recovery4PASS and evals51PASS/0SKIP. These are separate stage
observations, NOT a successful whole npm graph. Protected/native fixture gates
and corrected execution/internal-production broad reruns remain outstanding.
