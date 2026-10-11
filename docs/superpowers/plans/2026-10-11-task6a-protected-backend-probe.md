# Task6A Closed Protected Backend Probe Implementation Plan

> Root implements inline with TDD; agents investigate/review read-only. User's
> root-only/autonomous protocol overrides implementation delegation and repeated
> approval prompts; executing-plans skill is unavailable.

**Goal:** Consume fixed protected socket custody without publishing runtime authority.

**Architecture:** Zero-input closed owner retains reserve/query originals and
joins driver/native close before descriptor release; cleanup uncertainty is sticky.

**Tech Stack:** Node >=22, TypeScript ESM, Postgres.js3.4.8, node:test.

**Spec:** `docs/superpowers/specs/2026-10-11-task6a-protected-backend-probe-design.md`

## Global Constraints

- Root sole writer on fix/cutover-dashboard-reviewed-delivery-v6; preserve worktrees.
- No live namespace, account, DB/schema, dependency, service or selector change.
- No caller SQL/transport/callback, injected production API or returned capability.
- Complete original settlement before physical FD release; no timer race.
- Modeled composition is not fixed-source positive authority or startup clearance.

## File Map

Create `src/internal-production/task6a-protected-postgres-backend-probe-v1.ts`
and `tests/internal-production/task6a-protected-postgres-backend-probe-v1.test.ts`;
register focused/default discovery in package.json. This paired plan/spec carries
the causal missing-consumer scope; do not alter existing socket/file/client owners.

## Task 1: Closed consumer

**Interface:** `probeTask6aProtectedPostgresBackendV1(): Promise<void>` consumes
existing zero-input socket holder and one-attempt client; returns no data/authority.

- [x] Write missing-interface test plus functional healthy, pending reserve/query/
  close, source refusal, tuple drift, after-query recheck failure and undefined
  ending-failure controls. Use full real module translation with ONLY two exact
  imported dependency ports; source import must remain inert. Initial assertion:
  `assert.equal(typeof fixture.probe, 'function', 'missing closed backend consumer')`.
- [x] Run actual test artifact. Expected RED is missing consumer, not an import
  or dependency setup exception. Retain actual raw and original child close.
- [x] Implement zero-input owner: fixed holder before client, exact two literal
  SELECTs on reserved unsafe, full-tuple checks with holder rechecks around awaits;
  `finally { client.revoke(); reserved?.release(); await client.close(); held.close(); }`
  with independently attempted cleanup and explicit failure-presence flags. Keep
  held resources if client construction throws or close fails before returning
  its original; refuse future entry. Revoke/release throws cannot skip close.
- [ ] Run focused GREEN and adjacent descriptor/transport/socket controls. Strict
  source/actual-test types, version/English/path/migration/MC/diff checks; stock
  dirty build is forbidden. Independent source and complete raw review precede
  ordinary same-branch commit/push; PR remains draft until full integration gates.
- [ ] Record original results and unknown-cleanup limits. Positive fixed anchored
  proof stays pending until actual approved deployment provides that namespace;
  no private fixture path or modeled success may substitute for it.

Self-review: bounded one-consumer scope, exact signature/fields/cleanup and input
refusal consistent with spec; no grant/readiness/result claim or placeholder.

## Actual qualification checkpoint

Design ef165f1e follows read-only review. Genuine missing-interface RED CUsVTU
joined1/null,19 failures at the named absent-consumer assertion, not setup.
First complete owner GREEN cheAb5 joined0/null,19 modeled passes. Those original
test pins are historical: later actual-import, undefined-operation rejection and
cardinality controls, and failure-safe finally joins advance the test.

Review found construction-throw custody (I1) and unjoined assertion-failure test
originals (M1); both corrected and independently closed. Initial strict run31
diagnostics caught possible undefined holder/read and assert.deepEqual([])
narrowing events to never[]. Runtime presence guards and length0 check corrected
these without weakening authority or test/type policies. This failed type run is
not a backend RED. No source revert or private production hook was introduced.

Final fresh actual-source owner OTBk9F: focused26PASS/0FAIL/0SKIP, adjacent23PASS/
0FAIL/1explicitprivilegedskip, strictTS5.9.3 845roots/1194files/0diagnostics/noEmit.
All three original children naturally closed0/null. Complete-write/fsync helper,
11 actual input pins and nine streams/artifacts rechecked by independent readers;
no pin/capture/finalization or sampled8GiB-floor fault. Adjacent tests were not
individually prepinned; no complete dependency or native graph claim is made.
Readonly declared canonical-dependency fallback is not a stock candidate build.
Two actual imported refusal paths pass; remaining24 are explicit two-owner
modeled composition, not fixed-source/native PG authentication.

Source SHA b05643298be95e41eda7cfa0eb08696f335dcf43c96922c5a0a9707158e42700;
testSHA a5a671fb9146451eff67eb649680dc8d5a00e96b107eaf6cf7c4db2a6eb7c21c.
Raw focused3656B/df8b9174048f34a657754dd375b00e2855ffc459cbc7efe88a1003b8cd19bdef;
adjacent3868B/22fc844c6274f6704122b8d71c106aab35fbe371d09601ef30b58123b742c0c8;
strict97B/0b5fe9a6bdaba98122513db5684e61c7b856baa092d706a37d6fe95d9461818a.
Version2.3.79/English2000/path1003, semantic migration digests, all12 Mission
Control contract artifacts and diff checks passed. No dirty build, runtime bypass,
fixed namespace installation, account/DB/service/selector or live3333 action.

Independent exact source/test gates report C0/I0/M0. PR delivery remains a scoped
source checkpoint, never whole-cutover acceptance. Fixed protected positive
execution, full initializer/grants/catalog/historical ownership/controller and
actual clean-main build/current host proof remain openly required.
