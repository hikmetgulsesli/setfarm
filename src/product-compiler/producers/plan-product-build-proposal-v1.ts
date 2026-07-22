import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  ProductRuntimeBehaviorProposalV1Schema,
  hashProductRuntimeBehaviorProposalV1,
  type ProductRuntimeBehaviorContractV1,
  type ProductRuntimeBehaviorProposalV1,
  type ProductRuntimeBehaviorSemanticCoverageRefV1,
} from "../schemas/product-runtime-behavior-contract-v1.js";
import {
  PLAN_PRODUCT_BUILD_AUTHORITY_SCHEMA_V1,
  PLAN_PRODUCT_BUILD_AUTHORITY_VERSION_V1,
  PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1,
  PlanProductBuildAuthorityV1Schema,
  PlanProductBuildProposalV1Schema,
  PlanProductBuildReferenceMapV1Schema,
  hashPlanProductBuildAuthorityV1,
  hashPlanProductBuildProposalV1,
  hashPlanProductBuildReferenceMapV1,
  recursivelyFreezePlanProductBuildV1,
  type PlanProductBuildAuthorityV1,
  type PlanProductBuildProposalV1,
  type PlanProductBuildReferenceMapV1,
  type PlanRuntimeBehaviorEvidenceRefV1,
  type PlanRuntimeBehaviorSemanticCoverageRefV1,
} from "../schemas/plan-product-build-proposal-v1.js";
import {
  deriveActionInvocationEvidenceIdV2,
  derivePersistenceRoundTripEvidenceIdV2,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";
import {
  compileProductRuntimeBehaviorContractV1,
} from "../product-runtime-behavior-contract-v1.js";
import {
  compilePlanSemanticProposalV2,
  derivePlanActionRefV2,
  derivePlanEntityFieldRefV2,
  derivePlanEntityRefV2,
  derivePlanObservableEvidenceRefV2,
  derivePlanObservableRefV2,
  derivePlanPersistenceRefV2,
  derivePlanStateRefV2,
} from "./plan-semantic-proposal-v2.js";
import type { ProductDeliverySelectionV1 } from "../product-delivery-profile-catalog.js";
import type {
  CompilerOwnedPersistenceProjectionEvidenceV1,
} from "./compiler-owned-persistence-projection.js";

const PLAN_PRODUCT_BUILD_INPUT_MAX_BYTES_V1 = 8 * 1024 * 1024;
const PLAN_PRODUCT_BUILD_VERIFICATION_INPUT_MAX_BYTES_V1 = 16 * 1024 * 1024;
const PLAN_PRODUCT_BUILD_OUTPUT_MAX_BYTES_V1 = 4 * 1024 * 1024;
const PLAN_PRODUCT_BUILD_MAX_DIAGNOSTICS_V1 = 100;

const CompilerInputV1Schema = z.object({
  task: z.string().min(1).max(50_000),
  proposal: z.unknown(),
  requestedStackPackId: z.string().min(1).max(160).optional(),
}).strict();

const VerifierInputV1Schema = z.object({
  task: z.string().min(1).max(50_000),
  proposal: z.unknown(),
  requestedStackPackId: z.string().min(1).max(160).optional(),
  candidate: z.unknown(),
}).strict();

export type PlanProductBuildDiagnosticV1 = Readonly<{
  code: string;
  path: string;
  message: string;
  reference?: string;
}>;

export type PlanProductBuildCompilationResultV1 =
  | Readonly<{
      status: "shadow_compiled";
      sourceEnvelope: Readonly<PlanProductBuildProposalV1>;
      semanticProposalHash: string;
      productSpec: Readonly<ProductSpecV2>;
      productSpecCanonicalBytes: string;
      deliverySelection: Readonly<ProductDeliverySelectionV1>;
      deliverySelectionHash: string;
      deliverySelectionCanonicalBytes: string;
      persistenceProjectionEvidence: Readonly<CompilerOwnedPersistenceProjectionEvidenceV1>;
      runtimeBehaviorProposal: Readonly<ProductRuntimeBehaviorProposalV1>;
      runtimeBehaviorContract: Readonly<ProductRuntimeBehaviorContractV1>;
      referenceMap: Readonly<PlanProductBuildReferenceMapV1>;
      authority: Readonly<PlanProductBuildAuthorityV1>;
      canonicalAuthorityBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly PlanProductBuildDiagnosticV1[];
    }>;

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function diagnostic(
  code: string,
  path: string,
  message: string,
  reference?: string,
): PlanProductBuildDiagnosticV1 {
  return { code, path, message, ...(reference ? { reference } : {}) };
}

function rejected(
  diagnostics: readonly PlanProductBuildDiagnosticV1[],
): PlanProductBuildCompilationResultV1 {
  const bounded = diagnostics.slice(0, PLAN_PRODUCT_BUILD_MAX_DIAGNOSTICS_V1);
  return recursivelyFreezePlanProductBuildV1({
    status: "rejected" as const,
    diagnostics: bounded.length > 0
      ? bounded
      : [diagnostic(
          "PLAN_PRODUCT_BUILD_V1_UNKNOWN_REJECTION",
          "/",
          "Plan product-build compilation rejected without a diagnostic",
        )],
  });
}

function boundedSnapshot(value: unknown, maxBytes: number): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function zodDiagnostics(
  code: string,
  error: z.ZodError,
  prefix = "",
): readonly PlanProductBuildDiagnosticV1[] {
  return error.issues.slice(0, PLAN_PRODUCT_BUILD_MAX_DIAGNOSTICS_V1).map((issue) =>
    diagnostic(
      code,
      `${prefix}${issue.path.length > 0 ? `/${issue.path.join("/")}` : ""}` || "/",
      issue.message,
    ));
}

function traceabilityRequirements(
  productSpec: ProductSpecV2,
  semanticKind: string,
  semanticRef: string,
): readonly string[] | undefined {
  return productSpec.traceability.bindings.find((binding) =>
    binding.semanticKind === semanticKind
    && binding.semanticRef === semanticRef)?.requirementRefs;
}

function hasEvidence(
  productSpec: ProductSpecV2,
  evidenceRef: string,
  kind: ProductSpecV2["evidencePredicates"][number]["kind"],
): boolean {
  return productSpec.evidencePredicates.some((evidence) =>
    evidence.id === evidenceRef && evidence.kind === kind && evidence.required);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function compileReferenceMap(
  envelope: PlanProductBuildProposalV1,
  productSpec: ProductSpecV2,
  diagnostics: PlanProductBuildDiagnosticV1[],
): PlanProductBuildReferenceMapV1 | undefined {
  const states = envelope.semantics.states.map((state) => {
    const stateRef = derivePlanStateRefV2(state.key);
    const output = productSpec.states.find((candidate) => candidate.id === stateRef);
    if (!output || output.invariants.length !== state.invariants.length) {
      diagnostics.push(diagnostic(
        "PLAN_PRODUCT_BUILD_V1_REFERENCE_MAP_MISMATCH",
        `/semantics/states/${envelope.semantics.states.indexOf(state)}`,
        `State key ${state.key} does not reproduce one exact ProductSpec state`,
        state.key,
      ));
    }
    return { stateKey: state.key, stateRef, invariantCount: state.invariants.length };
  }).sort((left, right) => compareUtf16(left.stateKey, right.stateKey));

  const entities = envelope.semantics.entities.map((entity) => {
    const entityRef = derivePlanEntityRefV2(entity.key);
    const output = productSpec.entities.find((candidate) => candidate.id === entityRef);
    if (!output || output.fields.length !== entity.fields.length) {
      diagnostics.push(diagnostic(
        "PLAN_PRODUCT_BUILD_V1_REFERENCE_MAP_MISMATCH",
        `/semantics/entities/${envelope.semantics.entities.indexOf(entity)}`,
        `Entity key ${entity.key} does not reproduce one exact ProductSpec entity`,
        entity.key,
      ));
    }
    const fields = entity.fields.map((field) => {
      const fieldRef = derivePlanEntityFieldRefV2(entity.key, field.key);
      if (!output?.fields.some((candidate) => candidate.id === fieldRef)) {
        diagnostics.push(diagnostic(
          "PLAN_PRODUCT_BUILD_V1_REFERENCE_MAP_MISMATCH",
          `/semantics/entities/${envelope.semantics.entities.indexOf(entity)}/fields/${entity.fields.indexOf(field)}`,
          `Entity field key ${entity.key}.${field.key} does not reproduce one exact ProductSpec field`,
          field.key,
        ));
      }
      return { fieldKey: field.key, fieldRef };
    }).sort((left, right) => compareUtf16(left.fieldKey, right.fieldKey));
    return { entityKey: entity.key, entityRef, fields };
  }).sort((left, right) => compareUtf16(left.entityKey, right.entityKey));

  const actions = envelope.semantics.actions.map((action) => {
    const actionRef = derivePlanActionRefV2(action.key);
    const output = productSpec.actions.find((candidate) => candidate.id === actionRef);
    if (
      !output
      || output.preconditions.length !== action.preconditions.length
      || output.stateDeltas.length !== action.stateDeltas.length
      || output.observableEffects.length !== action.observables.length
      || output.persistenceEffects.length !== action.persistenceIntents.length
    ) {
      diagnostics.push(diagnostic(
        "PLAN_PRODUCT_BUILD_V1_REFERENCE_MAP_MISMATCH",
        `/semantics/actions/${envelope.semantics.actions.indexOf(action)}`,
        `Action key ${action.key} does not reproduce exact ProductSpec cardinality`,
        action.key,
      ));
    }
    if (output) {
      const expectedPreconditions = action.preconditions.map((precondition) => ({
        stateRef: derivePlanStateRefV2(precondition.stateKey),
        path: precondition.path,
        operator: precondition.operator,
        ...(precondition.expected !== undefined ? { expected: precondition.expected } : {}),
      }));
      const expectedDeltas = action.stateDeltas.map((delta) => ({
        stateRef: derivePlanStateRefV2(delta.stateKey),
        operation: delta.operation,
        path: delta.path,
        valueFrom: delta.valueFrom.kind === "state"
          ? {
              kind: "state" as const,
              stateRef: derivePlanStateRefV2(delta.valueFrom.stateKey),
              path: delta.valueFrom.path,
            }
          : delta.valueFrom.kind === "entity_field"
            ? {
                kind: "entity_field" as const,
                entityRef: derivePlanEntityRefV2(delta.valueFrom.entityKey),
                fieldRef: derivePlanEntityFieldRefV2(
                  delta.valueFrom.entityKey,
                  delta.valueFrom.fieldKey,
                ),
              }
            : delta.valueFrom,
        ...(delta.matchField ? { matchField: delta.matchField } : {}),
      }));
      const deltaByKey = new Map(action.stateDeltas.map((delta) => [delta.key, delta] as const));
      const expectedPersistenceEffects = action.persistenceIntents.map((intent) => {
        const deltas = intent.stateDeltaKeys.map((key) => deltaByKey.get(key)!);
        return {
          policyRef: derivePlanPersistenceRefV2(intent.policyKey),
          operation: intent.operation,
          ...(intent.entityKey
            ? { entityRef: derivePlanEntityRefV2(intent.entityKey) }
            : {}),
          payloadFields: uniqueSorted(deltas.flatMap((delta) =>
            delta.valueFrom.kind === "input"
              ? [delta.valueFrom.field]
              : delta.valueFrom.kind === "inputs"
                ? delta.valueFrom.fields
                : [])),
          statePaths: deltas.map((delta) => ({
            stateRef: derivePlanStateRefV2(delta.stateKey),
            path: delta.path,
          })),
        };
      });
      if (
        canonicalJsonStringify(output.preconditions)
          !== canonicalJsonStringify(expectedPreconditions)
        || canonicalJsonStringify(output.stateDeltas)
          !== canonicalJsonStringify(expectedDeltas)
        || canonicalJsonStringify(output.persistenceEffects)
          !== canonicalJsonStringify(expectedPersistenceEffects)
      ) {
        diagnostics.push(diagnostic(
          "PLAN_PRODUCT_BUILD_V1_REFERENCE_MAP_MISMATCH",
          `/semantics/actions/${envelope.semantics.actions.indexOf(action)}`,
          `Action key ${action.key} does not preserve exact ordered behavior projections`,
          action.key,
        ));
      }
    }
    const invocationEvidenceRef = deriveActionInvocationEvidenceIdV2(actionRef);
    if (!hasEvidence(productSpec, invocationEvidenceRef, "action_invocation")) {
      diagnostics.push(diagnostic(
        "PLAN_PRODUCT_BUILD_V1_REFERENCE_MAP_MISMATCH",
        `/semantics/actions/${envelope.semantics.actions.indexOf(action)}/invocationInterface`,
        `Action ${action.key} has no exact compiler-owned invocation evidence`,
        action.key,
      ));
    }
    const stateDeltas = action.stateDeltas.map((delta, deltaOrdinal) => ({
      stateDeltaKey: delta.key,
      deltaOrdinal,
    })).sort((left, right) => compareUtf16(left.stateDeltaKey, right.stateDeltaKey));
    const observables = action.observables.map((observable) => {
      const observableRef = derivePlanObservableRefV2(action.key, observable.key);
      const evidenceRef = derivePlanObservableEvidenceRefV2(action.key, observable.key);
      const outputObservable = output?.observableEffects.find((candidate) =>
        candidate.id === observableRef);
      if (
        !outputObservable
        || outputObservable.evidenceRef !== evidenceRef
        || !hasEvidence(productSpec, evidenceRef, "observable_outcome")
      ) {
        diagnostics.push(diagnostic(
          "PLAN_PRODUCT_BUILD_V1_REFERENCE_MAP_MISMATCH",
          `/semantics/actions/${envelope.semantics.actions.indexOf(action)}/observables/${action.observables.indexOf(observable)}`,
          `Observable ${action.key}.${observable.key} does not reproduce exact ProductSpec evidence`,
          observable.key,
        ));
      }
      return { observableKey: observable.key, observableRef, evidenceRef };
    }).sort((left, right) => compareUtf16(left.observableKey, right.observableKey));
    const persistenceEffects = action.persistenceIntents.map((intent, ordinal) => {
      const policyRef = derivePlanPersistenceRefV2(intent.policyKey);
      const evidenceRef = derivePersistenceRoundTripEvidenceIdV2(actionRef, policyRef);
      if (
        output?.persistenceEffects[ordinal]?.policyRef !== policyRef
        || !hasEvidence(productSpec, evidenceRef, "persistence_round_trip")
      ) {
        diagnostics.push(diagnostic(
          "PLAN_PRODUCT_BUILD_V1_REFERENCE_MAP_MISMATCH",
          `/semantics/actions/${envelope.semantics.actions.indexOf(action)}/persistenceIntents/${ordinal}`,
          `Persistence intent ${action.key}.${ordinal} does not reproduce exact ProductSpec evidence`,
          intent.policyKey,
        ));
      }
      return {
        persistenceIntentOrdinal: ordinal,
        policyKey: intent.policyKey,
        policyRef,
        evidenceRef,
      };
    });
    return {
      actionKey: action.key,
      actionRef,
      invocationEvidenceRef,
      preconditionCount: action.preconditions.length,
      stateDeltas,
      observables,
      persistenceEffects,
    };
  }).sort((left, right) => compareUtf16(left.actionKey, right.actionKey));

  const parsed = PlanProductBuildReferenceMapV1Schema.safeParse({
    schema: "setfarm.plan-product-build-reference-map.v1",
    states,
    entities,
    actions,
  });
  if (!parsed.success) {
    diagnostics.push(...zodDiagnostics(
      "PLAN_PRODUCT_BUILD_V1_REFERENCE_MAP_INVALID",
      parsed.error,
      "/referenceMap",
    ));
    return undefined;
  }
  return parsed.data;
}

function actionMap(
  referenceMap: PlanProductBuildReferenceMapV1,
  actionKey: string,
) {
  return referenceMap.actions.find((action) => action.actionKey === actionKey);
}

function compileCoverageRef(
  referenceMap: PlanProductBuildReferenceMapV1,
  source: PlanRuntimeBehaviorSemanticCoverageRefV1,
): ProductRuntimeBehaviorSemanticCoverageRefV1 | undefined {
  const action = actionMap(referenceMap, source.actionKey);
  if (!action) return undefined;
  if (source.kind === "action_delta") {
    const delta = action.stateDeltas.find((candidate) =>
      candidate.stateDeltaKey === source.stateDeltaKey);
    return delta
      ? { kind: "action_delta", actionRef: action.actionRef, deltaOrdinal: delta.deltaOrdinal }
      : undefined;
  }
  if (source.kind === "action_precondition") {
    return source.preconditionOrdinal < action.preconditionCount
      ? {
          kind: "action_precondition",
          actionRef: action.actionRef,
          preconditionOrdinal: source.preconditionOrdinal,
        }
      : undefined;
  }
  if (source.kind === "action_observable") {
    const observable = action.observables.find((candidate) =>
      candidate.observableKey === source.observableKey);
    return observable
      ? {
          kind: "action_observable",
          actionRef: action.actionRef,
          observableRef: observable.observableRef,
        }
      : undefined;
  }
  return source.persistenceIntentOrdinal < action.persistenceEffects.length
    ? {
        kind: "persistence_effect",
        actionRef: action.actionRef,
        effectOrdinal: source.persistenceIntentOrdinal,
      }
    : undefined;
}

function compileEvidenceRef(
  referenceMap: PlanProductBuildReferenceMapV1,
  source: PlanRuntimeBehaviorEvidenceRefV1,
): string | undefined {
  const action = actionMap(referenceMap, source.actionKey);
  if (!action) return undefined;
  if (source.kind === "action_invocation") return action.invocationEvidenceRef;
  if (source.kind === "observable_outcome") {
    return action.observables.find((candidate) =>
      candidate.observableKey === source.observableKey)?.evidenceRef;
  }
  return action.persistenceEffects.find((candidate) =>
    candidate.policyKey === source.policyKey)?.evidenceRef;
}

function compileRuntimeBehaviorProposal(
  envelope: PlanProductBuildProposalV1,
  productSpec: ProductSpecV2,
  referenceMap: PlanProductBuildReferenceMapV1,
  diagnostics: PlanProductBuildDiagnosticV1[],
): ProductRuntimeBehaviorProposalV1 | undefined {
  const invariantBindings = envelope.runtimeBehavior.invariantBindings.map((binding, index) => {
    const state = referenceMap.states.find((candidate) =>
      candidate.stateKey === binding.stateKey);
    if (!state || binding.invariantOrdinal >= state.invariantCount) {
      diagnostics.push(diagnostic(
        "PLAN_PRODUCT_BUILD_V1_RUNTIME_REFERENCE_UNRESOLVED",
        `/runtimeBehavior/invariantBindings/${index}`,
        `Runtime invariant does not resolve ${binding.stateKey}:${binding.invariantOrdinal}`,
        binding.stateKey,
      ));
      return undefined;
    }
    const requirementRefs = traceabilityRequirements(productSpec, "state", state.stateRef);
    if (!requirementRefs) {
      diagnostics.push(diagnostic(
        "PLAN_PRODUCT_BUILD_V1_RUNTIME_REFERENCE_UNRESOLVED",
        `/runtimeBehavior/invariantBindings/${index}/stateKey`,
        `Runtime invariant state has no canonical traceability ${binding.stateKey}`,
        binding.stateKey,
      ));
      return undefined;
    }
    if (binding.disposition.kind === "runtime_assertions") {
      return {
        stateRef: state.stateRef,
        invariantOrdinal: binding.invariantOrdinal,
        requirementRefs: [...requirementRefs],
        disposition: {
          kind: "runtime_assertions" as const,
          assertions: binding.disposition.assertions.map((assertion) => ({
            subject: assertion.subject.kind === "state_path"
              ? {
                  kind: "state_path" as const,
                  stateRef: state.stateRef,
                  path: assertion.subject.path,
                }
              : {
                  kind: "state_each" as const,
                  stateRef: state.stateRef,
                  collectionPath: assertion.subject.collectionPath,
                  itemPath: assertion.subject.itemPath,
                },
            predicate: assertion.predicate,
          })),
        },
      };
    }
    if (binding.disposition.kind === "structured_semantic_coverage") {
      const coverageRefs = binding.disposition.coverageRefs.map((source, coverageIndex) => {
        const compiled = compileCoverageRef(referenceMap, source);
        if (!compiled) {
          diagnostics.push(diagnostic(
            "PLAN_PRODUCT_BUILD_V1_RUNTIME_REFERENCE_UNRESOLVED",
            `/runtimeBehavior/invariantBindings/${index}/disposition/coverageRefs/${coverageIndex}`,
            "Structured runtime coverage does not resolve to canonical ProductSpec semantics",
          ));
        }
        return compiled;
      }).filter((value): value is ProductRuntimeBehaviorSemanticCoverageRefV1 =>
        value !== undefined);
      return {
        stateRef: state.stateRef,
        invariantOrdinal: binding.invariantOrdinal,
        requirementRefs: [...requirementRefs],
        disposition: {
          kind: "structured_semantic_coverage" as const,
          coverageRefs,
        },
      };
    }
    const evidenceRefs = binding.disposition.evidenceRefs.map((source, evidenceIndex) => {
      const compiled = compileEvidenceRef(referenceMap, source);
      if (!compiled) {
        diagnostics.push(diagnostic(
          "PLAN_PRODUCT_BUILD_V1_RUNTIME_REFERENCE_UNRESOLVED",
          `/runtimeBehavior/invariantBindings/${index}/disposition/evidenceRefs/${evidenceIndex}`,
          "Non-runtime evidence does not resolve to canonical ProductSpec evidence",
        ));
      }
      return compiled;
    }).filter((value): value is string => value !== undefined);
    return {
      stateRef: state.stateRef,
      invariantOrdinal: binding.invariantOrdinal,
      requirementRefs: [...requirementRefs],
      disposition: {
        kind: "non_runtime_requirement" as const,
        evidenceRefs,
      },
    };
  }).filter((value): value is NonNullable<typeof value> => value !== undefined);

  const entityFieldBindings = envelope.runtimeBehavior.entityFieldBindings.map((binding, index) => {
    const planAction = envelope.semantics.actions.find((candidate) =>
      candidate.key === binding.actionKey);
    const action = actionMap(referenceMap, binding.actionKey);
    const deltaMap = action?.stateDeltas.find((candidate) =>
      candidate.stateDeltaKey === binding.stateDeltaKey);
    const delta = planAction?.stateDeltas.find((candidate) =>
      candidate.key === binding.stateDeltaKey);
    const state = referenceMap.states.find((candidate) =>
      candidate.stateKey === binding.snapshot.stateKey);
    if (!action || !deltaMap || !delta || delta.valueFrom.kind !== "entity_field" || !state) {
      diagnostics.push(diagnostic(
        "PLAN_PRODUCT_BUILD_V1_RUNTIME_REFERENCE_UNRESOLVED",
        `/runtimeBehavior/entityFieldBindings/${index}`,
        `Entity-field binding does not resolve ${binding.actionKey}.${binding.stateDeltaKey}`,
      ));
      return undefined;
    }
    return {
      actionRef: action.actionRef,
      deltaOrdinal: deltaMap.deltaOrdinal,
      snapshot: {
        stateRef: state.stateRef,
        collectionPath: binding.snapshot.collectionPath,
        selection: binding.snapshot.selection.kind === "singleton"
          ? { kind: "singleton" as const }
          : {
              kind: "match_input" as const,
              matchFieldRef: derivePlanEntityFieldRefV2(
                delta.valueFrom.entityKey,
                binding.snapshot.selection.matchFieldKey,
              ),
              inputField: binding.snapshot.selection.inputField,
            },
      },
    };
  }).filter((value): value is NonNullable<typeof value> => value !== undefined);

  if (diagnostics.length > 0) return undefined;
  const parsed = ProductRuntimeBehaviorProposalV1Schema.safeParse({
    schema: "setfarm.product-runtime-behavior-proposal.v1",
    productSpecHash: hashCanonicalJson(productSpec),
    invariantBindings,
    entityFieldBindings,
  });
  if (!parsed.success) {
    diagnostics.push(...zodDiagnostics(
      "PLAN_PRODUCT_BUILD_V1_RUNTIME_PROPOSAL_INVALID",
      parsed.error,
      "/runtimeBehavior",
    ));
    return undefined;
  }
  return parsed.data;
}

function compileInternal(input: unknown): PlanProductBuildCompilationResultV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, PLAN_PRODUCT_BUILD_INPUT_MAX_BYTES_V1);
  } catch {
    return rejected([diagnostic(
      "PLAN_PRODUCT_BUILD_V1_INPUT_INVALID",
      "/",
      "Plan product-build input failed bounded canonical preflight",
    )]);
  }
  const outer = CompilerInputV1Schema.safeParse(snapshot);
  if (!outer.success) {
    return rejected(zodDiagnostics("PLAN_PRODUCT_BUILD_V1_INPUT_INVALID", outer.error));
  }
  const envelopeResult = PlanProductBuildProposalV1Schema.safeParse(outer.data.proposal);
  if (!envelopeResult.success) {
    return rejected(zodDiagnostics(
      "PLAN_PRODUCT_BUILD_V1_PROPOSAL_INVALID",
      envelopeResult.error,
      "/proposal",
    ));
  }
  const envelope = envelopeResult.data;
  const semantic = compilePlanSemanticProposalV2({
    task: outer.data.task,
    proposal: envelope.semantics,
    ...(outer.data.requestedStackPackId
      ? { requestedStackPackId: outer.data.requestedStackPackId }
      : {}),
  });
  if (semantic.status !== "canonicalized") {
    return rejected(semantic.diagnostics.map((item) => diagnostic(
      "PLAN_PRODUCT_BUILD_V1_SEMANTICS_REJECTED",
      `/proposal/semantics${item.path}`,
      item.message,
      item.reference,
    )));
  }

  const diagnostics: PlanProductBuildDiagnosticV1[] = [];
  const referenceMap = compileReferenceMap(envelope, semantic.productSpec, diagnostics);
  if (!referenceMap || diagnostics.length > 0) return rejected(diagnostics);
  const runtimeBehaviorProposal = compileRuntimeBehaviorProposal(
    envelope,
    semantic.productSpec,
    referenceMap,
    diagnostics,
  );
  if (!runtimeBehaviorProposal || diagnostics.length > 0) return rejected(diagnostics);
  const runtimeBehavior = compileProductRuntimeBehaviorContractV1({
    productSpec: semantic.productSpec,
    proposal: runtimeBehaviorProposal,
  });
  if (runtimeBehavior.status !== "shadow_compiled") {
    return rejected(runtimeBehavior.diagnostics.map((item) => diagnostic(
      "PLAN_PRODUCT_BUILD_V1_RUNTIME_BEHAVIOR_REJECTED",
      `/proposal/runtimeBehavior${item.path}`,
      item.message,
      item.reference,
    )));
  }

  const coverage = {
    stateCount: referenceMap.states.length,
    entityCount: referenceMap.entities.length,
    entityFieldCount: referenceMap.entities.reduce(
      (total, entity) => total + entity.fields.length,
      0,
    ),
    actionCount: referenceMap.actions.length,
    stateDeltaCount: referenceMap.actions.reduce(
      (total, action) => total + action.stateDeltas.length,
      0,
    ),
    observableCount: referenceMap.actions.reduce(
      (total, action) => total + action.observables.length,
      0,
    ),
    persistenceEffectCount: referenceMap.actions.reduce(
      (total, action) => total + action.persistenceEffects.length,
      0,
    ),
  };
  const withoutHash = {
    schema: PLAN_PRODUCT_BUILD_AUTHORITY_SCHEMA_V1,
    contractVersion: PLAN_PRODUCT_BUILD_AUTHORITY_VERSION_V1,
    readiness: {
      status: "shadow" as const,
      productionConsumption: "forbidden" as const,
      blockerCodes: [...PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1] as [
        typeof PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1[0],
        typeof PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1[1],
        typeof PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1[2],
        typeof PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1[3],
      ],
    },
    source: {
      sourceTaskHash: semantic.sourceTaskHash,
      envelopeHash: hashPlanProductBuildProposalV1(envelope),
      semanticProposalHash: semantic.semanticProposalHash,
    },
    outputs: {
      productSpecHash: hashCanonicalJson(semantic.productSpec),
      deliverySelectionHash: semantic.deliverySelectionHash,
      runtimeBehaviorProposalHash: hashProductRuntimeBehaviorProposalV1(
        runtimeBehaviorProposal,
      ),
      runtimeBehaviorContractHash: runtimeBehavior.contractHash,
      referenceMapHash: hashPlanProductBuildReferenceMapV1(referenceMap),
    },
    referenceMap,
    coverage,
  };
  const authorityResult = PlanProductBuildAuthorityV1Schema.safeParse({
    ...withoutHash,
    authorityHash: hashPlanProductBuildAuthorityV1(withoutHash),
  });
  if (!authorityResult.success) {
    return rejected(zodDiagnostics(
      "PLAN_PRODUCT_BUILD_V1_AUTHORITY_INVALID",
      authorityResult.error,
      "/authority",
    ));
  }
  let canonicalAuthorityBytes: Buffer;
  try {
    canonicalAuthorityBytes = canonicalJsonBytesBounded(authorityResult.data, {
      maxBytes: PLAN_PRODUCT_BUILD_OUTPUT_MAX_BYTES_V1,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch {
    return rejected([diagnostic(
      "PLAN_PRODUCT_BUILD_V1_OUTPUT_TOO_LARGE",
      "/authority",
      "Plan product-build authority exceeds the bounded output budget",
    )]);
  }
  return recursivelyFreezePlanProductBuildV1({
    status: "shadow_compiled" as const,
    sourceEnvelope: envelope,
    semanticProposalHash: semantic.semanticProposalHash,
    productSpec: semantic.productSpec,
    productSpecCanonicalBytes: semantic.canonicalBytes,
    deliverySelection: semantic.deliverySelection,
    deliverySelectionHash: semantic.deliverySelectionHash,
    deliverySelectionCanonicalBytes: semantic.deliverySelectionCanonicalBytes,
    persistenceProjectionEvidence: semantic.persistenceProjectionEvidence,
    runtimeBehaviorProposal,
    runtimeBehaviorContract: runtimeBehavior.contract,
    referenceMap,
    authority: authorityResult.data,
    canonicalAuthorityBytes: canonicalAuthorityBytes.toString("utf8"),
  });
}

export function compilePlanProductBuildProposalV1(
  input: unknown,
): PlanProductBuildCompilationResultV1 {
  return compileInternal(input);
}

export class PlanProductBuildVerificationErrorV1 extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PlanProductBuildVerificationErrorV1";
    this.code = code;
  }
}

