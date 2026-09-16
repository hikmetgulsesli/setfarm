import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createDeploymentCutoverIntentV1, encodeDeploymentCutoverIntentV1, parseDeploymentCutoverIntentV1 } from "../../src/internal-production/baseline-deployment-cutover-records-v1.js";

const input = () => ({
  oldDeployment: { checkoutPath: "/fixture/old", checkoutDirectoryIdentityHash: "a".repeat(64),
    sourceSha: "b".repeat(40), sourceTreeHash: "c".repeat(40), buildHash: "d".repeat(64) },
  newDeployment: { checkoutPath: "/fixture/new", checkoutDirectoryIdentityHash: "e".repeat(64),
    sourceSha: "f".repeat(40), sourceTreeHash: "1".repeat(40), buildHash: "2".repeat(64) },
  cliLinkObservationHash: "3".repeat(64), spawnerLauncherConfigurationHash: "4".repeat(64),
  dashboardLauncherConfigurationHash: "5".repeat(64), maintenanceIntentHash: "6".repeat(64), dashboardPort: 3333,
});
const canonical = (value: any): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
function signedBytes(body: Record<string, unknown>): Buffer {
  const digest = createHash("sha256").update(canonical(body)).digest("hex");
  return Buffer.from(`${canonical({ ...body, cutoverIntentHash: digest,
    cutoverIntentRef: `setfarm://internal-production/deployment-cutover-intent/sha256/${digest}` })}\n`);
}

test("canonical intent preserves both deployment and launcher commitments", () => {
  const record = createDeploymentCutoverIntentV1(input());
  assert.equal(record.oldDeployment.checkoutPath, "/fixture/old");
  assert.equal(record.newDeployment.buildHash, "2".repeat(64));
  assert.equal(record.dashboardPort, 3333);
  const bytes = encodeDeploymentCutoverIntentV1(record);
  assert.deepEqual(parseDeploymentCutoverIntentV1(bytes), record);
  assert.deepEqual(bytes, signedBytes({ ...input(), schema: "setfarm.internal-production-deployment-cutover-intent.v1", purpose: "preserved-deployment-cutover" }));
});

test("record owns frozen deployment snapshots", () => {
  const original = input(), record = createDeploymentCutoverIntentV1(original);
  original.newDeployment.checkoutPath = "/fixture/changed";
  assert.equal(record.newDeployment.checkoutPath, "/fixture/new");
  assert.ok(Object.isFrozen(record)); assert.ok(Object.isFrozen(record.newDeployment));
});

test("port changes and identical old/new roots refuse even with consistent hashes", () => {
  for (const update of [{ dashboardPort: 3334 }, { newDeployment: input().oldDeployment }]) {
    const body = { ...input(), ...update };
    assert.throws(() => createDeploymentCutoverIntentV1(body), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
    assert.throws(() => parseDeploymentCutoverIntentV1(signedBytes({ ...body,
      schema: "setfarm.internal-production-deployment-cutover-intent.v1", purpose: "preserved-deployment-cutover" })), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  }
});

test("unsafe root locators and malformed commitments refuse", () => {
  for (const checkoutPath of ["/", "relative", "/fixture/../new", "/fixture//new", "/fixture/new/", "/fixture/new\n", "/" + "a".repeat(1024)]) {
    assert.throws(() => createDeploymentCutoverIntentV1({ ...input(), newDeployment: { ...input().newDeployment, checkoutPath } }), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  }
  for (const field of ["sourceSha", "sourceTreeHash", "buildHash", "checkoutDirectoryIdentityHash"]) {
    assert.throws(() => createDeploymentCutoverIntentV1({ ...input(), newDeployment: { ...input().newDeployment, [field]: "BAD" } }), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  }
});

test("unknown fields and accessors refuse without getter execution", () => {
  assert.throws(() => createDeploymentCutoverIntentV1({ ...input(), bypass: true }), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  let reads = 0;
  const hostile = input();
  Object.defineProperty(hostile.newDeployment, "buildHash", { enumerable: true, get: () => { reads++; return "2".repeat(64); } });
  assert.throws(() => createDeploymentCutoverIntentV1(hostile), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  assert.equal(reads, 0);
});

test("tampered self pair and noncanonical or oversized bytes refuse", () => {
  const record = createDeploymentCutoverIntentV1(input()), bytes = encodeDeploymentCutoverIntentV1(record);
  assert.throws(() => encodeDeploymentCutoverIntentV1({ ...record, cutoverIntentHash: "0".repeat(64) }), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  assert.throws(() => encodeDeploymentCutoverIntentV1({ ...record, cutoverIntentRef: "crossed" }), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  for (const invalid of [Buffer.alloc(65537, 32), Buffer.from("{}\n"), Buffer.concat([bytes, Buffer.from("\n")]),
    Buffer.from(bytes.toString().replace('{', '{"dashboardPort":3333,')), Buffer.from(JSON.stringify(record, null, 2) + "\n")]) {
    assert.throws(() => parseDeploymentCutoverIntentV1(invalid), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  }
});

test("caller-owned Buffer methods cannot bypass canonical wire validation", () => {
  const bytes = Buffer.concat([encodeDeploymentCutoverIntentV1(createDeploymentCutoverIntentV1(input())), Buffer.from("\n")]);
  bytes.equals = () => true;
  assert.throws(() => parseDeploymentCutoverIntentV1(bytes), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  const valid = encodeDeploymentCutoverIntentV1(createDeploymentCutoverIntentV1(input()));
  let calls = 0;
  const trap = () => { calls++; throw Error("BUFFER_TRAP"); };
  valid.toString = trap; valid.valueOf = trap;
  Object.defineProperty(valid, "length", { get: trap });
  assert.equal(parseDeploymentCutoverIntentV1(valid).dashboardPort, 3333);
  assert.equal(calls, 0);
});

test("proxy and revoked proxy inputs refuse without invoking traps", () => {
  let traps = 0;
  const proxy = new Proxy(input(), { getPrototypeOf() { traps++; throw Error("TRAP_EXECUTED"); } });
  const revoked = Proxy.revocable(input(), {}); revoked.revoke();
  for (const value of [proxy, revoked.proxy, { ...input(), newDeployment: proxy }]) {
    assert.throws(() => createDeploymentCutoverIntentV1(value), /DEPLOYMENT_CUTOVER_INTENT_INVALID/);
  }
  assert.equal(traps, 0);
});
