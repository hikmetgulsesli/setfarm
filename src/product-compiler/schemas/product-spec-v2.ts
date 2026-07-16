import { z } from "zod";

import {
  RequirementIdSchema,
  RouteIdSchema,
  Sha256Schema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  ControlHintV2Schema,
  ControlSlotIdSchema,
  RequirementSemanticKindV2Schema,
} from "./common-v2.js";
import {
  ObservableAssertionV1Schema,
  ProductActionV1Schema,
  ProductDeliveryV1Schema,
  ProductRequirementV1Schema,
  ProductSpecV1Schema,
  validatePersistenceDeliveryCompatibilityV1,
} from "./product-spec-v1.js";
import { TaskRequirementClauseV1Schema } from "../requirements/task-requirements-v1.js";

export const ProductSurfaceCompositionV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("route_root") }).strict(),
  z.object({
    kind: z.literal("contained"),
    hostSurfaceRef: SurfaceIdSchema,
  }).strict(),
]);

export type ProductSurfaceCompositionV2 = z.infer<typeof ProductSurfaceCompositionV2Schema>;

export const ProductRouteV2Schema = z.object({
  id: RouteIdSchema,
  path: ProductSpecV1Schema.shape.routes.element.shape.path,
  rootSurfaceRef: SurfaceIdSchema,
  surfaceRefs: z.array(SurfaceIdSchema).min(1).max(500).refine(hasUniqueStrings, {
    message: "Route surface refs must be unique",
  }),
  entry: z.boolean(),
}).strict();

export type ProductRouteV2 = z.infer<typeof ProductRouteV2Schema>;

const ProductSurfaceV1Schema = ProductSpecV1Schema.shape.surfaces.element;

export const ProductSurfaceV2Schema = z.object({
  ...ProductSurfaceV1Schema.shape,
  composition: ProductSurfaceCompositionV2Schema,
}).strict();

export type ProductSurfaceV2 = z.infer<typeof ProductSurfaceV2Schema>;

export const ProductControlPlacementV2Schema = z.object({
  id: ControlSlotIdSchema,
  surfaceRef: SurfaceIdSchema,
  controlHint: ControlHintV2Schema,
}).strict();

export type ProductControlPlacementV2 = z.infer<typeof ProductControlPlacementV2Schema>;

export const ObservableSelectorV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("control"),
    controlSlotRef: ControlSlotIdSchema,
  }).strict(),
  z.object({
    kind: z.literal("surface"),
    surfaceRef: SurfaceIdSchema,
  }).strict(),
  z.object({
    kind: z.literal("accessibility"),
    surfaceRef: SurfaceIdSchema,
    role: z.string().min(1).max(100),
    name: z.string().min(1).max(500),
  }).strict(),
]);

export type ObservableSelectorV2 = z.infer<typeof ObservableSelectorV2Schema>;

export const ObservableActionEffectV2Schema = z.object({
  id: ProductActionV1Schema.shape.observableEffects.unwrap().element.shape.id,
  selector: ObservableSelectorV2Schema,
  assertions: z.array(ObservableAssertionV1Schema).min(1).max(100),
  evidenceRef: ProductActionV1Schema.shape.evidenceRefs.element,
}).strict().superRefine((value, context) => {
  if (!value.assertions.some((assertion) => assertion.phase === "after")) {
    context.addIssue({
      code: "custom",
      path: ["assertions"],
      message: "Observable action effects require an after assertion",
    });
  }
  const identities = value.assertions.map((assertion) => `${assertion.phase}\0${assertion.property}`);
  if (!hasUniqueStrings(identities)) {
    context.addIssue({
      code: "custom",
      path: ["assertions"],
      message: "Observable phase/property assertions must be unique",
    });
  }
});

export type ObservableActionEffectV2 = z.infer<typeof ObservableActionEffectV2Schema>;

const {
  surfaceRefs: _surfaceRefs,
  evidenceScenario: ActionEvidenceScenarioV1Schema,
  observableEffects: _observableEffects,
  ...ProductActionStableShape
} = ProductActionV1Schema.shape;

