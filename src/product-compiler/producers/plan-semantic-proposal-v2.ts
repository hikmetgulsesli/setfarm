import { createHash } from "node:crypto";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  PlanSemanticProposalV2Schema,
  type PlanSemanticProposalV2,
} from "../schemas/plan-semantic-proposal-v2.js";
import {
  ProductSpecV1Schema,
} from "../schemas/product-spec-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";
import type { ProductSpecProposalDiagnosticV1 } from "./plan-product-spec-proposal.js";
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
  const parsed = PlanSemanticProposalV2Schema.safeParse(input.proposal);
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
    const { surfaceRefs: _surfaceRefs, evidenceScenario, observableEffects: optionalObservableEffects, ...stableAction } = baseAction;
    const observableEffects = optionalObservableEffects!;
    const observableById = new Map(planAction.observables.map((observable) => [
      stableId("OBS", planAction.key, observable.key),
      observable,
    ] as const));
    return {
      ...stableAction,
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
  const requirements = base.requirements.map((requirement) => {
    const source = proposal.requirements.find((candidate) => candidate.id === requirement.id)!;
    return {
      ...requirement,
      expectedSemanticKinds: [...source.expectedSemanticKinds].sort(),
    };
  });

  const productSpec = ProductSpecV2Schema.parse({
    schema: "setfarm.product-spec.v2",
    product: base.product,
    entities: base.entities,
    states: base.states,
    persistencePolicies: base.persistencePolicies,
    routes,
    surfaces,
    actions,
    evidencePredicates: base.evidencePredicates,
    assumptions: base.assumptions,
    delivery: base.delivery,
    requirements,
    traceability: {
      schema: "setfarm.product-requirement-traceability.v2",
      sourceTaskHash: base.traceability.sourceTaskHash,
      bindings: [...base.traceability.bindings, ...controlPlacementBindings],
    },
  });
  return {
    ...baseResult,
    semanticProposal: proposal,
    semanticProposalHash: hashCanonicalJson(proposal),
    productSpec,
    canonicalBytes: canonicalJsonStringify(productSpec),
  };
}
