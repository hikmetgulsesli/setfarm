# Gemini / Sonnet Review Prompt

Use this prompt with the other files in this review packet.

---

You are an adversarial senior platform architect reviewing Setfarm + Mission Control.

Setfarm is intended to be an LLM-assisted software factory, not a loose agent chat runner. It takes a user task, creates a Product Contract, generates Stitch designs when needed, decomposes into stories, creates a repo, converts design to code, implements story PRs, verifies/merges, supervises, runs security/QA/final-test, and deploys. Mission Control should show this like a live company operations board.

The system is currently showing a severe reactive patch-loop smell. Each generated project reveals new behavior issues. We keep adding guards, QA-FIX loops, supervisor checks, runtime evidence rules, self-heal controls, and MC visibility patches. The concern is that the architecture is becoming too complex and still not reliably producing correct apps.

Review the provided files and answer adversarially.

## Required Answer Format

### 1. Diagnosis

Is this system:

- a promising deterministic factory,
- a reactive patch loop,
- an overcomplicated agent orchestration prototype,
- or something else?

Explain the actual root cause, not symptoms.

### 2. What To Keep

Which mechanisms are structurally correct and should remain?

Consider:

- Product Contract PRD
- Stitch design import
- stack contracts
- scope ownership
- run observations
- PR model
- runtime evidence
- supervisor
- self-heal plan-only
- MC live board

### 3. What To Remove Or Simplify

Which layers are unnecessary, duplicated, dangerous, or too reactive?

Be explicit about:

- guards that should move earlier
- guards that should be removed
- QA-FIX loop risk
- `step-ops.ts` over-centralization
- `spawner.ts` runtime discipline overload
- supervisor role confusion
- MC stale event/projection issues

### 4. Correct Target Architecture

Propose the target architecture for:

- Web apps
- browser games
- API/CLI projects
- Android/iOS future support

Avoid project-specific fixes. Define the stack-agnostic core.

### 5. Agent Role Model

We want a company-like model: patron, PM, designer, developer, reviewer, QA, security, deployer, supervisor.

Should we keep current agent roles, add more specialized agents, or reduce agents and strengthen the orchestrator?

Which responsibilities must never belong to an LLM agent?

### 6. Evidence Model

How should Setfarm prove that a story works?

Evaluate:

- `IMPLEMENT_INTENT.json`
- `IMPLEMENT_VERIFICATION_REQUEST.json`
- `IMPLEMENT_EVIDENCE.json`
- runtime driver
- screenshots/DOM/state bridge
- VLM or non-VLM visual checks
- advisory vs blocking evidence gates

Should evidence be mandatory for every story or only story types that need runtime?

### 7. Self-Heal Decision

Should the supervisor/Codex be allowed to patch Setfarm/MC automatically?

If yes, define exact safety boundaries.

If no, define what it should do instead.

Address:

- classification confidence
- immutable tests
- write interceptor
- rollback
- patch registry
- same-run resume
- MC patch visibility

### 8. Mission Control Redesign

How should MC show:

- live agent work
- per-story progress
- PR comments and merge state
- runtime URLs
- screenshots/evidence filmstrip
- stale/superseded blockers
- QA-FIX loops
- self-heal patches

Should MC be derived only from `run_observations`, or merged with legacy events?

### 9. Implementation Plan

Give a decision-complete refactor plan.

The plan must say:

- first three changes
- what to stop doing immediately
- which files/subsystems to edit
- what tests must exist
- how to know the patch loop is solved

### 10. Final Verdict

Choose one:

- Continue current architecture with targeted fixes
- Partial reset
- Full architecture reset
- Stop generated runs until core refactor

Be blunt. We want the correct system, not reassurance.

---

Important constraints:

- Do not propose project-specific rules for one generated app.
- Do not rely on prompt tuning as the primary fix.
- Prefer mechanical contracts, evidence, and explicit ownership.
- But also challenge whether too many contracts are creating the problem.
- The answer should include concrete code-level guidance where useful.

