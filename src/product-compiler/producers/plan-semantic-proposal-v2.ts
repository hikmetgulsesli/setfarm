import { createHash } from "node:crypto";

import { CanonicalJsonError, hashCanonicalJson } from "../canonical-json.js";
import {
  CanonicalJsonLimitError,
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import {
  PlanSemanticProposalV2Schema,
  type PlanSemanticProposalV2,
} from "../schemas/plan-semantic-proposal-v2.js";
import {
  ProductSpecV1Schema,
} from "../schemas/product-spec-v1.js";
import {
  ProductSpecV2Schema,
  deriveActionInvocationEvidenceIdV2,
  derivePersistenceRoundTripEvidenceIdV2,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";
import type { ProductSpecProposalDiagnosticV1 } from "./plan-product-spec-proposal.js";
import type {
  PlanActionInvocationInterfaceIntentV1,
  PlanInvocationResultValueContractV1,
  ProductInvocationResultValueContractV1,
  ProductActionInvocationInterfaceIntentV1,
} from "../schemas/action-invocation-interface-intent-v1.js";
import {
  compilePlanSemanticProposalV1,
  type CompiledPlanSemanticProposalV1,
} from "./plan-semantic-proposal.js";

export type CompiledPlanSemanticProposalV2 = Omit<
  CompiledPlanSemanticProposalV1,
  "semanticProposal" | "semanticProposalHash" | "productSpec" | "canonicalBytes"
> & Readonly<{
  semanticProposal: PlanSemanticProposalV2;
  semanticProposalHash: string;
  productSpec: ProductSpecV2;
  canonicalBytes: string;
}>;

export type PlanSemanticProposalCompilerResultV2 =
  | CompiledPlanSemanticProposalV2
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ProductSpecProposalDiagnosticV1[];
    }>;

export const PLAN_SEMANTIC_PROPOSAL_V2_INPUT_MAX_BYTES = 4 * 1024 * 1024;
export const PLAN_SEMANTIC_TASK_V2_MAX_CODE_UNITS = 50_000;
// This is a compiler-local output/DoS budget, not a publication guarantee.
// Exact envelope publishability also depends on producer identity and must be
// proven by the prepared artifact-publication batch boundary.
export const PRODUCT_SPEC_V2_COMPILER_OUTPUT_MAX_BYTES = 3 * 1024 * 1024;

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const stack: object[] = [value as object];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) stack.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

function canonicalInputRejection(error: unknown): ProductSpecProposalDiagnosticV1 {
  const code = error instanceof CanonicalJsonLimitError || error instanceof CanonicalJsonError
    ? error.code
    : "CANONICAL_JSON_INPUT_INVALID";
  const path = error instanceof CanonicalJsonLimitError || error instanceof CanonicalJsonError
    ? error.path
    : "$";
  return {
    code: "PLAN_SEMANTIC_PROPOSAL_V2_INPUT_INVALID",
    path,
    message: `Plan semantic input failed bounded canonical preflight: ${code}`,
    reference: code,
  };
}

function stableToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "PLACEMENT";
}

function stableId(prefix: string, ...keys: string[]): string {
  const token = keys.map(stableToken).join("_");
  const candidate = `${prefix}_${token}`;
  if (candidate.length <= 160) return candidate;
  const digest = createHash("sha256").update(candidate).digest("hex").slice(0, 16).toUpperCase();
  const budget = 160 - prefix.length - digest.length - 2;
  const head = token.slice(0, budget).replace(/_+$/u, "") || "SEMANTIC";
  return `${prefix}_${head}_${digest}`;
}

function actionId(key: string): string {
  return stableId("ACT", key);
}

function stateId(key: string): string {
  return stableId("STATE", key);
}

function surfaceId(key: string): string {
  return stableId("SURF", key);
}

function routeId(key: string): string {
  return stableId("ROUTE", key);
}

