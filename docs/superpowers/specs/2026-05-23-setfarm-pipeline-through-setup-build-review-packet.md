# Setfarm Pipeline Review Packet Through SETUP-BUILD

Date: 2026-05-23

Status: consolidated architecture review packet.

Scope: `PLAN -> DESIGN -> STORIES -> SETUP-REPO -> SETUP-BUILD`.

IMPLEMENT is intentionally excluded from this packet and should be reviewed with
the separate `2026-05-23-implement-full-gate-repair-contract.md` document.

## Reviewer Prompt

You are reviewing Setfarm, a contract-led autonomous software generation
pipeline. Treat this as a production platform architecture for running many
autonomous coding sessions with minimal human intervention.

Please critique only the pre-IMPLEMENT architecture:

```text
PLAN -> DESIGN -> STORIES -> SETUP-REPO -> SETUP-BUILD
```

Do not give generic praise. Focus on contradictions, missing contracts, brittle
handoffs, weak gates, places where agents can still hallucinate, places where
stack/platform behavior is underdefined, and places where the design is too
strict or too loose.

Context:

- IMPLEMENT is handled in a separate review packet.
- STORIES is a pure logical planning artifact. It must never emit physical file
  paths.
- SETUP-BUILD resolves logical story targets into physical paths using stack
  pack `targetResolutionRules`.
- MC owns run identity, repo paths, branch names, env values, Stitch project
  identity, and downstream per-story context assembly.

Questions to answer:

1. Is the pipeline order correct, assuming STORIES never emits physical file
   paths?
2. Is PLAN strong enough across web, mobile, desktop, API, CLI, browser-game,
   backend, and local-only apps without becoming project-specific?
3. Is the DESIGN/Stitch strategy strong enough to produce relevant UI while
   avoiding full-PRD attention dilution and unrelated screens?
4. Is the STORIES contract strong enough to avoid physical path hallucination,
   missing action coverage, and broken handoff into setup/build?
5. Is SETUP-REPO deterministic enough and clearly separated from PLAN/STORIES?
6. Is SETUP-BUILD deterministic enough with stack packs, target-resolution
   rules, dependency aggregation, setup certificates, and file-tree manifests?
7. Which schema fields or gates are still missing before coding starts?
8. Which parts are likely to produce false positives or false negatives during
   real runs?
9. What exact changes should be made before implementation begins?

Return the answer in this structure:

- Critical Issues
- Missing Contracts
- Risky Assumptions
- Recommended Schema/Rule Changes
- Gate Adjustments
- Setup/Build Adjustments
- Implementation Order
- Final Verdict

## Core Architecture

Setfarm must behave as a deterministic software factory, not a loose code
generator.

Every step emits a contract consumed by the next step. Agents may fill in
product-specific content, but they must not invent runtime paths, framework
behavior, unrelated screens, dependencies, ownership boundaries, or secret
values.

The pipeline order remains:

```text
PLAN -> DESIGN -> STORIES -> SETUP-REPO -> SETUP-BUILD -> IMPLEMENT -> VERIFY -> SECURITY -> QA -> FINAL
```

This packet covers only through SETUP-BUILD.

The order is intentionally not changed. STORIES runs before setup/build because
STORIES is a planning artifact. The fix is that STORIES emits logical ownership
only, never physical file paths.

Responsibilities:

- PLAN owns product behavior and platform-level contracts.
- DESIGN/Stitch owns UI design for UI-bound stacks.
- STORIES owns logical implementation slices, actions, dependency requests, and
  shared edit requests.
- SETUP-REPO owns repo/runtime creation and branch/worktree reality.
- SETUP-BUILD owns stack packs, scaffolding, build commands, dependency
  installation, physical target resolution, setup certificates, and file-tree
  manifests.
- MC owns run identity, repo paths, branch names, env values, Stitch project
  identity, and downstream context assembly.

Unsupported or ambiguous stacks fail explicitly. There is no silent fallback to
Vite, React, local fallback design, or project-specific defaults.

## PLAN Contract

PLAN emits a portable product contract. It must not include repo paths, branch
names, package names, run slugs, local directories, server directories, GitHub
URLs, concrete implementation files, or secret values.

Top-level fields:

```yaml
CONTRACT_SCHEMA_VERSION: "setfarm.plan.v2.2"
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

Additional required contracts:

```yaml
mock_data_contract:
  strategy: "fixture_files | seed_function | inline_constants"
  required_entities: []
  required_states: [] # product-specific: ready, empty, error, loading, offline, locked, partial, etc.
  persistence_seed_policy: "localStorage | sqlite_seed | server_seed | none"
  injection_boundary: "resolved by stack pack"

data_access_contract:
  client_state: "local_state | zustand | redux | none"
  server_state: "none | raw_fetch | react_query | swr | server_actions"
  persistence_adapter: "localStorage | sqlite | postgres | external_api | none"

environment_contract:
  required_keys: [] # key names only, never values
  optional_keys: []
  secret_handling: "mc_runtime_values_only"
  client_exposed_keys: [] # explicit public keys only

route_guard_policy:
  public_surfaces: []
  protected_surfaces: []
  redirect_on_unauthorized: null
  guard_implementation_owner: "STORIES_ASSIGNED"
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

PLAN rules:

- `host_surface_id` is required when `representation=inline`.
- `standalone` surfaces require standalone DESIGN coverage.
- `inline` surfaces pass DESIGN coverage only when represented inside their
  declared host surface.
- `control_hint: none` is valid only for system-triggered or non-visual actions.
- `mock_data_contract.required_states` is product-specific, not globally fixed.
- `environment_contract` may request key names only. MC supplies values.
- PLAN does not hardcode the route guard story id. STORIES assigns the guard
  implementation owner.
- The route guard owner implements guard plumbing only. It must not import or
  reference feature route components that do not exist yet.
- Out Of Scope must include product-specific anti-goals and universal runtime
  boundary bans.

PLAN gates:

```text
PLAN_SCHEMA_INVALID
PLAN_RUNTIME_FIELD_FORBIDDEN
PLAN_PRODUCT_SURFACE_INVALID
PLAN_ACTION_CONTRACT_INVALID
PLAN_MOCK_DATA_CONTRACT_MISSING
PLAN_DATA_ACCESS_CONTRACT_MISSING
PLAN_ENVIRONMENT_CONTRACT_INVALID
PLAN_ROUTE_GUARD_POLICY_INVALID
PLAN_OUT_OF_SCOPE_MISSING
```

## DESIGN And Stitch Contract

DESIGN consumes PLAN and produces Stitch artifacts. It does not send the full PRD
to Stitch.

The term `FULL_PRD_APPENDIX` is removed and must not appear in prompts or design
briefs.

DESIGN builds `PRD_CONTEXT_SLICE`, containing only UI-relevant content:

- product name, platform, stack, UI language
- `UI_VISION_SUMMARY`
- Product Surfaces
- action control hints
- visible data fields and visible relationships referenced by Product Surfaces
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

Stitch must not receive:

- backend schemas
- test contracts
- CLI contracts
- API endpoint internals
- setup/build commands
- repo paths
- env values
- failure ledgers
- raw full PRD text

`PRD_CONTEXT_SLICE` field rule:

- Include only entities referenced by `product_surfaces[].data_entities_bound`.
- Include only fields referenced by `product_surfaces[].core_content`,
  `display_fields`, visible validation, or permitted action feedback.
- A field is UI-visible only when it is explicitly listed in `display_fields`,
  referenced by an input/control hint, referenced by a validation error message,
  or named in a permitted action feedback string. There is no implicit inclusion.
- Exclude DB constraints, seed internals, endpoint status codes, test handles,
  and stack setup instructions.
- Validate `PRD_CONTEXT_SLICE` against schema before any Stitch call. Backend
  internals, password hashes, secret keys, endpoint contracts, test contracts,
  build commands, or failure ledger fields fail with `DESIGN_PRD_SLICE_INVALID`.

### Stitch Batch Strategy

Stitch generation is batch-first.

- Preferred path: generate all required standalone screens in one Stitch project
  using one batch prompt when Stitch accepts it.
- If product size requires staging, use staged batch in the same Stitch project.
- Default staged batch size is up to 5 standalone screens per batch.
- For example, 7 screens should be generated as batch 1 with 5 screens, then
  batch 2 with 2 screens in the same Stitch project.
- Batch 2+ must include `design_system_lock` derived from first batch tokens,
  navigation structure, density, typography, and shared component rules.
- `DESIGN_TOKEN_LOCK_MISSING` triggers before batch 2+ starts if tokens do not
  exist or are empty.
- If the Stitch project id becomes invalid, unavailable, or points to a project
  without this run's batch-1 token artifacts, MC may create a replacement Stitch
  project only by resetting DESIGN batch state and regenerating batch 1. Tokens
  from one Stitch project cannot be carried into another project as a valid lock.
- Per-screen generation is not normal behavior. It is recovery-only for missing
  standalone surfaces after batch verification fails.
- Recovery must use the same Stitch project for the run.

Stitch project identity:

- MC creates or resolves one Stitch project per Setfarm run.
- Retries within the same run reuse the same Stitch project.
- A new Setfarm run gets a distinct Stitch project unless the operator
  explicitly attaches an existing Stitch project.
- Stitch project id is runtime state and never appears in PLAN.

Required DESIGN outputs for UI-bound stacks:

```text
stitch/DESIGN_BRIEF.md
stitch/DESIGN.md
stitch/DESIGN_MANIFEST.json
stitch/DESIGN_DOM.json
stitch/UI_CONTRACT.json
stitch/SCREEN_MAP.json
stitch/design-tokens.css
stitch/design-tokens.json
stitch/*.html
stitch/*.png
```

Output ownership:

- `DESIGN_BRIEF.md` is the scoped, machine-oriented handoff derived from PLAN
  and used by DESIGN/STORIES/IMPLEMENT.
- `DESIGN.md` is human-readable design documentation downloaded from Stitch.
- `DESIGN_MANIFEST.json`, `DESIGN_DOM.json`, `UI_CONTRACT.json`, and
  `SCREEN_MAP.json` are gate authority. Markdown prose is never enough to pass
  contract gates.

Minimum `DESIGN_DOM.json` shape:

```json
{
  "schema": "setfarm.design-dom.v1",
  "screens": [
    {
      "screenId": "SCR-001",
      "surfaceId": "SURF_PRIMARY",
      "elements": [
        {
          "selector": "[data-action-id='ACT_PRIMARY']",
          "label": "Primary action",
          "role": "button",
          "actionId": "ACT_PRIMARY",
          "surfaceId": "SURF_PRIMARY"
        }
      ]
    }
  ]
}
```

Minimum `UI_CONTRACT.json` shape:

```json
{
  "schema": "setfarm.ui-contract.v1",
  "surfaces": [],
  "actions": [],
  "navigation": [],
  "states": ["ready", "empty", "loading", "error"],
  "testSelectors": [],
  "accessibilityNotes": []
}
```

DESIGN gates:

```text
DESIGN_STITCH_PROJECT_UNAVAILABLE
DESIGN_PROVIDER_UNREACHABLE
DESIGN_BATCH_PARTIAL
DESIGN_ARTIFACT_ASSEMBLY_FAILED
DESIGN_STITCH_HTML_UNAVAILABLE
DESIGN_PRD_SLICE_INVALID
DESIGN_TOKEN_LOCK_MISSING
DESIGN_TOKEN_DRIFT
DESIGN_SURFACE_MISMATCH
DESIGN_INLINE_SURFACE_UNREPRESENTED
DESIGN_SCREEN_MAP_MISSING
DESIGN_DOM_MISSING
DESIGN_DOM_ACTION_MISSING
DESIGN_UI_CONTRACT_MISSING
DESIGN_MARKDOWN_MISSING
DESIGN_ASSET_MISSING
```

