# Setfarm Pipeline Review Packet

Date: 2026-05-20

Purpose: external architecture review for Setfarm's contract-led software generation pipeline.

This document is meant to be pasted into Gemini, Sonnet, or another reviewer model. The requested response should be a critical review, not a generic approval.

## Reviewer Prompt

You are reviewing Setfarm, an autonomous multi-step AI software generation pipeline.

Please critique the architecture below. Do not give generic praise. Focus on contradictions, missing contracts, bad separation of concerns, stack/platform risks, brittle handoffs, over-strict gates, under-specified gates, and places where implementation agents may still hallucinate or overreach.

Answer these questions:

1. Is the PLAN contract strong enough for web, mobile, desktop, API, CLI, and game projects?
2. Is the DESIGN/Stitch strategy correct, especially batch generation, Product Surfaces, `SCREEN_SPEC` blocks, and passive `FULL_PRD_APPENDIX`?
3. Is the STORIES contract sufficient to prevent weak implementation, duplicated ownership, missing PRD actions, and orphan screens?
4. Is the proposed SETUP/BUILD refactor complete enough, or are stack packs, gates, evidence files, or retry policies missing?
5. Is `IMPLEMENTATION_HANDOFF.json` the right boundary between setup/build and implement?
6. Which parts are too strict and may block valid projects?
7. Which parts are too loose and may allow agents to invent code, screens, dependencies, or framework behavior?
8. What exact changes should be made before implementation starts?

Return the answer in this structure:

- Critical Issues
- Missing Contracts
- Risky Assumptions
- Recommended Schema/Rule Changes
- Setup/Build Refactor Adjustments
- Implementation Order
- Final Verdict

## Pipeline Goal

Setfarm should generate software through deterministic contracts:

```text
PLAN -> DESIGN -> STORIES -> SETUP-REPO -> SETUP-BUILD -> IMPLEMENT -> VERIFY -> SECURITY -> QA -> FINAL
```

The current focus is to make the first five steps contract-clean before redesigning implement.

Core principles:

- No project-specific hardcoding.
- No runtime paths, branch names, repo names, or package names in PLAN.
- No local fallback design when Stitch is required.
- Product behavior comes from PLAN/PRD.
- Visual design comes from Stitch/DESIGN.
- Implementation story ownership comes from STORIES.
- Runtime setup/build comes from MC/setup contracts.
- Unsupported or ambiguous stack choices fail explicitly instead of silently falling back.

## Step 1: PLAN Contract

PLAN is the portable product contract. It answers:

- what product behavior must exist
- what platform contract applies
- which tech stack is intended
- whether design is required
- what data, state, actions, validation, errors, tests, and out-of-scope rules apply

PLAN must not answer:

- where the repo lives
- what branch is used
- what GitHub repo is created
- what package name is used
- what exact screens Stitch will draw
- what local/server paths are used

Required output:

```text
STATUS: done
PROJECT_NAME: <product name>
PROJECT_SLUG: <kebab-case product slug>
PLATFORM: <web|mobile|desktop|api|cli|game>
TECH_STACK: <vite-react|nextjs|vanilla-ts|node-express|react-native|...>
UI_LANGUAGE: <English or requested language>
DB_REQUIRED: <none|postgres|sqlite>
DESIGN_REQUIRED: <true|false>
PRD:
<product contract>
```

Mandatory PRD sections:

1. Context And Goals
2. Data And State Contract
3. Behavioral And Action Contract
4. Product Surfaces, only for UI-bound platforms
5. Validation And Error Strategy
6. System Contracts
7. Platform Contract
8. Testability Contract
9. Out Of Scope

Product Surfaces are semantic, not physical screens. Stitch decides layout, screen count, routes, tabs, modals, drawers, and component hierarchy.

Each Product Surface includes:

- `SURFACE_ID`
- name
- purpose
- data entities bound
- core content
- permitted actions with `control_hint`
- entry points
- exit and guard rules
- auth required
- design guidance

PRD actions use `ACT_*` ids and must define:

- surface bound
- trigger
- preconditions and auth
- async behavior
- success and failure effects
- navigation after success and failure
- state changes
- persistence effects
- user feedback
- unauthorized effect

When `DESIGN_REQUIRED=false`, Product Surfaces and Stitch are skipped.

## Step 2: DESIGN/Stitch Contract

DESIGN builds a scoped Stitch design brief from PLAN Product Surfaces and generates Stitch artifacts.

Inputs:

- PRD from PLAN
- Product Surfaces
- action control hints
- validation/error strategy
- UI anti-goals
- platform/device target

Outputs:

