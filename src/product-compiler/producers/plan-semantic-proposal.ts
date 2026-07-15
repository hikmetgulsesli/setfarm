import { createHash } from "node:crypto";
import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  resolveProductDeliverySelectionV1,
  type ProductDeliverySelectionV1,
} from "../product-delivery-profile-catalog.js";
import { extractTaskRequirementLedgerV1 } from "../requirements/task-requirements-v1.js";
import {
  PlanSemanticProposalV1Schema,
  type PlanSemanticProposalV1,
} from "../schemas/plan-semantic-proposal-v1.js";
import type { ProductSpecV3Proposal } from "../schemas/product-spec-v1.js";
import type {
  CompilerOwnedPersistenceProjectionEvidenceV1,
} from "./compiler-owned-persistence-projection.js";
import {
  canonicalizeProductSpecV3Proposal,
  type ProductSpecProposalDiagnosticV1,
} from "./plan-product-spec-proposal.js";

export type CompiledPlanSemanticProposalV1 = Readonly<{
  status: "canonicalized";
  semanticProposal: PlanSemanticProposalV1;
  semanticProposalHash: string;
  productSpec: ProductSpecV3Proposal;
  canonicalBytes: string;
  sourceTaskHash: string;
  deliverySelection: ProductDeliverySelectionV1;
  deliverySelectionHash: string;
  deliverySelectionCanonicalBytes: string;
  persistenceProjectionEvidence: CompilerOwnedPersistenceProjectionEvidenceV1;
}>;

export type PlanSemanticProposalCompilerResultV1 =
  | CompiledPlanSemanticProposalV1
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ProductSpecProposalDiagnosticV1[];
    }>;

function diagnostic(
  code: string,
  path: string,
  message: string,
  reference?: string,
): ProductSpecProposalDiagnosticV1 {
  return { code, path, message, ...(reference ? { reference } : {}) };
}

function schemaDiagnostics(error: z.ZodError): ProductSpecProposalDiagnosticV1[] {
  return error.issues.slice(0, 200).map((issue) => diagnostic(
    "PLAN_SEMANTIC_PROPOSAL_SCHEMA_INVALID",
    issue.path.length > 0 ? `/${issue.path.join("/")}` : "",
    issue.message,
  ));
}

