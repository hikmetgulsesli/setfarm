# Stitch Nearest Surface Feedback Implementation Plan

> **For agentic workers:** Use subagent-driven-development for this single bounded task. Root owns delivery.

**Goal:** Give design retries the exact existing nearest-surface requirement that the selector rejected.

**Architecture:** Add one diagnostic to the existing selector output and clarify its existing correction line. Reuse semantic retry evidence unchanged.

**Tech Stack:** TypeScript, Node test runner, existing local browser capture fixture.

**Spec:** `docs/superpowers/specs/2026-11-08-stitch-nearest-surface-feedback-design.md`

## Global Constraints

- Sole writer: existing controller worktree, branch `fix/stitch-nearest-surface-feedback-20261108`, base `4093e08973c99e988a14cd96cc87b78967452979`.
- Preserve selector acceptance, schemas, policies, two-attempt budget, all capacities, Kimi LOW fix, credentials and guards.
- Derive references from validated placement/rendered data; production code contains no game-specific identifiers.
- Keep original PCA candidates, failures and captures immutable. No provider call is needed for local verification.

## Task 1: Carry the missing requirement through the retry pipeline

**File Map:**
- Modify `src/product-compiler/producers/stitch-target-candidate-selection-v2.ts`: append the specific diagnostic for one unambiguous wrong-surface slot element.
- Modify `src/product-compiler/design-source-semantic-retry-corrections-v1.ts`: clarify closest-surface meaning in the existing slot correction.
- Modify `tests/product-compiler/stitch-target-candidate-selection-v2.test.ts`: extend its real browser fixture for nested, absent and duplicate control placement; exercise the complete retry-data boundary.
- Modify `tests/product-compiler/design-source-semantic-retry-evidence-v1.test.ts` only as required for the intentional fixed correction text.

**Interfaces:** Existing selector, `projectDesignSourceSemanticRetryEvidenceV1`, and `compileDesignSourceSemanticRetryCorrectionsV1` keep their signatures. The existing diagnostic schema carries the added information.

- [ ] Extend the browser fixture with `controlSurface?: 'declared' | 'nested' | 'none'`, `duplicateControl?: boolean`, and optional `stageId?: string`. Keep defaults unchanged. Use a valid `DSGS_` stage for the retry projection.
- [ ] Write the causal regression first: capture a unique control inside the wrong declared nested surface, assert rejection, then assert a `control_contract` check ending `@nearest_surface` carries literal `expectedValue: 'SURF_PLAY_PAGE'` and the actual contained surface. Project the actual returned selection with a matching canonical selection-artifact ref, compile corrections, parse the emitted `semantic_requirement:` JSON and assert that required surface survives. Correct placement remains selected; duplicate slot elements have no single-element nearest-surface diagnostic; null nearest surface omits observedValue.
- [ ] Preserve the original RED before editing production. It must fail because the specific diagnostic/value is absent, not because of fixture/schema/capture setup.
- [ ] Inside the existing per-placement selector loop, add this shape only when there is exactly one slot element and its nearest surface differs:

```typescript
check({
  kind: 'control_contract',
  semanticRef: `${placement.controlSlotRef}@nearest_surface`,
  expectedCount: 1,
  elementRefs: [element.elementRef],
  expectedValue: placement.surfaceRef,
  ...(element.nearestSurfaceRef === null ? {} : { observedValue: element.nearestSurfaceRef }),
})
```

- [ ] Append the closest `[data-surface-id]`/`owning_surface_ref` instruction to the existing `CANDIDATE_CONTROL_SLOT_SET_MISMATCH` correction. Retain the existing same-element instruction and all projection/privacy limits.
- [ ] Run focused selector and retry-evidence tests plus TypeScript no-emit. Review the whole diff independently. Root commits, pushes, reads PR feedback and integrates normally. Run the clean stock build on merged main before normal rollout and one unchanged real case; local tests do not prove provider convergence.
