# Task6A Base Catalog Read-only V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner directed root to remain the sole writer; other agents are read-only reviewers.

**Goal:** Verify the ordinary Setfarm base schema from PostgreSQL catalogs without database/schema write privilege or a startup behavior change.

**Architecture:** A standalone function accepts the already-selected target `postgres.Sql` and checks a frozen, source-owned manifest inside one bounded read-only repeatable-read transaction. Required ordinary base objects match exactly by member while additional contract-spine objects remain legal. The function is not wired into `pgMigrate()` or live services in this PR.

**Tech Stack:** TypeScript, Node 26, PostgreSQL 17, `postgres` tagged SQL, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-27-task6a-base-catalog-readonly-v1-design.md` (one independent slice of `docs/superpowers/specs/2026-09-27-task6a-base-schema-readonly-verify-design.md`).

## Global Constraints

- Use only the dedicated PostgreSQL 17 cluster whose `data_directory` and port are verified distinct from live; do not assume loopback alone is isolation.
- No live role/grant/credential, LaunchAgent, selected CLI/dist, migration-32/33, journal, or admission change.
- No source-derived expected value may be read from the target catalog at verification time; no generic presence-only checks.
- No startup call site or `pgMigrate()` change in this slice; no direct-main commit, force push, build-guard bypass, secret logging, or worktree deletion.
- Root is the only writer; read-only independent review and exact-head PR checks precede delivery.

## File map

- Create `src/db/base-schema-readonly-verifier-v1.ts`: static manifest and one transaction-scoped verifier only.
- Create `tests/internal-production/base-schema-readonly-verifier-v1.test.ts`: pure catalog-row, SQL-shape, timeout and redaction cases.
- Create `tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts`: real fixture checks through an independent restricted login, including drift and unchanged-catalog proof.
- Modify `package.json`: register the explicit private-cluster-only integration command; the ordinary suite may report this case as skipped but cannot count it as the gate.
- Modify test/source registration only where an existing exact inventory requires it; inspect `tests/internal-production/task-0-source-manifest.test.ts` and `package.json` before touching them.

---

### Task 1: Required tables and columns

**Files:**
- Create: `src/db/base-schema-readonly-verifier-v1.ts`
- Create: `tests/internal-production/base-schema-readonly-verifier-v1.test.ts`
- Test: `tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts`

**Interfaces:**
- Consumes: raw `postgres.Sql` for an already-existing target database and the ordinary DDL at `src/db-pg.ts:5900-6069`.
- Produces: `verifyOrdinaryBaseSchemaCatalogReadOnlyV1(sql: postgres.Sql): Promise<void>`; failure code `SETFARM_BASE_SCHEMA_CATALOG_MISMATCH_V1`.

- [x] **Step 1: Write RED tests.** Require the exported function to verify an ordinary fully migrated isolated fixture; require a missing table, missing column, wrong `runs.run_number` nullability and changed `stories.status` default to refuse. The expected transaction is `isolation level repeatable read read only`; the function must not return a schema-ready signal or mutate the fixture. Pure tests assert bounded `lock_timeout`, `statement_timeout`, `idle_in_transaction_session_timeout`, and fixed `search_path` statements.
- [x] **Step 2: Run RED.** The focused pure test first failed with missing module and then with accepted missing columns. The dedicated-cluster integration ran directly with explicit `SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY`; the generic P3 projection strips this environment and must not substitute for the cluster preflight.
- [x] **Step 3: Implement the table/column projection.** In the new module, freeze source-owned required columns from the seven `CREATE TABLE` statements and later `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements at `src/db-pg.ts:5900-6069`. Each row records table, column, exact PostgreSQL 17 formatted type, `atttypmod`, `attnotnull`, and `pg_get_expr(pg_attrdef.adbin, adrelid)` or null. Read `pg_class`/`pg_namespace` and `pg_attribute`/`pg_attrdef` with public schema and named-table predicates; reject a missing/duplicate required member, non-ordinary/temporary/partitioned table, dropped attribute, unexpected type/nullability/default or SQL error. Normalize no values from the target into the expected manifest. Use one bounded `sql.begin("isolation level repeatable read read only", ...)` with transaction-local settings and one fixed sanitized error at the exported boundary.
- [x] **Step 4: Run GREEN and inspect manifest.** The dedicated PG17 restricted-role integration and pure tests passed, with ordinary fixture positive and explicit table/column drift refusal. The required names/defaults were reviewed against the base DDL and ordinary fixture; `claim_log.id BIGSERIAL` and fresh `runs.run_number NOT NULL` remain exact. Tasks 1-3 are delivered as one reviewed slice commit rather than intermediate commits.

### Task 2: Required constraints, indexes and sequences

