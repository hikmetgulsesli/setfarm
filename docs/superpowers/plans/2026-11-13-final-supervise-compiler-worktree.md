# Final Supervisor Compiler Worktree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. One implementation task; root alone delivers.

**Goal:** Let compiler-owned final supervision execute its existing owned evidence under the exact canonical repository binding and preserved instruction provenance.

**Architecture:** Carry the final-product repository through the existing initial runtime reservation and canonical JSON resolvedInput. Authenticate source context at publication/reissue; preserve the existing completion lease and source checks.

**Tech Stack:** TypeScript ESM, node:test, existing Postgres test harness.

**Spec:** docs/superpowers/specs/2026-11-13-final-supervise-compiler-worktree-design.md

## Global Constraints

- Existing sole writer; no generated-project edits, live DB/config/service/provider effects, new roles/schema/credentials or guard bypass.
- Preserve no-worker PID/start/runtime-path semantics and exact completion lease/worktree/source protections.
- Root owns staging, commits, push, PR and rollout; implementation/review agents are non-delivery and spawn no agents.
- Preserve all new records and existing workspaces. No workspace deletion or broad test campaign.

## File Map

- Modify src/installer/step-ops.ts: derive canonical final intent before fresh/reissued claim authentication; return meaningful canonical compiler JSON input bound to the reserved final repository; revalidate reissue without backfill.
- Modify src/execution/claim-runtime-publication.ts: compare final-product runtime worktree against locked current run context after real subject authentication and before birth/replay; reject conflicting or missing canonical source without producing an owner.
- Modify src/spawner.ts only if a regression proves existing JSON cwd/envelope behavior requires a correction; otherwise consume it unchanged.
- Modify tests/execution-attempts/claim-runtime-publication.test.ts: compose the regression with its existing authenticated seedV3LoopWithStoryAdmission fixture, real publication/lifecycle/lease SQL and finite peripheral ports. Reuse the admission fixture instead of duplicating its setup in a new test file.
- Update existing affected fixture setup only when its actual final-product context must now contain the required canonical repository; preserve its prior assertions.

### Task 1: Bind the compiler final-supervision handoff

**Consumes:** protected run context; existing RuntimeClaimIntentV1 optional worktree; authenticated final_product claim subject; ClaimResult.resolvedInput; actual safeAgentCwdFromClaimInput/runtimeClaimEnvelope and runOwnedSuperviseStageEvidenceV1.

**Produces:** the same final repository in initial runtime.worktree, returned JSON.repo and completion envelope.workdir/repo; exact nonempty envelope.input; unchanged guards and neutral worker fields.

- [ ] Write the composed regression before implementation. Use a temporary clean Git repo and the existing isolated Postgres harness. Obtain the compiler claim's actual returned input rather than supplying the corrected value in the test. Run real publication, owner/drain and supervisor lease SQL. Stop at a bounded evidence sentinel; do not call a model. Assert the original failure is the NULL/scratch mismatch, not fixture setup or absent helper.
- [ ] Capture original RED process, exact command, exit and output under this plan's private workspace. Do not re-run an unchanged successful command later without a reason.
- [ ] Implement the smallest initial-binding change. For a final-product v3 supervise claim, form an effective intent using the existing final source resolver and keep conflicting caller worktree a refusal. Publication already locks runs.context; validate the same canonical repo there before birth/replay. Reissue must compare current locked context, authenticated subject and the existing runtime, refusing NULL/mismatch without mutation. Reuse existing structures; no new public mutation API.
- [ ] Return deterministic instruction through resolvedInput. Required shape is canonical JSON with `schema: "setfarm.final-supervise-compiler-instruction.v1"`, `repo` equal to the reserved final worktree, and `instruction: "Audit the final integrated product with Setfarm-owned evidence under the authenticated final-product completion owner."`. Do not include story_workdir or a competing cwd value. Existing spawner parser/envelope must preserve this exact string.
- [ ] Complete the same fixture with refusal checks for stale/conflicting current repo, NULL/mismatched reissue, wrong/expired completion owner lease, and no evidence effects on refusal. Keep the actual SQL predicate unmodified. Do not fabricate worker PID/start or repair old persisted rows.
- [ ] Run the new regression to GREEN. Run adjacent changed-boundary tests: claim-runtime-publication, subscription-spawner-integration-v1 and subscription-owned-stage-evidence-v1, using their maintained harness. If an unchanged fixture needs a complete canonical final context, document that narrow adjustment and run its affected test. No full npm test matrix.
- [ ] Self-review the exact diff and write task-1-report.md with files changed, behavior, actual RED/GREEN commands/exits/counts, original capture paths and remaining limitations. Leave source edits for root to inspect and commit; do not build a dirty worktree.

## Root delivery after Task 1

- [ ] Review the task diff and original captures; commit the bounded source/test change on the scoped branch.
- [ ] Generate task review package and obtain independent task review; fix only material findings through the implementer with scoped reruns.
- [ ] Obtain whole-branch review on the complete plan diff. Keep records and adjudications.
- [ ] Deliver the normal reviewed PR and prepare one clean merged-source build. Do not bypass live/source guards or mark the retained current0ef failure passed.
- [ ] Reconcile current runtime/termination before any later guarded rollout. Update exact handoff phase with new source/review/build identities and unqualified remaining work.
