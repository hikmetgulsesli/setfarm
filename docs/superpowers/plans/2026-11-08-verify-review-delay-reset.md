# Preserve the same-PR review delay during pre-VERIFY cleanup

**Goal:** Preserve the original review-delay timestamp across repeated pre-VERIFY cleanup for the same PR.

**Architecture:** Separate six stale failure fields from full verified-story cleanup. The existing gate alone continues to decide elapsed time and changed-PR resets; full successful cleanup still deletes the timer pair.

**Tech Stack:** TypeScript ESM, node:test, existing TypeScript AST component fixtures with inert external ports.

**Spec:** Inline Design/authority and Minimal semantics below; no separate spec file.

**Design/authority:** Root adopted this bounded actual-run fix under Standing Owner Authorization. One existing sole writer, branch `fix/verify-review-delay-reset-20261108`, base9f0c2304a4c5a762953c4592dc34a61d8ec192e1. Root owns RED capture, review, delivery and live effects. No additional design approval or new feature is required.

**Cause:** Actual run5cfe6b78 claims16–18 each deferred a new300 seconds for the same PR. `injectVerifyContext` calls full verified-story cleanup for an already-supervised story; that cleanup deletes the pending PR URL and timestamp. The existing review gate then starts a fresh timer. Read-only proof: `root-5dfb-verify-review-delay-reset-readonly-v1.json`, SHA25667eaef88e03a4afebc4be46826e5a5221bbc7bb6471c7f87c49b0230c8118c4e.

**Minimal semantics:** Introduce private `clearStoryFailureContext(context)` for the existing six stale failure keys. Pre-VERIFY supervised-story cleanup uses it. Existing `clearVerifiedStoryFailureContext(context)` delegates to it and still deletes both review markers for actual successful verification/auto-verification. The unchanged gate compares PR URLs, preserving the original same-PR timestamp and starting the normal300-second wait for a changed PR. No new option, export, configuration, retry budget or wait policy.

## File Map / one causal task

- `src/installer/step-ops.ts`: failure-only helper and one pre-VERIFY caller; existing full-success cleanup retains marker deletion.
- `tests/execution-attempts/runtime-completion-scoped-routing.test.ts`: execute real existing AST function bodies with inert storage/Git ports; literal same-PR timestamp regression and real full-clear control. Actual gate statements may be executed for elapsed/new-PR controls without a full claim harness.
- `tests/claim-log-lifecycle.test.ts`: GREEN-only minimal update to the existing assertion naming the pre-VERIFY cleanup helper; source assertions do not qualify the new regression.
- This plan: scope, steps and original evidence.

## Global constraints

- Keep the exact300-second delay, claim selectors, runtime/SQL fences, retry limits and all other cleanup callers unchanged.
- No production exports/options/hooks, new configuration/framework, external provider calls or live state changes.
- Sole source author does not execute tests in these phases; Root captures original processes and owns delivery/build/rollout.

## Task1: isolate failure-only cleanup and prove the actual wait survives

- [x] PhaseA: add behavioral tests against unchanged production code. The primary test calls the real `injectVerifyContext` with supervisedUS-001, PR1 and a literal existing timestamp, then asserts that timestamp and persisted context remain unchanged while six stale failure fields disappear. Current code must fail at the missing timestamp, not at a missing helper/export/port. No production changes or test execution by the source author in PhaseA.
- [x] Root captured genuine RED: original NodePID61658 exit1, exactly actualundefined versus literal2026-11-08T10:40:54.035Z. The original test and unchanged production source were pinned. Focused command:

   `env -u SETFARM_INSTALLATION_DIR -u SETFARM_PG_URL -u SETFARM_TEST_PG_ADMIN_URL node --import tsx --test --test-name-pattern='verify pre-claim preserves the original same-PR delay timestamp' tests/execution-attempts/runtime-completion-scoped-routing.test.ts`

- [x] Root assigned GREEN. Add the private failure-only helper, keep full-clear completion behavior, and mechanically bind the new real declaration in the AST fixture. Original literal regression assertions remain unchanged. Execute the complete existing review-gate AST statements in controls for repeated same-PR injection after expiry, changed-PR fresh300-second wait and unelapsed240-second wait. Only external GitHub reads/storage and the clock are inert ports; no full claim harness is introduced.
- [x] Root ran/captured the focused existing component file and relevant lifecycle test, plus noEmit/diff check:

   `node --import tsx --test tests/execution-attempts/runtime-completion-scoped-routing.test.ts tests/claim-log-lifecycle.test.ts`

   `node node_modules/typescript/bin/tsc --noEmit`

   `git diff --check`

- [x] Freeze the bounded four-file author diff for independent review. Root handles verification, clean stock build and delivery. No provider/service/DB effects, generated artifact edits, commits or delivery by the author.

## Root verification checkpoint and test-only v2

Root's original focused PID71493 exit1 passed all10 behavioral/component cases and99/100 lifecycle cases. The sole failure was the pre-existing source finder for `let storyWorkdir = createStoryWorktree`, which no longer matches the earlier separate declaration/try-assignment shape. Root reproduced that exact failure against unchanged baseline9f with original PID72961 exit1; it is not a publication-order regression. Authorized test-only v2 finds the actual `storyWorkdir = createStoryWorktree(` assignment after the existing fast-forward call, explicitly asserts its presence, and retains every publication/provisioning ordering assertion. Production and behavioral test bytes remain frozen. Root final focused v2 original PID77437 exit0 passed110/110 tests with0 failures and0 skips. Preceding PID71493 partial failure and baseline PID72961 proof remain preserved. Root noEmit PID71492 exit0 remains applicable because production bytes are identical (SHA2565d0bc02be9f821625011c32bf98276710cbb740855665f03b745e4fa7c0ea9b9); diff check passed. These are unit/type/diff results only: no clean stock build or live fix is claimed. Independent review, commit/PR delivery, stock build and any rollout remain Root-owned.
