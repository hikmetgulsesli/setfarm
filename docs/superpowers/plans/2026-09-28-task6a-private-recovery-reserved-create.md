# Task6A private recovery-reserved create-only bridge

## Causal boundary

PR #229 commits a private recovery precreate reservation binding one live
lease to a root and source revision. PR #227 has a disposable-Git create-only
fixture, but accepts those values from its caller. A caller-selected tuple is
not a database-to-physical trace. Add an import-inert, private bridge that
derives the exact create tuple from a validated committed recovery row. This
is still diagnostic only: direct SQL rows are not producer authentication,
and holding a database transaction is not continuous exclusion of old OS
writers or superusers.

## Contract

- Input is only an existing private `postgres.Sql`, exact reservation hash,
  and disposable fixture `repo`. Reject extra keys/proxies/accessors. No
  caller root, source SHA/tree, raw lease token, or worktree path override.
- Own one `SERIALIZABLE` transaction with fixed local SQL/lock/idle timeouts.
  Verify mode, lock the canonical V3 run/termination authority and current
  delivery/case/revision/dispatch/story chain in the existing order. Read
  exactly one immutable recovery reservation and reconstruct its canonical
  body from every column, checking exact bytes and SHA-256 hash. Check the
  live leased owner/token commitment, unexpired database time, zero attempts,
  null execution-slice/start residues, no active implementation claim/attempt,
  no unreleased runtime session for the logical implement story,
  exact current case/revision/dispatch/finding directive and authorization
  time, repairing case, exactly one routable implement loop step and failed
  story, unchanged source, and absence of
  an exact root in the ordinary reservation table.
- While the transaction is held, call the existing create-only fixture once
  with root/source/hash derived only from the row. It already confines the
  operation to `/tmp/setfarm-task6a-create-only.*`, pinned one-file Git source,
  no replacement/prune/cleanup, and post-add physical verification. Verify
  its returned tuple exactly. Re-read exact delivery/lease state and database
  time after the Git add while the locks remain held; refuse if expiry or
  identity changed. A SQL rollback cannot undo Git: any error, commit loss
  or post-add refusal
  returns a fixed private refusal and leaves any created root and pending
  reservation visible as a one-shot unresolved blocker. Never retry/create-adopt, remove a worktree, publish a
  receipt, settle a reservation, or grant owner/admission authority.
- No live migration, selected CLI, service, runtime writer, role, credential
  or existing development/deployment worktree change.

## RED/GREEN and delivery

Use an isolated PostgreSQL 17 post-33 database and a fresh disposable Git
fixture. First prove missing-module RED. Cover wrong/missing reservation hash,
forged canonical-body/column divergence, wrong repo/target source, competing
ordinary root, rotated or expired lease, published claim or delivery
attempt residue after the
reservation, occupied/symlink target, successful
DB-derived detached pinned create, and second-call refusal with the root
untouched. Existing create-only tests cover a post-add failure leaving its
partial root visible; the bridge must not add cleanup or retry around it.
Exercise post-add lease/commit loss if a deterministic private fault seam can
do so without making live/public code caller-controllable. Otherwise do not
claim the bridge has proven atomicity or orphan recovery.

Independent design review identified two causally required pre-add checks:
null `execution_slice_hash`/`started_at` and exact current directive-chain
parity. Both classes produced RED private PostgreSQL tests against the first
bridge draft; the implementation and File Map remain scoped to this source
and integration test, not to the live attempt publisher.
Follow-up read-only review found two more pre-add parity gaps: the case's
opening revision identity and the parsed finding-set payload. Disposable
PostgreSQL/Git RED tests showed both could create a physical root from a
chain that the production V3 claim authority would reject. The bridge now
checks opening revision 1 against the case and validates the finding payload
against the current revision before invoking Git.
The same follow-up exposed mutable case-status and routability gaps. RED tests
for evidencing status, non-loop/completed step, duplicate eligible step, and
duplicate failed story showed physical creation where downstream production
would refuse. Pre-add checks now require `repairing` and exact singleton
eligible step/story rows; no live router or publisher code changes are made.
Final review identified a separate publication fence: an old closed claim may
retain an unreleased runtime session. A RED test with a drained historical
session proved Git creation remained possible; the private bridge now refuses
that exact runtime predicate before add.
Run focused private PG/Git tests, TypeScript, pure/cutover/manifest and
migration digests, independent read-only review, exact-head GitHub review,
then clean-main build and merged-main focused tests. Host verification stays
read-only unless later separately authorized code-owned rollout conditions
are met.

## File Map

- `src/internal-production/baseline-positive-worktree-private-recovery-reserved-create-v1.ts`:
  exact reservation-to-create derivation, held private transaction and
  diagnostic-only response.
- `tests/execution-attempts/task6a-private-recovery-reserved-create.integration.test.ts`:
  isolated PostgreSQL 17 and disposable Git adversarial fixture.
- Existing `baseline-positive-worktree-create-only-fixture-v1.ts` and its
  tests should remain unchanged; the bridge consumes that reviewed fixture.
- This plan records scope, failure semantics, and delivery evidence.
