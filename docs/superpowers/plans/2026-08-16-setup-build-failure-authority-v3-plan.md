# Setup-Build Failure Authority v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every current v3 setup-build packet rejection terminalize exactly once by aligning the TypeScript and PostgreSQL operational-failure authorities without changing historical authority or migration identities.

**Architecture:** Add immutable authority v3 as authority v2 plus one closed setup-build binding for the three current missing packet codes. Add contract-spine migration 31 as an exact, source-bound replacement of the failure-cause check constraint, then prove the existing terminal preclaim lifecycle closes one claim and refuses redispatch. Runtime mapping is compile-time exhaustive over `SetupBuildPacketErrorCode`; no cause-dropping fallback or retry-policy change is introduced.

**Tech Stack:** TypeScript ESM, Node.js test runner, PostgreSQL isolated-test harness, Zod, contract-spine semantic migration digests, GitHub pull-request delivery.

**Spec:** `docs/superpowers/specs/2026-08-16-setup-build-failure-authority-v3-design.md`

## Global Constraints

- Preserve authority v1 length 39 and hash `f420432715e094b6b60435b678eb320d553f6d77d33b9716833b4bd07235ad01`.
- Preserve authority v2 as exactly v1 plus the DESIGN semantic-closure binding; do not edit its source-bound behavior.
- Preserve migrations 21 and 30, their regions, names, statements, checksums, and source digests.
- Authority v3 adds only requester `setfarm.step-fail.single`, workflow step `setup-build`, boundary `product_compiler.setup_build_packet`, class `contract_invalid`, and codes `SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED`, `SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED`, and `SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED`.
- Keep `SETUP_PACKET_SEMANTICS_VERSION_MISMATCH` normalized to the already-authorized `SETUP_PACKET_PROTOCOL_MISMATCH`.
- Do not add a fallback that removes `operationalFailureCause`, weakens SQL authority, or requeues a terminal platform preclaim.
- Do not modify the live database, services, or generated project repositories before reviewed merge and clean-main rollout.
- Feature-branch verification uses focused tests, TypeScript `--noEmit`, English/path/digest checks, and diff hygiene. `npm run build` is intentionally reserved for clean synchronized `main`, because the build identity guard rejects non-main branches.
- External signing, notarization, distribution, and public release remain deferred.

---

### Task 1: Runtime authority v3 and exhaustive setup-packet mapping

**Files:**
- Create: `src/execution/operational-failure-cause-authority-v3.ts`
- Modify: `src/execution/run-termination.ts`
- Modify: `src/evals/convergence-runner.ts`
- Modify: `src/server/schemas/run-operational-snapshot-v1.ts`
- Modify: `src/installer/steps/05-setup-build/preclaim.ts`
- Create: `tests/execution-attempts/operational-failure-cause-v3.test.ts`
- Modify: `tests/execution-attempts/v3-setup-build-failure-cause.integration.test.ts`

**Interfaces:**
- Consumes: authority-v2 exports and `SetupBuildPacketErrorCode`.
- Produces: `OPERATIONAL_FAILURE_CAUSE_AUTHORITY_BINDINGS_V3`, `evaluateOperationalFailureCauseAuthorityV3(input)`, `evaluateOperationalFailureCauseEvidenceAuthorityV3(input)`, `operationalFailureCauseAuthoritySqlPredicateV3(input)`, `operationalFailureCauseEvidenceAuthoritySqlPredicateV3(input)`, `SETUP_BUILD_PACKET_OPERATIONAL_FAILURE_CODE_BY_ERROR_CODE_V3`, and `setupBuildPacketOperationalFailureCode(error)`.

- [ ] **Step 1: Write the failing authority-v3 test**

  Add literal causes for the three new codes and assert that v2 returns `PRODUCER_TUPLE_UNAUTHORIZED`, while the not-yet-created v3 evaluator is required to accept them. For each cause, mutate requester, step, boundary, class, code, and add a forbidden cause field; every mutation must reject. Assert existing v2 DESIGN and v1 setup-build causes remain trusted and pin v1/v2 identities.

