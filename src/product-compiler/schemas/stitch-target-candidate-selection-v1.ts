import { z } from "zod";

import {
  GenerationTargetIdSchema,
} from "./design-generation-targets-v1.js";
import {
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";
import { StitchRenderedCandidateFailureCodeV1Schema } from "./stitch-rendered-semantics-v1.js";

export const STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V1 =
  "exact-target-browser-semantics-html-screenshot-screen-id-asc.v1" as const;

const StitchBatchScreenV2Schema = z
  .object({
    screenId: z.string().min(1).max(500).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    title: z.string().min(1).max(500),
  })
  .strict();

/** Lossless candidate-set transport. Titles are target semantics, not identity. */
export const StitchBatchResponseV2Schema = z
  .object({
    schema: z.literal("setfarm.stitch-batch-response.v2"),
    stageId: z.string().min(1).max(160),
    targetRefs: z.array(GenerationTargetIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Batch target refs must be unique",
    }),
    screens: z.array(StitchBatchScreenV2Schema).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.screens.map((screen) => screen.screenId))) {
      context.addIssue({
        code: "custom",
        path: ["screens"],
        message: "Batch response screen IDs must be unique",
      });
    }
  });

const CandidateQualificationTierV1Schema = z.enum([
  "exact_target_semantics",
  "exact_title_incomplete_semantics",
  "renderable_stage_candidate",
  "excluded_missing_local_artifact",
  "excluded_missing_render_evidence",
  "excluded_response_identity_conflict",
]);

export const CandidateRejectionCodeV1Schema = z.enum([
  "CANDIDATE_RENDER_EVIDENCE_INCOMPLETE",
  "CANDIDATE_SCREEN_ID_UNSAFE",
  "CANDIDATE_RENDERED_SEMANTICS_MISSING",
  "CANDIDATE_RENDERED_SEMANTICS_HASH_MISMATCH",
  "CANDIDATE_RENDERED_SEMANTICS_SOURCE_REJECTED",
  "CANDIDATE_RESPONSE_IDENTITY_CONFLICT",
  "CANDIDATE_LOCAL_HTML_MISSING",
  "CANDIDATE_LOCAL_HTML_INVALID",
  "CANDIDATE_LOCAL_HTML_UNEXPECTED",
  "CANDIDATE_LOCAL_SCREENSHOT_MISSING",
  "CANDIDATE_LOCAL_SCREENSHOT_INVALID",
  "CANDIDATE_LOCAL_SCREENSHOT_UNEXPECTED",
  "CANDIDATE_DOWNLOAD_RECEIPT_MISSING",
  "CANDIDATE_DOWNLOAD_RECEIPT_MISMATCH",
  "CANDIDATE_TITLE_MISMATCH",
  "CANDIDATE_ACTION_SET_MISMATCH",
  "CANDIDATE_ACTION_INPUT_SET_MISMATCH",
  "CANDIDATE_SURFACE_SELECTOR_MISMATCH",
  "CANDIDATE_ACCESSIBILITY_SELECTOR_MISMATCH",
  "CANDIDATE_CONTROL_SET_MISMATCH",
]);

const CandidateSemanticCheckV1Schema = z
  .object({
    kind: z.enum([
      "screen_title",
      "surface",
      "action",
      "action_input",
      "accessibility",
      "control",
    ]),
    semanticRef: z.string().min(1).max(1_000),
    expectedValue: z.string().max(2_000).optional(),
    observedValue: z.string().max(2_000).optional(),
    expectedCount: z.number().int().nonnegative().max(10_000),
    observedCount: z.number().int().nonnegative().max(10_000),
    elementRefs: z.array(z.string().regex(/^[ES][0-9]{6}$/)).max(10_000).refine(hasUniqueStrings, {
      message: "Semantic-check element refs must be unique",
    }),
    disposition: z.enum(["exact", "missing", "duplicate", "unexpected", "mismatch"]),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedDisposition = value.expectedCount === 0 && value.observedCount > 0
      ? "unexpected"
      : value.expectedValue !== undefined
        && value.observedValue !== undefined
        && value.expectedValue !== value.observedValue
        ? "mismatch"
        : value.observedCount < value.expectedCount
          ? "missing"
          : value.observedCount > value.expectedCount
            ? "duplicate"
            : "exact";
    if (value.disposition !== expectedDisposition) {
      context.addIssue({
        code: "custom",
        path: ["disposition"],
        message: "Candidate semantic check disposition must be derived from expected/observed evidence",
      });
    }
    if (
      value.kind !== "screen_title"
      && value.elementRefs.length !== value.observedCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["elementRefs"],
        message: "Non-title semantic checks must name every exact observed element",
      });
    }
    if (value.kind === "screen_title" && value.elementRefs.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["elementRefs"],
        message: "Screen-title checks are response metadata and cannot claim DOM element refs",
      });
    }
  });

