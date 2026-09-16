import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import * as module from "../../src/internal-production/baseline-deployment-cutover-records-v1.js";
const records = module as any;
const canonical = (value: any): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const owner = (pid = 4101) => ({ uid: 501, pid, processLstart: "Wed Sep 16 01:02:03 2026", processGroupId: pid,
  bootSessionHash: "a".repeat(64), reservationNonce: "12345678-1234-4234-8234-123456789abc" });
function maintenance() {
  const body = { schema: "setfarm.internal-production-deployment-cutover-maintenance-intent.v1", purpose: "preserved-deployment-cutover",
    controllerSourceHash: "b".repeat(64), cutoverPlanHash: "c".repeat(64) };
  const maintenanceIntentHash = hash(body);
  return { ...body, maintenanceIntentHash, maintenanceIntentRef: `setfarm://internal-production/deployment-cutover-maintenance-intent/sha256/${maintenanceIntentHash}` };
}
const wire = (value: unknown) => Buffer.from(canonical(value) + "\n");
function signedOwner(input: { owner?: unknown; ordinal?: number; previousOwnerClaimHash?: string | null; previousOwnerDeathObservationHash?: string | null; maintenanceIntentHash?: string } = {}) {
  const body = { schema: "setfarm.internal-production-deployment-cutover-owner-claim.v1", maintenanceIntentHash: maintenance().maintenanceIntentHash,
    ordinal: 1, previousOwnerClaimHash: null, previousOwnerDeathObservationHash: null, owner: owner(), ...input };
  const ownerClaimHash = hash(body);
  return { ...body, ownerClaimHash, ownerClaimRef: `setfarm://internal-production/deployment-cutover-owner-claim/sha256/${ownerClaimHash}` };
}

test("first cutover owner claim matches independently signed historical bytes", () => {
  const input = { maintenance: maintenance(), owner: owner(), previous: null, previousOwnerDeathObservationHash: null };
  const claim = records.createDeploymentCutoverOwnerClaimV1(input);
  assert.deepEqual(records.encodeDeploymentCutoverOwnerClaimV1(claim), wire(signedOwner()));
  const history = records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), [wire(signedOwner())]);
  assert.deepEqual(history.claims, [claim]); assert.equal(history.maintenance.maintenanceIntentHash, maintenance().maintenanceIntentHash);
  input.owner.pid = 9999;
  assert.equal(claim.owner.pid, 4101); assert.ok(Object.isFrozen(claim.owner)); assert.ok(Object.isFrozen(history.claims));
});

test("successor cutover owner binds exact predecessor and historical death commitment", () => {
  const first = signedOwner(), death = "d".repeat(64);
  const expected = signedOwner({ owner: owner(4102), ordinal: 2, previousOwnerClaimHash: first.ownerClaimHash, previousOwnerDeathObservationHash: death });
  const second = records.createDeploymentCutoverOwnerClaimV1({ maintenance: maintenance(), owner: owner(4102), previous: first, previousOwnerDeathObservationHash: death });
  assert.deepEqual(records.encodeDeploymentCutoverOwnerClaimV1(second), wire(expected));
  assert.equal(records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), [wire(first), wire(expected)]).claims.length, 2);
  for (const bytes of [[wire(expected)], [wire(expected), wire(first)], [wire(first), wire(first)],
    [wire(first), wire(signedOwner({ owner: owner(4102), ordinal: 2, previousOwnerClaimHash: "e".repeat(64), previousOwnerDeathObservationHash: death }))]]) {
    assert.throws(() => records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), bytes), /DEPLOYMENT_CUTOVER/);
  }
});

test("owner history rejects independently rehashed gaps crossed maintenance and self-pair drift", () => {
  const first = signedOwner();
  for (const bad of [
    signedOwner({ owner: owner(4102), ordinal: 3, previousOwnerClaimHash: first.ownerClaimHash, previousOwnerDeathObservationHash: "d".repeat(64) }),
    signedOwner({ owner: owner(4102), ordinal: 2, previousOwnerClaimHash: first.ownerClaimHash, previousOwnerDeathObservationHash: "d".repeat(64), maintenanceIntentHash: "f".repeat(64) }),
    { ...first, ownerClaimHash: "f".repeat(64) }, { ...first, ownerClaimRef: "crossed" },
  ]) assert.throws(() => records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), [wire(first), wire(bad)]), /DEPLOYMENT_CUTOVER/);
  assert.deepEqual(records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), []).claims, []);
});

