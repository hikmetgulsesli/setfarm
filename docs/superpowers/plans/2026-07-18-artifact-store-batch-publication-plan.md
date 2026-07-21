# Artifact Store Batch Publication Implementation Plan

Date: 2026-07-18

Design:
`docs/superpowers/specs/2026-07-18-artifact-store-batch-publication-design.md`

Base commits:

- bounded single-artifact CAS: `9cebc6f`
- migration 23 aggregate database authority: `c53e688`
- batch publication design: `e5a757e`

Branch: `arch/product-semantics-v2-authority`

## Delivery rules

1. Work in dependency order and keep each commit independently testable.
2. Write failing tests before implementation code.
3. Keep batch and production-authority activation off until every consumer has
   migrated.
4. Do not change migration 23 membership or weaken its verifier.
5. Add migration 24 for database/root authority; never bypass a checksum.
6. Do not claim filesystem all-or-none atomicity.
7. Do not return partial publication as authority; recovery always performs
   fresh DB and CAS reads.
8. Do not delete final CAS hash targets as rollback or cleanup.
9. Do not use `SETFARM_ALLOW_DIRTY_BUILD=1` or a runtime guard bypass.
10. On the feature branch, use focused tests, `npx tsc --noEmit`, source
    contracts, and migration digest checks. Run authoritative `npm run build`
    only from the clean merged `main` commit.
11. Do not start a Setfarm run, mutate live DB state, or activate production
    publication during implementation.
12. Stop and report if the same root failure repeats three times after a fix.

## Slice A — Immutable prepared plan and aggregate admission

### Task A1: Bounded prepared batch plan

Files:

- add `src/product-compiler/artifact-store-batch-plan.ts`
- add `tests/product-compiler/artifact-store-batch-plan.test.ts`
- modify `src/product-compiler/artifact-store.ts` only to consume shared identity
  helpers if required; do not change publication behavior yet

Tests first:

- reject proxied outer plan before reading a trap;
- reject proxied/accessor/sparse item records before Zod traversal;
- reject zero and ten occurrences;
- reject invalid or non-dense durability tiers;
- bound each envelope's byte, depth, node, container, and work limits;
- preserve exact Canonical JSON bytes accepted by single-artifact `put`;
- deduplicate exact bytes at the same tier;
- reject same hash/identity at a different tier with zero side effects;
- sort unique entries by tier then lowercase hash;
- pin full-field UTF-8 plan and item golden hashes;
- mutating original input after preparation does not change bytes, identities,
  or plan identity;
- no public getter exposes the privately owned mutable buffers.

Implementation:

1. Define exact v1 plan/view/result schemas and bounds.
2. Add a dedicated outer-plan snapshot that rejects proxies and accessors before
   indexed reads.
3. Reuse `canonicalJsonBytesBounded` for each envelope before semantic schema
   parsing.
4. Copy accepted bytes into a runtime-private prepared-plan class.
5. Normalize occurrences, validate dense tiers, and compute the plan identity.
6. Expose only frozen identity views and internal byte access authenticated by a
   private capability.

Verification:

```bash
node --import tsx --test tests/product-compiler/artifact-store-batch-plan.test.ts
npx tsc --noEmit
npm run check:english
git diff --check
```

Commit: `feat(artifacts): prepare bounded batch plans`

### Task A2: Aggregate capacity assessment

Files:

- modify `src/product-compiler/artifact-capacity.ts`
- modify `tests/product-compiler/artifact-capacity.test.ts`
- add batch admission cases to
  `tests/product-compiler/artifact-store-batch-plan.test.ts`

Tests first:

- every unique item still observes `maxPayloadBytes` independently;
- duplicate occurrences count physical missing bytes once;
- aggregate addition rejects unsafe-integer overflow;
- root quota and free-space failures retain distinct codes;
- exact existing items contribute zero missing bytes;
- aggregate capacity failure is decided before any write hook can run.

Implementation:

1. Add a pure `assessArtifactBatchCapacity` over unique missing lengths.
2. Use checked safe-integer addition and the current normalized limits.
3. Preserve existing single-artifact assessment output and error codes.
4. Add `ARTIFACT_BATCH_CAPACITY_OVERFLOW` only for arithmetic authority loss.

Verification:

```bash
node --import tsx --test \
  tests/product-compiler/artifact-capacity.test.ts \
  tests/product-compiler/artifact-store-batch-plan.test.ts
npx tsc --noEmit
git diff --check
```

Commit: `feat(artifacts): assess aggregate capacity`

## Slice B — Database/root authority and crash-releasing lease

