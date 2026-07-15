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
  ObservableIdSchema,
  PersistenceIdSchema,
  ProductIdSchema,
  ProductRoutePathSchema,
  ProvenanceRefV1Schema,
  RequirementIdSchema,
  RouteIdSchema,
  StateIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  RequirementClauseSourceV1Schema,
  TaskRequirementClauseV1Schema,
} from "../requirements/task-requirements-v1.js";

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
  {
    message: "State path must be empty or a valid RFC 6901 JSON Pointer beginning with '/'; escape '~' as '~0' and '/' as '~1'",
  },
);

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
    rehydration: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("none") }).strict(),
      z.object({ kind: z.literal("initialization") }).strict(),
      z.object({ kind: z.literal("action"), actionRef: ActionIdSchema }).strict(),
    ]),
  })
  .strict()
  .superRefine((value, context) => {
    const durable = ["reload", "restart", "durable"].includes(value.durability);
    if (durable && value.rehydration.kind === "none") {
      context.addIssue({ code: "custom", path: ["rehydration"], message: "Durable persistence requires an exact rehydration owner" });
    }
    if (!durable && value.rehydration.kind !== "none") {
      context.addIssue({ code: "custom", path: ["rehydration"], message: "Non-durable persistence cannot declare a rehydration owner" });
    }
  });

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
    path: JsonPointerPathSchema,
    operator: z.enum(["equals", "not_equals", "exists", "not_exists", "truthy", "falsy"]),
    expected: z.json().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (["equals", "not_equals"].includes(value.operator) && value.expected === undefined) {
      context.addIssue({ code: "custom", path: ["expected"], message: `${value.operator} preconditions require an exact expected value` });
    }
    if (!["equals", "not_equals"].includes(value.operator) && value.expected !== undefined) {
      context.addIssue({ code: "custom", path: ["expected"], message: `${value.operator} preconditions cannot carry an unused expected value` });
    }
  });

const EvidenceScenarioInputValuesV1Schema = z.record(
  z.string().min(1).max(160),
  z.json(),
).refine((value) => Object.keys(value).length <= 500, "Evidence scenario inputs are limited to 500 fields");

const ActionEvidenceScenarioV1Schema = z.object({
  targetInputValues: EvidenceScenarioInputValuesV1Schema,
  prerequisiteSteps: z.array(z.object({
    actionRef: ActionIdSchema,
    inputValues: EvidenceScenarioInputValuesV1Schema,
  }).strict()).max(100),
}).strict();

export const ActionValueSourceV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("input"), field: z.string().min(1).max(160) }).strict(),
  z.object({
    kind: z.literal("state"),
    stateRef: StateIdSchema,
    path: JsonPointerPathSchema,
  }).strict(),
  z.object({
    kind: z.literal("entity_field"),
    entityRef: EntityIdSchema,
    fieldRef: EntityFieldIdSchema,
  }).strict(),
  z.object({ kind: z.literal("literal"), value: z.json() }).strict(),
  z.object({
    kind: z.literal("inputs"),
    fields: z.array(z.string().min(1).max(160)).min(1).max(500).refine(hasUniqueStrings, {
      message: "Composite input fields must be unique",
    }),
  }).strict(),
]);

export type ActionValueSourceV1 = z.infer<typeof ActionValueSourceV1Schema>;

const ActionStateDeltaV1Schema = z
  .object({
    stateRef: StateIdSchema,
    operation: z.enum(["set", "merge", "append", "remove", "clear", "upsert"]),
    path: JsonPointerPathSchema,
    valueFrom: ActionValueSourceV1Schema,
    matchField: z.string().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.operation === "upsert" && !value.matchField) {
      context.addIssue({ code: "custom", path: ["matchField"], message: "Upsert deltas require an exact match field" });
    }
    if (
      value.operation === "upsert"
      && value.matchField
      && value.valueFrom.kind === "inputs"
      && !value.valueFrom.fields.includes(value.matchField)
    ) {
      context.addIssue({ code: "custom", path: ["matchField"], message: "Upsert match field must be present in the composite input value" });
    }
    if (value.matchField && value.operation !== "upsert" && value.operation !== "remove") {
      context.addIssue({ code: "custom", path: ["matchField"], message: "Match fields are valid only for upsert/remove deltas" });
    }
  });

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
    statePaths: z.array(z.object({
      stateRef: StateIdSchema,
      path: JsonPointerPathSchema,
    }).strict()).min(1).max(500).refine(
      (values) => hasUniqueStrings(values.map((value) => `${value.stateRef}\0${value.path}`)),
      { message: "Persistence state paths must be unique" },
    ),
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

