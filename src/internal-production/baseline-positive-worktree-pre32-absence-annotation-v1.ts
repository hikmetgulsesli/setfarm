import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { observeCodeOwnedPositiveWorktreePre32HostPairV6,
  observePositiveWorktreePre32HostPairWithPortsV6 } from "./baseline-positive-worktree-host-pair-v2.js";
import { projectPositiveWorktreePrunableAbsenceWitnessV3 } from "./baseline-positive-worktree-prunable-absence-witness-v3.js";

// A same-interval diagnostic annotation. Absent Git records are not current owner evidence.
const SCHEMA = "setfarm.internal-production-pre32-absent-git-record-annotation.v1";
type Pair = Awaited<ReturnType<typeof observePositiveWorktreePre32HostPairWithPortsV6>>;

function fail(): never {
  throw new Error("INTERNAL_PRODUCTION_PRE32_ABSENT_GIT_RECORD_ANNOTATION_INVALID");
}

function annotate(pair: Pair) {
  const witness = projectPositiveWorktreePrunableAbsenceWitnessV3(pair.heldPair);
  if (witness.hostPair !== pair.heldPair || witness.sourcePairHash !== pair.heldPair.pairHash
    || witness.sourceCatalogHash !== pair.heldPair.physicalCatalog.catalogHash) fail();
  const witnessedRoots = new Set(witness.witnesses.map((entry) => entry.root));
  if (witnessedRoots.size !== witness.witnesses.length) fail();
  const matchedRoots = new Set<string>();
  const witnessedBlockers: typeof pair.heldPair.physicalCatalog.blockers[number][] = [];
  const remainingBlockers: typeof pair.heldPair.physicalCatalog.blockers[number][] = [];
  for (const blocker of pair.heldPair.physicalCatalog.blockers) {
    if (blocker.reason === "prunable-git-worktree" && witnessedRoots.has(blocker.root)) {
      witnessedBlockers.push(blocker);
      matchedRoots.add(blocker.root);
    } else {
      remainingBlockers.push(blocker);
    }
  }
  if (matchedRoots.size !== witnessedRoots.size
    || witnessedBlockers.length + remainingBlockers.length !== pair.heldPair.physicalCatalog.blockers.length) fail();
  const body = Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
    physicalIdentityProvenance: "unverified" as const, sourcePair: pair, witness,
    witnessedBlockers: Object.freeze(witnessedBlockers),
    remainingBlockers: Object.freeze(remainingBlockers) });
  return Object.freeze({ ...body, annotationHash: hashCanonicalJson(body) });
}

/** The existing V6 producer validates both observations in one held interval. */
export async function observePositiveWorktreePre32AbsenceAnnotationWithPortsV1(
  physical: Parameters<typeof observePositiveWorktreePre32HostPairWithPortsV6>[0],
  database: Parameters<typeof observePositiveWorktreePre32HostPairWithPortsV6>[1],
) {
  return annotate(await observePositiveWorktreePre32HostPairWithPortsV6(physical, database));
}

/** Authenticated zero-input host path; retains the same V6 launcher and failure rules. */
export async function observeCodeOwnedPositiveWorktreePre32AbsenceAnnotationV1() {
  if (arguments.length !== 0) fail();
  return annotate(await observeCodeOwnedPositiveWorktreePre32HostPairV6());
}