function stableId(prefix: string, ...keys: string[]): string {
  const token = keys.join("_").toUpperCase();
  const candidate = `${prefix}_${token}`;
  if (candidate.length <= 160) return candidate;
  const digest = createHash("sha256").update(candidate).digest("hex").slice(0, 16).toUpperCase();
  const budget = 160 - prefix.length - digest.length - 2;
  const head = token.slice(0, budget).replace(/_+$/u, "") || "SEMANTIC";
  return `${prefix}_${head}_${digest}`;
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function persistenceRuntimeProjection(
  kind: PlanSemanticProposalV1["persistencePolicies"][number]["kind"],
  delivery: ProductDeliverySelectionV1["delivery"],
  database: PlanSemanticProposalV1["product"]["database"],
): Readonly<{
  owner: "application" | "server" | "external";
  durability: "none" | "session" | "reload" | "durable";
}> {
  if (kind === "none") {
    return {
      owner: delivery.platform === "api" ? "server" : "application",
      durability: "none",
    };
  }
  if (kind === "memory") {
    return {
      owner: delivery.platform === "api" ? "server" : "application",
      durability: "session",
    };
  }
  if (kind === "local_storage") {
    return { owner: "application", durability: "reload" };
  }
  if (kind === "file") {
    return { owner: "server", durability: "durable" };
  }
  if (kind === "database") {
    return {
      owner: database === "sqlite" ? "server" : "external",
      durability: "durable",
    };
  }
  return { owner: "external", durability: "durable" };
}

function detectPrerequisiteCycle(
  proposal: PlanSemanticProposalV1,
): readonly ProductSpecProposalDiagnosticV1[] {
  const edges = new Map(proposal.actions.map((action) => [
    action.key,
    action.evidenceScenario.prerequisiteSteps.map((step) => step.actionKey),
  ] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const diagnostics: ProductSpecProposalDiagnosticV1[] = [];
  const visit = (key: string, path: readonly string[]): void => {
    if (visited.has(key) || diagnostics.length > 0) return;
    if (visiting.has(key)) {
      diagnostics.push(diagnostic(
        "PLAN_SEMANTIC_PREREQUISITE_CYCLE",
        `/actions/${path.join("/")}`,
        `Evidence prerequisite graph contains a cycle through ${key}`,
        key,
      ));
      return;
    }
    visiting.add(key);
    (edges.get(key) ?? []).forEach((next) => visit(next, [...path, next]));
    visiting.delete(key);
    visited.add(key);
  };
  proposal.actions.forEach((action) => visit(action.key, [action.key]));
  return diagnostics;
}

/**
 * Compile model-owned primary semantics into the complete ProductSpec graph.
 * No raw semantic proposal is published or consumed downstream.
 */
export function compilePlanSemanticProposalV1(input: Readonly<{
  task: string;
  proposal: unknown;
  requestedStackPackId?: string;
}>): PlanSemanticProposalCompilerResultV1 {
  let ledger;
  try {
    ledger = extractTaskRequirementLedgerV1(input.task);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "PLAN_SEMANTIC_REQUIREMENT_SOURCE_INVALID",
        "/requirements",
        error instanceof Error ? error.message : String(error),
      )],
    };
  }

  const parsed = PlanSemanticProposalV1Schema.safeParse(input.proposal);
  if (!parsed.success) return { status: "rejected", diagnostics: schemaDiagnostics(parsed.error) };
  const proposal = parsed.data;
  const diagnostics: ProductSpecProposalDiagnosticV1[] = [];
  if (proposal.sourceTaskHash !== ledger.sourceHash) {
    diagnostics.push(diagnostic(
      "PLAN_SEMANTIC_TASK_HASH_MISMATCH",
      "/sourceTaskHash",
      "Semantic proposal does not bind the exact task source hash",
    ));
  }

  const requirementById = new Map(ledger.requirements.map((requirement) => [requirement.id, requirement]));
  const classificationById = new Map(proposal.requirements.map((requirement) => [requirement.id, requirement]));
  ledger.requirements.forEach((requirement, index) => {
    if (!classificationById.has(requirement.id)) {
      diagnostics.push(diagnostic(
        "PLAN_SEMANTIC_REQUIREMENT_MISSING",
        `/requirements/${index}`,
        `Semantic proposal omitted ${requirement.id}`,
        requirement.id,
      ));
    }
  });
  proposal.requirements.forEach((requirement, index) => {
    if (!requirementById.has(requirement.id)) {
      diagnostics.push(diagnostic(
        "PLAN_SEMANTIC_REQUIREMENT_INVENTED",
        `/requirements/${index}/id`,
        `Semantic proposal invented ${requirement.id}`,
        requirement.id,
      ));
    }
  });

  const entityByKey = new Map(proposal.entities.map((item) => [item.key, item]));
  const stateByKey = new Map(proposal.states.map((item) => [item.key, item]));
  const persistenceByKey = new Map(proposal.persistencePolicies.map((item) => [item.key, item]));
  const routeByKey = new Map(proposal.routes.map((item) => [item.key, item]));
  const surfaceByKey = new Map(proposal.surfaces.map((item) => [item.key, item]));
  const actionByKey = new Map(proposal.actions.map((item) => [item.key, item]));
  const fieldByKey = new Map(proposal.entities.flatMap((entity) => entity.fields.map((field) => [
    `${entity.key}\0${field.key}`,
    field,
  ] as const)));

  const requireReference = (
    values: ReadonlyMap<string, unknown>,
    reference: string,
    path: string,
    label: string,
  ): void => {
    if (!values.has(reference)) {
      diagnostics.push(diagnostic(
        `PLAN_SEMANTIC_${label.toUpperCase()}_UNKNOWN`,
        path,
        `Unknown ${label} semantic key ${reference}`,
        reference,
      ));
    }
  };
  const requireEntityField = (entityKey: string, fieldKey: string, path: string): void => {
    requireReference(entityByKey, entityKey, `${path}/entityKey`, "entity");
    if (entityByKey.has(entityKey) && !fieldByKey.has(`${entityKey}\0${fieldKey}`)) {
      diagnostics.push(diagnostic(
        "PLAN_SEMANTIC_ENTITY_FIELD_UNKNOWN",
        `${path}/fieldKey`,
        `Unknown entity field semantic key ${entityKey}.${fieldKey}`,
        `${entityKey}.${fieldKey}`,
      ));
    }
  };
  const requireRequirementRefs = (refs: readonly string[], path: string): void => {
    refs.forEach((reference, index) => {
      if (!requirementById.has(reference)) {
        diagnostics.push(diagnostic(
          "PLAN_SEMANTIC_REQUIREMENT_REF_UNKNOWN",
          `${path}/${index}`,
          `Unknown source requirement ${reference}`,
          reference,
        ));
      }
    });
  };

  proposal.product.goals.forEach((item, index) => requireRequirementRefs(item.requirementRefs, `/product/goals/${index}/requirementRefs`));
  proposal.product.nonGoals.forEach((item, index) => requireRequirementRefs(item.requirementRefs, `/product/nonGoals/${index}/requirementRefs`));
  proposal.entities.forEach((item, index) => requireRequirementRefs(item.requirementRefs, `/entities/${index}/requirementRefs`));
  proposal.states.forEach((item, index) => requireRequirementRefs(item.requirementRefs, `/states/${index}/requirementRefs`));
  proposal.persistencePolicies.forEach((policy, policyIndex) => {
    requireRequirementRefs(policy.requirementRefs, `/persistencePolicies/${policyIndex}/requirementRefs`);
    policy.entityKeys.forEach((reference, index) => requireReference(
      entityByKey,
      reference,
      `/persistencePolicies/${policyIndex}/entityKeys/${index}`,
      "entity",
    ));
    if (policy.rehydration?.kind === "action") {
      requireReference(actionByKey, policy.rehydration.actionKey, `/persistencePolicies/${policyIndex}/rehydration/actionKey`, "action");
    }
  });
  proposal.routes.forEach((item, index) => requireRequirementRefs(item.requirementRefs, `/routes/${index}/requirementRefs`));
  proposal.surfaces.forEach((surface, index) => {
    requireRequirementRefs(surface.requirementRefs, `/surfaces/${index}/requirementRefs`);
    requireReference(routeByKey, surface.routeKey, `/surfaces/${index}/routeKey`, "route");
  });

  const usedStates = new Set<string>();
  const usedEntities = new Set<string>();
  const usedPersistence = new Set<string>();
  proposal.persistencePolicies.forEach((policy) => policy.entityKeys.forEach((key) => usedEntities.add(key)));
  proposal.actions.forEach((action, actionIndex) => {
    requireRequirementRefs(action.requirementRefs, `/actions/${actionIndex}/requirementRefs`);
    action.surfaceKeys.forEach((reference, index) => requireReference(
      surfaceByKey,
      reference,
      `/actions/${actionIndex}/surfaceKeys/${index}`,
      "surface",
    ));
    const inputNames = new Set(action.inputs.map((field) => field.name));
    const usedInputs = new Set<string>();
    action.inputs.forEach((field, fieldIndex) => {
      if (field.entityField) {
        requireEntityField(
          field.entityField.entityKey,
          field.entityField.fieldKey,
          `/actions/${actionIndex}/inputs/${fieldIndex}/entityField`,
        );
        usedEntities.add(field.entityField.entityKey);
      }
    });
    action.preconditions.forEach((condition, index) => {
      requireReference(stateByKey, condition.stateKey, `/actions/${actionIndex}/preconditions/${index}/stateKey`, "state");
      usedStates.add(condition.stateKey);
    });
    action.evidenceScenario.prerequisiteSteps.forEach((step, index) => requireReference(
      actionByKey,
      step.actionKey,
      `/actions/${actionIndex}/evidenceScenario/prerequisiteSteps/${index}/actionKey`,
      "action",
    ));
    const deltaByKey = new Map(action.stateDeltas.map((delta) => [delta.key, delta]));
    action.stateDeltas.forEach((delta, deltaIndex) => {
      requireReference(stateByKey, delta.stateKey, `/actions/${actionIndex}/stateDeltas/${deltaIndex}/stateKey`, "state");
      usedStates.add(delta.stateKey);
      if (delta.valueFrom.kind === "input") {
        usedInputs.add(delta.valueFrom.field);
        if (!inputNames.has(delta.valueFrom.field)) {
          diagnostics.push(diagnostic(
            "PLAN_SEMANTIC_ACTION_INPUT_UNKNOWN",
            `/actions/${actionIndex}/stateDeltas/${deltaIndex}/valueFrom/field`,
            `State delta references undeclared input ${delta.valueFrom.field}`,
            delta.valueFrom.field,
          ));
        }
      }
      if (delta.valueFrom.kind === "inputs") {
        delta.valueFrom.fields.forEach((field, fieldIndex) => {
          usedInputs.add(field);
          if (!inputNames.has(field)) {
            diagnostics.push(diagnostic(
              "PLAN_SEMANTIC_ACTION_INPUT_UNKNOWN",
              `/actions/${actionIndex}/stateDeltas/${deltaIndex}/valueFrom/fields/${fieldIndex}`,
              `State delta references undeclared input ${field}`,
              field,
            ));
          }
        });
      }
      if (delta.valueFrom.kind === "state") {
        requireReference(stateByKey, delta.valueFrom.stateKey, `/actions/${actionIndex}/stateDeltas/${deltaIndex}/valueFrom/stateKey`, "state");
        usedStates.add(delta.valueFrom.stateKey);
      }
      if (delta.valueFrom.kind === "entity_field") {
        requireEntityField(
          delta.valueFrom.entityKey,
          delta.valueFrom.fieldKey,
          `/actions/${actionIndex}/stateDeltas/${deltaIndex}/valueFrom`,
        );
        usedEntities.add(delta.valueFrom.entityKey);
      }
    });
    action.inputs.forEach((field, fieldIndex) => {
      if (!usedInputs.has(field.name)) {
        diagnostics.push(diagnostic(
          "PLAN_SEMANTIC_ACTION_INPUT_UNUSED",
          `/actions/${actionIndex}/inputs/${fieldIndex}/name`,
          `Action input ${action.key}.${field.name} does not feed a state delta`,
          field.name,
        ));
      }
    });
    if (action.navigation.kind === "route") {
      requireReference(routeByKey, action.navigation.routeKey, `/actions/${actionIndex}/navigation/routeKey`, "route");
    }
    action.persistenceIntents.forEach((intent, intentIndex) => {
      requireReference(persistenceByKey, intent.policyKey, `/actions/${actionIndex}/persistenceIntents/${intentIndex}/policyKey`, "persistence");
      usedPersistence.add(intent.policyKey);
      if (intent.entityKey) {
        requireReference(entityByKey, intent.entityKey, `/actions/${actionIndex}/persistenceIntents/${intentIndex}/entityKey`, "entity");
        usedEntities.add(intent.entityKey);
      }
      intent.stateDeltaKeys.forEach((reference, index) => {
        if (!deltaByKey.has(reference)) {
          diagnostics.push(diagnostic(
            "PLAN_SEMANTIC_STATE_DELTA_UNKNOWN",
            `/actions/${actionIndex}/persistenceIntents/${intentIndex}/stateDeltaKeys/${index}`,
            `Persistence intent references unknown action delta ${reference}`,
            reference,
          ));
        }
      });
    });
    action.observables.forEach((observable, observableIndex) => {
      requireRequirementRefs(observable.requirementRefs, `/actions/${actionIndex}/observables/${observableIndex}/requirementRefs`);
      if (observable.selector.kind !== "control") {
        requireReference(
          surfaceByKey,
          observable.selector.surfaceKey,
          `/actions/${actionIndex}/observables/${observableIndex}/selector/surfaceKey`,
          "surface",
        );
        if (!action.surfaceKeys.includes(observable.selector.surfaceKey)) {
          diagnostics.push(diagnostic(
            "PLAN_SEMANTIC_OBSERVABLE_SURFACE_NOT_OWNED",
            `/actions/${actionIndex}/observables/${observableIndex}/selector/surfaceKey`,
            `Observable surface ${observable.selector.surfaceKey} is not owned by action ${action.key}`,
            observable.selector.surfaceKey,
          ));
        }
      }
    });
  });
  proposal.assumptions.forEach((assumption, index) => requireRequirementRefs(
    assumption.requirementRefs,
    `/assumptions/${index}/requirementRefs`,
  ));

  proposal.states.forEach((state, index) => {
    if (!usedStates.has(state.key)) {
      diagnostics.push(diagnostic(
        "PLAN_SEMANTIC_STATE_UNOWNED",
        `/states/${index}/key`,
        `State ${state.key} has no action precondition, delta, or value-source owner`,
        state.key,
      ));
    }
  });
  proposal.entities.forEach((entity, index) => {
    if (!usedEntities.has(entity.key)) {
      diagnostics.push(diagnostic(
        "PLAN_SEMANTIC_ENTITY_UNOWNED",
        `/entities/${index}/key`,
        `Entity ${entity.key} has no persistence or action owner`,
        entity.key,
      ));
    }
  });
  proposal.persistencePolicies.forEach((policy, index) => {
    if (!usedPersistence.has(policy.key)) {
      diagnostics.push(diagnostic(
        "PLAN_SEMANTIC_PERSISTENCE_UNOWNED",
        `/persistencePolicies/${index}/key`,
        `Persistence policy ${policy.key} has no action intent owner`,
        policy.key,
      ));
    }
  });
  diagnostics.push(...detectPrerequisiteCycle(proposal));
  if (diagnostics.length > 0) return { status: "rejected", diagnostics };

  const delivery = resolveProductDeliverySelectionV1({
    productClass: proposal.product.class,
    ...(input.requestedStackPackId ? { requestedStackPackId: input.requestedStackPackId } : {}),
  });
  if (delivery.status !== "selected") {
    return { status: "rejected", diagnostics: delivery.diagnostics };
  }

  const productId = stableId("PROD", proposal.product.key);
  const entityId = (key: string): string => stableId("ENTITY", key);
  const fieldId = (entityKey: string, fieldKey: string): string => stableId("FIELD", entityKey, fieldKey);
  const stateId = (key: string): string => stableId("STATE", key);
  const persistenceId = (key: string): string => stableId("PERSIST", key);
  const routeId = (key: string): string => stableId("ROUTE", key);
  const surfaceId = (key: string): string => stableId("SURF", key);
  const actionId = (key: string): string => stableId("ACT", key);
  const observableId = (actionKey: string, key: string): string => stableId("OBS", actionKey, key);
  const evidenceId = (actionKey: string, key: string): string => stableId("EVID", actionKey, key);

  const bindings: Array<{
    semanticKind: "goal" | "non_goal" | "entity" | "state" | "persistence" | "route" | "surface" | "action" | "evidence" | "observable";
    semanticRef: string;
    requirementRefs: string[];
  }> = [];
  const bind = (
    semanticKind: typeof bindings[number]["semanticKind"],
    semanticRef: string,
    requirementRefs: readonly string[],
  ): void => {
    bindings.push({ semanticKind, semanticRef, requirementRefs: uniqueSorted(requirementRefs) });
  };

  const goals = proposal.product.goals.map((goal) => {
    const id = stableId("GOAL", goal.key);
    bind("goal", id, goal.requirementRefs);
    return { id, statement: goal.statement };
  });
  const nonGoals = proposal.product.nonGoals.map((goal) => {
    const id = stableId("NONGOAL", goal.key);
    bind("non_goal", id, goal.requirementRefs);
    return { id, statement: goal.statement };
  });
  const entities = proposal.entities.map((entity) => {
    const id = entityId(entity.key);
    bind("entity", id, entity.requirementRefs);
    return {
      id,
      name: entity.name,
      fields: entity.fields.map((field) => ({
        id: fieldId(entity.key, field.key),
        name: field.name,
        valueType: field.valueType,
        required: field.required,
        ...(field.enumValues ? { enumValues: field.enumValues } : {}),
        ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
      })),
    };
  });
  const states = proposal.states.map((state) => {
    const id = stateId(state.key);
    bind("state", id, state.requirementRefs);
    return { id, name: state.name, kind: state.kind, initialValue: state.initialValue, invariants: state.invariants };
  });
  const persistencePolicies = proposal.persistencePolicies.map((policy) => {
    const id = persistenceId(policy.key);
    const runtime = persistenceRuntimeProjection(
      policy.kind,
      delivery.selection.delivery,
      proposal.product.database,
    );
    bind("persistence", id, policy.requirementRefs);
    return {
      id,
      kind: policy.kind,
      owner: runtime.owner,
      entityRefs: policy.entityKeys.map(entityId),
      durability: runtime.durability,
      ...(policy.kind === "local_storage" ? { key: `setfarm.${proposal.product.key}.${policy.key}.v1` } : {}),
      rehydration: policy.rehydration?.kind === "action"
        ? { kind: "action" as const, actionRef: actionId(policy.rehydration.actionKey) }
        : policy.rehydration ?? { kind: "none" as const },
    };
  });
  const surfaces = proposal.surfaces.map((surface) => {
    const id = surfaceId(surface.key);
    bind("surface", id, surface.requirementRefs);
    return {
      id,
      name: surface.name,
      kind: surface.kind,
      routeRef: routeId(surface.routeKey),
      required: surface.required,
    };
  });
  const routes = proposal.routes.map((route) => {
    const id = routeId(route.key);
    bind("route", id, route.requirementRefs);
    return {
      id,
      path: route.path,
      surfaceRefs: proposal.surfaces.filter((surface) => surface.routeKey === route.key).map((surface) => surfaceId(surface.key)),
      entry: route.entry,
    };
  });

  const evidencePredicates: Array<{
    id: string;
    kind: "observable_outcome";
    required: boolean;
    subjectRef: string;
    capabilityRefs: string[];
    assertion: { operator: "passes" };
  }> = [];
  const actions = proposal.actions.map((action) => {
    const id = actionId(action.key);
    bind("action", id, action.requirementRefs);
    const deltaByKey = new Map(action.stateDeltas.map((delta) => [delta.key, delta]));
    const observables = action.observables.map((observable) => {
      const observableRef = observableId(action.key, observable.key);
      const evidenceRef = evidenceId(action.key, observable.key);
      bind("observable", observableRef, observable.requirementRefs);
      bind("evidence", evidenceRef, observable.requirementRefs);
      evidencePredicates.push({
        id: evidenceRef,
        kind: "observable_outcome",
        required: true,
        subjectRef: observableRef,
        capabilityRefs: [],
        assertion: { operator: "passes" },
      });
      const selector = observable.selector.kind === "control"
        ? { kind: "control" as const, actionRef: id }
        : observable.selector.kind === "surface"
          ? { kind: "surface" as const, surfaceRef: surfaceId(observable.selector.surfaceKey) }
          : {
              kind: "accessibility" as const,
              surfaceRef: surfaceId(observable.selector.surfaceKey),
              actionRef: id,
              role: observable.selector.role,
              name: observable.selector.name,
            };
      return {
        id: observableRef,
        selector,
        assertions: observable.assertions,
        evidenceRef,
      };
    });
    const evidenceRefs = observables.map((observable) => observable.evidenceRef);
    const stateDeltas = action.stateDeltas.map((delta) => ({
      stateRef: stateId(delta.stateKey),
      operation: delta.operation,
      path: delta.path,
      valueFrom: delta.valueFrom.kind === "state"
        ? { kind: "state" as const, stateRef: stateId(delta.valueFrom.stateKey), path: delta.valueFrom.path }
        : delta.valueFrom.kind === "entity_field"
          ? {
              kind: "entity_field" as const,
              entityRef: entityId(delta.valueFrom.entityKey),
              fieldRef: fieldId(delta.valueFrom.entityKey, delta.valueFrom.fieldKey),
            }
          : delta.valueFrom,
      ...(delta.matchField ? { matchField: delta.matchField } : {}),
    }));
    const persistenceEffects = action.persistenceIntents.map((intent) => {
      const deltas = intent.stateDeltaKeys.map((key) => deltaByKey.get(key)!);
      const payloadFields = uniqueSorted(deltas.flatMap((delta) =>
        delta.valueFrom.kind === "input"
          ? [delta.valueFrom.field]
          : delta.valueFrom.kind === "inputs"
            ? delta.valueFrom.fields
            : []));
      return {
        policyRef: persistenceId(intent.policyKey),
        operation: intent.operation,
        ...(intent.entityKey ? { entityRef: entityId(intent.entityKey) } : {}),
        payloadFields,
        statePaths: deltas.map((delta) => ({ stateRef: stateId(delta.stateKey), path: delta.path })),
      };
    });
    const stateRefs = uniqueSorted(action.stateDeltas.map((delta) => stateId(delta.stateKey)));
    const persistenceRefs = uniqueSorted(action.persistenceIntents.map((intent) => persistenceId(intent.policyKey)));
    return {
      id,
      name: action.name,
      surfaceRefs: action.surfaceKeys.map(surfaceId),
      trigger: action.trigger,
      input: {
        fields: action.inputs.map((field) => ({
          name: field.name,
          valueType: field.valueType,
          required: field.required,
          ...(field.entityField ? { entityFieldRef: fieldId(field.entityField.entityKey, field.entityField.fieldKey) } : {}),
        })),
      },
      preconditions: action.preconditions.map((condition) => ({
        stateRef: stateId(condition.stateKey),
        path: condition.path,
        operator: condition.operator,
        ...(condition.expected !== undefined ? { expected: condition.expected } : {}),
      })),
      evidenceScenario: {
        targetInputValues: action.evidenceScenario.targetInputValues,
        prerequisiteSteps: action.evidenceScenario.prerequisiteSteps.map((step) => ({
          actionRef: actionId(step.actionKey),
          inputValues: step.inputValues,
        })),
      },
      stateDeltas,
      navigation: action.navigation.kind === "route"
        ? { kind: "route" as const, routeRef: routeId(action.navigation.routeKey) }
        : action.navigation,
      persistenceEffects,
      success: { stateRefs, persistenceRefs, evidenceRefs, userVisible: evidenceRefs.length > 0 },
      failure: { stateRefs: [], persistenceRefs: [], evidenceRefs: [], userVisible: false },
      evidenceRefs,
      observableEffects: observables,
    };
  });

  const requirements = ledger.requirements.map((source) => {
    const classification = classificationById.get(source.id)!;
    return {
      ...source,
      classification: classification.classification,
      expectedSemanticKinds: uniqueSorted(classification.expectedSemanticKinds),
    };
  });
  const assumptions = proposal.assumptions.map((assumption) => ({
    id: stableId("ASSUMPTION", assumption.key),
    statement: assumption.statement,
    provenance: assumption.requirementRefs.flatMap((reference) => requirementById.get(reference)!.sources).map((source) => ({
      schema: "setfarm.provenance-ref.v1" as const,
      sourceHash: source.sourceHash,
      locator: source.locator,
      confidence: "exact" as const,
      range: {
        startLine: source.span.startLine,
        startColumn: source.span.startColumn,
        endLine: source.span.endLine,
        endColumn: source.span.endColumn,
      },
    })),
  }));

  const candidate = {
    schema: "setfarm.product-spec.v1" as const,
    product: {
      id: productId,
      name: proposal.product.name,
      class: proposal.product.class,
      goals,
      nonGoals,
    },
    entities,
    states,
    persistencePolicies,
    routes,
    surfaces,
    actions,
    evidencePredicates,
    assumptions,
    delivery: {
      platform: delivery.selection.delivery.platform,
      techStack: delivery.selection.delivery.techStack,
      uiLanguage: proposal.product.uiLanguage,
      database: proposal.product.database,
      designRequired: delivery.selection.delivery.designRequired,
      uiVisionSummary: proposal.product.uiVisionSummary,
    },
    requirements,
    traceability: {
      schema: "setfarm.product-requirement-traceability.v1" as const,
      sourceTaskHash: ledger.sourceHash,
      bindings,
    },
  };

  const canonical = canonicalizeProductSpecV3Proposal({
    task: input.task,
    proposal: candidate,
    authoritativeDelivery: {
      platform: delivery.selection.delivery.platform,
      techStack: delivery.selection.delivery.techStack,
      designRequired: delivery.selection.delivery.designRequired,
      allowedDatabases: delivery.selection.delivery.allowedDatabases,
      stackPackId: delivery.selection.stackPackId,
      evidenceCapabilityPolicyHash: delivery.selection.evidenceCapabilities.policyHash,
    },
  });
  if (canonical.status !== "canonicalized") return canonical;
  return {
    status: "canonicalized",
    semanticProposal: proposal,
    semanticProposalHash: hashCanonicalJson(proposal),
    productSpec: canonical.productSpec,
    canonicalBytes: canonical.canonicalBytes,
    sourceTaskHash: canonical.sourceTaskHash,
    deliverySelection: delivery.selection,
    deliverySelectionHash: delivery.selectionHash,
    deliverySelectionCanonicalBytes: delivery.canonicalBytes,
    persistenceProjectionEvidence: canonical.persistenceProjectionEvidence,
  };
}
