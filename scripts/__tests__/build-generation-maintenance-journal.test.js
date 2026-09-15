import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createMaintenanceIntentV1, createMaintenanceOwnerClaimV1, encodeMaintenanceJournalRecordV1, parseMaintenanceOwnerHistoryV1 } from "../build-generation-maintenance-journal.mjs";

const hashes = ["a", "b", "c", "d", "e", "f"].map(value => value.repeat(64));
const input = { candidateCompletionHash: hashes[0], controllerSourceHash: hashes[1], retainedBuildHash: hashes[2], launcherConfigurationHash: hashes[3] };
const owner = { uid: 501, pid: 1234, processLstart: "Tue Sep 15 08:00:00 2026", processGroupId: 1234,
  bootSessionHash: hashes[4], reservationNonce: "10000000-0000-4000-8000-000000000001" };
const nextOwner = { ...owner, pid: 2345, processGroupId: 2345, processLstart: "Tue Sep 15 08:01:00 2026",
  reservationNonce: "20000000-0000-4000-8000-000000000002" };
const encode = encodeMaintenanceJournalRecordV1;

test("owner restart preserves intent and links predecessor plus death evidence", () => {
  const intent = createMaintenanceIntentV1(input);
  const first = createMaintenanceOwnerClaimV1(intent, owner);
  const second = createMaintenanceOwnerClaimV1(intent, nextOwner, first, hashes[5]);
  const history = parseMaintenanceOwnerHistoryV1(encode(intent), [first, second].map(encode));
  assert.equal(history.intent.maintenanceIntentHash, intent.maintenanceIntentHash);
  assert.equal(history.claims[1].previousOwnerClaimHash, first.ownerClaimHash);
  assert.equal(history.claims[1].previousOwnerDeathObservationHash, hashes[5]);
  assert.equal(history.claims[1].ordinal, 2);
  assert.deepEqual(Object.keys(history).sort(), ["claims", "intent"]);
  assert.ok(Object.isFrozen(history.claims[1].owner));
});

test("successor claim cannot omit previous owner death commitment", () => {
  const intent = createMaintenanceIntentV1(input), first = createMaintenanceOwnerClaimV1(intent, owner);
  assert.throws(() => createMaintenanceOwnerClaimV1(intent, nextOwner, first), /MAINTENANCE_JOURNAL/);
  assert.throws(() => createMaintenanceOwnerClaimV1(intent, owner, null, hashes[5]), /MAINTENANCE_JOURNAL/);
});

test("same process birth cannot mint a replacement owner with a different nonce", () => {
  const intent = createMaintenanceIntentV1(input), first = createMaintenanceOwnerClaimV1(intent, owner);
  assert.throws(() => createMaintenanceOwnerClaimV1(intent, { ...owner, reservationNonce: nextOwner.reservationNonce }, first, hashes[5]), /MAINTENANCE_JOURNAL/);
});

test("claims cannot cross intents or reorder history", () => {
  const intent = createMaintenanceIntentV1(input), first = createMaintenanceOwnerClaimV1(intent, owner);
  const other = createMaintenanceIntentV1({ ...input, candidateCompletionHash: hashes[5] });
  const second = createMaintenanceOwnerClaimV1(intent, nextOwner, first, hashes[5]);
  assert.throws(() => createMaintenanceOwnerClaimV1(other, nextOwner, first, hashes[5]), /MAINTENANCE_JOURNAL/);
  assert.throws(() => parseMaintenanceOwnerHistoryV1(encode(other), [encode(first)]), /MAINTENANCE_JOURNAL/);
  assert.throws(() => parseMaintenanceOwnerHistoryV1(encode(intent), [encode(second), encode(first)]), /MAINTENANCE_JOURNAL/);
  assert.throws(() => parseMaintenanceOwnerHistoryV1(encode(intent), [encode(second)]), /MAINTENANCE_JOURNAL/);
});

