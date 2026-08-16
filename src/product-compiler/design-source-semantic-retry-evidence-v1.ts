import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonBytes, canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  ProductCompilationAttemptArtifactRefV1Schema,
  type ProductCompilationAttemptArtifactRefV1,
} from "./product-compilation-attempt-workspace.js";
import { GenerationTargetIdSchema } from "./schemas/design-generation-targets-v1.js";
import { Sha256Schema } from "./schemas/common-v1.js";
import {
  StitchCandidateRejectionCodeV2Schema,
  StitchCandidateSemanticCheckV2Schema,
  StitchTargetCandidateSelectionV2Schema,
  type StitchTargetCandidateSelectionV2,
} from "./schemas/stitch-target-candidate-selection-v2.js";
import { StitchRenderedCandidateFailureCodeV2Schema } from "./schemas/stitch-rendered-semantics-v2.js";

export const DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1 = Object.freeze({
  schema: "setfarm.design-source-semantic-retry-evidence-policy.v1" as const,
  maximumStages: 200,
  maximumTargetsPerStage: 100,
  maximumRequirementsPerTarget: 200,
  maximumObservationsPerRequirement: 8,
  maximumCanonicalBytes: 512 * 1024,
  maximumCorrectionRecordsPerStage: 400,
  maximumCorrectionBytesPerStage: 64 * 1024,
});

const RetryObservationV1Schema = z.object({
  disposition: z.enum(["missing", "duplicate", "unexpected", "mismatch"]),
  observedCount: z.number().int().nonnegative().max(10_000),
  observedValueHash: Sha256Schema.nullable(),
}).strict();

const RetryRequirementV1Schema = z.object({
  kind: StitchCandidateSemanticCheckV2Schema.shape.kind,
  semanticRef: z.string().min(1).max(1_000),
  expectedCount: z.number().int().nonnegative().max(10_000),
  expectedValue: z.string().max(2_000).nullable(),
  observations: z.array(RetryObservationV1Schema)
    .min(1)
    .max(DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1.maximumObservationsPerRequirement),
}).strict().superRefine((value, context) => {
  if (value.observations.some((observation, index) => index > 0
    && compareUtf16(
      canonicalJsonStringify(observation),
      canonicalJsonStringify(value.observations[index - 1]),
    ) <= 0)) {
    context.addIssue({
      code: "custom",
      path: ["observations"],
      message: "DESIGN_SOURCE_SEMANTIC_RETRY_OBSERVATIONS_NOT_CANONICAL",
    });
  }
});

const RetryTargetV1Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  rejectionCodes: z.array(StitchCandidateRejectionCodeV2Schema).max(32),
  renderedFailureCodes: z.array(StitchRenderedCandidateFailureCodeV2Schema).max(8),
  requirements: z.array(RetryRequirementV1Schema)
    .max(DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1.maximumRequirementsPerTarget),
}).strict().superRefine((value, context) => {
  if (value.rejectionCodes.some((code, index) => index > 0
    && compareUtf16(code, value.rejectionCodes[index - 1]!) <= 0)) {
    context.addIssue({
      code: "custom",
      path: ["rejectionCodes"],
      message: "DESIGN_SOURCE_SEMANTIC_RETRY_REJECTION_CODES_NOT_CANONICAL",
    });
  }
  if (value.renderedFailureCodes.some((code, index) => index > 0
    && compareUtf16(code, value.renderedFailureCodes[index - 1]!) <= 0)) {
    context.addIssue({
      code: "custom",
      path: ["renderedFailureCodes"],
      message: "DESIGN_SOURCE_SEMANTIC_RETRY_RENDERED_FAILURE_CODES_NOT_CANONICAL",
    });
  }
  if (value.requirements.some((requirement, index) => index > 0 && (
    compareUtf16(requirement.kind, value.requirements[index - 1]!.kind) < 0
    || (requirement.kind === value.requirements[index - 1]!.kind
      && compareUtf16(requirement.semanticRef, value.requirements[index - 1]!.semanticRef) <= 0)
  ))) {
    context.addIssue({
      code: "custom",
      path: ["requirements"],
      message: "DESIGN_SOURCE_SEMANTIC_RETRY_REQUIREMENTS_NOT_CANONICAL",
    });
  }
});