**Files:**
- Modify: `src/db/base-schema-readonly-verifier-v1.ts`
- Modify: `tests/internal-production/base-schema-readonly-verifier-v1.test.ts`
- Modify: `tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts`

**Interfaces:**
- Consumes: the Task 1 raw transaction and static base manifest.
- Produces: the same exported verifier, now complete for seven PKs, three base FKs, twelve explicit indexes, and two sequences.

- [x] **Step 1: Write RED mutation tests.** Drop `steps_run_id_fkey`, drop `idx_steps_run_status`, alter `runs_run_number_seq` increment, and detach `claim_log_id_seq` ownership one at a time in fresh isolated fixture states. The verifier must refuse each while a before/after catalog fingerprint around the verifier call is identical. The automated integration additionally tests missing table/column/default, wrong type and nullability.
- [x] **Step 2: Run RED.** Dedicated-cluster clones with missing index, missing FK and changed sequence increment were accepted before their corresponding checks were added.
- [x] **Step 3: Implement source-owned projections.** Check named PKs and the three `run_id -> runs.id ON DELETE CASCADE` FKs through `pg_constraint` with exact deparsed definition and flags. Check exactly the twelve index names from `src/db-pg.ts:6070-6108` through `pg_index`/`pg_class`/`pg_am`: btree, key order/direction, uniqueness, no INCLUDE/expressions, expected PostgreSQL 17 predicate deparse, and valid/ready/live state. Check `runs_run_number_seq` and `claim_log_id_seq` through `pg_sequence`, including type/limits/increment/cache/cycle and `pg_depend` ownership; do not inspect or compare `last_value`. Allow additional contract-spine objects outside these required names.
- [x] **Step 4: Run GREEN and review.** Focused private-cluster gate passed 4/4 with no skip; existing migration suite passed 54/54; digest, TypeScript, source-manifest and staged diff checks passed. Independent read-only review findings were addressed. Missing index/FK/sequence and changed sequence/ownership each demonstrate refusal without catalog change.

### Task 3: Distinct-role no-write integration and delivery

**Files:**
- Modify: `tests/execution-attempts/base-schema-readonly-verifier-v1.integration.test.ts`
- Modify: `tests/internal-production/base-schema-readonly-verifier-v1.test.ts`
- Modify: registration files only if their exact test/source manifests require it.

**Interfaces:**
- Consumes: `verifyOrdinaryBaseSchemaCatalogReadOnlyV1(sql: postgres.Sql): Promise<void>` from Tasks 1-2.
- Produces: reproducible evidence that a distinct restricted LOGIN can verify the already-existing base catalog without database/schema CREATE or journal MAINTAIN and without opening a maintenance-database connection.

- [x] **Step 1: Write the restricted-role case.** Before any role creation, require a test-only explicit expected `data_directory` and port to match `current_setting` on the admin connection. Create a random unique LOGIN in that private cluster without a password, using the private trust-authenticated Unix socket to exercise DB privilege isolation; the separate SCRAM credential rehearsal remains manual evidence. Grant only target-database CONNECT and public schema USAGE, and use a fresh `postgres.Sql` connection. Assert `session_user` is the new login and `has_database_privilege(CREATE)`, `has_schema_privilege(CREATE)`, and journal `has_table_privilege(MAINTAIN)` are false. Capture the catalog fingerprint before/after a positive call. In `finally`, close the restricted connection, drop only the generated fixture database and exact generated role.
- [x] **Step 2: Close privilege gaps without broad grants.** The distinct LOGIN succeeds with catalog visibility alone and no table SELECT grant. Owner-mutated drifts, including a dropped/readded column, identity conversion, and missing sequence, refuse under that login with unchanged before/after schema fingerprints. Inaccessible public schema and missing-target connection also refuse. The supported `npm run test:base-schema-catalog:isolated` path requires an explicit private-cluster preflight. No fallback to object-owner login and no grant of MAINTAIN, CREATE, BYPASSRLS or superuser.
- [ ] **Step 3: Verify and review final head.** Run the complete isolated migration suite on Node26 and the dedicated cluster, the pure tests, digest and TypeScript checks, and applicable source manifest tests. Obtain independent read-only review, push a scoped PR, require GitGuardian and exact-head Codex review with no unresolved major finding, then SHA-condition merge. Do the normal guarded clean-main build and focused merged-main isolated tests; preserve every worktree and selected old dist/CLI. The result is a standalone verifier only, not a Task6A admission or live rollout.

## Self-review boundary

This plan covers only the standalone base catalog verifier. The broader spec's role-neutral current-head contract-spine parity, `pgMigrate({baseSchemaMode:"verify"})` opt-in wiring, isolated OS identity fence, and live transition are separate plans and cannot be inferred from completion of this one.
