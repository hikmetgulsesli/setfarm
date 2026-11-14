# Playable Game Convergence Implementation Plan

> **For agentic workers:** Use subagent-driven development for independent review; root remains the sole source writer and delivery owner. Steps use checkbox syntax.

**Goal:** Exercise a real, task-complete game through existing native Setfarm machinery.

**Architecture:** Replace only the Kimi game holdout with a distinct source-bound contract. Preserve the other seven cases and all existing gates. Add the reviewed case ID to the finite manual progress catalog.

**Tech Stack:** TypeScript, Node test runner, Zod and existing JSON suite/oracle schemas.

**Spec:** `docs/superpowers/specs/2026-11-14-playable-game-convergence-design.md`

## Global Constraints

Eight cases; one baseline and one holdout per positive class; one repetition; rootCauseRepeatLimit3; runMs21600000/pollMs15000. Existing annual Kimi primary and MiniMax fallback. No HTML-only canvas rule, QA weakening, timer ABI, source guard bypass, failed-packet mutation or old-run rescue. Root is sole writer in the existing worktree.

### Task 1: Reviewed playable task and finite catalog compatibility

**Files:** the explicit paths in the spec File Map.

**Interfaces:** consume `ProductConvergenceSuiteV1Schema`, `evaluateTaskIntentOracleTaskBindingV1`, and signed worker progress frame APIs. Produce `game-playable-compositional-v2` in the Kimi holdout with exact task/oracle bytes and corresponding finite catalog ID.

- [x] Write focused assertions that remaining seven Kimi case objects equal the existing MiniMax contracts after profile removal; assert the old baseline is unchanged. Assert the missing new game has eight rendered action expectations and exact source-bound clauses, persistence and game-surface requirements.
- [x] Add signed progress frame acceptance/rejection regression using `type: progress`, `phase: case_running`, the new case ID and a real signed/verified frame. Reject `unreviewed-game-case`; preserve existing ID acceptance.
- [x] Run `node --import tsx --test tests/evals/subscription-model-suite.test.ts tests/execution-attempts/manual-control-worker-channel-v1.test.ts`; retain actual expected RED.
- [x] Replace only the Kimi holdout with the explicit three-lane single-round game task and oracle; each clause span is computed from the exact task text and checked by the real schema. Add only the new literal to `CatalogCaseId`.
- [x] Run the same two files for GREEN and `npx tsc --noEmit -p tsconfig.json`; retain actual outputs.
- [ ] Obtain independent task and whole-diff review; fix material findings and repeat only affected checks. Commit and push the scoped branch, open PR with actual evidence/limits and inspect GitHub exact-head review.
- [ ] Merge through protected normal merge, synchronize clean canonical main and run the normal clean release build. Use existing guarded transition and retained prior-run history; start one new clean reviewed game case only after current preflight/identity checks.
- [ ] Observe actual native result, inspect original artifacts and update current handoff. Passing fixture checks alone do not qualify software or the full suite.

## Test shape

```ts
const retained = kimi.cases.filter(c => c.caseId !== 'game-playable-compositional-v2');
assert.deepEqual(withoutProfile(retained), withoutProfile(baseline.cases.filter(c => c.caseId !== 'game-restart-compositional')));
assert.equal(evaluateTaskIntentOracleTaskBindingV1(game.task, game.oracle).mismatchCodes.length, 0);
const frame = signWorkerChannelFrameV1({ binding, direction: 'worker_to_broker', sequence: 1, body: progress, nonce });
assert.deepEqual(verifyWorkerChannelFrameV1({ frame, binding, direction: 'worker_to_broker', nonce }), frame);
assert.throws(() => signWorkerChannelFrameV1({ binding, direction: 'worker_to_broker', sequence: 1, body: { ...progress, currentCaseId: 'unreviewed-game-case' }, nonce }));
```

The test removes only executionProfile for preserved-case comparison. It does not normalize or rewrite oracle/task bytes, counts, timeouts or models. New-case assertions bind exact per-action text outcomes and source clauses; unknown IDs stay rejected.

## Actual source verification

Expected RED: 45 passed, two failures (missing reviewed case and finite catalog ID), exit1. GREEN: 47 passed, zero failures, exit0. TypeScript `npx tsc --noEmit -p tsconfig.json` session71548 closed exit0 with empty output. Private original logs and source-verification-v1.json retained under `.superpowers/sdd/2026-11-14-playable-game-convergence`. These results qualify fixture/schema compatibility, not game rendering, rollout or the full suite.
