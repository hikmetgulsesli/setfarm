import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import * as records from "../../src/internal-production/baseline-deployment-cutover-records-v1.js";

const controllerSourceHash = "8".repeat(64);
const plan = () => ({
  oldDeployment: { checkoutPath: "/fixture/old", checkoutDirectoryIdentityHash: "a".repeat(64), sourceSha: "b".repeat(40), sourceTreeHash: "c".repeat(40), buildHash: "d".repeat(64) },
  newDeployment: { checkoutPath: "/fixture/new", checkoutDirectoryIdentityHash: "e".repeat(64), sourceSha: "f".repeat(40), sourceTreeHash: "1".repeat(40), buildHash: "2".repeat(64) },
  cliLinkObservationHash: "3".repeat(64), spawnerLauncherConfigurationHash: "4".repeat(64),
  dashboardLauncherConfigurationHash: "5".repeat(64), dashboardPort: 3333,
});
const canonical = (value: any): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash = (value: unknown): string => createHash("sha256").update(canonical(value)).digest("hex");
function independentWire(): Buffer {
  const body = { schema: "setfarm.internal-production-deployment-cutover-maintenance-intent.v1",
    purpose: "preserved-deployment-cutover", controllerSourceHash,
    cutoverPlanHash: hash({ schema: "setfarm.internal-production-deployment-cutover-plan.v1", ...plan() }) };
  const maintenanceIntentHash = hash(body);
  return Buffer.from(canonical({ ...body, maintenanceIntentHash,
    maintenanceIntentRef: `setfarm://internal-production/deployment-cutover-maintenance-intent/sha256/${maintenanceIntentHash}` }) + "\n");
}

test("cutover maintenance commits its plan and controller without an archive candidate", () => {
  const input = { controllerSourceHash, plan: plan() };
  const maintenance = records.createDeploymentCutoverMaintenanceIntentV1(input);
  assert.deepEqual(records.encodeDeploymentCutoverMaintenanceIntentV1(maintenance), independentWire());
  assert.deepEqual(records.parseDeploymentCutoverMaintenanceIntentV1(independentWire()), maintenance);
  const cutover = records.createDeploymentCutoverIntentV1({ ...plan(), maintenanceIntentHash: maintenance.maintenanceIntentHash });
  assert.doesNotThrow(() => records.assertDeploymentCutoverMaintenanceRelationV1({ cutover, maintenance, controllerSourceHash }));
  input.plan.newDeployment.checkoutPath = "/fixture/changed";
  assert.deepEqual(records.encodeDeploymentCutoverMaintenanceIntentV1(maintenance), independentWire());
  assert.ok(Object.isFrozen(maintenance));
});

test("cutover maintenance rejects every crossed plan and controller commitment", () => {
  const maintenance = records.createDeploymentCutoverMaintenanceIntentV1({ controllerSourceHash, plan: plan() });
  const original = records.createDeploymentCutoverIntentV1({ ...plan(), maintenanceIntentHash: maintenance.maintenanceIntentHash });
  for (const changes of [
    ...["cliLinkObservationHash", "spawnerLauncherConfigurationHash", "dashboardLauncherConfigurationHash", "maintenanceIntentHash"].map(key => ({ [key]: "9".repeat(64) })),
    ...(["oldDeployment", "newDeployment"] as const).flatMap(side => [
      { [side]: { ...plan()[side], checkoutPath: `/fixture/${side}-crossed` } },
      ...["checkoutDirectoryIdentityHash", "buildHash"].map(key => ({ [side]: { ...plan()[side], [key]: "9".repeat(64) } })),
      ...["sourceSha", "sourceTreeHash"].map(key => ({ [side]: { ...plan()[side], [key]: "9".repeat(40) } })),
    ]),
  ]) {
    const cutover = records.createDeploymentCutoverIntentV1({ ...plan(), maintenanceIntentHash: maintenance.maintenanceIntentHash, ...changes });
    assert.throws(() => records.assertDeploymentCutoverMaintenanceRelationV1({ cutover, maintenance, controllerSourceHash }), /DEPLOYMENT_CUTOVER/);
  }
  assert.throws(() => records.assertDeploymentCutoverMaintenanceRelationV1({ cutover: original, maintenance, controllerSourceHash: "0".repeat(64) }), /DEPLOYMENT_CUTOVER/);
  assert.throws(() => records.assertDeploymentCutoverMaintenanceRelationV1({ cutover: original, maintenance, controllerSourceHash, allowed: true }), /DEPLOYMENT_CUTOVER/);
});

