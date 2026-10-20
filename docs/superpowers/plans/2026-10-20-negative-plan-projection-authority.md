# Negative PLAN and Projection Authority Implementation Plan

Revision v2 resolves independent review I1: successful accepted V3 pure and actual runner-port controls are mandatory before B2 delivery. A2, refusal causal test order, production interfaces, File Map and effect gates are unchanged. The v1 SourceMap checkpoint is historical; Root now supplies source `43291050` with P1 inert seam/test in progress. This static author does not independently attest Git state.

> For agentic workers: execute task by task using the existing subagent-driven-development/review protocol when Root appoints workers. Root alone owns validation, guarded P3/native/DB execution, delivery and rollout. Root has now placed this reviewed canonical plan for serialized implementation after PR301 merge. Scoped Source authors do not execute product code or deliver; Root retains actual execution/delivery.

**Goal:** Accept the exact supported V2 bare typed refusal and consume full strict canonical V2/V3 operational pairs without weakening provenance or settlement.

**Architecture:** A2 adds optional raw refusal authority at the existing resolver and exact completion wiring. B2 first extracts the unchanged V2 calculation into a pure helper, then adds strict V3 dispatch in a separate causal RED/GREEN cycle. The refusal transaction and collector effects remain at existing owners.

**Tech stack:** Existing TypeScript ESM with `.js` imports, Zod, node:test/tsx, canonical hashing; no new package, schema or migration.

**Spec:** Recommended `docs/superpowers/specs/2026-10-20-negative-plan-projection-authority-design.md`; this draft's sibling `negative-plan-projection-canonical-spec-draft-v2.md` is the complete specification until Root places it.

Canonical plan placed after SourceMap PR301 delivery at actual origin/main `ef92b53fe4654e012308df13eace9ef269aa1951`; existing sole writer branch `fix/negative-plan-projection-authority-20261020`. SourceMap records are retained and its final-main build remains deferred until these known root fixes are delivered.

## Global constraints

- One SF source writer; preserve source checkpoint and dirty work, serialize after current PR301 review/delivery. Root alone updates the tracked File Map before edits and owns Git delivery.
- Use the exact eight initial product/test files in the spec; conditional integration extensions require recorded causal need before editing.
- Existing `PLAN_V2_PRD_MAX_BYTES` and `PLAN_SEMANTIC_PROPOSAL_V2_INPUT_MAX_BYTES` are both 4,194,304 bytes. Bound selected bare raw before body scanning; preserve PRD positive bound including the envelope-overhead compatibility case.
- Keep strict schema/task/ref/hash/cardinality/atomic proposal/projection/semantic compatibility, exact refusal transaction and one-claim/zero-retry gates.
- Do not import `result-schema.ts` at runtime in the pure helper; no producer/runner/context/parser/prompt imports in pure tests.
- No SourceMap, global parser, schema, capability, retry, spawner-classifier or attestation policy change; no provider, PM, live, migration, credential, deletion, browser/native or guard effects by authors.
- Actual original full8 remains all eight FAILED, fail/no_go. Code-zero/no-completion and missing historical poll bodies remain separate unknowns.
- Root retains current guards, exact process captures and source pins. A stream/model/pre-import failure is UNKNOWN, not a product RED.
- SF final necessary stock build occurs on reviewed actual clean main after all known root fixes and before rollout. No intermediate build/qualification claim; MC845 build is separate.

## Task 0: freeze scope and qualify the execution inventory

Files: only Root-selected canonical spec/plan and review records; no product changes.

Interfaces: consumes Root-selected A2/B2, current PR301 checkpoint and static drafts; produces exact SourceFileMap, source/test hashes, allowed effects and ownership checkpoint for Tasks 1–4.

