import { userInfo } from "node:os";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { validateLegacyFindingPublicationInventoryV1 } from "../findings/legacy-finding-publication-inventory-v1.js";
import type { ActiveOwnerRowSnapshotV2 } from "./baseline-positive-worktree-active-row-snapshot-v2.js";
import { observeHeldPositiveWorktreePhysicalCatalogV2 } from "./baseline-positive-worktree-physical-catalog-v2.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";

// This pair is diagnostic evidence only. Neither producer's empty output grants cutover authority.
const SCHEMA = "setfarm.internal-production-positive-worktree-host-pair.v2";

type PhysicalCatalogV2 = Awaited<ReturnType<typeof observeHeldPositiveWorktreePhysicalCatalogV2>>;
type PhysicalObserverV2 = (betweenPasses: () => Promise<void>) => Promise<PhysicalCatalogV2>;
type DatabaseObserverV2 = () => Promise<ActiveOwnerRowSnapshotV2>;
type Pre32SnapshotV4 = Awaited<ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4>>;
type DatabaseObserverV4 = () => Promise<Pre32SnapshotV4>;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID"); }

function frozenData(value: unknown, seen = new WeakSet<object>(), remaining = { count: 32_768 }): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") { if (!Number.isSafeInteger(value)) fail(); return; }
  if (typeof value !== "object" || types.isProxy(value) || !Object.isFrozen(value)
    || seen.has(value) || --remaining.count < 0) fail();
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
    const descriptor = descriptors[key]!;
    if (!descriptor.enumerable || !("value" in descriptor)) fail();
    frozenData(descriptor.value, seen, remaining);
  }
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  frozenData(value);
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key))) fail();
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value as unknown]));
}

function sha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail();
  return value;
}

function validPhysicalCatalog(value: unknown): PhysicalCatalogV2 {
  const row = exact(value, ["schema", "status", "observerPidExcluded", "entries", "absentBases",
    "incidentalFiles", "blockers", "catalogHash"]);
  if (row.schema !== "setfarm.internal-production-positive-worktree-physical-catalog.v2"
    || (row.status !== "complete" && row.status !== "unresolved")) fail();
  const catalogHash = sha256(row.catalogHash);
  const body = { schema: row.schema, status: row.status, observerPidExcluded: row.observerPidExcluded,
    entries: row.entries, absentBases: row.absentBases, incidentalFiles: row.incidentalFiles,
    blockers: row.blockers };
  if (hashCanonicalJson(body) !== catalogHash) fail();
  return value as PhysicalCatalogV2;
}

function validDatabaseSnapshot(value: unknown): ActiveOwnerRowSnapshotV2 {
  const row = exact(value, ["schema", "authority", "physicalIdentityProvenance", "activeRuns",
    "openClaims", "activeAttempts", "activeSessions", "counts", "snapshotHash"]);
  if (row.schema !== "setfarm.internal-production-positive-worktree-active-rows.v2"
    || row.authority !== "diagnostic-only" || row.physicalIdentityProvenance !== "unverified") fail();
  const snapshotHash = sha256(row.snapshotHash);
  const body = { schema: row.schema, authority: row.authority,
    physicalIdentityProvenance: row.physicalIdentityProvenance, activeRuns: row.activeRuns,
    openClaims: row.openClaims, activeAttempts: row.activeAttempts, activeSessions: row.activeSessions,
    counts: row.counts };
  if (hashCanonicalJson(body) !== snapshotHash) fail();
  return value as ActiveOwnerRowSnapshotV2;
}

function validPre32SnapshotV4(value: unknown): Pre32SnapshotV4 {
  try {
    const row = exact(value, ["schema", "authority", "legacyCensus", "activeRows", "snapshotHash"]);
    if (row.schema !== "setfarm.internal-production-pre32-active-owner-snapshot.v4"
      || row.authority !== "diagnostic-only") failPre32();
    const census = exact(row.legacyCensus, ["activeRunCount", "openClaimCount", "executionAttemptCount",
      "activeRuntimeSessionCount", "activeCompletionOwnerCount", "unsettledMandatoryEffectCount",
      "artifactReservationCount", "publicationBatchCount", "artifactPublicationCount",
      "terminationOwnerCount", "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount",
      "legacyFindingPublicationInventory"]);
    for (const [key, count] of Object.entries(census)) {
      if (key !== "legacyFindingPublicationInventory" && count !== 0) failPre32();
    }
    validateLegacyFindingPublicationInventoryV1(census.legacyFindingPublicationInventory);
    const activeRows = validDatabaseSnapshot(row.activeRows);
    if (activeRows.counts.runCount !== census.activeRunCount
      || activeRows.counts.claimCount !== census.openClaimCount
      || activeRows.counts.attemptCount !== census.executionAttemptCount
      || activeRows.counts.sessionCount !== census.activeRuntimeSessionCount) failPre32();
    const snapshotHash = sha256(row.snapshotHash);
    if (hashCanonicalJson({ schema: row.schema, authority: row.authority,
      legacyCensus: row.legacyCensus, activeRows: row.activeRows }) !== snapshotHash) failPre32();
    return value as Pre32SnapshotV4;
  } catch { failPre32(); }
}

