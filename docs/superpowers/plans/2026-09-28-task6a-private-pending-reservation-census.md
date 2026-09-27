# Task6A private pending-reservation census

## Causal boundary

PRs #224/#229 added two separate immutable private precreate-reservation
tables. PRs #228/#230 link some of their rows to later receipts, but a link
does not authenticate a physical creator or settle the precreate gap. A
positive-owner cutover cannot infer zero pending roots from either table alone.
Add a private, import-inert, read-only diagnostic census of **both** tables.
It will not grant owner/admission authority or alter a live writer, migration,
service, role, credential or existing worktree.

## Contract

- Use one owned `REPEATABLE READ READ ONLY` PostgreSQL transaction and verify
  the transaction mode. Count both entire tables; refuse missing tables,
  inconsistent count/row projections or more than 256 combined rows rather
  than returning a partial sample. Bound SQL, lock and idle-in-transaction
  waits with fixed local timeouts; a held relation lock must refuse. No
  `WHERE linked = false` filter: every
  ordinary and recovery reservation remains pending, even with a receipt link.
- Select exact parent columns in deterministic hash order. Reconstruct each
  producer's full canonical body from columns, require exact bytes and SHA-256
  hash, and validate bounded IDs, source hashes and normalized absolute root.
  A direct SQL row whose sibling columns differ from the body is not evidence.
- Refuse an exact duplicate root across both tables. The same logical story
  may legitimately acquire a different root during later recovery; keep both
  rows pending but do not call that a physical-root collision. Prefix matches
  and symlink aliases also need separate physical proof. This snapshot check
  does not prevent a new writer from inserting a root after the transaction.
- Return only diagnostic counts and a deterministic identity-set hash, with
  explicit `empty`/`pending` diagnostic disposition and
  `physicalIdentityProvenance: unverified`.
  Never return raw roots or lease tokens, and never turn a zero count into an
  owner receipt. Caller still needs continuous writer exclusion and physical
  PostgreSQL-linked producer evidence.

## RED/GREEN and delivery

Private PostgreSQL 17 fixture: post-33 schema; both private tables; empty and
nonempty census; cross-table exact-root collision but tolerated same-story
different-root history; forged ordinary and recovery parent body-column
divergence; 256 valid canonical rows accepted and the 257th refused;
held-lock timeout; verified
read-only transaction mode; stable multirow hash across snapshots; linked
ordinary and recovery reservations still pending. Start with missing-module
RED, then implement and run
focused PG17, TypeScript, pure/cutover/manifest, migration digests, independent
read-only review and exact-head GitHub review. Build only on clean main after
reviewed PR merge. Preserve all existing development/deployment worktrees.

## File Map

- `src/internal-production/baseline-positive-worktree-private-pending-reservation-census-v1.ts`:
  import-inert, read-only both-table snapshot and fail-closed parser.
- `tests/execution-attempts/task6a-private-pending-reservation-census.integration.test.ts`:
  disposable PostgreSQL 17 adversarial fixture.
- `tests/execution-attempts/task6a-private-reservation-receipt-link.integration.test.ts`
  and `task6a-private-recovery-reservation-receipt-link.integration.test.ts`:
  existing linked-row fixtures prove that both linked parent types remain
  pending in the new census.
- This plan: scope, refusal semantics and delivery evidence.