- `stitch/DESIGN_BRIEF.md`
- `stitch/DESIGN.md`
- `stitch/DESIGN_MANIFEST.json`
- `stitch/DESIGN_DOM.json`
- `stitch/UI_CONTRACT.json`
- `stitch/design-tokens.css`
- `stitch/design-tokens.json`
- `stitch/*.html`
- `stitch/*.png`
- `SCREEN_MAP` with `surfaceIds`
- `DESIGN_SYSTEM`

Design generation strategy:

- Use Product Surfaces as the design source.
- Generate screens in batch stages, not one screen at a time.
- Each batch uses explicit `SCREEN_SPEC` blocks.
- Batch size may be staged, such as first 5 screens then remaining screens in the same Stitch project.
- If the Stitch project already has earlier screens, later batch stages must preserve the same visual system and navigation pattern.
- `FULL_PRD_APPENDIX` may be included only as passive context, not active screen source.
- `SCREEN_SPECS` remain the active design source.
- Stitch must not render PRD text into UI.
- Stitch must not invent modules outside Product Surfaces.
- Empty/loading/error states may be inline inside declared Product Surfaces.

Design verify must fail for:

- unrelated generated screens
- unmapped screens
- missing required Product Surface coverage
- out-of-scope modules
- invalid/missing Stitch outputs

Open question for reviewer: should missing surfaces always fail, or should some surfaces, such as error/empty recovery, pass when they are represented inline inside other screens?

## Step 3: STORIES Contract

STORIES consumes:

- PRD
- `SCREEN_MAP`
- `DESIGN_SYSTEM`
- `DESIGN_DOM_PREVIEW`
- `UI_BEHAVIOR_CONTRACT`
- predicted generated screen file paths

Stories run before setup-repo, so they cannot depend on repo files existing.

Story goals:

- dependency-ordered
- non-overlapping
- feature-sliced
- implementation-ready
- exact file ownership
- PRD action ownership
- no setup/toolchain work

Story ordering:

1. `US-001`: app shell, shared state, persistence, navigation, deterministic test bridge.
2. `US-002+`: Product Surface/generated screen action slices.
3. Later stories may reopen app integration files only for their owned screen/action wiring.

Every story has:

```json
{
  "id": "US-001",
  "title": "",
  "description": "",
  "acceptanceCriteria": [],
  "depends_on": [],
  "screens": [],
  "scope_files": [],
  "shared_files": [],
  "scope_description": "",
  "implementation_contract": {
    "owned_screen_ids": [],
    "owned_screen_files": [],
    "owned_actions": [
      {
        "id": "ACT_SAVE_RECORD",
        "trigger": "",
        "state_change": "",
        "ui_feedback": "",
        "generated_action_ids": []
      }
    ],
    "state_contract": [],
    "persistence_contract": [],
    "navigation_contract": [],
    "test_contract": []
  }
}
```

Rules:

- PRD `ACT_*` action ids are behavioral authority.
- Stitch DOM controls are visual triggers.
- Generated DOM control ids go under `generated_action_ids`.
- Every Product Surface action pair must be owned by exactly one story.
- Every generated screen must be owned by exactly one story or be a shared/non-visual artifact.
- Config/package/build files are setup/build-owned, not story-owned.
- App integration files are controlled and may only be reopened for explicit owned action wiring.

Recent refactor already added:

- PRD contract parser
- action/control mapper
- PRD action coverage gate
- prompt/rules cleanup around `US-001`

## Steps 4-5: Proposed SETUP/BUILD Refactor

Current problem:

- `setup-repo` is mostly `setup-repo.sh` plus preclaim auto-complete.
- `setup-build` mixes npm install, build, compat, Tailwind, Stitch conversion, post-build, and commits inside one preclaim file.
- Stack contract exists but setup still behaves too much like Vite/Next script logic.
- Setup/build need to match the contract strength of PLAN, DESIGN, and STORIES.

Target architecture:

```text
setup-contract/
setup-orchestrator/
setup-scaffold/
design-handoff/
```

### `src/installer/setup-contract/`

- `types.ts`
- `resolver.ts`
- `packs.ts`
- `ledger.ts`
- `validate.ts`

### `src/installer/setup-orchestrator/`

- `repo-orchestrator.ts`
- `build-orchestrator.ts`
- `git-baseline.ts`
- `process.ts`
- `evidence.ts`

### `src/installer/setup-scaffold/`

Supported scaffold modules:

- `vite-react.ts`
- `nextjs.ts`
- `static-html.ts`
- `browser-game.ts`
- `node-express.ts`
- `python-cli.ts`
- `python-web.ts`
- `react-native-expo.ts`
- `android.ts`
- `ios.ts`
- `desktop-electron.ts`

### `src/installer/design-handoff/`

- `stitch-assets.ts`
- `stitch-to-component.ts`
- `screen-contract.ts`

Stack pack shape:

