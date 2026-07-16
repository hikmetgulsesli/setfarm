import { z } from "zod";

import { hasUniqueStrings } from "./common-v1.js";
import {
  ControlHintV2Schema,
  RequirementSemanticKindV2Schema,
} from "./common-v2.js";
import {
  PlanSemanticKeyV1Schema,
  PlanSemanticProposalV1Schema,
} from "./plan-semantic-proposal-v1.js";

export const PlanSemanticKeyV2Schema = PlanSemanticKeyV1Schema;

export const PlanSurfaceCompositionV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("route_root") }).strict(),
  z.object({
    kind: z.literal("contained"),
    hostSurfaceKey: PlanSemanticKeyV2Schema,
  }).strict(),
]);

export type PlanSurfaceCompositionV2 = z.infer<typeof PlanSurfaceCompositionV2Schema>;

const PlanSurfaceV1Schema = PlanSemanticProposalV1Schema.shape.surfaces.element;
const RequirementRefsSchema = PlanSurfaceV1Schema.shape.requirementRefs;

export const PlanSurfaceV2Schema = z.object({
  ...PlanSurfaceV1Schema.shape,
  composition: PlanSurfaceCompositionV2Schema,
}).strict();

export type PlanSurfaceV2 = z.infer<typeof PlanSurfaceV2Schema>;

export const PlanControlPlacementV2Schema = z.object({
  key: PlanSemanticKeyV2Schema,
  surfaceKey: PlanSemanticKeyV2Schema,
  controlHint: ControlHintV2Schema,
  requirementRefs: RequirementRefsSchema,
}).strict();

export type PlanControlPlacementV2 = z.infer<typeof PlanControlPlacementV2Schema>;

export const PlanObservableSelectorV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("control"),
    controlPlacementKey: PlanSemanticKeyV2Schema,
  }).strict(),
  z.object({
    kind: z.literal("surface"),
    surfaceKey: PlanSemanticKeyV2Schema,
  }).strict(),
  z.object({
    kind: z.literal("accessibility"),
    surfaceKey: PlanSemanticKeyV2Schema,
    role: z.string().min(1).max(100),
    name: z.string().min(1).max(500),
  }).strict(),
]);

export type PlanObservableSelectorV2 = z.infer<typeof PlanObservableSelectorV2Schema>;

const PlanActionV1Schema = PlanSemanticProposalV1Schema.shape.actions.element;
const PlanObservableV1Schema = PlanActionV1Schema.shape.observables.element;
const {
  surfaceKeys: _surfaceKeys,
  evidenceScenario: PlanEvidenceScenarioV1Schema,
  observables: _observables,
  ...PlanActionStableShape
} = PlanActionV1Schema.shape;

export const PlanObservableV2Schema = z.object({
  ...PlanObservableV1Schema.shape,
  selector: PlanObservableSelectorV2Schema,
}).strict();

export type PlanObservableV2 = z.infer<typeof PlanObservableV2Schema>;

