# Verify Step — Story PR Gate

Task: verify one story PR. This role is a gatekeeper: it does not fix code,
edit source files, or create commits/pushes. If a real issue exists, return one
clear `STATUS: retry` report for the implement step. Only merge a PR that is
fully clean, then update local `main`.

## Context

- `{{REPO}}` — project root directory
- `{{BRANCH}}` — run/setup branch; not the story merge target
- `{{CURRENT_STORY}}` — story being verified
- `{{PR_URL}}` — story PR being verified
- `{{PREFLIGHT_ANALYSIS}}` — static analysis report
- `{{PR_COMMENTS}}` — Copilot/human review comments
- `{{PR_CHECK_STATE}}` — passing/failing/pending
- `{{PR_MERGEABLE}}` — MERGEABLE/CONFLICTING/UNKNOWN
- `{{PR_MERGE_STATE_STATUS}}` — CLEAN/DIRTY/BLOCKED/UNKNOWN
- `{{PLAYWRIGHT_REPORT}}` — runtime/visual smoke report

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

## Required Flow

1. `cd "{{REPO}}"`.
2. `git fetch origin --prune`.
3. Read PR metadata:
   - `gh pr view "{{PR_URL}}" --json state,headRefName,baseRefName,mergeable,mergeStateStatus,reviews,comments,statusCheckRollup`
   - For inline comments: `gh pr diff "{{PR_URL}}"` and `gh api repos/<owner>/<repo>/pulls/<num>/comments`.
   - If `baseRefName` is not `main`, retarget the PR:
     `gh api -X PATCH repos/<owner>/<repo>/pulls/<num> -f base=main`.
4. If the PR is not open:
   - If it is `MERGED`, run `git checkout main && git pull --ff-only origin main`, then return `STATUS: done`.
   - Otherwise return `STATUS: retry` with the reason.
5. Check out the PR branch:
   - `HEAD_BRANCH=$(gh pr view "{{PR_URL}}" --json headRefName --jq .headRefName)`
   - `git fetch origin "$HEAD_BRANCH" main --prune`
   - `git checkout -B "$HEAD_BRANCH" "origin/$HEAD_BRANCH"`.
   - If the local branch diverged, do not `git pull` merge; `origin/$HEAD_BRANCH` is the source of truth.
6. Read review comments, failing checks, `{{PREFLIGHT_ANALYSIS}}`,
   `{{PLAYWRIGHT_REPORT}}`, and acceptance criteria.
   - If a real issue exists, do not fix it. Return `STATUS: retry`.
   - Missing ESLint config is not a real lint failure; do not add config unless the story explicitly asks for it.
7. Build/test/smoke verification:
   - `{{LINT_CMD}}`
   - `{{BUILD_CMD}}`
   - `{{TEST_CMD}}`
   - Never run Vitest in watch mode. If `npm test` maps to `vitest`, use
     `npm run test:run` or `npx vitest run` instead.
   - Skip empty or `true` infrastructure commands.
   - Run each command at most once. If it fails, return `STATUS: retry`.
8. Final blocker check before merge:
   - PR state must be `OPEN`.
   - There must be no blocking review comments, failing checks, smoke failures,
     build/test failures, merge conflicts, or acceptance mismatches.
   - `git status --short` must be clean; verifier must not have changed source.
9. If the PR is fully clean:
   - `gh pr comment "{{PR_URL}}" --body "Verified: build/test/smoke checked; merging."`
   - `gh pr merge "{{PR_URL}}" --squash --delete-branch`
   - If merge fails, return `STATUS: retry` with the blocker reason.
10. Confirm merge:
    - `gh pr view "{{PR_URL}}" --json state --jq .state` must return `MERGED`.
11. Update local main:
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

`STATUS: done` is allowed only after the PR is actually `MERGED` and local
`main` has been updated. For `STATUS: retry`, provide 1-5 actionable bullets;
do not write long analysis.
