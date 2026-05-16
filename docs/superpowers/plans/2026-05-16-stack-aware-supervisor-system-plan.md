# Stack-Aware Supervisor System Implementation Plan

Date: 2026-05-16
Design: `docs/superpowers/specs/2026-05-16-stack-aware-supervisor-system-design.md`

## Intent

Implement the approved stack-aware supervisor architecture without adding project-specific guard patches. The first implementation target is a durable system that determines the project stack before worker implementation, injects only relevant stack/library guidance, records supervisor state in a portable ledger, and treats UI/DOM/visual gaps as repairable supervisor findings.

The plan builds on the existing supervisor-first refactor already present in `src/installer/supervisor/`.

## Constraints

- Keep runtime prompts, contracts, packs, tests, and docs in English.
- Do not make `find-skills` or skills.sh a runtime dependency.
- Do not inject all stack and library rules into every worker prompt.
- Preserve existing dirty worktree changes unless a change is explicitly required for this plan.
- Keep hard gates limited to infrastructure and critical safety failures.
- Move product, DOM, visual, and interaction issues into supervisor findings and repair loops.

## Phase 1: Stack Contract Core

Add a first-class stack contract model that supersedes the current ad-hoc `Stack` rules in `src/installer/steps/06-implement/stack-rules.ts`.

Files:

- `src/installer/stack-contract/types.ts`
- `src/installer/stack-contract/detector.ts`
- `src/installer/stack-contract/packs.ts`
- `src/installer/stack-contract/reconcile.ts`
- `src/installer/stack-contract/ledger.ts`
- `tests/stack-contract.test.ts`

Work:

- Define `StackContract` with stack id, confidence, repo evidence, setup commands, file contract, route contract, verification contract, and selected pack id.
- Create initial stack pack registry:
  - `nextjs-web-app`
  - `vite-react-web-app`
  - `static-html-site`
  - `browser-game-canvas`
  - `python-cli`
  - `python-web`
  - `android-app`
  - `ios-app`
- Detect stack from repository facts and PRD/task hints.
- Reconcile conflicts without failing immediately.
- Persist `.setfarm/ledger/stack-contract.json`.
- Provide a compact worker prompt fragment from the resolved stack pack.

Acceptance:

- A new run can produce a stack contract before implementation.
- Existing Vite and Next.js projects are detected correctly.
- Unknown projects return a recoverable `needs-reconcile` status, not a fatal failure.
- Tests cover at least Vite React, Next.js, static HTML, browser game, Python, Android, iOS, and unknown evidence.

## Phase 2: Pipeline Integration

Inject the stack contract before setup-build and implement workers start writing code.

Files:

- `src/installer/steps/03-stories/context.ts`
- `src/installer/steps/04-setup-repo/context.ts`
- `src/installer/steps/05-setup-build/context.ts`
- `src/installer/steps/06-implement/context.ts`
- `src/installer/steps/06-implement/prompt.md`
- `src/installer/steps/06-implement/stack-rules.ts`
- `src/installer/context-ops.ts`
- `tests/steps/03-stories.test.ts`
- `tests/steps/04-setup-repo.test.ts`
- `tests/steps/05-setup-build.test.ts`
- `tests/steps/06-implement.test.ts`

Work:

- Add context keys:
  - `stack_contract`
  - `stack_pack_id`
  - `stack_prompt`
  - `stack_setup_contract`
  - `stack_verification_contract`
- Keep existing `detected_stack` and `stack_rules` as compatibility aliases during migration.
- Make setup-build use stack setup contract instead of generic assumptions when available.
- Make implement prompt require workers to follow the resolved stack contract.
- Stop worker implementation when the stack contract is missing, but route the issue to preflight reconcile instead of a generic failure.

Acceptance:

- Implement prompt includes exactly one resolved stack pack.
- A Vite story no longer receives Next.js-only instructions.
- A Next.js story no longer receives Vite-only instructions.
- Existing tests still pass with compatibility aliases.

## Phase 3: Library Pack Registry

Add selected implementation library packs without turning them into global prompt noise.

Files:

- `src/installer/library-packs/types.ts`
- `src/installer/library-packs/registry.ts`
- `src/installer/library-packs/select.ts`
- `src/installer/library-packs/ledger.ts`
- `tests/library-packs.test.ts`

Work:

- Create library pack contracts for:
  - `ui-shadcn-radix`
  - `icons-lucide`
  - `motion-animation`
  - `creative-canvas`
  - `forms-validation`
  - `charts-data-viz`
- Select library packs from PRD intent, design contract, Stitch evidence, and stack contract.
- Persist `.setfarm/ledger/library-packs.json`.
- Inject only selected library guidance into worker prompts.
- Include explicit design authority rule: library defaults never override Stitch or the design contract.

Acceptance:

- Browser game selects creative canvas guidance, not dashboard form/chart guidance.
- Dashboard/data tool can select UI, icons, forms, and charts.
- Static/simple apps do not receive unnecessary library packs.
- Worker prompt contains selected packs only.

## Phase 4: Supervisor Ledger Expansion

Unify stack contract, library packs, design authority, findings, and repair history under the supervisor ledger.

Files:

- `src/installer/supervisor/types.ts`
- `src/installer/supervisor/state.ts`
- `src/installer/supervisor/run-supervisor.ts`
- `src/installer/supervisor/intervention.ts`
- `tests/supervisor.test.ts`

Work:

- Add ledger paths for:
  - `stack-contract.json`
  - `library-packs.json`
  - `design-contract.md`
  - `dom-inventory.json`
  - `repair-history.jsonl`
  - `final-evidence.json`
- Link supervisor run metadata to stack and library contracts.
- Record supervisor interventions with evidence, file targets, retry attempt, and expected outcome.
- Resume supervisor state from ledger artifacts when runtime state is incomplete.

Acceptance:

- Supervisor state summary can report stack pack, library packs, open findings, repair attempts, and visual status.
- Existing `.setfarm/supervisor/<runId>/` artifacts remain ignored by git unless explicitly committed.
- A restart/resume path can reconstruct the project context from ledger artifacts.

## Phase 5: Hard Gate And Finding Split

Simplify guard behavior so repairable product quality issues do not create failed spam.

Files:

- `src/installer/error-taxonomy.ts`
- `src/installer/step-fail.ts`
- `src/installer/step-ops.ts`
- `src/installer/steps/06-implement/guards.ts`
- `src/installer/steps/07-verify/guards.ts`
- `src/installer/steps/12-supervise/guards.ts`
- `tests/error-taxonomy.test.ts`
- `tests/steps/06-implement.test.ts`
- `tests/steps/07-verify.test.ts`
- `tests/steps/12-supervise.test.ts`

Work:

- Define hard gate categories for missing workspace, missing stack contract after reconcile, install/build/dev failure, app cannot start, critical crash, critical security issue, and unusable test runner.
- Convert DOM, visual, icon, route, and interaction gaps into supervisor findings where possible.
- Feed findings back to worker as concrete supervisor intervention text.
- Keep deterministic scope and git ownership gates hard.

Acceptance:

- Missing button handlers become supervisor findings with repair feedback.
- Broken build remains a hard gate.
- Scope bleed and git ownership violations remain hard gates.
- Failed counts in Mission Control represent true hard failures, not every UX finding.

## Phase 6: Web QA Findings Pipeline

Make Playwright and DOM extraction a supervisor sensor for web projects.

Files:

- `src/installer/supervisor/visual-qa.ts`
- `src/installer/supervisor/scanner.ts`
- `src/installer/steps/07-verify/playwright-check.ts`
- `src/installer/steps/07-verify/context.ts`
- `tests/supervisor.test.ts`
- `tests/steps/07-verify.test.ts`

Work:

- Use stack contract to start the correct dev/preview command.
- Visit required routes from route inventory.
- Capture desktop and mobile screenshots.
- Collect console errors, page errors, network errors, blank screens, layout overflow, and disappeared navigation regions.
- Compare DOM-extracted controls with clicked/verified controls.
- Write findings under supervisor visual artifacts.
- Mark subjective visual concerns as warnings and deterministic dead controls as blockers.

Acceptance:

- A web project cannot be marked done if required routes do not open.
- Dead controls become supervisor blockers with route, selector/label, screenshot, and repair instruction.
- Screenshots and visual report paths are visible in supervisor summary.

## Phase 7: Mission Control And Runtime Visibility

Expose the new model in Mission Control and Setfarm dashboards.

Files:

- `src/server/dashboard.ts`
- `src/server/index.html`
- `src/server/supervisor-summary.ts`
- Mission Control integration files in the OpenClaw runtime repository
- dashboard tests or smoke tests as available

Work:

- Show stack contract and selected library packs per run.
- Show hard gates separately from supervisor findings.
- Show repair loop count, visual QA status, DOM coverage status, and GitHub PR/check state.
- Show runtime version, git revision, dirty state, and build timestamp.
- Make local vs cloud/runtime source visible enough to avoid dashboard confusion.

Acceptance:

- Mission Control can explain why a run is running, repairing, blocked, failed, or done.
- Public/cloud state and local development state are distinguishable.
- Runtime version is no longer ambiguous.

## Phase 8: Canaries And Promotion

Run controlled projects to validate the system before broad runtime promotion.

Canaries:

- Browser game
- Web dashboard
- Static site
- Python app

Evidence required:

- Stack contract generated
- Library packs selected only when useful
- Build/test/smoke result
- DOM coverage result for web canaries
- Playwright screenshot report for web canaries
- Supervisor findings repaired or explicitly waived
- Mission Control state correct
- Runtime version visible

Promotion:

- Version bump
- Changelog entry
- Full build/test pass
- Runtime sync/deploy record
- Dashboard verification on cloud/OpenClaw

## Implementation Order

1. Phase 1 and Phase 2 together form the minimum useful slice.
2. Phase 3 can land after stack contracts are stable.
3. Phase 4 should land before aggressive repair loops.
4. Phase 5 should land before new canary runs to reduce failed spam.
5. Phase 6 and Phase 7 make the quality improvements visible.
6. Phase 8 validates the whole system.

## First Coding Slice

Start with Phase 1:

- Add stack contract types.
- Add detector and pack registry.
- Add ledger writer/reader.
- Add tests for stack detection and prompt fragment selection.

Do not modify worker prompts in the first slice beyond compatibility tests. Prompt injection belongs to Phase 2 after the contract model is stable.