function controlSlotId(actionKey: string, placementKey: string): string {
  const actionToken = actionId(actionKey).slice("ACT_".length);
  const placementToken = stableToken(placementKey);
  const candidate = `CSLOT_${actionToken}_${placementToken}`;
  if (candidate.length <= 160) return candidate;
  const digest = createHash("sha256").update(candidate).digest("hex").slice(0, 16).toUpperCase();
  const budget = 160 - "CSLOT_".length - actionToken.length - digest.length - 2;
  const placementHead = placementToken.slice(0, Math.max(1, budget)).replace(/_+$/u, "") || "PLACEMENT";
  return `CSLOT_${actionToken}_${placementHead}_${digest}`;
}

function invocationEvidenceId(actionKey: string): string {
  return deriveActionInvocationEvidenceIdV2(actionId(actionKey));
}

export function canonicalizePlanActionInvocationInterfaceV1(
  value: PlanActionInvocationInterfaceIntentV1,
): ProductActionInvocationInterfaceIntentV1 {
  const failureRank = new Map([
    ["input_validation", 0],
    ["precondition", 1],
    ["action_failure", 2],
  ] as const);
  const sortedCodes = (codes: readonly number[]) => [...codes].sort((left, right) => left - right);
  const sortedBindings = <T extends Readonly<{ fieldName: string }>>(bindings: readonly T[]) =>
    [...bindings].sort((left, right) =>
      left.fieldName < right.fieldName ? -1 : left.fieldName > right.fieldName ? 1 : 0);
  const sortedFailures = <T extends Readonly<{ kind: "input_validation" | "precondition" | "action_failure" }>>(
    failures: readonly T[],
  ) => [...failures].sort((left, right) => failureRank.get(left.kind)! - failureRank.get(right.kind)!);

  if (value.kind === "cli_command") {
    return {
      ...value,
      fieldBindings: sortedBindings(value.fieldBindings),
      result: {
        ...value.result,
        successExitCodes: sortedCodes(value.result.successExitCodes),
        failureCases: sortedFailures(value.result.failureCases).map((failure) => ({
          ...failure,
          exitCodes: sortedCodes(failure.exitCodes),
        })),
      },
    };
  }
  if (value.kind === "http_request") {
    const { routeKey, ...stable } = value;
    return {
      ...stable,
      routeRef: routeId(routeKey),
      fieldBindings: sortedBindings(value.fieldBindings),
      result: {
        ...value.result,
        successStatusCodes: sortedCodes(value.result.successStatusCodes),
        failureCases: sortedFailures(value.result.failureCases).map((failure) => ({
          ...failure,
          statusCodes: sortedCodes(failure.statusCodes),
        })),
      },
    };
  }
  if (value.kind === "route_entry") {
    const { routeKey, ...stable } = value;
    return { ...stable, routeRef: routeId(routeKey) };
  }
  return value;
}

function resolveInvocationResultValueContract(
  value: PlanInvocationResultValueContractV1,
): ProductInvocationResultValueContractV1 {
  return { valueType: value.valueType, expectedFrom: value.expectedFrom };
}

function diagnostic(message: string, path = ""): ProductSpecProposalDiagnosticV1 {
  return {
    code: "PLAN_SEMANTIC_PROPOSAL_V2_SCHEMA_INVALID",
    path,
    message,
  };
}

/**
 * Creates a validation-only v1 projection for the stable entity/state/
 * persistence compiler. Placement/effect separation remains authoritative in
 * the v2 proposal and is restored from exact keys below; it is never inferred
 * from the lossy projection.
 */
function v1ValidationProjection(proposal: PlanSemanticProposalV2): unknown {
  return {
    ...proposal,
    schema: "setfarm.plan-semantic-proposal.v1",
    requirements: proposal.requirements.map((requirement) => {
      const expectedSemanticKinds = requirement.expectedSemanticKinds.filter(
        (kind) => kind !== "control_placement",
      );
      return {
        ...requirement,
        expectedSemanticKinds: expectedSemanticKinds.length > 0
          ? expectedSemanticKinds
          : ["action"],
      };
    }),
    surfaces: proposal.surfaces.map(({ composition: _composition, ...surface }) => surface),
    actions: proposal.actions.map((action) => {
      const {
        controlPlacements,
        affectedSurfaceKeys,
        invocationInterface: _invocationInterface,
        evidenceScenario,
        observables,
        ...stableAction
      } = action;
      const { controlPlacementKey: _controlPlacementKey, ...stableEvidenceScenario } = evidenceScenario;
      return {
        ...stableAction,
        surfaceKeys: [...new Set([
          ...controlPlacements.map((placement) => placement.surfaceKey),
          ...affectedSurfaceKeys,
        ])],
        evidenceScenario: stableEvidenceScenario,
        observables: observables.map((observable) => ({
          ...observable,
          selector: observable.selector.kind === "control"
            ? { kind: "control" as const }
            : observable.selector,
        })),
      };
    }),
  };
}

