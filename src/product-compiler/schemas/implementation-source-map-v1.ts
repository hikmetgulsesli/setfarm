import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  ControlIdSchema,
  EvidenceIdSchema,
  NormalizedRelativeLocatorSchema,
  ObservableIdSchema,
  OwnerIdSchema,
  PathBindingIdSchema,
  RouteIdSchema,
  Sha256Schema,
  StoryIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ControlSlotIdSchema } from "./common-v2.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import {
  ObservableSelectorV2Schema,
  ProductControlPlacementV2Schema,
} from "./product-spec-v2.js";
import { StitchScreenIndexEntryV2Schema } from "./stitch-screen-index-v2.js";

export const IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V1 =
  "setfarm.implementation-source-map.v1" as const;

const ElementRefSchema = z.string().regex(/^E[0-9]{6}$/);
const ActionInputFieldSchema = z.string().min(1).max(160).regex(/^[A-Za-z][A-Za-z0-9_]*$/);
const GeneratedLocalIdSchema = z.string().min(1).max(500);
const InteractiveKindSchema = z.enum(["button", "link", "input", "textarea", "select"]);

export const ImplementationSourceConverterV1Schema = z.object({
  schema: z.literal("setfarm.implementation-source-converter.v1"),
  converterId: z.literal("setfarm.stitch-to-jsx"),
  contractVersion: z.literal(1),
  componentApiSchema: z.literal("setfarm.generated-screen-component-api.v1"),
  sourceHash: Sha256Schema,
  sourceByteLength: z.number().int().nonnegative(),
}).strict();

export type ImplementationSourceConverterV1 = z.infer<
  typeof ImplementationSourceConverterV1Schema
>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function requireCanonicalIdentities(
  context: z.RefinementCtx,
  path: PropertyKey[],
  identities: readonly string[],
  label: string,
): void {
  if (!hasUniqueStrings(identities)) {
    context.addIssue({ code: "custom", path, message: `${label} must be unique` });
  }
  if (identities.some((identity, index) =>
    index > 0 && compareUtf16(identity, identities[index - 1]!) <= 0)) {
    context.addIssue({
      code: "custom",
      path,
      message: `${label} must be canonically UTF-16 sorted`,
    });
  }
}

export const ImplementationSurfaceSourceV1Schema = z.object({
  surfaceRef: SurfaceIdSchema,
  sourceElementRef: ElementRefSchema,
  sourceElementHash: Sha256Schema,
}).strict();

export type ImplementationSurfaceSourceV1 = z.infer<
  typeof ImplementationSurfaceSourceV1Schema
>;

export const ImplementationHandlerBindingV1Schema = z.object({
  actionsPropName: z.literal("actions"),
  callbackKey: GeneratedLocalIdSchema,
  event: z.enum(["click", "change"]),
  preventsDefault: z.boolean(),
  inputFields: z.array(ActionInputFieldSchema).max(500),
}).strict().superRefine((value, context) => {
  requireCanonicalIdentities(
    context,
    ["inputFields"],
    value.inputFields,
    "Handler input fields",
  );
});

export type ImplementationHandlerBindingV1 = z.infer<
  typeof ImplementationHandlerBindingV1Schema
>;