const CandidateFactV1Schema = z
  .object({
    stageId: z.string().min(1).max(160),
    targetRefs: z.array(GenerationTargetIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Candidate stage target refs must be unique",
    }),
    screenId: z.string().min(1).max(500),
    title: z.string().min(1).max(500),
    responsePaths: z.array(z.string().min(1).max(2_000)).min(1).max(100).refine(hasUniqueStrings, {
      message: "Candidate response paths must be unique",
    }),
    renderDisposition: z.enum([
      "admitted_renderable_screen",
      "excluded_missing_render_evidence",
      "excluded_identity_conflict",
    ]),
    identityConflicts: z.array(z.enum([
      "title",
      "html_url",
      "screenshot_url",
      "width",
      "height",
      "screen_id",
      "render_evidence_splice",
    ])).max(7).refine(hasUniqueStrings, {
      message: "Candidate identity conflicts must be unique",
    }),
    missingEvidence: z.array(z.enum(["html", "screenshot"])).max(2).refine(hasUniqueStrings, {
      message: "Candidate missing evidence fields must be unique",
    }),
    htmlSourceRefHash: Sha256Schema.nullable(),
    screenshotSourceRefHash: Sha256Schema.nullable(),
    htmlDownloadedArtifactHash: Sha256Schema.nullable(),
    screenshotDownloadedArtifactHash: Sha256Schema.nullable(),
    htmlArtifactHash: Sha256Schema.nullable(),
    screenshotArtifactHash: Sha256Schema.nullable(),
    htmlArtifactValidity: z.enum(["missing", "invalid", "valid", "unexpected"]),
    screenshotArtifactValidity: z.enum(["missing", "invalid", "valid", "unexpected"]),
    semanticEvidenceStatus: z.enum(["browser_rendered", "browser_source_rejected", "historical_static"]),
    semanticDomHash: Sha256Schema.nullable(),
    semanticObservationHash: Sha256Schema.nullable(),
    semanticFailureCodes: z.array(StitchRenderedCandidateFailureCodeV1Schema).max(8).refine(hasUniqueStrings, {
      message: "Candidate semantic failure codes must be unique",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.semanticEvidenceStatus === "browser_rendered"
      && (!value.semanticDomHash || !value.semanticObservationHash || value.semanticFailureCodes.length > 0)
    ) {
      context.addIssue({ code: "custom", path: ["semanticEvidenceStatus"], message: "Rendered candidates require exact DOM and observation hashes" });
    }
    if (
      value.semanticEvidenceStatus === "browser_source_rejected"
      && (value.semanticDomHash || value.semanticObservationHash || value.semanticFailureCodes.length === 0)
    ) {
      context.addIssue({ code: "custom", path: ["semanticEvidenceStatus"], message: "Source-rejected candidates require typed failures without rendered hashes" });
    }
    if (
      value.semanticEvidenceStatus === "historical_static"
      && (value.semanticDomHash || value.semanticObservationHash || value.semanticFailureCodes.length > 0)
    ) {
      context.addIssue({ code: "custom", path: ["semanticEvidenceStatus"], message: "Historical static evidence cannot claim browser-rendered authority" });
    }
  });

export const CandidateEvaluationV1Schema = z
  .object({
    screenId: z.string().min(1).max(500),
    qualificationTier: CandidateQualificationTierV1Schema,
    rejectionCodes: z.array(CandidateRejectionCodeV1Schema).max(20).refine(hasUniqueStrings, {
      message: "Candidate rejection codes must be unique",
    }),
    semanticChecks: z.array(CandidateSemanticCheckV1Schema).min(1).max(10_000),
  })
  .strict()
  .superRefine((value, context) => {
    const exact = value.semanticChecks.every((check) => check.disposition === "exact");
    if (value.qualificationTier === "exact_target_semantics" && (!exact || value.rejectionCodes.length > 0)) {
      context.addIssue({
        code: "custom",
        path: ["qualificationTier"],
        message: "Exact target semantics require exact checks and no rejection codes",
      });
    }
    if (value.qualificationTier !== "exact_target_semantics" && value.rejectionCodes.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["rejectionCodes"],
        message: "Non-qualified candidates require at least one rejection code",
      });
    }
  });

