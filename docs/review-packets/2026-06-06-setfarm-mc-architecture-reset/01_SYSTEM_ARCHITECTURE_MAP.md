# System Architecture Map

## Current Intent

Setfarm is not intended to be an "agent chat runner." It is intended to be an evidence-driven software factory that uses LLM agents as bounded compiler passes. Mission Control should be the live operations board for this factory: it should show what each agent is doing, which file changed, which gate passed, which PR comment was resolved, and which runtime evidence was produced.

## Main Runtime Components

- `src/cli/cli.ts`: CLI entrypoint. Workflow start, status, and daemon/spawner commands flow through this file.
- `src/db-pg.ts`: PostgreSQL schema and migration-like startup DDL. State tables such as runs, steps, stories, claim logs, and observations live here.
- `src/installer/run.ts`: workflow-run creation and initial step-state preparation.
- `src/installer/step-ops.ts`: most claim, preclaim, completion, story-loop, PR, QA-FIX routing, and step-lifecycle behavior. It is a critical but excessively dense file.
- `src/spawner.ts`: agent process manager. It acquires claims, waits for OpenClaw/gateway readiness, starts agent processes, applies runtime guards and watchdogs, and cleans up stuck, self-looping, or orphaned claims.
- `src/spawner-prompt.ts`: builds the agent claim summary and prompt context. This file substantially determines what an agent does and does not know.
- `workflows/feature-dev/workflow.yml`: the main pipeline definition and role mapping. It defines the plan -> design -> stories -> setup -> implement -> verify -> supervise -> quality -> deploy flow.

## Pipeline Step Modules

In theory, every step under `src/installer/steps/*` owns its own contract:

- `preclaim.ts`: Setfarm-owned mechanical work performed before an agent starts.
- `context.ts`: context provided to the agent.
- `prompt.md`: agent prompt template.
- `rules.md`: step rules.
- `guards.ts`: output and completion guards.
- `module.ts`: `StepModule` export.

In practice, many critical behaviors remain centralized in `step-ops.ts`. This is architectural debt: step contracts and global lifecycle logic are intertwined.

## Mission Control Components

- `src/server/daemon.ts`: local MC server/daemon.
- `src/server/dashboard.ts`: API endpoints, runs/projects/observations data provider.
- `src/server/index.html`: current single-file UI. Views such as projects, run details, activity, and the evidence filmstrip live here.
- `src/server/spawnerctl.ts`: spawner control integration.
- `src/server/supervisor-summary.ts`: supervisor state summary helpers.

Although MC has started using the observation stream, it still coexists with legacy event structures. This creates a dual-truth risk: users can receive a misleading picture, especially around retries, QA-FIX, stale blockers, and cases that are verified but still appear blocked by an old observation.

## Evidence And Runtime Components

- `src/installer/runtime-driver.ts`: stack-agnostic runtime driver interface.
- `src/installer/web-runtime-driver.ts`: Vite/browser preview runtime start/interact/capture/stop.
- `src/installer/runtime-ports.ts`: MC/Setfarm-owned deterministic runtime port allocation.
- `src/installer/implement-evidence.ts`: intent/request/evidence artifact paths and validation.
- `src/installer/implement-evidence-runner.ts`: runtime build, preview, interaction, screenshot/DOM/state capture.
- `src/installer/implement-evidence-writer.ts`: `IMPLEMENT_EVIDENCE.json` writer.
- `src/installer/stack-evidence.ts`: stack capability/evidence metadata.

The target is correct: an agent does not claim that it tested the product; Setfarm runs the runtime and produces evidence. The current implementation is still fragmented, and evidence can often remain advisory when the request artifact is missing.

## Supervisor And Self-Heal

- `src/installer/supervisor/*`: product supervisor scanner, checklist, visual QA, intervention, state, ledger.
- `src/installer/product-supervisor.ts`: supervisor memory and product-level checks.
- `src/installer/platform-self-heal/*`: platform failure classifier, ownership map, patch plan, rollback, patch registry, strictness delta, write interceptor.

The supervisor currently handles signals from product correctness, deterministic checklists, and runtime discipline. If these role boundaries blur, the authority of the "executive," "QA," "compiler," and "developer" roles becomes mixed.

## Script Layer

- `scripts/stitch-to-jsx.mjs`: Stitch HTML -> generated React screens compiler.
- `scripts/generated-screen-validator.mjs`: generated screen/design/code consistency.
- `scripts/smoke-test.mjs`: app runtime smoke and semantic browser checks.
- `scripts/setup-repo.sh`: generated project scaffold/setup.
- `scripts/check-*.mjs`: repo build contracts.

These scripts form the "mechanical compiler/gate" layer. Validation that must not be delegated to LLM agents should live here.

## Observed System Shape

The current system has the right intent, but it tries to answer the same questions in too many places:

- Is the Stitch/design converter correct?
- Is the generated screen connected to the app?
- Is there an action handler?
- Is runtime state actually reflected in the UI?
- Has the PR been merged?
- Should a QA-FIX story be opened?
- Should the supervisor repair the issue itself?
- How should MC display a stale blocker?

Because most of these questions were added as individual guards, the system has developed a tendency toward reactive contract accumulation.