- [x] Root finishes current SourceMap review/delivery and checks both repositories' status, current sole writer and main/PR state using actual evidence. Reconcile handoff freshness; do not overwrite source from historical checkpoint prose.
- [x] Root places/reviews the two canonical documents, records original all8 failure and independent code-zero unknowns, and freezes the eight-file initial map. No re-request of already-selected A2/B2.
- [ ] Audit actual import closures before each command: static ESM/type-only distinction, dynamic imports, top-level I/O, fixture imports, wrappers and runtime guard admission. Reuse the existing isolated guarded P3 composition for later integration; never widen its allowlist or copy a SourceMap-specific selection as new authority.
- [ ] Record exact toolchain, argv, source/test/fixture hashes, expected effects, original stdout/stderr/exit status and cleanup evidence. Current SourceMap P3 uses production Node26.4.0 because unchanged `NODE_OPTIONS=--test-isolation=none` is rejected by Node22; keep that established compatibility fact and guard composition. It does not prove automatic admission for these different integration files.

## Task 1: A2 actual old-resolver RED, then narrow transport GREEN

Files: `tests/execution-attempts/v3-plan-output-authority-v2.test.ts`; after causal RED, `src/execution/v3-plan-output-authority-v2.ts`, `src/installer/step-ops.ts`, `src/installer/steps/01-plan/module.ts`.

Interfaces: consumes existing `block`, `typedRejection`, `CONTAINED_GAME_TASK`, ledger extractor and resolver; produces resolver's optional `rawOutput?: string` contract, with unchanged `V3PlanOutputAuthorityV2` return union and exact raw V2 completion wiring.

- [ ] First change only the existing authority test. Import `canonicalizeProductSpecRejectionV1` from its current producer module and `hashCanonicalJson` from current canonical JSON module. Add the following test body for each reason code; the intermediate variable deliberately compiles against the old structural input and does not require a new symbol:

```ts
for (const code of [
  "PRODUCT_SPEC_TASK_AMBIGUOUS",
  "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
] as const) {
  it(`accepts exact bare V2 refusal ${code} without PRD`, () => {
    const ledger = extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK);
    const rejection = typedRejection({
      reasons: [{
        code,
        requirementRefs: ledger.requirements.map(item => item.id),
        message: "The exact requested runtime authority cannot be determined.",
      }],
    });
    const fence = block("product-spec-rejection-v1", rejection);
    const input = {
      task: CONTAINED_GAME_TASK,
      parsed: { status: `done\n${fence}` },
      rawOutput: `STATUS: done\n${fence}`,
    };
    const before = structuredClone(input);
    const actual = resolveV3PlanOutputAuthorityV2(input);
    assert.equal(actual.status, "rejection");
    if (actual.status !== "rejection") throw new Error("expected typed rejection");
    const canonical = canonicalizeProductSpecRejectionV1({
      task: input.task, rejection,
    });
    assert.deepEqual(actual.rejection, canonical);
    assert.equal(hashCanonicalJson(actual.rejection), hashCanonicalJson(canonical));
    assert.deepEqual(input, before);
  });
}
```

- [ ] Root runs the effect-audited existing test file and retains causal RED: `V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:0:0` from existing resolver, not fixture/module/import/type failure. Before implementation, retain exact old authority/test hashes, exception path `/prd`, stdout/stderr and original terminal result.
- [ ] Add only `rawOutput?: string` to the V2 input. Implement private bare selection/strict matching under the spec's byte bound; factor the identical rejection decoder if helpful. Compute UTF-8 byte length first; use the spec's constant-state non-regex leading-prefix recognizer, stopping at the opening fence or first incompatible character. It may scan long leading whitespace, with cost linear in prefix length, but never parses/scans the body before the selected bare byte check. No truncation-and-fallback, whole-output split/trim copy or hidden positive raw cap. Once selected, extra payload is a transport error even if PRD parses. Full-match accepted grammar is:

