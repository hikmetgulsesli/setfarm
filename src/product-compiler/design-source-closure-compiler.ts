import { hashCanonicalJson } from "./canonical-json.js";
import { DesignGenerationTargetsV1Schema } from "./schemas/design-generation-targets-v1.js";
import { DesignInteractionGraphV1Schema } from "./schemas/design-interaction-graph-v1.js";
import {
  DesignSourceClosureV1Schema,
  type DesignSourceClosureV1,
} from "./schemas/design-source-closure-v1.js";
import { ProductSpecV1Schema } from "./schemas/product-spec-v1.js";
import { StitchDirectResponseEvidenceV2Schema } from "./schemas/stitch-direct-response-evidence-v2.js";
import { StitchRenderedSemanticsV1Schema } from "./schemas/stitch-rendered-semantics-v1.js";
import {
  StitchTargetCandidateSelectionV1Schema,
  StitchTargetResponseBindingsV2Schema,
} from "./schemas/stitch-target-candidate-selection-v1.js";

export type StitchDesignSourceInputV1 = Readonly<{
  kind: "stitch";
  generationTargets: unknown;
  directResponseEvidence: unknown;
  renderedSemantics: unknown;
  candidateSelection: unknown;
  responseBindings: unknown;
}>;

export type NoDesignSourceInputV1 = Readonly<{ kind: "none" }>;
export type DesignSourceInputV1 = StitchDesignSourceInputV1 | NoDesignSourceInputV1;

export type DesignSourceClosureIssueV1 = Readonly<{
  code:
    | "CONTRACT_DESIGN_SOURCE_CLOSURE_INVALID"
    | "CONTRACT_DESIGN_SOURCE_CLOSURE_KIND_MISMATCH"
    | "CONTRACT_DESIGN_SOURCE_HASH_CHAIN_MISMATCH"
    | "CONTRACT_DESIGN_SOURCE_GRAPH_PROVENANCE_MISSING"
    | "CONTRACT_DESIGN_SOURCE_TARGET_BINDING_MISMATCH";
  message: string;
  reference: string;
}>;

export type ValidatedDesignSourceClosureInputV1 =
  | Readonly<{
      kind: "none";
      payloadHashes: readonly [];
    }>
  | Readonly<{
      kind: "stitch";
      generationTargets: ReturnType<typeof DesignGenerationTargetsV1Schema.parse>;
      directResponseEvidence: ReturnType<typeof StitchDirectResponseEvidenceV2Schema.parse>;
      renderedSemantics: ReturnType<typeof StitchRenderedSemanticsV1Schema.parse>;
      candidateSelection: ReturnType<typeof StitchTargetCandidateSelectionV1Schema.parse>;
      responseBindings: ReturnType<typeof StitchTargetResponseBindingsV2Schema.parse>;
      payloadHashes: Readonly<{
        generationTargets: string;
        directResponseEvidence: string;
        renderedSemantics: string;
        candidateSelection: string;
        responseBindings: string;
      }>;
    }>;

export type ValidateDesignSourceClosureResultV1 =
  | Readonly<{ status: "validated"; value: ValidatedDesignSourceClosureInputV1 }>
  | Readonly<{ status: "rejected"; issues: DesignSourceClosureIssueV1[] }>;

function issue(
  code: DesignSourceClosureIssueV1["code"],
  message: string,
  reference: string,
): DesignSourceClosureIssueV1 {
  return { code, message, reference };
}

