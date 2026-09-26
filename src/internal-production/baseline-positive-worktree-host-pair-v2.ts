import { userInfo } from "node:os";
import { types } from "node:util";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { validateLegacyFindingPublicationInventoryV1 } from "../findings/legacy-finding-publication-inventory-v1.js";
import type { ActiveOwnerRowSnapshotV2 } from "./baseline-positive-worktree-active-row-snapshot-v2.js";
import { projectHeldPositiveWorktreeBindingCandidatesV1 } from "./baseline-positive-worktree-held-binding-candidates-v1.js";
import { observeHeldPositiveWorktreePhysicalCatalogV2 } from "./baseline-positive-worktree-physical-catalog-v2.js";
import { resolveInternalProductionBaselineWorkspaceRootV1 } from "./baseline-workspace-authority-path-v1.js";

// This pair is diagnostic evidence only. Neither producer's empty output grants cutover authority.
const SCHEMA = "setfarm.internal-production-positive-worktree-host-pair.v2";

type PhysicalCatalogV2 = Awaited<ReturnType<typeof observeHeldPositiveWorktreePhysicalCatalogV2>>;
type PhysicalObserverV2 = (betweenPasses: () => Promise<void>) => Promise<PhysicalCatalogV2>;
type PhysicalEntryV2 = PhysicalCatalogV2["entries"][number];
type PhysicalObserverWithFirstPassV2 = (betweenPasses: (firstPass: readonly PhysicalEntryV2[]) => Promise<void>) => Promise<PhysicalCatalogV2>;
type DatabaseObserverV2 = () => Promise<ActiveOwnerRowSnapshotV2>;
type Pre32SnapshotV4 = Awaited<ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusAndActiveRowsInOneReadOnlyTransactionV4>>;
type DatabaseObserverV4 = () => Promise<Pre32SnapshotV4>;
type Pre32SnapshotV5 = Awaited<ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusAndActiveRowsWithQuarantineV5>>;
type DatabaseObserverV5 = () => Promise<Pre32SnapshotV5>;
type Pre32SnapshotV6 = Awaited<ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusAndBindingRowsV6>>;
type DatabaseObserverV6 = () => Promise<Pre32SnapshotV6>;
type Pre32SnapshotV7 = Awaited<ReturnType<typeof import("./baseline-legacy-database-census-v1.js").observeLegacyDatabaseCensusAndBindingRowsV7>>;
type DatabaseObserverV7 = () => Promise<Pre32SnapshotV7>;
type ActiveBindingSnapshotV1 = Awaited<ReturnType<typeof import("./baseline-positive-worktree-active-binding-snapshot-v1.js").observePositiveWorktreeActiveBindingSnapshotInTransactionV1>>;
type ActiveBindingObserverV1 = () => Promise<ActiveBindingSnapshotV1>;

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

function validPre32SnapshotV5(value: unknown): Pre32SnapshotV5 {
  try {
    const row = exact(value, ["schema", "authority", "legacyCensus", "activeRows",
      "quarantinedRuntimeSessionCount", "snapshotHash"]);
    if (row.schema !== "setfarm.internal-production-pre32-active-owner-snapshot.v5"
      || row.authority !== "diagnostic-only"
      || typeof row.quarantinedRuntimeSessionCount !== "number"
      || !Number.isSafeInteger(row.quarantinedRuntimeSessionCount)
      || row.quarantinedRuntimeSessionCount < 0) failPre32();
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
      legacyCensus: row.legacyCensus, activeRows: row.activeRows,
      quarantinedRuntimeSessionCount: row.quarantinedRuntimeSessionCount }) !== snapshotHash) failPre32();
    return value as Pre32SnapshotV5;
  } catch { failPre32(); }
}

