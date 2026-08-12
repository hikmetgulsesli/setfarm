import { createHash } from "node:crypto";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import {
  isValidStitchHtmlBytes,
  isValidStitchScreenshotBytes,
} from "../stitch-render-artifact.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  DesignGenerationTargetsV2Schema,
  type DesignGenerationTargetV2,
  type DesignGenerationTargetsV2,
  type RequiredControlPlacementV2,
  type RequiredObservableSelectorV2,
} from "../schemas/design-generation-targets-v2.js";
import {
  StitchDirectResponseEvidenceV2Schema,
  type StitchDirectResponseEvidenceV2,
} from "../schemas/stitch-direct-response-evidence-v2.js";
import {
  StitchRenderedSemanticsV2Schema,
  type StitchGetByRoleReceiptV2,
  type StitchRenderedCandidateV2,
  type StitchRenderedElementV2,
  type StitchRenderedSemanticsV2,
} from "../schemas/stitch-rendered-semantics-v2.js";
import {
  STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V2,
  StitchTargetCandidateSelectionV2Schema,
  StitchTargetResponseBindingsV3Schema,
  type StitchCandidateEvaluationV2,
  type StitchCandidateFactV2,
  type StitchCandidateRejectionCodeV2,
  type StitchCandidateSemanticCheckV2,
  type StitchTargetCandidateSelectionV2,
  type StitchTargetResponseBindingsV3,
} from "../schemas/stitch-target-candidate-selection-v2.js";

export type StitchCandidateArtifactBytesV2 = Readonly<{
  screenId: string;
  htmlBytes?: Uint8Array;
  screenshotBytes?: Uint8Array;
}>;

export type StitchCandidateSelectionInfrastructurePhaseV2 =
  | "input_validation"
  | "authority_chain_validation"
  | "candidate_projection"
  | "candidate_evaluation"
  | "output_validation"
  | "binding_validation";

export class StitchCandidateSelectionInfrastructureErrorV2 extends Error {
  readonly code:
    | "STITCH_SELECTION_V2_INPUT_INVALID"
    | "STITCH_SELECTION_V2_AUTHORITY_CHAIN_MISMATCH"
    | "STITCH_SELECTION_V2_ARTIFACT_SET_INVALID"
    | "STITCH_SELECTION_V2_OUTPUT_INVALID"
    | "STITCH_BINDINGS_V3_INPUT_INVALID"
    | "STITCH_BINDINGS_V3_AUTHORITY_CHAIN_MISMATCH"
    | "STITCH_BINDINGS_V3_OUTPUT_INVALID"
    | "STITCH_SELECTION_V2_UNEXPECTED";
  readonly phase: StitchCandidateSelectionInfrastructurePhaseV2;

  constructor(
    code: StitchCandidateSelectionInfrastructureErrorV2["code"],
    phase: StitchCandidateSelectionInfrastructurePhaseV2,
    message: string,
  ) {
    super(`${code}:${phase}:${message}`);
    this.name = "StitchCandidateSelectionInfrastructureErrorV2";
    this.code = code;
    this.phase = phase;
  }
}

type SelectionRejected = Readonly<{
  status: "rejected";
  rejectionCodes: string[];
  diagnostics: CompilationDiagnosticV1[];
  candidateSelection: StitchTargetCandidateSelectionV2;
}>;

export type StitchCandidateSelectionResultV2 =
  | Readonly<{
      status: "produced";
      candidateSelection: StitchTargetCandidateSelectionV2;
      diagnostics: readonly [];
    }>
  | SelectionRejected;

export type StitchTargetBindingResultV3 =
  | Readonly<{
      status: "produced";
      responseBindings: StitchTargetResponseBindingsV3;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
      candidateSelection: StitchTargetCandidateSelectionV2;
    }>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}

function infrastructure(
  code: StitchCandidateSelectionInfrastructureErrorV2["code"],
  phase: StitchCandidateSelectionInfrastructurePhaseV2,
  error: unknown,
): StitchCandidateSelectionInfrastructureErrorV2 {
  return error instanceof StitchCandidateSelectionInfrastructureErrorV2
    ? error
    : new StitchCandidateSelectionInfrastructureErrorV2(code, phase, errorText(error));
}

function failChain(message: string): never {
  throw new StitchCandidateSelectionInfrastructureErrorV2(
    "STITCH_SELECTION_V2_AUTHORITY_CHAIN_MISMATCH",
    "authority_chain_validation",
    message,
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeScreenId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,499}$/.test(value);
}