export const ImplementationControlSourceV1Schema = z.object({
  controlSlotRef: ControlSlotIdSchema,
  actionRef: ActionIdSchema,
  placement: ProductControlPlacementV2Schema,
  controlPlacementHash: Sha256Schema,
  affectedSurfaceRefs: z.array(SurfaceIdSchema).max(1_000),
  physicalControlRef: ControlIdSchema,
  sourceElementRef: ElementRefSchema,
  sourceElementHash: Sha256Schema,
  generatedLocalId: GeneratedLocalIdSchema,
  generatedSelector: z.string().min(1).max(2_000),
  generatedKind: InteractiveKindSchema,
  tagName: z.string().regex(/^[a-z][a-z0-9-]*$/).max(100),
  nativeControlKind: InteractiveKindSchema.nullable(),
  role: z.string().min(1).max(160).nullable(),
  ariaLabel: z.string().min(1).max(500).nullable(),
  href: z.string().min(1).max(2_000).nullable(),
  interactiveRole: z.boolean(),
  handlerBinding: ImplementationHandlerBindingV1Schema,
}).strict().superRefine((value, context) => {
  if (value.placement.id !== value.controlSlotRef) {
    context.addIssue({
      code: "custom",
      path: ["placement", "id"],
      message: "Control placement identity must equal its exact control-slot reference",
    });
  }
  if (value.controlPlacementHash !== hashCanonicalJson(value.placement)) {
    context.addIssue({
      code: "custom",
      path: ["controlPlacementHash"],
      message: "Control placement hash must bind the exact ProductSpec placement",
    });
  }
  requireCanonicalIdentities(
    context,
    ["affectedSurfaceRefs"],
    value.affectedSurfaceRefs,
    "Control affected-surface refs",
  );
  if (value.handlerBinding.callbackKey !== value.generatedLocalId) {
    context.addIssue({
      code: "custom",
      path: ["handlerBinding", "callbackKey"],
      message: "Handler callback key must equal the exact generated local control ID",
    });
  }
  const expectedEvent = value.generatedKind === "button" || value.generatedKind === "link"
    ? "click"
    : "change";
  if (
    value.handlerBinding.event !== expectedEvent
    || value.handlerBinding.preventsDefault !== (value.tagName === "a")
  ) {
    context.addIssue({
      code: "custom",
      path: ["handlerBinding"],
      message: "Handler event/default behavior must equal the exact generated tag contract",
    });
  }
});

export type ImplementationControlSourceV1 = z.infer<
  typeof ImplementationControlSourceV1Schema
>;

export const ImplementationActionInputSourceV1Schema = z.object({
  actionInputRef: z.string().min(3).max(500),
  actionRef: ActionIdSchema,
  inputField: ActionInputFieldSchema,
  sourceElementRef: ElementRefSchema,
  sourceElementHash: Sha256Schema,
  generatedControlId: GeneratedLocalIdSchema,
  generatedSelector: z.string().min(1).max(2_000),
  stateKey: z.string().min(3).max(500),
  valueEvent: z.literal("change"),
  actionHandlerIds: z.array(GeneratedLocalIdSchema).min(1).max(10_000),
}).strict().superRefine((value, context) => {
  if (value.actionInputRef !== `${value.actionRef}.${value.inputField}`) {
    context.addIssue({
      code: "custom",
      path: ["actionInputRef"],
      message: "Action-input identity must derive from its exact action and input field",
    });
  }
  if (value.stateKey !== value.actionInputRef) {
    context.addIssue({
      code: "custom",
      path: ["stateKey"],
      message: "Action-input state key must equal the exact action-input reference",
    });
  }
  requireCanonicalIdentities(
    context,
    ["actionHandlerIds"],
    value.actionHandlerIds,
    "Action-input consumer handler IDs",
  );
});

export type ImplementationActionInputSourceV1 = z.infer<
  typeof ImplementationActionInputSourceV1Schema
>;

export const ImplementationObservableSourceV1Schema = z.object({
  observableRef: ObservableIdSchema,
  actionRef: ActionIdSchema,
  selector: ObservableSelectorV2Schema,
  selectorHash: Sha256Schema,
  evidenceRef: EvidenceIdSchema,
  sourceElementRef: ElementRefSchema,
  sourceElementHash: Sha256Schema,
  generatedSelector: z.string().min(1).max(2_000),
  assertionsHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.selectorHash !== hashCanonicalJson(value.selector)) {
    context.addIssue({
      code: "custom",
      path: ["selectorHash"],
      message: "Observable selector hash must bind the exact ProductSpec selector",
    });
  }
});

export type ImplementationObservableSourceV1 = z.infer<
  typeof ImplementationObservableSourceV1Schema
>;

export const ImplementationRejectedControlSourceV1Schema = z.object({
  contract: StitchScreenIndexEntryV2Schema.shape.rejectedControls.element,
  inertnessEvidence: z.object({
    schema: z.literal("setfarm.generated-control-inertness-evidence.v1"),
    sourceValidation: z.literal("ast_exact"),
    hidden: z.literal(true),
    ariaHidden: z.literal(true),
    semanticBindingsAbsent: z.literal(true),
    eventHandlersAbsent: z.literal(true),
    nativeDisabledOrLinkNeutralized: z.literal(true),
  }).strict(),
}).strict();

