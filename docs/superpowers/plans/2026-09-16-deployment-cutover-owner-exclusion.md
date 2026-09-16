# Deployment Cutover Owner Exclusion Implementation Plan

> **Execution:** Serialized primary-owner TDD and parallel read-only review.
> Continue the approved preserved-deployment design; no second writing branch.

**Goal:** Give the cutover controller recoverable single-writer ownership without
occupying the spawner singleton needed by unmodified cold preflight.

**Architecture:** A fixed sibling owner store carries cutover-specific maintenance
intent and append-only ordinal owner claims. No-replace publication chooses the
winner; a process-local capability requires the actual current process, stable
physical store and latest claim. Recovery appends only after fresh definite-death
evidence; no record is removed and no historical hash is treated as a live lease.

**Tech Stack:** Strict TypeScript codecs, physical immutable publication, existing
bounded boot/process observer and isolated competing-process fixtures.

**Spec:** `docs/superpowers/specs/2026-09-16-preserved-deployment-cutover-design.md`.

## Global constraints

- Preserve old deployment and all archives, fixed ports3080/3333/18789.
- Store fixed sibling `data/internal-production-baseline/deployment-cutover-owner-v1/`;
  ordinary-refusal root `deployment-cutover-v1/` still contains only intent.json.
- Never reuse the archive intent requiring candidateCompletionHash.
- No spawner.lock, caller-selected store, supplied PID, service effect or automatic
  deletion of losing/partial stages. Death alone does not prove helper quiescence.
- Acquiring controller ownership is not ordinary-spawner exclusion: durable
  refusal plus fresh runtime/family checks remain required before disruption.

## Task1: cutover-specific historical owner chain

**Files:** Modify `src/internal-production/baseline-deployment-cutover-records-v1.ts`;
create `tests/internal-production/baseline-deployment-cutover-owner-records-v1.test.ts`.

**Interface:** `createDeploymentCutoverOwnerClaimV1({maintenance,owner,previous,
previousOwnerDeathObservationHash})`, `encodeDeploymentCutoverOwnerClaimV1(claim)`,
`parseDeploymentCutoverOwnerHistoryV1(maintenanceBytes,claimBytes)`.
Owner fields are uid,pid,processLstart,processGroupId,bootSessionHash,reservationNonce.
Claim fields are schema,maintenanceIntentHash,ordinal,previousOwnerClaimHash,
previousOwnerDeathObservationHash,owner,ownerClaimRef,ownerClaimHash. Schema is
`setfarm.internal-production-deployment-cutover-owner-claim.v1`; pair prefix is
`setfarm://internal-production/deployment-cutover-owner-claim/sha256/`.

- [x] Write independent canonical-wire fixtures, not factory-derived expected
  hashes; require deeply detached/frozen first and successor claims:

```ts
assert.equal(first.ordinal, 1);
assert.equal(first.previousOwnerClaimHash, null);
assert.equal(second.ordinal, 2);
assert.equal(second.previousOwnerClaimHash, first.ownerClaimHash);
assert.equal(history.claims.length, 2);
```

- [x] Run RED, implement strict own-data/no-proxy snapshots and native owned
  Buffer parsing. Reuse existing maintenance validation, never archive codecs.
  Ordinals1..4096; first predecessor/death null; successor requires both hashes,
  exact previous hash/ordinal and unchanged maintenance identity. Same physical
  uid/pid/birth/boot owner cannot mint a successor with only a fresh nonce.
- [x] Test crossed intent, missing/reordered predecessor, malformed owner, changed
  self-pair, noncanonical bytes, proxy/accessor traps and mutable input detachment.
- [x] Run complete focused records suite, noemit/contracts and independent review.
- [x] Checkpoint Task1 at eff1eb72. These records remain historical, not ownership capability.

Task1 evidence: first4RED missing exports, then7 owner tests plus5 maintenance
tests passed12/12. Complete cutover suite151/151,zero skips14187.681042ms;
noemit0,English1515/path865. Independent review found no material issue.

