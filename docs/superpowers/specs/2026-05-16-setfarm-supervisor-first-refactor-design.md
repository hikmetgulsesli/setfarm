# Setfarm Supervisor-First Refactor Design

Date: 2026-05-16

## Summary

Setfarm currently relies on many fatal guards to correct agent behavior. This has made runs brittle: a worker can be killed for quality or context issues that should be managed by a project supervisor, and repeated guard additions have created overlapping rules that are hard to reason about.

This refactor moves Setfarm to a supervisor-first operating model:

- Fatal guards protect the platform and deterministic execution only.
- Product quality is managed by isolated project-run supervisors.
- DOM extract data becomes a checklist and evidence system, not only a late fatal gate.
- Supervisors can inject live instructions into the active worker session.
- If a worker cannot fix an issue, a stronger architect/fixer supervisor can change model or apply a scoped patch.
- Every project/run stays isolated in its own worktree, sessions, state, and logs.

The main supervisor model is Codex. Kimi and Minimax are supported as fallback providers through a model policy interface. No unavailable provider is hardcoded into the design.

## Current Problems

1. Guard sprawl

   Setfarm has accumulated fatal guards for build, scope, git, raw context reads, generated screen reads, DOM icon mismatches, retry discipline, no-delta stalls, traceability drift, and more. Some protect the platform; others are product review opinions. They currently share the same kill/retry pathway.

2. Quality is handled too late

   DOM extract mismatches are discovered after the worker reports done. The system often retries or kills instead of guiding the active worker while context is still warm.

3. Supervisor is too passive

   Supervisor exists as a checkpoint, but it does not yet behave like a project manager that tracks open work, injects corrections, verifies the fix, and escalates when the worker fails.

4. Context rules fight comprehension

   Some guards prevent broad reads to avoid context overload, but the result can be that agents lack enough local understanding to fix real code quality issues. The new approach should preserve isolation while allowing targeted code context.

5. Parallel projects need strict isolation

   Running 5-10 projects in parallel must not mean one model session knows or edits multiple projects. Each run needs its own supervisor, workers, worktree, checklist, state, and model sessions.

## Goals

- Replace guard-driven retry loops with supervisor-managed correction loops.
- Keep fatal guards only for deterministic system protection.
- Convert DOM extract controls into explicit checklist items.
- Persist per-run supervisor state so the system does not forget decisions.
- Allow supervisors to inject live instructions into worker sessions.
- Allow architect/fixer supervisors to use Codex by default and Kimi/Minimax as fallbacks.
- Ensure all coding happens directly in the assigned project/story worktree.
- Support many parallel projects without cross-project context contamination.
- Make runtime version and commit identity visible and reliable.
- Add tests that lock the new guard taxonomy, checklist, state, scanner, and intervention behavior.

## Non-Goals

- Do not make a single global supervisor read all project code.
- Do not let workers stage, commit, push, or create PRs.
- Do not let workers edit outside their assigned project/story worktree.
- Do not hardcode unavailable model providers.
- Do not store complete source code snapshots in supervisor memory.
- Do not use project-specific guard rules such as "Tetris Help button must exist" in platform code.

## Core Decisions

### 1. Supervisor-First Policy

The default response to incomplete product work is:

```text
observe -> compare -> assign -> inject -> verify -> close/escalate
```

The default response is not kill/retry.

Fatal guards remain for system safety and deterministic failures. Product completeness issues become supervisor blockers or warnings.

### 2. Strict Project Isolation

Every project/run has:

- One project-run supervisor session.
- One project worktree or run worktree.
- Separate story worker sessions.
- Separate supervisor checklist, state, and events.
- Separate transcripts and evidence records.
- Separate model provider selection.

No session handles multiple projects. No worker reads another project directory. No supervisor shares detailed project context across runs.

### 3. Coding Happens In The Assigned Worktree

Workers do not create code in a temporary directory and move it into the project.

