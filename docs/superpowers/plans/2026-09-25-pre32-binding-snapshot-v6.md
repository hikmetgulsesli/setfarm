# Pre-32 binding snapshot V6

Status: implemented diagnostic root fix; PR delivery pending. No live cutover authority.

## Causal scope

The preserved cutover's positive physical/PostgreSQL ownership contract needs
real attempt generation, fence commitment and source revision in the same
read-only transaction as the legacy pre-32 census. PR #163 supplied strict
binding-row parsing but did not connect it to the real postgres.js Result or
legacy snapshot. This slice adds a separately versioned V6 snapshot; V4/V5
remain byte-for-byte compatible. Because pre-32 requires zero active attempts
and sessions, a passing V6 can only have empty binding rows. It cannot qualify
physical worktrees as nonowners, grant admission or authorize cutover.

## File map and test sequence

1. Extend `tests/internal-production/baseline-legacy-database-census-v1.test.ts`
   with V6 import-inert, one-transaction Result metadata normalization, empty
   binding counts/hash, malformed/mismatched refusal and bounded close cases.
   Run RED against the missing V6 export.
2. Add V6 to `src/internal-production/baseline-legacy-database-census-v1.ts`
   through the existing strict cutover-local repeatable-read/read-only path.
   Normalize each driver Result at the DB boundary, compare legacy, V2 and
   binding counts and exact overlapping row identities, keep hashes diagnostic.
   Do not change migration history, V1 guards or runtime admission.
3. Run focused GREEN, pure tests, TypeScript/contracts and diff check. Seek
   independent read-only review. Deliver via scoped PR, then clean-main build
   and authenticated read-only host check without touching the selected old dist.

The held physical V6 pair, hash-aware trusted binder, tri-state classifier,
writer exclusion and versioned cutover receipt remain dependent tasks. No
physical candidate becomes a proven nonowner merely because DB rows are empty.

## Verification evidence

RED: focused census test failed because the V6 export was absent. GREEN:
focused census 5/5, cutover suite 389/389, pure suite 130/130, TypeScript
no-emit, English/path contracts and `git diff --check` passed. Independent
read-only review found no blocker. The pre-32 zero-active condition means the
positive identity comparison is intentionally unreachable in this route;
later non-pre32 binding tests must exercise positive matches and mismatches.
