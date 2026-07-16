import { createHash } from "node:crypto";
import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import {
  BuildTopologyV1Schema,
  type BuildTopologyV1,
} from "../schemas/build-topology-v1.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  PathBindingIdSchema,
  SourceArtifactRefV1Schema,
} from "../schemas/common-v1.js";
import { GenerationTargetIdSchema } from "../schemas/design-generation-targets-v1.js";
import {
  DesignGenerationTargetsV2Schema,
  type DesignGenerationTargetV2,
} from "../schemas/design-generation-targets-v2.js";
import {
  DesignInteractionGraphV2Schema,
  type DesignInteractionGraphV2,
  type DesignPhysicalControlV2,
} from "../schemas/design-interaction-graph-v2.js";
import {
  DesignSourceClosureV2Schema,
} from "../schemas/design-source-closure-v2.js";
import {
  ImplementationSourceMapV1Schema,
  implementationSourceMapPayloadHashV1,
  type ImplementationActionInputSourceV1,
  type ImplementationControlSourceV1,
  type ImplementationObservableSourceV1,
  type ImplementationScreenSourceV1,
  type ImplementationSourceMapV1,
} from "../schemas/implementation-source-map-v1.js";
import {
  ProductSpecV2Schema,
  type ProductActionV2,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";
import { StoryPlanV2Schema, type StoryPlanV2 } from "../schemas/story-plan-v2.js";
import { StitchScreenIndexV2Schema } from "../schemas/stitch-screen-index-v2.js";
import {
  StitchTargetResponseBindingsV3Schema,
} from "../schemas/stitch-target-candidate-selection-v2.js";
import { produceDesignGenerationTargetsV2 } from "./design-targets-v2.js";
import { produceStoryPlanV2 } from "./story-plan-v2.js";
import { validateStitchScreenSourceV2 } from "../stitch-screen-source-validator-v2.js";

const GeneratedSourceRefV1Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  responseScreenId: z.string().min(1).max(500),
  pathRef: PathBindingIdSchema,
  source: SourceArtifactRefV1Schema,
  text: z.string().max(20_000_000),
}).strict();

const ExactTextSourceV1Schema = z.object({
  source: SourceArtifactRefV1Schema,
  text: z.string().max(20_000_000),
}).strict();

export type ImplementationGeneratedSourceRefV1 = z.infer<
  typeof GeneratedSourceRefV1Schema
>;

const CommonInputShape = {
  productSpec: ProductSpecV2Schema,
  buildTopology: BuildTopologyV1Schema,
  storyPlan: StoryPlanV2Schema,
  designSourceClosure: DesignSourceClosureV2Schema,
};

const NoDesignInputSchema = z.object({
  ...CommonInputShape,
  designSourceKind: z.literal("none"),
  designGraph: z.null(),
  generationTargets: z.null(),
  responseBindings: z.null(),
  screenIndex: z.array(z.never()).length(0),
  screenIndexSource: z.null(),
  converterSource: z.null(),
  generatedSources: z.array(z.never()).length(0),
}).strict();

const StitchInputSchema = z.object({
  ...CommonInputShape,
  designSourceKind: z.literal("stitch"),
  designGraph: DesignInteractionGraphV2Schema,
  generationTargets: DesignGenerationTargetsV2Schema,
  responseBindings: StitchTargetResponseBindingsV3Schema,
  screenIndex: StitchScreenIndexV2Schema,
  screenIndexSource: ExactTextSourceV1Schema,
  converterSource: ExactTextSourceV1Schema,
  generatedSources: z.array(GeneratedSourceRefV1Schema).min(1).max(1_000),
}).strict();

const ImplementationSourceMapProducerInputV1Schema = z.discriminatedUnion(
  "designSourceKind",
  [NoDesignInputSchema, StitchInputSchema],
);

export type ImplementationSourceMapProducerInputV1 = z.input<
  typeof ImplementationSourceMapProducerInputV1Schema
>;

export type ImplementationSourceMapProducerResultV1 =
  | Readonly<{
      status: "produced";
      sourceMap: ImplementationSourceMapV1;
      payloadHash: string;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

type ParsedInput = z.infer<typeof ImplementationSourceMapProducerInputV1Schema>;
type StitchInput = Extract<ParsedInput, { designSourceKind: "stitch" }>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  const canonicalLeft = uniqueSorted(left);
  const canonicalRight = uniqueSorted(right);
  return canonicalLeft.length === canonicalRight.length
    && canonicalLeft.every((value, index) => value === canonicalRight[index]);
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isCanonical(values: readonly string[]): boolean {
  return values.every((value, index) =>
    index === 0 || compareUtf16(value, values[index - 1]!) > 0);
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates].sort(compareUtf16);
}

function diagnostic(input: {
  code: string;
  message: string;
  reference?: string;
  category?: CompilationDiagnosticV1["category"];
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: input.category ?? "contract",
    severity: "error",
    message: input.message.slice(0, 2_000),
    ...(input.reference ? { reference: input.reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(
  diagnostics: readonly CompilationDiagnosticV1[],
): ImplementationSourceMapProducerResultV1 {
  const sorted = sortCompilationDiagnostics(diagnostics).slice(0, 10_000);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
  };
}

function addSetMismatchDiagnostics(
  diagnostics: CompilationDiagnosticV1[],
  codePrefix: string,
  label: string,
  expected: readonly string[],
  observed: readonly string[],
): void {
  const expectedSet = new Set(expected);
  const observedSet = new Set(observed);
  uniqueSorted(expected.filter((value) => !observedSet.has(value))).forEach((value) => {
    diagnostics.push(diagnostic({
      code: `${codePrefix}_MISSING`,
      category: "link",
      message: `${label} is missing required identity ${value}`,
      reference: value,
    }));
  });
  uniqueSorted(observed.filter((value) => !expectedSet.has(value))).forEach((value) => {
    diagnostics.push(diagnostic({
      code: `${codePrefix}_EXTRA`,
      category: "link",
      message: `${label} contains unauthorized identity ${value}`,
      reference: value,
    }));
  });
}

function addAmbiguityDiagnostics(
  diagnostics: CompilationDiagnosticV1[],
  label: string,
  identities: readonly string[],
): void {
  duplicateValues(identities).forEach((identity) => {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_MAPPING_AMBIGUOUS",
      category: "link",
      message: `${label} repeats exact identity ${identity}`,
      reference: identity,
    }));
  });
}

