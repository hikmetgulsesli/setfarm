# Universal Agent Inner Dev Loop + Live Evidence Pipeline

## Problem

Setfarm can currently complete generated projects that build, smoke, and pass QA while still being semantically wrong. Recent browser-game runs showed the failure clearly: runtime score/state changed, but visible gameplay objects did not move; settings screens replaced the gameplay scene instead of proving overlay behavior. Adding one more browser-game-specific rule helps one failure class, but it does not scale to Android, iOS, API, CLI, or future app types.

The platform must stop asking agents to self-certify correctness. Agents may propose what should be verified, but Setfarm must execute, observe, judge, and record evidence.

## Design Goal

Every implementation story follows a universal loop:

```text
understand -> declare intent -> code -> request verification -> orchestrator runs -> evidence gate -> fix/retry or pass
```

The loop is stack-agnostic. Stack packs provide runtime capabilities; generic Setfarm code consumes those capabilities without embedding project-specific rules.

## Core Principle

Agent output is a claim. Setfarm evidence is authority.

Agents do not mark stories correct by saying they tested them. Agents produce structured verification requests. The orchestrator starts the runtime, executes interactions, captures screenshots/DOM/state/logs, writes artifacts, records `run_observations`, and decides whether completion is allowed.

## Runtime Driver Interface

Setfarm introduces a stack-owned runtime driver contract:

```ts
interface RuntimeDriver {
  start(context: StoryRuntimeContext): Promise<RuntimeSession>;
  waitReady(session: RuntimeSession): Promise<void>;
  interact(session: RuntimeSession, action: InteractionRequest): Promise<InteractionResult>;
  captureState(session: RuntimeSession): Promise<CapturedRuntimeState>;
  stop(session: RuntimeSession): Promise<void>;
}
```

Initial implementation is Vite React / browser runtime using Playwright and MC-owned ports. Future Android, iOS, API, and CLI drivers implement the same interface through emulator, simulator, HTTP, or process capture capabilities.

## Artifacts

### `IMPLEMENT_INTENT.json`

Written before coding. Setfarm validates it against the story contract before broad edits proceed.

Required fields:

- `schema: "setfarm.implement-intent.v1"`
- `storyId`
- `storyType`: `ui_interactive | ui_static | api_endpoint | cli_command | background_service | data_migration`
- `acceptanceCriteria[]`
- `boundSurfaces[]`
- `boundActions[]`
- `boundDataEntities[]`
- `runtimeEvidenceRequired`

### `IMPLEMENT_VERIFICATION_REQUEST.json`

Written after coding. This is not a success report. It tells Setfarm which flows to execute.

Required fields:

- `schema: "setfarm.implement-verification-request.v1"`
- `storyId`
- `status: "ready_for_orchestrator_verification"`
- `interactionRequests[]`
- `uncoveredCriteria[]`
- `knownGaps[]`

### `IMPLEMENT_EVIDENCE.json`

Written only by Setfarm.

Required fields:

- runtime session and allocated port
- command results
- interaction logs
- screenshot paths and timestamps
- DOM/accessibility snapshots where supported
- state bridge snapshots where supported
- visual evidence gate result
- final gate verdict

## Evidence Gate

Completion is blocked unless required evidence is present and mechanically valid.

Rollout control:

```text
SETFARM_IMPLEMENT_EVIDENCE_GATE=off|advisory|blocking
```

The gate defaults to `advisory` during rollout so existing agents can continue while MC exposes missing evidence. It becomes enforceable by switching to `blocking`.

Universal checks:

- artifact schemas are valid
- runtime port was allocated by Setfarm
- runtime started and stopped cleanly
- screenshots were captured inside the story runtime window
- claimed flows have corresponding artifacts
- required build/test commands passed
- `knownGaps` and `uncoveredCriteria` are explicit

Interactive UI checks:

- runtime screenshot is non-empty
- at least one state-changing flow was executed
- supported stacks expose a non-stale state bridge
- state bridge and screenshot timestamps advance across interactions

The evidence gate verifies evidence structure and runtime liveness. It must not grow into a project-specific checklist. Stack packs define capability-level requirements.

## Visual Evidence Gate

Visual evidence is a first-class gate from the beginning, not a forgotten future task.

Environment controls:

```text
SETFARM_VISUAL_EVIDENCE_GATE=off|advisory|blocking
SETFARM_VISUAL_EVIDENCE_PROVIDER=none|minimax|openai|anthropic
```

