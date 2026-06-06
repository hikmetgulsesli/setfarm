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

## Supervisor Memory
This is the persistent product-manager memory for this run. Treat blockers and prior decisions here as authoritative project context, not optional suggestions.

{{SUPERVISOR_MEMORY}}

## Previous Failure / Retry Feedback
Failure category: {{FAILURE_CATEGORY}}
Suggested response: {{FAILURE_SUGGESTION}}

{{PREVIOUS_FAILURE}}

## Claim Handoff
These labels are the authoritative machine-readable handoff for this claim.

RUN_ID: {{RUN_ID}}
STORY_ID: {{STORY_ID}}
STORY_BRANCH: {{STORY_BRANCH}}
STORY_WORKDIR: {{STORY_WORKDIR}}
MAIN_REPO: {{MAIN_REPO}}

## Current Story
{{STORY}}

## Story Implementation Contract
This is the behavior handoff from STORIES. Treat it as authoritative for the
current story's owned screens, actions, state, persistence, navigation, and
test obligations. It is NOT a code plan: choose hook/component/function names
from the real repository structure, but do not drop any listed behavior.

{{STORY_IMPLEMENTATION_CONTRACT}}

## Implement Context
This is the Setfarm machine handoff assembled after setup-build. It resolves
logical STORY scope targets into real repo paths and grants shared edits for
this story only. Treat this as the source of truth for file ownership.

IMPLEMENT_CONTEXT_PATH: {{IMPLEMENT_CONTEXT_PATH}}

{{IMPLEMENT_CONTEXT}}

## Project
{{TASK}}

## Story Screens (Stitch Design)
{{STORY_SCREENS}}

## Design Rules
{{DESIGN_RULES}}

## Stack Contract
The following stack contract is resolved by Setfarm before implementation. Follow it instead of guessing the framework or runtime.

{{STACK_CONTRACT}}

## Stack-Specific Implementation Rules
{{STACK_PROMPT}}

## Stack Verification Contract
{{STACK_VERIFICATION_CONTRACT}}

## Selected Library Packs
The following library packs were selected by Setfarm from the PRD, design contract, and resolved stack. These are implementation tools only; Stitch, PRD, DESIGN_DOM, and the stack contract remain the authority.

{{LIBRARY_PACKS}}

## Library-Specific Implementation Rules
{{LIBRARY_PROMPT}}

## Instructions

1. **WORKING DIRECTORY AND BRANCH (CRITICAL — prepared worktree architecture).** Everything happens in the prepared story worktree: `{{STORY_WORKDIR}}`.

   - **Every bash command prefix:** `cd "{{STORY_WORKDIR}}" && ...`. Do NOT cd anywhere else.
   - **Branch:** This story uses exactly `{{STORY_BRANCH}}`. The branch is already checked out.
   - **NEVER run** `git checkout -b`, `git branch -m`, or create/rename a branch.
   - **NEVER run** dependency install commands during implement. If a dependency is missing, report it.
   - **NEVER run broad process cleanup or ad hoc preview servers.** Do not use `pkill`, `killall`, `pgrep` pipelines, `kill $(pgrep ...)`, `npx vite preview`, `npm run dev`, or background preview commands to manage runtime processes. Setfarm owns runtime port lifecycle and cleanup. Your job is scoped source changes plus the declared build/test/lint commands.
   - **Do not run git staging, commit, push, branch, or PR commands.** Finish code + local checks and report `STATUS: done`; Setfarm commits the allowed story scope, pushes `{{STORY_BRANCH}}`, and owns the PR gate.
   - **Toolchain freeze:** do not inspect, rewrite, upgrade, or debate Vite/Tailwind/TypeScript/test config unless a local build/test command actually fails. If checks pass, leave config untouched. `vite.config.*` is app/toolchain config and is forbidden unless explicitly listed in SCOPE_FILES. If Vitest setup is needed, use/create `vitest.config.*` or `src/test/setup.ts` only.

