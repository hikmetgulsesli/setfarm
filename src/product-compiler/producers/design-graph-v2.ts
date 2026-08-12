import { hashCanonicalJson } from "../canonical-json.js";
import { produceDesignGenerationTargetsV2 } from "./design-targets-v2.js";
import { bindStitchTargetCandidateSelectionsV3 } from "./stitch-target-candidate-selection-v2.js";
import {
  DesignGenerationTargetsV2Schema,
  type DesignGenerationTargetsV2,
} from "../schemas/design-generation-targets-v2.js";
import {
  DesignInteractionGraphV2Schema,
  designControlIdV2,
  designControlIdentityHashV2,
  designTargetSourceAuthorityHashV2,
  type DesignElementSourceV2,
  type DesignInteractionGraphV2,
  type DesignTargetSourceAuthorityV2,
} from "../schemas/design-interaction-graph-v2.js";
import {
  ProductSpecV2Schema,
  type ProductActionV2,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";
import {
  StitchRenderedSemanticsV2Schema,
  type StitchRenderedCandidateV2,
  type StitchRenderedElementV2,
  type StitchRenderedSemanticsV2,
} from "../schemas/stitch-rendered-semantics-v2.js";
import {
  StitchTargetCandidateSelectionV2Schema,
  StitchTargetResponseBindingsV3Schema,
  type StitchTargetCandidateSelectionV2,
  type StitchTargetResponseBindingsV3,
} from "../schemas/stitch-target-candidate-selection-v2.js";

export type DesignInteractionGraphInfrastructurePhaseV2 =
  | "input_validation"
  | "authority_chain_validation"
  | "contract_validation"
  | "graph_projection"
  | "output_validation";

export class DesignInteractionGraphInfrastructureErrorV2 extends Error {
  readonly code:
    | "DESIGN_GRAPH_V2_INPUT_INVALID"
    | "DESIGN_GRAPH_V2_AUTHORITY_CHAIN_MISMATCH"
    | "DESIGN_GRAPH_V2_CONTRACT_MISMATCH"
    | "DESIGN_GRAPH_V2_OUTPUT_INVALID"
    | "DESIGN_GRAPH_V2_UNEXPECTED";

  readonly phase: DesignInteractionGraphInfrastructurePhaseV2;

  constructor(
    code: DesignInteractionGraphInfrastructureErrorV2["code"],
    phase: DesignInteractionGraphInfrastructurePhaseV2,
    message: string,
  ) {
    super(message);
    this.name = "DesignInteractionGraphInfrastructureErrorV2";
    this.code = code;
    this.phase = phase;
  }
}

export type DesignInteractionGraphProducerResultV2 = Readonly<{
  status: "produced";
  designGraph: DesignInteractionGraphV2;
  diagnostics: readonly [];
}>;

type ParsedInputs = Readonly<{
  productSpec: ProductSpecV2;
  generationTargets: DesignGenerationTargetsV2;
  renderedSemantics: StitchRenderedSemanticsV2;
  candidateSelection: StitchTargetCandidateSelectionV2;
  responseBindings: StitchTargetResponseBindingsV3;
}>;

type StitchTargetResponseBindingV3 = StitchTargetResponseBindingsV3["bindings"][number];

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function graphError(
  code: DesignInteractionGraphInfrastructureErrorV2["code"],
  phase: DesignInteractionGraphInfrastructurePhaseV2,
  message: string,
): DesignInteractionGraphInfrastructureErrorV2 {
  return new DesignInteractionGraphInfrastructureErrorV2(code, phase, message.slice(0, 8_000));
}

function contractMismatch(message: string): never {
  throw graphError("DESIGN_GRAPH_V2_CONTRACT_MISMATCH", "contract_validation", message);
}

function parseInputs(input: Readonly<{
  productSpec: unknown;
  generationTargets: unknown;
  renderedSemantics: unknown;
  candidateSelection: unknown;
  responseBindings: unknown;
}>): ParsedInputs {
  try {
    return {
      productSpec: ProductSpecV2Schema.parse(input.productSpec),
      generationTargets: DesignGenerationTargetsV2Schema.parse(input.generationTargets),
      renderedSemantics: StitchRenderedSemanticsV2Schema.parse(input.renderedSemantics),
      candidateSelection: StitchTargetCandidateSelectionV2Schema.parse(input.candidateSelection),
      responseBindings: StitchTargetResponseBindingsV3Schema.parse(input.responseBindings),
    };
  } catch (error) {
    throw graphError("DESIGN_GRAPH_V2_INPUT_INVALID", "input_validation", errorText(error));
  }
}

function validateAuthorityChain(input: ParsedInputs): void {
  const productSpecHash = hashCanonicalJson(input.productSpec);
  const generationTargetsHash = hashCanonicalJson(input.generationTargets);
  const renderedSemanticsHash = hashCanonicalJson(input.renderedSemantics);
  const candidateSelectionHash = hashCanonicalJson(input.candidateSelection);
  if (
    input.generationTargets.productSpecHash !== productSpecHash
    || input.renderedSemantics.generationTargetsHash !== generationTargetsHash
    || input.candidateSelection.generationTargetsHash !== generationTargetsHash
    || input.candidateSelection.renderedSemanticsHash !== renderedSemanticsHash
    || input.candidateSelection.directResponseEvidenceHash
      !== input.renderedSemantics.directResponseEvidenceHash
    || input.responseBindings.generationTargetsHash !== generationTargetsHash
    || input.responseBindings.renderedSemanticsHash !== renderedSemanticsHash
    || input.responseBindings.candidateSelectionHash !== candidateSelectionHash
    || input.responseBindings.directResponseEvidenceHash
      !== input.renderedSemantics.directResponseEvidenceHash
  ) {
    throw graphError(
      "DESIGN_GRAPH_V2_AUTHORITY_CHAIN_MISMATCH",
      "authority_chain_validation",
      "ProductSpec, generation targets, rendered semantics, candidate selection, and response bindings do not form one exact hash chain",
    );
  }
}

function validateProductContract(input: ParsedInputs): void {
  const expectedTargets = produceDesignGenerationTargetsV2(input.productSpec);
  if (
    expectedTargets.status !== "produced"
    || hashCanonicalJson(expectedTargets.generationTargets) !== hashCanonicalJson(input.generationTargets)
  ) {
    contractMismatch(
      "Generation targets are not the exact deterministic projection of ProductSpec v2 surfaces, control placements, affected surfaces, and observables",
    );
  }
  if (input.candidateSelection.selections.some((selection) => selection.status !== "selected")) {
    contractMismatch("DesignInteractionGraph v2 forbids unresolved candidate selections");
  }

  let rebound;
  try {
    rebound = bindStitchTargetCandidateSelectionsV3({
      generationTargets: input.generationTargets,
      candidateSelection: input.candidateSelection,
      renderedSemantics: input.renderedSemantics,
    });
  } catch (error) {
    throw graphError(
      "DESIGN_GRAPH_V2_CONTRACT_MISMATCH",
      "contract_validation",
      `Response binding authority could not be reproduced: ${errorText(error)}`,
    );
  }
  if (
    rebound.status !== "produced"
    || hashCanonicalJson(rebound.responseBindings) !== hashCanonicalJson(input.responseBindings)
  ) {
    contractMismatch("Response bindings are not the exact deterministic v3 projection of the selected rendered candidates");
  }
}

function sourceAuthority(binding: StitchTargetResponseBindingV3): DesignTargetSourceAuthorityV2 {
  const payload = {
    targetRef: binding.targetRef,
    targetHash: binding.targetHash,
    responseScreenId: binding.responseScreenId,
    stageId: binding.stageId,
    htmlSourceRefHash: binding.htmlSourceRefHash,
    screenshotSourceRefHash: binding.screenshotSourceRefHash,
    htmlDownloadedArtifactHash: binding.htmlDownloadedArtifactHash,
    screenshotDownloadedArtifactHash: binding.screenshotDownloadedArtifactHash,
    htmlArtifactHash: binding.htmlArtifactHash,
    screenshotArtifactHash: binding.screenshotArtifactHash,
    renderedHtmlArtifactHash: binding.renderedHtmlArtifactHash,
    renderedScreenshotArtifactHash: binding.renderedScreenshotArtifactHash,
    semanticDomHash: binding.semanticDomHash,
    semanticObservationHash: binding.semanticObservationHash,
    roleReceiptSetHash: binding.roleReceiptSetHash,
  };
  return { ...payload, sourceHash: designTargetSourceAuthorityHashV2(payload) };
}

function elementSource(source: DesignTargetSourceAuthorityV2): DesignElementSourceV2 {
  return {
    targetRef: source.targetRef,
    responseScreenId: source.responseScreenId,
    sourceHash: source.sourceHash,
    htmlArtifactHash: source.htmlArtifactHash,
    screenshotArtifactHash: source.screenshotArtifactHash,
    semanticDomHash: source.semanticDomHash,
    semanticObservationHash: source.semanticObservationHash,
  };
}

function renderedElement(
  rendered: StitchRenderedCandidateV2,
  elementRef: string,
  elementHash: string,
  reference: string,
): StitchRenderedElementV2 {
  const element = rendered.elements.find((candidate) => candidate.elementRef === elementRef);
  if (!element || hashCanonicalJson(element) !== elementHash) {
    contractMismatch(`${reference} lost its exact rendered element ref/hash authority`);
  }
  return element;
}

function targetForSurface(
  generationTargets: DesignGenerationTargetsV2,
  surfaceRef: string,
): DesignGenerationTargetsV2["targets"][number] {
  const matches = generationTargets.targets.filter((target) =>
    target.surfaceRef === surfaceRef || target.containedSurfaceRefs.includes(surfaceRef));
  if (matches.length !== 1) {
    contractMismatch(`ProductSpec surface ${surfaceRef} must belong to exactly one generation target`);
  }
  return matches[0]!;
}

function observableSurfaceRef(
  action: ProductActionV2,
  observable: ProductActionV2["observableEffects"][number],
): string {
  const selector = observable.selector;
  if (selector.kind === "invocation_output") {
    contractMismatch(`Observable ${observable.id} is non-rendered invocation output and cannot enter a design graph`);
  }
  if (selector.kind !== "control") return selector.surfaceRef;
  const placement = action.controlPlacements.find((candidate) =>
    candidate.id === selector.controlSlotRef);
  if (!placement) contractMismatch(`Observable ${observable.id} references an absent ProductSpec control slot`);
  return placement.surfaceRef;
}

function canonicalAssertions<T extends { phase: string; property: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) =>
    compareUtf16(`${left.phase}\0${left.property}`, `${right.phase}\0${right.property}`));
}