function validateBoundAuthority(input: ParsedInput): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const productSpecHash = hashCanonicalJson(input.productSpec);
  const buildTopologyHash = hashCanonicalJson(input.buildTopology);
  const designGraphHash = input.designGraph ? hashCanonicalJson(input.designGraph) : null;

  if (input.designSourceClosure.kind !== input.designSourceKind) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_DESIGN_SOURCE_CLOSURE_KIND_MISMATCH",
      message: "DesignSourceClosureV2 discriminator must equal the exact source-map design branch",
    }));
  }

  if (input.storyPlan.productSpecHash !== productSpecHash) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_PRODUCT_SPEC_HASH_MISMATCH",
      message: "StoryPlanV2 does not bind the exact ProductSpecV2 payload",
    }));
  }
  if (input.storyPlan.buildTopologyHash !== buildTopologyHash) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_BUILD_TOPOLOGY_HASH_MISMATCH",
      message: "StoryPlanV2 does not bind the exact BuildTopologyV1 payload",
    }));
  }
  if (
    input.storyPlan.designSourceKind !== input.designSourceKind
    || input.storyPlan.designGraphHash !== designGraphHash
  ) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_DESIGN_GRAPH_HASH_MISMATCH",
      message: "StoryPlanV2 design discriminator/hash does not bind the exact design authority",
    }));
  }

  const reproduced = produceStoryPlanV2({
    productSpec: input.productSpec,
    ...(input.designGraph ? { designGraph: input.designGraph } : {}),
    buildTopology: input.buildTopology,
  });
  if (reproduced.status !== "produced" || !sameCanonical(reproduced.storyPlan, input.storyPlan)) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_STORY_PLAN_PROJECTION_MISMATCH",
      message: "StoryPlanV2 is not the exact deterministic projection of bound product/design/topology authority",
    }));
  }
  return diagnostics;
}

function productControl(
  productSpec: ProductSpecV2,
  controlSlotRef: string,
): { action: ProductActionV2; placement: ProductActionV2["controlPlacements"][number] } | undefined {
  for (const action of productSpec.actions) {
    const placement = action.controlPlacements.find((candidate) => candidate.id === controlSlotRef);
    if (placement) return { action, placement };
  }
  return undefined;
}

function productObservable(
  productSpec: ProductSpecV2,
  observableRef: string,
): { action: ProductActionV2; effect: ProductActionV2["observableEffects"][number] } | undefined {
  for (const action of productSpec.actions) {
    const effect = action.observableEffects.find((candidate) => candidate.id === observableRef);
    if (effect) return { action, effect };
  }
  return undefined;
}

function sourceMapStory(
  storyPlan: StoryPlanV2,
  target: DesignGenerationTargetV2,
): StoryPlanV2["stories"][number] | undefined {
  const matches = storyPlan.stories.filter((story) =>
    story.routeRefs.includes(target.routeRef) && story.surfaceRefs.includes(target.surfaceRef));
  return matches.length === 1 ? matches[0] : undefined;
}

