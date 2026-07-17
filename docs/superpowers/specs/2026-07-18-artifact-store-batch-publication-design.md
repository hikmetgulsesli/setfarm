# Artifact Store Batch Publication Authority

## Status and scope

This is the approved physical-publication continuation of
`SETFARM_SYSTEM_AUDIT.md` section D.13.16 and the aggregate database authority
introduced by migration 23. The architecture was approved on 2026-07-18. This
written specification remains subject to the required written-spec review before
implementation starts.

This slice closes four coupled boundaries:

1. one bounded, immutable CAS publication plan for at most nine semantic
   artifacts;
2. aggregate filesystem capacity admission before the first final link;
3. dependency-tier durability without claiming filesystem all-or-none
   transactions;
4. database-first publication and bounded aggregate recovery.

It also removes a false recovery claim in the current primitive. A process that
dies while holding the existing `.capacity.lock` can leave a permanent lock
file. The existing store deliberately refuses to break such a lock. Production
batch recovery therefore cannot be called convergent while it depends only on
that persistent file. Before activation, every production single-artifact and
batch writer must use the same PostgreSQL transaction-scoped capacity lease.

This design does not activate Product Semantics v2, modify a generated project,
weaken a gate, start a Setfarm run, or claim that a set of filesystem directory
entries is atomically committed.

## Current evidence

The current `ContentAddressedArtifactStore.put` provides strong single-artifact
properties:

- bounded canonicalization before schema traversal;
- exact immutable hash paths and no-replace hard-link publication;
- physical-root identity fencing;
- per-artifact capacity admission;
- fresh bounded verification before returning success.

Those properties are implemented in `src/product-compiler/artifact-store.ts`.
They do not compose into a batch by calling `put` repeatedly. Each call measures
and locks independently, a quota failure can occur after an earlier artifact was
published, and there is no dependency durability order.

Migration 23 now supplies the complementary database authority:

- immutable normalized membership;
- one aggregate owner, token, and expiry;
- exact reserved-byte accounting;
- aggregate heartbeat, adoption, publication, and finalization;
- deterministic child reservations and terminal-state enforcement.

The remaining boundary is to make the filesystem operation and the database
aggregate describe the same prepared bytes without relying on caller prose or
mutable input.

## Considered approaches

### Repeated single-artifact `put`

This preserves current code but cannot perform aggregate capacity admission or
dependency durability. It is rejected.

### Staging-root rename or root generation swap

A private directory can be renamed atomically, but it cannot be atomically
merged into the shared flat CAS namespace. Swapping the whole root would break
concurrent readers, root identity, and existing hash paths. An indirection-based
generation store would be a different storage architecture and is not required
for immutable CAS convergence. It is rejected.

### Prepared tiered batch under database-backed capacity authority

All values are snapshotted and canonicalized before reservation or filesystem
mutation. The database reserves the exact identities. One crash-releasing
PostgreSQL lease then protects physical staging and publication. Missing bytes
are admitted as one aggregate, staged completely, and linked in durability
tiers with a directory-sync barrier between tiers. This is the selected
approach.

## Authoritative invariants

The implementation must preserve all of the following:

1. Public input contains between one and nine occurrences before deduplication.
2. No caller-owned proxy, accessor, mutable container, or malformed Unicode is
   traversed by Zod before bounded snapshot authority accepts it.
3. Every unique envelope independently satisfies the existing per-artifact
   payload limit and exact semantic-envelope schema.
4. Exact duplicate bytes at the same durability tier deduplicate. Reusing a
   hash with different bytes, identity, or tier fails before root creation,
   database reservation, or filesystem mutation.
5. Unique entries have one deterministic order: durability tier ascending,
   then artifact hash ascending.
6. Durability tiers are dense integers from zero through at most eight. A later
   tier may only be published after the previous tier has crossed a directory
   durability barrier.
7. The database batch is reserved before any CAS target is created.
8. Existing target bytes are verified before and again inside the physical
   publication lease.
9. Aggregate missing bytes pass root quota and free-space admission before the
   first final target is linked.
10. All missing payloads are written and file-synced before the first final
    target is linked.
11. No existing final target is overwritten or deleted.
12. The method returns success only after every expected final target is freshly
    read and its exact bytes, hash, envelope, and identity match the prepared
    plan.
