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

- [ ] Write independent canonical-wire fixtures, not factory-derived expected
  hashes; require deeply detached/frozen first and successor claims:

```ts
assert.equal(first.ordinal, 1);
assert.equal(first.previousOwnerClaimHash, null);
assert.equal(second.ordinal, 2);
assert.equal(second.previousOwnerClaimHash, first.ownerClaimHash);
assert.equal(history.claims.length, 2);
```

- [ ] Run RED, implement strict own-data/no-proxy snapshots and native owned
  Buffer parsing. Reuse existing maintenance validation, never archive codecs.
  Ordinals1..4096; first predecessor/death null; successor requires both hashes,
  exact previous hash/ordinal and unchanged maintenance identity. Same physical
  uid/pid/birth/boot owner cannot mint a successor with only a fresh nonce.
- [ ] Test crossed intent, missing/reordered predecessor, malformed owner, changed
  self-pair, noncanonical bytes, proxy/accessor traps and mutable input detachment.
- [ ] Run complete focused records suite, noemit/contracts, independent review
  and checkpoint. These records remain historical, not ownership capability.

## Task2: fixed immutable owner store

**Files:** Create `src/internal-production/baseline-deployment-cutover-owner-store-v1.ts`
and corresponding `tests/internal-production/baseline-deployment-cutover-owner-store-v1.test.ts`.

**Interface:** fixed-root internal `observeDeploymentCutoverOwnerHistoryV1()` and
`publishDeploymentCutoverOwnerClaimV1(maintenance,claim)` returning only validated
physical observations, never effect capabilities. No arbitrary directory input.

- [ ] Write physical fixtures for first intent/owner publication, matching replay,
  conflicting ordinal and concurrent no-replace contenders. Assert exactly one
  committed ordinal and preserve all foreign evidence:

```ts
assert.equal(committedClaims.length, 1);
assert.equal(new Set(winningOwnerPids).size, 1);
assert.deepEqual(foreignBytesAfter, foreignBytesBefore);
```

- [ ] RED then implement held ancestors, owner700/files600, exact names/caps,
  bounded no-follow reads, staged fsync/readback/no-replace link/directory sync.
  Reuse reviewed publication mechanics, not archive historical grammar. Matching
  replay must fsync file and ancestor directories, not just assume durability.
- [ ] Fault-inject every publication edge, file/ancestor swaps, short writes,
  response loss and descriptor reuse. Partial or uncertain state cannot return
  a finalized observation; no cleanup of foreign/ambiguous stage is inferred.
- [ ] Review, focused tests/noemit/contracts and checkpoint storage-only unit.

## Task3: process-local current owner capability

**Files:** Create `scripts/deployment-cutover-owner.mjs` and
`scripts/__tests__/deployment-cutover-owner.test.js`.

**Interface:** `acquireDeploymentCutoverOwnerV1(maintenance)` and
`assertDeploymentCutoverOwnerV1(capability)`. Dynamically load finalized compiled
cutover store/codecs from the controller's authenticated checkout. Reuse existing
`observeCurrentMaintenanceOwnerV1` and `observeMaintenanceOwnerProcessV1`.
Opaque capabilities live only in a module-private WeakMap.

- [ ] Write real competing child-process fixtures. A loser, forged object,
  transferred serialization, stale tip or crossed physical store must fail:

```js
assert.throws(() => assertDeploymentCutoverOwnerV1({...capability}));
assert.equal(successfulControllerCount, 1);
assert.equal(serviceEffectCount, 0);
```

- [ ] RED then acquire current owner identity with fresh nonce, publish first
  claim or same-process exact replay, and reobserve winning tip/physical store/
  current process before creating capability. Fresh successor only after the
  previous owner is definitely dead; live/reused/ambiguous identity refuses.
- [ ] Assert capability before each future side effect and after awaits; assert
  again after external helper completion. A child helper surviving owner death
  requires separate family quiescence before recovery effects.
- [ ] Exercise crash before/after publication, response loss, live owner conflict,
  PID reuse and reboot observation. Preserve history, invalidate uncertain handles
  and prove no spawner singleton is created. Review and qualify before integration.

## Integration remains mandatory

No live service operations are enabled by these tasks alone. Controller preflight
must authenticate source/build, maintenance relation, durable ordinary refusal,
zero-owner runtime and exact service families under the current owner capability.
Journaled launcher/link effects, crash recovery and ready-bound completion still
need their own complete integration tests before real cutover.