Modes:

- `off`: Setfarm writes `visualEvidence.status = "disabled"` and MC shows the gate as disabled.
- `advisory`: Setfarm runs visual/VLM review when configured, records pass/fail, but does not block completion.
- `blocking`: visual failure blocks story completion.

Initial rollout may default to `off` or `advisory`, but the artifact schema, config, MC row, and tests must exist immediately. This prevents the visual gate from becoming an undocumented "later" task.

## Mission Control

Mission Control shows an evidence filmstrip per active story:

```text
Intent declared
Runtime started: localhost:63xx
Build passed
Flow 1 executed: before/after thumbnails
Flow 2 executed: before/after thumbnails
Visual Evidence: disabled/advisory pass/blocking pass/fail
Evidence gate: pass/fail
Runtime stopped
```

Completed stories collapse to summary rows. The active story owns the live runtime focus. MC should not dump raw Playwright logs into the main view; raw logs remain available in the evidence drawer.

## Port And Process Lifecycle

Setfarm owns port allocation, runtime startup, and cleanup.

- Implement story runtime uses the existing MC-owned runtime port allocator.
- Vite/browser story evidence uses the preview band unless a future stack pack declares a different band.
- Story retry reuses or explicitly releases the previous session before allocating another.
- `try/finally` cleanup is mandatory.
- MC records `runtime.started`, `runtime.ready`, `runtime.stopped`, and `runtime.cleanup_failed` observations.

## Stack Evidence Contract

Stack packs expose capabilities instead of project-specific rules:

```ts
interface StackEvidenceContract {
  runtimeKind: "browser" | "emulator" | "simulator" | "process" | "none";
  runtimeReadinessProbe: "http_200" | "port_open" | "log_pattern" | "none";
  screenshotTool: "playwright" | "emulator_screenshot" | "simctl" | "none";
  stateBridgeTool: "window_app" | "adb_shell" | "xcrun_simctl" | "stdout" | "none";
  flowEvidenceType: "screenshot" | "http_response" | "log_artifact" | "stdout";
  minFlowsPerInteractiveStory: number;
  visualEvidenceSupported: boolean;
  preflightChecks: Array<{ label: string; command: string }>;
}
```

Generic pipeline code asks the stack pack for capabilities. It does not ask whether a project is a browser game, Android app, or iOS app.

## Agent Instructions

AGENTS.md must state:

- agents do not self-certify tests
- implement stories must emit intent and verification request artifacts when evidence is required
- Setfarm owns runtime execution and evidence
- visual evidence gate is controlled by env and always represented in artifacts/MC
- generated projects must expose stack-declared state bridges when required

## Rollout

### Phase 1: Web Foundation

- Define schemas for intent, verification request, and evidence.
- Add Vite React runtime driver using Playwright.
- Add evidence gate with schema, command, screenshot, timestamp, and runtime cleanup checks.
- Add visual evidence gate config and disabled/advisory/blocking artifact states.
- Add MC evidence filmstrip rows backed by `run_observations`.

### Phase 2: Interactive State

- Require stack-declared state bridge for `ui_interactive`.
- For Vite React, standardize `window.app` / `window.__SETFARM_TEST_BRIDGE__` enough to expose liveness, route/surface, and interaction state.
- Block stale interactive state when evidence requires motion/progress.

### Phase 3: Visual/VLM Judgement

- Wire configured VLM provider behind `SETFARM_VISUAL_EVIDENCE_GATE`.
- Compare before/after screenshots and design intent.
- Keep advisory mode available for calibration.
- Enable blocking only after several clean advisory runs.

### Phase 4: Other Stacks

- Add Android/iOS/API/CLI drivers through the same interface.
- Do not add stack-specific logic to generic step modules.

## Acceptance Criteria

- A story cannot complete based only on agent prose.
- Required evidence artifacts are versioned JSON and schema validated.
- MC shows the active runtime link and evidence timeline.
- Visual evidence is always represented as `disabled`, `advisory`, or `blocking`.
- Env can disable, observe, or enforce visual evidence without code changes.
- Runtime processes are stopped and ports are released after story completion/failure.
- Vite React runs can catch the class of failures where visible UI does not reflect runtime state.

## Non-Goals

- Do not implement Android/iOS evidence runners before Vite React is stable.
- Do not make VLM the only authority for correctness.
- Do not add project-specific gameplay/business rules to generic evidence gates.
- Do not allow agents to write their own final evidence verdict.
