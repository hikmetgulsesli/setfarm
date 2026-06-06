# Setfarm Generated Runtime Root Fix Review

Date: 2026-05-25
Scope: Setfarm + Mission Control local runtime, system-level fixes only
Status: implementation patch applied locally, tests/build passing, clean-run validation still pending

## Purpose

This packet is meant for a second-model review. It summarizes the last failing project samples, the systemic causes we found, the files changed, and the remaining design questions.

The goal is not to fix ReturnFlow, ClinicFlow, DispatchGrid, WarehouseOps, or YardPulse one by one. The goal is to make the Setfarm pipeline generate, verify, observe, and repair any product/domain/stack with the same root contracts.

## User Pain

- Generated projects could pass build while the coded app was much worse than the Stitch design.
- Buttons, settings, reports, details panels, and navigation were often missing or fake.
- Implement/verify appeared to do work in bulk at the end instead of showing step-by-step progress.
- GitHub PR review comments and story completion were unclear in Mission Control.
- A run could spend retries in implement even though the defect came from design import/setup-build.
- Different domains exposed new failures: returns, clinic, dispatch, warehouse, yard operations.

## Last Sample Runs

### ReturnFlow Desk

Symptom from browser comparison:
- Stitch design had a detailed return workflow with sidebar navigation, table, filters, detail panel, and action buttons.
- Coded app rendered only a partial board or incomplete route states.
- Reports/settings/navigation were not fully implemented.

Systemic cause:
- Generated screens were treated as visual assets, but implementation could mount partial or hardcoded app state without proving route/control parity.
- The pipeline needed stronger generated runtime semantics and story ownership checks.

### YardPulse Control, run #230 / 1bcede5d

Symptom:
- Implement US-001 failed because generated screens contained generic icon fallbacks.
- Files included `EmptyAndErrorRecoveryYardpulseControl.tsx` and `SettingsAndPreferencesYardpulseControl.tsx`.

Systemic cause:
- `stitch-to-jsx` silently converted unknown Material Symbols to `BadgeHelp`.
- This poisoned implementation even though the defect belonged to design import/setup-build.

### ClinicFlow Command, run #239 / 1500143a

Symptom:
- Implement US-001 exhausted retries.
- Generated screens contained `BadgeHelp` fallbacks in clinic-specific screens.
- Missing Material Symbols included healthcare and workflow symbols such as `ecg_heart`, `local_hospital`, `clinical_notes`, `contact_phone`, `medical_services`, plus general app symbols.

Systemic cause:
- The converter had a shallow icon map.
- The quality gate did not stop the pipeline at setup-build when generated screens were semantically degraded.

### DispatchGrid Control, run #242 / a028335f

Symptom:
- Plan/design/setup-build appeared green, but generated screens still had `BadgeHelp`.
- Missing Material Symbols included dispatch/operations symbols such as `precision_manufacturing`, `list_alt`, `sensors`, `assignment_ind`, `grid_view`, `drag_indicator`, and `open_in_full`.

Systemic cause:
- Setup-build preclaim could detect the failure, but `onComplete` could later clear the failure if `npm run build` passed.
- Build success was incorrectly stronger than design import semantic failure.

### WarehouseOps Console, runs #245 / 73892cdd and #248 / 08e20dfd

Symptom:
- #245 failed plan with `PLAN_SURFACE_DRIFT` because generic surface labels like `Item Operations` were treated as unrequested domain drift.
- #248 passed plan after the generic-label fix, but setup-build still passed under an old completion path despite generated `BadgeHelp`.
- Warehouse-specific symbols included `warehouse`, `widgets`, `pending_actions`, `monitoring`, `power`, `wifi_off`, `person_search`, `fact_check`, and others.

Systemic cause:
- Product supervisor was too strict about generic nouns such as item/entity/resource.
- Setup-build needed to preserve design import failures until the generated source itself was clean.

## Root Causes

1. Silent semantic fallback in Stitch conversion.
   Unknown Material Symbols became `BadgeHelp`, so build passed while the UI lost meaning.

2. Build-only recovery path in setup-build.
   A design import failure could be cleared by a passing build, even when generated source still contained fallback icons.

3. Generated-runtime validation happened too late.
   Implement agents inherited setup/design defects and spent retries on the wrong layer.

4. Product-surface drift guard mixed domain drift with generic labels.
   Generic labels like Item Operations should be allowed only when the surface purpose preserves the requested domain.

5. Mission Control did not expose enough live operation granularity.
   Users need to see story-level, PR-level, supervisor-level, and retry-level state as it happens, not just phase-level pass/fail.

