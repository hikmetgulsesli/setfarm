# Developer Task

You are implementing ONE user story. You may ONLY write to the files listed below.

## YOUR FILES (scope_files) — you may ONLY create/modify these:
{{SCOPE_FILES}}

{{SCOPE_REMINDER}}

## Story Roadmap (all stories in this run)
{{STORY_ROADMAP}}

> The files listed under each "✓ DONE" story are already written — do not re-create them, do not modify them.
> The files under "□ PENDING" stories belong to future stories — leave them for those.
> Files under "→ CURRENT" are YOUR scope.

## Current Story
{{STORY}}

## Project
{{TASK}}

## Story Screens (Stitch Design)
{{STORY_SCREENS}}

## Design Rules
{{DESIGN_RULES}}

## Instructions

1. **WORKING DIRECTORY AND BRANCH (CRITICAL — prepared worktree architecture).** Everything happens in the prepared story worktree: `{{STORY_WORKDIR}}`.

   - **Every bash command prefix:** `cd "{{STORY_WORKDIR}}" && ...`. Do NOT cd anywhere else.
   - **Branch:** This story uses exactly `{{STORY_BRANCH}}`. The branch is already checked out.
   - **NEVER run** `git checkout -b`, `git branch -m`, or create/rename a branch.
   - **NEVER run** dependency install commands during implement. If a dependency is missing, report it.
   - **Before every `git commit` and `git push`:** verify `git branch --show-current` equals `{{STORY_BRANCH}}`.
   - **End of story:** commit only your scope files and push `{{STORY_BRANCH}}`. Do NOT create or merge a PR; the pipeline owns the PR gate.

2. **ABSOLUTE SCOPE DISCIPLINE.** Write ONLY the files listed in SCOPE_FILES. That list is exhaustive for your story; every file the project needs was pre-planned into some story's scope.
   - Your job is ONLY the files above. Every other file already belongs to another story.
   - Read from SHARED_FILES for import context; do not modify them and do not create sibling files next to them.
   - Assembly of components into pages/layouts happens in the integration story (the last story, which owns `App.tsx`/`main.tsx`). If your scope is a set of components, write just those components — do not wrap them into a new parent file.
   - Preserve all behavior and tests from DONE stories. Existing tests are accepted contract, not disposable scaffolding.
   - Do not delete or weaken existing tests to make your new code pass. Fix the implementation instead.
   - Do not add navigation, profile, archive, settings, demo panels, or other UI unless this story explicitly asks for them.
   - If acceptance criteria conflict with existing tests, make the smallest compatible change and keep both old and new behavior working.
   - Before committing, run `git diff` and verify the diff contains only this story's required changes.

3. **Design reference, not file assignment.** The Stitch design may show elements that are not in your SCOPE_FILES (e.g. a Header when your scope is a counter component). Use the design as reference for visual style, spacing and interaction of your scope files only. Do not create the other elements — another story owns them.

4. Read the story's acceptance criteria and implement ONLY what it asks
5. Use imports from SHARED_FILES but do not modify them unless minor
6. Commit on the CURRENT branch (do not switch branches): `git add <only-your-scope-files> && git commit -m "feat: <story-id> - <description>"`
7. Do NOT use `git add -A` — stage only your scope files explicitly
8. If the pre-commit hook rejects, run `git reset HEAD <file>` and remove out-of-scope changes. Do NOT bypass with `--no-verify`.

9. **CHECKPOINT (her ~5dk bir, REQUIRED).** Uzun implementasyonlarda her 5 dakikada bir progress kaydı yaz:
   ```bash
   echo "[$(date +%H:%M:%S)] <kısa durum: hangi dosyayı yazıyorsun, kaç dosya tamamlandı>" >> /tmp/setfarm-progress-{{RUN_ID}}.txt
   ```
   Medic bu dosyayı "alive" sinyali olarak okur — çok sık checkpoint yazarsan medic stuck-step timeout'unu ertelemez, gerçekten ilerlediğini görür. Checkpoint yazmak 1 saniye sürer, story'nin timeout ile kesilme riskini ciddi azaltır.

## Output Format

```
STATUS: done
STORY_BRANCH: <your-branch-name>
CHANGES: <summary of what you implemented>
PR_URL: <leave empty; pipeline creates the PR>
```

If you cannot complete the story, report:
```
STATUS: fail
REASON: <why you could not complete it>
```