function validPre32SnapshotV6(value: unknown): Pre32SnapshotV6 {
  try {
    const row = exact(value, ["schema", "authority", "legacyCensus", "activeRows", "bindingRows",
      "quarantinedRuntimeSessionCount", "snapshotHash"]);
    if (row.schema !== "setfarm.internal-production-pre32-active-binding-snapshot.v6"
      || row.authority !== "diagnostic-only" || typeof row.quarantinedRuntimeSessionCount !== "number"
      || !Number.isSafeInteger(row.quarantinedRuntimeSessionCount)
      || row.quarantinedRuntimeSessionCount < 0) failPre32();
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
      || activeRows.counts.sessionCount !== census.activeRuntimeSessionCount
      || !Array.isArray(activeRows.activeRuns) || activeRows.activeRuns.length !== activeRows.counts.runCount
      || !Array.isArray(activeRows.openClaims) || activeRows.openClaims.length !== activeRows.counts.claimCount
      || !Array.isArray(activeRows.activeAttempts) || activeRows.activeAttempts.length !== activeRows.counts.attemptCount
      || !Array.isArray(activeRows.activeSessions) || activeRows.activeSessions.length !== activeRows.counts.sessionCount) failPre32();
    const binding = exact(row.bindingRows, ["schema", "authority", "physicalIdentityProvenance",
      "activeAttempts", "activeSessions", "counts", "snapshotHash"]);
    const counts = exact(binding.counts, ["attemptCount", "sessionCount"]);
    if (binding.schema !== "setfarm.internal-production-positive-worktree-binding-rows.v1"
      || binding.authority !== "diagnostic-only" || binding.physicalIdentityProvenance !== "unverified"
      || counts.attemptCount !== activeRows.counts.attemptCount
      || counts.sessionCount !== activeRows.counts.sessionCount
      || !Array.isArray(binding.activeAttempts) || binding.activeAttempts.length !== counts.attemptCount
      || !Array.isArray(binding.activeSessions) || binding.activeSessions.length !== counts.sessionCount) failPre32();
    if (hashCanonicalJson({ schema: binding.schema, authority: binding.authority,
      physicalIdentityProvenance: binding.physicalIdentityProvenance,
      activeAttempts: binding.activeAttempts, activeSessions: binding.activeSessions,
      counts: binding.counts }) !== sha256(binding.snapshotHash)) failPre32();
    if (hashCanonicalJson({ schema: row.schema, authority: row.authority,
      legacyCensus: row.legacyCensus, activeRows: row.activeRows, bindingRows: row.bindingRows,
      quarantinedRuntimeSessionCount: row.quarantinedRuntimeSessionCount }) !== sha256(row.snapshotHash)) failPre32();
    return value as Pre32SnapshotV6;
  } catch { failPre32(); }
}

function validPre32SnapshotV7(value: unknown): Pre32SnapshotV7 {
  try {
    const row = exact(value, ["schema", "authority", "tableLockScope", "journalIdentity", "lockState",
      "legacyCensus", "activeRows", "bindingRows", "quarantinedRuntimeSessionCount", "snapshotHash"]);
    if (row.schema !== "setfarm.internal-production-pre32-active-binding-snapshot.v7"
      || row.authority !== "diagnostic-only"
      || row.tableLockScope !== "fixed-pre32-legacy-superset"
      || row.journalIdentity !== "source-ordinal-name-checksum-state-1-through-31"
      || row.lockState !== "released-at-return") failPre32();
    const v6Body = Object.freeze({ schema: "setfarm.internal-production-pre32-active-binding-snapshot.v6" as const,
      authority: row.authority, legacyCensus: row.legacyCensus, activeRows: row.activeRows,
      bindingRows: row.bindingRows, quarantinedRuntimeSessionCount: row.quarantinedRuntimeSessionCount });
    validPre32SnapshotV6(Object.freeze({ ...v6Body, snapshotHash: hashCanonicalJson(v6Body) }));
    const { snapshotHash: _hash, ...body } = row;
    if (hashCanonicalJson(body) !== sha256(row.snapshotHash)) failPre32();
    return value as Pre32SnapshotV7;
  } catch { failPre32(); }
}

function failActiveBinding(): never {
  throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_BINDING_HOST_PAIR_INVALID");
}