function schemaIssue(label: string, result: { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  return result.error.issues.slice(0, 100).map((entry) => issue(
    "CONTRACT_DESIGN_SOURCE_CLOSURE_INVALID",
    `${label} failed at ${entry.path.join("/") || "$"}: ${entry.message}`,
    `${label}:${entry.path.join("/") || "$"}`,
  ));
}

export function validateDesignSourceClosureInputV1(input: Readonly<{
  productSpec: unknown;
  designGraph: unknown;
  designSource: DesignSourceInputV1;
}>): ValidateDesignSourceClosureResultV1 {
  const product = ProductSpecV1Schema.safeParse(input.productSpec);
  const graph = DesignInteractionGraphV1Schema.safeParse(input.designGraph);
  const issues: DesignSourceClosureIssueV1[] = [];
  if (!product.success) issues.push(...schemaIssue("productSpec", product));
  if (!graph.success) issues.push(...schemaIssue("designGraph", graph));
  if (!product.success || !graph.success) return { status: "rejected", issues };

  if (input.designSource.kind === "none") {
    if (product.data.delivery?.designRequired !== false) {
      return {
        status: "rejected",
        issues: [issue(
          "CONTRACT_DESIGN_SOURCE_CLOSURE_KIND_MISMATCH",
          "A delivery profile that requires design cannot use an empty design-source closure",
          "designSource.kind",
        )],
      };
    }
    return { status: "validated", value: { kind: "none", payloadHashes: [] } };
  }

  if (product.data.delivery?.designRequired !== true) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_CLOSURE_KIND_MISMATCH",
      "A Stitch design-source closure requires a design-required delivery profile",
      "designSource.kind",
    ));
  }
  const generationTargets = DesignGenerationTargetsV1Schema.safeParse(input.designSource.generationTargets);
  const directResponseEvidence = StitchDirectResponseEvidenceV2Schema.safeParse(input.designSource.directResponseEvidence);
  const renderedSemantics = StitchRenderedSemanticsV1Schema.safeParse(input.designSource.renderedSemantics);
  const candidateSelection = StitchTargetCandidateSelectionV1Schema.safeParse(input.designSource.candidateSelection);
  const responseBindings = StitchTargetResponseBindingsV2Schema.safeParse(input.designSource.responseBindings);
  if (!generationTargets.success) issues.push(...schemaIssue("generationTargets", generationTargets));
  if (!directResponseEvidence.success) issues.push(...schemaIssue("directResponseEvidence", directResponseEvidence));
  if (!renderedSemantics.success) issues.push(...schemaIssue("renderedSemantics", renderedSemantics));
  if (!candidateSelection.success) issues.push(...schemaIssue("candidateSelection", candidateSelection));
  if (!responseBindings.success) issues.push(...schemaIssue("responseBindings", responseBindings));
  if (
    !generationTargets.success
    || !directResponseEvidence.success
    || !renderedSemantics.success
    || !candidateSelection.success
    || !responseBindings.success
  ) {
    return { status: "rejected", issues };
  }

  const payloadHashes = {
    generationTargets: hashCanonicalJson(generationTargets.data),
    directResponseEvidence: hashCanonicalJson(directResponseEvidence.data),
    renderedSemantics: hashCanonicalJson(renderedSemantics.data),
    candidateSelection: hashCanonicalJson(candidateSelection.data),
    responseBindings: hashCanonicalJson(responseBindings.data),
  };
  if (
    candidateSelection.data.downloadReceiptPolicy !== "required"
    || candidateSelection.data.semanticEvidencePolicy !== "browser_rendered_v1"
    || candidateSelection.data.generationTargetsHash !== payloadHashes.generationTargets
    || candidateSelection.data.directResponseEvidenceHash !== payloadHashes.directResponseEvidence
    || renderedSemantics.data.generationTargetsHash !== payloadHashes.generationTargets
    || renderedSemantics.data.directResponseEvidenceHash !== payloadHashes.directResponseEvidence
    || candidateSelection.data.renderedSemanticsHash !== payloadHashes.renderedSemantics
    || responseBindings.data.generationTargetsHash !== payloadHashes.generationTargets
    || responseBindings.data.candidateSelectionHash !== payloadHashes.candidateSelection
    || responseBindings.data.renderedSemanticsHash !== payloadHashes.renderedSemantics
  ) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_HASH_CHAIN_MISMATCH",
      "Generation targets, direct evidence, rendered semantics, candidate selection, and response bindings do not form one clean-v3 payload hash chain",
      "designSource",
    ));
  }

  const selectionByTarget = new Map(candidateSelection.data.selections.map((entry) => [entry.targetRef, entry]));
  const candidateById = new Map(candidateSelection.data.candidates.map((entry) => [entry.screenId, entry]));
  const renderedById = new Map(renderedSemantics.data.candidates.map((entry) => [entry.screenId, entry]));
  const bindingByTarget = new Map(responseBindings.data.bindings.map((entry) => [entry.targetRef, entry]));
  for (const candidate of candidateSelection.data.candidates) {
    const rendered = renderedById.get(candidate.screenId);
    if (
      !rendered
      || rendered.stageId !== candidate.stageId
      || rendered.htmlArtifactHash !== candidate.htmlArtifactHash
      || rendered.screenshotArtifactHash !== candidate.screenshotArtifactHash
      || (rendered.semanticDom?.hash ?? null) !== candidate.semanticDomHash
      || rendered.observationHash !== candidate.semanticObservationHash
    ) {
      issues.push(issue(
        "CONTRACT_DESIGN_SOURCE_TARGET_BINDING_MISMATCH",
        `Candidate ${candidate.screenId} does not equal its rendered-semantics authority`,
        candidate.screenId,
      ));
    }
  }
  if (renderedById.size !== candidateById.size) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_TARGET_BINDING_MISMATCH",
      "Candidate-selection and rendered-semantics cardinalities differ",
      "designSource.candidates",
    ));
  }
  for (const target of generationTargets.data.targets) {
    const selection = selectionByTarget.get(target.targetId);
    const binding = bindingByTarget.get(target.targetId);
    const candidate = selection?.selectedScreenId ? candidateById.get(selection.selectedScreenId) : undefined;
    const rendered = selection?.selectedScreenId ? renderedById.get(selection.selectedScreenId) : undefined;
    const selectedEvaluation = selection?.selectedScreenId
      ? selection.evaluations.find((entry) => entry.screenId === selection.selectedScreenId)
      : undefined;
    const expectedContractElementRefs = [...new Set(
      selectedEvaluation?.semanticChecks
        .filter((check) => check.kind !== "screen_title" && check.disposition === "exact")
        .flatMap((check) => check.elementRefs) ?? [],
    )].sort();
    const observedContractElementRefs = binding ? [...binding.contractElementRefs].sort() : [];
    if (
      selection?.status !== "selected"
      || !binding
      || !candidate
      || rendered?.status !== "rendered"
      || !selectedEvaluation
      || selectedEvaluation.qualificationTier !== "exact_target_semantics"
      || binding.responseScreenId !== candidate.screenId
      || binding.stageId !== candidate.stageId
      || binding.requestScreenKey !== target.requestScreenKey
      || binding.expectedScreenTitle !== target.expectedScreenTitle
      || binding.responseTitle !== candidate.title
      || binding.htmlArtifactHash !== candidate.htmlArtifactHash
      || binding.screenshotArtifactHash !== candidate.screenshotArtifactHash
      || binding.semanticDomHash !== candidate.semanticDomHash
      || binding.semanticObservationHash !== candidate.semanticObservationHash
      || binding.semanticDomHash !== rendered.semanticDom?.hash
      || binding.semanticObservationHash !== rendered.observationHash
      || JSON.stringify(observedContractElementRefs) !== JSON.stringify(expectedContractElementRefs)
      || binding.contractElementRefs.some((elementRef) =>
        !rendered.elements.some((element) => element.elementRef === elementRef))
    ) {
      issues.push(issue(
        "CONTRACT_DESIGN_SOURCE_TARGET_BINDING_MISMATCH",
        `Generation target ${target.targetId} does not resolve to one exact selected candidate and response binding`,
        target.targetId,
      ));
    }
  }
  if (
    selectionByTarget.size !== generationTargets.data.targets.length
    || bindingByTarget.size !== generationTargets.data.targets.length
  ) {
    issues.push(issue(
      "CONTRACT_DESIGN_SOURCE_TARGET_BINDING_MISMATCH",
      "Design-source target, selection, and binding cardinalities differ",
      "designSource.targets",
    ));
  }

  for (const [name, payloadHash] of Object.entries(payloadHashes)) {
    if (!graph.data.rawArtifactHashes.includes(payloadHash)) {
      issues.push(issue(
        "CONTRACT_DESIGN_SOURCE_GRAPH_PROVENANCE_MISSING",
        `DesignGraph does not transitively attest ${name} payload authority`,
        name,
      ));
    }
  }
  if (issues.length > 0) return { status: "rejected", issues };
  return {
    status: "validated",
    value: {
      kind: "stitch",
      generationTargets: generationTargets.data,
      directResponseEvidence: directResponseEvidence.data,
      renderedSemantics: renderedSemantics.data,
      candidateSelection: candidateSelection.data,
      responseBindings: responseBindings.data,
      payloadHashes,
    },
  };
}

