# Task6A private recovery physical-create receipt

## Causal boundary

PR #233 creates a disposable pinned Git worktree from one validated recovery
reservation, but only returns a reservation hash. No durable row records the
physical directory identity observed after Git add. The existing postclaim
receipt journal requires claim/attempt/session rows and cannot describe this
preclaim event. Add one private, append-only diagnostic create receipt in the
same bridge-owned transaction; this is correlation, not producer proof or an
execution owner.

## Contract

- Keep the bridge input exactly `(postgres.Sql, {reservationHash, repo})` and
  the disposable `/tmp/setfarm-task6a-create-only.*` confinement. Do not add
  caller-supplied physical identity, root or source overrides.
- A private table, installed only by explicit fixture statements after the
  existing post-33 tables, stores one canonical receipt keyed by hash and
  unique reservation/root. Its body binds the immutable reservation hash,
  run/story/dispatch/case/revision, owner and lease-token commitment, root,
  source SHA/tree, Git primary root, and physical identity `{root,dev,ino,
  birthtimeNs,gitPrimaryRoot}` under the existing identity.v2 hash schema.
  Protect body hash in SQL and reject UPDATE/DELETE/TRUNCATE.
- The create-only fixture returns the exact bigint device/inode/birthtime
  tuple that it checked after Git add. The bridge compares that tuple with an
  immediate post-return sample before its next awaited SQL operation, then
  compares samples after the lease/time recheck and receipt insert. Require
  unchanged positive device/inode/birthtime and exact real path. Insert the
  receipt in the same `SERIALIZABLE` transaction and
  return only after commit. Never adopt a pre-existing root or retry after a
  post-add/commit failure. SQL rollback does not undo Git; root and reservation
  remain visible, receipt absent, owner still absent.
- Keep direct SQL provenance explicitly untrusted. No live migration, runtime
  writer, selected CLI, role, credential, service, owner/admission, reservation
  settlement or user development/deployment worktree change.

## RED/GREEN and delivery

Use isolated PostgreSQL 17 and disposable Git only. First prove missing-table
refusal and receipt-absence RED. Positive test verifies exact canonical
body/hash, unique root/reservation, physical identity hash and pending census
unchanged. A test-only trigger fails receipt INSERT after Git add: assert SQL
rollback, no receipt, Git registration/root retained, pending census 1, and
  repeat refusal without inode change. A test-only SQL proxy swaps only the
  disposable root after Git add and proves that a replacement cannot receive
  the created inode's receipt. Cover occupied/replaced root and crossed
body/column if feasible without removing any non-fixture path. Existing #233
24 tests must still pass. Run TypeScript, private focused tests, pure/cutover/
manifest and migration digests, independent read-only review, exact-head PR
review, then clean-main build and merged-main focused tests.

## File Map

- New `src/internal-production/baseline-positive-worktree-private-recovery-create-receipt-v1.ts`:
  private table statements and canonical receipt projection/validation.
- `src/internal-production/baseline-positive-worktree-private-recovery-reserved-create-v1.ts`:
  compare the fixture-captured physical identity against subsequent samples,
  append the private receipt and preserve one-shot failure.
- `src/internal-production/baseline-positive-worktree-create-only-fixture-v1.ts`:
  return its final checked bigint physical identity to the private bridge.
- `tests/internal-production/baseline-positive-worktree-create-only-fixture-v1.test.ts`:
  prove the returned physical identity equals the created disposable root.
- `tests/execution-attempts/task6a-private-recovery-reserved-create.integration.test.ts`:
  fixture table, positive and failure-path PostgreSQL/Git tests.
