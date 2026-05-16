# Stack-Aware Supervisor System Design

Date: 2026-05-16
Status: Approved design
Scope: Setfarm orchestration, OpenClaw runtime integration, Mission Control state, supervisor workflow, stack/library pack architecture

## Purpose

Setfarm should produce complete, working projects across different application types without relying on a growing pile of project-specific guards. The root problem is not one missing button or one broken route. The root problem is that workers often start implementation before the system has a clear contract for the target stack, design authority, selected implementation libraries, and verification expectations.

This design replaces guard-heavy execution with a stack-aware supervisor system. The system first determines the project type and best-fit stack, then gives workers a short, deterministic contract. Supervisors continuously verify behavior and guide repairs through findings instead of turning every quality issue into a hard failure.

## Non-Goals

- Do not add project-specific rules for one failed run.
- Do not inject every possible framework and library rule into every worker prompt.
- Do not make `find-skills` or skills.sh a runtime dependency.
- Do not let library defaults override Stitch or project design intent.
- Do not treat every DOM, visual, or UX issue as a run-level failure.

## System Architecture

Setfarm will use four orchestration roles:

- **Global coordinator:** Manages queueing, capacity, provider/model budget, dashboard state, stuck-run detection, and health metrics across many parallel projects.
- **Project supervisor:** Owns one project. It understands the PRD, stack contract, design contract, selected library packs, story progress, findings, repairs, and final delivery evidence.
- **Worker:** Implements code inside one project workspace/session using the project contract supplied by the supervisor.
- **Verifier tools/agents:** Produce evidence from build output, tests, DOM extraction, Playwright screenshots, route checks, security checks, GitHub PR checks, and review comments.

Every project gets isolated execution:

- Separate workspace
- Separate worker session
- Separate supervisor session
- Separate runtime state
- Separate ledger
- Separate GitHub branch/PR/check trace when GitHub flow is enabled

The global coordinator never mixes project context. It can pause, resume, retry, switch provider, or surface health state, but project-specific reasoning belongs to the project supervisor.

## Stack Selection And Reconciliation

Stack selection is hybrid. The PRD may declare or imply a target stack, while the detector reads repository facts. The supervisor reconciles both before implementation starts.

The detector reads evidence such as:

- `package.json`
- lockfiles
- `next.config.*`
- `vite.config.*`
- `app/` and `pages/`
- `src/main.*`
- `android/`, Gradle files
- `ios/`, Xcode project files
- `pyproject.toml`
- `requirements.txt`
- framework-specific entrypoints and route files

Conflicts do not immediately fail the run. They enter **Stack Preflight Reconcile**:

- If the PRD is wrong or ambiguous, the supervisor updates the PRD-derived contract.
- If repository setup is missing, setup/build repair runs before implementation.
- If the project is new, the supervisor chooses the best-fit stack for the product type.
- If the repository already has a coherent stack, Setfarm avoids unnecessary conversion.
- If the target is platform-specific, such as Android or iOS, the supervisor selects the appropriate native or established project stack.

The result is a **stack contract** that workers must follow.

## Stack Packs

Stack packs are Setfarm-owned contracts. They are short, deterministic, and specific to one infrastructure family. They are not copied from external skills at runtime.

Each stack pack contains:

- **When to use:** Project types and PRD signals that fit this stack.
- **Repo evidence:** Files and patterns that confirm the stack.
- **Setup contract:** Install, build, test, dev, and smoke commands.
- **File contract:** Expected entrypoints, routes, asset locations, and generated files.
- **Implementation rules:** Short prompt fragment with only stack-specific constraints.
- **Verification contract:** Required build, smoke, DOM, route, visual, and test evidence.
- **Done means:** A concise checklist for completion.

Initial stack packs:

- `nextjs-web-app`
- `vite-react-web-app`
- `static-html-site`
- `browser-game-canvas`
- `python-cli`
- `python-web`
- `android-app`
- `ios-app`

Stack packs may be prepared using official documentation and trusted references, but normal project runs must not depend on live web research.

## Library Packs

Library packs are implementation tool contracts. They do not choose the stack and they do not own visual design.

