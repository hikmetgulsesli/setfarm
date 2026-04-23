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

1. **WORKING DIRECTORY AND BRANCH (CRITICAL — single-directory architecture).** Everything happens in ONE directory: `{{REPO}}`. No worktree, no sub-dir, no alternate path.

   - **Every bash command prefix:** `cd "{{REPO}}" && ...`. Do NOT cd anywhere else.
   - **Branch:** The entire run uses ONE branch: `{{STORY_BRANCH}}`. Your first command: `cd "{{REPO}}" && git checkout "{{STORY_BRANCH}}"` (if already on it, no-op).
   - **NEVER run** `git checkout -b` or `git branch -m` — no branch create, no rename.
   - **Scaffold tools** (`npm create vite`, `npx create-next-app`, `npx create-expo-app`, `npx react-native init`, `flutter create`, `dotnet new`, `cargo new`, etc.) MAY auto-switch the branch. After ANY scaffold command, run `git checkout "{{STORY_BRANCH}}"` to return.
   - **Before every `git commit` and `git push`:** verify `git branch --show-current` equals `{{STORY_BRANCH}}`.
   - **PR flow (end of story — required):**
     1. `cd "{{REPO}}" && git add -A && git commit -m "feat: {{CURRENT_STORY_ID}} — <summary>"`
     2. `git push origin "{{STORY_BRANCH}}"`
     3. `gh pr create --base main --head "{{STORY_BRANCH}}" --title "{{CURRENT_STORY_ID}}: <short title>" --body "<what + how>"` → capture PR URL
     4. `gh pr merge <pr_number> --auto --squash` — enables auto-merge when review passes
     5. Emit `PR_URL: <url>` in your STATUS block.

2. **ABSOLUTE SCOPE DISCIPLINE.** Write ONLY the files listed in SCOPE_FILES. That list is exhaustive for your story; every file the project needs was pre-planned into some story's scope.
   - Your job is ONLY the files above. Every other file already belongs to another story.
   - Read from SHARED_FILES for import context; do not modify them and do not create sibling files next to them.
   - Assembly of components into pages/layouts happens in the integration story (the last story, which owns `App.tsx`/`main.tsx`). If your scope is a set of components, write just those components — do not wrap them into a new parent file.

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
PR_URL: <if you created a PR>
```

If you cannot complete the story, report:
```
STATUS: fail
REASON: <why you could not complete it>
```