function validateGlobalStitchClosure(input: StitchInput): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const targetsHash = hashCanonicalJson(input.generationTargets);
  const bindingsHash = hashCanonicalJson(input.responseBindings);
  const productSpecHash = hashCanonicalJson(input.productSpec);

  if (
    input.generationTargets.productSpecHash !== productSpecHash
    || input.designGraph.productSpecHash !== productSpecHash
  ) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_PRODUCT_SPEC_HASH_MISMATCH",
      message: "Stitch target/graph authority does not bind the exact ProductSpecV2 payload",
    }));
  }
  if (
    input.responseBindings.generationTargetsHash !== targetsHash
    || input.designGraph.generationTargetsHash !== targetsHash
  ) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_GENERATION_TARGETS_HASH_MISMATCH",
      message: "Response/graph authority does not bind the exact DesignGenerationTargetsV2 payload",
    }));
  }
  if (input.designGraph.responseBindingsHash !== bindingsHash) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_RESPONSE_BINDINGS_HASH_MISMATCH",
      message: "DesignInteractionGraphV2 does not bind the exact Stitch response bindings payload",
    }));
  }
  if (
    input.designSourceClosure.kind !== "stitch"
    || input.designSourceClosure.generationTargets.payloadHash !== targetsHash
    || input.designSourceClosure.responseBindings.payloadHash !== bindingsHash
    || input.designSourceClosure.designGraph.payloadHash !== hashCanonicalJson(input.designGraph)
  ) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_DESIGN_SOURCE_CLOSURE_HASH_MISMATCH",
      message: "DesignSourceClosureV2 does not bind the exact target/response/graph payload closure",
    }));
  }

  let parsedScreenIndex: unknown;
  try {
    parsedScreenIndex = JSON.parse(input.screenIndexSource.text);
  } catch {
    parsedScreenIndex = undefined;
  }
  const parsedScreenIndexResult = StitchScreenIndexV2Schema.safeParse(parsedScreenIndex);
  const canonicalScreenIndexText = parsedScreenIndexResult.success
    ? JSON.stringify(parsedScreenIndexResult.data, null, 2)
    : undefined;
  if (
    input.screenIndexSource.source.locator !== "src/screens/SCREEN_INDEX.json"
    || input.screenIndexSource.source.hash !== sha256Utf8(input.screenIndexSource.text)
    || input.screenIndexSource.source.byteLength !== Buffer.byteLength(input.screenIndexSource.text, "utf8")
    || !parsedScreenIndexResult.success
    || input.screenIndexSource.text !== canonicalScreenIndexText
    || !sameCanonical(parsedScreenIndexResult.data, input.screenIndex)
  ) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_SCREEN_INDEX_SOURCE_HASH_MISMATCH",
      message: "SCREEN_INDEX source ref/bytes/payload must resolve to the exact strict StitchScreenIndexV2",
      reference: input.screenIndexSource.source.locator,
    }));
  }
  if (
    input.converterSource.source.locator !== "scripts/stitch-to-jsx.mjs"
    || input.converterSource.source.hash !== sha256Utf8(input.converterSource.text)
    || input.converterSource.source.byteLength !== Buffer.byteLength(input.converterSource.text, "utf8")
  ) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_CONVERTER_SOURCE_HASH_MISMATCH",
      message: "Converter identity must bind the exact scripts/stitch-to-jsx.mjs source bytes",
      reference: input.converterSource.source.locator,
    }));
  }

  const reproducedTargets = produceDesignGenerationTargetsV2(input.productSpec);
  if (
    reproducedTargets.status !== "produced"
    || !sameCanonical(reproducedTargets.generationTargets, input.generationTargets)
  ) {
    diagnostics.push(diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_GENERATION_TARGETS_PROJECTION_MISMATCH",
      message: "Generation targets are not the exact deterministic ProductSpecV2 projection",
    }));
  }

  for (const [label, identities] of [
    ["generation targets", input.generationTargets.targets.map((target) => target.targetId)],
    ["response bindings", input.responseBindings.bindings.map((binding) => binding.targetRef)],
    ["screen index", input.screenIndex.map((screen) => screen.projection.targetRef)],
    ["generated sources", input.generatedSources.map((source) => source.targetRef)],
  ] as const) {
    if (!isCanonical(identities)) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_NONCANONICAL_INPUT_ORDER",
        message: `${label} must be unique and canonically UTF-16 sorted before source-map projection`,
      }));
    }
  }

  for (const [label, identities] of [
    ["generated source target refs", input.generatedSources.map((source) => source.targetRef)],
    ["generated source response IDs", input.generatedSources.map((source) => source.responseScreenId)],
    ["generated source path refs", input.generatedSources.map((source) => source.pathRef)],
    ["generated source locators", input.generatedSources.map((source) => source.source.locator)],
  ] as const) {
    addAmbiguityDiagnostics(diagnostics, label, identities);
  }

  const targetRefs = input.generationTargets.targets.map((target) => target.targetId);
  for (const [label, observed] of [
    ["response target map", input.responseBindings.bindings.map((binding) => binding.targetRef)],
    ["graph source-authority target map", input.designGraph.sourceAuthorities.map((source) => source.targetRef)],
    ["screen-index target map", input.screenIndex.map((screen) => screen.projection.targetRef)],
    ["generated-source target map", input.generatedSources.map((source) => source.targetRef)],
  ] as const) {
    addSetMismatchDiagnostics(
      diagnostics,
      "IMPLEMENTATION_SOURCE_MAP_V1_TARGET_MAPPING",
      label,
      targetRefs,
      observed,
    );
  }

  const responseScreenIds = input.responseBindings.bindings.map((binding) => binding.responseScreenId);
  for (const [label, observed] of [
    ["graph source-authority screen map", input.designGraph.sourceAuthorities.map((source) => source.responseScreenId)],
    ["screen-index response map", input.screenIndex.map((screen) => screen.screenId)],
    ["generated-source response map", input.generatedSources.map((source) => source.responseScreenId)],
  ] as const) {
    addSetMismatchDiagnostics(
      diagnostics,
      "IMPLEMENTATION_SOURCE_MAP_V1_RESPONSE_MAPPING",
      label,
      responseScreenIds,
      observed,
    );
  }

  const targetSurfaceRefs = input.generationTargets.targets.flatMap((target) =>
    [target.surfaceRef, ...target.containedSurfaceRefs]);
  const productSurfaceRefs = input.productSpec.surfaces.map((surface) => surface.id);
  addSetMismatchDiagnostics(
    diagnostics,
    "IMPLEMENTATION_SOURCE_MAP_V1_TARGET_SURFACE_MAPPING",
    "generation-target surface closure",
    productSurfaceRefs,
    targetSurfaceRefs,
  );
  addSetMismatchDiagnostics(
    diagnostics,
    "IMPLEMENTATION_SOURCE_MAP_V1_GRAPH_SURFACE_MAPPING",
    "design-graph surface closure",
    productSurfaceRefs,
    input.designGraph.surfaces.map((surface) => surface.surfaceRef),
  );

  const productControlSlots = input.productSpec.actions.flatMap((action) =>
    action.controlPlacements.map((placement) => placement.id));
  const targetControlSlots = input.generationTargets.targets.flatMap((target) =>
    target.requiredControlPlacements.map((placement) => placement.controlSlotRef));
  const indexedControlSlots = input.screenIndex.flatMap((screen) =>
    screen.controls.flatMap((control) =>
      control.semanticSource === "data-action" ? [control.controlSlotRef] : []));
  addAmbiguityDiagnostics(diagnostics, "screen-index control slots", indexedControlSlots);
  addAmbiguityDiagnostics(
    diagnostics,
    "response control slots",
    input.responseBindings.bindings.flatMap((binding) =>
      binding.controlSlotBindings.map((control) => control.controlSlotRef)),
  );
  for (const [prefix, label, observed] of [
    ["IMPLEMENTATION_SOURCE_MAP_V1_TARGET_CONTROL_MAPPING", "generation-target control closure", targetControlSlots],
    ["IMPLEMENTATION_SOURCE_MAP_V1_GRAPH_CONTROL_MAPPING", "design-graph control closure", input.designGraph.controls.map((control) => control.identity.controlSlotRef)],
    ["IMPLEMENTATION_SOURCE_MAP_V1_SCREEN_CONTROL_MAPPING", "screen-index control closure", indexedControlSlots],
  ] as const) {
    addSetMismatchDiagnostics(diagnostics, prefix, label, productControlSlots, observed);
  }

  const productObservableRefs = input.productSpec.actions.flatMap((action) =>
    action.observableEffects.map((observable) => observable.id));
  const targetObservableRefs = input.generationTargets.targets.flatMap((target) =>
    target.requiredObservableSelectors.map((observable) => observable.observableRef));
  const indexedObservableRefs = input.screenIndex.flatMap((screen) =>
    screen.observables.map((observable) => observable.observableRef));
  addAmbiguityDiagnostics(diagnostics, "screen-index observables", indexedObservableRefs);
  addAmbiguityDiagnostics(
    diagnostics,
    "response observables",
    input.responseBindings.bindings.flatMap((binding) =>
      binding.observableBindings.map((observable) => observable.observableRef)),
  );
  for (const [prefix, label, observed] of [
    ["IMPLEMENTATION_SOURCE_MAP_V1_TARGET_OBSERVABLE_MAPPING", "generation-target observable closure", targetObservableRefs],
    ["IMPLEMENTATION_SOURCE_MAP_V1_GRAPH_OBSERVABLE_MAPPING", "design-graph observable closure", input.designGraph.observables.map((observable) => observable.observableRef)],
    ["IMPLEMENTATION_SOURCE_MAP_V1_SCREEN_OBSERVABLE_MAPPING", "screen-index observable closure", indexedObservableRefs],
  ] as const) {
    addSetMismatchDiagnostics(diagnostics, prefix, label, productObservableRefs, observed);
  }

  return diagnostics;
}