### Task B1: Migration 24 authority ledger

Files:

- modify `src/db/contract-spine-migrations.ts`
- modify `src/db/contract-spine-migration-source-integrity.ts`
- regenerate `src/db/contract-spine-migration-digests.generated.ts`
- modify `scripts/contract-spine-migrate.ts`
- modify `package.json`
- add `tests/execution-attempts/artifact-store-authority-migration.test.ts`
- modify `tests/execution-attempts/migration-source-digests.test.ts`
- modify `tests/execution-attempts/migrations.test.ts`
- modify `tests/execution-attempts/product-compilation-attempt-migration.test.ts`
- modify `scripts/__tests__/contract-spine-migrate.test.js`

Tests first:

- install and verify exact migration 24 from v23;
- reject extra/missing columns, constraints, indexes, functions, or triggers;
- reject unlogged, partitioned, inherited, or RLS-enabled authority relation;
- enforce exact `binding|ready|quarantined` shapes;
- make authority identity immutable and quarantine terminal;
- detect dropped journaled helpers with typed drift on every operation;
- source digest changes for SQL, verifier, registration, database audit,
  migration-schema adoption, rollback, and canonical receipt identity; mutable
  CLI/package wiring is verified separately and never changes DB journal identity;
- offline database audit rejects authority-row drift;
- audit linearizes after an in-flight authority writer, verifies the exact
  journal/source chain and v23 prerequisites, and rejects newer journal versions;
- deterministic authority collations and exact journal collation ownership
  reject case-insensitive canonical identity or state weakening;
- apply, verify, attestation, audit, and rollback fail closed behind direct
  journal writers; rollback rejects incoming FK cascade side effects;
- rollback refuses any authority row;
- empty verified migration rolls back to v23 under an exact release target;
- concurrent apply has one migration owner and no intermediate adoption.

Implementation:

1. Add exact `artifact_store_authorities` singleton schema and transition
   authority.
2. Add bounded startup verification and explicit offline data audit.
3. Add source-bound empty-only rollback.
4. Add CLI modes for database authority audit and empty rollback. Keep offline
   root adoption absent until B2 marker/lease authority and E1 closure-aware
   inventory are available. Binding is permanent provenance: never add an
   unbind GUC, trigger bypass, or authority-row deletion path; future root
   movement uses a new versioned authority epoch.
5. Keep migration 23 byte-for-byte and checksum-identical.

Verification:

```bash
node --import tsx --test tests/execution-attempts/artifact-store-authority-migration.test.ts
node --import tsx --test tests/execution-attempts/migration-source-digests.test.ts
npm run check:migration-digests
npm run test:scripts
npx tsc --noEmit
git diff --check
```

Commit body must explain migration/adoption/rollback boundaries.

Commit: `feat(db): bind artifact store authority`

### Task B2: Root marker and hybrid PostgreSQL/filesystem capacity provider

Files:

- add `src/product-compiler/artifact-store-authority.ts`
- add `tests/product-compiler/artifact-store-authority.test.ts`
- modify `src/product-compiler/artifact-index.ts`
- modify `tests/product-compiler/artifact-index.test.ts`
- modify `src/product-compiler/runtime-packet-compiler.ts`
- modify `src/execution/activation-preflight.ts`
- modify `src/server/product-build-authority.ts`
- modify `src/server/run-operational-snapshot.ts`
- modify `src/execution/run-operational-action.ts`
- modify `src/execution/v3-project-transfer-ack-repository.ts`
- modify `src/evals/convergence-runner.ts`
- modify `src/product-compiler/runtime-artifact-reader.ts`
- modify `src/runtime-config.ts`
- modify `scripts/product-artifact-index.ts`
- modify other production `IndexedArtifactPublisher` factories found by `rg`

Tests first:

- DB row commits in `binding` before marker creation;
- crash before marker and crash before `ready` replay the same authority ID;
- marker creation is no-replace and exact canonical bytes;
- a parent-directory no-replace binding claim distinguishes crash replay from
  adoption of any pre-existing unmarked root;
- an empty unmarked root without the exact binding claim is rejected;
- a stale exact claim is removed durably only after the ready marker supersedes
  it;
- wrong authority ID, locator hash, schema, bytes, file type, or symlink
  quarantines before artifact mutation;
- two databases racing with different identities for one root produce one
  marker winner and one loser;
- two restored/cloned databases carrying the same ready identity and sharing
  one root serialize on one crash-releasing filesystem kernel lock;
