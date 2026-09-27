# Findings Owner-Backed Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Root remains the sole writer; other agents are read-only.

**Goal:** Restore truthful clean-main findings-suite verification without weakening owner-production or recovery-claim guards.

**Architecture:** Route the ten findings files that create isolated databases through the existing authenticated P3 projection runner, one file per invocation. Keep the eight pure files on the lightweight runner; align one legacy manual-claim test with the current fail-closed reservation boundary. The authenticated coordinator regression also requires the narrow revision-2 root fix: anchor immutable case identity to revision 1 while authenticating mutable current identity through the current revision and dispatch chain.

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
- Create `scripts/finding-test-preflight.mjs` and `scripts/__tests__/finding-test-preflight.test.js`: reject unclassified files and misplaced direct database-fixture imports; prove exact private-cluster preflight/refusal.
- Modify `package.json`: route `test:findings` through that runner only.
- Modify `tests/findings/recovery-delivery-repository.test.ts`: replace the obsolete manual-claim success expectation with exact fail-closed no-residue assertions.
- Modify `tests/findings/repository.test.ts`: point the cold pre32 catalog source extraction at its current import-inert census module and extract only its actual dependencies; production implementation stays unchanged.
- Modify `tests/findings/v3-github-review-authorization.integration.test.ts`: replace obsolete manually inserted repair claim with genuine compiler story admission and canonical recovery claim/runtime publication.
- Modify `tests/findings/v3-recovery-claim-authority.test.ts`: authenticate the attempt-bound reissue case through canonical story admission and claim/runtime publication while leaving the other lease cases unchanged.
- Modify `tests/findings/v3-recovery-coordinator.test.ts`: give initial claims and runs genuine owner births and model recovery attempts canonical story proof, claim/runtime publication, execution-slice authority, and no-spawn runtime release.
- Modify `tests/findings/v3-recovery-work-router.test.ts`: terminalize an unreserved initial dispatch as blocked, advance to changed source/slice/finding revision 2, and prove the router leases the revised supervisor chain.
- Modify `src/recovery/v3-recovery-claim-authority.ts`, `src/execution/attempt-repository.ts`, `src/recovery/v3-recovery-work-router.ts`, `src/recovery/v3-recovery-lifecycle-reconciler.ts`, `src/recovery/v3-evidence-only-worker.ts`, `src/recovery/v3-evidence-only-publication.ts`, and `src/recovery/recovery-delivery-repository.ts`: anchor the immutable case tuple to revision 1 and preserve the exact current revision/dispatch/delivery/finding-set chain.
- Modify `src/recovery/v3-evidence-only-runtime.ts`: read the exact current revision when selecting a terminal source-owning worktree; preserve the opening anchor, use opening prior refs only for revision 1, and for later revisions require one failed terminal parent dispatch/claim/attempt chain with exact source-before and source-after.
- Regenerate `src/db/contract-spine-migration-digests.generated.ts` with the canonical script because migration 33 declares `v3-recovery-claim-authority.ts` as a semantic helper dependency; retain the source-integrity refusal.
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
- [x] **Step 3: Verify positive preflight.** The focused owner-backed file reached the P3 clone on the actual private cluster; the first run reached 7/9 cases and exposed a separate runtime-session fixture collision.
- [ ] **Step 4: Close the indirect-import gap.** Independent review found that an unknown file with an indirect DB helper could be misclassified as pure. A new RED unit test first failed on missing classification API; add an explicit eight-file pure allowlist and refuse unclassified files before any test process starts, then require GREEN.

### Task 2c: Restore canonical GitHub review recovery fixture

**Files:** Modify `tests/findings/v3-github-review-authorization.integration.test.ts`.

- [x] **Step 1: Confirm RED.** Under P3, the first six cases passed and three resolution-success cases failed at `RECOVERY_ATTEMPT_CLAIM_PUBLICATION_NOT_FOUND` from manually inserted repair claims.
- [x] **Step 2: Use actual authorities.** Seed canonical compiler story admission, keep the selected story's immutable fields, and acquire/publish a bounded recovery claim/runtime before reserving the repair attempt.
- [ ] **Step 3: Run GREEN.** First P3 run passed 7/9, including the canonical success case, and exposed a second fixture issue: three test runs reused the same global runtime session ID because the canonical story ID is stable. Bind the session ID to the run ID; rerun all cases, then the remaining full findings suite.

### Task 2d: Preserve attempt-bound recovery-lease replay coverage

**Files:** Modify `tests/findings/v3-recovery-claim-authority.test.ts`.

