import { z } from "zod";

import {
  RequirementIdSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";
import { RequirementSemanticKindV1Schema } from "./product-spec-v1.js";

export const PlanSemanticKeyV1Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/, "Expected a lowercase semantic key");

const RequirementRefsSchema = z.array(RequirementIdSchema)
  .min(1)
  .max(1_000)
  .refine(hasUniqueStrings, { message: "Semantic requirement refs must be unique" });

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

const JsonPointerPathSchema = z.string().max(500).refine(
  (value) => /^(?:\/(?:[^~]|~[01])*)*$/.test(value),
  "Expected an empty or RFC 6901 JSON Pointer",
);

const GoalSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  statement: z.string().min(1).max(2_000),
  requirementRefs: RequirementRefsSchema,
}).strict();

const NonGoalSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  statement: z.string().min(1).max(2_000),
  requirementRefs: RequirementRefsSchema,
}).strict();

const EntityFieldSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  name: z.string().min(1).max(160).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  valueType: ValueTypeSchema,
  required: z.boolean(),
  enumValues: z.array(z.string().min(1).max(500)).min(1).max(500).optional(),
  defaultValue: z.json().optional(),
}).strict().superRefine((value, context) => {
  if (value.valueType === "enum" && !value.enumValues) {
    context.addIssue({ code: "custom", path: ["enumValues"], message: "Enum fields require enumValues" });
  }
  if (value.valueType !== "enum" && value.enumValues) {
    context.addIssue({ code: "custom", path: ["enumValues"], message: "enumValues are valid only for enum fields" });
  }
});

const EntitySchema = z.object({
  key: PlanSemanticKeyV1Schema,
  name: z.string().min(1).max(200),
  fields: z.array(EntityFieldSchema).min(1).max(500),
  requirementRefs: RequirementRefsSchema,
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.fields.map((field) => field.key))) {
    context.addIssue({ code: "custom", path: ["fields"], message: "Entity field keys must be unique" });
  }
  if (!hasUniqueStrings(value.fields.map((field) => field.name))) {
    context.addIssue({ code: "custom", path: ["fields"], message: "Entity field names must be unique" });
  }
});

const StateSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  name: z.string().min(1).max(200),
  kind: z.enum(["application", "domain", "ui", "session"]),
  initialValue: z.json(),
  invariants: z.array(z.string().min(1).max(2_000)).max(200),
  requirementRefs: RequirementRefsSchema,
}).strict();

const PersistenceSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  kind: z.enum(["none", "memory", "local_storage", "database", "file", "remote_api"]),
  entityKeys: z.array(PlanSemanticKeyV1Schema).max(500).refine(hasUniqueStrings, {
    message: "Persistence entity keys must be unique",
  }),
  rehydration: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("initialization") }).strict(),
    z.object({ kind: z.literal("action"), actionKey: PlanSemanticKeyV1Schema }).strict(),
  ]).optional(),
  requirementRefs: RequirementRefsSchema,
}).strict().superRefine((value, context) => {
  const durable = ["local_storage", "database", "file", "remote_api"].includes(value.kind);
  if (durable && !value.rehydration) {
    context.addIssue({
      code: "custom",
      path: ["rehydration"],
      message: "Durable semantic persistence requires initialization or action rehydration",
    });
  }
  if (!durable && value.rehydration) {
    context.addIssue({
      code: "custom",
      path: ["rehydration"],
      message: "Non-durable semantic persistence cannot propose rehydration",
    });
  }
});

const RouteSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  path: z.string().min(1).max(500).refine((value) => value.startsWith("/"), "Route paths must start with /")
    .refine((value) => !value.includes("\\") && !value.includes("\0"), "Route paths cannot contain backslashes or NUL"),
  entry: z.boolean(),
  requirementRefs: RequirementRefsSchema,
}).strict();

const SurfaceSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  name: z.string().min(1).max(200),
  kind: z.enum(["page", "panel", "dialog", "overlay", "canvas", "terminal", "api"]),
  routeKey: PlanSemanticKeyV1Schema,
  required: z.boolean(),
  requirementRefs: RequirementRefsSchema,
}).strict();

const InputFieldSchema = z.object({
  name: z.string().min(1).max(160).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  valueType: ValueTypeSchema,
  required: z.boolean(),
  entityField: z.object({
    entityKey: PlanSemanticKeyV1Schema,
    fieldKey: PlanSemanticKeyV1Schema,
  }).strict().optional(),
}).strict();

const ValueSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("input"), field: z.string().min(1).max(160) }).strict(),
  z.object({
    kind: z.literal("state"),
    stateKey: PlanSemanticKeyV1Schema,
    path: JsonPointerPathSchema,
  }).strict(),
  z.object({
    kind: z.literal("entity_field"),
    entityKey: PlanSemanticKeyV1Schema,
    fieldKey: PlanSemanticKeyV1Schema,
  }).strict(),
  z.object({ kind: z.literal("literal"), value: z.json() }).strict(),
  z.object({
    kind: z.literal("inputs"),
    fields: z.array(z.string().min(1).max(160)).min(1).max(500).refine(hasUniqueStrings, {
      message: "Composite input fields must be unique",
    }),
  }).strict(),
]);

const StateDeltaSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  stateKey: PlanSemanticKeyV1Schema,
  operation: z.enum(["set", "merge", "append", "remove", "clear", "upsert"]),
  path: JsonPointerPathSchema,
  valueFrom: ValueSourceSchema,
  matchField: z.string().min(1).max(160).optional(),
}).strict();

const ObservableAssertionSchema = z.object({
  phase: z.enum(["before", "after", "reload"]),
  property: z.enum(["visible_text", "value", "visibility", "enabled", "route"]),
  operator: z.enum(["equals", "contains", "matches", "changed"]),
  expected: z.json().optional(),
}).strict();

const ObservableSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  selector: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("control") }).strict(),
    z.object({ kind: z.literal("surface"), surfaceKey: PlanSemanticKeyV1Schema }).strict(),
    z.object({
      kind: z.literal("accessibility"),
      surfaceKey: PlanSemanticKeyV1Schema,
      role: z.string().min(1).max(100),
      name: z.string().min(1).max(500),
    }).strict(),
  ]),
  assertions: z.array(ObservableAssertionSchema).min(1).max(100),
  requirementRefs: RequirementRefsSchema,
}).strict();

const ActionSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  name: z.string().min(1).max(200),
  surfaceKeys: z.array(PlanSemanticKeyV1Schema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Action surface keys must be unique",
  }),
  trigger: z.object({
    kind: z.enum(["user", "system", "timer", "route"]),
    sourceRef: z.string().min(1).max(160).optional(),
  }).strict(),
  inputs: z.array(InputFieldSchema).max(500),
  preconditions: z.array(z.object({
    stateKey: PlanSemanticKeyV1Schema,
    path: JsonPointerPathSchema,
    operator: z.enum(["equals", "not_equals", "exists", "not_exists", "truthy", "falsy"]),
    expected: z.json().optional(),
  }).strict()).max(500),
  evidenceScenario: z.object({
    targetInputValues: z.record(z.string().min(1).max(160), z.json()),
    prerequisiteSteps: z.array(z.object({
      actionKey: PlanSemanticKeyV1Schema,
      inputValues: z.record(z.string().min(1).max(160), z.json()),
    }).strict()).max(100),
  }).strict(),
  stateDeltas: z.array(StateDeltaSchema).max(500),
  navigation: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("stay") }).strict(),
    z.object({ kind: z.literal("route"), routeKey: PlanSemanticKeyV1Schema }).strict(),
    z.object({ kind: z.literal("back") }).strict(),
    z.object({ kind: z.literal("external"), url: z.url() }).strict(),
  ]),
  persistenceIntents: z.array(z.object({
    policyKey: PlanSemanticKeyV1Schema,
    operation: z.enum(["read", "write", "update", "delete", "clear"]),
    entityKey: PlanSemanticKeyV1Schema.optional(),
    stateDeltaKeys: z.array(PlanSemanticKeyV1Schema).min(1).max(500).refine(hasUniqueStrings, {
      message: "Persistence state delta keys must be unique",
    }),
  }).strict()).max(500),
  observables: z.array(ObservableSchema).min(1).max(500),
  requirementRefs: RequirementRefsSchema,
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
});

const RequirementClassificationSchema = z.object({
  id: RequirementIdSchema,
  classification: z.enum(["functional", "constraint", "non_goal"]),
  expectedSemanticKinds: z.array(RequirementSemanticKindV1Schema).min(1).max(10).refine(hasUniqueStrings, {
    message: "Requirement expected semantic kinds must be unique",
  }),
}).strict();

const AssumptionSchema = z.object({
  key: PlanSemanticKeyV1Schema,
  statement: z.string().min(1).max(2_000),
  requirementRefs: RequirementRefsSchema,
}).strict();

function uniqueKeys(
  context: z.core.$RefinementCtx,
  path: string,
  values: readonly Readonly<{ key: string }>[],
): void {
  if (!hasUniqueStrings(values.map((value) => value.key))) {
    context.addIssue({ code: "custom", path: [path], message: `${path} semantic keys must be unique` });
  }
}

/**
 * The model-owned PLAN boundary. It contains only primary semantic facts and
 * exact requirement references; all global IDs and redundant projections are
 * compiler output.
 */
export const PlanSemanticProposalV1Schema = z.object({
  schema: z.literal("setfarm.plan-semantic-proposal.v1"),
  sourceTaskHash: Sha256Schema,
  product: z.object({
    key: PlanSemanticKeyV1Schema,
    name: z.string().min(1).max(200),
    class: z.enum(["utility", "operations", "game", "content", "commerce", "developer_tool", "service", "other"]),
    uiLanguage: z.string().min(1).max(100),
    database: z.enum(["none", "postgres", "sqlite", "external"]),
    uiVisionSummary: z.string().min(80).max(4_000),
    goals: z.array(GoalSchema).min(1).max(200),
    nonGoals: z.array(NonGoalSchema).max(200),
  }).strict(),
  requirements: z.array(RequirementClassificationSchema).min(1).max(1_000),
  entities: z.array(EntitySchema).max(500),
  states: z.array(StateSchema).min(1).max(500),
  persistencePolicies: z.array(PersistenceSchema).max(500),
  routes: z.array(RouteSchema).min(1).max(500),
  surfaces: z.array(SurfaceSchema).min(1).max(1_000),
  actions: z.array(ActionSchema).min(1).max(2_000),
  assumptions: z.array(AssumptionSchema).max(500),
}).strict().superRefine((value, context) => {
  uniqueKeys(context, "goals", value.product.goals);
  uniqueKeys(context, "nonGoals", value.product.nonGoals);
  uniqueKeys(context, "entities", value.entities);
  uniqueKeys(context, "states", value.states);
  uniqueKeys(context, "persistencePolicies", value.persistencePolicies);
  uniqueKeys(context, "routes", value.routes);
  uniqueKeys(context, "surfaces", value.surfaces);
  uniqueKeys(context, "actions", value.actions);
  uniqueKeys(context, "assumptions", value.assumptions);
  if (!hasUniqueStrings(value.requirements.map((requirement) => requirement.id))) {
    context.addIssue({ code: "custom", path: ["requirements"], message: "Requirement IDs must be unique" });
  }
});

export type PlanSemanticProposalV1 = z.infer<typeof PlanSemanticProposalV1Schema>;