function mappedActionInputs(
  diagnostics: CompilationDiagnosticV1[],
  targetRef: string,
  expectedControls: readonly DesignPhysicalControlV2[],
  indexed: StitchInput["screenIndex"][number],
  response: StitchInput["responseBindings"]["bindings"][number],
  productSpec: ProductSpecV2,
  story: StoryPlanV2["stories"][number],
): ImplementationActionInputSourceV1[] {
  const graphBindings = expectedControls.flatMap((control) =>
    control.actionInputBindings.map((binding) => ({
      actionInputRef: binding.actionInputRef,
      actionRef: control.identity.actionRef,
      inputField: binding.fieldRef,
      sourceElementRef: binding.elementRef,
      sourceElementHash: binding.elementHash,
    })));
  const grouped = new Map<string, typeof graphBindings>();
  graphBindings.forEach((binding) => {
    grouped.set(binding.actionInputRef, [...(grouped.get(binding.actionInputRef) ?? []), binding]);
  });
  const canonicalGraphBindings: typeof graphBindings = [];
  for (const [actionInputRef, bindings] of grouped) {
    const first = bindings[0]!;
    if (bindings.some((binding) => !sameCanonical(binding, first))) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_ACTION_INPUT_AMBIGUOUS",
        category: "link",
        message: `Action input ${actionInputRef} resolves to conflicting design elements`,
        reference: actionInputRef,
      }));
      continue;
    }
    canonicalGraphBindings.push(first);
  }
  canonicalGraphBindings.sort((left, right) => compareUtf16(left.actionInputRef, right.actionInputRef));

  const observed = indexed.controls.flatMap((control) =>
    (control.inputBindings ?? []).map((binding) => ({
      actionInputRef: `${binding.actionRef}.${binding.inputField}`,
      actionRef: binding.actionRef,
      inputField: binding.inputField,
      sourceElementRef: control.sourceElementRef,
      generatedControlId: control.generatedLocalId,
      generatedSelector: control.selector,
    })));
  addAmbiguityDiagnostics(
    diagnostics,
    `screen-index action inputs for ${targetRef}`,
    observed.map((binding) => `${binding.actionInputRef}\0${binding.generatedControlId}`),
  );
  addSetMismatchDiagnostics(
    diagnostics,
    "IMPLEMENTATION_SOURCE_MAP_V1_ACTION_INPUT_MAPPING",
    `screen-index action-input map for ${targetRef}`,
    canonicalGraphBindings.map((binding) => binding.actionInputRef),
    uniqueSorted(observed.map((binding) => binding.actionInputRef)),
  );

  const observedByTransport = new Map(observed.map((binding) =>
    [`${binding.actionInputRef}\0${binding.generatedControlId}`, binding] as const));
  const responseByRef = new Map(response.actionInputBindings.map((binding) =>
    [binding.actionInputRef, binding] as const));
  addSetMismatchDiagnostics(
    diagnostics,
    "IMPLEMENTATION_SOURCE_MAP_V1_RESPONSE_ACTION_INPUT_MAPPING",
    `response action-input map for ${targetRef}`,
    canonicalGraphBindings.map((binding) => binding.actionInputRef),
    response.actionInputBindings.map((binding) => binding.actionInputRef),
  );

  const graphByRef = new Map(canonicalGraphBindings.map((binding) =>
    [binding.actionInputRef, binding] as const));
  const transportKeys = indexed.componentApi.inputTransports.map((transport) =>
    `${transport.actionInputRef}\0${transport.generatedControlId}`);
  addSetMismatchDiagnostics(
    diagnostics,
    "IMPLEMENTATION_SOURCE_MAP_V1_COMPONENT_INPUT_TRANSPORT_MAPPING",
    `component API input transports for ${targetRef}`,
    observed.map((binding) => `${binding.actionInputRef}\0${binding.generatedControlId}`),
    transportKeys,
  );

  const mapped: ImplementationActionInputSourceV1[] = [];
  for (const transport of [...indexed.componentApi.inputTransports].sort((left, right) =>
    compareUtf16(
      `${left.actionInputRef}\0${left.generatedControlId}`,
      `${right.actionInputRef}\0${right.generatedControlId}`,
    ))) {
    const binding = graphByRef.get(transport.actionInputRef);
    const observedBinding = observedByTransport.get(
      `${transport.actionInputRef}\0${transport.generatedControlId}`,
    );
    if (!binding) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_ACTION_INPUT_MAPPING_MISSING",
        category: "link",
        message: `Component input transport ${transport.actionInputRef} lacks exact graph authority`,
        reference: transport.actionInputRef,
      }));
      continue;
    }
    if (!observedBinding) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_ACTION_INPUT_MAPPING_MISSING",
        category: "link",
        message: `Component input transport ${transport.actionInputRef}/${transport.generatedControlId} lacks exact SCREEN_INDEX control authority`,
        reference: transport.actionInputRef,
      }));
      continue;
    }
    const responseBinding = responseByRef.get(binding.actionInputRef);
    const action = productSpec.actions.find((candidate) => candidate.id === binding.actionRef);
    const actionHandlerIds = indexed.componentApi.actionBindings
      .filter((candidate) => candidate.actionRef === binding.actionRef)
      .map((candidate) => candidate.generatedLocalId)
      .sort(compareUtf16);
    if (
      observedBinding.actionRef !== binding.actionRef
      || observedBinding.inputField !== binding.inputField
      || observedBinding.sourceElementRef !== binding.sourceElementRef
      || transport.stateKey !== binding.actionInputRef
      || !responseBinding
      || responseBinding.actionRef !== binding.actionRef
      || responseBinding.elementRef !== binding.sourceElementRef
      || responseBinding.elementHash !== binding.sourceElementHash
      || !action?.input.fields.some((field) => field.name === binding.inputField)
      || !story.actionRefs.includes(binding.actionRef)
      || actionHandlerIds.length === 0
    ) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_ACTION_INPUT_IDENTITY_MISMATCH",
        category: "link",
        message: `Action input ${binding.actionInputRef} lost exact action/input/element/story authority`,
        reference: binding.actionInputRef,
      }));
    }
    mapped.push({
      ...binding,
      generatedControlId: transport.generatedControlId,
      generatedSelector: observedBinding.generatedSelector,
      stateKey: transport.stateKey,
      valueEvent: "change",
      actionHandlerIds,
    });
  }
  return mapped;
}

