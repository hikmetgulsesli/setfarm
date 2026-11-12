# Evidence absent-set change implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this single bounded task. Root owns all Git delivery and runtime effects.

**Goal:** A valid set creating an absent path must produce ordinary canonical evidence instead of quarantining completion.

**Architecture:** Preserve the strict canonical serializer and existing delta validation. Handle the missing-before sentinel at the delta change-detection caller only, after operation success. Exercise the real native evidence path and existing pure semantic seam.

**Tech Stack:** TypeScript ESM, Node test runner, existing native browser fixture and evidence factories.

**Spec:** `docs/superpowers/specs/2026-11-13-evidence-absent-set-change-design.md`.

## Global Constraints

- Use the existing sole writer on `fix/evidence-absent-set-change-20261113`, based on merged `4595c85c4b37e871ca8337ef59d7e328622c39cc`.
- Root alone stages, commits, pushes, merges and changes live runtime state. Implementation/review agents do not deliver.
- No global canonical/equality relaxation, undefined-to-null conversion, guard/cap/timer/role changes, generated-project patch or quarantine repair/replay.
- Missing after/expected/state instrumentation remains inconclusive; incorrect or unchanged persisted values remain non-pass.
- Genuine targeted RED precedes production edits; preserve actual command/PID/exit/hash evidence. Use focused checks only.
- Preserve the current case and all evidence, old namespace histories and npm cache. Never delete this plan's workspace at completion.

## Task 1: Preserve absence in exact delta change detection

**Files:** modify `src/evidence/canonical-evidence-runner.ts`; modify `tests/evidence/native-packet-v3-evidence-fixture.ts`, `tests/evidence/evidence-plan-v2.test.ts`, and `tests/evidence/produced-predicate-semantics.test.ts`.

**Interfaces:** retain `evaluateProducedPredicateSemanticsV1`, `createCanonicalEvidenceBundleV2`, `runImplementEvidenceIfRequested` and all production signatures. The only new test-only option is `nativeBrowserFixture({ persistence: true, persistedZeroFromAbsent: true })`.

- [ ] Add the test-only option before producer compilation. Inside the existing persistence branch, append this delta and bind that intent to it, retaining the original phase delta and observables:

```ts
if (options.persistedZeroFromAbsent) {
  primary.stateDeltas.push({
    key: "persisted_zero", stateKey: "game_phase", operation: "set",
    path: "/persisted_score", valueFrom: { kind: "literal", value: 0 },
  });
  primary.persistenceIntents[0].stateDeltaKeys = ["persisted_zero"];
}
```

The initial fixture state already has only `phase`; do not add the absent score or replace absence with null. Require persistence when the new option is set.

- [ ] Add a native test named `proves absent persisted zero through the genuine native browser bundle` using the existing helpers:

```ts
const value = await nativeBrowserFixture({ persistence: true, persistedZeroFromAbsent: true });
try {
  writeNativeBrowserRuntime(value);
  const result = await runNative(value, "absent-zero-001");
  assert.equal(result.ok, true, nativeDiagnostic(result, value.workdir));
  const bundle = assertExactNativePredicates(value, result);
  assert.equal(bundle.aggregateVerdict, "pass");
  const traceRef = bundle.artifacts.find(a => a.locator.endsWith("runtime-trace.json"))!;
  const trace = JSON.parse(fs.readFileSync(path.join(value.workdir, traceRef.locator), "utf8"));
  const flow = result.evidencePlan!.flows.find(f => f.actionRef === "ACT_START_GAME")!;
  const actionTrace = trace.interactions.find((i: { request: { id: string } }) => i.request.id === flow.actionInteractionId);
  const reloadTrace = trace.interactions.find((i: { request: { id: string } }) => i.request.id === flow.reloadInteractionId);
  assert.equal(Object.hasOwn(actionTrace.before.stateBridge.states.STATE_GAME_PHASE, "persisted_score"), false);
  assert.equal(actionTrace.after.stateBridge.states.STATE_GAME_PHASE.persisted_score, 0);
  assert.equal(reloadTrace.after.stateBridge.states.STATE_GAME_PHASE.persisted_score, 0);
  for (const kind of ["action_invocation", "persistence_round_trip"]) {
    const required = value.slice.contract.product.evidencePredicates.filter(p => p.required && p.kind === kind);
    assert.ok(required.length > 0);
    assert.ok(required.every(p => bundle.predicates.find(b => b.predicateRef === p.id)?.verdict === "pass"));
  }
} finally { value.cleanup(); }
```

- [ ] Run targeted RED with the original production condition:

```sh
node --import tsx --test --test-name-pattern='absent persisted zero' tests/evidence/evidence-plan-v2.test.ts
```

Expected failure is the actual `CanonicalJsonError` at bare `$` during delta evaluation, after valid native fixture compilation/browser interaction. If the test fails earlier, correct only the fixture/test and rerun RED. Do not edit production until this behavior failure is captured.

- [ ] Add narrow evaluator controls using the existing `produced`, `action` and `predicate` helpers. Produce the existing browser-game/high-score task; select `ACT_RECORD_HIGH_SCORE`, input `{ score: 0 }`, remove only the `highScore` property from a copy of initial `STATE_GAME_SESSION`, and evaluate its persistence predicate with the existing runtime fields. Cases: absent→0/action+reload0 passes; 0→0 fails; after1 versus input0 fails; missing after-path is inconclusive; missing reload-path is inconclusive; missing parent instrumentation is inconclusive; null→0 is a distinct valid change. Use real evaluator behavior, no equality/serializer stubs.

- [ ] Make the one-line production change after the existing `if (!operationPassed) return "fail"`:

```ts
if (beforeTarget === undefined || !deepEqual(beforeTarget, afterTarget)) observedExactChange = true;
```

- [ ] Run focused GREEN and production no-emit; inspect original exits and output:

```sh
node --import tsx --test tests/evidence/evidence-plan-v2.test.ts tests/evidence/produced-predicate-semantics.test.ts tests/product-compiler/canonical-json.test.ts tests/product-compiler/plan-semantic-proposal-v2.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

- [ ] Self-review the exact diff for unintended fixture coupling or weakened non-pass controls. Freeze source/test/diff hashes, real command/PID/exit evidence and a brief report in this plan's workspace. Return the report to Root; do not stage/commit/deliver.

## Root delivery and operation

Review the task and whole diff, commit/push a scoped PR, inspect actual GitHub checks, merge normally and perform the required clean stock build. Retain the historical failed completion. Runtime continuation/retirement is a separate evidence-gated operation using maintained controls, never a direct mutation of the quarantined row. No additional campaign or model rerun is implied by unit success.
