import { z } from "zod";

import {
  ActionIdSchema,
  ControlIdSchema,
  EvidenceIdSchema,
  NormalizedRelativeLocatorSchema,
  ObservableIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ControlSlotIdSchema } from "./common-v2.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";

const ElementRefSchema = z.string().regex(/^E[0-9]{6}$/);
const LocalControlIdSchema = z.string().min(1).max(500);
const InteractiveKindSchema = z.enum(["button", "link", "input", "textarea", "select"]);

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

const IndexedInputMappingV2Schema = z.object({
  actionRef: ActionIdSchema,
  inputField: z.string().min(1).max(160),
}).strict();

const RejectedInteractiveControlV2Schema = z.object({
  rejectionId: LocalControlIdSchema,
  kind: InteractiveKindSchema,
  label: z.string().min(1).max(500),
  index: z.number().int().nonnegative(),
  reasonCode: z.literal("outside_canonical_rendered_contract"),
  rawActionRef: ActionIdSchema.optional(),
  rawInputBindings: z.array(IndexedInputMappingV2Schema).min(1).max(500).optional(),
  href: z.string().max(2_000).optional(),
  sourceElementRef: ElementRefSchema.optional(),
  sourceLocator: NormalizedRelativeLocatorSchema,
  generatedSourceLocator: NormalizedRelativeLocatorSchema,
  selector: z.string().min(1).max(2_000),
}).strict();

const IndexedControlBaseV2Schema = z.object({
  id: LocalControlIdSchema,
  generatedLocalId: LocalControlIdSchema,
  kind: InteractiveKindSchema,
  label: z.string().min(1).max(500).optional(),
  index: z.number().int().nonnegative().optional(),
  inputBindings: z.array(IndexedInputMappingV2Schema).max(500).optional(),
  sourceElementRef: ElementRefSchema,
  sourceLocator: NormalizedRelativeLocatorSchema,
  generatedSourceLocator: NormalizedRelativeLocatorSchema,
  selector: z.string().min(1).max(2_000),
  href: z.string().max(2_000).optional(),
});

export const StitchScreenPhysicalControlV2Schema = IndexedControlBaseV2Schema.extend({
  semanticSource: z.literal("data-action"),
  actionRef: ActionIdSchema,
  controlSlotRef: ControlSlotIdSchema,
  surfaceRef: SurfaceIdSchema,
  physicalControlRef: ControlIdSchema,
  affectedSurfaceRefs: z.array(SurfaceIdSchema).max(1_000),
  tagName: z.string().regex(/^[a-z][a-z0-9-]*$/).max(100),
  nativeControlKind: InteractiveKindSchema.nullable(),
  role: z.string().min(1).max(160).nullable(),
  ariaLabel: z.string().min(1).max(500).nullable(),
  interactiveRole: z.boolean(),
  href: z.string().min(1).max(2_000).nullable(),
}).strict();

const StitchScreenActionIndexEntryV2Schema = IndexedControlBaseV2Schema
  .omit({ generatedSourceLocator: true })
  .extend({
    semanticSource: z.literal("data-action"),
    actionRef: ActionIdSchema,
    controlSlotRef: ControlSlotIdSchema,
    surfaceRef: SurfaceIdSchema,
    physicalControlRef: ControlIdSchema,
    affectedSurfaceRefs: z.array(SurfaceIdSchema).max(1_000),
    tagName: z.string().regex(/^[a-z][a-z0-9-]*$/).max(100),
    nativeControlKind: InteractiveKindSchema.nullable(),
    role: z.string().min(1).max(160).nullable(),
    ariaLabel: z.string().min(1).max(500).nullable(),
    interactiveRole: z.boolean(),
    href: z.string().min(1).max(2_000).nullable(),
  })
  .strict();

const StitchScreenInputControlV2Schema = IndexedControlBaseV2Schema.extend({
  semanticSource: z.literal("data-action-input"),
  inputBindings: z.array(IndexedInputMappingV2Schema).min(1).max(500),
}).strict();

