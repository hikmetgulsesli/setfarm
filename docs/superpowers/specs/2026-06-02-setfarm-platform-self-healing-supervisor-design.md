# Setfarm Platform Self-Healing Supervisor Design

Date: 2026-06-02
Status: Revised after external adversarial review
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
- Do not enable hot-patching of an active orchestrator process in the first implementation.
- Do not allow the self-healer to edit immutable platform invariant tests.

## Operating Modes

The system is controlled by environment variables.

```bash
SETFARM_PLATFORM_SELF_HEAL=off
SETFARM_PLATFORM_SELF_HEAL_MODE=plan_only
SETFARM_PLATFORM_SELF_HEAL_MAX_PATCHES_PER_RUN=1
SETFARM_PLATFORM_SELF_HEAL_MIN_CONFIDENCE=0.75
SETFARM_PLATFORM_SELF_HEAL_AUTO_RESUME=0
SETFARM_PLATFORM_SELF_HEAL_ALLOWED_AREAS=smoke,qa,final-test,design-import,mc,stack-pack
SETFARM_PLATFORM_SELF_HEAL_ALLOWED_CLASSES=smoke_contract_gap,qa_contract_gap,final_test_contract_gap,design_import_gap
SETFARM_PLATFORM_SELF_HEAL_MAX_CLASSIFICATIONS_PER_RUN=3
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

`patch_and_resume` must remain disabled until the mandatory tests in this
document pass and at least three `patch_only` runs have produced reviewed,
non-regressing patches.

Recommended local development policy:

```bash
SETFARM_PLATFORM_SELF_HEAL=on
SETFARM_PLATFORM_SELF_HEAL_MODE=patch_only
SETFARM_PLATFORM_SELF_HEAL_MAX_PATCHES_PER_RUN=1
SETFARM_PLATFORM_SELF_HEAL_AUTO_RESUME=0
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

- `confidence >= minConfidence` plus mechanical corroboration: automatic platform patch may run.
- `0.50 <= confidence < minConfidence`: write plan and collect more evidence.
- `confidence < 0.50`: block for human architect review.

The numeric confidence value is not trusted when it is only self-assessed by an
LLM. A classification can cross the automatic patch threshold only when at least
one mechanical corroboration signal is present:

- the failure signature matches a versioned known platform pattern
- the same failure class appeared in prior runs
- a deterministic validator, AST check, schema check, grep, or artifact
  comparison independently confirms the signature

When no mechanical corroboration exists, the classification is capped below the
automatic patch threshold and produces a plan-only artifact.

## Adversarial Classification

Platform self-heal uses a two-pass classifier.

Blue classifier:

- proposes `project_failure`, `platform_failure`, or `ambiguous_failure`
- cites evidence and candidate repair target
- maps to known platform failure signatures when possible

Red classifier:

- attempts to disprove `platform_failure`
- argues whether the defect is actually a generated project bug
- checks for reward-hacking risk such as relaxing smoke tests or removing gates

A platform patch can proceed only when:

- Blue proposes `platform_failure`
- Red fails to invalidate the classification
- at least one mechanical corroboration signal exists
- the failure class is allowed by env
- the target category has a category test suite and immutable invariant coverage

Ambiguous failures have a bounded reclassification policy:

- collect extra deterministic evidence once
- rerun Blue/Red classification once
- if still ambiguous, block and emit an MC human-review notification

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
    - forbidden

