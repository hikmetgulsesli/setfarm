# Setfarm + Mission Control Deterministic Pipeline Review Packet

Date: 2026-05-26
Scope: Setfarm pipeline, Mission Control observability, stack/runtime contracts, QA/final-test gates.

## Why This Packet Exists

We have been fixing repeated generated-project failures one by one: Stitch-to-JSX drift, missing icons, weak QA evidence, port conflicts, incomplete Mission Control visibility, PR/review lifecycle ambiguity, and final-test/QA inconsistencies.

The goal is to stop reactive project-by-project patching and move Setfarm toward a deterministic compiler/factory pipeline:

- Each phase must produce machine-verifiable contracts.
- Agents may make claims, but Setfarm/Mission Control must verify evidence.
- QA/final-test must use stack/runtime contracts instead of tool/port guessing.
- Mission Control must show real operation-level activity, not only end-state phase changes.
- Fixes must be stack/system-level, not specific to one generated project or domain.

## Context Files To Attach

Please attach these existing specs with this packet:

- `docs/superpowers/specs/2026-05-25-setfarm-generated-runtime-root-fix-review.md`
- `docs/superpowers/specs/2026-05-25-setfarm-pipeline-operations-contract-v1.md`

Useful screenshots to attach:

- Stitch design vs generated app screenshots showing missing navigation/buttons/settings/reports.
- Mission Control screenshots showing pipeline phases, Run Contract, Story Ownership, Supervisor, Files, Activity Feed, and Projects page.
- Screenshots where QA/final-test appeared to pass despite incomplete generated UI.

## Previous External Review Summary

Gemini and Sonnet both converged on the same diagnosis:

- This is not mainly a prompt-quality problem.
- The root issue is weak contract enforcement between phases.
- Build success was being treated as semantic success.
- Design import failures could leak into IMPLEMENT.
- QA agents were able to improvise with missing tools or unstable ports.
- Mission Control lacked a unified event/observation stream for live work visibility.
- Stack packs need explicit runtime/tooling contracts.
- Unknown design primitives should fail mechanically before IMPLEMENT.

Key recommended direction:

- Treat agents as bounded compiler passes.
- Harden `stitch-to-jsx`.
- Add stack pack contracts.
- Add deterministic runtime port/tool preflight.
- Replace agent QA improvisation with system-owned evidence gates.
- Stream operation events to Mission Control.

## Recent Fixes Already Implemented

### 1. Runtime Port Contract

Added deterministic local runtime port allocation.

Files:

- `src/installer/runtime-ports.ts`
- `tests/runtime-ports.test.ts`

Behavior:

- Backend ports use `4100-4999`.
- Frontend/dev ports use `5100-5999`.
- Preview/smoke ports use `6100-6999`.
- Allocation uses run identity and scans for a free port.
- QA/final-test no longer rely on Vite randomly switching ports.

### 2. Stack Pack Runtime And Tool Preflight

Extended stack contracts with runtime and preflight metadata.

Files:

- `src/installer/stack-contract/types.ts`
- `src/installer/stack-contract/packs.ts`
- `src/installer/stack-contract/reconcile.ts`
- `src/installer/stack-contract/context.ts`
- `src/installer/stack-evidence.ts`
- `tests/stack-evidence.test.ts`

Behavior:

- Vite React stack declares a preview runtime contract.
- Smoke commands use strict host/port behavior.
- Required tools such as `node`, `npm`, and `agent-browser` are represented as preflight checks.
- Evidence classes are derived from stack/runtime kind.

### 3. QA Preclaim Becomes System-Owned

QA now runs a deterministic system preclaim before spawning a QA agent.

Files:

- `src/installer/steps/09-qa-test/preclaim.ts`
- `src/installer/steps/09-qa-test/module.ts`
- `src/installer/steps/09-qa-test/guards.ts`
- `src/installer/steps/09-qa-test/prompt.md`
- `tests/steps/09-qa-test.test.ts`

