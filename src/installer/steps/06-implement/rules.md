# Implementation Rules

## Scope Discipline (BLOCKER — read this FIRST)

You are assigned ONE story with a FIXED list of files. You MUST NOT create or modify ANY file outside this list.

**Before writing ANY code, check your SCOPE_FILES.** If a file is not in that list, DO NOT touch it.

### What you CAN write:
- Files listed in SCOPE_FILES (your story's owned files)
- Files listed in SHARED_FILES are read/import context only; do not edit them unless they are also listed in SCOPE_FILES
- Test files (*.test.tsx, *.spec.tsx) for YOUR scope files only
- Test config (vitest.config.ts, jest.config.ts)

### What you CANNOT write:
- ANY file not in SCOPE_FILES or SHARED_FILES
- Do NOT create new component files that aren't in your scope
- Do NOT create Header.tsx, Footer.tsx, Nav.tsx, Layout.tsx etc. unless they are in YOUR SCOPE_FILES
- Do NOT rewrite App.tsx, main.tsx, index.css unless they are in YOUR SCOPE_FILES
- A pre-commit hook will REJECT your commit if you touch out-of-scope files
- Server-side SCOPE_BLEED guard will REJECT your output even if the hook is bypassed

### If the pre-commit hook rejects your commit:
1. Run `git reset HEAD <blocked-file>` for each blocked file
2. Run `git checkout -- <blocked-file>` to discard changes
3. Only stage and commit files from your SCOPE_FILES
4. Do NOT use --no-verify to bypass the hook

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

## Git Hygiene
- Commit once at the end after implementation and local checks pass. Use `/tmp/setfarm-progress-<run>.txt` checkpoints for long work, not partial git commits.
- Format: `feat: <story-id> - <description>`
- Do NOT force push or rewrite history
- Do NOT modify package.json dependencies unless the story requires it
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