function mappedControls(
  diagnostics: CompilationDiagnosticV1[],
  input: StitchInput,
  target: DesignGenerationTargetV2,
  response: StitchInput["responseBindings"]["bindings"][number],
  indexed: StitchInput["screenIndex"][number],
  story: StoryPlanV2["stories"][number],
): { controls: ImplementationControlSourceV1[]; graphControls: DesignPhysicalControlV2[] } {
  const graphControls = input.designGraph.controls
    .filter((control) => control.source.targetRef === target.targetId)
    .sort((left, right) => compareUtf16(left.identity.controlSlotRef, right.identity.controlSlotRef));
  const graphBySlot = new Map(graphControls.map((control) =>
    [control.identity.controlSlotRef, control] as const));
  const indexedPhysical = indexed.controls.filter((control) =>
    control.semanticSource === "data-action");
  const indexedBySlot = new Map(indexedPhysical.map((control) =>
    [control.controlSlotRef, control] as const));
  const responseBySlot = new Map(response.controlSlotBindings.map((binding) =>
    [binding.controlSlotRef, binding] as const));
  const graphActionByRef = new Map(input.designGraph.actions.map((action) =>
    [action.actionRef, action] as const));

  const controls: ImplementationControlSourceV1[] = [];
  for (const required of [...target.requiredControlPlacements]
    .sort((left, right) => compareUtf16(left.controlSlotRef, right.controlSlotRef))) {
    const product = productControl(input.productSpec, required.controlSlotRef);
    const graph = graphBySlot.get(required.controlSlotRef);
    const screen = indexedBySlot.get(required.controlSlotRef);
    const responseBinding = responseBySlot.get(required.controlSlotRef);
    const graphAction = graph ? graphActionByRef.get(graph.identity.actionRef) : undefined;
    const componentActionBinding = screen
      ? indexed.componentApi.actionBindings.find((binding) =>
          binding.generatedLocalId === screen.generatedLocalId
          && binding.actionRef === screen.actionRef)
      : undefined;
    if (!product || !graph || !screen || !responseBinding || !graphAction || !componentActionBinding) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_CONTROL_MAPPING_MISSING",
        category: "link",
        message: `Control slot ${required.controlSlotRef} lacks one exact product/graph/screen/response mapping`,
        reference: required.controlSlotRef,
      }));
      continue;
    }
    const expectedInputFields = product.action.input.fields
      .map((field) => field.name)
      .sort(compareUtf16);
    const expectedAffected = [...product.action.affectedSurfaceRefs].sort(compareUtf16);
    if (
      required.actionRef !== product.action.id
      || required.surfaceRef !== product.placement.surfaceRef
      || required.controlHint !== product.placement.controlHint
      || !sameCanonical(required.inputFields, expectedInputFields)
      || !sameCanonical(componentActionBinding.inputFields, expectedInputFields)
      || graph.controlPlacementHash !== hashCanonicalJson(product.placement)
      || graph.identity.actionRef !== product.action.id
      || graph.identity.surfaceRef !== product.placement.surfaceRef
      || graph.source.targetRef !== target.targetId
      || graph.source.responseScreenId !== response.responseScreenId
      || screen.actionRef !== product.action.id
      || screen.surfaceRef !== product.placement.surfaceRef
      || screen.physicalControlRef !== graph.id
      || screen.sourceElementRef !== graph.elementRef
      || screen.tagName !== graph.tagName
      || screen.nativeControlKind !== graph.nativeControlKind
      || screen.role !== graph.role
      || screen.ariaLabel !== graph.ariaLabel
      || screen.href !== graph.href
      || screen.interactiveRole !== graph.interactiveRole
      || screen.generatedSourceLocator !== indexed.file
      || !sameCanonical(screen.affectedSurfaceRefs, expectedAffected)
      || !sameCanonical(graphAction.affectedSurfaceRefs, expectedAffected)
      || responseBinding.actionRef !== product.action.id
      || responseBinding.surfaceRef !== product.placement.surfaceRef
      || responseBinding.elementRef !== graph.elementRef
      || responseBinding.elementHash !== graph.elementHash
      || !story.controlSlotRefs.includes(required.controlSlotRef)
      || !story.controlRefs.includes(graph.id)
      || !story.actionRefs.includes(product.action.id)
    ) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_CONTROL_IDENTITY_MISMATCH",
        category: "link",
        message: `Control slot ${required.controlSlotRef} lost exact placement/action/surface/physical/source/story authority`,
        reference: required.controlSlotRef,
      }));
    }
    controls.push({
      controlSlotRef: required.controlSlotRef,
      actionRef: product.action.id,
      placement: product.placement,
      controlPlacementHash: hashCanonicalJson(product.placement),
      affectedSurfaceRefs: expectedAffected,
      physicalControlRef: graph.id,
      sourceElementRef: graph.elementRef,
      sourceElementHash: graph.elementHash,
      generatedLocalId: screen.generatedLocalId,
      generatedSelector: screen.selector,
      generatedKind: screen.kind,
      tagName: screen.tagName,
      nativeControlKind: screen.nativeControlKind,
      role: screen.role,
      ariaLabel: screen.ariaLabel,
      href: screen.href,
      interactiveRole: screen.interactiveRole,
      handlerBinding: {
        actionsPropName: indexed.componentApi.actionsPropName,
        callbackKey: screen.generatedLocalId,
        event: screen.kind === "button" || screen.kind === "link" ? "click" : "change",
        preventsDefault: screen.tagName === "a",
        inputFields: componentActionBinding.inputFields,
      },
    });
  }
  return { controls, graphControls };
}

