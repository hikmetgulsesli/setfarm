# Setfarm Pipeline Final Plan

Date: 2026-05-20
Last revised: 2026-05-21

Status: final review spec, revised after external Gemini and Sonnet review. This document supersedes the older setup/build and review-packet drafts from 2026-05-20 where they conflict.

## Reviewer Prompt

You are reviewing Setfarm, a contract-led autonomous software generation pipeline.

Please critique this final architecture as an adversarial senior platform orchestration engineer. Do not give generic praise. Focus on contradictions, missing contracts, brittle handoffs, weak gates, stack/platform gaps, places where agents can still hallucinate, and places where the design is too strict or too loose.

Questions to answer:

1. Is the pipeline order correct: `PLAN -> DESIGN -> STORIES -> SETUP-REPO -> SETUP-BUILD -> IMPLEMENT`?
2. Is the separation between logical story ownership, `FILE_TREE_MANIFEST.json`, and physical file resolution strong enough?
3. Is the Stitch strategy strong enough for web, desktop, and browser-game UI while avoiding attention dilution?
4. Are setup/build stack packs, evidence files, retry limits, and failure contracts complete?
5. Are `SETUP_CERTIFICATE.json` and per-story `IMPLEMENT_CONTEXT.json` the right handoff split?
6. Which schema fields are still missing before implementation starts?
7. Which gates can produce false positives or false negatives?
8. What exact changes should be made before coding this refactor?

Return the answer in this structure:

- Critical Issues
- Missing Contracts
- Risky Assumptions
- Recommended Schema/Rule Changes
- Setup/Build Refactor Adjustments
- Implementation Order
- Final Verdict

## Goal

Setfarm must behave as a deterministic software factory, not a loose code generator. Every step emits a contract consumed by the next step. Agents may fill in product-specific content, but they must not invent runtime paths, framework behavior, unrelated screens, dependencies, or ownership boundaries.

Core principles:

- PLAN owns product behavior.
- DESIGN/Stitch owns visual UI design for UI-bound stacks.
- STORIES owns logical implementation slices, not physical files.
- SETUP-REPO and SETUP-BUILD own repository/runtime/bootstrap reality.
- MC owns run identity, paths, branch names, repo names, env values, and per-story context assembly.
- IMPLEMENT owns only the story work allowed by its resolved context.
- Unsupported or ambiguous stack choices fail explicitly. No silent fallback to Vite, React, or any project-specific default.

Pipeline order remains:

```text
PLAN -> DESIGN -> STORIES -> SETUP-REPO -> SETUP-BUILD -> IMPLEMENT -> VERIFY -> SECURITY -> QA -> FINAL
```

The order is not changed because STORIES is a planning artifact. The fix is that STORIES stops guessing physical paths.

## PLAN Contract

PLAN outputs a portable product contract. It must not include repo paths, branch names, package names, run slugs, local directories, GitHub URLs, or physical implementation files.

Required top-level fields:

```yaml
STATUS: done
PROJECT_NAME: "product name from user request or PRD inference"
PROJECT_SLUG: "stable kebab-case product slug"
PLATFORM: "web | mobile | desktop | api | cli | game"
TECH_STACK: "vite-react | nextjs | static-html | browser-game | react-native-expo | node-express | python-web | node-cli | python-cli | android-native | ios-native | desktop-electron"
UI_LANGUAGE: "requested UI language"
DB_REQUIRED: "none | postgres | sqlite | external"
DESIGN_REQUIRED: true
UI_VISION_SUMMARY: "3-4 UI-focused sentences for DESIGN only"
PRD:
  ...
```

Mandatory PRD sections:

1. Context And Goals
2. Data And State Contract
3. Behavioral And Action Contract
4. Product Surfaces, for UI-bound platforms
5. Validation And Error Strategy
6. System Contracts
7. Platform Contract
8. Testability Contract
9. Out Of Scope

PLAN adds these required contracts:

```yaml
mock_data_contract:
  strategy: "fixture_files | seed_function | inline_constants"
  required_entities: []
  required_states: [] # PLAN fills product-specific states such as ready, empty, error, loading, offline, locked, partial
  persistence_seed_policy: "localStorage | sqlite_seed | server_seed | none"
  injection_boundary: "resolved by stack pack"

data_access_contract:
  client_state: "local_state | zustand | redux | none"
  server_state: "none | raw_fetch | react_query | swr | server_actions"
  persistence_adapter: "localStorage | sqlite | postgres | external_api | none"

route_guard_policy:
  public_surfaces: []
  protected_surfaces: []
  redirect_on_unauthorized: null
  guard_implementation_owner: "US-001"
  implementation_mode: "plumbing_only_until_surface_routes_exist"
```