- [ ] **Step 2: Verify RED**

  Run:

  ```bash
  node --import tsx --test tests/execution-attempts/operational-failure-cause-v3.test.ts
  ```

  Expected: FAIL because the v3 module or exports do not exist.

- [ ] **Step 3: Implement the minimal frozen v3 authority**

  Add one frozen binding:

  ```ts
  const SETUP_BUILD_PACKET_BINDING_V3 = Object.freeze({
    requestedBy: "setfarm.step-fail.single",
    workflowStepIds: Object.freeze(["setup-build"]),
    boundary: "product_compiler.setup_build_packet",
    failureClass: "contract_invalid",
    failureCodes: Object.freeze([
      "SETUP_PACKET_DESIGN_SOURCE_ATTEMPT_REJECTED",
      "SETUP_PACKET_DESIGN_SOURCE_CLOSURE_REJECTED",
      "SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED",
    ]),
  } satisfies OperationalFailureCauseAuthorityBindingV1);
  ```

  Compose it after the untouched v2 registry. Delegate v2 evidence evaluation for v2-trusted causes; the new exact tuple has no supplemental evidence contract. Move only current runtime consumers to v3.

- [ ] **Step 4: Write the exhaustive setup-packet mapping test and verify RED**

  Export the current mapping seam from preclaim, but first add a test with the hand-checked 25-code literal input list. Assert the map has exactly those keys, semantics-version maps to protocol-mismatch, every other value preserves its input code, and every resulting cause is trusted by authority v3. The production change this catches is a new or remapped packet code that is not authorized.

- [ ] **Step 5: Implement the exhaustive map**

  Replace the conditional helper with an immutable value satisfying:

  ```ts
  Readonly<Record<SetupBuildPacketErrorCode, string>>
  ```

  Include every union member literally. The helper performs only an indexed lookup. A future union member must produce a TypeScript error until deliberately mapped.

- [ ] **Step 6: Run focused runtime tests GREEN**

  Run:

  ```bash
  node --import tsx --test tests/execution-attempts/operational-failure-cause-v1.test.ts tests/execution-attempts/operational-failure-cause-v2.test.ts tests/execution-attempts/operational-failure-cause-v3.test.ts tests/execution-attempts/v3-setup-build-failure-cause.integration.test.ts
  npx tsc -p tsconfig.json --noEmit
  git diff --check
  ```

  Expected: all tests pass; TypeScript is clean; v1/v2 identity assertions are unchanged.

- [ ] **Step 7: Commit Task 1**

  ```bash
  git add src/execution/operational-failure-cause-authority-v3.ts src/execution/run-termination.ts src/evals/convergence-runner.ts src/server/schemas/run-operational-snapshot-v1.ts src/installer/steps/05-setup-build/preclaim.ts tests/execution-attempts/operational-failure-cause-v3.test.ts tests/execution-attempts/v3-setup-build-failure-cause.integration.test.ts
  git commit -m "fix(runtime): authorize setup-build packet failures"
  ```

### Task 2: Contract-spine migration 31

**Files:**
- Create: `src/db/operational-failure-cause-authority-v3-migration.ts`
- Modify: `src/db/contract-spine-migrations.ts`
- Modify: `src/db/contract-spine-migration-source-integrity.ts`
- Regenerate: `src/db/contract-spine-migration-digests.generated.ts`
- Modify: `scripts/contract-spine-migrate.ts`
- Modify: `package.json`
- Modify: `scripts/__tests__/contract-spine-migrate.test.js`
- Modify: `tests/execution-attempts/operational-failure-cause-migration.test.ts`
- Modify: `tests/execution-attempts/migration-source-digests.test.ts`
- Modify: `tests/execution-attempts/migrations.test.ts`
- Modify: `tests/execution-attempts/v3-platform-preclaim-terminal.integration.test.ts`
- Modify older-head fixtures that currently roll migration 30 back directly: `tests/execution-attempts/artifact-publication-batch-migration.test.ts`, `tests/execution-attempts/artifact-publication-batch-plan-migration.test.ts`, `tests/execution-attempts/artifact-store-authority-migration.test.ts`, `tests/execution-attempts/platform-release-store-record-ledger-v3-contract-integration.test.ts`, `tests/execution-attempts/preparation-authority-v2-migration.test.ts`, `tests/execution-attempts/product-compilation-attempt-migration.test.ts`, `tests/execution-attempts/run-terminal-transition.test.ts`, `tests/execution-attempts/runtime-completion-manifest-authority-migration.test.ts`, and `tests/execution-attempts/v3-story-claim-runtime-binding-v1-migration.test.ts`.

