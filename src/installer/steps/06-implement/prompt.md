# Developer Task

You are implementing ONE user story. You may ONLY write to the files listed below.

## YOUR FILES (scope_files) — you may ONLY create/modify these:
{{SCOPE_FILES}}

{{SCOPE_REMINDER}}

## Current Story
{{STORY}}

## Project
{{TASK}}

## Story Screens (Stitch Design)
{{STORY_SCREENS}}

## Design Rules
{{DESIGN_RULES}}

## Instructions

1. **DO NOT create a new branch.** Your working directory is ALREADY on the correct story branch — a git worktree was prepared for you by setfarm. Run `git branch --show-current` to see it; use that exact name as-is (it is always lowercase, e.g. `abc12345-us-001`). NEVER run `git checkout -b` with a different case (e.g. `US-001` uppercase) — merge-back will fail because your commits would live on an orphan branch.

2. **ABSOLUTE SCOPE DISCIPLINE — READ THIS TWICE.** The SCOPE_FILES list above is EXHAUSTIVE. Every file needed by every story was pre-planned into SOME story's scope. If a file you think is "needed" is NOT in your SCOPE_FILES:
   - It does NOT belong to your story. Another story owns it.
   - DO NOT create it. DO NOT write "infrastructure" or "wrapper" or "layout" files that weren't planned.
   - Common forbidden creations: `Header.tsx`, `Footer.tsx`, `Nav.tsx`, `BottomNav.tsx`, `Layout.tsx`, `Sidebar.tsx`, `*Section.tsx` (e.g. `CounterSection.tsx`, `HistorySection.tsx`), `*Container.tsx`, `*Wrapper.tsx`, `*Provider.tsx` — unless they are LITERALLY in your SCOPE_FILES list.
   - If your scope is `CounterDisplay.tsx + CounterControls.tsx`, you write ONLY those TWO components. Do NOT wrap them in a new `CounterSection.tsx`. The integration story (usually the last story, e.g. `App.tsx`/`main.tsx`) will assemble them — that is not your job.
   - You may IMPORT from SHARED_FILES (read-only reference) but NEVER create brand-new sibling files.

3. **If the design screenshot shows a Header or BottomNav but you weren't given that file in scope** — do not panic and do not create it. Another story owns it, or it will be implemented inline in the integration story. Your job is the slice you were assigned, nothing more.

4. Read the story's acceptance criteria and implement ONLY what it asks
5. Use imports from SHARED_FILES but do not modify them unless minor
6. Commit on the CURRENT branch (do not switch branches): `git add <only-your-scope-files> && git commit -m "feat: <story-id> - <description>"`
7. Do NOT use `git add -A` — stage only your scope files explicitly
8. If the pre-commit hook rejects, run `git reset HEAD <file>` and remove out-of-scope changes. Do NOT bypass with `--no-verify`.

## Output Format

```
STATUS: done
STORY_BRANCH: <your-branch-name>
CHANGES: <summary of what you implemented>
PR_URL: <if you created a PR>
```

If you cannot complete the story, report:
```
STATUS: fail
REASON: <why you could not complete it>
```
