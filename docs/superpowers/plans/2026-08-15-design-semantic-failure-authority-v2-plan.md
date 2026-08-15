# DESIGN Semantic Failure Authority v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authorize the exact DESIGN semantic-closure termination cause in runtime and PostgreSQL without changing the frozen authority-v1 or migration-21 identities.

**Architecture:** Add an authority-v2 registry that is the immutable v1 registry plus one exact DESIGN binding, and route current termination validation through the v2 evaluator. Add migration 30 as an additive replacement of the operational-failure-cause check constraint, with exact detect/verify/adopt semantics and a source-bound implementation digest; migration 21 and authority v1 remain byte-semantically frozen.

**Tech Stack:** TypeScript, Node.js test runner, PostgreSQL isolated-test harness, Zod, contract-spine semantic migration digests.

**Spec:** Runtime failure from clean convergence run `e19ca526-86c8-454c-b284-3681e437d103`: `RUN_TERMINATION_FAILURE_CAUSE_AUTHORITY_INVALID:PRODUCER_TUPLE_UNAUTHORIZED` for `DESIGN_SOURCE_SEMANTIC_CLOSURE_OPERATIONAL_CAUSE_V1`.

## Global Constraints

- Preserve `OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1` length 39 and hash `f420432715e094b6b60435b678eb320d553f6d77d33b9716833b4bd07235ad01`.
- Preserve migration 21 name, statements, source identity, and journal checksum.
- Authorize only requester `setfarm.step-fail.single` with workflow step `design`, boundary `product_compiler.design_source.semantic_closure`, class `contract_invalid`, and code `DESIGN_SOURCE_SEMANTIC_CLOSURE_REJECTED`.
- Reject mutated requester, step, boundary, class, code, structure, and forbidden evidence-carried cause fields.
- Migration 30 must upgrade existing v29 databases, reject partial/drifted adoption, verify the exact v2 SQL predicate, and remain crash/idempotency safe under the existing fenced migrator.
- Do not mutate live databases or services until the PR is merged into a clean canonical main and the migration is applied through the official CLI.

---

### Task 1: Authority v2 runtime contract

**Files:**
- Create: `src/execution/operational-failure-cause-authority-v2.ts`
- Modify: `src/execution/run-termination.ts`
- Create: `tests/execution-attempts/operational-failure-cause-v2.test.ts`
- Modify: `tests/execution-attempts/run-termination.test.ts`

**Interfaces:**
- Consumes: `OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V1`, `evaluateOperationalFailureCauseEvidenceAuthorityV1`, and `OperationalFailureCauseV1Schema`.
- Produces: `OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V2`, `evaluateOperationalFailureCauseAuthorityV2(input)`, `evaluateOperationalFailureCauseEvidenceAuthorityV2(input)`, `operationalFailureCauseAuthoritySqlPredicateV2(input)`, and `operationalFailureCauseEvidenceAuthoritySqlPredicateV2(input)`.

- [ ] **Step 1: Write failing authority-v2 tests**

  Assert that v1 still rejects the DESIGN cause, v2 accepts only the exact tuple for `setfarm.step-fail.single`, all one-field mutations reject, existing v1 tuples still accept, and the v1 registry hash remains unchanged.

- [ ] **Step 2: Run the new test and verify RED**

  Run: `node --import tsx --test tests/execution-attempts/operational-failure-cause-v2.test.ts`

  Expected: FAIL because `operational-failure-cause-authority-v2.ts` does not exist.

- [ ] **Step 3: Implement the minimal v2 registry/evaluators**

  Freeze a v2 registry containing the v1 bindings plus exactly one DESIGN binding. Delegate evidence checks for v1 requesters to v1 and accept the new DESIGN binding only when the strict cause tuple matches; do not add occurrence-derived fields to semantic identity.

- [ ] **Step 4: Route run termination through v2 and add a failing/passing transaction test**

  Add a run-termination test proving the exact DESIGN request reaches durable insertion while a mutated boundary throws `RUN_TERMINATION_FAILURE_CAUSE_AUTHORITY_INVALID:PRODUCER_TUPLE_UNAUTHORIZED`.

