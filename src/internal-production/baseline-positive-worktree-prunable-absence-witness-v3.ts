import path from "node:path";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { observeCodeOwnedPositiveWorktreeHostPairV2 } from "./baseline-positive-worktree-host-pair-v2.js";

// Diagnostic sidecar only: two bracketed absence checks never authorize prune or cutover.
const SCHEMA = "setfarm.internal-production-prunable-absence-witness.v3";
const MAX_BLOCKERS = 1_024;
type HostPairV2 = Awaited<ReturnType<typeof observeCodeOwnedPositiveWorktreeHostPairV2>>;
type Witness = Readonly<{ root: string; absentBase: string }>;

function fail(): never { throw new Error("INTERNAL_PRODUCTION_PRUNABLE_ABSENCE_WITNESS_INVALID"); }

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
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key))) fail();
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value as unknown]));
}

function sha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail();
  return value;
}

function canonicalPath(value: unknown): string {
  if (typeof value !== "string" || value === "/" || value.includes("\0")
    || !path.posix.isAbsolute(value) || path.posix.normalize(value) !== value
    || Buffer.byteLength(value) > 4_096) fail();
  return value;
}

function validPair(value: unknown): HostPairV2 {
  frozenData(value);
  const pair = exact(value, ["schema", "authority", "physicalIdentityProvenance", "physicalCatalog",
    "databaseSnapshot", "pairHash"]);
  if (pair.schema !== "setfarm.internal-production-positive-worktree-host-pair.v2"
    || pair.authority !== "diagnostic-only" || pair.physicalIdentityProvenance !== "unverified") fail();
  const catalog = exact(pair.physicalCatalog, ["schema", "status", "observerPidExcluded", "entries",
    "absentBases", "incidentalFiles", "blockers", "catalogHash"]);
  if (catalog.schema !== "setfarm.internal-production-positive-worktree-physical-catalog.v2"
    || (catalog.status !== "complete" && catalog.status !== "unresolved")
    || !Array.isArray(catalog.absentBases) || !Array.isArray(catalog.blockers)) fail();
  const catalogBody = { schema: catalog.schema, status: catalog.status,
    observerPidExcluded: catalog.observerPidExcluded, entries: catalog.entries,
    absentBases: catalog.absentBases, incidentalFiles: catalog.incidentalFiles,
    blockers: catalog.blockers };
  if (hashCanonicalJson(catalogBody) !== sha256(catalog.catalogHash)) fail();
  const database = exact(pair.databaseSnapshot, ["schema", "authority", "physicalIdentityProvenance",
    "activeRuns", "openClaims", "activeAttempts", "activeSessions", "counts", "snapshotHash"]);
  if (database.schema !== "setfarm.internal-production-positive-worktree-active-rows.v2"
    || database.authority !== "diagnostic-only" || database.physicalIdentityProvenance !== "unverified") fail();
  const databaseBody = { schema: database.schema, authority: database.authority,
    physicalIdentityProvenance: database.physicalIdentityProvenance, activeRuns: database.activeRuns,
    openClaims: database.openClaims, activeAttempts: database.activeAttempts,
    activeSessions: database.activeSessions, counts: database.counts };
  if (hashCanonicalJson(databaseBody) !== sha256(database.snapshotHash)) fail();
  const pairBody = { schema: pair.schema, authority: pair.authority,
    physicalIdentityProvenance: pair.physicalIdentityProvenance,
    physicalCatalog: pair.physicalCatalog, databaseSnapshot: pair.databaseSnapshot };
  if (hashCanonicalJson(pairBody) !== sha256(pair.pairHash)) fail();
  return value as HostPairV2;
}

function compareRoot(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

export function projectPositiveWorktreePrunableAbsenceWitnessV3(rawPair: unknown) {
  const hostPair = validPair(rawPair);
  const catalog = hostPair.physicalCatalog;
  if (catalog.absentBases.length > MAX_BLOCKERS || catalog.blockers.length > MAX_BLOCKERS) fail();
  const absentBases = new Set<string>();
  for (const value of catalog.absentBases) {
    const base = canonicalPath(value);
    if (absentBases.has(base)) fail();
    absentBases.add(base);
  }
  const byRoot = new Map<string, Witness>();
  let unwitnessedPrunableCount = 0;
  for (const rawBlocker of catalog.blockers) {
    const blocker = exact(rawBlocker, ["root", "reason"]);
    const root = canonicalPath(blocker.root);
    if (typeof blocker.reason !== "string" || blocker.reason.length === 0
      || Buffer.byteLength(blocker.reason) > 128) fail();
    if (blocker.reason !== "prunable-git-worktree") continue;
    const parent = path.posix.dirname(root);
    if (absentBases.has(parent)) byRoot.set(root, Object.freeze({ root, absentBase: parent }));
    else unwitnessedPrunableCount += 1;
  }
  const witnesses = Object.freeze([...byRoot.values()].sort((left, right) => compareRoot(left.root, right.root)));
  const body = { schema: SCHEMA, authority: "diagnostic-only" as const,
    temporalScope: "v2-bracketed-two-pass" as const,
    sourcePairHash: hostPair.pairHash, sourceCatalogHash: catalog.catalogHash,
    hostPair, witnesses, unwitnessedPrunableCount };
  return Object.freeze({ ...body, witnessHash: hashCanonicalJson(body) });
}

/** Zero-input, code-owned diagnostic; the V2 producer performs the held observation. */
export async function observeCodeOwnedPositiveWorktreePrunableAbsenceWitnessV3() {
  return projectPositiveWorktreePrunableAbsenceWitnessV3(await observeCodeOwnedPositiveWorktreeHostPairV2());
}
