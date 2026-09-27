# Task6A private reservation–receipt link

## Goal and causal boundary

The private pre-create reservation (#226) and post-33 receipt journal (#225)
are independent immutable records. Matching strings in application memory do
not prove that one actual story dispatch produced the later receipt. Add a
private, post-33, insert-once PostgreSQL bridge that correlates exactly one of
each under a fresh V3 story/claim/attempt/session binding check. This closes
only a database correlation gap: the reservation's `dispatch_key` still lacks
a durable producer/claim binding. It is not a physical creation or
producer-authenticity proof, and grants no owner or admission authority.

The ordinary writer still uses destructive `createStoryWorktree` paths. No live
schema registration, migration 34, selected CLI, service, role/grant,
credential, physical writer, census, or activation path changes in this slice.
Every pending reservation, including a linked one, must remain a zero-owner
cutover blocker in a future census. This slice does not implement that census,
authenticated physical creation, continuous DB/OS writer exclusion or terminal
reconciliation.

## Contract

- Input contains only exact `reservationHash` and `receiptHash` strings. The
  adapter derives canonical link bytes from the two committed database rows;
  caller-supplied run, root, source or owner identity is never trusted.
- An owned `SERIALIZABLE` transaction locks both immutable parents and the
  exact V3 run/story, migration-33 story/claim/runtime binding, claim, attempt
  and session. It refuses crossed run, owner, root, source SHA/tree, story DB
  row/logical ID, step, claim, attempt, generation, session, terminal state, or
  fence commitment. A story may have advanced from
  pending to running after the reservation; completed/failed rows refuse.
- A new private table has one-to-one unique parent hashes, canonical-body
  SHA-256, composite foreign keys for shared parent fields, and no-replace
  UPDATE/DELETE/TRUNCATE triggers. Other link columns are validated by the
  adapter, not independently authenticated by the table; direct SQL inserts
  must never be consumed as authority. `INSERT ... ON CONFLICT DO NOTHING`
  adopts only one byte-identical link; conflicts, ambiguity and rollback refuse.
- The return value is explicitly `diagnostic-only`. It never says that the
  physical root exists, that the receipt producer or dispatch is authenticated,
  or that the reservation is resolved.

## RED/GREEN and verification

First write a private PostgreSQL 17 integration test and observe the missing
bridge fail. Test positive insert/identical retry, a real crossed reservation,
missing V3 story binding, closed or drifted active rows, rollback after insert,
no-replace DML and continuing reservation row presence. The one-to-one unique
constraints remain a database requirement even when the fixture cannot seed a
second simultaneously active V3 receipt for the same story claim. Use only a
disposable private-cluster database.

Then implement the smallest import-inert bridge, run the focused test,
TypeScript, pure/cutover/manifest and migration digests. Require independent
read-only review, exact-head GitHub review and GitGuardian. Branch build must
remain fail-closed; build and rerun relevant tests only after merge on clean
main. Keep all existing development and deployment worktrees visible.

## File Map

- `src/internal-production/baseline-positive-worktree-reservation-receipt-link-contract-v1.ts`:
  import-inert private SQL schema and exact two-hash append.
- `tests/execution-attempts/task6a-private-reservation-receipt-link.integration.test.ts`:
  opt-in private PG17 adversarial contract proof.
- This plan: causal boundary, tests and delivery evidence.