- [ ] **Step 5: Run focused runtime tests GREEN**

  Run: `node --import tsx --test tests/execution-attempts/operational-failure-cause-v1.test.ts tests/execution-attempts/operational-failure-cause-v2.test.ts tests/execution-attempts/run-termination.test.ts`

  Expected: all tests pass and v1 hash assertions remain unchanged.

### Task 2: Contract-spine migration 30

**Files:**
- Create: `src/db/operational-failure-cause-authority-v2-migration.ts`
- Modify: `src/db/contract-spine-migrations.ts`
- Modify: `src/db/contract-spine-migration-source-integrity.ts`
- Regenerate: `src/db/contract-spine-migration-digests.generated.ts`
- Modify: `tests/execution-attempts/operational-failure-cause-migration.test.ts`
- Modify: `tests/execution-attempts/migration-source-digests.test.ts`
- Modify: `tests/execution-attempts/migrations.test.ts`

**Interfaces:**
- Consumes: v2 SQL authority/evidence predicates and existing migration error factory/fenced migration registry.
- Produces: migration `030_operational_failure_cause_authority_v2`, exact apply/detect/verify adapters, and semantic digest entry 30.

- [ ] **Step 1: Write failing migration-30 tests**

  Start an isolated database at the existing migration head, prove the DESIGN tuple is rejected before v30, apply v30, prove exact DESIGN insertion succeeds, and prove mutations fail the named check constraint. Assert reapply is idempotent and drifted constraint adoption is rejected.

- [ ] **Step 2: Run the migration tests and verify RED**

  Run: `node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/execution-attempts/operational-failure-cause-migration.test.ts`

  Expected: FAIL because migration 30 and its digest/source manifest are absent.

- [ ] **Step 3: Implement migration 30**

  Replace only `run_termination_requests_operational_failure_cause_check` with the exact v2 expression under the existing fenced migration transaction. Detect `absent|present|partial`, verify canonical expression plus behavioral probes, and leave the immutable trigger/function unchanged unless its semantics require a v2-specific exact update.

- [ ] **Step 4: Register migration 30 and source integrity**

  Add the version-30 registration/adapters and source regions, then run `node --import tsx scripts/check-contract-spine-migration-digests.ts --write` to generate the implementation digest. Update expected migration lists without changing historical digests.

- [ ] **Step 5: Run focused migration tests GREEN**

  Run: `node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/execution-attempts/operational-failure-cause-migration.test.ts tests/execution-attempts/migrations.test.ts tests/execution-attempts/migration-source-digests.test.ts`

  Expected: all tests pass; migration 30 is the unique supported head; historical checksums remain accepted.

### Task 3: Delivery and live proof

**Files:**
- Modify only files required by Tasks 1–2; do not edit generated runtime projects.

**Interfaces:**
- Consumes: clean feature branch, focused tests, migration source-integrity check.
- Produces: reviewed PR, clean canonical main, official migration application, and convergence evidence.

- [ ] **Step 1: Verify before commit**

  Run focused execution-attempt tests, `npm run check:migration-digests`, `npm run typecheck`, and `git diff --check`.

- [ ] **Step 2: Commit and build from a clean worktree**

  Commit the reviewed diff with a conventional message, then run `npm run build` and the relevant execution-attempt suite from the clean commit.

- [ ] **Step 3: Push a PR and resolve review feedback**

  Push the branch, open a PR against Setfarm `main`, inspect checks and unresolved threads, apply only root fixes, and merge only when current checks and review are green.

- [ ] **Step 4: Apply migration through the official clean-main release path**

  On clean canonical Setfarm main with no active owners, run `npm run --silent db:contract-spine:plan`, `npm run --silent db:contract-spine:apply`, and `npm run --silent db:contract-spine:verify`; retain the release SHA and journal evidence.

- [ ] **Step 5: Rerun the clean canary and golden convergence matrix**

  Run a new clean canary, require the DESIGN semantic retry to terminate or recover without authority rejection, then run the 8-slot convergence matrix at the same clean release. Continue with recovery/idempotency, Mission Control DB/API/UI, controlled-fleet, and clean-main closure gates from the active goal.
