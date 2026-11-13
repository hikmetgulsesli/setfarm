# Read-only verifier handoff design

## Problem and authority

Current production source 6713ba08, installation9ea4bbb1, run2e5b61a0: IMPLEMENT8 and SUPERVISE9 each produced canonical8/8PASS at source828297e3. VERIFY11 completed through exact RCR_ee299283 authority, but returned retry/VERIFY_PR_MERGE_NOT_CONFIRMED because its read-only tool policy cannot fetch or merge. The verify prompt/rules explicitly require agent merge before done. Generic retry made US001 pending/retry1 without canonical repair authority; the next preparation guard correctly refuses. Original RCA and snapshots are under ../2026-11-13-vitest-browser-storage-compat. This root fix is causally required for the existing full-system/one-real-run objective under standing owner authority.

## Decision

Align the existing verify prompt, appended rules and verify-specific reviewer guidance with the already implemented platform-owned merge path. A reviewer is a read-only evidence/source gate. STATUS: done means the reviewer found no blocking issue in the available authoritative evidence and focused source review; it is a handoff, not a merge or final story-verification claim. Setfarm alone re-reads exact review state, waits the review window, authenticates the exact story checkout, runs configured premerge commands, reauthenticates the tested head, performs exact-head merge, confirms remote state and applies postmerge build/smoke gates.

An OPEN PR alone and lack of agent shell/Git/GitHub mutation capability are not product defects. The reviewer must not claim unavailable checks ran. Missing required acceptance/source/runtime evidence must still be reported explicitly and must never be treated as a pass. Real product defects remain retry findings, never automatically promoted to done.

The ordinary command prohibition excludes only the exact bootstrap and claim-bound artifact submission selected by the canonical stage handoff and its tool policy. It does not grant ordinary shell, product command, Git, PR or service authority. Infrastructure-only failure transport retains its existing narrow conditions. This exception must remain explicit in the rendered instruction, appended rules and verify-specific role guidance.

Alternatives rejected: granting the reviewer exec/Git/merge permissions violates the immutable tool boundary; interpreting historical retry prose as pass invents a successful verdict. No status parser, classifier, preparation owner guard, DB mutation, merge implementation or tool-policy change is part of this fix.

## Limits

Current2e5 is retained, not repaired or replayed. Generic V3 text-retry authority mismatch remains a separate known issue; this fix removes the concrete impossible merge demand, without authorizing a new retry owner. External Codex review failed due usage quota and remains uncompleted; native Kimi review is separate. Original PNG/DOM retention gap is documented separately and is not implemented here. No new credentials, roles, privileged repair, gate weakening, generated source patch, paid review or cleanup.

## File Map

- src/installer/steps/07-verify/prompt.md: actual rendered verify task and output semantics.
- src/installer/steps/07-verify/rules.md: appended read-only role and pass requirements.
- workflows/feature-dev/agents/reviewer/AGENTS.md: only verify-specific guidance and precedence over generic tool examples; security/final-test behavior unchanged.
- tests/steps/07-verify-readonly-handoff.test.ts: new actual buildPrompt/role-contract regression.
- tests/steps/07-verify.test.ts: replace the existing wrong requirement that done requires an already merged PR, retaining unrelated assertions.
- tests/execution-attempts/subscription-owned-stage-evidence-v1.test.ts: restore the missing real `exactPlanInteractions` declaration in the existing isolated production-body fixture; no production behavior or ports changed.

## Verification and delivery

Genuine RED on the new contract tests before source edits; then focused GREEN for those and07-verify plus the existing executable subscription-owned-stage-evidence-v1 tests. That existing production-body seam must continue to reject failed tests, wrong checkout and head drift and pass the tested SHA into merge. Source changes are prompt assets only; no compiler/runtime code changes. Build once on clean committed source, independent task and whole review, normal PR delivery. A fresh bounded production case after guarded rollout must measure actual model behavior; local prompt assertions do not prove end-to-end success. Preserve all current records and historical scopes.

The first focused run recorded 74/75 passing tests and one unchanged fixture ReferenceError: it extracted `runImplementEvidenceIfRequested` without its real `exactPlanInteractions` helper. Repair only that test realm and rerun the failed test by exact name; retain the original result and do not repeat the 74 passing tests. This test dependency is causally required to qualify the unchanged owned-stage boundary, not a production feature.
