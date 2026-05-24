# Setfarm Current Architecture Review Response

Date: 2026-05-23

Status: current decision summary after Gemini and Sonnet adversarial reviews.

Use this document together with:

- `2026-05-23-setfarm-pipeline-through-setup-build-review-packet.md`
- `2026-05-23-implement-full-gate-repair-contract.md`

This document summarizes the changes accepted after external review and clarifies
that the architecture remains infrastructure-oriented, not project-specific.

## Reviewer Prompt

We reviewed Setfarm's pre-IMPLEMENT and IMPLEMENT architecture with Gemini and
Sonnet. Based on that feedback, we applied the decisions in this document.

Please perform one more adversarial senior platform-orchestration review.

Focus on:

- contradictions introduced by these updates
- missing contracts
- brittle handoffs
- false-positive or false-negative gates
- places where agents can still self-grade, overreach, hallucinate paths, or
  bypass blockers
- platform gaps across web, Next.js, Vite, React Native, browser-game, API, CLI,
  Python, desktop, Android, and iOS
- whether this is now ready to implement

Return the answer in this structure:

- Critical Issues
- Missing Contracts
- Risky Assumptions
- Recommended Schema/Rule Changes
- Gate And Retry Adjustments
- Setup/Build/Implement Adjustments
- Implementation Order
- Final Verdict

## Important Boundary

No project-specific hardcoding is allowed.

The accepted changes are infrastructure contracts:

- stack-pack path resolution rules
- deterministic slug rules
- dependency resolution policies
- MC-owned evidence execution
- blocker ledger authority
- repair rollback signals
- status ledger semantics

They are not rules for SurfaceGate, tickets, CRMs, dashboards, or any specific
product domain. Those names are examples only and must not appear in stack-pack
rules, path resolution rules, gates, or prompts as defaults.

## Accepted Review Decisions

### 1. Agents Never Grade Their Own Tests

Accepted.

`setfarm.implement-output.v2` no longer asks the agent to claim command pass/fail
status as authoritative evidence.

The agent may provide evidence hints, but MC must execute gate-critical commands.

MC owns:

- command execution
- stdout/stderr capture
- exit code capture
- artifact storage
- pass/fail derivation
- blocker ledger updates from real evidence

Gate-critical evidence must use:

```json
{
  "cmd": "npm run build",
  "executor": "MC_SANDBOX",
  "captureStdout": true,
  "captureStderr": true,
  "requiredWhen": "always | files_changed"
}
```

Agent terminal output is advisory only.

### 2. Deterministic Target Resolution Requires `slugRules`

Accepted.

`targetResolutionRules` cannot depend on undefined template variables such as
`{surface_slug}` or `{ScreenId}`.

Every stack pack must define deterministic `slugRules`:

```ts
slugRules: {
  surface_slug: "strip SURF_ prefix, lowercase, replace underscores with hyphens",
  screen_file: "PascalCase from screen id/title, strip SCR prefix when present",
  action_file: "camelCase from ACT_ id",
  entity_file: "PascalCase from entity name",
  route_segment: "lowercase kebab-case, framework-safe"
}
```

Rules:

- slugging is stack-pack-owned
- slugging is tested per stack pack
- agents never choose physical path names
- repeated runs must produce identical paths for identical logical targets

### 3. Target Resolution Supports More Than Flat Templates

Accepted.

Static flat string templates are not enough for frameworks such as Next.js App
Router, Remix-like file routers, CLI trees, API endpoint trees, or browser-game
runtime modules.

Stack packs now declare:

```ts
routerParadigm:
  "file_system_nested | declarative_flat | endpoint_tree | command_tree | canvas_runtime | none"
```

`targetResolutionRules` may define:

- `single_file`
- `file_set`
- `route_tree`
- `endpoint_tree`
- `command_tree`
- `submodule_set`
- `shared_file`

This remains deterministic stack-pack logic. There is no open-ended LLM path
resolver.

### 4. File Tree Path Collision Is A Setup-Build Gate

Accepted.

