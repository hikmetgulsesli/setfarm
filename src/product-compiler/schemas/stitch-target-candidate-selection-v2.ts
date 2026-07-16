import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  ObservableIdSchema,
  Sha256Schema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ControlSlotIdSchema } from "./common-v2.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import { StitchRenderedCandidateFailureCodeV2Schema } from "./stitch-rendered-semantics-v2.js";

export const STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V2 =
  "exact-v2-rendered-slots-surfaces-role-receipts-hash-ranked.v2" as const;

const ObservedScreenIdSchema = z.string().min(1).max(500);
const SafeScreenIdSchema = z.string()
  .min(1)
  .max(500)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const ElementRefSchema = z.string().regex(/^E[0-9]{6}$/);

export const StitchCandidateRejectionCodeV2Schema = z.enum([
  "CANDIDATE_RENDER_EVIDENCE_INCOMPLETE",
  "CANDIDATE_SCREEN_ID_UNSAFE",
  "CANDIDATE_RESPONSE_IDENTITY_CONFLICT",
  "CANDIDATE_LOCAL_HTML_MISSING",
  "CANDIDATE_LOCAL_HTML_INVALID",
  "CANDIDATE_LOCAL_HTML_UNEXPECTED",
  "CANDIDATE_LOCAL_SCREENSHOT_MISSING",
  "CANDIDATE_LOCAL_SCREENSHOT_INVALID",
  "CANDIDATE_LOCAL_SCREENSHOT_UNEXPECTED",
  "CANDIDATE_DOWNLOAD_RECEIPT_MISSING",
  "CANDIDATE_DOWNLOAD_RECEIPT_MISMATCH",
  "CANDIDATE_RENDERED_SEMANTICS_SOURCE_REJECTED",
  "CANDIDATE_RENDERED_TARGET_MISMATCH",
  "CANDIDATE_TITLE_MISMATCH",
  "CANDIDATE_SURFACE_SET_MISMATCH",
  "CANDIDATE_CONTROL_SLOT_SET_MISMATCH",
  "CANDIDATE_ACTION_INPUT_SET_MISMATCH",
  "CANDIDATE_OBSERVABLE_SET_MISMATCH",
  "CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL",
  "CANDIDATE_UNDECLARED_ACTION",
  "CANDIDATE_UNDECLARED_CONTROL_SLOT",
  "CANDIDATE_UNDECLARED_ACTION_INPUT",
  "CANDIDATE_UNDECLARED_SURFACE",
]);

export type StitchCandidateRejectionCodeV2 = z.infer<
  typeof StitchCandidateRejectionCodeV2Schema
>;

export const StitchCandidateSemanticCheckV2Schema = z.object({
  kind: z.enum([
    "screen_title",
    "target_identity",
    "surface_wrapper",
    "control_slot",
    "control_contract",
    "action_input",
    "action_input_contract",
    "observable",
    "undeclared_interactive",
    "undeclared_action",
    "undeclared_control_slot",
    "undeclared_action_input",
    "undeclared_surface",
    "undeclared_observable",
  ]),
  semanticRef: z.string().min(1).max(1_000),
  expectedValue: z.string().max(2_000).optional(),
  observedValue: z.string().max(2_000).optional(),
  expectedCount: z.number().int().nonnegative().max(10_000),
  observedCount: z.number().int().nonnegative().max(10_000),
  elementRefs: z.array(ElementRefSchema).max(10_000).refine(hasUniqueStrings, {
    message: "Candidate semantic-check element refs must be unique",
  }),
  disposition: z.enum(["exact", "missing", "duplicate", "unexpected", "mismatch"]),
}).strict().superRefine((value, context) => {
  const expectedDisposition = value.expectedCount === 0 && value.observedCount > 0
    ? "unexpected"
    : value.observedCount < value.expectedCount
      ? "missing"
      : value.observedCount > value.expectedCount
        ? "duplicate"
        : value.expectedValue !== undefined && value.observedValue === undefined
          ? "missing"
          : value.expectedValue !== undefined && value.observedValue !== value.expectedValue
            ? "mismatch"
            : "exact";
  if (value.disposition !== expectedDisposition) {
    context.addIssue({
      code: "custom",
      path: ["disposition"],
      message: "Candidate semantic-check disposition must be derived from exact count and value evidence",
    });
  }
  if (
    !["screen_title", "target_identity"].includes(value.kind)
    && value.elementRefs.length !== value.observedCount
  ) {
    context.addIssue({
      code: "custom",
      path: ["elementRefs"],
      message: "DOM semantic checks must name every exact observed element",
    });
  }
  if (
    ["screen_title", "target_identity"].includes(value.kind)
    && value.elementRefs.length > 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["elementRefs"],
      message: "Metadata checks cannot claim DOM element refs",
    });
  }
});

