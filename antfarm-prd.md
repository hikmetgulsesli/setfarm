# Antfarm PRD (Claude Agent SDK)

## Overview
Antfarm is a multi-tenant SaaS that lets users create tasks against their GitHub repos and have a lead agent orchestrate development, verification, and review until a PR is ready for human approval. The primary UX is a Kanban board; a secondary interface is Telegram messaging with the lead agent.

This PRD is opinionated about workflow: every task must be clarified into explicit acceptance criteria, decomposed into subtasks, implemented sequentially via per-subtask threads, verified, reviewed, and then surfaced to the user for merge.

## Goals
- End-to-end: user creates task -> PR is created -> reviewer signs off -> lead notifies user.
- Task clarity: lead must gather requirements until acceptance criteria are testable by agents.
- Deterministic process: every task has subtasks, each executed in its own thread to avoid context exhaustion.
- Learning and memory: each agent updates its memory and project knowledge after each handoff.
- UI should use earthy tones with a warm, grounded feel.

## Non-Goals (MVP)
- Automatic merge of PRs.
- Merge conflict detection or resolution (user handles during merge).
- Multi-repo workspaces.
- Non-Telegram messaging channels.

## User Journey (MVP)
1. User visits `antfarm.cool` and signs up.
2. User installs the Antfarm GitHub App and selects a repo.
3. A workspace is created (1 workspace = 1 repo).
4. User creates a task (e.g., "Build a new landing page").
5. Lead agent asks clarifying questions in the task thread (or Telegram) until acceptance criteria are explicit.
6. Lead decomposes into subtasks and assigns to dev agent threads.
7. Dev threads implement subtasks sequentially, update memory, update CLAUDE.md as needed, and create logs.
8. Verifier agent checks deliverables; if incomplete, it reassigns to dev.
9. When verification passes, PR is created and assigned to reviewer.
10. Reviewer comments on PR; if changes needed, task returns to dev.
11. When reviewer marks it ready, lead notifies the user.

## System Components
- Next.js (App Router) frontend on Vercel.
- Neon Postgres for user/workspace/task state.
- Task runner service for running Claude Agent SDK in per-task containers.
- GitHub App for repo access and PR creation.
- Telegram bot for messaging.
- User-provided Claude API key stored securely for token billing.

## Roles & Responsibilities

### Lead Agent
- Confirms task scope and acceptance criteria.
- Creates and manages subtasks.
- Assigns subtasks to dev threads.
- Receives updates from dev/verifier/reviewer.
- Notifies user when PR is ready.

### Dev Agent (one thread per subtask)
- Implements a single subtask.
- Updates `memory.md` for the dev agent after subtask completion.
- Updates any relevant `CLAUDE.md` files in directories it touched with durable project knowledge.
- Writes a log entry for the subtask.

### Verifier Agent
- Validates acceptance criteria were met.
- Checks tests, build, and any explicit criteria.
- If any criterion fails, reassigns to dev with explicit fixes.

### Reviewer Agent
- Reviews the PR for correctness, style, and completeness.
- Leaves comments on the PR.
- If changes required, reassigns to dev with specific fixes.

## Task Lifecycle (Opinionated Workflow)

### 1. Task Creation
- User enters a task title and optional description.
- Task status = `Inbox`.

### 2. Clarification (Lead)
- Lead runs in plan mode (`permission_mode: "plan"`) so it can analyze and ask questions but cannot edit files or run commands.
- Lead asks questions until all requirements are explicit and testable.
- Lead writes acceptance criteria in the task description.
- Task status = `Assigned`.

### 3. Decomposition
- Lead creates subtasks.
- Each subtask has explicit inputs, outputs, and test plan.

### 4. Execution (Dev Threads)
- Each subtask is assigned to its own dev thread (Claude Agent SDK thread).
- Each dev thread:
  - Works only on its subtask.
  - Updates `memory.md` after completion.
  - Updates `CLAUDE.md` in touched directories if it learned durable project info.
  - Creates a log entry file.
- Task status = `In Progress`.

### 5. Verification
- Verifier replays acceptance criteria and checks output artifacts.
- If any failures, task loops back to dev with precise corrections.
- When verified, task advances.

