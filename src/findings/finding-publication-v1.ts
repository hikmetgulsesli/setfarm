import { FindingSetV1Schema, type FindingSetV1 } from "./finding-set.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";

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