export type StitchCandidateSemanticCheckV2 = z.infer<
  typeof StitchCandidateSemanticCheckV2Schema
>;

export const StitchCandidateFactV2Schema = z.object({
  stageId: z.string().min(1).max(160),
  targetRefs: z.array(GenerationTargetIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Candidate target refs must be unique",
  }),
  screenId: ObservedScreenIdSchema,
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
  htmlAvailable: z.boolean(),
  screenshotAvailable: z.boolean(),
  htmlSourceRefHash: Sha256Schema.nullable(),
  screenshotSourceRefHash: Sha256Schema.nullable(),
  htmlDownloadedArtifactHash: Sha256Schema.nullable(),
  screenshotDownloadedArtifactHash: Sha256Schema.nullable(),
  htmlArtifactHash: Sha256Schema.nullable(),
  screenshotArtifactHash: Sha256Schema.nullable(),
  htmlArtifactValidity: z.enum(["missing", "invalid", "valid", "unexpected"]),
  screenshotArtifactValidity: z.enum(["missing", "invalid", "valid", "unexpected"]),
  renderedStatus: z.enum(["rendered", "source_rejected"]),
  renderedTargetRef: GenerationTargetIdSchema.nullable(),
  renderedHtmlArtifactHash: Sha256Schema.nullable(),
  renderedScreenshotArtifactHash: Sha256Schema.nullable(),
  semanticDomHash: Sha256Schema.nullable(),
  semanticObservationHash: Sha256Schema.nullable(),
  roleReceiptSetHash: Sha256Schema.nullable(),
  semanticFailureCodes: z.array(StitchRenderedCandidateFailureCodeV2Schema).max(8).refine(hasUniqueStrings, {
    message: "Candidate rendered-semantics failures must be unique",
  }),
}).strict().superRefine((value, context) => {
  if (value.htmlAvailable !== Boolean(value.htmlSourceRefHash)) {
    context.addIssue({
      code: "custom",
      path: ["htmlSourceRefHash"],
      message: "HTML source identity must exactly follow direct availability",
    });
  }
  if (value.screenshotAvailable !== Boolean(value.screenshotSourceRefHash)) {
    context.addIssue({
      code: "custom",
      path: ["screenshotSourceRefHash"],
      message: "Screenshot source identity must exactly follow direct availability",
    });
  }
  for (const [validity, hash, field] of [
    [value.htmlArtifactValidity, value.htmlArtifactHash, "htmlArtifactHash"],
    [value.screenshotArtifactValidity, value.screenshotArtifactHash, "screenshotArtifactHash"],
  ] as const) {
    if ((validity === "missing") !== (hash === null)) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "Local artifact validity must exactly describe hash presence",
      });
    }
  }
  if (
    value.renderedHtmlArtifactHash !== value.htmlArtifactHash
    || value.renderedScreenshotArtifactHash !== value.screenshotArtifactHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["renderedHtmlArtifactHash"],
      message: "Rendered-semantics artifact hashes must equal the exact local bytes",
    });
  }
  if (value.renderedStatus === "rendered") {
    if (
      !value.renderedTargetRef
      || !value.renderedHtmlArtifactHash
      || !value.renderedScreenshotArtifactHash
      || !value.semanticDomHash
      || !value.semanticObservationHash
      || !value.roleReceiptSetHash
      || value.semanticFailureCodes.length > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["renderedStatus"],
        message: "Rendered candidates require exact target, artifact, DOM, observation, and role-receipt hashes",
      });
    }
  } else if (
    value.semanticDomHash
    || value.semanticObservationHash
    || value.roleReceiptSetHash
    || value.semanticFailureCodes.length === 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["renderedStatus"],
      message: "Source-rejected candidates require typed failures without fabricated rendered observations",
    });
  }
});

