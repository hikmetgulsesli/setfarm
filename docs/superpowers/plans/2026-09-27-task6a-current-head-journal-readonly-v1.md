# Task6A Current-Head Journal Read-only V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner requires root to remain the sole writer; subagents, if used, are read-only reviewers.

**Goal:** Verify the exact migration-1–33 journal and its own catalog from a restricted target-database login without a write, strong lock or startup behavior change.

**Architecture:** Export only immutable source identities from `completeMigrations`. A standalone verifier uses one bounded read-only snapshot to compare journal rows and source-owned `pg_catalog` projections, returns `void` on exact match and one fixed error on any drift. This is journal/catalog partial verification, not full contract-spine parity or Task6A admission.

**Tech Stack:** TypeScript, Node 26, PostgreSQL 17, `postgres`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-27-task6a-current-head-journal-readonly-v1-design.md`.

## Global Constraints

- Only the explicit private PG17 cluster with verified `data_directory`, non-live port and Unix socket may host test writes.
- No live roles, grants, credentials, LaunchAgents, selected CLI/dist, guarded migration-32/33, journal or admission change.
- The journal verifier must not invoke current full migration hooks, take advisory or SHARE locks, connect to maintenance `postgres`, or return runtime readiness.
- Root is sole writer; no direct-main commit, force push, worktree deletion, guard bypass or secret logging.
- The source identity export must stay outside frozen semantic migration regions; digest checks must pass.
- A clean-main build and focused merged-main private-cluster rerun follow reviewed PR merge.

## File map

- Modify `src/db/contract-spine-migrations.ts`: export a frozen, narrow source-derived identity list from `completeMigrations` only.
- Modify `tests/execution-attempts/migrations.test.ts`: advance the whole-file source hash pin for this reviewed outside-region export; retain the semantic digest and adjacent re-export assertions.
- Create `src/db/contract-spine-readonly-verifier-v1.ts`: one transaction and exact journal/catalog check, no effect hooks.
- Create `tests/internal-production/contract-spine-readonly-verifier-v1.test.ts`: source identities, fake transaction SQL safety, fixed error.
- Create `tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts`: real private-cluster restricted-role positive and drift cases.
- Modify `package.json` and `tests/internal-production/task-0-source-manifest.test.ts` only if their exact registration contracts require it.

---

### Task 1: Source-bound current-head identity

**Files:**
- Modify: `src/db/contract-spine-migrations.ts` after the existing re-export and planner function, outside the outer `migration-v33-blocked-successor-planner` region and without breaking the re-export adjacency contract.
- Test: `tests/internal-production/contract-spine-readonly-verifier-v1.test.ts`.

**Interfaces:**
- Consumes: existing `completeMigrations`, `checksum(migration)` and `migrationClass`.
- Produces: `getContractSpineCurrentHeadJournalIdentitiesV1(): readonly Readonly<{version:number; name:string; checksum:string; migrationClass:"automatic"|"guarded"}>[]`.

- [ ] **Step 1: Write RED source test.** Import the named getter; assert 33 frozen, contiguous version rows, version-32 class `guarded`, version-33 source identity matching the existing `V3_RECOVERY_CLAIM_RUNTIME_PUBLICATION_V1_MIGRATION_JOURNAL_IDENTITY`; assert no SQL connection argument or effect hook is returned.
- [ ] **Step 2: Run RED.** `env -u SETFARM_PG_URL node --import tsx --test tests/internal-production/contract-spine-readonly-verifier-v1.test.ts` must fail because the getter is missing, not because of a test syntax error.
- [ ] **Step 3: Implement the getter.** Freeze each literal projection `{version, name, checksum: checksum(migration), migrationClass}` from `completeMigrations`; freeze the returned array; assert exactly versions 1–33 before returning. Do not export migration objects or hook references. Advance only the reviewed whole-file hash pin; preserve historical semantic-region digests.
- [ ] **Step 4: Run GREEN and commit.** Run the focused pure test, `npm run check:migration-digests`, `./node_modules/.bin/tsc --noEmit`, `git diff --check`; commit the exact source/test files conventionally.

### Task 2: Standalone read-only journal/catalog verifier

**Files:**
- Create: `src/db/contract-spine-readonly-verifier-v1.ts`.
- Modify: `tests/internal-production/contract-spine-readonly-verifier-v1.test.ts`.

**Interfaces:**
- Consumes: raw target `postgres.Sql` and Task-1 source identity getter.
- Produces: `verifyContractSpineCurrentHeadJournalReadOnlyV1(sql: postgres.Sql): Promise<void>`; fixed error `SETFARM_CURRENT_HEAD_JOURNAL_CATALOG_MISMATCH_V1`.

- [ ] **Step 1: Write RED pure cases.** A fake `sql.begin` asserts exact `"isolation level repeatable read read only"`; capture the first statement as `SELECT pg_catalog.set_config('search_path', 'pg_catalog, public, pg_temp', true)`; assert bounded transaction-local timeouts, no DDL/DML/advisory/explicit table lock, and fixed redacted error for a missing table or SQL exception containing a private URL.
- [ ] **Step 2: Run RED.** The same focused pure command must fail at the missing verifier export.
- [ ] **Step 3: Implement static catalog projections.** Query schema-qualified `pg_catalog` for the exact journal relation, eight attributes, seven named constraints, two indexes, triggers/rules/policies/inheritance/incoming FK and dependency flags. Freeze expected PG17 type/default/definition literals from source and isolated fixture; do not derive them from the target. Query exactly all journal rows in version order with a finite limit and compare the 33 source identities/states. Catch and sanitize every error at the exported boundary; no repair or startup calls.
- [ ] **Step 4: Run GREEN and commit.** Focused pure tests, TypeScript, digest and diff checks must pass; commit exact module/test files conventionally.

### Task 3: Distinct restricted-role PostgreSQL proof and delivery

**Files:**
- Create: `tests/execution-attempts/contract-spine-readonly-verifier-v1.integration.test.ts`.
- Modify: `tests/execution-attempts/migrations.test.ts` for the source whole-file hash pin.
- Modify: `tests/internal-production/contract-spine-readonly-verifier-v1.test.ts` and `package.json` only for required normal-suite registration.

**Interfaces:**
- Consumes: Task-2 exported verifier and existing `createIsolatedTestDatabase()` fixture.
- Produces: real private-cluster evidence of exact journal/catalog verification under a distinct SELECT-only login with unchanged before/after catalog fingerprint.

- [ ] **Step 1: Write RED integration mutations.** Preflight admin `data_directory`, port and socket against explicit private-cluster environment. Create one random no-password LOGIN with `CONNECT` on fixture DB, `USAGE` on `public`, `SELECT` on only `setfarm_schema_migrations`; assert no CREATE/MAINTAIN/owner membership. Against a fully migrated fixture, the positive verifier must succeed without schema fingerprint change. Then reset isolated fixture per case and require refusal for missing/extra/edited row, wrong v32 state, revoked SELECT, missing column, altered constraint/index, rewrite rule, user trigger and incoming FK. Include a NOINHERIT login with SET-able and then ADMIN-only journal-writer membership: directly effective INSERT is false but the verifier must reject both latent paths. Preflight exact random role names as unused before CREATE and make them cleanup-eligible before issuing CREATE so an ambiguous committed CREATE is cleaned; do not remove a duplicate name owned elsewhere. Guard exact test-owned database/role cleanup in `finally` and propagate cleanup failures.
- [ ] **Step 2: Run RED in the private cluster.** Use explicit `SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY` and `SETFARM_TEST_PG_ADMIN_URL`, never ambient live `SETFARM_PG_URL`; the first absent invariant must be accepted or positive fail for the expected missing code, not an environment typo.
- [ ] **Step 3: GREEN, verify and review.** Complete only the catalog checks demonstrated by RED; run private-cluster integration (zero skip), existing migration suite, pure suite, source manifest, digest, TypeScript and diff checks. Obtain read-only independent review, push the scoped PR, require GitGuardian and exact-head Codex review with no unresolved major finding, then SHA-condition squash merge. Fast-forward preserved deployment worktree, run guarded clean-main build and focused merged-main isolated test. Recheck selected old CLI hash/inode and HTTP 3080/3333/18789 without changing selected services.

## Self-review boundary

This plan ends with a standalone journal/catalog verifier. It neither proves all migrated objects/private data nor enables `pgMigrate({baseSchemaMode:"verify"})`; both require separate reviewed work and writer-fence evidence.