export const PlanActionV2Schema = z.object({
  ...PlanActionStableShape,
  controlPlacements: z.array(PlanControlPlacementV2Schema).max(1_000),
  affectedSurfaceKeys: z.array(PlanSemanticKeyV2Schema).max(1_000).refine(hasUniqueStrings, {
    message: "Action affected surface keys must be unique",
  }),
  evidenceScenario: z.object({
    ...PlanEvidenceScenarioV1Schema.shape,
    controlPlacementKey: PlanSemanticKeyV2Schema.optional(),
  }).strict(),
  observables: z.array(PlanObservableV2Schema).min(1).max(500),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.inputs.map((field) => field.name))) {
    context.addIssue({ code: "custom", path: ["inputs"], message: "Action input names must be unique" });
  }
  if (!hasUniqueStrings(value.stateDeltas.map((delta) => delta.key))) {
    context.addIssue({ code: "custom", path: ["stateDeltas"], message: "Action state delta keys must be unique" });
  }
  if (!hasUniqueStrings(value.observables.map((observable) => observable.key))) {
    context.addIssue({ code: "custom", path: ["observables"], message: "Action observable keys must be unique" });
  }
  if (!hasUniqueStrings(value.controlPlacements.map((placement) => placement.key))) {
    context.addIssue({
      code: "custom",
      path: ["controlPlacements"],
      message: "PLAN_SEMANTIC_CONTROL_PLACEMENT_DUPLICATE: Action control placement keys must be unique",
    });
  }

  const evidencePlacement = value.evidenceScenario.controlPlacementKey;
  if (value.trigger.kind === "user") {
    if (value.controlPlacements.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["controlPlacements"],
        message: "PLAN_SEMANTIC_USER_CONTROL_PLACEMENT_REQUIRED: User actions require at least one explicit control placement",
      });
    }
    if (!evidencePlacement) {
      context.addIssue({
        code: "custom",
        path: ["evidenceScenario", "controlPlacementKey"],
        message: "PLAN_SEMANTIC_EVIDENCE_CONTROL_PLACEMENT_REQUIRED: User action evidence requires one explicit control placement",
      });
    }
  } else {
    if (value.controlPlacements.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["controlPlacements"],
        message: "PLAN_SEMANTIC_NON_USER_CONTROL_PLACEMENT_FORBIDDEN: Non-user actions cannot declare rendered control placements",
      });
    }
    if (evidencePlacement) {
      context.addIssue({
        code: "custom",
        path: ["evidenceScenario", "controlPlacementKey"],
        message: "PLAN_SEMANTIC_NON_USER_EVIDENCE_CONTROL_FORBIDDEN: Non-user action evidence cannot select a rendered control placement",
      });
    }
  }
  if (evidencePlacement && !value.controlPlacements.some((placement) => placement.key === evidencePlacement)) {
    context.addIssue({
      code: "custom",
      path: ["evidenceScenario", "controlPlacementKey"],
      message: `PLAN_SEMANTIC_EVIDENCE_CONTROL_PLACEMENT_UNRESOLVED: ${evidencePlacement}`,
    });
  }
});

export type PlanActionV2 = z.infer<typeof PlanActionV2Schema>;

const RequirementClassificationV1Schema = PlanSemanticProposalV1Schema.shape.requirements.element;
const RequirementClassificationV2Schema = z.object({
  ...RequirementClassificationV1Schema.shape,
  expectedSemanticKinds: z.array(RequirementSemanticKindV2Schema).min(1).max(11).refine(hasUniqueStrings, {
    message: "Requirement expected semantic kinds must be unique",
  }),
}).strict();

function addUniqueKeyIssue(
  context: z.RefinementCtx,
  path: string,
  values: readonly Readonly<{ key: string }>[],
): void {
  if (!hasUniqueStrings(values.map((value) => value.key))) {
    context.addIssue({ code: "custom", path: [path], message: `${path} semantic keys must be unique` });
  }
}

/**
 * The v2 planner boundary makes rendered control placement and downstream
 * behavior scope separate primary facts. It never infers one from the other.
 */
