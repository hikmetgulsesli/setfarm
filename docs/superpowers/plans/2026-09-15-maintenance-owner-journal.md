# Maintenance Owner Journal Implementation Plan

> **For agentic workers:** Use test-driven-development with serialized writes and independent read-only review. Continue between tasks without another execution-choice prompt.

**Goal:** Preserve one immutable maintenance intent across controller restarts, with a strictly linked history of owner attempts.

**Architecture:** Separate the candidate/source/configuration intent from renewable process ownership records. Canonical hashed records prove historical integrity only; process liveness, physical lock ownership and fresh exclusion must be independently authenticated by the controller. Never modify an already-hashed retention operation to change its owner.

**Tech Stack:** Node.js ESM, SHA-256, existing durable publication patterns.

**Spec:** `docs/superpowers/specs/2026-09-15-stopped-spawner-retention-design.md`.

## Global Constraints

- No live operations or new retention CLI until end-to-end safety qualification.
- Immutable maintenance intent binds candidate completion, clean controller source,
  retained build and launcher configuration hashes (four SHA-256 commitments).
- Owner attempt binds UID, PID, start string, process group, boot-session hash and
  reservation nonce. Owner PID is not accepted as a live observation by a parser.
- First claim has no predecessor/death observation. Later claims bind the exact
  preceding claim and a definitely-dead observation commitment; PID reuse or
  ambiguous liveness never authorizes the controller to reclaim a lock.
- Parsing or replay grants no permission to delete, launch, reclaim or release.
- Existing V1/V2 retention operation/proof parsers remain unchanged.

## File Map

- Create `scripts/build-generation-maintenance-journal.mjs`: intent and owner-chain
  canonical codecs; later physical publication uses the same strict records.
- Create `scripts/__tests__/build-generation-maintenance-journal.test.js`: schema,
  tamper, cross-intent, restart and noncanonical rejection tests.
- Create `scripts/build-generation-maintenance-journal-store.mjs`: internal
  private-directory, immutable publication and stable journal observation.
- Create `scripts/__tests__/build-generation-maintenance-journal-store.test.js`:
  physical publication, retry, partial-temp, competition and failure tests.
- Create `scripts/build-generation-maintenance-owner-observer.mjs` and its
  `scripts/__tests__/build-generation-maintenance-owner-observer.test.js`: bounded
  read-only Darwin boot/process observation; no signaling or lock mutation.
- Create `scripts/build-generation-maintenance-owner-attempt.mjs` and its test:
  compose immutable storage and current observations without granting exclusion.
- Extend `scripts/__tests__/stopped-retention-startup-qualification.test.js`:
  isolate the retained gate to distinguish absent/prepared/observer-error behavior.
- Extend the reservation module only when publication nonce must be bound before
  filesystem effects; do not expose a caller-supplied PID.
- Integrate physical immutable journal publication into retention only after the
  record codec and source/owner observation adapters are independently reviewed.

### Task 1: Immutable intent and owner history

Interfaces:

```js
createMaintenanceIntentV1({ candidateCompletionHash, controllerSourceHash,
  retainedBuildHash, launcherConfigurationHash });
createMaintenanceOwnerClaimV1(intent, owner, previousClaim = null,
  previousOwnerDeathObservationHash = null);
encodeMaintenanceJournalRecordV1(record); // canonical Buffer, newline terminated
parseMaintenanceOwnerHistoryV1(intentBytes, claimBytes); // historical data only
```

`owner` has exact keys `uid`, `pid`, `processLstart`, `processGroupId`,
`bootSessionHash`, `reservationNonce`. Intent self-pair is `maintenanceIntentRef` /
`maintenanceIntentHash`; owner self-pair is `ownerClaimRef` / `ownerClaimHash`.
Claim body includes intent hash, ordinal, previous claim hash, previous death
observation hash and owner. References use `setfarm://build-generation-maintenance/`.
Claims are limited to 4,096; each record is limited to 65,536 bytes. A later claim
cannot repeat the predecessor's UID/PID/start/boot identity with a new nonce.

- [x] Write tests before implementation:

```js
const first = createMaintenanceOwnerClaimV1(intent, owner);
const second = createMaintenanceOwnerClaimV1(intent, restartedOwner, first, deathHash);
const history = parseMaintenanceOwnerHistoryV1(
  encodeMaintenanceJournalRecordV1(intent),
  [first, second].map(encodeMaintenanceJournalRecordV1));
assert.equal(history.claims[1].previousOwnerClaimHash, first.ownerClaimHash);
assert.equal(history.intent.maintenanceIntentHash, intent.maintenanceIntentHash);
assert.throws(() => createMaintenanceOwnerClaimV1(intent, restartedOwner, first));
```