test("cutover maintenance rejects archive grammar and noncanonical wire", () => {
  const maintenance = records.createDeploymentCutoverMaintenanceIntentV1({ controllerSourceHash, plan: plan() });
  for (const bytes of [Buffer.from("{}\n"), Buffer.concat([independentWire(), Buffer.from("\n")]), Buffer.alloc(65537),
    Buffer.from(JSON.stringify(maintenance, null, 2) + "\n"),
    Buffer.from(independentWire().toString().replace("setfarm.internal-production-deployment-cutover-maintenance-intent.v1", "setfarm.build-generation-maintenance-intent.v1"))]) {
    assert.throws(() => records.parseDeploymentCutoverMaintenanceIntentV1(bytes), /DEPLOYMENT_CUTOVER/);
  }
  for (const change of [{ maintenanceIntentHash: "0".repeat(64) }, { maintenanceIntentRef: "crossed" }, { candidateCompletionHash: "0".repeat(64) }]) {
    assert.throws(() => records.encodeDeploymentCutoverMaintenanceIntentV1({ ...maintenance, ...change }), /DEPLOYMENT_CUTOVER/);
  }
});

test("maintenance construction rejects authority seams and hostile object shapes without traps", () => {
  let traps = 0;
  const hostile = { controllerSourceHash, plan: plan() };
  Object.defineProperty(hostile.plan.newDeployment, "buildHash", { enumerable: true, get() { traps++; return "2".repeat(64); } });
  const proxy = new Proxy(plan(), { getPrototypeOf() { traps++; throw Error("PROXY_TRAP"); } });
  const revoked = Proxy.revocable(plan(), {}); revoked.revoke();
  for (const input of [hostile,
    { controllerSourceHash, plan: proxy }, { controllerSourceHash, plan: revoked.proxy },
    { controllerSourceHash, plan: { ...plan(), maintenanceIntentHash: "0".repeat(64) } },
    { controllerSourceHash, plan: { ...plan(), dashboardPort: 3334 } },
    { controllerSourceHash: "invalid", plan: plan() },
    { controllerSourceHash, plan: plan(), allowed: true }]) {
    assert.throws(() => records.createDeploymentCutoverMaintenanceIntentV1(input), /DEPLOYMENT_CUTOVER/);
  }
  assert.equal(traps, 0);
});

test("maintenance wire validation ignores caller Buffer methods and rejects proxy buffers", () => {
  let traps = 0;
  const valid = independentWire(), trap = () => { traps++; throw Error("BUFFER_TRAP"); };
  valid.toString = trap; valid.valueOf = trap;
  Object.defineProperty(valid, "length", { get: trap });
  assert.equal(records.parseDeploymentCutoverMaintenanceIntentV1(valid).controllerSourceHash, controllerSourceHash);
  const invalid = Buffer.concat([independentWire(), Buffer.from("\n")]);
  invalid.equals = () => true;
  assert.throws(() => records.parseDeploymentCutoverMaintenanceIntentV1(invalid), /DEPLOYMENT_CUTOVER/);
  const proxy = new Proxy(independentWire(), { get() { traps++; throw Error("BUFFER_PROXY_TRAP"); } });
  assert.throws(() => records.parseDeploymentCutoverMaintenanceIntentV1(proxy), /DEPLOYMENT_CUTOVER/);
  assert.equal(traps, 0);
});