function failPre32(): never {
  throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID");
}

export async function observePositiveWorktreeHostPairWithPortsV2(
  observePhysical: PhysicalObserverV2,
  observeDatabase: DatabaseObserverV2,
) {
  let databaseSnapshot: ActiveOwnerRowSnapshotV2 | null = null;
  let phase = 0;
  let attempts = 0;
  let callbackPromise: Promise<void> | null = null;
  const physicalCatalog = await observePhysical(() => {
    attempts += 1;
    if (phase !== 0) {
      const rejected = Promise.reject(new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_HOST_PAIR_INVALID"));
      void rejected.catch(() => undefined);
      return rejected;
    }
    phase = 1;
    callbackPromise = Promise.resolve().then(observeDatabase).then((snapshot) => {
      databaseSnapshot = snapshot;
      phase = 2;
    });
    // A faulty fixture observer may return without awaiting this callback.
    // Keep its eventual rejection handled while still refusing the early return.
    void callbackPromise.catch(() => undefined);
    return callbackPromise;
  });
  if (attempts !== 1 || callbackPromise === null || phase !== 2 || databaseSnapshot === null) fail();
  const physicalEvidence = validPhysicalCatalog(physicalCatalog);
  const databaseEvidence = validDatabaseSnapshot(databaseSnapshot);
  const body = { schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const, physicalCatalog: physicalEvidence,
    databaseSnapshot: databaseEvidence } as const;
  return Object.freeze({ ...body, pairHash: hashCanonicalJson(body) });
}

export async function observePositiveWorktreePre32HostPairWithPortsV4(
  observePhysical: PhysicalObserverV2,
  observeDatabase: DatabaseObserverV4,
) {
  let complete: Pre32SnapshotV4 | null = null;
  const heldPair = await observePositiveWorktreeHostPairWithPortsV2(observePhysical, async () => {
    const result = validPre32SnapshotV4(await observeDatabase());
    complete = result;
    return result.activeRows;
  });
  const pre32Database = complete as Pre32SnapshotV4 | null;
  if (pre32Database === null || heldPair.databaseSnapshot !== pre32Database.activeRows) failPre32();
  const body = { schema: "setfarm.internal-production-pre32-physical-database-pair.v4" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    heldPair, pre32Database };
  return Object.freeze({ ...body, pairHash: hashCanonicalJson(body) });
}

/** Zero-input diagnostic observer. Import DB configuration before physical acquisition. */
export async function observeCodeOwnedPositiveWorktreeHostPairV2() {
  const ownerHomeRoot = userInfo().homedir;
  const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
  const { observeCodeOwnedPositiveWorktreeActiveRowSnapshotV2 } = await import("../db-pg.js");
  return observePositiveWorktreeHostPairWithPortsV2(
    (betweenPasses) => observeHeldPositiveWorktreePhysicalCatalogV2({ ownerHomeRoot, workspaceRoot }, betweenPasses),
    observeCodeOwnedPositiveWorktreeActiveRowSnapshotV2,
  );
}

/** Diagnostic only: fixed launcher credentials remain private through the held physical callback. */
export async function observeCodeOwnedPositiveWorktreePre32HostPairV4() {
  if (arguments.length !== 0) failPre32();
  const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
  const launcher = holdDeploymentCutoverDefaultLauncherV1();
  try {
    await launcher.qualifyPassiveHome();
    launcher.recheck();
    const ownerHomeRoot = userInfo().homedir;
    const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
    const result = await observePositiveWorktreePre32HostPairWithPortsV4(
      (betweenPasses) => observeHeldPositiveWorktreePhysicalCatalogV2({ ownerHomeRoot, workspaceRoot }, betweenPasses),
      launcher.censusAndActiveRows,
    );
    launcher.recheck();
    return result;
  } finally {
    launcher.close();
  }
}
