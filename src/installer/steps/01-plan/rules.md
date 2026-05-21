# PLAN Step Rules

PLAN is the run's portable product contract. It answers what product behavior,
state, data, platform, and design intent must exist. It must not answer where
the repo lives, which files exist, which package name is used, or what exact
screens Stitch draws.

## Required Output Fields

```
CONTRACT_SCHEMA_VERSION: setfarm.plan.v2.2
STATUS: done
PROJECT_NAME: <product name>
PROJECT_SLUG: <kebab-case product slug>
PLATFORM: <web|mobile|desktop|api|cli|game>
TECH_STACK: <vite-react|nextjs|static-html|browser-game|node-express|python-web|node-cli|python-cli|react-native-expo|android-native|ios-native|desktop-electron>
UI_LANGUAGE: <English or requested product language>
DB_REQUIRED: <none|postgres|sqlite|external>
DESIGN_REQUIRED: <true|false>
UI_VISION_SUMMARY: <3-4 UI-focused sentences for DESIGN; no runtime paths>
PRD:
<PRD body, at least 2000 characters, English technical prose>
```

Every field is required. This is not JSON. Only `PRD` may be multi-line.

## Runtime Ownership Boundary

PLAN must not emit or embed these runtime-owned values:

- `REPO`
- `BRANCH`
- `GITHUB_REPO`
- `RUN_SLUG`
- `APP_TITLE`
- `PACKAGE_NAME`
- `DB_SCHEMA_VERSION`
- `.env` contents
- ENV values or secrets
- hardcoded local/server paths
- physical file paths such as `src/App.tsx`
- physical screen counts or `PRD_SCREEN_COUNT`
- `FULL_PRD_APPENDIX`

Setfarm/MC resolves runtime identity, repo path, branch, GitHub name, package
name, env values, and physical file targets after PLAN.

LLM output is advisory only until validated by deterministic Setfarm code.
PLAN must not leave "LLM decides" or open-ended resolver language in the PRD.

## Mandatory PRD Sections

### 1. Context And Goals
- Overview: summarize the product in 2-3 sentences.
- Target audience and personas.
- Business goals and user goals.
- Primary workflows with success criteria.
- Non-functional targets: performance, accessibility, target devices, localization policy.
- External dependencies, if any.

### 2. Data And State Contract
- Entities with fields, types, required flags, constraints, and relationships.
- State architecture: server state, client/local state, URL/router state,
  persisted preferences, transient UI state.
- Data flow: read path, write path, error path, and side effects.
- `mock_data_contract`: fixture strategy, required entities, required UI states,
  seed policy, and stack-pack injection boundary. This must be product-specific;
  do not hardcode only ready/empty/error if the product needs loading, offline,
  locked, partial, validation, or game-over states.
- `data_access_contract`: data fetching/storage paradigm for the selected stack
  such as local state, fixture file, raw fetch, server action, endpoint adapter,
  CLI file input, or game runtime state.

### 3. Behavioral And Action Contract
Use one block per action. Each action must include:

- `ACTION_ID`: `ACT_*`
- `Surface Bound`: `SURF_*` for UI-bound actions or `N/A` for API/CLI actions
- Trigger
- Preconditions and auth/role requirements
- Async behavior: loading state, timeout behavior, idempotency
- Success effect
- Failure effect
- Navigation after success/failure for UI platforms
- State changes
- Persistence effects
- User feedback
- Unauthorized effect

### 4. Product Surfaces
For UI-bound platforms, define semantic Product Surfaces. These are not screens.
Stitch decides physical layout, screen count, routing, modals, drawers, tabs,
and component hierarchy in `DESIGN_MANIFEST.json`.

Each surface must include:

- `SURFACE_ID`: `SURF_*`
- Name
- Purpose
- Domain Hint: stable domain slug used later by deterministic target resolution
- Representation: `standalone` or `inline`
- Host Surface ID: `SURF_*` when representation is `inline`, otherwise `none`
- Data entities bound
- Display Fields: only fields that may appear in UI/context slice
- Core content
- Permitted actions, each with a `control_hint`
- Entry points
- Exit and guard rules
- Auth required
- Design guidance for Stitch

Allowed `control_hint` values:
`primary_button`, `secondary_button`, `icon_button`, `context_menu`,
`context_menu_destructive`, `form_submit`, `inline_edit`, `swipe_action`, `fab`,
`search_input_persistent`, `keyboard_shortcut`, `none`.

Inline surface rule: DESIGN_VERIFY accepts inline coverage only when PLAN
explicitly declares `Representation: inline` and `Host Surface ID: SURF_*`.
Agent claims do not override this declaration.

