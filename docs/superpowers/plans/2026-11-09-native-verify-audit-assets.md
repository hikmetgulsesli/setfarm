# Native Verify Audit Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Prepare compatible owned audit assets before launching an authenticated V3 subscription verifier.

**Architecture:** Reuse the existing native audit preparation and captured selected-profile reader. Select the asset mode from an actual run-row protocol, leaving inspection, legacy paths and all execution authority unchanged.

**Tech Stack:** TypeScript ESM, existing Node/tsx tests, real temporary Git worktrees and the actual strict coding-worktree inspector.

**Spec:** `docs/superpowers/specs/2026-11-09-native-verify-audit-assets-design.md`

## Global Constraints

- Sole Setfarm source writer: existing `.worktrees/setfarm-dashboard-cutover-controller-20261007-v1`, branch `fix/native-verify-audit-assets-20261109`, base `53bf796db062e309d5ee8717257708f407984804`.
- Keep `injectVerifyContext` signature and callers unchanged; no new production export or generic framework.
- Only actual DB protocol `v3` plus captured selected provider `kimi|minimax` selects existing `native-audit` assets.
- Do not trust `context.protocol`, implementation flags, or ambient environment to select the mode; selected-profile refusal propagates.
- Preserve strict inspector/native custody, legacy/Codex semantics, PR timing and every authority, credential, budget and runtime guard.
- No old worktree conversion, generated-project edits, runtime artifact edits, database writes, provider calls, service changes or manual replay.
- No dependency install, npm cache cleanup or Vite preview. Existing writer dependencies are a canonical symlink; use them read-only for focused tests/no-emit. Builds run only on a clean committed tree, without dirty-build or skip-guard flags.
- Root alone stages, commits, pushes, reviews/delivers releases. Preserve all workspaces and evidence.

## File Map

| File | Responsibility |
| --- | --- |
| `src/installer/step-ops.ts` | Import existing selected-profile reader; choose the existing asset mode in actual VERIFY injection |
| `tests/worktree-ops.test.ts` | Existing real Git/native-assets fixtures and AST loader; exercise actual injection through preparation and inspection |
| `tests/verify-retry-routing.test.ts` | Only a mechanical external-port binding if existing isolated injection fixtures require it; preserve all timer assertions |

## Task 1: Select owned native verifier assets at the actual injection boundary

**Interfaces:** Existing `ensureStoryAuditWorkdir(..., assets?: 'native-audit')`, `readSelectedFreshExecutionProfileV1()`, selected `pgGet` run protocol and existing strict `inspectSubscriptionCodingWorktreeV1(worktree, [])`.

- [ ] Extend the existing real-Git test fixture/AST loader to exercise actual `injectVerifyContext`, actual `ensureStoryAuditWorkdir` and actual worktree asset preparation. External DB returns an owned done story with a branch and the literal selected run protocol; the selected-profile port returns a closed Kimi/MiniMax profile. Use the fixture's tiny real dependency tree, .bin internal link and external reference directory. Do not recreate the production selector in the test.
- [ ] Call actual injection for V3 subscription, then require the actual strict inspector to accept its worktree. Assert top-level dependencies/references are owned material, not external aliases; dependency inode differs from the repo source. On current production the strict inspector must refuse because injection selected legacy aliases. Capture the genuine failing assertion and original PID/exit/output before production changes; fixture errors are not RED.
- [ ] Add same-context re-entry to show that native preparation starts before a review deferral and remains valid/idempotent when claimed later. Include legacy DB protocol with spoofed V3 context, V3 Codex/null-profile controls, and captured-profile/native-custody drift refusal. Reuse existing fixtures; no new isolated DB or model harness.
- [ ] Add the existing selected-profile reader import in `step-ops.ts`. Inside the existing `nextUnverified.story_branch` block, query `SELECT protocol FROM runs WHERE id = $1` for `step.run_id`. For V3 read the captured profile; use `profile?.providerId === 'kimi' || profile?.providerId === 'minimax'` to pass `native-audit` as the seventh workdir argument. Other paths pass undefined. Do not catch a profile refusal into a legacy fallback.
- [ ] Run the covering `node --import tsx --test tests/worktree-ops.test.ts`; run the existing VERIFY retry/timer file only if its isolated function binding is affected. Capture original commands/PIDs/exit/output. Run production `tsc --noEmit -p tsconfig.json` with the existing dependencies. Do not claim this typechecks test files unless that configuration includes them.
- [ ] Freeze the source/test diff and a task report with original RED/GREEN/no-emit evidence, limits and exact next review step. Implementation worker performs no Git mutation or dirty build.

## Delivery

Root checks original results, commits the scoped changes and performs a clean-tree stock build. Task and whole-branch review precede normal PR delivery. A clean main release is built before any guarded rollout. The old Source53/257f quarantined VERIFY18 and its accepted application/supervisor evidence remain unchanged; no manual replay or fabricated closure is permitted.