- [x] Observe initial missing-module failure, then implement exact-key, bounded,
  canonical/hash validators and immutable results. Keep structural validation
  separate from external observation authentication; do not invent a live lease.
- [x] Test crossed intent, reordered/missing predecessor, body tampering, malformed
  owner, repeated birth identity, extra keys, oversize bytes, noncanonical JSON,
  and caller mutation after record creation. Run focused tests.
- [x] Independent review; fix every material finding before physical integration.

### Task 2: Physical persistence

`openMaintenanceOwnerJournalV1(directory)` returns frozen methods `read()`,
`publishIntent(intent)` and `publishOwnerClaim(claim)`. The caller supplies an
existing absolute physical private directory; no implicit mkdir, CLI or live root
selection. Files are `intent.json` and `owner-0001.json` through `owner-4096.json`.
Staging is `.<basename>.<uuid-v4>.tmp`. All files are current-UID regular files,
mode0600, at most65536 bytes. Ancestors are stable directories, never symlinks.

`read()` is nonmutating and returns `{ intent, claims, pendingPublicationCount }`;
intent is null only in an empty/uncommitted store. It authenticates committed
canonical bytes with Task1, contiguous filenames, file identity and unchanged
directory inventory. Partial staging bytes confer no authority. At most eight
unlinked staging files are allowed; linked staging must exactly match the single
committed inode it aliases. Unknown names/types/links fail without deletion.

`publishIntent` accepts absence or byte-identical committed intent, never a
different one. `publishOwnerClaim` requires the stored intent and exact next
predecessor, or byte-identical replay of the latest claim. Replaying an older
claim after a successor exists refuses. No mutable head/index file is needed.

Publication order: exclusive staging open → complete write/fsync → no-replace
hard link → stable inode/byte verification → remove only this verified staging
name → directory fsync → stable reread. Errors close descriptors once and preserve
fixed/remaining staging evidence; no catch-path target unlink. Existing identical
fixed bytes are fsynced and reobserved without deleting an earlier publisher's
staging name. A crash before linking can be retried with another staging name;
partial old bytes remain bounded evidence, not an adopted record.

- [x] Write physical tests first:

```js
const store = openMaintenanceOwnerJournalV1(root);
store.publishIntent(intent);
store.publishOwnerClaim(first);
store.publishOwnerClaim(first); // latest exact replay, no overwrite
store.publishOwnerClaim(second);
assert.throws(() => store.publishOwnerClaim(first));
assert.equal(store.read().claims.length, 2);
assert.equal(readFileSync(path.join(root, 'intent.json'), 'utf8'), encode(intent).toString());
```

- [x] Test different intent preservation, competing next-owner bytes, malformed
  fixed record, valid partial staging ignored as authority, ninth pending staging
  refusal, extra alias/symlink/parent replacement, and a distinct child fault after
  hard link. Reopen and replay the identical record after that child exits.
- [x] Observe missing implementation failure, implement the above order with
  bounded reads and primary/close error preservation, then run focused tests.
- [x] Independent review before owner observation/controller integration.

### Task 3: Owner observation

Export `normalizeMaintenanceOwnerV1(owner)` from the codec as a frozen structural
copy, not live proof. The observer exposes:

```js
observeCurrentMaintenanceOwnerV1(reservationNonce); // { owner, observationHash }
observeMaintenanceOwnerProcessV1(owner); // { state, observationHash, bootSessionHash }
```

States are `live_match`, `live_pid_reused`, `definitely_dead`, `ambiguous`.
Only two clean empty status1 ps observations can produce definitely_dead. Any
live PID with changed UID/start/group/boot is live_pid_reused; malformed, mixed,
zombie, timeout, stderr or command errors are ambiguous. Neither state allows
reclamation. Current-owner creation requires stable real PID/UID and boot identity.

Use fixed `/usr/sbin/sysctl -n kern.boottime` before/after two fixed `/bin/ps -p
<pid> -o uid= -o lstart= -o pgid= -o stat=` observations. No shell, minimal C locale
environment, 5000ms timeout, 65536-byte cap. Hash the parsed boot sec/usec tuple,
not locale-dependent display text. Current process identity comes from the OS,
not caller fields. Current nonce is validated structurally and journal-bound;
the OS does not attest a journal nonce.

- [x] Add a read-only current-process smoke test and isolated-child command-result
  fixtures for two dead results, reused birth/boot, mixed dead/live, stderr,
  timeout, malformed rows and changing boot. Command fixtures never write live
  PID files or invoke real service commands.
