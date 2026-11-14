# PLAN renderer scheduling boundary

## Goal and evidence

Allow the existing admitted user-action game semantics to be proposed without falsely treating render-only scheduling as a new product invocation ABI. Actual run e2fc918f failed PLAN with model-authored PRODUCT_SPEC_SEMANTIC_UNSUPPORTED for REQ_72C32EBF4D19AC93: the planner interpreted an internal RAF/setInterval painting loop as unsupported timer/system action invocation. The task explicitly keeps score/lane mutation outside that loop. This is separate from its first two broker REQUEST_TIMEOUT infrastructure retries. Failed e2fc and all originals remain preserved; no rearm or redispatch budget override.

Deployed source already restricts invocation interfaces per product action. It contains no general ban on implementation scheduling. A bounded real atomic compiler experiment accepted an added rendering constraint bound to the canvas surface with the existing user action and no new runtime source; changing that action trigger to timer was rejected with INVOCATION_INTERFACE_RENDERED_TRIGGER_MISMATCH. That experiment proves admission of this representation, not animation correctness or acceptance of every eight-action proposal.

## Decision

Add one precise PLAN prompt paragraph adjacent to the existing invocation rule. The unsupported timer/system boundary applies to semantic product action invocation. Internal renderer scheduling may paint or animate presentation while reading already declared state, without mutating any declared semantic state (including UI/session state) or invoking product actions. Represent a task-required rendering mechanism as a constraint with exact surface requirement refs; do not invent a timer/system action or claim that constraint traceability proves animation. Automatic gameplay state mutations still require a supported event-source contract or typed refusal.

Alternative task-only clarification would leave the generic boundary ambiguous; a timer ABI would be a wider feature and is unnecessary for this case. Do not add either. QA, evidence ownership, schemas, release/runtime guards, retries, providers and budgets remain unchanged.

## File Map

- `src/installer/steps/01-plan/module.ts`: clarify the existing v2 native proposal prompt boundary; no schema or invocation compatibility change.
- `tests/product-compiler/plan-product-build-proposal-v1.test.ts`: characterize a real accepted surface-bound rendering constraint with user-only action authority; mutate that same action to timer and prove rejection. No prompt substring test.
- This spec and `docs/superpowers/plans/2026-11-14-plan-renderer-scheduling-boundary.md`: causal scope and actual validation.

## Verification and limits

Use the existing atomic compiler test file and TypeScript, then independent reviews, exact-head GitHub review and normal protected merge. Build clean main and use the existing guarded transition before one new clean unchanged playable-v2 task. The observed model refusal is the live behavioral counterexample; the characterization is intentionally already accepted before the prompt edit and is not mislabeled a failing compiler regression. Only a new native result can qualify the planning guidance. No mirroring prompt-text assertion, new timer framework, HTML-only renderer constraint, false animation proof, gate weakening, old project rescue, new secret/account or extra paid API.

## Authority

The user explicitly authorized completing Setfarm, ordinary causal fixes, real tests and parallel review without routine confirmation. Standing Owner Authorization v1 covers this small prompt ambiguity fix. It grants no unrelated feature, destructive cleanup, privilege or guard bypass. Source writer remains the existing sole worktree.