export const StitchScreenControlV2Schema = z.union([
  StitchScreenPhysicalControlV2Schema,
  StitchScreenInputControlV2Schema,
]);

export const StitchScreenObservableV2Schema = z.object({
  observableRef: ObservableIdSchema,
  actionRef: ActionIdSchema,
  selectorKind: z.enum(["control", "surface", "accessibility"]),
  controlSlotRef: ControlSlotIdSchema.optional(),
  surfaceRef: SurfaceIdSchema.optional(),
  role: z.string().min(1).max(160).optional(),
  name: z.string().min(1).max(500).optional(),
  evidenceRef: EvidenceIdSchema,
  sourceElementRef: ElementRefSchema,
  sourceLocator: NormalizedRelativeLocatorSchema,
  generatedSourceLocator: NormalizedRelativeLocatorSchema,
  selector: z.string().min(1).max(2_000),
}).strict().superRefine((value, context) => {
  if (value.selectorKind === "control" && !value.controlSlotRef) {
    context.addIssue({
      code: "custom",
      path: ["controlSlotRef"],
      message: "Control observables require their exact physical control slot",
    });
  }
  if (value.selectorKind !== "control" && value.controlSlotRef) {
    context.addIssue({
      code: "custom",
      path: ["controlSlotRef"],
      message: "Only control observables may carry a control-slot reference",
    });
  }
  if (value.selectorKind !== "control" && !value.surfaceRef) {
    context.addIssue({
      code: "custom",
      path: ["surfaceRef"],
      message: "Surface and accessibility observables require their exact surface",
    });
  }
  if (value.selectorKind === "accessibility" && (!value.role || !value.name)) {
    context.addIssue({
      code: "custom",
      path: ["role"],
      message: "Accessibility observables require their exact browser role and name",
    });
  }
  if (value.selectorKind !== "accessibility" && (value.role || value.name)) {
    context.addIssue({
      code: "custom",
      path: ["role"],
      message: "Only accessibility observables may carry browser role/name authority",
    });
  }
});

const InteractiveCountsV2Schema = z.object({
  buttons: z.number().int().nonnegative(),
  links: z.number().int().nonnegative(),
  inputs: z.number().int().nonnegative(),
  textareas: z.number().int().nonnegative(),
  selects: z.number().int().nonnegative(),
}).strict();

const ScreenProjectionV2Schema = z.object({
  schema: z.literal("setfarm.stitch-screen-projection.v2"),
  mode: z.literal("contract_only"),
  targetRef: GenerationTargetIdSchema,
  authoritySchema: z.literal("setfarm.design-interaction-graph.v2"),
  rawInteractiveCounts: InteractiveCountsV2Schema,
  requiredObservableRefs: z.array(ObservableIdSchema).max(10_000).refine(hasUniqueStrings),
}).strict();

const GeneratedScreenActionBindingV1Schema = z.object({
  generatedLocalId: LocalControlIdSchema,
  actionRef: ActionIdSchema,
  inputFields: z.array(z.string().min(1).max(160)).max(500),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.inputFields)) {
    context.addIssue({
      code: "custom",
      path: ["inputFields"],
      message: "Generated component action input fields must be unique",
    });
  }
  if (JSON.stringify(value.inputFields) !== JSON.stringify([...value.inputFields].sort(compareUtf16))) {
    context.addIssue({
      code: "custom",
      path: ["inputFields"],
      message: "Generated component action input fields must be canonically sorted",
    });
  }
});

const GeneratedScreenInputTransportV1Schema = z.object({
  actionInputRef: z.string().min(3).max(500),
  generatedControlId: LocalControlIdSchema,
  stateKey: z.string().min(3).max(500),
}).strict().superRefine((value, context) => {
  const separator = value.actionInputRef.indexOf(".");
  if (
    separator < 0
    || !ActionIdSchema.safeParse(value.actionInputRef.slice(0, separator)).success
    || value.actionInputRef.slice(separator + 1).length === 0
    || value.actionInputRef.slice(separator + 1).length > 160
  ) {
    context.addIssue({
      code: "custom",
      path: ["actionInputRef"],
      message: "Generated input transport must identify an exact ActionId.field input",
    });
  }
  if (value.stateKey !== value.actionInputRef) {
    context.addIssue({
      code: "custom",
      path: ["stateKey"],
      message: "Generated input state keys must equal their exact action-input reference",
    });
  }
});