export type StitchCandidateFactV2 = z.infer<typeof StitchCandidateFactV2Schema>;

export const StitchCandidateEvaluationV2Schema = z.object({
  screenId: ObservedScreenIdSchema,
  qualificationTier: z.enum([
    "exact_target_semantics",
    "exact_title_incomplete_semantics",
    "renderable_stage_candidate",
    "excluded_missing_local_artifact",
    "excluded_missing_render_evidence",
    "excluded_response_identity_conflict",
    "rendered_source_rejected",
  ]),
  rejectionCodes: z.array(StitchCandidateRejectionCodeV2Schema).max(32).refine(hasUniqueStrings, {
    message: "Candidate rejection codes must be unique",
  }),
  semanticChecks: z.array(StitchCandidateSemanticCheckV2Schema).min(1).max(20_000),
}).strict().superRefine((value, context) => {
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
      message: "Non-qualified candidates require at least one typed rejection",
    });
  }
  const identities = value.semanticChecks.map((check) => `${check.kind}\0${check.semanticRef}`);
  if (!hasUniqueStrings(identities)) {
    context.addIssue({
      code: "custom",
      path: ["semanticChecks"],
      message: "Candidate semantic checks must have unique kind/ref identities",
    });
  }
  if (value.semanticChecks.some((check, index) => index > 0 && (
    check.kind < value.semanticChecks[index - 1]!.kind
    || (check.kind === value.semanticChecks[index - 1]!.kind
      && check.semanticRef <= value.semanticChecks[index - 1]!.semanticRef)
  ))) {
    context.addIssue({
      code: "custom",
      path: ["semanticChecks"],
      message: "Candidate semantic checks must be canonically sorted",
    });
  }
});

export type StitchCandidateEvaluationV2 = z.infer<typeof StitchCandidateEvaluationV2Schema>;

export const StitchTargetSelectionV2Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  stageId: z.string().min(1).max(160),
  evaluations: z.array(StitchCandidateEvaluationV2Schema).max(1_000),
  rankedQualifiedScreenIds: z.array(SafeScreenIdSchema).max(1_000).refine(hasUniqueStrings, {
    message: "Ranked qualified screen IDs must be unique",
  }),
  status: z.enum(["selected", "unresolved"]),
  selectedScreenId: SafeScreenIdSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.evaluations.map((evaluation) => evaluation.screenId))) {
    context.addIssue({
      code: "custom",
      path: ["evaluations"],
      message: "Target evaluations must be unique by screen ID",
    });
  }
  if (value.evaluations.some((evaluation, index) =>
    index > 0 && evaluation.screenId <= value.evaluations[index - 1]!.screenId)) {
    context.addIssue({
      code: "custom",
      path: ["evaluations"],
      message: "Target evaluations must be canonically sorted",
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
      message: "Ranked candidates must exactly equal the qualified set",
    });
  }
  const expectedStatus = value.rankedQualifiedScreenIds.length > 0 ? "selected" : "unresolved";
  if (
    value.status !== expectedStatus
    || value.selectedScreenId !== (value.rankedQualifiedScreenIds[0] ?? null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["selectedScreenId"],
      message: "Selection must use the first deterministically ranked exact candidate",
    });
  }
});