test("tampered or noncanonical record bytes refuse", () => {
  const intent = createMaintenanceIntentV1(input), first = createMaintenanceOwnerClaimV1(intent, owner);
  assert.throws(() => parseMaintenanceOwnerHistoryV1(encode(intent), [Buffer.from(JSON.stringify({ ...first, ordinal: 2 }))]), /MAINTENANCE_JOURNAL/);
  assert.throws(() => parseMaintenanceOwnerHistoryV1(Buffer.from(JSON.stringify(intent, null, 2)), []), /MAINTENANCE_JOURNAL/);
  assert.throws(() => parseMaintenanceOwnerHistoryV1(Buffer.alloc(65537), []), /MAINTENANCE_JOURNAL/);
  assert.throws(() => parseMaintenanceOwnerHistoryV1(encode(intent), Array(4097).fill(encode(first))), /MAINTENANCE_JOURNAL/);
});

test("rejects malformed owner and unrecognized fields", () => {
  const intent = createMaintenanceIntentV1(input);
  for (const invalid of [{ ...owner, pid: 0 }, { ...owner, uid: -1 }, { ...owner, processLstart: "now" },
    { ...owner, reservationNonce: "arbitrary" }, { ...owner, extra: true }]) {
    assert.throws(() => createMaintenanceOwnerClaimV1(intent, invalid), /MAINTENANCE_JOURNAL/);
  }
  assert.throws(() => createMaintenanceIntentV1({ ...input, extra: true }), /MAINTENANCE_JOURNAL/);
});

test("record owns a frozen copy rather than a caller-mutable owner", () => {
  const intent = createMaintenanceIntentV1(input), mutable = { ...owner };
  const first = createMaintenanceOwnerClaimV1(intent, mutable);
  mutable.pid = 9000;
  assert.equal(first.owner.pid, 1234);
  assert.throws(() => { first.owner.pid = 9000; }, TypeError);
  assert.equal(parseMaintenanceOwnerHistoryV1(encode(intent), [encode(first)]).claims[0].owner.pid, 1234);
});

test("rejects accessor-backed input before signing an inconsistent intent", () => {
  let reads = 0;
  const unstable = { ...input };
  Object.defineProperty(unstable, "candidateCompletionHash", { enumerable: true,
    get: () => ++reads === 1 ? hashes[0] : "not-a-hash" });
  assert.throws(() => createMaintenanceIntentV1(unstable), /MAINTENANCE_JOURNAL/);
  assert.equal(reads, 0, "journal inputs must be data records, not executed accessors");
});

test("correctly hashed structural contradictions still refuse", () => {
  const intent = createMaintenanceIntentV1(input), first = createMaintenanceOwnerClaimV1(intent, owner);
  const second = createMaintenanceOwnerClaimV1(intent, nextOwner, first, hashes[5]);
  const canonicalFixture = value => value === null || typeof value !== "object" ? JSON.stringify(value)
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalFixture(value[key])}`).join(",")}}`;
  const rehash = record => {
    const { ownerClaimRef, ownerClaimHash, ...body } = record;
    const digest = createHash("sha256").update(canonicalFixture(body)).digest("hex");
    return Buffer.from(`${canonicalFixture({ ...body, ownerClaimHash: digest,
      ownerClaimRef: `setfarm://build-generation-maintenance/owner-claim/sha256/${digest}` })}\n`);
  };
  for (const invalid of [{ ...first, ordinal: 0 }, { ...first, ordinal: 4097 },
    { ...first, previousOwnerClaimHash: hashes[5] }, { ...first, previousOwnerDeathObservationHash: hashes[5] }]) {
    assert.throws(() => parseMaintenanceOwnerHistoryV1(encode(intent), [rehash(invalid)]), /MAINTENANCE_JOURNAL/);
  }
  assert.throws(() => parseMaintenanceOwnerHistoryV1(encode(intent), [encode(first),
    rehash({ ...second, previousOwnerClaimHash: hashes[0] })]), /MAINTENANCE_JOURNAL/);
});
