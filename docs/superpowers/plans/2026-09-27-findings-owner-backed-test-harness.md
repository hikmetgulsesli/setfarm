# Findings Owner-Backed Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Root remains the sole writer; other agents are read-only.

**Goal:** Restore truthful clean-main findings-suite verification without weakening owner-production or recovery-claim guards.

**Architecture:** Route the ten findings files that create isolated databases through the existing authenticated P3 projection runner, one file per invocation. Keep the eight pure files on the lightweight runner; align one legacy manual-claim test with the current fail-closed reservation boundary.

**Tech Stack:** Node 26, TypeScript, `node:test`, PostgreSQL 17.

**Spec:** `docs/superpowers/specs/2026-09-27-findings-owner-backed-test-harness-design.md`.

## Global constraints

- Root is the only writer. Preserve all prior worktrees, selected CLI/dist and live database/services.
- Test DB writes require the explicitly identified private PostgreSQL 17 cluster on port 55437, not the ambient `SETFARM_PG_URL`.
- Do not bypass admission, author a fake owner receipt, alter production guards, or hide failures.
- The test runner must reject a stale allowlist and propagate all child errors.
- This root fix is causally required because the full clean-main test run for reviewed PR #208 failed at the findings stage despite the targeted suites and build passing.

## File map

- Create `scripts/run-finding-tests.ts`: deterministic discovery, pure/owner-backed partition, serial P3 invocation and child-exit propagation.
- Create `scripts/finding-test-preflight.mjs` and `scripts/__tests__/finding-test-preflight.test.js`: classify all direct database-fixture imports and prove exact private-cluster preflight/refusal.
- Modify `package.json`: route `test:findings` through that runner only.
- Modify `tests/findings/recovery-delivery-repository.test.ts`: replace the obsolete manual-claim success expectation with exact fail-closed no-residue assertions.
- Modify `tests/findings/repository.test.ts`: point the cold pre32 catalog source extraction at its current import-inert census module and extract only its actual dependencies; production implementation stays unchanged.
- Modify `tests/findings/v3-github-review-authorization.integration.test.ts`: replace obsolete manually inserted repair claim with genuine compiler story admission and canonical recovery claim/runtime publication.
- Create `scripts/__tests__/run-finding-tests.test.js` only if a focused source/partition regression is needed beyond the executable `test:findings` gate.

---

### Task 1: Authenticate findings test fixtures

**Files:** Create `scripts/run-finding-tests.ts`; modify `package.json`.

**Interfaces:** The new runner consumes `tests/findings/*.test.ts` and uses the existing `scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 <one file>` interface. It produces the exit status of the first failed child.

- [x] **Step 1: Confirm RED.** Clean main and the isolated branch's explicit-private-cluster direct run failed at `INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_UNAVAILABLE`; downstream missing-row assertions cascaded from the absent owner activation.
- [x] **Step 2: Implement the smallest runner.** Discovery/sorted partition and exact ten-file allowlist are implemented. The runner rejects newly discovered direct `createIsolatedTestDatabase` use without registration, strips ambient `SETFARM_PG_URL`, and propagates signal/status errors. The pure `contracts.test.ts` focused run passed 8/8 and TypeScript passed. P3 itself refused the dirty `package.json`, as intended, so commit before Step 3.
- [x] **Step 3: Run focused GREEN until the next real failure.** With the committed runner, private P3 execution passed the first four delivery tests and exposed only the obsolete manual-claim success expectation. The owner-producer-unavailable cascade disappeared.

### Task 2: Preserve the recovery publication fence in the legacy test

**Files:** Modify `tests/findings/recovery-delivery-repository.test.ts`.

**Interfaces:** The test consumes existing `createAttemptRepository(...).reserve(...)` and `createRecoveryDeliveryRepository(...).findDelivery(...)`; no runtime API changes.