## Task2: fixed immutable owner store

**Files:** Create `src/internal-production/baseline-deployment-cutover-owner-store-v1.ts`
and corresponding `tests/internal-production/baseline-deployment-cutover-owner-store-v1.test.ts`.

**Interface:** fixed-root internal `observeDeploymentCutoverOwnerHistoryV1()` and
`publishDeploymentCutoverOwnerClaimV1(maintenance,claim,expectedHistoryHash?)` returning only validated
physical observations, never effect capabilities. No arbitrary directory input.

- [x] Write physical fixtures for first intent/owner publication, matching replay,
  conflicting ordinal and concurrent no-replace contenders. Assert exactly one
  committed ordinal and preserve all foreign evidence:

```ts
assert.equal(committedClaims.length, 1);
assert.equal(new Set(winningOwnerPids).size, 1);
assert.deepEqual(foreignBytesAfter, foreignBytesBefore);
```

- [x] RED then implement held ancestors, owner700/files600, exact names/caps,
  bounded no-follow reads, staged fsync/readback/no-replace link/directory sync.
  Reuse reviewed publication mechanics, not archive historical grammar. Matching
  replay must fsync file and ancestor directories, not just assume durability.
- [x] Fault-inject publication/replay edges, file/ancestor swaps, short writes,
  response loss and descriptor reuse. Only committed fixed names contribute to
  history. A bounded, owner600, regular singly-linked staging file with a valid
  stage name is inert non-authority, whether complete or incomplete; preserve it
  and report its identity/hash/size separately. Stable inert stages do not defeat
  a fully validated committed tip or allow adoption of their proposed owner.
  A two-link stage is permitted only as the exact byte/inode alias of its
  committed destination; publication response-loss recovery must fsync the held
  file and directory before treating that fixed record as durable. Reject other
  link counts, crossed aliases, unexpected names, unsafe modes and changing
  stage metadata. Never delete a stage based on its mere presence or owner death.
  Cap inert stages at8; reaching the cap refuses new publication, not history
  reading. This preserves crash/loser evidence without a partial-write authority
  or a permanent first-loser veto. Uncertain current writes/close/fsync still
  return no new capability; a later fresh attempt must reauthenticate durability.
- [x] Review, focused tests/noemit/contracts and checkpoint storage-only unit.

Task2 implementation retains successful two-link stages as exact committed aliases;
it never removes stages. Observations hash-bind each file's identity, content hash,
byte length and classification (committed, inert-stage, committed-alias). Concurrent
changing inventories can make both contenders refuse; a quiescent fresh retry
must still complete without removing either contender's evidence.

TDD evidence: five initial missing-module failures; review regressions reproduced
crossed-maintenance root creation and predecessor replacement before successor
publication, then passed after pre-I/O binding and transaction-local committed
identity pins. Missing stage classification reproduced before adding explicit
observation fields. Focused store suite30/30,zero failures/skips14333.720042ms.
Seven targeted fault tests cover post-link intent/root sync, owner staging sync,
owner link response loss/root sync and owner replay file/root/baseline sync.
Independent final review found no remaining material issue. Complete cutover
verification passed181/181,zero failures/skips23461.354209ms; noemit0,
English1517/path866. Normal finalized build remains a clean-main delivery gate;
no dirty-build override or live owner publication was used.

## Task3: process-local current owner capability

**Files:** Create `scripts/deployment-cutover-owner.mjs` and
`scripts/__tests__/deployment-cutover-owner.test.js`.

**Interface:** `acquireDeploymentCutoverOwnerV1(maintenance)` and
`assertDeploymentCutoverOwnerV1(capability)`. Dynamically load finalized compiled
cutover store/codecs from the controller's authenticated checkout. Reuse existing
`observeCurrentMaintenanceOwnerV1` and `observeMaintenanceOwnerProcessV1`.
Opaque capabilities live only in a module-private WeakMap.
`observeDeploymentCutoverOwnerControllerSourceV1()` returns the code-relative
source commitment without acquiring an owner or writing the runtime store.