Initial library pack categories:

- `ui-shadcn-radix`: shadcn/ui, Radix primitives, Tailwind-compatible component mechanics.
- `icons-lucide`: Consistent icon system.
- `motion-animation`: Motion, Framer Motion, GSAP, or similar animation tools when appropriate.
- `creative-canvas`: Three.js, PixiJS, Phaser, Matter.js, or similar creative/game foundations.
- `forms-validation`: react-hook-form, zod, and form interaction patterns.
- `charts-data-viz`: Recharts, D3, ECharts, or similar data visualization tools.

Selection is supervisor-driven:

- The supervisor reads PRD intent, stack contract, design contract, and project type.
- The worker receives only selected library packs, not the full library catalog.
- Library packs include install guidance, usage boundaries, and verification expectations.
- Discovery articles can inspire pack creation, but they are not source of truth.
- Official docs and stable local patterns are preferred.

## Design Authority

Design authority is explicit:

1. Stitch and downloaded design artifacts are the visual source of truth when present.
2. If Stitch is absent, the project supervisor creates a short design contract.
3. Library packs provide component mechanics and implementation patterns.
4. Library default styling must be overridden when it conflicts with Stitch or the design contract.
5. Visual QA compares the final application to the design authority, not to library defaults.

Example: if Stitch defines a modal, a worker may use Radix or shadcn Dialog for accessibility and mechanics, but spacing, visual hierarchy, colors, and presentation must follow Stitch or the design contract.

## Supervisor Ledger And Memory

Supervisor memory is hybrid. Live model context is useful, but it is not the source of truth.

The runtime stores live orchestration state:

- Active step and story
- Active worker and supervisor sessions
- Retry counters
- Provider/model state
- Queue and health status
- Current hard gates and findings

The workspace/repository stores a portable audit trail, for example:

- `.setfarm/ledger/stack-contract.json`
- `.setfarm/ledger/library-packs.json`
- `.setfarm/ledger/design-contract.md`
- `.setfarm/ledger/story-checklist.json`
- `.setfarm/ledger/dom-inventory.json`
- `.setfarm/ledger/visual-findings.json`
- `.setfarm/ledger/repair-history.jsonl`
- `.setfarm/ledger/final-evidence.json`

GitHub stores external delivery evidence when enabled:

- Branches
- Pull requests
- Review comments
- CI/check results
- Merge trace

If a session, worker, container, or runtime restarts, the supervisor resumes from runtime state plus the project ledger. It should summarize current state for the next worker instead of re-inferring the project from scratch.

## Supervisor Intervention And Repair Loop

The project supervisor is an active manager, not a passive final reviewer.

Signal sources:

- File diffs
- Build and test output
- DOM extract
- Button, link, and form inventory
- Route inventory
- Playwright screenshots
- Console and page errors
- Responsive viewport checks
- Stitch/design contract comparison
- PRD/story acceptance checklist
- GitHub PR checks and review comments

Repair loop:

1. Worker implements a story.
2. Supervisor reads intermediate signals.
3. Supervisor records findings in the ledger.
4. Supervisor injects a concrete instruction into the worker session.
5. Worker repairs the issue.
6. Supervisor verifies the repair with the relevant evidence.
7. After a retry threshold, the supervisor can refine the instruction, switch provider/model, create a focused repair task, or patch directly.

Worker intervention instructions must be concrete. They should identify the missing behavior, relevant file, evidence, and expected outcome.

## Guard Model

Guards are split into two classes.

### Hard Gates

Hard gates block progress only when the project cannot safely continue:

- Workspace or entrypoint is missing.
- Stack contract cannot be produced.
- Install/build/dev command is completely broken.
- Application cannot start.
- Critical runtime crash blocks route loading.
- Critical security issue is detected.
- Test runner infrastructure is unusable.

Hard gates can mark a step or run failed when repair is exhausted.

### Supervisor Findings

Supervisor findings do not create immediate run-level failure. They trigger repair:

- Button/link handler missing
- Route missing
- Modal/dropdown/menu not working
- Icon mismatch
- Layout breakage
- Stitch/design mismatch
- Responsive overflow
- Non-critical console issue
- PRD acceptance gap
- DOM element present but behavior absent
- Header/footer/sidebar disappearing during navigation

