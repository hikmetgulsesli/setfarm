import { z } from "zod";

import {
  ActionIdSchema,
  DesignSurfaceIdSchema,
  ObservableIdSchema,
  RouteIdSchema,
  Sha256Schema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  ControlHintV2Schema,
  ControlSlotIdSchema,
} from "./common-v2.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import { ObservableAssertionV1Schema } from "./product-spec-v1.js";
import { ObservableSelectorV2Schema } from "./product-spec-v2.js";

export const RequiredControlPlacementV2Schema = z.object({
  controlSlotRef: ControlSlotIdSchema,
  actionRef: ActionIdSchema,
  surfaceRef: SurfaceIdSchema,
  controlHint: ControlHintV2Schema,
  inputFields: z.array(z.string().min(1).max(160)).max(500).refine(hasUniqueStrings, {
    message: "Generation target control input fields must be unique",
  }),
}).strict();

export type RequiredControlPlacementV2 = z.infer<typeof RequiredControlPlacementV2Schema>;

export const RequiredObservableSelectorV2Schema = z.object({
  observableRef: ObservableIdSchema,
  actionRef: ActionIdSchema,
  selector: ObservableSelectorV2Schema,
  assertions: z.array(ObservableAssertionV1Schema).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (!value.assertions.some((assertion) => assertion.phase === "after")) {
    context.addIssue({
      code: "custom",
      path: ["assertions"],
      message: "DESIGN_TARGET_V2_OBSERVABLE_AFTER_REQUIRED: Required observable selectors must preserve an after assertion",
    });
  }
  const assertionKeys = value.assertions.map((assertion) =>
    `${assertion.phase}\0${assertion.property}`);
  if (!hasUniqueStrings(assertionKeys)) {
    context.addIssue({
      code: "custom",
      path: ["assertions"],
      message: "DESIGN_TARGET_V2_OBSERVABLE_ASSERTION_DUPLICATE: Observable phase/property assertions must be unique",
    });
  }
});

export type RequiredObservableSelectorV2 = z.infer<typeof RequiredObservableSelectorV2Schema>;

export const DesignGenerationTargetV2Schema = z.object({
  targetId: GenerationTargetIdSchema,
  designSurfaceId: DesignSurfaceIdSchema,
  routeRef: RouteIdSchema,
  surfaceRef: SurfaceIdSchema,
  containedSurfaceRefs: z.array(SurfaceIdSchema).max(1_000).refine(hasUniqueStrings, {
    message: "Generation target contained surface refs must be unique",
  }),
  requestScreenKey: z.string().min(1).max(500),
  expectedScreenTitle: z.string().min(1).max(500),
  requiredControlPlacements: z.array(RequiredControlPlacementV2Schema).max(2_000),
  affectingActionRefs: z.array(ActionIdSchema).max(2_000).refine(hasUniqueStrings, {
    message: "Generation target affecting action refs must be unique",
  }),
  requiredObservableSelectors: z.array(RequiredObservableSelectorV2Schema).max(2_000),
}).strict().superRefine((value, context) => {
  if (value.containedSurfaceRefs.includes(value.surfaceRef)) {
    context.addIssue({
      code: "custom",
      path: ["containedSurfaceRefs"],
      message: "DESIGN_TARGET_V2_ROOT_CONTAINMENT_SELF_REFERENCE: Root surface cannot also be a contained surface",
    });
  }

  const targetSurfaceRefs = new Set([value.surfaceRef, ...value.containedSurfaceRefs]);
  if (!hasUniqueStrings(value.requiredControlPlacements.map((placement) => placement.controlSlotRef))) {
    context.addIssue({
      code: "custom",
      path: ["requiredControlPlacements"],
      message: "DESIGN_TARGET_V2_CONTROL_SLOT_DUPLICATE: Required control slot refs must be unique",
    });
  }
  value.requiredControlPlacements.forEach((placement, placementIndex) => {
    if (!targetSurfaceRefs.has(placement.surfaceRef)) {
      context.addIssue({
        code: "custom",
        path: ["requiredControlPlacements", placementIndex, "surfaceRef"],
        message: `DESIGN_TARGET_V2_CONTROL_SURFACE_OUTSIDE_TARGET: ${placement.surfaceRef}`,
      });
    }
  });

  if (!hasUniqueStrings(value.requiredObservableSelectors.map((observable) => observable.observableRef))) {
    context.addIssue({
      code: "custom",
      path: ["requiredObservableSelectors"],
      message: "DESIGN_TARGET_V2_OBSERVABLE_DUPLICATE: Required observable refs must be unique",
    });
  }
  const placementBySlot = new Map(value.requiredControlPlacements.map((placement) =>
    [placement.controlSlotRef, placement] as const));
  value.requiredObservableSelectors.forEach((observable, observableIndex) => {
    if (observable.selector.kind === "control") {
      const placement = placementBySlot.get(observable.selector.controlSlotRef);
      if (!placement) {
        context.addIssue({
          code: "custom",
          path: ["requiredObservableSelectors", observableIndex, "selector", "controlSlotRef"],
          message: `DESIGN_TARGET_V2_OBSERVABLE_CONTROL_SLOT_UNRESOLVED: ${observable.selector.controlSlotRef}`,
        });
      } else if (placement.actionRef !== observable.actionRef) {
        context.addIssue({
          code: "custom",
          path: ["requiredObservableSelectors", observableIndex, "actionRef"],
          message: `DESIGN_TARGET_V2_OBSERVABLE_CONTROL_ACTION_MISMATCH: ${observable.selector.controlSlotRef} belongs to ${placement.actionRef}`,
        });
      }
      return;
    }
    if (!targetSurfaceRefs.has(observable.selector.surfaceRef)) {
      context.addIssue({
        code: "custom",
        path: ["requiredObservableSelectors", observableIndex, "selector", "surfaceRef"],
        message: `DESIGN_TARGET_V2_OBSERVABLE_SURFACE_OUTSIDE_TARGET: ${observable.selector.surfaceRef}`,
      });
    }
  });
});