export const ObservableSelectorV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("control"),
    actionRef: ActionIdSchema,
  }).strict(),
  z.object({
    kind: z.literal("surface"),
    surfaceRef: SurfaceIdSchema,
  }).strict(),
  z.object({
    kind: z.literal("accessibility"),
    surfaceRef: SurfaceIdSchema,
    actionRef: ActionIdSchema.optional(),
    role: z.string().min(1).max(100),
    name: z.string().min(1).max(500),
  }).strict(),
]);

export const ObservableAssertionV1Schema = z.object({
  phase: z.enum(["before", "after", "reload"]),
  property: z.enum(["visible_text", "value", "visibility", "enabled", "route"]),
  operator: z.enum(["equals", "contains", "matches", "changed"]),
  expected: z.json().optional(),
}).strict().superRefine((value, context) => {
  if (value.operator === "changed" && value.expected !== undefined) {
    context.addIssue({ code: "custom", path: ["expected"], message: "Changed assertions compare against the before capture and cannot carry expected" });
  }
  if (value.operator !== "changed" && value.expected === undefined) {
    context.addIssue({ code: "custom", path: ["expected"], message: `${value.operator} observable assertions require expected` });
  }
  if (value.phase === "before" && value.operator === "changed") {
    context.addIssue({ code: "custom", path: ["operator"], message: "Before assertions cannot use changed" });
  }
  if (["contains", "matches"].includes(value.operator) && typeof value.expected !== "string") {
    context.addIssue({ code: "custom", path: ["expected"], message: `${value.operator} observable assertions require a string expected value` });
  }
  if (["visibility", "enabled"].includes(value.property)) {
    if (!(["equals", "changed"].includes(value.operator))) {
      context.addIssue({ code: "custom", path: ["operator"], message: `${value.property} supports only equals or changed` });
    }
    if (value.operator === "equals" && typeof value.expected !== "boolean") {
      context.addIssue({ code: "custom", path: ["expected"], message: `${value.property} equals assertions require a boolean` });
    }
  }
  if (value.property === "route" && value.operator === "equals" && (
    typeof value.expected !== "string" || !value.expected.startsWith("/")
  )) {
    context.addIssue({ code: "custom", path: ["expected"], message: "Route equality requires an absolute product route path" });
  }
});

export const ObservableActionEffectV1Schema = z.object({
  id: ObservableIdSchema,
  selector: ObservableSelectorV1Schema,
  assertions: z.array(ObservableAssertionV1Schema).min(1).max(100),
  evidenceRef: EvidenceIdSchema,
}).strict().superRefine((value, context) => {
  if (!value.assertions.some((assertion) => assertion.phase === "after")) {
    context.addIssue({ code: "custom", path: ["assertions"], message: "Observable action effects require an after assertion" });
  }
  const identities = value.assertions.map((assertion) => `${assertion.phase}\0${assertion.property}`);
  if (!hasUniqueStrings(identities)) {
    context.addIssue({ code: "custom", path: ["assertions"], message: "Observable phase/property assertions must be unique" });
  }
});

export type ObservableActionEffectV1 = z.infer<typeof ObservableActionEffectV1Schema>;

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
    evidenceScenario: ActionEvidenceScenarioV1Schema,
    stateDeltas: z.array(ActionStateDeltaV1Schema).max(500),
    navigation: ActionNavigationV1Schema,
    persistenceEffects: z.array(PersistenceEffectV1Schema).max(500),
    success: ActionOutcomeV1Schema,
    failure: ActionOutcomeV1Schema,
    evidenceRefs: z.array(EvidenceIdSchema).min(1).max(500).refine(hasUniqueStrings, {
      message: "Action evidence refs must be unique",
    }),
    observableEffects: z.array(ObservableActionEffectV1Schema).min(1).max(500).optional(),
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
      "observable_outcome",
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

export const RequirementSemanticKindV1Schema = z.enum([
  "goal",
  "non_goal",
  "entity",
  "state",
  "persistence",
  "route",
  "surface",
  "action",
  "evidence",
  "observable",
]);