Behavior:

- Allocates deterministic preview port.
- Writes `preview_port`, `dev_server_port`, `dev_server_url`, and `qa_url` into context.
- Runs stack tool preflight.
- Runs `scripts/smoke-test.mjs <repo> --port <allocated>`.
- Writes both:
  - `quality-reports/qa-test-1.md`
  - `quality-reports/qa-test-1.json`
- Completes QA with structured evidence:
  - `QA_REPORT`
  - `QA_JSON`
  - route/screen/interaction counts
  - issue count

Contract change:

- QA `STATUS: done|retry|fail` now requires both markdown and JSON evidence.
- JSON schema must be `setfarm.qa-report.v1`.
- Shallow QA reports without concrete route/screenshot/interaction sections are rejected.

### 4. Final-Test Runtime Parity With QA

Final-test now follows the same runtime/tooling discipline as QA.

Files:

- `src/installer/steps/10-final-test/preclaim.ts`
- `tests/steps/10-final-test.test.ts`

Behavior:

- Allocates deterministic runtime port.
- Injects `DEV_SERVER_URL`, `QA_URL`, `PORT`, `PREVIEW_PORT`.
- Runs stack tool preflight before final smoke.
- Runs `smoke-test.mjs` with `--port <allocated>`.
- Records final smoke observations.

Remaining question:

- Final-test still uses `SMOKE_TEST_RESULT` rather than a full `FINAL_TEST_JSON` artifact. Should final-test also produce machine-readable JSON like QA?

### 5. Smoke Test Port Semantics

Fixed smoke test script behavior around explicit ports.

Files:

- `scripts/smoke-test.mjs`

Behavior:

- Passing `--port` no longer means “external server already exists.”
- `--external-server` is now the explicit mode for using an already-running server.
- This prevents silent false negatives/false positives from port assumptions.

### 6. Stitch-To-JSX Hardening

Hardened generated UI conversion.

Files:

- `scripts/stitch-to-jsx.mjs`
- `tests/stitch-to-jsx.test.ts`

Behavior:

- Unknown Material Symbols are treated as strict failures rather than silent `BadgeHelp` fallback.
- Runtime CSS generation covers Stitch token utility classes.
- Generated icon-only controls receive deterministic `aria-label` injection when no visible text/title/aria-label exists.

Remaining question:

- Is the current converter validation enough, or should there be an explicit intermediate AST/manifest gate before JSX is written?

### 7. Mission Control Observation Stream

Added persistent observation records and exposed them to MC.

Files:

- `src/db-pg.ts`
- `src/installer/observations.ts`
- `src/installer/operation-observability.ts`
- `src/server/dashboard.ts`
- `src/server/index.html`

Behavior:

- New `run_observations` table stores operation-level events:
  - run id
  - step id
  - story id
  - agent id
  - phase
  - check id
  - label
  - status
  - summary/detail
  - evidence/file paths/github/metadata
- Added endpoint:
  - `GET /api/runs/:id/observations`
- Mission Control Activity panel now merges old event log with observations.
- Observation write failures are now warning-level instead of debug-only.

Remaining question:

- Is merging observations into the old Activity panel enough, or should Mission Control switch to projections derived primarily from `run_observations`?

### 8. Hard-Gate Preclaim Failures

Preclaim failures for quality/security gates now block instead of silently falling back to an agent.

File:

- `src/installer/step-ops.ts`

Behavior:

- `security-gate`, `qa-test`, and `final-test` preclaim failures are now hard gate failures.
- This prevents deterministic infrastructure/tooling failures from becoming agent improvisation.

Remaining question:

- Should `setup-build` design import preclaim also be treated as a hard preclaim gate through this same mechanism, or is its existing internal completion/failure path sufficient?

### 9. Context Pruning Clarification

Clarified that `STEP_CONTEXT_ALLOWLIST` is currently reference documentation, not active enforcement.

Files:

- `src/installer/constants.ts`
- `src/installer/context-ops.ts`

