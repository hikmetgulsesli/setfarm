# Setfarm Mission Control Live Operations Design

Date: 2026-05-24
Status: Proposed for review
Scope: Setfarm observability infrastructure and Mission Control run visibility

## Problem

Mission Control currently shows pipeline truth too late. A run can sit on `PENDING` or a coarse phase summary while agents are actively planning, fixing, testing, reviewing, resolving GitHub comments, and retrying. When a step finally completes, many checks flip to `PASS` at once. That hides the work, makes failures feel sudden, and prevents the operator from understanding what the agent company is doing in real time.

The target experience is a live operations room: from the top level the operator should see every pipeline lane, every active story, every retry, every blocker, every GitHub/reviewer/supervisor intervention, and representative examples of the actual fix work.

## Product Direction

Use a hybrid operations model.

- Keep the existing Mission Control shell, dark command-center style, top navigation, run detail page, and current Run Contract tab.
- Upgrade Run Contract into a live operations board.
- Show pipeline phases as top-level lanes: Plan, Design, Stories, Setup, Build, Implementation, Verify, Security Gate, QA, Final Test, Deploy.
- For story-based phases, especially Implementation and Verify, show nested story cards: US-001, US-002, US-003.
- Add a live detail/feed layer for agent actions, supervisor interventions, GitHub activity, file changes, test/build evidence, and retry loops.

Mission Control should answer three questions at a glance:

1. What is running right now?
2. What exactly passed, failed, retried, or is blocked?
3. What did the agents actually do to move the run forward?

## User Jobs

- When a run is active, I want to see each pipeline phase transition through `pending`, `running`, `pass`, `fail`, `retry`, or `blocked` as it happens, so I do not wait blindly.
- When a story is being implemented, I want to see its live subchecks and fix examples, so I know whether the developer is making real progress.
- When supervisor or GitHub feedback appears, I want to see the exact blocker/comment and the agent response, so I can trust the retry loop.
- When a run fails, I want to know the current root blocker, the last successful checkpoint, and what must happen next.

## Observation Model

Add a durable observation stream in Setfarm. This is separate from final contract evidence. Contract evidence answers "is the run valid"; observations answer "what is happening right now".

### Table: `run_observations`

Fields:

- `id`: UUID primary key
- `run_id`: UUID, required
- `step_id`: text, required
- `story_id`: text, nullable
- `agent_id`: text, nullable
- `phase`: text, required
- `check_id`: text, required
- `label`: text, required
- `status`: enum text: `pending`, `running`, `pass`, `fail`, `retry`, `blocked`, `info`
- `summary`: text, short human-readable message
- `evidence`: text, optional detailed evidence
- `file_paths`: JSON array of file paths
- `github`: JSON object with PR/comment/thread/check URLs or IDs
- `metadata`: JSON object for structured details
- `started_at`: timestamptz, nullable
- `completed_at`: timestamptz, nullable
- `created_at`: timestamptz, required
- `updated_at`: timestamptz, required

Uniqueness:

- `(run_id, step_id, story_id, check_id)` should upsert the latest state for stable checks.
- A separate append-only event log can be derived from updates or added later if timeline fidelity needs every transition.

### API Shape

Mission Control should consume:

- `GET /api/setfarm/runs/:id/operations`

Response:

- run summary
- phases
- stories
- observations grouped by phase/story/check
- recent activity feed
- active blockers
- active retries
- latest agent outputs

Initial implementation may use polling. WebSocket/SSE can follow after the data model is stable.

## Checkpoint Coverage

Every pipeline phase should emit observations. The first implementation should cover the most operator-visible checkpoints, then expand.

### Plan

- plan claimed
- PRD captured
- product surfaces detected
- stack/language declared
- guardrail drift check
- plan completed

### Design

- Stitch project ensured
- generation started
- screen batch progress
- HTML downloaded
- screenshots downloaded
- DESIGN.md captured
- UI contract extracted
- design completed

### Stories

- story decomposition started
- each story created
- scope files assigned
- implementation contract validated
- ownership/deferred screen check
- stories completed

### Setup And Build

- repo scaffolded
- dependencies installed
- generated screens imported
- build command detected
- build artifact produced
- setup/build completed

### Implementation

For each story:

- story claim started
- retry active, with retry number and previous blocker
- files touched
- scope check running/pass/fail
- build running/pass/fail
- tests running/pass/fail
- supervisor scan running/pass/fail
- examples of fixes, including file paths and concise diff summaries
- PR creation, GitHub checks, review comments, thread resolution, merge status
- story verified or blocked

### Verify

- reviewer claimed
- build/test/lint evidence checked
- PR comments fetched
- GitHub review threads classified
- outdated/resolved thread cleanup
- merge attempted
- post-merge build checked
- story verified

### Security, QA, Final Test, Deploy

- step claimed
- checks started
- checks pass/fail
- blocker created when failed
- deploy started/pass/fail

## Mission Control UI

### Run Contract: Live Operations Mode

The current Run Contract view should become a richer board, not a full replacement of Mission Control.

Layout:

- Top strip: run health, current phase, active story, active agent, retry count, blocker count.
- Phase rail: each pipeline phase card shows status, pass/fail/pending counts, elapsed time, and retry badge.
- Main grid: phase sections with live observations.
- Implementation section: nested story cards.
- Right drawer or bottom pane: live feed and selected item details.

### Story Card

Each story card shows:

- story id and title
- status
- retry count with visible retry badge
- current agent
- current blocker, if any
- check chips: scope, files, build, tests, supervisor, PR, GitHub, merge
- latest fix example

Hover or click opens detail:

- chronological activity for that story
- files changed
- build/test output excerpts
- supervisor blocker text
- GitHub PR/comment/thread links
- last agent summary

### Live Feed

The live feed should be filtered by selected phase/story but default to the whole run.

Example feed items:

- `feature-dev_developer started US-002 retry 1`
- `scope check failed: store.ts outside scope`
- `developer edited VehicleOperationsFleetpulseMatrixV2r8.tsx`
- `build passed: npm run build`
- `supervisor opened blocker: static button Fleet Manager`
- `GitHub review thread resolved: PRRT_...`
- `US-001 merged: PR #1`

### Status Semantics

- `pending`: expected but not started
- `running`: active work/check in progress
- `pass`: completed successfully
- `fail`: completed unsuccessfully
- `retry`: failed but has an active retry path
- `blocked`: cannot progress without code/policy/state change
- `info`: contextual event that is not a gate

Retry should be visually distinct from fail. A retry badge must show retry number and max retries when known.

## Data Flow

1. Step starts or preclaim begins.
2. Setfarm calls `recordObservation(...)` with `running`.
3. Each internal guard/check emits `running`, then `pass` or `fail`.
4. Agent transcript summaries and step outputs emit `info` observations for meaningful work.
5. Supervisor emits blockers and resolutions as observations.
6. GitHub PR/comment/thread checks emit observations with GitHub metadata.
7. Mission Control polls `/operations` and renders changes immediately.

## Implementation Architecture

### Setfarm

Add:

- migration/provisioning for `run_observations`
- helper module `src/installer/observations.ts`
- `recordObservation`
- `recordObservationPass`
- `recordObservationFail`
- `recordObservationInfo`
- `recordObservationRetry`

Integrate first into:

- step claim/start completion path
- implement scope/build/test/supervisor gates
- verify GitHub/PR checks
- design preclaim progress
- stories guard progress

Then expand to all remaining steps.

### Mission Control Server

Add:

- route for `/api/setfarm/runs/:id/operations`
- aggregation logic that joins runs, steps, stories, observations, and existing activity events
- lightweight normalization so UI does not parse raw Setfarm output strings

### Mission Control Frontend

Add:

- `LiveOperationsBoard`
- `PhaseLane`
- `StoryOpsCard`
- `ObservationChip`
- `RetryBadge`
- `LiveOpsFeed`
- `ObservationDetailDrawer`

Keep the existing `InlinePlanView` tabs. Add a new first-class tab or section named `LIVE OPS` or upgrade `CONTRACT` with live mode. The contract evidence grid can remain below or behind a subtab.

## Rollout Plan

Phase 1: Infrastructure and Implement/Verify coverage

- DB table
- helper functions
- operations API
- MC live board for implementation stories and verify/GitHub
- enough observations to solve the current blind spot

Phase 2: Full pipeline coverage

- Plan, Design, Stories, Setup, Build, Security, QA, Final, Deploy observation emitters
- richer live feed
- hover/detail drawer

Phase 3: Visual polish

- refined layout
- better interaction design
- optional Stitch exploration for final visual language once the data model is real

## Non-Goals

- Do not replace the whole Mission Control navigation.
- Do not depend on parsing browser screenshots for status.
- Do not make GitHub the source of truth for Setfarm state.
- Do not wait for WebSocket before shipping the first version.
- Do not remove existing contract evidence; live observations complement it.

## Acceptance Criteria

- A running Setfarm run shows phase-level live observations before the step completes.
- Implementation shows each story as its own live card.
- Retry state is visible with retry count.
- Supervisor blockers appear as live observations with exact blocker text.
- Developer fixes appear with file paths and short summaries.
- GitHub PR/comment/thread activity appears when available.
- Contract pass/fail still reflects final validation, while live observations show in-progress work.
- The UI no longer appears to jump from all-pending to all-pass without intermediate states.

## Risks And Mitigations

- Risk: too many noisy events. Mitigation: stable check IDs for gates, append only meaningful agent summaries, and group feed items by phase/story.
- Risk: observations diverge from contract truth. Mitigation: label observations as operational state and keep contract evidence as validation state.
- Risk: DB churn. Mitigation: upsert stable checks and cap append-only feed retrieval.
- Risk: UI overload. Mitigation: use a hybrid board with drill-down details rather than showing every event at top level.

## Product Decision

The first version will upgrade the existing Run Contract tab so it opens with Live Ops first and keeps the evidence grid below or behind a secondary section. A separate `LIVE OPS` tab is not needed for the first version because the operator already uses Run Contract as the source of run truth.