Legacy aliases such as `DESIGN_STITCH_PROVIDER_UNAVAILABLE` must be normalized to
the canonical provider gate `DESIGN_PROVIDER_UNREACHABLE`. `DESIGN_ASSET_MISSING`
is not a catch-all. It is used only when a required artifact path is absent after
provider success and artifact assembly success.

DESIGN failures must report:

- provider/API/service error vs prompt/output mismatch
- Stitch project id
- Stitch project status: created, reused, invalidated, replacement-created
- batch index
- attempt count
- expected screens
- generated screens
- missing surfaces
- artifact paths
- first failing stage and raw provider/status excerpt when available

Design token rules:

- Batch 1 establishes the locked token baseline.
- Batch 2+ must not introduce contradictory color, typography, spacing, radius,
  elevation, or navigation primitives unless the operator explicitly requests a
  design-system revision.
- `DESIGN_TOKEN_DRIFT` compares parsed token artifacts, not only prompt text.
- Prompt-level `design_system_lock` is guidance. Parsed artifact validation is
  the gate.

`DESIGN_TOKEN_DRIFT` normalization algorithm:

- Parse `design-tokens.css` and `design-tokens.json` into a canonical token map.
- Normalize colors to lowercase hex with alpha when possible; `#0055ff` and
  `rgb(0, 85, 255)` are equivalent.
- Normalize absolute lengths to numeric px when conversion is deterministic.
- Do not require headless computed-style evaluation for variables, `rem`, `vh`,
  `vw`, percentages, or inherited/scoped values. These values are compared by
  declaration text plus selector/token key because DOM cascade assumptions create
  false drift failures.
- Optional visual QA may compute styles in a real browser, but computed-style
  output is not the authority for `DESIGN_TOKEN_DRIFT`.
- Normalize font family lists by trimming quotes and whitespace while preserving
  order.
- Normalize token names to exact semantic keys. A later batch may reuse a locked
  token, omit an unused token, or add a namespaced local token. It may not change
  the value of a locked semantic token.
- Compare color, typography, spacing, radius, elevation, layout density, and
  navigation primitives. Conflicts fail `DESIGN_TOKEN_DRIFT`; equivalent
  formatting does not.

Inline surface verification:

- `DESIGN_MANIFEST.json` must include `representedSurfaces`.
- Each `standalone` PLAN surface must map to a screen in `SCREEN_MAP.json`.
- Each `inline` PLAN surface must map to its declared `host_surface_id` and
  include DOM evidence such as selectors, action ids, labels, or state text.
- An inline surface cannot be claimed by prose alone.
- Missing inline evidence fails `DESIGN_INLINE_SURFACE_UNREPRESENTED`.
- `UI_CONTRACT.json` is the logical UI contract authority.
- `DESIGN_DOM.json` is the physical DOM/native semantic evidence authority.
- Tier 2 design compliance requires both: the logical action/state must exist in
  `UI_CONTRACT.json`, and the corresponding element/state evidence must exist in
  `DESIGN_DOM.json`.
- If `UI_CONTRACT.json` declares an action or state but `DESIGN_DOM.json` lacks
  matching evidence for the owning screen/surface, fail
  `DESIGN_DOM_ACTION_MISSING`.

Required manifest evidence shape:

```json
{
  "representedSurfaces": [
    {
      "surfaceId": "SURF_EMPTY_AND_ERROR_RECOVERY",
      "representation": "inline",
      "hostSurfaceId": "SURF_TICKET_OPERATIONS",
      "screenIds": ["SCR-001"],
      "domEvidence": {
        "selectors": ["[data-surface-id='SURF_EMPTY_AND_ERROR_RECOVERY']"],
        "actionIds": ["ACT_RETRY_LOAD"],
        "labels": ["Retry", "Clear filters"]
      }
    }
  ]
}
```

`DESIGN_BATCH_PARTIAL` recovery ladder:

```text
partial batch
-> if batch 1 is partial, discard partial batch-1 output and retry full batch 1
   in the same Stitch project; use a reset replacement project only when MC has
   invalidated the original project under the Stitch project identity rules
-> do not create or use design_system_lock until batch 1 is fully downloaded and
   verified
-> if batch 2+ is partial, retry missing standalone surfaces in the same Stitch
   project
-> verify design token lock still resolves
-> run token drift and surface coverage gates
-> if token drift appears, fail DESIGN_TOKEN_DRIFT
-> if still partial after max attempts, route to human review with provider and
   batch evidence
```

Per-screen recovery is allowed only inside this ladder and only for missing
standalone surfaces. It does not become the default DESIGN strategy.

## STORIES Contract

STORIES consumes PLAN, DESIGN outputs, `SCREEN_MAP`, `DESIGN_MANIFEST`,
`DESIGN_DOM`, and `UI_CONTRACT`.

STORIES is a pure planning step. It must not write repo files and must not emit
physical file paths.

STORIES emits logical story contracts.

Story shape:

```json
{
  "id": "US-001",
  "title": "",
  "type": "app_shell | feature_surface | shared_state | integration | api | cli | game_runtime | nonvisual",
  "depends_on": [],
  "acceptanceCriteria": [],
  "scope_targets": [
    {
      "role": "app_shell | route_registration | surface_component | state_store | fixture_data | persistence_adapter | test_bridge | style_integration | game_runtime | api_route | cli_command | action_handler",
      "surface_id": "SURF_*",
      "screen_id": null,
      "action_id": null,
      "entity": null,
      "resolved_path": null
    }
  ],
  "shared_edit_requests": [
    {
      "target": "app_shell | route_registry | global_store | style_entrypoint | test_bridge",
      "reason": "",
      "editScope": "route_registration_only | navigation_item_only | provider_registration_only | style_import_only | test_bridge_only",
      "allowedOperations": [],
      "forbiddenOperations": []
    }
  ],
  "requested_dependencies": [
    {
      "name": "",
      "ecosystem": "npm | pip | maven | gradle | cocoapods | spm",
      "reason": "",
      "usedBy": ["US-001"],
      "required": false
    }
  ],
  "implementation_contract": {
    "owned_screen_ids": [],
    "owned_surface_ids": [],
    "owned_actions": [],
    "state_contract": [],
    "persistence_contract": [],
    "navigation_contract": [],
    "test_contract": []
  }
}
```