```text
surrounding whitespace
exact "STATUS: done" line
whitespace-only separation
exact "```product-spec-rejection-v1" line
one JSON object, LF or CRLF
exact "```" closing line
surrounding whitespace and end of input
```

Reject nonempty PRD/extra parsed siblings for a selected bare form; preserve ordinary PRD path when there is no bare candidate. No bare-positive fallback, synthetic PRD, arbitrary key concatenation or mutation. Use existing `V3PlanOutputV2RejectedError` for new transport diagnostics, with stable explicit codes documented in the implementation; preserve current established codes for existing PRD paths.
- [ ] Wire only `resolveV3PlanOutputAuthorityV2({ ...planInput, rawOutput: output })` in `completeStep`. Keep the V1 call and all transaction/projection/failure routing unchanged. Change prompt lines to conditional complete V2 bare/V1 PRD rejection examples and one-decision wording.
- [ ] Add table-driven cases in the same pure test, each constructing real ledger-bound rejection/proposal fixtures. Positive controls: legacy PRD rejection equals bare canonical bytes/hash; LF, CRLF, surrounding whitespace; untouched inputs; prior atomic proposal/projection and authorized semantic compatibility. Include near-cap accepted PRD with raw envelope overhead to ensure the new raw path does not reduce positive admission.

| Rejected input | Required outcome |
| --- | --- |
| Invalid JSON, extra schema property, wrong sourceTaskHash, unknown requirementRef | Existing strict decode/schema/canonical rejection |
| Two rejection fences; rejection plus build/semantic/split/compiler/legacy fence | Transport rejected; no chosen artifact |
| Prose before/after selected bare form; extra KEY; PRD after bare fence; exact raw plus populated parsed PRD/sibling | No competing authority or ignored payload |
| Wrong/missing STATUS; incomplete fence; absent raw and absent PRD | Refused; old absent-PRD path still 0:0 |
| Bare UTF-8 bytes over 4 MiB, including multibyte input with character count below cap, appended valid PRD and very long leading whitespace | Refused before full-body regex/JSON decode; never truncated into PRD fallback |
| Bare atomic build or semantic proposal | Refused; no raw positive fallback |
| PRD semantic-only proposal without compatibility flag | Existing `V3_PLAN_V2_SEMANTIC_ONLY_COMPATIBILITY_NOT_AUTHORIZED` |
| JSON-object outer output containing only status/rejection | No new bare JSON-object transport |

- [ ] Root runs identical causal witnesses plus entire focused authority file. Record both GREEN reason classes and unchanged positive controls. Review exact diff for transport ambiguity, byte-cap ordering, no mutation, V1 compatibility and unchanged runtime authority. Root commits only after the task review gate.

Future focused command, only after Root's current import/effect/guard audit:

```sh
node --import tsx --test tests/execution-attempts/v3-plan-output-authority-v2.test.ts
```

## Task 2: B2 mechanical V2 extraction, real V3 RED, strict dispatch GREEN

Files: new `src/evals/convergence-projection-v1.ts`, new `tests/evals/convergence-projection-v1.test.ts`, new `tests/evals/fixtures/convergence-operational-snapshot-v3.ts`; modify `src/evals/convergence-runner.ts`.

Interfaces: consumes unknown operational bodies plus `runId`; exports `evaluateConvergenceProjectionPairV1` and `ConvergenceProjectionPairEvaluationV1` exactly as in the spec. Runner keeps HTTP, polling and runtime result parsing. Fixture exports proposed `convergenceOperationalSnapshotV2Fixture(runId: string)` and `convergenceOperationalSnapshotV3Fixture(runId: string, reasonCode: "PRODUCT_SPEC_TASK_AMBIGUOUS" | "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED")`, returning full strict-schema parsed bodies. Those are test-only new helpers, not production APIs. Within the same mapped fixture file, also propose `convergenceAcceptedOperationalSnapshotFixtureV1(input: Readonly<{ runId: string; version: "v2" | "v3"; persistedAt?: string }>)`, returning a full strict-schema V2 or V3 accepted snapshot. This additional test constructor carries no production API or policy change.

- [ ] Mechanically copy existing V2-only `collectProjection` calculation to the new pure helper: exact ten capability keys, unavailable sentinel, V2 strict parsing/run/hash/submission checks, ack calculation and knownTerminal/pending/settled predicates. Replace server hash import with the exact local stable expression:

```ts
const { snapshotHash, generatedAt, ...state } = snapshot;
const invariants = state.invariants.map(({ observedAt, ...item }) => item);
const validHash = hashCanonicalJson({ ...state, invariants }) === snapshotHash;
```

Keep `result-schema.ts` and Zod `z` imports type-only for the result type. Produce an explicitly typed evidence object without runtime result-schema import. Runner calls `.parse` on all helper results:

```ts
const evaluated = evaluateConvergenceProjectionPairV1({
  runId,
  setfarm: setfarmRead.ok ? setfarmRead.value : undefined,
  missionControl: missionControlRead.ok ? missionControlRead.value : undefined,
});
return {
  ordinaryPending: evaluated.ordinaryPending,
  projection: ConvergenceProjectionEvidenceV1Schema.parse(evaluated.projection),
};
```

Keep the two settled concurrent reads exactly where they are. Remove old private unavailable/calculation code and unused V2/server-hash imports only if no remaining callers; do not duplicate policy between helper and runner.
- [ ] Build small deterministic V2 and V3 test fixtures from the full shape in existing `tests/evals/convergence-eval.test.ts:497–587`, copying data construction only, never importing that test/runner. V2 negative base has failed terminal run, complete attested migration19 source, all eleven V2 capabilities true, zero owner counters, disabled stop/resume and null accepted/deployment/transfer evidence. Retain all required empty arrays, IDs, runRef, timestamps and exact hash.
- [ ] V3 fixture adds schema v3, migrations `[19, 22]`, capability `operationalFailureAuthority: true`, one full terminalized failed request and exact `operationalFailure`. Populate every termination field from `OperationalTerminationRequestV1Schema`: ref/requestId/runRef, targetStatus/state, requestedBy/diagnostic/evidence, requestedAt/drainedAt/terminalizedAt/createdAt/updatedAt. Use these actual authority values:

```ts
const requestedBy = "setfarm.product-compiler.plan-refusal";
const evidenceSchema = "setfarm.v3-plan-clarification-termination.v1";
const cause = {
  schema: "setfarm.operational-failure-cause.v1",
  workflowStepId: "plan",
  boundary: "product_compiler.plan_refusal",
  failureClass: "contract_invalid",
  failureCode: "V3_PLAN_CLARIFICATION_REQUIRED",
} as const;
```

Use `extractTaskRequirementLedgerV1` and canonical rejection to construct true sourceTaskHash/rejectionHash/reasonCodes/requirementRefs with owner compiler, terminalFailure true and modelRedispatchBudget zero. Set evidence.operationalFailureCause to `cause`; use existing pure `createOperationalFailureIdentityV2({ requestedBy, evidenceSchema, operationalCause: cause, exactFailure: null })`; bind terminationRequestRef to the sole request ref. Finish with actual `computeRunOperationalSnapshotHashV3` and `RunOperationalSnapshotV3Schema.parse`. Fixtures must succeed independently through full schema before testing evaluator acceptance. No mocked `safeParse`, sanitized partial V3 or host/runtime data reads.
- [ ] For I1, construct a successful accepted fixture by copying the existing deterministic data recipes `acceptedSnapshotEvidence` and `transferSnapshotEvidence` in `tests/evals/convergence-eval.test.ts` into the mapped pure fixture file; never import the test harness/runner. Preserve all candidate/evidence/deployment/runtime/project projection/ack bindings using their existing pure constructors and schemas. Root audits the expanded fixture import closure before running it. The V3 branch has a completed terminal run, no canonical failure termination, `operationalFailure: null`, migrations `[19, 22]`, the same non-null release attestation and implementation capability as the accepted V2 baseline, `operationalFailureAuthority: true`, zero settled owner/outbox counters and matching full-schema candidate/receipt/ack evidence. Compute the full V3 hash and independently `RunOperationalSnapshotV3Schema.parse` before evaluator assertions. The V2 branch retains the existing complete accepted behavior.
- [ ] For the unequal transfer control, construct two independently valid accepted V3 snapshots for the same run with distinct `persistedAt` values. Use each value in the canonical project-record payload, then recompute `projectRecordHash`, `projectRecordRef`, acknowledgement `ackHash`, its outer `setfarm://v3-project-transfer-acks/<ackHash>` ref and the full snapshot hash. Keep candidate/deployment/source bindings exact and validate both full V3 schemas separately. This changes legitimate acknowledgement identity; editing a hash alone or manufacturing an invalid candidate/receipt relation is not the mismatch test.
- [ ] Root first proves V2 compatibility on mechanically extracted V2-only helper: settled pair, invalid/hash/mismatch/unavailable, partial, ordinary drain and transfer behavior remain equal to existing policy. Freeze extraction hash and evidence. This compatibility pass is not the B2 causal RED.
- [ ] Add both V3 reason-class witnesses against unchanged V2-only helper. They require exact complete settled match, all ten capability evidence values true and no transfer:

