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

1. **CHECK YOUR SCOPE FIRST** — you can ONLY write to the files listed above in SCOPE_FILES
2. Do NOT create files like Header.tsx, Footer.tsx, Nav.tsx, Layout.tsx etc. unless they are in YOUR SCOPE_FILES
3. Read the story's acceptance criteria and implement ONLY what it asks
4. Use imports from SHARED_FILES but do not modify them unless minor
5. Commit: `git add <only-your-scope-files> && git commit -m "feat: <story-id> - <description>"`
6. Do NOT use `git add -A` — stage only your scope files explicitly
7. If the pre-commit hook rejects, run `git reset HEAD <file>` and remove out-of-scope changes

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
