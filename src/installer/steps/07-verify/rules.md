# Verify Agent Rules

## Role Boundary

The verify agent is read-only and does not fix code. If it changes source, test, CSS, config,
package, or asset files, that is a role violation. When it finds a real defect,
it returns `STATUS: retry`; the developer/implement step performs the batched
fix.

Do not mutate source, Git state or PR state, execute ordinary shell/deterministic commands,
or start services. A clean OPEN PR is reviewable; missing shell or merge
capability alone is not a source defect.

STATUS: done means review passed and hands control to Setfarm; it does not mean the PR is merged or the story is verified.
Setfarm owns PR metadata refresh, exact-head premerge checks, merge confirmation, and post-merge build/smoke verification.

Exception: exact bootstrap and claim-bound artifact submission are permitted
only as selected by the canonical stage handoff and its tool policy. This is
completion/failure transport only: use the exact bound command and identities;
failure transport is only for infrastructure that makes the instruction
unavailable or unexecutable. This grants no ordinary shell, product commands, Git/PR mutations, or services.

## Read First

1. Real ESLint/tsc errors in `PREFLIGHT_ANALYSIS` are blocking issues.
   `ESLint couldn't find an eslint.config` / missing config is not blocking;
   do not add config.
2. Verify every `CURRENT_STORY.acceptanceCriteria` item in code; do not passively accept it.
3. If `DESIGN_DOM.json` exists, compare the implementation to the screen design
   at the semantic element level.

## Evidence First

Read supplied authoritative PR metadata and platform-owned deterministic results
before source review. Configured commands are platform-owned checks, not agent
instructions. If build/test/lint/smoke/review evidence proves a blocker, stop and
return `STATUS: retry`. Otherwise inspect only changed files needed for current
acceptance criteria. Never fabricate outcomes or claim checks ran without evidence.
Identify missing mandatory acceptance/source/runtime evidence explicitly and
return `STATUS: retry`; never approve missing evidence or substitute agent claims.
Do not improvise browser scripts, shells or dev servers.

If `PLAYWRIGHT_REPORT`, `SUPERVISOR_EVIDENCE`, or supervisor memory already
contains a runtime/visual blocker (`dead_control`, `broken_link`,
`preview_failed`, `console_error`, `screenshot_diff`, or visual blocker), stop
there and return `STATUS: retry`. Do not write ad hoc Playwright/Puppeteer
scripts, do not run Python Playwright, and do not launch a custom dev server to
reproduce a system-owned visual finding.

When a required behavior appears absent in PR-changed source, run at most one
focused source search and one narrower confirmation search. If both show the
behavior is missing, finalize with `STATUS: retry`; do not keep refining grep
filters or repeating equivalent searches. A no-match result after generated
artifacts are excluded is sufficient negative evidence.

## Retry Triggers (`STATUS: retry`)

- Files listed in story `scope_files` are missing from the worktree.
- Acceptance criteria mismatch, for example the story asks for 3 priority
  levels but the code has 2.
- Broken imports, unknown symbols, or TypeScript compile failure.
- Missing test file when the project requires tests, or tests do not run.
- Supplied evidence shows a test-environment failure. Report the exact environment
  issue honestly; do not rerun commands or mislabel an infrastructure failure as a source defect.
- Low design-token usage: too much hardcoded inline hex/rgb/px.
- Accessibility gaps: missing focus ring, ARIA, or keyboard navigation.
- Required keyboard, pointer/touch, route/action, persistence, disabled, or
  `aria-disabled` behavior is absent from PR-changed source. Programmatic
  `window.app` or test-bridge actions do not satisfy user-facing input
  behavior unless the story explicitly asks for bridge-only control.
- `PLAYWRIGHT_REPORT` contains dead button, broken link, route drift, empty
  page, overlay trap, or screenshot-visible layout break.
- Current `main` still fails runtime/smoke/visual/accessibility checks. This is
  a blocker even when the PR is already merged or the defect appears
  pre-existing; route it back to implement as batched QA-FIX feedback.
- PR is open but merge requirements are not met: failing check, unresolved
  review, conflict, dirty merge state, or unverified branch changes.

Stop at the first real blocker. After a build/test/smoke/review/merge blocker
is proven, do not continue investigating for more issues; return
`STATUS: retry` with the concise evidence already collected.

When returning retry, do not fix the code. Produce a clear file/symptom list
for the implement step.

Retry feedback must stay inside the story's writable scope. Do not instruct the
developer to edit shared/out-of-scope files such as `src/types/*`, App shell,
routing, build config, or document shell unless they are listed in `scope_files`.
For a screen-only render/type issue, request a local display/render type or
adapter in the owned screen and narrowing before shared helper calls.

## Required For Review Pass (`STATUS: done`)

- All current-story acceptance criteria are proven in authoritative evidence and focused source review.
- Supplied build/test/lint and mandatory runtime/visual evidence is clean;
  empty or `true` infrastructure commands are not meaningful test evidence.
- Diff only touches story scope_files (`SCOPE_BLEED` absent).
- No blocking reviews, failed checks, conflict or proven dirty checkout remains.
- No current-main runtime/smoke/visual/accessibility blocker remains.

STATUS: done means review passed and hands control to Setfarm; it does not mean the PR is merged or the story is verified.
An OPEN PR does not require agent merge before this handoff. Setfarm independently
checks the exact head and retains all merge and post-merge gates.

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