const GeneratedScreenComponentApiV1Schema = z.object({
  schema: z.literal("setfarm.generated-screen-component-api.v1"),
  actionsPropName: z.literal("actions"),
  actionBindings: z.array(GeneratedScreenActionBindingV1Schema).max(10_000),
  inputTransports: z.array(GeneratedScreenInputTransportV1Schema).max(100_000),
}).strict().superRefine((value, context) => {
  const actionBindingKeys = value.actionBindings.map(
    (binding) => `${binding.generatedLocalId}\0${binding.actionRef}`,
  );
  if (!hasUniqueStrings(actionBindingKeys)) {
    context.addIssue({
      code: "custom",
      path: ["actionBindings"],
      message: "Generated component action bindings must have unique local/action identities",
    });
  }
  if (JSON.stringify(actionBindingKeys) !== JSON.stringify([...actionBindingKeys].sort(compareUtf16))) {
    context.addIssue({
      code: "custom",
      path: ["actionBindings"],
      message: "Generated component action bindings must be canonically sorted",
    });
  }
  const transportKeys = value.inputTransports.map(
    (transport) => `${transport.actionInputRef}\0${transport.generatedControlId}`,
  );
  if (!hasUniqueStrings(transportKeys)) {
    context.addIssue({
      code: "custom",
      path: ["inputTransports"],
      message: "Generated component input transports must have unique input/control identities",
    });
  }
  if (JSON.stringify(transportKeys) !== JSON.stringify([...transportKeys].sort(compareUtf16))) {
    context.addIssue({
      code: "custom",
      path: ["inputTransports"],
      message: "Generated component input transports must be canonically sorted",
    });
  }
});

