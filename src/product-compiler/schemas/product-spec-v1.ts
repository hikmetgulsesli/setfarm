import { z } from "zod";

import {
  ActionIdSchema,
  AssumptionIdSchema,
  CapabilityIdSchema,
  EntityFieldIdSchema,
  EntityIdSchema,
  EvidenceIdSchema,
  GoalIdSchema,
  NonGoalIdSchema,
  PersistenceIdSchema,
  ProductIdSchema,
  ProductRoutePathSchema,
  ProvenanceRefV1Schema,
  RouteIdSchema,
  StateIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";

const ValueTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "enum",
  "object",
  "array",
]);

const GoalV1Schema = z
  .object({
    id: GoalIdSchema,
    statement: z.string().min(1).max(2_000),
  })
  .strict();

const NonGoalV1Schema = z
  .object({
    id: NonGoalIdSchema,
    statement: z.string().min(1).max(2_000),
  })
  .strict();

const ProductIdentityV1Schema = z
  .object({
    id: ProductIdSchema,
    name: z.string().min(1).max(200),
    class: z.enum([
      "utility",
      "operations",
      "game",
      "content",
      "commerce",
      "developer_tool",
      "service",
      "other",
    ]),
    goals: z.array(GoalV1Schema).min(1).max(200),
    nonGoals: z.array(NonGoalV1Schema).max(200),
  })
  .strict();

export const EntityFieldV1Schema = z
  .object({
    id: EntityFieldIdSchema,
    name: z.string().min(1).max(160).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    valueType: ValueTypeSchema,
    required: z.boolean(),
    enumValues: z.array(z.string().min(1).max(500)).min(1).max(500).optional(),
    defaultValue: z.json().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.valueType === "enum" && !value.enumValues) {
      context.addIssue({
        code: "custom",
        path: ["enumValues"],
        message: "Enum fields require enumValues",
      });
    }
    if (value.valueType !== "enum" && value.enumValues) {
      context.addIssue({
        code: "custom",
        path: ["enumValues"],
        message: "enumValues are allowed only for enum fields",
      });
    }
  });

export type EntityFieldV1 = z.infer<typeof EntityFieldV1Schema>;

export const ProductEntityV1Schema = z
  .object({
    id: EntityIdSchema,
    name: z.string().min(1).max(200),
    fields: z.array(EntityFieldV1Schema).min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.fields.map((field) => field.id);
    const names = value.fields.map((field) => field.name);
    if (!hasUniqueStrings(ids)) {
      context.addIssue({ code: "custom", path: ["fields"], message: "Entity field IDs must be unique" });
    }
    if (!hasUniqueStrings(names)) {
      context.addIssue({ code: "custom", path: ["fields"], message: "Entity field names must be unique" });
    }
  });

export type ProductEntityV1 = z.infer<typeof ProductEntityV1Schema>;

export const ProductStateV1Schema = z
  .object({
    id: StateIdSchema,
    name: z.string().min(1).max(200),
    kind: z.enum(["application", "domain", "ui", "session"]),
    initialValue: z.json(),
    invariants: z.array(z.string().min(1).max(2_000)).max(200),
  })
  .strict();

export type ProductStateV1 = z.infer<typeof ProductStateV1Schema>;

export const PersistencePolicyV1Schema = z
  .object({
    id: PersistenceIdSchema,
    kind: z.enum([
      "none",
      "memory",
      "local_storage",
      "database",
      "file",
      "remote_api",
    ]),
    owner: z.enum(["application", "user", "server", "external"]),
    entityRefs: z.array(EntityIdSchema).max(500).refine(hasUniqueStrings, {
      message: "Persistence entity refs must be unique",
    }),
    durability: z.enum(["none", "session", "reload", "restart", "durable"]),
    key: z.string().min(1).max(500).optional(),
  })
  .strict();

export type PersistencePolicyV1 = z.infer<typeof PersistencePolicyV1Schema>;

export const ProductRouteV1Schema = z
  .object({
    id: RouteIdSchema,
    path: ProductRoutePathSchema,
    surfaceRefs: z.array(SurfaceIdSchema).min(1).max(500).refine(hasUniqueStrings, {
      message: "Route surface refs must be unique",
    }),
    entry: z.boolean(),
  })
  .strict();

export type ProductRouteV1 = z.infer<typeof ProductRouteV1Schema>;

export const ProductSurfaceV1Schema = z
  .object({
    id: SurfaceIdSchema,
    name: z.string().min(1).max(200),
    kind: z.enum(["page", "panel", "dialog", "overlay", "canvas", "terminal", "api"]),
    routeRef: RouteIdSchema,
    required: z.boolean(),
  })
  .strict();