/**
 * Compiles primary v2 semantics. The v1 compiler is used only for stable base
 * semantics; all route composition, control placement, observable slot, and
 * traceability facts are projected directly from the validated v2 proposal.
 */
export function compilePlanSemanticProposalV2(input: Readonly<{
  task: string;
  proposal: unknown;
  requestedStackPackId?: string;
}>): PlanSemanticProposalCompilerResultV2 {
  if (
    typeof input.task !== "string"
    || input.task.length === 0
    || input.task.length > PLAN_SEMANTIC_TASK_V2_MAX_CODE_UNITS
  ) {
    return {
      status: "rejected",
      diagnostics: [{
        code: "PLAN_SEMANTIC_TASK_V2_INPUT_INVALID",
        path: "/task",
        message: `Task must contain 1..${PLAN_SEMANTIC_TASK_V2_MAX_CODE_UNITS} UTF-16 code units`,
      }],
    };
  }
  let proposalSnapshot: unknown;
  try {
    const bytes = canonicalJsonBytesBounded(input.proposal, {
      maxBytes: PLAN_SEMANTIC_PROPOSAL_V2_INPUT_MAX_BYTES,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
    proposalSnapshot = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    return { status: "rejected", diagnostics: [canonicalInputRejection(error)] };
  }
  const parsed = PlanSemanticProposalV2Schema.safeParse(proposalSnapshot);
  if (!parsed.success) {
    return {
      status: "rejected",
      diagnostics: parsed.error.issues.slice(0, 200).map((issue) => diagnostic(
        issue.message,
        issue.path.length > 0 ? `/${issue.path.join("/")}` : "",
      )),
    };
  }
  const proposal = parsed.data;
  const shadowOnlyActionIndex = proposal.actions.findIndex((action) =>
    action.invocationInterface.kind === "cli_command"
    || action.invocationInterface.kind === "http_request");
  if (shadowOnlyActionIndex >= 0) {
    return {
      status: "rejected",
      diagnostics: [{
        code: "PLAN_SEMANTIC_PROPOSAL_V2_INVOCATION_PROFILE_UNAVAILABLE",
        path: `/actions/${shadowOnlyActionIndex}/invocationInterface`,
        message: "CLI/API invocation semantics are valid proposal authority but remain shadow-only until ProductDeliveryProfileV2 and the standalone V2 compiler path are active",
      }],
    };
  }
  const baseResult = compilePlanSemanticProposalV1({
    task: input.task,
    proposal: v1ValidationProjection(proposal),
    ...(input.requestedStackPackId ? { requestedStackPackId: input.requestedStackPackId } : {}),
  });
  if (baseResult.status !== "canonicalized") return baseResult;
  const base = ProductSpecV1Schema.parse(baseResult.productSpec);
  if (
    !base.requirements
    || !base.traceability
    || base.actions.some((action) => !action.observableEffects)
  ) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "The stable base compiler omitted required v3 requirement or observable authority",
      )],
    };
  }
  const planActionById = new Map(proposal.actions.map((action) => [actionId(action.key), action] as const));
  const planSurfaceById = new Map(proposal.surfaces.map((surface) => [surfaceId(surface.key), surface] as const));
  const persistenceRoundTripPredicatesByAction = new Map(base.actions.map((action) => {
    const predicates = [...new Set(action.persistenceEffects.map((effect) => effect.policyRef))]
      .sort()
      .map((policyRef) => ({
        id: derivePersistenceRoundTripEvidenceIdV2(action.id, policyRef),
        kind: "persistence_round_trip" as const,
        required: true,
        subjectRef: policyRef,
        capabilityRefs: [],
        assertion: { operator: "passes" as const },
      }));
    return [action.id, predicates] as const;
  }));

  const routes = base.routes.map((route) => {
    const planRoute = proposal.routes.find((candidate) => routeId(candidate.key) === route.id)!;
    const routeSurfaces = proposal.surfaces.filter((surface) => surface.routeKey === planRoute.key);
    const root = routeSurfaces.find((surface) => surface.composition.kind === "route_root")!;
    return {
      ...route,
      rootSurfaceRef: surfaceId(root.key),
      surfaceRefs: routeSurfaces.map((surface) => surfaceId(surface.key)),
    };
  });
  const surfaces = base.surfaces.map((surface) => {
    const planSurface = planSurfaceById.get(surface.id)!;
    return {
      ...surface,
      composition: planSurface.composition.kind === "route_root"
        ? { kind: "route_root" as const }
        : {
            kind: "contained" as const,
            hostSurfaceRef: surfaceId(planSurface.composition.hostSurfaceKey),
          },
    };
  });
  const actions = base.actions.map((baseAction) => {
    const planAction = planActionById.get(baseAction.id)!;
    const {
      surfaceRefs: _surfaceRefs,
      evidenceScenario,
      evidenceRefs,
      success,
      observableEffects: optionalObservableEffects,
      ...stableAction
    } = baseAction;
    const observableEffects = optionalObservableEffects!;
    const actionInvocationEvidenceRef = invocationEvidenceId(planAction.key);
    const persistenceRoundTripEvidenceRefs = (
      persistenceRoundTripPredicatesByAction.get(baseAction.id) ?? []
    ).map((predicate) => predicate.id);
    const observableById = new Map(planAction.observables.map((observable) => [
      stableId("OBS", planAction.key, observable.key),
      observable,
    ] as const));
    return {
      ...stableAction,
      invocationInterface: canonicalizePlanActionInvocationInterfaceV1(planAction.invocationInterface),
      trigger: planAction.invocationInterface.kind === "route_entry"
        ? {
            ...baseAction.trigger,
            sourceRef: routeId(planAction.invocationInterface.routeKey),
          }
        : baseAction.trigger,
      controlPlacements: planAction.controlPlacements.map((placement) => ({
        id: controlSlotId(planAction.key, placement.key),
        surfaceRef: surfaceId(placement.surfaceKey),
        controlHint: placement.controlHint,
      })),
      affectedSurfaceRefs: planAction.affectedSurfaceKeys.map(surfaceId),
      evidenceScenario: {
        ...evidenceScenario,
        ...(planAction.evidenceScenario.controlPlacementKey
          ? {
              controlSlotRef: controlSlotId(
                planAction.key,
                planAction.evidenceScenario.controlPlacementKey,
              ),
            }
          : {}),
      },
      evidenceRefs: [
        ...evidenceRefs,
        ...persistenceRoundTripEvidenceRefs,
        actionInvocationEvidenceRef,
      ].sort(),
      success: {
        ...success,
        evidenceRefs: [
          ...success.evidenceRefs,
          ...persistenceRoundTripEvidenceRefs,
          actionInvocationEvidenceRef,
        ].sort(),
      },
      observableEffects: observableEffects.map((effect) => {
        const planObservable = observableById.get(effect.id)!;
        return {
          ...effect,
          selector: planObservable.selector.kind === "control"
            ? {
                kind: "control" as const,
                controlSlotRef: controlSlotId(
                  planAction.key,
                  planObservable.selector.controlPlacementKey,
                ),
              }
            : planObservable.selector.kind === "surface"
              ? { kind: "surface" as const, surfaceRef: surfaceId(planObservable.selector.surfaceKey) }
              : planObservable.selector.kind === "invocation_output"
                ? {
                    kind: "invocation_output" as const,
                    coordinate: "result_value" as const,
                    pointer: planObservable.selector.pointer,
                    valueContract: resolveInvocationResultValueContract(
                      planObservable.selector.valueContract,
                    ),
                  }
              : {
                  kind: "accessibility" as const,
                  surfaceRef: surfaceId(planObservable.selector.surfaceKey),
                  role: planObservable.selector.role,
                  name: planObservable.selector.name,
                },
        };
      }),
    };
  });
  const controlPlacementBindings = proposal.actions.flatMap((action) =>
    action.controlPlacements.map((placement) => ({
      semanticKind: "control_placement" as const,
      semanticRef: controlSlotId(action.key, placement.key),
      requirementRefs: [...placement.requirementRefs].sort(),
    })));
  const invocationEvidenceBindings = proposal.actions.map((action) => ({
    semanticKind: "evidence" as const,
    semanticRef: invocationEvidenceId(action.key),
    requirementRefs: [...action.requirementRefs].sort(),
  }));
  const persistenceRoundTripEvidenceBindings = proposal.actions.flatMap((action) =>
    (persistenceRoundTripPredicatesByAction.get(actionId(action.key)) ?? []).map((predicate) => ({
      semanticKind: "evidence" as const,
      semanticRef: predicate.id,
      requirementRefs: [...action.requirementRefs].sort(),
    })));
  const invocationEvidencePredicates = proposal.actions.map((action) => ({
    id: invocationEvidenceId(action.key),
    kind: "action_invocation" as const,
    required: true,
    subjectRef: actionId(action.key),
    capabilityRefs: [],
    assertion: { operator: "passes" as const },
  }));
  const requirements = base.requirements.map((requirement) => {
    const source = proposal.requirements.find((candidate) => candidate.id === requirement.id)!;
    return {
      ...requirement,
      expectedSemanticKinds: [...source.expectedSemanticKinds].sort(),
    };
  });

  const productSpecResult = ProductSpecV2Schema.safeParse({
    schema: "setfarm.product-spec.v2",
    product: base.product,
    entities: base.entities,
    states: base.states,
    persistencePolicies: base.persistencePolicies,
    routes,
    surfaces,
    actions,
    evidencePredicates: [
      ...base.evidencePredicates,
      ...[...persistenceRoundTripPredicatesByAction.values()].flat(),
      ...invocationEvidencePredicates,
    ],
    assumptions: base.assumptions,
    delivery: base.delivery,
    requirements,
    traceability: {
      schema: "setfarm.product-requirement-traceability.v2",
      sourceTaskHash: base.traceability.sourceTaskHash,
      bindings: [
        ...base.traceability.bindings,
        ...controlPlacementBindings,
        ...persistenceRoundTripEvidenceBindings,
        ...invocationEvidenceBindings,
      ],
    },
  });
  if (!productSpecResult.success) {
    return {
      status: "rejected",
      diagnostics: productSpecResult.error.issues.slice(0, 200).map((issue) => diagnostic(
        issue.message,
        issue.path.length > 0 ? `/${issue.path.join("/")}` : "",
      )),
    };
  }
  let canonicalProductSpecBytes: Buffer;
  try {
    canonicalProductSpecBytes = canonicalJsonBytesBounded(productSpecResult.data, {
      maxBytes: PRODUCT_SPEC_V2_COMPILER_OUTPUT_MAX_BYTES,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch (error) {
    const reference = error instanceof CanonicalJsonLimitError || error instanceof CanonicalJsonError
      ? error.code
      : "CANONICAL_JSON_OUTPUT_INVALID";
    return {
      status: "rejected",
      diagnostics: [{
        code: "PRODUCT_SPEC_V2_PAYLOAD_TOO_LARGE",
        path: "/",
        message: `ProductSpecV2 exceeds the bounded compiler output budget: ${reference}`,
        reference,
      }],
    };
  }
  const productSpec = ProductSpecV2Schema.parse(JSON.parse(
    canonicalProductSpecBytes.toString("utf8"),
  ));
  return deepFreezeJson({
    ...baseResult,
    semanticProposal: deepFreezeJson(proposal),
    semanticProposalHash: hashCanonicalJson(proposal),
    productSpec: deepFreezeJson(productSpec),
    canonicalBytes: canonicalProductSpecBytes.toString("utf8"),
  });
}