```ts
{
  id,
  platform,
  techStackAliases,
  designPolicy,
  scaffoldPolicy,
  commands,
  requiredFiles,
  artifactChecks,
  implementationBoundaries,
  verificationPolicy
}
```

Required stack packs:

- `vite-react-web-app`
- `nextjs-web-app`
- `static-html-site`
- `browser-game`
- `node-express-api`
- `python-web-api`
- `node-cli`
- `python-cli`
- `react-native-expo`
- `android-native`
- `ios-native`
- `desktop-electron`

Design policies:

- `stitch-required`
- `stitch-brief-only`
- `optional-stitch`
- `none`

API, CLI, Android native, and iOS native stacks must not force Stitch. Web/static/Next/Vite/Electron renderer stacks require design handoff when `DESIGN_REQUIRED=true`.

Setup/build gates:

- `SETUP_CONTRACT_UNRESOLVED`
- `UNSUPPORTED_STACK`
- `STACK_POLICY_MISMATCH`
- `SCAFFOLD_REQUIRED_FILE_MISSING`
- `BUILD_COMMAND_MISSING`
- `BUILD_FAILED`
- `DESIGN_HANDOFF_MISSING`
- `GENERATED_SCREEN_MISMATCH`
- `IMPLEMENTATION_HANDOFF_MISSING`
- `SETUP_OWNED_FILE_DIRTY`

Setup/build evidence files:

- `.setfarm/setup/SETUP_CONTRACT.json`
- `.setfarm/setup/REPO_EVIDENCE.json`
- `.setfarm/setup/BUILD_EVIDENCE.json`
- `.setfarm/setup/DESIGN_HANDOFF.json`
- `.setfarm/setup/IMPLEMENTATION_HANDOFF.json`
- `.setfarm/setup/FAILURE.json`

## Implementation Handoff

`setup-build` must write:

```text
.setfarm/setup/IMPLEMENTATION_HANDOFF.json
```

Required shape:

```json
{
  "schema": "setfarm.implementation-handoff.v1",
  "runId": "",
  "projectName": "",
  "projectSlug": "",
  "platform": "",
  "techStack": "",
  "stackPackId": "",
  "commands": {
    "install": "",
    "dev": "",
    "build": "",
    "test": "",
    "smoke": ""
  },
  "entrypoints": [],
  "setupOwnedFiles": [],
  "sharedEditableFiles": [],
  "generatedDesignFiles": [],
  "storyOwnership": {
    "source": "stories.implementation_contract",
    "rule": "Story may edit only its scope_files plus explicitly listed sharedEditableFiles when ownership requires app integration."
  },
  "forbiddenDuringImplement": [],
  "designAuthority": {
    "required": false,
    "source": "",
    "screenMap": "",
    "rules": []
  },
  "verification": {
    "buildArtifact": "",
    "testHandlePolicy": "",
    "runtimeBridge": ""
  }
}
```

Implement receives:

- `implementation_handoff_path`
- `implementation_handoff_excerpt`
- `setup_owned_files`
- `forbidden_during_implement`
- `stack_pack_id`
- `build_cmd`
- `test_cmd`
- `design_handoff_path`

File ownership:

- Setup-owned files are locked after setup-build.
- Package dependencies are not ad hoc during implement.
- `src/App.tsx` is controlled shared integration.
- Generated Stitch screens are visual source material, not final behavior.
- PRD actions remain behavioral authority.

## Current Concern Areas

Please focus critique on these:

1. Full PRD vs focused Stitch payload: previous attempts without enough PRD context sometimes produced weak or unrelated designs; too much PRD context risks PRD text appearing in the UI.
2. Batch Stitch generation: one batch is coherent, but too many surfaces may need staged 5+N generation in the same project. The prompt must make every screen spec distinct.
3. Inline recovery surfaces: empty/error/settings surfaces may be represented inline instead of separate screens. Verification must handle this without hiding missing important functionality.
4. Stack completeness: setup/build must not silently default to Vite for API, CLI, mobile, Android, iOS, desktop, or game projects.
5. Handoff strictness: locking setup-owned files protects baseline, but may block legitimate story fixes if scope rules are too rigid.
6. App shell ownership: `US-001` owns app shell, but later stories may need limited integration edits. The boundary must be enforceable.
7. Existing repositories: setup must verify without overwriting meaningful existing code.
8. Design-to-code conversion: Stitch HTML to components may be useful for web, but not directly for React Native/native mobile/API/CLI.
9. Contract ledger: setup/build evidence should feed UI contract checks so users see precise pass/fail reasons.
10. Retry behavior: structured failures should avoid infinite retries and avoid agent claims of success without rerunning gates.

## Desired Review Output

Please give concrete edits, not high-level encouragement. If a schema is wrong, rewrite it. If a gate is missing, name it. If a rule is too strict, explain the exact exception. If a step boundary is wrong, propose the corrected boundary.

