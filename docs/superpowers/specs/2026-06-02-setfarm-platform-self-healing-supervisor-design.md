# Setfarm Platform Self-Healing Supervisor Design

Date: 2026-06-02
Status: Proposed for review
Scope: Setfarm infrastructure, Mission Control observability, and automated platform repair

## Problem

Setfarm currently learns from generated project failures, but most systemic fixes still require a human operator to inspect the failed run, decide whether the issue is project-specific or platform-level, edit Setfarm/Mission Control code, run tests, and then resume or replay the run. This creates a reactive loop: every new project can expose a new validator gap, smoke-test blind spot, design import issue, stack-pack assumption, or Mission Control visibility bug.

The target is an aggressive self-improving platform: when a generated project reveals a systemic defect, Setfarm should classify the defect, produce a bounded platform patch plan, let Codex apply the fix, prove it with tests and replay evidence, and resume automatically when policy allows. The system must be powerful enough to edit Setfarm itself, but observable and controlled enough that it cannot silently corrupt the platform.

## Product Goal

Add a `Platform Self-Healing Supervisor` that can automatically repair Setfarm and Mission Control infrastructure during or after failed runs.

The operator experience should feel like watching an engineering lead intervene live:

- detect a systemic failure
- classify root cause
- choose target files
- patch Setfarm/MC code
- run targeted tests and build checks
- replay the failed step or resume the run
- expose the exact patch, diff, logs, and result in Mission Control

## Non-Goals

- Do not replace project-level implement, verify, QA, or product supervisor loops.
- Do not add domain-specific fixes for one generated app.
- Do not hide automatic platform edits from Mission Control.
- Do not mark platform patches successful based only on agent prose.
- Do not require Docker/container isolation for the first local implementation.

## Operating Modes

The system is controlled by environment variables.

```bash
SETFARM_PLATFORM_SELF_HEAL=off
SETFARM_PLATFORM_SELF_HEAL_MODE=plan_only
SETFARM_PLATFORM_SELF_HEAL_MAX_PATCHES_PER_RUN=1
SETFARM_PLATFORM_SELF_HEAL_MIN_CONFIDENCE=0.75
SETFARM_PLATFORM_SELF_HEAL_AUTO_RESUME=0
SETFARM_PLATFORM_SELF_HEAL_ALLOWED_AREAS=smoke,qa,final-test,design-import,mc,stack-pack
SETFARM_PLATFORM_SELF_HEAL_FORBID_DIRTY_REPO=1
SETFARM_PLATFORM_SELF_HEAL_REQUIRE_TEST_DELTA=1
SETFARM_PLATFORM_SELF_HEAL_REQUIRE_REPLAY=1
SETFARM_PLATFORM_SELF_HEAL_ROLLBACK_ON_FAIL=1
```

Modes:

- `off`: no self-heal classification, planning, patching, or resume.
- `plan_only`: classify failures and write plans, but do not patch.
- `patch_only`: patch and test, but do not resume.
- `patch_and_resume`: patch, test, replay/resume when gates pass.

Recommended local development policy:

```bash
SETFARM_PLATFORM_SELF_HEAL=on
SETFARM_PLATFORM_SELF_HEAL_MODE=patch_and_resume
SETFARM_PLATFORM_SELF_HEAL_MAX_PATCHES_PER_RUN=2
SETFARM_PLATFORM_SELF_HEAL_AUTO_RESUME=1
SETFARM_PLATFORM_SELF_HEAL_FORBID_DIRTY_REPO=0
```

Recommended server policy for first rollout:

```bash
SETFARM_PLATFORM_SELF_HEAL=on
SETFARM_PLATFORM_SELF_HEAL_MODE=plan_only
SETFARM_PLATFORM_SELF_HEAL_AUTO_RESUME=0
SETFARM_PLATFORM_SELF_HEAL_FORBID_DIRTY_REPO=1
```

## Failure Classification

Every failed run or failed step is normalized into a route contract before repair.

### Project Failure

The generated application failed to satisfy its own PRD or story contract.

Examples:

- a game does not move
- a settings form does not persist state
- a required button has no handler
- an acceptance criterion is missing from implementation

Repair target: generated project repo.

### Platform Failure

Setfarm, Mission Control, a stack-pack, a validator, or a gate allowed a bad state or produced a false failure.

Examples:

- smoke test ignores valid `data-action-id` controls
- QA contract requires impossible evidence
- `SCREEN_MAP` declares screens that generated code does not contain
- stitch-to-jsx silently degrades icons or tokens
- failed/cancelled project cards pollute MC Projects default view
- stack-pack preview port or build command is wrong

Repair target: Setfarm repo, Mission Control repo, or stack-pack code.

### Ambiguous Failure

The evidence is insufficient to decide whether the defect is project-level or platform-level.