export type StitchTargetSelectionV2 = z.infer<typeof StitchTargetSelectionV2Schema>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export const StitchTargetCandidateSelectionV2Schema = z.object({
  schema: z.literal("setfarm.stitch-target-candidate-selection.v2"),
  policy: z.literal(STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V2),
  generationTargetsHash: Sha256Schema,
  directResponseEvidenceHash: Sha256Schema,
  renderedSemanticsHash: Sha256Schema,
  candidates: z.array(StitchCandidateFactV2Schema).min(1).max(10_000),
  selections: z.array(StitchTargetSelectionV2Schema).min(1).max(1_000),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.candidates.map((candidate) => candidate.screenId))) {
    context.addIssue({ code: "custom", path: ["candidates"], message: "Candidate screen IDs must be globally unique" });
  }
  if (!hasUniqueStrings(value.selections.map((selection) => selection.targetRef))) {
    context.addIssue({ code: "custom", path: ["selections"], message: "Target selections must be unique" });
  }
  if (value.candidates.some((candidate, index) => index > 0 && (
    candidate.stageId < value.candidates[index - 1]!.stageId
    || (candidate.stageId === value.candidates[index - 1]!.stageId
      && candidate.screenId <= value.candidates[index - 1]!.screenId)
  ))) {
    context.addIssue({ code: "custom", path: ["candidates"], message: "Candidates must be canonically sorted" });
  }
  if (value.selections.some((selection, index) =>
    index > 0 && selection.targetRef <= value.selections[index - 1]!.targetRef)) {
    context.addIssue({ code: "custom", path: ["selections"], message: "Selections must be canonically sorted" });
  }
  const candidateById = new Map(value.candidates.map((candidate) => [candidate.screenId, candidate] as const));
  const selectionByTarget = new Map(value.selections.map((selection) =>
    [selection.targetRef, selection] as const));
  value.candidates.forEach((candidate, candidateIndex) => {
    candidate.targetRefs.forEach((targetRef, targetIndex) => {
      const selection = selectionByTarget.get(targetRef);
      if (!selection || selection.stageId !== candidate.stageId) {
        context.addIssue({
          code: "custom",
          path: ["candidates", candidateIndex, "targetRefs", targetIndex],
          message: "Every candidate target ref must resolve to its exact same-stage selection",
        });
      }
    });
  });
  value.selections.forEach((selection, selectionIndex) => {
    const expectedEvaluationIds = value.candidates
      .filter((candidate) =>
        candidate.stageId === selection.stageId && candidate.targetRefs.includes(selection.targetRef))
      .map((candidate) => candidate.screenId)
      .sort(compareUtf16);
    if (JSON.stringify(selection.evaluations.map((item) => item.screenId)) !== JSON.stringify(expectedEvaluationIds)) {
      context.addIssue({
        code: "custom",
        path: ["selections", selectionIndex, "evaluations"],
        message: "Every target selection must evaluate every direct candidate in its exact owning stage",
      });
    }
    const expectedRanking = selection.evaluations
      .filter((evaluation) => evaluation.qualificationTier === "exact_target_semantics")
      .map((evaluation) => candidateById.get(evaluation.screenId)!)
      .sort((left, right) =>
        compareUtf16(left.htmlArtifactHash ?? "", right.htmlArtifactHash ?? "")
        || compareUtf16(left.screenshotArtifactHash ?? "", right.screenshotArtifactHash ?? "")
        || compareUtf16(left.semanticObservationHash ?? "", right.semanticObservationHash ?? "")
        || compareUtf16(left.screenId, right.screenId))
      .map((candidate) => candidate.screenId);
    if (JSON.stringify(selection.rankedQualifiedScreenIds) !== JSON.stringify(expectedRanking)) {
      context.addIssue({
        code: "custom",
        path: ["selections", selectionIndex, "rankedQualifiedScreenIds"],
        message: "Qualified candidates must use exact local/render hash and screen-ID ranking",
      });
    }
    selection.evaluations.forEach((evaluation, evaluationIndex) => {
      const candidate = candidateById.get(evaluation.screenId);
      if (!candidate) {
        context.addIssue({
          code: "custom",
          path: ["selections", selectionIndex, "evaluations", evaluationIndex, "screenId"],
          message: "Evaluation candidate fact is absent",
        });
        return;
      }
      if (
        evaluation.qualificationTier === "rendered_source_rejected"
        && candidate.renderedStatus !== "source_rejected"
      ) {
        context.addIssue({
          code: "custom",
          path: ["selections", selectionIndex, "evaluations", evaluationIndex, "qualificationTier"],
          message: "Source-rejected qualification requires exact typed rendered rejection evidence",
        });
      }
      if (evaluation.qualificationTier !== "exact_target_semantics") return;
      const titleCheck = evaluation.semanticChecks.find((item) =>
        item.kind === "screen_title" && item.semanticRef === selection.targetRef);
      const targetCheck = evaluation.semanticChecks.find((item) =>
        item.kind === "target_identity" && item.semanticRef === selection.targetRef);
      if (
        candidate.renderDisposition !== "admitted_renderable_screen"
        || candidate.identityConflicts.length > 0
        || candidate.missingEvidence.length > 0
        || candidate.htmlArtifactValidity !== "valid"
        || candidate.screenshotArtifactValidity !== "valid"
        || !candidate.htmlSourceRefHash
        || !candidate.screenshotSourceRefHash
        || !candidate.htmlDownloadedArtifactHash
        || !candidate.screenshotDownloadedArtifactHash
        || candidate.htmlDownloadedArtifactHash !== candidate.htmlArtifactHash
        || candidate.screenshotDownloadedArtifactHash !== candidate.screenshotArtifactHash
        || candidate.renderedStatus !== "rendered"
        || candidate.renderedTargetRef !== selection.targetRef
        || !candidate.semanticDomHash
        || !candidate.semanticObservationHash
        || !candidate.roleReceiptSetHash
        || candidate.semanticFailureCodes.length > 0
        || titleCheck?.disposition !== "exact"
        || targetCheck?.disposition !== "exact"
      ) {
        context.addIssue({
          code: "custom",
          path: ["selections", selectionIndex, "evaluations", evaluationIndex, "qualificationTier"],
          message: "Exact qualification requires the complete source/download/local/render authority chain",
        });
      }
    });
  });
});