function diagnostic(code: string, message: string, reference?: string): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code,
    category: "link",
    severity: "error",
    message: message.slice(0, 2_000),
    ...(reference ? { reference: reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function rejectedSelection(
  candidateSelection: StitchTargetCandidateSelectionV2,
  diagnostics: CompilationDiagnosticV1[],
): SelectionRejected {
  const sorted = sortCompilationDiagnostics(diagnostics);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
    candidateSelection,
  };
}

function parseSelectionInputs(input: Readonly<{
  generationTargets: unknown;
  directResponseEvidence: unknown;
  renderedSemantics: unknown;
}>): Readonly<{
  generationTargets: DesignGenerationTargetsV2;
  directResponseEvidence: StitchDirectResponseEvidenceV2;
  renderedSemantics: StitchRenderedSemanticsV2;
}> {
  try {
    return {
      generationTargets: DesignGenerationTargetsV2Schema.parse(input.generationTargets),
      directResponseEvidence: StitchDirectResponseEvidenceV2Schema.parse(input.directResponseEvidence),
      renderedSemantics: StitchRenderedSemanticsV2Schema.parse(input.renderedSemantics),
    };
  } catch (error) {
    throw infrastructure("STITCH_SELECTION_V2_INPUT_INVALID", "input_validation", error);
  }
}

function stageByTarget(
  generationTargets: DesignGenerationTargetsV2,
  directResponseEvidence: StitchDirectResponseEvidenceV2,
): Map<string, StitchDirectResponseEvidenceV2["batches"][number]> {
  const targetIds = new Set(generationTargets.targets.map((target) => target.targetId));
  const result = new Map<string, StitchDirectResponseEvidenceV2["batches"][number]>();
  for (const batch of directResponseEvidence.batches) {
    for (const targetRef of batch.targetRefs) {
      if (!targetIds.has(targetRef)) failChain(`Direct stage ${batch.stageId} owns absent target ${targetRef}`);
      if (result.has(targetRef)) failChain(`Target ${targetRef} is owned by multiple direct stages`);
      result.set(targetRef, batch);
    }
  }
  for (const targetId of targetIds) {
    if (!result.has(targetId)) failChain(`Target ${targetId} has no direct response stage`);
  }
  return result;
}

function validateAuthorityChain(input: Readonly<{
  generationTargets: DesignGenerationTargetsV2;
  directResponseEvidence: StitchDirectResponseEvidenceV2;
  renderedSemantics: StitchRenderedSemanticsV2;
  artifacts: readonly StitchCandidateArtifactBytesV2[];
}>): Readonly<{
  stageByTarget: Map<string, StitchDirectResponseEvidenceV2["batches"][number]>;
  renderedByScreen: Map<string, StitchRenderedCandidateV2>;
  artifactByScreen: Map<string, StitchCandidateArtifactBytesV2>;
}> {
  if (input.renderedSemantics.generationTargetsHash !== hashCanonicalJson(input.generationTargets)) {
    failChain("Rendered semantics do not reference the exact DesignGenerationTargetsV2 bytes");
  }
  if (input.renderedSemantics.directResponseEvidenceHash !== hashCanonicalJson(input.directResponseEvidence)) {
    failChain("Rendered semantics do not reference the exact DirectResponseEvidenceV2 bytes");
  }
  const byTarget = stageByTarget(input.generationTargets, input.directResponseEvidence);
  const directCandidates = input.directResponseEvidence.batches.flatMap((batch) =>
    batch.candidates.map((candidate) => ({ stageId: batch.stageId, targetRefs: batch.targetRefs, candidate })));
  const knownScreenIds = new Set(directCandidates.map((entry) => entry.candidate.screenId));
  const renderedByScreen = new Map(input.renderedSemantics.candidates.map((candidate) =>
    [candidate.screenId, candidate] as const));
  if (
    renderedByScreen.size !== knownScreenIds.size
    || [...knownScreenIds].some((screenId) => !renderedByScreen.has(screenId))
  ) {
    failChain("Rendered semantics must preserve every direct candidate exactly once");
  }
  for (const entry of directCandidates) {
    const rendered = renderedByScreen.get(entry.candidate.screenId)!;
    if (rendered.stageId !== entry.stageId) {
      failChain(`Rendered semantics changed the owning stage for ${entry.candidate.screenId}`);
    }
    if (rendered.targetRef !== null && !entry.targetRefs.includes(rendered.targetRef)) {
      failChain(`Rendered candidate ${entry.candidate.screenId} references a target outside its direct stage`);
    }
  }
  const artifactByScreen = new Map<string, StitchCandidateArtifactBytesV2>();
  for (const artifact of input.artifacts) {
    if (artifactByScreen.has(artifact.screenId)) {
      throw new StitchCandidateSelectionInfrastructureErrorV2(
        "STITCH_SELECTION_V2_ARTIFACT_SET_INVALID",
        "authority_chain_validation",
        `Local artifacts repeat candidate ${artifact.screenId}`,
      );
    }
    if (!knownScreenIds.has(artifact.screenId)) {
      throw new StitchCandidateSelectionInfrastructureErrorV2(
        "STITCH_SELECTION_V2_ARTIFACT_SET_INVALID",
        "authority_chain_validation",
        `Local artifact is absent from direct evidence: ${artifact.screenId}`,
      );
    }
    artifactByScreen.set(artifact.screenId, artifact);
  }
  for (const entry of directCandidates) {
    const artifact = artifactByScreen.get(entry.candidate.screenId);
    const localHtmlHash = artifact?.htmlBytes?.byteLength ? sha256(artifact.htmlBytes) : null;
    const localScreenshotHash = artifact?.screenshotBytes?.byteLength ? sha256(artifact.screenshotBytes) : null;
    const rendered = renderedByScreen.get(entry.candidate.screenId)!;
    if (
      rendered.htmlArtifactHash !== localHtmlHash
      || rendered.screenshotArtifactHash !== localScreenshotHash
    ) {
      failChain(`Rendered semantics no longer attest the local bytes for ${entry.candidate.screenId}`);
    }
  }
  return { stageByTarget: byTarget, renderedByScreen, artifactByScreen };
}

function localArtifactValidity(
  bytes: Uint8Array | undefined,
  available: boolean,
  validator: (value: Uint8Array) => boolean,
): "missing" | "invalid" | "valid" | "unexpected" {
  if (!bytes?.byteLength) return "missing";
  if (!available) return "unexpected";
  return validator(bytes) ? "valid" : "invalid";
}

function candidateFacts(input: Readonly<{
  directResponseEvidence: StitchDirectResponseEvidenceV2;
  renderedByScreen: ReadonlyMap<string, StitchRenderedCandidateV2>;
  artifactByScreen: ReadonlyMap<string, StitchCandidateArtifactBytesV2>;
}>): StitchCandidateFactV2[] {
  return input.directResponseEvidence.batches.flatMap((batch) =>
    batch.candidates.map((candidate): StitchCandidateFactV2 => {
      const artifact = input.artifactByScreen.get(candidate.screenId);
      const htmlBytes = artifact?.htmlBytes?.byteLength ? artifact.htmlBytes : undefined;
      const screenshotBytes = artifact?.screenshotBytes?.byteLength ? artifact.screenshotBytes : undefined;
      const rendered = input.renderedByScreen.get(candidate.screenId)!;
      return {
        stageId: batch.stageId,
        targetRefs: [...batch.targetRefs].sort(compareUtf16),
        screenId: candidate.screenId,
        title: candidate.title,
        responsePaths: [...candidate.responsePaths].sort(compareUtf16),
        renderDisposition: candidate.disposition,
        identityConflicts: [...candidate.identityConflicts].sort(compareUtf16),
        missingEvidence: [...candidate.missingEvidence].sort(compareUtf16),
        htmlAvailable: candidate.htmlAvailable,
        screenshotAvailable: candidate.screenshotAvailable,
        htmlSourceRefHash: candidate.htmlSourceRefHash ?? null,
        screenshotSourceRefHash: candidate.screenshotSourceRefHash ?? null,
        htmlDownloadedArtifactHash: candidate.htmlDownloadedArtifactHash ?? null,
        screenshotDownloadedArtifactHash: candidate.screenshotDownloadedArtifactHash ?? null,
        htmlArtifactHash: htmlBytes ? sha256(htmlBytes) : null,
        screenshotArtifactHash: screenshotBytes ? sha256(screenshotBytes) : null,
        htmlArtifactValidity: localArtifactValidity(htmlBytes, candidate.htmlAvailable, isValidStitchHtmlBytes),
        screenshotArtifactValidity: localArtifactValidity(
          screenshotBytes,
          candidate.screenshotAvailable,
          isValidStitchScreenshotBytes,
        ),
        renderedStatus: rendered.status,
        renderedTargetRef: rendered.targetRef,
        renderedHtmlArtifactHash: rendered.htmlArtifactHash,
        renderedScreenshotArtifactHash: rendered.screenshotArtifactHash,
        semanticDomHash: rendered.semanticDom?.hash ?? null,
        semanticObservationHash: rendered.observationHash,
        roleReceiptSetHash: rendered.status === "rendered"
          ? hashCanonicalJson(rendered.roleReceipts)
          : null,
        semanticFailureCodes: [...rendered.failureCodes].sort(compareUtf16),
      };
    }))
    .sort((left, right) =>
      compareUtf16(left.stageId, right.stageId) || compareUtf16(left.screenId, right.screenId));
}

function disposition(input: Readonly<{
  expectedCount: number;
  observedCount: number;
  expectedValue?: string;
  observedValue?: string;
}>): StitchCandidateSemanticCheckV2["disposition"] {
  if (input.expectedCount === 0 && input.observedCount > 0) return "unexpected";
  if (input.observedCount < input.expectedCount) return "missing";
  if (input.observedCount > input.expectedCount) return "duplicate";
  if (input.expectedValue !== undefined && input.observedValue === undefined) return "missing";
  if (input.expectedValue !== undefined && input.observedValue !== input.expectedValue) return "mismatch";
  return "exact";
}

function check(input: Readonly<{
  kind: StitchCandidateSemanticCheckV2["kind"];
  semanticRef: string;
  expectedCount: number;
  elementRefs?: readonly string[];
  observedCount?: number;
  expectedValue?: string;
  observedValue?: string;
}>): StitchCandidateSemanticCheckV2 {
  const elementRefs = uniqueSorted(input.elementRefs ?? []);
  const observedCount = input.observedCount ?? elementRefs.length;
  const comparable = {
    expectedCount: input.expectedCount,
    observedCount,
    ...(input.expectedValue !== undefined ? { expectedValue: input.expectedValue } : {}),
    ...(input.observedValue !== undefined ? { observedValue: input.observedValue } : {}),
  };
  return {
    kind: input.kind,
    semanticRef: input.semanticRef,
    ...comparable,
    elementRefs,
    disposition: disposition(comparable),
  };
}

function isInteractive(element: StitchRenderedElementV2): boolean {
  return element.nativeControlKind !== null || element.interactiveRole;
}

function isOperable(element: StitchRenderedElementV2): boolean {
  return element.renderState === "rendered" && element.enabled && element.pointerOperable;
}

function inputTokens(element: StitchRenderedElementV2): string[] {
  return (element.dataActionInput ?? "").split(/[;,\s]+/).filter(Boolean);
}

function expectedPhases(observable: RequiredObservableSelectorV2): Array<"before" | "after" | "reload"> {
  const phases = new Set(observable.assertions.map((assertion) => assertion.phase));
  return (["before", "after", "reload"] as const).filter((phase) => phases.has(phase));
}

function mustBeVisibleBefore(observable: RequiredObservableSelectorV2): boolean {
  return observable.assertions.some((assertion) =>
    assertion.phase === "before"
    && assertion.property === "visibility"
    && assertion.operator === "equals"
    && assertion.expected === true);
}

function expectedReceiptProjection(observable: RequiredObservableSelectorV2): unknown {
  if (observable.selector.kind !== "accessibility") return null;
  return {
    observableRef: observable.observableRef,
    actionRef: observable.actionRef,
    selectorHash: hashCanonicalJson(observable.selector),
    surfaceRef: observable.selector.surfaceRef,
    query: {
      engine: "playwright",
      method: "getByRole",
      role: observable.selector.role,
      name: observable.selector.name,
      exact: true,
      includeHidden: true,
    },
    phases: expectedPhases(observable),
    visibilityRequirement: mustBeVisibleBefore(observable)
      ? "must_be_visible_before"
      : "traceable_hidden_allowed",
  };
}

function observedReceiptProjection(receipt: StitchGetByRoleReceiptV2): unknown {
  return {
    observableRef: receipt.observableRef,
    actionRef: receipt.actionRef,
    selectorHash: receipt.selectorHash,
    surfaceRef: receipt.surfaceRef,
    query: receipt.query,
    phases: receipt.phases,
    visibilityRequirement: receipt.visibilityRequirement,
  };
}

type ExactTargetEvidence = Readonly<{
  surfaceElements: ReadonlyMap<string, StitchRenderedElementV2[]>;
  controlElements: ReadonlyMap<string, StitchRenderedElementV2[]>;
  observableElements: ReadonlyMap<string, StitchRenderedElementV2[]>;
  receiptByObservable: ReadonlyMap<string, StitchGetByRoleReceiptV2>;
  checks: StitchCandidateSemanticCheckV2[];
}>;

function semanticEvidence(
  target: DesignGenerationTargetV2,
  rendered: StitchRenderedCandidateV2,
): ExactTargetEvidence {
  const elements = rendered.status === "rendered" ? rendered.elements : [];
  const roleReceipts = rendered.status === "rendered" ? rendered.roleReceipts : [];
  const checks: StitchCandidateSemanticCheckV2[] = [];
  const expectedSurfaceRefs = new Set([target.surfaceRef, ...target.containedSurfaceRefs]);
  const surfaceElements = new Map<string, StitchRenderedElementV2[]>();
  for (const surfaceRef of [...expectedSurfaceRefs].sort(compareUtf16)) {
    const allWrappers = elements.filter((element) => element.ownSurfaceRef === surfaceRef);
    const exactWrappers = allWrappers.filter((element) =>
      element.nearestSurfaceRef === surfaceRef);
    surfaceElements.set(surfaceRef, exactWrappers);
    checks.push(check({
      kind: "surface_wrapper",
      semanticRef: surfaceRef,
      expectedCount: 1,
      elementRefs: exactWrappers.map((element) => element.elementRef),
    }));
    const invalidWrappers = allWrappers.filter((element) => !exactWrappers.includes(element));
    if (invalidWrappers.length > 0) {
      checks.push(check({
        kind: "surface_wrapper",
        semanticRef: `${surfaceRef}@invalid_wrapper`,
        expectedCount: 0,
        elementRefs: invalidWrappers.map((element) => element.elementRef),
      }));
    }
  }
  for (const element of elements) {
    if (element.ownSurfaceRef && !expectedSurfaceRefs.has(element.ownSurfaceRef)) {
      checks.push(check({
        kind: "undeclared_surface",
        semanticRef: `${element.ownSurfaceRef}@${element.elementRef}`,
        expectedCount: 0,
        elementRefs: [element.elementRef],
      }));
    }
  }

  const placementBySlot = new Map(target.requiredControlPlacements.map((placement) =>
    [placement.controlSlotRef, placement] as const));
  const controlElements = new Map<string, StitchRenderedElementV2[]>();
  const declaredControlRefs = new Set<string>();
  for (const placement of [...target.requiredControlPlacements]
    .sort((left, right) => compareUtf16(left.controlSlotRef, right.controlSlotRef))) {
    const allSlotElements = elements.filter((element) =>
      element.dataControlSlot === placement.controlSlotRef);
    const exactElements = allSlotElements.filter((element) =>
      element.dataAction === placement.actionRef
      && element.nearestSurfaceRef === placement.surfaceRef
      && isInteractive(element)
      && isOperable(element));
    controlElements.set(placement.controlSlotRef, exactElements);
    exactElements.forEach((element) => declaredControlRefs.add(element.elementRef));
    checks.push(check({
      kind: "control_slot",
      semanticRef: placement.controlSlotRef,
      expectedCount: 1,
      elementRefs: exactElements.map((element) => element.elementRef),
    }));
    const invalidElements = allSlotElements.filter((element) => !exactElements.includes(element));
    if (invalidElements.length > 0) {
      checks.push(check({
        kind: "control_contract",
        semanticRef: `${placement.controlSlotRef}@invalid_same_element_contract`,
        expectedCount: 0,
        elementRefs: invalidElements.map((element) => element.elementRef),
      }));
    }
  }
  for (const element of elements) {
    if (element.dataControlSlot && !placementBySlot.has(element.dataControlSlot)) {
      checks.push(check({
        kind: "undeclared_control_slot",
        semanticRef: `${element.dataControlSlot}@${element.elementRef}`,
        expectedCount: 0,
        elementRefs: [element.elementRef],
      }));
    }
    if (element.dataAction && !declaredControlRefs.has(element.elementRef)) {
      checks.push(check({
        kind: "undeclared_action",
        semanticRef: `${element.dataAction}@${element.elementRef}`,
        expectedCount: 0,
        elementRefs: [element.elementRef],
      }));
    }
  }

  const expectedInputSurfaces = new Map<string, Set<string>>();
  for (const placement of target.requiredControlPlacements) {
    for (const field of placement.inputFields) {
      const inputRef = `${placement.actionRef}.${field}`;
      const surfaces = expectedInputSurfaces.get(inputRef) ?? new Set<string>();
      surfaces.add(placement.surfaceRef);
      expectedInputSurfaces.set(inputRef, surfaces);
    }
  }
  const declaredInputElementRefs = new Set<string>();
  for (const inputRef of [...expectedInputSurfaces.keys()].sort(compareUtf16)) {
    const surfaces = expectedInputSurfaces.get(inputRef)!;
    const exactElements = elements.filter((element) =>
      isOperable(element)
      && isInteractive(element)
      && element.nearestSurfaceRef !== null
      && surfaces.has(element.nearestSurfaceRef)
      && inputTokens(element).includes(inputRef));
    exactElements.forEach((element) => declaredInputElementRefs.add(element.elementRef));
    checks.push(check({
      kind: "action_input",
      semanticRef: inputRef,
      expectedCount: 1,
      elementRefs: exactElements.map((element) => element.elementRef),
    }));
  }
  for (const element of elements) {
    const tokens = inputTokens(element);
    const uniqueTokens = new Set(tokens);
    if (tokens.length !== uniqueTokens.size) {
      checks.push(check({
        kind: "action_input_contract",
        semanticRef: `${element.elementRef}@duplicate_input_token`,
        expectedCount: 0,
        elementRefs: [element.elementRef],
      }));
    }
    for (const inputRef of uniqueTokens) {
      const surfaces = expectedInputSurfaces.get(inputRef);
      const exact = Boolean(
        surfaces
        && isOperable(element)
        && isInteractive(element)
        && element.nearestSurfaceRef !== null
        && surfaces.has(element.nearestSurfaceRef),
      );
      if (!exact) {
        checks.push(check({
          kind: "undeclared_action_input",
          semanticRef: `${inputRef}@${element.elementRef}`,
          expectedCount: 0,
          elementRefs: [element.elementRef],
        }));
      }
    }
  }

  const declaredInteractiveRefs = new Set([...declaredControlRefs, ...declaredInputElementRefs]);
  for (const element of elements) {
    if (
      element.renderState === "rendered"
      && isInteractive(element)
      && !declaredInteractiveRefs.has(element.elementRef)
    ) {
      checks.push(check({
        kind: "undeclared_interactive",
        semanticRef: `${element.elementRef}@interactive_control`,
        expectedCount: 0,
        elementRefs: [element.elementRef],
      }));
    }
  }

  const receiptByObservable = new Map(roleReceipts.map((receipt) =>
    [receipt.observableRef, receipt] as const));
  const observableElements = new Map<string, StitchRenderedElementV2[]>();
  const elementByRef = new Map(elements.map((element) => [element.elementRef, element] as const));
  for (const observable of [...target.requiredObservableSelectors]
    .sort((left, right) => compareUtf16(left.observableRef, right.observableRef))) {
    const selectorHash = hashCanonicalJson(observable.selector);
    let exactElements: StitchRenderedElementV2[] = [];
    let observedValue: string | undefined;
    if (observable.selector.kind === "control") {
      exactElements = controlElements.get(observable.selector.controlSlotRef) ?? [];
      if (exactElements.length > 0) observedValue = selectorHash;
    } else if (observable.selector.kind === "surface") {
      exactElements = surfaceElements.get(observable.selector.surfaceRef) ?? [];
      if (exactElements.length > 0) observedValue = selectorHash;
    } else {
      const receipt = receiptByObservable.get(observable.observableRef);
      exactElements = receipt?.elementRefs
        .map((elementRef) => elementByRef.get(elementRef))
        .filter((element): element is StitchRenderedElementV2 => Boolean(element)) ?? [];
      if (receipt) observedValue = hashCanonicalJson(observedReceiptProjection(receipt));
    }
    observableElements.set(observable.observableRef, exactElements);
    checks.push(check({
      kind: "observable",
      semanticRef: observable.observableRef,
      expectedCount: 1,
      elementRefs: exactElements.map((element) => element.elementRef),
      expectedValue: observable.selector.kind === "accessibility"
        ? hashCanonicalJson(expectedReceiptProjection(observable))
        : selectorHash,
      ...(observedValue ? { observedValue } : {}),
    }));
  }
  const expectedObservableRefs = new Set(target.requiredObservableSelectors.map((observable) =>
    observable.observableRef));
  for (const receipt of roleReceipts) {
    if (!expectedObservableRefs.has(receipt.observableRef)) {
      checks.push(check({
        kind: "undeclared_observable",
        semanticRef: receipt.observableRef,
        expectedCount: 0,
        elementRefs: receipt.elementRefs,
      }));
    }
  }

  return {
    surfaceElements,
    controlElements,
    observableElements,
    receiptByObservable,
    checks: checks.sort((left, right) =>
      compareUtf16(left.kind, right.kind) || compareUtf16(left.semanticRef, right.semanticRef)),
  };
}

function candidateRejectionCodes(input: Readonly<{
  target: DesignGenerationTargetV2;
  candidate: StitchCandidateFactV2;
  checks: readonly StitchCandidateSemanticCheckV2[];
}>): StitchCandidateRejectionCodeV2[] {
  const codes: StitchCandidateRejectionCodeV2[] = [];
  const { candidate, checks } = input;
  if (!safeScreenId(candidate.screenId)) codes.push("CANDIDATE_SCREEN_ID_UNSAFE");
  if (candidate.renderDisposition !== "admitted_renderable_screen") {
    codes.push("CANDIDATE_RENDER_EVIDENCE_INCOMPLETE");
  }
  if (candidate.renderDisposition === "excluded_identity_conflict") {
    codes.push("CANDIDATE_RESPONSE_IDENTITY_CONFLICT");
  }
  if (candidate.htmlArtifactValidity === "missing") codes.push("CANDIDATE_LOCAL_HTML_MISSING");
  if (candidate.htmlArtifactValidity === "invalid") codes.push("CANDIDATE_LOCAL_HTML_INVALID");
  if (candidate.htmlArtifactValidity === "unexpected") codes.push("CANDIDATE_LOCAL_HTML_UNEXPECTED");
  if (candidate.screenshotArtifactValidity === "missing") codes.push("CANDIDATE_LOCAL_SCREENSHOT_MISSING");
  if (candidate.screenshotArtifactValidity === "invalid") codes.push("CANDIDATE_LOCAL_SCREENSHOT_INVALID");
  if (candidate.screenshotArtifactValidity === "unexpected") codes.push("CANDIDATE_LOCAL_SCREENSHOT_UNEXPECTED");
  if (
    !candidate.htmlSourceRefHash
    || !candidate.screenshotSourceRefHash
    || !candidate.htmlDownloadedArtifactHash
    || !candidate.screenshotDownloadedArtifactHash
  ) {
    codes.push("CANDIDATE_DOWNLOAD_RECEIPT_MISSING");
  } else if (
    candidate.htmlDownloadedArtifactHash !== candidate.htmlArtifactHash
    || candidate.screenshotDownloadedArtifactHash !== candidate.screenshotArtifactHash
  ) {
    codes.push("CANDIDATE_DOWNLOAD_RECEIPT_MISMATCH");
  }
  if (candidate.renderedStatus === "source_rejected") {
    codes.push("CANDIDATE_RENDERED_SEMANTICS_SOURCE_REJECTED");
  }
  if (candidate.renderedTargetRef !== input.target.targetId) {
    codes.push("CANDIDATE_RENDERED_TARGET_MISMATCH");
  }
  if (candidate.title !== input.target.expectedScreenTitle) codes.push("CANDIDATE_TITLE_MISMATCH");
  const failedKinds = new Set(checks
    .filter((item) => item.disposition !== "exact")
    .map((item) => item.kind));
  if (failedKinds.has("surface_wrapper")) codes.push("CANDIDATE_SURFACE_SET_MISMATCH");
  if (failedKinds.has("control_slot") || failedKinds.has("control_contract")) {
    codes.push("CANDIDATE_CONTROL_SLOT_SET_MISMATCH");
  }
  if (failedKinds.has("action_input") || failedKinds.has("action_input_contract")) {
    codes.push("CANDIDATE_ACTION_INPUT_SET_MISMATCH");
  }
  if (failedKinds.has("observable") || failedKinds.has("undeclared_observable")) {
    codes.push("CANDIDATE_OBSERVABLE_SET_MISMATCH");
  }
  if (failedKinds.has("undeclared_interactive")) codes.push("CANDIDATE_UNDECLARED_INTERACTIVE_CONTROL");
  if (failedKinds.has("undeclared_action")) codes.push("CANDIDATE_UNDECLARED_ACTION");
  if (failedKinds.has("undeclared_control_slot")) codes.push("CANDIDATE_UNDECLARED_CONTROL_SLOT");
  if (failedKinds.has("undeclared_action_input")) codes.push("CANDIDATE_UNDECLARED_ACTION_INPUT");
  if (failedKinds.has("undeclared_surface")) codes.push("CANDIDATE_UNDECLARED_SURFACE");
  return uniqueSorted(codes) as StitchCandidateRejectionCodeV2[];
}

function candidateEvaluation(input: Readonly<{
  target: DesignGenerationTargetV2;
  candidate: StitchCandidateFactV2;
  rendered: StitchRenderedCandidateV2;
}>): StitchCandidateEvaluationV2 {
  const evidence = semanticEvidence(input.target, input.rendered);
  const title = check({
    kind: "screen_title",
    semanticRef: input.target.targetId,
    expectedCount: 1,
    observedCount: 1,
    expectedValue: input.target.expectedScreenTitle,
    observedValue: input.candidate.title,
  });
  const targetIdentity = check({
    kind: "target_identity",
    semanticRef: input.target.targetId,
    expectedCount: 1,
    observedCount: input.candidate.renderedTargetRef ? 1 : 0,
    expectedValue: input.target.targetId,
    ...(input.candidate.renderedTargetRef
      ? { observedValue: input.candidate.renderedTargetRef }
      : {}),
  });
  const semanticChecks = [title, targetIdentity, ...evidence.checks]
    .sort((left, right) =>
      compareUtf16(left.kind, right.kind) || compareUtf16(left.semanticRef, right.semanticRef));
  const rejectionCodes = candidateRejectionCodes({
    target: input.target,
    candidate: input.candidate,
    checks: semanticChecks,
  });
  let qualificationTier: StitchCandidateEvaluationV2["qualificationTier"];
  if (input.candidate.renderDisposition === "excluded_identity_conflict") {
    qualificationTier = "excluded_response_identity_conflict";
  } else if (input.candidate.renderDisposition !== "admitted_renderable_screen") {
    qualificationTier = "excluded_missing_render_evidence";
  } else if (
    input.candidate.htmlArtifactValidity !== "valid"
    || input.candidate.screenshotArtifactValidity !== "valid"
    || rejectionCodes.some((code) => code.startsWith("CANDIDATE_DOWNLOAD_RECEIPT_"))
  ) {
    qualificationTier = "excluded_missing_local_artifact";
  } else if (input.candidate.renderedStatus === "source_rejected") {
    qualificationTier = "rendered_source_rejected";
  } else if (!safeScreenId(input.candidate.screenId)) {
    qualificationTier = "excluded_missing_render_evidence";
  } else if (title.disposition !== "exact") {
    qualificationTier = "renderable_stage_candidate";
  } else if (semanticChecks.every((item) => item.disposition === "exact") && rejectionCodes.length === 0) {
    qualificationTier = "exact_target_semantics";
  } else {
    qualificationTier = "exact_title_incomplete_semantics";
  }
  return {
    screenId: input.candidate.screenId,
    qualificationTier,
    rejectionCodes,
    semanticChecks,
  };
}

export function selectStitchTargetCandidatesV2(input: Readonly<{
  generationTargets: unknown;
  directResponseEvidence: unknown;
  renderedSemantics: unknown;
  artifacts: readonly StitchCandidateArtifactBytesV2[];
}>): StitchCandidateSelectionResultV2 {
  let phase: StitchCandidateSelectionInfrastructurePhaseV2 = "input_validation";
  try {
    const parsed = parseSelectionInputs(input);
    phase = "authority_chain_validation";
    const chain = validateAuthorityChain({ ...parsed, artifacts: input.artifacts });
    phase = "candidate_projection";
    const candidates = candidateFacts({
      directResponseEvidence: parsed.directResponseEvidence,
      renderedByScreen: chain.renderedByScreen,
      artifactByScreen: chain.artifactByScreen,
    });
    const candidateById = new Map(candidates.map((candidate) => [candidate.screenId, candidate] as const));
    phase = "candidate_evaluation";
    const selections = parsed.generationTargets.targets.map((target) => {
      const stage = chain.stageByTarget.get(target.targetId)!;
      const evaluations = stage.candidates
        .map((candidate) => candidateEvaluation({
          target,
          candidate: candidateById.get(candidate.screenId)!,
          rendered: chain.renderedByScreen.get(candidate.screenId)!,
        }))
        .sort((left, right) => compareUtf16(left.screenId, right.screenId));
      const rankedQualifiedScreenIds = evaluations
        .filter((evaluation) => evaluation.qualificationTier === "exact_target_semantics")
        .map((evaluation) => candidateById.get(evaluation.screenId)!)
        .sort((left, right) =>
          compareUtf16(left.htmlArtifactHash ?? "", right.htmlArtifactHash ?? "")
          || compareUtf16(left.screenshotArtifactHash ?? "", right.screenshotArtifactHash ?? "")
          || compareUtf16(left.semanticObservationHash ?? "", right.semanticObservationHash ?? "")
          || compareUtf16(left.screenId, right.screenId))
        .map((candidate) => candidate.screenId);
      return {
        targetRef: target.targetId,
        stageId: stage.stageId,
        evaluations,
        rankedQualifiedScreenIds,
        status: rankedQualifiedScreenIds.length > 0 ? "selected" as const : "unresolved" as const,
        selectedScreenId: rankedQualifiedScreenIds[0] ?? null,
      };
    }).sort((left, right) => compareUtf16(left.targetRef, right.targetRef));
    phase = "output_validation";
    const output = StitchTargetCandidateSelectionV2Schema.safeParse({
      schema: "setfarm.stitch-target-candidate-selection.v2",
      policy: STITCH_TARGET_CANDIDATE_SELECTION_POLICY_V2,
      generationTargetsHash: hashCanonicalJson(parsed.generationTargets),
      directResponseEvidenceHash: hashCanonicalJson(parsed.directResponseEvidence),
      renderedSemanticsHash: hashCanonicalJson(parsed.renderedSemantics),
      candidates,
      selections,
    });
    if (!output.success) {
      throw new StitchCandidateSelectionInfrastructureErrorV2(
        "STITCH_SELECTION_V2_OUTPUT_INVALID",
        phase,
        output.error.issues.slice(0, 20).map((issue) =>
          `${issue.path.join("/") || "$"}:${issue.message}`).join("; "),
      );
    }
    const candidateSelection = output.data;
    const unresolved = candidateSelection.selections.filter((selection) =>
      selection.status === "unresolved");
    if (unresolved.length > 0) {
      return rejectedSelection(candidateSelection, unresolved.map((selection) => diagnostic(
        "DESIGN_CANDIDATE_SELECTION_V2_UNRESOLVED",
        `Target ${selection.targetRef} has no exact candidate under immutable v2 browser authority`,
        selection.targetRef,
      )));
    }
    return { status: "produced", candidateSelection, diagnostics: [] };
  } catch (error) {
    if (error instanceof StitchCandidateSelectionInfrastructureErrorV2) throw error;
    throw infrastructure("STITCH_SELECTION_V2_UNEXPECTED", phase, error);
  }
}

function exactControlElements(
  target: DesignGenerationTargetV2,
  placement: RequiredControlPlacementV2,
  rendered: StitchRenderedCandidateV2,
): StitchRenderedElementV2[] {
  return rendered.elements.filter((element) =>
    element.dataControlSlot === placement.controlSlotRef
    && element.dataAction === placement.actionRef
    && element.nearestSurfaceRef === placement.surfaceRef
    && isInteractive(element)
    && isOperable(element));
}

function selectedFact(
  selection: StitchTargetCandidateSelectionV2,
  targetRef: string,
): Readonly<{
  screenId: string;
  fact: StitchCandidateFactV2;
}> | undefined {
  const selected = selection.selections.find((item) => item.targetRef === targetRef);
  if (!selected?.selectedScreenId || selected.status !== "selected") return undefined;
  const evaluation = selected.evaluations.find((item) => item.screenId === selected.selectedScreenId);
  const fact = selection.candidates.find((candidate) => candidate.screenId === selected.selectedScreenId);
  if (!fact || evaluation?.qualificationTier !== "exact_target_semantics") return undefined;
  return { screenId: selected.selectedScreenId, fact };
}

function bindingChainMismatch(message: string): never {
  throw new StitchCandidateSelectionInfrastructureErrorV2(
    "STITCH_BINDINGS_V3_AUTHORITY_CHAIN_MISMATCH",
    "binding_validation",
    message,
  );
}

function bindStitchTargetCandidateSelectionsV3Internal(input: Readonly<{
  generationTargets: unknown;
  candidateSelection: unknown;
  renderedSemantics: unknown;
}>): StitchTargetBindingResultV3 {
  let generationTargets: DesignGenerationTargetsV2;
  let candidateSelection: StitchTargetCandidateSelectionV2;
  let renderedSemantics: StitchRenderedSemanticsV2;
  try {
    generationTargets = DesignGenerationTargetsV2Schema.parse(input.generationTargets);
    candidateSelection = StitchTargetCandidateSelectionV2Schema.parse(input.candidateSelection);
    renderedSemantics = StitchRenderedSemanticsV2Schema.parse(input.renderedSemantics);
  } catch (error) {
    throw infrastructure("STITCH_BINDINGS_V3_INPUT_INVALID", "binding_validation", error);
  }
  if (
    candidateSelection.generationTargetsHash !== hashCanonicalJson(generationTargets)
    || candidateSelection.renderedSemanticsHash !== hashCanonicalJson(renderedSemantics)
    || renderedSemantics.generationTargetsHash !== hashCanonicalJson(generationTargets)
    || candidateSelection.directResponseEvidenceHash !== renderedSemantics.directResponseEvidenceHash
  ) {
    throw new StitchCandidateSelectionInfrastructureErrorV2(
      "STITCH_BINDINGS_V3_AUTHORITY_CHAIN_MISMATCH",
      "binding_validation",
      "Response bindings v3 inputs do not form one exact candidate/render/target authority chain",
    );
  }
  const unresolved = candidateSelection.selections.filter((selection) =>
    selection.status === "unresolved");
  if (unresolved.length > 0) {
    const diagnostics = sortCompilationDiagnostics(unresolved.map((selection) => diagnostic(
      "DESIGN_BINDINGS_V3_SELECTION_UNRESOLVED",
      `Target ${selection.targetRef} has no selected v2 candidate authority`,
      selection.targetRef,
    )));
    return {
      status: "rejected",
      rejectionCodes: uniqueSorted(diagnostics.map((item) => item.code)),
      diagnostics,
      candidateSelection,
    };
  }
  const renderedByScreen = new Map(renderedSemantics.candidates.map((candidate) =>
    [candidate.screenId, candidate] as const));
  const bindings: StitchTargetResponseBindingsV3["bindings"] = [];
  for (const target of generationTargets.targets) {
    const selected = selectedFact(candidateSelection, target.targetId);
    const rendered = selected ? renderedByScreen.get(selected.screenId) : undefined;
    const fact = selected?.fact;
    if (
      !selected
      || !rendered
      || rendered.status !== "rendered"
      || rendered.targetRef !== target.targetId
      || !fact
      || !fact.htmlSourceRefHash
      || !fact.screenshotSourceRefHash
      || !fact.htmlDownloadedArtifactHash
      || !fact.screenshotDownloadedArtifactHash
      || !fact.htmlArtifactHash
      || !fact.screenshotArtifactHash
      || !fact.renderedHtmlArtifactHash
      || !fact.renderedScreenshotArtifactHash
      || !fact.semanticDomHash
      || !fact.semanticObservationHash
      || !fact.roleReceiptSetHash
      || fact.title !== target.expectedScreenTitle
    ) {
      throw new StitchCandidateSelectionInfrastructureErrorV2(
        "STITCH_BINDINGS_V3_AUTHORITY_CHAIN_MISMATCH",
        "binding_validation",
        `Selected target ${target.targetId} lost exact rendered candidate authority`,
      );
    }
    const elementByRef = new Map(rendered.elements.map((element) =>
      [element.elementRef, element] as const));
    const surfaceBindings = [target.surfaceRef, ...target.containedSurfaceRefs]
      .map((surfaceRef) => {
        const matches = rendered.elements.filter((element) =>
          element.ownSurfaceRef === surfaceRef
          && element.nearestSurfaceRef === surfaceRef);
        if (matches.length !== 1) {
          throw new StitchCandidateSelectionInfrastructureErrorV2(
            "STITCH_BINDINGS_V3_AUTHORITY_CHAIN_MISMATCH",
            "binding_validation",
            `Selected target ${target.targetId} surface ${surfaceRef} is no longer exact`,
          );
        }
        return {
          surfaceRef,
          elementRef: matches[0]!.elementRef,
          elementHash: hashCanonicalJson(matches[0]!),
        };
      }).sort((left, right) => compareUtf16(left.surfaceRef, right.surfaceRef));
    const controlSlotBindings = target.requiredControlPlacements.map((placement) => {
      const matches = exactControlElements(target, placement, rendered);
      if (matches.length !== 1) {
        throw new StitchCandidateSelectionInfrastructureErrorV2(
          "STITCH_BINDINGS_V3_AUTHORITY_CHAIN_MISMATCH",
          "binding_validation",
          `Selected target ${target.targetId} control slot ${placement.controlSlotRef} is no longer exact`,
        );
      }
      return {
        controlSlotRef: placement.controlSlotRef,
        actionRef: placement.actionRef,
        surfaceRef: placement.surfaceRef,
        actionInputRefs: placement.inputFields.map((field) => `${placement.actionRef}.${field}`)
          .sort(compareUtf16),
        elementRef: matches[0]!.elementRef,
        elementHash: hashCanonicalJson(matches[0]!),
      };
    }).sort((left, right) => compareUtf16(left.controlSlotRef, right.controlSlotRef));
    const expectedInputContracts = new Map<string, {
      actionRef: string;
      surfaceRefs: Set<string>;
    }>();
    for (const placement of target.requiredControlPlacements) {
      for (const field of placement.inputFields) {
        const actionInputRef = `${placement.actionRef}.${field}`;
        const contract = expectedInputContracts.get(actionInputRef) ?? {
          actionRef: placement.actionRef,
          surfaceRefs: new Set<string>(),
        };
        contract.surfaceRefs.add(placement.surfaceRef);
        expectedInputContracts.set(actionInputRef, contract);
      }
    }
    const actionInputBindings = [...expectedInputContracts]
      .map(([actionInputRef, contract]) => {
        const matches = rendered.elements.filter((element) =>
          isOperable(element)
          && isInteractive(element)
          && element.nearestSurfaceRef !== null
          && contract.surfaceRefs.has(element.nearestSurfaceRef)
          && inputTokens(element).includes(actionInputRef));
        if (matches.length !== 1 || !matches[0]!.nearestSurfaceRef) {
          bindingChainMismatch(
            `Selected target ${target.targetId} action input ${actionInputRef} is no longer exact`,
          );
        }
        return {
          actionInputRef,
          actionRef: contract.actionRef,
          surfaceRef: matches[0]!.nearestSurfaceRef,
          elementRef: matches[0]!.elementRef,
          elementHash: hashCanonicalJson(matches[0]!),
        };
      })
      .sort((left, right) => compareUtf16(left.actionInputRef, right.actionInputRef));
    const controlBySlot = new Map(controlSlotBindings.map((binding) =>
      [binding.controlSlotRef, binding] as const));
    const surfaceByRef = new Map(surfaceBindings.map((binding) =>
      [binding.surfaceRef, binding] as const));
    const receiptByObservable = new Map(rendered.roleReceipts.map((receipt) =>
      [receipt.observableRef, receipt] as const));
    const observableBindings = target.requiredObservableSelectors.map((observable) => {
      let elementRefs: string[];
      let roleReceiptHash: string | null = null;
      if (observable.selector.kind === "control") {
        const binding = controlBySlot.get(observable.selector.controlSlotRef);
        if (!binding) bindingChainMismatch(`Control observable unresolved: ${observable.observableRef}`);
        elementRefs = [binding.elementRef];
      } else if (observable.selector.kind === "surface") {
        const binding = surfaceByRef.get(observable.selector.surfaceRef);
        if (!binding) bindingChainMismatch(`Surface observable unresolved: ${observable.observableRef}`);
        elementRefs = [binding.elementRef];
      } else if (observable.selector.kind === "accessibility") {
        const receipt = receiptByObservable.get(observable.observableRef);
        if (!receipt || receipt.selectorHash !== hashCanonicalJson(observable.selector)) {
          bindingChainMismatch(`Accessibility observable receipt unresolved: ${observable.observableRef}`);
        }
        elementRefs = [...receipt.elementRefs];
        roleReceiptHash = hashCanonicalJson(receipt);
      } else {
        bindingChainMismatch(
          `Invocation-output observable cannot bind Stitch target: ${observable.observableRef}`,
        );
      }
      const elementHashes = elementRefs.map((elementRef) => {
        const element = elementByRef.get(elementRef);
        if (!element) bindingChainMismatch(`Observable element ref unresolved: ${elementRef}`);
        return hashCanonicalJson(element);
      });
      return {
        observableRef: observable.observableRef,
        actionRef: observable.actionRef,
        selectorKind: observable.selector.kind,
        selectorHash: hashCanonicalJson(observable.selector),
        elementRefs,
        elementHashes,
        roleReceiptHash,
      };
    }).sort((left, right) => compareUtf16(left.observableRef, right.observableRef));
    bindings.push({
      targetRef: target.targetId,
      targetHash: hashCanonicalJson(target),
      requestScreenKey: target.requestScreenKey,
      expectedScreenTitle: target.expectedScreenTitle,
      responseScreenId: fact.screenId,
      responseTitle: fact.title,
      stageId: fact.stageId,
      htmlSourceRefHash: fact.htmlSourceRefHash,
      screenshotSourceRefHash: fact.screenshotSourceRefHash,
      htmlDownloadedArtifactHash: fact.htmlDownloadedArtifactHash,
      screenshotDownloadedArtifactHash: fact.screenshotDownloadedArtifactHash,
      htmlArtifactHash: fact.htmlArtifactHash,
      screenshotArtifactHash: fact.screenshotArtifactHash,
      renderedHtmlArtifactHash: fact.renderedHtmlArtifactHash,
      renderedScreenshotArtifactHash: fact.renderedScreenshotArtifactHash,
      semanticDomHash: fact.semanticDomHash,
      semanticObservationHash: fact.semanticObservationHash,
      roleReceiptSetHash: fact.roleReceiptSetHash,
      surfaceBindings,
      controlSlotBindings,
      actionInputBindings,
      observableBindings,
    });
  }
  const output = StitchTargetResponseBindingsV3Schema.safeParse({
    schema: "setfarm.stitch-target-response-bindings.v3",
    generationTargetsHash: hashCanonicalJson(generationTargets),
    directResponseEvidenceHash: candidateSelection.directResponseEvidenceHash,
    candidateSelectionHash: hashCanonicalJson(candidateSelection),
    renderedSemanticsHash: hashCanonicalJson(renderedSemantics),
    bindings: bindings.sort((left, right) => compareUtf16(left.targetRef, right.targetRef)),
  });
  if (!output.success) {
    throw new StitchCandidateSelectionInfrastructureErrorV2(
      "STITCH_BINDINGS_V3_OUTPUT_INVALID",
      "binding_validation",
      output.error.issues.slice(0, 20).map((issue) =>
        `${issue.path.join("/") || "$"}:${issue.message}`).join("; "),
    );
  }
  return { status: "produced", responseBindings: output.data, diagnostics: [] };
}

export function bindStitchTargetCandidateSelectionsV3(input: Readonly<{
  generationTargets: unknown;
  candidateSelection: unknown;
  renderedSemantics: unknown;
}>): StitchTargetBindingResultV3 {
  try {
    return bindStitchTargetCandidateSelectionsV3Internal(input);
  } catch (error) {
    if (error instanceof StitchCandidateSelectionInfrastructureErrorV2) throw error;
    throw infrastructure("STITCH_SELECTION_V2_UNEXPECTED", "binding_validation", error);
  }
}
