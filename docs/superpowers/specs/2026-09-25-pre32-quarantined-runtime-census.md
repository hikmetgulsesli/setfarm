# Pre32 quarantined-runtime census V5

Status: diagnostic-only continuation of the approved positive physical-plus-PostgreSQL ownership contract. V4 and every V1 admission/cutover guard remain unchanged.

## Evidence and decision

The authenticated V4 host pair on clean main `5dd63fbe` observed 57 visible physical candidates and zero active run, claim, attempt, and runtime rows in one held interval. The physical catalog retained 269 blockers: 263 prunable Git records (all direct children of held absent bases), four non-Git children, one absent workflow-agents discovery parent, and one linked Git-admin churn. A separate read-only host query saw zero quarantined runtime sessions, but it was not part of the V4 transaction or held physical interval.

The legacy active-runtime predicate excludes `quarantined`; activation preflight does too. A quarantined session is still unresolved and recoverable, and OpenClaw/external runtimes need not have a local PID. Therefore a zero legacy runtime count must not be interpreted as proof that all runtime sessions were released.

Add a new V5 diagnostic database snapshot, leaving the V4 schema and observer untouched. Inside the same cutover-local repeatable-read/read-only transaction used by V4, collect the same legacy census and complete active rows, then count `runtime_sessions.state = 'quarantined'` through one fixed SQL statement. Require exactly one canonical nonnegative decimal count within JavaScript safe-integer range; malformed, extra, missing, or failed DB evidence refuses. Bind the count into an immutable V5 body/hash. A positive count is reported as diagnostic evidence, not silently normalized to zero. Even count zero is not owner, artifact, or cutover authority.

This slice does not join historical runtime paths, change owner classification, query external process state, grant controller ownership, publish intent, or alter services. A later held V5 physical/database adapter must consume this snapshot with the other missing evidence before any versioned zero-owner guard can exist.

## File map

- `src/internal-production/baseline-legacy-database-census-v1.ts`: new zero-ambient-URL V5 read-only observer and exact count validation; preserve V4 export and SQL.
- `tests/internal-production/baseline-legacy-database-census-v1.test.ts`: import inertness, same-transaction order, canonical count, nonzero visibility, malformed/refusal, and bounded close fixtures.
- `docs/superpowers/plans/2026-09-25-pre32-quarantined-runtime-census.md`: TDD and delivery evidence.
