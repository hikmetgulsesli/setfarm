# Task6A private recovery reservation–receipt link

## Causal boundary

PR #229 commits an exact recovery delivery lease before physical creation;
PR #225 commits a claim/attempt/session receipt afterwards. PR #228 links
only the older ordinary reservation table. Add a separate private post-33
link that requires an immutable V3 recovery claim publication to join the
recovery dispatch/lease to the later receipt. This closes a diagnostic DB
correlation gap only. It does not authenticate the physical creator, prove
that a root was created, settle either pending reservation table, fence old
writers or grant owner/admission authority.

No live migration, selected CLI, runtime writer, service, role/grant,
credential, owner census or activation changes. Existing development and
deployment worktrees remain visible. Future census must treat every ordinary
and recovery reservation row, linked or not, as unresolved until a separately
authenticated terminal outcome exists; cross-table root collisions still
block cutover.

## Exact diagnostic join

- Input is only the exact recovery reservation and receipt hashes. Derive all
  other identities from committed rows. Lock the canonical V3 story advisory
  key, active run/termination authority, exact delivery, recovery case,
  revision, dispatch, finding set, publication, story/claim/attempt/session/V3 binding and
  the receipt inside one owned SERIALIZABLE transaction. Read and recheck the
  immutable reservation parent without an early row lock, preserving the
  delivery-first canonical lock order. Reconstruct both parent canonical
  bodies from every projected column and require exact bytes/hash; a direct
  row whose sibling columns disagree with its body is not linkable. Refuse any absent,
  duplicate, crossed, terminal or drifted chain.
- Parse the stored publication handoff through the exact V3 schema, require
  byte-canonical JSON and its SHA-256 hash, and compare its full revision
  directive and dispatch/case/revision/run/story/owner/source/lease token
  with the reservation's committed token commitment. Never return, log or persist the raw token in the new
  link. A direct SQL publication is not producer-authenticated.
- Require delivery attempt/claim binding to the receipt, state
  `attempt_reserved` or `running`, attempt count exactly one, current lease
  token equal to the handoff and current expiry after fresh PostgreSQL time.
  Compare the live delivery and dispatch authorization timestamps inside
  PostgreSQL, and require a non-null delivery start equal to the bound
  attempt's lease acquisition and between session creation and delivery lease
  expiry; JavaScript millisecond dates cannot prove these native microsecond
  equalities. Re-sample PostgreSQL time after all active owner locks and
  again after insertion/conflict handling; refuse if either attempt or
  delivery lease expired during a wait.
  Both supported implementation recovery dispatches require current case
  status `repairing`; `open` and evidence-only `evidencing` refuse.
  Match the case's immutable opening-revision packet, finding set/IDs, slice
  and source identity before accepting its current revision. Lock the
  authoritative finding-set row after dispatch, validate its parsed payload,
  and match row/payload run, story, packet, slice, source and finding IDs to
  the current revision. Match live
  delivery/runtime states as a pair: reserved delivery with reserved,
  starting or running session, or running delivery with running session.
  A legitimate same-token renewal may change expiry, so never require the
  current expiry to equal the original handoff timestamp.
- Require active claim/attempt/session and exact V3 story binding, current
  running loop workflow step still owning the story, runtime heartbeat no
  earlier than its creation, live run packet hash, fence
  hash, source SHA/tree, root, generation and owner identity. Story claimant
  must match the claim agent, and immutable publication bound time must equal
  claim/story birth and precede runtime creation. The V3 binding bound time
  must also equal claim birth. Insert
  one immutable link with canonical-body hash and parent FKs; only byte-
  identical retry can adopt a conflict. Shared-field FKs and direct SQL rows
  are not complete producer-authenticity evidence.
- Match attempt role to the real V3 dispatch class: `developer` for product
  implementation and `supervisor` for supervisor repair. A synthetic
  `implementer` role is not a production recovery handoff.

## RED/GREEN and verification

Use a disposable private PostgreSQL 17 database. Seed a real recovery lease
and private reservation, then an exact synthetic claim/attempt/session/V3
publication and private receipt; the synthetic physical receipt remains
diagnostic, not a physical proof. The fixture commits its publication after
the receipt to test absent-publication refusal; this is not a production
lifecycle claim. Test missing publication, crossed input hashes, token
rotation, expired delivery and attempt, mutable current-case/status/step
drift, crossed case opening identity, malformed historical finding IDs,
forged reservation or receipt canonical-body/column divergence,
invalid delivery/runtime state pair,
pre-creation runtime heartbeat, non-loop claim step,
changed delivery authorization, absent, shifted or pre-session delivery start,
attempt lease expiration during a delayed link insert, with a nontransactional
private sequence proving the delay trigger ran before rollback,
base-schema run-packet immutability, story claimant/birth drift,
claim/session/slice/role drift
for both supported recovery dispatch classes,
rollback,
immutable DML, identical retry and continued pending-row presence. A separate
fixture is still needed for forged immutable publication bytes/hash and
crossed publication identity. The V3 binding insert trigger enforces its
bound-time equality and prevents mutable DML, so no in-place crossed-time
fixture is claimed; the link rechecks it for historical/direct-import rows.
Observe RED before implementation. Run
focused PG17, TypeScript, pure/cutover/manifest, migration digests and
independent read-only review. Branch build must fail at clean-main guard;
exact-head GitHub review and GitGuardian precede merge, followed by clean-
main build, focused rerun and evidence-based host check.

## File Map

- `src/internal-production/baseline-positive-worktree-recovery-reservation-receipt-link-contract-v1.ts`:
  import-inert private exact recovery DB join and immutable link schema.
- `tests/execution-attempts/task6a-private-recovery-reservation-receipt-link.integration.test.ts`:
  disposable PG17 adversarial correlation proof.
- This plan: bounded causal design, tests and delivery evidence.