```ts
const value = convergenceOperationalSnapshotV3Fixture(
  "run-projection-refusal", "PRODUCT_SPEC_TASK_AMBIGUOUS",
);
const observed = evaluateConvergenceProjectionPairV1({
  runId: value.run.id,
  setfarm: value,
  missionControl: structuredClone(value),
});
assert.equal(observed.projection.exactHashMatch, true);
assert.equal(observed.projection.setfarmProjection, "complete");
assert.equal(observed.projection.missionControlProjection, "complete");
assert.equal(observed.projection.operationalSettled, true);
assert.equal(observed.ordinaryPending, false);
assert.equal(observed.projection.transferAcknowledged, false);
assert.ok(Object.values(observed.projection.capabilities).every(Boolean));
```

- [ ] Root retains causal RED: full strict V3 fixture valid, helper exists/imports successfully, but V2-only parsing returns unavailable/exactHashMatch false. Missing module, invalid fixture, import failure, or test skip does not qualify.
- [ ] Add literal strict V2/V3 dispatch. Both branches retain exact run/hash/submission checks. Never retry invalid V3 as V2, cast it through V2, erase version fields or relax schemas. Leave ten evidence capabilities/polling/ack/settlement policy unchanged.
- [ ] Resolve I1 before B2 GREEN/delivery with the successful accepted-pair control below for both versions. For V3, additionally assert `operationalFailure === null` after full V3 schema parsing. No failure identity is fabricated for an accepted run.

