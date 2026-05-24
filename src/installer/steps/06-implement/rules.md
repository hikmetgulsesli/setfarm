# Implementation Rules

## Scope Discipline (BLOCKER — read this FIRST)

You are assigned ONE story with a FIXED list of files. You MUST NOT create or modify ANY file outside this list.

**Before writing ANY code, check your SCOPE_FILES.** If a file is not in that list, DO NOT touch it.

### What you CAN write:
- Files listed in SCOPE_FILES (your story's owned files)
- Files listed in SHARED_FILES are read/import context only; do not edit them unless they are also listed in SCOPE_FILES
- Test files (*.test.tsx, *.spec.tsx) for YOUR scope files only
- Test config (`vitest.config.*`, `jest.config.*`) and `src/test/*` helpers only. `vite.config.*`, `tailwind.config.*`, `tsconfig.*`, and `index.html` are NOT test config and are forbidden unless explicitly listed in SCOPE_FILES.
- Shared domain/type files (`src/types/*`, `src/types.ts`, domain model files) only when explicitly listed in SCOPE_FILES.

### What you CANNOT write:
- ANY file not in SCOPE_FILES, except scoped test files and test config listed above
- Do NOT create new component files that aren't in your scope
- Do NOT create Header.tsx, Footer.tsx, Nav.tsx, Layout.tsx etc. unless they are in YOUR SCOPE_FILES
- Do NOT rewrite App.tsx, main.tsx, index.css unless they are in YOUR SCOPE_FILES
- Do NOT edit `index.html` for title, font links, metadata, icon fonts, or root markup unless it is in YOUR SCOPE_FILES. Setup owns document shell metadata.
- Do NOT edit `vite.config.*` to add Vitest settings. Use `vitest.config.*` when test config is allowed.
- Do NOT widen shared exported/domain types to fix only a screen component. Use a local render/display type or adapter in your owned file, then narrow before calling shared helpers.
- Do NOT invent props for components imported from SHARED_FILES. Render them with their declared props only, or expose owned context/actions for the owner story to consume later.
- Generated Stitch screen components may expose a typed `actions` prop. Use those declared action IDs for wiring; do NOT route clicks by matching `textContent`, `innerText`, or DOM labels.
- Runtime scope guard will REJECT your output if you touch out-of-scope files
- Server-side SCOPE_BLEED guard will REJECT your output even if local tooling is bypassed

### If scope guard reports out-of-scope changes:
1. Run `git status --short` and `git diff -- <path>` to inspect the exact file
2. Restore or remove each out-of-scope file before reporting done
3. Do not stage, commit, push, branch, or open PRs; Setfarm owns git after gates pass
4. Do NOT use --no-verify, alternate git binaries, or shell wrappers to bypass guards

## Regression Safety
- DONE story behavior is contract. Preserve existing features unless this story explicitly replaces them.
- Existing tests are contract. Do not delete, skip, or weaken them to pass the current story.
- Add tests for the current story without removing previous story coverage.
- Do not add speculative UI such as profile, archive, settings, navigation, or dashboards unless listed in acceptance criteria.
- If a current acceptance criterion appears to conflict with previous behavior, implement the smallest compatible change and keep the full test suite green.
- Review `git diff` before committing; the diff should explain itself as this story only.

## Code Quality
- Follow existing project patterns (check src/ structure before writing)
- Use TypeScript types — no `any` unless wrapping external data
- Import from existing shared code before creating new utilities
- CSS: use Tailwind classes matching the Stitch design tokens
- Generated screen content must be state-driven. If this story owns generated `src/screens/*.tsx`, replace static Stitch placeholder data for visible tables, rows, cards, metrics, forms, checklist/status chips, detail panels, saved filters, and empty/error panels with story-owned props/store/adapters. Action wiring is not complete until a real owned action changes visible DOM inside the generated screen, not only `window.app`, shell state, or logs.
- Save/create/update/apply/retry/clear actions must not be no-ops. Do not complete an owned action by only changing an active route/panel, logging, updating `window.app`, or writing the same current value back into state; mutate the declared data/recovery/persistence state and show that change in generated-screen DOM.
- Do not add visible diagnostic/session/status/debug/QA strips around generated full-screen Stitch screens unless that visible surface is explicitly in the story. Expose smoke/debug state through `window.app` or `globalThis.app`; do not create app-level chrome that pushes, overlays, or horizontally overflows the generated screen on mobile.
- Do not wrap generated full-screen Stitch screens in another semantic landmark/root such as `<main>`, `<section role="main">`, or a second viewport shell. Generated screens own their semantic landmarks; app shell wrappers must be neutral containers such as `<div data-setfarm-root>`.
- Keep reducers/state transition functions pure: no localStorage, timers, DOM access, random mutable singletons, or mutation of existing state objects inside reducers. Run persistence and timers in effects/action wrappers.
- Local checks must preserve real exit codes. Do not decide build/test success from commands piped through `head`, `tail`, `grep`, `tee`, `cat`, or similar filters. If logs are long, run the full command first and inspect saved output only after the command exits.

## Git Hygiene
- Do NOT run `git add`, `git commit`, `git push`, branch commands, or PR commands during implement.
- Use `/tmp/setfarm-progress-<run>.txt` checkpoints for long work, not partial git commits.
- Setfarm creates the final scoped commit as `feat: <story-id> - <description>` after build/scope/supervisor gates pass.
- Do NOT force push, rewrite history, or bypass the git wrapper/guards.
- Do NOT modify package.json dependencies unless the story requires it.
- Do NOT create, edit, merge, retarget, or close GitHub PRs. Setfarm creates the story PR after completion.

## Output Contract
- STATUS: done | fail | skip
- STORY_BRANCH: the exact branch name (lowercase)
- CHANGES: human-readable summary of implemented features
- PR_URL: leave empty; Setfarm creates/reuses the story PR with base `main`

## Anti-Patterns (Auto-Rejected)
- Zero source file changes → NO_WORK rejection
- Fewer than 10 lines inserted → INSUFFICIENT_WORK rejection
- Files outside scope → SCOPE_BLEED rejection
- More than 12 files (30 with deps) → SCOPE_OVERFLOW rejection
- Referencing other project repos → CROSS_PROJECT rejection
