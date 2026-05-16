# Setfarm Supervisor-First Refactor Implementation Plan

Date: 2026-05-16

## Intent

Move Setfarm away from project-specific guard patches and into a durable supervisor-managed execution model.

The implementation target is:

- one isolated supervisor state per project run
- one coding worker per story/worktree
- hard guards only for platform safety and deterministic broken behavior
- product/design incompleteness represented as supervisor checklist blockers or warnings
- context/read/stall problems recorded as supervisor signals before escalation
- Codex as the default architect/fixer provider, with configurable Kimi/Minimax fallback slots

## Slice 1: Supervisor Core

Add `src/installer/supervisor/` with:

- `types.ts`: shared state, checklist, finding, event, intervention, and model policy types
- `state.ts`: read/write/append helpers under `.setfarm/supervisor/<runId>/`
- `checklist.ts`: deterministic checklist generation from `SCREEN_INDEX.json` and `stitch/DESIGN_DOM.json`
- `scanner.ts`: static evidence scan for buttons, links, inputs, handlers, hrefs, malformed URLs, and icon severity
- `intervention.ts`: short correction messages tied to checklist item ids
- `model-policy.ts`: configurable provider priority, defaulting to `codex,kimi,minimax`
- `coordinator.ts`, `run-supervisor.ts`, `fixer.ts`: stable integration surfaces for later live loops and scoped fixes

## Slice 2: Guard Taxonomy

Keep hard:

- platform cwd safety
- missing claim workdir
- story scope write isolation
- worker git staging/commit/push/branch discipline
- build/test failure
- malformed deploy URL
- active button without handler/disabled/submit state
- active link with missing/dead href when it is intended to navigate

Convert to supervisor signal:

- generated screen shared read
- raw Stitch corpus read
- full/irrelevant reference read
- claim parse loop
- pre-delta check before source change
- pre-delta context sprawl
- no-delta stall
- missing DOM controls
- labeled icon mismatch
- label/style/design drift

## Slice 3: Implement Done Flow

At implement completion:

1. Run existing deterministic hard gates.
2. Generate or refresh supervisor checklist for the story scope.
3. Run supervisor scanner.
4. Persist blockers, warnings, and evidence.
5. Block story acceptance only when unresolved supervisor blockers remain.
6. Store exact supervisor intervention text in state/events and retry feedback.
7. Preserve platform story commit ownership after gates pass.

## Slice 4: Runtime Signals

In `src/spawner.ts`:

- keep scope-write and git-discipline as kill/requeue
- record nonfatal runtime guard findings once per active worker/session
- append transcript markers as `SUPERVISOR SIGNAL`
- preserve ordering before process-terminal recovery
- avoid retry loops for nonfatal context/read/stall signals

## Slice 5: Prompt And Feedback

In claim summary/prompt generation:

- expose supervisor checklist/state paths
- instruct workers to close checklist blockers before done
- treat supervisor blockers as exact implementation feedback
- stop treating labeled icon mismatches as fatal semantic-fix blockers
- keep first-delta discipline as a focused prompt hint, not a kill rule

## Slice 6: Tests

Add or update tests for:

- checklist generation from DOM extract
- state read/write/update/events
- scanner severity rules
- intervention messages
- model policy fallback order
- labeled icon mismatch warning
- icon-only missing blocker
- runtime signal behavior without kill/requeue
- hard scope/git guards still kill/requeue
- version/build metadata remains tied to package version plus git sha

## Slice 7: Verification And Runtime Sync

Run:

- `npm run build`
- `npm test`
- `npm run test:steps`

Then commit, push, and sync runtime repo.

## Follow-Up Slice: Visual QA Supervisor

After this refactor lands, design a separate visual QA supervisor slice before implementation. It should use Playwright as a deterministic sensor, not as another project-specific guard patch.

Required scope for that follow-up:

- start the app with the project-native dev/preview command
- crawl every discoverable route, link, tab, menu, modal trigger, and primary button that can be exercised safely
- capture desktop and mobile screenshots for initial state and important post-click states
- collect console errors, page errors, network failures, blank screens, layout overflow, missing main regions, and obvious vanished header/sidebar/footer states
- compare DOM-extracted controls with clicked controls so unvisited controls become supervisor blockers
- write artifacts under `.setfarm/supervisor/<runId>/visual/`
- report deterministic failures as supervisor blockers and subjective visual concerns as supervisor warnings
- feed the exact evidence back into the worker session before escalating to a fixer model

## Explicit Non-Goals

- no project-specific platform guard rules
- no single global supervisor reading multiple projects
- no worker-side git ownership
- no unavailable model provider hardcoding
- no complete source-code snapshots as supervisor memory
- no visual QA implementation in the current refactor slice without a separate approved design
