STORIES step — decompose the PRD into implementation-ready user stories.

## REPO

{{REPO}}

Repo lifecycle note: `stories` runs before `setup-repo` and before the project
repository is guaranteed to exist on disk. Treat this path as a future target
path only. Do NOT read `{{REPO}}/PRD.md`, package files, or source files for
required input. Use the embedded PRD, SCREEN_MAP, PREDICTED_SCREEN_FILES,
DESIGN_DOM_PREVIEW, and UI_BEHAVIOR_CONTRACT as the source of truth.

## PRD

{{PRD}}

## SCREEN_MAP

{{SCREEN_MAP}}

## DESIGN_SYSTEM

{{DESIGN_SYSTEM}}

## USER STORY LIMIT

{{STORY_COUNT_HINT}}

If this says `MAX_STORIES=N`, total STORIES_JSON length MUST be <= N, including
setup and integration. Combine small concerns into the nearest functional story
instead of exceeding the explicit user cap.

## PREDICTED_SCREEN_FILES

These are the exact Stitch-generated screen identities and legacy file hints.
Use them only to identify `screen_id` ownership and `target_slug`.
Do not output physical implementation paths as ownership truth. STORIES emits
logical `scope_targets`; SETUP-BUILD resolves those targets into files.

{{PREDICTED_SCREEN_FILES}}

## DESIGN_DOM_PREVIEW

This is the per-screen element summary, including buttons, links, and inputs. Use it to
choose scope ownership and to predict which components/hooks each screen needs.
If the same control appears on multiple screens, request a scoped shared edit
through `shared_edit_requests`. STORIES may request shared wiring but cannot
grant write permission. Generated screen identities still have exactly one owner
story.

{{DESIGN_DOM_PREVIEW}}

## UI_BEHAVIOR_CONTRACT

This behavior contract is extracted from the Stitch DOM. Before coding starts,
distribute every line into story acceptance criteria. Every active visible
button, link, icon-button, input, form submit, modal open/close action, delete
action, and navigation item needs one owning story.

If a visible active control is not explicitly described in the PRD, do one of:
- assign a real project-specific behavior that fits the product, or
- state that the control must be intentionally disabled/hidden.

No active-looking control may be left as a no-op.

{{UI_BEHAVIOR_CONTRACT}}

## Work

0. **LOCK THE PRODUCT CONCEPT.** Story title, description, acceptance criteria,
   and scope must preserve the PRD/task domain. Do not turn a counter into a
   game, a note app into a CRM, or a company page into a todo app. If unsure,
   reuse the product name and core user actions from the PRD.
1. **ONE MAIN CONCEPT PER STORY.** A story may own one component family, one
   hook+utility boundary, one screen flow, or one integration slice. Do not mix
   unrelated concepts.
2. **Separate setup/build from implementation ownership.**
   - Setup and build are already handled by earlier/later pipeline steps; do
     not create stories for package.json, scaffold, config, or dependency work.
   - US-001 owns the app shell, shared state, persistence, navigation, and
     `window.app` test bridge needed by generated screens.
   - US-002..N own Product Surface / generated screen action slices. Each
     story wires only its owned PRD actions and generated screen controls into
     the shared US-001 state contract.
3. **Prevent context bloat.** Each story should be small enough for implement
   to code, test, commit, and push without losing context.
4. Assign every screen in SCREEN_MAP to exactly one owner story. Use
   `scope_targets` with `role: "surface_component"` and the matching
   `screen_id`; do not output page/view/component paths.
   Every generated screen also needs a real user path from the first rendered
   app surface. A screen may be a separate route/phase only if some visible
   button/link/menu item/keyboard shortcut reaches it and a visible action
   returns to the main flow. Status/HUD screens may instead be embedded into a
   reachable parent screen. Do not leave orphan route/phase-only screens.
5. Split by structure, not by element count. If one screen combines a form, a
   list, and a detail drawer, use separate stories when those are distinct
   concepts.
6. Put shared components such as Button, Input, Modal, shared state, or layout
   only where one story clearly owns them. Later screen stories may ask for
   app-shell edits using `shared_edit_requests` only to connect their owned
   screen controls to already-planned shared state and navigation.
