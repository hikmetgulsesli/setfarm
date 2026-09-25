# Pre-32 fixed-table SHARE-lock diagnostic design

The preserved deployment cutover needs a stable database owner census before migration 32 exists. The existing V31 repeatable-read census takes only `ACCESS SHARE` locks, so an ordinary writer may create an owner after its snapshot. Migration 32's owner-admission fence cannot be applied before this cold check. This slice proves fixed-table locking mechanics for the delivered legacy count predicates; it does not claim a complete owner census. It is a causally required refinement of the approved positive physical/DB ownership contract, not a relaxation of any cutover gate.

## Choice and alternatives

Add a separate versioned, cutover-local, diagnostic-only held census. It uses one authenticated local PostgreSQL connection and a `READ COMMITTED READ ONLY` transaction, sets bounded lock and statement timeouts, and takes `SHARE` locks on a fixed superset of pre-32 legacy, auxiliary-authority, and migration-journal tables in lexical order before the first owner query. It verifies only the applied ordinal/state tail for migrations 26–31, then runs the existing legacy census in that same transaction. Prior committed writers on the fixed tables are visible after lock acquisition; new DML on those tables waits until transaction end. The result does not survive as a lease or authorize cutover.

Changing the old V31 observer would alter delivered observation semantics. Advisory locks alone do not stop ordinary SQL writers. A `REPEATABLE READ` snapshot taken before the table locks could miss a writer that committed while lock acquisition waited. Those approaches are rejected.

## Boundaries

- The fixed table list is a conservative pre-32 superset covering run/claim, execution/session, completion, recovery/finding, operational delivery, artifact capacity/publication, preparation, and migration journal tables. Missing listed tables, the wrong 26–31 ordinal/state tail, migration 32+, lock timeout, insufficient privilege, connection failure, or a non-local/ambiguous URL refuse. This does **not** verify full journal names/checksums, versions 1–25, auxiliary authority row classifications, or every external SQL/DDL route.
- No ambient URL, secret output, migration, write, service effect, worktree cleanup, guard change, or authority receipt is permitted. The returned record explicitly says `diagnostic-only`, `fixed-pre32-legacy-superset`, `tail-ordinal-state-only`, and `released-at-return`.
- This does not exclude the old selected CLI, launchd jobs, process families, filesystem writers, or external DDL/new owner routes. A later controller must journal service/process exclusion and hold an admission barrier through its own atomic transition. Four present non-Git roots and the other physical blockers remain unresolved.
- Source tests prove the exact fixed lock order before journal/census reads and sanitized refusal on a lock failure or future journal tail. A separate isolated PostgreSQL 17 two-connection experiment verifies that `READ ONLY` permits `SHARE` and a competing insert waits until release. The experiment does not call this source API; a full v31 fixture and producer-coverage proof remain required before authority integration. Never use live port 5432 for lock tests.

## File map

- `src/internal-production/baseline-legacy-database-census-v1.ts`: shared legacy queries plus the separately selected held-lock mode; old exports retain their exact behavior.
- `tests/internal-production/baseline-legacy-database-census-v1.test.ts`: RED/GREEN query-order, target, close, and refusal tests.
- Isolated PostgreSQL 17 experiment in the status ledger: database lock behavior characterization; it is not a source integration test.
- This design and its paired plan: scope, evidence, and unresolved boundary.
