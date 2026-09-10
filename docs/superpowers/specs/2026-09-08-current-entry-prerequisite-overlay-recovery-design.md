# Current-Entry Prerequisite Overlay Recovery Design

Date: 2026-09-08
Status: Approved design; awaiting written-spec review
Scope: Setfarm Task 6A current-entry prerequisite publication and exact-poison recovery on the canonical internal-production host

## Decision

Repair the current-entry recovery boundary with a dynamic, exact, fail-closed prerequisite overlay. Recovery must preserve the frozen predecessor poison inventory, accept only the two current prerequisite records that Setfarm itself can independently reconstruct from the authenticated clean-main source and live database, and construct the successor operation from those current records.

The correction must not delete, rename, overwrite, scan for “latest,” or manually bless the live `8d…` and `b7…` records. It must remain valid after future clean-main source generations change both content hashes.

## Observed Failure

Clean main `c44f618f7e7a7cd98d15180aba6006462a1808d8` passed the full P3 gate and produced a finalized clean build. Task 6A Step 1 then successfully published:

- current Authority-V3-through-migration-31 audit `8d80ed98…`, bound to clean main `c44f618f…`;
- current pending guarded-migration projection `b7ddaeba…`, bound to the same source and build.

`prepare-current-entry` stopped before migration or service mutation. Its exact-poison admission still expected only the frozen historical `31/e2` audit shards and `6e/ce` pending shards, so it treated the newly published, physically valid `8d/b7` records as foreign inventory.

The defect has two causal parts:

1. `expectedPublished` already crosses the private recovery admission boundary but is ignored by the inventory observer.
2. Recovery still labels the frozen `e2/ce` pair, produced from source `505bde4a…`, as “current” and would bind it into the successor even if the inventory accepted `8d/b7`.

No migration-32 application, manifest activation, service restart, or recovery source run occurred. The live files are preserved evidence and must remain untouched until code-owned recovery authenticates them.

## Scope and Non-Goals

This change is limited to the one already frozen exact-poison predecessor operation and its prerequisite publication/recovery interaction.

In scope:

- private no-write construction of current v31 and pending records;
- exact optional overlay admission under the existing predecessor-derived recovery writer;
- current-pair successor construction;
- response-loss, concurrency, and hostile-topology tests;
- the causal amendment to the internal-production closure plan and File Map if required by the final test inventory.

Out of scope:

- broad repair of arbitrary current-entry stores;
- accepting arbitrary historical generations, paths, bodies, or caller-supplied candidates;
- changing migration 32 or 33 semantics;
- changing the public current-entry record/pair ABI;
- deleting or compacting historical prerequisite records;
- weakening exact-poison fingerprint, zero-owner, service, source, database, or downstream-absence gates;
- external signing, notarization, packaging, installation, or distribution.

## Invariants

1. The exact poison predecessor operation, contamination fingerprint, original ten-directory/five-file inventory body, original inventory hash, and predecessor physical identities remain frozen.
2. Only `prepare-current-entry` may enter the recovery publisher. Public v31 and pending observers remain prerequisite publishers and never repair or select a successor.
3. Overlay authority is never supplied by a caller, filename scan, mtime, or “latest” rule. Its two target paths and bytes are derived privately from current authenticated source and database observations.
4. An overlay member is admissible only when its target equals the derived content-addressed path and its complete canonical bytes, file type, mode, link count, UID, device, parent chain, and stable descriptor/path observation are exact.
5. Any extra generation, unknown dirent, unequal bytes, malformed body, symlink, hard link, wrong mode/device/owner, temporary outside the existing bounded publisher family, or unstable observation fails before recovery publication.
6. The successor operation binds the current source generation’s v31 and pending pairs, never the frozen `e2/ce` pair merely because those files are members of the original poison inventory.
7. Existing records are immutable history. Recovery creates the successor through the existing no-replace publication automata and never erases or rewrites the legacy store.
8. A source, build, PBA, database, service, physical, owner, downstream, or prerequisite change across the A/B fences fails closed.

## Components

### Private Current-Prerequisite Builders

Split each current observer into a private no-write builder and the existing public publication wrapper.

The builder returns exactly `{value, bytes, pair}` after performing the current source/database/digest validation already owned by that observer. It accepts no path, root, pair, body, SQL handle, callback, or caller-provided authority. It performs no filesystem mutation.

The public observer selects its normal current-entry context, calls the builder, publishes the returned bytes through the existing immutable content-addressed publisher, and resolves the exact pair. Public behavior and historical resolution remain unchanged.

Recovery calls the builders directly. It does not call the public observers and therefore cannot accidentally publish into the legacy root before admission.

### Expected-Published Overlay

Under the existing predecessor-derived recovery writer, recovery constructs the current v31 and pending records and derives their two legacy content-addressed targets. These are the sole `expectedPublished` candidates.

The exact-poison inventory observer keeps the original frozen inventory projection unchanged. Separately, it admits each derived overlay target as either:

- absent under a stable authenticated parent; or
- present as the exact expected immutable record.

The admitted subset is pinned with the root and parent topology. Its absent/present state and every present inode/byte identity must remain stable through the adjacent recovery fences. The root enumeration may contain the frozen original inventory, the authenticated recovery writer family, reserved successor namespaces, and this exact overlay subset only.

Overlay presence is not added to the frozen poison inventory hash because it is redundant, zero-authority publication history and must not choose the recovery result. Its complete semantic content is nevertheless bound by the current-prerequisite A/B observations, the complete zero-effect bracket hash, successor genesis, and successor operation. The successor bytes are reconstructed from current authority and published independently; no legacy inode is copied, linked, or selected as authority.