function projectGraph(input: ParsedInputs): DesignInteractionGraphV2 {
  const responseByTarget = new Map(input.responseBindings.bindings.map((binding) =>
    [binding.targetRef, binding] as const));
  const renderedByScreen = new Map(input.renderedSemantics.candidates.map((candidate) =>
    [candidate.screenId, candidate] as const));
  const sourceAuthorities = input.responseBindings.bindings
    .map(sourceAuthority)
    .sort((left, right) => compareUtf16(left.targetRef, right.targetRef));
  const sourceByTarget = new Map(sourceAuthorities.map((source) => [source.targetRef, source] as const));

  if (sourceAuthorities.length !== input.generationTargets.targets.length) {
    contractMismatch("Every generation target requires exactly one selected response source authority");
  }

  const surfaces: DesignInteractionGraphV2["surfaces"] = input.productSpec.surfaces
    .map((surface) => {
      const target = targetForSurface(input.generationTargets, surface.id);
      const response = responseByTarget.get(target.targetId);
      const source = sourceByTarget.get(target.targetId);
      const rendered = response ? renderedByScreen.get(response.responseScreenId) : undefined;
      const binding = response?.surfaceBindings.find((candidate) =>
        candidate.surfaceRef === surface.id);
      if (!response || !source || !rendered || rendered.status !== "rendered" || !binding) {
        contractMismatch(`Surface ${surface.id} has no exact target/screen/rendered response binding`);
      }
      renderedElement(rendered, binding.elementRef, binding.elementHash, `Surface ${surface.id}`);
      return {
        surfaceRef: surface.id,
        productSurfaceHash: hashCanonicalJson(surface),
        designSurfaceRef: target.designSurfaceId,
        routeRef: surface.routeRef,
        kind: surface.kind,
        required: surface.required,
        composition: surface.composition,
        source: elementSource(source),
        elementRef: binding.elementRef,
        elementHash: binding.elementHash,
      };
    })
    .sort((left, right) => compareUtf16(left.surfaceRef, right.surfaceRef));

  const controls: DesignInteractionGraphV2["controls"] = input.productSpec.actions
    .flatMap((action) => action.controlPlacements.map((placement) => {
      const surface = input.productSpec.surfaces.find((candidate) =>
        candidate.id === placement.surfaceRef);
      if (!surface) contractMismatch(`Control slot ${placement.id} references an absent ProductSpec surface`);
      const target = targetForSurface(input.generationTargets, placement.surfaceRef);
      const response = responseByTarget.get(target.targetId);
      const source = sourceByTarget.get(target.targetId);
      const rendered = response ? renderedByScreen.get(response.responseScreenId) : undefined;
      const binding = response?.controlSlotBindings.find((candidate) =>
        candidate.controlSlotRef === placement.id);
      if (
        !response
        || !source
        || !rendered
        || rendered.status !== "rendered"
        || !binding
        || binding.actionRef !== action.id
        || binding.surfaceRef !== placement.surfaceRef
      ) {
        contractMismatch(`Control slot ${placement.id} has no exact action/surface/response binding`);
      }
      const expectedInputRefs = action.input.fields
        .map((field) => `${action.id}.${field.name}`)
        .sort(compareUtf16);
      if (JSON.stringify(binding.actionInputRefs) !== JSON.stringify(expectedInputRefs)) {
        contractMismatch(`Control slot ${placement.id} does not preserve every exact ProductSpec action input ref`);
      }
      const element = renderedElement(
        rendered,
        binding.elementRef,
        binding.elementHash,
        `Control slot ${placement.id}`,
      );
      if (
        element.dataAction !== action.id
        || element.dataControlSlot !== placement.id
        || element.nearestSurfaceRef !== placement.surfaceRef
        || element.renderState !== "rendered"
        || !element.enabled
        || !element.pointerOperable
        || (!element.nativeControlKind && !element.interactiveRole)
      ) {
        contractMismatch(`Control slot ${placement.id} is not one exact reachable rendered control`);
      }
      const actionInputBindings = action.input.fields
        .map((field) => {
          const actionInputRef = `${action.id}.${field.name}`;
          const inputBinding = response.actionInputBindings.find((candidate) =>
            candidate.actionInputRef === actionInputRef);
          if (!inputBinding || inputBinding.actionRef !== action.id) {
            contractMismatch(`Action input ${actionInputRef} has no exact response element binding`);
          }
          renderedElement(
            rendered,
            inputBinding.elementRef,
            inputBinding.elementHash,
            `Action input ${actionInputRef}`,
          );
          return {
            actionInputRef,
            fieldRef: field.name,
            elementRef: inputBinding.elementRef,
            elementHash: inputBinding.elementHash,
          };
        })
        .sort((left, right) => compareUtf16(left.actionInputRef, right.actionInputRef));
      const identityPayload = {
        schema: "setfarm.design-control-identity.v2" as const,
        controlSlotRef: placement.id,
        actionRef: action.id,
        routeRef: surface.routeRef,
        surfaceRef: placement.surfaceRef,
      };
      return {
        id: designControlIdV2(identityPayload),
        identity: {
          ...identityPayload,
          identityHash: designControlIdentityHashV2(identityPayload),
        },
        controlPlacementHash: hashCanonicalJson(placement),
        source: elementSource(source),
        elementRef: element.elementRef,
        elementHash: hashCanonicalJson(element),
        dataAction: action.id,
        dataControlSlot: placement.id,
        tagName: element.tagName,
        nativeControlKind: element.nativeControlKind,
        role: element.role,
        ariaLabel: element.ariaLabel,
        href: element.href,
        interactiveRole: element.interactiveRole,
        renderState: "rendered" as const,
        enabled: true as const,
        pointerOperable: true as const,
        actionInputBindings,
      };
    }))
    .sort((left, right) => compareUtf16(left.id, right.id));

  const controlBySlot = new Map(controls.map((control) =>
    [control.identity.controlSlotRef, control] as const));
  const actions: DesignInteractionGraphV2["actions"] = input.productSpec.actions
    .map((action) => {
      const actionControls = controls.filter((control) =>
        control.identity.actionRef === action.id);
      return {
        actionRef: action.id,
        productActionHash: hashCanonicalJson(action),
        triggerKind: action.trigger.kind,
        navigation: action.navigation,
        controlSlotRefs: action.controlPlacements.map((placement) => placement.id).sort(compareUtf16),
        controlRefs: actionControls.map((control) => control.id).sort(compareUtf16),
        affectedSurfaceRefs: [...action.affectedSurfaceRefs].sort(compareUtf16),
        observableRefs: action.observableEffects.map((observable) => observable.id).sort(compareUtf16),
      };
    })
    .sort((left, right) => compareUtf16(left.actionRef, right.actionRef));

  const observables: DesignInteractionGraphV2["observables"] = input.productSpec.actions
    .flatMap((action) => action.observableEffects.map((observable) => {
      const surfaceRef = observableSurfaceRef(action, observable);
      const target = targetForSurface(input.generationTargets, surfaceRef);
      const response = responseByTarget.get(target.targetId);
      const source = sourceByTarget.get(target.targetId);
      const rendered = response ? renderedByScreen.get(response.responseScreenId) : undefined;
      const binding = response?.observableBindings.find((candidate) =>
        candidate.observableRef === observable.id);
      const selectorHash = hashCanonicalJson(observable.selector);
      if (
        !response
        || !source
        || !rendered
        || rendered.status !== "rendered"
        || !binding
        || binding.actionRef !== action.id
        || binding.selectorKind !== observable.selector.kind
        || binding.selectorHash !== selectorHash
      ) {
        contractMismatch(`Observable ${observable.id} has no exact selector/action/response binding`);
      }
      const elementBindings = binding.elementRefs.map((elementRef, index) => {
        const elementHash = binding.elementHashes[index];
        if (!elementHash) contractMismatch(`Observable ${observable.id} lost an element hash`);
        renderedElement(rendered, elementRef, elementHash, `Observable ${observable.id}`);
        return { elementRef, elementHash };
      }).sort((left, right) => compareUtf16(left.elementRef, right.elementRef));

      let roleReceipt: DesignInteractionGraphV2["observables"][number]["roleReceipt"] = null;
      if (observable.selector.kind === "accessibility") {
        const receipt = rendered.roleReceipts.find((candidate) =>
          candidate.observableRef === observable.id);
        if (
          !receipt
          || binding.roleReceiptHash !== hashCanonicalJson(receipt)
          || receipt.selectorHash !== selectorHash
        ) {
          contractMismatch(`Accessibility observable ${observable.id} lost its exact browser role receipt`);
        }
        roleReceipt = { receiptHash: binding.roleReceiptHash, receipt };
      } else if (binding.roleReceiptHash !== null) {
        contractMismatch(`Non-accessibility observable ${observable.id} cannot claim a role receipt`);
      }

      if (observable.selector.kind === "control") {
        const control = controlBySlot.get(observable.selector.controlSlotRef);
        if (!control || control.identity.actionRef !== action.id) {
          contractMismatch(`Control observable ${observable.id} does not resolve to its owning action slot`);
        }
      }

      const assertions = canonicalAssertions(observable.assertions);
      return {
        observableRef: observable.id,
        productObservableHash: hashCanonicalJson(observable),
        actionRef: action.id,
        selector: observable.selector,
        selectorHash,
        assertions,
        assertionsHash: hashCanonicalJson(assertions),
        evidenceRef: observable.evidenceRef,
        source: elementSource(source),
        elementBindings,
        roleReceipt,
      };
    }))
    .sort((left, right) => compareUtf16(left.observableRef, right.observableRef));

  const rawArtifactHashes = uniqueSorted(sourceAuthorities.flatMap((source) => [
    source.htmlArtifactHash,
    source.screenshotArtifactHash,
  ]));
  const cardinality = {
    rawArtifacts: rawArtifactHashes.length,
    sourceAuthorities: sourceAuthorities.length,
    surfaces: surfaces.length,
    actions: actions.length,
    userActions: actions.filter((action) => action.triggerKind === "user").length,
    controlSlots: actions.reduce((total, action) => total + action.controlSlotRefs.length, 0),
    physicalControls: controls.length,
    actionInputBindings: controls.reduce(
      (total, control) => total + control.actionInputBindings.length,
      0,
    ),
    observables: observables.length,
  };

  const output = DesignInteractionGraphV2Schema.safeParse({
    schema: "setfarm.design-interaction-graph.v2",
    productSpecHash: hashCanonicalJson(input.productSpec),
    generationTargetsHash: hashCanonicalJson(input.generationTargets),
    renderedSemanticsHash: hashCanonicalJson(input.renderedSemantics),
    candidateSelectionHash: hashCanonicalJson(input.candidateSelection),
    responseBindingsHash: hashCanonicalJson(input.responseBindings),
    rawArtifactHashes,
    sourceAuthorities,
    surfaces,
    actions,
    controls,
    observables,
    cardinality,
  });
  if (!output.success) {
    throw graphError(
      "DESIGN_GRAPH_V2_OUTPUT_INVALID",
      "output_validation",
      output.error.issues.slice(0, 50).map((issue) =>
        `${issue.path.join("/") || "$"}:${issue.message}`).join("; "),
    );
  }
  return output.data;
}

export function produceDesignInteractionGraphV2(input: Readonly<{
  productSpec: unknown;
  generationTargets: unknown;
  renderedSemantics: unknown;
  candidateSelection: unknown;
  responseBindings: unknown;
}>): DesignInteractionGraphProducerResultV2 {
  try {
    const parsed = parseInputs(input);
    validateAuthorityChain(parsed);
    validateProductContract(parsed);
    return { status: "produced", designGraph: projectGraph(parsed), diagnostics: [] };
  } catch (error) {
    if (error instanceof DesignInteractionGraphInfrastructureErrorV2) throw error;
    throw graphError("DESIGN_GRAPH_V2_UNEXPECTED", "graph_projection", errorText(error));
  }
}
