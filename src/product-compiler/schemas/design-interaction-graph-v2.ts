import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  ControlIdSchema,
  DesignSurfaceIdSchema,
  EvidenceIdSchema,
  ObservableIdSchema,
  RouteIdSchema,
  Sha256Schema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ControlSlotIdSchema } from "./common-v2.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import {
  RenderedObservableSelectorV2Schema,
  ProductSurfaceCompositionV2Schema,
} from "./product-spec-v2.js";
import { ObservableAssertionV1Schema } from "./product-spec-v1.js";
import { StitchGetByRoleReceiptV2Schema } from "./stitch-rendered-semantics-v2.js";

const ElementRefSchema = z.string().regex(/^E[0-9]{6}$/);
const ActionInputFieldSchema = z.string().min(1).max(160).regex(/^[A-Za-z][A-Za-z0-9_]*$/);

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isStrictlySorted(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || value > values[index - 1]!);
}

function addCanonicalUniqueIssue(
  context: z.RefinementCtx,
  path: PropertyKey,
  values: readonly string[],
  label: string,
): void {
  if (!hasUniqueStrings(values)) {
    context.addIssue({ code: "custom", path: [path], message: `${label} must be unique` });
  }
  if (!isStrictlySorted(values)) {
    context.addIssue({ code: "custom", path: [path], message: `${label} must be canonically sorted` });
  }
}

export const DesignTargetSourceAuthorityPayloadV2Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  targetHash: Sha256Schema,
  responseScreenId: z.string().min(1).max(500),
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
}).strict().superRefine((value, context) => {
  if (
    value.htmlDownloadedArtifactHash !== value.htmlArtifactHash
    || value.renderedHtmlArtifactHash !== value.htmlArtifactHash
    || value.screenshotDownloadedArtifactHash !== value.screenshotArtifactHash
    || value.renderedScreenshotArtifactHash !== value.screenshotArtifactHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["htmlArtifactHash"],
      message: "Design source authority must preserve one exact download/local/render artifact chain",
    });
  }
});

export type DesignTargetSourceAuthorityPayloadV2 = z.infer<
  typeof DesignTargetSourceAuthorityPayloadV2Schema
>;

export function designTargetSourceAuthorityHashV2(
  value: DesignTargetSourceAuthorityPayloadV2,
): string {
  return hashCanonicalJson(DesignTargetSourceAuthorityPayloadV2Schema.parse(value));
}

export const DesignTargetSourceAuthorityV2Schema = z.object({
  ...DesignTargetSourceAuthorityPayloadV2Schema.shape,
  sourceHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { sourceHash: _sourceHash, ...payload } = value;
  if (value.sourceHash !== designTargetSourceAuthorityHashV2(payload)) {
    context.addIssue({
      code: "custom",
      path: ["sourceHash"],
      message: "Design target source hash must derive from the exact canonical source authority",
    });
  }
});

export type DesignTargetSourceAuthorityV2 = z.infer<
  typeof DesignTargetSourceAuthorityV2Schema
>;

export const DesignElementSourceV2Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  responseScreenId: z.string().min(1).max(500),
  sourceHash: Sha256Schema,
  htmlArtifactHash: Sha256Schema,
  screenshotArtifactHash: Sha256Schema,
  semanticDomHash: Sha256Schema,
  semanticObservationHash: Sha256Schema,
}).strict();

export type DesignElementSourceV2 = z.infer<typeof DesignElementSourceV2Schema>;

export const DesignElementBindingV2Schema = z.object({
  elementRef: ElementRefSchema,
  elementHash: Sha256Schema,
}).strict();

export type DesignElementBindingV2 = z.infer<typeof DesignElementBindingV2Schema>;

export const DesignSurfaceBindingV2Schema = z.object({
  surfaceRef: SurfaceIdSchema,
  productSurfaceHash: Sha256Schema,
  designSurfaceRef: DesignSurfaceIdSchema,
  routeRef: RouteIdSchema,
  kind: z.enum(["page", "panel", "dialog", "overlay", "canvas", "terminal", "api"]),
  required: z.boolean(),
  composition: ProductSurfaceCompositionV2Schema,
  source: DesignElementSourceV2Schema,
  ...DesignElementBindingV2Schema.shape,
}).strict();