- two processes in one DB serialize on the advisory transaction lock;
- process, helper, or connection death releases its corresponding lock;
- one cumulative 30-second acquisition and five-minute work deadline spans
  initialization plus lease work; the ready fast path uses one transaction;
- `assertCurrent` fences transaction, row, marker, kernel descriptor/helper,
  and physical-root changes;
- deterministic authority stages reject external hardlink aliases and replay
  an exact link-before-unlink crash tail to one final link;
- final marker, descriptor, and binding claim require exact canonical bytes,
  current ownership, mode `0600`, and one link;
- root enumeration before marker and before `ready` rejects any foreign entry;
- transient filesystem observation failure is retryable/unavailable and never
  terminal quarantine;
- a wrong configured root fails without mutating or quarantining the authority
  bound to the correct root;
- a caller-thrown lookalike authority error cannot trigger quarantine;
- production factory refuses a duck-typed store without the private concrete
  hybrid-provider brand;
- a read-only runtime provider never initializes a missing/binding authority;
- every public provider-backed `get` acquires the hybrid lease and a missing
  marker cannot be read through a raw store escape hatch;
- operational refusal/snapshot consumers reject a standalone structural read
  port when `hybrid-required` is selected;
- activation preflight and index maintenance fail before DB/root access until
  E1 owns reserved-entry inventory and adoption;
- existing unmarked root is not adopted during normal startup.
- adoption remains unavailable until the E1 bounded inventory reconciliation
  is present; B2 supplies marker/lease capability but does not guess an
  existing root's identity. Unbind does not exist; future movement is a
  forward-only authority epoch.

Implementation:

1. Define exact authority marker canonical schema and locator hash.
2. Define the exact temporary parent binding-claim schema needed to close the
   portable `mkdir`/marker crash gap without adopting an existing root.
3. Implement bind/replay/quarantine state transitions through migration 24.
4. Implement a capability-based hybrid provider: PostgreSQL transaction lock
   for DB-local state plus a crash-releasing kernel lock on one exact persistent
   descriptor inside the shared root. Version-forward the provider literal;
   PostgreSQL-only authority is not production authority.
5. Put production-authority selection behind an off-by-default fail-closed
   activation switch until E1 reconciliation/adoption exists.
6. Make every enabled production single and future batch publisher use the
   privately branded concrete store/provider; never accept duck typing or fall
   back after selection.
7. Route public provider-backed reads through a private unleased implementation;
   the central runtime reader uses a non-initializing hybrid provider and outer
   SQL owners inject its exact branded port into transactional snapshots.
8. Retain standalone persistent locking only for isolated/offline mode. Block
   activation and maintenance in hybrid mode until E1 inventory/adoption lands.

Verification:

```bash
node --import tsx --test \
  tests/product-compiler/artifact-store-authority.test.ts \
  tests/product-compiler/artifact-index.test.ts
node --import tsx --test tests/execution-attempts/activation-preflight.test.ts
npx tsc --noEmit
npm run check:migration-digests
git diff --check
```

Commit: `feat(artifacts): lease physical publication`

## Slice C — Owned staging and tiered CAS publication

### Task C1: Owned staging lifecycle

Files:

- modify `src/product-compiler/artifact-store-authority.ts`
- modify `src/product-compiler/artifact-store.ts`
- add `tests/product-compiler/artifact-store-staging.test.ts`
- modify `tests/product-compiler/artifact-store.test.ts`

Tests first:

- create exact `.staging` layout only under a verified marker/root;
- accept at most 64 attempts, nine temp files per attempt, and 640 entries;
- cleanup follows no symlink and opens no special file;
- unexpected name, nested directory, FIFO, socket, symlink, excess entry, or
  root replacement fails closed;
- process-crash fixtures leave staging that the next sole DB owner cleans;
- cleanup never removes `<hash>.json` or an untrusted path;
- staging and root directory sync failures are not reported as success.

Implementation:

1. Add no-follow staging/root handle helpers with identity fences.
2. Add bounded enumeration and exact filename validation.
3. Delete only authenticated abandoned attempt files under the sole DB lease.
4. Synchronize staging and root after cleanup.

Verification:

```bash
node --import tsx --test \
  tests/product-compiler/artifact-store-staging.test.ts \
  tests/product-compiler/artifact-store.test.ts
npx tsc --noEmit
git diff --check
```

Commit: `feat(cas): own bounded staging cleanup`

### Task C2: Tiered `putPreparedBatch`

Files:

- modify `src/product-compiler/artifact-store.ts`
- modify `src/product-compiler/artifact-capacity.ts`
- add `tests/product-compiler/artifact-store-batch.test.ts`
- modify `tests/product-compiler/artifact-store.test.ts`
- modify `tests/product-compiler/artifact-capacity.test.ts`