Product Surface schema:

```yaml
product_surfaces:
  - surface_id: "SURF_*"
    name: ""
    domain_hint: ""
    purpose: ""
    representation: "standalone | inline"
    host_surface_id: null
    data_entities_bound: []
    core_content: []
    display_fields: []
    permitted_actions:
      - action_id: "ACT_*"
        control_hint: "primary_button | secondary_button | icon_button | context_menu | context_menu_destructive | form_submit | inline_edit | swipe_action | fab | search_input_persistent | keyboard_shortcut | none"
    entry_points: []
    exit_points: []
    auth_required: false
    design_guidance: ""
```

Rules:

- `host_surface_id` is required when `representation=inline`.
- `standalone` surfaces require standalone DESIGN coverage.
- `inline` surfaces pass DESIGN coverage only when represented inside their declared host surface.
- `control_hint: none` is valid only for system-triggered or non-visual actions.
- Out Of Scope must include product-specific anti-goals and universal runtime-boundary bans.
- `mock_data_contract.required_states` is product-specific. `ready`, `empty`, and `error` are common defaults, not a fixed global list.
- US-001 implements route guard plumbing only. It must not import or reference feature route components that do not exist yet.

## DESIGN And Stitch Contract

DESIGN consumes PLAN and produces Stitch artifacts. It does not consume raw full PRD text as visual source.

`FULL_PRD_APPENDIX` is removed. The term must not appear in prompts or generated design briefs.

DESIGN constructs a `PRD_CONTEXT_SLICE` with only UI-relevant content:

- product name, platform, stack, UI language
- `UI_VISION_SUMMARY`
- Product Surfaces
- action control hints
- visible data fields and visible relationships that are referenced by Product Surfaces
- validation/error display strategy
- route/guard effects that affect UI
- empty/loading/error states
- UI anti-goals and out-of-scope modules
- browser-game visual HUD/menu/control expectations when applicable

Stitch payload order:

1. `STRICT_UI_SCOPE_CONTRACT`
2. `UI_VISION_SUMMARY`
3. `PRODUCT_SURFACES`
4. explicit `SCREEN_SPEC` blocks
5. `ACTION_CONTROL_HINTS`
6. `UI_OUT_OF_SCOPE`
7. `PRD_CONTEXT_SLICE`

Stitch must not receive backend schemas, test contracts, CLI contracts, API endpoint internals, setup/build commands, repo paths, env values, or failure ledgers.

`PRD_CONTEXT_SLICE` field rule:

- Include only entities referenced by `product_surfaces[].data_entities_bound`.
- Include only fields referenced by `product_surfaces[].core_content`, `display_fields`, visible validation, or permitted action feedback.
- Exclude DB constraints, seed internals, endpoint status codes, test handles, and stack setup instructions.

### Batch Strategy

Stitch generation is batch-first.

- Preferred path: generate all required standalone screens in one Stitch project using one batch prompt when Stitch accepts it.
- If Stitch output length or product size requires staging, use staged batch in the same Stitch project.
- Default staged batch size is up to 5 standalone screens per batch.
- Subsequent batch prompts must include `design_system_lock` derived from first batch tokens, navigation structure, density, typography, and shared component rules.
- `DESIGN_TOKEN_LOCK_MISSING` triggers before batch 2+ starts. The check requires `stitch/design-tokens.css` and `stitch/design-tokens.json` to exist and be non-empty after batch 1. Failure blocks the next batch and retries batch 1 in the same Stitch project.
- Per-screen generation is not the normal path. It is disabled by default and only allowed as explicit recovery for missing standalone surfaces after batch verification fails.
- Recovery must use the same Stitch project for the run.

Stitch project identity:

- MC creates or resolves a Stitch project per Setfarm run.
- Retries within the same run reuse the same Stitch project.
- A new Setfarm run gets a distinct Stitch project unless the operator explicitly attaches an existing Stitch project.
- Stitch project id is runtime state and never appears in PLAN.

### DESIGN Outputs

Required outputs for UI-bound stacks:

```text
stitch/DESIGN_BRIEF.md
stitch/DESIGN.md
stitch/DESIGN_MANIFEST.json
stitch/DESIGN_DOM.json
stitch/UI_CONTRACT.json
stitch/design-tokens.css
stitch/design-tokens.json
stitch/*.html
stitch/*.png
SCREEN_MAP
DESIGN_SYSTEM
```

Design verify gates:

- `DESIGN_STITCH_PROJECT_UNAVAILABLE`
- `DESIGN_ARTIFACT_MISSING`
- `DESIGN_SURFACE_MISMATCH`
- `DESIGN_INLINE_SURFACE_UNDECLARED`
- `DESIGN_UNMAPPED_SCREEN`
- `DESIGN_RELATEDNESS_FAIL`
- `DESIGN_TOKEN_LOCK_MISSING`
- `DESIGN_DOM_EXTRACTION_FAILED`

Coverage rules:

- Every standalone Product Surface needs a mapped screen.
- Every inline Product Surface needs declared host coverage.
- Extra screens are allowed only when they map to Product Surfaces or declared shared visual system artifacts.
- A design-system board is not a product screen.
- Missing Settings, Empty, Error, Help, or Recovery coverage fails only when PLAN declares them standalone. Inline coverage passes when declared and visible in host DOM metadata.

### Browser Game Design Policy

Browser games are UI-bound. Stitch is applicable and required when `DESIGN_REQUIRED=true`.

Stitch is authority for:

- title/menu screens
- HUD layout
- pause, settings, help, game-over, restart, score panels
- mobile/touch control layout
- visual style, tokens, typography, iconography, composition

Stitch is not authority for:

- game loop
- physics
- collision detection
- scoring logic
- level state machine
- input runtime correctness
- canvas/WebGL render correctness

Browser game verify must prove the runtime is playable:

- canvas or scene is nonblank
- keyboard/touch input changes state
- score/progress updates
- pause/restart/game-over states work
- frame loop runs without console errors

Browser game DOM policy:

- Default `browser-game` stack pack uses `conversionPolicy=reference_only`.
- Stitch guides menu/HUD/overlay composition, but raw Stitch HTML is not automatically mounted over the canvas.
- DOM overlays are allowed only when the stack pack declares `domOverlayPolicy=external_shell` or `hybrid`.
- Canvas/WebGL input handling must remain owned by the game runtime story and final runtime tests.

## STORIES Contract

STORIES is a pure planning artifact. It consumes PLAN, DESIGN outputs, Product Surfaces, `SCREEN_MAP`, `DESIGN_SYSTEM`, `DESIGN_DOM_PREVIEW`, and `UI_BEHAVIOR_CONTRACT`.

STORIES must not depend on repository files existing. It must not output physical implementation paths as ownership truth.

`scope_files` is replaced by `scope_targets`.

Story schema:

```json
{
  "id": "US-001",
  "title": "",
  "description": "",
  "acceptanceCriteria": [],
  "depends_on": [],
  "screens": [],
  "requested_dependencies": [
    {
      "name": "recharts",
      "ecosystem": "npm",
      "reason": "render declared insights charts",
      "requested_by_action_ids": ["ACT_FILTER_INSIGHTS"]
    }
  ],
  "scope_targets": [
    {
      "role": "app_shell | route_registration | surface_component | action_handler | state_store | fixture_data | persistence_adapter | test_bridge | style_integration | game_runtime | api_route | cli_command",
      "surface_id": "SURF_*",
      "screen_id": "SCR-*",
      "domain_slug": "tickets",
      "target_slug": "ticket-editor",
      "action_ids": ["ACT_*"],
      "entity_names": [],
      "resolved_path": null
    }
  ],
  "shared_edit_requests": [
    {
      "role": "route_registration",
      "action": "register_route",
      "intent": "import resolved SurfaceComponent and append one route registration to the app shell route registry",
      "edit_scope": "route_registration_only",
      "requested_by": "US-003"
    }
  ],
  "implementation_contract": {
    "owned_surface_ids": [],
    "owned_screen_ids": [],
    "owned_actions": [
      {
        "action_id": "ACT_*",
        "source": "PRD",
        "visual_trigger_source": "DESIGN_DOM",
        "required_action_checks": [
          "preconditions handled",
          "success effect implemented",
          "failure effect implemented",
          "state changes implemented",
          "persistence effect implemented",
          "user feedback implemented"
        ],
        "generated_action_ids": []
      }
    ],
    "state_contract": [],
    "persistence_contract": [],
    "navigation_contract": [],
    "mock_data_contract": [],
    "test_contract": []
  }
}
```

