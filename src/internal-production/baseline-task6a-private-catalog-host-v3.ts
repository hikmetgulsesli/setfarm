import { userInfo } from "node:os";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { observeHeldPositiveWorktreePhysicalCatalogV2 } from "./baseline-positive-worktree-physical-catalog-v2.js";
import { observeTask6aThreeLauncherHostWithPortsV2 } from "./baseline-task6a-three-launcher-host-v2.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";

type Ports = Parameters<typeof observeTask6aThreeLauncherHostWithPortsV2>[0];
type Inventory = Awaited<ReturnType<Ports["setfarm"]["observeTask6aPrivateCatalogInventoryV3"]>>;
const COUNT_NAMES = ["object", "explicitAclObject", "defaultAcl", "directMembership",
  "publicAclObject", "publicDefaultAcl"] as const;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_HOST_INVALID"); }
function tree(value: unknown, seen = new WeakSet<object>(), budget = { left: 32768 }): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isSafeInteger(value)) return;
  if (typeof value !== "object" || types.isProxy(value) || !Object.isFrozen(value) || --budget.left < 0) fail();
  if (seen.has(value)) return;
  seen.add(value);
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
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
  const descriptors = Object.getOwnPropertyDescriptors(value as object), actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) fail();
  return Object.fromEntries(keys.map(key => [key, descriptors[key]!.value as unknown]));
}
function inventory(value: unknown): Inventory {
  const fields = ["schema", "authority", "cutoverAdmission", "physicalIdentityProvenance",
    "catalogScope", "databaseName", "serverVersion", "counts", "detailHash"] as const;
  const row = exact(value, [...fields, "diagnosticHash"]), counts = exact(row.counts, COUNT_NAMES);
  if (row.schema !== "setfarm.internal-production-task6a-private-catalog-inventory.v3"
    || row.authority !== "diagnostic-only" || row.cutoverAdmission !== "not-granted"
    || row.physicalIdentityProvenance !== "unverified"
    || row.catalogScope !== "selected-explicit-acl-and-direct-membership-rows-not-permission-proof"
    || row.databaseName !== "setfarm" || !Number.isSafeInteger(row.serverVersion)
    || (row.serverVersion as number) < 160000 || (row.serverVersion as number) >= 200000
    || typeof row.detailHash !== "string" || !/^[a-f0-9]{64}$/.test(row.detailHash)
    || typeof row.diagnosticHash !== "string" || !/^[a-f0-9]{64}$/.test(row.diagnosticHash)
    || Object.values(counts).some(count => !Number.isSafeInteger(count) || (count as number) < 0)
    || hashCanonicalJson(Object.fromEntries(fields.map(field => [field, row[field]]))) !== row.diagnosticHash) fail();
  const object = counts.object as number, explicit = counts.explicitAclObject as number;
  const defaults = counts.defaultAcl as number, membership = counts.directMembership as number;
  if (object < 1 || object + defaults + membership > 1024 || explicit > object
    || (counts.publicAclObject as number) > explicit
    || (counts.publicDefaultAcl as number) > defaults) fail();
  return value as Inventory;
}

/** The exact selected rows remain private during the held physical interval. */
export async function observeTask6aPrivateCatalogHostWithPortsV3(ports: Ports) {
  try {
    if (arguments.length !== 1 || !ports || typeof ports !== "object") fail();
    let callbacks = 0;
    let observedInventory: Inventory | undefined;
    const threeLauncherHostV2 = await observeTask6aThreeLauncherHostWithPortsV2({
      setfarm: ports.setfarm, mc: ports.mc,
      observePhysical: async betweenPasses => {
        let callbackPromise: Promise<void> | undefined;
        let callbackSettled = false;
        let physicalResult: Awaited<ReturnType<Ports["observePhysical"]>> | undefined;
        let physicalFailed = false;
        let returnedEarly = false;
        let physicalReturned = false;
        try {
          physicalResult = await ports.observePhysical(() => {
            if (physicalReturned || ++callbacks !== 1) {
              const rejected = Promise.reject(new Error("INTERNAL_PRODUCTION_TASK6A_PRIVATE_CATALOG_HOST_INVALID"));
              void rejected.catch(() => undefined);
              return rejected;
            }
            callbackPromise = Promise.resolve().then(async () => {
              await betweenPasses();
              observedInventory = inventory(await ports.setfarm.observeTask6aPrivateCatalogInventoryV3(ports.mc));
            }).finally(() => { callbackSettled = true; });
            void callbackPromise.catch(() => undefined);
            return callbackPromise;
          });
          returnedEarly = callbackPromise !== undefined && !callbackSettled;
        } catch { physicalFailed = true; }
        finally { physicalReturned = true; }
        if (callbackPromise) {
          try { await callbackPromise; } catch { physicalFailed = true; }
        }
        if (physicalFailed || returnedEarly || callbacks !== 1 || !observedInventory || !physicalResult) fail();
        return physicalResult;
      },
    });
    if (callbacks !== 1 || !observedInventory) fail();
    const body = Object.freeze({ schema: "setfarm.internal-production-task6a-private-catalog-host.v3" as const,
      authority: "diagnostic-only" as const, cutoverAdmission: "not-granted" as const,
      physicalIdentityProvenance: "unverified" as const,
      temporalScope: "held-physical-two-pass-sequential-private-catalog-sample" as const,
      threeLauncherHostV2, privateCatalogInventoryV3: observedInventory });
    return Object.freeze({ ...body, diagnosticHash: hashCanonicalJson(body) });
  } catch { fail(); }
}

/** Import-inert no-write adapter; the V2 composer owns holder closure. */
export async function observeCodeOwnedTask6aPrivateCatalogHostV3() {
  if (arguments.length !== 0) fail();
  let setfarm: Ports["setfarm"] | undefined;
  let mc: Ports["mc"] | undefined;
  try {
    const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
    const { holdTask6aMissionControlLauncherV2 } = await import("./baseline-task6a-mission-control-launcher-hold-v2.js");
    setfarm = holdDeploymentCutoverDefaultLauncherV1();
    mc = holdTask6aMissionControlLauncherV2();
    const ownerHomeRoot = userInfo().homedir;
    const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
    const heldSetfarm = setfarm, heldMc = mc;
    setfarm = undefined; mc = undefined;
    return await observeTask6aPrivateCatalogHostWithPortsV3({ setfarm: heldSetfarm, mc: heldMc,
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
