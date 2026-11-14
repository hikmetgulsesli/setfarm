# PLAN invariant traceability guidance implementation plan

> **For agentic workers:** Use subagent-driven-development for independent review; Root alone edits and delivers source. Execute this single task in the existing writer checkout.

**Goal:** Explain the existing invariant requirement inheritance and per-reference coverage rule to atomic PLAN workers.

**Architecture:** Change only the existing atomic prompt. Characterize the unchanged production compiler with a multi-requirement owning state and real local-key references; never normalize or repair generated artifacts.

**Tech Stack:** TypeScript ESM, Node test runner, tsx.

**Spec:** `docs/superpowers/specs/2026-11-14-plan-invariant-traceability-guidance-design.md`

## Global constraints

- Root is the sole source writer in the existing writer checkout.
- Keep schemas, compiler, gates, legacy PLAN, task, model profiles and all resource/retry budgets unchanged.
- Preserve the failed native case; no rearm, generated-artifact rescue or acceptance by SDK exit status.

### Task 1: Document the existing atomic traceability ABI

**Files:** Modify `src/installer/steps/01-plan/module.ts` and `tests/product-compiler/plan-product-build-proposal-v1.test.ts`; include the design and this plan.

**Interfaces:** Consume `compilePlanProductBuildProposalV1({task, proposal})` and its unchanged diagnostic/authority result. Produce only additional atomic prompt guidance; no runtime interface changes.

- [x] Add real compiler characterization using the existing two-requirement fixture. Assert the accepted binding inherits the full owning-state set. Select two observables with individually incomplete sets whose union covers the state; assert each missing reference is rejected, then restore truthful full coverage and assert compilation succeeds.
- [x] Run `env -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test tests/product-compiler/plan-product-build-proposal-v1.test.ts tests/steps/01-plan.test.ts`. Record that this characterization is already green before prompt editing; the native failed run supplies the behavioral baseline.
- [x] Add atomic-only guidance: every invariant inherits its owning state's complete `requirementRefs`; each `structured_semantic_coverage.coverageRefs` entry must resolve to an owner carrying that complete set. Require truthful requirement association and preservation of behavior; retain the prohibition on model-authored runtime requirement IDs.
- [ ] Repeat the focused command and run `node node_modules/typescript/bin/tsc --noEmit`. Review the exact diff and obtain independent task/whole reviews. Do not add implementation-mirroring prompt-string tests.
- [ ] Commit and push the scoped branch, obtain exact-head review and merge normally. Build clean main and deliver through existing guarded rollout. Start one fresh unchanged native game task and assess actual accepted PLAN/downstream behavior; do not claim convergence from these unit checks.