7. Write mechanical acceptance criteria for every UI_BEHAVIOR_CONTRACT item:
   `"Control name" opens the matching panel`, `"Route name" navigates to its
   route`, `"Action name" changes visible state/localStorage`, etc. Use real
   PRD/Stitch labels; do not copy placeholder names.
8. Add `implementation_contract` to every story. This is a behavior handoff,
   not a code plan. It MUST name owned screen ids, owned PRD `ACT_*`
   actions, Stitch control mappings, state contract, persistence contract,
   navigation contract, and test contract. PRD actions are the behavior
   authority; Stitch DOM controls are only visual triggers. Do not prescribe
   hook names, component splits, function names, or framework internals before
   setup has created the real repo.
9. Update SCREEN_MAP by adding a `stories` field to each screen.
10. Return the exact output format below.

## Story Schema Reference

Replace every placeholder with the real PRD domain and real logical ids.
Outputting literal placeholders such as `<domain>` is an error.

```json
{
  "id": "US-002",
  "title": "<PRD domain> — one functional slice",
  "description": "Concrete work that implements real PRD actions",
  "acceptanceCriteria": [
    "The first PRD behavior is implemented and testable",
    "The related UI action produces visible state/data change",
    "Required persistence/API/validation behavior is verified"
  ],
  "depends_on": [],
  "screens": ["SCR-001"],
  "requested_dependencies": [
    {
      "name": "recharts",
      "ecosystem": "npm",
      "reason": "render declared operational charts",
      "requested_by_action_ids": ["ACT_FILTER_INSIGHTS"]
    }
  ],
  "scope_targets": [
    {
      "role": "surface_component",
      "surface_id": "SURF_EXAMPLE",
      "screen_id": "SCR-001",
      "domain_slug": "tickets",
      "target_slug": "ticket-editor",
      "action_ids": ["ACT_SAVE_RECORD"],
      "entity_names": ["Ticket"],
      "resolved_path": null
    },
    {
      "role": "action_handler",
      "surface_id": "SURF_EXAMPLE",
      "screen_id": "SCR-001",
      "domain_slug": "tickets",
      "target_slug": "save-record",
      "action_ids": ["ACT_SAVE_RECORD"],
      "entity_names": ["Ticket"],
      "resolved_path": null
    }
  ],
  "shared_edit_requests": [
    {
      "role": "route_registration",
      "action": "register_route",
      "intent": "import resolved SurfaceComponent and append one route registration to the app shell route registry",
      "edit_scope": "route_registration_only",
      "requested_by": "US-002"
    }
  ],
  "scope_description": "State/helper + component family + related screen flow",
  "implementation_contract": {
    "owned_surface_ids": ["SURF_EXAMPLE"],
    "owned_screen_ids": ["SCR-001"],
    "owned_screen_files": [],
    "owned_actions": [
      {
        "id": "ACT_EXAMPLE",
        "trigger": "Exact Stitch control or PRD action",
        "state_change": "Visible app state/data change",
        "ui_feedback": "Visible confirmation, validation, route, panel, or disabled state",
        "surface_id": "SURF_EXAMPLE",
        "control_hint": "primary_button",
        "generated_action_ids": ["Stitch label or generated DOM action id"]
      }
    ],
    "state_contract": ["Named state responsibilities, not hook/function names"],
    "persistence_contract": ["localStorage/API/database behavior required by PRD"],
    "navigation_contract": ["reachable screen and return/close behavior"],
    "test_contract": ["deterministic behavior that implement must verify"]
  }
}
```

Optional but recommended: add `file_skeletons` where key = file path and value =
one sentence describing the file role only if PREDICTED_SCREEN_FILES already
provided that exact file. `scope_targets` remains the ownership source.

## Output Format

```
STATUS: done
STORIES_JSON:
[
  { "id": "US-001", "title": "...", "description": "...",
    "acceptanceCriteria": [...], "depends_on": [],
    "screens": [...], "requested_dependencies": [],
    "scope_targets": [...], "shared_edit_requests": [],
    "scope_description": "..." }
]
SCREEN_MAP:
[
  { "screenId": "...", "name": "...", "type": "...", "description": "...", "stories": ["US-001"] }
]
```

Do not read `rules.md`; the rules are embedded below.
