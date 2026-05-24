# Setfarm Implement Full-Gate And Repair Contract

Date: 2026-05-23

Status: review draft for external Gemini/Sonnet critique.

This document extends the Setfarm pipeline final plan. It focuses only on the
`IMPLEMENT` step and its retry, review, supervisor, and repair boundaries.

## Reviewer Prompt

You are reviewing Setfarm, a contract-led autonomous software generation
pipeline.

Please critique this IMPLEMENT architecture as an adversarial senior platform
orchestration engineer. Do not give generic praise. Focus on contradictions,
missing contracts, brittle handoffs, weak gates, retry loops that can damage the
system, places where agents can still overreach, and places where the design is
too strict or too loose.

Context:

- The pipeline order is:
  `PLAN -> DESIGN -> STORIES -> SETUP-REPO -> SETUP-BUILD -> IMPLEMENT -> VERIFY -> SECURITY -> QA -> FINAL`.
- PLAN owns product behavior.
- DESIGN/Stitch owns UI design for UI-bound stacks.
- STORIES owns logical implementation slices, not physical file paths.
- SETUP-BUILD resolves logical story targets into physical files through stack
  pack `targetResolutionRules`.
- SETUP-BUILD emits `SETUP_CERTIFICATE.json` and `FILE_TREE_MANIFEST.json`.
- MC assembles a per-story `IMPLEMENT_CONTEXT.json` immediately before each
  story implementation attempt.
- IMPLEMENT must not invent files, dependencies, routes, setup behavior, or
  design authority outside its context.

Questions to answer:

1. Is the full-gate model strict enough to prevent incomplete story completion?
2. Is the blocker ledger model safe enough, or can agents still bypass review or
   supervisor feedback?
3. Is the retry and supervisor repair ladder strong enough without letting
   supervisors freely damage the system?
4. Are `IMPLEMENT_CONTEXT.json`, `BLOCKER_LEDGER`, `REPAIR_CONTRACT`, and
   `IMPLEMENT_EVIDENCE` separated correctly?
5. Which fields are still missing before implementation starts?
6. Which gates can produce false positives or false negatives?
7. Is the model escalation path safe?
8. What exact changes should be made before coding this refactor?

Return the answer in this structure:

- Critical Issues
- Missing Contracts
- Risky Assumptions
- Recommended Schema/Rule Changes
- Gate And Retry Adjustments
- Implementation Order
- Final Verdict

## Goal

IMPLEMENT must become a deterministic execution step, not a loose coding loop.

A story can pass only when Setfarm verifies that:

- all open blocker checklist items are closed by evidence
- PR review comments are resolved or explicitly classified as non-actionable by
  the gate, not by the implement agent
- supervisor blockers are closed
- owned actions and acceptance criteria are implemented
- build/test/smoke evidence is current
- changed files stay inside per-story ownership permissions
- setup-owned and forbidden files are untouched
- shared files are edited only under explicit edit scopes
- dependency policy is obeyed
- runtime state and UI behavior are verifiable when applicable

The implement agent may write code. It may not decide whether the story is truly
done. Setfarm gates decide that.

## Non-Goals

This spec does not reopen PLAN, DESIGN, STORIES, SETUP-REPO, or SETUP-BUILD
architecture except where IMPLEMENT needs their contracts.

This spec does not allow local fallback design.

This spec does not allow supervisors, repair agents, or stronger models to
bypass file ownership, design authority, dependency policy, or setup ownership.

This spec does not introduce project-specific rules. All rules must work across
web, mobile, desktop, API, CLI, browser-game, and backend stacks.

## Core Decisions

### 1. Full Gate Is Mandatory

`IMPLEMENT` does not advance because an agent reports `STATUS: done`.

`IMPLEMENT` advances only when the story gate report proves:

- no open blocker items remain
- no stale PR comments remain actionable
- no supervisor blocker remains open
- no story acceptance criterion remains unverified
- no owned action remains unimplemented
- no required evidence is missing
- no forbidden file was touched
- no setup-owned file drift occurred
- no dependency change occurred outside the stack pack policy
- no build/test/smoke gate failed

### 2. Structured Blockers Are Authoritative

Reviewer, supervisor, verify, security, QA, build, runtime, and scope feedback is
normalized into structured blocker items before the implement agent receives it.

Prose feedback is context only. It is never the authoritative source of what must
be fixed.

### 3. MC Owns The Canonical Blocker Ledger

The canonical blocker ledger lives in MC/runtime state. The agent receives a
read-only snapshot through `IMPLEMENT_CONTEXT.json`.

Agents do not edit the canonical ledger. They submit closure evidence. MC
validates that evidence and updates the ledger.

Generated repo-local files may exist for auditability, but they are snapshots,
not authority.

### 4. Retry Failure Escalates To Controlled Repair

If normal retries cannot close a blocker, Setfarm does not let the agent keep
looping or broaden its own scope.

After the retry limit, supervisor produces a `REPAIR_CONTRACT`. Then MC launches
a repair implement pass that may use a stronger or different model, but still
uses the same gates and least-privilege scope.

Supervisor diagnosis is allowed. Unbounded supervisor editing is not allowed.

### 5. Agents Never Grade Their Own Evidence

Implement agents may report what they changed and which blocker they believe was
addressed. They may not grade build, test, smoke, runtime, dependency, or scope
evidence.

MC executes required commands, captures outputs, stores artifacts, and derives
pass/fail status independently.

## Implement Context V2

`IMPLEMENT_CONTEXT.json` is assembled per story and per attempt.

It is not a generic run context. It is a least-privilege execution contract.

Required shape:

```json
{
  "schema": "setfarm.implement-context.v2",
  "runId": "",
  "storyId": "US-001",
  "contextVersion": 1,
  "setupCertificateVersion": 1,
  "fileTreeManifestVersion": 1,
  "sharedGrantsVersion": 1,
  "storyContractVersion": 1,
  "attempt": {
    "attemptCount": 1,
    "maxAttempts": 3,
    "mode": "normal | retry | repair",
    "retryFingerprint": null
  },
  "project": {
    "projectName": "",
    "projectSlug": "",
    "platform": "",
    "techStack": "",
    "stackPackId": ""
  },
  "story": {
    "title": "",
    "type": "app_shell | feature_surface | shared_state | integration | api | cli | game_runtime | nonvisual",
    "dependsOn": [],
    "acceptanceCriteria": [],
    "implementationContract": {}
  },
  "resolvedScope": {
    "ownedFiles": [],
    "ownedTargets": [],
    "generatedDesignFiles": [],
    "ownedSurfaces": [],
    "ownedScreenIds": [],
    "ownedActions": []
  },
  "sharedEditableFiles": [
    {
      "path": "src/App.tsx",
      "allowedForThisStory": true,
      "editScope": "route_registration_only",
      "grantedBy": "GRANT-US001-ROUTE-001",
      "allowedOperations": ["import_component", "append_route", "wire_nav_item"],
      "forbiddenOperations": ["rewrite_app_shell", "replace_router", "remove_existing_routes"]
    }
  ],
  "forbiddenFiles": [],
  "setupOwnedFiles": [],
  "dependencyPolicy": {
    "canAddDependencies": false,
    "allowedDependencies": [],
    "installedDependencies": [],
    "importNamespaces": [],
    "dependencyEvidencePath": ".setfarm/setup/DEPENDENCY_EVIDENCE.json"
  },
  "sharedGrantPolicy": {
    "sharedGrantsPath": ".setfarm/setup/SHARED_GRANTS.json",
    "grantIds": []
  },
  "designAuthority": {
    "required": true,
    "manifestPath": "stitch/DESIGN_MANIFEST.json",
    "screenMapPath": "stitch/SCREEN_MAP.json",
    "uiContractPath": "stitch/UI_CONTRACT.json",
    "conversionPolicy": "wrap_jsx | reference_only | native_equivalent | none",
    "conversionNote": ""
  },
  "mockDataContract": {
    "strategy": "fixture_files | seed_function | inline_constants",
    "requiredEntities": [],
    "requiredStates": [],
    "injectionBoundary": ""
  },
  "routeGuardPolicy": {
    "publicSurfaces": [],
    "protectedSurfaces": [],
    "redirectOnUnauthorized": null,
    "guardImplementationOwner": "STORIES_ASSIGNED",
    "implementationMode": "plumbing_only_until_surface_routes_exist"
  },
  "requiredEvidence": {
    "commands": [
      {
        "cmd": "npm run build",
        "executor": "MC_SANDBOX",
        "captureStdout": true,
        "captureStderr": true,
        "requiredWhen": "always | files_changed",
        "timeoutMs": 120000,
        "memoryMb": 2048,
        "maxStdoutBytes": 120000,
        "maxStderrBytes": 120000,
        "networkPolicy": "none | localhost_only | allowlist",
        "allowedHosts": [],
        "portPolicy": "allocated_by_mc",
        "abortOnStderr": false
      }
    ],
    "runtimeChecks": [],
    "actionChecks": [],
    "scopeChecks": [],
    "visualChecks": [],
    "verificationMode": "automated | command_output | manual_only"
  },
  "blockerSnapshot": {
    "source": "MC_BLOCKER_LEDGER",
    "openBlockers": [],
    "closedBlockers": []
  },
  "assemblyRules": {
    "scopeResolution": "Use SETUP_CERTIFICATE targetResolutionRules and FILE_TREE_MANIFEST only. The agent never resolves paths.",
    "sharedEditConflict": "forbiddenFiles and setupOwnedFiles beat SHARED_GRANTS. Denied or missing grants fail before IMPLEMENT.",
    "dependencyCheck": "dependencies may be used only if present in installedDependencies or allowedDependencies with setup evidence.",
    "dependencyReadiness": "all dependsOn story IDs must have passed their full gate before this story runs unless marked shared/nonvisual by STORIES.",
    "blockerAuthority": "openBlockers are authoritative. Prose feedback is context only.",
    "stalenessCheck": "contextVersion, setupCertificateVersion, fileTreeManifestVersion, sharedGrantsVersion, and storyContractVersion must match RuntimeState before the attempt starts."
  }
}
```

Rules:

- `ownedFiles` and `sharedEditableFiles` are the only writable file sets.
- Every `sharedEditableFiles[]` item must reference a granted
  `SHARED_GRANTS.json` grant id.
- `forbiddenFiles` and `setupOwnedFiles` are hard deny lists.
- `sharedEditableFiles[].editScope` must be narrow and actionable.
- Any missing `ownedActions` or `acceptanceCriteria` evidence fails the story.
- `dependencyPolicy.canAddDependencies=false` by default.
- A repair pass receives the same structure with `attempt.mode="repair"` and an
  attached `REPAIR_CONTRACT`.
- `story.type` controls conditional gates. `feature_surface` stories require
  owned surface/screen/action evidence. `app_shell`, `api`, `cli`, and
  `nonvisual` stories do not require UI screen ownership unless explicitly
  declared.
- `requiredEvidence.commands[].executor` must be `MC` for gate-critical commands.
  The canonical executor name is `MC_SANDBOX`; legacy `MC` is normalized to
  `MC_SANDBOX`.
  Agent-reported command status is ignored.
- `IMPLEMENT_CONTEXT_STALE` blocks an attempt when context versions do not match
  RuntimeState, queues automatic MC context re-assembly, and blocks only if
  re-assembly fails.

## Blocker Ledger

