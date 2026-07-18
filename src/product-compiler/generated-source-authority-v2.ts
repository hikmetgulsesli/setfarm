import { canonicalJsonStringify } from "./canonical-json.js";
import type { DesignInteractionGraphV2 } from "./schemas/design-interaction-graph-v2.js";
import type { DesignGenerationTargetsV2 } from "./schemas/design-generation-targets-v2.js";
import {
  GeneratedSourceSemanticIdentityClosureV2Schema,
  type GeneratedSourceSemanticIdentityClosureV2,
} from "./schemas/generated-source-receipt-v2.js";
import type {
  StitchScreenIndexEntryV2,
  StitchScreenIndexV2,
} from "./schemas/stitch-screen-index-v2.js";
import { validateStitchScreenSourceV2 } from "./stitch-screen-source-validator-v2.js";

export type GeneratedSourceAuthorityInputEntryV2 = Readonly<{
  targetRef: string;
  responseScreenId: string;
  sourceLocator: string;
  sourceText: string;
}>;

export type GeneratedSourceAuthorityDiagnosticV2 = Readonly<{
  code:
    | "GENERATED_SOURCE_AUTHORITY_V2_MAPPING_MISMATCH"
    | "GENERATED_SOURCE_AUTHORITY_V2_SOURCE_INVALID";
  message: string;
  reference: string;
}>;

export type BoundGeneratedSourceAuthorityV2 = Readonly<{
  targetRef: string;
  responseScreenId: string;
  sourceLocator: string;
  screenIndexEntry: StitchScreenIndexEntryV2;
  semanticIdentityClosure: GeneratedSourceSemanticIdentityClosureV2;
}>;

export type BindGeneratedSourceAuthoritiesResultV2 =
  | Readonly<{
      status: "bound";
      diagnostics: readonly [];
      authorities: readonly BoundGeneratedSourceAuthorityV2[];
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly GeneratedSourceAuthorityDiagnosticV2[];
    }>;

const MAX_DIAGNOSTICS = 200;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return canonicalJsonStringify([...left].sort(compareUtf16))
    === canonicalJsonStringify([...right].sort(compareUtf16));
}

function diagnostic(
  code: GeneratedSourceAuthorityDiagnosticV2["code"],
  message: string,
  reference: string,
): GeneratedSourceAuthorityDiagnosticV2 {
  return Object.freeze({
    code,
    message: message.slice(0, 1_500),
    reference: reference.slice(0, 500),
  });
}

function compareDiagnostics(
  left: GeneratedSourceAuthorityDiagnosticV2,
  right: GeneratedSourceAuthorityDiagnosticV2,
): number {
  return compareUtf16(
    `${left.code}\0${left.reference}\0${left.message}`,
    `${right.code}\0${right.reference}\0${right.message}`,
  );
}

function physicalControlKey(control: StitchScreenIndexEntryV2["controls"][number]): string | null {
  if (control.semanticSource !== "data-action") return null;
  return canonicalJsonStringify({
    physicalControlRef: control.physicalControlRef,
    actionRef: control.actionRef,
    controlSlotRef: control.controlSlotRef,
    surfaceRef: control.surfaceRef,
    affectedSurfaceRefs: [...control.affectedSurfaceRefs].sort(compareUtf16),
    sourceElementRef: control.sourceElementRef,
  });
}

function graphControlKey(
  graph: DesignInteractionGraphV2,
  control: DesignInteractionGraphV2["controls"][number],
): string {
  const action = graph.actions.find((candidate) => candidate.actionRef === control.identity.actionRef);
  return canonicalJsonStringify({
    physicalControlRef: control.id,
    actionRef: control.identity.actionRef,
    controlSlotRef: control.identity.controlSlotRef,
    surfaceRef: control.identity.surfaceRef,
    affectedSurfaceRefs: [...(action?.affectedSurfaceRefs ?? [])].sort(compareUtf16),
    sourceElementRef: control.elementRef,
  });
}

function indexObservableKey(observable: StitchScreenIndexEntryV2["observables"][number]): string {
  return canonicalJsonStringify({
    observableRef: observable.observableRef,
    actionRef: observable.actionRef,
    selectorKind: observable.selectorKind,
    controlSlotRef: observable.controlSlotRef ?? null,
    surfaceRef: observable.surfaceRef ?? null,
    role: observable.role ?? null,
    name: observable.name ?? null,
    evidenceRef: observable.evidenceRef,
    sourceElementRef: observable.sourceElementRef,
  });
}