`FILE_TREE_MANIFEST.json` must be checked for path collisions while SETUP-BUILD
writes it.

New gate:

```text
FILE_TREE_PATH_COLLISION
```

Rules:

- two stories cannot resolve to the same path unless that path is explicitly
  shared
- feature component collisions fail by default
- shared collisions require a declared shared target and later MC-granted edit
  permissions

### 5. Dependency Requests Need Conflict Resolution

Accepted.

STORIES may request dependencies. SETUP-BUILD aggregates and validates them.

Stack packs must define:

```json
{
  "allowedEcosystems": ["npm"],
  "versionPolicy": "latest_compatible | exact_requested | stack_locked",
  "conflictPolicy": "fail | choose_highest_compatible | stack_locked_wins",
  "optionalDependencyPolicy": "reject | approve_if_allowed | require_story_fallback",
  "outOfEcosystemPolicy": "fail"
}
```

New gates:

```text
DEPENDENCY_CONFLICT
DEPENDENCY_ECOSYSTEM_UNSUPPORTED
```

### 6. Dependency Use Requires Import Namespace Evidence

Accepted.

SETUP-BUILD writes dependency evidence including import namespaces.

```json
{
  "installed": [],
  "importNamespaces": [
    {
      "package": "zod",
      "imports": ["zod"]
    }
  ]
}
```

IMPLEMENT gates scan changed files for new imports. Imports must match approved
or installed dependency namespaces.

No ad hoc package installation is allowed inside IMPLEMENT.

### 7. Mock Injection Boundary Is Stack-Pack-Owned

Accepted.

PLAN's `mock_data_contract` is logical. SETUP-BUILD resolves physical injection
through the stack pack.

```json
{
  "mockInjectionContract": {
    "fixtureRoot": "src/__fixtures__",
    "injectionEntrypoint": "src/mocks/bootstrap.ts",
    "enablementMode": "dev_only | test_only | explicit_import",
    "productionLeakCheck": true
  }
}
```

New gate:

```text
MOCK_INJECTION_BOUNDARY_MISSING
```

IMPLEMENT agents must not invent mock bootstrapping patterns.

### 8. Stitch Batch Lock Needs Artifact Validation

Accepted.

`design_system_lock` in the prompt is guidance, not proof.

Batch 1 establishes locked token artifacts. Batch 2+ must not introduce
contradictory token systems.

New gate:

```text
DESIGN_TOKEN_DRIFT
```

The gate compares parsed token artifacts, not only prompt text.

### 9. `FULL_PRD_APPENDIX` Remains Removed

Accepted.

Stitch receives only `PRD_CONTEXT_SLICE`, not the full PRD.

`PRD_CONTEXT_SLICE` contains only UI-relevant fields:

- product identity
- UI vision summary
- product surfaces
- action control hints
- visible data fields
- validation/error UI strategy
- empty/loading/error states
- UI anti-goals

It must not include backend schema internals, test contracts, setup/build
commands, repo paths, env values, or failure ledgers.

### 10. Native And Browser-Game Design Policies Are Explicit

Accepted.

React Native:

- `reference_only` is safe default
- `native_equivalent` is disabled unless the stack pack declares an actual
  converter/adapter artifact and emits `NATIVE_EQUIVALENT_CONTRACT.json`
- raw Stitch HTML is never native runtime authority

Browser game:

- Stitch may guide menus, HUD, overlays, visual shell, and controls
- Stitch is not game loop/runtime logic
- DOM overlays require explicit stack-pack permission
- game runtime targets resolve to explicit modules such as `engine`, `loop`,
  `state`, `input`, `hud`

### 11. Runtime State Is Canonical For Story Status

Accepted.

MC keeps canonical story state outside agent-editable context.

```json
{
  "schema": "setfarm.runtime-state.v1",
  "runId": "",
  "stories": {
    "US-001": {
      "status": "pending | in_progress | passed | retry | repair_required | human_review | failed",
      "attemptCount": 1,
      "latestGateReportPath": ".setfarm/gates/US-001/1-gate-report.json",
      "openBlockerCount": 0
    }
  }
}
```