export function verifyPlanProductBuildAuthorityV1(
  input: unknown,
): Readonly<PlanProductBuildAuthorityV1> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, PLAN_PRODUCT_BUILD_VERIFICATION_INPUT_MAX_BYTES_V1);
  } catch {
    throw new PlanProductBuildVerificationErrorV1(
      "PLAN_PRODUCT_BUILD_V1_VERIFICATION_INPUT_INVALID",
      "Plan product-build verification input failed bounded canonical preflight",
    );
  }
  const outer = VerifierInputV1Schema.safeParse(snapshot);
  if (!outer.success) {
    throw new PlanProductBuildVerificationErrorV1(
      "PLAN_PRODUCT_BUILD_V1_VERIFICATION_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "Plan product-build verification input is invalid",
    );
  }
  const candidate = PlanProductBuildAuthorityV1Schema.safeParse(outer.data.candidate);
  if (!candidate.success) {
    throw new PlanProductBuildVerificationErrorV1(
      "PLAN_PRODUCT_BUILD_V1_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Plan product-build candidate is invalid",
    );
  }
  const reproduced = compileInternal({
    task: outer.data.task,
    proposal: outer.data.proposal,
    ...(outer.data.requestedStackPackId
      ? { requestedStackPackId: outer.data.requestedStackPackId }
      : {}),
  });
  if (reproduced.status !== "shadow_compiled") {
    throw new PlanProductBuildVerificationErrorV1(
      "PLAN_PRODUCT_BUILD_V1_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Plan product-build reproduction rejected",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== reproduced.canonicalAuthorityBytes) {
    throw new PlanProductBuildVerificationErrorV1(
      "PLAN_PRODUCT_BUILD_V1_VERIFICATION_AUTHORITY_MISMATCH",
      "Plan product-build candidate differs from fresh task and proposal authority",
    );
  }
  return reproduced.authority;
}
