# Verify Step — Story PR Gate

Task: verify one story PR. This role is a gatekeeper: it does not fix code,
edit source files, or create commits/pushes. If a real issue exists, return one
clear `STATUS: retry` report for the implement step. Only merge a PR that is
fully clean, then update local `main`.

## Context

VERIFY_WORKDIR: {{VERIFY_WORKDIR}}
MAIN_REPO: {{MAIN_REPO}}
STORY_WORKDIR: {{STORY_WORKDIR}}
REPO: {{REPO}}

- `VERIFY_WORKDIR` is where the story branch must be verified.
- `MAIN_REPO` is the canonical project repository for final `main` update.
- `STORY_WORKDIR` is the existing story-branch worktree, when this is a story PR.
- `REPO` is the primary verification workdir; it equals `STORY_WORKDIR` when present, otherwise `MAIN_REPO`.
- `{{BRANCH}}` — run/setup branch; not the story merge target
- `{{CURRENT_STORY}}` — story being verified
- `{{PR_URL}}` — story PR being verified
- `{{PREFLIGHT_ANALYSIS}}` — static analysis report
- `{{PR_COMMENTS}}` — Copilot/human review comments
- `{{PR_CHECK_STATE}}` — passing/failing/pending
- `{{PR_MERGEABLE}}` — MERGEABLE/CONFLICTING/UNKNOWN
- `{{PR_MERGE_STATE_STATUS}}` — CLEAN/DIRTY/BLOCKED/UNKNOWN
- `{{PLAYWRIGHT_REPORT}}` — runtime/visual smoke report
- `{{SUPERVISOR_MEMORY}}` — durable manager decisions from earlier phases

## Role Boundary

Forbidden:

- Editing source, test, CSS, config, package, or asset files.
- Running `git add`, `git commit`, or `git push`.
- Trying to repair review/smoke findings yourself.
- Re-running the same failing command repeatedly without code changes.
- Turning the verify step into open-ended debugging work.

Allowed:

- Gathering evidence with `git fetch`, `git checkout`, `git status`,
  `gh pr view`, `gh pr diff`, and `gh api`.
- Running each build/test/smoke command once.
- Retargeting PR metadata to `main` when the PR base is wrong.
- Merging the PR when it is fully clean.

## Bounded Manager Protocol

Verify is an evidence gate, not a broad manual source review.

- After the claim summary and PR metadata, run deterministic evidence first:
  lint/build/test/smoke as configured.
- Do not read many source/test files before those commands. If build/test/lint
  fail, immediately return `STATUS: retry` with the first blocker.
- If deterministic evidence passes, inspect only PR-changed files needed to
  prove acceptance criteria or explain the first blocker.
- Do not open unrelated source files, generated screen sources, or full test
  suites as a substitute for running the configured commands.

## Required Flow

1. `cd "{{VERIFY_WORKDIR}}"`.
   - If `{{STORY_WORKDIR}}` is non-empty, this is the authoritative checkout
     for the story branch. Do not check out the story branch inside
     `{{MAIN_REPO}}`; Git worktree ownership will reject it and it wastes the
     verify budget.
   - Use `{{MAIN_REPO}}` only for final `main` refresh after the PR is merged.
2. `git fetch origin --prune`.
3. If `{{PR_URL}}` is empty, stop immediately. Do not inspect source files,
   read generated screens, run build/test, or infer a branch. Return:
   `STATUS: fail` and `FEEDBACK: VERIFY_INFRA_PR_URL_MISSING — Setfarm must create/reuse the story PR before reviewer runs.`
4. Read PR metadata:
   - `gh pr view "{{PR_URL}}" --json state,headRefName,baseRefName,mergeable,mergeStateStatus,reviews,comments,statusCheckRollup`
   - For inline comments: `gh pr diff "{{PR_URL}}"` and `gh api repos/<owner>/<repo>/pulls/<num>/comments`.
   - If `baseRefName` is not `main`, retarget the PR:
     `gh api -X PATCH repos/<owner>/<repo>/pulls/<num> -f base=main`.
5. If the PR is not open:
   - If it is `MERGED`, run `git checkout main && git pull --ff-only origin main`,
     then still evaluate the build/test/smoke evidence below before returning.
   - Otherwise return `STATUS: retry` with the reason.