13. A failure can leave immutable final targets, but never a success receipt or
    database claim for bytes that were not freshly verified.
14. A ByteBundle root is never indexed unless every referenced ByteChunk is
    freshly present and exactly matches the root manifest.
15. All production CAS writers share one crash-releasing capacity authority.
    Direct store calls without that authority cannot be activated in production.
16. One database authority UUID is immutably bound to one configured root
    locator and one no-replace root marker. A different database authority
    cannot adopt that root by configuration alone.

## Versioned publication plan

The public input schema is `setfarm.artifact-store-batch-put-plan.v1`:

```ts
type ArtifactStoreBatchPutPlanV1 = Readonly<{
  schema: "setfarm.artifact-store-batch-put-plan.v1";
  items: readonly Readonly<{
    durabilityTier: number;
    envelope: unknown;
  }>[];
}>;
```

`durabilityTier` is physical ordering metadata, not semantic identity. The
producer that understands an artifact schema owns the mapping from semantic
dependencies to tiers. For ByteBundleV1, every ByteChunk is tier zero and the
ByteBundle root is tier one. Within a tier, artifact hash order is canonical.

Preparation produces a runtime-private `PreparedArtifactStoreBatchV1`. It owns
copied canonical buffers that are not exposed to the caller. Its public view is:

```ts
type PreparedArtifactStoreBatchViewV1 = Readonly<{
  schema: "setfarm.prepared-artifact-store-batch.v1";
  planIdentityHash: string;
  occurrenceCount: number;
  items: readonly Readonly<{
    durabilityTier: number;
    identity: ArtifactIdentity;
  }>[];
}>;
```

`planIdentityHash` is SHA-256 over Canonical JSON containing the plan schema and
the ordered tier plus full artifact identity of every unique item. It protects
the in-process handoff and operational evidence. It does not replace migration
23's membership identity. Migration 23 remains authoritative for the unordered
semantic set; the prepared plan is authoritative for physical durability order.

The successful result is:

```ts
type ArtifactStoreBatchPutResultV1 = Readonly<{
  schema: "setfarm.artifact-store-batch-put-result.v1";
  planIdentityHash: string;
  createdCount: number;
  createdBytes: number;
  items: readonly Readonly<{
    durabilityTier: number;
    hash: string;
    path: string;
    byteLength: number;
    created: boolean;
  }>[];
}>;
```

The item order is the prepared canonical tier/hash order. There is no partial
success result.

## Pure preparation boundary

A new focused module owns batch preparation. It must:

1. reject a proxied or malformed outer plan before reading indexed properties;
2. snapshot at most nine plain item records with data properties only;
3. run the existing bounded canonical serializer independently on each
   envelope;
4. parse only the resulting plain JSON snapshot with
   `SemanticArtifactEnvelopeV1Schema`;
5. canonicalize the parsed envelope again and require byte equality with the
   source snapshot;
6. derive full artifact identities from those exact bytes;
7. normalize exact duplicates and reject conflicts;
8. validate dense bounded tiers and produce canonical tier/hash order;
9. copy every retained byte buffer into private prepared-plan ownership;
10. compute and pin the plan identity.

Preparation performs no directory creation, PostgreSQL call, capacity
measurement, or artifact write. Mutating the original input after preparation
cannot change identities or written bytes.

`ContentAddressedArtifactStore.put(value)` is reimplemented through a one-item,
tier-zero prepared batch. Single and batch writes must not retain separate
publication algorithms.

## Production capacity lease

The current persistent `.capacity.lock` remains a useful fail-closed standalone
diagnostic, but it is not a crash-releasing production coordinator. The selected
production authority combines a PostgreSQL transaction-scoped advisory lock
with an immutable database/root binding.

Migration 24 adds the exact singleton authority relation:

```sql
CREATE TABLE artifact_store_authorities (
  authority_key TEXT PRIMARY KEY,
  authority_schema TEXT NOT NULL,
  authority_id UUID NOT NULL UNIQUE,
  root_locator_hash TEXT NOT NULL,
  state TEXT NOT NULL,
  diagnostic TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

Exact constraints restrict `authority_key` to `semantic-artifacts`,
`authority_schema` to `setfarm.artifact-store-authority.v1`,
`root_locator_hash` to lowercase SHA-256, and `state` to
`binding | ready | quarantined`. `ready` has no diagnostic; `quarantined`
requires one. Identity fields and a ready row are immutable. Migration 24 owns
the exact table, constraints, indexes, transition trigger, verifier, source
digest, audit, and empty-only rollback.

The root contains one canonical, no-replace marker named
`.setfarm-artifact-root-authority.json`:

```json
{
  "schema": "setfarm.artifact-store-root-authority.v1",
  "authorityId": "00000000-0000-0000-0000-000000000000",
  "rootLocatorHash": "64-lowercase-hex"
}
```

The locator hash is computed from Canonical JSON containing the normalized
absolute configured root path and authority schema; it contains no credential.
The database row is committed first in `binding` state. The marker is then
created with no replacement under the advisory lock, freshly verified, and the
same row becomes `ready`. A crash after either boundary replays the same
identity. If a marker already carries another identity or locator, the database
row becomes quarantined and no artifact path is touched. Two databases racing
for one unbound root therefore produce one marker winner and one typed loser,
even though PostgreSQL advisory locks are database-local.

An existing unmarked root may be bound only by an explicit offline adoption
operation that first performs complete bounded inventory and database
reconciliation. Normal startup never adopts it merely because its path matches.

The advisory lock identity is the fixed versioned domain
`setfarm.semantic-artifact-filesystem-publication.v1`. One database may only
have one ready semantic artifact authority row. Multiple application processes
using that database serialize on the same lock.

The provider interface is capability-based:

```ts
type ArtifactStoreCapacityLease = Readonly<{
  authority: "postgres-transaction-v1";
  assertCurrent(): Promise<void>;
}>;

