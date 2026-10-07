import { types } from "node:util";
import type postgres from "postgres";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { verifyHeldPre32ContractSpineJournalIdentityV1 } from "./contract-spine-migrations.js";
import { observeHeldColdPre32LegacyDatabaseCensusV2 } from "../internal-production/baseline-legacy-database-census-v1.js";
import { validateLegacyFindingPublicationInventoryV1 } from "../findings/legacy-finding-publication-inventory-v1.js";
import { observeDashboardCoreReadonlyProfileV2, type DashboardCoreReadonlyProfileV2 } from "./dashboard-core-readonly-profile-v2.js";

// Retained observations only: the caller owns qualified snapshot/locks/lifecycle.
export type DashboardCoreReadonlyQualificationV2 = Readonly<{
  schema: "setfarm.dashboard-core-readonly-qualification.v2";
  profile: DashboardCoreReadonlyProfileV2;
  censusHash: string;
}>;
const issued = new WeakSet<object>();
const counts = "activeRunCount openClaimCount executionAttemptCount activeRuntimeSessionCount activeCompletionOwnerCount unsettledMandatoryEffectCount artifactReservationCount publicationBatchCount artifactPublicationCount terminationOwnerCount findingOwnerCount recoveryOwnerCount operationalDeliveryCount".split(" ");
function refuse(): never { throw new Error("DASHBOARD_CORE_READONLY_QUALIFICATION_REFUSED"); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || types.isProxy(value)) refuse();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) refuse();
  const copied: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) refuse();
    Object.defineProperty(copied, key, { value: descriptor.value, enumerable: true });
  }
  return copied;
}
function journalRows(value: unknown, count: number, keys: readonly string[]): Record<string, unknown>[] {
  if (value === null || typeof value !== "object" || types.isProxy(value) || !Array.isArray(value)) refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertyDescriptor(value, "length")?.value !== count) refuse();
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") refuse();
    if (key !== "length" && (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= count)
      && descriptors[key]!.enumerable) refuse();
  }
  const copied: Record<string, unknown>[] = [];
  for (let index = 0; index < count; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) refuse();
    const row = record(descriptor.value, keys);
    for (const item of Object.values(row)) {
      if (typeof item === "number" && Number.isSafeInteger(item)) continue;
      if (typeof item !== "string" || item.includes("\0")
        || Buffer.from(item, "utf8").toString("utf8") !== item) refuse();
    }
    copied.push(Object.freeze(row));
  }
  return copied;
}
const TAIL_SQL = "SELECT version,state FROM public.setfarm_schema_migrations WHERE version >= 26 ORDER BY version";
export async function observeDashboardCoreReadonlyQualificationV2(
  originalTransaction: postgres.TransactionSql,
  previous?: DashboardCoreReadonlyQualificationV2,
): Promise<DashboardCoreReadonlyQualificationV2> {
  try {
    if (arguments.length > 2 || (previous !== undefined && (previous === null
      || typeof previous !== "object" || types.isProxy(previous) || !issued.has(previous)))) refuse();
    if (typeof originalTransaction !== "function" || types.isProxy(originalTransaction)) refuse();
    const profile = await observeDashboardCoreReadonlyProfileV2(originalTransaction, previous?.profile);
    async function query(statement: string, parameters: readonly number[], count: number, keys: readonly string[]) {
      const pending = originalTransaction.unsafe(statement, [...parameters]);
      if (pending !== null && (typeof pending === "object" || typeof pending === "function") && types.isProxy(pending)) refuse();
      return journalRows(await pending, count, keys);
    }
    await verifyHeldPre32ContractSpineJournalIdentityV1((statement, parameters) =>
      query(statement, parameters, 31, ["version", "name", "checksum", "state"]));
    const tail = await query(TAIL_SQL, [], 6, ["version", "state"]);
    if (tail.some((row, index) => row.version !== index + 26 || row.state !== "applied")) refuse();
    // The retained census needs the same callable tagged-query surface. This
    // type adaptation supplies no new driver or acquisition capability.
    const census = record(await observeHeldColdPre32LegacyDatabaseCensusV2(
      originalTransaction as unknown as postgres.Sql), [...counts, "legacyFindingPublicationInventory"]);
    const normalized: Record<string, unknown> = {};
    for (const key of counts) {
      if (typeof census[key] !== "number" || !Object.is(census[key], 0)) refuse();
      normalized[key] = 0;
    }
    normalized.legacyFindingPublicationInventory = validateLegacyFindingPublicationInventoryV1(census.legacyFindingPublicationInventory);
    const censusHash = hashCanonicalJson(normalized);
    if (previous && previous.censusHash !== censusHash) refuse();
    const snapshot = Object.freeze({ schema: "setfarm.dashboard-core-readonly-qualification.v2" as const, profile, censusHash });
    issued.add(snapshot);
    return snapshot;
  } catch { refuse(); }
}