const RetryStageV1Schema = z.object({
  stageId: z.string().regex(/^DSGS_[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/),
  targets: z.array(RetryTargetV1Schema)
    .min(1)
    .max(DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1.maximumTargetsPerStage),
}).strict().superRefine((value, context) => {
  if (value.targets.some((target, index) => index > 0
    && compareUtf16(target.targetRef, value.targets[index - 1]!.targetRef) <= 0)) {
    context.addIssue({
      code: "custom",
      path: ["targets"],
      message: "DESIGN_SOURCE_SEMANTIC_RETRY_TARGETS_NOT_CANONICAL",
    });
  }
});

export const DesignSourceSemanticRetryEvidenceV1Schema = z.object({
  schema: z.literal("setfarm.design-source-semantic-retry-evidence.v1"),
  policyHash: Sha256Schema,
  candidateSelectionArtifact: ProductCompilationAttemptArtifactRefV1Schema,
  stages: z.array(RetryStageV1Schema)
    .min(1)
    .max(DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1.maximumStages),
}).strict().superRefine((value, context) => {
  if (value.stages.some((stage, index) => index > 0
    && compareUtf16(stage.stageId, value.stages[index - 1]!.stageId) <= 0)) {
    context.addIssue({
      code: "custom",
      path: ["stages"],
      message: "DESIGN_SOURCE_SEMANTIC_RETRY_STAGES_NOT_CANONICAL",
    });
  }
});

export type DesignSourceSemanticRetryEvidenceV1 = z.infer<
  typeof DesignSourceSemanticRetryEvidenceV1Schema
>;

type MutableRequirement = {
  kind: z.infer<typeof StitchCandidateSemanticCheckV2Schema>["kind"];
  semanticRef: string;
  expectedCount: number;
  expectedValue: string | null;
  observations: Map<string, z.infer<typeof RetryObservationV1Schema>>;
};

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function observedValueHash(value: string | undefined): string | null {
  if (value === undefined) return null;
  return hashCanonicalJson({
    schema: "setfarm.design-source-semantic-retry-observed-value.v1",
    value,
  });
}

const CODE_OWNED_UNDECLARED_RETRY_REF_BY_KIND = Object.freeze({
  undeclared_action: "UNDECLARED_ACTION",
  undeclared_action_input: "UNDECLARED_ACTION_INPUT",
  undeclared_control_slot: "UNDECLARED_CONTROL_SLOT",
  undeclared_interactive: "UNDECLARED_INTERACTIVE",
  undeclared_observable: "UNDECLARED_OBSERVABLE",
  undeclared_surface: "UNDECLARED_SURFACE",
} as const);

function semanticRetryRef(kind: string, semanticRef: string): string {
  const codeOwnedUndeclaredRef = CODE_OWNED_UNDECLARED_RETRY_REF_BY_KIND[
    kind as keyof typeof CODE_OWNED_UNDECLARED_RETRY_REF_BY_KIND
  ];
  if (codeOwnedUndeclaredRef !== undefined) return codeOwnedUndeclaredRef;
  const withoutElementRefs = semanticRef
    .replace(/@E[0-9]{6}(?=@|$)/g, "")
    .replace(/^E[0-9]{6}@?/, "");
  return withoutElementRefs || kind.toUpperCase();
}

export function parseDesignSourceSemanticRetryEvidenceV1(
  value: unknown,
): DesignSourceSemanticRetryEvidenceV1 {
  const snapshot = JSON.parse(canonicalJsonBytesBounded(value, {
    maxBytes: DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1.maximumCanonicalBytes,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  }).toString("utf8"));
  const parsed = DesignSourceSemanticRetryEvidenceV1Schema.parse(snapshot);
  if (parsed.policyHash !== hashCanonicalJson(DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1)) {
    throw new Error("DESIGN_SOURCE_SEMANTIC_RETRY_POLICY_HASH_MISMATCH");
  }
  if (canonicalJsonBytes(parsed).byteLength > DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1.maximumCanonicalBytes) {
    throw new Error("DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_CAPACITY_EXCEEDED");
  }
  return parsed;
}

export function projectDesignSourceSemanticRetryEvidenceV1(input: Readonly<{
  candidateSelection: StitchTargetCandidateSelectionV2;
  candidateSelectionArtifact: ProductCompilationAttemptArtifactRefV1;
}>): DesignSourceSemanticRetryEvidenceV1 | null {
  const candidateSelection = StitchTargetCandidateSelectionV2Schema.parse(input.candidateSelection);
  const candidateSelectionArtifact = ProductCompilationAttemptArtifactRefV1Schema.parse(
    input.candidateSelectionArtifact,
  );
  const candidateSelectionBytes = canonicalJsonBytes(candidateSelection);
  if (
    candidateSelectionArtifact.area !== "selection"
    || candidateSelectionArtifact.locator !== "candidate-selection.json"
    || candidateSelectionArtifact.contentHash !== hashCanonicalJson(candidateSelection)
    || candidateSelectionArtifact.byteLength !== candidateSelectionBytes.byteLength
  ) {
    return null;
  }
  const candidateById = new Map(candidateSelection.candidates.map((candidate) => [candidate.screenId, candidate]));
  const unresolved = candidateSelection.selections.filter((selection) => selection.status === "unresolved");
  const byStage = new Map<string, typeof unresolved>();
  let expectationConflict = false;
  for (const selection of unresolved) {
    const selections = byStage.get(selection.stageId) ?? [];
    selections.push(selection);
    byStage.set(selection.stageId, selections);
  }
  const stages = [...byStage.entries()]
    .sort(([left], [right]) => compareUtf16(left, right))
    .map(([stageId, selections]) => ({
      stageId,
      targets: [...selections]
        .sort((left, right) => compareUtf16(left.targetRef, right.targetRef))
        .map((selection) => {
          const requirements = new Map<string, MutableRequirement>();
          for (const evaluation of selection.evaluations) {
            for (const check of evaluation.semanticChecks) {
              if (check.disposition === "exact") continue;
              const semanticRef = semanticRetryRef(check.kind, check.semanticRef);
              const key = `${check.kind}\0${semanticRef}`;
              const expectedValue = check.expectedValue ?? null;
              const existing = requirements.get(key);
              if (
                existing
                && (existing.expectedCount !== check.expectedCount || existing.expectedValue !== expectedValue)
              ) {
                expectationConflict = true;
                continue;
              }
              const requirement = existing ?? {
                kind: check.kind,
                semanticRef,
                expectedCount: check.expectedCount,
                expectedValue,
                observations: new Map(),
              };
              const observation = {
                disposition: check.disposition,
                observedCount: check.observedCount,
                observedValueHash: observedValueHash(check.observedValue),
              };
              requirement.observations.set(canonicalJsonStringify(observation), observation);
              requirements.set(key, requirement);
            }
          }
          const evaluatedCandidates = selection.evaluations
            .map((evaluation) => candidateById.get(evaluation.screenId))
            .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
          return {
            targetRef: selection.targetRef,
            rejectionCodes: uniqueSorted(selection.evaluations.flatMap((evaluation) => evaluation.rejectionCodes)),
            renderedFailureCodes: uniqueSorted(evaluatedCandidates.flatMap((candidate) => candidate.semanticFailureCodes)),
            requirements: [...requirements.values()]
              .sort((left, right) => compareUtf16(left.kind, right.kind)
                || compareUtf16(left.semanticRef, right.semanticRef))
              .map((requirement) => ({
                ...requirement,
                observations: [...requirement.observations.values()].sort((left, right) =>
                  compareUtf16(canonicalJsonStringify(left), canonicalJsonStringify(right))),
              })),
          };
        }),
    }));
  if (stages.length === 0 || expectationConflict) return null;
  try {
    return parseDesignSourceSemanticRetryEvidenceV1({
      schema: "setfarm.design-source-semantic-retry-evidence.v1",
      policyHash: hashCanonicalJson(DESIGN_SOURCE_SEMANTIC_RETRY_EVIDENCE_POLICY_V1),
      candidateSelectionArtifact,
      stages,
    });
  } catch {
    return null;
  }
}