function validActiveBindingSnapshotV1(value: unknown): ActiveBindingSnapshotV1 {
  try {
    const row = exact(value, ["schema", "authority", "physicalIdentityProvenance", "activeRows",
      "bindingRows", "snapshotHash"]);
    if (row.schema !== "setfarm.internal-production-positive-worktree-active-binding-snapshot.v1"
      || row.authority !== "diagnostic-only" || row.physicalIdentityProvenance !== "unverified") failActiveBinding();
    const activeRows = validDatabaseSnapshot(row.activeRows);
    const activeCounts = exact(activeRows.counts, ["runCount", "claimCount", "attemptCount", "sessionCount"]);
    for (const [name, count] of Object.entries(activeCounts)) {
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || count > 256) failActiveBinding();
      const list = name === "runCount" ? activeRows.activeRuns : name === "claimCount" ? activeRows.openClaims
        : name === "attemptCount" ? activeRows.activeAttempts : activeRows.activeSessions;
      if (!Array.isArray(list) || list.length !== count) failActiveBinding();
    }
    const binding = exact(row.bindingRows, ["schema", "authority", "physicalIdentityProvenance",
      "activeAttempts", "activeSessions", "counts", "snapshotHash"]);
    const counts = exact(binding.counts, ["attemptCount", "sessionCount"]);
    if (binding.schema !== "setfarm.internal-production-positive-worktree-binding-rows.v1"
      || binding.authority !== "diagnostic-only" || binding.physicalIdentityProvenance !== "unverified"
      || counts.attemptCount !== activeCounts.attemptCount || counts.sessionCount !== activeCounts.sessionCount
      || !Array.isArray(binding.activeAttempts) || binding.activeAttempts.length !== counts.attemptCount
      || !Array.isArray(binding.activeSessions) || binding.activeSessions.length !== counts.sessionCount) failActiveBinding();
    for (let index = 0; index < binding.activeAttempts.length; index += 1) {
      const observed = exact(binding.activeAttempts[index], ["attemptId", "runId", "claimId", "generation",
        "fenceTokenHash", "sourceSha", "sourceTreeHash", "worktreeRoot", "disposition"]);
      const active = exact(activeRows.activeAttempts[index], ["attemptId", "runId", "stepId", "storyId",
        "claimId", "worktreeRoot", "disposition"]);
      if (typeof observed.generation !== "number" || !Number.isSafeInteger(observed.generation) || observed.generation < 1
        || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(String(observed.sourceSha))
        || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(String(observed.sourceTreeHash))
        || !/^[a-f0-9]{64}$/.test(String(observed.fenceTokenHash))
        || (["attemptId", "runId", "claimId", "worktreeRoot", "disposition"] as const)
          .some(key => observed[key] !== active[key])) failActiveBinding();
    }
    for (let index = 0; index < binding.activeSessions.length; index += 1) {
      const observed = exact(binding.activeSessions[index], ["sessionId", "runId", "claimId", "attemptId",
        "ownerInstanceId", "worktreeRoot", "state"]);
      const active = exact(activeRows.activeSessions[index], ["sessionId", "runId", "claimId", "attemptId",
        "ownerInstanceId", "worktreeRoot", "state"]);
      if ((["sessionId", "runId", "claimId", "attemptId", "ownerInstanceId", "worktreeRoot", "state"] as const)
        .some(key => observed[key] !== active[key])) failActiveBinding();
    }
    if (hashCanonicalJson({ schema: binding.schema, authority: binding.authority,
      physicalIdentityProvenance: binding.physicalIdentityProvenance, activeAttempts: binding.activeAttempts,
      activeSessions: binding.activeSessions, counts: binding.counts }) !== sha256(binding.snapshotHash)
      || hashCanonicalJson({ schema: row.schema, authority: row.authority,
        physicalIdentityProvenance: row.physicalIdentityProvenance, activeRows: row.activeRows,
        bindingRows: row.bindingRows }) !== sha256(row.snapshotHash)) failActiveBinding();
    return value as ActiveBindingSnapshotV1;
  } catch { failActiveBinding(); }
}

function failPre32(): never {
  throw new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID");
}
type Pre32PairPhase = "launcher-load" | "launcher-acquire" | "passive-qualification"
  | "pre-physical-recheck" | "physical-first-pass" | "database-callback"
  | "physical-second-pass" | "pair-validation" | "post-pair-recheck" | "launcher-cleanup";
type PhysicalFailurePoint = Readonly<{ schema: "setfarm.internal-production-positive-worktree-physical-refusal-point.v1";
  operation: string; candidateOrdinal: number | null }>;