type ArtifactStoreCapacityLeaseProvider = Readonly<{
  withLease<T>(
    work: (lease: ArtifactStoreCapacityLease) => Promise<T>,
  ): Promise<T>;
}>;
```

The provider starts one bounded transaction, applies a 30-second advisory-lock
acquisition timeout, takes the advisory transaction lock, and proves the
`artifact_capacity` singleton and ready authority row are present and not
quarantined. It freshly verifies the exact root marker before invoking work.
The callback has a five-minute abort deadline, which is above the bounded
nine-artifact/36-MiB maximum but below the aggregate database lease maximum.
The capability includes an `AbortSignal`; `assertCurrent` checks that signal,
the transaction connection, authority row, marker, and root identity.
Connection loss or timeout makes subsequent publication fences fail. The
advisory lock is released automatically by commit, rollback, connection loss,
or process death.

The production factory must inject this provider into every
`IndexedArtifactPublisher`, including single-artifact publication. A store
without a PostgreSQL provider is test/bootstrap-only, carries no production
activation authority, and cannot be selected by runtime configuration.

## Owned staging layout

The artifact root gains one reserved internal directory:

```text
<root>/.setfarm-artifact-root-authority.json
<root>/.staging/<planIdentityHash>.<random-token>/<artifact-hash>.tmp
<root>/<artifact-hash>.json
```

`.staging` and attempt directories must be ordinary directories beneath the
held physical root. They cannot be symlinks. Temp entries must be ordinary files
with exact expected names and private mode. Final publication remains a
same-filesystem, no-replace hard link from temp to the flat CAS hash path.

At the start of a production lease, the current holder is the only production
writer. It may remove abandoned staging attempt directories after bounded,
no-follow validation. At most 64 attempt directories, at most nine temp files
per attempt, and at most 640 total staging entries are inspected in one cleanup.
Exceeding any bound quarantines the layout. Cleanup is fail-closed:

- a symlink, special file, unexpected name, excessive entry count, or root
  identity change quarantines the operation;
- cleanup never follows a path outside the held root;
- final `<hash>.json` targets are never considered staging and are never
  removed;
- staging and root directories are synchronized after cleanup.

Inventory scanning accepts the exact authority marker and owned `.staging`
directory only after it has acquired the same production lease, verified the
marker, and completed cleanup. Any other non-canonical root entry remains an
inventory error.

## Filesystem publication algorithm

`putPreparedBatch` performs the following exact sequence:

1. Verify all currently existing final targets outside the lease. This is an
   optimization only and grants no authority.
2. Ensure the root and owned staging layout exist without replacing an existing
   entry.
3. Acquire the production capacity lease; verify the database/root authority
   binding; bind the physical root identity.
4. Clean only abandoned owned staging under the held authority.
5. Reverify every final target. Partition the plan into exact existing and
   missing entries.
6. Measure the held physical root once. A test override may only increase
   observed root bytes or decrease observed free bytes.
7. Check each unique entry against `maxPayloadBytes`; safely sum unique missing
   bytes; perform root-quota and free-space admission with that aggregate.
8. Create one private attempt directory. Write, file-sync, and close every
   missing temp file in canonical tier/hash order. Reverify temp identity and
   bytes. No final target has been linked yet.
9. For each durability tier in ascending order:
   - assert the database lease and physical root;
   - link each missing temp to its final target with no replacement;
   - on `EEXIST`, freshly verify exact target bytes;
   - assert the lease and root again;
   - sync the artifact root directory as the tier durability barrier.
10. Freshly read and verify every final target under the same root authority.
11. Remove only the current attempt directory, sync `.staging` and root, and
    return the complete result.

Any error closes handles and removes only verified current-attempt temp paths
when authority is still held. Already linked immutable targets are not rolled
back. If authority is lost, cleanup stops rather than acting on an untrusted
path.

The durability claim is deliberately narrow. After a process or host failure,
zero or more complete earlier tiers and part of the current tier may remain.
No artifact in a later tier was linked before the previous tier's directory
barrier completed. This is dependency-tier convergence, not all-or-none
filesystem atomicity.

## Database-first indexed publisher

`IndexedArtifactPublisher` gains one aggregate method:

```ts
putBatch(input: Readonly<{
  batchReservationId: string;
  plan: unknown;
}>): Promise<IndexedArtifactBatchPublicationResultV1>;
```

It executes this state machine:

1. Prepare the immutable batch completely.
2. Reserve migration 23's aggregate batch from the prepared full identities.
   No CAS mutation occurs before this commit.
3. If the batch is already completed, fresh-read every CAS artifact and validate
   semantic closure before returning an idempotent result.
4. Require the exact live aggregate owner/token returned by reservation.
5. Call `putPreparedBatch` with the production capacity provider.
6. Fresh-read all prepared artifacts again and compare full identities.
7. Validate artifact-type closure. For ByteBundleV1 this proves every declared
   chunk exists and matches its envelope hash, envelope byte length, raw hash,
   raw byte length, and ordinal.
8. Publish database child reservations in durability-tier/hash order. A later
   tier cannot be indexed before every earlier-tier member is indexed or was
   already indexed. The ByteBundle root is therefore indexed last.
9. Require the aggregate header to become `completed` after the last child.
10. Return one result that binds the database batch identity, prepared plan
    identity, CAS results, and final lifecycle.

The publisher does not recreate an indexed artifact whose CAS target is absent.
That is filesystem/index drift and quarantines the operation. It also does not
convert a lease loss into a new reservation. Expiry recovery owns that decision.

## Failure settlement

Failure handling is based on fresh operational evidence:

- failure before any valid CAS target exists: finalize the owned aggregate as
  `released` with a typed diagnostic;
- one or more valid immutable targets exist and no target is corrupt: leave the
  aggregate active for expiry recovery; do not discard its recovery evidence;
- any expected hash has corrupt, non-canonical, wrong-type, or wrong-identity
  bytes: finalize or recover the whole remaining aggregate as `quarantined`;
- owner/token/expiry loss: make no terminal mutation under stale authority;
- PostgreSQL or filesystem authority loss with uncertain state: return an error
  and require fresh aggregate recovery.

Errors may include non-authoritative diagnostic context such as the current
hash and tier. They do not include a reusable partial-success receipt. The next
owner must read migration 23 state and CAS bytes again.

New typed store/coordinator failures are limited to:

- `ARTIFACT_BATCH_PLAN_INVALID`
- `ARTIFACT_BATCH_DUPLICATE_CONFLICT`
- `ARTIFACT_BATCH_CAPACITY_OVERFLOW`
- `ARTIFACT_BATCH_PUBLICATION_INCOMPLETE`
- `ARTIFACT_STAGING_LAYOUT_INVALID`
- `ARTIFACT_CAPACITY_AUTHORITY_LOST`

Existing hash, envelope, root, file-change, bounded-read, quota, and free-space
codes remain authoritative and are not reclassified by message regex.

## Aggregate recovery

`recoverExpiredArtifactPublications` remains single-reservation recovery and
continues to exclude `APRB_` children. A separate
`recoverExpiredArtifactPublicationBatches` owns aggregate work:

1. List expired batches with exact observed token and expiry generation.
2. Fresh-read every batch member from CAS and classify it as exact, missing, or
   corrupt. Never trust a prior exception message or agent claim.
3. Validate closure for every dependency-bearing root.
4. If any member is corrupt, generation-scoped finalize as `quarantined`.
5. If every unresolved member is exact, adopt once, publish in durability order,
   and complete.
6. For a mixed exact/missing set, adopt once, publish only exact members whose
   dependency closure is satisfied, then owned-finalize all remaining members as
   `released`. A valid ByteBundle root with any missing referenced chunk is not
   publishable.
7. If every unresolved member is missing, generation-scoped finalize as
   `released` without a transient adoption.
8. Any heartbeat, adoption, or finalization race produces `stale`; the worker
   re-lists rather than retrying an unchanged decision.

Recovery never calls a model. Mission Control receives canonical lifecycle,
member classifications, generation identity, and diagnostics from operational
evidence.

## Inventory and bootstrap closure

`scanArtifactInventory` becomes a bounded two-pass validator:

1. enumerate only canonical final artifact files plus the exact owned staging
   directory;
2. fresh-read every final artifact and derive full identity;
3. build an in-memory hash map bounded by the configured root quota and a
   versioned maximum of 100,000 canonical final artifacts;
4. validate every registered dependency-bearing artifact type against that map;
5. only then pass the complete inventory to database bootstrap.

ByteBundleV1 is the first closure validator. A bundle with a missing or
mismatched chunk makes bootstrap quarantine the inventory; it is never silently
indexed and never silently deleted. Unknown future dependency-bearing types are
not activated until they register a deterministic closure validator.

## Concurrency and crash semantics

The following outcomes are permitted:

- concurrent identical batches converge on the same immutable targets;
- overlapping batches share exact existing targets and charge missing bytes
  once at the filesystem layer and once through database publication identity;
- a process crash leaves an expiring database batch, an automatically released
  PostgreSQL capacity lease, optional owned staging, and an immutable subset of
  final targets;
- a host crash may retain a partial current tier, but cannot retain a linked
  later tier whose prerequisite tier never crossed its durability barrier;
- a database commit failure after filesystem publication leaves CAS evidence
  for aggregate expiry recovery.

The following outcomes are forbidden:

- two live production capacity owners;
- stale persistent lock files blocking all later production publication;
- manifest/root indexing before dependency closure;
- aggregate quota rejection after the first final link;
- success based on a pre-lock read;
- deleting a final hash target as rollback;
- publishing under an expired or adopted aggregate generation.

## Compatibility and migration

Migration 23's semantic membership schema does not change. Migration 24 adds
only database/root physical authority; it does not alter batch membership or
semantic artifact identity. Durability tiers are
an operational physical plan and do not alter artifact identity. The publisher
must prove that its prepared unique identity set exactly equals migration 23's
immutable item set before writing.

The flat `<hash>.json` read path remains compatible. The authority marker and
`.staging` are newly reserved internal entries and require inventory, capacity,
path-contract, migration, and cleanup updates. Existing roots containing an
unrelated marker or `.staging` entry fail closed; they are not adopted by name
alone.

Single-artifact publication is migrated onto the same prepared batch and
PostgreSQL capacity-provider path before batch activation. The old persistent
file lock remains available only to isolated tests and explicit offline tools.
There is no mixed production mode.

Rollback is code-first:

1. disable the batch publisher activation flag;
2. allow active migration 23 batches to expire and run aggregate recovery;
3. return callers to the single-artifact publisher, which still uses the same
   production capacity provider;
4. retain CAS files and migration 23 evidence;
5. remove no final artifact and bypass no checksum.

Migration 24 rollback has a stricter offline boundary. It refuses while any
final artifact, staging entry, active publisher, or authority mismatch exists.
An explicit unbind operation must hold the advisory lock, prove the marker and
database row are exact, prove the root has no final artifacts and empty staging,
remove the marker with no-follow identity checks, synchronize the root, and
delete the authority row in a source-bound receipt transaction. Only then may
the empty migration 24 schema roll back to migration 23. Normal release rollback
does not require or perform this destructive unbind.

## Dependency-order implementation program

1. Add pure bounded batch-plan preparation and golden identity tests.
2. Add aggregate capacity assessment without changing single-payload limits.
3. Add migration 24 database/root authority, exact verifier, source digest,
   offline audit, adoption CLI, and empty-only rollback.
4. Add the PostgreSQL transaction-scoped capacity provider, exact marker
   binding, abort deadline, and production factory assertion.
5. Add owned staging validation and bounded abandoned-staging cleanup.
6. Refactor single `put` through the prepared one-item path.
7. Add tiered `putPreparedBatch` and filesystem adversarial tests.
8. Add artifact closure registry and ByteBundleV1 closure validation.
9. Add indexed aggregate `putBatch` using migration 23 APIs.
10. Add aggregate expiry recovery and generation-race tests.
11. Upgrade inventory/bootstrap to two-pass closure validation.
12. Add Mission Control operational result mapping only after canonical server
    evidence exists.
13. Keep activation off until the complete verification matrix is green on a
    clean `main` build.

No step may temporarily activate a caller that depends on a later invariant.
The implementation plan may divide these steps into reviewable commits, but the
authority is one coupled release slice: production activation is withheld until
the provider, store, publisher, recovery, and bootstrap consumers all use it.

## Verification matrix

### Unit

- outer proxy, item proxy, accessor, sparse array, excessive occurrence count,
  malformed Unicode, depth, node, container, and byte budgets;
- exact duplicate dedupe and hash/identity/tier conflict with zero mutation;
- dense tier normalization and deterministic plan identity golden vectors;
- per-item payload limit plus safe aggregate-byte overflow handling;
- original input mutation after preparation cannot alter output;
- ByteBundle dependency-tier plan and exact closure validator.
- migration 24 rejects extra/missing/weakened authority objects and marker
  identity drift across plan, apply, verify, audit, adoption, and rollback.

### Filesystem integration

- all temps are file-synced before the first final link;
- root quota and free-space rejection occur before any final link;
- one root measurement and conservative override behavior;
- existing exact target reuse, corrupt target rejection, and no overwrite;
- tier barrier order under deterministic crash injection;
- process failure after staging, during tier zero, between tiers, during tier one,
  and before final verification;
- stale staging cleanup under the sole PostgreSQL owner;
- two different database authority IDs racing for one root produce one marker
  winner and one quarantined loser before any final artifact link;
- symlink, FIFO, socket, special-file, root replacement, staging replacement,
  lock loss, and path ABA attacks;
- final success fresh-verifies every member.

### Database and concurrency

- database reservation commits before the first CAS mutation;
- two capacity contenders serialize and process death releases authority;
- two identical and two overlapping batches converge without double charge;
- lease expiry during filesystem work cannot publish under stale ownership;
- partial DB publication followed by adoption completes exactly once;
- mixed missing/exact recovery releases only after publishing closure-safe
  members;
- corruption quarantines the remaining aggregate;
- stale expected token/expiry cannot finalize an adopted generation;
- single and batch publishers share the same capacity authority.

### Bootstrap and end to end

- abandoned owned staging is cleaned before inventory;
- inventory rejects more than 100,000 final artifacts before unbounded map
  construction;
- unexpected root entries remain fail-closed;
- orphan chunks are valid standalone artifacts;
- an orphan ByteBundle root with missing chunks quarantines bootstrap and is not
  indexed;
- maximum eight-chunk ByteBundle publishes chunks before the root and replays
  idempotently after each injected crash boundary;
- clean `main` build, full Setfarm tests, migration digest verification, path and
  English contracts;
- three clean product-class evals may begin only after later packet, evidence,
  browser, and runtime capsule dependencies are complete.

## Release decision

Implementation of this design is **GO** after written-spec approval. Production
activation, migration deployment, Setfarm release, and clean product evals
remain **NO-GO** until every dependency-order step and verification row above is
green. The design intentionally replaces repeated root-fix behavior with one
machine-readable publication plan, one aggregate database fence, one physical
capacity owner, and fresh evidence-based recovery.
