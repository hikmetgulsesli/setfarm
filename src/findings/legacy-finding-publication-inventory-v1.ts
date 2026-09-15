import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";

export const LEGACY_FINDING_PUBLICATION_MAX_SETS_V1 = 4_096;
export const LEGACY_FINDING_PUBLICATION_MAX_CHILDREN_V1 = 65_536;
const INVENTORY_SCHEMA_V1 = "setfarm.legacy-finding-publication-inventory.v1";
const SHA256_V1 = /^[a-f0-9]{64}$/;

export type LegacyFindingPublicationEntryV1 = Readonly<{
  findingSetHash: string;
  publicationHash: string;
  runId: string;
  terminalRunStatus: "completed" | "failed" | "cancelled";
}>;

export type LegacyFindingPublicationInventoryV1 = Readonly<{
  schema: typeof INVENTORY_SCHEMA_V1;
  entries: readonly LegacyFindingPublicationEntryV1[];
  inventoryHash: string;
}>;

// This validates embedded evidence, not admission authority. Only an
// authenticated legacy-zero/migration chain can grant membership provenance.
export function validateLegacyFindingPublicationInventoryV1(input: unknown): LegacyFindingPublicationInventoryV1 {
  try {
    const encoded = canonicalJsonStringify(input);
    if (Buffer.byteLength(encoded, "utf8") > 4_194_304) throw new Error();
    if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error();
    const value = input as Record<string, unknown>;
    if (Object.keys(value).length !== 3 || value.schema !== INVENTORY_SCHEMA_V1
      || !Array.isArray(value.entries) || value.entries.length > LEGACY_FINDING_PUBLICATION_MAX_SETS_V1
      || typeof value.inventoryHash !== "string" || !SHA256_V1.test(value.inventoryHash)) throw new Error();
    const entries: LegacyFindingPublicationEntryV1[] = [];
    const runStatuses = new Map<string, string>();
    for (const raw of value.entries) {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error();
      const entry = raw as Record<string, unknown>;
      if (Object.keys(entry).length !== 4
        || typeof entry.findingSetHash !== "string" || !SHA256_V1.test(entry.findingSetHash)
        || typeof entry.publicationHash !== "string" || !SHA256_V1.test(entry.publicationHash)
        || typeof entry.runId !== "string" || entry.runId.length < 1 || entry.runId.length > 500
        || typeof entry.terminalRunStatus !== "string"
        || !["completed", "failed", "cancelled"].includes(entry.terminalRunStatus)) throw new Error();
      if (entries.length > 0 && entries.at(-1)!.findingSetHash >= entry.findingSetHash) throw new Error();
      const priorStatus = runStatuses.get(entry.runId);
      if (priorStatus !== undefined && priorStatus !== entry.terminalRunStatus) throw new Error();
      runStatuses.set(entry.runId, entry.terminalRunStatus);
      entries.push(Object.freeze({ findingSetHash: entry.findingSetHash, publicationHash: entry.publicationHash,
        runId: entry.runId, terminalRunStatus: entry.terminalRunStatus as LegacyFindingPublicationEntryV1["terminalRunStatus"] }));
    }
    const body = { schema: INVENTORY_SCHEMA_V1, entries: Object.freeze(entries) } as const;
    if (hashCanonicalJson(body) !== value.inventoryHash) throw new Error();
    return Object.freeze({ ...body, inventoryHash: value.inventoryHash });
  } catch {
    throw new Error("LEGACY_FINDING_PUBLICATION_INVENTORY_INVALID");
  }
}

export function createLegacyFindingPublicationInventoryValueV1(
  entries: readonly LegacyFindingPublicationEntryV1[],
): LegacyFindingPublicationInventoryV1 {
  const body = { schema: INVENTORY_SCHEMA_V1, entries };
  return validateLegacyFindingPublicationInventoryV1({ ...body, inventoryHash: hashCanonicalJson(body) });
}

export function requireLegacyFindingPublicationInventoryContinuityV1(
  before: LegacyFindingPublicationInventoryV1 | null,
  after: LegacyFindingPublicationInventoryV1 | null,
): void {
  // A historical V1 observation contains no authenticated memberships.
  const prior = before === null ? [] : validateLegacyFindingPublicationInventoryV1(before).entries;
  const next = after === null ? [] : validateLegacyFindingPublicationInventoryV1(after).entries;
  if (canonicalJsonStringify(prior) !== canonicalJsonStringify(next)) {
    throw new Error("LEGACY_FINDING_PUBLICATION_INVENTORY_DRIFT");
  }
}