export type DesignSurfaceBindingV2 = z.infer<typeof DesignSurfaceBindingV2Schema>;

export const DesignControlIdentityPayloadV2Schema = z.object({
  schema: z.literal("setfarm.design-control-identity.v2"),
  controlSlotRef: ControlSlotIdSchema,
  actionRef: ActionIdSchema,
  routeRef: RouteIdSchema,
  surfaceRef: SurfaceIdSchema,
}).strict();

export type DesignControlIdentityPayloadV2 = z.infer<
  typeof DesignControlIdentityPayloadV2Schema
>;

export function designControlIdentityHashV2(value: DesignControlIdentityPayloadV2): string {
  return hashCanonicalJson(DesignControlIdentityPayloadV2Schema.parse(value));
}

export function designControlIdV2(value: DesignControlIdentityPayloadV2): string {
  return `CTRL_${designControlIdentityHashV2(value).slice(0, 16)}`;
}

export const DesignControlIdentityV2Schema = z.object({
  ...DesignControlIdentityPayloadV2Schema.shape,
  identityHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { identityHash: _identityHash, ...payload } = value;
  if (value.identityHash !== designControlIdentityHashV2(payload)) {
    context.addIssue({
      code: "custom",
      path: ["identityHash"],
      message: "Physical control identity hash must derive only from slot/action/route/surface identity",
    });
  }
});

export const DesignActionInputBindingV2Schema = z.object({
  actionInputRef: z.string().min(3).max(500),
  fieldRef: ActionInputFieldSchema,
  ...DesignElementBindingV2Schema.shape,
}).strict();

export type DesignActionInputBindingV2 = z.infer<typeof DesignActionInputBindingV2Schema>;

export const DesignPhysicalControlV2Schema = z.object({
  id: ControlIdSchema,
  identity: DesignControlIdentityV2Schema,
  controlPlacementHash: Sha256Schema,
  source: DesignElementSourceV2Schema,
  ...DesignElementBindingV2Schema.shape,
  dataAction: ActionIdSchema,
  dataControlSlot: ControlSlotIdSchema,
  tagName: z.string().regex(/^[a-z][a-z0-9-]*$/).max(100),
  nativeControlKind: z.enum(["button", "link", "input", "textarea", "select"]).nullable(),
  role: z.string().min(1).max(160).nullable(),
  ariaLabel: z.string().min(1).max(500).nullable(),
  href: z.string().min(1).max(2_000).nullable(),
  interactiveRole: z.boolean(),
  renderState: z.literal("rendered"),
  enabled: z.literal(true),
  pointerOperable: z.literal(true),
  actionInputBindings: z.array(DesignActionInputBindingV2Schema).max(500),
}).strict().superRefine((value, context) => {
  const identityPayload = {
    schema: value.identity.schema,
    controlSlotRef: value.identity.controlSlotRef,
    actionRef: value.identity.actionRef,
    routeRef: value.identity.routeRef,
    surfaceRef: value.identity.surfaceRef,
  } as const;
  if (value.id !== designControlIdV2(identityPayload)) {
    context.addIssue({
      code: "custom",
      path: ["id"],
      message: "Physical CTRL identity must be the first 16 hex characters of its canonical semantic identity hash",
    });
  }
  if (
    value.dataAction !== value.identity.actionRef
    || value.dataControlSlot !== value.identity.controlSlotRef
  ) {
    context.addIssue({
      code: "custom",
      path: ["dataAction"],
      message: "Rendered action/slot attributes must equal the physical control semantic identity",
    });
  }
  if (!value.nativeControlKind && !value.interactiveRole) {
    context.addIssue({
      code: "custom",
      path: ["interactiveRole"],
      message: "A physical action control must have native or browser-computed interactive semantics",
    });
  }
  const inputRefs = value.actionInputBindings.map((binding) => binding.actionInputRef);
  addCanonicalUniqueIssue(context, "actionInputBindings", inputRefs, "Control action-input refs");
  value.actionInputBindings.forEach((binding, index) => {
    if (binding.actionInputRef !== `${value.identity.actionRef}.${binding.fieldRef}`) {
      context.addIssue({
        code: "custom",
        path: ["actionInputBindings", index, "actionInputRef"],
        message: "Action-input refs must derive from the exact action and ProductSpec input field",
      });
    }
  });
});