export type ImplementationRejectedControlSourceV1 = z.infer<
  typeof ImplementationRejectedControlSourceV1Schema
>;

const ImplementationInteractiveCountsV1Schema = z.object({
  buttons: z.number().int().nonnegative(),
  links: z.number().int().nonnegative(),
  inputs: z.number().int().nonnegative(),
  textareas: z.number().int().nonnegative(),
  selects: z.number().int().nonnegative(),
}).strict();

export const ImplementationScreenCardinalityV1Schema = z.object({
  raw: ImplementationInteractiveCountsV1Schema,
  accepted: ImplementationInteractiveCountsV1Schema,
  rejected: ImplementationInteractiveCountsV1Schema,
}).strict().superRefine((value, context) => {
  for (const kind of ["buttons", "links", "inputs", "textareas", "selects"] as const) {
    if (value.raw[kind] !== value.accepted[kind] + value.rejected[kind]) {
      context.addIssue({
        code: "custom",
        path: ["raw", kind],
        message: `Raw ${kind} must equal accepted plus inert-rejected cardinality`,
      });
    }
  }
});

export type ImplementationScreenCardinalityV1 = z.infer<
  typeof ImplementationScreenCardinalityV1Schema
>;

export const ImplementationScreenSourceV1Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  responseScreenId: z.string().min(1).max(500),
  routeRef: RouteIdSchema,
  rootSurface: ImplementationSurfaceSourceV1Schema,
  containedSurfaces: z.array(ImplementationSurfaceSourceV1Schema).max(1_000),
  pathRef: PathBindingIdSchema,
  path: NormalizedRelativeLocatorSchema,
  contentHash: Sha256Schema,
  sourceByteLength: z.number().int().nonnegative(),
  componentName: z.string().min(1).max(500),
  componentApi: StitchScreenIndexEntryV2Schema.shape.componentApi,
  targetHash: Sha256Schema,
  responseBindingHash: Sha256Schema,
  storyId: StoryIdSchema,
  ownerRef: OwnerIdSchema,
  controls: z.array(ImplementationControlSourceV1Schema).max(10_000),
  actionInputs: z.array(ImplementationActionInputSourceV1Schema).max(100_000),
  observables: z.array(ImplementationObservableSourceV1Schema).max(10_000),
  rejectedControls: z.array(ImplementationRejectedControlSourceV1Schema).max(10_000),
  cardinality: ImplementationScreenCardinalityV1Schema,
}).strict().superRefine((value, context) => {
  requireCanonicalIdentities(
    context,
    ["containedSurfaces"],
    value.containedSurfaces.map((surface) => surface.surfaceRef),
    "Contained surface refs",
  );
  requireCanonicalIdentities(
    context,
    ["controls"],
    value.controls.map((control) => control.controlSlotRef),
    "Screen control-slot refs",
  );
  requireCanonicalIdentities(
    context,
    ["actionInputs"],
    value.actionInputs.map((input) => `${input.actionInputRef}\0${input.generatedControlId}`),
    "Screen action-input transport identities",
  );
  requireCanonicalIdentities(
    context,
    ["observables"],
    value.observables.map((observable) => observable.observableRef),
    "Screen observable refs",
  );
  requireCanonicalIdentities(
    context,
    ["rejectedControls"],
    value.rejectedControls.map((control) => control.contract.rejectionId),
    "Screen rejected-control IDs",
  );

  const componentActionByLocalId = new Map(value.componentApi.actionBindings.map((binding) =>
    [binding.generatedLocalId, binding] as const));
  value.controls.forEach((control, index) => {
    const actionBinding = componentActionByLocalId.get(control.generatedLocalId);
    if (
      !actionBinding
      || actionBinding.actionRef !== control.actionRef
      || actionBinding.inputFields.length !== control.handlerBinding.inputFields.length
      || actionBinding.inputFields.some((field, fieldIndex) =>
        field !== control.handlerBinding.inputFields[fieldIndex])
    ) {
      context.addIssue({
        code: "custom",
        path: ["controls", index, "handlerBinding"],
        message: "Control handler must exactly equal its generated component API callback",
      });
    }
  });
  const componentTransportKeys = new Set(value.componentApi.inputTransports.map((transport) =>
    `${transport.actionInputRef}\0${transport.generatedControlId}\0${transport.stateKey}`));
  const mappedTransportKeys = new Set(value.actionInputs.map((input) =>
    `${input.actionInputRef}\0${input.generatedControlId}\0${input.stateKey}`));
  if (
    componentTransportKeys.size !== mappedTransportKeys.size
    || [...componentTransportKeys].some((key) => !mappedTransportKeys.has(key))
  ) {
    context.addIssue({
      code: "custom",
      path: ["actionInputs"],
      message: "Source map must contain every and only generated component input transport",
    });
  }
  value.actionInputs.forEach((input, index) => {
    if (!componentTransportKeys.has(
      `${input.actionInputRef}\0${input.generatedControlId}\0${input.stateKey}`,
    )) {
      context.addIssue({
        code: "custom",
        path: ["actionInputs", index],
        message: "Action-input transport must resolve to the exact generated component API",
      });
    }
  });

  const surfaceRefs = new Set([
    value.rootSurface.surfaceRef,
    ...value.containedSurfaces.map((surface) => surface.surfaceRef),
  ]);
  if (value.containedSurfaces.some((surface) => surface.surfaceRef === value.rootSurface.surfaceRef)) {
    context.addIssue({
      code: "custom",
      path: ["containedSurfaces"],
      message: "Root surface cannot also be a contained surface",
    });
  }
  value.controls.forEach((control, index) => {
    if (!surfaceRefs.has(control.placement.surfaceRef)) {
      context.addIssue({
        code: "custom",
        path: ["controls", index, "placement", "surfaceRef"],
        message: "Control placement must resolve within its exact screen surface set",
      });
    }
  });
});