```ts
for (const version of ["v2", "v3"] as const) {
  const value = convergenceAcceptedOperationalSnapshotFixtureV1({
    runId: "run-projection-accepted", version,
  });
  if (version === "v3") {
    assert.equal(RunOperationalSnapshotV3Schema.parse(value).operationalFailure, null);
  }
  const ack = value.projectTransferAck?.acknowledgement;
  if (!ack) throw new Error("accepted fixture must contain a valid transfer acknowledgement");
  const observed = evaluateConvergenceProjectionPairV1({
    runId: value.run.id, setfarm: value, missionControl: structuredClone(value),
  });
  assert.equal(observed.projection.exactHashMatch, true);
  assert.equal(observed.projection.setfarmProjection, "complete");
  assert.equal(observed.projection.missionControlProjection, "complete");
  assert.equal(observed.projection.operationalSettled, true);
  assert.ok(Object.values(observed.projection.capabilities).every(Boolean));
  assert.equal(observed.ordinaryPending, false);
  assert.equal(observed.projection.transferAcknowledged, true);
  assert.equal(observed.projection.projectTransferAckHash, ack.ackHash);
  assert.equal(observed.projection.projectRecordHash, ack.projectRecordHash);
}
const acceptedLeft = convergenceAcceptedOperationalSnapshotFixtureV1({
  runId: "run-projection-accepted", version: "v3",
  persistedAt: "2026-07-13T12:00:00.000Z",
});
const acceptedRight = convergenceAcceptedOperationalSnapshotFixtureV1({
  runId: "run-projection-accepted", version: "v3",
  persistedAt: "2026-07-13T12:00:01.000Z",
});
RunOperationalSnapshotV3Schema.parse(acceptedLeft);
RunOperationalSnapshotV3Schema.parse(acceptedRight);
const unequal = evaluateConvergenceProjectionPairV1({
  runId: acceptedLeft.run.id, setfarm: acceptedLeft, missionControl: acceptedRight,
});
assert.equal(unequal.projection.transferAcknowledged, false);
assert.equal(unequal.projection.projectTransferAckHash, null);
assert.equal(unequal.projection.projectRecordHash, null);
assert.equal(unequal.projection.exactHashMatch, false);
```