export type DesignPhysicalControlV2 = z.infer<typeof DesignPhysicalControlV2Schema>;

export const DesignActionNavigationV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stay") }).strict(),
  z.object({ kind: z.literal("route"), routeRef: RouteIdSchema }).strict(),
  z.object({ kind: z.literal("back") }).strict(),
  z.object({ kind: z.literal("external"), url: z.url() }).strict(),
]);

export const DesignActionBindingV2Schema = z.object({
  actionRef: ActionIdSchema,
  productActionHash: Sha256Schema,
  triggerKind: z.enum(["user", "system", "timer", "route"]),
  navigation: DesignActionNavigationV2Schema,
  controlSlotRefs: z.array(ControlSlotIdSchema).max(1_000),
  controlRefs: z.array(ControlIdSchema).max(1_000),
  affectedSurfaceRefs: z.array(SurfaceIdSchema).max(1_000),
  observableRefs: z.array(ObservableIdSchema).min(1).max(500),
}).strict().superRefine((value, context) => {
  addCanonicalUniqueIssue(context, "controlSlotRefs", value.controlSlotRefs, "Action control-slot refs");
  addCanonicalUniqueIssue(context, "controlRefs", value.controlRefs, "Action physical control refs");
  addCanonicalUniqueIssue(context, "affectedSurfaceRefs", value.affectedSurfaceRefs, "Action affected-surface refs");
  addCanonicalUniqueIssue(context, "observableRefs", value.observableRefs, "Action observable refs");
  if (value.controlSlotRefs.length !== value.controlRefs.length) {
    context.addIssue({
      code: "custom",
      path: ["controlRefs"],
      message: "Every ProductSpec control slot requires exactly one reachable physical control",
    });
  }
  if (value.triggerKind === "user" && value.controlRefs.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["controlRefs"],
      message: "Every user action requires at least one reachable physical control",
    });
  }
  if (value.triggerKind !== "user" && (value.controlSlotRefs.length > 0 || value.controlRefs.length > 0)) {
    context.addIssue({
      code: "custom",
      path: ["controlRefs"],
      message: "Non-user actions cannot own physical controls",
    });
  }
});

export type DesignActionBindingV2 = z.infer<typeof DesignActionBindingV2Schema>;

export const DesignObservableRoleReceiptV2Schema = z.object({
  receiptHash: Sha256Schema,
  receipt: StitchGetByRoleReceiptV2Schema,
}).strict().superRefine((value, context) => {
  if (value.receiptHash !== hashCanonicalJson(value.receipt)) {
    context.addIssue({
      code: "custom",
      path: ["receiptHash"],
      message: "Observable role-receipt hash must bind the exact browser receipt",
    });
  }
});