Behavior:

- Runtime pruning is denylist-based.
- Heavy implementation-only keys are removed outside IMPLEMENT.
- The old allowlist remains as documentation for expected step inputs.

Remaining question:

- Should this reference allowlist be removed entirely to avoid confusion, or converted into test-only documentation?

## Verification Performed

Build:

```bash
SETFARM_ALLOW_DIRTY_BUILD=1 npm run build
```

Result: passed.

Focused tests:

```bash
node --import tsx --test \
  tests/steps/09-qa-test.test.ts \
  tests/steps/10-final-test.test.ts \
  tests/runtime-ports.test.ts \
  tests/stack-evidence.test.ts
```

Result: passed.

Additional lifecycle tests:

```bash
SETFARM_SKIP_RUNTIME_GUARD=1 node --import tsx --test \
  tests/steps/09-qa-test.test.ts \
  tests/steps/10-final-test.test.ts \
  tests/runtime-ports.test.ts \
  tests/stack-evidence.test.ts \
  tests/claim-log-lifecycle.test.ts
```

Result: passed.

Full suite:

```bash
SETFARM_SKIP_RUNTIME_GUARD=1 npm test
```

Result: passed.

Note:

- Normal `npm test` can fail in this dirty development tree because runtime guard intentionally rejects dirty state. The runtime guard was skipped only for local verification.

## Current Architectural Concerns

These may still be unresolved:

1. Mission Control is not fully event-sourced yet.
   - `run_observations` exists, but old events still drive parts of the UI.
   - Need to decide if observations become the primary projection source.

2. Final-test may need a JSON report contract.
   - QA now has `QA_JSON`.
   - Final-test still primarily has `SMOKE_TEST_RESULT`.

3. Setup-build hard gate may still be split across mechanisms.
   - Design import failures are stricter than before.
   - But the generic hard-preclaim list currently includes only `security-gate`, `qa-test`, `final-test`.

4. Stack packs are still partial.
   - Vite React has concrete runtime/tool contract.
   - Next.js/iOS/Android/etc. should not be opened until Vite path is stable.

5. QA is more deterministic, but not fully contract-driven.
   - It still relies on smoke script behavior rather than generated Gherkin/Cucumber-style acceptance contracts.

6. Story file ownership is not yet a hard sandbox.
   - Guards exist around scope, but write access is not mechanically blocked at filesystem/sandbox level.

7. PR review lifecycle is improving but may not be a full FSM.
   - Review comments can be detected/routed.
   - Need confirm if comment state is modeled as `OPEN -> ADDRESSED -> VERIFY_EVALUATING -> RESOLVED/REJECTED`.

8. No container/server sandbox has been introduced.
   - User notes production will run on the server; Mac is only development.
   - Question: is deterministic port/tool/runtime preflight enough, or is per-run isolation still necessary on the server?

## Questions For Gemini/Sonnet

Please review this adversarially as a systems architecture/code pipeline review.

1. Are these fixes enough to meaningfully escape the reactive loop, or are we still mostly patching symptoms?
2. What is the next highest-leverage architectural fix?
3. Should final-test require a machine-readable JSON artifact like QA?
4. Should Mission Control use `run_observations` as the primary event-sourced projection model?
5. Is deterministic port allocation and tool preflight enough for server execution, or do we still need per-run sandbox/container isolation?
6. Should `setup-build` be included in hard preclaim failure routing?
7. What contract boundaries are still porous between PLAN, DESIGN, STORIES, SETUP-BUILD, IMPLEMENT, VERIFY, QA, FINAL-TEST, and DEPLOY?
8. What should be blocked before any more generated-project runs?
9. What should be deferred until after Vite React stabilizes?
10. Are there any dangerous regressions or hidden failure modes in the recent changes?

Please do not give generic LLM/prompt advice. Focus on deterministic contracts, stack-pack design, failure routing, Mission Control observability, and phase boundary enforcement.

