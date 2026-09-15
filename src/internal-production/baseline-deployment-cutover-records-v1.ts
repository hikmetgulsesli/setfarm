import path from "node:path";
import { types } from "node:util";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";

// Historical commitments only. No filesystem, process, launcher or admission IO.
export type DeploymentCutoverBuildV1 = Readonly<{
  checkoutPath: string; checkoutDirectoryIdentityHash: string;
  sourceSha: string; sourceTreeHash: string; buildHash: string;
}>;
export type DeploymentCutoverIntentV1 = Readonly<{
  schema: "setfarm.internal-production-deployment-cutover-intent.v1";
  purpose: "preserved-deployment-cutover";
  oldDeployment: DeploymentCutoverBuildV1; newDeployment: DeploymentCutoverBuildV1;
  cliLinkObservationHash: string; spawnerLauncherConfigurationHash: string;
  dashboardLauncherConfigurationHash: string; maintenanceIntentHash: string;
  dashboardPort: 3333; cutoverIntentRef: string; cutoverIntentHash: string;
}>;
const SCHEMA = "setfarm.internal-production-deployment-cutover-intent.v1";
const PURPOSE = "preserved-deployment-cutover";
const PREFIX = "setfarm://internal-production/deployment-cutover-intent/sha256/";
const COMMITMENTS = ["cliLinkObservationHash", "spawnerLauncherConfigurationHash", "dashboardLauncherConfigurationHash", "maintenanceIntentHash"] as const;
const INPUT_KEYS = ["oldDeployment", "newDeployment", ...COMMITMENTS, "dashboardPort"];
const BUILD_KEYS = ["checkoutPath", "checkoutDirectoryIdentityHash", "sourceSha", "sourceTreeHash", "buildHash"];
function fail(): never { throw Error("DEPLOYMENT_CUTOVER_INTENT_INVALID"); }

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value), actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key)
    || !descriptors[key]!.enumerable || !("value" in descriptors[key]!))) fail();
  return Object.fromEntries(keys.map(key => [key, descriptors[key]!.value as unknown]));
}
function hash(value: unknown, git = false): string {
  if (typeof value !== "string" || !(git ? /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/ : /^[a-f0-9]{64}$/).test(value)) fail();
  return value;
}
function build(value: unknown): DeploymentCutoverBuildV1 {
  const record = exact(value, BUILD_KEYS), checkoutPath = record.checkoutPath;
  if (typeof checkoutPath !== "string" || Buffer.byteLength(checkoutPath) > 1024 || checkoutPath === "/"
    || !path.posix.isAbsolute(checkoutPath) || path.posix.normalize(checkoutPath) !== checkoutPath
    || checkoutPath.split("/").slice(1).some(segment => !/^[A-Za-z0-9._-]+$/.test(segment) || [".", ".."].includes(segment))) fail();
  return Object.freeze({ checkoutPath, checkoutDirectoryIdentityHash: hash(record.checkoutDirectoryIdentityHash),
    sourceSha: hash(record.sourceSha, true), sourceTreeHash: hash(record.sourceTreeHash, true), buildHash: hash(record.buildHash) });
}

export function createDeploymentCutoverIntentV1(input: unknown): DeploymentCutoverIntentV1 {
  const record = exact(input, INPUT_KEYS);
  const oldDeployment = build(record.oldDeployment), newDeployment = build(record.newDeployment);
  if (record.dashboardPort !== 3333 || oldDeployment.checkoutPath === newDeployment.checkoutPath) fail();
  const body = { schema: SCHEMA, purpose: PURPOSE, oldDeployment, newDeployment,
    cliLinkObservationHash: hash(record.cliLinkObservationHash),
    spawnerLauncherConfigurationHash: hash(record.spawnerLauncherConfigurationHash),
    dashboardLauncherConfigurationHash: hash(record.dashboardLauncherConfigurationHash),
    maintenanceIntentHash: hash(record.maintenanceIntentHash), dashboardPort: 3333 } as const;
  const cutoverIntentHash = hashCanonicalJson(body);
  return Object.freeze({ ...body, cutoverIntentHash, cutoverIntentRef: PREFIX + cutoverIntentHash });
}

function validate(value: unknown): DeploymentCutoverIntentV1 {
  const record = exact(value, [...INPUT_KEYS, "schema", "purpose", "cutoverIntentRef", "cutoverIntentHash"]);
  if (record.schema !== SCHEMA || record.purpose !== PURPOSE) fail();
  const expected = createDeploymentCutoverIntentV1(Object.fromEntries(INPUT_KEYS.map(key => [key, record[key]])));
  if (record.cutoverIntentHash !== expected.cutoverIntentHash || record.cutoverIntentRef !== expected.cutoverIntentRef) fail();
  return expected;
}

export function encodeDeploymentCutoverIntentV1(record: unknown): Buffer {
  const bytes = Buffer.from(`${canonicalJsonStringify(validate(record))}\n`);
  if (bytes.length > 65536) fail();
  return bytes;
}

export function parseDeploymentCutoverIntentV1(bytes: Buffer): DeploymentCutoverIntentV1 {
  if (types.isProxy(bytes) || !types.isUint8Array(bytes) || !Buffer.isBuffer(bytes)) fail();
  const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length")!.get!.call(bytes) as number;
  if (length === 0 || length > 65536) fail();
  const owned = Buffer.alloc(length);
  Uint8Array.prototype.set.call(owned, bytes);
  let parsed: unknown;
  try { parsed = JSON.parse(owned.toString("utf8")); } catch { fail(); }
  const record = validate(parsed);
  if (!owned.equals(encodeDeploymentCutoverIntentV1(record))) fail();
  return record;
}