### 5. Validation And Error Strategy
- Field validation rules and user-facing error messages.
- Error taxonomy: validation, business rule, system/network.
- Error display policy: inline, toast, banner, retry, empty/error state.

### 6. System Contracts
- `environment_contract`: required key names, optional key names,
  secret handling, client-exposed public keys, and missing-key behavior.
  Values are supplied by MC/runtime, never by PLAN.
- External integrations with purpose and fallback behavior.
- Permission model and role boundaries when relevant.

### 7. Platform Contract
Only include the selected platform's rules.

- Web: rendering strategy, auth storage, `route_guard_policy`, CSP posture.
- Mobile: deep link scheme, offline policy, native permissions, push policy,
  route/navigation guard policy, and `testID` policy.
- Desktop: local file policy, updater policy if requested, storage policy, route guard policy.
- API: auth scheme, endpoint/DTO/status-code contract, pagination, rate limit,
  error envelope.
- CLI: command tree, args/flags, stdin/stdout/stderr, exit codes, config location.
- Game: game loop, input model, pause/restart, save/high-score state,
  DOM/canvas overlay boundary.

Do not include another platform's rules. Next.js PRDs must not include React
Native/Android rules; React Native PRDs must not include browser `window.app`
rules; API/CLI PRDs must not include Stitch requirements beyond
`DESIGN_REQUIRED=false`.

### 8. Testability Contract
- Critical happy paths and unhappy variants.
- Test handle policy:
  - Vite React/Web: `data-testid` and `window.app` are allowed.
  - Next.js: use stable test handles; browser APIs only in client components.
  - React Native/Expo: use `testID`, not `window.app`.
  - API: endpoint assertions and response envelopes.
  - CLI: stdout/stderr and exit-code assertions.
  - Browser game: expose deterministic debug state for tests, plus canvas/DOM
    pixel and interaction verification.
- API mock hints when applicable.

### 9. Out Of Scope
At least one explicit deny item is required. Use this to prevent agent
hallucination, for example "No ecommerce checkout", "No admin panel",
"No physical screen list in PLAN", or domain-specific anti-goals.

## Stitch/Design Boundary

When `DESIGN_REQUIRED=true`, PLAN gives Stitch direction only through:

- `UI_VISION_SUMMARY`
- Product Surfaces
- display fields
- action control hints
- design guidance
- validation/error strategy
- UI anti-goals

DESIGN builds a scoped `DESIGN_BRIEF.md` and Stitch payload. Stitch receives
`PRD_CONTEXT_SLICE`, not the full PRD. The slice contains only visible product
context derived from Product Surfaces, Display Fields, permitted actions,
UI-facing validation/error behavior, and Out Of Scope UI anti-goals.

Stitch is not allowed to invent modules, workflows, or screens outside Product
Surfaces. DESIGN Verify fails with `DESIGN_SURFACE_MISMATCH` if Stitch produces
unrelated or unmapped screens, or if a standalone surface is missing.

When `DESIGN_REQUIRED=false`, Product Surfaces may be a short skipped section,
and Stitch is skipped.

## TECH_STACK Selection

- `vite-react`: general browser apps, dashboards, internal tools.
- `nextjs`: SSR/SEO, content-heavy public web, ecommerce, server routes.
- `static-html`: tiny static UI where no build framework is needed.
- `browser-game`: browser games, canvas/WebGL/DOM games.
- `node-express`: API-only/backend service on Node.
- `python-web`: API/backend service on Python.
- `node-cli`: Node command-line tool.
- `python-cli`: Python command-line tool.
- `react-native-expo`: React Native/Expo mobile app.
- `android-native`: native Android app.
- `ios-native`: native iOS app.
- `desktop-electron`: desktop app.

Use the explicitly requested framework when present. Use `vite-react` for
general web apps when unclear.

## DB_REQUIRED

- `none`: static, game, local-storage app, CLI with file-only state.
- `postgres`: auth, shared user data, CRUD, multi-user data, server persistence.
- `sqlite`: explicitly requested local database or suitable local CLI/desktop.
- `external`: managed service owns persistence, such as Firebase/Supabase API mode.

## Do Not

- Do not write user stories; STORIES owns that.
- Do not write code.
- Do not output a Screens table.
- Do not output physical file paths.
- Do not output fewer than one Product Surface for UI platforms.
- Do not output a PRD shorter than 2000 characters.
- Do not add project-specific infrastructure paths.
- Do not leave resolver behavior to an LLM; deterministic downstream contracts
  must own target resolution.