6. Check out or align the PR branch in the verification workdir:
   - `HEAD_BRANCH=$(gh pr view "{{PR_URL}}" --json headRefName --jq .headRefName)`
   - `git fetch origin "$HEAD_BRANCH" main --prune`
   - If `{{STORY_WORKDIR}}` is non-empty, stay in `{{STORY_WORKDIR}}` and
     confirm `git branch --show-current` is `$HEAD_BRANCH`. If it differs,
     return `STATUS: retry` with `VERIFY_WORKDIR_BRANCH_MISMATCH`; do not try
     to steal that branch from another worktree.
   - If no story workdir exists, run
     `git checkout -B "$HEAD_BRANCH" "origin/$HEAD_BRANCH"` in `{{VERIFY_WORKDIR}}`.
   - If the local branch diverged, do not `git pull` merge; `origin/$HEAD_BRANCH` is the source of truth.
7. Read review comments, failing checks, `{{PREFLIGHT_ANALYSIS}}`,
   `{{PLAYWRIGHT_REPORT}}`, `{{SUPERVISOR_MEMORY}}`, and acceptance criteria.
   Do not inspect source files in this step; first run the deterministic
   commands in step 8.
   - If a real issue exists, do not fix it. Return `STATUS: retry`.
   - First blocker wins. After finding a real build, test, smoke, review,
     acceptance, or merge blocker, stop investigating and return
     `STATUS: retry` with concise evidence.
   - Retry feedback must respect the current story's writable scope. Do not
     tell implement to edit `src/types/*`, App shell, routing, config, or other
     shared/out-of-scope files unless those files are listed in the story's
     scope_files. For screen-only typing defects, ask for a local display/render
     type or adapter in the owned screen instead of widening shared exported
     domain types.
   - Runtime/smoke/visual/accessibility failures on current `main` are still
     blockers for this run. Do not dismiss them as "pre-existing" or "not
     introduced by this PR"; report them so implement can create a batched
     QA-FIX story.
   - Missing ESLint config is not a real lint failure; do not add config unless the story explicitly asks for it.
8. Build/test/smoke verification before source review:
   - `{{LINT_CMD}}`
   - `{{BUILD_CMD}}`
   - `{{TEST_CMD}}`
   - Never run Vitest in watch mode. If `npm test` maps to `vitest`, use
     `npm run test:run` or `npx vitest run` instead.
   - Run test commands with a clean test environment. If `NODE_ENV` is
     `production`, unset it or run with `NODE_ENV=test`; React/Vitest tests
     failing only because production React disables `act()` are environment
     failures, not source defects.
   - Skip empty or `true` infrastructure commands.
   - Run each command at most once. If it fails, immediately return
     `STATUS: retry`; do not run extra commands to "get the full picture".
9. Focused source/acceptance review:
   - If commands pass, inspect only files changed by the PR and only as much as
     needed to prove acceptance criteria or explain the first blocker.
   - Do not read unrelated source/test files for general quality hunting.
10. Final blocker check before merge:
   - PR state must be `OPEN`.
   - There must be no blocking review comments, failing checks, smoke failures,
     build/test failures, merge conflicts, or acceptance mismatches.
   - `git status --short` must be clean; verifier must not have changed source.
11. If the PR is fully clean:
   - `gh pr comment "{{PR_URL}}" --body "Verified: build/test/smoke checked; merging."`
   - `gh pr merge "{{PR_URL}}" --squash --delete-branch`
   - If merge fails, immediately return `STATUS: retry` with the blocker
     reason. Do not inspect, rebase, resolve, or repair merge conflicts.
12. Confirm merge:
    - `gh pr view "{{PR_URL}}" --json state --jq .state` must return `MERGED`.
13. Update local main in the canonical repo:
    - `cd "{{MAIN_REPO}}"`
    - `git fetch origin main`
    - `git checkout main`
    - `git pull --ff-only origin main`
    - `git status --short` must be clean.

## Time Budget

Produce the first meaningful verification result within 8 minutes. If a clean
merge is not possible within 8 minutes, return `STATUS: retry` with the evidence
already collected. Verify must not become an open-ended debug/fix session.

## Output

```
STATUS: done|retry|skip|fail
FEEDBACK: <short reason when retry/fail>
```

`STATUS: done` is allowed only after the PR is actually `MERGED`, local `main`
has been updated, and current-main runtime/smoke evidence is clean. For
`STATUS: retry`, provide 1-5 actionable bullets; do not write long analysis.