The blocker ledger is canonical in MC/runtime state.

Each blocker item has this shape:

```json
{
  "id": "BLK-US001-VERIFY-001",
  "runId": "",
  "storyId": "US-001",
  "source": "verify | reviewer | supervisor | security | qa | build | test | runtime_guard | scope_guard | design_guard",
  "severity": "blocking | warning",
  "status": "open | fixed_pending_validation | closed | waived | warning_carry_forward",
  "retryFingerprint": "",
  "attemptCount": 1,
  "maxAttempts": 3,
  "createdAt": "",
  "updatedAt": "",
  "summary": "",
  "proseContext": "",
  "fileRefs": [],
  "surfaceIds": [],
  "screenIds": [],
  "actionIds": [],
  "requiredChange": "",
  "acceptanceCheck": "",
  "evidenceRequired": {
    "commands": [],
    "runtimeChecks": [],
    "fileChecks": [],
    "manualChecks": []
  },
  "closureEvidence": null,
  "waiver": null
}
```

Rules:

- `status=closed` can be set only by MC after validation.
- `status=waived` is human-only and requires an explicit reason and evidence.
  Agents and autonomous supervisors cannot waive blockers.
- `status=warning_carry_forward` is allowed only for `severity=warning`. It
  does not close or waive a blocker and must remain visible in the dashboard.
- `proseContext` can help the agent understand the issue, but `requiredChange`
  and `acceptanceCheck` define the actual work.
- `retryFingerprint` is deterministic and MC-generated. Agents never invent it.
- If a blocker repeats with the same fingerprint after `maxAttempts`, it
  escalates to supervisor repair.
- Every PR review comment is normalized into a blocker item. Non-blocking nits
  become `severity=warning`; actionable comments become `severity=blocking`.
  The implement agent never decides whether a PR comment is non-actionable.

## Human Review Request

Human-only waivers and human review exits require an explicit artifact. A
dashboard status alone is not enough to resume a blocked story.

Required shape:

```json
{
  "schema": "setfarm.human-review-request.v1",
  "runId": "",
  "storyId": "",
  "reason": "",
  "blockerIds": [],
  "requestedResolution": "waive | rollback | accept_as_is | escalate",
  "resolution": null,
  "resolvedBy": "",
  "resolvedAt": "",
  "notes": "",
  "artifactRefs": []
}
```

Rules:

- MC creates this artifact when a gate requires human review.
- `status=waived` or `human_review -> passed` is impossible without a resolved
  `HUMAN_REVIEW_REQUEST.json`.
- Autonomous agents and supervisors cannot populate `resolvedBy` or create a
  waiver resolution.
- Missing required human review evidence fails `HUMAN_REVIEW_REQUEST_MISSING`.

Retry fingerprint normalization:

```text
retryFingerprint =
  sha256(
    schemaVersion,
    runPhase,
    storyId,
    blockerId,
    gateCode,
    blockerSource,
    normalizedAffectedFiles,
    normalizedCommandId,
    normalizedErrorCode,
    normalizedLineSpan,
    normalizedRootCauseCategory
  )
```

Rules:

- Do not include attempt count, timestamp, random ids, raw absolute paths, or
  unbounded stderr.
- Normalize paths relative to the project root.
- Strip ANSI codes, collapse whitespace, normalize line endings, and byte-limit
  command excerpts before deriving error code/line span.
- Prefer stable compiler/test error codes when available. If no code exists,
  use normalized file path plus line span plus gate code.
- Use blocker id for deduplication when the same blocker reopens. Similar text
  from a different blocker must not immediately escalate.
- `retryFingerprint` is used for retry loop detection only; it is not a proof of
  root cause equality.

## Canonical Runtime State

MC keeps canonical story state outside agent-editable context.

Required shape:

```json
{
  "schema": "setfarm.runtime-state.v1",
  "runId": "",
  "setupCertificateVersion": 1,
  "fileTreeManifestVersion": 1,
  "sharedGrantsVersion": 1,
  "storyContractVersion": 1,
  "rollbackEpoch": 0,
  "stories": {
    "US-001": {
      "status": "pending | in_progress | passed | retry | repair_required | regression_pending | human_review | failed",
      "validationState": "unverified | verified | pending_regression_check | stale_after_rollback",
      "attemptCount": 1,
      "latestGateReportPath": ".setfarm/gates/US-001/1-gate-report.json",
      "openBlockerCount": 0,
      "dependsOn": [],
      "lastContextVersion": 1,
      "lastVerifiedAgainst": {
        "setupCertificateVersion": 1,
        "fileTreeManifestVersion": 1,
        "sharedGrantsVersion": 1,
        "storyContractVersion": 1,
        "rollbackEpoch": 0
      }
    }
  }
}
```

Rules:

- MC uses this state for dependency readiness, dashboard current state, and
  story advancement.
- Gate reports are audit artifacts. Runtime state is the canonical current
  status.
- Agents cannot edit runtime state.
- Runtime state updates only after MC validation.

Rollback invalidation rules:

- Setup/build rollback writes a new setup certificate version. The previous
  certificate remains immutable historical evidence.
- Stories already marked `passed` are not erased, but their `validationState`
  becomes `pending_regression_check` when the rollback could affect them.
- If MC cannot prove the rollback impact set, all previously passed stories move
  to `pending_regression_check`.
- A story in `pending_regression_check` cannot unblock dependent stories or final
  pass until MC reruns its declared regression smoke/test evidence.
- Story decomposition rollback increments `storyContractVersion` and marks all
  stories affected by changed ownership, dependencies, or action coverage as
  `stale_after_rollback`.
- Regression checks reuse existing code unless failures prove rework is needed.
  This avoids forcing passed stories back into implementation without evidence.

Context re-assembly event:

```json
{
  "schema": "setfarm.context-reassembly-event.v1",
  "trigger": "rollback | stale_detected | manual",
  "reassemblyAttempt": 1,
  "maxReassemblies": 3,
  "affectedStories": [],
  "fromVersion": {
    "setupCertificateVersion": 1,
    "fileTreeManifestVersion": 1,
    "sharedGrantsVersion": 1,
    "storyContractVersion": 1
  },
  "toVersion": {
    "setupCertificateVersion": 2,
    "fileTreeManifestVersion": 2,
    "sharedGrantsVersion": 1,
    "storyContractVersion": 1
  },
  "previousContextHash": "",
  "newContextHash": "",
  "assembledBy": "MC",
  "artifactPaths": [],
  "status": "pass | fail",
  "failureCategory": "stale_context | state_corruption | infrastructure | contract | null"
}
```

Rules:

- `IMPLEMENT_CONTEXT_STALE` queues this event automatically.
- MC assembles fresh contexts before retrying the story or regression check.
- If re-assembly emits the same context hash/version as the stale context, MC
  increments `reassemblyAttempt` and retries only up to `maxReassemblies`.
- Repeating the same stale result or exceeding `maxReassemblies` fails with
  `MC_REASSEMBLY_LOOP_DETECTED` and classifies the failure as
  `state_corruption` or `contract`.
- A failed re-assembly becomes `CONTEXT_REASSEMBLY_FAILED` with an explicit
  `failureCategory`; a stale context alone does not go to human review.

Regression evidence:

```json
{
  "regressionEvidence": {
    "required": true,
    "triggeredBy": "rollback_epoch_mismatch | dependency_changed | target_resolution_changed",
    "commands": [],
    "runtimeChecks": [],
    "status": "not_run | pass | fail",
    "gateReportPath": ""
  }
}
```

Regression failure workflow:

- If regression evidence passes, the story returns to `status=passed` and
  `validationState=verified` against the new versions.
- If regression evidence fails, MC emits `REGRESSION_FAILURE`, sets the story to
  `repair_required`, and generates a `REPAIR_CONTRACT` limited to adapting the
  previously verified code to the new setup/story baseline.
- Regression repair cannot add feature scope. New dependency or stack gaps must
  go through the normal rollback matrix.
- Regression repair uses `repairClass="regression"`, forces
  `featureScopeExpansion="forbidden"`, and requires `scopeAmendment=null`.
- Dependent stories remain blocked by `ROLLBACK_REGRESSION_CHECK_PENDING` until
  the regression story is verified again.

Systemic failure state:

```json
{
  "systemicFailureState": {
    "active": false,
    "gateCode": null,
    "rootCauseCategory": null,
    "class": "infrastructure | contract | logic",
    "affectedStories": [],
    "detectedAt": null,
    "resumePolicy": "backoff_retry | stack_pack_review | human_review",
    "resolvedAt": null
  }
}
```

Rules:

- Infrastructure systemic failures use backoff/retry first.
- Contract or logic systemic failures halt story advancement until stack-pack,
  setup, or contract review resolves them.
- Resume requires a new versioned artifact or explicit human resolution note.

## Implement Output Contract

Every implement attempt must output a structured completion contract.

Required shape:

```json
{
  "schema": "setfarm.implement-output.v2",
  "status": "done | blocked | failed",
  "storyId": "US-001",
  "attemptCount": 1,
  "changedFiles": [],
  "blockersClosed": [
    {
      "blockerId": "BLK-US001-VERIFY-001",
      "summary": "",
      "evidence": {
        "filesChanged": [],
        "commandsRun": [],
        "runtimeChecks": [],
        "notes": ""
      }
    }
  ],
  "acceptanceEvidence": [
    {
      "criterion": "",
      "evidence": ""
    }
  ],
  "ownedActionEvidence": [
    {
      "actionId": "ACT_SAVE_RECORD",
      "implemented": true,
      "evidence": ""
    }
  ],
  "evidenceHints": {
    "commandsTheAgentBelievesAreRelevant": [],
    "manualNotes": ""
  },
  "scopeDeclaration": {
    "onlyOwnedFilesChanged": true,
    "sharedFilesChangedWithinEditScope": true,
    "forbiddenFilesTouched": false,
    "setupOwnedFilesTouched": false
  }
}
```

Rules:

- The agent's output is a claim, not proof.
- MC validates the claim against git diff, command logs, runtime checks, and
  blocker ledger.
- MC executes required commands independently. Agent command pass/fail claims are
  not accepted as gate evidence.
- Missing evidence leaves blockers open.
- False scope declarations fail the attempt.

## MC Evidence Runner

MC owns gate-critical command execution.

Required behavior:

- read `IMPLEMENT_CONTEXT.requiredEvidence.commands`
- execute each required command when its `requiredWhen` condition applies
- capture stdout, stderr, exit code, duration, and environment summary
- store output as an artifact with byte-limited excerpts for model context
- update blocker ledger and gate report from actual command results
- re-run build/test/smoke on every retry that changes source/runtime files
- skip command execution only when no relevant files changed and the evidence
  rule allows `requiredWhen=files_changed`

Agent terminal output is advisory only.

### MC Execution Sandbox

MC must run evidence commands inside a bounded sandbox. A command that hangs,
spawns an infinite process, opens unauthorized network egress, or exceeds memory
is a gate failure, not an orchestrator failure.

Command contract:

```json
{
  "cmd": "npm run test",
  "executor": "MC_SANDBOX",
  "cwd": "project_root",
  "timeoutMs": 30000,
  "memoryMb": 2048,
  "maxStdoutBytes": 120000,
  "maxStderrBytes": 120000,
  "networkPolicy": "none | localhost_only | allowlist",
  "allowedHosts": [],
  "portPolicy": "allocated_by_mc",
  "envPolicy": "setup_certificate_plus_mc_runtime_only",
  "abortOnStderr": false
}
```