export type ImplementationScreenSourceV1 = z.infer<
  typeof ImplementationScreenSourceV1Schema
>;

const ImplementationSourceMapAuthorityShapeV1 = {
  schema: z.literal(IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V1),
  sourceMapVersion: z.literal(1),
  productSpecV2PayloadHash: Sha256Schema,
  buildTopologyV1PayloadHash: Sha256Schema,
  storyPlanV2PayloadHash: Sha256Schema,
  designSourceClosureV2PayloadHash: Sha256Schema,
};

const ImplementationSourceMapNoneV1Schema = z.object({
  ...ImplementationSourceMapAuthorityShapeV1,
  designSourceKind: z.literal("none"),
  designGraphV2PayloadHash: z.null(),
  screenIndexV2PayloadHash: z.null(),
  screenIndexSourceHash: z.null(),
  converter: z.null(),
  screens: z.array(z.never()).length(0),
}).strict();

const ImplementationSourceMapStitchV1Schema = z.object({
  ...ImplementationSourceMapAuthorityShapeV1,
  designSourceKind: z.literal("stitch"),
  designGraphV2PayloadHash: Sha256Schema,
  screenIndexV2PayloadHash: Sha256Schema,
  screenIndexSourceHash: Sha256Schema,
  converter: ImplementationSourceConverterV1Schema,
  screens: z.array(ImplementationScreenSourceV1Schema).min(1).max(1_000),
}).strict().superRefine((value, context) => {
  for (const [field, identities] of [
    ["targetRef", value.screens.map((screen) => screen.targetRef)],
    ["responseScreenId", value.screens.map((screen) => screen.responseScreenId)],
    ["pathRef", value.screens.map((screen) => screen.pathRef)],
    ["path", value.screens.map((screen) => screen.path)],
  ] as const) {
    if (!hasUniqueStrings(identities)) {
      context.addIssue({
        code: "custom",
        path: ["screens"],
        message: `Screen ${field} mappings must be unique`,
      });
    }
  }
  requireCanonicalIdentities(
    context,
    ["screens"],
    value.screens.map((screen) => screen.targetRef),
    "Screen target refs",
  );
});

export const ImplementationSourceMapV1Schema = z.discriminatedUnion("designSourceKind", [
  ImplementationSourceMapNoneV1Schema,
  ImplementationSourceMapStitchV1Schema,
]);

export type ImplementationSourceMapV1 = z.infer<typeof ImplementationSourceMapV1Schema>;

/** Hash of the strict payload only. CAS artifact identity additionally binds the semantic envelope. */
export function implementationSourceMapPayloadHashV1(value: ImplementationSourceMapV1): string {
  return hashCanonicalJson(ImplementationSourceMapV1Schema.parse(value));
}