function mappedObservables(
  diagnostics: CompilationDiagnosticV1[],
  input: StitchInput,
  target: DesignGenerationTargetV2,
  response: StitchInput["responseBindings"]["bindings"][number],
  indexed: StitchInput["screenIndex"][number],
  story: StoryPlanV2["stories"][number],
): ImplementationObservableSourceV1[] {
  const graphByRef = new Map(input.designGraph.observables
    .filter((observable) => observable.source.targetRef === target.targetId)
    .map((observable) => [observable.observableRef, observable] as const));
  const screenByRef = new Map(indexed.observables.map((observable) =>
    [observable.observableRef, observable] as const));
  const responseByRef = new Map(response.observableBindings.map((observable) =>
    [observable.observableRef, observable] as const));
  const observables: ImplementationObservableSourceV1[] = [];

  for (const required of [...target.requiredObservableSelectors]
    .sort((left, right) => compareUtf16(left.observableRef, right.observableRef))) {
    const product = productObservable(input.productSpec, required.observableRef);
    const graph = graphByRef.get(required.observableRef);
    const screen = screenByRef.get(required.observableRef);
    const responseBinding = responseByRef.get(required.observableRef);
    const element = graph?.elementBindings[0];
    const expectedControlSlot = graph?.selector.kind === "control"
      ? graph.selector.controlSlotRef
      : undefined;
    const expectedSurface = graph?.selector.kind === "control"
      ? undefined
      : graph?.selector.surfaceRef;
    const expectedRole = graph?.selector.kind === "accessibility"
      ? graph.selector.role
      : undefined;
    const expectedName = graph?.selector.kind === "accessibility"
      ? graph.selector.name
      : undefined;
    if (!product || !graph || !screen || !responseBinding || !element) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_OBSERVABLE_MAPPING_MISSING",
        category: "link",
        message: `Observable ${required.observableRef} lacks one exact product/graph/screen/response mapping`,
        reference: required.observableRef,
      }));
      continue;
    }
    if (
      required.actionRef !== product.action.id
      || !sameCanonical(required.selector, product.effect.selector)
      || !sameCanonical(required.assertions, product.effect.assertions)
      || graph.actionRef !== product.action.id
      || !sameCanonical(graph.selector, product.effect.selector)
      || graph.selectorHash !== hashCanonicalJson(product.effect.selector)
      || graph.assertionsHash !== hashCanonicalJson(product.effect.assertions)
      || graph.evidenceRef !== product.effect.evidenceRef
      || graph.source.responseScreenId !== response.responseScreenId
      || graph.elementBindings.length !== 1
      || screen.actionRef !== graph.actionRef
      || screen.selectorKind !== graph.selector.kind
      || screen.controlSlotRef !== expectedControlSlot
      || screen.surfaceRef !== expectedSurface
      || screen.role !== expectedRole
      || screen.name !== expectedName
      || screen.evidenceRef !== graph.evidenceRef
      || screen.sourceElementRef !== element.elementRef
      || screen.generatedSourceLocator !== indexed.file
      || responseBinding.actionRef !== graph.actionRef
      || responseBinding.selectorKind !== graph.selector.kind
      || responseBinding.selectorHash !== graph.selectorHash
      || responseBinding.elementRefs[0] !== element.elementRef
      || responseBinding.elementHashes[0] !== element.elementHash
      || !story.observableRefs.includes(graph.observableRef)
      || !story.actionRefs.includes(graph.actionRef)
      || !story.evidenceRefs.includes(graph.evidenceRef)
    ) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_OBSERVABLE_IDENTITY_MISMATCH",
        category: "link",
        message: `Observable ${required.observableRef} lost exact selector/evidence/source/story authority`,
        reference: required.observableRef,
      }));
    }
    observables.push({
      observableRef: graph.observableRef,
      actionRef: graph.actionRef,
      selector: graph.selector,
      selectorHash: graph.selectorHash,
      evidenceRef: graph.evidenceRef,
      sourceElementRef: element.elementRef,
      sourceElementHash: element.elementHash,
      generatedSelector: screen.selector,
      assertionsHash: graph.assertionsHash,
    });
  }
  return observables;
}

type InteractiveCounts = Readonly<{
  buttons: number;
  links: number;
  inputs: number;
  textareas: number;
  selects: number;
}>;

function interactiveCounts(
  controls: readonly { kind: "button" | "link" | "input" | "textarea" | "select" }[],
): InteractiveCounts {
  const counts = { buttons: 0, links: 0, inputs: 0, textareas: 0, selects: 0 };
  controls.forEach((control) => {
    if (control.kind === "button") counts.buttons += 1;
    else if (control.kind === "link") counts.links += 1;
    else if (control.kind === "input") counts.inputs += 1;
    else if (control.kind === "textarea") counts.textareas += 1;
    else counts.selects += 1;
  });
  return counts;
}

