# Task6A Raw Native Region Diagnostic v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Root executes inline as sole writer; other agents investigate/review read-only.

**Goal:** Decode bounded raw native region ABI without trusting formatter permissions or granting complete-native authority.

**Architecture:** A pure96-byte decoder consumes independently built fixtures through actual Apple system Perl. Genuine own-child query/lifecycle is a separately planned pre-effect-reviewed follow-up, not part of this decoder delivery.

**Tech Stack:** SIP Apple Perl5.34.1/Config/JSON::PP; node:test and Buffer fixtures.

**Spec:** docs/superpowers/specs/2026-09-30-task6a-native-region-diagnostic-v2-design.md

## Global constraints

- Root only writer; reuse isolated tree, preserve every previous branch/tree/dirty19.
- Pure exact96-byte little-endian ARM64 LP64 ABI; Config ivsize8; exact integer sums.
- No actual syscall, PID/flags selection, native observer, root, UID drop or DB/service effects.
- Scope proc-region-abi-diagnostic-only; completeNativeClosure and productionAuthority false.
- No bootstrap source-policy/import/main change or relaxed potential-executable gate.

## File map

- Create scripts/task6a-origin-proc-region-v2.pm, Task6aOriginProcRegionV2::decode_region_v2($raw,$query).
- Create scripts/__tests__/task6a-origin-proc-region-v2.test.js, real fixed SIP Perl byte consumers and in-memory mutants only.
- This plan/spec. No package.json change or native collector in this task.

### Task 1: Pure native ABI decoder with denial consumers

**Consumes:**96 raw bytes and internal canonical query address. **Produces:** All decoded numeric fields, exact u64 offset hex, submap/shared/current/potential booleans, bounded address/size/end and false-authority diagnostic; or TASK6A_ORIGIN_PROC_REGION_REFUSED.

- [x] Write a hand-built fixture with u32 words at0..12/24..76, u64 offset16,
  address80,size88; independent literal expected fields. The production breaks
  caught are wrong offsets/endian, truncated buffer, lossy u64 and permission
  exemption. Assert implementation existence first so missing-code RED is an
  AssertionError, not require-loader failure.

```js
const raw=Buffer.alloc(96);
raw.writeUInt32LE(3,0); raw.writeUInt32LE(7,4);
raw.writeBigUInt64LE(0xfedcba9876543210n,16);
raw.writeBigUInt64LE(0x100000000n,80);
raw.writeBigUInt64LE(0x4000n,88);
assert.equal(actual(raw,0).offsetHex,'fedcba9876543210');
assert.equal(actual(raw,0).potentialExecutable,true);
assert.equal(actual(raw,0).completeNativeClosure,false);
```

- [x] Run node --test scripts/__tests__/task6a-origin-proc-region-v2.test.js;
  verify missing implementation assertions RED and repair harness errors first.
- [x] Implement minimum pure decoder, explicit V/Q< formats and all spec gates;
  no Perl native calls or local mutable module fallback.
- [x] Test complete95/96/97-byte consumers, current/max combinations including
  zero and max-onlyX, invalid bit8/current outside max, flags0..3/unknown4,
  zero/overflow/overbound/nonprogress/query-inside/query-gap/backtracked end,
  depth1, synthetic tag UINT32_MAX, share0..8/unknown9, high offset preserved.
  Ref/null/UTF8/extra/missing arguments all canonical refusal, empty stdout.
- [x] Test actual admitted integer boundary at2^48 exclusive end and+1 refusal.
  Remove permission/length/range guard IN MEMORY to prove refusal consumers
  detect coherent accepted-bad-input mutants; never edit runtime source for mutants.
- [x] Unsupported/root host registration refuses before helper invocation with
  a test-only forbidden-child sentinel; actual macOS verification zero skips.
- [x] Verify default npm graph reaches its script-suite glob, an omitted-glob
  mutant refuses, and the actual selected bounded pure leaf executes. This
  proves graph selection plus real leaf, not completion of the entire npm graph.
  No fixture/native-effect opt-in.
- [x] Full focused tests/English/path/version/semanticmigration/MC/sourceTSC/diff
  contracts; independent exact all-byte source/test/spec/plan review.
- [ ] Conventional scoped commit, push/PR, fresh available-cloud/security/full
  paginated reviews/threads. SHA-bound normal merge and clean standby-main build;
  no unmerged or pure-byte result called genuine native origin/admission.

### Explicit next boundary

After decoder delivery, map and test the separately reviewed ordinary own-child
collector described by the spec. No collector/native effect is authorized by a
pure decoder green test. EINVAL termination, submap recursion, host equivalence
and vnode/COW origin remain unresolved; raw queries cannot waive these gates.

## Current verification evidence

Three unsupported/root JS registration sentinels pass without local helper exec.
Initial57 implementation assertions RED, then all60GREEN743.503ms. Three
coherent IN-MEMORY missing length/permission/end guards actually accept their
bad inputs, while genuine guards refuse; real leaf/default graph consumers give
fresh62PASS/0FAIL/0SKIP902.517ms. No syscall/observer/privilege/native-origin claim.
Current decoder SHA256ec86a8b28009c0bef400a04bb1dc5776ba4a998346fc3df2e87e2accc9d57c1f;
tests ec1f5287377f17d6a4331979610175ff11123fad1c6b71a3caa381ac756146df.
Fresh combined delivered-bootstrap+new-decoder420PASS/0FAIL/0SKIP48616.760ms,
complete output/exit0 read before source commit. No production import changed.
Version2.3.79/English1896/path956/semanticmigration/MC12/sourceTSC/diff checks
exit0. Independent whole-byte source/test/spec/plan review cleared exact hashes
above; independent62PASS/0FAIL/0SKIP1087.169ms. This is pure ABI clearance only.
Existing clean-main47e7 broad npm graph with explicit isolated local test admin
endpoint is running on the separate unselected standby; its overall result is
not known yet and is not decoder verification. All old user changes preserved.