Rules:

- Every MC-executed command has an absolute timeout.
- Long-running dev servers are started only through MC-managed port allocation
  and killed by MC after smoke evidence is collected.
- Network is denied by default for build/test/smoke unless the stack pack
  declares a specific allow-list.
- Toolchain downloads and browser binary installs must be completed during
  SETUP-BUILD `sandboxPrewarm`. IMPLEMENT evidence commands should not need
  external network for ordinary build/test/smoke.
- If supervisor repair triggers a SETUP-BUILD dependency amendment or package
  manifest change, patch mode must rerun `sandboxPrewarm` and issue fresh
  prewarm evidence before IMPLEMENT resumes. Otherwise MC must fail before
  sandboxed evidence commands with `SANDBOX_PREWARM_MISSING`, not wait for a
  later network violation.
- Captured output is stored in full as an artifact and injected into model
  context only as byte-limited excerpts.
- Sandbox failures create structured blockers with specific gate codes.

Sandbox gate codes:

```text
MC_EXECUTION_TIMEOUT
MC_EXECUTION_OOM
MC_NETWORK_POLICY_VIOLATION
MC_PORT_ALLOCATION_FAILED
MC_COMMAND_ARTIFACT_MISSING
```


## Full Gate Report

After each implement attempt, MC writes a gate report.

Required shape:

```json
{
  "schema": "setfarm.story-gate-report.v1",
  "runId": "",
  "storyId": "US-001",
  "attemptCount": 1,
  "status": "pass | retry | repair_required | human_review | fail",
  "checks": {
    "scope": "pass | fail",
    "setupOwnedDrift": "pass | fail",
    "forbiddenFiles": "pass | fail",
    "sharedEditScopes": "pass | fail",
    "dependencies": "pass | fail",
    "acceptanceCriteria": "pass | fail",
    "ownedActions": "pass | fail",
    "blockers": "pass | fail",
    "build": "pass | fail",
    "tests": "pass | fail",
    "runtimeSmoke": "pass | fail | not_applicable",
    "designCompliance": "pass | fail | not_applicable",
    "regression": "pass | fail | not_applicable"
  },
  "regressionEvidence": {
    "required": false,
    "status": "not_run | pass | fail",
    "triggeredBy": null,
    "artifactPaths": []
  },
  "openBlockers": [],
  "closedBlockers": [],
  "newBlockers": [],
  "nextAction": "advance_story | retry_same_story | supervisor_repair | human_review"
}
```

Pass requires every applicable check to pass.

Gate applicability by story type:

| story.type | designCompliance | owned screens | owned surfaces | runtime smoke |
| --- | --- | --- | --- | --- |
| `app_shell` | not_applicable unless app shell owns visible shell | false | false | applicable for UI apps |
| `feature_surface` | applicable | true | true | applicable for UI apps |
| `shared_state` | not_applicable | false | false | conditional |
| `integration` | conditional | false unless declared | false unless declared | conditional |
| `api` | not_applicable | false | false | command/endpoint evidence |
| `cli` | not_applicable | false | false | command evidence |
| `game_runtime` | conditional | false | conditional | applicable |
| `nonvisual` | not_applicable | false | false | conditional |

Design compliance evidence tiers:

- Tier 0: required design artifacts exist and are non-empty.
- Tier 1: manifest/screen/surface/action mapping matches the story contract.
- Tier 2: DOM or native semantic evidence shows owned actions, labels, states,
  and inline surfaces when applicable.
- Tier 3: visual evidence verifies screenshots/canvas/native rendering for
  blankness, major layout overflow, and token drift-sensitive changes.

Each stack pack declares which tiers apply. `feature_surface` web stories require
Tier 0-2 by default. Browser-game UI/HUD stories require Tier 3 canvas/visual
evidence when canvas is the primary render surface.

## Retry Ladder

Retry is deterministic.

```text
attempt 1 -> normal implement
attempt 2 -> retry with open blocker checklist only
attempt 3 -> retry with narrowed blocker checklist and stronger instructions
after attempt 3 failure -> supervisor diagnosis and REPAIR_CONTRACT
repair pass -> controlled implement pass, optionally with a stronger/different model
repair failure -> human review or explicit halt
```

Rules:

- Retry context contains only open blockers plus necessary story/design/setup
  context.
- Closed blockers are summarized, not fully re-injected.
- Same `retryFingerprint` cannot loop indefinitely.
- A retry may not broaden scope unless MC issues an explicit scope amendment.
- A retry may not add dependencies unless setup/build already approved them.
- Attempt 3 may include supervisor diagnosis as context, but it is not yet a
  scope-broadening repair pass. Scope changes require a validated
  `REPAIR_CONTRACT`.

## Supervisor Repair Contract

Supervisor repair is controlled. It is not a permission to freely modify the
repository.

`REPAIR_CONTRACT.json` shape:

```json
{
  "schema": "setfarm.repair-contract.v1",
  "runId": "",
  "storyId": "US-001",
  "repairClass": "feature | regression | scope_amendment",
  "featureScopeExpansion": "forbidden | allowed_by_contract",
  "sourceBlockers": [],
  "diagnosis": "",
  "rootCauseCategory": "missing_context | wrong_file_scope | bad_implementation | flaky_tool | ambiguous_contract | stack_gap | design_gap | test_gap",
  "repairScope": {
    "ownedFiles": [],
    "sharedEditableFiles": [],
    "forbiddenFiles": [],
    "setupOwnedFiles": [],
    "allowedOperations": [],
    "forbiddenOperations": []
  },
  "modelPolicy": {
    "allowModelEscalation": true,
    "recommendedModelClass": "same | stronger_reasoning | code_specialist",
    "reason": ""
  },
  "requiredChange": "",
  "acceptanceCheck": "",
  "requiredEvidence": {
    "commands": [],
    "runtimeChecks": [],
    "fileChecks": []
  },
  "scopeAmendment": null,
  "scopeAmendmentRules": {
    "cannotInclude": ["forbiddenDuringImplement", "setupOwnedFiles", "otherStoryOwnedFiles"],
    "mustReferenceFileTreeManifest": true,
    "requiresMcValidation": true,
    "mustMapToExistingLogicalTarget": true,
    "cannotCreateNewSharedFileWithoutRollback": true
  },
  "dependencyAmendment": {
    "add": [],
    "requiresSetupBuildPatch": false,
    "reason": ""
  },
  "pipelineEscalation": {
    "requiresRollbackTo": "SETUP_BUILD | STORIES | null",
    "requestedDependencies": [],
    "reason": ""
  }
}
```

Rules:

- Supervisor must diagnose first.
- Supervisor does not directly edit code in the normal path.
- `repairClass=regression` is used only for rollback/regression adaptation. It
  must set `featureScopeExpansion=forbidden`, `scopeAmendment=null`, and may not
  add new product behavior.
- `repairClass=feature` fixes the current story inside existing scope.
- `repairClass=scope_amendment` is valid only when MC has proven the original
  context was insufficient and validates the amendment before repair starts.
- A repair implement pass may use a different model, but it remains bound by
  `repairScope`.
- `scopeAmendment` is allowed only when the original context was proven
  insufficient. MC must validate it before repair starts.
- Repair cannot touch setup-owned files unless the pipeline explicitly rolls
  back to setup/build. It cannot silently mutate bootstrap reality.
- Repair cannot bypass design authority for UI-bound stories.
- If repair needs a new dependency, the repair contract must set
  `pipelineEscalation.requiresRollbackTo="SETUP_BUILD"` and include the requested
  dependency. The implement repair pass does not install it directly.
- If repair requires changing story decomposition or ownership, the repair
  contract must set `pipelineEscalation.requiresRollbackTo="STORIES"`.
- `scopeAmendment` cannot include forbidden files, setup-owned files, or files
  owned by other stories unless MC rolls back to the responsible phase and
  regenerates contracts.
- Scope amendment validation always uses the RuntimeState-pinned
  `fileTreeManifestVersion`, `setupCertificateVersion`, and
  `storyContractVersion` from the current attempt. If any version changed after
  diagnosis, MC first performs context re-assembly and then re-validates the
  repair contract.

Scope amendment validation algorithm:

1. Parse `scopeAmendment` into requested files, logical targets, operations, and
   reason.
2. Reject if any requested file is in `forbiddenFiles`,
   `setupOwnedFiles`, or `SETUP_CERTIFICATE.forbiddenDuringImplement`.
3. Reject if any requested file is owned by another story in
   `FILE_TREE_MANIFEST` and not declared shared.
4. Reject if a requested file cannot be traced to an existing logical target,
   shared target, or approved repair dependency amendment.
5. Reject if requested operations are broader than the diagnosis requires.
6. Reject if the amendment would create a new shared utility file without
   rollback to STORIES or SETUP-BUILD.
7. Emit `REPAIR_CONTRACT_INVALID` with the failed rule id when validation fails.

Root cause escalation matrix:

| rootCauseCategory | Required path |
| --- | --- |
| `bad_implementation` | repair same story within current context |
| `missing_context` | reassemble `IMPLEMENT_CONTEXT`; repair only after fresh context |
| `wrong_file_scope` | validate `scopeAmendment`; otherwise rollback to STORIES |
| `flaky_tool` | MC tool reset/retry within sandbox limits |
| `ambiguous_contract` | human review or rollback to originating contract phase |
| `stack_gap` | rollback to SETUP-BUILD |
| `design_gap` | rollback to DESIGN |
| `test_gap` | verify/test contract review; do not edit tests unless test ownership is granted |
| `dependency_gap` | rollback to SETUP-BUILD through `dependencyAmendment` |

Supervisor diagnosis is advisory until MC validates that the requested path
matches this matrix.

## Model Escalation Policy

Model escalation is allowed only as an execution quality change, not as a scope
change.

Rules:

- Escalated models receive the same or narrower context.
- Escalated models receive the same `ownedFiles`, `sharedEditableFiles`, and
  `forbiddenFiles`.
- Escalated models cannot install dependencies.
- Escalated models cannot modify setup-owned files.
- Escalated models cannot waive blockers.
- Escalated models must produce the same implement output contract.

## Gate Codes

Required implement gate codes:

```text
IMPLEMENT_CONTEXT_MISSING
IMPLEMENT_CONTEXT_INVALID
IMPLEMENT_CONTEXT_STALE
CONTEXT_REASSEMBLY_FAILED
MC_REASSEMBLY_LOOP_DETECTED
BLOCKER_LEDGER_MISSING
OPEN_BLOCKERS_REMAIN
BLOCKER_CLOSURE_EVIDENCE_MISSING
PR_REVIEW_COMMENTS_OPEN
SUPERVISOR_BLOCKERS_OPEN
ACCEPTANCE_CRITERIA_UNVERIFIED
OWNED_ACTION_UNIMPLEMENTED
SCOPE_FILE_UNOWNED
SHARED_EDIT_SCOPE_VIOLATION
SHARED_EDIT_AST_UNAVAILABLE
SHARED_TARGET_GRANT_DENIED
PATCH_WINDOW_MARKER_MISSING
ORPHANED_UTILITY_FILE
FORBIDDEN_FILE_TOUCHED
SETUP_OWNED_FILE_DIRTY
DEPENDENCY_POLICY_VIOLATION
DEPENDENCY_EVIDENCE_MISSING
BUILD_FAILED
TEST_FAILED
RUNTIME_SMOKE_FAILED
WINDOW_APP_CONTRACT_MISSING
DESIGN_AUTHORITY_VIOLATION
DESIGN_DOM_ACTION_MISSING
MC_EXECUTION_TIMEOUT
MC_EXECUTION_OOM
MC_NETWORK_POLICY_VIOLATION
ROLLBACK_REGRESSION_CHECK_PENDING
REGRESSION_FAILURE
SYSTEMIC_FAILURE_SUSPECTED
RETRY_LIMIT_EXCEEDED
REPAIR_CONTRACT_MISSING
REPAIR_CONTRACT_INVALID
REPAIR_SCOPE_INVALID
HUMAN_REVIEW_REQUIRED
HUMAN_REVIEW_REQUEST_MISSING
```