**Interfaces:**
- Consumes: authority-v3 SQL predicates and the exact validated migration-30 predecessor.
- Produces: migration `031_operational_failure_cause_authority_v3`, v31 detect/verify/current-audit interfaces, `rollbackOperationalFailureCauseAuthorityV3ToV30`, CLI mode `rollback-31-to-30`, package script `db:contract-spine:rollback-31`, and semantic digest 31.

- [ ] **Step 1: Write failing migration-31, current-head, and terminal lifecycle tests**

  In the isolated Postgres suite, assert exact v30 rejects each new tuple. Require migration 31 to apply all three, reject one-field variants through the named constraint, reapply idempotently, detect drift as partial, and rollback only when no v3-only durable cause exists. Update current-head tests to require `[26,27,28,29,30,31]` and older-head helpers to roll back 31 before 30.

  Change/add the terminal preclaim case to use exact cause `SETUP_PACKET_IMPLEMENTATION_SOURCE_MAP_REJECTED`. Require literal result `{ retrying: false, runFailed: true }`, one failed claim, one requested termination with the exact cause, zero completion requests, unchanged configured retry budget, and no second claim after another `claimStep` call. This test must fail against the exact migration-30 constraint before migration 31 exists.

- [ ] **Step 2: Verify RED**

  Run:

  ```bash
  node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/execution-attempts/operational-failure-cause-migration.test.ts tests/execution-attempts/migrations.test.ts tests/execution-attempts/v3-platform-preclaim-terminal.integration.test.ts
  ```

  Expected: FAIL because migration 31, its current audit, and rollback seam do not exist.

- [ ] **Step 3: Implement the dedicated v3 migration module**

  Follow the v2 module's fenced shape with v3 names and errors. Keep the constraint name stable. Treat exact canonical v1 or v2 as `absent`, exact v3 as `present`, and every other state as `partial`. Verification must prove all three positives and strict negatives. Export exact v2 restore statements for rollback; never alter the migration-30 module.

- [ ] **Step 4: Register version 31 and advance only current authority**

  Add v31 error binding, registration, current-object ownership, exact-head audit, current-head dispatcher, and rollback regions. Preserve v30 audit as historical. Extend `verifyOperationalFailureCauseSeal` to accept canonical v1, v2, or v3. The v31 audit must lock and read the exact validated v3 identity inside its read-only transaction and require journal head `[26,27,28,29,30,31]`.

- [ ] **Step 5: Add CLI rollback and exact provenance refusal**

  Add `rollback-31-to-30` plus `db:contract-spine:rollback-31`. Rollback holds the migration advisory lock, rejects newer heads, locks termination requests, refuses any durable v3-only cause, restores exact v2, verifies retained head 30, records the rollback receipt, and removes only journal version 31. It never rewrites or deletes operational evidence.

- [ ] **Step 6: Bind and regenerate migration source integrity**

  Add manifest entry 31 and every fixed version list. Bind the v31 migration module/regions and v1/v2/v3 authority dependencies. Generate, do not hand-edit, the digest:

  ```bash
  node --import tsx scripts/check-contract-spine-migration-digests.ts --write
  ```

  Assert digests 8 through 30 are byte-identical to their pre-task values.