function projectStitchScreens(input: StitchInput): {
  screens: ImplementationScreenSourceV1[];
  diagnostics: CompilationDiagnosticV1[];
} {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const responseByTarget = new Map(input.responseBindings.bindings.map((binding) =>
    [binding.targetRef, binding] as const));
  const indexedByTarget = new Map(input.screenIndex.map((screen) =>
    [screen.projection.targetRef, screen] as const));
  const sourceByTarget = new Map(input.generatedSources.map((source) =>
    [source.targetRef, source] as const));
  const authorityByTarget = new Map(input.designGraph.sourceAuthorities.map((authority) =>
    [authority.targetRef, authority] as const));
  const graphSurfaceByRef = new Map(input.designGraph.surfaces.map((surface) =>
    [surface.surfaceRef, surface] as const));
  const productSurfaceByRef = new Map(input.productSpec.surfaces.map((surface) =>
    [surface.id, surface] as const));
  const pathByRef = new Map(input.buildTopology.pathBindings.map((path) =>
    [path.id, path] as const));
  const ownerByStory = new Map(input.buildTopology.owners.flatMap((owner) =>
    owner.kind === "story" ? [[owner.storyRef, owner] as const] : []));
  const screens: ImplementationScreenSourceV1[] = [];

  for (const target of [...input.generationTargets.targets]
    .sort((left, right) => compareUtf16(left.targetId, right.targetId))) {
    const response = responseByTarget.get(target.targetId);
    const indexed = indexedByTarget.get(target.targetId);
    const generated = sourceByTarget.get(target.targetId);
    const authority = authorityByTarget.get(target.targetId);
    const story = sourceMapStory(input.storyPlan, target);
    if (!response || !indexed || !generated || !authority || !story) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_SCREEN_MAPPING_MISSING",
        category: "link",
        message: `Target ${target.targetId} lacks one exact response/index/source/authority/story mapping`,
        reference: target.targetId,
      }));
      continue;
    }
    const topologyPath = pathByRef.get(generated.pathRef);
    const topologyOwner = ownerByStory.get(story.id);
    if (
      generated.source.hash !== sha256Utf8(generated.text)
      || generated.source.byteLength !== Buffer.byteLength(generated.text, "utf8")
    ) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_GENERATED_SOURCE_HASH_MISMATCH",
        category: "source",
        message: `Generated source ${generated.source.locator} ref does not bind its exact UTF-8 bytes`,
        reference: generated.source.locator,
      }));
    }
    const sourceValidation = validateStitchScreenSourceV2({
      screen: indexed,
      sourceText: generated.text,
    });
    if (sourceValidation.status !== "valid") {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_GENERATED_SOURCE_CONTRACT_INVALID",
        category: "source",
        message: `Generated source ${generated.source.locator} failed exact SCREEN_INDEX source validation: ${sourceValidation.rejectionCodes.join(",")}`,
        reference: generated.source.locator,
      }));
    }
    if (
      response.targetHash !== hashCanonicalJson(target)
      || authority.targetHash !== response.targetHash
      || response.responseScreenId !== indexed.screenId
      || response.responseScreenId !== generated.responseScreenId
      || response.responseScreenId !== authority.responseScreenId
      || response.responseTitle !== indexed.title
      || indexed.projection.targetRef !== target.targetId
      || generated.source.locator !== indexed.file
      || !topologyPath
      || topologyPath.path !== indexed.file
      || topologyPath.role !== "generated"
      || topologyPath.presence !== "present"
      || topologyPath.knownContentHash !== generated.source.hash
      || topologyPath.ownerRef !== story.ownerRef
      || !story.ownedPathRefs.includes(generated.pathRef)
      || !topologyOwner
      || topologyOwner.id !== story.ownerRef
    ) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_SOURCE_OWNERSHIP_MISMATCH",
        category: "link",
        message: `Target ${target.targetId} lost exact screen/path/content/story/owner authority`,
        reference: target.targetId,
      }));
    }

    const expectedSurfaceRefs = [target.surfaceRef, ...target.containedSurfaceRefs];
    const responseSurfaceRefs = response.surfaceBindings.map((surface) => surface.surfaceRef);
    const graphSurfaceRefs = input.designGraph.surfaces
      .filter((surface) => surface.source.targetRef === target.targetId)
      .map((surface) => surface.surfaceRef);
    addSetMismatchDiagnostics(
      diagnostics,
      "IMPLEMENTATION_SOURCE_MAP_V1_RESPONSE_SURFACE_MAPPING",
      `response surface map for ${target.targetId}`,
      expectedSurfaceRefs,
      responseSurfaceRefs,
    );
    addSetMismatchDiagnostics(
      diagnostics,
      "IMPLEMENTATION_SOURCE_MAP_V1_GRAPH_SURFACE_MAPPING",
      `graph surface map for ${target.targetId}`,
      expectedSurfaceRefs,
      graphSurfaceRefs,
    );

    const surfaceSource = (surfaceRef: string) => {
      const graphSurface = graphSurfaceByRef.get(surfaceRef);
      const productSurface = productSurfaceByRef.get(surfaceRef);
      const responseSurface = response.surfaceBindings.find((binding) =>
        binding.surfaceRef === surfaceRef);
      if (
        !graphSurface
        || !productSurface
        || !responseSurface
        || graphSurface.productSurfaceHash !== hashCanonicalJson(productSurface)
        || graphSurface.routeRef !== target.routeRef
        || graphSurface.source.responseScreenId !== response.responseScreenId
        || responseSurface.elementRef !== graphSurface.elementRef
        || responseSurface.elementHash !== graphSurface.elementHash
        || !story.surfaceRefs.includes(surfaceRef)
      ) {
        diagnostics.push(diagnostic({
          code: "IMPLEMENTATION_SOURCE_MAP_V1_SURFACE_IDENTITY_MISMATCH",
          category: "link",
          message: `Surface ${surfaceRef} lost exact product/graph/response/story authority`,
          reference: surfaceRef,
        }));
      }
      return graphSurface ? {
        surfaceRef,
        sourceElementRef: graphSurface.elementRef,
        sourceElementHash: graphSurface.elementHash,
      } : undefined;
    };
    const rootSurface = surfaceSource(target.surfaceRef);
    const containedSurfaces = [...target.containedSurfaceRefs]
      .sort(compareUtf16)
      .map(surfaceSource)
      .filter((surface): surface is NonNullable<typeof surface> => Boolean(surface));
    const productRoot = productSurfaceByRef.get(target.surfaceRef);
    if (
      !productRoot
      || productRoot.composition.kind !== "route_root"
      || productRoot.routeRef !== target.routeRef
      || !story.routeRefs.includes(target.routeRef)
      || target.containedSurfaceRefs.some((surfaceRef) => {
        const surface = productSurfaceByRef.get(surfaceRef);
        return !surface || surface.composition.kind !== "contained" || surface.routeRef !== target.routeRef;
      })
    ) {
      diagnostics.push(diagnostic({
        code: "IMPLEMENTATION_SOURCE_MAP_V1_SURFACE_COMPOSITION_MISMATCH",
        category: "link",
        message: `Target ${target.targetId} root/contained surface composition is not exact`,
        reference: target.targetId,
      }));
    }

    const mapped = mappedControls(diagnostics, input, target, response, indexed, story);
    const actionInputs = mappedActionInputs(
      diagnostics,
      target.targetId,
      mapped.graphControls,
      indexed,
      response,
      input.productSpec,
      story,
    );
    const observables = mappedObservables(diagnostics, input, target, response, indexed, story);
    const rejectedControls = [...indexed.rejectedControls]
      .sort((left, right) => compareUtf16(left.rejectionId, right.rejectionId))
      .map((contract) => ({
        contract,
        inertnessEvidence: {
          schema: "setfarm.generated-control-inertness-evidence.v1" as const,
          sourceValidation: "ast_exact" as const,
          hidden: true as const,
          ariaHidden: true as const,
          semanticBindingsAbsent: true as const,
          eventHandlersAbsent: true as const,
          nativeDisabledOrLinkNeutralized: true as const,
        },
      }));
    const cardinality = {
      raw: indexed.projection.rawInteractiveCounts,
      accepted: interactiveCounts(indexed.controls),
      rejected: interactiveCounts(indexed.rejectedControls),
    };
    if (!rootSurface || !topologyPath) continue;

    screens.push({
      targetRef: target.targetId,
      responseScreenId: response.responseScreenId,
      routeRef: target.routeRef,
      rootSurface,
      containedSurfaces,
      pathRef: generated.pathRef,
      path: generated.source.locator,
      contentHash: generated.source.hash,
      sourceByteLength: generated.source.byteLength,
      componentName: indexed.componentName,
      componentApi: indexed.componentApi,
      targetHash: hashCanonicalJson(target),
      responseBindingHash: hashCanonicalJson(response),
      storyId: story.id,
      ownerRef: story.ownerRef,
      controls: mapped.controls,
      actionInputs,
      observables,
      rejectedControls,
      cardinality,
    });
  }
  return { screens, diagnostics };
}