export type DesignGenerationTargetV2 = z.infer<typeof DesignGenerationTargetV2Schema>;

export const DesignGenerationTargetsV2Schema = z.object({
  schema: z.literal("setfarm.design-generation-targets.v2"),
  productSpecHash: Sha256Schema,
  targets: z.array(DesignGenerationTargetV2Schema).min(1).max(1_000),
}).strict().superRefine((value, context) => {
  for (const [field, values] of [
    ["targetId", value.targets.map((target) => target.targetId)],
    ["designSurfaceId", value.targets.map((target) => target.designSurfaceId)],
    ["routeRef", value.targets.map((target) => target.routeRef)],
    ["surfaceRef", value.targets.map((target) => target.surfaceRef)],
    ["requestScreenKey", value.targets.map((target) => target.requestScreenKey)],
    ["expectedScreenTitle", value.targets.map((target) => target.expectedScreenTitle)],
  ] as const) {
    if (!hasUniqueStrings(values)) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: `Generation target ${field} values must be unique`,
      });
    }
  }

  const ownedSurfaceRefs = value.targets.flatMap((target) =>
    [target.surfaceRef, ...target.containedSurfaceRefs]);
  if (!hasUniqueStrings(ownedSurfaceRefs)) {
    context.addIssue({
      code: "custom",
      path: ["targets"],
      message: "DESIGN_TARGET_V2_SURFACE_OWNERSHIP_DUPLICATE: A ProductSpec surface can belong to only one route-root target",
    });
  }
  const controlSlotRefs = value.targets.flatMap((target) =>
    target.requiredControlPlacements.map((placement) => placement.controlSlotRef));
  if (!hasUniqueStrings(controlSlotRefs)) {
    context.addIssue({
      code: "custom",
      path: ["targets"],
      message: "DESIGN_TARGET_V2_CONTROL_SLOT_OWNERSHIP_DUPLICATE: A control slot can belong to only one generation target",
    });
  }
  const observableRefs = value.targets.flatMap((target) =>
    target.requiredObservableSelectors.map((observable) => observable.observableRef));
  if (!hasUniqueStrings(observableRefs)) {
    context.addIssue({
      code: "custom",
      path: ["targets"],
      message: "DESIGN_TARGET_V2_OBSERVABLE_OWNERSHIP_DUPLICATE: An observable can belong to only one generation target",
    });
  }
});

export type DesignGenerationTargetsV2 = z.infer<typeof DesignGenerationTargetsV2Schema>;
