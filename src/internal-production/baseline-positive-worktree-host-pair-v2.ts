import { userInfo } from "node:os";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type { ActiveOwnerRowSnapshotV2 } from "./baseline-positive-worktree-active-row-snapshot-v2.js";
import { observeHeldPositiveWorktreePhysicalCatalogV2 } from "./baseline-positive-worktree-physical-catalog-v2.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";

// This pair is diagnostic evidence only. Neither producer's empty output grants cutover authority.
const SCHEMA = "setfarm.internal-production-positive-worktree-host-pair.v2";

type PhysicalCatalogV2 = Awaited<ReturnType<typeof observeHeldPositiveWorktreePhysicalCatalogV2>>;
type PhysicalObserverV2 = (betweenPasses: () => Promise<void>) => Promise<PhysicalCatalogV2>;
type DatabaseObserverV2 = () => Promise<ActiveOwnerRowSnapshotV2>;

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

export async function observePositiveWorktreeHostPairWithPortsV2(
  observePhysical: PhysicalObserverV2,
  observeDatabase: DatabaseObserverV2,
) {
  let databaseSnapshot: ActiveOwnerRowSnapshotV2 | null = null;
  let phase = 0;
  let attempts = 0;
  const physicalCatalog = await observePhysical(async () => {
    attempts += 1;
    if (phase !== 0) fail();
    phase = 1;
    databaseSnapshot = await observeDatabase();
    phase = 2;
  });
  if (attempts !== 1 || phase !== 2 || databaseSnapshot === null) fail();
  const physicalEvidence = validPhysicalCatalog(physicalCatalog);
  const databaseEvidence = validDatabaseSnapshot(databaseSnapshot);
  const body = { schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const, physicalCatalog: physicalEvidence,
    databaseSnapshot: databaseEvidence } as const;
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