export type StitchTargetCandidateSelectionV2 = z.infer<
  typeof StitchTargetCandidateSelectionV2Schema
>;

const ElementBindingV3Schema = z.object({
  elementRef: ElementRefSchema,
  elementHash: Sha256Schema,
}).strict();

export const StitchSurfaceBindingV3Schema = z.object({
  surfaceRef: SurfaceIdSchema,
  ...ElementBindingV3Schema.shape,
}).strict();

export const StitchControlSlotBindingV3Schema = z.object({
  controlSlotRef: ControlSlotIdSchema,
  actionRef: ActionIdSchema,
  surfaceRef: SurfaceIdSchema,
  actionInputRefs: z.array(z.string().min(1).max(500)).max(500).refine(hasUniqueStrings, {
    message: "Control-slot action input refs must be unique",
  }),
  ...ElementBindingV3Schema.shape,
}).strict();

export const StitchActionInputBindingV3Schema = z.object({
  actionInputRef: z.string().min(1).max(500),
  actionRef: ActionIdSchema,
  surfaceRef: SurfaceIdSchema,
  ...ElementBindingV3Schema.shape,
}).strict();

export const StitchObservableBindingV3Schema = z.object({
  observableRef: ObservableIdSchema,
  actionRef: ActionIdSchema,
  selectorKind: z.enum(["control", "surface", "accessibility"]),
  selectorHash: Sha256Schema,
  elementRefs: z.array(ElementRefSchema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Observable binding element refs must be unique",
  }),
  elementHashes: z.array(Sha256Schema).min(1).max(1_000),
  roleReceiptHash: Sha256Schema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.elementRefs.length !== value.elementHashes.length) {
    context.addIssue({
      code: "custom",
      path: ["elementHashes"],
      message: "Observable binding must hash every exact element ref",
    });
  }
  if ((value.selectorKind === "accessibility") !== Boolean(value.roleReceiptHash)) {
    context.addIssue({
      code: "custom",
      path: ["roleReceiptHash"],
      message: "Only browser accessibility selectors carry a getByRole receipt hash",
    });
  }
});