function graphObservableKey(
  observable: DesignInteractionGraphV2["observables"][number],
): string {
  return canonicalJsonStringify({
    observableRef: observable.observableRef,
    actionRef: observable.actionRef,
    selectorKind: observable.selector.kind,
    controlSlotRef: observable.selector.kind === "control"
      ? observable.selector.controlSlotRef
      : null,
    surfaceRef: observable.selector.kind === "control"
      ? null
      : observable.selector.surfaceRef,
    role: observable.selector.kind === "accessibility" ? observable.selector.role : null,
    name: observable.selector.kind === "accessibility" ? observable.selector.name : null,
    evidenceRef: observable.evidenceRef,
    sourceElementRef: observable.elementBindings[0]?.elementRef ?? null,
  });
}

function identityClosure(
  input: Readonly<{
    generationTargets: DesignGenerationTargetsV2;
    designGraph: DesignInteractionGraphV2;
  }>,
  targetRef: string,
): GeneratedSourceSemanticIdentityClosureV2 {
  const target = input.generationTargets.targets.find((candidate) => candidate.targetId === targetRef)!;
  const controls = input.designGraph.controls.filter((control) => control.source.targetRef === targetRef);
  const observables = input.designGraph.observables.filter((observable) =>
    observable.source.targetRef === targetRef);
  const actionInputRefs = controls.flatMap((control) =>
    control.actionInputBindings.map((binding) => binding.actionInputRef));
  const actionRefs = uniqueSorted([
    ...target.affectingActionRefs,
    ...controls.map((control) => control.identity.actionRef),
    ...actionInputRefs.map((reference) => reference.slice(0, reference.indexOf("."))),
    ...observables.map((observable) => observable.actionRef),
  ]);
  const generatedElementBindings = [
    ...input.designGraph.surfaces
      .filter((surface) => surface.source.targetRef === targetRef)
      .map((surface) => ({
        kind: "surface" as const,
        subjectRef: surface.surfaceRef,
        elementRef: surface.elementRef,
        elementHash: surface.elementHash,
      })),
    ...controls.map((control) => ({
      kind: "physical_control" as const,
      subjectRef: control.id,
      elementRef: control.elementRef,
      elementHash: control.elementHash,
    })),
  ].sort((left, right) => compareUtf16(
    `${left.kind}\0${left.subjectRef}`,
    `${right.kind}\0${right.subjectRef}`,
  ));
  return GeneratedSourceSemanticIdentityClosureV2Schema.parse({
    schema: "setfarm.generated-source-semantic-identity-closure.v2",
    targetRef: target.targetId,
    surfaceRefs: uniqueSorted([target.surfaceRef, ...target.containedSurfaceRefs]),
    physicalControlRefs: uniqueSorted(controls.map((control) => control.id)),
    actionRefs,
    actionInputRefs: uniqueSorted(actionInputRefs),
    observableRefs: uniqueSorted(observables.map((observable) => observable.observableRef)),
    generatedElementBindings,
  });
}