### 6. PR Creation
- Verifier creates a PR via GitHub App once all acceptance criteria pass.
- PR includes summary, checklist, and test evidence.
- Task status = `Review`.

### 7. Review
- Reviewer agent comments on PR.
- If changes required, task loops back to dev.
- When reviewer marks as ready, lead notifies user.

### 8. Done
- Task status = `Done`.
- User merges PR manually.

## Subtask Threading Model
- Each subtask runs in a separate Claude Agent SDK thread.
- Subtask threads run sequentially in a loop until all subtasks are complete.
- Threads share the same repo checkout in the task container.
- The lead tracks thread IDs and status.

## Knowledge & Logging

### Per-Agent Memory
- Each agent maintains a private `memory.md` file.
- Location: `.antfarm/memory/{agent-name}/memory.md`.
- Updated before handing off to another agent.

### Project Knowledge
- Use `CLAUDE.md` in directories where durable lessons apply.
- Only add information that will help future agents avoid mistakes or understand local conventions.

### Logs
- Each agent thread writes a log entry file after completion.
- Location: `.antfarm/logs/{task-id}/{thread-id}.md`.
- Format: summary, changes made, commands run, tests run, follow-ups.

## Data Model (MVP)
- `users`: id, email, name
- `workspaces`: id, owner_id, github_repo, github_install_id, default_branch
- `tasks`: id, workspace_id, title, description, status, branch_name, pr_url
- `subtasks`: id, task_id, title, status, thread_id
- `messages`: id, task_id, sender_type, content
- `agent_runs`: id, task_id, agent_role, status, started_at, finished_at
- `claude_api_keys`: id, user_id, encrypted_key, created_at

## APIs (MVP)
- `POST /api/workspaces` create workspace
- `POST /api/tasks` create task
- `POST /api/tasks/:id/assign` assign task to lead
- `POST /api/tasks/:id/subtasks` create subtasks
- `POST /api/tasks/:id/run` start task execution
- `POST /api/tasks/:id/verify` start verification
- `POST /api/tasks/:id/review` start review
- `POST /api/telegram/webhook` receive Telegram messages
- `POST /api/github/webhook` handle PR updates

## Acceptance Criteria (System)
- Task cannot move to `Assigned` until acceptance criteria exist.
- Task cannot move to `Review` until verifier passes.
- Task cannot move to `Done` until reviewer passes.
- Every agent handoff must include memory/log updates.

## Claude Task List Integration
Claude Code includes a task list that is session-scoped by default, but can be persisted across sessions by setting `CLAUDE_CODE_TASK_LIST_ID` to store task state under `~/.claude/tasks/`. In Antfarm:
- Antfarm remains the source of truth for tasks/subtasks in the database.
- Each agent session initializes a Claude task list that mirrors the Antfarm subtasks.
- The task runner sets `CLAUDE_CODE_TASK_LIST_ID` to a stable value per task (for example `antfarm-{workspaceId}-{taskId}`) so sequential threads can share a task list within the container.
- When a thread finishes, Antfarm syncs the Claude task list state back into the database.

## Claude API Key Handling
- Users provide their own Claude API key immediately after adding a GitHub repo during onboarding.
- The key is stored encrypted in Neon and injected into task containers at runtime.
- The key is scoped to the user/workspace to ensure billing is aligned with the customer’s usage.

## Risks / Ambiguities to Resolve
1. Claude task list API surface: documentation covers task list UI and persistence, but the programmatic interface for task creation/updates inside the Agent SDK must be confirmed.
2. Sequential subtask execution: no parallel edits by design, but long-running tasks still need timeouts and budget controls.
3. Agent memory and CLAUDE.md updates: need guardrails to prevent noisy or redundant updates.
4. Long-running tasks: container lifetime and cost controls need explicit limits.
5. Security: ensure GitHub App tokens and Claude API keys are isolated per workspace and container.

## Open Questions
1. What are default acceptance criteria templates (e.g., tests, lint, screenshot)?
2. Do we need a per-task budget limit (tokens, time)?
3. Should the verifier run tests by default, or only if acceptance criteria require it?
4. Is the agent log stored in the repo or in Antfarm storage? (Spec currently stores in repo under `.antfarm/`).
