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

Create only scripts/task6a-origin-mach-recon-v2.py and
scripts/__tests__/task6a-origin-mach-recon-v2.test.js, plus this plan/spec.
Default test:scripts already selects scripts/__tests__/*.test.js.

## Task 1: Pure decoder and census with lazy native/owned-child edges

**Interfaces:** decode_region(raw,address,size,query,requested_depth,depth,count)
returns preserved finite diagnostic region. walk_regions(query,alive,clock)
calls query(address,depth) -> (kr,address,size,depth,count,raw) and returns bounded
region/submap enumeration. run() has no arguments and refuses unqualified hosts
before external effects. NativeReadPort owns only its captured child's read right.

- [ ] Write Node tests loading Python source in memory under a non-main name.
  Use a hand-packed vector `struct.pack('<iiiQIIIIIIHBBiiiHHIQ', ...)` with
  protection3/max7/offset0xfedcba9876543210 and exact literal expected fields.
  `assert d['offsetHex']=='fedcba9876543210'` catches wrong native offsets and
  float truncation. Missing file assertion is expected initial RED.
- [ ] Run `node --test scripts/__tests__/task6a-origin-mach-recon-v2.test.js`.
  Observe missing implementation RED; no real native library/target queries.
- [ ] Implement decode with exact type/length/count/range/depth/field guards.
  Implement walk with fresh count19 per query, submap descent, leaf progression,
  strict error handling and nonrenewing liveness/time/budget checks.
- [ ] Add independent literal nested replies: submap(0x1000,0x4000,depth0),
  leaf(0x1000,0x1000,depth1), leaf(0x3000,0x1000,depth1),
  leaf(0x6000,0x1000,depth0), terminal1. Assert actual query trace
  `[(0,0),(4096,1),(8192,1),(16384,1),(28672,0)]` and all leaf masks retained.
  Failure tests replace terminal1 with error5, initial1, cycle, malformed count,
  byte suffix, depth65, lost child and advanced clock. No synthetic mock-only
  approval: doubles drive the actual decoder/walk/lifecycle implementations.
- [ ] Add lazy fixed native bridge and parent-owned lifecycle only after RED
  tests for refused host, read-port denial, deallocation failure and child loss.
  Test system boundaries with exact doubles; no production test-only overrides.
- [ ] Exercise real controlled Perl child readiness/EOF/definite close without
  native query through test-local fake read bridge. Capture all failure results.
- [ ] Run GREEN, in-memory guard mutants, existing358+62 safe suites, noemit and
  version/English/path/migration/diff checks. No overlapping genuine host fixtures
  while the separate full npm test chain runs on the clean standby.
- [ ] Request independent all-source review and remediate findings with RED/GREEN.
  Record exact source hashes and pre-effect invocation clearance separately.
- [ ] Only then run one guarded ordinary own-child native diagnostic; retain
  raw map only in orchestration memory and log sanitized aggregates or refusal.
- [ ] Commit exact mapped files with reviewed evidence, push scoped PR, inspect
  security and available exact-head cloud findings, merge by verified head SHA.
- [ ] After the running full npm chain closes, ff-only independent clean main,
  run normal guarded build and merged focused tests/CLI/PG31/HTTP verification.
  No selected runtime switch; later privileged/native/compiler/fence gates remain.

## Initial evidence

Base is reviewed PR254 merge794bea6854ef6ab290c672ab39777cc3fca80996.
The independent standby remains clean47e7f8ef while its full npm chain owns that
checkout. Do not synchronize/build it until the chain definitively closes.
The Python startup research is static and unadmitted; no Python execution or
Mach query occurred during that research. task_read_for_pid policy denial is
new diagnostic evidence, never grounds to change permissions or add root mode.
