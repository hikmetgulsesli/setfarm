# Read-only Verifier Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Remove the impossible agent-owned merge requirement from the read-only verify stage while retaining every platform merge gate.

**Architecture:** Reviewer done is a source/evidence review handoff. Existing handleVerifyEachCompletion owns exact-head premerge checks, merge and postmerge verification; its code and all authority guards remain unchanged.

**Tech Stack:** TypeScript ESM, Node test runner/tsx, Markdown prompt assets.

**Spec:** docs/superpowers/specs/2026-11-13-readonly-verifier-handoff-design.md

## Global Constraints

One existing sole writer; no main commit, new worktree, dependency install, build while dirty, role/credential/tool policy change, DB repair, generated app edit, gate bypass, prose-to-pass conversion or current run replay. Preserve all records. Root alone commits/pushes/merges/effects. Scope exactly the six files in the amended spec File Map; independent followups require a recorded root ruling.

### Task 1: Align the verify handoff contract

**Files:** See the exact six-file File Map in the spec. No production TypeScript edits.

**Interfaces:** Consumes existing verifyModule.buildPrompt(PromptContext): string and its unchanged STATUS done|retry|skip|fail parser. Produces a capability-consistent rendered instruction and matching role guidance, without changing completion authority or merge behavior.

- [ ] Read the spec, actual prompt/rules/reviewer VERIFY section, module.ts buildPrompt, actual production owned OPEN-merge clause and tests/execution-attempts/subscription-owned-stage-evidence-v1.test.ts.
- [ ] Add tests/steps/07-verify-readonly-handoff.test.ts importing verifyModule directly (avoid importing step-ops in this new test). Render a realistic OPEN/clean/preflight+supervisor-evidence context. Assert read-only review, platform merge ownership, done-as-review-handoff, explicit missing-evidence honesty, and absence of fetch/checkout/PR edit/comment/merge commands or an already-MERGED requirement. Check the appended Rules too and verify-specific AGENTS section. Assert real acceptance defects still require retry and review does not establish story verified or merge success.
- [ ] Run `node --import tsx --test tests/steps/07-verify-readonly-handoff.test.ts`, save stdout/stderr/original exit under this plan workspace; expected RED is the existing agent merge requirement and shell instructions, not import/setup failure.
- [ ] Update actual prompt and appended rules. Preserve context bindings, current-story acceptance/scope/evidence/first-blocker rules and bounded review. Use this exact semantic contract in both: `STATUS: done means review passed and hands control to Setfarm; it does not mean the PR is merged or the story is verified.` State: `Setfarm owns PR metadata refresh, exact-head premerge checks, merge confirmation, and post-merge build/smoke verification.` Remove commands requesting agent fetch/checkout/retarget/comment/merge or execution of deterministic commands. Refer to configured commands as platform-owned checks and use supplied evidence honestly. A clean OPEN PR is reviewable; missing shell or merge capability alone is not a source defect. Do not ask the agent to fabricate check outcomes or approve missing mandatory acceptance evidence.
- [ ] Align only VERIFY portions of reviewer AGENTS: read canonical stage handoff/instruction for v3, read-only review role, no claim-summary override, same done handoff. Put a verify-specific precedence note above generic multi-role tool/GH examples; preserve security-gate/final-test sections and their behavior.
- [ ] Replace only the obsolete MERGED-pass requirement assertion in07-verify.test.ts; preserve other existing protection assertions unless exact wording changes require an equivalent capability-consistent assertion and record it.
- [ ] Run focused new test +07-verify.test.ts +existing subscription-owned-stage-evidence-v1.test.ts once. Record exact process results. On new failure, fix only the changed contract or a proven causal issue; do not broaden the matrix. Also run git diff --check. A clean committed release build is Root delivery work after reviews, not implementer work.
- [ ] Root ruling after original 74/75 run: include the real `exactPlanInteractions` production declaration in the unchanged isolated evidence fixture which currently extracts only `runImplementEvidenceIfRequested`. Rerun only `mandatory stage candidate commands remain owned with gate off and preserve disabled/advisory visual reporting` by test-name pattern. Preserve all existing ports and original failed capture; no production helper modification or new behavior mock. Report original 74/75 and corrected focused result separately.
- [ ] Self-review the whole five-file diff for contradictory merge/exec instructions, evidence honesty, scope limits and prompt max size. Write a concise task report with changes, RED/GREEN commands and exits, limitations and hashes. Do not stage/commit/push, build, change live state or delete the workspace.
