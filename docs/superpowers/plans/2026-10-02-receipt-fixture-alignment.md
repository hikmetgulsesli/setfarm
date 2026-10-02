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
