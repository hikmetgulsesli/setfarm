# PLAN Semantic Checkpoint Guidance

**Goal:** Explain existing compiler constraints that exhausted a real planner's normal feedback retries before software generation.

**Design:** Keep the typed proposal, compiler, evidence gates, model limits and retry policy unchanged. Add three generic instructions to the existing v3 PLAN prompt: runtime invariants hold initially and at every checkpoint; post-action guarantees use their exact existing semantic coverage; observable assertions cannot use `changed` before the action or repeat a phase/property pair. This is a prompt correction within the working-software objective, not a new runtime feature.

**Observed evidence:** A complete original MiniMax report used `changed` in a before assertion. The next report fixed that error but duplicated an observable phase/property pair. The final report fixed that error but represented post-action values as invariant predicates, contradicting its initial state. Normal feedback reached the model; the compiler correctly refused all three reports. One earlier response ended at the existing token limit; a subsequent complete report fit that same limit, so no budget change is justified.

**Alternatives:** Blindly repeating unchanged input does not address these omissions. Relaxing validation or increasing retries would mask the mismatch. Explain the already enforced rules at the producer boundary instead. This can improve guidance but does not guarantee model convergence.

## File Map

- `src/installer/steps/01-plan/module.ts`: three instructions beside the existing invariant and observable rules, for all tasks using the corresponding protocol.
- `docs/superpowers/plans/2026-11-08-plan-semantic-checkpoint-guidance.md`: causal scope and verification record.
- Existing `tests/product-compiler/plan-product-semantics-v2.test.ts` and `tests/product-compiler/plan-product-build-proposal-v1.test.ts`: exercise actual prompt construction and strict proposal compilation. No new prose-presence test; agent behavior is measured by the next actual run.

## Execution

- [x] Recover complete original reports and exact compiler diagnostics; independently review the causal distinction.
- [ ] Add the three generic instructions without changing schemas, compiler logic, runtime guards, provider settings or retries.
- [ ] Run the two focused existing consumer suites and TypeScript checking; independently review the exact diff.
- [ ] Commit, push and deliver through reviewed GitHub PR; stock-build a clean pinned Source.
- [ ] After normal terminalization of the failed run, use maintained service transition and a fresh run to observe actual model behavior. Preserve the original failure and report software completion only after deployment evidence.

## Limits

The local suites cannot prove an LLM will follow these instructions. No generated product is manually patched, no original report is repaired, and no failed run is represented as passing. The existing token-limit refusal and unresolved Kimi supervisor failure remain separate evidence.