export const ProductActionV2Schema = z.object({
  ...ProductActionStableShape,
  controlPlacements: z.array(ProductControlPlacementV2Schema).max(1_000),
  affectedSurfaceRefs: z.array(SurfaceIdSchema).max(1_000).refine(hasUniqueStrings, {
    message: "Action affected surface refs must be unique",
  }),
  evidenceScenario: z.object({
    ...ActionEvidenceScenarioV1Schema.shape,
    controlSlotRef: ControlSlotIdSchema.optional(),
  }).strict(),
  observableEffects: z.array(ObservableActionEffectV2Schema).min(1).max(500),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.controlPlacements.map((placement) => placement.id))) {
    context.addIssue({
      code: "custom",
      path: ["controlPlacements"],
      message: "PRODUCT_SPEC_CONTROL_SLOT_DUPLICATE: Action control slot refs must be unique",
    });
  }

  const expectedPrefix = `CSLOT_${value.id.slice("ACT_".length)}_`;
  value.controlPlacements.forEach((placement, placementIndex) => {
    if (!placement.id.startsWith(expectedPrefix)) {
      context.addIssue({
        code: "custom",
        path: ["controlPlacements", placementIndex, "id"],
        message: `PRODUCT_SPEC_CONTROL_SLOT_ACTION_MISMATCH: ${placement.id} must begin with ${expectedPrefix}`,
      });
    }
  });

  const evidenceSlot = value.evidenceScenario.controlSlotRef;
  if (value.trigger.kind === "user") {
    if (value.controlPlacements.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["controlPlacements"],
        message: "PRODUCT_SPEC_USER_CONTROL_SLOT_REQUIRED: User actions require at least one explicit control slot",
      });
    }
    if (!evidenceSlot) {
      context.addIssue({
        code: "custom",
        path: ["evidenceScenario", "controlSlotRef"],
        message: "PRODUCT_SPEC_EVIDENCE_CONTROL_SLOT_REQUIRED: User action evidence requires one explicit control slot",
      });
    }
  } else {
    if (value.controlPlacements.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["controlPlacements"],
        message: "PRODUCT_SPEC_NON_USER_CONTROL_SLOT_FORBIDDEN: Non-user actions cannot declare rendered control slots",
      });
    }
    if (evidenceSlot) {
      context.addIssue({
        code: "custom",
        path: ["evidenceScenario", "controlSlotRef"],
        message: "PRODUCT_SPEC_NON_USER_EVIDENCE_CONTROL_FORBIDDEN: Non-user action evidence cannot select a rendered control slot",
      });
    }
  }
  if (evidenceSlot && !value.controlPlacements.some((placement) => placement.id === evidenceSlot)) {
    context.addIssue({
      code: "custom",
      path: ["evidenceScenario", "controlSlotRef"],
      message: `PRODUCT_SPEC_EVIDENCE_CONTROL_SLOT_UNRESOLVED: ${evidenceSlot}`,
    });
  }
});

export type ProductActionV2 = z.infer<typeof ProductActionV2Schema>;

export const ProductRequirementV2Schema = z.object({
  ...ProductRequirementV1Schema.shape,
  expectedSemanticKinds: z.array(RequirementSemanticKindV2Schema).min(1).max(11).refine(hasUniqueStrings, {
    message: "Requirement expected semantic kinds must be unique",
  }),
}).strict();

export type ProductRequirementV2 = z.infer<typeof ProductRequirementV2Schema>;

export const RequirementBindingV2Schema = z.object({
  semanticKind: RequirementSemanticKindV2Schema,
  semanticRef: z.string().min(1).max(160),
  requirementRefs: z.array(RequirementIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Requirement binding refs must be unique",
  }),
}).strict();

export type RequirementBindingV2 = z.infer<typeof RequirementBindingV2Schema>;

export const ProductRequirementTraceabilityV2Schema = z.object({
  schema: z.literal("setfarm.product-requirement-traceability.v2"),
  sourceTaskHash: Sha256Schema,
  bindings: z.array(RequirementBindingV2Schema).min(1).max(20_000),
}).strict();

export type ProductRequirementTraceabilityV2 = z.infer<typeof ProductRequirementTraceabilityV2Schema>;