STORIES rules:

- `resolved_path` must be `null` in STORIES output.
- `scope_targets` are logical targets only.
- `requested_dependencies` are requests only. SETUP-BUILD decides installability.
- `shared_edit_requests` are requests only. MC grants or denies per-story
  permissions later.
- App shell/nonvisual/shared stories may own zero screens when their contract is
  explicitly nonvisual.
- Feature surface stories must cover surfaces/actions from PLAN and DESIGN.
- Every action must be owned by at least one story or explicitly declared
  nonvisual/system-owned.
- Repeated action IDs across surfaces must preserve surface/action pairs, not
  collapse into one ambiguous action.
- `story.type` drives downstream gate applicability. For example,
  `feature_surface` requires owned surface/screen/action coverage, while
  `nonvisual`, `api`, and `cli` stories do not require UI screen ownership.

STORIES gates:

```text
STORIES_JSON_MISSING
STORY_CONTRACT_MISSING
STORY_SCOPE_TARGET_INVALID
STORY_PHYSICAL_PATH_FORBIDDEN
STORIES_DEPENDENCY_CYCLE
STORY_ACTION_UNOWNED
STORY_SURFACE_UNOWNED
STORY_DEPENDENCY_REQUEST_INVALID
STORY_SHARED_EDIT_REQUEST_INVALID
STORIES_WROTE_REPO_FILES
```

STORIES dependency graph rules:

- `depends_on` must form an acyclic directed graph.
- MC/STORIES validation runs DFS cycle detection before SETUP-BUILD.
- Cycles fail `STORIES_DEPENDENCY_CYCLE`.
- Parallel execution is disabled unless the runtime explicitly sets
  `parallelPolicy=parallel_independent_only` and MC proves stories have no file,
  dependency, shared edit, or route-registration overlap.

## SETUP-REPO Contract

SETUP-REPO owns repository reality.

It resolves runtime locations from MC, not PLAN.

Responsibilities:

- create or verify project repo/worktree
- create feature branch/run branch
- write runtime metadata
- preserve user/unrelated dirty worktree changes
- initialize setup directories
- prepare `.setfarm/setup/`
- fail on ambiguous or unsupported runtime state

SETUP-REPO must not choose product behavior, screens, stories, dependencies, or
design.

Required setup repo outputs:

```text
.setfarm/setup/REPO_EVIDENCE.json
.setfarm/setup/RUNTIME_IDENTITY.json
```

SETUP-REPO gates:

```text
REPOSITORY_PATH_UNRESOLVED
REPOSITORY_INIT_FAILED
FEATURE_BRANCH_UNRESOLVED
RUNTIME_IDENTITY_MISSING
WORKTREE_UNSAFE
```

`WORKTREE_UNSAFE` triggers when:

- the target path is not controlled by the current run and contains unrelated
  uncommitted changes that setup would overwrite
- another Setfarm run lock is active for the same repo/worktree
- the active branch does not match the runtime branch and cannot be safely
  created or switched
- required setup directories cannot be created without deleting existing user
  files
- runtime identity files disagree with MC run identity

## SETUP-BUILD Contract

SETUP-BUILD owns stack reality.

It resolves stack packs, scaffolds or verifies required files, installs approved
dependencies, runs baseline build/test/smoke commands, converts or references
design assets according to stack policy, resolves logical story targets into
physical paths, and writes immutable setup evidence.

### Stack Pack Contract

