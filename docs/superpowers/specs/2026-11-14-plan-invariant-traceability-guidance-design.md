# PLAN invariant traceability guidance

## Problem and scope

The genuine MiniMax game run `23c39bd2-b8dc-44d0-ae87-aac20b2d0016` completed all three SDK reports normally. Native feedback corrected malformed JSON and unowned entity declarations. Its final proposal failed because a structured invariant coverage reference resolved to an action with fewer requirement references than the owning state.

The atomic producer derives every invariant binding's requirements from its owning state's complete requirement set. The runtime contract then requires **each** selected structured coverage reference's semantic owner to carry that complete set. The actual consumed prompt explained exact local references and prohibited model-authored runtime requirement IDs, but omitted this derivation and set obligation. The independently verified prompt-gap evidence is private; do not commit runtime artifacts or task-specific identifiers into instructions.

## Decision

Clarify this existing atomic PLAN ABI in its initial prompt. Explain whole-state requirement inheritance and the obligation on each selected coverage reference. Preserve truthful traceability: do not add unrelated requirement references, remove required behavior, or invent runtime requirement IDs merely to pass validation. Choose a genuinely enforcing, truthfully traced declaration or another admitted disposition that actually preserves the invariant.

An unchanged fresh run would measure model variance without addressing the observed instruction gap. Changing compiler acceptance or retry limits would change authority and is outside this repair. A compiler tool for the worker would be a separate feature and is unnecessary here.

## File map and constraints

- `src/installer/steps/01-plan/module.ts`: atomic-only instruction clarification.
- `tests/product-compiler/plan-product-build-proposal-v1.test.ts`: real compiler characterization of inherited requirements and each-reference coverage, including a positive control and a rejected union of incomplete references.
- This design and its implementation plan: scope, evidence, validation and delivery limits.

Keep schemas, compiler, gates, legacy PLAN, task, model profiles and all resource/retry budgets unchanged. Root remains the sole source writer in the existing writer checkout. Existing standing continuation authority covers this causal instruction repair; no new runtime capability is introduced.

## Verification and acceptance

Run the compiler characterization before and after the prompt edit, together with the existing PLAN tests, then TypeScript checking. The characterization is expected to pass before the edit: it proves the existing contract and is not a fabricated red test. The failed native run is the behavioral baseline; unit checks cannot prove model compliance.

Require independent reviews, exact-head GitHub review, a clean source build and guarded delivery before one fresh native case. Keep the failed case immutable. Only actual accepted native PLAN and subsequent software evidence establish convergence; neither prompt delivery nor normal SDK closure is software qualification.