- [ ] Add the strict matrix below with an explicitly valid fixture baseline. Rehash mutations intended to be internally valid; keep stale hashes only for corruption tests. For schema-negative cases, recompute hash so schema rejection is independently exercised. Do not “repair” fixtures by forcibly zeroing counters.

| Case | Expected |
| --- | --- |
| Same V3 body, different generatedAt | Same full hash, settled exact pair |
| Existing valid V2 pair, including accepted candidate/deployment/transfer success | Compatibility unchanged; accepted transfer true with exact returned hashes |
| Full strict accepted V3 pair, operationalFailure null, matching candidate/receipt/ack | Complete/exact/settled, all ten capabilities true, ordinaryPending false, transferAcknowledged true with exact returned ack/project-record hashes |
| Valid V2 versus valid V3 | exactHashMatch false; no normalization |
| Unknown version or extra top-level/capability field | unavailable, ordinaryPending false |
| Missing/spurious failure, incorrect cause/requester/ref/hash, nonfailed run with failure | Full strict V3 rejection |
| Capability true without migration22 or attestation; complete V3 capability false | unavailable |
| Implementation submission capability false on either otherwise valid partial source | unavailable |
| Wrong run ID, corrupted hash, changed authority/permissions without rehash | unavailable |
| Two valid unequal V3 bodies | mismatch cannot pass |
| Equal unavailable sentinel hashes | exactHashMatch remains false |
| Known terminal with real pending owner/outbox and consistent counters | ordinaryPending true, settled false |
| Same pair after valid zero-owner/all-published transition | settled true |
| Partial/unavailable source, nonterminal, unhealthy/invariant-bearing, counter/outbox inconsistency | Existing predicate/schema refusal as applicable |
| Refusal fixture action permissions, absent transfer | stop/resume remain false, transfer false |
| Separately full-schema-valid accepted V3 pair with unequal transfer identities and re-bound full hashes | No transfer acknowledgement; both returned transfer hashes null; no malformed fixture shortcut |

- [ ] Root runs V2 controls, identical refusal V3 causal witnesses and I1 accepted V3 success/valid unequal-transfer controls GREEN, re-audits runtime imports and performs scoped review before commit. Confirm no result-schema runtime import, server producer dependency or duplicate policy. Record no integration/provenance completion claim.

Future focused command after Root's audit:

```sh
node --import tsx --test tests/evals/convergence-projection-v1.test.ts
```

## Task 3: guarded exact integration and prompt coverage

Files: only Root-recorded necessary extensions from the spec: existing refusal integration, convergence eval integration and conditionally PLAN prompt tests. No additional production API or launcher.