function validPhysicalFailurePoint(error: unknown, phase: Pre32PairPhase): PhysicalFailurePoint | null {
  try {
    if (phase !== "physical-first-pass" && phase !== "physical-second-pass") return null;
    if (error === null || typeof error !== "object" || types.isProxy(error)
      || Object.getPrototypeOf(error) !== Error.prototype || !Object.isFrozen(error)) return null;
    const message = Object.getOwnPropertyDescriptor(error, "message");
    const descriptor = Object.getOwnPropertyDescriptor(error, "physicalFailurePoint");
    if (!message || !Object.hasOwn(message, "value")
      || message.value !== "INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PHYSICAL_CATALOG_INVALID"
      || !descriptor || !Object.hasOwn(descriptor, "value")
      || descriptor.enumerable || descriptor.configurable || descriptor.writable) return null;
    const point = descriptor.value;
    if (point === null || typeof point !== "object" || types.isProxy(point)
      || Object.getPrototypeOf(point) !== Object.prototype || !Object.isFrozen(point)) return null;
    const fields = Object.getOwnPropertyDescriptors(point), keys = Reflect.ownKeys(fields);
    if (keys.length !== 3 || keys.some(key => typeof key !== "string"
      || !["schema", "operation", "candidateOrdinal"].includes(key)
      || !fields[key]!.enumerable || !Object.hasOwn(fields[key]!, "value"))) return null;
    const operation = fields.operation!.value, ordinal = fields.candidateOrdinal!.value;
    const candidate = ["candidate-git", "candidate-lsof", "candidate-record", "candidate-recheck-git", "candidate-recheck-lsof",
      "candidate-recheck-compare"].includes(operation);
    const firstPass = ["scope-hold", "base-discovery", "parent-git", "candidate-git", "candidate-lsof",
      "candidate-record", "first-pass-recheck"];
    const secondPass = ["post-database-stability", "parent-recheck", "candidate-recheck-git",
      "candidate-recheck-lsof", "candidate-recheck-compare", "result"];
    if (fields.schema!.value !== "setfarm.internal-production-positive-worktree-physical-refusal-point.v1"
      || !(phase === "physical-first-pass" ? firstPass : secondPass).includes(operation)
      || (candidate ? !Number.isInteger(ordinal) || ordinal < 0 || ordinal >= 256 : ordinal !== null)) return null;
    return point as PhysicalFailurePoint;
  } catch { return null; }
}
function pre32PhaseFailure(phase: Pre32PairPhase, physicalPoint: PhysicalFailurePoint | null = null): Error {
  const error = new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_PRE32_HOST_PAIR_INVALID");
  Object.defineProperty(error, "pre32PairPhase", { value: phase });
  if (physicalPoint !== null && (phase === "physical-first-pass" || phase === "physical-second-pass"))
    Object.defineProperty(error, "pre32PhysicalPoint", { value: physicalPoint });
  return Object.freeze(error);
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

export async function observePositiveWorktreePre32HostPairWithPortsV5(
  observePhysical: PhysicalObserverV2,
  observeDatabase: DatabaseObserverV5,
) {
  let complete: Pre32SnapshotV5 | null = null;
  const heldPair = await observePositiveWorktreeHostPairWithPortsV2(observePhysical, async () => {
    const result = validPre32SnapshotV5(await observeDatabase());
    complete = result;
    return result.activeRows;
  });
  const pre32Database = complete as Pre32SnapshotV5 | null;
  if (pre32Database === null || heldPair.databaseSnapshot !== pre32Database.activeRows) failPre32();
  const body = { schema: "setfarm.internal-production-pre32-physical-database-pair.v5" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    heldPair, pre32Database };
  return Object.freeze({ ...body, pairHash: hashCanonicalJson(body) });
}

export async function observePositiveWorktreePre32HostPairWithPortsV6(
  observePhysical: PhysicalObserverV2,
  observeDatabase: DatabaseObserverV6,
) {
  let complete: Pre32SnapshotV6 | null = null;
  const heldPair = await observePositiveWorktreeHostPairWithPortsV2(observePhysical, async () => {
    const result = validPre32SnapshotV6(await observeDatabase());
    complete = result;
    return result.activeRows;
  });
  const pre32Database = complete as Pre32SnapshotV6 | null;
  if (pre32Database === null || heldPair.databaseSnapshot !== pre32Database.activeRows) failPre32();
  const body = { schema: "setfarm.internal-production-pre32-physical-database-pair.v6" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    heldPair, pre32Database };
  return Object.freeze({ ...body, pairHash: hashCanonicalJson(body) });
}

export async function observePositiveWorktreePre32HostPairWithPortsV7(
  observePhysical: PhysicalObserverV2,
  observeDatabase: DatabaseObserverV7,
) {
  let complete: Pre32SnapshotV7 | null = null;
  const heldPair = await observePositiveWorktreeHostPairWithPortsV2(observePhysical, async () => {
    const result = validPre32SnapshotV7(await observeDatabase());
    complete = result;
    return result.activeRows;
  });
  const pre32Database = complete as Pre32SnapshotV7 | null;
  if (pre32Database === null || heldPair.databaseSnapshot !== pre32Database.activeRows) failPre32();
  const body = { schema: "setfarm.internal-production-pre32-physical-database-pair.v7" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    heldPair, pre32Database };
  return Object.freeze({ ...body, pairHash: hashCanonicalJson(body) });
}

/** Non-pre32 positive rows remain diagnostic and preserve every physical blocker. */
export async function observePositiveWorktreeActiveBindingHostPairWithPortsV1(
  observePhysical: PhysicalObserverV2,
  observeDatabase: ActiveBindingObserverV1,
) {
  let complete: ActiveBindingSnapshotV1 | null = null;
  const heldPair = await observePositiveWorktreeHostPairWithPortsV2(observePhysical, async () => {
    const observed = validActiveBindingSnapshotV1(await observeDatabase());
    complete = observed;
    return observed.activeRows;
  });
  const activeBindingDatabase = complete as ActiveBindingSnapshotV1 | null;
  if (activeBindingDatabase === null || heldPair.databaseSnapshot !== activeBindingDatabase.activeRows) failActiveBinding();
  const body = { schema: "setfarm.internal-production-active-binding-physical-database-pair.v1" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    heldPair, activeBindingDatabase };
  return Object.freeze({ ...body, pairHash: hashCanonicalJson(body) });
}

/** Diagnostic-only held relation; a joined candidate is never an authenticated owner. */
export async function observePositiveWorktreeHeldBindingCandidatesWithPortsV1(
  observePhysical: PhysicalObserverWithFirstPassV2,
  observeDatabase: ActiveBindingObserverV1,
) {
  let firstPass: readonly PhysicalEntryV2[] | null = null;
  const heldActiveBindingPair = await observePositiveWorktreeActiveBindingHostPairWithPortsV1(
    betweenPasses => observePhysical(async view => {
      if (firstPass !== null) throw new Error("INTERNAL_PRODUCTION_HELD_BINDING_CANDIDATES_INVALID");
      firstPass = view;
      await betweenPasses();
    }), observeDatabase);
  const heldFirstPass = firstPass as readonly PhysicalEntryV2[] | null;
  if (heldFirstPass === null) throw new Error("INTERNAL_PRODUCTION_HELD_BINDING_CANDIDATES_INVALID");
  const joinedCandidates = projectHeldPositiveWorktreeBindingCandidatesV1(heldFirstPass,
    heldActiveBindingPair.activeBindingDatabase.bindingRows);
  const orderedFirst = [...heldFirstPass].sort((left, right) =>
    Buffer.compare(Buffer.from(left.root), Buffer.from(right.root)));
  if (hashCanonicalJson(orderedFirst) !== hashCanonicalJson(heldActiveBindingPair.heldPair.physicalCatalog.entries)) {
    throw new Error("INTERNAL_PRODUCTION_HELD_BINDING_CANDIDATES_INVALID");
  }
  const body = { schema: "setfarm.internal-production-held-binding-physical-database-pair.v1" as const,
    authority: "diagnostic-only" as const, physicalIdentityProvenance: "unverified" as const,
    heldActiveBindingPair, joinedCandidates };
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
  type Launcher = ReturnType<typeof import("./baseline-deployment-cutover-launcher-observation-v1.js").holdDeploymentCutoverDefaultLauncherV1>;
  let phase: Pre32PairPhase = "launcher-load";
  let launcher: Launcher | undefined;
  let result: Awaited<ReturnType<typeof observePositiveWorktreePre32HostPairWithPortsV4>> | undefined;
  let failure: Error | null = null;
  let physicalPoint: PhysicalFailurePoint | null = null;
  try {
    const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
    phase = "launcher-acquire";
    launcher = holdDeploymentCutoverDefaultLauncherV1();
    phase = "passive-qualification";
    await launcher.qualifyPassiveHome();
    phase = "pre-physical-recheck";
    launcher.recheck();
    const ownerHomeRoot = userInfo().homedir;
    const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
    phase = "physical-first-pass";
    result = await observePositiveWorktreePre32HostPairWithPortsV4(
      async (betweenPasses) => {
        let physical: PhysicalCatalogV2;
        try {
          physical = await observeHeldPositiveWorktreePhysicalCatalogV2({ ownerHomeRoot, workspaceRoot }, async () => {
            phase = "database-callback";
            await betweenPasses();
            phase = "physical-second-pass";
          });
        } catch (error) { physicalPoint = validPhysicalFailurePoint(error, phase); throw error; }
        phase = "pair-validation";
        return physical;
      },
      launcher.censusAndActiveRows,
    );
    phase = "post-pair-recheck";
    launcher.recheck();
  } catch { failure = pre32PhaseFailure(phase, physicalPoint); }
  try { launcher?.close(); }
  catch { failure = pre32PhaseFailure("launcher-cleanup"); }
  if (failure) throw failure;
  if (result === undefined) throw pre32PhaseFailure("pair-validation");
  return result;
}

/** Diagnostic only: V5 adds quarantined runtime evidence inside the held physical interval. */
export async function observeCodeOwnedPositiveWorktreePre32HostPairV5() {
  if (arguments.length !== 0) failPre32();
  type Launcher = ReturnType<typeof import("./baseline-deployment-cutover-launcher-observation-v1.js").holdDeploymentCutoverDefaultLauncherV1>;
  let phase: Pre32PairPhase = "launcher-load";
  let launcher: Launcher | undefined;
  let result: Awaited<ReturnType<typeof observePositiveWorktreePre32HostPairWithPortsV5>> | undefined;
  let failure: Error | null = null;
  let physicalPoint: PhysicalFailurePoint | null = null;
  try {
    const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
    phase = "launcher-acquire";
    launcher = holdDeploymentCutoverDefaultLauncherV1();
    phase = "passive-qualification";
    await launcher.qualifyPassiveHome();
    phase = "pre-physical-recheck";
    launcher.recheck();
    const ownerHomeRoot = userInfo().homedir;
    const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
    phase = "physical-first-pass";
    result = await observePositiveWorktreePre32HostPairWithPortsV5(
      async (betweenPasses) => {
        let physical: PhysicalCatalogV2;
        try {
          physical = await observeHeldPositiveWorktreePhysicalCatalogV2({ ownerHomeRoot, workspaceRoot }, async () => {
            phase = "database-callback";
            await betweenPasses();
            phase = "physical-second-pass";
          });
        } catch (error) { physicalPoint = validPhysicalFailurePoint(error, phase); throw error; }
        phase = "pair-validation";
        return physical;
      },
      launcher.censusAndActiveRowsWithQuarantine,
    );
    phase = "post-pair-recheck";
    launcher.recheck();
  } catch { failure = pre32PhaseFailure(phase, physicalPoint); }
  try { launcher?.close(); }
  catch { failure = pre32PhaseFailure("launcher-cleanup"); }
  if (failure) throw failure;
  if (result === undefined) throw pre32PhaseFailure("pair-validation");
  return result;
}

/** Diagnostic only: V6 holds same-transaction binding rows inside both physical passes. */
export async function observeCodeOwnedPositiveWorktreePre32HostPairV6() {
  if (arguments.length !== 0) failPre32();
  type Launcher = ReturnType<typeof import("./baseline-deployment-cutover-launcher-observation-v1.js").holdDeploymentCutoverDefaultLauncherV1>;
  let phase: Pre32PairPhase = "launcher-load";
  let launcher: Launcher | undefined;
  let result: Awaited<ReturnType<typeof observePositiveWorktreePre32HostPairWithPortsV6>> | undefined;
  let failure: Error | null = null;
  let physicalPoint: PhysicalFailurePoint | null = null;
  try {
    const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
    phase = "launcher-acquire";
    launcher = holdDeploymentCutoverDefaultLauncherV1();
    phase = "passive-qualification";
    await launcher.qualifyPassiveHome();
    phase = "pre-physical-recheck";
    launcher.recheck();
    const ownerHomeRoot = userInfo().homedir;
    const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
    phase = "physical-first-pass";
    result = await observePositiveWorktreePre32HostPairWithPortsV6(
      async (betweenPasses) => {
        let physical: PhysicalCatalogV2;
        try {
          physical = await observeHeldPositiveWorktreePhysicalCatalogV2({ ownerHomeRoot, workspaceRoot }, async () => {
            phase = "database-callback";
            await betweenPasses();
            phase = "physical-second-pass";
          });
        } catch (error) { physicalPoint = validPhysicalFailurePoint(error, phase); throw error; }
        phase = "pair-validation";
        return physical;
      },
      launcher.censusAndBindingRows,
    );
    phase = "post-pair-recheck";
    launcher.recheck();
  } catch { failure = pre32PhaseFailure(phase, physicalPoint); }
  try { launcher?.close(); }
  catch { failure = pre32PhaseFailure("launcher-cleanup"); }
  if (failure) throw failure;
  if (result === undefined) throw pre32PhaseFailure("pair-validation");
  return result;
}

/** Diagnostic only: V7 binds the exact held pre32 journal and binding rows inside both physical passes. */
export async function observeCodeOwnedPositiveWorktreePre32HostPairV7() {
  if (arguments.length !== 0) failPre32();
  type Launcher = ReturnType<typeof import("./baseline-deployment-cutover-launcher-observation-v1.js").holdDeploymentCutoverDefaultLauncherV1>;
  let phase: Pre32PairPhase = "launcher-load";
  let launcher: Launcher | undefined;
  let result: Awaited<ReturnType<typeof observePositiveWorktreePre32HostPairWithPortsV7>> | undefined;
  let failure: Error | null = null;
  let physicalPoint: PhysicalFailurePoint | null = null;
  try {
    const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
    phase = "launcher-acquire";
    launcher = holdDeploymentCutoverDefaultLauncherV1();
    phase = "passive-qualification";
    await launcher.qualifyPassiveHome();
    phase = "pre-physical-recheck";
    launcher.recheck();
    const ownerHomeRoot = userInfo().homedir;
    const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
    phase = "physical-first-pass";
    result = await observePositiveWorktreePre32HostPairWithPortsV7(
      async (betweenPasses) => {
        let physical: PhysicalCatalogV2;
        try {
          physical = await observeHeldPositiveWorktreePhysicalCatalogV2({ ownerHomeRoot, workspaceRoot }, async () => {
            phase = "database-callback";
            await betweenPasses();
            phase = "physical-second-pass";
          });
        } catch (error) { physicalPoint = validPhysicalFailurePoint(error, phase); throw error; }
        phase = "pair-validation";
        return physical;
      },
      launcher.censusAndBindingRowsV7,
    );
    phase = "post-pair-recheck";
    launcher.recheck();
  } catch { failure = pre32PhaseFailure(phase, physicalPoint); }
  try { launcher?.close(); }
  catch { failure = pre32PhaseFailure("launcher-cleanup"); }
  if (failure) throw failure;
  if (result === undefined) throw pre32PhaseFailure("pair-validation");
  return result;
}

function activeBindingPhaseFailure(phase: Pre32PairPhase, physicalPoint: PhysicalFailurePoint | null = null): Error {
  const error = new Error("INTERNAL_PRODUCTION_POSITIVE_WORKTREE_ACTIVE_BINDING_HOST_PAIR_INVALID");
  Object.defineProperty(error, "activeBindingPairPhase", { value: phase });
  if (physicalPoint !== null && (phase === "physical-first-pass" || phase === "physical-second-pass"))
    Object.defineProperty(error, "activeBindingPhysicalPoint", { value: physicalPoint });
  return Object.freeze(error);
}

/** Zero-input, non-pre32 diagnostic. The launcher privately holds the agreed DB URL. */
export async function observeCodeOwnedPositiveWorktreeActiveBindingHostPairV1() {
  if (arguments.length !== 0) failActiveBinding();
  type Launcher = ReturnType<typeof import("./baseline-deployment-cutover-launcher-observation-v1.js").holdDeploymentCutoverDefaultLauncherV1>;
  let phase: Pre32PairPhase = "launcher-load";
  let launcher: Launcher | undefined;
  let result: Awaited<ReturnType<typeof observePositiveWorktreeActiveBindingHostPairWithPortsV1>> | undefined;
  let failure: Error | null = null;
  let physicalPoint: PhysicalFailurePoint | null = null;
  try {
    const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
    phase = "launcher-acquire";
    launcher = holdDeploymentCutoverDefaultLauncherV1();
    phase = "passive-qualification";
    await launcher.qualifyPassiveHome();
    phase = "pre-physical-recheck";
    launcher.recheck();
    const ownerHomeRoot = userInfo().homedir;
    const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
    phase = "physical-first-pass";
    result = await observePositiveWorktreeActiveBindingHostPairWithPortsV1(
      async betweenPasses => {
        let physical: PhysicalCatalogV2;
        try {
          physical = await observeHeldPositiveWorktreePhysicalCatalogV2({ ownerHomeRoot, workspaceRoot }, async () => {
            phase = "database-callback";
            await betweenPasses();
            phase = "physical-second-pass";
          });
        } catch (error) { physicalPoint = validPhysicalFailurePoint(error, phase); throw error; }
        phase = "pair-validation";
        return physical;
      },
      launcher.activeBindingSnapshot,
    );
    phase = "post-pair-recheck";
    launcher.recheck();
  } catch { failure = activeBindingPhaseFailure(phase, physicalPoint); }
  try { launcher?.close(); }
  catch { failure = activeBindingPhaseFailure("launcher-cleanup"); }
  if (failure) throw failure;
  if (result === undefined) throw activeBindingPhaseFailure("pair-validation");
  return result;
}

/** Zero-input diagnostic: capture first-pass physical roots while the private DB URL is held. */
export async function observeCodeOwnedPositiveWorktreeHeldBindingCandidatesV1() {
  if (arguments.length !== 0) failActiveBinding();
  type Launcher = ReturnType<typeof import("./baseline-deployment-cutover-launcher-observation-v1.js").holdDeploymentCutoverDefaultLauncherV1>;
  let phase: Pre32PairPhase = "launcher-load";
  let launcher: Launcher | undefined;
  let result: Awaited<ReturnType<typeof observePositiveWorktreeHeldBindingCandidatesWithPortsV1>> | undefined;
  let failure: Error | null = null;
  let physicalPoint: PhysicalFailurePoint | null = null;
  try {
    const { holdDeploymentCutoverDefaultLauncherV1 } = await import("./baseline-deployment-cutover-launcher-observation-v1.js");
    phase = "launcher-acquire";
    launcher = holdDeploymentCutoverDefaultLauncherV1();
    phase = "passive-qualification";
    await launcher.qualifyPassiveHome();
    phase = "pre-physical-recheck";
    launcher.recheck();
    const ownerHomeRoot = userInfo().homedir;
    const workspaceRoot = resolveInternalProductionBaselineWorkspaceRootV1();
    phase = "physical-first-pass";
    result = await observePositiveWorktreeHeldBindingCandidatesWithPortsV1(
      async betweenPasses => {
        let physical: PhysicalCatalogV2;
        try {
          physical = await observeHeldPositiveWorktreePhysicalCatalogV2({ ownerHomeRoot, workspaceRoot }, async firstPass => {
            phase = "database-callback";
            await betweenPasses(firstPass);
            phase = "physical-second-pass";
          });
        } catch (error) { physicalPoint = validPhysicalFailurePoint(error, phase); throw error; }
        phase = "pair-validation";
        return physical;
      },
      launcher.activeBindingSnapshot,
    );
    phase = "post-pair-recheck";
    launcher.recheck();
  } catch { failure = activeBindingPhaseFailure(phase, physicalPoint); }
  try { launcher?.close(); }
  catch { failure = activeBindingPhaseFailure("launcher-cleanup"); }
  if (failure) throw failure;
  if (result === undefined) throw activeBindingPhaseFailure("pair-validation");
  return result;
}
