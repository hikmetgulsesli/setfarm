# Artifact Publication Batch Lease Authority

## Status and scope

This design is the approved dependency-order continuation of
`SETFARM_SYSTEM_AUDIT.md` section D.13.16. It closes one boundary only: a
multi-artifact publication batch must have one durable recovery owner and one
fence. It does not claim filesystem batch atomicity, activate the publisher in
production, or make the wider Product Semantics v2 release GO.

## Considered approaches

1. Keep child reservations independent and copy one token into each child.
   This reduces accidental divergence but leaves no durable aggregate state or
   terminal owner. A generic child recovery can still split the set.
2. Add a separate one-to-one batch lease table. This keeps the identity header
   physically immutable, but adds another required row, more deferred
   cross-table checks, and a second lifecycle object with no independent use.
3. Keep immutable identity and mutable lifecycle columns on the batch header.
   This makes the header the aggregate root and gives every operation one lock
   and transition authority. This is the selected approach.

## Aggregate schema

`artifact_publication_batches` owns two disjoint field groups.

Immutable identity:

- `batch_reservation_id`
- `identity_schema`
- `batch_identity_hash`
- `artifact_count`
- `created_by_instance_id`
- `created_at`

Mutable lifecycle:

- `state`: `active | completed | released | quarantined`
- `owner_instance_id`
- `lease_token`
- `lease_expires_at`
- `diagnostic`
- `finalized_at`
- `updated_at`

An active row has a non-null owner, token, and expiry and no finalization time.
A terminal row has no owner, token, or expiry and has a finalization time.
Quarantine additionally requires a non-empty diagnostic. Identity fields can
never change. A terminal batch can never become active again.

An active lease is always bounded to at most 30 minutes from its authoritative
`updated_at`; this applies to initial insertion as well as later transitions.
An active-to-active transition observes PostgreSQL `clock_timestamp()` once and
is legal only as one of:

- heartbeat: same owner and token, old lease is still live, `updated_at` and
  expiry both advance, and the replacement expiry is live but no more than 30
  minutes beyond the observed DB time;
- adoption: old lease is expired, owner and token both change, `updated_at` is
  not before the old expiry, and the replacement expiry is live but no more
  than 30 minutes beyond the observed DB time.

An active-to-terminal transition clears the lease fields. `completed` is legal
only when no reserved child remains and every member has an indexed artifact.
`released` and `quarantined` are legal only when no reserved child remains.

## Transaction and lock order

Every quota or batch lifecycle mutation uses this order:

1. `artifact_capacity` singleton;
2. batch header;
3. immutable batch item rows in canonical order;
4. batch child reservations ordered by reservation ID;
5. semantic artifact rows as needed.

Creation, heartbeat, adoption, publish, and finalization follow this order.
Generic single-reservation APIs reject the reserved `APRB_` namespace before
locking. `listExpired` excludes batch children; expired batches have their own
aggregate query.

Batch creation generates one `APB_` lease token and writes it to the header and
every unpublished child. Before returning, deferred constraints are forced and
the header plus all still-reserved children receive a fresh database-authority
expiry. This prevents a valid transaction from returning an already-expired
lease merely because insertion or deferred validation took time. The transition
trigger recognizes this exception only while the header tuple was created by
the current PostgreSQL transaction (`xmin = pg_current_xact_id()`); a committed
expired batch cannot use the creation-refresh path to revive its token.

Replay and mutation paths re-read PostgreSQL time after acquiring aggregate
locks. A request whose lease expired while blocked cannot publish, heartbeat,
or return stale ownership merely because it sampled time before the lock wait.

## API and recovery behavior

The artifact index exposes aggregate operations:

- `heartbeatPublicationBatch`: extends the header and every remaining reserved
  child in one transaction under the exact owner/token fence.
- `adoptExpiredPublicationBatch`: after expiry, rotates the header and all
  remaining reserved children to one new owner/token in one transaction.
- `publishPublicationBatchItem`: publishes one exact member only while both
  its child row and aggregate header share the supplied live fence.
- `finalizeOwnedPublicationBatch`: a live owner releases or quarantines every
  remaining reserved child and settles reserved bytes once.
- `finalizeExpiredPublicationBatch`: recovery releases or quarantines an
  expired aggregate without first creating a transient child owner, but only
  under the exact `expectedLeaseToken` and `expectedLeaseExpiresAt` returned by
  the recovery observation.
- `listExpiredPublicationBatches`: returns aggregate recovery work, never child
  work.

Publishing one batch child checks both its reservation and the header fence.
After the last reserved child is published, the same transaction marks the
header `completed`. An already-published child remains idempotently readable
after completion, but no stale owner can mutate an unpublished child after a
heartbeat loss or adoption.

Replay of the same batch identity behaves as follows:

- active and exact live owner/token set: return the remaining set;
- completed: return all members as already published;
- active but expired: require aggregate adoption;
- released or quarantined: typed terminal-batch failure;
- any identity, membership, lease-coherence, or source mismatch: fail closed.

## Database enforcement