export type ProductSurfaceV1 = z.infer<typeof ProductSurfaceV1Schema>;

export const ActionInputFieldV1Schema = z
  .object({
    name: z.string().min(1).max(160).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    valueType: ValueTypeSchema,
    required: z.boolean(),
    entityFieldRef: EntityFieldIdSchema.optional(),
  })
  .strict();

const ActionInputV1Schema = z
  .object({
    fields: z.array(ActionInputFieldV1Schema).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.fields.map((field) => field.name))) {
      context.addIssue({ code: "custom", path: ["fields"], message: "Action input names must be unique" });
    }
  });

const ActionTriggerV1Schema = z
  .object({
    kind: z.enum(["user", "system", "timer", "route"]),
    sourceRef: z.string().min(1).max(160).optional(),
  })
  .strict();

const ActionPreconditionV1Schema = z
  .object({
    stateRef: StateIdSchema,
    path: z.string().max(500).refine((value) => value === "" || value.startsWith("/")),
    operator: z.enum(["equals", "not_equals", "exists", "not_exists", "truthy", "falsy"]),
    expected: z.json().optional(),
  })
  .strict();

export const ActionValueSourceV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("input"), field: z.string().min(1).max(160) }).strict(),
  z.object({
    kind: z.literal("state"),
    stateRef: StateIdSchema,
    path: z.string().max(500).refine((value) => value === "" || value.startsWith("/")),
  }).strict(),
  z.object({
    kind: z.literal("entity_field"),
    entityRef: EntityIdSchema,
    fieldRef: EntityFieldIdSchema,
  }).strict(),
  z.object({ kind: z.literal("literal"), value: z.json() }).strict(),
]);

export type ActionValueSourceV1 = z.infer<typeof ActionValueSourceV1Schema>;

const ActionStateDeltaV1Schema = z
  .object({
    stateRef: StateIdSchema,
    operation: z.enum(["set", "merge", "append", "remove", "clear"]),
    path: z.string().max(500).refine((value) => value === "" || value.startsWith("/")),
    valueFrom: ActionValueSourceV1Schema,
  })
  .strict();

const ActionNavigationV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stay") }).strict(),
  z.object({ kind: z.literal("route"), routeRef: RouteIdSchema }).strict(),
  z.object({ kind: z.literal("back") }).strict(),
  z.object({ kind: z.literal("external"), url: z.url() }).strict(),
]);

const PersistenceEffectV1Schema = z
  .object({
    policyRef: PersistenceIdSchema,
    operation: z.enum(["read", "write", "update", "delete", "clear"]),
    entityRef: EntityIdSchema.optional(),
    payloadFields: z.array(z.string().min(1).max(160)).max(500).refine(hasUniqueStrings, {
      message: "Persistence payload fields must be unique",
    }),
  })
  .strict();

const ActionOutcomeV1Schema = z
  .object({
    stateRefs: z.array(StateIdSchema).max(500).refine(hasUniqueStrings, {
      message: "Outcome state refs must be unique",
    }),
    persistenceRefs: z.array(PersistenceIdSchema).max(500).refine(hasUniqueStrings, {
      message: "Outcome persistence refs must be unique",
    }).optional(),
    evidenceRefs: z.array(EvidenceIdSchema).max(500).refine(hasUniqueStrings, {
      message: "Outcome evidence refs must be unique",
    }),
    userVisible: z.boolean().optional(),
  })
  .strict();

export const ProductActionV1Schema = z
  .object({
    id: ActionIdSchema,
    name: z.string().min(1).max(200),
    surfaceRefs: z.array(SurfaceIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Action surface refs must be unique",
    }),
    trigger: ActionTriggerV1Schema,
    input: ActionInputV1Schema,
    preconditions: z.array(ActionPreconditionV1Schema).max(500),
    stateDeltas: z.array(ActionStateDeltaV1Schema).max(500),
    navigation: ActionNavigationV1Schema,
    persistenceEffects: z.array(PersistenceEffectV1Schema).max(500),
    success: ActionOutcomeV1Schema,
    failure: ActionOutcomeV1Schema,
    evidenceRefs: z.array(EvidenceIdSchema).min(1).max(500).refine(hasUniqueStrings, {
      message: "Action evidence refs must be unique",
    }),
  })
  .strict();

export type ProductActionV1 = z.infer<typeof ProductActionV1Schema>;

