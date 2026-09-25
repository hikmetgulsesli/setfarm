# Pre-32 Fixed-Table SHARE-Lock Diagnostic Implementation Plan

> **For agentic workers:** Root is the sole writer. Execute tasks inline with TDD; read-only agents may independently review. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Prove a bounded pre-32 legacy PostgreSQL census locks a named table superset before reading and releases the locks before returning a diagnostic.

**Architecture:** Reuse the existing legacy census query on its own reserved connection but select a new transaction mode. Acquire fixed `SHARE` locks before the 26–31 journal-tail check, cold catalog and legacy owner reads. Expose only a diagnostic result with explicit fixed-table scope, incomplete journal identity, and lock-release status; no cutover admission or migration integration.

**Tech Stack:** TypeScript ESM, postgres.js, PostgreSQL 17, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-26-pre32-database-writer-exclusion-design.md`

## Global Constraints

- Preserve all visible dirty, historical, development, and deployment worktrees and the selected old dist/CLI link.
- Do not run locks or effects on live port 5432; use only the isolated PostgreSQL fixture.
- Do not change V31/V4/V5/V6 behavior, the V1 guard, migrations, or owner-admission rules.
- This API remains diagnostic-only and cannot be consumed as a ready/zero-owner lease. Auxiliary authority rows, full migration names/checksums, and external writers are not classified.

---

### Task 1: Held database census contract

**Files:** Modify `src/internal-production/baseline-legacy-database-census-v1.ts`; test `tests/internal-production/baseline-legacy-database-census-v1.test.ts`.

**Interfaces:** Add `observeLegacyDatabaseCensusWithPre32ShareLocksV1(databaseUrl: string | undefined)` returning a frozen diagnostic containing the legacy zero census and the literal fields `authority: "diagnostic-only"`, `tableLockScope: "fixed-pre32-legacy-superset"`, `journalIdentity: "tail-ordinal-state-only"`, and `lockState: "released-at-return"`.

- [x] Add a test where the new API is absent; run it and confirm RED for the missing export.
- [x] Add exact order/refusal tests: same authenticated URL, `READ COMMITTED READ ONLY`, timeouts, every fixed table `SHARE`-locked before journal/cold catalog/counts, no old-export drift, bounded close.
- [x] Implement the minimal separate mode and fixed table lock sequence; keep the existing observation continuation and sanitize this API's failure.
- [x] Run focused tests and `npx tsc --noEmit` until GREEN.

### Task 2: Real isolated PostgreSQL characterization

**Files:** Record evidence in `/Users/setrox/ai/setrox/logs/2026-09-25-cutover-status.md`.

**Interfaces:** Exercise PostgreSQL 17 `READ COMMITTED READ ONLY` plus `SHARE` using two independent connections on the temporary 127.0.0.1:55432 cluster. The source-level fake-driver test above covers emitted SQL/order; this database experiment characterizes the lock primitive, not the source API.

- [x] Hold `SHARE` in a read-only transaction; issue `INSERT` from another connection and observe it blocked while held and committed after release.
- [x] Stop the temporary PostgreSQL server; no listener remains on 55432. Do not alter live 5432.
- [x] Re-run focused seven-test suite, internal-production cutover 393/393, pure 151/151, TypeScript, English/path/migration-digest contracts and diff check after review fixes.

### Task 3: Independent review and delivery

**Files:** Update this plan and the host status ledger with exact evidence.

- [x] Ask a read-only independent reviewer to examine the diff; its omissions and overclaim findings drove the expanded fixed list and explicit diagnostic-only scope.
- [x] Obtain a final read-only review confirming no remaining Critical/Important finding.
- [ ] Commit conventionally, push scoped branch, request exact-head PR checks/reviews, merge only after reviewing them.
- [ ] Fast-forward a clean independent `main` deployment clone; run a normal guarded build without deleting retained generations.
- [ ] Perform only safe read-only host verification; do not invoke this lock-taking API on live port 5432 or switch services.
