# Task6A Migration Test Pin Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Root remains the sole writer; review agents are read-only.

**Goal:** Restore the exact isolated migration-test baseline needed to verify the Task6A least-privilege rehearsal without modifying migration semantics.

**Architecture:** The historical migration-32 source and generated semantic digests remain byte-identical. Two reviewed read-only inspection functions were later added outside semantic migration regions in `contract-spine-migrations.ts`, making one raw whole-file test hash stale. Update only that expectation after independent diff review.

**Tech Stack:** TypeScript, Node 26, PostgreSQL 17 isolated cluster, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-27-task6a-base-schema-readonly-verify-design.md`; this prerequisite repairs its real integration-test surface and does not implement the verifier.

## Global Constraints

- Do not modify historical migration-32/33 SQL, source digests, generated digest file, live PostgreSQL, selected CLI or LaunchAgents.
- Preserve all existing worktrees and use a dedicated isolated PostgreSQL cluster authenticated as a distinct data directory/port.
- Root alone edits, commits, pushes and delivers. No direct-main commit, force-push, secret logging or guard bypass.

---

### Task 1: Repair reviewed raw source pin

**Files:**
- Modify: `tests/execution-attempts/migrations.test.ts:120`
- Test: `tests/execution-attempts/migrations.test.ts`

**Interfaces:**
- Consumes: the existing `sha256(guardedSource)` assertion and the independent reviewed git diff `e09894d1..0275a3a1`.
- Produces: the same exact-byte test with current reviewed whole-file SHA; no production-code interface.

- [x] **Step 1: Verify RED and source scope.**

Run the existing isolated migration test against the dedicated cluster and observe 53/54 with only `P4 guarded stage uses held savepoint without changing v32 digest` failing: actual `79116ca2831d17e6b4d19359abc34df1088576811246d75dfc853612a044da42`, expected `00ebd7073d7fce8f68acbf7054db179403e9ccb44df4b8c15df145dcf81f52a5`. Run `git diff --unified=2 e09894d1 0275a3a1 -- src/db/contract-spine-migrations.ts`; require only the two read-only functions outside semantic regions. Run `node --import tsx scripts/check-contract-spine-migration-digests.ts --check`; require success.

- [x] **Step 2: Minimal GREEN edit.**

In the three-element expected hash array in `tests/execution-attempts/migrations.test.ts`, replace only the middle literal:

```ts
"79116ca2831d17e6b4d19359abc34df1088576811246d75dfc853612a044da42",
```

Keep the migration-32 source and generated-digest literals unchanged.

- [x] **Step 3: Verify GREEN and scope.**

The isolated test runner requires a clean tracked source projection, so commit
the reviewed one-literal edit and documentation before its GREEN run. Run the
full isolated `tests/execution-attempts/migrations.test.ts` on Node 26 against
the same isolated-cluster identity; require 54/54. Then run
`npm run check:migration-digests`, `npx tsc --noEmit -p tsconfig.json`,
`git diff --check`, and review the committed test diff for only one literal
change. Do not treat a pure hash check as proof of Task6A writer exclusion.

- [ ] **Step 4: Review and delivery.**

Obtain read-only independent review, push a PR branch, wait for exact-head
review/checks, SHA-condition merge, and run a normal guarded clean-main build
in the preserved deployment worktree. Preserve historical selected dist/CLI
bytes; no live cutover action follows from this test repair.