export const DesignObservableBindingV2Schema = z.object({
  observableRef: ObservableIdSchema,
  productObservableHash: Sha256Schema,
  actionRef: ActionIdSchema,
  selector: RenderedObservableSelectorV2Schema,
  selectorHash: Sha256Schema,
  assertions: z.array(ObservableAssertionV1Schema).min(1).max(100),
  assertionsHash: Sha256Schema,
  evidenceRef: EvidenceIdSchema,
  source: DesignElementSourceV2Schema,
  elementBindings: z.array(DesignElementBindingV2Schema).length(1, {
    message: "Every canonical observable must resolve to one exact rendered element",
  }),
  roleReceipt: DesignObservableRoleReceiptV2Schema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.selectorHash !== hashCanonicalJson(value.selector)) {
    context.addIssue({
      code: "custom",
      path: ["selectorHash"],
      message: "Observable selector hash must bind the exact ProductSpec selector",
    });
  }
  if (value.assertionsHash !== hashCanonicalJson(value.assertions)) {
    context.addIssue({
      code: "custom",
      path: ["assertionsHash"],
      message: "Observable assertion hash must bind the exact canonical ProductSpec assertions",
    });
  }
  const assertionKeys = value.assertions.map((assertion) => `${assertion.phase}\0${assertion.property}`);
  addCanonicalUniqueIssue(context, "assertions", assertionKeys, "Observable assertions");
  const elementRefs = value.elementBindings.map((binding) => binding.elementRef);
  addCanonicalUniqueIssue(context, "elementBindings", elementRefs, "Observable element refs");
  if ((value.selector.kind === "accessibility") !== Boolean(value.roleReceipt)) {
    context.addIssue({
      code: "custom",
      path: ["roleReceipt"],
      message: "Only accessibility observables carry an exact browser role receipt",
    });
  }
  if (value.roleReceipt) {
    const receipt = value.roleReceipt.receipt;
    if (
      receipt.observableRef !== value.observableRef
      || receipt.actionRef !== value.actionRef
      || receipt.selectorHash !== value.selectorHash
      || JSON.stringify([...receipt.elementRefs].sort(compareUtf16)) !== JSON.stringify(elementRefs)
    ) {
      context.addIssue({
        code: "custom",
        path: ["roleReceipt"],
        message: "Browser role receipt must exactly identify the observable, action, selector, and elements",
      });
    }
  }
});

export type DesignObservableBindingV2 = z.infer<typeof DesignObservableBindingV2Schema>;

export const DesignInteractionGraphCardinalityV2Schema = z.object({
  rawArtifacts: z.number().int().nonnegative().max(20_000),
  sourceAuthorities: z.number().int().positive().max(1_000),
  surfaces: z.number().int().positive().max(1_000),
  actions: z.number().int().positive().max(2_000),
  userActions: z.number().int().nonnegative().max(2_000),
  controlSlots: z.number().int().nonnegative().max(10_000),
  physicalControls: z.number().int().nonnegative().max(10_000),
  actionInputBindings: z.number().int().nonnegative().max(100_000),
  observables: z.number().int().positive().max(10_000),
}).strict();

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function elementBindingKeys(bindings: readonly DesignElementBindingV2[]): string[] {
  return bindings.map((binding) => `${binding.elementRef}\0${binding.elementHash}`);
}

