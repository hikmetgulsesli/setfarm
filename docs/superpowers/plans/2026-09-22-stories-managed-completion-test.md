# STORIES Managed-Completion Contract Test Implementation Plan

> **For agentic workers:** Root is the sole writer. Review agents are read-only.

**Goal:** Restore the full-suite STORIES gate after the intentional managed-completion ownership change, without restoring early runtime release or weakening runtime guards.

**Architecture:** Keep the existing compiler-only source contract; replace its obsolete direct-release symbol check with scoped checks of the claim handoff, terminal no-agent publication branch, processor drain, and accept-and-release boundary. Existing database lifecycle suites prove the downstream behavior. This test does not claim to exercise the combined live spawner path.

**Tech stack:** TypeScript, node:test, isolated PostgreSQL test runner.

**Spec:** `docs/superpowers/specs/2026-08-12-v3-story-claim-runtime-binding-v1-design.md`

## Global constraints

- Keep V3 claim/runtime authority and all completion guards intact.
- Do not change production code, runtime configuration, or live database state.
- Root is the sole writer; review agents only read.

## Causal scope and file map

The clean-main `npm test` after PR143 stopped at `tests/steps/03-stories.test.ts:87`. The test requires `releaseReservedRuntimeSessionInTransaction` in `step-ops.ts`, but commit `c4fc112c` intentionally removed that call. Current success ownership flows through `compilerCompletionOutput` and runtime ID, spawner no-agent managed publication, proven drain, and accepted completion release. The old assertion is stale on pre-PR main `07c2b163` as well. This test correction is necessary to regain a meaningful full-suite signal for the same internal-production closure; it changes no production behavior.

- Modify `tests/steps/03-stories.test.ts`: keep compiler preclaim guards; assert current handoff/no-spawn/drain/accept ownership source boundaries instead of a direct release call.
- No production files or runtime configuration change.

## Task 1: Correct the STORIES source contract

**Files:** Modify `tests/steps/03-stories.test.ts`; create this plan only.

**Interface:** The test reads the real source boundary; it does not mock runtime owners.

- [x] RED: targeted `keeps v3 STORIES on the compiler-owned no-agent path` fails on the obsolete symbol in clean main `223befb0`.
- [x] GREEN: replace the obsolete assertion with current owner-chain checks; run the targeted test (1/1).
- [x] Independently review the mutation boundary: removing the no-agent branch's terminal `return` must fail the new assertion.
- [ ] Run complete `03-stories` isolated suite, relevant runtime-completion integration, noemit and contract checks.
- [ ] Independent read-only review; commit, PR, exact-head security/cloud review, SHA-bound merge.
- [ ] Normal clean-main build and rerun `npm test` with the verified local isolated-test DB URL. Report any further independent failure exactly.