export const PlanSemanticProposalV2Schema = z.object({
  ...PlanSemanticProposalV1Schema.shape,
  schema: z.literal("setfarm.plan-semantic-proposal.v2"),
  requirements: z.array(RequirementClassificationV2Schema).min(1).max(1_000),
  surfaces: z.array(PlanSurfaceV2Schema).min(1).max(1_000),
  actions: z.array(PlanActionV2Schema).min(1).max(2_000),
}).strict().superRefine((value, context) => {
  addUniqueKeyIssue(context, "goals", value.product.goals);
  addUniqueKeyIssue(context, "nonGoals", value.product.nonGoals);
  addUniqueKeyIssue(context, "entities", value.entities);
  addUniqueKeyIssue(context, "states", value.states);
  addUniqueKeyIssue(context, "persistencePolicies", value.persistencePolicies);
  addUniqueKeyIssue(context, "routes", value.routes);
  addUniqueKeyIssue(context, "surfaces", value.surfaces);
  addUniqueKeyIssue(context, "actions", value.actions);
  addUniqueKeyIssue(context, "assumptions", value.assumptions);
  if (!hasUniqueStrings(value.requirements.map((requirement) => requirement.id))) {
    context.addIssue({ code: "custom", path: ["requirements"], message: "Requirement IDs must be unique" });
  }

  const routeKeys = new Set(value.routes.map((route) => route.key));
  const surfaceByKey = new Map(value.surfaces.map((surface) => [surface.key, surface] as const));

  value.surfaces.forEach((surface, surfaceIndex) => {
    if (!routeKeys.has(surface.routeKey)) {
      context.addIssue({
        code: "custom",
        path: ["surfaces", surfaceIndex, "routeKey"],
        message: `PLAN_SEMANTIC_SURFACE_ROUTE_UNRESOLVED: ${surface.routeKey}`,
      });
    }
    if (surface.composition.kind !== "contained") return;
    const host = surfaceByKey.get(surface.composition.hostSurfaceKey);
    if (!host) {
      context.addIssue({
        code: "custom",
        path: ["surfaces", surfaceIndex, "composition", "hostSurfaceKey"],
        message: `PLAN_SEMANTIC_SURFACE_HOST_UNRESOLVED: ${surface.composition.hostSurfaceKey}`,
      });
      return;
    }
    if (host.routeKey !== surface.routeKey) {
      context.addIssue({
        code: "custom",
        path: ["surfaces", surfaceIndex, "composition", "hostSurfaceKey"],
        message: `PLAN_SEMANTIC_SURFACE_HOST_CROSS_ROUTE: ${surface.key} belongs to ${surface.routeKey}, but its host belongs to ${host.routeKey}`,
      });
    }
  });

  value.routes.forEach((route, routeIndex) => {
    const routeRoots = value.surfaces.filter((surface) =>
      surface.routeKey === route.key && surface.composition.kind === "route_root");
    if (routeRoots.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["routes", routeIndex],
        message: `PLAN_SEMANTIC_ROUTE_ROOT_CARDINALITY: Route ${route.key} requires exactly one route-root surface, found ${routeRoots.length}`,
      });
    }
  });

  value.surfaces.forEach((surface, surfaceIndex) => {
    const seen = new Set<string>([surface.key]);
    let cursor = surface;
    while (cursor.composition.kind === "contained") {
      const host = surfaceByKey.get(cursor.composition.hostSurfaceKey);
      if (!host || host.routeKey !== surface.routeKey) break;
      if (seen.has(host.key)) {
        context.addIssue({
          code: "custom",
          path: ["surfaces", surfaceIndex, "composition"],
          message: `PLAN_SEMANTIC_SURFACE_CONTAINMENT_CYCLE: ${surface.key}`,
        });
        break;
      }
      seen.add(host.key);
      cursor = host;
    }
  });

  value.actions.forEach((action, actionIndex) => {
    const placementByKey = new Map(action.controlPlacements.map((placement) => [placement.key, placement] as const));
    const scopedSurfaceKeys = new Set<string>(action.affectedSurfaceKeys);

    action.controlPlacements.forEach((placement, placementIndex) => {
      scopedSurfaceKeys.add(placement.surfaceKey);
      if (!surfaceByKey.has(placement.surfaceKey)) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "controlPlacements", placementIndex, "surfaceKey"],
          message: `PLAN_SEMANTIC_CONTROL_PLACEMENT_SURFACE_UNRESOLVED: ${placement.surfaceKey}`,
        });
      }
    });
    action.affectedSurfaceKeys.forEach((surfaceKey, surfaceIndex) => {
      if (!surfaceByKey.has(surfaceKey)) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "affectedSurfaceKeys", surfaceIndex],
          message: `PLAN_SEMANTIC_AFFECTED_SURFACE_UNRESOLVED: ${surfaceKey}`,
        });
      }
    });

    action.observables.forEach((observable, observableIndex) => {
      const selector = observable.selector;
      if (selector.kind === "control") {
        if (!placementByKey.has(selector.controlPlacementKey)) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "observables", observableIndex, "selector", "controlPlacementKey"],
            message: `PLAN_SEMANTIC_OBSERVABLE_CONTROL_PLACEMENT_UNRESOLVED: ${selector.controlPlacementKey}`,
          });
        }
        return;
      }
      if (!surfaceByKey.has(selector.surfaceKey)) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "observables", observableIndex, "selector", "surfaceKey"],
          message: `PLAN_SEMANTIC_OBSERVABLE_SURFACE_UNRESOLVED: ${selector.surfaceKey}`,
        });
      } else if (!scopedSurfaceKeys.has(selector.surfaceKey)) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "observables", observableIndex, "selector", "surfaceKey"],
          message: `PLAN_SEMANTIC_OBSERVABLE_SURFACE_OUTSIDE_ACTION_SCOPE: ${selector.surfaceKey}`,
        });
      }
    });
  });
});

export type PlanSemanticProposalV2 = z.infer<typeof PlanSemanticProposalV2Schema>;
