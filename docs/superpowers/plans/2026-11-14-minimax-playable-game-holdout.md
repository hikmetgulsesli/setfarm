# MiniMax Playable Game Holdout Implementation Plan

> Root is the sole source writer. Review agents independently assess the task
> and final diff; operational authors prepare private artifacts without effects.

**Goal:** Admit the same reviewed playable game task with the supported annual
MiniMax primary profile.

**Architecture:** Replace the MiniMax suite's existing game holdout with the
Kimi playable-v2 entry and the existing MiniMax profile. Both fixed recipes keep
eight cases and their native compiler/oracle/admission contracts.

**Tech stack:** TypeScript, node:test/tsx, versioned convergence JSON suites.

**Spec:** `docs/superpowers/specs/2026-11-14-minimax-playable-game-holdout-design.md`

## Global constraints

- Preserve the other seven cases, suite identity, configuration and budgets.
- Copy the exact playable-v2 task and oracle; use MiniMax's existing profile.
- Preserve runtime policy, PLAN primary selection and canonical guards.
- No software or full-suite success claim follows from contract tests.

## Task 1: Share the playable holdout across the two supported fixed recipes

**Files:**
- Modify `evals/suites/product-convergence-minimax-m31-flash-v1.json`.
- Test `tests/evals/subscription-model-suite.test.ts`.

**Interface:** Existing `ProductConvergenceSuiteV1Schema.parse` consumes each
fixed JSON suite; native recipe selection and admission consume its unchanged
suite identity and exact case/task/oracle hashes.

- [ ] Update the existing parsed-suite tests to preserve seven generic cases
  and exercise the reviewed playable contract for both model identities. Assert
  identical task/oracle across profiles. A missing MiniMax playable entry must
  fail, and a changed score requirement must remain schema-rejected.
- [ ] Run `node --import tsx --test tests/evals/subscription-model-suite.test.ts`;
  retain the expected missing MiniMax holdout failure before changing the JSON.
- [ ] Replace only the MiniMax game holdout with the Kimi entry, assigning
  `{providerId: "minimax", modelId: "minimax/MiniMax-M3.1-Flash"}`.
- [ ] Run the same test file plus
  `tests/execution-attempts/manual-control-worker-channel-v1.test.ts`, then
  `npx tsc -p tsconfig.json --noEmit`. Record original exits and actual counts.
- [ ] Obtain independent task and whole-diff review, commit the scoped change,
  push a PR and resolve actual exact-head review findings before normal merge.
- [ ] Build clean main and use the existing guarded release/bootstrap/profile
  transition. Admit one actual MiniMax playable case only after native preflight
  and owner checks. Retain current Kimi history and original observer results.
