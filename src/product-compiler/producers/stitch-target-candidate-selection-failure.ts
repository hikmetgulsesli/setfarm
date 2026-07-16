import { hashCanonicalJson } from "../canonical-json.js";
import {
  StitchTargetCandidateSelectionFailureV1Schema,
  stitchTargetCandidateSelectionFailureFingerprintBasisV1,
  type StitchTargetCandidateSelectionFailureV1,
} from "../schemas/stitch-target-candidate-selection-failure-v1.js";
import type {
  StitchTargetCandidateSelectionV1,
} from "../schemas/stitch-target-candidate-selection-v1.js";

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareUtf16);
}

/**
 * Seals an unresolved selection as an operationally actionable failure. The
 * fingerprint excludes diagnostics and other prose so wording changes cannot
 * create a new retry identity on unchanged authority.
 */
export function produceStitchTargetCandidateSelectionFailureV1(
  candidateSelection: StitchTargetCandidateSelectionV1,
): StitchTargetCandidateSelectionFailureV1 {
  const targetFailures = candidateSelection.selections
    .filter((selection) => selection.status === "unresolved")
    .map((selection) => ({
      targetRef: selection.targetRef,
      stageId: selection.stageId,
      evaluations: [...selection.evaluations].sort((left, right) =>
        compareUtf16(left.screenId, right.screenId)),
      rejectionCodes: uniqueSorted(selection.evaluations.flatMap((evaluation) =>
        evaluation.rejectionCodes)),
    }))
    .sort((left, right) => compareUtf16(left.targetRef, right.targetRef));
  if (targetFailures.length === 0) {
    throw new TypeError("A Stitch target candidate selection failure requires at least one unresolved target");
  }

  const candidateSelectionHash = hashCanonicalJson(candidateSelection);
  const valueWithoutFingerprint: Omit<StitchTargetCandidateSelectionFailureV1, "fingerprint"> = {
    schema: "setfarm.stitch-target-candidate-selection-failure.v1",
    generationTargetsHash: candidateSelection.generationTargetsHash,
    directResponseEvidenceHash: candidateSelection.directResponseEvidenceHash,
    candidateSelectionHash,
    targetFailures,
    expectedDelta: {
      kind: "candidate_authority_change",
      targetRefs: targetFailures.map((failure) => failure.targetRef),
      rejectionCodesToClear: uniqueSorted(targetFailures.flatMap((failure) => failure.rejectionCodes)),
      requiredAuthorityHash: "candidateSelectionHash",
      fromCandidateSelectionHash: candidateSelectionHash,
    },
    owner: "stitch_generation_orchestrator",
    retry: {
      disposition: "retry_after_authority_delta",
      sameAuthorityRetryForbidden: true,
      maxAttempts: 1,
    },
  };
  return StitchTargetCandidateSelectionFailureV1Schema.parse({
    ...valueWithoutFingerprint,
    fingerprint: hashCanonicalJson(
      stitchTargetCandidateSelectionFailureFingerprintBasisV1(valueWithoutFingerprint),
    ),
  });
}