export function buildDesignSourceClosureV1(input: Readonly<{
  validated: ValidatedDesignSourceClosureInputV1;
  envelopeHashes?: Readonly<{
    generationTargets: string;
    directResponseEvidence: string;
    renderedSemantics: string;
    candidateSelection: string;
    responseBindings: string;
  }>;
}>): DesignSourceClosureV1 {
  if (input.validated.kind === "none") {
    return DesignSourceClosureV1Schema.parse({
      schema: "setfarm.design-source-closure.v1",
      kind: "none",
      reason: "product_delivery_design_not_required",
    });
  }
  if (!input.envelopeHashes) throw new TypeError("A Stitch design-source closure requires child envelope hashes");
  return DesignSourceClosureV1Schema.parse({
    schema: "setfarm.design-source-closure.v1",
    kind: "stitch",
    generationTargets: {
      artifactType: "setfarm.design-generation-targets.v1",
      envelopeHash: input.envelopeHashes.generationTargets,
      payloadHash: input.validated.payloadHashes.generationTargets,
    },
    directResponseEvidence: {
      artifactType: "setfarm.stitch-direct-response-evidence.v2",
      envelopeHash: input.envelopeHashes.directResponseEvidence,
      payloadHash: input.validated.payloadHashes.directResponseEvidence,
    },
    renderedSemantics: {
      artifactType: "setfarm.stitch-rendered-semantics.v1",
      envelopeHash: input.envelopeHashes.renderedSemantics,
      payloadHash: input.validated.payloadHashes.renderedSemantics,
    },
    candidateSelection: {
      artifactType: "setfarm.stitch-target-candidate-selection.v1",
      envelopeHash: input.envelopeHashes.candidateSelection,
      payloadHash: input.validated.payloadHashes.candidateSelection,
    },
    responseBindings: {
      artifactType: "setfarm.stitch-target-response-bindings.v2",
      envelopeHash: input.envelopeHashes.responseBindings,
      payloadHash: input.validated.payloadHashes.responseBindings,
    },
  });
}