export function bindGeneratedSourceAuthoritiesV2(input: Readonly<{
  generationTargets: DesignGenerationTargetsV2;
  designGraph: DesignInteractionGraphV2;
  screenIndex: StitchScreenIndexV2;
  generatedSources: readonly GeneratedSourceAuthorityInputEntryV2[];
}>): BindGeneratedSourceAuthoritiesResultV2 {
  const diagnostics: GeneratedSourceAuthorityDiagnosticV2[] = [];
  const add = (
    message: string,
    reference: string,
    code: GeneratedSourceAuthorityDiagnosticV2["code"] =
      "GENERATED_SOURCE_AUTHORITY_V2_MAPPING_MISMATCH",
  ): void => {
    if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push(diagnostic(code, message, reference));
  };
  const maps = [
    ["generation targets", input.generationTargets.targets.map((item) => item.targetId)],
    ["graph source authorities", input.designGraph.sourceAuthorities.map((item) => item.targetRef)],
    ["screen index", input.screenIndex.map((item) => item.projection.targetRef)],
    ["generated sources", input.generatedSources.map((item) => item.targetRef)],
  ] as const;
  const expectedTargets = uniqueSorted(maps[0][1]);
  for (const [label, refs] of maps) {
    if (refs.length !== new Set(refs).size || !sameStrings(expectedTargets, refs)) {
      add(`${label} must equal the every-and-only generation-target set`, label);
    }
  }
  const responseMaps = [
    ["graph response screens", input.designGraph.sourceAuthorities.map((item) => item.responseScreenId)],
    ["screen-index response screens", input.screenIndex.map((item) => item.screenId)],
    ["generated-source response screens", input.generatedSources.map((item) => item.responseScreenId)],
  ] as const;
  const expectedResponses = uniqueSorted(responseMaps[0][1]);
  for (const [label, refs] of responseMaps) {
    if (refs.length !== new Set(refs).size || !sameStrings(expectedResponses, refs)) {
      add(`${label} must equal the every-and-only graph response-screen set`, label);
    }
  }

  const graphAuthorityByTarget = new Map(input.designGraph.sourceAuthorities.map((item) =>
    [item.targetRef, item] as const));
  const screenByTarget = new Map(input.screenIndex.map((item) =>
    [item.projection.targetRef, item] as const));
  const sourceByTarget = new Map(input.generatedSources.map((item) =>
    [item.targetRef, item] as const));
  for (const target of input.generationTargets.targets) {
    const graphAuthority = graphAuthorityByTarget.get(target.targetId);
    const screen = screenByTarget.get(target.targetId);
    const source = sourceByTarget.get(target.targetId);
    if (!graphAuthority || !screen || !source) continue;
    if (
      graphAuthority.responseScreenId !== screen.screenId
      || graphAuthority.responseScreenId !== source.responseScreenId
      || screen.file !== source.sourceLocator
    ) {
      add("Target must resolve to one exact graph screen, index entry, and generated source locator", target.targetId);
    }
    const sourceValidation = validateStitchScreenSourceV2({
      screen,
      sourceText: source.sourceText,
      surfaceBindings: input.designGraph.surfaces
        .filter((surface) => surface.source.targetRef === target.targetId)
        .map((surface) => ({
          surfaceRef: surface.surfaceRef,
          elementRef: surface.elementRef,
        })),
    });
    if (sourceValidation.status !== "valid") {
      add(
        `Generated source failed exact SCREEN_INDEX AST validation: ${sourceValidation.rejectionCodes.join(",")}`,
        source.sourceLocator,
        "GENERATED_SOURCE_AUTHORITY_V2_SOURCE_INVALID",
      );
    }
    const expectedSurfaces = uniqueSorted([target.surfaceRef, ...target.containedSurfaceRefs]);
    const graphSurfaces = input.designGraph.surfaces
      .filter((surface) => surface.source.targetRef === target.targetId)
      .map((surface) => surface.surfaceRef);
    if (!sameStrings(expectedSurfaces, graphSurfaces)) {
      add("Generation target and design graph do not bind every and only target surface", target.targetId);
    }
    const graphControls = input.designGraph.controls.filter((control) =>
      control.source.targetRef === target.targetId);
    const graphControlKeys = graphControls.map((control) => graphControlKey(input.designGraph, control));
    const indexControlKeys = screen.controls
      .map(physicalControlKey)
      .filter((value): value is string => value !== null);
    if (!sameStrings(graphControlKeys, indexControlKeys)) {
      add("SCREEN_INDEX does not bind every and only target physical control", target.targetId);
    }
    const graphInputs = graphControls.flatMap((control) => control.actionInputBindings.map((binding) =>
      `${binding.actionInputRef}\0${binding.elementRef}`));
    const indexInputs = screen.controls.flatMap((control) => (control.inputBindings ?? []).map((binding) =>
      `${binding.actionRef}.${binding.inputField}\0${control.sourceElementRef}`));
    if (
      graphInputs.length !== new Set(graphInputs).size
      || indexInputs.length !== new Set(indexInputs).size
      || !sameStrings(graphInputs, indexInputs)
    ) add("SCREEN_INDEX does not bind every and only target action-input element", target.targetId);
    const graphObservables = input.designGraph.observables.filter((observable) =>
      observable.source.targetRef === target.targetId);
    if (!sameStrings(graphObservables.map(graphObservableKey), screen.observables.map(indexObservableKey))) {
      add("SCREEN_INDEX does not bind every and only target observable", target.targetId);
    }
  }
  if (diagnostics.length > 0) {
    return Object.freeze({
      status: "rejected",
      diagnostics: Object.freeze(diagnostics.sort(compareDiagnostics).slice(0, MAX_DIAGNOSTICS)),
    });
  }
  const authorities = input.generationTargets.targets
    .map((target) => {
      const screen = screenByTarget.get(target.targetId)!;
      const source = sourceByTarget.get(target.targetId)!;
      return Object.freeze({
        targetRef: target.targetId,
        responseScreenId: source.responseScreenId,
        sourceLocator: source.sourceLocator,
        screenIndexEntry: screen,
        semanticIdentityClosure: identityClosure(input, target.targetId),
      });
    })
    .sort((left, right) => compareUtf16(left.targetRef, right.targetRef));
  return Object.freeze({
    status: "bound",
    diagnostics: EMPTY_DIAGNOSTICS,
    authorities: Object.freeze(authorities),
  });
}