export const ProductRequirementV1Schema = z.object({
  id: RequirementIdSchema,
  normalizedClause: z.string().min(1).max(20_000),
  clauseHash: z.string().regex(/^[a-f0-9]{64}$/),
  sources: z.array(RequirementClauseSourceV1Schema).min(1).max(1_000),
  classification: z.enum(["functional", "constraint", "non_goal"]),
  expectedSemanticKinds: z.array(RequirementSemanticKindV1Schema).min(1).max(10).refine(hasUniqueStrings, {
    message: "Requirement expected semantic kinds must be unique",
  }),
}).strict();

export const RequirementBindingV1Schema = z.object({
  semanticKind: RequirementSemanticKindV1Schema,
  semanticRef: z.string().min(1).max(160),
  requirementRefs: z.array(RequirementIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
    message: "Requirement binding refs must be unique",
  }),
}).strict();

export const ProductDeliveryV1Schema = z.object({
  platform: z.enum(["web", "mobile", "desktop", "api", "cli", "game"]),
  techStack: z.enum([
    "vite-react",
    "nextjs",
    "static-html",
    "browser-game",
    "node-express",
    "python-web",
    "node-cli",
    "python-cli",
    "react-native-expo",
    "android-native",
    "ios-native",
    "desktop-electron",
  ]),
  uiLanguage: z.string().min(1).max(100),
  database: z.enum(["none", "postgres", "sqlite", "external"]),
  designRequired: z.boolean(),
  uiVisionSummary: z.string().min(1).max(4_000),
}).strict().superRefine((value, context) => {
  const platformStacks: Readonly<Record<string, readonly string[]>> = {
    web: ["vite-react", "nextjs", "static-html"],
    mobile: ["react-native-expo", "android-native", "ios-native"],
    desktop: ["desktop-electron"],
    api: ["node-express", "python-web"],
    cli: ["node-cli", "python-cli"],
    game: ["browser-game"],
  };
  if (!platformStacks[value.platform]?.includes(value.techStack)) {
    context.addIssue({ code: "custom", path: ["techStack"], message: `Tech stack ${value.techStack} is not valid for ${value.platform}` });
  }
  const nonVisualPlatform = value.platform === "api" || value.platform === "cli";
  if (nonVisualPlatform && value.designRequired) {
    context.addIssue({ code: "custom", path: ["designRequired"], message: `${value.platform} ProductSpec cannot require Stitch UI design` });
  }
  if (!nonVisualPlatform && !value.designRequired) {
    context.addIssue({
      code: "custom",
      path: ["designRequired"],
      message: `DESIGN_V1_VISUAL_PLATFORM_REQUIRES_DESIGN: ${value.platform} ProductSpec must require Stitch UI design`,
    });
  }
});

export type ProductDeliveryV1 = z.infer<typeof ProductDeliveryV1Schema>;

export type PersistenceDeliveryCompatibilityIssueV1 = Readonly<{
  code:
    | "PERSISTENCE_V1_DELIVERY_DATABASE_UNSUPPORTED"
    | "PERSISTENCE_V1_DATABASE_POLICY_MISSING"
    | "PERSISTENCE_V1_KIND_UNSUPPORTED"
    | "PERSISTENCE_V1_PLATFORM_UNSUPPORTED"
    | "PERSISTENCE_V1_DATABASE_MISMATCH"
    | "PERSISTENCE_V1_OWNER_MISMATCH"
    | "PERSISTENCE_V1_DURABILITY_MISMATCH"
    | "PERSISTENCE_V1_KEY_REQUIRED"
    | "PERSISTENCE_V1_KEY_FORBIDDEN"
    | "PERSISTENCE_V1_REHYDRATION_MISMATCH"
    | "PERSISTENCE_V1_BROWSER_KEY_COLLISION";
  message: string;
  path: readonly (string | number)[];
  policyRef?: string;
}>;

/**
 * The complete runtime-data compatibility authority for Product Build Packet
 * contract version 1. It is deliberately fail-closed: a new platform,
 * persistence kind, owner, durability, or database ABI must be added here and
 * proven by the runtime-data producer before it can enter a sealed packet.
 */
