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
2. **CHECK YOUR SCOPE FIRST** — you can ONLY write to the files listed above in SCOPE_FILES
3. Do NOT create files like Header.tsx, Footer.tsx, Nav.tsx, Layout.tsx etc. unless they are in YOUR SCOPE_FILES
4. Read the story's acceptance criteria and implement ONLY what it asks
5. Use imports from SHARED_FILES but do not modify them unless minor
6. Commit on the CURRENT branch (do not switch branches): `git add <only-your-scope-files> && git commit -m "feat: <story-id> - <description>"`
7. Do NOT use `git add -A` — stage only your scope files explicitly
8. If the pre-commit hook rejects, run `git reset HEAD <file>` and remove out-of-scope changes

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
