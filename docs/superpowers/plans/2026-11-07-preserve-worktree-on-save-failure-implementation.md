# Preserve worktree on save failure implementation plan

> **For agentic workers:** Use the existing sole author with subagent-driven development; Root owns all delivery.

**Goal:** Do not remove a story worktree when its existing Git preservation fails.

**Architecture:** Keep the current synchronous API and successful save/push flow. Git failures or mismatched metadata refuse before removal; the caller logs a failed cleanup.

**Tech Stack:** TypeScript ESM, Node test runner, actual local Git and local bare remote fixtures.

**Spec:** docs/superpowers/specs/2026-11-07-preserve-worktree-on-save-failure-design.md

## Global constraints

Existing sole writer only; no live effects, DB, models, network remote or real historical cleanup. Preserve old public services and all runtime/retained material. No guard bypass or archive authority.

## One task: preservation is a prerequisite for removal

**Files:** src/installer/worktree-ops.ts; tests/worktree-ops.test.ts; spec and this plan.

**Interface:** `saveAndRemoveWorktree(repo: string, worktreeDir: string, storyBranch: string): void`; `removeStoryWorktree` retains its existing error logging.

- [x] Add real local-Git tests that create a committed primary, linked story worktree and local bare origin. A failing pre-commit hook must leave a dirty source file and node_modules symlink present after invoking the actual function. A rejecting pre-receive hook must leave the worktree present after a committed save. Capture genuine pre-fix REDs, preserving original argv/PID/exit/output privately.
- [x] Change only the preservation function so an absent target returns; missing/broken Git or branch mismatch refuses; status/stage/commit/push failures propagate before unlink/removal. After successful push, confirm unchanged HEAD and clean status; otherwise retain the directory. Use existing execFileSync and bounded errors, no injected production test ports.
- [x] Add focused negative cases for clean local commits with rejected push and invalid/mismatched metadata; assert bytes/symlink remain. Add a successful case: actual local remote resolves the saved story HEAD and worktree is removed. Cover absent target idempotence. Keep tests proportional and local.
- [x] Run the full focused file with exact argv `node --import tsx --test tests/worktree-ops.test.ts` (41/41, including 19 new cases), `node node_modules/typescript/bin/tsc --noEmit` and `git diff --check` (all exit 0). Freeze source and exact captures for independent review.
- [ ] Root reviews exact diff/captures, resolves actionable findings, stages only the four File Map files, commits/pushes/opens PR, checks exact-head review then merges. Branch stock build is known to require HEAD=origin/main; do not repeat or bypass it. Run genuine stock build on synchronized clean canonical main after reviewed merge.

A focused green or merged PR does not complete canonical migration/admission. No production restart or historical cleanup is part of this task.

## Author evidence and handoff

Private 0600 captures are under `.superpowers/sdd/2026-11-04-subscription-operational-integration/`, prefix `root-preserve-worktree-save-`. Separate `red-commit` (PID 91574) and `red-push` (PID 91650) both exited 1 at the assertion proving the actual temporary worktree was absent. `red-contract` records the broader pre-fix failures; its case-only branch rename initially failed in fixture setup on a case-insensitive filesystem. The repaired case was separately observed failing against original production source in `red-case-mismatch` (PID 94393); fixture setup failures are not counted as production REDs.

Initial v1 source/test verification: `green-final` PID 94665 passed all 40 tests, `noemit-final` PID 94664 exited 0, and `diffcheck-final` PID 94663 exited 0. At the v1 freeze, source and tests did not change after those checks; only documentation evidence notes were then updated. The freeze handoff records final four-file hashes and a subsequent whitespace check. No actual existing caller regression was observed. No broader suite, stock build, DB, service, model, network remote or historical cleanup was run; Root owns independent review and delivery.

## Accepted review finding and v2 freeze

- [x] Add one real primary repository initialized with `--separate-git-dir` under a managed-looking `.worktrees` path. Observe its actual deletion against the v1 postimage (`red-separate-primary-v2`, PID 99684, exit 1, retention `false !== true`). Add the narrow absolute-git-dir/common-dir primary refusal before any stage/commit/push; no caller or general cleanup changes.
- [x] Run the affected test file (`green-final-v2`, PID 99868: 41/41 passed, 19 preservation cases), TypeScript noEmit (`noemit-final-v2`, PID 99867: exit 0) and whitespace check (`diffcheck-final-v2`, PID 99866: exit 0). The added primary case also confirms original source bytes/dependency link, HEAD, unstaged index and empty remote refs on refusal. No existing caller regression was observed.

`root-preserve-worktree-save-author-handoff-v2.json` supersedes the v1 author freeze; final documentation notes and their whitespace check are included in its four-file hashes. Only this accepted review delta was added. Stock build, broader cleanup, archive/disposition, live activation and delivery remain outside this author checkpoint.