export const EvidencePredicateV1Schema = z
  .object({
    id: EvidenceIdSchema,
    kind: z.enum([
      "control_visible",
      "control_action",
      "state_transition",
      "persistence_round_trip",
      "navigation",
      "download",
      "runtime",
      "build",
      "test",
      "visual",
    ]),
    required: z.boolean(),
    subjectRef: z.string().min(1).max(160),
    capabilityRefs: z.array(CapabilityIdSchema).max(500).refine(hasUniqueStrings, {
      message: "Evidence capability refs must be unique",
    }),
    assertion: z.object({
      operator: z.enum(["equals", "not_equals", "exists", "not_exists", "passes", "matches"]),
      expected: z.json().optional(),
    }).strict(),
  })
  .strict();

export type EvidencePredicateV1 = z.infer<typeof EvidencePredicateV1Schema>;

const ProductAssumptionV1Schema = z
  .object({
    id: AssumptionIdSchema,
    statement: z.string().min(1).max(2_000),
    provenance: z.array(ProvenanceRefV1Schema).min(1).max(100),
  })
  .strict();

function duplicateIssue(
  context: z.RefinementCtx,
  path: PropertyKey,
  label: string,
  values: readonly string[],
): void {
  if (!hasUniqueStrings(values)) {
    context.addIssue({ code: "custom", path: [path], message: `${label} must be unique` });
  }
}