export const StitchTargetResponseBindingV3Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  targetHash: Sha256Schema,
  requestScreenKey: z.string().min(1).max(500),
  expectedScreenTitle: z.string().min(1).max(500),
  responseScreenId: SafeScreenIdSchema,
  responseTitle: z.string().min(1).max(500),
  stageId: z.string().min(1).max(160),
  htmlSourceRefHash: Sha256Schema,
  screenshotSourceRefHash: Sha256Schema,
  htmlDownloadedArtifactHash: Sha256Schema,
  screenshotDownloadedArtifactHash: Sha256Schema,
  htmlArtifactHash: Sha256Schema,
  screenshotArtifactHash: Sha256Schema,
  renderedHtmlArtifactHash: Sha256Schema,
  renderedScreenshotArtifactHash: Sha256Schema,
  semanticDomHash: Sha256Schema,
  semanticObservationHash: Sha256Schema,
  roleReceiptSetHash: Sha256Schema,
  surfaceBindings: z.array(StitchSurfaceBindingV3Schema).min(1).max(1_000),
  controlSlotBindings: z.array(StitchControlSlotBindingV3Schema).max(2_000),
  actionInputBindings: z.array(StitchActionInputBindingV3Schema).max(2_000),
  observableBindings: z.array(StitchObservableBindingV3Schema).max(2_000),
}).strict().superRefine((value, context) => {
  if (value.responseTitle !== value.expectedScreenTitle) {
    context.addIssue({
      code: "custom",
      path: ["responseTitle"],
      message: "Selected response title must exactly equal the generation target title",
    });
  }
  if (
    value.renderedHtmlArtifactHash !== value.htmlArtifactHash
    || value.renderedScreenshotArtifactHash !== value.screenshotArtifactHash
    || value.htmlDownloadedArtifactHash !== value.htmlArtifactHash
    || value.screenshotDownloadedArtifactHash !== value.screenshotArtifactHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["htmlArtifactHash"],
      message: "Selected response source, download, local, and rendered artifact chain must be exact",
    });
  }
  for (const [field, values] of [
    ["surfaceBindings", value.surfaceBindings.map((binding) => binding.surfaceRef)],
    ["controlSlotBindings", value.controlSlotBindings.map((binding) => binding.controlSlotRef)],
    ["actionInputBindings", value.actionInputBindings.map((binding) => binding.actionInputRef)],
    ["observableBindings", value.observableBindings.map((binding) => binding.observableRef)],
  ] as const) {
    if (!hasUniqueStrings(values)) {
      context.addIssue({ code: "custom", path: [field], message: `${field} identities must be unique` });
    }
  }
  if (value.surfaceBindings.some((binding, index) =>
    index > 0 && binding.surfaceRef <= value.surfaceBindings[index - 1]!.surfaceRef)) {
    context.addIssue({ code: "custom", path: ["surfaceBindings"], message: "Surface bindings must be sorted" });
  }
  if (value.controlSlotBindings.some((binding, index) =>
    index > 0 && binding.controlSlotRef <= value.controlSlotBindings[index - 1]!.controlSlotRef)) {
    context.addIssue({ code: "custom", path: ["controlSlotBindings"], message: "Control-slot bindings must be sorted" });
  }
  if (value.actionInputBindings.some((binding, index) =>
    index > 0 && binding.actionInputRef <= value.actionInputBindings[index - 1]!.actionInputRef)) {
    context.addIssue({ code: "custom", path: ["actionInputBindings"], message: "Action-input bindings must be sorted" });
  }
  if (value.observableBindings.some((binding, index) =>
    index > 0 && binding.observableRef <= value.observableBindings[index - 1]!.observableRef)) {
    context.addIssue({ code: "custom", path: ["observableBindings"], message: "Observable bindings must be sorted" });
  }
});

export const StitchTargetResponseBindingsV3Schema = z.object({
  schema: z.literal("setfarm.stitch-target-response-bindings.v3"),
  generationTargetsHash: Sha256Schema,
  directResponseEvidenceHash: Sha256Schema,
  candidateSelectionHash: Sha256Schema,
  renderedSemanticsHash: Sha256Schema,
  bindings: z.array(StitchTargetResponseBindingV3Schema).min(1).max(1_000),
}).strict().superRefine((value, context) => {
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
        message: `Response binding ${field} values must be unique`,
      });
    }
  }
  if (value.bindings.some((binding, index) =>
    index > 0 && binding.targetRef <= value.bindings[index - 1]!.targetRef)) {
    context.addIssue({ code: "custom", path: ["bindings"], message: "Response bindings must be sorted" });
  }
});

export type StitchTargetResponseBindingsV3 = z.infer<
  typeof StitchTargetResponseBindingsV3Schema
>;

export function stitchElementBindingHashV3(value: unknown): string {
  return hashCanonicalJson(value);
}
