import { FindingSetV1Schema, type FindingSetV1 } from "./finding-set.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  createLegacyFindingPublicationInventoryValueV1,
  LEGACY_FINDING_PUBLICATION_MAX_SETS_V1,
  LEGACY_FINDING_PUBLICATION_MAX_CHILDREN_V1,
  type LegacyFindingPublicationEntryV1,
  type LegacyFindingPublicationInventoryV1,
} from "./legacy-finding-publication-inventory-v1.js";

export type FindingPublicationParentRowV1 = Readonly<{
  finding_set_hash: string;
  finding_set_id: string;
  run_id: string;
  story_id: string;
  packet_hash: string;
  slice_hash: string;
  source_sha: string;
  source_tree_hash: string;
  finding_ids: unknown;
  payload: unknown;
}>;

export type FindingPublicationChildRowV1 = Readonly<{
  finding_set_hash: string;
  finding_id: string;
  origin: string;
  classification: string;
  invariant_ref: string;
  status: string;
  source_fingerprint: string;
  payload: unknown;
}>;

// Publication completion is independent of issue or run status. Legacy
// admission provenance and terminal-run eligibility are separate authorities.
export function requireFindingPublicationV1(
  parent: FindingPublicationParentRowV1,
  children: readonly FindingPublicationChildRowV1[],
): FindingSetV1 {
  try {
    const value = FindingSetV1Schema.parse(parent.payload);
    if (
      parent.finding_set_hash !== value.findingSetHash
      || parent.finding_set_id !== value.findingSetId
      || parent.run_id !== value.runId
      || parent.story_id !== value.storyId
      || parent.packet_hash !== value.packetHash
      || parent.slice_hash !== value.sliceHash
      || parent.source_sha !== value.sourceRevision.sha
      || parent.source_tree_hash !== value.sourceRevision.treeHash
      || canonicalJsonStringify(parent.finding_ids) !== canonicalJsonStringify(value.findings.map((finding) => finding.findingId))
      || canonicalJsonStringify(parent.payload) !== canonicalJsonStringify(value)
      || children.length !== value.findings.length
    ) throw new Error("FINDING_PUBLICATION_INVALID");
    const ordered = [...children].sort((left, right) => left.finding_id < right.finding_id ? -1 : left.finding_id > right.finding_id ? 1 : 0);
    if (ordered.some((row, index) => {
      const finding = value.findings[index]!;
      return row.finding_set_hash !== value.findingSetHash
        || row.finding_id !== finding.findingId
        || row.origin !== finding.origin
        || row.classification !== finding.classification
        || row.invariant_ref !== finding.invariantRef
        || row.status !== finding.status
        || row.source_fingerprint !== hashCanonicalJson(finding.sourceLocators)
        || canonicalJsonStringify(row.payload) !== canonicalJsonStringify(finding);
    })) throw new Error("FINDING_PUBLICATION_INVALID");
    return value;
  } catch {
    throw new Error("FINDING_PUBLICATION_INVALID");
  }
}

export function observeLegacyFindingPublicationInventoryV1(
  parents: readonly FindingPublicationParentRowV1[],
  children: readonly FindingPublicationChildRowV1[],
  runs: readonly Readonly<{ id: string; status: string }>[],
): LegacyFindingPublicationInventoryV1 {
  if (parents.length > LEGACY_FINDING_PUBLICATION_MAX_SETS_V1
    || children.length > LEGACY_FINDING_PUBLICATION_MAX_CHILDREN_V1
    || runs.length > LEGACY_FINDING_PUBLICATION_MAX_SETS_V1) throw new Error("LEGACY_FINDING_PUBLICATION_INVENTORY_LIMIT");
  const runById = new Map<string, string>();
  for (const run of runs) {
    if (runById.has(run.id) || !["completed", "failed", "cancelled"].includes(run.status)) {
      throw new Error("LEGACY_FINDING_PUBLICATION_TERMINAL_RUN_INVALID");
    }
    runById.set(run.id, run.status);
  }
  const bySet = new Map<string, FindingPublicationChildRowV1[]>();
  for (const parent of parents) {
    if (bySet.has(parent.finding_set_hash)) throw new Error("LEGACY_FINDING_PUBLICATION_PARENT_DUPLICATE");
    bySet.set(parent.finding_set_hash, []);
  }
  for (const child of children) {
    const members = bySet.get(child.finding_set_hash);
    if (!members) throw new Error("LEGACY_FINDING_PUBLICATION_ORPHAN_CHILD");
    members.push(child);
  }
  const requiredRuns = new Set(parents.map((parent) => parent.run_id));
  if (requiredRuns.size !== runById.size || [...requiredRuns].some((id) => !runById.has(id))) {
    throw new Error("LEGACY_FINDING_PUBLICATION_TERMINAL_RUN_INVALID");
  }
  const entries = parents.map((parent): LegacyFindingPublicationEntryV1 => {
    const value = requireFindingPublicationV1(parent, bySet.get(parent.finding_set_hash)!);
    return { findingSetHash: value.findingSetHash,
      publicationHash: hashCanonicalJson({ schema: "setfarm.finding-publication.v1", findingSet: value }),
      runId: value.runId, terminalRunStatus: runById.get(value.runId)! as LegacyFindingPublicationEntryV1["terminalRunStatus"] };
  }).sort((left, right) => left.findingSetHash < right.findingSetHash ? -1 : left.findingSetHash > right.findingSetHash ? 1 : 0);
  return createLegacyFindingPublicationInventoryValueV1(entries);
}
