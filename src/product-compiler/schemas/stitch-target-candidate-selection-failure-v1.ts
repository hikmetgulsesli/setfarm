import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  GenerationTargetIdSchema,
} from "./design-generation-targets-v1.js";
import {
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  CandidateEvaluationV1Schema,
  CandidateRejectionCodeV1Schema,
} from "./stitch-target-candidate-selection-v1.js";

const FailureTargetV1Schema = z
  .object({
    targetRef: GenerationTargetIdSchema,
    stageId: z.string().min(1).max(160),
    evaluations: z.array(CandidateEvaluationV1Schema).min(1).max(1_000),
    rejectionCodes: z.array(CandidateRejectionCodeV1Schema).min(1).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    const evaluationIds = value.evaluations.map((evaluation) => evaluation.screenId);
    const sortedEvaluationIds = [...evaluationIds].sort(compareUtf16);
    if (
      !hasUniqueStrings(evaluationIds)
      || evaluationIds.some((screenId, index) => screenId !== sortedEvaluationIds[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["evaluations"],
        message: "Failure target evaluations must be unique and canonically sorted by screen ID",
      });
    }
    const expectedCodes = uniqueSorted(value.evaluations.flatMap((evaluation) => evaluation.rejectionCodes));
    if (!sameStrings(value.rejectionCodes, expectedCodes)) {
      context.addIssue({
        code: "custom",
        path: ["rejectionCodes"],
        message: "Failure target rejection codes must exactly aggregate its candidate evaluations",
      });
    }
  });

const ExpectedDeltaV1Schema = z
  .object({
    kind: z.literal("candidate_authority_change"),
    targetRefs: z.array(GenerationTargetIdSchema).min(1).max(1_000),
    rejectionCodesToClear: z.array(CandidateRejectionCodeV1Schema).min(1).max(20),
    requiredAuthorityHash: z.literal("candidateSelectionHash"),
    fromCandidateSelectionHash: Sha256Schema,
  })
  .strict();

const RetryPolicyV1Schema = z
  .object({
    disposition: z.literal("retry_after_authority_delta"),
    sameAuthorityRetryForbidden: z.literal(true),
    maxAttempts: z.literal(1),
  })
  .strict();

export type StitchTargetCandidateSelectionFailureFingerprintBasisV1 = Readonly<{
  schema: "setfarm.stitch-target-candidate-selection-failure-fingerprint.v1";
  generationTargetsHash: string;
  directResponseEvidenceHash: string;
  candidateSelectionHash: string;
  targetFailures: z.infer<typeof FailureTargetV1Schema>[];
  expectedDelta: z.infer<typeof ExpectedDeltaV1Schema>;
  owner: "stitch_generation_orchestrator";
  retry: z.infer<typeof RetryPolicyV1Schema>;
}>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function stitchTargetCandidateSelectionFailureFingerprintBasisV1(
  value: Omit<StitchTargetCandidateSelectionFailureV1, "fingerprint">,
): StitchTargetCandidateSelectionFailureFingerprintBasisV1 {
  return {
    schema: "setfarm.stitch-target-candidate-selection-failure-fingerprint.v1",
    generationTargetsHash: value.generationTargetsHash,
    directResponseEvidenceHash: value.directResponseEvidenceHash,
    candidateSelectionHash: value.candidateSelectionHash,
    targetFailures: value.targetFailures,
    expectedDelta: value.expectedDelta,
    owner: value.owner,
    retry: value.retry,
  };
}

export const StitchTargetCandidateSelectionFailureV1Schema = z
  .object({
    schema: z.literal("setfarm.stitch-target-candidate-selection-failure.v1"),
    generationTargetsHash: Sha256Schema,
    directResponseEvidenceHash: Sha256Schema,
    candidateSelectionHash: Sha256Schema,
    targetFailures: z.array(FailureTargetV1Schema).min(1).max(1_000),
    expectedDelta: ExpectedDeltaV1Schema,
    owner: z.literal("stitch_generation_orchestrator"),
    retry: RetryPolicyV1Schema,
    fingerprint: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const targetRefs = value.targetFailures.map((failure) => failure.targetRef);
    const sortedTargetRefs = [...targetRefs].sort(compareUtf16);
    if (
      !hasUniqueStrings(targetRefs)
      || targetRefs.some((targetRef, index) => targetRef !== sortedTargetRefs[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["targetFailures"],
        message: "Failure targets must be unique and canonically sorted by target ref",
      });
    }
    const expectedCodes = uniqueSorted(value.targetFailures.flatMap((failure) => failure.rejectionCodes));
    if (!sameStrings(value.expectedDelta.targetRefs, sortedTargetRefs)) {
      context.addIssue({
        code: "custom",
        path: ["expectedDelta", "targetRefs"],
        message: "Expected delta target refs must exactly equal the failed target set",
      });
    }
    if (!sameStrings(value.expectedDelta.rejectionCodesToClear, expectedCodes)) {
      context.addIssue({
        code: "custom",
        path: ["expectedDelta", "rejectionCodesToClear"],
        message: "Expected delta rejection codes must exactly equal the failed invariant set",
      });
    }
    if (value.expectedDelta.fromCandidateSelectionHash !== value.candidateSelectionHash) {
      context.addIssue({
        code: "custom",
        path: ["expectedDelta", "fromCandidateSelectionHash"],
        message: "Expected delta must start from the exact failed candidate selection authority",
      });
    }
    const expectedFingerprint = hashCanonicalJson(
      stitchTargetCandidateSelectionFailureFingerprintBasisV1(value),
    );
    if (value.fingerprint !== expectedFingerprint) {
      context.addIssue({
        code: "custom",
        path: ["fingerprint"],
        message: "Failure fingerprint must hash only its canonical authority, evaluations, delta, owner, and retry policy",
      });
    }
  });

export type StitchTargetCandidateSelectionFailureV1 = z.infer<
  typeof StitchTargetCandidateSelectionFailureV1Schema
>;
