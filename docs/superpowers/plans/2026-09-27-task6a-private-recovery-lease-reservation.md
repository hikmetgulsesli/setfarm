# Task6A private recovery lease reservation

## Causal boundary

PR #228 links a pre-create reservation to a post-create receipt under a fresh
V3 claim/session check, but its generic reservation `dispatch_key` is not
durably tied to a recovery producer. A recovery worktree is currently created
after dispatch delivery leasing and before claim/runtime publication. Add a
separate private post-33 recovery-only reservation fixture that records the
exact current leased delivery and revision before any physical creation.

This is a diagnostic database-correlation proof, not producer authentication,
physical creation, writer exclusion, owner birth or admission. Keep the
ordinary V1 reservation and V1 receipt link unchanged; a later separately
reviewed bridge must distinguish and bind this recovery row to an authenticated
physical creator/receipt. No live schema registration, migration, role/grant,
credential, selected CLI, service or runtime writer changes in this slice.
Every pending row remains a zero-owner blocker, even after a later link.
The separate ordinary V1 table can contain a competing root; this fixture
does not establish cross-table exclusivity, so a later census must inspect
both rather than promoting either row.

## Contract and ordering

- Input is exact run/story DB and logical ID, dispatch ID, owner, raw lease
  token, absent root, and source SHA/tree. The raw token is never persisted,
  logged or returned; only a domain-separated canonical SHA-256 commitment is
  included in the immutable reservation body, so same-owner lease rotation
  cannot adopt an earlier reservation.
- Own one SERIALIZABLE transaction. Acquire the canonical V3 story advisory
  lock, run/termination authority, delivery row lock, current case lock,
  revision/dispatch key-share locks, and exact failed story row lock in that
  order. Use PostgreSQL wall-clock after locking. Require V3 active run,
  nonterminal current case/revision, model dispatch class, matching
  run/story/owner/source and exact unexpired `leased` token with no published
  claim or attempt, zero historical delivery attempt count, and no active
  implementation claim or attempt for that run/story. A stale or crossed row
  refuses without a reservation.
- The target must be exactly absent before the transaction and is sampled
  again before commit; this is not a continuous OS fence. A failed second
  sample rolls back the private row.
- The private table has canonical-body hash, unique dispatch/story/root,
  shared-field foreign keys where available, immutable UPDATE/DELETE/TRUNCATE
  triggers, rollback on failure and byte-identical retry only. Direct SQL
  insertion is not authenticated authority and must never be consumed as such.

## RED/GREEN and verification

Create an opt-in disposable PostgreSQL 17 integration test using real recovery
repository authorization and lease acquisition. Observe RED before the module
exists. Prove exact leased insertion and retry, arbitrary/crossed dispatch,
run/story/source/owner/token, expired/terminal/attempt-bound delivery,
rotation, rollback, no-replace DML and continued physical absence. Run the
focused test, TypeScript, pure/cutover/manifest and migration digests;
independent read-only review, exact-head GitHub review and GitGuardian precede
merge. Branch build must fail at clean-main guard; build on merged clean main.

## File Map

- `src/internal-production/baseline-positive-worktree-recovery-precreate-reservation-contract-v1.ts`:
  import-inert private recovery lease/dispatch reservation SQL and append.
- `tests/execution-attempts/task6a-private-recovery-precreate-reservation.integration.test.ts`:
  private PostgreSQL 17 adversarial transaction proof.
- This plan: causal scope and delivery evidence.