export const DesignInteractionGraphV2Schema = z.object({
  schema: z.literal("setfarm.design-interaction-graph.v2"),
  productSpecHash: Sha256Schema,
  generationTargetsHash: Sha256Schema,
  renderedSemanticsHash: Sha256Schema,
  candidateSelectionHash: Sha256Schema,
  responseBindingsHash: Sha256Schema,
  rawArtifactHashes: z.array(Sha256Schema).min(1).max(20_000),
  sourceAuthorities: z.array(DesignTargetSourceAuthorityV2Schema).min(1).max(1_000),
  surfaces: z.array(DesignSurfaceBindingV2Schema).min(1).max(1_000),
  actions: z.array(DesignActionBindingV2Schema).min(1).max(2_000),
  controls: z.array(DesignPhysicalControlV2Schema).max(10_000),
  observables: z.array(DesignObservableBindingV2Schema).min(1).max(10_000),
  cardinality: DesignInteractionGraphCardinalityV2Schema,
}).strict().superRefine((value, context) => {
  addCanonicalUniqueIssue(context, "rawArtifactHashes", value.rawArtifactHashes, "Raw artifact hashes");
  addCanonicalUniqueIssue(
    context,
    "sourceAuthorities",
    value.sourceAuthorities.map((source) => source.targetRef),
    "Source target refs",
  );
  addCanonicalUniqueIssue(context, "surfaces", value.surfaces.map((surface) => surface.surfaceRef), "Surface refs");
  addCanonicalUniqueIssue(context, "actions", value.actions.map((action) => action.actionRef), "Action refs");
  addCanonicalUniqueIssue(context, "controls", value.controls.map((control) => control.id), "Physical control IDs");
  addCanonicalUniqueIssue(
    context,
    "observables",
    value.observables.map((observable) => observable.observableRef),
    "Observable refs",
  );

  if (!hasUniqueStrings(value.sourceAuthorities.map((source) => source.responseScreenId))) {
    context.addIssue({ code: "custom", path: ["sourceAuthorities"], message: "Source response screen IDs must be unique" });
  }
  if (!hasUniqueStrings(value.controls.map((control) => control.identity.controlSlotRef))) {
    context.addIssue({ code: "custom", path: ["controls"], message: "Physical controls must be unique by control slot" });
  }
  if (!hasUniqueStrings(value.controls.map((control) =>
    `${control.source.targetRef}\0${control.source.responseScreenId}\0${control.elementRef}`))) {
    context.addIssue({ code: "custom", path: ["controls"], message: "One rendered element cannot implement multiple physical controls" });
  }

  const sourceByTarget = new Map(value.sourceAuthorities.map((source) => [source.targetRef, source] as const));
  const surfaceByRef = new Map(value.surfaces.map((surface) => [surface.surfaceRef, surface] as const));
  const actionByRef = new Map(value.actions.map((action) => [action.actionRef, action] as const));
  const controlBySlot = new Map(value.controls.map((control) =>
    [control.identity.controlSlotRef, control] as const));

  const checkElementSource = (
    source: DesignElementSourceV2,
    path: PropertyKey[],
  ): void => {
    const authority = sourceByTarget.get(source.targetRef);
    if (
      !authority
      || source.responseScreenId !== authority.responseScreenId
      || source.sourceHash !== authority.sourceHash
      || source.htmlArtifactHash !== authority.htmlArtifactHash
      || source.screenshotArtifactHash !== authority.screenshotArtifactHash
      || source.semanticDomHash !== authority.semanticDomHash
      || source.semanticObservationHash !== authority.semanticObservationHash
    ) {
      context.addIssue({
        code: "custom",
        path,
        message: "Element source must resolve to one exact target/screen/artifact authority",
      });
    }
  };

  value.surfaces.forEach((surface, index) => {
    checkElementSource(surface.source, ["surfaces", index, "source"]);
  });
  value.sourceAuthorities.forEach((source, index) => {
    if (!value.surfaces.some((surface) => surface.source.targetRef === source.targetRef)) {
      context.addIssue({
        code: "custom",
        path: ["sourceAuthorities", index],
        message: "Every selected target authority must own at least one exact ProductSpec surface",
      });
    }
  });

  value.controls.forEach((control, index) => {
    checkElementSource(control.source, ["controls", index, "source"]);
    const surface = surfaceByRef.get(control.identity.surfaceRef);
    if (
      !surface
      || surface.routeRef !== control.identity.routeRef
      || surface.source.targetRef !== control.source.targetRef
      || surface.source.responseScreenId !== control.source.responseScreenId
    ) {
      context.addIssue({
        code: "custom",
        path: ["controls", index, "identity", "surfaceRef"],
        message: "Physical control must resolve to its exact route, surface, target, and screen",
      });
    }
    if (!actionByRef.has(control.identity.actionRef)) {
      context.addIssue({
        code: "custom",
        path: ["controls", index, "identity", "actionRef"],
        message: "Physical control action ref is absent from graph actions",
      });
    }
  });

  value.actions.forEach((action, index) => {
    const controls = value.controls
      .filter((control) => control.identity.actionRef === action.actionRef)
      .sort((left, right) => compareUtf16(left.id, right.id));
    const expectedControlRefs = controls.map((control) => control.id);
    const expectedSlotRefs = controls.map((control) => control.identity.controlSlotRef).sort(compareUtf16);
    if (!sameStrings(action.controlRefs, expectedControlRefs) || !sameStrings(action.controlSlotRefs, expectedSlotRefs)) {
      context.addIssue({
        code: "custom",
        path: ["actions", index, "controlRefs"],
        message: "Action control refs must exactly index every and only its physical control slots",
      });
    }
    if (action.affectedSurfaceRefs.some((surfaceRef) => !surfaceByRef.has(surfaceRef))) {
      context.addIssue({
        code: "custom",
        path: ["actions", index, "affectedSurfaceRefs"],
        message: "Affected surfaces must resolve without minting physical controls",
      });
    }
    const expectedObservableRefs = value.observables
      .filter((observable) => observable.actionRef === action.actionRef)
      .map((observable) => observable.observableRef)
      .sort(compareUtf16);
    if (!sameStrings(action.observableRefs, expectedObservableRefs)) {
      context.addIssue({
        code: "custom",
        path: ["actions", index, "observableRefs"],
        message: "Action observable refs must exactly index its ProductSpec evidence effects",
      });
    }
  });

  value.observables.forEach((observable, index) => {
    checkElementSource(observable.source, ["observables", index, "source"]);
    if (!actionByRef.has(observable.actionRef)) {
      context.addIssue({
        code: "custom",
        path: ["observables", index, "actionRef"],
        message: "Observable action ref is absent from graph actions",
      });
    }
    let expectedTargetRef: string | undefined;
    let expectedElementBindings: DesignElementBindingV2[] | undefined;
    if (observable.selector.kind === "control") {
      const control = controlBySlot.get(observable.selector.controlSlotRef);
      if (control && control.identity.actionRef === observable.actionRef) {
        expectedTargetRef = control.source.targetRef;
        expectedElementBindings = [{ elementRef: control.elementRef, elementHash: control.elementHash }];
      }
    } else {
      const surface = surfaceByRef.get(observable.selector.surfaceRef);
      if (surface) {
        expectedTargetRef = surface.source.targetRef;
        if (observable.selector.kind === "surface") {
          expectedElementBindings = [{ elementRef: surface.elementRef, elementHash: surface.elementHash }];
        }
      }
    }
    if (!expectedTargetRef || expectedTargetRef !== observable.source.targetRef) {
      context.addIssue({
        code: "custom",
        path: ["observables", index, "source", "targetRef"],
        message: "Observable selector must resolve to its exact owning target authority",
      });
    }
    if (
      expectedElementBindings
      && !sameStrings(elementBindingKeys(observable.elementBindings), elementBindingKeys(expectedElementBindings))
    ) {
      context.addIssue({
        code: "custom",
        path: ["observables", index, "elementBindings"],
        message: "Control and surface observables must bind their exact graph element",
      });
    }
  });

  const expectedRawArtifactHashes = [...new Set(value.sourceAuthorities.flatMap((source) => [
    source.htmlArtifactHash,
    source.screenshotArtifactHash,
  ]))].sort(compareUtf16);
  if (!sameStrings(value.rawArtifactHashes, expectedRawArtifactHashes)) {
    context.addIssue({
      code: "custom",
      path: ["rawArtifactHashes"],
      message: "Raw artifact hashes must exactly equal selected HTML and screenshot bytes",
    });
  }

  const expectedCardinality = {
    rawArtifacts: value.rawArtifactHashes.length,
    sourceAuthorities: value.sourceAuthorities.length,
    surfaces: value.surfaces.length,
    actions: value.actions.length,
    userActions: value.actions.filter((action) => action.triggerKind === "user").length,
    controlSlots: value.actions.reduce((total, action) => total + action.controlSlotRefs.length, 0),
    physicalControls: value.controls.length,
    actionInputBindings: value.controls.reduce(
      (total, control) => total + control.actionInputBindings.length,
      0,
    ),
    observables: value.observables.length,
  };
  if (hashCanonicalJson(value.cardinality) !== hashCanonicalJson(expectedCardinality)) {
    context.addIssue({
      code: "custom",
      path: ["cardinality"],
      message: "Graph cardinality must exactly describe every closed semantic collection",
    });
  }
});

export type DesignInteractionGraphV2 = z.infer<typeof DesignInteractionGraphV2Schema>;
