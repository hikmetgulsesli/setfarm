import { userInfo } from "node:os";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { observePositiveWorktreePre32HostPairWithPortsV7 } from "./baseline-positive-worktree-host-pair-v2.js";
import { observeHeldPositiveWorktreePhysicalCatalogV2 } from "./baseline-positive-worktree-physical-catalog-v2.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";

type Setfarm = ReturnType<typeof import("./baseline-deployment-cutover-launcher-observation-v1.js").holdDeploymentCutoverDefaultLauncherV1>;
type Mission = ReturnType<typeof import("./baseline-task6a-mission-control-launcher-hold-v2.js").holdTask6aMissionControlLauncherV2>;
type Physical = Parameters<typeof observePositiveWorktreePre32HostPairWithPortsV7>[0];
type Writer = Awaited<ReturnType<Setfarm["observeTask6aWriterDatabaseSnapshotV2"]>>;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_TASK6A_THREE_LAUNCHER_HOST_INVALID"); }
function tree(value: unknown, seen = new WeakSet<object>(), budget = { remaining: 32768 }): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isSafeInteger(value)) return;
  if (typeof value !== "object" || types.isProxy(value) || !Object.isFrozen(value)
    || --budget.remaining < 0) fail();
  if (seen.has(value)) return;
  seen.add(value);
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (array && keys.length !== value.length + 1) fail();
  for (const key of keys) {
    if (array && key === "length") continue;
    if (typeof key !== "string" || (array && (!/^(0|[1-9][0-9]*)$/.test(key)
      || Number(key) >= value.length))) fail();
    const field = descriptors[key]!;
    if (!field.enumerable || !Object.hasOwn(field, "value")) fail();
    tree(field.value, seen, budget);
  }
}
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  tree(value);
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) fail();
  return Object.fromEntries(keys.map(key => [key, descriptors[key]!.value as unknown]));
}
function checkedHash(value: unknown, key: string, keys: readonly string[]): Record<string, unknown> {
  const row = exact(value, [...keys, key]);
  const observed = row[key];
  if (typeof observed !== "string" || !/^[a-f0-9]{64}$/.test(observed)) fail();
  const body = Object.fromEntries(keys.map(field => [field, row[field]]));
  if (hashCanonicalJson(body) !== observed) fail();
  return row;
}
function missionObservation(value: unknown): Record<string, unknown> {
  const row = checkedHash(value, "observationHash", ["schema", "authority", "cutoverAdmission",
    "physicalIdentityProvenance", "label", "state", "activeCount", "databaseRole"]);
  if (row.schema !== "setfarm.internal-production-task6a-mission-control-launcher.v2"
    || row.authority !== "diagnostic-only" || row.cutoverAdmission !== "not-granted"
    || row.physicalIdentityProvenance !== "unverified" || row.label !== "com.setrox.mission-control"
    || row.state !== "running" || row.activeCount !== 1 || typeof row.databaseRole !== "string"
    || !/^[a-z][a-z0-9_]{0,62}$/.test(row.databaseRole)) fail();
  return row;
}
function writerSnapshot(value: unknown): Writer {
  const row = checkedHash(value, "snapshotHash", ["schema", "authority", "temporalScope", "cutoverAdmission",
    "physicalIdentityProvenance", "database"]);
  const database = exact(row.database, ["databaseName", "databaseOwnerRole", "sessionRole", "effectiveRole",
    "login", "superuser", "bypassRls", "createRole", "createDatabase", "otherSessionCount"]);
  if (row.schema !== "setfarm.internal-production-task6a-writer-database-snapshot.v2"
    || row.authority !== "diagnostic-only" || row.temporalScope !== "catalog-snapshot-and-live-session-sample"
    || row.cutoverAdmission !== "not-granted" || row.physicalIdentityProvenance !== "unverified"
    || database.databaseName !== "setfarm" || database.sessionRole !== database.effectiveRole
    || ["databaseOwnerRole", "sessionRole", "effectiveRole"].some(key =>
      typeof database[key] !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(database[key] as string))
    || ["login", "superuser", "bypassRls", "createRole", "createDatabase"].some(key => typeof database[key] !== "boolean")
    || !Number.isSafeInteger(database.otherSessionCount) || (database.otherSessionCount as number) < 0) fail();
  return value as Writer;
}
function validPair(value: unknown) {
  const row = checkedHash(value, "pairHash", ["schema", "authority", "physicalIdentityProvenance",
    "heldPair", "pre32Database"]);
  if (row.schema !== "setfarm.internal-production-pre32-physical-database-pair.v7"
    || row.authority !== "diagnostic-only" || row.physicalIdentityProvenance !== "unverified") fail();
  return value as Awaited<ReturnType<typeof observePositiveWorktreePre32HostPairWithPortsV7>>;
}

