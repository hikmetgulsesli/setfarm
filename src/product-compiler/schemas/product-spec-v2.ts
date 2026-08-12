import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
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
  EvidencePredicateV1Schema,
  ObservableAssertionV1Schema,
  ProductActionV1Schema,
  ProductDeliveryV1Schema,
  PRODUCT_SPEC_V1_OPAQUE_SOURCE_EVIDENCE_PATHS,
  ProductRequirementV1Schema,
  PRODUCT_SPEC_V1_ENGLISH_PROSE_PATHS,
  ProductSpecV1Schema,
  validatePersistenceDeliveryCompatibilityV1,
  type ProductSpecV1,
} from "./product-spec-v1.js";
import { TaskRequirementClauseV1Schema } from "../requirements/task-requirements-v1.js";
import {
  ENGLISH_TEXT_TREE_MAX_CODE_UNITS_V1,
  ENGLISH_TEXT_TREE_MAX_ISSUES_V1,
  ENGLISH_TEXT_TREE_MAX_VALUES_V1,
  englishTextViolationMessageV1,
  inspectEnglishTextTreeV1,
  inspectEnglishTextV1,
} from "../english-text-contract-v1.js";
import {
  ProductActionInvocationInterfaceIntentV1Schema,
  ProductInvocationResultValueContractV1Schema,
  addInvocationInterfaceActionIssuesV1,
  cliInvocationTokenSequencesOverlapV1,
  compareCliInvocationTokenSequencesV1,
  compareInvocationTextCodeUnitsV1,
  findHttpInvocationRouteCollisionV1,
  httpRouteParameterNamesV1,
  invocationValueMatchesTypeV1,
  isSafeHttpInvocationRoutePathV1,
} from "./action-invocation-interface-intent-v1.js";

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

const ControlObservableSelectorV2Schema = z.object({
  kind: z.literal("control"),
  controlSlotRef: ControlSlotIdSchema,
}).strict();

const SurfaceObservableSelectorV2Schema = z.object({
  kind: z.literal("surface"),
  surfaceRef: SurfaceIdSchema,
}).strict();

const AccessibilityObservableSelectorV2Schema = z.object({
  kind: z.literal("accessibility"),
  surfaceRef: SurfaceIdSchema,
  role: z.string().min(1).max(100),
  name: z.string().min(1).max(500),
}).strict();

const InvocationOutputObservableSelectorV2Schema = z.object({
  kind: z.literal("invocation_output"),
  coordinate: z.literal("result_value"),
  pointer: z.string().max(500).refine(
    (value) => /^(?:\/(?:[^~]|~[01])*)*$/.test(value),
    "Expected an empty or RFC 6901 JSON Pointer",
  ),
  valueContract: ProductInvocationResultValueContractV1Schema,
}).strict();

/** Selector authority that is valid only for rendered-design consumers. */
export const RenderedObservableSelectorV2Schema = z.discriminatedUnion("kind", [
  ControlObservableSelectorV2Schema,
  SurfaceObservableSelectorV2Schema,
  AccessibilityObservableSelectorV2Schema,
]);

export type RenderedObservableSelectorV2 = z.infer<typeof RenderedObservableSelectorV2Schema>;

/** Product-level selector authority, including no-design invocation output. */
export const ObservableSelectorV2Schema = z.discriminatedUnion("kind", [
  ControlObservableSelectorV2Schema,
  SurfaceObservableSelectorV2Schema,
  AccessibilityObservableSelectorV2Schema,
  InvocationOutputObservableSelectorV2Schema,
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

export const EvidencePredicateV2Schema = z.object({
  ...EvidencePredicateV1Schema.shape,
  kind: z.enum([
    ...EvidencePredicateV1Schema.shape.kind.options,
    "action_invocation",
  ]),
}).strict().superRefine((value, context) => {
  if (value.kind !== "action_invocation") return;
  if (!value.required) {
    context.addIssue({
      code: "custom",
      path: ["required"],
      message: "PRODUCT_SPEC_ACTION_INVOCATION_REQUIRED: action invocation evidence cannot be optional",
    });
  }
  if (value.assertion.operator !== "passes" || value.assertion.expected !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["assertion"],
      message: "PRODUCT_SPEC_ACTION_INVOCATION_ASSERTION: action invocation evidence requires an exact passes assertion without expected data",
    });
  }
  if (value.capabilityRefs.length !== 0) {
    context.addIssue({
      code: "custom",
      path: ["capabilityRefs"],
      message: "PRODUCT_SPEC_ACTION_INVOCATION_CAPABILITY_FORBIDDEN: capability ownership begins at ProductEvidenceCapabilityPolicyV2",
    });
  }
});

export type EvidencePredicateV2 = z.infer<typeof EvidencePredicateV2Schema>;

/** Compiler-owned namespace for generic invocation evidence. */
export function deriveActionInvocationEvidenceIdV2(actionRef: string): string {
  const digest = hashCanonicalJson({
    domain: "setfarm.action-invocation-evidence-id.v2",
    actionRef,
  }).toUpperCase();
  return `EVID_INVOCATION_${digest}`;
}

/** Compiler-owned namespace for an exact action/persistence-policy witness. */
export function derivePersistenceRoundTripEvidenceIdV2(
  actionRef: string,
  persistenceRef: string,
): string {
  const digest = hashCanonicalJson({
    domain: "setfarm.persistence-round-trip-evidence-id.v2",
    actionRef,
    persistenceRef,
  }).toUpperCase();
  return `EVID_PERSISTENCE_ROUND_TRIP_${digest}`;
}

const {
  surfaceRefs: _surfaceRefs,
  evidenceScenario: ActionEvidenceScenarioV1Schema,
  observableEffects: _observableEffects,
  ...ProductActionStableShape
} = ProductActionV1Schema.shape;

