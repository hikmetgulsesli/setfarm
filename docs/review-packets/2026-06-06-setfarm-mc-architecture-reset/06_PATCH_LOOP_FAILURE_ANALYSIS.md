# Patch Loop Failure Analysis

## Symptom

In recent runs, primary stories can become "done" or "verified," only for QA, smoke checks, or the supervisor to find another problem later. The system opens a QA-FIX story, the agent attempts a repair, and the supervisor then finds another checklist blocker. To the user, this looks like an "endless patch loop."

## Recent Failure Classes

### Design Import Gap

Unknown Material icons or Stitch CSS problems should fail during setup-build. In the past, fallback icon/CSS leakage propagated downstream.

Correct layer: `stitch-to-jsx` + setup-build hard gate.

### Generated Screen Coverage Mismatch

SCREEN_MAP can require two screens while only one generated-screen file exists. A design/code mismatch can remain even when the run appears completed.

Correct layer: setup-build certificate + generated-screen-validator hard gate.

### Runtime State Not Reflected In UI

Game state may advance without any visible movement on the screen. Passing the build, tests, and action-handler checks does not catch this.

Correct layer: runtime evidence/test bridge/smoke gate. However, this should be caught early after IMPLEMENT rather than late in QA-FIX.

### Agent Self-Review Weakness

An agent may say "the build/tests pass and the runtime is ready," but that claim is weak without orchestrator-owned screenshots, DOM, and state.

Correct layer: implementation evidence runner, not agent prose.

### QA-FIX Loop

A QA-FIX story is opened after a QA or VERIFY smoke failure. While QA-FIX repairs an existing screen, the supervisor can bring the new layout/runtime fix into conflict with an old checklist.

Correct layer: failure-routing policy. Some smoke failures should become a retry of the previous implementation story or a platform bug, not a QA-FIX.

### Stale MC Observation

An OPEN PR-state or actionable-comment blocked observation can appear as an active problem in raw activity even after it is resolved or verified.

Correct layer: MC projection/read model, not event deletion.

### PR/Verify Ambiguity

The reviewer can say PR comments are resolved while the PR state still appears OPEN, followed later by an auto-merge/verified observation. Users cannot understand what happened unless this lifecycle is an explicit FSM.

Correct layer: PR-comment/PR-state FSM.

## Why More Patches Are Not Enough

Adding a new guard for every new bug appears correct in the short term. In aggregate, however:

- the agent prompt becomes bloated
- the number of spawner guards grows
- MC activity becomes noisy
- failure routing becomes difficult to understand
- QA-FIX contaminates the system again as a new story
- the stack-agnostic goal becomes weaker

The main analysis requested from the external model is therefore: Which checks should remain platform invariants, and which should be removed or moved into a stack evidence contract?

## Architectural Smell

The following files/layers may carry too much responsibility:

- `src/installer/step-ops.ts`: lifecycle, PR, QA-FIX, verification, routing, side effects.
- `src/spawner.ts`: process manager, runtime guard, supervisor signal, gateway health, claim recovery.
- `src/server/index.html`: UI projection, activity rendering, evidence filmstrip.
- supervisor layer: product PM + static analyzer + fixer + QA signals.

## Core Reset Question

Is Setfarm an "agent orchestration platform" or an "LLM-assisted compiler/evidence pipeline"?

If it is the latter:

- completion is based only on machine evidence
- agent output remains advisory
- the failure-routing table is small and mechanical
- QA-FIX is bounded and rare
- the MC projection is derived from the event log
- self-heal begins in plan-only or approval-only mode
