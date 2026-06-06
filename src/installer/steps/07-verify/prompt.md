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

- Editing source/test/CSS/config/package/assets; running `git add`, `git commit`, or `git push`.
- Repairing review/smoke findings yourself or repeating failing commands without code changes.
- Open-ended debugging. Stop at the first proven blocker.
- Writing ad hoc Playwright/Puppeteer/browser scripts for an already reported
  `PLAYWRIGHT_REPORT` or supervisor visual blocker.

Allowed:

- Evidence commands: `git fetch`, `git checkout`, `git status`, `gh pr view`, `gh pr diff`, `gh api`.
- Run each build/test/smoke command once; retarget PR base to `main`; merge only a fully clean PR.
- Use configured bounded smoke or precomputed `PLAYWRIGHT_REPORT`.

## Bounded Manager Protocol

Verify is an evidence gate, not a broad manual source review.

- After the claim summary and PR metadata, run deterministic evidence first:
  lint/build/test/smoke as configured.
- Do not read many source/test files before commands. If build/test/lint fail, immediately return `STATUS: retry`.
- If deterministic evidence passes, inspect only PR-changed files needed to prove acceptance criteria or explain the first blocker.
- Do not open unrelated source files, generated screens, or full test suites as a substitute for commands.
- Negative evidence finalization: when a required behavior appears absent in
  PR-changed source (for example keyboard handlers, pointer/touch handlers,
  disabled/aria-disabled states, route/action wiring, or persistence), run at
  most one focused source search and one narrower confirmation search. If both
  show the behavior is missing, stop and return `STATUS: retry`; do not keep
  refining grep filters, reading more files, or repeating equivalent searches.
- No project-source matches after excluding generated artifacts is enough negative evidence.
- If story/PRD/design/AC require user keyboard/input behavior, programmatic `window.app` or test-bridge actions are not a substitute for DOM/event handlers unless explicitly requested.

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
   Do not inspect source files here; first run deterministic commands in step 8.
   - If a real issue exists, do not fix it. Return `STATUS: retry`.
   - If `PLAYWRIGHT_REPORT`, `SUPERVISOR_EVIDENCE`, or supervisor memory
     contains a blocker such as `dead_control`, `broken_link`, `preview_failed`,
     `console_error`, `screenshot_diff`, or `visual blocker`, stop immediately
     and return `STATUS: retry` with that evidence. Do not try to reproduce it
     with a new browser script or dev server.
   - First blocker wins. After a build/test/smoke/review/acceptance/merge blocker, return `STATUS: retry`.
   - Missing user-facing event handling is a real acceptance blocker. If
     keyboard, pointer/touch, button disabled state, or route/action behavior is
     required and the focused source review proves it is absent, return
     `STATUS: retry` immediately after the confirmation search.
   - Retry feedback must respect current story scope. Do not ask edits to
     `src/types/*`, App shell, routing, config, or other shared files unless listed in scope_files.
   - Runtime/smoke/visual/accessibility failures on current `main` are still
     blockers for this run. Do not dismiss them as "pre-existing" or "not
     introduced by this PR"; report them so implement can create a batched
     QA-FIX story.
   - Missing ESLint config is not a real lint failure; do not add config unless the story explicitly asks for it.
8. Build/test/smoke verification before source review:
   - `{{LINT_CMD}}`, `{{BUILD_CMD}}`, `{{TEST_CMD}}`
   - Never run Vitest in watch mode. If `npm test` maps to `vitest`, use
     `npm run test:run` or `npx vitest run` instead.
   - Do not run long-lived servers in the foreground. Never execute
     `npm run dev`, `npm run preview`, `vite`, `next dev`, or similar commands
     as a blocking verification command.
   - If runtime/visual evidence is required but `PLAYWRIGHT_REPORT` and a
     bounded smoke command are both unavailable, return `STATUS: retry` with
     the missing evidence. Do not improvise an unbounded manual dev-server
     session.
   - If `PLAYWRIGHT_REPORT` is present and failing, it is already the bounded
     smoke evidence. Do not run Python Playwright, `npx playwright`, or custom
     browser harnesses to confirm it.
   - Use a test/development env. If `NODE_ENV=production`, unset it or run with `NODE_ENV=test`.
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
