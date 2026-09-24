# Pre-32 Active-Owner Same-Transaction Implementation Plan

> **For agentic workers:** Root is the sole writer; independent agents are read-only reviewers. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the existing thirteen-category pre32 census and four V2 active row sets from one authenticated read-only PostgreSQL snapshot without changing the legacy API.

**Architecture:** Reuse the legacy census's one cutover-local connection and repeatable-read/read-only transaction through a private continuation. Run the existing strict V2 in-transaction row reader after legacy zero verification; bind both unchanged results in one diagnostic hash. Do not change physical, cutover, service, or migration behavior.

**Tech Stack:** TypeScript ESM, postgres.js, Node test runner, canonical JSON hash.

**Spec:** `docs/superpowers/specs/2026-09-25-pre32-active-owner-same-transaction-design.md`

## Global Constraints

- Preserve `observeLegacyDatabaseCensusV1` signature, result, target/PG-environment checks, strict SQL/counters and bounded close.
- Preserve V2 active-row SQL, parser, schema and hash; strip only known postgres.js Result metadata at its existing DB boundary.
- No live write, migration, new owner/sidecar, physical-owner classification, V1 guard, runtime bypass, or service change.
- Root alone edits/commits/delivers. Preserve all retained worktrees and selected historical dist/CLI.

## Task 1: One transaction, two existing evidence sets

**Files:** Modify `src/internal-production/baseline-legacy-database-census-v1.ts`; extend `tests/internal-production/baseline-legacy-database-census-v1.test.ts`.

**Interfaces:** Add `observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4(databaseUrl:string|undefined)` returning frozen `{schema,authority,legacyCensus,activeRows,snapshotHash}`. Existing `observeLegacyDatabaseCensusV1` stays source-compatible.

- [x] RED: add a fake postgres-driver boundary that records one `begin("isolation level repeatable read read only")`, answers the existing catalog/count/finding queries and V2 row queries on the same transaction object, and asserts an exact diagnostic result/counts/hash and one bounded `end({timeout:1})`. The missing export must fail before implementation.
- [x] GREEN: move only the current legacy transaction body to a private generic continuation function; make the existing export return its old census unchanged. Add fixed V4 wrapper whose continuation calls `observePositiveWorktreeActiveRowSnapshotInTransactionV2` through `normalizeActiveOwnerRowPgResultV2` and hashes the exact combined body.
- [x] RED/GREEN refusal cases: nonzero legacy category, active-row count mismatch, malformed/extra active row, ambiguous target/ambient PG option, transaction failure, callback failure, and close failure must never return an empty/zero pair. Test that the old export still returns its prior shape.
- [x] Verify focused legacy/V2 tests, `npx tsc --noEmit`, `npm run test:internal-production:pure`, `npm run test:internal-production:cutover`, `npm run check:paths`, `git diff --check`.
- [ ] Obtain independent read-only code/spec review; fix Important/Critical findings and rerun affected checks. Commit conventionally, push scoped PR, inspect exact-head cloud review and checks, SHA-bound merge, fast-forward independent clean-main clone and run normal build. Host read-only count/health checks cannot claim cutover.