- [x] **Step 1: Confirm RED.** Under the committed P3 runner, the manual `INSERT INTO claim_log` case failed with `RECOVERY_ATTEMPT_CLAIM_PUBLICATION_NOT_FOUND` while four sibling cases passed.
- [x] **Step 2: Align the expectation.** The manual claim is now a negative fixture asserting exact rejection, zero attempt rows, no delivery attempt ID, and retained `leased` state. Modern canonical success tests remain unchanged.
- [ ] **Step 3: Run GREEN.** Run this file in one P3 invocation, then run the full findings command. Investigate and fix any different failure with its own RED evidence.

### Task 2a: Align the moved cold pre32 catalog test

**Files:** Modify `tests/findings/repository.test.ts`.

**Interfaces:** The existing source-extraction test still invokes the private `requireColdPre32CatalogAbsenceV1` function against synthetic rows and an isolated migration-31 database.

- [x] **Step 1: Confirm RED.** Full P3 findings run passed the other 15 repository assertions but failed before catalog assertions because the function no longer resides in `baseline-post-handoff-receipt-v1.ts`.
- [x] **Step 2: Update only the source locator.** Extract `requireColdPre32CatalogAbsenceV1`, `isPlainRecord`, `hasExactKeys`, and `currentEntryFail` from `baseline-legacy-database-census-v1.ts`; do not export or alter the production function.
- [ ] **Step 3: Run GREEN.** Require the focused repository file and full findings suite to pass with no skipped owner-backed cases on the private cluster.

### Task 2b: Enforce private-cluster identity before owner-backed tests

**Files:** Create `scripts/finding-test-preflight.mjs` and `scripts/__tests__/finding-test-preflight.test.js`; modify `scripts/run-finding-tests.ts`.

- [x] **Step 1: Confirm RED.** Read-only review identified that migration-only fixture imports escaped the allowlist check, while any localhost admin URL (including live port 5432) could be accepted. The new behavior tests initially failed on missing classifier/preflight functions.
- [x] **Step 2: Implement and prove local GREEN.** Test direct fixture-module import classification and exact private PostgreSQL directory/port/socket identity; `node --test` passed 2/2. A wrong-directory integration attempt refused before any P3 database clone.
- [ ] **Step 3: Verify positive preflight.** Execute the focused owner-backed file using the actual private-cluster identity.

### Task 2c: Restore canonical GitHub review recovery fixture

**Files:** Modify `tests/findings/v3-github-review-authorization.integration.test.ts`.

- [x] **Step 1: Confirm RED.** Under P3, the first six cases passed and three resolution-success cases failed at `RECOVERY_ATTEMPT_CLAIM_PUBLICATION_NOT_FOUND` from manually inserted repair claims.
- [x] **Step 2: Use actual authorities.** Seed canonical compiler story admission, keep the selected story's immutable fields, and acquire/publish a bounded recovery claim/runtime before reserving the repair attempt.
- [ ] **Step 3: Run GREEN.** First P3 run passed 7/9, including the canonical success case, and exposed a second fixture issue: three test runs reused the same global runtime session ID because the canonical story ID is stable. Bind the session ID to the run ID; rerun all cases, then the remaining full findings suite.

### Task 3: Review and deliver

**Files:** The scoped files above plus the spec/plan.

**Interfaces:** No production export or runtime behavior changes.

- [ ] **Step 1: Verify.** Run findings on the private cluster, script tests, relevant recovery/attempt focused tests, `npx tsc --noEmit`, source manifest/digest checks and `git diff --check`. Build only after committing to a clean worktree.
- [ ] **Step 2: Review and PR.** Obtain independent read-only review, fix findings test-first, commit conventionally, push this branch, wait for GitGuardian and exact-head Codex review, then merge by verified SHA.
- [ ] **Step 3: Clean-main evidence.** Fast-forward the preserved deployment worktree, run an ordinary clean-main build and focused merged-main findings test on the private cluster; recheck old selected CLI identity and HTTP 3080/3333/18789 without service mutation.
