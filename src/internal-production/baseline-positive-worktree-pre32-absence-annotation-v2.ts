import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { observeCodeOwnedPositiveWorktreePre32HostPairV7,
  observePositiveWorktreePre32HostPairWithPortsV7 } from "./baseline-positive-worktree-host-pair-v2.js";
import { projectPositiveWorktreePrunableAbsenceWitnessV3 } from "./baseline-positive-worktree-prunable-absence-witness-v3.js";

// V7 exact-journal interval only. Witnessed absence is never positive owner evidence.
const SCHEMA = "setfarm.internal-production-pre32-absent-git-record-annotation.v2";
type Pair = Awaited<ReturnType<typeof observePositiveWorktreePre32HostPairWithPortsV7>>;

function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_PRE32_ABSENT_GIT_RECORD_ANNOTATION_V2_INVALID");
}

function annotate(pair: Pair) {
  if (pair.schema !== "setfarm.internal-production-pre32-physical-database-pair.v7"
    || pair.authority !== "diagnostic-only" || pair.physicalIdentityProvenance !== "unverified"
    || pair.pre32Database.journalIdentity !== "source-ordinal-name-checksum-state-1-through-31"
    || pair.pre32Database.lockState !== "released-at-return") fail();
  const witness = projectPositiveWorktreePrunableAbsenceWitnessV3(pair.heldPair);
  if (witness.hostPair !== pair.heldPair || witness.sourcePairHash !== pair.heldPair.pairHash
    || witness.sourceCatalogHash !== pair.heldPair.physicalCatalog.catalogHash) fail();
  const witnessedRoots = new Set(witness.witnesses.map(entry => entry.root));
  if (witnessedRoots.size !== witness.witnesses.length) fail();
  const matchedRoots = new Set<string>();
  const witnessedBlockers: typeof pair.heldPair.physicalCatalog.blockers[number][] = [];
  const remainingBlockers: typeof pair.heldPair.physicalCatalog.blockers[number][] = [];
  for (const blocker of pair.heldPair.physicalCatalog.blockers) {
    if (blocker.reason === "prunable-git-worktree" && witnessedRoots.has(blocker.root)) {
      witnessedBlockers.push(blocker);
      matchedRoots.add(blocker.root);
    } else remainingBlockers.push(blocker);
  }
  if (matchedRoots.size !== witnessedRoots.size
    || witnessedBlockers.length + remainingBlockers.length !== pair.heldPair.physicalCatalog.blockers.length) fail();
  const body = Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const, sourcePair: pair, witness,
    witnessedBlockers: Object.freeze(witnessedBlockers),
    remainingBlockers: Object.freeze(remainingBlockers) });
  return Object.freeze({ ...body, annotationHash: hashCanonicalJson(body) });
}

/** The V7 producer validates its journal, rows and physical catalog in one held interval. */
export async function observePositiveWorktreePre32AbsenceAnnotationWithPortsV2(
  physical: Parameters<typeof observePositiveWorktreePre32HostPairWithPortsV7>[0],
  database: Parameters<typeof observePositiveWorktreePre32HostPairWithPortsV7>[1],
) {
  return annotate(await observePositiveWorktreePre32HostPairWithPortsV7(physical, database));
}

/** Authenticated zero-input host path; retains V7 launcher and refusal rules. */
export async function observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV2() {
  if (arguments.length !== 0) fail();
  return annotate(await observeCodeOwnedPositiveWorktreePre32HostPairV7());
}