- [x] **Step 1: Confirm RED.** Full findings passed 5/6 claim-authority cases; the lone attempt-bound case manually inserted a claim and failed at `RECOVERY_ATTEMPT_CLAIM_PUBLICATION_NOT_FOUND`.
- [x] **Step 2: Use actual authorities.** Only that case seeds canonical compiler story admission and publishes its acquired recovery lease through `publishLoopClaimRuntime` before attempt reservation.
- [ ] **Step 3: Run GREEN.** The first focused P3 rerun passed the old five cases and reached the new publication, then refused the test's obsolete arbitrary slice (`RECOVERY_DELIVERY_SLICE_AUTHORITY_MISMATCH`). Bind reservation to the handoff's contract slice, rerun the case, then the remaining findings files and complete suite.

### Task 2e: Restore coordinator fixture authority

**Files:** Modify `tests/findings/v3-recovery-coordinator.test.ts`.

- [x] **Step 1: Confirm RED.** P3 coordinator passed 5/8; terminal settlement refused a manually inserted ownerless claim (`INTERNAL_PRODUCTION_CLAIM_OWNER_UNAVAILABLE`), and two model recovery cases refused manually inserted unpublished claims (`RECOVERY_ATTEMPT_CLAIM_PUBLICATION_NOT_FOUND`).
- [x] **Step 2: Model authentic births.** Reuse production claim owner-birth APIs and canonical compiler admission; publish model recovery runtime/claim with a typed execution-slice envelope and release the never-spawned runtime after terminal attempt. Leave evidence-only delivery non-model.
- [ ] **Step 3: Run GREEN.** First P3 rerun found one shared strict-input mismatch: the local `canonical` fixture property was passed to `V3RecoveryCoordinatorInputSchema` and refused in six cases. Moving it to a run-keyed test-only map restored five passing cases. Remaining RED: two model cases used invalid underscore-rich runtime session IDs, and terminal settlement correctly refused an ownerless workflow-run birth. Use a schema-valid deterministic session ID and the production owner-reservation begin/bind APIs, then rerun.

### Task 2f: Authenticate bounded revision-2 identity

**Files:** The eight production gate files listed in the File Map, generated migration digest, and focused coordinator and claim/attempt/worker tests.

- [x] **Step 1: Confirm RED.** The authenticated coordinator integration reaches a real product failure, advances to a different source/slice/finding revision 2, then the supervisor claim fails at `V3_RECOVERY_AUTHORITY_IDENTITY_MISMATCH` solely because the frozen case tuple is compared to the current revision. Independent read-only reviews confirmed the dedupe/FK contract requires the case opening tuple to stay frozen.
- [x] **Step 2: Implement the smallest root fix.** Exact case-to-opening-revision identity and current revision-to-dispatch/delivery/finding-set identity now replace stale equality in model and non-model gates. The legacy revision-1 rehydration remains supported by raw-column opening comparison. A current revision's run/story must match the delivery before evidence publication. Refresh migration-33's declared helper digest rather than bypassing source integrity.
- [ ] **Step 3: Prove GREEN and refusal.** The original coordinator P3 file passed 8/8 (including bounded revision-2 supervisor). A later direct opening-revision tamper attempt was rejected by PostgreSQL's `ARTIFACT_IDENTITY_IMMUTABLE` trigger before claim authority; assert that exact database refusal and retained row. The revised router passed 8/8 after its pre-attempt terminal fixture used valid `blocked` state. Read-only review then exposed that revised evidence-only source ownership cannot use the opening `prior_attempt_refs`; add an exact parent-delivery/attempt positive and wrong-source negative before the final full findings suite.

### Task 3: Review and deliver

**Files:** The scoped files above plus the spec/plan.

**Interfaces:** One internal read-only selector export for direct integration verification; the existing revision-2 route must become usable without weakening exact owner and current-chain checks.

- [ ] **Step 1: Verify.** Run findings on the private cluster, script tests, relevant recovery/attempt focused tests, `npx tsc --noEmit`, source manifest/digest checks and `git diff --check`. Build only after committing to a clean worktree.
- [ ] **Step 2: Review and PR.** Obtain independent read-only review, fix findings test-first, commit conventionally, push this branch, wait for GitGuardian and exact-head Codex review, then merge by verified SHA.
- [ ] **Step 3: Clean-main evidence.** Fast-forward the preserved deployment worktree, run an ordinary clean-main build and focused merged-main findings test on the private cluster; recheck old selected CLI identity and HTTP 3080/3333/18789 without service mutation.
