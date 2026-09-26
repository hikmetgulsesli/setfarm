import { userInfo } from "node:os";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { observeHeldPositiveWorktreePhysicalCatalogV2 } from "./baseline-positive-worktree-physical-catalog-v2.js";
import { observeTask6aThreeLauncherHostWithPortsV2 } from "./baseline-task6a-three-launcher-host-v2.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";

type Ports = Parameters<typeof observeTask6aThreeLauncherHostWithPortsV2>[0];
type Catalog = Awaited<ReturnType<Ports["setfarm"]["observeTask6aWriterCatalogTopologyV2"]>>;
const COUNT_NAMES = ["directMembership", "directInherit", "directSet", "directAdmin", "schema", "ownedSchema",
  "relation", "ownedRelation", "sequence", "ownedSequence", "routine", "ownedRoutine",
  "securityDefinerRoutine", "selectedExplicitAclRow", "defaultAcl", "ownedDefaultAcl"] as const;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_TASK6A_WRITER_CATALOG_HOST_INVALID"); }
function tree(value: unknown, seen = new WeakSet<object>(), budget = { left: 32768 }): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isSafeInteger(value)) return;
  if (typeof value !== "object" || types.isProxy(value) || !Object.isFrozen(value) || --budget.left < 0) fail();
  if (seen.has(value)) return;
  seen.add(value);
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (array && keys.length !== value.length + 1) fail();
  for (const key of keys) {
    if (array && key === "length") continue;
    if (typeof key !== "string" || (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) fail();
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
function catalog(value: unknown): Catalog {
  const fields = ["schema", "authority", "cutoverAdmission", "physicalIdentityProvenance", "temporalScope",
    "membershipScope", "catalogScope", "databaseName", "sessionRole", "serverVersion", "counts"] as const;
  const row = exact(value, [...fields, "topologyHash"]);
  const counts = exact(row.counts, COUNT_NAMES);
  if (row.schema !== "setfarm.internal-production-task6a-writer-catalog-topology.v2"
    || row.authority !== "diagnostic-only" || row.cutoverAdmission !== "not-granted"
    || row.physicalIdentityProvenance !== "unverified" || row.temporalScope !== "catalog-transaction-snapshot"
    || row.membershipScope !== "direct-only-non-transitive"
    || row.catalogScope !== "coarse-selected-catalog-row-counts-not-permission-proof"
    || row.databaseName !== "setfarm" || typeof row.sessionRole !== "string"
    || !/^[a-z][a-z0-9_]{0,62}$/.test(row.sessionRole)
    || !Number.isSafeInteger(row.serverVersion) || (row.serverVersion as number) < 160000
    || (row.serverVersion as number) >= 200000
    || Object.values(counts).some(count => !Number.isSafeInteger(count) || (count as number) < 0)
    || typeof row.topologyHash !== "string" || !/^[a-f0-9]{64}$/.test(row.topologyHash)
    || hashCanonicalJson(Object.fromEntries(fields.map(field => [field, row[field]]))) !== row.topologyHash) fail();
  for (const [subset, total] of [["directInherit", "directMembership"], ["directSet", "directMembership"],
    ["directAdmin", "directMembership"], ["ownedSchema", "schema"], ["ownedRelation", "relation"],
    ["sequence", "relation"], ["ownedSequence", "sequence"], ["ownedRoutine", "routine"],
    ["securityDefinerRoutine", "routine"], ["ownedDefaultAcl", "defaultAcl"]] as const) {
    if ((counts[subset] as number) > (counts[total] as number)) fail();
  }
  return value as Catalog;
}

/** The catalog callback is awaited after the V7 and writer samples, before physical pass two. */
export async function observeTask6aWriterCatalogHostWithPortsV2(ports: Ports) {
  try {
    if (arguments.length !== 1 || !ports || typeof ports !== "object") fail();
    let callbacks = 0;
    let observedCatalog: Catalog | undefined;
    const threeLauncherHostV2 = await observeTask6aThreeLauncherHostWithPortsV2({
      setfarm: ports.setfarm, mc: ports.mc,
      observePhysical: async betweenPasses => ports.observePhysical(async () => {
        if (++callbacks !== 1) fail();
        await betweenPasses();
        observedCatalog = catalog(await ports.setfarm.observeTask6aWriterCatalogTopologyV2(ports.mc));
      }),
    });
    if (callbacks !== 1 || !observedCatalog
      || observedCatalog.sessionRole !== threeLauncherHostV2.writerDatabaseSnapshotV2.database.sessionRole
      || observedCatalog.sessionRole !== threeLauncherHostV2.missionControlLauncher.databaseRole) fail();
    const body = Object.freeze({ schema: "setfarm.internal-production-task6a-writer-catalog-host.v2" as const,
      authority: "diagnostic-only" as const, cutoverAdmission: "not-granted" as const,
      physicalIdentityProvenance: "unverified" as const,
      temporalScope: "held-physical-two-pass-sequential-catalog-sample" as const,
      threeLauncherHostV2, writerCatalogTopologyV2: observedCatalog });
    return Object.freeze({ ...body, diagnosticHash: hashCanonicalJson(body) });
  } catch { fail(); }
}

/** Import-inert, no-write host adapter. All holders close in the V2 composer. */
export async function observeCodeOwnedTask6aWriterCatalogHostV2() {
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
    setfarm = undefined;mc = undefined;
    return await observeTask6aWriterCatalogHostWithPortsV2({ setfarm: heldSetfarm, mc: heldMc,
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