/**
 * Materializes only exact authority already proven by typed v2/v3 contracts.
 * It never infers a screen, path, owner, selector, control, or source element.
 */
export function produceImplementationSourceMapV1(
  input: unknown,
): ImplementationSourceMapProducerResultV1 {
  const parsed = ImplementationSourceMapProducerInputV1Schema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 200).map((issue) => diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_INPUT_INVALID",
      category: "configuration",
      message: `Typed input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }

  const value = parsed.data;
  const authorityDiagnostics = validateBoundAuthority(value);
  if (authorityDiagnostics.length > 0) return reject(authorityDiagnostics);

  if (value.designSourceKind === "none") {
    const sourceMap = ImplementationSourceMapV1Schema.parse({
      schema: "setfarm.implementation-source-map.v1",
      sourceMapVersion: 1,
      designSourceKind: "none",
      productSpecV2PayloadHash: hashCanonicalJson(value.productSpec),
      designGraphV2PayloadHash: null,
      buildTopologyV1PayloadHash: hashCanonicalJson(value.buildTopology),
      storyPlanV2PayloadHash: hashCanonicalJson(value.storyPlan),
      designSourceClosureV2PayloadHash: hashCanonicalJson(value.designSourceClosure),
      screenIndexV2PayloadHash: null,
      screenIndexSourceHash: null,
      converter: null,
      screens: [],
    });
    return {
      status: "produced",
      sourceMap,
      payloadHash: implementationSourceMapPayloadHashV1(sourceMap),
      diagnostics: [],
    };
  }

  const diagnostics = validateGlobalStitchClosure(value);
  if (diagnostics.length > 0) return reject(diagnostics);
  const projection = projectStitchScreens(value);
  if (projection.diagnostics.length > 0) return reject(projection.diagnostics);

  const candidate = ImplementationSourceMapV1Schema.safeParse({
    schema: "setfarm.implementation-source-map.v1",
    sourceMapVersion: 1,
    designSourceKind: "stitch",
    productSpecV2PayloadHash: hashCanonicalJson(value.productSpec),
    designGraphV2PayloadHash: hashCanonicalJson(value.designGraph),
    buildTopologyV1PayloadHash: hashCanonicalJson(value.buildTopology),
    storyPlanV2PayloadHash: hashCanonicalJson(value.storyPlan),
    designSourceClosureV2PayloadHash: hashCanonicalJson(value.designSourceClosure),
    screenIndexV2PayloadHash: hashCanonicalJson(value.screenIndex),
    screenIndexSourceHash: value.screenIndexSource.source.hash,
    converter: {
      schema: "setfarm.implementation-source-converter.v1",
      converterId: "setfarm.stitch-to-jsx",
      contractVersion: 1,
      componentApiSchema: "setfarm.generated-screen-component-api.v1",
      sourceHash: value.converterSource.source.hash,
      sourceByteLength: value.converterSource.source.byteLength,
    },
    screens: projection.screens,
  });
  if (!candidate.success) {
    return reject(candidate.error.issues.slice(0, 200).map((issue) => diagnostic({
      code: "IMPLEMENTATION_SOURCE_MAP_V1_OUTPUT_INVALID",
      message: `Projected source map failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }
  return {
    status: "produced",
    sourceMap: candidate.data,
    payloadHash: implementationSourceMapPayloadHashV1(candidate.data),
    diagnostics: [],
  };
}
