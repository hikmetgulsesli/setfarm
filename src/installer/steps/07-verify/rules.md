# Verify Agent Rules

## Role Boundary

The verify agent does not fix code. If it changes source, test, CSS, config,
package, or asset files, that is a role violation. When it finds a real defect,
it returns `STATUS: retry`; the developer/implement step performs the batched
fix.

Do not mutate anything except:

- Retargeting the PR to `main` when the base is wrong.
- Merging a fully clean PR.
- Posting a short verification comment before merge.

## Read First

1. Real ESLint/tsc errors in `PREFLIGHT_ANALYSIS` are blocking issues.
   `ESLint couldn't find an eslint.config` / missing config is not blocking;
   do not add config.
2. Verify every `CURRENT_STORY.acceptanceCriteria` item in code; do not passively accept it.
3. If `DESIGN_DOM.json` exists, compare the implementation to the screen design
   at the semantic element level.

## Retry Triggers (`STATUS: retry`)

- Files listed in story `scope_files` are missing from the worktree.
- Acceptance criteria mismatch, for example the story asks for 3 priority
  levels but the code has 2.
- Broken imports, unknown symbols, or TypeScript compile failure.
- Missing test file when the project requires tests, or tests do not run.
- Low design-token usage: too much hardcoded inline hex/rgb/px.
- Accessibility gaps: missing focus ring, ARIA, or keyboard navigation.
- `PLAYWRIGHT_REPORT` contains dead button, broken link, route drift, empty
  page, overlay trap, or screenshot-visible layout break.
- PR is open but merge requirements are not met: failing check, unresolved
  review, conflict, dirty merge state, or unverified branch changes.

When returning retry, do not fix the code. Produce a clear file/symptom list
for the implement step.

## Required For Pass (`STATUS: done`)

- All acceptance criteria are proven.
- `npm run build` passes and `preflight_errors` is empty.
- TypeScript strict mode / tsc is clean.
- Diff between story branch and main only touches the story scope files
  (`SCOPE_BLEED` absent).
- PR is actually `MERGED`.
- Local `main` is up to date with `origin/main` and the worktree is clean.

`STATUS: done` is forbidden while the PR is still open, before merge is
attempted, or after a failed merge.

## Fail (`STATUS: fail`) Is Rare

Use fail only for unrecoverable states: corrupt worktree, unresolved PR merge
conflict after auto-rebase, or dev-server crash loop. Normal defects use retry;
the developer gets another attempt.

## Feedback Format

For retry/fail, write 1-3 directly actionable items:

```
FEEDBACK:
- src/App.tsx:42 — useEffect dependency array is missing.
- Story AC-3 requires test coverage, but no test covers the main component.
- index.css:12 hardcodes #3B82F6 instead of using --color-primary.
```

Do not write long preambles or praise. Only actionable defects.
