# Preserve worktrees when their save fails

## Problem and scope

Material review for the existing production transition found seven retained runtime roots, including unique working files and differing evidence. The current `saveAndRemoveWorktree` comments promise saving before removal, but actual Git status/add/commit/push errors are caught and removal continues. A model or repository error must not cause this path to erase the only working code. This is a causally required safety fix for reliable generated-software cleanup; it is not an archive/disposition mechanism or a way around current migration guards.

## Alternatives and selected design

Choose a narrow refusal on failed preservation. A general archive/retirement framework would be much larger and would need new custody and destination-census contracts; silently deleting after a logged error violates the existing contract. Keep the existing successful save/push/removal API, but fail before unlink/removal when Git identity, staging, commit or push cannot be confirmed. Require a linked-worktree marker, a target Git directory distinct from its common Git directory, the actual target root and common Git directory to match the supplied repository, and the actual checked-out branch to match the normalized story branch. Existing uppercase story-ID input still selects its lowercase branch. A clean worktree with local commits must also push successfully before removal. Missing, broken or mismatched Git metadata must retain the directory. Recheck local status and HEAD after a successful push so newly changed work is not knowingly discarded. No claim of atomic cross-process exclusion or complete archival preservation is made.

The method keeps its `(repo, worktreeDir, storyBranch): void` signature; absent target remains an idempotent return. Failures throw a bounded error and existing `removeStoryWorktree` logs the failed removal. A failure must preserve original source files and dependency symlink. No failing preservation branch may call `removeManagedWorktreePath` or prune.

## File Map

- `src/installer/worktree-ops.ts`: only the existing save-and-remove preservation path and adjacent message/comment required by it. No bulk cleanup, process signals, migration, role, retention or provider change.
- `tests/worktree-ops.test.ts`: focused real local-Git cases with temporary owned repositories/local bare remotes and failing hooks; no real project paths, network, database, models or production installation.
- This spec and matching implementation plan.

## Evidence and limits

Observe genuine pre-fix deletion after commit failure and push failure with the real function. After the fix verify exact file and symlink preservation in these failure cases, retained clean unpushed commits when push fails, missing/broken/mismatched metadata refusals, and normal successful save/push/removal with the expected source commit in the local remote. Verify absent target idempotence. Run focused tests, TypeScript noEmit and diff check; independent review then reviewed delivery and genuine clean-main stock build. Existing broader cleanup functions remain outside this fix and are not thereby certified safe or suitable for the seven historical roots.

## Operational constraints

Use the existing sole writer; no new worktree, DB, OS identity, service, model run or deployment. Live selected services remain unchanged. Preserve all seven roots, 270 missing Git registrations, old/new records and credentials. The approved 33 dependency cleanup is already complete and is not repeated. New-build live activation remains a separate guarded outcome.

## Author verification checkpoint

The initial v1 focused file run `node --import tsx --test tests/worktree-ops.test.ts` passed all 40 tests, including 18 preservation cases. Real pre-fix commit and push rejections deleted the owned temporary worktrees; separate private captures record those failures. The final cases cover rejection after saving, clean local commits, metadata/identity/branch refusal, status/index errors, post-push local drift, successful remote contents/removal and absent-target idempotence. Existing caller tests in the same file passed. TypeScript `--noEmit` and `git diff --check` passed. Independent review and Root delivery remain pending.

These checks cover this Git preservation path only. Ignored/untracked archival custody, cross-process atomic exclusion, other cleanup paths, historical-root disposition, production activation and a stock build are not certified by this checkpoint. No stock build was attempted on the author branch; the required clean-main build remains Root's delivery step.

Independent review identified that a primary created with `git init --separate-git-dir` also has a regular `.git` file. In a managed-looking path, the initial identity checks admitted it and filesystem fallback could delete the primary. A real temporary-primary regression observed this deletion against the v1 implementation before the narrow fix. The preservation path now refuses when the target's absolute Git directory equals its common Git directory, before staging, committing or pushing. The regression verifies retained source/dependency link and unchanged HEAD, index and empty remote refs. Final v2 focused verification passed 41/41 tests (19 preservation cases), TypeScript noEmit and diff check. This closes the accepted primary-identity finding within the same path; other cleanup and archival limits above remain.