2. **ABSOLUTE SCOPE DISCIPLINE.** Write ONLY the files listed in SCOPE_FILES. That list is exhaustive for your story; every file the project needs was pre-planned into some story's scope.
   - Your job is ONLY the files above. Every other file already belongs to another story.
   - Do not create scratch notes, todo files, progress files, logs, or reports inside the project worktree. Files such as `progress.txt`, `TODO.md`, `notes.md`, `scratch.*`, or ad hoc reports are out of scope unless explicitly listed in SCOPE_FILES. Use `/tmp/setfarm-progress-{{RUN_ID}}.txt` for checkpoints only.
   - Read from SHARED_FILES for import context; do not modify them and do not create sibling files next to them.
   - If a SHARED_FILE exports a React component, do not invent props for it and do not change its TypeScript interface. Render it only with props it already declares; if it needs new behavior, expose state/actions from your owned files and leave component-side wiring to the story that owns that component.
   - Shared domain/type files (`src/types/*`, `src/types.ts`, domain model files) are read-only unless they are explicitly listed in SCOPE_FILES. Do not widen exported union/domain types to satisfy a screen-only render case when their consumers are outside your scope. Instead define a local display/render type or adapter in your owned file and narrow before calling shared helpers.
   - Generated Stitch screen components may declare an `actions` prop and `*ActionId` types. When you own app/screen assembly, wire controls through those declared action IDs from the component props or `src/screens/SCREEN_INDEX.json`; do not infer actions from `textContent`, `innerText`, DOM label matching, or `querySelector` heuristics.
   - If `App.*`, router, root shell, or navigation files are in SCOPE_FILES, treat them as additive integration surfaces. Preserve every existing reachable render branch and previously integrated generated screen while adding the current story's screen/action wiring. Do not replace prior generated screens with only the current story screen.
   - If a generated screen file is only in SHARED_FILES, do not use `read`, `cat`, `sed`, `head`, `tail`, `rg`, `grep`, `find`, `awk`, `node`, or `python` on that `src/screens/*.tsx` file. Use `src/screens/SCREEN_INDEX.json`, `src/screens/index.ts`, COMPONENT REGISTRY, STORY_SCREENS, and UI BEHAVIOR CONTRACT for component/action contracts. Read generated screen source only when that exact `src/screens/*.tsx` file is listed in SCOPE_FILES, and then inspect one focused owned file at a time. This is machine-enforced by the Setfarm spawner: reading a generated `src/screens/*.tsx` file outside SCOPE_FILES kills and retries the claim before context overload.
   - Do not read raw `stitch/*.html`, `.stitch-screens*.json`, or full `stitch/DESIGN_DOM.json` during implement. The story prompt already injects focused Stitch excerpts, UI behavior contracts, `src/screens/SCREEN_INDEX.json`, and generated screen contracts; loading the raw design corpus causes context overload and cross-story drift.
   - Assembly of components into pages/layouts happens only in the story that owns `App.tsx`/`main.tsx`. If your scope is a set of components, write just those components — do not wrap them into a new parent file.
   - Preserve all behavior and tests from DONE stories. Existing tests are accepted contract, not disposable scaffolding.
   - Do not delete or weaken existing tests to make your new code pass. Fix the implementation instead.
   - Do not add speculative navigation, account, archive, configuration, demo panels, or other UI unless this story explicitly asks for them.
   - If acceptance criteria conflict with existing tests, make the smallest compatible change and keep both old and new behavior working.
   - Do not edit `index.html` for title, Google fonts, icon fonts, metadata, or root markup unless `index.html` is explicitly listed in SCOPE_FILES. Setup owns document shell metadata and global font links.
   - Before reporting done, run `git diff` and verify the diff contains only this story's required changes.
   - Implementation evidence request artifacts are required when Setfarm runs with `SETFARM_IMPLEMENT_EVIDENCE_GATE=blocking` and strongly expected when it runs with `advisory`. You may write only these Setfarm evidence request artifacts outside source scope: `.setfarm/implement/{{STORY_ID}}/IMPLEMENT_INTENT.json` before broad coding and `.setfarm/implement/{{STORY_ID}}/IMPLEMENT_VERIFICATION_REQUEST.json` after coding. Do not write `IMPLEMENT_EVIDENCE.json`; Setfarm owns that file.
   - Use these exact implementation evidence schemas. Do not rename them, do not use slash-style schema IDs, and do not put build/source-grep checks in `interactionRequests`.
     `IMPLEMENT_INTENT.json` minimal runtime/shell template:
     ```json
     {
       "schema": "setfarm.implement-intent.v1",
       "storyId": "{{STORY_ID}}",
       "storyType": "ui_interactive",
       "acceptanceCriteria": [
         { "id": "AC-001", "description": "Story acceptance criterion implemented" }
       ],
       "boundSurfaces": [],
       "boundActions": [],
       "boundDataEntities": [],
       "runtimeEvidenceRequired": {
         "minFlowCount": 1,
         "requiredArtifactTypes": ["initial_screenshot", "dom_snapshot", "build_pass"],
         "testBridgeRequired": true
       }
     }
     ```
    `IMPLEMENT_VERIFICATION_REQUEST.json` minimal runtime/shell template:
     ```json
     {
       "schema": "setfarm.implement-verification-request.v1",
       "storyId": "{{STORY_ID}}",
       "status": "ready_for_orchestrator_verification",
       "interactionRequests": [
         {
           "id": "flow-1",
           "action": "click",
           "target": "[data-action-id='<action-id>']",
           "waitCondition": "dom_idle",
           "timeoutMs": 1000
         }
       ],
       "uncoveredCriteria": [],
       "knownGaps": []
     }
     ```
     `interactionRequests: []` is allowed only when the story's acceptance criteria do not need a user/runtime interaction. For interactive criteria, request executable actions or list the unverified criteria in `uncoveredCriteria`; never leave interactive criteria as silently covered. `interactionRequests` is only for browser runtime actions that Setfarm can execute from the app's initial loaded state in array order. If a target control appears only after opening another screen/surface, first request or implement a reachable opener action, then request the target action. For example: `{ "id": "open-settings", "action": "click", "target": "[data-action-id='settings-3']", "waitCondition": "dom_idle", "timeoutMs": 1000 }` followed by the settings action. Build, test, source-grep, and prose checks do not belong there; Setfarm already runs build/runtime capture separately.

