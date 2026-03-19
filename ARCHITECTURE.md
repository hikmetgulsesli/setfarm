# Setfarm Architecture

## Overview

Setfarm is a multi-agent workflow orchestration system built on top of OpenClaw.
It manages 10 agents across 5 workflow types, with a SQLite-backed pipeline engine.

## Pipeline Lifecycle

```
PLAN → SETUP [DB?] → DESIGN [Stitch?] → IMPLEMENT (loop: stories) → VERIFY (verify_each)
  → SECURITY-GATE → FINAL-TEST → DEPLOY
```

### Step States
```
waiting → pending → running → done
                  ↘ failed (retry → pending)
```

### Story States (inside loop steps)
```
pending → running → done → verified
                  ↘ failed → skipped (v9.0: skip instead of blocking)
                  ↘ abandoned (auto-save → pending)
```

## Module Map

### Core Pipeline (`src/installer/`)

| Module | Responsibility |
|--------|---------------|
| `step-ops.ts` | Pipeline engine: claim, complete, fail, advance |
| `constants.ts` | Single source for thresholds, timeouts, optional vars |
| `config-schema.ts` | Config validation rules (codified tribal knowledge) |
| `openclaw-config.ts` | Read/write OpenClaw JSON config with validation |
| `agent-cron.ts` | Cron management for agent polling |
| `design-contract.ts` | UI contract generation from Stitch HTML |
| `db-provision.ts` | Auto-provision PostgreSQL/MariaDB/MySQL/MongoDB |
| `quality-gates.ts` | Code quality checks (dead links, placeholders) |
| `browser-tools.ts` | Browser DOM verification |
| `workflow-spec.ts` | YAML workflow parser and validator |
| `types.ts` | Shared TypeScript types |
| `paths.ts` | Path resolution for OpenClaw directories |
| `events.ts` | Event emission for logging/notifications |
| `install.ts` | Workflow installation (agents, crons, config) |
| `uninstall.ts` | Workflow uninstallation |
| `run.ts` | Workflow run creation |
| `status.ts` | Run status reporting |

### CLI & Medic

| Module | Responsibility |
|--------|---------------|
| `src/cli/cli.ts` | CLI entry point — imports `claimStep`, `completeStep`, `failStep`, `getStories`, `peekStep` |
| `src/medic/medic.ts` | Health watchdog — imports `completeStep` |
| `src/medic/checks.ts` | Medic health checks |

### Database (`src/db.ts`)

SQLite via `node:sqlite` (`DatabaseSync`). Three tables:

- **runs**: Workflow run state + JSON context bag
- **steps**: Individual pipeline steps (waiting/pending/running/done/failed)
- **stories**: User stories within loop steps

Key indexes: `idx_steps_agent_status`, `idx_stories_run_status`, `idx_steps_status_updated`

## Key Mechanisms

### Story-Each Loop (Parallel Execution)

1. Loop step with `type: "loop"` iterates over stories
2. Each story gets a **git worktree** (isolated branch + working directory)
3. `parallelCount` controls max concurrent stories (default: 3)
4. Worktree includes symlinked `node_modules` and copied `stitch/` assets
5. On abandon: auto-save uncommitted changes (`git add -A && git commit -m "wip: ..."`)

### Verify-Each Flow

1. After each story completes → verify step set to `pending`
2. Verifier agent reviews PR
3. If `STATUS: retry` → story goes back to `pending` with feedback
4. If merged PR detected → auto-verify (quality gate must pass)
5. After all stories verified → loop step `done` → advance pipeline

### Context Management

- Run context: JSON bag in `runs.context` column
- Protected keys: `repo`, `task`, `branch`, `run_id`, `design_system` (never overwritten)
- Template vars: `{{key}}` resolved from context, `{{key|default}}` for fallback
- Optional vars: defaulted to `""` to prevent MISSING_INPUT_GUARD false positives

### Abandoned Step Detection

- **Base threshold**: 120s (first abandon)
- **Fast threshold**: 90s (repeat abandons)
- **Max resets**: 5 (then permanent failure)
- `abandoned_count` tracked separately from `retry_count`
- Auto-save worktree on abandon (preserves WIP commits)

### Config Validation (Production Rules)

Codified in `config-schema.ts`:
- `agents.defaults.sandbox.mode` must be `"off"` (worktree write access)
- `tools.fs.workspaceOnly` must be `false` (same reason)
- `tools.exec.security` must be `"full"` (build/test execution)
- Model name must never be `"default"` (silent fallback)
- No Anthropic custom provider (gateway crash)

## Workflow YAML Structure

```yaml
id: feature-dev
agents:
  - id: planner
    role: analysis
    model: minimax/MiniMax-M2.7
    workspace: { baseDir: ..., files: {...} }
steps:
  - id: plan
    agent: planner
    type: single
    input: |
      {{task}} instructions...
    expects: "STORIES_JSON"
  - id: implement
    agent: developer
    type: loop
    loop:
      over: stories
      completion: all_done
      verify_each: true
      verify_step: verify
      parallel_count: 5
    input: |
      Story: {{current_story}}
    expects: "STATUS: done"
```

## External Dependencies

- **GitHub CLI** (`gh`): PR operations (create, view, merge, reopen)
- **Git**: Worktree management, branch operations
- **Stitch API**: Google Stitch MCP for UI design (via `stitch-api.mjs`)
- **fal.ai**: Image generation for design assets
- **External DB servers**: PostgreSQL/MariaDB/MySQL/MongoDB at ***REMOVED***
