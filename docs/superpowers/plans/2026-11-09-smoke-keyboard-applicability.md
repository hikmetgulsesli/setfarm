# Smoke keyboard applicability plan

Spec: `docs/superpowers/specs/2026-11-09-smoke-keyboard-applicability-design.md`.

## Constraints

Base Source561 `561f66a9181906af5dab5f9bd574aac333bb9755`; existing sole writer on `fix/smoke-keyboard-applicability-20261109`. The actual post-merge false rejection is the causal reason for this change. Restrict production changes to Phase 15 applicability. Preserve all genuine keyboard failure checks and other smoke phases. Root owns delivery and effects; implementation/review agents do not commit, push or operate services.

## Task 1

1. Read the spec, relevant AGENTS instructions and canonical Phase 15.
2. Add a focused regression harness executing the actual production Phase 15 code. Demonstrate genuine behavior RED before editing production: button-only canvas and ambiguous action words must not demand keyboard input. Missing imports or fixture errors are not RED.
3. Keep explicit keyboard/no-response and ambient-only failures, plus responsive keyboard success. Make the smallest applicability correction and run focused GREEN plus existing smoke static/invariant tests.
4. Freeze the exact diff, command/PID/exit evidence, file hashes and a concise manifest. No whole-suite or live browser/model run unless a concrete harness limitation requires it. Stop source writes for task review and whole-branch review.

## Root delivery

Review the task and whole branch, commit/push a scoped PR normally, read actual GitHub state, merge normally, produce a clean stock release build, retire the disposable failed canary normally and prepare the usual guarded successor. Admit one unchanged clean game only after rollout. Do not claim the full workflow succeeds until actual terminal evidence proves it.

## Preflight scan

| Scope | Producer/consumer and ruling |
| --- | --- |
| Task 1 production/tests | Tests execute the actual Phase 15; correction must retain keyboard negative controls. No copied replacement classifier. |
| Task 1 evidence/review | Private RED/GREEN records and frozen hashes are review inputs; reviewers make no source or runtime effects. |
| Delivery/build | Only merged clean source may become the public successor; no in-place immutable-source retarget. |

Ruling: existing owner authorization covers this causal root fix and ordinary reviewed delivery. It does not permit changing guards, inventing successful tests or modifying generated code to satisfy an unintended keyboard requirement.