export const ProductSpecV1Schema = z
  .object({
    schema: z.literal("setfarm.product-spec.v1"),
    product: ProductIdentityV1Schema,
    entities: z.array(ProductEntityV1Schema).max(500),
    states: z.array(ProductStateV1Schema).min(1).max(500),
    persistencePolicies: z.array(PersistencePolicyV1Schema).max(500),
    routes: z.array(ProductRouteV1Schema).min(1).max(500),
    surfaces: z.array(ProductSurfaceV1Schema).min(1).max(1_000),
    actions: z.array(ProductActionV1Schema).min(1).max(2_000),
    evidencePredicates: z.array(EvidencePredicateV1Schema).min(1).max(2_000),
    assumptions: z.array(ProductAssumptionV1Schema).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    duplicateIssue(context, "product", "Goal IDs", value.product.goals.map((item) => item.id));
    duplicateIssue(context, "product", "Non-goal IDs", value.product.nonGoals.map((item) => item.id));
    duplicateIssue(context, "entities", "Entity IDs", value.entities.map((item) => item.id));
    duplicateIssue(context, "states", "State IDs", value.states.map((item) => item.id));
    duplicateIssue(
      context,
      "persistencePolicies",
      "Persistence IDs",
      value.persistencePolicies.map((item) => item.id),
    );
    duplicateIssue(context, "routes", "Route IDs", value.routes.map((item) => item.id));
    duplicateIssue(context, "routes", "Route paths", value.routes.map((item) => item.path));
    duplicateIssue(context, "surfaces", "Surface IDs", value.surfaces.map((item) => item.id));
    duplicateIssue(context, "actions", "Action IDs", value.actions.map((item) => item.id));
    duplicateIssue(
      context,
      "evidencePredicates",
      "Evidence IDs",
      value.evidencePredicates.map((item) => item.id),
    );
    duplicateIssue(
      context,
      "assumptions",
      "Assumption IDs",
      value.assumptions.map((item) => item.id),
    );

    const entityIds = new Set(value.entities.map((item) => item.id));
    const fieldIds = new Set(value.entities.flatMap((item) => item.fields.map((field) => field.id)));
    if (fieldIds.size !== value.entities.reduce((total, entity) => total + entity.fields.length, 0)) {
      context.addIssue({ code: "custom", path: ["entities"], message: "Entity field IDs must be globally unique" });
    }
    const stateIds = new Set(value.states.map((item) => item.id));
    const persistenceIds = new Set(value.persistencePolicies.map((item) => item.id));
    const routeIds = new Set(value.routes.map((item) => item.id));
    const surfaceIds = new Set(value.surfaces.map((item) => item.id));
    const actionIds = new Set(value.actions.map((item) => item.id));
    const evidenceIds = new Set(value.evidencePredicates.map((item) => item.id));

    const requireRef = (
      exists: Set<string>,
      reference: string,
      path: PropertyKey[],
      label: string,
    ) => {
      if (!exists.has(reference)) {
        context.addIssue({ code: "custom", path, message: `Unresolved ${label}: ${reference}` });
      }
    };

    value.persistencePolicies.forEach((policy, policyIndex) => {
      policy.entityRefs.forEach((ref, refIndex) => {
        requireRef(entityIds, ref, ["persistencePolicies", policyIndex, "entityRefs", refIndex], "entity ref");
      });
    });
    value.surfaces.forEach((surface, index) => {
      requireRef(routeIds, surface.routeRef, ["surfaces", index, "routeRef"], "route ref");
    });
    value.routes.forEach((route, routeIndex) => {
      route.surfaceRefs.forEach((ref, refIndex) => {
        requireRef(surfaceIds, ref, ["routes", routeIndex, "surfaceRefs", refIndex], "surface ref");
        const surface = value.surfaces.find((item) => item.id === ref);
        if (surface && surface.routeRef !== route.id) {
          context.addIssue({
            code: "custom",
            path: ["routes", routeIndex, "surfaceRefs", refIndex],
            message: `Surface ${ref} belongs to ${surface.routeRef}, not ${route.id}`,
          });
        }
      });
    });

    value.actions.forEach((action, actionIndex) => {
      const inputFields = new Set(action.input.fields.map((field) => field.name));
      action.surfaceRefs.forEach((surfaceRef, surfaceIndex) => {
        requireRef(
          surfaceIds,
          surfaceRef,
          ["actions", actionIndex, "surfaceRefs", surfaceIndex],
          "surface ref",
        );
      });
      action.input.fields.forEach((field, fieldIndex) => {
        if (field.entityFieldRef) {
          requireRef(fieldIds, field.entityFieldRef, ["actions", actionIndex, "input", "fields", fieldIndex, "entityFieldRef"], "entity field ref");
        }
      });
      action.preconditions.forEach((condition, index) => {
        requireRef(stateIds, condition.stateRef, ["actions", actionIndex, "preconditions", index, "stateRef"], "state ref");
      });
      action.stateDeltas.forEach((delta, index) => {
        requireRef(stateIds, delta.stateRef, ["actions", actionIndex, "stateDeltas", index, "stateRef"], "state ref");
        if (delta.valueFrom.kind === "input" && !inputFields.has(delta.valueFrom.field)) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "stateDeltas", index, "valueFrom", "field"],
            message: `Unresolved action input field: ${delta.valueFrom.field}`,
          });
        }
        if (delta.valueFrom.kind === "state") {
          requireRef(stateIds, delta.valueFrom.stateRef, ["actions", actionIndex, "stateDeltas", index, "valueFrom", "stateRef"], "state ref");
        }
        if (delta.valueFrom.kind === "entity_field") {
          requireRef(entityIds, delta.valueFrom.entityRef, ["actions", actionIndex, "stateDeltas", index, "valueFrom", "entityRef"], "entity ref");
          requireRef(fieldIds, delta.valueFrom.fieldRef, ["actions", actionIndex, "stateDeltas", index, "valueFrom", "fieldRef"], "entity field ref");
        }
      });
      if (action.navigation.kind === "route") {
        requireRef(routeIds, action.navigation.routeRef, ["actions", actionIndex, "navigation", "routeRef"], "route ref");
      }
      action.persistenceEffects.forEach((effect, index) => {
        requireRef(persistenceIds, effect.policyRef, ["actions", actionIndex, "persistenceEffects", index, "policyRef"], "persistence ref");
        if (effect.entityRef) {
          requireRef(entityIds, effect.entityRef, ["actions", actionIndex, "persistenceEffects", index, "entityRef"], "entity ref");
        }
        effect.payloadFields.forEach((field, fieldIndex) => {
          if (!inputFields.has(field)) {
            context.addIssue({
              code: "custom",
              path: ["actions", actionIndex, "persistenceEffects", index, "payloadFields", fieldIndex],
              message: `Unresolved action input field: ${field}`,
            });
          }
        });
      });
      for (const [outcomeName, outcome] of [["success", action.success], ["failure", action.failure]] as const) {
        outcome.stateRefs.forEach((ref, index) => {
          requireRef(stateIds, ref, ["actions", actionIndex, outcomeName, "stateRefs", index], "state ref");
        });
        outcome.persistenceRefs?.forEach((ref, index) => {
          requireRef(persistenceIds, ref, ["actions", actionIndex, outcomeName, "persistenceRefs", index], "persistence ref");
        });
        outcome.evidenceRefs.forEach((ref, index) => {
          requireRef(evidenceIds, ref, ["actions", actionIndex, outcomeName, "evidenceRefs", index], "evidence ref");
        });
      }
      action.evidenceRefs.forEach((ref, index) => {
        requireRef(evidenceIds, ref, ["actions", actionIndex, "evidenceRefs", index], "evidence ref");
      });
    });

    const evidenceSubjects = new Set<string>([
      ...actionIds,
      ...routeIds,
      ...surfaceIds,
      ...stateIds,
      ...persistenceIds,
      ...entityIds,
    ]);
    value.evidencePredicates.forEach((predicate, index) => {
      requireRef(evidenceSubjects, predicate.subjectRef, ["evidencePredicates", index, "subjectRef"], "evidence subject");
    });
  });

export type ProductSpecV1 = z.infer<typeof ProductSpecV1Schema>;