const TargetSelectionV1Schema = z
  .object({
    targetRef: GenerationTargetIdSchema,
    stageId: z.string().min(1).max(160),
    evaluations: z.array(CandidateEvaluationV1Schema).min(1).max(1_000),
    rankedQualifiedScreenIds: z.array(z.string().min(1).max(500).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)).max(1_000).refine(hasUniqueStrings, {
      message: "Ranked qualified screen IDs must be unique",
    }),
    status: z.enum(["selected", "unresolved"]),
    selectedScreenId: z.string().min(1).max(500).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.evaluations.map((evaluation) => evaluation.screenId))) {
      context.addIssue({
        code: "custom",
        path: ["evaluations"],
        message: "Candidate evaluations must be unique by screen ID",
      });
    }
    const qualified = value.evaluations
      .filter((evaluation) => evaluation.qualificationTier === "exact_target_semantics")
      .map((evaluation) => evaluation.screenId);
    if (
      qualified.length !== value.rankedQualifiedScreenIds.length
      || qualified.some((screenId) => !value.rankedQualifiedScreenIds.includes(screenId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["rankedQualifiedScreenIds"],
        message: "Ranked screen IDs must exactly equal the qualified candidate set",
      });
    }
    const expectedStatus = value.rankedQualifiedScreenIds.length > 0 ? "selected" : "unresolved";
    const expectedSelected = value.rankedQualifiedScreenIds[0] ?? null;
    if (value.status !== expectedStatus || value.selectedScreenId !== expectedSelected) {
      context.addIssue({
        code: "custom",
        path: ["selectedScreenId"],
        message: "Selected screen must be the first deterministically ranked qualified candidate",
      });
    }
  });

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export const StitchTargetCandidateSelectionV1Schema = z
  .object({
    schema: z.literal("setfarm.stitch-target-candidate-selection.v1"),
    generationTargetsHash: Sha256Schema,
    directResponseEvidenceHash: Sha256Schema,
    semanticEvidencePolicy: z.enum(["browser_rendered_v1", "historical_static_v1"]),
    renderedSemanticsHash: Sha256Schema.nullable(),
    policy: z.literal(STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V1),
    downloadReceiptPolicy: z.enum(["required", "historical_unverified"]),
    candidates: z.array(CandidateFactV1Schema).min(1).max(10_000),
    selections: z.array(TargetSelectionV1Schema).min(1).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.candidates.map((candidate) => candidate.screenId))) {
      context.addIssue({ code: "custom", path: ["candidates"], message: "Candidate screen IDs must be globally unique" });
    }
    if (!hasUniqueStrings(value.selections.map((selection) => selection.targetRef))) {
      context.addIssue({ code: "custom", path: ["selections"], message: "Target selections must be unique" });
    }
    const expectsBrowserEvidence = value.semanticEvidencePolicy === "browser_rendered_v1";
    if (
      expectsBrowserEvidence !== (value.downloadReceiptPolicy === "required")
      || expectsBrowserEvidence !== Boolean(value.renderedSemanticsHash)
      || value.candidates.some((candidate) => expectsBrowserEvidence
        ? candidate.semanticEvidenceStatus === "historical_static"
        : candidate.semanticEvidenceStatus !== "historical_static")
    ) {
      context.addIssue({
        code: "custom",
        path: ["semanticEvidencePolicy"],
        message: "Clean download receipts, browser semantics, and rendered authority hash must activate as one policy",
      });
    }
    const candidateById = new Map(value.candidates.map((candidate) => [candidate.screenId, candidate]));
    for (const [selectionIndex, selection] of value.selections.entries()) {
      const expectedEvaluationIds = value.candidates
        .filter((candidate) => candidate.stageId === selection.stageId && candidate.targetRefs.includes(selection.targetRef))
        .map((candidate) => candidate.screenId)
        .sort(compareUtf16);
      const actualEvaluationIds = selection.evaluations.map((evaluation) => evaluation.screenId).sort(compareUtf16);
      if (JSON.stringify(actualEvaluationIds) !== JSON.stringify(expectedEvaluationIds)) {
        context.addIssue({
          code: "custom",
          path: ["selections", selectionIndex, "evaluations"],
          message: "Target evaluations must preserve every direct candidate from the owning stage",
        });
      }
      const expectedRanking = selection.evaluations
        .filter((evaluation) => evaluation.qualificationTier === "exact_target_semantics")
        .map((evaluation) => candidateById.get(evaluation.screenId))
        .filter((candidate): candidate is z.infer<typeof CandidateFactV1Schema> => Boolean(candidate))
        .sort((left, right) =>
          compareUtf16(left.htmlArtifactHash ?? "", right.htmlArtifactHash ?? "")
          || compareUtf16(left.screenshotArtifactHash ?? "", right.screenshotArtifactHash ?? "")
          || compareUtf16(left.screenId, right.screenId))
        .map((candidate) => candidate.screenId);
      if (JSON.stringify(selection.rankedQualifiedScreenIds) !== JSON.stringify(expectedRanking)) {
        context.addIssue({
          code: "custom",
          path: ["selections", selectionIndex, "rankedQualifiedScreenIds"],
          message: "Qualified candidates must use the declared HTML hash, screenshot hash, screen ID ordering",
        });
      }
      if (value.downloadReceiptPolicy === "required") {
        for (const evaluation of selection.evaluations) {
          if (evaluation.qualificationTier !== "exact_target_semantics") continue;
          const candidate = candidateById.get(evaluation.screenId);
          if (
            !candidate?.htmlSourceRefHash
            || !candidate.screenshotSourceRefHash
            || !candidate.htmlDownloadedArtifactHash
            || !candidate.screenshotDownloadedArtifactHash
            || candidate.htmlDownloadedArtifactHash !== candidate.htmlArtifactHash
            || candidate.screenshotDownloadedArtifactHash !== candidate.screenshotArtifactHash
          ) {
            context.addIssue({
              code: "custom",
              path: ["selections", selectionIndex, "evaluations", evaluation.screenId],
              message: "Receipt-required exact candidates must seal both source identities and attempt-bound local artifact hashes",
            });
          }
        }
      }
    }
  });

