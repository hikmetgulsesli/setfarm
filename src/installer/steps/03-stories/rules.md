# STORIES Step Rules

Read PRD + SCREEN_MAP + DESIGN_SYSTEM and produce a file-scoped user story
list. Stories must be dependency-ordered, non-overlapping, and implementation
ready.

## Inputs

- `prd`: Plan step PRD.
- `screen_map`: Design step SCREEN_MAP.
- `design_system`: Design step fonts, palette, and aesthetic.
- `predicted_screen_files`: exact generated paths for each screen, e.g.
  `src/screens/<ScreenName>.tsx`.

Stories runs before setup-repo. Do not depend on files inside REPO existing on
disk. The embedded claim context is the source of truth.

## Story Format

```json
{
  "id": "US-001",
  "title": "English technical story title",
  "description": "1-2 paragraphs covering model/API/UI/test work",
  "acceptanceCriteria": ["Criterion 1", "Tests pass", "Typecheck passes"],
  "depends_on": ["US-X"],
  "screens": ["screen-id-1"],
  "scope_files": ["src/lib/foo.ts", "src/screens/Bar.tsx"],
  "shared_files": ["src/App.tsx"],
  "scope_description": "One sentence defining what this story owns"
}
```

Story titles/descriptions/acceptance criteria are agent-facing and should be
English. Visible UI copy requirements may specify the user's requested product
language.

## Story Size Target

- 15-25 minutes per story.
- 200-500 LOC per story.
- Target 3-6 owned files per story.
- Max 5 acceptance criteria per story; split if more are needed.

### Feature-Complete Packaging

Each story must be a working feature slice, not an isolated display file:
- main component(s) + hook(s) + type(s) + tests, or
- screen + all directly required support files, or
- storage/API boundary + tests.

If a feature naturally fits in one file, combine it with the nearest related
state/test/screen file so implement does not infer "write the whole app".

## Ordering

1. US-001: app shell, shared state, persistence, navigation, and deterministic
   test bridge (`window.app`). Setup/build/toolchain work belongs to setup
   steps, not stories.
2. US-002+: Product Surface / generated screen action slices, depending on
   US-001. Each story owns its generated screen file(s) and the PRD `ACT_*`
   actions mapped to those screens.
3. App integration files may be reopened by later screen stories only to wire
   that story's owned PRD actions and generated controls into shared state.

Later stories may depend on earlier stories. Earlier stories must not depend on
later stories.

## scope_files and shared_files

- `scope_files`: the only files that story may create or modify.
- `shared_files`: read/import context only unless also listed in `scope_files`.
- `scope_description`: one sentence saying what the story owns and does not own.

Two stories must not share the same generated screen file in `scope_files`.
App integration files may be reopened by later interactive screen stories when
the story must wire its owned screen controls into shared state, navigation, or
actions. Keep those edits limited to that owned screen's behavior.

## Screen File Rules

Use paths from PREDICTED_SCREEN_FILES exactly. Do not invent:
- `src/pages/GameScreen.tsx`
- `src/views/MainMenu.tsx`
- `src/components/screens/...`

Every screen is owned by exactly one story. Menus/lists, main functional
screens, settings/profile, and result/notification flows should be distributed
by product structure.
Every generated screen must be reachable in the final app from the first
rendered product surface through visible navigation/control flow, or embedded
inside a reachable parent screen. Do not plan orphan route/phase-only screens
that render in App state but have no user-enterable path.

## Reopenable App Integration Files

These files may appear in `scope_files` for US-001 and for later screen stories
that need to wire owned generated controls into the app shell:
- `src/App.tsx`, `src/main.tsx`, `src/index.tsx`
- `src/index.css`, `src/App.css`
- `src/contexts/AppContext.tsx`, `src/hooks/useAppState.ts`, `src/types/domain.ts`, `src/utils/storage.ts`

Package manager, TypeScript, Vite, Next, and Tailwind config files remain setup
or final-test owned unless explicitly listed in the current story scope.

## Acceptance Criteria

Good criteria are mechanical and testable:
- "When the user clicks X, Y becomes visible."
- "Submitting with a missing required field is blocked and shows an error."
- "State persists after reload."
- "Tests pass and typecheck/build pass."

### UI Behavior Contract

PRD Product Surface actions are the behavior authority. Stitch DOM controls are
visual triggers. In `implementation_contract.owned_actions`, preserve PRD
`ACT_*` ids whenever Product Surfaces provide them, and put generated DOM action
ids/labels under `generated_action_ids`.

If UI_BEHAVIOR_CONTRACT exists, every button/link/input must appear in at least
one acceptance criterion. A criterion must describe behavior, not just presence:
route change, panel/dialog open, state/localStorage change, search/filter
result, validation feedback, or an intentional disabled/hidden state.

Icon-only controls need an accessible name or icon meaning tied to a behavior.
Do not invent unrelated example names.
Every interactive acceptance criterion must be verifiable after the action:
name the expected route/hash, visible panel/dialog, data/state change,
validation message, or intentional disabled state. Do not write criteria that
only say a control is present or clickable.

## Output Format

```
STATUS: done
STORIES_JSON:
[
  { "id": "US-001", "title": "...", "description": "...", "acceptanceCriteria": [...], "depends_on": [], "screens": [...], "scope_files": [...], "shared_files": [], "scope_description": "..." }
]
SCREEN_MAP:
[
  { "screenId": "...", "name": "...", "type": "...", "description": "...", "stories": ["US-001"] }
]
```

## Do Not

- Do not choose a new TECH_STACK.
- Do not invent screen paths.
- Do not create oversized stories.
- Do not assign the same file to multiple stories.
- Do not put App.tsx in an arbitrary feature story; only reopen app integration
  files for owned screen/action wiring.
- Do not output zero stories or missing scope descriptions.