The spawner resolves a claim workdir, creates the claim summary, and starts the worker with `cwd` set to the resolved worktree. All source reads and edits happen directly inside that worktree. This remains the required implementation model.

### 4. Memory Means Verified State, Not Full Code

Supervisors do not memorize all source code. They keep:

- Required checklist items.
- Observed evidence.
- Open blockers and warnings.
- Interventions and results.
- Focused file references.
- Recent diffs and scan summaries.

When deeper context is needed, the architect/fixer reads targeted files in the same project/story worktree.

### 5. Dual Supervisor Model

Setfarm uses two supervisor roles.

#### Sentinel Supervisor

The sentinel supervisor is the always-on project-run watcher.

Responsibilities:

- Load or create `SUPERVISOR_CHECKLIST.json`.
- Update `SUPERVISOR_STATE.json`.
- Append to `SUPERVISOR_EVENTS.jsonl`.
- Watch worker transcript, active claim, scope files, diff, scanner output, build/test output, and smoke evidence.
- Inject live correction messages into the active worker session.
- Verify whether the worker actually fixed the item.

The sentinel does not perform broad architectural edits.

#### Architect/Fixer Supervisor

The architect/fixer is invoked when judgment or repair is needed.

Default model: Codex.

Fallback models: Kimi, Minimax.

Responsibilities:

- Build enough focused context to understand the bug.
- Review checklist, state, evidence, worker transcript, recent diff, and relevant code.
- Decide whether to reinstruct, switch model, or apply a scoped patch.
- Apply small scoped fixes when policy allows.
- Run scanner/build/test after a fix.
- Update supervisor state with evidence.

## Architecture

Add a dedicated supervisor module:

```text
src/installer/supervisor/
  coordinator.ts
  run-supervisor.ts
  checklist.ts
  state.ts
  scanner.ts
  intervention.ts
  model-policy.ts
  fixer.ts
  types.ts
```

### `coordinator.ts`

Global lightweight coordinator.

It manages operational metadata only:

- active run ids
- supervisor session ids
- run status
- heartbeat
- active worker counts
- active fixer counts
- provider availability
- stuck run detection
- restart/resume decisions

It does not read project code or DOM checklist details.

### `run-supervisor.ts`

Per-run supervisor loop.

Responsibilities:

- Resolve the project/run worktree.
- Load checklist and state.
- Poll worker sessions and claims.
- Request scans.
- Compute open blockers and warnings.
- Create interventions.
- Escalate to architect/fixer when needed.

### `checklist.ts`

Builds the expected work list from stable project inputs:

- PRD
- design summary
- `stitch/UI_CONTRACT.json`
- `stitch/DESIGN_DOM.json` or normalized DOM extract
- `src/screens/SCREEN_INDEX.json`
- story records and scope files
- deploy/domain contract
- QA expectations

Checklist items are not project-specific code rules. They are data produced from each project's own inputs.

### `state.ts`

Reads and writes supervisor state.

Recommended state location:

```text
.setfarm/supervisor/<runId>/SUPERVISOR_CHECKLIST.json
.setfarm/supervisor/<runId>/SUPERVISOR_STATE.json
.setfarm/supervisor/<runId>/SUPERVISOR_EVENTS.jsonl
```

If a story worktree is used, the same run id is still used so state remains tied to the project-run, not to an individual worker attempt.

### `scanner.ts`

Deterministic evidence generation.

Initial scanners:

- static control scan
- handler scan
- href scan
- malformed URL scan
- icon scan
- diff scan
- build result adapter
- test result adapter
- optional browser DOM scan

Scanner output feeds state. Model opinion alone never closes a checklist item.

### `intervention.ts`

Creates and delivers live supervisor instructions to the active worker session.

Intervention messages are short, exact, and tied to checklist item ids. They are written to supervisor events and linked to the worker session.

Example:

```text
SUPERVISOR_INTERVENTION:
US-003 is not complete.
Open blocker: dom:GameOptions:button:help
GameOptions must include a visible Help button wired to openHelp.
Only edit scoped files:
- src/screens/GameOptions.tsx
Do not report STATUS: done until this item passes scanner evidence.
```

### `model-policy.ts`

Selects provider/model for architect/fixer work.

Initial policy:

- Use Codex for complex context, architecture, many-file reasoning, and first fixer attempt.
- Use Kimi or Minimax when Codex session/context fails, the same blocker remains unresolved after repeated attempts, or a second model opinion is useful.
- Keep provider selection data-driven and configurable.

### `fixer.ts`

Applies scoped supervisor fixes.

Rules:

- Operates only in the assigned project/story worktree.
- Edits only files tied to open blockers and allowed scope.
- Does not stage, commit, push, or open PRs.
- Runs scanner/build/test after edits.
- Records evidence and state changes.

## Data Contracts

### Checklist

`SUPERVISOR_CHECKLIST.json`

```json
{
  "schema": "setfarm.supervisor-checklist.v1",
  "runId": "736",
  "projectSlug": "example-project",
  "sourceCommit": "abc123",
  "items": [
    {
      "id": "dom:GameOptions:button:help",
      "storyId": "US-003",
      "screen": "GameOptions",
      "scopeFiles": ["src/screens/GameOptions.tsx"],
      "type": "button",
      "label": "Help",
      "icon": "help",
      "action": "openHelp",
      "severity": "blocker",
      "evidenceRequired": ["static-control", "handler"]
    },
    {
      "id": "dom:GameOptions:icon:back",
      "storyId": "US-003",
      "screen": "GameOptions",
      "scopeFiles": ["src/screens/GameOptions.tsx"],
      "type": "icon",
      "label": "Back to Menu",
      "icon": "arrow_back",
      "severity": "warning",
      "evidenceRequired": ["static-control"]
    }
  ]
}
```

Severity rules:

- Missing button, link, input, select, nav item, form, or dialog required by DOM extract: blocker.
- Active button with no handler, submit behavior, disabled state, or explicit inert state: blocker.
- Active link with dead, malformed, or missing href: blocker.
- Icon-only control missing its icon: blocker.
- Labeled control missing expected icon: warning.
- Exact label mismatch where the control is still discoverable and functional: warning.
- Style or micro fidelity mismatch: warning.
- Screen count or domain drift: warning unless it breaks route/story ownership.

### State

`SUPERVISOR_STATE.json`

```json
{
  "schema": "setfarm.supervisor-state.v1",
  "runId": "736",
  "projectStatus": "implementing",
  "stories": {
    "US-003": {
      "status": "blocked",
      "currentWorker": "feature-dev_developer",
      "attempt": 2,
      "openBlockers": ["dom:GameOptions:button:help"],
      "warnings": ["dom:GameOptions:icon:back"],
      "resolved": ["dom:GameOptions:button:save-close"],
      "lastEvidenceAt": "2026-05-16T12:40:00+03:00"
    }
  },
  "evidence": {
    "dom:GameOptions:button:help": {
      "status": "missing",
      "observed": [],
      "lastScan": "static-control-scan",
      "files": ["src/screens/GameOptions.tsx"]
    }
  },
  "interventions": [
    {
      "storyId": "US-003",
      "itemId": "dom:GameOptions:button:help",
      "targetWorker": "feature-dev_developer",
      "type": "live-instruction",
      "message": "GameOptions Help button missing. Add visible button and openHelp handler before done.",
      "result": "pending"
    }
  ]
}
```

### Events

`SUPERVISOR_EVENTS.jsonl`

Each event is append-only:

```json
{"ts":"2026-05-16T12:40:00+03:00","runId":"736","storyId":"US-003","type":"blocker-opened","itemId":"dom:GameOptions:button:help","source":"scanner"}
{"ts":"2026-05-16T12:41:00+03:00","runId":"736","storyId":"US-003","type":"intervention-sent","itemId":"dom:GameOptions:button:help","targetWorker":"feature-dev_developer"}
{"ts":"2026-05-16T12:44:00+03:00","runId":"736","storyId":"US-003","type":"blocker-resolved","itemId":"dom:GameOptions:button:help","evidence":["static-control","handler","build-pass"]}
```

## Guard Taxonomy

All existing guard behavior should be classified into one of three categories.

### Hard Guard

Hard guards can fail, kill, or block a claim.

Allowed hard guards:

- platform cwd safety
- workdir missing
- project/run write isolation
- story scope write isolation
- worker git staging/commit/push/branch discipline
- build failure
- touched test failure
- malformed deploy URL
- active button/link that is deterministically broken
- dead active href

### Supervisor Signal

Supervisor signals do not kill the worker immediately. They update supervisor state and may trigger live intervention or escalation.

Examples:

- missing DOM control
- missing DOM link/input/select/nav item
- DOM icon mismatch
- exact label mismatch
- screen count drift
- domain/traceability drift
- optional module drift
- raw Stitch read
- generated screen shared read
- full reference read
- context sprawl
- claim parse loop
- first-delta discipline violation
- no-delta stall
- scope overflow that remains inside the same project/run

### Prompt Hint

Prompt hints influence worker instructions but do not directly block anything.

Examples:

- prefer summary before raw claim
- keep reads focused
- implement all DOM extract controls
- keep labels close to design
- do not use icon fonts
- preserve design tokens

## Runtime Behavior

### Worker Done Flow

When a worker reports done:

1. Hard guards run.
2. Scanner runs.
3. Supervisor state updates.
4. If hard guard fails, the claim fails or retries through the existing deterministic path.
5. If supervisor blockers remain, the story is not accepted as complete.
6. The supervisor injects a live instruction into the active worker if possible.
7. If the worker cannot resolve the blocker, architect/fixer escalation starts.

### Live Intervention Flow

For each open blocker:

1. Build a short exact instruction from checklist item and evidence.
2. Send it to the active worker session.
3. Record `intervention-sent`.
4. Wait for source delta or worker response.
5. Rescan.
6. If resolved, close item.
7. If unresolved after configured attempts, escalate.

### Escalation Flow

Escalate when:

- the same blocker remains after two interventions,
- worker reports done while blockers remain,
- worker creates new blockers while fixing,
- worker breaks build/test,
- worker session stalls,
- supervisor cannot make a confident decision from scanner evidence.

Escalation actions:

1. Switch worker/fixer model according to policy.
2. Invoke architect/fixer with focused context.
3. Apply scoped patch if policy allows.
4. Run scanner/build/test.
5. Update state and events.

## Parallel Runs

Setfarm supports multiple active projects by isolating run state.

Example:

```text
run-741/
  supervisor-session-741
  worker-session-US001
  worker-session-US002
  project-worktree
  .setfarm/supervisor/741/

run-742/
  supervisor-session-742
  worker-session-US001
  worker-session-US002
  project-worktree
  .setfarm/supervisor/742/
```

The global coordinator may manage 5, 10, or more runs based on configuration, but it does not merge their contexts.

Initial configuration shape:

```json
{
  "maxConcurrentRuns": 10,
  "maxActiveWorkersTotal": 20,
  "maxArchitectFixers": 2,
  "maxLiveInterventionsPerRun": 3,
  "maxFixAttemptsPerItem": 2,
  "providerPriority": ["codex", "kimi", "minimax"]
}
```

## Integration Points

### `src/installer/steps/06-implement/guards.ts`

Refactor:

- Keep build/test/scope/git/deterministic interaction hard guards.
- Move general `DESIGN_DOM_IMPLEMENTATION_MISMATCH` behavior into supervisor checklist/state.
- Keep active broken interaction detection as a hard guard only when deterministic.

### `src/spawner.ts`

Refactor:

- Keep platform cwd, workdir missing, git discipline, and write isolation hard guards.
- Convert raw Stitch read, generated screen read, full reference read, context sprawl, claim parse loop, first-delta, and no-delta stall from immediate kill paths into supervisor signals.
- Preserve event recording so supervisor has evidence.

### `src/spawner-prompt.ts`

Refactor:

- Add supervisor checklist paths to claim summary.
- Tell workers to implement all scoped checklist blockers before done.
- Keep instructions short and focused.
- Remove retry language that treats icon/label mismatches as fatal implementation blockers.

### `src/installer/product-supervisor.ts`

Refactor:

- Keep deterministic malformed URL and active broken control checks.
- Move traceability and drift findings into supervisor warnings.
- Route project quality findings into supervisor state rather than direct workflow failure.

### `workflows/feature-dev/agents/supervisor`

Refactor:

- Update supervisor identity to match project-run manager behavior.
- Define live intervention, evidence verification, and escalation responsibilities.
- Remove wording that implies supervisor is only a late reviewer.

## Versioning

The refactor must keep runtime identity clear.

Requirements:

- Build metadata includes commit hash.
- Dashboard/runtime status shows version plus commit.
- Each platform commit that changes runtime behavior should update visible build metadata.
- Tests verify version/build metadata generation.

This prevents confusion where runtime appears stuck at a generic `2.1.0`.

## Testing Strategy

Unit tests:

- guard taxonomy classification
- checklist generation from DOM extract
- severity classification
- state read/write/update
- scanner output for buttons, links, inputs, icons, handlers, malformed hrefs
- model policy fallback selection
- intervention message creation

Integration tests:

- worker done with missing DOM button creates supervisor blocker, not fatal guard failure
- labeled missing icon creates warning, not blocker
- icon-only missing icon creates blocker
- active button without handler remains hard failure
- active dead href remains hard failure
- raw Stitch/generated screen/context-sprawl records supervisor signal instead of kill
- supervisor intervention closes item only after scanner evidence
- architect/fixer can patch within allowed scope only
- parallel run state does not cross-contaminate

Sensor runs:

- one browser game project
- one dashboard/app project
- each run must produce checklist, state, interventions if needed, and final closed blockers

## Acceptance Criteria

- Fatal guard list is documented and enforced through a centralized policy.
- DOM extract creates a project-specific checklist without adding project-specific platform code.
- Worker incompleteness creates supervisor blockers/warnings.
- Worker is not killed for non-fatal quality issues.
- Supervisor can inject correction instructions into an active worker session.
- Supervisor verifies fixes with deterministic evidence.
- Architect/fixer can use Codex by default and Kimi/Minimax through policy.
- Every run has isolated supervisor state and sessions.
- No model session manages multiple project codebases at once.
- Runtime version/commit identity is visible after build/restart.
- Tests cover guard simplification, supervisor state, checklist, scanner, intervention, and isolation.

## Rollout Plan

This is a full refactor, but it should be merged in coherent slices that all serve the final design.

1. Add supervisor module types, state, checklist, scanner, and tests.
2. Add guard taxonomy and convert non-fatal quality/context kills to supervisor signals.
3. Wire implement completion to update supervisor state.
4. Add live intervention delivery.
5. Add architect/fixer model policy and scoped fix path.
6. Update prompts and workflow supervisor identity.
7. Add version/build metadata assertions.
8. Run unit/integration tests.
9. Run game and app sensor projects.

Each slice must preserve the architecture above; no temporary project-specific guard patches are accepted.

## Open Implementation Notes

- The session injection transport must use the currently available OpenClaw session mechanism. If direct injection is unavailable, the implementation must introduce a Setfarm-managed intervention queue consumed by the worker prompt/session loop.
- Supervisor state should be recoverable after daemon restart.
- Existing supervisor memory should be migrated into state/events without losing useful context.
- The first implementation pass should prioritize correctness and isolation over cost optimization.
