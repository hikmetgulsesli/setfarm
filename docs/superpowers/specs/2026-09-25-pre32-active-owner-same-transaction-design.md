# Pre-32 active-owner evidence in one PostgreSQL transaction

Status: bounded prerequisite of the owner-approved positive physical-plus-PostgreSQL cutover design. It does not qualify physical worktrees or authorize cutover.

## Problem

`observeLegacyDatabaseCensusV1` proves the thirteen pre-32 database/effect owner categories empty in one repeatable-read/read-only transaction. `observeCodeOwnedPositiveWorktreeActiveRowSnapshotV2` separately reads the four active row sets in another transaction. Calling the two existing zero-input functions during one held physical callback would still mix two PostgreSQL snapshots. Path text in either result is not physical identity.

## Decision

Keep `observeLegacyDatabaseCensusV1(databaseUrl,coldBootstrap,profile)` behavior, target checks, transaction mode, catalog verification, thirteen counts, finding-inventory validation, close behavior, and return shape unchanged. Extract its transaction body into a private continuation helper. Add `observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4(databaseUrl)` as a fixed cutover-local, cold-pre32 diagnostic entry point. It executes the existing legacy census first, then the existing V2 in-transaction active-row observer on the very same PostgreSQL transaction object. Convert only postgres.js `Result` container metadata at the query boundary using the existing V2 normalizer; do not soften row parsing.

Return a frozen, hash-bound exact object with schema `setfarm.internal-production-pre32-active-owner-snapshot.v4`, `authority:"diagnostic-only"`, the unchanged legacy census, unchanged V2 active-row snapshot, and `snapshotHash` over those fields. Compare the four overlapping legacy and V2 counts exactly. A nonzero legacy count, missing/ambiguous local target, malformed V2 rows, count drift, transaction/connection/close error, or a second transaction refuses. A successful empty pair proves only this database sample, not continuous absence, physical owner exclusion, source/build provenance, controller fencing, or cutover.

The new function accepts no callback, transaction, SQL, row, count, path, or caller zero assertion. Its only argument is the same explicitly supplied local database URL already authenticated at the cutover-local boundary. The future V4 held host qualifier must derive that URL from code-owned launcher authority and call this function exactly once within the physical observer callback. No service, schema, migration, Git worktree, existing V1/V2 evidence, or guard changes here.

## File map

- `src/internal-production/baseline-legacy-database-census-v1.ts`: private transaction-body extraction and fixed combined V4 observer; preserve the existing V1 public API.
- `tests/internal-production/baseline-legacy-database-census-v1.test.ts`: real boundary/fake-driver tests proving one repeatable-read/read-only transaction, exact query order, same transaction, count parity, refusal and close behavior.
- `docs/superpowers/plans/2026-09-25-pre32-active-owner-same-transaction.md`: TDD and delivery plan.

The existing focused test registration already includes this file; no package change is required.