Migration 23 owns exact checks and exact-verified trigger functions for:

- header identity immutability and lifecycle transitions;
- deferred membership, deterministic child IDs, full UTF-8 identity, and
  producer budgets;
- deferred header/child lease coherence after insert or update;
- `APRB_` child membership;
- terminal child monotonicity and the invariant that a reserved child cannot
  simultaneously exist in `semantic_artifacts`;
- exact capacity effects for reservation, publish, release, and quarantine, so
  raw header/child terminal transitions cannot omit accounting;
- last-child completion in the same transaction as the final publish.

The two v23 relations and all three shared publication authorities
(`artifact_capacity`, `artifact_publication_reservations`, and
`semantic_artifacts`) must be ordinary permanent, non-partitioned,
non-inherited tables with row-level security disabled. Exact verification
also owns their columns/defaults, complete validated constraint sets, and exact
index sets; it owns the semantic artifact immutability function and sole enabled
trigger, and the reservation trigger set appropriate to pre-v23 or v23 state.
The capacity singleton is independently checked for positive quota/payload,
nonnegative counters, quota bounds, state/reconciliation shape, and quarantine
diagnostic. Visibility, topology, trigger, constraint, or capacity poison is
rejected across plan, verify, apply, offline audit, and rollback, including
before an unjournaled v23 adoption performs DDL.

Normal startup verification remains bounded to exact schema/function/trigger
ownership. The explicit offline audit re-hashes historical identities and also
checks lifecycle coherence, capacity totals, published identity, and historical
child resurrection. Rollback to v22 remains allowed only when the batch header,
item, and deterministic child namespace are empty.

Migration 23's checksum is source-bound to its SQL/body regions, shared
ownership verifier, registration wiring, rollback implementation, batch
identity implementation, and canonical JSON dependency used to derive rollback
receipt identity. Dropping a journaled object, replacing a verifier callback,
or changing rollback identity semantics cannot retain the same attestation.

## Failure semantics

Aggregate misuse is typed and never translated into a generic retry:

- `ARTIFACT_BATCH_LEASE_LOST`
- `ARTIFACT_BATCH_NOT_EXPIRED`
- `ARTIFACT_BATCH_TERMINAL`
- `ARTIFACT_BATCH_OPERATION_REQUIRED`
- existing identity, capacity, and incomplete-batch errors

Generic `publish`, like the other generic reservation lifecycle APIs, rejects
the `APRB_` namespace. Callers cannot accidentally bypass aggregate fencing by
choosing a lower-level method.

No API silently repairs partial state. Any state impossible under owned APIs is
reported as invariant drift and requires offline audit or migration recovery.
An expired-finalization decision is generation-scoped: adoption or heartbeat
between observation and finalization yields `ARTIFACT_BATCH_LEASE_LOST`; the
recovery owner must re-list/reinspect before deciding the new generation.

## Verification matrix

Unit and schema tests must prove:

- terminal and malformed header shapes are rejected;
- initial, heartbeat, and adopted leases cannot exceed the 30-minute recovery
  bound or install an already-expired replacement fence;
- identity fields and terminal rows are immutable;
- quoted SQL literals and same-name no-op functions are detected;
- permanent/ordinary/topology/RLS authority is exact for all five relations;
- shared columns/defaults/constraints/indexes, semantic immutability authority,
  reservation trigger mode, and capacity value invariants are exact;
- source digest mutations cover registration wiring, shared ownership,
  rollback, identity, and canonical receipt hashing;
- startup plan, verify, audit, apply, and rollback agree on structural drift.

Integration and concurrency tests must prove:

- two-child creation has one header token and matching child fences;
- generic heartbeat/adopt/release/quarantine reject `APRB_` children;
- heartbeat updates all remaining children or none;
- two concurrent adopters produce exactly one winner and no split owner;
- publish racing adoption cannot commit under a stale fence;
- one published plus one expired child converges through aggregate adoption;
- owned and expired finalization settle every remaining child and quota once;
- stale expired-finalization observations cannot terminalize an adopted or
  heartbeated generation, while a fresh observation can converge it;
- last publish marks the header completed;
- replay of completed, released, and quarantined batches is deterministic;
- production expiry is derived from PostgreSQL after deferred creation work.
- a production creation blocked longer than its requested lease refreshes only
  inside its still-uncommitted creation transaction and returns a live fence;
- a production replay that waits past expiry loses its fence after the locks;
- raw SQL cannot publish/resurrect a child, complete/release a header, or alter
  capacity without satisfying the whole deferred aggregate invariant.

## Compatibility and rollout

Migration 23 is not released, so its schema and checksum are replaced in place
on the feature branch. There is no supported production data migration from the
earlier unmerged header shape. Existing v22 databases apply the final v23 once.
Any environment that applied an intermediate v23 must roll it back while empty
or be quarantined for an explicit forward migration; checksum bypass is not
allowed.

The production publisher remains on single-artifact publication until the
aggregate tests, migration attestation, source-bound digest, and adversarial
review are clean. Activation is a later slice and does not weaken this gate.