export const ProductActionV2Schema = z.object({
  ...ProductActionStableShape,
  invocationInterface: ProductActionInvocationInterfaceIntentV1Schema,
  controlPlacements: z.array(ProductControlPlacementV2Schema).max(1_000),
  affectedSurfaceRefs: z.array(SurfaceIdSchema).max(1_000).refine(hasUniqueStrings, {
    message: "Action affected surface refs must be unique",
  }),
  evidenceScenario: z.object({
    ...ActionEvidenceScenarioV1Schema.shape,
    controlSlotRef: ControlSlotIdSchema.optional(),
  }).strict(),
  observableEffects: z.array(ObservableActionEffectV2Schema).min(1).max(499),
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
  addInvocationInterfaceActionIssuesV1({
    invocationInterface: value.invocationInterface,
    inputFields: value.input.fields,
    inputFieldPath: ["input", "fields"],
    trigger: value.trigger,
    preconditionCount: value.preconditions.length,
    controlPlacementCount: value.controlPlacements.length,
    evidenceControlRefPresent: evidenceSlot !== undefined,
    canonicalAuthority: true,
    context,
  });
  if (
    value.invocationInterface.kind !== "rendered_control"
    && value.affectedSurfaceRefs.length === 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["affectedSurfaceRefs"],
      message: "PRODUCT_SPEC_NON_RENDERED_SURFACE_REQUIRED: non-rendered actions require at least one exact affected surface",
    });
  }
  const invocationOutputCount = value.observableEffects.filter((effect) =>
    effect.selector.kind === "invocation_output").length;
  if (
    ["cli_command", "http_request"].includes(value.invocationInterface.kind)
    && invocationOutputCount !== value.observableEffects.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["observableEffects"],
      message: "PRODUCT_SPEC_INVOCATION_OUTPUT_CLOSURE: CLI/HTTP action observables must use exact invocation-output selectors",
    });
  }
  if (
    !["cli_command", "http_request"].includes(value.invocationInterface.kind)
    && invocationOutputCount > 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["observableEffects"],
      message: "PRODUCT_SPEC_INVOCATION_OUTPUT_FORBIDDEN: only CLI/HTTP actions can claim invocation-output selectors",
    });
  }
  const invocationOutputPointers = value.observableEffects.flatMap((effect) =>
    effect.selector.kind === "invocation_output" ? [effect.selector.pointer] : []);
  if (!hasUniqueStrings(invocationOutputPointers)) {
    context.addIssue({
      code: "custom",
      path: ["observableEffects"],
      message: "PRODUCT_SPEC_INVOCATION_OUTPUT_POINTER_DUPLICATE: output pointers must be unique within an action",
    });
  }
  if (value.invocationInterface.kind === "cli_command" || value.invocationInterface.kind === "http_request") {
    value.observableEffects.forEach((effect, effectIndex) => {
      if (effect.selector.kind !== "invocation_output") return;
      const contract = effect.selector.valueContract;
      effect.assertions.forEach((assertion, assertionIndex) => {
        if (
          assertion.property !== "value"
          || assertion.operator !== "equals"
          || assertion.expected === undefined
          || !invocationValueMatchesTypeV1(contract.valueType, assertion.expected)
        ) {
          context.addIssue({
            code: "custom",
            path: ["observableEffects", effectIndex, "assertions", assertionIndex],
            message: "PRODUCT_SPEC_INVOCATION_OUTPUT_VALUE_ASSERTION_REQUIRED: invocation output requires a typed equals assertion with expected data",
          });
        }
      });
      if (contract.expectedFrom.kind === "input") {
        const source = contract.expectedFrom;
        const inputField = value.input.fields.find((field) =>
          field.name === source.fieldName);
        if (!inputField || inputField.valueType !== contract.valueType) {
          context.addIssue({
            code: "custom",
            path: ["observableEffects", effectIndex, "selector", "valueContract"],
            message: `PRODUCT_SPEC_INVOCATION_OUTPUT_INPUT_MISMATCH: ${source.fieldName}`,
          });
        }
        const scenarioValue = value.evidenceScenario.targetInputValues[source.fieldName];
        effect.assertions.forEach((assertion, assertionIndex) => {
          if (assertion.expected === undefined || scenarioValue === undefined) return;
          if (hashCanonicalJson(assertion.expected) === hashCanonicalJson(scenarioValue)) return;
          context.addIssue({
            code: "custom",
            path: ["observableEffects", effectIndex, "assertions", assertionIndex, "expected"],
            message: `PRODUCT_SPEC_INVOCATION_OUTPUT_EXPECTED_FROM_INPUT_MISMATCH: ${source.fieldName}`,
          });
        });
      }
      if (contract.expectedFrom.kind === "literal") {
        const source = contract.expectedFrom;
        if (!invocationValueMatchesTypeV1(contract.valueType, source.value)) {
          context.addIssue({
            code: "custom",
            path: ["observableEffects", effectIndex, "selector", "valueContract", "expectedFrom", "value"],
            message: `PRODUCT_SPEC_INVOCATION_OUTPUT_LITERAL_TYPE_MISMATCH: ${effect.id}`,
          });
        }
        effect.assertions.forEach((assertion, assertionIndex) => {
          if (assertion.expected === undefined) return;
          if (hashCanonicalJson(assertion.expected) === hashCanonicalJson(source.value)) return;
          context.addIssue({
            code: "custom",
            path: ["observableEffects", effectIndex, "assertions", assertionIndex, "expected"],
            message: `PRODUCT_SPEC_INVOCATION_OUTPUT_LITERAL_EXPECTED_MISMATCH: ${effect.id}`,
          });
        });
      }
    });
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

function findPrerequisiteCycleV2(actions: readonly ProductActionV2[]): string[] | null {
  const actionIds = new Set(actions.map((action) => action.id));
  const edges = new Map(actions.map((action) => [
    action.id,
    [...new Set(action.evidenceScenario.prerequisiteSteps
      .map((step) => step.actionRef)
      .filter((reference) => actionIds.has(reference)))]
      .sort(),
  ] as const));
  const colors = new Map<string, 0 | 1 | 2>();
  for (const start of [...actionIds].sort()) {
    if ((colors.get(start) ?? 0) !== 0) continue;
    const stack: Array<{ node: string; nextIndex: number }> = [{ node: start, nextIndex: 0 }];
    const path: string[] = [start];
    const pathIndex = new Map<string, number>([[start, 0]]);
    colors.set(start, 1);
    while (stack.length > 0) {
      const frame = stack.at(-1)!;
      const outgoing = edges.get(frame.node) ?? [];
      if (frame.nextIndex >= outgoing.length) {
        colors.set(frame.node, 2);
        pathIndex.delete(frame.node);
        path.pop();
        stack.pop();
        continue;
      }
      const next = outgoing[frame.nextIndex]!;
      frame.nextIndex += 1;
      if (next === frame.node) continue; // already reported by exact self-edge validation
      const color = colors.get(next) ?? 0;
      if (color === 2) continue;
      if (color === 1) {
        const cycleStart = pathIndex.get(next);
        return cycleStart === undefined ? [next, next] : [...path.slice(cycleStart), next];
      }
      colors.set(next, 1);
      pathIndex.set(next, path.length);
      path.push(next);
      stack.push({ node: next, nextIndex: 0 });
    }
  }
  return null;
}

/**
 * Product semantics v2 authority. Physical controls are declared only by
 * control slots; affected surfaces never imply a rendered control.
 */
export const ProductSpecV2Schema = z.object({
  schema: z.literal("setfarm.product-spec.v2"),
  product: ProductSpecV1Schema.shape.product,
  entities: ProductSpecV1Schema.shape.entities,
  states: z.array(ProductSpecV1Schema.shape.states.element).max(500),
  persistencePolicies: ProductSpecV1Schema.shape.persistencePolicies,
  routes: z.array(ProductRouteV2Schema).min(1).max(500),
  surfaces: z.array(ProductSurfaceV2Schema).min(1).max(1_000),
  actions: z.array(ProductActionV2Schema).min(1).max(2_000),
  evidencePredicates: z.array(EvidencePredicateV2Schema).min(1).max(4_000),
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

  const observableCount = value.actions.reduce(
    (total, action) => total + action.observableEffects.length,
    0,
  );
  const invocationEvidenceCount = value.evidencePredicates.filter(
    (predicate) => predicate.kind === "action_invocation",
  ).length;
  const controlPlacementCount = value.actions.reduce(
    (total, action) => total + action.controlPlacements.length,
    0,
  );
  const predictedTraceabilityBindings =
    value.product.goals.length
    + value.product.nonGoals.length
    + value.entities.length
    + value.states.length
    + value.persistencePolicies.length
    + value.routes.length
    + value.surfaces.length
    + value.actions.length
    + controlPlacementCount
    + value.evidencePredicates.length
    + observableCount;
  if (value.states.length === 0 && !["cli", "api"].includes(value.delivery.platform)) {
    context.addIssue({
      code: "custom",
      path: ["states"],
      message: `PRODUCT_SPEC_V2_STATE_REQUIRED: ${value.delivery.platform} delivery cannot be stateless`,
    });
  }
  if (observableCount > 2_000) {
    context.addIssue({
      code: "custom",
      path: ["actions"],
      message: `PRODUCT_SPEC_V2_OBSERVABLE_BUDGET_EXCEEDED: ${observableCount} exceeds the product-wide limit of 2000`,
    });
  }
  if (value.evidencePredicates.length - invocationEvidenceCount > 2_000) {
    context.addIssue({
      code: "custom",
      path: ["evidencePredicates"],
      message: "PRODUCT_SPEC_V2_BASE_EVIDENCE_BUDGET_EXCEEDED: non-invocation evidence is limited to 2000 predicates",
    });
  }
  if (predictedTraceabilityBindings > 20_000) {
    context.addIssue({
      code: "custom",
      path: ["traceability", "bindings"],
      message: `PRODUCT_SPEC_V2_TRACEABILITY_BUDGET_EXCEEDED: semantic graph requires ${predictedTraceabilityBindings} bindings, limit 20000`,
    });
  }
  if (
    observableCount > 2_000
    || value.evidencePredicates.length - invocationEvidenceCount > 2_000
    || predictedTraceabilityBindings > 20_000
  ) return;

  const entityIds = new Set(value.entities.map((entity) => entity.id));
  const entityFields = value.entities.flatMap((entity) => entity.fields);
  const entityFieldIds = new Set(entityFields.map((field) => field.id));
  const entityFieldById = new Map(entityFields.map((field) => [field.id, field] as const));
  const entityOwnerByFieldId = new Map(value.entities.flatMap((entity) =>
    entity.fields.map((field) => [field.id, entity.id] as const)));
  if (entityFieldIds.size !== entityFields.length) {
    context.addIssue({
      code: "custom",
      path: ["entities"],
      message: "PRODUCT_SPEC_V2_ENTITY_FIELD_DUPLICATE: Entity field IDs must be globally unique",
    });
  }
  value.entities.forEach((entity, entityIndex) => {
    entity.fields.forEach((field, fieldIndex) => {
      if (field.valueType !== "enum" || !field.enumValues) return;
      if (hasUniqueStrings(field.enumValues)) return;
      context.addIssue({
        code: "custom",
        path: ["entities", entityIndex, "fields", fieldIndex, "enumValues"],
        message: `PRODUCT_SPEC_V2_ENUM_DOMAIN_DUPLICATE: ${field.id} enum values must be unique`,
      });
    });
  });
  const stateIds = new Set(value.states.map((state) => state.id));
  const persistenceIds = new Set(value.persistencePolicies.map((policy) => policy.id));
  const actionIds = new Set(value.actions.map((action) => action.id));
  const evidenceIds = new Set(value.evidencePredicates.map((predicate) => predicate.id));
  const persistenceById = new Map(value.persistencePolicies.map((policy) =>
    [policy.id, policy] as const));
  const actionById = new Map(value.actions.map((action) => [action.id, action] as const));
  const actionOwnersByEvidenceId = new Map<string, ProductActionV2[]>();
  value.actions.forEach((action) => {
    action.evidenceRefs.forEach((evidenceRef) => {
      const owners = actionOwnersByEvidenceId.get(evidenceRef) ?? [];
      owners.push(action);
      actionOwnersByEvidenceId.set(evidenceRef, owners);
    });
  });
  const evidenceById = new Map(value.evidencePredicates.map((predicate) =>
    [predicate.id, predicate] as const));
  const observableIds = new Set(value.actions.flatMap((action) =>
    action.observableEffects.map((effect) => effect.id)));

  const requireRef = (
    references: ReadonlySet<string>,
    reference: string,
    path: PropertyKey[],
    label: string,
  ): void => {
    if (references.has(reference)) return;
    context.addIssue({
      code: "custom",
      path,
      message: `PRODUCT_SPEC_V2_REFERENCE_UNRESOLVED: ${label}: ${reference}`,
    });
  };

  const validateScenarioInputTypes = (
    action: ProductActionV2,
    inputValues: Readonly<Record<string, unknown>>,
    path: PropertyKey[],
  ): void => {
    action.input.fields.forEach((field) => {
      const supplied = inputValues[field.name];
      const valid = invocationValueMatchesTypeV1(field.valueType, supplied);
      const entityField = field.entityFieldRef
        ? entityFieldById.get(field.entityFieldRef)
        : undefined;
      const enumValid = field.valueType !== "enum" || Boolean(
        entityField?.valueType === "enum"
        && entityField.enumValues
        && hasUniqueStrings(entityField.enumValues)
        && typeof supplied === "string"
        && entityField.enumValues.includes(supplied),
      );
      if (valid && enumValid) return;
      context.addIssue({
        code: "custom",
        path: [...path, field.name],
        message: `PRODUCT_SPEC_V2_EVIDENCE_VALUE_INVALID: ${action.id}.${field.name} does not satisfy ${field.valueType}`,
      });
    });
  };

  const routeById = new Map(value.routes.map((route) => [route.id, route] as const));
  const surfaceById = new Map(value.surfaces.map((surface) => [surface.id, surface] as const));
  const slotOwnerById = new Map(value.actions.flatMap((action) =>
    action.controlPlacements.map((placement) => [placement.id, action.id] as const)));

  const cliInvocations = value.actions.flatMap((action, actionIndex) =>
    action.invocationInterface.kind === "cli_command"
      ? [{ actionIndex, actionRef: action.id, tokens: action.invocationInterface.subcommandTokens }]
      : []).sort((left, right) =>
        compareCliInvocationTokenSequencesV1(left.tokens, right.tokens)
        || compareInvocationTextCodeUnitsV1(left.actionRef, right.actionRef));
  for (let index = 1; index < cliInvocations.length; index += 1) {
    const previous = cliInvocations[index - 1]!;
    const current = cliInvocations[index]!;
    if (!cliInvocationTokenSequencesOverlapV1(previous.tokens, current.tokens)) continue;
    context.addIssue({
      code: "custom",
      path: ["actions", current.actionIndex, "invocationInterface", "subcommandTokens"],
      message: `PRODUCT_SPEC_V2_CLI_INVOCATION_IDENTITY_COLLISION: ${previous.actionRef} and ${current.actionRef} have overlapping command prefixes`,
    });
    break;
  }

  const httpInvocationActionIndex = new Map<string, number>();
  const httpInvocations = value.actions.flatMap((action, actionIndex) => {
    if (action.invocationInterface.kind !== "http_request") return [];
    const route = routeById.get(action.invocationInterface.routeRef);
    if (!route) return [];
    httpInvocationActionIndex.set(action.id, actionIndex);
    return [{
      identity: action.id,
      method: action.invocationInterface.method,
      path: route.path,
    }];
  });
  const httpCollision = findHttpInvocationRouteCollisionV1(httpInvocations);
  if (httpCollision.status === "collision") {
    context.addIssue({
      code: "custom",
      path: ["actions", httpInvocationActionIndex.get(httpCollision.rightIdentity)!, "invocationInterface"],
      message: `PRODUCT_SPEC_V2_HTTP_INVOCATION_IDENTITY_COLLISION: ${httpCollision.leftIdentity} ${httpCollision.method} ${httpCollision.leftPath} overlaps ${httpCollision.rightIdentity} ${httpCollision.rightPath}`,
    });
  } else if (httpCollision.status === "budget_exceeded") {
    context.addIssue({
      code: "custom",
      path: ["actions"],
      message: `PRODUCT_SPEC_V2_HTTP_INVOCATION_COMPARISON_BUDGET_EXCEEDED: route overlap proof exceeded ${httpCollision.comparisons - 1} comparisons`,
    });
  }

  value.persistencePolicies.forEach((policy, policyIndex) => {
    policy.entityRefs.forEach((entityRef, entityIndex) => {
      requireRef(
        entityIds,
        entityRef,
        ["persistencePolicies", policyIndex, "entityRefs", entityIndex],
        "persistence entity ref",
      );
    });
    if (policy.rehydration.kind !== "action") return;
    const actionRef = policy.rehydration.actionRef;
    requireRef(
      actionIds,
      actionRef,
      ["persistencePolicies", policyIndex, "rehydration", "actionRef"],
      "rehydration action ref",
    );
    const action = actionById.get(actionRef);
    if (!action) return;
    if (action.trigger.kind !== "system" && action.trigger.kind !== "route") {
      context.addIssue({
        code: "custom",
        path: ["persistencePolicies", policyIndex, "rehydration", "actionRef"],
        message: "PRODUCT_SPEC_V2_REHYDRATION_TRIGGER_INVALID: rehydration actions require a system or route trigger",
      });
    }
    if (!action.persistenceEffects.some((effect) =>
      effect.policyRef === policy.id && effect.operation === "read")) {
      context.addIssue({
        code: "custom",
        path: ["persistencePolicies", policyIndex, "rehydration", "actionRef"],
        message: "PRODUCT_SPEC_V2_REHYDRATION_READ_MISSING: rehydration actions require an exact read effect for the policy",
      });
    }
  });

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
    const inputFields = new Set(action.input.fields.map((field) => field.name));
    const invocationInputFields = new Set(
      action.invocationInterface.kind === "cli_command"
      || action.invocationInterface.kind === "http_request"
        ? action.invocationInterface.fieldBindings.map((binding) => binding.fieldName)
        : [],
    );
    const stateDeltaInputFields = new Set<string>();

    action.input.fields.forEach((field, fieldIndex) => {
      if (field.valueType === "enum" && !field.entityFieldRef) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "input", "fields", fieldIndex, "entityFieldRef"],
          message: `PRODUCT_SPEC_V2_ENUM_INPUT_AUTHORITY_MISSING: ${action.id}.${field.name} requires an exact enum entity field authority`,
        });
      }
      if (!field.entityFieldRef) return;
      requireRef(
        entityFieldIds,
        field.entityFieldRef,
        ["actions", actionIndex, "input", "fields", fieldIndex, "entityFieldRef"],
        "entity field ref",
      );
      const entityField = entityFieldById.get(field.entityFieldRef);
      if (entityField && entityField.valueType !== field.valueType) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "input", "fields", fieldIndex, "valueType"],
          message: `PRODUCT_SPEC_V2_ACTION_ENTITY_FIELD_TYPE_MISMATCH: ${action.id}.${field.name} declares ${field.valueType}, but ${field.entityFieldRef} declares ${entityField.valueType}`,
        });
      }
      if (
        field.valueType === "enum"
        && entityField
        && (
          entityField.valueType !== "enum"
          || !entityField.enumValues
          || !hasUniqueStrings(entityField.enumValues)
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "input", "fields", fieldIndex, "entityFieldRef"],
          message: `PRODUCT_SPEC_V2_ENUM_INPUT_AUTHORITY_INVALID: ${field.entityFieldRef} must provide a unique exact enum domain`,
        });
      }
    });
    action.preconditions.forEach((condition, conditionIndex) => {
      requireRef(
        stateIds,
        condition.stateRef,
        ["actions", actionIndex, "preconditions", conditionIndex, "stateRef"],
        "precondition state ref",
      );
    });

    const expectedTargetFields = [...inputFields].sort();
    const suppliedTargetFields = Object.keys(action.evidenceScenario.targetInputValues).sort();
    if (
      expectedTargetFields.length !== suppliedTargetFields.length
      || expectedTargetFields.some((field, index) => field !== suppliedTargetFields[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "evidenceScenario", "targetInputValues"],
        message: `PRODUCT_SPEC_V2_EVIDENCE_INPUT_CLOSURE: target inputs must exactly equal action inputs for ${action.id}`,
      });
    }
    validateScenarioInputTypes(
      action,
      action.evidenceScenario.targetInputValues,
      ["actions", actionIndex, "evidenceScenario", "targetInputValues"],
    );

    action.evidenceScenario.prerequisiteSteps.forEach((step, stepIndex) => {
      requireRef(
        actionIds,
        step.actionRef,
        ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "actionRef"],
        "scenario action ref",
      );
      if (step.actionRef === action.id) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "actionRef"],
          message: "PRODUCT_SPEC_V2_EVIDENCE_SELF_PREREQUISITE: an evidence scenario cannot invoke its target action as a prerequisite",
        });
      }
      const prerequisite = actionById.get(step.actionRef);
      if (!prerequisite) return;
      const expectedFields = prerequisite.input.fields.map((field) => field.name).sort();
      const suppliedFields = Object.keys(step.inputValues).sort();
      if (
        expectedFields.length !== suppliedFields.length
        || expectedFields.some((field, index) => field !== suppliedFields[index])
      ) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "inputValues"],
          message: `PRODUCT_SPEC_V2_EVIDENCE_PREREQUISITE_INPUT_CLOSURE: inputs must exactly equal action inputs for ${step.actionRef}`,
        });
      }
      validateScenarioInputTypes(
        prerequisite,
        step.inputValues,
        ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "inputValues"],
      );
    });

    action.stateDeltas.forEach((delta, deltaIndex) => {
      requireRef(
        stateIds,
        delta.stateRef,
        ["actions", actionIndex, "stateDeltas", deltaIndex, "stateRef"],
        "state delta state ref",
      );
      if (delta.valueFrom.kind === "input") {
        stateDeltaInputFields.add(delta.valueFrom.field);
        if (!inputFields.has(delta.valueFrom.field)) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "stateDeltas", deltaIndex, "valueFrom", "field"],
            message: `PRODUCT_SPEC_V2_ACTION_INPUT_UNRESOLVED: ${delta.valueFrom.field}`,
          });
        }
      }
      if (delta.valueFrom.kind === "inputs") {
        delta.valueFrom.fields.forEach((field, fieldIndex) => {
          stateDeltaInputFields.add(field);
          if (inputFields.has(field)) return;
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "stateDeltas", deltaIndex, "valueFrom", "fields", fieldIndex],
            message: `PRODUCT_SPEC_V2_ACTION_INPUT_UNRESOLVED: ${field}`,
          });
        });
      }
      if (delta.valueFrom.kind === "state") {
        requireRef(
          stateIds,
          delta.valueFrom.stateRef,
          ["actions", actionIndex, "stateDeltas", deltaIndex, "valueFrom", "stateRef"],
          "state value source ref",
        );
      }
      if (delta.valueFrom.kind === "entity_field") {
        requireRef(
          entityIds,
          delta.valueFrom.entityRef,
          ["actions", actionIndex, "stateDeltas", deltaIndex, "valueFrom", "entityRef"],
          "entity value source ref",
        );
        requireRef(
          entityFieldIds,
          delta.valueFrom.fieldRef,
          ["actions", actionIndex, "stateDeltas", deltaIndex, "valueFrom", "fieldRef"],
          "entity field value source ref",
        );
        const fieldOwner = entityOwnerByFieldId.get(delta.valueFrom.fieldRef);
        if (fieldOwner && fieldOwner !== delta.valueFrom.entityRef) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "stateDeltas", deltaIndex, "valueFrom", "fieldRef"],
            message: `PRODUCT_SPEC_V2_ENTITY_FIELD_OWNER_MISMATCH: ${delta.valueFrom.fieldRef} belongs to ${fieldOwner}, not ${delta.valueFrom.entityRef}`,
          });
        }
      }
    });
    action.input.fields.forEach((field, fieldIndex) => {
      if (stateDeltaInputFields.has(field.name) || invocationInputFields.has(field.name)) return;
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "input", "fields", fieldIndex, "name"],
        message: `PRODUCT_SPEC_V2_ACTION_INPUT_UNUSED: ${action.id}.${field.name} must feed an exact state delta`,
      });
    });

    if (action.navigation.kind === "route") {
      requireRef(
        new Set(routeById.keys()),
        action.navigation.routeRef,
        ["actions", actionIndex, "navigation", "routeRef"],
        "navigation route ref",
      );
    }
    action.persistenceEffects.forEach((effect, effectIndex) => {
      requireRef(
        persistenceIds,
        effect.policyRef,
        ["actions", actionIndex, "persistenceEffects", effectIndex, "policyRef"],
        "persistence policy ref",
      );
      if (effect.entityRef) {
        requireRef(
          entityIds,
          effect.entityRef,
          ["actions", actionIndex, "persistenceEffects", effectIndex, "entityRef"],
          "persistence entity ref",
        );
        const policy = persistenceById.get(effect.policyRef);
        if (policy && !policy.entityRefs.includes(effect.entityRef)) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "persistenceEffects", effectIndex, "entityRef"],
            message: `PRODUCT_SPEC_V2_PERSISTENCE_ENTITY_OUTSIDE_POLICY: ${effect.entityRef} is not owned by ${effect.policyRef}`,
          });
        }
      }
      effect.statePaths.forEach((statePath, statePathIndex) => {
        requireRef(
          stateIds,
          statePath.stateRef,
          ["actions", actionIndex, "persistenceEffects", effectIndex, "statePaths", statePathIndex, "stateRef"],
          "persistence state ref",
        );
        if (
          effect.operation !== "read"
          && !action.stateDeltas.some((delta) =>
            delta.stateRef === statePath.stateRef && delta.path === statePath.path)
        ) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "persistenceEffects", effectIndex, "statePaths", statePathIndex],
            message: "PRODUCT_SPEC_V2_PERSISTENCE_DELTA_MISSING: write state paths must name an exact state delta from the same action",
          });
        }
      });
      effect.payloadFields.forEach((field, fieldIndex) => {
        if (inputFields.has(field)) return;
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "persistenceEffects", effectIndex, "payloadFields", fieldIndex],
          message: `PRODUCT_SPEC_V2_ACTION_INPUT_UNRESOLVED: ${field}`,
        });
      });
    });

    const durableWrite = action.persistenceEffects.some((effect) => {
      if (effect.operation === "read") return false;
      const policy = persistenceById.get(effect.policyRef);
      return Boolean(policy && ["reload", "restart", "durable"].includes(policy.durability));
    });
    if (durableWrite && !action.observableEffects.some((effect) =>
      effect.assertions.some((assertion) => assertion.phase === "reload"))) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "observableEffects"],
        message: "PRODUCT_SPEC_V2_DURABLE_RELOAD_EVIDENCE_MISSING: durable writes require an exact reload assertion",
      });
    }

    for (const [outcomeName, outcome] of [
      ["success", action.success],
      ["failure", action.failure],
    ] as const) {
      outcome.stateRefs.forEach((stateRef, stateIndex) => requireRef(
        stateIds,
        stateRef,
        ["actions", actionIndex, outcomeName, "stateRefs", stateIndex],
        "outcome state ref",
      ));
      outcome.persistenceRefs?.forEach((persistenceRef, persistenceIndex) => requireRef(
        persistenceIds,
        persistenceRef,
        ["actions", actionIndex, outcomeName, "persistenceRefs", persistenceIndex],
        "outcome persistence ref",
      ));
      outcome.evidenceRefs.forEach((evidenceRef, evidenceIndex) => {
        requireRef(
          evidenceIds,
          evidenceRef,
          ["actions", actionIndex, outcomeName, "evidenceRefs", evidenceIndex],
          "outcome evidence ref",
        );
        if (action.evidenceRefs.includes(evidenceRef)) return;
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, outcomeName, "evidenceRefs", evidenceIndex],
          message: "PRODUCT_SPEC_V2_OUTCOME_EVIDENCE_NOT_OWNED: outcome evidence must be owned by the action",
        });
      });
    }
    action.evidenceRefs.forEach((evidenceRef, evidenceIndex) => requireRef(
      evidenceIds,
      evidenceRef,
      ["actions", actionIndex, "evidenceRefs", evidenceIndex],
      "action evidence ref",
    ));

    const platform = value.delivery.platform;
    if (action.invocationInterface.kind === "cli_command" && platform !== "cli") {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "invocationInterface", "kind"],
        message: `PRODUCT_SPEC_INVOCATION_DELIVERY_MISMATCH: cli_command requires cli delivery, observed ${platform}`,
      });
    }
    if (action.invocationInterface.kind === "http_request" && platform !== "api") {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "invocationInterface", "kind"],
        message: `PRODUCT_SPEC_INVOCATION_DELIVERY_MISMATCH: http_request requires api delivery, observed ${platform}`,
      });
    }
    if (
      action.invocationInterface.kind === "rendered_control"
      && !["web", "mobile", "desktop", "game"].includes(platform)
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "invocationInterface", "kind"],
        message: `PRODUCT_SPEC_INVOCATION_DELIVERY_MISMATCH: rendered_control is not valid for ${platform} delivery`,
      });
    }
    if (
      action.invocationInterface.kind === "route_entry"
      && !["web", "mobile", "desktop", "game"].includes(platform)
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "invocationInterface", "kind"],
        message: `PRODUCT_SPEC_INVOCATION_DELIVERY_MISMATCH: route_entry is not valid for ${platform} delivery`,
      });
    }

    if (action.invocationInterface.kind === "http_request") {
      const route = routeById.get(action.invocationInterface.routeRef);
      if (!route) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "invocationInterface", "routeRef"],
          message: `PRODUCT_SPEC_INVOCATION_ROUTE_UNRESOLVED: ${action.invocationInterface.routeRef}`,
        });
      } else {
        if (!isSafeHttpInvocationRoutePathV1(route.path)) {
          context.addIssue({
            code: "custom",
            path: ["routes", value.routes.indexOf(route), "path"],
            message: `PRODUCT_SPEC_HTTP_ROUTE_PATH_UNSAFE: ${route.path}`,
          });
        }
        const expected = httpRouteParameterNamesV1(route.path);
        const observed = action.invocationInterface.fieldBindings.flatMap((binding) =>
          binding.channel.kind === "path_parameter" ? [binding.channel.name] : []);
        if (
          expected === null
          || !hasUniqueStrings(expected)
          || expected.length !== observed.length
          || expected.some((name) => !observed.includes(name))
        ) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionIndex, "invocationInterface", "fieldBindings"],
            message: `PRODUCT_SPEC_HTTP_PATH_PARAMETER_CLOSURE: ${route.path}`,
          });
        }
      }
    }
    if (
      action.invocationInterface.kind === "route_entry"
      && !routeById.has(action.invocationInterface.routeRef)
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "invocationInterface", "routeRef"],
        message: `PRODUCT_SPEC_INVOCATION_ROUTE_UNRESOLVED: ${action.invocationInterface.routeRef}`,
      });
    }

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
      requireRef(
        evidenceIds,
        effect.evidenceRef,
        ["actions", actionIndex, "observableEffects", effectIndex, "evidenceRef"],
        "observable evidence ref",
      );
      if (!action.evidenceRefs.includes(effect.evidenceRef)) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "observableEffects", effectIndex, "evidenceRef"],
          message: "PRODUCT_SPEC_V2_OBSERVABLE_EVIDENCE_NOT_OWNED: observable evidence must be included in the owning action evidence refs",
        });
      }
      const predicate = evidenceById.get(effect.evidenceRef);
      if (predicate && (
        predicate.kind !== "observable_outcome"
        || predicate.subjectRef !== effect.id
      )) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "observableEffects", effectIndex, "evidenceRef"],
          message: "PRODUCT_SPEC_V2_OBSERVABLE_EVIDENCE_MISMATCH: evidence must be an observable_outcome predicate for the exact effect",
        });
      }
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
      if (selector.kind === "invocation_output") {
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

  const prerequisiteCycle = findPrerequisiteCycleV2(value.actions);
  if (prerequisiteCycle) {
    context.addIssue({
      code: "custom",
      path: ["actions"],
      message: `PRODUCT_SPEC_V2_PREREQUISITE_CYCLE: ${prerequisiteCycle.join(" -> ")}`,
    });
  }

  const evidenceSubjects = new Set<string>([
    ...actionIds,
    ...routeById.keys(),
    ...surfaceById.keys(),
    ...stateIds,
    ...persistenceIds,
    ...entityIds,
    ...observableIds,
  ]);
  value.evidencePredicates.forEach((predicate, predicateIndex) => {
    requireRef(
      evidenceSubjects,
      predicate.subjectRef,
      ["evidencePredicates", predicateIndex, "subjectRef"],
      "evidence subject",
    );
    if (predicate.kind === "action_invocation" && !actionIds.has(predicate.subjectRef)) {
      context.addIssue({
        code: "custom",
        path: ["evidencePredicates", predicateIndex, "subjectRef"],
        message: `PRODUCT_SPEC_ACTION_INVOCATION_SUBJECT_UNRESOLVED: ${predicate.subjectRef}`,
      });
    }
    if (predicate.kind !== "persistence_round_trip") return;
    if (!persistenceIds.has(predicate.subjectRef)) {
      context.addIssue({
        code: "custom",
        path: ["evidencePredicates", predicateIndex, "subjectRef"],
        message: `PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_SUBJECT_INVALID: ${predicate.subjectRef} must name one exact persistence policy`,
      });
    }
    const owners = actionOwnersByEvidenceId.get(predicate.id) ?? [];
    if (owners.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["evidencePredicates", predicateIndex, "id"],
        message: `PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_OWNER_CARDINALITY: ${predicate.id} must be owned through evidenceRefs by exactly one action; observed ${owners.length}`,
      });
      return;
    }
    if (
      persistenceIds.has(predicate.subjectRef)
      && !owners[0]!.persistenceEffects.some((effect) => effect.policyRef === predicate.subjectRef)
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidencePredicates", predicateIndex, "subjectRef"],
        message: `PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_EFFECT_MISSING: ${owners[0]!.id} has no persistence effect for ${predicate.subjectRef}`,
      });
    }
    if (
      !owners[0]!.success.evidenceRefs.includes(predicate.id)
      || owners[0]!.failure.evidenceRefs.includes(predicate.id)
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidencePredicates", predicateIndex, "id"],
        message: `PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_OUTCOME_CLOSURE: ${owners[0]!.id} success must claim ${predicate.id} and failure must not claim it`,
      });
    }
    if (
      !(owners[0]!.success.persistenceRefs ?? []).includes(predicate.subjectRef)
      || (owners[0]!.failure.persistenceRefs ?? []).includes(predicate.subjectRef)
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidencePredicates", predicateIndex, "subjectRef"],
        message: `PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_PERSISTENCE_OUTCOME_CLOSURE: ${owners[0]!.id} success must claim ${predicate.subjectRef} and failure must not claim it`,
      });
    }
    if (persistenceIds.has(predicate.subjectRef)) {
      const expectedId = derivePersistenceRoundTripEvidenceIdV2(
        owners[0]!.id,
        predicate.subjectRef,
      );
      if (predicate.id !== expectedId) {
        context.addIssue({
          code: "custom",
          path: ["evidencePredicates", predicateIndex, "id"],
          message: `PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_ID_MISMATCH: expected ${expectedId}`,
        });
      }
    }
  });
  value.evidencePredicates.forEach((predicate, predicateIndex) => {
    if (predicate.kind !== "action_invocation" || !actionIds.has(predicate.subjectRef)) return;
    const expectedId = deriveActionInvocationEvidenceIdV2(predicate.subjectRef);
    if (predicate.id === expectedId) return;
    context.addIssue({
      code: "custom",
      path: ["evidencePredicates", predicateIndex, "id"],
      message: `PRODUCT_SPEC_ACTION_INVOCATION_ID_MISMATCH: expected ${expectedId}`,
    });
  });
  const invocationEvidenceById = new Map(value.evidencePredicates
    .filter((predicate) => predicate.kind === "action_invocation")
    .map((predicate) => [predicate.id, predicate] as const));
  const invocationPredicatesByAction = new Map<string, EvidencePredicateV2[]>();
  for (const predicate of invocationEvidenceById.values()) {
    const owned = invocationPredicatesByAction.get(predicate.subjectRef) ?? [];
    owned.push(predicate);
    invocationPredicatesByAction.set(predicate.subjectRef, owned);
  }
  value.actions.forEach((action, actionIndex) => {
    const invocationPredicates = invocationPredicatesByAction.get(action.id) ?? [];
    if (invocationPredicates.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "evidenceRefs"],
        message: `PRODUCT_SPEC_ACTION_INVOCATION_CARDINALITY: ${action.id} requires exactly one action_invocation predicate`,
      });
      return;
    }
    const invocationEvidenceRef = invocationPredicates[0]!.id;
    const ownedInvocationRefs = action.evidenceRefs.filter((reference) =>
      invocationEvidenceById.has(reference));
    const successInvocationRefs = action.success.evidenceRefs.filter((reference) =>
      invocationEvidenceById.has(reference));
    const failureInvocationRefs = action.failure.evidenceRefs.filter((reference) =>
      invocationEvidenceById.has(reference));
    if (
      ownedInvocationRefs.length !== 1
      || ownedInvocationRefs[0] !== invocationEvidenceRef
      || successInvocationRefs.length !== 1
      || successInvocationRefs[0] !== invocationEvidenceRef
      || failureInvocationRefs.length !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "evidenceRefs"],
        message: `PRODUCT_SPEC_ACTION_INVOCATION_EVIDENCE_CLOSURE: ${action.id} must own exactly ${invocationEvidenceRef}, success must require it, and failure must not claim it`,
      });
    }
  });

  if (["web", "mobile", "desktop", "game"].includes(value.delivery.platform)) {
    const invocationEvidenceIds = new Set(invocationEvidenceById.keys());
    const withoutInvocationEvidence = (references: readonly string[]) =>
      references.filter((reference) => !invocationEvidenceIds.has(reference));
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
          invocationInterface: _invocationInterface,
          evidenceScenario,
          observableEffects,
          evidenceRefs,
          success,
          failure,
          ...stableAction
        } = action;
        const { controlSlotRef: _controlSlotRef, ...stableEvidenceScenario } = evidenceScenario;
        return {
          ...stableAction,
          surfaceRefs: [...new Set([
            ...controlPlacements.map((placement) => placement.surfaceRef),
            ...affectedSurfaceRefs,
          ])],
          evidenceRefs: withoutInvocationEvidence(evidenceRefs),
          success: {
            ...success,
            evidenceRefs: withoutInvocationEvidence(success.evidenceRefs),
          },
          failure: {
            ...failure,
            evidenceRefs: withoutInvocationEvidence(failure.evidenceRefs),
          },
          evidenceScenario: stableEvidenceScenario,
          observableEffects: observableEffects.flatMap((effect) => {
            if (effect.selector.kind === "invocation_output") return [];
            return [{
              ...effect,
              selector: effect.selector.kind === "control"
                ? { kind: "control" as const, actionRef: action.id }
                : effect.selector,
            }];
          }),
        };
      }),
      evidencePredicates: value.evidencePredicates.filter((predicate) =>
        predicate.kind !== "action_invocation"),
      assumptions: value.assumptions,
    });
    if (!v1Compatibility.success) {
      v1Compatibility.error.issues.forEach((issue) => context.addIssue({
        code: "custom",
        path: issue.path,
        message: `PRODUCT_SPEC_V2_BASE_CONTRACT_INVALID: ${issue.message}`,
      }));
    }
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
  const observedBindingKeySet = new Set(observedBindingKeys);
  const bindingByKey = new Map(value.traceability.bindings.map((binding) =>
    [`${binding.semanticKind}\0${binding.semanticRef}`, binding] as const));
  const bindingsByRequirement = new Map<string, RequirementBindingV2[]>();
  value.traceability.bindings.forEach((binding) => {
    binding.requirementRefs.forEach((requirementRef) => {
      const owned = bindingsByRequirement.get(requirementRef) ?? [];
      owned.push(binding);
      bindingsByRequirement.set(requirementRef, owned);
    });
  });
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
  value.actions.forEach((action, actionIndex) => {
    const invocationPredicate = invocationPredicatesByAction.get(action.id)?.[0];
    if (!invocationPredicate) return;
    const actionBinding = bindingByKey.get(`action\0${action.id}`);
    const evidenceBinding = bindingByKey.get(`evidence\0${invocationPredicate.id}`);
    if (!actionBinding || !evidenceBinding) return;
    const actionRequirements = [...actionBinding.requirementRefs].sort();
    const evidenceRequirements = [...evidenceBinding.requirementRefs].sort();
    if (
      actionRequirements.length !== evidenceRequirements.length
      || actionRequirements.some((reference, index) => reference !== evidenceRequirements[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "evidenceRefs"],
        message: `PRODUCT_SPEC_ACTION_INVOCATION_TRACEABILITY_MISMATCH: ${invocationPredicate.id} must carry the exact action requirement set`,
      });
    }
  });
  semanticRefs.forEach((semantic) => {
    const bindingKey = `${semantic.semanticKind}\0${semantic.semanticRef}`;
    if (!observedBindingKeySet.has(bindingKey)) {
      context.addIssue({
        code: "custom",
        path: ["traceability", "bindings"],
        message: `ProductSpec semantic artifact has no requirement binding: ${semantic.semanticKind}:${semantic.semanticRef}`,
      });
    }
  });
  value.requirements.forEach((requirement, requirementIndex) => {
    const bindings = bindingsByRequirement.get(requirement.id) ?? [];
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

export const ProductSpecV2EnglishWriteSchema = ProductSpecV2Schema.superRefine(
  (value, context) => {
    if (value.delivery.uiLanguage !== "English") {
      context.addIssue({
        code: "custom",
        path: ["delivery", "uiLanguage"],
        message: "PRODUCT_SPEC_V2_UI_LANGUAGE_MUST_BE_ENGLISH",
      });
    }
    const englishTreeIssues = inspectEnglishTextTreeV1(value, {
      lexicalPathPatterns: PRODUCT_SPEC_V1_ENGLISH_PROSE_PATHS,
      opaquePathPatterns: PRODUCT_SPEC_V1_OPAQUE_SOURCE_EVIDENCE_PATHS,
    });
    englishTreeIssues.forEach((issue) => context.addIssue({
      code: "custom",
      path: [...issue.path],
      message: `PRODUCT_SPEC_V2_ENGLISH_TEXT_REQUIRED: ${englishTextViolationMessageV1(issue)}`,
    }));
    if (englishTreeIssues.some((issue) => issue.code === "ENGLISH_TEXT_TREE_LIMIT_EXCEEDED")
      || englishTreeIssues.length >= ENGLISH_TEXT_TREE_MAX_ISSUES_V1) return;
    let visibleTextValues = 0;
    let visibleTextCodeUnits = 0;
    let englishIssueCount = englishTreeIssues.length;
    visibleTextScan: for (let actionIndex = 0; actionIndex < value.actions.length; actionIndex += 1) {
      const action = value.actions[actionIndex]!;
      for (let effectIndex = 0; effectIndex < action.observableEffects.length; effectIndex += 1) {
        const effect = action.observableEffects[effectIndex]!;
        for (let assertionIndex = 0; assertionIndex < effect.assertions.length; assertionIndex += 1) {
          const assertion = effect.assertions[assertionIndex]!;
          if (assertion.property !== "visible_text" || typeof assertion.expected !== "string") continue;
          visibleTextValues += 1;
          visibleTextCodeUnits += assertion.expected.length;
          const path = [
            "actions",
            actionIndex,
            "observableEffects",
            effectIndex,
            "assertions",
            assertionIndex,
            "expected",
          ];
          if (visibleTextValues > ENGLISH_TEXT_TREE_MAX_VALUES_V1
            || visibleTextCodeUnits > ENGLISH_TEXT_TREE_MAX_CODE_UNITS_V1) {
            context.addIssue({
              code: "custom",
              path,
              message: "PRODUCT_SPEC_V2_ENGLISH_TEXT_REQUIRED: ENGLISH_TEXT_TREE_LIMIT_EXCEEDED",
            });
            break visibleTextScan;
          }
          const issue = inspectEnglishTextV1(assertion.expected);
          if (!issue) continue;
          context.addIssue({
            code: "custom",
            path,
            message: `PRODUCT_SPEC_V2_ENGLISH_TEXT_REQUIRED: ${englishTextViolationMessageV1(issue)}`,
          });
          englishIssueCount += 1;
          if (englishIssueCount >= ENGLISH_TEXT_TREE_MAX_ISSUES_V1) break visibleTextScan;
        }
      }
    }
  },
);

export type ProductSpecV2EnglishWrite = z.infer<typeof ProductSpecV2EnglishWriteSchema>;

/**
 * Explicit product-semantics authority accepted by shared topology/runtime
 * projections. This is a version union, never a compatibility conversion:
 * callers retain the exact v1 or v2 payload and its schema identity.
 */
export const ProductSpecV1OrV2Schema = z.union([
  ProductSpecV2Schema,
  ProductSpecV1Schema,
]);

export type ProductSpecV1OrV2 = ProductSpecV1 | ProductSpecV2;