Rules:

- Every PRD `ACT_*` action must be owned by exactly one story unless it is explicitly non-visual/shared.
- Every generated screen must be owned by exactly one story or declared shared design artifact.
- STORIES may request shared edits, but cannot grant shared edit permission.
- STORIES cannot name setup/build files as editable work.
- Stories cannot prescribe framework internals before setup-build resolves the stack.
- `requested_dependencies` is advisory input to SETUP-BUILD. IMPLEMENT may not add ad hoc packages outside the resolved dependency contract.
- `domain_slug` and `target_slug` are sanitized logical identifiers, not paths. SETUP-BUILD may reject or normalize them.
- US-001 owns app shell, navigation, state/persistence baseline, fixture seed path, route guard implementation, and deterministic test bridge.
- Feature stories own behavior slices mapped to Product Surfaces and PRD actions.

## SETUP-REPO Contract

SETUP-REPO resolves runtime repository reality from MC context plus PLAN metadata.

It owns:

- repository path
- feature branch
- Git remote handling
- runtime project directory
- base scaffold creation or verification
- stack pack selection
- initial runtime ledger creation

It does not use PLAN-generated paths because PLAN must not generate paths.

Stack pack selection:

- exact match from `PLATFORM`, `TECH_STACK`, `DESIGN_REQUIRED`, and repo evidence
- unsupported stack fails with `UNSUPPORTED_STACK`
- ambiguous stack fails with `SETUP_CONTRACT_UNRESOLVED`
- no default fallback to Vite or React

Scaffold detection must be discriminative:

```ts
detect(projectRoot: string): {
  match: boolean;
  confidence: "exact" | "partial" | "ambiguous";
  evidence: string[];
}
```

Only `confidence=exact` can auto-select a stack pack. `partial` or `ambiguous` fails with `SETUP_CONTRACT_UNRESOLVED`.

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

## SETUP-BUILD Contract

SETUP-BUILD proves the scaffold can build or execute according to the stack pack. It also resolves logical story targets into physical file paths, but it does not mutate story ownership.

It owns:

- dependency install command
- build/test/smoke commands
- artifact checks
- design handoff validation
- StackPack conversion policy
- setup-owned file lock
- immutable `SETUP_CERTIFICATE.json`
- target resolution rules for MC
- deterministic `FILE_TREE_MANIFEST.json`
- dependency aggregation and installation before setup lock

It does not write per-story `IMPLEMENT_CONTEXT.json`. MC assembles implement context from the certificate plus story contracts immediately before each story runs.

### File Tree Resolution

SETUP-BUILD resolves `scope_targets` through a deterministic resolver, not a free-form LLM.

Inputs:

- stack pack `targetResolutionRules`
- story `scope_targets`
- story `requested_dependencies`
- Product Surface `domain_hint`
- sanitized `domain_slug` and `target_slug`
- `SCREEN_MAP`

Output:

```text
.setfarm/setup/FILE_TREE_MANIFEST.json
```

Shape:

```json
{
  "schema": "setfarm.file-tree-manifest.v1",
  "runId": "",
  "stackPackId": "",
  "resolvedTargets": [
    {
      "storyId": "US-003",
      "role": "surface_component",
      "surfaceId": "SURF_TICKET_EDITOR",
      "screenId": "SCR-002",
      "domainSlug": "tickets",
      "targetSlug": "ticket-editor",
      "path": "src/features/tickets/TicketEditor.tsx",
      "ruleId": "vite.surface_component"
    }
  ],
  "dependencyPlan": [],
  "mockInjectionPoints": [],
  "routeRegistrationPlan": []
}
```

Rules:

- `targetResolutionRules` must be non-empty for every role supported by the stack pack.
- Resolver may normalize slugs but must not invent directories outside stack pack templates.
- If a role has no rule, setup-build fails with `SCOPE_TARGET_UNRESOLVED`.
- If two stories resolve to the same write path without an explicit shared-edit grant, setup-build fails.
- MC may only use paths from `FILE_TREE_MANIFEST.json`; it must not synthesize fallback paths.
- An LLM may propose `domain_slug` or `target_slug` during STORIES, but path resolution remains deterministic and testable.

### Stack Pack Shape