This reduces failed spam while preserving quality control.

## Web QA Model

Web projects require DOM coverage plus Playwright visual route audit before completion.

Required evidence:

- Route/page inventory
- Playwright visit for each required route
- Desktop and mobile screenshots
- Console and page error report
- DOM extract per relevant page
- Button/link/form inventory
- Handler/link/form behavior coverage
- Navigation persistence checks
- Responsive layout checks
- Design authority comparison when Stitch or a design contract exists

The project is not done until required routes open, critical console errors are absent, expected interactive elements work, screenshots are not blank or incoherent, responsive layout is acceptable, and the design authority is not visibly violated.

## Mission Control And OpenClaw Integration

OpenClaw runtime is the primary deployment target. Localhost is for development and testing.

Mission Control should show:

- Project stack contract
- Selected library packs
- Supervisor state
- Worker state
- Current story
- Hard gates
- Supervisor findings
- DOM and visual QA status
- Repair loop count
- GitHub branch/PR/check state
- Runtime version and source revision

Mission Control should reserve `failed` for true hard gate exhaustion or unrecoverable run failure. DOM, visual, design, and interaction problems should appear as findings under active repair.

Public and local dashboards must not be confused. Cloud state, local development state, and runtime source revision should be visible enough to explain which environment is being observed.

## Version And Release Discipline

Every Setfarm behavior change must update version metadata and changelog before being promoted to runtime. Mission Control and Setfarm dashboard should display runtime version, source revision, dirty state, and build timestamp.

Minimum release evidence:

- Package version bump for behavior changes
- Changelog entry
- Build/test result
- Runtime sync/deploy record
- Dashboard-visible version

This prevents stale `2.1.0`-style ambiguity and makes it clear which system version produced a run.

## Prompt And Documentation Language

Runtime prompts, stack packs, library packs, supervisor instructions, guard messages, and design specs must be written in English. User-facing conversation can be localized outside the repo, but project execution artifacts must stay English-only to reduce model confusion.

## Migration Plan

1. Inventory existing guards.
2. Classify each guard as:
   - keep as hard gate
   - convert to supervisor finding
   - move into stack pack
   - move into library pack
   - delete as project-specific or noisy
3. Add stack contract generation and preflight reconcile.
4. Create initial stack packs.
5. Create initial library pack registry.
6. Extend supervisor ledger.
7. Move DOM/visual/design issues into findings and repair loop.
8. Update Mission Control to show stack contracts, findings, repair state, and runtime version.
9. Run canaries:
   - browser game
   - web dashboard
   - static site
   - Python app
10. Promote to OpenClaw runtime after canaries show stable evidence.

## Acceptance Criteria

- A worker cannot start implementation without a stack contract.
- A worker receives only the relevant stack pack and selected library packs.
- Stitch or a supervisor design contract is always the visual authority.
- Hard gates are limited to blocking infrastructure and critical safety failures.
- DOM, visual, and UX issues are findings with repair loops.
- Each project has isolated supervisor, worker, workspace, runtime state, and ledger.
- Mission Control shows the difference between hard failures and repairable findings.
- Runtime version and source revision are visible.
- No runtime prompt or Setfarm execution artifact contains Turkish instructions.

## Implementation Planning Defaults

- Runtime DB owns live supervisor state. The implementation should reuse existing run/project state tables first and add supervisor-specific tables only when existing tables would blur ownership.
- Workspace ledger files are persisted as runtime artifacts by default. They are committed only when a project explicitly needs audit files in the repository.
- The first retry threshold is two focused worker repair attempts. After that, the supervisor may switch provider/model, create a focused repair task, or patch directly.
- The first canaries are a browser game and a web dashboard because they exercise stack selection, library selection, DOM coverage, visual QA, and interactive controls.
- The first visual comparison method is pragmatic: Playwright screenshots, DOM inventory, route persistence, responsive checks, and supervisor visual review. Pixel-perfect image diff can be added later after the finding pipeline is stable.