- [x] Observe RED, implement bounded observation, then run codec/store/observer/
  reservation suites together and obtain independent review.
- [x] Extend reservation publication with an optional validated UUID-v4 nonce so
  the controller can journal that exact nonce before effects. PID remains internal.
  Invalid nonces refuse before filesystem mutation; default remains randomUUID.

### Task 4: Live-controller integration

#### Internal owner-attempt preparation (no live route)

Files: `scripts/build-generation-maintenance-owner-attempt.mjs` and
`scripts/__tests__/build-generation-maintenance-owner-attempt.test.js`.

`prepareMaintenanceOwnerAttemptV1(directory, intent)` opens the physical journal,
validates the exact intent, obtains a real current-owner observation with a fresh
UUID nonce, and durably publishes the claim before returning. It does not publish
a PID reservation, pause a launcher, reclaim a file or grant exclusion.

An existing claim for the same observed UID/PID/start/group/boot reuses its nonce
and latest immutable claim after a fresh observation. Any different predecessor
must freshly observe as definitely dead; live, reused and ambiguous results
refuse without appending. The successor binds that observation hash. This is a
historical commitment, not a resolvable death-evidence record or cleanup authority.
The full controller must add durable physical death evidence before reclamation.
Publish intent before claim; reread the latest claim and reobserve the current
owner after publication. A failed final check preserves history and returns no
success. Fixed-owner replay does not adopt a reservation or replace its inode.

- [x] Write a real temporary-journal/current-process test first:

```js
const first = prepareMaintenanceOwnerAttemptV1(root, intent);
const retry = prepareMaintenanceOwnerAttemptV1(root, intent);
assert.equal(first.claim.owner.pid, process.pid);
assert.equal(retry.claim.ownerClaimHash, first.claim.ownerClaimHash);
assert.equal(openMaintenanceOwnerJournalV1(root).read().claims.length, 1);
assert.deepEqual(readdirSync(root).sort(), ['intent.json', 'owner-0001.json']);
```

- [x] Run it RED, then implement the internal composition using static imports.
- [x] Use actual exited child for successor history; command-result fixtures
  cover live/reused/ambiguous predecessor and failed post-publication observation.
  Assert no successor file or reservation appears on refusal; do not mock storage.
- [x] Run all maintenance suites and independent read-only review before wiring
  any live-facing operation. Candidate/source/launcher authentication remains the
  future live controller's mandatory precondition, not inferred from hash validity.

The codec/store are prerequisites, not a complete journal controller. Before adding a
live-facing route, bind the fixed journal root below the existing retention
store and exact current-owner observation port. Reuse the existing retention publisher pattern; don't reuse
its singleton adoption semantics. Publish intent before bootout, owner claim and
reservation nonce before singleton effects; V3 retention binds the unchanged
intent pair. Every resume reobserves owner death and establishes fresh exclusion.

Required physical tests: partial temporary, hard-link after-effect, directory
fsync failure, replay of identical committed bytes, competing owner bytes,
ancestor replacement, prior live/reused/ambiguous owner, and reboot evidence.
This task cannot be declared complete from codec tests.

### Verification checkpoint

Codec, store and observer scoped reviews are clear; owner-attempt review found no
material implementation issue. Added its advisory conflicting-intent, ambiguous
initial observation and competing-successor tests; all ten owner-attempt tests
pass. Darwin-only real OS smokes are skipped only outside Darwin; deterministic
command fixtures run everywhere. No live integration is implemented or qualified.
Eight startup-qualification tests include the actual retained gate extracted from
pinned Git source. They qualify gate behavior only; the prepared fixture does not
establish real publication authority, and the injected observer error does not
authenticate the live historical parser. Independent scoped review is clear.

Full `npm run test:scripts`: 367 passes, zero failures/skips, exit0,
638846.938292ms. That run loaded the earlier 7-case attempt and 5-case startup
files; a subsequent exact six-file focused run includes all later additions:
64 passes, zero failures/skips, exit0, 1575.918833ms. No production code changed
between those runs. Syntax checks, English1486, paths859 and diff checks pass.
These checks do not claim a current production build or full P3 rerun.

## Causal integration map

Existing prepare obtains zero-reference proof at retention3966 before operation
construction3973. Therefore pre-operation maintenance intent is necessary.
V3 operation dispatch3655/3692 and closure4409 must explicitly bind it. A distinct
stopped proof must be dispatched consistently at prepare3688, terminal4482,
quarantine4607 and erase4687. Keep historical exact schemas unchanged.