This makes all four settled prefixes safe: neither current prerequisite present, audit only, pending only, or both present. A concurrent observer that changes the topology during admission causes the stability fence to fail; a later retry may admit the now-settled exact subset.

### Successor Construction

The recovery no-write bracket uses current builder outputs for both A and B observations and requires exact equality. The successor operation, zero-effect proof, successor genesis, disposition, edge, seal, and activation commit are derived from that current pair set.

The frozen `e2/ce` records remain authenticated members of the original poisoned store only. They no longer supply the successor’s current prerequisite pairs.

After activation commit, ordinary selection resolves the successor store. The returned prepared operation therefore contains the same current v31 and pending pairs captured earlier by Task 6A Step 1, so the Step 1 status equality fence can succeed without a compatibility alias.

## Data Flow

1. `prepare-current-entry` reads the fixed operation and confirms the exact poison predecessor.
2. It acquires and reauthenticates the existing predecessor-derived recovery writer.
3. It builds current v31 and pending candidates without writing.
4. It authenticates the frozen original inventory plus the optional exact current overlay.
5. It performs the existing source/PBA/service/physical/database/owner/downstream A/B fence, rebuilding current prerequisites and requiring byte equality.
6. It derives the successor operation from the current pairs.
7. It publishes or adopts the existing seven-phase disposition/genesis/operation/edge/seal/commit chain using no-replace semantics.
8. It validates the committed successor, releases the writer, selects the successor context freshly, and continues ordinary operation preparation/status publication.

Every crash or lost response resumes from durable prefix evidence. No step infers success from absence alone.

## Error and Concurrency Behavior

- A mismatched overlay is ordinary corruption, not a recoverable generation.
- A third valid-looking historical record is still foreign unless it is one of the two currently derived candidates.
- If a public observer publishes one exact candidate during recovery, topology stability rejects the current attempt before the next mutation. Retry recomputes current authority and admits the settled file only if it is still exact.
- If source or database state changes, the recomputed candidate bytes change and the A/B or already-published-candidate equality fence rejects the attempt.
- If recovery has already published a disposition or later phase, replay must reconstruct byte-identical candidates. A source generation change cannot silently fork the predecessor edge.
- Cleanup remains limited to existing writer/recovery temporary automata. Overlay and historical final records are never cleanup targets.
- Failures preserve the original error; lock release and descriptor closure remain `finally`-owned.

## Test Design

Implementation begins with a causal RED fixture that combines the two previously separate test families: exact poison plus a newer clean source generation whose public observers have published current prerequisite records.

Required coverage:

1. Both current records present: prepare converges, preserves every legacy inode/byte, creates a successor operation bound to the new pairs, and performs no DB migration or service mutation.
2. Overlay prefix matrix: none, audit only, pending only, and both present all converge to the same current-pair successor.
3. Foreign matrix: third generation, wrong shard, wrong bytes, malformed canonical body, symlink, hard link, wrong mode/device/UID, unknown sibling, and over-cap temporary all fail before recovery publication and remain unchanged.
4. Stability races: overlay appearance, replacement, parent change, and source/database A/B drift fail closed with no successor prefix beyond any already authenticated response-loss state.
5. Response loss: every existing seven-phase publication boundary is replayed with the overlay present; reconstruction is byte-identical and no overlay/original record is removed.
6. Concurrency: two recovery callers serialize under the existing writer; a concurrent public prerequisite observer can cause a safe retry but no fork or overwrite.
7. Historical behavior: old and new prerequisite pairs remain pair-resolvable by exact locator; no scan/latest/mtime selection is introduced.
8. Live-shaped regression: old `505b…` `e2/ce` originals plus current `c44f…` candidates produce a successor bound only to current pairs.
9. Static boundary: `expectedPublished` is private and derived; public observers do not call the recovery prehook; recovery does not call public observers.

Focused tests must run before implementation GREEN. After GREEN, run the complete current-entry receipt suite, source-manifest/plan tests, TypeScript, migration digests, Setfarm build, and the clean-main P3 full gate required by the closure plan.

## Delivery and Rollout

The change is delivered from a dedicated branch and reviewed PR. It is not committed directly to `main`.

After merge:

1. synchronize and authenticate a clean-main Setfarm worktree;
2. rebuild the finalized Setfarm generation if required by source change;
3. rerun Task 6A Step 1 from the beginning using the exact plan block and isolated PostgreSQL admin input;
4. require the existing live `8d/b7` files to be preserved and the successor operation/status to bind their current pairs;
5. continue migration/restart rollout only after the Step 1 zero-mutation boundary is green;
6. proceed with Mission Control DB/API/UI reconciliation, golden-run/recovery/idempotency scenarios, controlled project fleet, and final broad clean-main review.

External signed distribution remains explicitly deferred.

## File Map

Expected implementation scope:

- `src/internal-production/baseline-post-handoff-receipt-v1.ts`
- `tests/internal-production/baseline-post-handoff-receipt-v1.test.ts`
- `docs/superpowers/plans/2026-08-13-internal-production-baseline-mc-handoff-plan.md`
- Task source/P3 manifest files only if the final test path inventory changes

No new runtime module, migration, service configuration, environment variable, public CLI command, or Mission Control file is expected.

## Acceptance Criteria

The correction is complete only when:

- the live-shaped combined regression is causal and green;
- current prerequisite overlays are admitted only by exact privately derived path/bytes;
- the successor binds current rather than frozen historical prerequisite pairs;
- every legacy record is preserved byte- and inode-identically;
- response-loss and concurrency tests prove one deterministic successor;
- focused, build, migration-digest, full P3, and independent review gates pass on the delivered commit;
- clean-main Task 6A Step 1 succeeds without migration or service mutation before its documented boundary.