6. Stitch design tokens were not converted into runtime CSS utilities.
   Stitch HTML commonly emits token classes such as `bg-surface`, `text-on-surface`, `border-outline-variant`, `p-gutter`, and `dark:hover:bg-surface-container-high`. The generated React source preserved those classes, but the Vite/Tailwind baseline did not know the Stitch theme tokens, so the browser rendered a white/default app even when the JSX structure was close to the design.

## Files Changed

### `scripts/stitch-to-jsx.mjs`

Changes:
- Expanded Material Symbols to lucide-react mappings across returns, clinic, dispatch, warehouse, operations, and general app UI.
- Added mappings including `warehouse`, `terrain`, `local_hospital`, `medical_services`, `clinical_notes`, `ecg_heart`, `precision_manufacturing`, `pending_actions`, `monitoring`, `person_search`, `fact_check`, and related symbols.
- Added unknown-icon collection.
- Unknown Material Symbols now fail conversion with `UNKNOWN_MATERIAL_ICONS` unless explicitly bypassed with `SETFARM_ALLOW_UNKNOWN_MATERIAL_ICONS=1`.
- Parses `stitch/design-tokens.css` and emits runtime utility CSS for Stitch token classes that Tailwind does not know by default.
- Covers token-backed color, spacing, radius, and font utilities, including opacity forms like `bg-surface-variant/30`.
- Handles common Tailwind variants for generated token utilities: `dark`, `hover`, `focus`, `focus-visible`, `focus-within`, `active`, `disabled`, `visited`, `group-hover`, and responsive wrappers.

Why:
- Unknown design semantics must stop setup-build immediately. They must not become quiet fake icons that later look like implement bugs.
- Stitch token classes must render with the same semantic theme as the source design. Preserving JSX class names is not enough unless the runtime has corresponding CSS.

### `src/installer/steps/05-setup-build/preclaim.ts`

Changes:
- Runs generated-screen fallback scan after Stitch HTML conversion and generated-screen validation.
- Sets `design_import_failure` when generated screens contain fallback icons.

Why:
- Setup-build should block before committing/building poisoned generated screens.

### `src/installer/steps/05-setup-build/guards.ts`

Changes:
- `onComplete` rechecks generated screen fallback icons when `failure_category` is `design_import_failure`.
- A passing build can no longer clear a still-real generated design import defect.

Why:
- This closes the path observed in run #248 where setup-build completed after a preclaim blocker.

### `src/installer/steps/06-implement/guards.ts`

Changes:
- Exported generated-screen fallback detection.
- Runtime semantic gate now treats generated `BadgeHelp` as a hard failure.
- `Circle` remains guarded only near semantic icon text to avoid false positives from SVG internals.

Why:
- Implement should not complete against degraded generated screens, but the primary fix is to push this failure earlier into setup-build.

### `src/installer/product-supervisor.ts`

Changes:
- Added generic product surface terms: `item`, `items`, `entity`, `entities`, `resource`, `resources`.
- Generic labels are allowed only when the surface purpose still traces to the requested domain.

Why:
- Avoid false plan failures while preserving drift protection.

### Tests

Updated or added:
- `tests/stitch-to-jsx.test.ts`
- `tests/steps/05-setup-build.test.ts`
- `tests/steps/06-implement.test.ts`
- `tests/quality-gates.test.ts`
- `tests/product-supervisor.test.ts`

Coverage added:
- Common cross-domain Material Symbols convert to semantic lucide icons.
- Unknown Material Symbols fail conversion with `UNKNOWN_MATERIAL_ICONS`.
- Stitch token classes from `design-tokens.css` generate runtime CSS for dark, hover, color, spacing, radius, and font utilities.
- Setup-build does not clear design import failure while generated fallback icons remain.
- Implement/runtime semantic gate catches generated fallback icons.
- Product supervisor accepts generic item labels when domain traceability is preserved.

## Verification

Commands run:

```bash
node --test tests/stitch-to-jsx.test.ts tests/steps/05-setup-build.test.ts tests/steps/06-implement.test.ts tests/quality-gates.test.ts tests/product-supervisor.test.ts
```

Result:
- 129 tests passed.

Additional focused checks after the Stitch token fix:

```bash
node --test tests/stitch-to-jsx.test.ts
```

Result:
- 20 tests passed.

```bash
node --import tsx --test tests/steps/05-setup-build.test.ts tests/steps/06-implement.test.ts tests/supervisor.test.ts
```

Result:
- 109 tests passed.

```bash
SETFARM_ALLOW_DIRTY_BUILD=1 npm run build
```

Result:
- Build passed.

Manual converter proof against the TurnOps sample:

```bash
node scripts/stitch-to-jsx.mjs /tmp/turnops-converter-check
rg -n "dark \\.dark\\\\:hover\\\\:bg-surface-container-high|hover\\\\:bg-surface-container-high:hover|\\.bg-surface \\{" /tmp/turnops-converter-check/src/index.css
```

Result:
- Runtime CSS now includes token-backed `bg-surface`, `hover:bg-surface-container-high:hover`, and `.dark .dark:hover:bg-surface-container-high:hover` rules.

Visual audit evidence:
- Stitch source screenshot: `/Users/setrox/.openclaw/workspaces/workflows/feature-dev/agents/supervisor/story-worktrees/db1b2ea0-us-003/stitch/ad635ff380fd4568b7a8f13dd10d102c.png`
- Pre-fix coded screenshot: `/tmp/setfarm-visual-audit-db1b2ea0/status-board.png`
- Finding: the coded screen was structurally related but rendered in default white/light styling because Stitch token classes had no generated CSS.

## Remaining Gaps

1. Need another fresh clean run after syncing the latest runtime.
   Expected behavior: if Stitch emits an unknown Material Symbol, setup-build fails early with the exact missing symbol list; if Stitch emits token classes, generated runtime CSS preserves the design theme.

2. Need a stack-pack strategy, not one-off app fixes.
   Vite React is currently the best covered path. Next.js, React Native/Expo, iOS, Android, and backend-heavy stacks need explicit stack evidence contracts, build/test/smoke commands, and generated source rules.

3. Need canonical design import diagnostics.
   `UNKNOWN_MATERIAL_ICONS` should eventually be persisted as structured evidence, not just stderr.

4. Need Mission Control live workroom to show all step operations.
   Each phase should expose running/pass/fail/retry/subtask events, story ownership, PR review state, and supervisor interventions in real time.

5. Need GitHub review comment lifecycle clarity.
   Story rows should show PR open, actionable comments, mergeable state, checks, latest commit, and whether review comments were actually addressed before merge.

6. Need QA step completion to be deterministic.
   The TurnOps validation produced a clean QA report and browser evidence, but the workflow spawned another `qa-test` worker instead of advancing. This wastes tokens and makes the user think the generated app is still broken when the actual issue is the step completion / worker lifecycle path.

7. Need browser-test tooling to match the installed environment.
   The QA prompt tells agents to use Python Playwright, but the local Python environment did not have the `playwright` package. The worker then fell back to agent-browser, but its local `agent-browser skills get core` instruction was stale because the installed CLI did not support that subcommand. Tool contracts must be generated from available tools, not assumed.

## TurnOps Run #255 Findings

Run:
- ID: `db1b2ea0-1e36-47ce-bff6-50354ab640cf`
- Project: `/Users/setrox/projects/turnops-console-db1b2ea0`
- Task: TurnOps Console, airport ground operations turn management app
- Final handling: run was manually stopped after collecting enough evidence because `qa-test` kept re-claiming work.

What worked:
- `plan`, `design`, `stories`, `setup-repo`, `setup-build`, `implement`, `verify`, `supervise`, and `security-gate` reached done.
- Six stories were complete and verified:
  - `US-001`
  - `US-002`
  - `US-003`
  - `QA-FIX-001`
  - `QA-FIX-002`
  - `QA-FIX-003`
- QA found real routing/deep-link issues earlier, routed them through QA fix stories, and those fixes were verified.
- A focused browser pass after QA fixes covered 4 screens, 4 routes, and 12 interactions with 0 issues.
- Quality report exists at `/Users/setrox/projects/turnops-console-db1b2ea0/quality-reports/qa-test-1.md`.

What still failed systemically:
- The run did not naturally advance past `qa-test` even after a clean QA report.
- The later QA worker repeated browser testing and hit environment/tooling mismatches rather than product defects.
- The QA agent used `npm run dev`, which moved to a new port when the expected port was occupied. That increases nondeterminism.
- Some icon-only generated buttons still have weak accessible names in browser snapshots. This is a converter/accessibility contract issue, not a TurnOps-specific issue.
- Forced `workflow stop --force` changed the final status view to show multiple already-finished later steps as cancelled. Stop/cancel needs to preserve prior completed evidence and distinguish "cancelled after evidence capture" from "never successfully completed".

Decision:
- Treat TurnOps as useful evidence, not as a run to wait on forever.
- Stop broad random project runs until the QA completion and stack-tooling contracts are fixed.

## Why This Will Not End With One-Off Fixes

The repeated failures are not mainly domain failures. ReturnFlow, ClinicFlow, DispatchGrid, WarehouseOps, YardPulse, and TurnOps exposed different symptoms, but the underlying categories repeat:

- Design import semantics: icons, tokens, routes, actions, and component contracts must be preserved.
- Stack runtime contract: each stack needs known build/test/dev/preview/smoke commands and known app entry conventions.
- Interaction contract: generated screens must expose named actions, accessible names, route metadata, and test hooks.
- Step lifecycle contract: a step must move from running to done/fail exactly once after structured output is accepted.
- Tooling contract: prompts must only instruct agents to use installed tools and packages.
- Mission Control contract: every sub-operation must be visible while it happens.

Therefore the next work should be platform infrastructure, not more sample-app patching.

## Stack-Pack Strategy

Model each target platform as a stack pack. A stack pack should define:

- scaffold command and expected file layout
- allowed package manager and lockfile behavior
- build command
- unit/integration test command
- dev or preview server command
- browser/mobile smoke runner
- app root selectors and route-state probe
- allowed generated-source patterns
- accessibility naming expectations
- screenshot/visual diff capture
- failure categories that should route back to plan/design/setup/implement/verify

Initial priority:

1. `vite-react-web`
   Current main path. Needs deterministic preview smoke, generated CSS token utilities, action wiring, accessible icon buttons, and route hydration proof.

2. `nextjs-web`
   Needs official Next.js app router/pages router detection, `next build`, `next lint` or replacement, route smoke, server/client component constraints, and metadata/static asset handling.

3. `react-native-expo`
   Needs Expo/Metro commands, native-device-independent smoke, Maestro or RN test strategy, safe area/layout constraints, and mobile accessibility labels.

4. `ios-native`
   Needs Xcode scheme discovery, simulator build/run/test, SwiftUI/AppKit rules, accessibility identifiers, and screenshot smoke.

5. `android-native`
   Needs Gradle project detection, emulator install/run/test, logcat capture, Maestro/UIAutomator smoke, and Material component conventions.

6. backend/API stacks
   Needs service health, OpenAPI/contract tests, DB migration evidence, integration tests, and deployment readiness gates.

## Next Root Fix Plan

Do these before more production-like runs:

1. QA completion/lifecycle fix.
   Reproduce why `qa-test` reclaims after `STATUS: done`; add a regression test around `step complete` and output file ingestion for QA steps.

2. Tool availability contract.
   Claim summaries should tell QA agents whether Python Playwright is installed. If not, prompts should use agent-browser or the app's own test runner directly.

3. Deterministic preview runner.
   Add a Setfarm-owned browser smoke helper that starts the right server, picks a known port, waits for readiness, captures console/page errors, closes cleanly, and emits structured JSON.

4. Generated action/accessibility contract.
   Converter should add deterministic `aria-label` / action metadata for icon-only buttons based on UI_CONTRACT action labels. QA should fail unlabeled interactive controls at setup/verify level.

5. Stack-pack registry.
   Replace scattered stack assumptions with one registry that covers Vite React first, then Next.js, Expo, iOS, Android, and backend/API stacks.

6. Mission Control operation timeline.
   Persist every sub-operation as structured events: command start/end, route checked, screenshot captured, PR comment found/fixed, retry reason, and ownership transfer.

7. Stop/cancel semantics.
   `workflow stop --force` should only cancel currently active and future steps, and should not overwrite completed step state. The UI should show a clear stop reason and retain all previously passed evidence.

8. Review packet to Gemini/Sonnet.
   Use this document as the prompt context and ask for architecture blind spots before expanding to more stacks.

## Suggested Second-Model Prompt

Use this prompt with Gemini/Sonnet:

```text
You are reviewing Setfarm, an autonomous multi-agent app generation pipeline.

Please review the attached root-fix packet. The goal is system-level robustness, not project-specific patches.

Questions:
1. Are the current fixes sufficient to prevent generated design defects from leaking into implement/verify?
2. Is failing `stitch-to-jsx` on unknown Material Symbols the right default, or should the converter use a deterministic broader fallback strategy?
3. What structured evidence should be persisted so Mission Control can show live root-cause state?
4. How should stack-specific rules be modeled for Vite React, Next.js, React Native/Expo, iOS, Android, and backend-heavy projects without hardcoding per-project behavior?
5. What blind spots remain in the plan/design/stories/setup/implement/verify/security/qa/final/deploy chain?

Please answer with:
- Critical risks
- Recommended architecture changes
- Missing tests
- Which fixes should be implemented before the next production-like run
- Which fixes can wait
```

## Current Recommendation

Do not start broad domain-specific repair work. First fix QA completion/lifecycle and tool availability, then run one fresh `vite-react-web` project. If that run is stable, promote the same contract into stack packs for Next.js, Expo, iOS, Android, and backend/API work. More random domain runs before this will mostly produce more symptoms, not a stable platform.
