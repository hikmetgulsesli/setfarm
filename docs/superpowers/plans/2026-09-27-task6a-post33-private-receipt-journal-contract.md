# Task6A post-33 private receipt journal contract

This is a causal prerequisite for the approved positive physical/PostgreSQL
owner contract. The currently delivered held receipt is diagnostic and
unpublished. A future producer needs durable, insert-once bytes bound to the
same active claim, attempt generation/fence and runtime session before the
first relevant side effect. The present same-UID/superuser host has no
continuous writer exclusion. Do not call this fixture an owner or cutover.

## Boundary and File Map

- `src/internal-production/baseline-positive-worktree-receipt-journal-contract-v1.ts`:
  inert table/guard definitions and an exact locked-row append transaction.
- `tests/execution-attempts/task6a-post33-private-receipt-journal.integration.test.ts`:
  opt-in isolated PG17 proof after the fixture applies guarded 32 and ordinary
  33; no live database or service.
- This plan records the relation to Task6A and test evidence.

No registered migration 34, runtime import/call, admission change, public
CLI, live role/grant/credential, service, selected build, or existing
worktree mutation. The only table and temporary role exist inside an
explicitly identified disposable fixture database/cluster. The historical
development and deployment worktrees remain present and visible.

## Contract

Reuse `projectPositiveWorktreeBindingCandidateV1` to validate the complete
canonical receipt body/hash against exact row and physical tuples. Persist
the canonical receipt body/hash, run/claim/attempt/session IDs, generation,
root, physical/source identities and fence-token commitment, never raw fence.
Use attempt/session/claim foreign keys and uniqueness on attempt and session.
The module itself opens one `SERIALIZABLE` read-write transaction, locks and
compares the exact active claim, attempt and session rows, including raw-fence
CAS, then inserts with `ON CONFLICT DO NOTHING` and
accept only a byte-identical existing row. Never update or replace a receipt.
Guard UPDATE, DELETE and TRUNCATE with an immutable-row trigger. A trigger is
not a superuser/owner fence; the fixture must show ordinary nonowner writes
cannot modify the journal and preserve that caveat.

RED: a private test requiring this journal failed at `journal-statements`
because no table/append contract existed. Independent review then found that
checking an isolation setting on a caller-supplied SQL handle did not prove
one transaction; the module now owns `begin` and the test injects an AFTER
INSERT failure to prove rollback. GREEN: test exact insert, identical retry,
mismatched physical identity,
source/fence/generation/session/claim, collision, active-row drift, rollback
before commit, retry after commit, and ordinary DML denial; run TypeScript,
focused pure/cutover and source manifest, independent read-only review and
exact-head PR review. The physical observation remains unverified until a
code-owned producer brackets it; a journal row alone cannot prove current
owner or fence worktree creation. `markStarting` is too late for the first
spawner writes, so later integration requires a counted pending reservation
and pre-create exclusion under the continuous DB/OS writer fence.