export type DeploymentCutoverMaintenanceIntentV1 = Readonly<{
  schema: "setfarm.internal-production-deployment-cutover-maintenance-intent.v1";
  purpose: "preserved-deployment-cutover"; controllerSourceHash: string;
  cutoverPlanHash: string; maintenanceIntentRef: string; maintenanceIntentHash: string;
}>;
const MAINTENANCE_SCHEMA = "setfarm.internal-production-deployment-cutover-maintenance-intent.v1";
const MAINTENANCE_PREFIX = "setfarm://internal-production/deployment-cutover-maintenance-intent/sha256/";
const PLAN_KEYS = ["oldDeployment", "newDeployment", "cliLinkObservationHash", "spawnerLauncherConfigurationHash", "dashboardLauncherConfigurationHash", "dashboardPort"];

function cutoverPlanHashV1(input: unknown): string {
  const record = exact(input, PLAN_KEYS);
  const oldDeployment = build(record.oldDeployment), newDeployment = build(record.newDeployment);
  if (record.dashboardPort !== 3333 || oldDeployment.checkoutPath === newDeployment.checkoutPath) fail();
  return hashCanonicalJson({ schema: "setfarm.internal-production-deployment-cutover-plan.v1",
    oldDeployment, newDeployment, cliLinkObservationHash: hash(record.cliLinkObservationHash),
    spawnerLauncherConfigurationHash: hash(record.spawnerLauncherConfigurationHash),
    dashboardLauncherConfigurationHash: hash(record.dashboardLauncherConfigurationHash), dashboardPort: 3333 });
}
function maintenanceFromHashesV1(controllerSourceHash: unknown, cutoverPlanHash: unknown): DeploymentCutoverMaintenanceIntentV1 {
  const body = { schema: MAINTENANCE_SCHEMA, purpose: PURPOSE,
    controllerSourceHash: hash(controllerSourceHash), cutoverPlanHash: hash(cutoverPlanHash) } as const;
  const maintenanceIntentHash = hashCanonicalJson(body);
  return Object.freeze({ ...body, maintenanceIntentHash, maintenanceIntentRef: MAINTENANCE_PREFIX + maintenanceIntentHash });
}

// Cutover-specific historical commitment, never archive-disposal authority.
// Excluding the maintenance/self pairs from the plan avoids a hash cycle.
export function createDeploymentCutoverMaintenanceIntentV1(input: unknown): DeploymentCutoverMaintenanceIntentV1 {
  const record = exact(input, ["controllerSourceHash", "plan"]);
  return maintenanceFromHashesV1(record.controllerSourceHash, cutoverPlanHashV1(record.plan));
}
function validateMaintenanceV1(input: unknown): DeploymentCutoverMaintenanceIntentV1 {
  const record = exact(input, ["schema", "purpose", "controllerSourceHash", "cutoverPlanHash", "maintenanceIntentHash", "maintenanceIntentRef"]);
  if (record.schema !== MAINTENANCE_SCHEMA || record.purpose !== PURPOSE) fail();
  const expected = maintenanceFromHashesV1(record.controllerSourceHash, record.cutoverPlanHash);
  if (record.maintenanceIntentHash !== expected.maintenanceIntentHash || record.maintenanceIntentRef !== expected.maintenanceIntentRef) fail();
  return expected;
}
export function encodeDeploymentCutoverMaintenanceIntentV1(input: unknown): Buffer {
  return Buffer.from(`${canonicalJsonStringify(validateMaintenanceV1(input))}\n`);
}
export function parseDeploymentCutoverMaintenanceIntentV1(bytes: Buffer): DeploymentCutoverMaintenanceIntentV1 {
  if (types.isProxy(bytes) || !types.isUint8Array(bytes) || !Buffer.isBuffer(bytes)) fail();
  const length = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length")!.get!.call(bytes) as number;
  if (length === 0 || length > 65536) fail();
  const owned = Buffer.alloc(length);
  Uint8Array.prototype.set.call(owned, bytes);
  let parsed: unknown;
  try { parsed = JSON.parse(owned.toString("utf8")); } catch { fail(); }
  const record = validateMaintenanceV1(parsed);
  if (!owned.equals(encodeDeploymentCutoverMaintenanceIntentV1(record))) fail();
  return record;
}

// Relation validation is not current source, process, exclusion or service IO.
export function assertDeploymentCutoverMaintenanceRelationV1(input: unknown): void {
  const record = exact(input, ["cutover", "maintenance", "controllerSourceHash"]);
  const cutover = validate(record.cutover), maintenance = validateMaintenanceV1(record.maintenance);
  const plan = Object.fromEntries(PLAN_KEYS.map(key => [key, cutover[key as keyof DeploymentCutoverIntentV1]]));
  if (maintenance.controllerSourceHash !== hash(record.controllerSourceHash)
    || maintenance.cutoverPlanHash !== cutoverPlanHashV1(plan)
    || maintenance.maintenanceIntentHash !== cutover.maintenanceIntentHash) fail();
}
