# Evidence change detection for an initially absent path

## Actual failure and scope

Live Source4595 run `34fb5d86-f374-4357-a49a-902def397900` produced candidate `96f320b1b220de20b9d4c6b351cade3cfe9d463f`. Its authenticated implementation handoff declares an initial state without `high_score`, then a literal set of that path to numeric zero. The actual browser trace contains the absent before-path, zero after the action, and zero after reload. Completion `RCR_b3314fae-de54-470c-b9ba-fc3acf810473` was quarantined before an evidence bundle or completion plan was accepted.

The failure is `CanonicalJsonError: Unsupported canonical JSON value (undefined) at $`. The canonical serializer is correct. In `evaluateActionStateDeltas`, an absent JSON pointer intentionally becomes JavaScript undefined. The successful set is checked first, then change detection incorrectly passes that absence sentinel to strict canonical equality. The original error stack was not persisted; the call path is reconstructed from matching source and authenticated inputs.

Immutable evidence remains under the preceding operational workspace `.superpowers/sdd/2026-11-09-native-review-operational-success/resume-20261113`. Quarantine observation SHA256: `8047e6499de4da15d25416781619d4e707d83a4a44fcd2844972de6a34dbb779`; assembled handoff SHA256: `a41cf13f70d877b1a2660faa33801eb194d93dd60cee053f16a97971a9d6c0b5`; runtime trace SHA256: `998fc9b969a95ecdd04cd82e4d519a67b1bd481267778d83565d0ed817e03b13`. New task evidence belongs to this plan's own workspace; those originals are read-only inputs.

## Decision

Treat an absent before-path as a structural change only after the existing expected-value, after-target and operation-success checks have succeeded. The minimal caller change is:

```ts
if (beforeTarget === undefined || !deepEqual(beforeTarget, afterTarget)) observedExactChange = true;
```

This preserves absence versus JSON null and strict canonical comparison for present values. Missing state instrumentation, missing expected values and missing after-targets remain inconclusive. Incorrect after-values and unchanged zero-to-zero persistence remain failures. All existing packet/source, predicate identity, provenance and artifact guards remain unchanged.

Alternatives considered: changing global canonical serialization would weaken unrelated identities; catching the exception and fabricating an evidence verdict would conceal the caller defect. Neither is in scope. No global equality relaxation, undefined-to-null conversion, new recovery authority or runtime guard change is permitted.

## Regression and file map

- `src/evidence/canonical-evidence-runner.ts`: one absence-aware change-detection condition.
- `tests/evidence/native-packet-v3-evidence-fixture.ts`: one test-only `persistedZeroFromAbsent?: boolean` option; retain the normal phase delta, add a literal zero set to omitted `/persisted_score`, and bind the local-storage intent to that delta.
- `tests/evidence/evidence-plan-v2.test.ts`: execute the existing real native producer/browser/bundle path; require exact invocation and persistence predicates to pass, and prove absent before-path and numeric zero after action/reload.
- `tests/evidence/produced-predicate-semantics.test.ts`: use the existing exported evaluator and produced high-score action to cover absent-to-zero, zero-to-zero, incorrect value, missing action/reload targets and absent parent instrumentation.
- Existing strict canonical JSON and plan no-change tests remain controls.

Run a genuine targeted RED before production edits. A fixture, dependency or browser setup failure is not the regression. After the one-line fix, run only focused native/evaluator/serializer/plan controls and production no-emit. Root later performs the required clean stock build during normal reviewed delivery. No broad test matrix, provider calls or generated-project edits.

## Authority and operational limits

This is a causal root fix for the existing user-directed working-software objective under Standing Owner Authorization v1. Existing full/continue instructions authorize its ordinary reversible source/test/docs/PR work; no duplicate design approval is requested. Root retains delivery ownership and the existing sole writer. Preserve all new records, the current quarantine, prior namespace proofs and protected npm cache. Fixing code does not repair or certify this historical quarantined completion. Any later runtime action must use existing maintained controls and current guards; no raw SQL mutation, replay or invented successful closure.