3. **Design reference, not file assignment.** The Stitch design may show elements that are not in your SCOPE_FILES (for example, a shared header while your scope is one screen component). Use the design as reference for visual style, spacing and interaction of your scope files only. Do not create the other elements — another story owns them.

4. Read the story's acceptance criteria and implement ONLY what it asks
5. Use imports from SHARED_FILES for context only; do not modify shared files unless they are also listed in SCOPE_FILES.
   If TypeScript says a prop does not exist on a shared component, remove the invented prop or add an owned adapter/context; never edit tsconfig or the shared component to hide the error.
   If TypeScript says a shared exported type is too narrow for an owned screen's visual-only state, keep the shared type compatible and create a local render/display type inside the owned screen. A build error in an out-of-scope consumer means the shared API change is not allowed in this story.
6. Every interactive control you create must be a real semantic control.
   - Use `<button>` for actions and `<a href>`/router links for navigation.
   - Do not put `onClick` on `<div>`, `<span>`, `<li>`, headings, or layout
     containers. If an existing component absolutely requires a non-native
     element, it must include `role="button"`, `tabIndex={0}`, and Enter/Space
     keyboard handling in the same element.
   - Every native `<button>` must have real behavior: `onClick`,
     `type="submit"`, or `disabled`/`aria-disabled` for intentionally
     unavailable controls.
   - For games and spatial/keyboard/touch interfaces, do not render movement,
     pickup/drop, pause, or other gameplay-only controls as active buttons
     outside the state where they can change gameplay. On menu, help, paused,
     game-over, empty, loading, or inactive screens, hide those controls or
     mark them `disabled`/`aria-disabled` with clear visual state.
   - Do not use `data-smoke-ignore` to hide product controls from smoke checks.
     Icon-only controls must have an accessible name and must change visible
     state, open a project-specific panel/dialog, navigate, or be disabled.
     Decorative icons must not be rendered as `<button>`.
   - If you render generated Stitch screens, use their typed `actions` prop for button and link behavior. Do not attach a parent click handler that branches on visible text.
   - Do not add a generic fallback for unknown generated action IDs, such as `actionDispatch[id] ?? { type: "panel", panel: id }`. Every declared action ID you pass into a generated screen must be explicitly mapped to a visible route, dialog/panel, toast, disabled state, or intentional error/recovery message. Footer/global actions such as Support, System Status, Documentation, notifications, account, filter, sort, and overflow menus must either show a visible surface or be disabled; they cannot update hidden state only.
   - If this story owns generated `src/screens/*.tsx`, every visible product datum in those screens must render from story-owned props, store state, or adapters: tables, rows, cards, metrics, detail/editor fields, checklist/status chips, saved filters, and empty/error panels. Do not leave static Stitch placeholder rows, metrics, forms, or checklist values when an owned PRD action mutates that state.
   - Action wiring that only updates `window.app`, `globalThis.app`, hidden shell state, logs, or a status snapshot is incomplete. Before `STATUS: done`, prove at least one owned action changes visible DOM inside the generated screen itself: a created row/card, changed metric, selected item, form value, checklist/status value, validation message, or empty/error recovery state.
   - Save/create/update/apply/retry/clear actions are not complete when they only set an active route/panel, log, update `window.app`, or write a field back to the same current value. They must perform the declared state, persistence, or recovery mutation and make that mutation visible in the generated screen.
   - Create/edit/task-flow actions must preserve app context with a visible back/cancel path and consistent shell affordances unless the Stitch screen is explicitly a full-screen linear workflow. Opening an editor must not make the app look blank or unrelated to the previous shell.
   - Do not add visible diagnostic, session, status, QA, debug, or telemetry strips above, beside, or over generated full-screen Stitch screens unless the current story explicitly owns that Product Surface. Use `window.app`/`globalThis.app` for test bridge state instead. App shell diagnostics must not push, cover, or horizontally overflow generated screens on a 390px mobile viewport.
   - Do not wrap generated full-screen Stitch screens in another semantic landmark/root such as `<main>`, `<section role="main">`, or a second viewport shell. Render the generated screen as the visual root, or use a neutral `<div data-setfarm-root>` container when you need app-level state wiring.
   - When removing app-shell diagnostics/status panels around generated Stitch screens, preserve the generated screen's required mount layout. If the generated screen renders sibling sidebar/content regions such as a `shrink-0`/`h-screen` sidebar plus a `flex-1` content region, the neutral `<div data-setfarm-root>` mount must remain a flex container (`flex min-h-screen w-full` or equivalent). Move visible product feedback into owned generated-screen props/state; do not trade shell-chrome removal for a broken non-flex root.
   - If a generated screen renders root-level `absolute inset-0` or `fixed inset-0` viewport layers, the neutral app mount must provide positioning and viewport height, for example `<div data-setfarm-root className="relative min-h-screen w-full overflow-hidden">`. A bare `<div data-setfarm-root>` collapses to height 0 and makes the game/screen visually dead even when TypeScript and smoke pass.
   - Browser games and full-viewport interactive surfaces must render one continuous viewport scene. `html`, `body`, `#root`, and the app/game root must fill the viewport (`min-h-screen`/`h-screen` plus full width, or equivalent). Do not fake a scene by repeating the same large `<img>` tile across a grid. Use one viewport-cover background layer, canvas, or generated scene component, and keep settings, pause, and game-over panels as overlays on that scene instead of replacing it with a gray/empty backdrop.