mc_projects_visibility_bug:
  ownedPaths:
    - ${MISSION_CONTROL_SOURCE_ROOTS}/src/pages/Projects.tsx
    - ${MISSION_CONTROL_SOURCE_ROOTS}/src/components/projects/**

mc_run_operations_view_bug:
  ownedPaths:
    - ${MISSION_CONTROL_SOURCE_ROOTS}/src/pages/RunDetail.tsx
    - ${MISSION_CONTROL_SOURCE_ROOTS}/src/components/runs/**

mc_event_stream_bug:
  ownedPaths:
    - ${MISSION_CONTROL_SOURCE_ROOTS}/server/routes/**
    - ${MISSION_CONTROL_SOURCE_ROOTS}/src/lib/api.ts

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
Broad Mission Control wildcards are forbidden. `mc_visibility_bug` is a
classification umbrella only; it cannot authorize writes until decomposed into a
narrow subcategory.

Each ownership entry also declares a full category suite. Patch plans may add
targeted tests, but the category suite is non-negotiable.

```yaml
smoke_contract_gap:
  categorySuite:
    - node --import tsx --test tests/smoke-test-static-rules.test.ts
    - node --import tsx --test tests/platform-invariants/smoke-invariants.test.ts

design_import_gap:
  categorySuite:
    - node --import tsx --test tests/stitch-to-jsx.test.ts tests/generated-screen-validator.test.ts
    - node --import tsx --test tests/platform-invariants/design-import-invariants.test.ts
```

## Immutable Platform Invariants

Self-heal can edit platform code, but it cannot edit invariant tests.

Immutable tests live under:

```text
tests/platform-invariants/**
tests/immutable/**
```

The write interceptor rejects any attempt to modify these paths. These tests
protect minimum platform strictness, including:

- unknown Stitch icons fail instead of silently degrading
- missing generated screens fail setup/build gates
- QA interactions cannot pass without real interaction evidence
- smoke tests cannot pass by counting fake hash navigation
- final-test cannot complete without structured evidence
- platform failures cannot be resolved by deleting throw/error/fail paths
- failed/cancelled project visibility policy remains explicit

Immutable tests are not generated by the self-healer and are not listed in
`targetFiles`.

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
- Targeted tests are additive; the full category suite and immutable tests still run.
- No project/domain-specific hardcoding.
- No resume without replay or targeted evidence.
- Same failure recurring after the patch invalidates the patch result.
- Build success alone is not enough; targeted regression evidence is required.
- The LLM cannot mark the patch successful; Setfarm gates do.
- Patch plans that remove assertions, error throws, hard failures, or threshold
  checks require an explicit strictness-delta review and cannot auto-advance on
  LLM rationale alone.

## Write Interceptor

Ownership is enforced at write time, not only by post-hoc diff review.

The platform repair runner wraps all patch writes. Every attempted write path is
checked against:

- `PATCH_PLAN.targetFiles`
- the ownership map for the failure category
- forbidden immutable paths
- configured Mission Control source roots

A write outside the allowed set fails immediately, records
`platform_self_heal.blocked`, and triggers rollback if any file content changed.
Post-hoc git diff validation still runs as a second-line defense.

## Strictness Delta Analyzer

Before a patch can pass, Setfarm analyzes the diff for likely reward hacking.

The analyzer flags:

- deleted `throw`, `process.exit`, `return false`, or hard-fail branches
- changed thresholds that make checks easier to pass
- removed assertions
- removed validator cases
- deleted smoke/QA/final-test evidence requirements
- tests whose expected failures were changed into expected passes

Flagged patches are shown in MC as `strictness_delta=high` and cannot
auto-resume. They require human approval or a separate immutable invariant test
that proves strictness was preserved.

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
    PRE_PATCH_HASHES.json
    strictness-delta.json
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

Before patching, Setfarm stores the exact content hash and contents of every
target file. Rollback restores this captured pre-patch state, not git HEAD. This
is required for dirty local repos.

## Resume Policy

Patch success can trigger one of three policies:

- `resume_same_run`: continue the current run after platform repair.
- `replay_failed_step`: rerun only the failed step.
- `start_clean_replay`: restart the same prompt from a clean run.

Defaults:

- QA/final/smoke/MC visibility bugs: `replay_failed_step`.
- setup/design/validator bugs: `start_clean_replay`.
- infrastructure health bugs: `start_clean_replay` unless proven runtime-only.

`resume_same_run` is deferred for platform code patches because the active Node
orchestrator may have cached old modules. The first implementation must use
`replay_failed_step` or `start_clean_replay`. A future `resume_same_run` mode
requires a process restart contract that serializes run state, restarts the
orchestrator, verifies the new code is loaded, and resumes from the persisted
state.

After any platform patch, the remainder of the run enters audit mode: it may
collect extra evidence, but a second self-heal patch in the same run requires an
elevated threshold and defaults to plan-only unless explicitly allowed.

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

The drawer also shows a `Strictness Delta` section:

- removed assertions
- relaxed thresholds
- deleted hard failures
- deleted evidence requirements
- changed expected failures in tests
- immutable invariant results

Operators must be able to revert a platform self-heal patch from MC. Revert
creates a new observation, restores the registered patch delta, and marks the
affected patch registry entry as reverted.

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
platform_self_heal.strictness_delta_flagged
platform_self_heal.operator_approval_required
platform_self_heal.reverted
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
4. Blue classifier writes a proposed `FAILURE_ROUTE.json`.
5. Red classifier attempts to invalidate the platform classification.
6. Mechanical corroboration checks run.
7. If policy allows repair, Setfarm prepares a platform repair workspace.
8. Codex produces `PATCH_PLAN.json`.
9. Setfarm validates target files against ownership map.
10. Setfarm captures pre-patch file hashes and contents.
11. Codex applies the patch through the write interceptor.
12. Setfarm captures `patch.diff` and `strictness-delta.json`.
13. Setfarm runs targeted tests, full category suite, immutable tests, and build checks.
14. If tests fail, Setfarm restores pre-patch file content hashes.
15. If tests pass, Setfarm registers the platform patch.
16. Setfarm replays/restarts according to resume policy.
17. Mission Control shows all events and artifacts.

## Implementation Components

Setfarm:

- `src/installer/platform-self-heal/config.ts`
- `src/installer/platform-self-heal/classifier.ts`
- `src/installer/platform-self-heal/ownership-map.ts`
- `src/installer/platform-self-heal/workspace.ts`
- `src/installer/platform-self-heal/patch-contract.ts`
- `src/installer/platform-self-heal/runner.ts`
- `src/installer/platform-self-heal/resume.ts`
- `src/installer/platform-self-heal/write-interceptor.ts`
- `src/installer/platform-self-heal/strictness-delta.ts`
- `src/installer/platform-self-heal/patch-registry.ts`
- `src/installer/platform-self-heal/known-failure-patterns.json`
- `src/installer/platform-self-heal/patch-registry.json`

Mission Control:

- API endpoint for self-heal artifacts under run detail.
- Self-heal lane in run operations view.
- Patch drawer with diff/test/result tabs.

Tests:

- env policy parsing
- failure classification
- Red/Blue adversarial classification
- mechanical corroboration gating
- known failure pattern matching
- ownership enforcement
- target file validation
- write interceptor rejection
- immutable invariant protection
- strictness delta detection
- full category suite enforcement
- hash-based rollback
- patch registry registration
- ambiguous reclassification and escalation
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
- Writes outside `targetFiles` are rejected at write time, not only after diff review.
- Immutable invariant tests cannot be modified by self-heal.
- Classification above patch threshold requires mechanical corroboration.
- Red classifier must fail to disprove platform-failure classification before patching.
- Production code patch without targeted regression evidence is rejected.
- Production code patch without full category suite and immutable test pass is rejected.
- Project/domain hardcodes are rejected.
- Failed tests trigger rollback to pre-patch file hashes when rollback env is enabled.
- Repeated identical failure after patch blocks the patch as unsuccessful.
- `resume_same_run` is unavailable for platform code patches until process restart/resume is implemented.
- MC exposes strictness delta, diff, tests, rollback, and patch registry lineage.

## Risks And Mitigations

- Risk: self-heal corrupts Setfarm. Mitigation: target file enforcement, tests, rollback, max patches per run, env kill switch.
- Risk: self-heal hides project bugs as platform bugs. Mitigation: confidence thresholds, ambiguous classification, replay evidence.
- Risk: self-heal reward-hacks tests. Mitigation: immutable invariants, strictness delta analyzer, full category suite, Red classifier.
- Risk: active process executes old cached code after patch. Mitigation: defer `resume_same_run`; use replay/clean replay until restart contract exists.
- Risk: dirty repo rollback loses user changes. Mitigation: pre-patch content hash capture and restore.
- Risk: MC becomes noisy. Mitigation: one self-heal lane with expandable cards and drawer detail.
- Risk: LLM makes broad architecture edits. Mitigation: ownership map and patch plan target-file gate.

## Rollout

Phase 1: plan-only classifier, Red/Blue review, mechanical corroboration, and artifacts.

Phase 2: immutable invariants, write interceptor, strictness delta analyzer, hash rollback, patch registry.

Phase 3: patch-only for smoke, QA, final-test, and narrow MC visibility categories.

Phase 4: local replay mode after three reviewed patch-only successes.

Phase 5: server rollout in plan-only mode.

Phase 6: server patch-only after local false-classification rate is measured and acceptable.

Phase 7: patch-and-resume only after process restart/resume, honeypot tests, immutable invariants, and patch registry validation are proven.

## Mandatory Honeypot Tests

Before `patch_and_resume` is enabled anywhere, these tests must pass:

| Test | Required Result |
|---|---|
| Known broken generated app is misrouted as platform failure | Patch is blocked |
| Known platform failure is routed to the correct owned paths | Patch plan is created |
| Patch plan includes non-owned file | Plan validation fails |
| Patch attempts to write file not in `targetFiles` | Write interceptor blocks immediately |
| Patch attempts to edit immutable tests | Write interceptor blocks immediately |
| Targeted tests pass but full category suite fails | Patch rolls back |
| Tests fail in dirty repo | Rollback restores pre-patch file hashes |
| Diff removes hard failure path | Strictness delta blocks auto-resume |
| Same failure recurs after replay | Second patch requires elevated threshold or blocks |
| `SETFARM_PLATFORM_SELF_HEAL=off` | No classification, plan, artifact, or patch |
| `plan_only` | Artifacts written, no edits |
| `patch_only` | Edits and tests run, no resume |
| Ambiguous classification remains ambiguous after one recheck | MC human-review notification |
| `MAX_PATCHES_PER_RUN=1` | Second patch in same run is blocked |
