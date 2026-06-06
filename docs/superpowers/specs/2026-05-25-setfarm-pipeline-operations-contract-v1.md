# Setfarm Pipeline Operations Contract V1

Date: 2026-05-25
Status: Approved for implementation
Scope: Setfarm pipeline contracts, stack-aware evidence, quality/deploy gates, and Mission Control live operations

## Goal

Setfarm must behave as a stack-aware software factory. Every pipeline phase emits a contract for the next phase, records evidence from system-owned checks, normalizes blockers, and streams live operational observations to Mission Control.

This is system-level behavior. It must not encode project names, sample domains, specific product surfaces, or one-off UI actions into Setfarm gates.

## Pipeline Contract

Every phase uses the same four-layer model:

- `contract`: the formal handoff consumed by the next phase.
- `evidence`: system-owned proof such as build, test, smoke, GitHub, security, QA, and deploy checks.
- `blockers`: structured items that must close before the run advances.
- `observations`: live operational state for Mission Control.

Agents may create code and summaries. Agents do not grade their own evidence.

## Stack Authority

`StackPack` is the source of stack-specific behavior. Generic pipeline code may ask the selected stack pack which evidence classes apply, but it must not assume every project is a Vite web app.

Examples:

- Web packs may run DOM, visual, route, Playwright, browser smoke, and static UI checks.
- React Native, Android, and iOS packs use native-equivalent evidence and mobile build/test/simulator contracts.
- API and CLI packs use command, endpoint, integration, and contract tests, not browser DOM checks.
- Deploy checks are capability-based and environment-aware.

## Phase Semantics

PLAN owns portable product intent. DESIGN owns visual authority when applicable. STORIES owns logical implementation slices. SETUP resolves the stack pack, scaffold, dependency policy, and setup certificate. IMPLEMENT receives per-story least-privilege context. VERIFY owns PR/GitHub/merge/post-merge evidence. SUPERVISE owns product coherence and safe repair. SECURITY, QA, FINAL, and DEPLOY own stack-specific quality and release evidence.

## Mission Control Semantics

Mission Control must show both:

- validation state from contracts/evidence/blockers
- live operations from observations

Live observations may show `pending`, `running`, `pass`, `fail`, `retry`, `blocked`, or `info`. They do not replace final contract truth; they explain what is happening right now.

## First Implementation Slice

1. Add stack-aware evidence helpers.
2. Emit live observations for all step completions and quality/deploy gates.
3. Prevent web-only smoke preclaims from running on non-browser stacks.
4. Improve Mission Control operation aggregation so current check state and feed history are both visible.
5. Keep existing contract evidence views intact.

## Acceptance Criteria

- No project-specific strings are introduced into gates.
- Web-only browser smoke does not run automatically for native/API/CLI stacks.
- Verify, supervise, security, QA, final-test, and deploy emit live observations before and after meaningful checks.
- Mission Control shows retry/blocker/status changes without waiting for the whole phase to finish.
- Existing tests and builds continue to pass.
