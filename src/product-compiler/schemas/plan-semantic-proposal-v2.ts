import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";

import { hasUniqueStrings } from "./common-v1.js";
import {
  ControlHintV2Schema,
  RequirementSemanticKindV2Schema,
} from "./common-v2.js";
import {
  PlanSemanticKeyV1Schema,
  PlanSemanticProposalV1Schema,
} from "./plan-semantic-proposal-v1.js";
import {
  PlanActionInvocationInterfaceIntentV1Schema,
  PlanInvocationResultValueContractV1Schema,
  addInvocationInterfaceActionIssuesV1,
  cliInvocationTokenSequencesOverlapV1,
  compareCliInvocationTokenSequencesV1,
  compareInvocationTextCodeUnitsV1,
  findHttpInvocationRouteCollisionV1,
  httpRouteParameterNamesV1,
  invocationValueMatchesTypeV1,
  isSafeHttpInvocationRoutePathV1,
} from "./action-invocation-interface-intent-v1.js";

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
  z.object({
    kind: z.literal("invocation_output"),
    coordinate: z.literal("result_value"),
    pointer: z.string().max(500).refine(
      (value) => /^(?:\/(?:[^~]|~[01])*)*$/.test(value),
      "Expected an empty or RFC 6901 JSON Pointer",
    ),
    valueContract: PlanInvocationResultValueContractV1Schema,
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
  invocationInterface: PlanActionInvocationInterfaceIntentV1Schema,
  controlPlacements: z.array(PlanControlPlacementV2Schema).max(1_000),
  affectedSurfaceKeys: z.array(PlanSemanticKeyV2Schema).max(1_000).refine(hasUniqueStrings, {
    message: "Action affected surface keys must be unique",
  }),
  evidenceScenario: z.object({
    ...PlanEvidenceScenarioV1Schema.shape,
    controlPlacementKey: PlanSemanticKeyV2Schema.optional(),
  }).strict(),
  // Reserve the inherited 500th action evidence slot for the compiler-owned
  // action_invocation predicate.
  observables: z.array(PlanObservableV2Schema).min(1).max(499),
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
  addInvocationInterfaceActionIssuesV1({
    invocationInterface: value.invocationInterface,
    inputFields: value.inputs,
    inputFieldPath: ["inputs"],
    trigger: value.trigger,
    preconditionCount: value.preconditions.length,
    controlPlacementCount: value.controlPlacements.length,
    evidenceControlRefPresent: evidencePlacement !== undefined,
    canonicalAuthority: false,
    context,
  });
  if (
    value.invocationInterface.kind !== "rendered_control"
    && value.affectedSurfaceKeys.length === 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["affectedSurfaceKeys"],
      message: "PLAN_SEMANTIC_NON_RENDERED_SURFACE_REQUIRED: non-rendered actions require at least one exact affected surface",
    });
  }
  const invocationOutputCount = value.observables.filter((observable) =>
    observable.selector.kind === "invocation_output").length;
  if (
    ["cli_command", "http_request"].includes(value.invocationInterface.kind)
    && invocationOutputCount !== value.observables.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["observables"],
      message: "PLAN_SEMANTIC_INVOCATION_OUTPUT_CLOSURE: CLI/HTTP action observables must use exact invocation-output selectors",
    });
  }
  if (
    !["cli_command", "http_request"].includes(value.invocationInterface.kind)
    && invocationOutputCount > 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["observables"],
      message: "PLAN_SEMANTIC_INVOCATION_OUTPUT_FORBIDDEN: only CLI/HTTP actions can claim invocation-output selectors",
    });
  }
  const invocationOutputPointers = value.observables.flatMap((observable) =>
    observable.selector.kind === "invocation_output" ? [observable.selector.pointer] : []);
  if (!hasUniqueStrings(invocationOutputPointers)) {
    context.addIssue({
      code: "custom",
      path: ["observables"],
      message: "PLAN_SEMANTIC_INVOCATION_OUTPUT_POINTER_DUPLICATE: output pointers must be unique within an action",
    });
  }
  value.observables.forEach((observable, observableIndex) => {
    if (observable.selector.kind !== "invocation_output") return;
    const contract = observable.selector.valueContract;
    observable.assertions.forEach((assertion, assertionIndex) => {
      if (
        assertion.property !== "value"
        || assertion.operator !== "equals"
        || assertion.expected === undefined
        || !invocationValueMatchesTypeV1(contract.valueType, assertion.expected)
      ) {
        context.addIssue({
          code: "custom",
          path: ["observables", observableIndex, "assertions", assertionIndex],
          message: `PLAN_SEMANTIC_INVOCATION_OUTPUT_ASSERTION_INVALID: ${observable.key} requires a typed equals assertion with expected data`,
        });
      }
    });
    if (contract.expectedFrom.kind === "input") {
      const source = contract.expectedFrom;
      const inputField = value.inputs.find((field) =>
        field.name === source.fieldName);
      if (!inputField || inputField.valueType !== contract.valueType) {
        context.addIssue({
          code: "custom",
          path: ["observables", observableIndex, "selector", "valueContract"],
          message: `PLAN_SEMANTIC_INVOCATION_OUTPUT_INPUT_MISMATCH: ${source.fieldName}`,
        });
      }
      const scenarioValue = value.evidenceScenario.targetInputValues[source.fieldName];
      observable.assertions.forEach((assertion, assertionIndex) => {
        if (assertion.expected === undefined || scenarioValue === undefined) return;
        if (hashCanonicalJson(assertion.expected) === hashCanonicalJson(scenarioValue)) return;
        context.addIssue({
          code: "custom",
          path: ["observables", observableIndex, "assertions", assertionIndex, "expected"],
          message: `PLAN_SEMANTIC_INVOCATION_OUTPUT_EXPECTED_FROM_INPUT_MISMATCH: ${source.fieldName}`,
        });
      });
    }
    if (contract.expectedFrom.kind === "literal") {
      const source = contract.expectedFrom;
      if (!invocationValueMatchesTypeV1(contract.valueType, source.value)) {
        context.addIssue({
          code: "custom",
          path: ["observables", observableIndex, "selector", "valueContract", "expectedFrom", "value"],
          message: `PLAN_SEMANTIC_INVOCATION_OUTPUT_LITERAL_TYPE_MISMATCH: ${observable.key}`,
        });
      }
      observable.assertions.forEach((assertion, assertionIndex) => {
        if (assertion.expected === undefined) return;
        if (hashCanonicalJson(assertion.expected) === hashCanonicalJson(source.value)) return;
        context.addIssue({
          code: "custom",
          path: ["observables", observableIndex, "assertions", assertionIndex, "expected"],
          message: `PLAN_SEMANTIC_INVOCATION_OUTPUT_LITERAL_EXPECTED_MISMATCH: ${observable.key}`,
        });
      });
    }
  });
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
  states: z.array(PlanSemanticProposalV1Schema.shape.states.element).max(500),
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

  const externalOnly = value.actions.every((action) =>
    action.invocationInterface.kind === "cli_command"
    || action.invocationInterface.kind === "http_request");
  if (value.states.length === 0 && !externalOnly) {
    context.addIssue({
      code: "custom",
      path: ["states"],
      message: "PLAN_SEMANTIC_STATE_REQUIRED: only an all-CLI/HTTP proposal may be stateless",
    });
  }
  const observableCount = value.actions.reduce(
    (total, action) => total + action.observables.length,
    0,
  );
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
    + (value.actions.length * 2)
    + controlPlacementCount
    + (observableCount * 2);
  if (observableCount > 2_000) {
    context.addIssue({
      code: "custom",
      path: ["actions"],
      message: `PLAN_SEMANTIC_OBSERVABLE_BUDGET_EXCEEDED: ${observableCount} exceeds the publishable product limit of 2000`,
    });
  }
  if (predictedTraceabilityBindings > 20_000) {
    context.addIssue({
      code: "custom",
      path: ["actions"],
      message: `PLAN_SEMANTIC_TRACEABILITY_BUDGET_EXCEEDED: compiler projection requires ${predictedTraceabilityBindings} bindings, limit 20000`,
    });
  }
  if (observableCount > 2_000 || predictedTraceabilityBindings > 20_000) return;

  const routeKeys = new Set(value.routes.map((route) => route.key));
  const stateKeys = new Set(value.states.map((state) => state.key));
  const entityByKey = new Map(value.entities.map((entity) => [entity.key, entity] as const));
  const surfaceByKey = new Map(value.surfaces.map((surface) => [surface.key, surface] as const));
  const actionByKey = new Map(value.actions.map((action) => [action.key, action] as const));

  const cliInvocations = value.actions.flatMap((action, actionIndex) =>
    action.invocationInterface.kind === "cli_command"
      ? [{ actionIndex, actionKey: action.key, tokens: action.invocationInterface.subcommandTokens }]
      : []).sort((left, right) =>
        compareCliInvocationTokenSequencesV1(left.tokens, right.tokens)
        || compareInvocationTextCodeUnitsV1(left.actionKey, right.actionKey));
  for (let index = 1; index < cliInvocations.length; index += 1) {
    const previous = cliInvocations[index - 1]!;
    const current = cliInvocations[index]!;
    if (!cliInvocationTokenSequencesOverlapV1(previous.tokens, current.tokens)) continue;
    context.addIssue({
      code: "custom",
      path: ["actions", current.actionIndex, "invocationInterface", "subcommandTokens"],
      message: `PLAN_SEMANTIC_CLI_INVOCATION_IDENTITY_COLLISION: ${previous.actionKey} and ${current.actionKey} have overlapping command prefixes`,
    });
    break;
  }

  const httpInvocationActionIndex = new Map<string, number>();
  const httpInvocations = value.actions.flatMap((action, actionIndex) => {
    if (action.invocationInterface.kind !== "http_request") return [];
    const invocationInterface = action.invocationInterface;
    const route = value.routes.find((candidate) =>
      candidate.key === invocationInterface.routeKey);
    if (!route) return [];
    httpInvocationActionIndex.set(action.key, actionIndex);
    return [{
      identity: action.key,
      method: invocationInterface.method,
      path: route.path,
    }];
  });
  const httpCollision = findHttpInvocationRouteCollisionV1(httpInvocations);
  if (httpCollision.status === "collision") {
    context.addIssue({
      code: "custom",
      path: ["actions", httpInvocationActionIndex.get(httpCollision.rightIdentity)!, "invocationInterface"],
      message: `PLAN_SEMANTIC_HTTP_INVOCATION_IDENTITY_COLLISION: ${httpCollision.leftIdentity} ${httpCollision.method} ${httpCollision.leftPath} overlaps ${httpCollision.rightIdentity} ${httpCollision.rightPath}`,
    });
  } else if (httpCollision.status === "budget_exceeded") {
    context.addIssue({
      code: "custom",
      path: ["actions"],
      message: `PLAN_SEMANTIC_HTTP_INVOCATION_COMPARISON_BUDGET_EXCEEDED: route overlap proof exceeded ${httpCollision.comparisons - 1} comparisons`,
    });
  }

  value.entities.forEach((entity, entityIndex) => {
    entity.fields.forEach((field, fieldIndex) => {
      if (field.valueType !== "enum" || !field.enumValues) return;
      if (hasUniqueStrings(field.enumValues)) return;
      context.addIssue({
        code: "custom",
        path: ["entities", entityIndex, "fields", fieldIndex, "enumValues"],
        message: `PLAN_SEMANTIC_ENUM_DOMAIN_DUPLICATE: ${entity.key}.${field.key} enum values must be unique`,
      });
    });
  });

  const validateScenarioInputTypes = (
    action: (typeof value.actions)[number],
    inputValues: Readonly<Record<string, unknown>>,
    path: PropertyKey[],
  ): void => {
    action.inputs.forEach((field) => {
      const supplied = inputValues[field.name];
      const entity = field.entityField
        ? entityByKey.get(field.entityField.entityKey)
        : undefined;
      const entityField = field.entityField
        ? entity?.fields.find((candidate) => candidate.key === field.entityField!.fieldKey)
        : undefined;
      const enumValid = field.valueType !== "enum" || Boolean(
        entityField?.valueType === "enum"
        && entityField.enumValues
        && hasUniqueStrings(entityField.enumValues)
        && typeof supplied === "string"
        && entityField.enumValues.includes(supplied),
      );
      if (invocationValueMatchesTypeV1(field.valueType, supplied) && enumValid) return;
      context.addIssue({
        code: "custom",
        path: [...path, field.name],
        message: `PLAN_SEMANTIC_EVIDENCE_VALUE_INVALID: ${action.key}.${field.name} does not satisfy ${field.valueType}`,
      });
    });
  };

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
    const invocationInterface = action.invocationInterface;

    action.inputs.forEach((field, fieldIndex) => {
      if (field.valueType === "enum" && !field.entityField) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "inputs", fieldIndex, "entityField"],
          message: `PLAN_SEMANTIC_ENUM_INPUT_AUTHORITY_MISSING: ${action.key}.${field.name} requires an exact enum entity field authority`,
        });
      }
      if (!field.entityField) return;
      const entity = entityByKey.get(field.entityField.entityKey);
      if (!entity) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "inputs", fieldIndex, "entityField", "entityKey"],
          message: `PLAN_SEMANTIC_INPUT_ENTITY_UNRESOLVED: ${field.entityField.entityKey}`,
        });
        return;
      }
      const entityField = entity.fields.find((candidate) =>
        candidate.key === field.entityField!.fieldKey);
      if (!entityField) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "inputs", fieldIndex, "entityField", "fieldKey"],
          message: `PLAN_SEMANTIC_INPUT_ENTITY_FIELD_UNRESOLVED: ${field.entityField.entityKey}.${field.entityField.fieldKey}`,
        });
        return;
      }
      if (entityField.valueType !== field.valueType) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "inputs", fieldIndex, "valueType"],
          message: `PLAN_SEMANTIC_INPUT_ENTITY_FIELD_TYPE_MISMATCH: ${action.key}.${field.name} declares ${field.valueType}, but ${field.entityField.entityKey}.${field.entityField.fieldKey} declares ${entityField.valueType}`,
        });
      }
      if (
        field.valueType === "enum"
        && (
          entityField.valueType !== "enum"
          || !entityField.enumValues
          || !hasUniqueStrings(entityField.enumValues)
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "inputs", fieldIndex, "entityField"],
          message: `PLAN_SEMANTIC_ENUM_INPUT_AUTHORITY_INVALID: ${field.entityField.entityKey}.${field.entityField.fieldKey} must provide a unique exact enum domain`,
        });
      }
    });

    const expectedTargetFields = action.inputs.map((field) => field.name).sort();
    const suppliedTargetFields = Object.keys(action.evidenceScenario.targetInputValues).sort();
    if (
      expectedTargetFields.length !== suppliedTargetFields.length
      || expectedTargetFields.some((field, index) => field !== suppliedTargetFields[index])
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "evidenceScenario", "targetInputValues"],
        message: `PLAN_SEMANTIC_EVIDENCE_INPUT_CLOSURE: target inputs must exactly equal action inputs for ${action.key}`,
      });
    }
    validateScenarioInputTypes(
      action,
      action.evidenceScenario.targetInputValues,
      ["actions", actionIndex, "evidenceScenario", "targetInputValues"],
    );
    action.evidenceScenario.prerequisiteSteps.forEach((step, stepIndex) => {
      const prerequisite = actionByKey.get(step.actionKey);
      if (!prerequisite) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "actionKey"],
          message: `PLAN_SEMANTIC_EVIDENCE_PREREQUISITE_UNRESOLVED: ${step.actionKey}`,
        });
        return;
      }
      if (step.actionKey === action.key) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "actionKey"],
          message: "PLAN_SEMANTIC_EVIDENCE_SELF_PREREQUISITE: an evidence scenario cannot invoke its target action as a prerequisite",
        });
      }
      const expectedFields = prerequisite.inputs.map((field) => field.name).sort();
      const suppliedFields = Object.keys(step.inputValues).sort();
      if (
        expectedFields.length !== suppliedFields.length
        || expectedFields.some((field, index) => field !== suppliedFields[index])
      ) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "inputValues"],
          message: `PLAN_SEMANTIC_EVIDENCE_PREREQUISITE_INPUT_CLOSURE: inputs must exactly equal action inputs for ${step.actionKey}`,
        });
      }
      validateScenarioInputTypes(
        prerequisite,
        step.inputValues,
        ["actions", actionIndex, "evidenceScenario", "prerequisiteSteps", stepIndex, "inputValues"],
      );
    });

    if (invocationInterface.kind === "http_request") {
      const route = value.routes.find((candidate) =>
        candidate.key === invocationInterface.routeKey);
      if (!route) {
        context.addIssue({
          code: "custom",
          path: ["actions", actionIndex, "invocationInterface", "routeKey"],
          message: `PLAN_SEMANTIC_INVOCATION_ROUTE_UNRESOLVED: ${invocationInterface.routeKey}`,
        });
      } else {
        if (!isSafeHttpInvocationRoutePathV1(route.path)) {
          context.addIssue({
            code: "custom",
            path: ["routes", value.routes.indexOf(route), "path"],
            message: `PLAN_SEMANTIC_HTTP_ROUTE_PATH_UNSAFE: ${route.path}`,
          });
        }
        const expected = httpRouteParameterNamesV1(route.path);
        const observed = invocationInterface.fieldBindings.flatMap((binding) =>
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
            message: `PLAN_SEMANTIC_HTTP_PATH_PARAMETER_CLOSURE: ${route.path}`,
          });
        }
      }
    }
    if (
      invocationInterface.kind === "route_entry"
      && !value.routes.some((route) => route.key === invocationInterface.routeKey)
    ) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "invocationInterface", "routeKey"],
        message: `PLAN_SEMANTIC_INVOCATION_ROUTE_UNRESOLVED: ${invocationInterface.routeKey}`,
      });
    }

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
      if (selector.kind === "invocation_output") {
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