Examples:

- UI does not respond, but smoke automation may be using the wrong selector
- design/code mismatch could be converter failure or implement drift
- final-test failed after an infra timeout

Repair target: none until extra evidence is collected.

## Failure Route Contract

```json
{
  "schema": "setfarm.failure-route.v1",
  "runId": "run-id",
  "stepId": "qa-test",
  "failureClass": "platform_failure",
  "category": "smoke_contract_gap",
  "confidence": 0.91,
  "evidence": [
    "QA_INTERACTIONS_TESTED=0",
    "data-action-id controls existed",
    "smoke runner ignored action controls"
  ],
  "repairTarget": "setfarm_repo",
  "repairMode": "platform_self_heal",
  "resumePolicy": "replay_failed_step"
}
```

Policy:

- `confidence >= minConfidence`: automatic platform patch may run.
- `0.50 <= confidence < minConfidence`: write plan and collect more evidence.
- `confidence < 0.50`: block for human architect review.

## Repair Ownership Map

The self-heal supervisor uses a category-to-file ownership map. The initial map is intentionally explicit.

```yaml
smoke_contract_gap:
  ownedPaths:
    - scripts/smoke-test.mjs
    - tests/smoke-test-static-rules.test.ts

design_import_gap:
  ownedPaths:
    - scripts/stitch-to-jsx.mjs
    - scripts/generated-screen-validator.mjs
    - tests/stitch-to-jsx.test.ts
    - tests/generated-screen-validator.test.ts

qa_contract_gap:
  ownedPaths:
    - src/installer/steps/09-qa-test/**
    - tests/steps/09-qa-test.test.ts

final_test_contract_gap:
  ownedPaths:
    - src/installer/steps/10-final-test/**
    - tests/steps/10-final-test.test.ts

mc_visibility_bug:
  ownedPaths:
    - ${MISSION_CONTROL_SOURCE_ROOTS}/src/**

stack_pack_gap:
  ownedPaths:
    - src/installer/stack-contract/**
    - tests/stack-evidence.test.ts
    - tests/runtime-ports.test.ts
```

The map can grow, but entries must remain project-agnostic.
Mission Control source roots are resolved from configuration so local snapshots,
temporary development checkouts, and future server paths do not become hardcoded
repair policy.

## Platform Patch Plan Contract

Before editing, Codex must produce a structured patch plan.

```json
{
  "schema": "setfarm.platform-patch-plan.v1",
  "selfHealId": "sh_002",
  "intent": "Fix smoke runner so action controls count as interactions",
  "targetFiles": [
    "scripts/smoke-test.mjs",
    "tests/smoke-test-static-rules.test.ts"
  ],
  "expectedBehaviorChange": [
    "data-action-id controls count as actionable interactions",
    "hash-only navigation is no longer treated as route coverage"
  ],
  "testsToRun": [
    "node --import tsx --test tests/smoke-test-static-rules.test.ts",
    "npm run build"
  ],
  "rollback": "revert_patch_if_tests_fail"
}
```

Hard rules:

- No writes outside `targetFiles`.
- Production code changes require a targeted test change or explicit exception.
- No project/domain-specific hardcoding.
- No resume without replay or targeted evidence.
- Same failure recurring after the patch invalidates the patch result.
- Build success alone is not enough; targeted regression evidence is required.
- The LLM cannot mark the patch successful; Setfarm gates do.

## Platform Repair Workspace

For each attempt, Setfarm writes durable artifacts:

```text
.setfarm/platform-self-heal/
  sh_002/
    FAILURE_ROUTE.json
    PATCH_PLAN.json
    patch.diff
    test.log
    replay.log
    RESULT.json
```

The repair context given to Codex includes:

- normalized failure route
- recent run observations
- failing step output
- relevant generated project artifacts
- owned paths and forbidden paths
- relevant tests
- similar previous platform fixes
- required evidence commands

## Resume Policy

Patch success can trigger one of three policies:

- `resume_same_run`: continue the current run after platform repair.
- `replay_failed_step`: rerun only the failed step.
- `start_clean_replay`: restart the same prompt from a clean run.

Defaults:

- QA/final/smoke/MC visibility bugs: `replay_failed_step`.
- setup/design/validator bugs: `start_clean_replay`.
- infrastructure health bugs: `resume_same_run`.

## Mission Control Visibility

Mission Control must show every self-heal decision and edit live.

### Platform Self-Heal Lane

Run detail gains a `PLATFORM SELF-HEAL` lane with statuses:

- `idle`
- `classifying`
- `plan_created`
- `patching`
- `testing`
- `rollback`
- `resume_pending`
- `resumed`
- `blocked`

### Self-Heal Card

Example card:

```text
SELF-HEAL #2
Failure: qa-test / QA_INTERACTIONS_TESTED=0
Class: platform_failure / smoke_contract_gap
Confidence: 0.91
Mode: patch_and_resume
Status: testing
```

Substeps:

```text
✓ failure evidence collected
✓ route classified
✓ patch plan created
▶ editing scripts/smoke-test.mjs
• editing tests/smoke-test-static-rules.test.ts
• running targeted tests
• replaying qa-test
```

### Patch Drawer

Clicking a self-heal card opens a drawer with tabs:

- `Decision`
- `Files`
- `Diff`
- `Tests`
- `Resume`
- `Result`

The drawer shows changed files, summary, unified diff, test commands, logs, rollback result, and resume/replay result.

## Observation Events

Self-heal writes into `run_observations`.

Event names:

```text
platform_self_heal.detected
platform_self_heal.classified
platform_self_heal.plan_created
platform_self_heal.patch_started
platform_self_heal.file_changed
platform_self_heal.test_started
platform_self_heal.test_passed
platform_self_heal.test_failed
platform_self_heal.rollback_started
platform_self_heal.rollback_done
platform_self_heal.resume_started
platform_self_heal.resume_done
platform_self_heal.blocked
```

Metadata:

```json
{
  "selfHealId": "sh_002",
  "failureClass": "platform_failure",
  "category": "smoke_contract_gap",
  "confidence": 0.91,
  "targetFiles": ["scripts/smoke-test.mjs"],
  "patchPlanPath": ".setfarm/platform-self-heal/sh_002/PATCH_PLAN.json",
  "diffPath": ".setfarm/platform-self-heal/sh_002/patch.diff",
  "testLogPath": ".setfarm/platform-self-heal/sh_002/test.log"
}
```

## Data Flow

1. A run step fails or guardrail reports a blocker.
2. Setfarm records the failure observation.
3. Platform self-heal checks env policy.
4. Failure classifier writes `FAILURE_ROUTE.json`.
5. If policy allows repair, Setfarm prepares a platform repair workspace.
6. Codex produces `PATCH_PLAN.json`.
7. Setfarm validates target files against ownership map.
8. Codex applies the patch.
9. Setfarm captures `patch.diff`.
10. Setfarm runs targeted tests and build checks.
11. If tests fail, Setfarm rolls back when configured.
12. If tests pass, Setfarm replays/resumes according to resume policy.
13. Mission Control shows all events and artifacts.

## Implementation Components

Setfarm:

- `src/installer/platform-self-heal/config.ts`
- `src/installer/platform-self-heal/classifier.ts`
- `src/installer/platform-self-heal/ownership-map.ts`
- `src/installer/platform-self-heal/workspace.ts`
- `src/installer/platform-self-heal/patch-contract.ts`
- `src/installer/platform-self-heal/runner.ts`
- `src/installer/platform-self-heal/resume.ts`

Mission Control:

- API endpoint for self-heal artifacts under run detail.
- Self-heal lane in run operations view.
- Patch drawer with diff/test/result tabs.

Tests:

- env policy parsing
- failure classification
- ownership enforcement
- target file validation
- rollback on test failure
- resume policy selection
- run observation emission
- MC artifact API rendering

## Acceptance Criteria

- Self-heal can be fully disabled with env.
- `plan_only` writes artifacts but performs no edits.
- `patch_only` edits and tests but does not resume.
- `patch_and_resume` can replay a failed step after successful platform patch.
- Every automatic patch has `FAILURE_ROUTE.json`, `PATCH_PLAN.json`, `patch.diff`, `test.log`, and `RESULT.json`.
- MC shows self-heal status, target files, diff, test logs, and resume result live.
- Writes outside `targetFiles` are rejected.
- Production code patch without targeted regression evidence is rejected.
- Project/domain hardcodes are rejected.
- Failed tests trigger rollback when rollback env is enabled.
- Repeated identical failure after patch blocks the patch as unsuccessful.

## Risks And Mitigations

- Risk: self-heal corrupts Setfarm. Mitigation: target file enforcement, tests, rollback, max patches per run, env kill switch.
- Risk: self-heal hides project bugs as platform bugs. Mitigation: confidence thresholds, ambiguous classification, replay evidence.
- Risk: MC becomes noisy. Mitigation: one self-heal lane with expandable cards and drawer detail.
- Risk: dirty local repo complicates rollback. Mitigation: policy flag for dirty repo, patch artifacts, explicit diff capture.
- Risk: LLM makes broad architecture edits. Mitigation: ownership map and patch plan target-file gate.

## Rollout

Phase 1: plan-only classifier and artifacts.

Phase 2: patch-only for smoke, QA, final-test, and MC visibility categories.

Phase 3: patch-and-resume for local development.

Phase 4: server rollout in plan-only mode.

Phase 5: server patch-and-resume after repeated clean local runs.
