# PLAN Step Rules

PLAN is the run's portable product contract. It answers "what product behavior
must exist" and "what platform contract applies". It must not answer "where
will this repo live" or "what exact screens will Stitch draw".

## Required Output Fields

```
STATUS: done
PROJECT_NAME: <product name>
PROJECT_SLUG: <kebab-case product slug>
PLATFORM: <web|mobile|desktop|api|cli|game>
TECH_STACK: <vite-react|nextjs|vanilla-ts|node-express|react-native>
UI_LANGUAGE: <English or requested product language>
DB_REQUIRED: <none|postgres|sqlite>
DESIGN_REQUIRED: <true|false>
PRD:
<PRD body, at least 2000 characters, English technical prose>
```

## Runtime Ownership Boundary

PLAN must not emit or embed these runtime-owned values:

- `REPO`
- `BRANCH`
- `GITHUB_REPO`
- `RUN_SLUG`
- `APP_TITLE`
- `PACKAGE_NAME`
- `DB_SCHEMA_VERSION`
- ENV values
- hardcoded local/server paths
- physical screen counts or `PRD_SCREEN_COUNT`

Setfarm/MC resolves those values after PLAN from `PROJECT_NAME`,
`PROJECT_SLUG`, workflow/run id, and environment configuration.

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
- Seed states when needed.

### 3. Behavioral And Action Contract
Use one block per action. Each action must include:

- `ACTION_ID`: `ACT_*`
- `Surface Bound`: `SURF_*`
- Trigger
- Preconditions and auth/role requirements
- Async behavior: loading state, timeout behavior, idempotency
- Success effect
- Failure effect
- Navigation after success/failure
- State changes
- Persistence effects
- User feedback
- Unauthorized effect

### 4. Product Surfaces
For UI-bound platforms, define semantic Product Surfaces. These are not screens.
Stitch decides layout, screen count, routing, modals, drawers, tabs, and physical
component hierarchy in `DESIGN_MANIFEST.json`.

Each surface must include:

- `SURFACE_ID`: `SURF_*`
- Name
- Purpose
- Data entities bound
- Core content
- Permitted actions, each with a `control_hint`
- Entry points
- Exit and guard rules
- Auth required
- Design guidance for Stitch

Allowed `control_hint` values:
`primary_button`, `secondary_button`, `icon_button`, `context_menu`,
`context_menu_destructive`, `form_submit`, `inline_edit`, `swipe_action`, `fab`,
`search_input_persistent`, `keyboard_shortcut`.

### 5. Validation And Error Strategy
- Field validation rules and user-facing error messages.
- Error taxonomy: validation, business rule, system/network.
- Error display policy: inline, toast, banner, retry, empty/error state.

### 6. System Contracts
- Environment needs as key names only. Do not include values.
- External integrations with purpose and fallback behavior.
- Permission model and role boundaries when relevant.

### 7. Platform Contract
Only include the selected platform's rules.

- Web: rendering strategy, auth storage, routing/guard location, CSP posture.
- Mobile: deep link scheme, offline policy, native permissions, push policy.
- API: auth scheme, endpoints/DTO/status codes, pagination, rate limit, error envelope.
- CLI: command tree, args/flags, stdin/stdout/stderr, exit codes, config location.
- Game: game loop, input model, pause/restart, save/high-score state.

Do not include another platform's rules. Next.js PRDs must not include React
Native/Android rules; React Native PRDs must not include browser `window.app`
rules; API/CLI PRDs must not include Product Surfaces or Stitch requirements.

### 8. Testability Contract
- Critical happy paths and unhappy variants.
- Test handle policy:
  - Vite React/Web: `data-testid` and `window.app` are allowed.
  - Next.js: use stable test handles; browser APIs only in client components.
  - React Native: use `testID`, not `window.app`.
  - API: endpoint assertions and response envelopes.
  - CLI: stdout/stderr and exit-code assertions.
- API mock hints when applicable.

### 9. Out Of Scope
At least one explicit deny item is required. Use this to prevent agent
hallucination, for example "No ecommerce checkout", "No admin panel",
"No physical screen list in PLAN", or domain-specific anti-goals.

## Stitch/Design Boundary

When `DESIGN_REQUIRED=true`, PLAN gives Stitch direction only through Product
Surfaces, action control hints, design guidance, validation/error strategy, and
UI anti-goals. DESIGN builds a scoped `DESIGN_BRIEF.md` and Stitch payload.

Stitch may receive the full PRD only as `FULL_PRD_APPENDIX` passive background.
It is not allowed to invent modules, workflows, or screens outside Product
Surfaces. DESIGN Verify must fail with `DESIGN_SURFACE_MISMATCH` if Stitch
produces unrelated or unmapped screens.

When `DESIGN_REQUIRED=false`, Product Surfaces and Stitch are skipped.

## TECH_STACK Selection

- `vite-react`: SPA, browser game, dashboard, utility, internal tool.
- `nextjs`: SSR/SEO, content-heavy, multi-page public web, ecommerce.
- `vanilla-ts`: minimal browser utility or no-framework frontend.
- `node-express`: API-only/backend service.
- `react-native`: mobile app.

Use the explicitly requested framework when present. Use `vite-react` for
general web apps when unclear.

## DB_REQUIRED

- `none`: static, game, local-storage app.
- `postgres`: auth, shared user data, CRUD, multi-user data, server persistence.
- `sqlite`: only when explicitly requested or suitable for local CLI/desktop.

## Do Not

- Do not write user stories; STORIES owns that.
- Do not write code.
- Do not output a Screens table.
- Do not output fewer than one Product Surface for UI platforms.
- Do not output a PRD shorter than 2000 characters.
- Do not add project-specific infrastructure paths.