/** Ports are held for the full two-pass interval; their close is mandatory on every path. */
export async function observeTask6aThreeLauncherHostWithPortsV2(ports: Readonly<{
  setfarm: Setfarm; mc: Mission; observePhysical: Physical;
}>) {
  let failure: Error | null = null;
  let result: ReturnType<typeof Object.freeze> | undefined;
  try {
    if (arguments.length !== 1 || !ports || typeof ports !== "object") fail();
    const { setfarm, mc, observePhysical } = ports;
    if (!setfarm || !mc || typeof observePhysical !== "function") fail();
    const labels = setfarm.observation.launchers.map(row => row.label);
    if (labels.length !== 2 || labels[0] !== "com.setrox.setfarm-spawner"
      || labels[1] !== "com.setrox.setfarm-dashboard") fail();
    const missionControlLauncher = missionObservation(mc.observation);
    await setfarm.qualifyPassiveHome();
    setfarm.recheck();mc.recheck();
    let writerDatabaseSnapshotV2: Writer | undefined;
    const pre32HostPairV7 = validPair(await observePositiveWorktreePre32HostPairWithPortsV7(
      observePhysical, async () => {
        const v7 = await setfarm.censusAndBindingRowsV7();
        writerDatabaseSnapshotV2 = writerSnapshot(await setfarm.observeTask6aWriterDatabaseSnapshotV2(mc));
        return v7;
      }));
    setfarm.recheck();mc.recheck();
    if (!writerDatabaseSnapshotV2 || writerDatabaseSnapshotV2.database.sessionRole !== missionControlLauncher.databaseRole) fail();
    const body = Object.freeze({ schema: "setfarm.internal-production-task6a-three-launcher-host.v2" as const,
      authority: "diagnostic-only" as const, cutoverAdmission: "not-granted" as const,
      physicalIdentityProvenance: "unverified" as const,
      temporalScope: "held-physical-two-pass-sequential-database-samples" as const,
      roleAgreement: true as const, missionControlLauncher: mc.observation,
      pre32HostPairV7, writerDatabaseSnapshotV2 });
    result = Object.freeze({ ...body, diagnosticHash: hashCanonicalJson(body) });
  } catch { failure = new Error("INTERNAL_PRODUCTION_TASK6A_THREE_LAUNCHER_HOST_INVALID"); }
  try { ports?.mc?.close(); } catch { failure = new Error("INTERNAL_PRODUCTION_TASK6A_THREE_LAUNCHER_HOST_INVALID"); }
  try { ports?.setfarm?.close(); } catch { failure = new Error("INTERNAL_PRODUCTION_TASK6A_THREE_LAUNCHER_HOST_INVALID"); }
  if (failure || !result) fail();
  return result as Readonly<{ schema: "setfarm.internal-production-task6a-three-launcher-host.v2";
    authority: "diagnostic-only"; cutoverAdmission: "not-granted"; physicalIdentityProvenance: "unverified";
    temporalScope: "held-physical-two-pass-sequential-database-samples"; roleAgreement: true;
    missionControlLauncher: Mission["observation"];
    pre32HostPairV7: Awaited<ReturnType<typeof observePositiveWorktreePre32HostPairWithPortsV7>>;
    writerDatabaseSnapshotV2: Writer; diagnosticHash: string }>;
}

/** Import-inert, no-write host adapter. A failure never becomes cutover authority. */
export async function observeCodeOwnedTask6aThreeLauncherHostV2() {
  if (arguments.length !== 0) fail();
  let setfarm: Setfarm | undefined;
  let mc: Mission | undefined;
  try {
    const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
    const { holdTask6aMissionControlLauncherV2 } = await import("./baseline-task6a-mission-control-launcher-hold-v2.js");
    setfarm = holdDeploymentCutoverDefaultLauncherV1();
    mc = holdTask6aMissionControlLauncherV2();
    const ownerHomeRoot = userInfo().homedir;
    const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
    const heldSetfarm = setfarm, heldMc = mc;
    setfarm = undefined;mc = undefined;
    return await observeTask6aThreeLauncherHostWithPortsV2({ setfarm: heldSetfarm, mc: heldMc,
      observePhysical: betweenPasses => observeHeldPositiveWorktreePhysicalCatalogV2(
        { ownerHomeRoot, workspaceRoot }, betweenPasses) });
  } catch {
    let cleanupFailed = false;
    try { mc?.close(); } catch { cleanupFailed = true; }
    try { setfarm?.close(); } catch { cleanupFailed = true; }
    if (cleanupFailed) fail();
    fail();
  }
}