7. Interaction tests must prove the post-click result. Do not write
   `expect(() => fireEvent.click(...)).not.toThrow()` or the same pattern with
   `userEvent.click` as the only assertion. After every click in a test, assert
   the visible UI state, route/hash, dialog/panel presence, callback call,
   validation message, localStorage/state change, or saved data.
8. If the story acceptance criteria or PRD mention `window.app`, implement it
   as a real runtime test bridge, not documentation. Scoped source must contain
   an actual assignment such as `window.app = { state, actions }` or
   `globalThis.app = { state, actions }` from a React effect or equivalent live
   update point; type declarations, comments, `window.game`, and prose about a
   bridge do not count. Keep its fields current after state changes. For games
   this includes the requested game's score/progress, status, level/difficulty
   where present, paused/gameOver, and gameplay entities; for product apps this
   includes active
   screen/route, selected record, counts, storage status, last error, and active
   panel where those concepts exist.
   Reducers and state transition functions must be pure: no localStorage reads/writes, timers, DOM access, or mutation of existing state objects inside the reducer. Put persistence and timer side effects in effects or action wrappers, then dispatch plain state updates.
9. Before reporting done, run available local checks. Prefer `npm run build`; for Vitest use `npm run test:run` or `npx vitest run` instead of watch-mode `npm test` when needed. Do not pipe build/test commands through `head`, `tail`, `grep`, `tee`, `cat`, or similar output filters when deciding pass/fail; those pipelines can hide a failing exit code. If output is too long, run the full command first, preserve the command's real exit status, then inspect a saved log afterward. If a script is missing, say so in CHANGES.
   - Do not claim that flows were tested in prose. For runtime/UI stories, describe the flows Setfarm should execute in `.setfarm/implement/{{STORY_ID}}/IMPLEMENT_VERIFICATION_REQUEST.json`. Setfarm will start the runtime, execute interactions, capture screenshots/DOM/state, and write `.setfarm/implement/{{STORY_ID}}/IMPLEMENT_EVIDENCE.json`.
   - If Setfarm says `SETFARM_IMPLEMENT_EVIDENCE_GATE=blocking` and you cannot create `IMPLEMENT_INTENT.json` or `IMPLEMENT_VERIFICATION_REQUEST.json`, report `STATUS: retry` with the exact reason. Do not report `STATUS: done` for a runtime/UI story without those request artifacts in blocking mode.
10. Do NOT run `git add`, `git commit`, `git push`, `gh pr create`, or any branch command. The implement worktree installs a git wrapper that blocks unsafe git operations, and Setfarm performs the final scoped story commit after build/scope/supervisor gates pass.
11. If `git diff` shows out-of-scope changes, remove them before reporting done. Do NOT bypass hooks with `--no-verify`.

12. **CHECKPOINT (about every 5 minutes, REQUIRED).** For long implementations,
   write a short progress checkpoint every 5 minutes:
   ```bash
   echo "[$(date +%H:%M:%S)] <short status: file being edited, files completed>" >> /tmp/setfarm-progress-{{RUN_ID}}.txt
   ```
   Medic reads this file as an alive/progress signal. A checkpoint must reflect
   real progress; spammy checkpoints do not postpone stuck-step timeout.

## Output Format

```
STATUS: done
STORY_BRANCH: {{STORY_BRANCH}}
CHANGES: <summary of what you implemented>
PR_URL: <leave empty; pipeline creates the PR>
```

If you cannot complete the story, report:
```
STATUS: fail
REASON: <why you could not complete it>
```