function addDuplicateIssue(
  context: z.RefinementCtx,
  path: PropertyKey,
  label: string,
  values: readonly string[],
): void {
  if (!hasUniqueStrings(values)) {
    context.addIssue({ code: "custom", path: [path], message: `${label} must be unique` });
  }
}

/**
 * Product semantics v2 authority. Physical controls are declared only by
 * control slots; affected surfaces never imply a rendered control.
 */
export const ProductSpecV2Schema = z.object({
  schema: z.literal("setfarm.product-spec.v2"),
  product: ProductSpecV1Schema.shape.product,
  entities: ProductSpecV1Schema.shape.entities,
  states: ProductSpecV1Schema.shape.states,
  persistencePolicies: ProductSpecV1Schema.shape.persistencePolicies,
  routes: z.array(ProductRouteV2Schema).min(1).max(500),
  surfaces: z.array(ProductSurfaceV2Schema).min(1).max(1_000),
  actions: z.array(ProductActionV2Schema).min(1).max(2_000),
  evidencePredicates: ProductSpecV1Schema.shape.evidencePredicates,
  assumptions: ProductSpecV1Schema.shape.assumptions,
  delivery: ProductDeliveryV1Schema,
  requirements: z.array(ProductRequirementV2Schema).min(1).max(1_000),
  traceability: ProductRequirementTraceabilityV2Schema,
}).strict().superRefine((value, context) => {
  addDuplicateIssue(context, "product", "Goal IDs", value.product.goals.map((item) => item.id));
  addDuplicateIssue(context, "product", "Non-goal IDs", value.product.nonGoals.map((item) => item.id));
  addDuplicateIssue(context, "entities", "Entity IDs", value.entities.map((item) => item.id));
  addDuplicateIssue(context, "states", "State IDs", value.states.map((item) => item.id));
  addDuplicateIssue(context, "persistencePolicies", "Persistence IDs", value.persistencePolicies.map((item) => item.id));
  addDuplicateIssue(context, "routes", "Route IDs", value.routes.map((item) => item.id));
  addDuplicateIssue(context, "routes", "Route paths", value.routes.map((item) => item.path));
  addDuplicateIssue(context, "surfaces", "Surface IDs", value.surfaces.map((item) => item.id));
  addDuplicateIssue(context, "actions", "Action IDs", value.actions.map((item) => item.id));
  addDuplicateIssue(context, "evidencePredicates", "Evidence IDs", value.evidencePredicates.map((item) => item.id));
  addDuplicateIssue(context, "assumptions", "Assumption IDs", value.assumptions.map((item) => item.id));
  addDuplicateIssue(
    context,
    "actions",
    "Observable effect IDs",
    value.actions.flatMap((action) => action.observableEffects.map((effect) => effect.id)),
  );
  addDuplicateIssue(
    context,
    "actions",
    "Control slot IDs",
    value.actions.flatMap((action) => action.controlPlacements.map((placement) => placement.id)),
  );

  const routeById = new Map(value.routes.map((route) => [route.id, route] as const));
  const surfaceById = new Map(value.surfaces.map((surface) => [surface.id, surface] as const));
  const slotOwnerById = new Map(value.actions.flatMap((action) =>
    action.controlPlacements.map((placement) => [placement.id, action.id] as const)));

  value.surfaces.forEach((surface, surfaceIndex) => {
    if (!routeById.has(surface.routeRef)) {
      context.addIssue({
        code: "custom",
        path: ["surfaces", surfaceIndex, "routeRef"],
        message: `PRODUCT_SPEC_SURFACE_ROUTE_UNRESOLVED: ${surface.routeRef}`,
      });
    }
    if (surface.composition.kind !== "contained") return;
    const host = surfaceById.get(surface.composition.hostSurfaceRef);
    if (!host) {
      context.addIssue({
        code: "custom",
        path: ["surfaces", surfaceIndex, "composition", "hostSurfaceRef"],
        message: `PRODUCT_SPEC_SURFACE_HOST_UNRESOLVED: ${surface.composition.hostSurfaceRef}`,
      });
      return;
    }
    if (host.routeRef !== surface.routeRef) {
      context.addIssue({
        code: "custom",
        path: ["surfaces", surfaceIndex, "composition", "hostSurfaceRef"],
        message: `PRODUCT_SPEC_SURFACE_HOST_CROSS_ROUTE: ${surface.id} belongs to ${surface.routeRef}, but its host belongs to ${host.routeRef}`,
      });
    }
  });

  value.routes.forEach((route, routeIndex) => {
    const routeSurfaces = value.surfaces.filter((surface) => surface.routeRef === route.id);
    const expectedSurfaceRefs = new Set(routeSurfaces.map((surface) => surface.id));
    if (
      route.surfaceRefs.length !== expectedSurfaceRefs.size
      || route.surfaceRefs.some((surfaceRef) => !expectedSurfaceRefs.has(surfaceRef))
    ) {
      context.addIssue({
        code: "custom",
        path: ["routes", routeIndex, "surfaceRefs"],
        message: `PRODUCT_SPEC_ROUTE_SURFACE_INDEX_MISMATCH: Route ${route.id} surfaceRefs must exactly index its ProductSpec surfaces`,
      });
    }
    const routeRoots = routeSurfaces.filter((surface) => surface.composition.kind === "route_root");
    if (routeRoots.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["routes", routeIndex, "rootSurfaceRef"],
        message: `PRODUCT_SPEC_ROUTE_ROOT_CARDINALITY: Route ${route.id} requires exactly one route-root surface, found ${routeRoots.length}`,
      });
    }
    const root = surfaceById.get(route.rootSurfaceRef);
    if (!root || root.routeRef !== route.id || root.composition.kind !== "route_root") {
      context.addIssue({
        code: "custom",
        path: ["routes", routeIndex, "rootSurfaceRef"],
        message: `PRODUCT_SPEC_ROUTE_ROOT_MISMATCH: ${route.rootSurfaceRef} is not the route-root surface for ${route.id}`,
      });
    }
  });

  value.surfaces.forEach((surface, surfaceIndex) => {
    const seen = new Set<string>([surface.id]);
    let cursor = surface;
    while (cursor.composition.kind === "contained") {
      const host = surfaceById.get(cursor.composition.hostSurfaceRef);
      if (!host || host.routeRef !== surface.routeRef) break;
      if (seen.has(host.id)) {
        context.addIssue({
          code: "custom",
          path: ["surfaces", surfaceIndex, "composition"],
          message: `PRODUCT_SPEC_SURFACE_CONTAINMENT_CYCLE: ${surface.id}`,
        });
        break;
      }
      seen.add(host.id);
      cursor = host;
    }
  });

  value.actions.forEach((action, actionIndex) => {
    const scopedSurfaceRefs = new Set<string>(action.affectedSurfaceRefs);
    const ownedSlotRefs = new Set(action.controlPlacements.map((placement) => placement.id));

    action.controlPlacements.forEach((placement, placementIndex) => {
      scopedSurfaceRefs.add(placement.surfaceRef);
      if (!surfaceById.has(placement.surfaceRef)) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "controlPlacements", placementIndex, "surfaceRef"],
          message: `PRODUCT_SPEC_CONTROL_SLOT_SURFACE_UNRESOLVED: ${placement.surfaceRef}`,
        });
      }
    });
    action.affectedSurfaceRefs.forEach((surfaceRef, surfaceIndex) => {
      if (!surfaceById.has(surfaceRef)) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "affectedSurfaceRefs", surfaceIndex],
          message: `PRODUCT_SPEC_AFFECTED_SURFACE_UNRESOLVED: ${surfaceRef}`,
        });
      }
    });

    action.observableEffects.forEach((effect, effectIndex) => {
      const selector = effect.selector;
      if (selector.kind === "control") {
        if (!ownedSlotRefs.has(selector.controlSlotRef)) {
          const owner = slotOwnerById.get(selector.controlSlotRef);
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "observableEffects", effectIndex, "selector", "controlSlotRef"],
            message: owner
              ? `PRODUCT_SPEC_OBSERVABLE_CONTROL_SLOT_WRONG_OWNER: ${selector.controlSlotRef} belongs to ${owner}`
              : `PRODUCT_SPEC_OBSERVABLE_CONTROL_SLOT_UNRESOLVED: ${selector.controlSlotRef}`,
          });
        }
        return;
      }
      if (!surfaceById.has(selector.surfaceRef)) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "observableEffects", effectIndex, "selector", "surfaceRef"],
          message: `PRODUCT_SPEC_OBSERVABLE_SURFACE_UNRESOLVED: ${selector.surfaceRef}`,
        });
      } else if (!scopedSurfaceRefs.has(selector.surfaceRef)) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "observableEffects", effectIndex, "selector", "surfaceRef"],
          message: `PRODUCT_SPEC_OBSERVABLE_SURFACE_OUTSIDE_ACTION_SCOPE: ${selector.surfaceRef}`,
        });
      }
    });
  });

  const v1Compatibility = ProductSpecV1Schema.safeParse({
    schema: "setfarm.product-spec.v1",
    product: value.product,
    entities: value.entities,
    states: value.states,
    persistencePolicies: value.persistencePolicies,
    routes: value.routes.map(({ rootSurfaceRef: _rootSurfaceRef, ...route }) => route),
    surfaces: value.surfaces.map(({ composition: _composition, ...surface }) => surface),
    actions: value.actions.map((action) => {
      const {
        controlPlacements,
        affectedSurfaceRefs,
        evidenceScenario,
        observableEffects,
        ...stableAction
      } = action;
      const { controlSlotRef: _controlSlotRef, ...stableEvidenceScenario } = evidenceScenario;
      return {
        ...stableAction,
        surfaceRefs: [...new Set([
          ...controlPlacements.map((placement) => placement.surfaceRef),
          ...affectedSurfaceRefs,
        ])],
        evidenceScenario: stableEvidenceScenario,
        observableEffects: observableEffects.map((effect) => ({
          ...effect,
          selector: effect.selector.kind === "control"
            ? { kind: "control" as const, actionRef: action.id }
            : effect.selector,
        })),
      };
    }),
    evidencePredicates: value.evidencePredicates,
    assumptions: value.assumptions,
  });
  if (!v1Compatibility.success) {
    v1Compatibility.error.issues.forEach((issue) => context.addIssue({
      code: "custom",
      path: issue.path,
      message: `PRODUCT_SPEC_V2_BASE_CONTRACT_INVALID: ${issue.message}`,
    }));
  }

  validatePersistenceDeliveryCompatibilityV1({
    delivery: value.delivery,
    policies: value.persistencePolicies,
  }).forEach((issue) => context.addIssue({
    code: "custom",
    path: [...issue.path],
    message: `${issue.code}: ${issue.message}`,
  }));

  const requirementIds = new Set(value.requirements.map((requirement) => requirement.id));
  if (requirementIds.size !== value.requirements.length) {
    context.addIssue({ code: "custom", path: ["requirements"], message: "Product requirement IDs must be unique" });
  }
  value.requirements.forEach((requirement, requirementIndex) => {
    const sourceClause = TaskRequirementClauseV1Schema.safeParse({
      id: requirement.id,
      normalizedClause: requirement.normalizedClause,
      clauseHash: requirement.clauseHash,
      sources: requirement.sources,
    });
    if (!sourceClause.success) {
      context.addIssue({
        code: "custom",
        path: ["requirements", requirementIndex],
        message: `Requirement source identity is invalid: ${sourceClause.error.issues[0]?.message || "schema mismatch"}`,
      });
    }
    requirement.sources.forEach((source, sourceIndex) => {
      if (source.sourceHash !== value.traceability.sourceTaskHash) {
        context.addIssue({
          code: "custom",
          path: ["requirements", requirementIndex, "sources", sourceIndex, "sourceHash"],
          message: "Requirement source hash must match traceability sourceTaskHash",
        });
      }
    });
  });

  const semanticRefs: Array<{
    semanticKind: z.infer<typeof RequirementSemanticKindV2Schema>;
    semanticRef: string;
  }> = [
    ...value.product.goals.map((item) => ({ semanticKind: "goal" as const, semanticRef: item.id })),
    ...value.product.nonGoals.map((item) => ({ semanticKind: "non_goal" as const, semanticRef: item.id })),
    ...value.entities.map((item) => ({ semanticKind: "entity" as const, semanticRef: item.id })),
    ...value.states.map((item) => ({ semanticKind: "state" as const, semanticRef: item.id })),
    ...value.persistencePolicies.map((item) => ({ semanticKind: "persistence" as const, semanticRef: item.id })),
    ...value.routes.map((item) => ({ semanticKind: "route" as const, semanticRef: item.id })),
    ...value.surfaces.map((item) => ({ semanticKind: "surface" as const, semanticRef: item.id })),
    ...value.actions.map((item) => ({ semanticKind: "action" as const, semanticRef: item.id })),
    ...value.actions.flatMap((action) => action.controlPlacements.map((placement) => ({
      semanticKind: "control_placement" as const,
      semanticRef: placement.id,
    }))),
    ...value.evidencePredicates.map((item) => ({ semanticKind: "evidence" as const, semanticRef: item.id })),
    ...value.actions.flatMap((action) => action.observableEffects.map((item) => ({
      semanticKind: "observable" as const,
      semanticRef: item.id,
    }))),
  ];
  const expectedBindings = new Set(semanticRefs.map((entry) => `${entry.semanticKind}\0${entry.semanticRef}`));
  const observedBindingKeys = value.traceability.bindings.map((binding) =>
    `${binding.semanticKind}\0${binding.semanticRef}`);
  if (!hasUniqueStrings(observedBindingKeys)) {
    context.addIssue({
      code: "custom",
      path: ["traceability", "bindings"],
      message: "Semantic requirement bindings must be unique",
    });
  }
  value.traceability.bindings.forEach((binding, bindingIndex) => {
    const bindingKey = `${binding.semanticKind}\0${binding.semanticRef}`;
    if (!expectedBindings.has(bindingKey)) {
      context.addIssue({
        code: "custom",
        path: ["traceability", "bindings", bindingIndex, "semanticRef"],
        message: `Traceability binding does not name an exact ProductSpec semantic artifact: ${binding.semanticRef}`,
      });
    }
    binding.requirementRefs.forEach((requirementRef, requirementIndex) => {
      if (!requirementIds.has(requirementRef)) {
        context.addIssue({
          code: "custom",
          path: ["traceability", "bindings", bindingIndex, "requirementRefs", requirementIndex],
          message: `Unresolved requirement ref: ${requirementRef}`,
        });
      }
    });
  });
  semanticRefs.forEach((semantic) => {
    const bindingKey = `${semantic.semanticKind}\0${semantic.semanticRef}`;
    if (!observedBindingKeys.includes(bindingKey)) {
      context.addIssue({
        code: "custom",
        path: ["traceability", "bindings"],
        message: `ProductSpec semantic artifact has no requirement binding: ${semantic.semanticKind}:${semantic.semanticRef}`,
      });
    }
  });
  value.requirements.forEach((requirement, requirementIndex) => {
    const bindings = value.traceability.bindings.filter((binding) =>
      binding.requirementRefs.includes(requirement.id));
    if (bindings.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["requirements", requirementIndex],
        message: `Requirement has no semantic coverage: ${requirement.id}`,
      });
    }
    requirement.expectedSemanticKinds.forEach((kind, kindIndex) => {
      if (!bindings.some((binding) => binding.semanticKind === kind)) {
        context.addIssue({
          code: "custom",
          path: ["requirements", requirementIndex, "expectedSemanticKinds", kindIndex],
          message: `Requirement ${requirement.id} has no declared ${kind} semantic artifact`,
        });
      }
    });
    if (requirement.classification === "non_goal" && !bindings.some((binding) => binding.semanticKind === "non_goal")) {
      context.addIssue({
        code: "custom",
        path: ["requirements", requirementIndex, "classification"],
        message: "Non-goal requirements must bind an explicit ProductSpec non-goal",
      });
    }
  });
});

export type ProductSpecV2 = z.infer<typeof ProductSpecV2Schema>;
