# PLAN Renderer Scheduling Boundary Implementation Plan

> **For agentic workers:** Use subagent-driven independent review; root remains the sole source writer and delivery owner. Steps use checkbox syntax.

**Goal:** Prevent the actual e2fc renderer-only timer false refusal using the existing compiler contract.

**Architecture:** Clarify one native PLAN instruction, and characterize the already-supported constraint representation through the real atomic compiler. No schema or runtime behavior changes.

**Tech Stack:** TypeScript, native Node tests, existing ProductSpec/atomic compiler schemas.

**Spec:** `docs/superpowers/specs/2026-11-14-plan-renderer-scheduling-boundary-design.md`

## Global Constraints

No new timer/system invocation ABI, automatic state source, animation proof claim, QA/ownership guard relaxation, retry or timeout increase, provider change, failed-run rearm or cleanup. Keep the unchanged playable-v2 case and source-bound annual model profiles.

### Task 1: Existing boundary clarification and characterization

**Files:** the two source/test paths in the spec File Map.

**Interfaces:** consume containedGamePlanProductBuildProposalV1, extractTaskRequirementLedgerV1 and compilePlanProductBuildProposalV1. Produce one surface-bound constraint fixture accepted by existing atomic compilation, plus its timer-trigger mutation rejected by the unchanged compatibility guard.

- [x] Capture actual e2fc model-authored clarification and distinguish infrastructure retries; preserve failed run and all closed observer originals.
- [x] Run a bounded pre-edit real compiler experiment with an added renderer constraint: accepted shadow_compiled; timer-trigger mutation rejected by existing rendered-trigger mismatch. This is characterization, not a compiler RED.
- [ ] Add the characterization to the existing atomic compiler file, checking source-bound constraint and exact user invocation, then mutate trigger to timer and assert rejection.

```ts
const task = CONTAINED_GAME_TASK + '\nUse an internal requestAnimationFrame loop only to paint the game canvas while playing, without invoking a product action or changing declared application or domain state.';
const ledger = extractTaskRequirementLedgerV1(task);
const envelope = containedGamePlanProductBuildProposalV1();
const requirement = ledger.requirements.at(-1)!;
envelope.semantics.sourceTaskHash = ledger.sourceHash;
envelope.semantics.requirements.push({ id: requirement.id, classification: 'constraint', expectedSemanticKinds: ['surface'] });
envelope.semantics.surfaces.find(s => s.key === 'game_canvas')!.requirementRefs.push(requirement.id);
const result = compilePlanProductBuildProposalV1({ task, proposal: envelope });
assert.equal(result.status, 'shadow_compiled');
const invalid = structuredClone(envelope);
invalid.semantics.actions[0]!.trigger = { kind: 'timer' };
assert.equal(compilePlanProductBuildProposalV1({ task, proposal: invalid }).status, 'rejected');
```

- [ ] Add the precise native prompt paragraph: rendered scheduling reads declared state and paints presentation; it is not a timer/system product action unless it invokes product behavior or changes application/domain state. Keep exact constraint/surface provenance and require typed refusal for unsupported automatic gameplay state sources.
- [ ] Run `node --import tsx --test tests/product-compiler/plan-product-build-proposal-v1.test.ts` and `npx tsc --noEmit -p tsconfig.json`; retain actual results. No broad database suite or prompt-wording mirror test.
- [ ] Obtain independent scope/whole-diff reviews, commit/push the scoped branch and inspect GitHub exact-head review before protected normal merge.
- [ ] Build clean canonical main, preserve nineteen existing run histories and use the existing guarded rollout. Admit one new clean unchanged playable-v2 task only after actual service identity/preflight. Inspect the actual result before claiming improved planning or playable software.