```ts
interface StackPack {
  id: string;
  platform: string;
  techStackAliases: string[];
  designPolicy: "stitch-required" | "stitch-brief-only" | "none";
  conversionPolicy: "none" | "wrap_jsx" | "reference_only" | "native_equivalent";
  domOverlayPolicy?: "none" | "external_shell" | "hybrid";
  scaffoldPolicy: "create" | "verify-existing" | "hybrid";
  commands: {
    setup?: string;
    install?: string;
    dev?: string;
    build?: string;
    test?: string;
    smoke?: string;
  };
  requiredFiles: string[];
  artifactChecks: string[];
  entrypoints: string[];
  allowedDependencies: string[];
  targetResolutionRules: Record<string, {
    ruleId: string;
    template: string;
    allowedRoles: string[];
  }>;
  mockInjectionPolicy: {
    fixtureRoot?: string;
    bootstrapFile?: string;
    productionIsolation: "test_only" | "dev_only" | "runtime_seed";
  };
  dataAccessPolicy: {
    defaultClientState: string;
    defaultServerState: string;
    allowedLibraries: string[];
  };
  implementationBoundaries: {
    setupOwnedFiles: string[];
    forbiddenDuringImplement: string[];
    sharedFiles: string[];
  };
}
```

Example target resolution rules:

```ts
targetResolutionRules: {
  surface_component: {
    ruleId: "vite.surface_component",
    template: "src/features/{domain_slug}/{ComponentName}.tsx",
    allowedRoles: ["surface_component"]
  },
  state_store: {
    ruleId: "vite.state_store",
    template: "src/features/{domain_slug}/{domain_slug}.store.ts",
    allowedRoles: ["state_store"]
  },
  fixture_data: {
    ruleId: "vite.fixture_data",
    template: "src/__fixtures__/{domain_slug}.fixture.ts",
    allowedRoles: ["fixture_data"]
  }
}
```

Shared edit permission is not stored as mutable story-specific state in the setup certificate. Stack packs list shared files; MC grants per-story shared edits only in `IMPLEMENT_CONTEXT.json` after checking story `shared_edit_requests`.

### Conversion Policy

- Vite/Next/static web: `wrap_jsx` or `reference_only` according to stack pack.
- Desktop Electron renderer: `wrap_jsx` or `reference_only` according to renderer stack.
- Browser game: `reference_only` by default; Stitch guides UI shells and overlays, not game runtime logic. A separate stack pack may use `wrap_jsx` only when it declares a DOM-first game shell.
- React Native/Expo: `reference_only`; raw Stitch HTML is not automatically converted to native components.
- Android native and iOS native: `none`; design may be reference material only when separately supported.
- API/CLI stacks: `none`; DESIGN must be skipped.

### React Native/Expo Build Evidence

`react-native-expo` stack pack must define:

```ts
verificationPolicy: {
  buildCommand: "npx expo export --platform web --dev",
  smokeCommand: "npx expo-doctor",
  artifactCheck: "dist/index.html OR expo-doctor exit 0",
  nativeBuildPolicy: "out_of_scope_for_setfarm_pipeline",
  nativeEvidenceClaim: "not_native_build_evidence"
}
```

Expo web export is not native iOS/Android evidence. If a task requires native device evidence, the stack pack must fail with `UNSUPPORTED_NATIVE_BUILD_ENVIRONMENT` unless a configured native CI/device workflow exists.

### Python Stack Contract

Python stacks must use explicit venv commands:

```text
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pytest
```

Shell activation is not a contract boundary. Commands must call `.venv/bin/python` directly and execute with `VIRTUAL_ENV` and `PATH` patched so subprocesses use the same venv.

Host OS support is explicit. If a stack pack only supports POSIX paths, Windows host execution fails with `UNSUPPORTED_HOST_OS` instead of guessing `.venv` paths.

## Setup Certificate And Implement Context

`SETUP_CERTIFICATE.json` is immutable after setup-build succeeds.

Path:

```text
.setfarm/setup/SETUP_CERTIFICATE.json
```

Shape:

```json
{
  "schema": "setfarm.setup-certificate.v1",
  "runId": "",
  "projectName": "",
  "projectSlug": "",
  "platform": "",
  "techStack": "",
  "stackPackId": "",
  "commands": {},
  "entrypoints": [],
  "setupOwnedFiles": [],
  "forbiddenDuringImplement": [],
  "sharedFiles": [],
  "scaffoldSnapshot": [],
  "generatedDesignFiles": [],
  "designAuthority": {
    "required": true,
    "source": "stitch",
    "screenMap": "stitch/SCREEN_MAP.json",
    "rules": [],
    "conversionPolicy": "reference_only",
    "conversionNote": "Reference material only when stack pack cannot consume raw Stitch HTML."
  },
  "fileTreeManifestPath": ".setfarm/setup/FILE_TREE_MANIFEST.json",
  "targetResolutionRules": {
    "surface_component": {
      "ruleId": "vite.surface_component",
      "template": "src/features/{domain_slug}/{ComponentName}.tsx"
    }
  },
  "dependencyEvidence": {
    "requested": [],
    "approved": [],
    "installed": [],
    "rejected": []
  },
  "buildEvidence": {
    "buildCommand": "",
    "artifactPath": "",
    "stdoutPath": "",
    "stderrPath": ""
  }
}
```

`IMPLEMENT_CONTEXT.json` is assembled per story by MC immediately before implement runs.

Path:

```text
.setfarm/implement-context/US-001.json
```

Shape:

```json
{
  "schema": "setfarm.implement-context.v1",
  "runId": "",
  "storyId": "US-001",
  "setupCertificatePath": ".setfarm/setup/SETUP_CERTIFICATE.json",
  "fileTreeManifestPath": ".setfarm/setup/FILE_TREE_MANIFEST.json",
  "resolvedScopeFiles": [],
  "readOnlyFiles": [],
  "sharedEditableFiles": [
    {
      "path": "src/App.tsx",
      "allowedForThisStory": true,
      "editScope": "route_registration_only",
      "grantedBy": "US-003.shared_edit_requests"
    }
  ],
  "forbiddenFiles": [],
  "dependencyContext": {
    "availableDependencies": [],
    "forbiddenDependencyChanges": true
  },
  "ownedActions": [],
  "ownedSurfaces": [],
  "mockDataContract": {},
  "routeGuardPolicy": {},
  "assemblyRules": {
    "scopeResolution": "apply FILE_TREE_MANIFEST resolvedTargets for this story only",
    "sharedEditConflict": "forbiddenDuringImplement beats story.shared_edit_requests",
    "dependencyCheck": "all depends_on story IDs must be completed in the story ledger and must not have open blocking review/verify findings before this story starts",
    "mockDataSource": "PLAN.mock_data_contract merged with story.mock_data_contract and stack mockInjectionPolicy"
  },
  "verificationCommands": {}
}
```

Rules:

- IMPLEMENT receives one story context at a time.
- IMPLEMENT may edit only `resolvedScopeFiles` plus allowed `sharedEditableFiles`.
- `sharedEditableFiles` are not globally writable.
- If MC cannot resolve a `scope_target`, implement must not start.
- `SETUP_CERTIFICATE.json` stores shared file candidates, not per-story write permission.
- Dependency installation is locked before implement. IMPLEMENT cannot add packages unless a retry returns to setup-build with a new approved dependency plan.

## Failure Contract

All setup/build/design/story handoff failures use structured failure files.

Path pattern:

```text
.setfarm/failures/<step>/<failure-code>.json
```

Shape:

```json
{
  "schema": "setfarm.failure.v1",
  "runId": "",
  "step": "",
  "code": "",
  "message": "",
  "recoverable": true,
  "attemptCount": 1,
  "maxAttempts": 3,
  "retryFingerprint": "",
  "escalationPolicy": "supervisor_agent | human_review | halt",
  "stdoutPath": "",
  "stderrPath": "",
  "affectedFiles": [],
  "driftFiles": [],
  "diffs": [],
  "diffByteLimit": 32000,
  "missingRole": "",
  "suggestedRuleAddition": "",
  "requiredAction": "",
  "recoveryHint": ""
}
```

Required failure codes:

- `SETUP_CONTRACT_UNRESOLVED`
- `UNSUPPORTED_STACK`
- `STACK_POLICY_MISMATCH`
- `SCAFFOLD_REQUIRED_FILE_MISSING`
- `BUILD_COMMAND_MISSING`
- `BUILD_FAILED`
- `SMOKE_FAILED`
- `DESIGN_HANDOFF_MISSING`
- `GENERATED_SCREEN_MISMATCH`
- `SETUP_CERTIFICATE_MISSING`
- `IMPLEMENT_CONTEXT_UNRESOLVED`
- `SETUP_OWNED_FILE_DIRTY`
- `STORIES_WROTE_REPO_FILES`
- `SCOPE_TARGET_UNRESOLVED`
- `DEPENDENCY_NOT_ALLOWED`
- `DEPENDENCY_INSTALL_FAILED`
- `UNSUPPORTED_HOST_OS`
- `UNSUPPORTED_NATIVE_BUILD_ENVIRONMENT`