Tests first:

- all exact existing items return without new allocation;
- reverify existing items after lease acquisition;
- aggregate quota/free-space reject before the first final link;
- all missing temp files are written, exact-verified, and file-synced before the
  first link;
- within-tier order is hash order and each tier ends with a directory barrier;
- injected crash after staging, during tier zero, between tiers, during tier
  one, and before final verification leaves only permitted immutable evidence;
- `EEXIST` races converge only when bytes are exact;
- corrupt collision never overwrites a target;
- root, marker, lease, staging, or temp ABA fails closed;
- complete result is returned only after every final target is freshly read;
- `put(value)` delegates to one tier-zero prepared item with unchanged public
  behavior and existing tests remain green.

Implementation:

1. Add `putPreparedBatch` behind an authenticated prepared plan and DB lease.
2. Perform one held-root measurement and aggregate admission.
3. Stage and sync all missing bytes before linking.
4. Link no-replace by tier/hash and sync the root after every tier.
5. Fresh-verify all targets and remove only owned staging.
6. Refactor single `put` through the same algorithm.

Verification:

```bash
node --import tsx --test \
  tests/product-compiler/artifact-store-batch.test.ts \
  tests/product-compiler/artifact-store.test.ts \
  tests/product-compiler/artifact-capacity.test.ts
npm run test:product-compiler
npx tsc --noEmit
git diff --check
```

Commit: `feat(cas): publish dependency tiers`

## Slice D — Semantic closure, indexed publication, and recovery

### Task D1: Artifact closure registry

Files:

- add `src/product-compiler/artifact-closure.ts`
- add `tests/product-compiler/artifact-closure.test.ts`
- modify `src/product-compiler/schemas/byte-bundle-v1.ts` only if a shared exact
  comparison helper is required
- modify `tests/product-compiler/byte-bundle-v1.test.ts`

Tests first:

- ordinary leaf artifacts require no dependency closure;
- ByteBundle root requires every declared chunk identity;
- missing, wrong type, hash, envelope length, raw hash, raw length, ordinal, or
  duplicate chunk fails with one typed classification;
- closure order maps chunks to tier zero and root to tier one;
- unknown dependency-bearing type cannot activate without a registered
  validator;
- registry output is deterministic and bounded to nine items.

Implementation:

1. Define a closed registry keyed by exact artifact type/version.
2. Implement ByteBundleV1 closure against fresh `ArtifactGetResult` values.
3. Produce physical tiers and publishable-member decisions from typed evidence.
4. Keep schema-specific behavior outside generic CAS code.

Verification:

```bash
node --import tsx --test \
  tests/product-compiler/artifact-closure.test.ts \
  tests/product-compiler/byte-bundle-v1.test.ts
npx tsc --noEmit
git diff --check
```

Commit: `feat(artifacts): validate bundle closure`

### Task D2: DB-first indexed batch publisher

Files:

- modify `src/product-compiler/indexed-artifact-publisher.ts`
- modify `tests/product-compiler/indexed-artifact-publisher.test.ts`
- modify `src/product-compiler/artifact-index.ts` only for transaction-safe
  batch reads required by the coordinator
- modify `tests/product-compiler/artifact-index.test.ts`

Tests first:

- immutable preparation completes before DB reservation;
- DB reservation commits before the first filesystem mutation;
- prepared identity set must exactly equal migration 23 membership;
- completed replay fresh-reads every CAS member and closure;
- active owner uses exact aggregate token and expiry;
- chunks publish before ByteBundle root;
- root cannot publish while any dependency is unindexed or mismatched;
- filesystem success plus DB failure leaves active recovery evidence;
- lease loss never creates a replacement reservation or stale terminal write;
- no partial result is returned;
- final result binds batch identity, plan identity, CAS receipts, and completed
  lifecycle.

Implementation:

1. Extend the index client type with aggregate migration 23 operations.
2. Add `IndexedArtifactPublisher.putBatch` as the only DB/CAS coordinator.
3. Reserve, physically publish, fresh-read, validate closure, and publish child
   rows in tier/hash order.
4. Settle only from fresh evidence and preserve active recovery state after
   durable partial publication.

Verification:

```bash
node --import tsx --test \
  tests/product-compiler/indexed-artifact-publisher.test.ts \
  tests/product-compiler/artifact-index.test.ts
npm run test:product-compiler
npx tsc --noEmit
git diff --check
```

Commit: `feat(artifacts): coordinate batch publication`