test("owner histories enforce the bounded ordinal domain without accepting sparse arrays", () => {
  for (const ordinal of [0, 4097, 1.5]) {
    assert.throws(() => records.encodeDeploymentCutoverOwnerClaimV1(signedOwner({ ordinal })), /DEPLOYMENT_CUTOVER/);
  }
  for (const claims of [Array(1), Array(4097).fill(wire(signedOwner()))]) {
    assert.throws(() => records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), claims), /DEPLOYMENT_CUTOVER/);
  }
  const last = signedOwner({ ordinal: 4096, previousOwnerClaimHash: "e".repeat(64), previousOwnerDeathObservationHash: "d".repeat(64) });
  assert.throws(() => records.createDeploymentCutoverOwnerClaimV1({ maintenance: maintenance(), owner: owner(4102), previous: last, previousOwnerDeathObservationHash: "d".repeat(64) }), /DEPLOYMENT_CUTOVER/);
});

test("owner wire parsing uses native bytes and rejects proxies without executing traps", () => {
  let traps = 0; const trap = () => { traps++; throw Error("BUFFER_TRAP"); };
  const bytes = wire(signedOwner()); bytes.toString = trap; Object.defineProperty(bytes, "length", { get: trap });
  assert.equal(records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), [bytes]).claims[0].owner.pid, 4101);
  const proxy = new Proxy(wire(signedOwner()), { get: trap });
  assert.throws(() => records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), [proxy]), /DEPLOYMENT_CUTOVER/);
  const arrayProxy = new Proxy([], { get: trap, getPrototypeOf: trap });
  assert.throws(() => records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), arrayProxy), /DEPLOYMENT_CUTOVER/);
  assert.equal(traps, 0);
});

test("owner claims reject crossed maintenance and nonce-only same-process succession", () => {
  const first = signedOwner();
  for (const input of [
    { maintenance: maintenance(), owner: owner(), previous: first, previousOwnerDeathObservationHash: "d".repeat(64) },
    { maintenance: maintenance(), owner: { ...owner(), reservationNonce: "87654321-1234-4234-8234-123456789abc" }, previous: first, previousOwnerDeathObservationHash: "d".repeat(64) },
    { maintenance: maintenance(), owner: owner(4102), previous: first, previousOwnerDeathObservationHash: null },
    { maintenance: maintenance(), owner: owner(), previous: null, previousOwnerDeathObservationHash: "d".repeat(64) },
    { maintenance: maintenance(), owner: owner(4102), previous: signedOwner({ maintenanceIntentHash: "f".repeat(64) }), previousOwnerDeathObservationHash: "d".repeat(64) },
  ]) assert.throws(() => records.createDeploymentCutoverOwnerClaimV1(input), /DEPLOYMENT_CUTOVER/);
});

test("owner history rejects noncanonical bytes and hostile inputs without invoking traps", () => {
  let traps = 0; const trap = () => { traps++; throw Error("TRAP"); };
  const badOwner = owner(); Object.defineProperty(badOwner, "pid", { enumerable: true, get: trap });
  const proxy = new Proxy(owner(), { getPrototypeOf: trap });
  for (const candidate of [badOwner, proxy, { ...owner(), pid: 0 }, { ...owner(), uid: -1 }, { ...owner(), processGroupId: 0 },
    { ...owner(), processLstart: "invalid" }, { ...owner(), bootSessionHash: "bad" }, { ...owner(), reservationNonce: "bad" }]) {
    assert.throws(() => records.createDeploymentCutoverOwnerClaimV1({ maintenance: maintenance(), owner: candidate, previous: null, previousOwnerDeathObservationHash: null }), /DEPLOYMENT_CUTOVER/);
  }
  const list = [wire(signedOwner())]; Object.defineProperty(list, "0", { get: trap });
  assert.throws(() => records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), list), /DEPLOYMENT_CUTOVER/);
  for (const bytes of [Buffer.from(JSON.stringify(signedOwner(), null, 2) + "\n"), Buffer.concat([wire(signedOwner()), Buffer.from("\n")]), Buffer.alloc(65537)]) {
    assert.throws(() => records.parseDeploymentCutoverOwnerHistoryV1(wire(maintenance()), [bytes]), /DEPLOYMENT_CUTOVER/);
  }
  assert.equal(traps, 0);
});