export const StitchScreenIndexEntryV2Schema = z.object({
  screenId: z.string().min(1).max(500),
  title: z.string().min(1).max(500),
  componentName: z.string().min(1).max(500),
  file: NormalizedRelativeLocatorSchema,
  buttons: z.number().int().nonnegative(),
  inputs: z.number().int().nonnegative(),
  textareas: z.number().int().nonnegative(),
  selects: z.number().int().nonnegative(),
  links: z.number().int().nonnegative(),
  actions: z.array(StitchScreenActionIndexEntryV2Schema).max(10_000),
  controls: z.array(StitchScreenControlV2Schema).max(10_000),
  observables: z.array(StitchScreenObservableV2Schema).max(10_000),
  projection: ScreenProjectionV2Schema,
  componentApi: GeneratedScreenComponentApiV1Schema,
  rejectedControls: z.array(RejectedInteractiveControlV2Schema).max(10_000),
}).strict().superRefine((value, context) => {
  for (const [field, identities] of [
    ["controls", value.controls.map((control) => control.generatedLocalId)],
    ["controls", value.controls.map((control) => control.selector)],
    ["controls", value.controls.map((control) => control.sourceElementRef)],
    ["observables", value.observables.map((observable) => observable.observableRef)],
    ["observables", value.observables.map((observable) => observable.selector)],
    ["rejectedControls", value.rejectedControls.map((control) => control.rejectionId)],
    ["rejectedControls", value.rejectedControls.map((control) => control.selector)],
  ] as const) {
    if (!hasUniqueStrings(identities)) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: `${field} exact generated identities must be unique per screen`,
      });
    }
  }
  const observableRefs = [...value.observables.map((observable) => observable.observableRef)].sort();
  const requiredRefs = [...value.projection.requiredObservableRefs].sort();
  if (
    observableRefs.length !== requiredRefs.length
    || observableRefs.some((reference, index) => reference !== requiredRefs[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["projection", "requiredObservableRefs"],
      message: "SCREEN_INDEX observables must exactly equal the target-required observable set",
    });
  }

  const physicalControls = value.controls.filter((control) => control.semanticSource === "data-action");
  const projectedActions = physicalControls.map((control) => {
    const { generatedSourceLocator: _generatedSourceLocator, ...action } = control;
    return action;
  });
  if (JSON.stringify(value.actions) !== JSON.stringify(projectedActions)) {
    context.addIssue({
      code: "custom",
      path: ["actions"],
      message: "SCREEN_INDEX actions must exactly project every and only physical control",
    });
  }

  const expectedActionBindings = physicalControls
    .map((control) => ({
      generatedLocalId: control.generatedLocalId,
      actionRef: control.actionRef,
      inputFields: [...new Set(value.controls.flatMap((candidate) =>
        (candidate.inputBindings ?? [])
          .filter((binding) => binding.actionRef === control.actionRef)
          .map((binding) => binding.inputField)))].sort(compareUtf16),
    }))
    .sort((left, right) => compareUtf16(
      `${left.generatedLocalId}\0${left.actionRef}`,
      `${right.generatedLocalId}\0${right.actionRef}`,
    ));
  if (JSON.stringify(value.componentApi.actionBindings) !== JSON.stringify(expectedActionBindings)) {
    context.addIssue({
      code: "custom",
      path: ["componentApi", "actionBindings"],
      message: "Generated component API must exactly type every physical action and its target-wide inputs",
    });
  }

  const expectedInputTransports = value.controls
    .flatMap((control) => (control.inputBindings ?? []).map((binding) => {
      const actionInputRef = `${binding.actionRef}.${binding.inputField}`;
      return {
        actionInputRef,
        generatedControlId: control.generatedLocalId,
        stateKey: actionInputRef,
      };
    }))
    .sort((left, right) => compareUtf16(
      `${left.actionInputRef}\0${left.generatedControlId}`,
      `${right.actionInputRef}\0${right.generatedControlId}`,
    ));
  if (JSON.stringify(value.componentApi.inputTransports) !== JSON.stringify(expectedInputTransports)) {
    context.addIssue({
      code: "custom",
      path: ["componentApi", "inputTransports"],
      message: "Generated component API must exactly transport every indexed action input",
    });
  }

  const rawCounts = value.projection.rawInteractiveCounts;
  const declaredCounts = {
    buttons: value.buttons,
    links: value.links,
    inputs: value.inputs,
    textareas: value.textareas,
    selects: value.selects,
  };
  if (JSON.stringify(rawCounts) !== JSON.stringify(declaredCounts)) {
    context.addIssue({
      code: "custom",
      path: ["projection", "rawInteractiveCounts"],
      message: "SCREEN_INDEX raw interactive counts must equal its exact screen counts",
    });
  }
  for (const [kind, countField] of [
    ["button", "buttons"],
    ["link", "links"],
    ["input", "inputs"],
    ["textarea", "textareas"],
    ["select", "selects"],
  ] as const) {
    const covered = value.controls.filter((control) => control.kind === kind).length
      + value.rejectedControls.filter((control) => control.kind === kind).length;
    if (covered !== rawCounts[countField]) {
      context.addIssue({
        code: "custom",
        path: ["rejectedControls"],
        message: `Every rendered ${kind} must be exactly accepted or inert-rejected`,
      });
    }
  }
});

export const StitchScreenIndexV2Schema = z.array(StitchScreenIndexEntryV2Schema)
  .min(1)
  .max(1_000)
  .superRefine((value, context) => {
    for (const [field, identities] of [
      ["screenId", value.map((entry) => entry.screenId)],
      ["file", value.map((entry) => entry.file)],
      ["targetRef", value.map((entry) => entry.projection.targetRef)],
    ] as const) {
      if (!hasUniqueStrings(identities)) {
        context.addIssue({
          code: "custom",
          path: [],
          message: `SCREEN_INDEX ${field} identities must be unique`,
        });
      }
    }
  });

export type StitchScreenIndexV2 = z.infer<typeof StitchScreenIndexV2Schema>;
export type StitchScreenIndexEntryV2 = z.infer<typeof StitchScreenIndexEntryV2Schema>;