Interfaces: actual `requestRuntimeCompletion` → owned/drained processing request → `runWithRuntimeCompletionOwner` → `completeStep(stepDbId, output, envelope, { deferContinuationToEffectLedger: true })`; existing completion/effect/termination repositories; existing `runConvergenceSuite` ports and private collector.

- [ ] Before editing, Root records why current V1/PRD integration cannot establish V2/raw wiring and why pure helper tests cannot establish real collector delegation. Select the exact extension files and scoped cases; audit eager/dynamic imports and existing guarded P3 admission for the selected test file.
- [ ] Preserve V1 PRD baseline. Add both V2 reason variants with exact `context` keys `{ task: TASK, plan_protocol: "v3", product_semantics_version: "v2", plan_output_authority_version: "product_build_v1" }` and raw output containing STATUS plus refusal fence, no PRD. Use existing real owner-backed run/claim/runtime/completion fixture, not a direct call to refusal helper or mocked transaction.
- [ ] In that existing test, query exact run-bound counts and assert **one PLAN step, one completed PLAN claim, retry_count 0, one bound compiler termination**, correct clarification record run/step/claim/task/rejection hash, owner_committed completion and expected single `v3.plan.clarification.recorded` effect. Retain existing before-termination assertion that design is waiting; after terminalization assert no downstream claim/attempt/packet/candidate/dispatch occurred, not just terminal labels. Check final owner/completion/effect states using existing repositories/SQL; preserve ordinary cleanup.
- [ ] Verify source/test wiring via the actual completion call. A test that supplies synthetic `parsed.prd` or bypasses `completeStep` fails this requirement. Terminate through existing `createRunTerminationRepository` lifecycle as the current test does; assert exactly one terminalized request with trusted typed operational cause and zero redispatch budget.
- [ ] Before B2 delivery, add an explicit I1 successful accepted V3 control in the already conditional `tests/evals/convergence-eval.test.ts`: feed full strict accepted V3 bodies through actual `runConvergenceSuite` → private collector → existing `ports.http.operationalSnapshot`. Require complete/exact/settled projection, all ten capabilities true, transferAcknowledged true and exact returned ack/project-record hashes on the accepted branch. Retain successful accepted V2 and existing accepted synchronization semantics; do not defer this source-level wiring control to fresh full8. This remains a guarded harness test, not proof of live DB/HTTP outcomes.
- [ ] Extend existing convergence eval harness through `ports.http.operationalSnapshot` with full strict V3 negative fixtures. Run actual `runConvergenceSuite` collector path; assert settled/exact projection, retained negative provenance predicates, no extra sync/retry, and disabled action permissions. Retain V2 compatibility and accepted transfer requirement. Exercise successful reads, rejected HTTP-port read, ordinary pending→published drain and cancellation uncertainty with existing poll bounds. Port fixtures prove wiring/policy, not real HTTP or DB outcomes.
- [ ] To bind actual DB refusal outcomes to producer truth, Root uses existing `buildRunOperationalSnapshot(database.sql, runId, options)` from `src/server/run-operational-snapshot.ts` within the admitted isolated integration context. Its actual result is `Promise<RunOperationalSnapshotV2 | RunOperationalSnapshotV3 | null>` and its public call opens repeatable-read/read-only SQL; imports/default artifact options are I/O-capable and must be audited. Establish fixture migration/attestation shape with the existing guarded fixture mechanisms, drain owners/outbox through existing owned lifecycle paths, validate full V3, then pass those actual bodies through the real collector harness. Do not edit counters/snapshot fields to manufacture settlement or claim the earlier requested-termination phase is settled. If existing P3 cannot admit that readback safely, record the exact remaining integration limit; do not replace it with crafted data or a new guard allowance. Source fixes remain unqualified until required real integration is proven.
- [ ] If exact prompt tests are absent, extend `tests/steps/01-plan.test.ts` in its guarded phase to assert V2 complete bare refusal, V1 PRD-wrapped refusal and one-decision wording. Prompt module eagerly reads markdown and imports guards/preclaim; never classify this as a pure test.
- [ ] Root executes only admitted selected cases through established P3 isolation, verifies actual DB selection for all clients, exact source/test pins, original process exit/EOF, owned cleanup and no live effects. No broad test wrapper/PM selection, provider calls, untracked-source shortcut or test-name-based safety inference.

