# Smoke keyboard probe applicability

## Evidence and objective

The real Source561 run `685d33a1-ba91-4b74-a9be-684c15e3267f` produced an application and supervisor evidence with 9/9 passing predicates. VERIFY completed and its receipt was accepted. Post-merge smoke and its confirmation then rejected the application solely because keyboard input changed none of four signals. The fixed task requires a Start button, visible canvas and persistent score; it does not require keyboard controls. The immutable causal proof is `ea07e09922466cbd3d8a85fb5176ff5dd271c5d05a8b4359a90aaf90f687b8c7` in the preceding private run workspace.

This root fix is necessary for the existing objective: let Setfarm generate software and reject real defects without inventing additional product requirements.

## Decision

Phase 15 in `scripts/smoke-test.mjs` currently treats any canvas, or ambiguous words such as “press start”, “jump” and “duck”, as authority to require a keyboard response. Require an explicit keyboard affordance instead. A canvas or a Start button alone is insufficient. Preserve recognizable keyboard instructions such as Space, Enter, arrow keys and WASD.

Do not disable smoke, change confidence thresholds, alter retry budgets, edit generated software, or make a special case for this run/task. Preserve keyboard dispatch, ambient control, four-signal comparison, responsive keyboard success and unresponsive/ambient-only failure. Every other smoke phase remains unchanged. This corrects applicability; it does not turn an unresponsive declared keyboard control into a pass.

## Verification

Exercise the actual production Phase 15 path, not a copied predicate or an assertion on source spelling. Before production edits, reproduce the false rejection on a canvas with button-only Start instructions and on ambiguous non-keyboard action text. Keep negative controls for explicit keyboard instructions with no response and ambient-only change, and a positive responsive keyboard control. Use a deterministic local harness with no live service/provider interaction; preserve original RED and GREEN exits. Run existing smoke static/invariant coverage and the normal clean release build after review and delivery. No unrelated test matrix.

## File map

| File | Responsibility |
| --- | --- |
| `scripts/smoke-test.mjs` | Minimal Phase 15 applicability correction |
| `tests/smoke-keyboard-applicability.test.ts` | Actual Phase 15 regression and retained positive/negative controls |
| This spec and corresponding plan | Causal scope, constraints and verification |

## Operational limits

Preserve the failed run and all accepted evidence. Retire it only through maintained normal cancellation. Root alone handles Git/PR, clean build and guarded rollout. Keep the sole writer; no generated-project rescue, raw SQL repair, credentials/grants, gate overrides, timer changes or destructive cleanup.