Each stack pack must define:

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
  verificationPolicy,
  dependencyPolicy,
  dependencyResolutionPolicy,
  targetResolutionRules,
  slugRules,
  slugRuleTests,
  routerParadigm,
  mockInjectionContract,
  utilityFilePolicy,
  sharedEditValidationPolicy,
  patchWindowMarkers,
  buildStrippingPolicy,
  sandboxPrewarm,
  conversionPolicy
}
```

Supported stack packs:

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

`targetResolutionRules` are mandatory. Empty maps are invalid.

`targetResolutionRules` are not limited to flat string templates. A stack pack
may define single-file, file-set, route-tree, endpoint-tree, command-tree, or
game-runtime resolution rules. This is still deterministic stack-pack logic, not
an open-ended LLM resolver.

Required resolver fields:

```ts
{
  routerParadigm: "file_system_nested | declarative_flat | endpoint_tree | command_tree | canvas_runtime | none",
  slugRules: {
    surface_slug: "strip SURF_ prefix, lowercase, replace underscores with hyphens",
    screen_file: "PascalCase from screen id/title, strip SCR prefix when present",
    action_file: "camelCase from ACT_ id",
    entity_file: "PascalCase from entity name",
    route_segment: "lowercase kebab-case, framework-safe"
  },
  slugRuleTests: [
    { ruleKey: "surface_slug", input: "SURF_PRIMARY_EDITOR", expected: "primary-editor" },
    { ruleKey: "screen_file", input: "SCR-002 Primary Editor", expected: "PrimaryEditor" }
  ],
  targetResolutionRules: {
    surface_component: { kind: "single_file", template: "src/features/{surface_slug}/{screen_file}.tsx" },
    route_registration: { kind: "shared_file", path: "src/App.tsx", editScope: "route_registration_only" }
  }
}
```

Example expanded rule shape:

```ts
targetResolutionRules: {
  surface_component: {
    kind: "single_file",
    template: "src/features/{surface_slug}/{screen_file}.tsx"
  },
  next_app_route: {
    kind: "file_set",
    files: [
      "src/app/{route_segment}/page.tsx",
      "src/app/{route_segment}/loading.tsx",
      "src/app/{route_segment}/error.tsx"
    ]
  },
  state_store: {
    kind: "single_file",
    template: "src/store/{entity_file}.store.ts"
  },
  action_handler: {
    kind: "single_file",
    template: "src/features/{surface_slug}/actions/{action_file}.ts"
  },
  api_route: {
    kind: "single_file",
    template: "src/routes/{action_file}.ts"
  },
  cli_command: {
    kind: "single_file",
    template: "src/commands/{action_file}.ts"
  },
  fixture_data: {
    kind: "single_file",
    template: "src/__fixtures__/{entity_file}.fixture.ts"
  },
  persistence_adapter: {
    kind: "single_file",
    template: "src/lib/data/{entity_file}.repo.ts"
  },
  game_runtime: {
    kind: "submodule_set",
    filesByEntity: {
      engine: "src/game/engine.ts",
      loop: "src/game/loop.ts",
      state: "src/game/state.ts",
      input: "src/game/input.ts",
      hud: "src/game/hud.ts"
    }
  }
}
```

Rules:

- Target resolution is deterministic and stack-pack-owned.
- Implement agents never resolve paths.
- MC must fail with `SCOPE_TARGET_UNRESOLVED` if a logical target has no rule.
- Static stack pack rules must be explicit. No open-ended model/agent path
  resolver is allowed.
- File naming may use deterministic slugging from surface/action/entity ids.
- If a domain-specific path cannot be resolved safely, fail and update the stack
  pack contract instead of hallucinating.
- `slugRules` are mandatory and tested per stack pack.
- `slugRuleTests` are mandatory per stack pack and fail
  `TARGET_SLUG_RULE_TEST_FAILED` when any deterministic example does not match.
- File-system routers such as Next.js App Router must use file-set or route-tree
  rules when a logical surface needs multiple files such as `page.tsx`,
  `layout.tsx`, loading/error files, or route groups.
- Browser-game runtime targets must resolve through explicit submodules, such as
  `engine`, `loop`, `state`, `input`, and `hud`; recursive placeholders such as
  `{role}` are invalid.

Utility file policy:

```json
{
  "utilityFilePolicy": {
    "allowedRoles": ["utility_module", "shared_library", "test_helper"],
    "defaultOwner": "story",
    "sharedUtilityRequires": "shared_edit_request",
    "forbiddenPatterns": ["src/lib/global/*"],
    "maxFanoutWithoutSharedContract": 1,
    "orphanHandling": "remove_if_unreferenced_and_story_owned | report_only | human_review"
  }
}
```

Rules:

- Utility files are not ownerless escape hatches.
- A story may create a utility file only when a logical `scope_target` resolves
  to that utility role.
- A utility file imported by multiple stories must become a shared target with
  explicit MC-granted edit permissions.
- Stack packs define allowed utility roots. Agents do not invent global helper
  locations.
- After rollback or story rewrite, MC/SETUP-BUILD checks generated utility files
  against ownership and import references. A story-owned utility that is no
  longer referenced is removed only when `orphanHandling` allows safe removal;
  otherwise it is reported as `ORPHANED_UTILITY_FILE`.

### Shared Edit Validation And Patch Windows

Stack packs must declare how shared files are validated:

```json
{
  "sharedEditValidationPolicy": "ast_required | patch_window | human_review_required",
  "patchWindowMarkers": [
    {
      "target": "route_registry",
      "path": "src/App.tsx",
      "start": "// SETFARM_ROUTE_INJECT_START",
      "end": "// SETFARM_ROUTE_INJECT_END",
      "allowedOperations": ["append_route", "append_nav_item"]
    }
  ]
}
```

Rules:

- `patch_window` is valid only when SETUP-BUILD scaffolds the declared marker
  pairs into the shared files before IMPLEMENT starts.
- Markers are part of the setup scaffold baseline. IMPLEMENT agents may edit
  inside a granted marker window only; they may not create, move, rename, delete,
  or widen marker windows.
- Deleted, duplicated, reordered, or corrupted markers fail
  `PATCH_WINDOW_MARKER_MISSING`.
- MC may restore exact marker text from the setup snapshot only when the
  surrounding file has not been otherwise corrupted. Otherwise the story goes to
  human review or rollback to SETUP-BUILD.
- Regex-only shared code validation is not accepted. Patch windows are a
  deterministic scaffold mechanism, not a loose regex parser.

### Dependency Aggregation

STORIES may request dependencies. SETUP-BUILD aggregates and validates them.

Rules:

- Dependencies are installed only during SETUP-BUILD.
- IMPLEMENT cannot install dependencies ad hoc.
- Stack pack owns allowed ecosystems and install commands.
- Dependency evidence is written before `SETUP_CERTIFICATE.json`.
- Unapproved dependency requests fail explicitly.
- Conflicting dependency requests are resolved by stack-pack
  `dependencyResolutionPolicy`, not by the agent.
- If two stories request incompatible versions, SETUP-BUILD fails with
  `DEPENDENCY_CONFLICT` unless the stack pack has an explicit resolution rule.
- Optional dependency requests may be rejected without failing the run when the
  story has a no-dependency implementation path.

Required dependency evidence:

```json
{
  "schema": "setfarm.dependency-evidence.v1",
  "requested": [],
  "approved": [],
  "installed": [],
  "rejected": [],
  "commands": [],
  "importNamespaces": [
    {
      "package": "zod",
      "imports": ["zod"]
    }
  ]
}
```

Dependency resolution policy shape:

```json
{
  "allowedEcosystems": ["npm"],
  "versionPolicy": "latest_compatible | exact_requested | stack_locked",
  "conflictPolicy": "fail | choose_highest_compatible | stack_locked_wins",
  "optionalDependencyPolicy": "reject | approve_if_allowed | require_story_fallback",
  "outOfEcosystemPolicy": "fail"
}
```

### Mock Injection Boundary

`mock_data_contract` from PLAN is logical. SETUP-BUILD resolves the physical
mock injection boundary through the stack pack.

Required stack-pack fields:

```json
{
  "mockInjectionContract": {
    "fixtureRoot": "src/__fixtures__",
    "injectionEntrypoint": "src/mocks/bootstrap.ts",
    "enablementMode": "dev_only | test_only | explicit_import",
    "productionLeakCheck": true
  },
  "buildStrippingPolicy": {
    "testBridgeStripping": {
      "required": true,
      "method": "bundler_define_replacement | file_exclusion | env_guarded_dead_code",
      "productionFlag": "import.meta.env.PROD | process.env.NODE_ENV=production",
      "forbiddenProductionSymbols": ["window.app", "__fixtures__", "mockBootstrap"],
      "validation": "bundler_config_ast | source_map_trace | define_replacement_assertion"
    },
    "devToolStripping": {
      "required": false,
      "forbiddenProductionSymbols": [],
      "validation": "bundler_config_ast | source_map_trace | define_replacement_assertion"
    }
  }
}
```

Rules:

- Fixture location and injection entrypoint are stack-pack-owned.
- IMPLEMENT agents must not invent mock bootstrapping patterns.
- SETUP-BUILD fails with `MOCK_INJECTION_BOUNDARY_MISSING` when PLAN requires
  mock data but the stack pack has no injection boundary.
- Production builds must not silently include dev/test mock services unless the
  stack pack explicitly allows it.
- When `productionLeakCheck=true`, SETUP-BUILD must validate stripping through
  stack-pack-declared bundler config analysis, source-map-aware tracing, or
  define-replacement assertions. Grep-only production scans are insufficient as
  the sole proof because minification and chunking can hide leaked bridges.
- Production artifact scans may be used as extra evidence for fixture filenames,
  fixture entity ids, mock bootstrap imports, and mock-only keys. Any confirmed
  match fails `MOCK_PRODUCTION_LEAK` unless explicitly allowed by stack policy.
- Stack packs must define how test bridges and mock bootstrap code are stripped
  or excluded from production builds. Missing stripping policy fails
  `TEST_BRIDGE_STRIPPING_POLICY_MISSING`.

### Sandbox Prewarm

Network access is allowed during setup/build dependency installation and explicit
tool prewarm, not during normal IMPLEMENT evidence commands.

Required stack-pack field:

```json
{
  "sandboxPrewarm": {
    "enabled": true,
    "commands": ["npm ci", "npx playwright install --with-deps"],
    "successCheck": "exit_code_zero | binary_hash | version_match",
    "expectedVersion": "",
    "timeoutMs": 120000,
    "cacheKeys": ["package-lock.json", "playwright.config.ts"],
    "networkPolicyDuringPrewarm": "allowlist",
    "allowedHosts": ["registry.npmjs.org", "playwright.azureedge.net"],
    "artifactPath": ".setfarm/setup/PREWARM_EVIDENCE.json"
  }
}
```

Rules:

- SETUP-BUILD performs dependency/tool binary downloads in prewarm.
- IMPLEMENT sandbox commands run offline or localhost-only unless stack policy
  explicitly allows an external host.
- Missing prewarm for a stack that needs browser/tool binaries fails
  `SANDBOX_PREWARM_MISSING`.
- A SETUP-BUILD patch mode that changes the package manifest, lockfile,
  dependency evidence, or toolchain binary requirements must rerun
  `sandboxPrewarm` before writing the new setup certificate. A dependency
  amendment cannot advance to IMPLEMENT with stale prewarm evidence.

### Setup Certificate

`SETUP_CERTIFICATE.json` is immutable after setup-build succeeds.

Required shape:

```json
{
  "schema": "setfarm.setup-certificate.v1",
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
  "sharedFiles": [],
  "forbiddenDuringImplement": [],
  "generatedDesignFiles": [],
  "dependencyEvidencePath": ".setfarm/setup/DEPENDENCY_EVIDENCE.json",
  "prewarmEvidencePath": ".setfarm/setup/PREWARM_EVIDENCE.json",
  "fileTreeManifestPath": ".setfarm/setup/FILE_TREE_MANIFEST.json",
  "sharedGrantsPath": ".setfarm/setup/SHARED_GRANTS.json",
  "routerParadigm": "",
  "slugRules": {},
  "dependencyResolutionPolicy": {},
  "mockInjectionContract": {},
  "utilityFilePolicy": {},
  "sharedEditValidationPolicy": "",
  "patchWindowMarkers": [],
  "buildStrippingPolicy": {},
  "sandboxPrewarm": {},
  "targetResolutionRules": {},
  "designAuthority": {
    "required": false,
    "source": "",
    "screenMap": "",
    "rules": [],
    "conversionPolicy": "wrap_jsx | reference_only | native_equivalent | none"
  },
  "verification": {
    "buildArtifact": "",
    "testHandlePolicy": "",
    "runtimeBridge": "",
    "regressionSmokeCommands": []
  }
}
```

Rules:

- Certificate contains setup-owned files and shared file candidates.
- Per-story edit permissions do not live in the certificate.
- Per-story permissions are assembled later by MC.
- Certificate is a setup/build proof, not a mutable implement config.
- `sharedGrantsPath` points to the grant artifact MC will write later. The
  certificate itself does not contain per-story grants.
- A later dependency or setup rollback never mutates this certificate in place.
  It produces a new certificate version and marks downstream runtime state for
  regression checks.

### SETUP-BUILD Patch Mode

Supervisor repair may request a controlled rollback to SETUP-BUILD for approved
dependency or stack-pack gaps. This is not an IMPLEMENT dependency install.

Patch-mode rules:

- Input is a validated `REPAIR_CONTRACT.pipelineEscalation.requiresRollbackTo`
  with a concrete dependency, stack-pack, or setup contract gap.
- SETUP-BUILD re-runs only the affected setup/build operations when the stack
  pack supports partial patching; otherwise it performs a full setup/build
  re-run.
- Patch mode writes a new setup certificate version, dependency evidence version,
  and file tree manifest version.
- If patch mode changes `package.json`, a lockfile, dependency evidence,
  toolchain downloads, or sandbox cache keys, it must rerun `sandboxPrewarm` and
  write a new `PREWARM_EVIDENCE.json` before issuing the certificate.
- MC invalidates affected story validation state before any story resumes.
- If patch mode changes target resolution or shared file policy, MC must
  reassemble all affected `IMPLEMENT_CONTEXT` files.
- If the same setup gap repeats with the same fingerprint, fail with
  `SYSTEMIC_FAILURE_SUSPECTED` instead of looping.

### File Tree Manifest

`FILE_TREE_MANIFEST.json` resolves all story logical targets.

Required shape:

```json
{
  "schema": "setfarm.file-tree-manifest.v1",
  "runId": "",
  "stackPackId": "",
  "resolvedTargets": [
    {
      "storyId": "US-001",
      "role": "surface_component",
      "surfaceId": "SURF_PRIMARY_EDITOR",
      "screenId": "SCR-002",
      "actionId": null,
      "entity": null,
      "resolvedPath": "src/features/primary-editor/PrimaryEditor.tsx",
      "resolutionRule": "surface_component",
      "owner": "US-001",
      "collisionStatus": "unique | invalid_collision | pending_shared_grant",
      "sharedGrantRequestId": null
    }
  ]
}
```

Rules:

- Every logical target must be resolved or fail.
- Resolved paths must stay within allowed project directories.
- SETUP-BUILD detects collisions while writing the manifest, but it does not
  grant per-story edit permission.
- A feature/component collision without matching `shared_edit_requests` fails
  immediately with `FILE_TREE_PATH_COLLISION`.
- A collision that maps only to declared shared targets with matching
  `shared_edit_requests` is written as `collisionStatus=pending_shared_grant`.
- MC context assembly later grants or denies the shared target and writes the
  decision to `SHARED_GRANTS.json`. Denial fails `SHARED_TARGET_GRANT_DENIED`.
- Feature component collisions are invalid by default.

### Shared Grants Artifact

`FILE_TREE_MANIFEST.json` remains immutable setup/build evidence. MC grant or
deny decisions are written to a separate versioned artifact.

Required shape:

```json
{
  "schema": "setfarm.shared-grants.v1",
  "runId": "",
  "fileTreeManifestVersion": 1,
  "grantVersion": 1,
  "grants": [
    {
      "grantId": "GRANT-US001-ROUTE-001",
      "storyId": "US-001",
      "path": "src/App.tsx",
      "target": "route_registry",
      "editScope": "route_registration_only",
      "allowedOperations": ["append_route"],
      "forbiddenOperations": ["rewrite_app_shell"],
      "status": "granted | denied",
      "sourceRequest": "US-001.shared_edit_requests[0]",
      "reason": ""
    }
  ]
}
```

Rules:

- SETUP-BUILD may mark a collision as `pending_shared_grant`; it never mutates
  the file tree manifest to grant permissions.
- MC assembly reads `FILE_TREE_MANIFEST.json` plus `SHARED_GRANTS.json`.
- `IMPLEMENT_CONTEXT.sharedEditableFiles[].grantedBy` must reference a concrete
  `grantId`, not a prose reason.
- Missing required shared grant evidence fails `SHARED_GRANTS_MISSING`.
- A denied grant fails `SHARED_TARGET_GRANT_DENIED` before IMPLEMENT starts.

SETUP-BUILD gates:

```text
SETUP_CONTRACT_UNRESOLVED
UNSUPPORTED_STACK
STACK_POLICY_MISMATCH
SCAFFOLD_REQUIRED_FILE_MISSING
BUILD_COMMAND_MISSING
BUILD_FAILED
DESIGN_HANDOFF_MISSING
GENERATED_SCREEN_MISMATCH
TARGET_RESOLUTION_RULE_MISSING
TARGET_SLUG_RULE_MISSING
TARGET_SLUG_RULE_TEST_FAILED
SCOPE_TARGET_UNRESOLVED
FILE_TREE_PATH_COLLISION
SHARED_GRANTS_MISSING
SHARED_TARGET_GRANT_DENIED
DEPENDENCY_POLICY_VIOLATION
DEPENDENCY_CONFLICT
DEPENDENCY_ECOSYSTEM_UNSUPPORTED
DEPENDENCY_EVIDENCE_MISSING
MOCK_INJECTION_BOUNDARY_MISSING
MOCK_PRODUCTION_LEAK
TEST_BRIDGE_STRIPPING_POLICY_MISSING
SANDBOX_PREWARM_MISSING
PATCH_WINDOW_MARKER_MISSING
ORPHANED_UTILITY_FILE
SETUP_CERTIFICATE_MISSING
FILE_TREE_MANIFEST_MISSING
SETUP_OWNED_FILE_DIRTY
SYSTEMIC_FAILURE_SUSPECTED
```

## Platform Notes Through SETUP-BUILD

### Web / Vite / Next / Static HTML

- DESIGN is required when `DESIGN_REQUIRED=true`.
- Baseline build must pass before IMPLEMENT.
- Runtime bridge/test handle policy is prepared by stack pack.
- Stitch conversion policy must be explicit.

### React Native / Expo

- Stitch is `reference_only` or `native_equivalent`, not raw HTML authority.
- `reference_only` is the default and only generally enabled policy.
- `native_equivalent` is disabled unless the stack pack declares a concrete
  converter/adapter artifact and emits `NATIVE_EQUIVALENT_CONTRACT.json`.
  Without that artifact React Native must use `reference_only`.
- Minimum native equivalent contract:

```json
{
  "schema": "setfarm.native-equivalent-contract.v1",
  "sourceScreenIds": [],
  "targetComponentFamilies": [],
  "mappingPolicy": "manual_adapter | tool_generated",
  "unsupportedHtmlPatterns": [],
  "validationPolicy": "native_semantics | screenshot_compare | manual_review"
}
```

- Expo-compatible build/export/typecheck evidence must be stack-pack-defined.
- Native iOS/Android build evidence must not be falsely claimed by web export.

### Browser Game

- Stitch may guide menus, HUD, overlays, visual shell, and controls.
- Stitch must not be treated as game loop/runtime logic.
- Stack pack must declare whether DOM overlays are allowed.
- Game runtime scope targets must resolve to explicit submodules such as
  `engine`, `loop`, `state`, `input`, and `hud`.

### API / CLI

- DESIGN is skipped unless explicitly applicable.
- `Product Surfaces` are not required.
- Endpoint/command contracts drive stories and setup/build.
- Exit codes, error envelopes, and command surfaces must be stack-pack verified.
- API evidence uses endpoint checks with method, path, request fixture, expected
  status, expected response envelope, and error case.
- CLI evidence uses command checks with args, stdin fixture, expected stdout,
  expected stderr, and expected exit code.

### Python / Android / iOS

- Stack packs must define platform-native `slugRules`; JavaScript casing examples
  are not universal.
- `python-web` and `python-cli` use snake_case file names and explicit virtualenv
  command templates.
- `android-native` uses Android/Kotlin-safe class/file/resource naming rules.
- `ios-native` uses Swift-safe type/file naming and bundle-safe identifiers.
- Each supported non-JS stack pack must include at least three
  `slugRuleTests` covering surface/module names, action/command names, and
  entity/type names. Example expectations:
  - `python-cli`: `SURF_REPORT_EXPORT` -> `report_export.py`;
    `ACT_SEND_EMAIL` -> `send_email`; `InvoiceItem` -> `invoice_item`.
  - `android-native`: `SURF_REPORT_EXPORT` -> `ReportExport.kt`;
    `ACT_SEND_EMAIL` -> `sendEmail`; layout/resource ids use lowercase
    underscore.
  - `ios-native`: `SURF_REPORT_EXPORT` -> `ReportExport.swift`;
    `ACT_SEND_EMAIL` -> `sendEmail`; bundle identifiers use lowercase reverse
    DNS-safe segments.
- Unsupported host OS or missing native toolchain fails explicitly; it does not
  fall back to a web stack.

## End-To-End Gates Summary Through SETUP-BUILD

PLAN pass:

- product contract valid
- product surfaces valid for UI platforms
- no runtime paths or secret values
- platform/stack/language declared
- mock/data/access/env/route contracts present

DESIGN pass:

- Stitch artifacts present
- screen map covers required standalone surfaces
- inline surfaces covered only in declared host surfaces
- design tokens and UI contract present
- `PRD_CONTEXT_SLICE` schema valid and free of backend/test/setup internals
- staged batch token drift check passes against normalized batch-1 tokens
- Stitch project id recorded as runtime state
- provider/API, partial batch, artifact assembly, and prompt-output failures
  classified with specific gate codes

STORIES pass:

- stories decomposed
- logical scope targets only
- no physical paths
- actions/surfaces covered
- dependencies requested but not installed
- shared edit requests scoped
- no repo writes

SETUP-REPO pass:

- repo/worktree ready
- branch/runtime identity ready
- setup directories ready
- no unsafe worktree mutation

SETUP-BUILD pass:

- stack pack resolved
- target resolution rules complete
- utility file policy complete
- slug rule tests pass
- dependencies approved/installed with evidence
- sandbox/tool prewarm complete when stack requires it
- build/test/smoke baseline passes where applicable
- mock production leak check passes when configured
- test bridge/build stripping policy present when a deterministic test bridge is
  required
- setup certificate written
- file tree manifest written
- shared collisions are either invalid failures or marked `pending_shared_grant`
  for MC assembly
- design handoff applied or explicitly bypassed by stack policy

## Implementation Order

1. Update this review packet after external critique.
2. Freeze schema versions:
   - `setfarm.plan.v2.2`
   - `setfarm.stories.v2`
   - `setfarm.setup-certificate.v1`
   - `setfarm.file-tree-manifest.v1`
3. Define `slugRules`, `routerParadigm`, dependency resolution policy, and mock
   injection boundary before freezing behavior.
4. Add schema/type tests before behavior changes.
5. Harden PLAN prompt/guards.
6. Harden DESIGN payload, Stitch batch/staged generation, token drift validation,
   and artifact gates.
7. Harden STORIES prompt/guards for logical targets, dependency requests, shared
   edit requests, and action coverage.
8. Complete stack pack `targetResolutionRules`, slug rules, router paradigms,
   dependency policies, utility file policies, and mock injection contracts.
9. Complete SETUP-REPO runtime evidence.
10. Complete SETUP-BUILD certificate and file-tree manifest generation.
11. Add tests:
    - PLAN schema and runtime-field bans
    - DESIGN payload slicing and artifact gates
    - `PRD_CONTEXT_SLICE` schema validation
    - token drift normalization
    - batch-1 partial recovery resets token-lock state
    - inline surface manifest evidence
    - `DESIGN_DOM_ACTION_MISSING` for UI contract actions without DOM evidence
    - STORIES logical target validation and no-path rules
    - dependency request aggregation
    - dependency conflict resolution
    - stack pack target resolution
    - slug rule determinism
    - slug rule test harness
    - file tree collision detection
    - shared grant artifact generation and denial handling
    - mock injection boundary
    - mock production leak detection
    - build stripping policy
    - sandbox prewarm
    - sandbox prewarm rerun after dependency patch mode
    - utility file policy enforcement
    - orphaned utility file detection
    - patch window marker creation and corruption detection
    - setup-build patch mode certificate versioning
    - setup certificate immutability
    - file tree manifest completeness
    - setup/build gate failure output
12. Run unit tests, step tests, and one full run through SETUP-BUILD before
    applying the separate IMPLEMENT refactor.

## Review Focus Questions

These are not unresolved policy decisions. They are the areas reviewers should
stress-test for contradictions or false-positive gates:

1. Deterministic stack-pack resolution and slug-rule coverage.
2. Dependency approval/rejection behavior across stack packs.
3. Browser-game and React Native design authority boundaries.
4. Optional dependency handling when a no-dependency implementation path exists.
5. Staged Stitch batch recovery and token drift validation.
