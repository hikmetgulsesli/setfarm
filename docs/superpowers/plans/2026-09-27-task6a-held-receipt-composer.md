# Task6A held diagnostic receipt composition

Root is the only writer. PR #221 provides a one-use physical/source capability
for a real runtime linked worktree; PR #219/220 provide a diagnostic-only,
read-only PostgreSQL receipt adapter and private exact-SQL proof. They are not
yet connected. Compose them without publishing a receipt or admitting an owner.

## Decision

The adapter must receive the actual physical callback's frozen identity,
recheck and source observer. Its held port may forward those values once but
must not synthesize a new hold from a path string. Keep its candidate local
until the entire physical catalog returns `complete` after the second pass and
descriptor cleanup. Collapse all failures to one private-data-free code.
The explicit scoped URL remains caller-supplied; neither its origin nor a
continuous writer fence is authenticated in this slice. The read-only DB
transaction ends before the final source/physical check, so the candidate
remains unpublished, unverified and diagnostic-only.

## File Map

- `src/internal-production/baseline-positive-worktree-receipt-host-composer-v1.ts`:
  import-inert composition of the actual held physical/source callback and
  existing database adapter. Require exactly one matching runtime linked Git
  first-pass entry, one adapter result, a complete final catalog, and frozen
  diagnostic-only candidate. Never expose a URL, fence token or provisional
  result on failure.
- `tests/internal-production/baseline-positive-worktree-receipt-host-composer-v1.test.ts`:
  start RED. Use a real linked-Git fixture and a fake database adapter to prove
  exact callback wiring, no result before the second physical pass, refusal
  for retained/missing roots, a final unresolved catalog and nested Git drift,
  and fixed private-data-free failure. Prove import inertia before any driver
  load. The adapter's exact SQL and role behavior remain covered by PR #220's
  private PG17 test and the existing adapter tests; the fake tests only the
  composition seam.
- `package.json`: register the composer test in the standard pure suite.

Run focused RED/GREEN, pure suite, manifest, TypeScript and migration digests,
independent read-only review, exact-head PR review, clean-main build and host
checks. Do not change live roles, services, credentials, generated projects,
worktrees, owner admission or runtime guards.