## Task 4: review, delivery and bounded qualification

Files: reviewed eight-file diff plus exact recorded test extensions and canonical documents.

Interfaces: consumes causal Task1/Task2 evidence and Task3 actual integration; produces reviewed delivery evidence. Build/rollout/fresh full8 remain Root's guarded outcomes.

- [ ] Verify independent review I1's source-level coverage is satisfied by both accepted V3 pure and actual runner-port successes plus separately schema-valid transfer mismatch, with accepted V2 retained; static v2 text resolves the plan gap but does not claim these tests passed.
- [ ] Review exact delivered base→current head for spec coverage, no schema/hash/source/capability weakening, no hidden effect imports, genuine before/after failures and unchanged positive compatibility. Record known limits and exact first-failure provenance.
- [ ] Root performs proportional type checks and relevant scoped overlap tests only. Preserve current runtime/build guards and protected PM boundary; do not select entire npm test/test:scripts on convenience.
- [ ] Complete ordinary scoped PR/review/check delivery under existing owner authorization. Keep SourceMap and this root fix causally linked but independently reviewed; no direct commit to main or force-push.
- [ ] After all known necessary root fixes are delivered, Root runs the required SF stock build on actual reviewed clean main==origin/main, then existing controlled rollout/health gates. Do not claim PR301, this plan, a type check or MC845's separate PASS already proves that build.
- [ ] Fresh negative runs must prove one completed PLAN claim, retry_count zero, exactly one bound typed terminalized refusal, no downstream effects, full strict matching settled SF/MC projection and unchanged action/source/build admission. Fresh code-zero infra retry is a separate failed provenance outcome.
- [ ] Fresh maintained full8 must satisfy all eight current predicates, including all six positive cases. Preserve original all8 FAILED/no_go and failed rows/attempts unchanged. Report implementation, integration, build, delivery, rollout and full8 independently.

## Effect audit and completion limits

| Phase | Permitted effects after Root gate | Unproven by that phase |
| --- | --- | --- |
| This author | Static text reads; four new evidence documents; hashes | Any Source/test/build/runtime result |
| Source/test author | Scoped text edits only in frozen map | Actual causal RED/GREEN |
| Pure tests | Audited Node module reads and CPU schema/hash/compiler validation | DB transaction, claim/retry counts, dispatch or live settlement |
| Guarded integration | Owned isolated DB/process/temp-file effects under existing P3; exact cleanup records | Live I5 history or new provider-run qualification |
| Delivery/type checks | Reviewed commit/PR/type-check effects by Root | Final stock build/rollout |
| Final main build/rollout | Existing code-owned guards and explicit bounded runtime authority | Fresh all8 GO without actual full8 |

Implementation tasks remain unchecked at canonical placement; Task0 source-delivery/doc-placement checks are proven above. SourceMap Task1 and Task2 evidence are separately retained, not rerun or promoted here. Remaining unknowns are code-zero/no-completion cause, historical polling bodies/exclusive sentinel causation and fresh provider/runtime recurrence. Root retains exact next steps and limits in the current handoff before yielding.


Root File Map decision before edits: the eight initial paths are adopted. The two necessary existing integration extensions `tests/execution-attempts/v3-plan-refusal.integration.test.ts` and `tests/evals/convergence-eval.test.ts` are selected for Task3 because the current cases prove only V1/PRD completion and V2 runner output; they cannot prove the new wiring/accepted V3 branch. `tests/steps/01-plan.test.ts` remains conditional on exact rendered prompt coverage inspection. No other product/test/guard file is authorized. All product code and tests remain unimplemented at this canonical placement.
