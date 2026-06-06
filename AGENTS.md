# Setfarm Agent Guide

## Repository Shape

Setfarm is a private TypeScript/Node.js CLI and workflow runtime. Work in this repo when changing Setfarm or Mission Control:

- `src/installer`: workflow orchestration, state transitions, gates, stack contracts, evidence, PR lifecycle, and step modules.
- `src/spawner.ts`: detached agent spawning, runtime discipline, transcript guards, cleanup, and recovery handling.
- `src/server`: Mission Control API and UI.
- `workflows`: workflow definitions and agent prompt fragments.
- `tests`: unit and lifecycle regression tests; step-specific coverage lives in `tests/steps`.

Use TypeScript ESM with explicit `.js` imports for local compiled modules. Prefer deterministic code, schemas, observations, and tests over prompt-only instructions.

## Commands

- `npm run build`: version/path/English contracts, TypeScript compile, asset copy, and dist preparation.
- `npm test`: all tests.
- `npm run test:steps`: step-module tests.
- `npm run test:scripts`: script tests.
- Local dirty-tree verification may use `SETFARM_ALLOW_DIRTY_BUILD=1`.
- Runtime guard bypass for platform verification may use `SETFARM_SKIP_RUNTIME_GUARD=1` only when the reason is explicit.

## Operating Protocol

Start with live truth. Before judging a run, inspect the local repo, PostgreSQL state, relevant claim logs, observations, and GitHub PR state. Do not rely on stale `stories.output`, agent prose, or Mission Control cards as the source of truth.

Generated projects are disposable evidence sources. Do not spend effort rescuing a failed or low-value generated project unless it is needed to observe a recent platform fix or expose a systemic Setfarm/MC bug. If a project is effectively trash, stop recovering it and move to a clean run.

Use observe-first recovery:

- Continue an existing run only to measure platform behavior after a fix, confirm a state-machine path, or gather a new systemic bug signal.
- Do not manually resolve GitHub threads, extend retry budgets, mutate DB state, or patch generated project code just to save a project.
- Any operational recovery must be bounded, documented in `run_observations`, preserve evidence, and explain the platform cause.
- Prefer starting a new run over carrying forward polluted state after the platform behavior has been learned.

## Platform Invariants

Agents do not self-certify correctness. Agent output is a claim; Setfarm-owned evidence is authority. For implementation stories that require runtime evidence, agents may declare intent and request verification, but Setfarm must run the app, execute interactions, capture screenshots/DOM/state/logs, write authoritative artifacts, and decide pass/fail.

Use the Universal Agent Inner Dev Loop design in `docs/superpowers/specs/2026-06-03-universal-agent-inner-dev-loop-design.md` for Setfarm and Mission Control work:

- Do not add project-specific hardcode to generic gates.
- Express requirements through stack packs, capability contracts, evidence artifacts, and tests.
- Mission Control should render derived state from DB observations/events, not agent claims.
- Supervisor is a bounded coherence/evidence gate, not an unbounded code fixer.
- Self-heal is plan-only unless explicitly and safely expanded; it must not weaken invariant tests.

Visual evidence is a first-class gate. Control it with:

- `SETFARM_IMPLEMENT_EVIDENCE_GATE=off|advisory|blocking`
- `SETFARM_VISUAL_EVIDENCE_GATE=off|advisory|blocking`
- `SETFARM_VISUAL_EVIDENCE_PROVIDER=none|minimax|openai|anthropic`

Even when disabled, Mission Control and evidence artifacts must show the visual gate as `disabled`. Blocking mode may only advance from orchestrator-owned evidence.

## Git And Safety

The worktree is often intentionally dirty. Never revert changes you did not make. Keep edits scoped to the platform concern being fixed, and avoid generated runtime artifacts unless they are required source assets.

Developer, reviewer, supervisor, QA, and final-test agents must not stage, commit, push, or open PRs. Setfarm owns git handoff after scoped gates pass.

Do not commit `.env`, tokens, local run state, generated project worktrees, or transient evidence directories.

## Testing Expectations

Add regression tests for every gate, validator, PR lifecycle, state transition, Mission Control state derivation, spawner recovery, or evidence bug. For changes in generated-screen, setup-build, verify, QA, final-test, spawner, or Mission Control behavior, run focused tests plus `npm run build` when code changes require compilation.