The owner unit is not an executable live controller. Its source commitment is
domain-separated over the exact clean source/build observation and sorted fixed
controller/helper file hashes, never simply the build hash. Pin the initial
physical files before dynamic imports and permanently compare against those
snapshots. Compiled imports have no source/tsx fallback. A fresh trusted controller
bootstrap must authenticate this module before loading it; reading a pathname
after arbitrary cached import does not prove already-loaded bytes. That bootstrap
and its cached-module/replacement integration tests are mandatory before live
effects; the owner unit alone must not be advertised as loaded-code authority.

There is exactly one in-process acquisition/workflow owner. Reserve that slot
before the first await or effect; every further public acquisition while active
refuses. Same-process exact replay is internal continuation of that acquisition,
never a second public handle. The eventual controller
must serialize its workflow entry as well as capability creation; assertion alone
cannot serialize two callers holding the same handle. Retain failed acquisition
state as uncertain until a fresh authenticated retry, never release via a generic
finally while asynchronous helpers may still execute.

- [x] Write real competing child-process fixtures. A loser, forged object,
  transferred serialization, stale tip or crossed physical store must fail:

```js
assert.throws(() => assertDeploymentCutoverOwnerV1({...capability}));
assert.equal(successfulControllerCount, 1);
assert.equal(serviceEffectCount, 0);
```

- [x] RED then acquire current owner identity with fresh nonce, publish first
  claim or same-process exact replay, and reobserve winning tip/physical store/
  current process before creating capability. Fresh successor only after the
  previous owner is definitely dead; live/reused/ambiguous identity refuses.
- [ ] Integrate capability before each future side effect and after awaits; assert
  again after external helper completion. A child helper surviving owner death
  requires separate family quiescence before recovery effects.
- [ ] Exercise crash before/after publication, response loss, live owner conflict,
  PID reuse and reboot observation. Preserve history, invalidate uncertain handles
  and prove no spawner singleton is created. Review and qualify before integration.

Task3 owner-unit evidence: initial4RED missing module; caller mutation across
await and same-root moved under a replacement baseline reproduced2RED then fixed.
Input is now detached strictly before the first await. Store observations bind
the full held ancestor projection, and the owner capability retains it.
Observation/publication transaction replacement reproduced a further RED; the
publisher now checks the expected committedHistoryHash under its own held pins
before writes, including expected absence before mkdir and competing EEXIST.
Independent review found those fixes complete with no further material finding.

The internal unit includes real live/exited/concurrent owners, transferred/forged
handles, PID reuse, actual child exit after owner link, inert stages, missing
compiled observer, ambiguous process and restored-after-drift rejection. The
private test build observer is explicitly a fixture, not finalized-build proof.
Full source/bootstrap replacement and live-effect integration are still required.
Complete cutover181/181,zero skips23500.24275ms; noemit0,English1519/path868.

Task3 checkpoint:6664fd45. Subsequent bootstrap qualification uses the real
plain-JS finalized source observer, not the eager compiled receipt dependency
graph. The source closure now binds bootstrap, retention verifier, owner, process
observer and journal normalizer. Bootstrap12 + owner20 + process-observer15 passed
47/47,zero skips15720.170125ms; cutover refresh181/181,zero skips21512.481083ms.
The trusted loading boundary is now tested with actual finalized-output fixtures
and load-time replacement markers. Live-effect integration remains outstanding.

## Integration remains mandatory

No live service operations are enabled by these tasks alone. Controller preflight
must authenticate source/build, maintenance relation, durable ordinary refusal,
zero-owner runtime and exact service families under the current owner capability.
Journaled launcher/link effects, crash recovery and ready-bound completion still
need their own complete integration tests before real cutover.