const StitchTargetResponseBindingV2Schema = z
  .object({
    targetRef: GenerationTargetIdSchema,
    requestScreenKey: z.string().min(1).max(500),
    expectedScreenTitle: z.string().min(1).max(500),
    responseScreenId: z.string().min(1).max(500).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    responseTitle: z.string().min(1).max(500),
    stageId: z.string().min(1).max(160),
    htmlArtifactHash: Sha256Schema,
    screenshotArtifactHash: Sha256Schema,
    semanticDomHash: Sha256Schema,
    semanticObservationHash: Sha256Schema,
    contractElementRefs: z.array(z.string().regex(/^E[0-9]{6}$/)).min(1).max(10_000).refine(hasUniqueStrings, {
      message: "Selected binding element refs must be unique",
    }),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.responseTitle !== value.expectedScreenTitle) {
      context.addIssue({
        code: "custom",
        path: ["responseTitle"],
        message: "Selected Stitch response title must exactly equal the generation target title",
      });
    }
  });

export const StitchTargetResponseBindingsV2Schema = z
  .object({
    schema: z.literal("setfarm.stitch-target-response-bindings.v2"),
    generationTargetsHash: Sha256Schema,
    candidateSelectionHash: Sha256Schema,
    renderedSemanticsHash: Sha256Schema,
    bindings: z.array(StitchTargetResponseBindingV2Schema).min(1).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [field, values] of [
      ["targetRef", value.bindings.map((binding) => binding.targetRef)],
      ["requestScreenKey", value.bindings.map((binding) => binding.requestScreenKey)],
      ["expectedScreenTitle", value.bindings.map((binding) => binding.expectedScreenTitle)],
      ["responseScreenId", value.bindings.map((binding) => binding.responseScreenId)],
    ] as const) {
      if (!hasUniqueStrings(values)) {
        context.addIssue({
          code: "custom",
          path: ["bindings"],
          message: `Selected Stitch response ${field} values must be unique`,
        });
      }
    }
  });

export type StitchTargetCandidateSelectionV1 = z.infer<typeof StitchTargetCandidateSelectionV1Schema>;
export type StitchBatchResponseV2 = z.infer<typeof StitchBatchResponseV2Schema>;
export type StitchCandidateFactV1 = z.infer<typeof CandidateFactV1Schema>;
export type StitchCandidateEvaluationV1 = z.infer<typeof CandidateEvaluationV1Schema>;
export type StitchTargetResponseBindingsV2 = z.infer<typeof StitchTargetResponseBindingsV2Schema>;