Rules:

- Same `retryFingerprint` at `maxAttempts` escalates immediately.
- `retryFingerprint` must include step, code, command, normalized stderr, and affected files. It must not include timestamp.
- `SETUP_OWNED_FILE_DIRTY` must include file list and diff paths.
- Diff content passed to agents must be byte-capped. Full diffs live on disk and are referenced by path.
- `STORIES_WROTE_REPO_FILES` is distinct from setup-owned drift because STORIES should never write repo files.
- External design failure does not trigger local fallback design. It triggers structured retry or escalation.
- `SCOPE_TARGET_UNRESOLVED` is non-recoverable inside a run. It requires adding or fixing a stack pack `targetResolutionRule`.

## Setup And Build Gates

Setup/build pass only when every applicable gate passes:

- resolved setup contract
- supported stack pack
- exact scaffold detection or explicit scaffold creation
- required scaffold files present
- setup-owned files recorded
- install/build/smoke commands captured or explicitly not required by stack pack
- story `requested_dependencies` aggregated, allowlisted, installed, and recorded
- artifact checks pass
- Stitch handoff exists for UI stacks with `stitch-required`
- conversion policy is valid for stack
- target resolution rules are non-empty and can resolve all story `scope_targets`
- `FILE_TREE_MANIFEST.json` written and internally consistent
- mock data injection points resolved by stack pack
- `SETUP_CERTIFICATE.json` written
- no repo files written by STORIES
- no setup-owned drift before implement starts

## Implementation Order For This Refactor

1. Update final spec documents and mark conflicting old terms as superseded.
2. Update PLAN schema and rules with `UI_VISION_SUMMARY`, `PRD_CONTEXT_SLICE`, `mock_data_contract`, `data_access_contract`, `route_guard_policy`, `representation`, `host_surface_id`, and `control_hint: none`.
3. Update DESIGN payload construction and verify gates. Remove old `FULL_PRD_APPENDIX` references from active prompts and step docs.
4. Update STORIES schema from physical `scope_files` to logical `scope_targets`, `requested_dependencies`, and actionable `shared_edit_requests`.
5. Add stack pack types, required `targetResolutionRules`, dependency policies, mock injection policies, and exact/ambiguous scaffold detection.
6. Add unit tests proving every stack pack resolves every supported `scope_target.role`.
7. Add setup contract, scaffold, process, and evidence modules.
8. Add setup-build dependency aggregation, deterministic target resolver, and `FILE_TREE_MANIFEST.json` writer.
9. Write immutable `SETUP_CERTIFICATE.json`.
10. Add MC per-story `IMPLEMENT_CONTEXT.json` assembler with explicit assembly rules.
11. Update implement context injection and guards to consume resolved context instead of raw story path guesses.
12. Add contract ledger tests for every handoff and failure code.
13. Run build, step tests, and a fresh pipeline run through IMPLEMENT start.

## Non-Negotiable Decisions

- Pipeline order stays `PLAN -> DESIGN -> STORIES -> SETUP-REPO -> SETUP-BUILD -> IMPLEMENT`.
- STORIES does not write physical ownership paths.
- SETUP-BUILD resolves physical paths through stack packs.
- SETUP-BUILD writes deterministic `FILE_TREE_MANIFEST.json`; MC never invents fallback paths.
- `targetResolutionRules` cannot be empty.
- `SETUP_CERTIFICATE.json` and `IMPLEMENT_CONTEXT.json` are separate files with separate mutability rules.
- `FULL_PRD_APPENDIX` is removed.
- Stitch is batch-first and same-project staged when needed.
- Local fallback design is not allowed when Stitch is required.
- Browser-game uses Stitch for visual UI/reference and separate runtime verification for playability.
- React Native/Expo does not auto-convert raw Stitch HTML into native UI.
- Dependencies are approved and installed before implement starts; implement does not add packages ad hoc.
- Unsupported stacks fail explicitly.
