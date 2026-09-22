# V3 Deploy Receipt Fixture Owner Implementation Plan

> **For agentic workers:** Root is the sole writer; review agents are read-only. Use RED/GREEN and keep the P3 guard intact.

**Goal:** Restore the deploy-receipt integration suite's valid claim-owner fixture so the clean-main execution-attempts gate can continue.

**Architecture:** Replace the fixture's direct `claim_log` INSERT with the same transactional preallocate/prepare/insert-and-bind path used by production single-step claims, and route the file through the existing owner-backed test projection. Leave all five receipt assertions and production code unchanged.

**Tech Stack:** TypeScript, node:test, isolated PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-22-deploy-receipt-fixture-owner-design.md`

## Global Constraints

- Preserve all P3 claim-owner and terminal-close fail-closed guards.
- Do not mutate live PostgreSQL data, generated runtime artifacts, or selected historical dist.
- Root is the sole writer; PR branch only, no direct `main` commit.

## Causal scope and file map

The full clean-main Setfarm test signal is necessary for the same internal-production cutover objective. Five deploy-receipt ledger tests fail on a July fixture that inserts a claim without the P3 sidecar required since August. This predates PRs #143/#144 and is test-only drift.

- Modify `tests/execution-attempts/v3-deploy-receipt-repository.test.ts`: canonical owner-bound claim birth in `seed()`.
- Modify `scripts/run-execution-attempt-tests.ts`: classify the test as owner-backed so the existing P3 projection provides an activated producer manifest.
- Create this spec and plan as documentation of the causal scope.
- No production files.

### Task 1: Repair the shared deploy claim seed

**Files:** Modify the test file above.

**Interfaces:** Import `prepareInternalProductionClaimBirthV1` and `insertAndBindInternalProductionClaimBirthV1` from `src/execution/claim-runtime-publication.ts`. Keep `seed()`'s return shape and `claimId: number` unchanged.

- [x] RED: run `SETFARM_TEST_PG_ADMIN_URL=... node --import tsx scripts/run-execution-attempt-tests.ts v3-deploy-receipt-repository.test.ts`; the five fixture tests fail (four with `INTERNAL_PRODUCTION_CLAIM_OWNER_UNAVAILABLE`, final run also encountered a PostgreSQL deadlock before its assertion).
- [x] Intermediate RED: canonical claim birth in the raw test database fails all five cases with `INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_UNAVAILABLE`, proving the missing runner classification.
- [x] Replace direct claim INSERT with one `database.sql.begin` transaction: `SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id`; `prepareInternalProductionClaimBirthV1(transaction, 'a-claim-single-runtime-v1', ids)`; `insertAndBindInternalProductionClaimBirthV1(transaction, birth, {runId, workflowStepId:'deploy', storyId:null, claimAgentId:'deployer', claimedAt:new Date()})`.
- [x] Classify the test in the existing P3 owner-backed runner. Commit the source/test/plan before projected GREEN because its fail-closed projection rejects untracked docs and dirty files outside its tracked scope.
- [ ] GREEN: rerun the exact five-test file through the test runner; verify all 5 and DB cleanup.
- [ ] Run typecheck, relevant claim/runtime tests, `git diff --check`, independent read-only review; keep source File Map and inventory unchanged unless an exact gate requires the test path to be declared.
- [ ] Commit conventionally, push scoped PR, obtain exact-head security/cloud review, SHA-conditioned merge; run clean-main verification and report any further independent suite failure.
