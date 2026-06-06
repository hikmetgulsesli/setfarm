# Setfarm + Mission Control Audit Findings

Date: 2026-06-06

## Summary

This audit is for platform behavior, not generated-project rescue. Generated projects are useful only as signals for Setfarm/Mission Control defects. If a run becomes low-value or terminally polluted, prefer a clean replay/new run after extracting the platform lesson.

Primary audit areas:

- Pipeline state machine and retry/recovery behavior.
- PR lifecycle and review-thread handling.
- Mission Control state derivation and noise control.
- Runtime evidence, visual evidence, and agent self-certification boundaries.
- Spawner guardrails, orphan recovery, and dead/duplicated recovery paths.
- Maintainability and dead-code risks that can hide platform bugs.

## Findings And Root Fixes

### P0/P1: Recovery Policy Is Too Implicit

Observed shape:

- `src/spawner.ts` contains recovery paths that can complete orphaned implement work if a build and scope gate pass.
- Manual operational recovery is possible through DB/GitHub actions, but the platform does not yet expose a first-class "observe-only recovery" policy.
- Recent run #862 showed the correct learning target: verify parser behavior after a platform fix. The generated project itself was not important.

Risk:

- Operators or agents can drift into rescuing bad generated projects instead of learning from them and starting clean.
- Retry extensions and DB edits can become hidden product rescue work unless explicitly recorded and bounded.

Root fix:

- Add a small platform recovery policy layer that classifies recovery intent as `observe_fix`, `platform_replay`, or `project_rescue`.
- Permit only `observe_fix` and `platform_replay` without explicit human approval.
- Require every allowed recovery to write a `run_observations` record with cause, scope, preserved evidence, and next stop condition.
- Surface the recovery class in Mission Control.

Tests:

- Unit test recovery classification and observation payload.
- Spawner/step lifecycle test proving terminal generated-project rescue does not auto-extend retries without an allowed recovery class.

### P1: Mission Control Shows Raw Run History Instead Of Derived Operational Views

Observed shape:

- `src/server/dashboard.ts#getRuns` returns all runs ordered by `created_at`.
- `src/server/index.html#renderBoard` places every run into a workflow step column, including failed/cancelled historical cards.
- Failed/cancelled cards are styled but not policy-filtered by default.

Risk:

- Mission Control becomes noisy and can imply that old trash projects deserve attention.
- Operators may spend time rescuing failed projects instead of looking at active platform signals.

Root fix:

- Add a server-side or explicit UI default filter for terminal failed/cancelled runs.
- Keep a "Show terminal runs" toggle for audit history.
- Add derived run health fields: active, terminal, needs-platform-attention, generated-project-trash, and recovery-observed.

Tests:

- Dashboard API or UI test for default terminal filtering.
- Regression test that terminal runs remain accessible when explicitly requested.

### P1: PR Review Thread Resolution Needs Policy Separation

Observed shape:

- `detectOpenPrReviewCommentFailure` can resolve mechanically satisfied inline review threads before routing to implement.
- Historical thread resolution runs after comments are no longer actionable.
- This is useful, but policy text and tests still need to distinguish "mechanically satisfied after code evidence" from "manual project rescue".

Risk:

- Future changes may blur the line and let Setfarm resolve current review feedback without real code evidence.

Root fix:

- Keep current mechanic, but add a policy wrapper around resolution calls:
  - `mechanically_satisfied_current_thread`
  - `historical_or_outdated_thread`
  - `manual_resolution_forbidden`
- Record the policy decision in `run_observations.github`.

Tests:

- Existing verify tests should be extended to assert the policy decision metadata, not only final actionable count.

### P1: Evidence Gate Still Has Advisory Escape Hatches

Observed shape:

- `implement-evidence-runner` synthesizes default intent/request artifacts when the agent did not provide them.
- This is useful during rollout, but it can hide missing story-specific verification requests.
- Visual/evidence gate modes are env-controlled, but MC must consistently display disabled/advisory/blocking state.

Risk:

- Agent prose can still appear sufficient if synthesized evidence is treated like explicit intent.
- Interactive stories may pass with conservative snapshots instead of meaningful flows.

Root fix:

- Distinguish `agent_declared` vs `setfarm_synthesized` evidence in artifacts, observations, and MC.
- In blocking mode, fail interactive stories when only synthesized verification exists unless the stack pack marks the story non-interactive.
- Add MC filmstrip row for "verification request source".

Tests:

- Implement evidence tests for explicit request, synthesized request advisory pass, and synthesized request blocking failure.
- MC summary test that synthesized evidence is visibly marked.

### P1/P2: Spawner Guardrails Are Powerful But Hard To Audit

Observed shape:

- `src/spawner.ts` contains many runtime supervisor checks and direct DB transitions.
- Several functions update stories/steps/claim_log in separate statements without a shared transition abstraction.

Risk:

- Future fixes can introduce partial state updates or duplicate lifecycle behavior.
- Dead or overlapping recovery paths are hard to identify.

Root fix:

- Inventory spawner DB mutations and group them behind named lifecycle helpers where practical.
- Add a lightweight invariant test suite for "story status, step status, claim_log outcome" combinations after each guard path.
- Do not refactor everything at once; start with recovery/requeue paths.

Tests:

- Add table-driven tests around repeated runtime guard limit, orphan story requeue, orphan implement recovery, and single-step orphan requeue.

### P2: Dead Code And Maintainability Drift Should Become Invariants

Observed shape:

- The repo has many TODO-like and legacy/recovery paths.
- Some are real guardrails; some are historical comments or test fixtures.
- There is no single dead-code or unused-export gate.

Risk:

- Old project-specific assumptions can survive as inactive code until a future run hits them.

Root fix:

- Add a scripted audit command for high-signal patterns only:
  - project-specific hardcode in generic gates
  - direct retry/max_retries mutation outside approved lifecycle helpers
  - agent self-certification language in workflow prompts
  - MC using raw story output as current truth
- Make the script advisory first, then convert stable checks into tests.

Tests:

- Script tests for each pattern with allowed exceptions.

## Recommended Next Fix Order

1. Mission Control terminal-run filtering and derived run health. Implemented: `/api/runs` hides terminal failed/cancelled/error runs by default, `include_terminal=1` restores them, and Mission Control has a `Show terminal` toggle.
2. Recovery policy classification and observation metadata. Started: orphaned implement recovery is now classified as `platform_replay` and recorded before recovered output is completed.
3. PR review resolution policy metadata. Implemented: verified and historical thread resolution observations now include a policy decision.
4. Evidence request source distinction.
5. Spawner lifecycle helper/invariant tests.
6. Advisory dead-code/platform-smell audit script.

## Acceptance Criteria For This Audit Thread

- `AGENTS.md` states observe-first behavior and discourages generated-project rescue.
- Audit findings identify root platform fixes, not one-off project patches.
- Future implementation work can be split into focused, testable PRs.