### Task D3: Aggregate expiry recovery

Files:

- modify `src/product-compiler/indexed-artifact-publisher.ts`
- modify `tests/product-compiler/indexed-artifact-publisher.test.ts`
- modify recovery scheduling call sites discovered by `rg`
- add focused integration cases under `tests/execution-attempts/`

Tests first:

- generic recovery continues to exclude deterministic batch children;
- every expired batch is classified from fresh CAS bytes;
- all exact members adopt once, publish in tier order, and complete;
- all missing members generation-finalize as released without adoption;
- mixed exact/missing publishes only closure-safe members then releases the
  remainder;
- valid manifest with a missing chunk is never indexed;
- corruption quarantines the remaining aggregate;
- stale observed token/expiry after heartbeat or adoption returns stale and
  re-lists;
- two concurrent recoverers produce one owner and one bounded stale result;
- recovery invokes no model and parses no prose classifier.

Implementation:

1. Add `recoverExpiredArtifactPublicationBatches` beside single recovery.
2. Use exact generation fields from `listExpiredPublicationBatches`.
3. Reuse closure registry and aggregate index APIs.
4. Emit canonical recovery results suitable for Mission Control.

Verification:

```bash
node --import tsx --test tests/product-compiler/indexed-artifact-publisher.test.ts
npm run test:execution-attempts
npx tsc --noEmit
git diff --check
```

Commit: `feat(recovery): reconcile artifact batches`

## Slice E — Bootstrap authority, presentation, and release evidence

### Task E1: Two-pass closure-aware inventory

Files:

- modify `src/product-compiler/indexed-artifact-publisher.ts`
- modify `tests/product-compiler/indexed-artifact-publisher.test.ts`
- modify `src/execution/activation-preflight.ts`
- modify `tests/execution-attempts/activation-preflight.test.ts`
- modify eval and bootstrap consumers found by `rg`

Tests first:

- acquire authority and clean staging before inventory;
- accept only marker, `.staging`, and canonical final names;
- reject more than 100,000 final artifacts before building an unbounded map;
- read every identity before closure validation or DB bootstrap;
- orphan chunks remain valid leaf artifacts;
- incomplete/corrupt ByteBundle root quarantines bootstrap and is not indexed;
- exact complete inventory reconciles idempotently;
- index/CAS drift never triggers silent artifact recreation or deletion.

Implementation:

1. Split bounded enumeration, identity read, closure validation, and DB
   bootstrap into explicit passes.
2. Bind the inventory to migration 24 authority and marker identity.
3. Return structured mismatch evidence for activation and recovery owners.

Verification:

```bash
node --import tsx --test \
  tests/product-compiler/indexed-artifact-publisher.test.ts \
  tests/execution-attempts/activation-preflight.test.ts
npm run test:product-compiler
npx tsc --noEmit
git diff --check
```

Commit: `fix(artifacts): validate inventory closure`

### Task E2: Canonical Mission Control projection

Files:

- modify Setfarm server operational-model/API files identified from the
  canonical recovery result
- modify Setfarm server tests
- modify Mission Control only after its repo is clean and Setfarm contracts are
  committed/pinned

Tests first:

- API exposes batch lifecycle, generation, member classifications, closure,
  authority state, and recovery decision from canonical evidence;
- no UI field derives success from agent prose or PR-comment text;
- stale/released/quarantined/completed remain distinct;
- disabled activation is visible rather than omitted.

Implementation:

1. Add one versioned server response mapped from DB/CAS evidence.
2. Regenerate and pin Mission Control contract artifacts.
3. Render canonical fields without local state-machine reimplementation.

Verification:

```bash
npm run check:mission-control-contracts
npx tsc --noEmit
git diff --check
```

Mission Control verification occurs in its own serialized repo commit.

Commit: `feat(server): expose batch evidence`

### Task E3: Adversarial and release gate

Evidence:

- focused unit/integration/concurrency suites for every task;
- independent adversarial review of root marker, migration 24, staging, tier
  ordering, lease loss, recovery, and bootstrap;
- full Product Compiler and execution-attempt suites;
- `npm test` with unrelated failures separately proven or resolved at source;
- `npm run check:migration-digests`;
- `npm run check:english` and path/contract checks;
- clean merged `main` `npm run build` without override;
- live migration plan/verify only after explicit deployment approval;
- no clean Setfarm product run until later Packet/Evidence/Browser/Capsule
  dependencies are also complete.

Release remains **NO-GO** until all evidence is green. This plan implements the
physical publication authority; it does not by itself satisfy the three-product
clean-run eval gate.