- [ ] **Step 7: Run focused migration tests GREEN**

  Run:

  ```bash
  node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/execution-attempts/operational-failure-cause-migration.test.ts tests/execution-attempts/migrations.test.ts tests/execution-attempts/migration-source-digests.test.ts tests/execution-attempts/platform-release-store-record-ledger-v3-contract-integration.test.ts tests/execution-attempts/v3-story-claim-runtime-binding-v1-migration.test.ts
  node --test scripts/__tests__/contract-spine-migrate.test.js
  npm run check:migration-digests
  npx tsc -p tsconfig.json --noEmit
  git diff --check
  ```

  Expected: all tests/checks pass; version 31 is the unique current head; historical source digests remain stable.

- [ ] **Step 8: Commit Task 2**

  ```bash
  git add package.json scripts/contract-spine-migrate.ts scripts/__tests__/contract-spine-migrate.test.js src/db/operational-failure-cause-authority-v3-migration.ts src/db/contract-spine-migrations.ts src/db/contract-spine-migration-source-integrity.ts src/db/contract-spine-migration-digests.generated.ts tests/execution-attempts
  git commit -m "fix(db): add failure authority migration 31"
  ```

### Task 3: Review, delivery, and clean-main rollout

**Files:**
- Modify only Task 1/2 files if review reveals a causal defect.

**Interfaces:**
- Consumes: authority v3, migration 31, and existing `terminal_platform_preclaim` lifecycle.
- Produces: one-claim terminal regression, reviewed PR, clean synchronized main, applied/verified migration 31, and a fresh convergence result.

- [ ] **Step 1: Re-run the terminal integration on the complete branch**

  Run:

  ```bash
  node --import tsx scripts/run-isolated-postgres-tests.ts -- node --import tsx --test tests/execution-attempts/v3-platform-preclaim-terminal.integration.test.ts tests/execution-attempts/v3-platform-preclaim-termination-race.integration.test.ts
  ```

  Expected: the live tuple terminalizes once; the existing conflicting-owner race still fails closed.

- [ ] **Step 2: Run branch verification**

  Run:

  ```bash
  npm run check:english
  npm run check:paths
  npm run check:migration-digests
  npx tsc -p tsconfig.json --noEmit
  npm run test:execution-attempts
  npm run test:scripts
  git diff --check origin/main...HEAD
  git status --short --branch
  ```

  Expected: all checks pass and the feature worktree is clean. Do not invoke `npm run build` on the feature branch.

- [ ] **Step 3: Commit, independent review, and PR delivery**

  Commit the terminal test if it is not already included, run task-scoped and whole-branch reviews, fix every actionable Critical/High/Medium finding, push the scoped branch, open a Setfarm PR, wait for current checks, inspect unresolved review threads, and merge only after green review. Standing owner authorization covers the ordinary push/PR/merge workflow.

- [ ] **Step 4: Clean-main rollout**

  Synchronize `/Users/setrox/ai/setrox/.worktrees/setfarm-internal-production-bootstrap` to merged `origin/main`. Require clean main and fresh complete zero-owner census. Run:

  ```bash
  npm run build
  npm test
  npm run --silent db:contract-spine:plan
  npm run --silent db:contract-spine:apply
  npm run --silent db:contract-spine:verify
  ```

  Apply/verify migration before starting new runtime bytes. Restart Setfarm spawner/dashboard only through their code-owned CLI, then require CLI version/source SHA and HTTP health to match merged main.

- [ ] **Step 5: Fresh runtime proof and goal continuation**

  Do not resume run `bcf8aa39-54fb-4c89-9576-d7a07fee7dce` or its generated repo. Launch a new clean canary at the merged release, prove no `PRODUCER_TUPLE_UNAUTHORIZED` or unchanged setup-build claim recurrence, then run the golden convergence matrix. Continue the active goal through recovery/idempotency, Mission Control DB/API/UI, controlled fleet, and clean-main closure gates. Keep external signed distribution deferred.