Gate failure output must include:

```json
{
  "code": "",
  "storyId": "",
  "attemptCount": 1,
  "maxAttempts": 3,
  "retryFingerprint": "",
  "recoverable": true,
  "requiredAction": "",
  "affectedFiles": [],
  "diffSummary": "",
  "diffExcerpt": "",
  "diffTruncated": false
}
```

Diff excerpts must be byte-limited. Full diffs must be stored as artifacts, not
blindly injected into model context.

Shared edit scope enforcement:

- Line diff checks are insufficient for shared files.
- For supported languages, MC must use AST-aware or parser-aware checks to prove
  the change stayed within the granted edit scope.
- Example: `route_registration_only` may add an import and append a route, but
  must not delete providers, replace routers, rewrite app shell layout, or remove
  existing route entries.
- Stack packs must declare `sharedEditValidationPolicy`:
  `ast_required | patch_window | human_review_required`.
- If AST validation is unavailable and the policy is `ast_required`, fail with
  `SHARED_EDIT_AST_UNAVAILABLE`.
- `patch_window` is valid only when SETUP-BUILD has created marked edit windows
  in shared files. Agents cannot invent patch windows.
- For `patch_window`, MC validates that start/end markers are present exactly
  once, in the expected order, and outside the modified diff except for content
  inside the window.
- Deleted, moved, duplicated, renamed, or widened markers fail
  `PATCH_WINDOW_MARKER_MISSING`.
- A repair pass cannot recreate patch markers. MC may restore exact marker text
  from the setup snapshot only when surrounding code is unchanged; otherwise the
  story goes to human review or rollback to SETUP-BUILD.
- Simple config files must use structured parsers where available. Regex-only
  validation is not accepted for shared code edits.
- If no safe fallback exists, the story goes to human review instead of failing
  open.
- Human approval for `SHARED_EDIT_AST_UNAVAILABLE` creates a human-only waiver
  tied to the exact diff artifact and story attempt. It does not authorize future
  attempts or wider shared-file edits.

Dependency enforcement:

- MC scans changed files for new imports.
- New imports must match `dependencyPolicy.installedDependencies` or
  `dependencyPolicy.importNamespaces`.
- Otherwise `DEPENDENCY_POLICY_VIOLATION` is raised.
- New dependency needs discovered during repair must flow through
  `dependencyAmendment` and SETUP-BUILD rollback.

Systemic failure detection:

- If the same gate code and normalized root cause appears across multiple
  stories in the same stack pack, MC raises `SYSTEMIC_FAILURE_SUSPECTED`.
- Thresholds are stack-pack/runtime configurable:
  `{ storiesInRun, runsWithSamePack, windowDays }`.
- Infrastructure gates such as provider/network/timeouts trigger exponential
  backoff before halt.
- Contract or logic gates such as unresolved targets or repeated scope failures
  halt new story advancement and route to stack-pack/setup review.
- Resume requires `systemicFailureState.resolvedAt` plus a new versioned
  artifact or explicit human resolution note.

Warning carry-forward:

- Human-only `waived` remains the only way to waive a blocking item.
- Autonomous supervisor may mark non-blocking warnings as
  `warning_carry_forward` only when severity is already `warning`, no gate check
  is failing, and the warning has a dashboard-visible follow-up note.
- `warning_carry_forward` cannot turn a blocking item into a pass.
- A warning produced by a failing gate is not eligible for carry-forward until
  the gate passes or a human-only waiver is recorded.
- Warning carry-forward expires before FINAL unless a human review SLA or
  post-review policy is attached by MC/runtime configuration.

## Required Evidence By Platform

### Web / Vite / Next / Static HTML

Required evidence:

- build command passes
- test command passes when available
- runtime smoke passes when dev server can run
- `window.app` or equivalent deterministic bridge exists when required by stack
  contract
- all interactive controls for owned actions are inspectable through DOM or app
  state
- generated UI follows Stitch design authority

`window.app` deterministic bridge contract, when required by stack pack:

```ts
window.app = {
  version: string,
  getState(): unknown,
  getSurfaceState(surfaceId: string): unknown,
  dispatch(actionId: string, payload?: unknown): Promise<unknown> | unknown,
  seed(stateName: string): Promise<void> | void,
  reset(): Promise<void> | void
}
```

Rules:

- The bridge is test-only/dev-only unless the stack pack explicitly allows
  production exposure.
- Production stripping evidence must come from stack-pack-declared bundler
  config/source-map/define-replacement validation. Grep-only output scans are
  supplementary evidence, not the sole gate proof.
- `seed(stateName)` must cover the PLAN `mock_data_contract.required_states`.
- `dispatch(actionId)` must expose deterministic action verification for owned
  actions when UI automation alone is insufficient.
- Missing required bridge shape fails `WINDOW_APP_CONTRACT_MISSING`.

### React Native / Expo

Required evidence:

- Expo-compatible build or export command passes according to stack pack policy
- typecheck/lint/test passes when available
- native-only failures are not falsely claimed as covered by web export
- design authority is marked as `reference_only` or `native_equivalent` with an
  explicit conversion note
- `native_equivalent` is accepted only when the stack pack provides a concrete
  `NATIVE_EQUIVALENT_CONTRACT.json`; otherwise React Native/Expo uses
  `reference_only`

### Browser Game

Required evidence:

- game runtime entrypoint exists
- game loop starts without crashing
- canvas or primary render surface is non-blank over multiple frames
- deterministic input changes observable game state or rendered pixels
- controls/HUD/menu surfaces match design authority where applicable
- Stitch is not treated as canvas runtime logic
- DOM overlays are allowed only when the stack pack declares that pattern

### API / CLI

Required evidence:

- no Stitch/design UI checks unless explicitly applicable
- command/endpoint contracts pass
- error envelope or exit code behavior passes
- mock/fixture state is deterministic
- runtime paths and env values are not invented by implement

API evidence shape:

```json
{
  "type": "api_endpoint",
  "method": "GET | POST | PUT | PATCH | DELETE",
  "path": "/resource",
  "requestFixture": {},
  "expectedStatus": 200,
  "expectedEnvelope": {},
  "errorCase": {}
}
```

CLI evidence shape:

```json
{
  "type": "cli_command",
  "cmd": "tool command --flag",
  "stdinFixture": "",
  "expectedStdout": "",
  "expectedStderr": "",
  "expectedExitCode": 0
}
```

## Dashboard And Status Semantics

Dashboard must distinguish current canonical state from historical failures.

Rules:

- A historical failed evidence item must not keep a current phase red after the
  canonical story gate has passed.
- Current status is computed from `setfarm.runtime-state.v1`, which points to
  the latest canonical gate report.
- Historical failures remain visible as audit events, not active blockers.
- A run can show `Design done` and still show old design retry events as history.
- A run can show `Stories done` and still show prior stories guard failures as
  history.

This is important because stale UI state can mislead operators into thinking
PLAN/DESIGN/STORIES are broken when the canonical pipeline already advanced.

## Implementation Order

1. Update this spec after external review.
2. Define TypeScript types for:
   - `ImplementContextV2`
   - `BlockerItem`
   - `ImplementOutputV2`
   - `StoryGateReport`
   - `RepairContract`
   - `RuntimeState`
   - `McEvidenceRunner`
   - `McExecutionSandbox`
   - `RollbackInvalidation`
3. Add MC core modules:
   - runtime state writer/reader
   - rollback invalidation graph
   - context re-assembly event writer/reader
   - context re-assembly loop breaker
   - systemic failure state machine
   - execution sandbox
   - command evidence runner
   - byte-limited artifact capture
   - dependency import scanner
   - shared file AST/scope checker
   - patch-window marker validator
4. Add MC blocker ledger module:
   - create blocker
   - normalize prose feedback into blockers
   - snapshot open blockers into implement context
   - validate closure evidence
   - update blocker statuses
   - write/read `HUMAN_REVIEW_REQUEST.json`
5. Extend `assembleImplementContext`:
   - include blocker snapshot
   - include required evidence
   - include route guard policy
   - include story type
   - include shared grant ids and `SHARED_GRANTS.json` version
   - include stricter shared edit operation scopes
6. Update implement prompts/rules:
   - structured blockers are authoritative
   - prose context is secondary
   - output `setfarm.implement-output.v2`
   - no command self-grading
   - no blocker waiver by implement agent
7. Add full-gate validator:
   - scope diff check
   - shared edit AST/scope check
   - forbidden/setup-owned file check
   - dependency import check
   - context staleness check
   - shared grant check
   - patch-window marker corruption check
   - rollback regression check
   - blocker closure check
   - owned action and acceptance evidence check
   - MC-executed build/test/runtime evidence check
8. Add retry ladder:
   - attempt counting
   - retry fingerprint normalization and matching
   - closed blocker summarization
   - open blocker context narrowing
   - systemic failure detection
   - weighted infrastructure backoff
9. Add supervisor repair flow:
   - generate `REPAIR_CONTRACT`
   - validate repair scope and root-cause escalation matrix
   - support `pipelineEscalation` rollback requests
   - support setup-build patch mode and dependency amendments
   - force sandbox prewarm rerun after dependency patch mode changes
   - support regression repair contracts
   - enforce `repairClass=regression` restrictions
   - launch repair implement pass
   - support model escalation without scope escalation
10. Update dashboard/status:
   - show canonical current state separately from historical events
   - expose open blockers and retry count clearly
11. Add tests:
   - implement context schema
   - blocker ledger lifecycle
   - runtime state lifecycle
   - MC command execution artifacts
   - MC sandbox timeout/OOM/network failures
   - context re-assembly loop detection
   - rollback invalidation and regression checks
   - prose feedback normalization
   - full-gate pass/fail
   - retry limit escalation
   - repair contract validation
   - shared edit scope enforcement
   - patch-window marker enforcement
   - human review request lifecycle
   - dependency import enforcement
   - stale historical failure does not mark current phase failed

## Closed Policy Decisions

1. Human-only waivers are allowed only through `HUMAN_REVIEW_REQUEST.json`.
2. Supervisor repair may request `scopeAmendment`, but MC must validate it
   against RuntimeState, FILE_TREE_MANIFEST, SHARED_GRANTS, and setup-owned
   deny lists before any repair attempt starts.
3. Model escalation occurs after supervisor diagnosis or explicit repair policy,
   not as a scope-broadening shortcut.
4. Dashboard current status is sourced from RuntimeState. Phase evidence checks
   update RuntimeState through MC gates rather than independently overriding it.
