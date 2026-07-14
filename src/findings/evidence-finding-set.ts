import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { computeEvidenceBundleHash, EvidenceBundleV2Schema, type EvidenceBundleV2 } from "../evidence/evidence-bundle-v2.js";
import { createFindingSetV1, type FindingSetV1, type FindingV1 } from "./finding-set.js";
import { ImplementationSliceV1Schema, type ImplementationSliceV1 } from "../product-compiler/schemas/implementation-slice-v1.js";
import { topologyPathAbsenceHash } from "../product-compiler/schemas/build-topology-v1.js";

function contentHash(workdir: string, relative: string): string {
  const root = path.resolve(workdir);
  const absolute = path.resolve(root, relative);
  if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`EVIDENCE_FINDING_SOURCE_PATH_ESCAPE:${relative}`);
  }
  try {
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile()) throw new Error(`EVIDENCE_FINDING_SOURCE_NOT_FILE:${relative}`);
    return createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return topologyPathAbsenceHash(relative);
    }
    throw error;
  }
}

function findingOrigin(predicate: EvidenceBundleV2["predicates"][number]): FindingV1["origin"] {
  if (predicate.invariantRef === "INV_COMMAND_BUILD") return "build";
  if (predicate.invariantRef === "INV_COMMAND_TEST") return "test";
  return "runtime";
}

/**
 * Convert canonical non-passing predicates into one immutable FindingSet.
 * Source locators are an exact snapshot of the story's compiler-declared
 * writable surface, never paths proposed by an agent or review comment.
 */
export function createFindingSetFromEvidenceBundleV2(input: Readonly<{
  workdir: string;
  slice: ImplementationSliceV1;
  sliceHash: string;
  bundle: EvidenceBundleV2;
}>): FindingSetV1 | undefined {
  const slice = ImplementationSliceV1Schema.parse(input.slice);
  const bundle = EvidenceBundleV2Schema.parse(input.bundle);
  if (
    bundle.storyId !== slice.storyId
    || bundle.packetHash !== slice.packetHash
    || bundle.sliceHash !== input.sliceHash
  ) {
    throw new Error("EVIDENCE_FINDING_CONTRACT_IDENTITY_MISMATCH");
  }
  const nonPassing = bundle.predicates.filter((predicate) => predicate.required && predicate.verdict !== "pass");
  if (nonPassing.length === 0) return undefined;

  const writable = slice.files
    .filter((file) => file.role === "owned" || file.role === "shared_writable")
    .sort((left, right) => left.path.localeCompare(right.path));
  const locatable = writable.length > 0
    ? writable
    : slice.files.filter((file) => file.role !== "dependency").sort((left, right) => left.path.localeCompare(right.path));
  if (locatable.length === 0) throw new Error("EVIDENCE_FINDING_SOURCE_AUTHORITY_MISSING");
  if (locatable.length > 1_000) throw new Error("EVIDENCE_FINDING_SOURCE_AUTHORITY_TOO_BROAD");
  const sourceLocators = locatable.map((file) => ({
    path: file.path,
    contentHash: contentHash(input.workdir, file.path),
  }));
  const bundleHash = computeEvidenceBundleHash(bundle);
  return createFindingSetV1({
    runId: bundle.runId,
    storyId: bundle.storyId,
    packetHash: bundle.packetHash,
    sliceHash: bundle.sliceHash,
    sourceRevision: bundle.sourceRevision,
    findings: nonPassing.map((predicate) => ({
      origin: findingOrigin(predicate),
      classification: "structured" as const,
      invariantRef: predicate.invariantRef,
      sourceLocators,
      observedEvidenceRefs: [bundleHash],
      expectedPredicateRef: predicate.predicateRef,
      status: "open" as const,
    })),
  });
}