Rules:

- MC uses runtime state for dependency readiness and story advancement
- gate reports are audit artifacts
- dashboard current status comes from runtime state
- agents cannot edit runtime state

### 12. Story Type Controls Gate Applicability

Accepted.

`IMPLEMENT_CONTEXT.story.type` is required.

Examples:

| story.type | designCompliance | owned screens | owned surfaces | runtime smoke |
| --- | --- | --- | --- | --- |
| `app_shell` | conditional | false | false | applicable for UI apps |
| `feature_surface` | applicable | true | true | applicable for UI apps |
| `shared_state` | not_applicable | false | false | conditional |
| `api` | not_applicable | false | false | command/endpoint evidence |
| `cli` | not_applicable | false | false | command evidence |
| `game_runtime` | conditional | false | conditional | applicable |
| `nonvisual` | not_applicable | false | false | conditional |

### 13. PR Comments Normalize Into Blockers

Accepted.

Every PR review comment becomes a blocker item.

- actionable comments become `severity=blocking`
- nits/non-blocking comments become `severity=warning`
- implement agents cannot decide that a comment is non-actionable
- MC/supervisor normalization decides severity

### 14. Waivers Are Human-Only

Accepted.

`waived` blockers may exist, but only human operators can create them.

Agents and autonomous supervisors cannot waive blockers.

### 15. Shared File Edits Need Parser-Aware Enforcement

Accepted.

Line diff checks are insufficient for shared files.

For supported languages, MC must use AST-aware or parser-aware checks.

Example:

`route_registration_only` may add an import and append a route, but must not:

- delete providers
- replace routers
- rewrite the app shell
- remove existing routes
- alter unrelated state providers

If AST validation is unavailable, shared file edits require stricter predefined
patch windows or human review.

### 16. Repair Needs Rollback Signals

Accepted.

Supervisor repair cannot silently broaden scope or install dependencies.

`REPAIR_CONTRACT` now supports:

```json
{
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

- new dependency need -> rollback to SETUP-BUILD
- changed story decomposition/ownership -> rollback to STORIES
- setup-owned file changes require rollback to setup/build
- repair pass does not install dependencies directly

### 17. Scope Amendments Are Validated

Accepted.

`scopeAmendment` is not free-form permission expansion.

Rules:

- cannot include forbidden files
- cannot include setup-owned files
- cannot include other story owned files
- must reference `FILE_TREE_MANIFEST`
- requires MC validation before repair starts

### 18. Dashboard Must Separate Current State From History

Accepted.

Dashboard must not show historical failed evidence as current failure after the
canonical gate has passed.

Rules:

- current state comes from runtime state
- historical events remain visible as audit trail
- open blockers and retry counts are visible separately

### 19. Rollback Creates New Versions And Invalidates State

Accepted.

Rollback to SETUP-BUILD or STORIES never mutates an existing certificate or story
contract in place.

Rules:

- setup/build patch writes a new setup certificate version
- file tree manifest and dependency evidence are versioned with the certificate
- RuntimeState tracks `setupCertificateVersion`, `fileTreeManifestVersion`,
  `storyContractVersion`, and `rollbackEpoch`
- passed stories become `pending_regression_check` when a rollback may affect
  them
- if MC cannot prove the affected set, all previously passed stories require
  regression smoke/test evidence before they can unblock later stories

### 20. MC Evidence Runs Inside A Sandbox

Accepted.

MC owns evidence execution, but it must protect the orchestrator from hanging or
unsafe agent code.

Required command fields:

```json
{
  "executor": "MC_SANDBOX",
  "timeoutMs": 30000,
  "memoryMb": 2048,
  "networkPolicy": "none | localhost_only | allowlist",
  "maxStdoutBytes": 120000,
  "maxStderrBytes": 120000,
  "portPolicy": "allocated_by_mc"
}
```

New gates:

```text
MC_EXECUTION_TIMEOUT
MC_EXECUTION_OOM
MC_NETWORK_POLICY_VIOLATION
MC_PORT_ALLOCATION_FAILED
```

### 21. DESIGN Failures Are Split By Root Cause

Accepted.

DESIGN must not collapse provider, prompt/output, partial batch, and artifact
assembly failures into one generic asset error.

Canonical DESIGN gates now include:

```text
DESIGN_PROVIDER_UNREACHABLE
DESIGN_BATCH_PARTIAL
DESIGN_ARTIFACT_ASSEMBLY_FAILED
DESIGN_INLINE_SURFACE_UNREPRESENTED
DESIGN_PRD_SLICE_INVALID
```

`DESIGN_ASSET_MISSING` is used only after provider success and artifact assembly
success when a required path is absent.

### 22. Token Drift Has A Normalized Algorithm

Accepted.

`DESIGN_TOKEN_DRIFT` parses token artifacts and normalizes values before
comparison.

Rules:

- colors normalize to lowercase hex/rgba equivalence
- absolute lengths normalize to px where conversion is deterministic
- CSS variables, `rem`, `vh`, `vw`, percentages, and inherited/scoped values are
  compared by declaration text plus selector/token key, not brittle headless-DOM
  computed-style assumptions
- font family lists normalize whitespace/quotes while preserving order
- locked semantic token names cannot change value across batches
- new tokens are allowed only when non-conflicting and namespaced/local

### 23. Inline Surfaces Need Manifest Evidence

Accepted.

Inline surface coverage is valid only when PLAN declares
`representation=inline` and `host_surface_id`.

`DESIGN_MANIFEST.json` must contain represented-surface evidence. Prose claims
do not pass. Missing evidence fails `DESIGN_INLINE_SURFACE_UNREPRESENTED`.

### 24. `PRD_CONTEXT_SLICE` Is Schema-Validated

Accepted.

Stitch receives no full PRD. `PRD_CONTEXT_SLICE` includes only explicitly
UI-visible fields.

A field is visible only if it is listed in `display_fields`, referenced by a
control hint, referenced by a validation error message, or named in user feedback
text. Backend internals, endpoint contracts, test contracts, setup/build
commands, and failure ledgers fail `DESIGN_PRD_SLICE_INVALID`.

### 25. Retry Fingerprints Are MC-Normalized

Accepted.

`retryFingerprint` is MC-generated and excludes timestamps, attempt counts,
random ids, absolute paths, and unbounded stderr.

It hashes stable fields: schema version, phase, story id, blocker id, gate code,
source, normalized affected files, command id, error code, line span, and root
cause category.

### 26. Shared Edit AST Fallback Is Explicit

Accepted.

Stack packs must declare:

```text
ast_required | patch_window | human_review_required
```

If AST validation is unavailable and no safe fallback is declared, Setfarm fails
closed with `SHARED_EDIT_AST_UNAVAILABLE` or routes to human review. It never
silently allows broad shared-file edits.

Regex-only validation is not accepted for shared code edits. Simple config files
must use structured parsers where available.

### 27. `WINDOW_APP` Contract Is Defined

Accepted.

For web stacks that require deterministic UI smoke evidence:

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

Missing required bridge shape fails `WINDOW_APP_CONTRACT_MISSING`.

### 28. Supervisor Repair Has A Root-Cause Matrix

Accepted.

Supervisor diagnosis is advisory until MC validates it against the escalation
matrix.

Examples:

- `dependency_gap` -> rollback to SETUP-BUILD
- `stack_gap` -> rollback to SETUP-BUILD
- `design_gap` -> rollback to DESIGN
- `wrong_file_scope` -> validated scope amendment or rollback to STORIES
- `bad_implementation` -> same-story repair
- `flaky_tool` -> MC tool reset/retry inside sandbox

Invalid repair contracts fail `REPAIR_CONTRACT_INVALID`.

### 29. Systemic Failures Halt Individual Retry Loops

Accepted.

If the same gate/root cause repeats across multiple stories or runs for the same
stack pack, MC raises `SYSTEMIC_FAILURE_SUSPECTED` and routes the run to
stack-pack/setup review rather than retrying each story independently.

### 30. Browser Game Evidence Cannot Be Loop-Only

Accepted.

Browser-game smoke evidence must prove the primary render surface is non-blank
over multiple frames and that deterministic input changes state or pixels.
Starting a RAF/game loop alone is not enough.

### 31. Warnings May Carry Forward, Blockers May Not

Accepted with limits.

Human-only `waived` remains the only way to waive a blocking item.

Autonomous supervisor may mark a non-blocking `severity=warning` item as
`warning_carry_forward` only when all gates pass and the dashboard keeps the
warning visible for asynchronous human review. This cannot convert a blocker
into a pass.

### 32. Shared Path Collision Is A Two-Phase Decision

Accepted.

SETUP-BUILD detects path collisions but does not grant per-story permissions.

Rules:

- feature/component collisions fail immediately with `FILE_TREE_PATH_COLLISION`
- collisions matching declared shared targets and `shared_edit_requests` are
  written as `pending_shared_grant`
- MC context assembly grants or denies the shared target
- denied grants fail `SHARED_TARGET_GRANT_DENIED`

### 33. Stale Context Triggers Automatic Re-Assembly

Accepted.

`IMPLEMENT_CONTEXT_STALE` is not a dead-end gate.

MC writes a `setfarm.context-reassembly-event.v1`, assembles a fresh context for
the current RuntimeState versions, and retries the attempt only after fresh
context exists. Re-assembly failure becomes `CONTEXT_REASSEMBLY_FAILED`.

### 34. Regression Failures Have A Repair Path

Accepted.

Rollback can mark passed stories as `pending_regression_check`. If regression
evidence fails, MC emits `REGRESSION_FAILURE`, sets the story to
`repair_required`, and generates a repair contract limited to adapting the
previously verified code to the new setup/story baseline.

### 35. Systemic Failure Has Resume Semantics

Accepted.

`SYSTEMIC_FAILURE_SUSPECTED` now records a runtime state block with class
`infrastructure | contract | logic`.

Infrastructure failures use exponential backoff first. Contract/logic systemic
failures halt story advancement until stack-pack/setup/contract review writes a
new versioned artifact or a human resolution note.

### 36. Sandbox Network Is Prewarmed In SETUP-BUILD

Accepted.

Stack packs can define `sandboxPrewarm` for dependency/tool downloads such as
browser binaries. IMPLEMENT sandbox commands then run offline or localhost-only
unless the stack pack explicitly allow-lists an external host.

### 37. Test Bridges Require Production Stripping Policy

Accepted.

Stack packs must define how `window.app`, fixture imports, and mock bootstraps
are excluded or stripped from production builds.

Missing policy fails `TEST_BRIDGE_STRIPPING_POLICY_MISSING`; leaked production
symbols fail `MOCK_PRODUCTION_LEAK`. The proof must come from bundler config,
source-map, or define-replacement validation; grep-only checks are not accepted
as sole evidence.

### 38. DESIGN Artifacts Have Minimum Schemas

Accepted.

`DESIGN_DOM.json` and `UI_CONTRACT.json` now have minimum schemas. Markdown is
not authority. `DESIGN_BRIEF.md` is scoped machine handoff; `DESIGN.md` is
human-readable Stitch documentation.

### 39. Batch Partial Recovery Is Defined

Accepted.

`DESIGN_BATCH_PARTIAL` recovery retries missing standalone surfaces in the same
Stitch project, verifies token lock, then runs token drift and surface gates.
Repeated partial output goes to human review with batch/provider evidence.

If batch 1 is partial, token lock is not established; Setfarm retries full batch
1 instead of continuing to batch 2.

### 40. Route Guard Owner Is Story-Assigned

Accepted.

PLAN no longer hardcodes `US-001` as guard owner. PLAN emits
`guard_implementation_owner: STORIES_ASSIGNED`; STORIES assigns the concrete
owner. The owner may create guard plumbing only until routes/components exist.

### 41. Dependency Graph And Parallel Policy Are Explicit

Accepted.

STORIES validates `depends_on` as an acyclic graph. Parallel story execution is
disabled unless runtime explicitly enables `parallel_independent_only` and MC
proves no file, dependency, shared edit, or route-registration overlap.

### 42. Context Re-Assembly Has A Circuit Breaker

Accepted.

`IMPLEMENT_CONTEXT_STALE` queues automatic context re-assembly, but re-assembly
cannot loop forever.

`setfarm.context-reassembly-event.v1` now records:

```json
{
  "reassemblyAttempt": 1,
  "maxReassemblies": 3,
  "previousContextHash": "",
  "newContextHash": "",
  "failureCategory": "stale_context | state_corruption | infrastructure | contract | null"
}
```

If re-assembly emits the same stale context hash/version or exceeds
`maxReassemblies`, MC fails with:

```text
MC_REASSEMBLY_LOOP_DETECTED
```

### 43. Shared Grants Are Versioned Separately

Accepted.

`FILE_TREE_MANIFEST.json` stays immutable. SETUP-BUILD can mark shared
collisions as `pending_shared_grant`, but MC writes grant/deny decisions to:

```text
.setfarm/setup/SHARED_GRANTS.json
```

`IMPLEMENT_CONTEXT.sharedEditableFiles[].grantedBy` must reference a concrete
grant id. Missing grant evidence fails `SHARED_GRANTS_MISSING`; denied grants
fail `SHARED_TARGET_GRANT_DENIED`.

### 44. Patch Windows Must Be Scaffolded And Protected

Accepted.

If a stack pack uses `sharedEditValidationPolicy=patch_window`, SETUP-BUILD must
scaffold explicit markers such as:

```text
// SETFARM_ROUTE_INJECT_START
// SETFARM_ROUTE_INJECT_END
```

Agents may edit only inside granted windows. They may not create, move, delete,
duplicate, rename, or widen markers.

Marker corruption fails:

```text
PATCH_WINDOW_MARKER_MISSING
```

MC may restore exact marker text only from the setup snapshot when surrounding
code is unchanged. Otherwise the story goes to human review or rollback to
SETUP-BUILD.

### 45. Dependency Patch Mode Re-Runs Sandbox Prewarm

Accepted.

When SETUP-BUILD patch mode changes a package manifest, lockfile, dependency
evidence, toolchain downloads, or sandbox cache keys, it must rerun
`sandboxPrewarm` and write fresh `PREWARM_EVIDENCE.json` before IMPLEMENT
resumes.

### 46. Production Stripping Cannot Be Grep-Only

Accepted.

`MOCK_PRODUCTION_LEAK` and test bridge stripping must use stack-pack-declared
bundler config analysis, source-map-aware tracing, or define-replacement
assertions. Grep/output string scans are supplemental evidence only.

`buildStrippingPolicy` is split into:

- `testBridgeStripping`
- `devToolStripping`

### 47. Batch-1 Partial Output Resets Token Lock

Accepted.

If Stitch batch 1 is partial, no `design_system_lock` exists. The pipeline
retries full batch 1; batch 2+ cannot start until batch 1 artifacts and tokens
are fully downloaded and verified.

For batch 2+ partial output, recovery may retry missing standalone surfaces in
the same Stitch project, then run token lock and coverage gates.

### 48. Human Review Requires An Artifact

Accepted.

Human-only waivers and human review exits require:

```text
HUMAN_REVIEW_REQUEST.json
```

Agents and autonomous supervisors cannot resolve or waive this artifact.
Missing required human review evidence fails `HUMAN_REVIEW_REQUEST_MISSING`.

### 49. Regression Repair Is A Separate Repair Class

Accepted.

`REPAIR_CONTRACT.json` now includes:

```json
{
  "repairClass": "feature | regression | scope_amendment",
  "featureScopeExpansion": "forbidden | allowed_by_contract"
}
```

`repairClass=regression` must set `featureScopeExpansion=forbidden` and
`scopeAmendment=null`. It may adapt previously verified code to a new setup
baseline, but it cannot add feature scope.

### 50. Native Equivalent Is Disabled Without A Converter Contract

Accepted.

React Native/Expo defaults to `reference_only`.

`native_equivalent` is accepted only when the stack pack emits a concrete
`NATIVE_EQUIVALENT_CONTRACT.json`. Without that artifact, Stitch design remains
reference material and is not treated as converted native UI.

### 51. Orphaned Utilities Are Tracked

Accepted.

Utility files are not permanent escape hatches. After rollback or story rewrite,
MC/SETUP-BUILD checks generated utility files against ownership and import
references.

Unreferenced story-owned utility files are removed only when stack policy allows
safe removal. Otherwise they are reported as:

```text
ORPHANED_UTILITY_FILE
```

### 52. DESIGN DOM And UI Contract Have Separate Authority

Accepted.

`UI_CONTRACT.json` is logical authority. `DESIGN_DOM.json` is physical
DOM/native semantic evidence.

Tier 2 design compliance requires both. If an action exists in the UI contract
but lacks matching DOM/native evidence, the gate fails with:

```text
DESIGN_DOM_ACTION_MISSING
```

## Updated Gate Additions

Pre-IMPLEMENT:

```text
DESIGN_PROVIDER_UNREACHABLE
DESIGN_BATCH_PARTIAL
DESIGN_ARTIFACT_ASSEMBLY_FAILED
DESIGN_INLINE_SURFACE_UNREPRESENTED
DESIGN_PRD_SLICE_INVALID
DESIGN_TOKEN_DRIFT
DESIGN_DOM_ACTION_MISSING
TARGET_SLUG_RULE_MISSING
FILE_TREE_PATH_COLLISION
SHARED_GRANTS_MISSING
SHARED_TARGET_GRANT_DENIED
DEPENDENCY_CONFLICT
DEPENDENCY_ECOSYSTEM_UNSUPPORTED
MOCK_INJECTION_BOUNDARY_MISSING
MOCK_PRODUCTION_LEAK
TEST_BRIDGE_STRIPPING_POLICY_MISSING
SANDBOX_PREWARM_MISSING
PATCH_WINDOW_MARKER_MISSING
ORPHANED_UTILITY_FILE
TARGET_SLUG_RULE_TEST_FAILED
STORIES_DEPENDENCY_CYCLE
SYSTEMIC_FAILURE_SUSPECTED
```

IMPLEMENT:

```text
IMPLEMENT_CONTEXT_STALE
CONTEXT_REASSEMBLY_FAILED
MC_REASSEMBLY_LOOP_DETECTED
BLOCKER_CLOSURE_EVIDENCE_MISSING
PR_REVIEW_COMMENTS_OPEN
SUPERVISOR_BLOCKERS_OPEN
ACCEPTANCE_CRITERIA_UNVERIFIED
OWNED_ACTION_UNIMPLEMENTED
SHARED_EDIT_SCOPE_VIOLATION
SHARED_EDIT_AST_UNAVAILABLE
PATCH_WINDOW_MARKER_MISSING
ORPHANED_UTILITY_FILE
DEPENDENCY_POLICY_VIOLATION
RUNTIME_SMOKE_FAILED
MC_EXECUTION_TIMEOUT
MC_EXECUTION_OOM
MC_NETWORK_POLICY_VIOLATION
ROLLBACK_REGRESSION_CHECK_PENDING
REGRESSION_FAILURE
SYSTEMIC_FAILURE_SUSPECTED
REPAIR_CONTRACT_MISSING
REPAIR_CONTRACT_INVALID
REPAIR_SCOPE_INVALID
HUMAN_REVIEW_REQUIRED
HUMAN_REVIEW_REQUEST_MISSING
```

## Updated Implementation Order

1. Finalize spec after this second review.
2. Define schema/types:
   - `PlanContractV2_2`
   - `StoryContractV2`
   - `SetupCertificateV1`
   - `FileTreeManifestV1`
   - `RuntimeStateV1`
   - `ImplementContextV2`
   - `BlockerItem`
   - `ImplementOutputV2`
   - `StoryGateReportV1`
   - `RepairContractV1`
3. Implement pre-IMPLEMENT schema tests.
4. Implement stack-pack slug rules and router paradigms.
5. Implement file tree target resolution and collision checks.
6. Implement dependency aggregation, conflict policy, and import namespace
   evidence.
7. Implement mock injection boundary resolution.
8. Implement test bridge production stripping and sandbox prewarm contracts.
9. Implement patch window marker scaffolding, utility file policy, orphaned
   utility detection, and setup-build patch mode.
10. Harden PLAN/DESIGN/STORIES/SETUP gates, including batch partial recovery.
11. Implement `SHARED_GRANTS.json` and MC grant/deny assembly.
12. Implement MC runtime state, rollback invalidation graph, and context
    re-assembly events with loop circuit breaker.
13. Implement systemic failure state machine.
14. Implement MC execution sandbox.
15. Implement MC evidence runner.
16. Implement blocker ledger, PR comment normalization, and
    `HUMAN_REVIEW_REQUEST.json`.
17. Implement per-story `IMPLEMENT_CONTEXT` assembly with staleness checks and
    shared target grant decisions.
18. Implement parser-aware shared edit scope checks and declared fallbacks.
19. Implement full gate validator.
20. Implement retry ladder, retry fingerprint normalization, and systemic
    failure detection.
21. Implement supervisor repair rollback signals, regression repair classes, and
    root-cause matrix.
22. Update dashboard canonical status rendering.
23. Run tests and full run through SETUP-BUILD.
24. Run full run through IMPLEMENT.

## Current Non-Negotiable Blockers Before Coding

1. No agent self-grading.
2. `slugRules` and `routerParadigm` must be defined before target resolution.
3. `FILE_TREE_PATH_COLLISION` must exist before IMPLEMENT context assembly.
4. MC runtime state must be canonical for story dependency readiness.
5. Runtime rollback invalidation must exist before setup-build patch mode.
6. MC sandbox must exist before MC command evidence runner goes live.
7. Context re-assembly must exist before stale context gate is enabled.
8. Regression failure repair path must exist before setup-build patch mode.
9. Repair rollback to SETUP-BUILD/STORIES must be explicit.
10. Shared file edit scope cannot rely only on line diff.
11. Retry fingerprint normalization must be defined before retry ladder coding.
12. DESIGN gate split, token drift normalization, and inline surface evidence
    must exist before DESIGN is considered stable.
13. `PRD_CONTEXT_SLICE` schema validation must exist before Stitch payload
    generation.
14. Browser-game smoke evidence cannot be loop-only.
15. Shared path grant cannot be decided during SETUP-BUILD; MC assembly must
    grant or deny it.
16. Sandbox prewarm and production stripping must exist before strict sandbox
    enforcement.
17. Context re-assembly must have `MC_REASSEMBLY_LOOP_DETECTED` before automatic
    stale-context retry is enabled.
18. Shared grants must be a separate versioned artifact; SETUP-BUILD must not
    mutate `FILE_TREE_MANIFEST.json` to grant permissions.
19. Patch-window markers must be scaffolded before a stack pack can use
    `patch_window`.
20. Human review exits and waivers require `HUMAN_REVIEW_REQUEST.json`.
21. Regression repair must use `repairClass=regression` and forbid feature
    expansion.

## Review Request

Please check whether these decisions close the prior Gemini/Sonnet issues or
whether they introduce new contradictions.

Pay special attention to:

- whether deterministic stack-pack resolution is now strong enough
- whether MC-owned evidence execution is sufficient
- whether repair can still deadlock
- whether dependency amendments and setup rollback are well-scoped
- whether React Native/browser-game design authority is still ambiguous
- whether dashboard/runtime state has a single source of truth
- whether rollback invalidation avoids stale pass states without forcing
  unnecessary rework
- whether MC sandbox limits are strict enough for autonomous scale
- whether warning carry-forward is safe without weakening blocker gates
