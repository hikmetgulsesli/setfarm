# Stories Implementation Contract Design

## Scope

This change strengthens only the `stories` step handoff into `implement`.
Plan, design, Stitch batch generation, setup, verify, QA, and deploy behavior are
out of scope unless they need to read the new story contract.

## Problem

Stories already consume PRD, `SCREEN_MAP`, `DESIGN_MANIFEST`, `DESIGN_DOM`, and
`UI_BEHAVIOR_CONTRACT`. The weak point is the handoff shape: a story can own
files and acceptance criteria without giving implement a compact contract for
the actions, state, persistence, navigation, and tests that must be delivered.

This leaves implement too much interpretation room, especially for generated
Stitch screens with many visible controls.

## Design

Each story includes a top-level `implementation_contract` object in
`STORIES_JSON`.

The contract is a behavior handoff, not a code plan. It may name owned screens,
actions, state concepts, persistence behavior, navigation behavior, and tests.
It must not require exact hook names, component splits, function names, or
framework internals before the repo exists.

Expected shape:

```json
{
  "implementation_contract": {
    "owned_screen_ids": ["SCR-002"],
    "owned_screen_files": ["src/screens/TicketEditor.tsx"],
    "owned_actions": [
      {
        "id": "ACT_SAVE_RECORD",
        "trigger": "Save button / form submit",
        "state_change": "valid draft becomes persisted ticket",
        "ui_feedback": "success confirmation and updated timestamp"
      }
    ],
    "state_contract": ["owns activeDraft, validationErrors, saveStatus"],
    "persistence_contract": ["writes Ticket changes to localStorage when DB_REQUIRED=none"],
    "navigation_contract": ["save returns to Ticket Operations; cancel closes editor"],
    "test_contract": ["empty required title shows inline validation"]
  }
}
```

## Pipeline Behavior

- `stories` prompt asks for `implementation_contract` on every story.
- Parser stores the contract in the `stories` table as JSON text.
- Implement context injects the current story contract as
  `{{STORY_IMPLEMENTATION_CONTRACT}}`.
- Implement prompt treats the contract as authoritative behavior scope.
- Guards reject malformed or missing contracts for feature stories.
- Existing `acceptanceCriteria`, `scope_files`, and `UI_BEHAVIOR_CONTRACT`
  remain active and compatible.

## Constraints

- No per-project hardcoding.
- No local fallback design.
- No screen generation in stories.
- No hook/component/function name prescription from stories.
- Setup/app-shell stories describe app shell/tooling responsibilities, not
  feature screen internals.
- Integration stories may own app shell/routing/global wiring but should not
  duplicate screen-owned behavior.

## Verification

Add tests for:

- Parser persists `implementation_contract`.
- Implement context injects it.
- Stories guard rejects feature stories without a useful contract.
- Existing stories tests keep passing.
