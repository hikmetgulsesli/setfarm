# Setfarm Guard Inventory

Date: 2026-05-16

This inventory separates platform safety guards from product-quality checks.
The rule is project-neutral: Setfarm may hard-fail deterministic system risks,
but product completeness should flow through supervisor checklist evidence,
intervention text, retry feedback, and fixer escalation.

## Hard Guards

Hard guards are allowed to fail or requeue an agent because continuing would
corrupt the platform, advance broken code, or lose deterministic state.

| Area | Files | Purpose |
| --- | --- | --- |
| Runtime integrity | `src/cli/runtime-guard.ts`, `scripts/write-build-info.mjs`, `scripts/inject-version.js` | Refuse stale runtime builds, keep release surfaces tied to `package.json`, and stamp runtime display versions with package semver plus git sha. |
| Agent cwd isolation | `src/spawner.ts` | Start agents in safe scratch space unless a claim workdir is explicitly resolved, preventing platform source self-corruption. |
| Step output parsing | `src/installer/step-guardrails.ts`, per-step `guards.ts` | Require machine-readable output fields that downstream steps actually consume. |
| Story scope isolation | `src/installer/steps/06-implement/guards.ts`, `src/installer/worktree-ops.ts` | Reject story completion when source writes escape declared story scope or implicit shared source rules. |
| Worker git discipline | `src/installer/worktree-ops.ts`, `src/spawner.ts` | Prevent workers from staging, committing, pushing, branching, or bypassing Setfarm ownership. |
| Build and touched-test gates | `src/installer/steps/06-implement/guards.ts` | Reject `STATUS: done` when the story worktree cannot build or touched tests fail. |
| Runtime bridge contract | `src/installer/steps/06-implement/guards.ts` | Reject stories that promise `window.app`/`globalThis.app` runtime observability but do not expose a live state bridge. |
| Active inert controls | `src/installer/steps/06-implement/guards.ts` | Reject active buttons or navigation controls that have no handler, href, submit behavior, disabled state, or explicit inert semantics. |
| Deploy URL contract | `src/installer/steps/11-deploy/preclaim.ts`, `src/installer/steps/11-deploy/guards.ts` | Keep deploy results parseable and prevent malformed live URLs from passing. |

## Supervisor Signals

Supervisor signals should not become project-specific fatal guards. They create
or update checklist blockers, warnings, state entries, events, and targeted
instructions for the active worker.

| Signal | Files | Expected handling |
| --- | --- | --- |
| Missing DOM-extracted controls | `src/installer/supervisor/checklist.ts`, `src/installer/supervisor/scanner.ts`, `src/installer/steps/06-implement/guards.ts` | Add checklist blocker with item id, feed exact missing control back to worker, verify by scanner before close. |
| Labeled icon mismatch | `src/installer/supervisor/scanner.ts`, `src/installer/supervisor/intervention.ts` | Record warning or blocker based on severity; do not hardcode app-specific icon names. |
| Button/link wiring gaps | `src/installer/supervisor/scanner.ts`, `src/installer/supervisor/visual-qa.ts` | Use static evidence plus Playwright clicked-control evidence; only keep blocker open when user-visible control cannot produce state, DOM, URL, or disabled feedback. |
| Raw design corpus over-read | `src/spawner.ts`, `src/spawner-prompt.ts` | Record supervisor signal and targeted correction; do not kill unless it causes scope or output failure. |
| No-delta and parse-loop stalls | `src/spawner.ts` | Signal the supervisor while the worker session is warm; escalate only after repeated failure thresholds. |
| Visual layout/runtime issues | `src/installer/supervisor/visual-qa.ts`, `src/installer/steps/07-verify/context.ts` | Persist screenshots, console issues, route/click evidence, and layout overflow findings under `.setfarm/supervisor/<runId>/visual/`. |
| Product/design drift | `src/installer/product-supervisor.ts`, `src/installer/steps/03-stories/guards.ts` | Convert into PRD/story checklist feedback unless the stories no longer preserve the original task domain at all. |

## Per-Step Guard Files

| Step | Guard file | Notes |
| --- | --- | --- |
| `01-plan` | `src/installer/steps/01-plan/guards.ts` | Minimal output validation; project requirements are injected through preclaim text. |
| `02-design` | `src/installer/steps/02-design/guards.ts` | Minimal output validation; generated fallback design assets are handled in preclaim. |
| `03-stories` | `src/installer/steps/03-stories/guards.ts` | Story parsing, semantic domain preservation, UI behavior injection, and product supervisor review. |
| `04-setup-repo` | `src/installer/steps/04-setup-repo/guards.ts` | Minimal output validation; setup writes deterministic repo metadata. |
| `05-setup-build` | `src/installer/steps/05-setup-build/guards.ts` | Build command and baseline smoke validation. |
| `06-implement` | `src/installer/steps/06-implement/guards.ts` | Main deterministic safety gate plus supervisor checklist scan. |
| `07-verify` | `src/installer/steps/07-verify/guards.ts` | Output normalization; visual QA evidence is injected through context. |
| `08-security-gate` | `src/installer/steps/08-security-gate/guards.ts` | Minimal security-gate output checks. |
| `09-qa-test` | `src/installer/steps/09-qa-test/guards.ts` | QA output normalization and test evidence parsing. |
| `10-final-test` | `src/installer/steps/10-final-test/guards.ts` | Final output normalization and smoke evidence parsing. |
| `11-deploy` | `src/installer/steps/11-deploy/guards.ts` | Deploy output shape; URL contract is generated in preclaim. |
| `12-supervise` | `src/installer/steps/12-supervise/guards.ts` | Supervisor decision normalization and final supervisor pass/fail handling. |

## Regression Commands

Run these before syncing runtime:

```sh
npm run check:english
npm run build
npm test
```

`npm test` must include top-level TypeScript tests, step tests, and script tests.
Script tests are part of the version contract, so they must stay in the default
test command rather than being optional.