export function validatePersistenceDeliveryCompatibilityV1(input: Readonly<{
  delivery: ProductDeliveryV1;
  policies: readonly PersistencePolicyV1[];
}>): PersistenceDeliveryCompatibilityIssueV1[] {
  const issues: PersistenceDeliveryCompatibilityIssueV1[] = [];
  const add = (
    policyIndex: number | undefined,
    field: string,
    code: PersistenceDeliveryCompatibilityIssueV1["code"],
    message: string,
  ) => {
    const policy = policyIndex === undefined ? undefined : input.policies[policyIndex];
    issues.push({
      code,
      message,
      path: policyIndex === undefined
        ? ["delivery", field]
        : ["persistencePolicies", policyIndex, field],
      ...(policy ? { policyRef: policy.id } : {}),
    });
  };

  if (input.delivery.database === "external") {
    add(
      undefined,
      "database",
      "PERSISTENCE_V1_DELIVERY_DATABASE_UNSUPPORTED",
      "Product Build Packet v1 has no generic external database ABI; select postgres or reject the product class",
    );
  }
  if (
    input.delivery.database !== "none"
    && input.delivery.database !== "external"
    && !input.policies.some((policy) => policy.kind === "database")
  ) {
    add(
      undefined,
      "database",
      "PERSISTENCE_V1_DATABASE_POLICY_MISSING",
      `Delivery database ${input.delivery.database} requires at least one exact database persistence policy`,
    );
  }

  input.policies.forEach((policy, policyIndex) => {
    const expectOwner = (owner: PersistencePolicyV1["owner"]) => {
      if (policy.owner !== owner) {
        add(policyIndex, "owner", "PERSISTENCE_V1_OWNER_MISMATCH", `${policy.id} requires owner ${owner}, not ${policy.owner}`);
      }
    };
    const expectDurability = (durability: PersistencePolicyV1["durability"]) => {
      if (policy.durability !== durability) {
        add(
          policyIndex,
          "durability",
          "PERSISTENCE_V1_DURABILITY_MISMATCH",
          `${policy.id} requires ${durability} durability, not ${policy.durability}`,
        );
      }
    };
    const expectNoKey = () => {
      if (policy.key !== undefined) {
        add(policyIndex, "key", "PERSISTENCE_V1_KEY_FORBIDDEN", `${policy.id} cannot declare a browser-local storage key`);
      }
    };
    const expectNoRehydration = () => {
      if (policy.rehydration.kind !== "none") {
        add(
          policyIndex,
          "rehydration",
          "PERSISTENCE_V1_REHYDRATION_MISMATCH",
          `${policy.id} is non-durable and cannot declare a rehydration owner`,
        );
      }
    };
    const expectDurableRehydration = () => {
      if (policy.rehydration.kind === "none") {
        add(
          policyIndex,
          "rehydration",
          "PERSISTENCE_V1_REHYDRATION_MISMATCH",
          `${policy.id} requires initialization or action rehydration`,
        );
      }
    };

    if (policy.kind === "none") {
      expectOwner(input.delivery.platform === "api" ? "server" : "application");
      expectDurability("none");
      expectNoKey();
      expectNoRehydration();
      return;
    }
    if (policy.kind === "memory") {
      expectOwner(input.delivery.platform === "api" ? "server" : "application");
      expectDurability("session");
      expectNoKey();
      expectNoRehydration();
      return;
    }
    if (policy.kind === "local_storage") {
      if (input.delivery.platform !== "web" && input.delivery.platform !== "game") {
        add(
          policyIndex,
          "kind",
          "PERSISTENCE_V1_PLATFORM_UNSUPPORTED",
          `${policy.id} local_storage is supported only for web and browser-game products`,
        );
      }
      if (input.delivery.database !== "none") {
        add(
          policyIndex,
          "kind",
          "PERSISTENCE_V1_DATABASE_MISMATCH",
          `${policy.id} browser-local persistence cannot be paired with delivery database ${input.delivery.database}`,
        );
      }
      expectOwner("application");
      expectDurability("reload");
      if (policy.key === undefined) {
        add(policyIndex, "key", "PERSISTENCE_V1_KEY_REQUIRED", `${policy.id} requires an exact browser-origin key`);
      }
      expectDurableRehydration();
      return;
    }
    if (policy.kind === "file") {
      if (input.delivery.platform !== "api") {
        add(
          policyIndex,
          "kind",
          "PERSISTENCE_V1_PLATFORM_UNSUPPORTED",
          `${policy.id} file persistence is supported only by an API server runtime in contract v1`,
        );
      }
      expectOwner("server");
      expectDurability("durable");
      expectNoKey();
      expectDurableRehydration();
      return;
    }
    if (policy.kind === "database") {
      if (input.delivery.platform !== "api") {
        add(
          policyIndex,
          "kind",
          "PERSISTENCE_V1_PLATFORM_UNSUPPORTED",
          `${policy.id} database persistence is supported only by an API server runtime in contract v1`,
        );
      }
      if (input.delivery.database !== "sqlite" && input.delivery.database !== "postgres") {
        add(
          policyIndex,
          "kind",
          "PERSISTENCE_V1_DATABASE_MISMATCH",
          `${policy.id} requires an exact sqlite or postgres delivery database ABI`,
        );
      } else {
        expectOwner(input.delivery.database === "sqlite" ? "server" : "external");
      }
      expectDurability("durable");
      expectNoKey();
      expectDurableRehydration();
      return;
    }

    expectNoKey();
    add(
      policyIndex,
      "kind",
      "PERSISTENCE_V1_KIND_UNSUPPORTED",
      `${policy.id} remote_api has no runtime authority ABI in Product Build Packet v1`,
    );
  });

  const browserPoliciesByKey = new Map<string, number[]>();
  input.policies.forEach((policy, policyIndex) => {
    if (policy.kind !== "local_storage" || policy.key === undefined) return;
    const indexes = browserPoliciesByKey.get(policy.key) ?? [];
    indexes.push(policyIndex);
    browserPoliciesByKey.set(policy.key, indexes);
  });
  browserPoliciesByKey.forEach((indexes, key) => {
    if (indexes.length < 2) return;
    indexes.forEach((policyIndex) => add(
      policyIndex,
      "key",
      "PERSISTENCE_V1_BROWSER_KEY_COLLISION",
      `Browser-origin key ${key} is owned by more than one persistence policy`,
    ));
  });

  return issues;
}

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
    delivery: ProductDeliveryV1Schema.optional(),
    requirements: z.array(ProductRequirementV1Schema).min(1).max(1_000).optional(),
    traceability: z.object({
      schema: z.literal("setfarm.product-requirement-traceability.v1"),
      sourceTaskHash: z.string().regex(/^[a-f0-9]{64}$/),
      bindings: z.array(RequirementBindingV1Schema).min(1).max(20_000),
    }).strict().optional(),
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
    const entityFieldById = new Map(value.entities.flatMap((item) => item.fields.map((field) => [field.id, field] as const)));
    if (fieldIds.size !== value.entities.reduce((total, entity) => total + entity.fields.length, 0)) {
      context.addIssue({ code: "custom", path: ["entities"], message: "Entity field IDs must be globally unique" });
    }
    const stateIds = new Set(value.states.map((item) => item.id));
    const persistenceIds = new Set(value.persistencePolicies.map((item) => item.id));
    const routeIds = new Set(value.routes.map((item) => item.id));
    const surfaceIds = new Set(value.surfaces.map((item) => item.id));
    const actionIds = new Set(value.actions.map((item) => item.id));
    const evidenceIds = new Set(value.evidencePredicates.map((item) => item.id));
    const observableIds = new Set(value.actions.flatMap((item) =>
      (item.observableEffects ?? []).map((effect) => effect.id)));
    const exactV3Contract = Boolean(value.delivery && value.requirements && value.traceability);
    if (observableIds.size !== value.actions.reduce(
      (total, action) => total + (action.observableEffects?.length ?? 0),
      0,
    )) {
      context.addIssue({ code: "custom", path: ["actions"], message: "Observable effect IDs must be globally unique" });
    }

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
    const validateScenarioInputTypes = (
      action: ProductActionV1,
      inputValues: Readonly<Record<string, unknown>>,
      path: PropertyKey[],
    ) => {
      action.input.fields.forEach((field, fieldIndex) => {
        const supplied = inputValues[field.name];
        const valid = field.valueType === "number"
          ? typeof supplied === "number" && Number.isFinite(supplied)
          : field.valueType === "boolean"
            ? typeof supplied === "boolean"
            : field.valueType === "object"
              ? supplied !== null && typeof supplied === "object" && !Array.isArray(supplied)
              : field.valueType === "array"
                ? Array.isArray(supplied)
                : typeof supplied === "string";
        const entityField = field.entityFieldRef ? entityFieldById.get(field.entityFieldRef) : undefined;
        const enumValid = field.valueType !== "enum"
          || !entityField?.enumValues
          || (typeof supplied === "string" && entityField.enumValues.includes(supplied));
        if (!valid || !enumValid) {
          context.addIssue({
            code: "custom",
            path: [...path, field.name],
            message: `Evidence value for ${action.id}.${field.name} does not satisfy ${field.valueType}`,
          });
        }
      });
    };

    value.persistencePolicies.forEach((policy, policyIndex) => {
      policy.entityRefs.forEach((ref, refIndex) => {
        requireRef(entityIds, ref, ["persistencePolicies", policyIndex, "entityRefs", refIndex], "entity ref");
      });
      if (policy.rehydration.kind === "action") {
        const actionRef = policy.rehydration.actionRef;
        requireRef(actionIds, actionRef, ["persistencePolicies", policyIndex, "rehydration", "actionRef"], "rehydration action ref");
        const action = value.actions.find((candidate) => candidate.id === actionRef);
        if (action && action.trigger.kind !== "system" && action.trigger.kind !== "route") {
          context.addIssue({
            code: "custom",
            path: ["persistencePolicies", policyIndex, "rehydration", "actionRef"],
            message: "A rehydration action must have a system or route trigger",
          });
        }
        if (action && !action.persistenceEffects.some((effect) =>
          effect.policyRef === policy.id && effect.operation === "read")) {
          context.addIssue({
            code: "custom",
            path: ["persistencePolicies", policyIndex, "rehydration", "actionRef"],
            message: "A rehydration action must declare an exact read effect for its policy",
          });
        }
      }
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
      const stateDeltaInputFields = new Set<string>();
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
      {
        const expectedFields = action.input.fields.map((field) => field.name).sort();
        const suppliedFields = Object.keys(action.evidenceScenario.targetInputValues).sort();
        if (
          expectedFields.length !== suppliedFields.length
          || expectedFields.some((field, index) => field !== suppliedFields[index])
        ) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "evidenceScenario", "targetInputValues"],
            message: `Evidence target inputs must exactly equal action inputs for ${action.id}`,
          });
        }
        validateScenarioInputTypes(
          action,
          action.evidenceScenario.targetInputValues,
          ["actions", actionIndex, "evidenceScenario", "targetInputValues"],
        );
      }
      action.evidenceScenario.prerequisiteSteps.forEach((step, stepIndex) => {
        requireRef(actionIds, step.actionRef, ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "actionRef"], "scenario action ref");
        if (step.actionRef === action.id) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "actionRef"],
            message: "An evidence scenario cannot invoke its target action as a prerequisite",
          });
        }
        const prerequisite = value.actions.find((candidate) => candidate.id === step.actionRef);
        if (prerequisite) {
          const expectedFields = prerequisite.input.fields.map((field) => field.name).sort();
          const suppliedFields = Object.keys(step.inputValues).sort();
          if (
            expectedFields.length !== suppliedFields.length
            || expectedFields.some((field, index) => field !== suppliedFields[index])
          ) {
            context.addIssue({
              code: "custom",
              path: ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "inputValues"],
              message: `Scenario inputs must exactly equal action inputs for ${step.actionRef}`,
            });
          }
          validateScenarioInputTypes(
            prerequisite,
            step.inputValues,
            ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "inputValues"],
          );
        }
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
        if (delta.valueFrom.kind === "input") {
          stateDeltaInputFields.add(delta.valueFrom.field);
        }
        if (delta.valueFrom.kind === "inputs") {
          delta.valueFrom.fields.forEach((field, fieldIndex) => {
            stateDeltaInputFields.add(field);
            if (!inputFields.has(field)) {
              context.addIssue({
                code: "custom",
                path: ["actions", actionIndex, "stateDeltas", index, "valueFrom", "fields", fieldIndex],
                message: `Unresolved action input field: ${field}`,
              });
            }
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
      if (exactV3Contract) {
        action.input.fields.forEach((field, fieldIndex) => {
          if (stateDeltaInputFields.has(field.name)) return;
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "input", "fields", fieldIndex, "name"],
            message: `Action input ${action.id}.${field.name} is behaviorally unused: every v3 input must feed an exact state delta through valueFrom.kind input or inputs; remove constant inputs and use a literal delta instead`,
          });
        });
      }
      if (action.navigation.kind === "route") {
        requireRef(routeIds, action.navigation.routeRef, ["actions", actionIndex, "navigation", "routeRef"], "route ref");
      }
      action.persistenceEffects.forEach((effect, index) => {
        requireRef(persistenceIds, effect.policyRef, ["actions", actionIndex, "persistenceEffects", index, "policyRef"], "persistence ref");
        if (effect.entityRef) {
          requireRef(entityIds, effect.entityRef, ["actions", actionIndex, "persistenceEffects", index, "entityRef"], "entity ref");
        }
        effect.statePaths.forEach((statePath, statePathIndex) => {
          requireRef(stateIds, statePath.stateRef, ["actions", actionIndex, "persistenceEffects", index, "statePaths", statePathIndex, "stateRef"], "persistence state ref");
          if (effect.operation !== "read" && !action.stateDeltas.some((delta) =>
            delta.stateRef === statePath.stateRef && delta.path === statePath.path)) {
            context.addIssue({
              code: "custom",
              path: ["actions", actionIndex, "persistenceEffects", index, "statePaths", statePathIndex],
              message: "A persistence write state path must name an exact state delta from the same action",
            });
          }
        });
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
          if (!action.evidenceRefs.includes(ref)) {
            context.addIssue({
              code: "custom",
              path: ["actions", actionIndex, outcomeName, "evidenceRefs", index],
              message: "Action outcome evidence must be owned by the action evidenceRefs contract",
            });
          }
        });
      }
      action.evidenceRefs.forEach((ref, index) => {
        requireRef(evidenceIds, ref, ["actions", actionIndex, "evidenceRefs", index], "evidence ref");
      });
      (action.observableEffects ?? []).forEach((effect, effectIndex) => {
        requireRef(evidenceIds, effect.evidenceRef, ["actions", actionIndex, "observableEffects", effectIndex, "evidenceRef"], "observable evidence ref");
        if (!action.evidenceRefs.includes(effect.evidenceRef)) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "observableEffects", effectIndex, "evidenceRef"],
            message: "Observable evidence must be included in the owning action evidence refs",
          });
        }
        if (effect.selector.kind === "control" && effect.selector.actionRef !== action.id) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "observableEffects", effectIndex, "selector", "actionRef"],
            message: "A control observable must bind its owning action",
          });
        }
        if (effect.selector.kind === "surface" && !action.surfaceRefs.includes(effect.selector.surfaceRef)) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "observableEffects", effectIndex, "selector", "surfaceRef"],
            message: "A surface observable must bind one of the action surfaces",
          });
        }
        if (effect.selector.kind === "accessibility") {
          if (!action.surfaceRefs.includes(effect.selector.surfaceRef)) {
            context.addIssue({
              code: "custom",
              path: ["actions", actionIndex, "observableEffects", effectIndex, "selector", "surfaceRef"],
              message: "An accessibility observable must bind one of the action surfaces",
            });
          }
          if (effect.selector.actionRef && effect.selector.actionRef !== action.id) {
            context.addIssue({
              code: "custom",
              path: ["actions", actionIndex, "observableEffects", effectIndex, "selector", "actionRef"],
              message: "An accessibility action selector must bind its owning action",
            });
          }
        }
        const predicate = value.evidencePredicates.find((candidate) => candidate.id === effect.evidenceRef);
        if (predicate && (
          predicate.kind !== "observable_outcome" || predicate.subjectRef !== effect.id
        )) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "observableEffects", effectIndex, "evidenceRef"],
            message: "Observable evidence must be an observable_outcome predicate whose subject is the exact effect",
          });
        }
      });
    });

    const evidenceSubjects = new Set<string>([
      ...actionIds,
      ...routeIds,
      ...surfaceIds,
      ...stateIds,
      ...persistenceIds,
      ...entityIds,
      ...observableIds,
    ]);
    value.evidencePredicates.forEach((predicate, index) => {
      requireRef(evidenceSubjects, predicate.subjectRef, ["evidencePredicates", index, "subjectRef"], "evidence subject");
    });

    const extensionPresence = [value.delivery, value.requirements, value.traceability]
      .filter((item) => item !== undefined).length;
    if (extensionPresence > 0 && extensionPresence !== 3) {
      context.addIssue({
        code: "custom",
        path: ["traceability"],
        message: "V3 ProductSpec delivery, requirements, and traceability must be declared together",
      });
    }
    if (value.delivery && value.requirements && value.traceability) {
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
          if (source.sourceHash !== value.traceability!.sourceTaskHash) {
            context.addIssue({
              code: "custom",
              path: ["requirements", requirementIndex, "sources", sourceIndex, "sourceHash"],
              message: "Requirement source hash must match traceability sourceTaskHash",
            });
          }
        });
      });

      const semanticRefs: Array<{ semanticKind: z.infer<typeof RequirementSemanticKindV1Schema>; semanticRef: string }> = [
        ...value.product.goals.map((item) => ({ semanticKind: "goal" as const, semanticRef: item.id })),
        ...value.product.nonGoals.map((item) => ({ semanticKind: "non_goal" as const, semanticRef: item.id })),
        ...value.entities.map((item) => ({ semanticKind: "entity" as const, semanticRef: item.id })),
        ...value.states.map((item) => ({ semanticKind: "state" as const, semanticRef: item.id })),
        ...value.persistencePolicies.map((item) => ({ semanticKind: "persistence" as const, semanticRef: item.id })),
        ...value.routes.map((item) => ({ semanticKind: "route" as const, semanticRef: item.id })),
        ...value.surfaces.map((item) => ({ semanticKind: "surface" as const, semanticRef: item.id })),
        ...value.actions.map((item) => ({ semanticKind: "action" as const, semanticRef: item.id })),
        ...value.evidencePredicates.map((item) => ({ semanticKind: "evidence" as const, semanticRef: item.id })),
        ...value.actions.flatMap((action) => (action.observableEffects ?? [])
          .map((item) => ({ semanticKind: "observable" as const, semanticRef: item.id }))),
      ];
      const expectedBindings = new Map<string, typeof semanticRefs[number]>(semanticRefs.map((entry) =>
        [`${entry.semanticKind}\0${entry.semanticRef}`, entry] as const));
      const observedBindingKeys = value.traceability.bindings.map((binding) =>
        `${binding.semanticKind}\0${binding.semanticRef}`);
      if (!hasUniqueStrings(observedBindingKeys)) {
        context.addIssue({ code: "custom", path: ["traceability", "bindings"], message: "Semantic requirement bindings must be unique" });
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
          requireRef(requirementIds, requirementRef, ["traceability", "bindings", bindingIndex, "requirementRefs", requirementIndex], "requirement ref");
        });
      });
      semanticRefs.forEach((semantic) => {
        const key = `${semantic.semanticKind}\0${semantic.semanticRef}`;
        if (!observedBindingKeys.includes(key)) {
          context.addIssue({
            code: "custom",
            path: ["traceability", "bindings"],
            message: `ProductSpec semantic artifact has no requirement binding: ${semantic.semanticKind}:${semantic.semanticRef}`,
          });
        }
      });
      value.requirements.forEach((requirement, requirementIndex) => {
        const bindings = value.traceability!.bindings.filter((binding) =>
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

      value.actions.forEach((action, actionIndex) => {
        const effects = action.observableEffects ?? [];
        if (effects.length === 0) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "observableEffects"],
            message: "V3 actions require a typed observable effect",
          });
        }
        const durableWrite = action.persistenceEffects.some((effect) => {
          if (effect.operation === "read") return false;
          const policy = value.persistencePolicies.find((candidate) => candidate.id === effect.policyRef);
          return Boolean(policy && ["reload", "restart", "durable"].includes(policy.durability));
        });
        if (durableWrite && !effects.some((effect) =>
          effect.assertions.some((assertion) => assertion.phase === "reload"))) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "observableEffects"],
            message: "Durable action effects require an observable reload assertion",
          });
        }
      });
    }
  });

export type ProductSpecV1 = z.infer<typeof ProductSpecV1Schema>;

export const ProductSpecV3ProposalSchema = ProductSpecV1Schema.superRefine((value, context) => {
  if (!value.delivery) context.addIssue({ code: "custom", path: ["delivery"], message: "V3 ProductSpec requires delivery" });
  if (!value.requirements) context.addIssue({ code: "custom", path: ["requirements"], message: "V3 ProductSpec requires source requirements" });
  if (!value.traceability) context.addIssue({ code: "custom", path: ["traceability"], message: "V3 ProductSpec requires requirement traceability" });
  if (value.delivery) {
    validatePersistenceDeliveryCompatibilityV1({
      delivery: value.delivery,
      policies: value.persistencePolicies,
    }).forEach((issue) => context.addIssue({
      code: "custom",
      path: [...issue.path],
      message: `${issue.code}: ${issue.message}`,
    }));
  }
});

export type ProductSpecV3Proposal = z.infer<typeof ProductSpecV3ProposalSchema>;
