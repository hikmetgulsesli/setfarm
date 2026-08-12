import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  DesignSurfaceIdSchema,
  EvidenceIdSchema,
  ObservableIdSchema,
  RouteIdSchema,
  Sha256Schema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  ControlHintV2Schema,
  ControlSlotIdSchema,
} from "./common-v2.js";
import {
  ActionInputTransportV2Schema,
  type ActionInputTransportV2,
} from "./action-input-transport-v2.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import { ObservableAssertionV1Schema } from "./product-spec-v1.js";
import {
  RenderedObservableSelectorV2Schema,
  ProductActionV2Schema,
  ProductSpecV2Schema,
  type ProductActionV2,
} from "./product-spec-v2.js";

export const DESIGN_GENERATION_TARGETS_ARTIFACT_TYPE_V3 =
  "setfarm.design-generation-targets.v3" as const;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function requireCanonicalIdentities(
  context: z.RefinementCtx,
  path: PropertyKey[],
  values: readonly string[],
  code: string,
  label: string,
): void {
  if (!hasUniqueStrings(values)) {
    context.addIssue({
      code: "custom",
      path,
      message: `${code}_DUPLICATE: ${label} must be unique`,
    });
  }
  if (values.some((value, index) =>
    index > 0 && compareUtf16(values[index - 1]!, value) >= 0)) {
    context.addIssue({
      code: "custom",
      path,
      message: `${code}_ORDER_INVALID: ${label} must be canonically UTF-16 sorted`,
    });
  }
}

export const RequiredObservableSelectorV3Schema = z.object({
  observableRef: ObservableIdSchema,
  actionRef: ActionIdSchema,
  selector: RenderedObservableSelectorV2Schema,
  assertions: z.array(ObservableAssertionV1Schema).min(1).max(100),
  evidenceRef: EvidenceIdSchema,
}).strict().superRefine((value, context) => {
  if (!value.assertions.some((assertion) => assertion.phase === "after")) {
    context.addIssue({
      code: "custom",
      path: ["assertions"],
      message: "DESIGN_TARGET_V3_OBSERVABLE_AFTER_REQUIRED: Required observable selectors must preserve an after assertion",
    });
  }
  const assertionKeys = value.assertions.map((assertion) =>
    `${assertion.phase}\0${assertion.property}`);
  if (!hasUniqueStrings(assertionKeys)) {
    context.addIssue({
      code: "custom",
      path: ["assertions"],
      message: "DESIGN_TARGET_V3_OBSERVABLE_ASSERTION_DUPLICATE: Observable phase/property assertions must be unique",
    });
  }
});
export type RequiredObservableSelectorV3 = z.infer<
  typeof RequiredObservableSelectorV3Schema
>;

export function requiredEvidenceRefsForActionsV3(
  actions: readonly ProductActionV2[],
): string[] {
  return uniqueSorted(actions.flatMap((action) => [
    ...action.evidenceRefs,
    ...action.success.evidenceRefs,
    ...action.failure.evidenceRefs,
    ...action.observableEffects.map((observable) => observable.evidenceRef),
  ]));
}

export type ActionDependencyClosureV3 = Readonly<{
  directActionRefs: string[];
  dependencyActionRefs: string[];
  requiredActionRefs: string[];
  unresolvedActionRefs: string[];
  cyclePaths: string[][];
}>;

/**
 * Derives the exact transitive evidence-scenario prerequisite closure. Direct
 * target ownership and evidence-only dependencies remain separate authorities.
 */
export function deriveActionDependencyClosureV3(
  actions: readonly ProductActionV2[],
  directActionRefsInput: readonly string[],
): ActionDependencyClosureV3 {
  const directActionRefs = uniqueSorted(directActionRefsInput);
  const directActionRefSet = new Set(directActionRefs);
  const actionByRef = new Map(actions.map((action) => [action.id, action] as const));
  const dependencyActionRefs = new Set<string>();
  const unresolvedActionRefs = new Set<string>();
  const visited = new Set<string>();
  const activeRefs: string[] = [];
  const activeRefSet = new Set<string>();
  const cyclePathKeys = new Set<string>();
  const cyclePaths: string[][] = [];

  const visit = (actionRef: string): void => {
    if (activeRefSet.has(actionRef)) {
      const cycleStart = activeRefs.indexOf(actionRef);
      const cyclePath = [...activeRefs.slice(cycleStart), actionRef];
      const cyclePathKey = cyclePath.join("\0");
      if (!cyclePathKeys.has(cyclePathKey)) {
        cyclePathKeys.add(cyclePathKey);
        cyclePaths.push(cyclePath);
      }
      return;
    }
    if (visited.has(actionRef)) return;
    const action = actionByRef.get(actionRef);
    if (!action) {
      unresolvedActionRefs.add(actionRef);
      return;
    }

    activeRefs.push(actionRef);
    activeRefSet.add(actionRef);
    const prerequisiteRefs = uniqueSorted(
      action.evidenceScenario.prerequisiteSteps.map((step) => step.actionRef),
    );
    prerequisiteRefs.forEach((prerequisiteRef) => {
      if (!directActionRefSet.has(prerequisiteRef)) {
        dependencyActionRefs.add(prerequisiteRef);
      }
      visit(prerequisiteRef);
    });
    activeRefs.pop();
    activeRefSet.delete(actionRef);
    visited.add(actionRef);
  };

  directActionRefs.forEach(visit);
  const sortedDependencyActionRefs = uniqueSorted([...dependencyActionRefs]);
  return {
    directActionRefs,
    dependencyActionRefs: sortedDependencyActionRefs,
    requiredActionRefs: uniqueSorted([
      ...directActionRefs,
      ...sortedDependencyActionRefs,
    ]),
    unresolvedActionRefs: uniqueSorted([...unresolvedActionRefs]),
    cyclePaths: cyclePaths.sort((left, right) =>
      compareUtf16(left.join("\0"), right.join("\0"))),
  };
}

const RequiredControlPlacementV3BaseSchema = z.object({
  controlSlotRef: ControlSlotIdSchema,
  actionRef: ActionIdSchema,
  surfaceRef: SurfaceIdSchema,
  controlHint: ControlHintV2Schema,
  actionInputTransports: z.array(ActionInputTransportV2Schema).max(500),
  actionInputTransportsHash: Sha256Schema,
}).strict();

export type RequiredControlPlacementV3 = z.infer<
  typeof RequiredControlPlacementV3BaseSchema
>;

export function hashRequiredActionInputTransportsV3(
  transports: readonly ActionInputTransportV2[],
): string {
  return hashCanonicalJson(transports);
}

export const RequiredControlPlacementV3Schema = RequiredControlPlacementV3BaseSchema
  .superRefine((value, context) => {
    const actionInputRefs = value.actionInputTransports.map((transport) =>
      transport.actionInputRef);
    requireCanonicalIdentities(
      context,
      ["actionInputTransports"],
      actionInputRefs,
      "DESIGN_TARGET_V3_ACTION_INPUT",
      "Action-input transport refs",
    );
    value.actionInputTransports.forEach((transport, transportIndex) => {
      if (transport.actionRef !== value.actionRef) {
        context.addIssue({
          code: "custom",
          path: ["actionInputTransports", transportIndex, "actionRef"],
          message: `DESIGN_TARGET_V3_ACTION_INPUT_OWNER_MISMATCH: ${transport.actionInputRef} belongs to ${transport.actionRef}, not ${value.actionRef}`,
        });
      }
    });
    if (
      value.actionInputTransportsHash
      !== hashRequiredActionInputTransportsV3(value.actionInputTransports)
    ) {
      context.addIssue({
        code: "custom",
        path: ["actionInputTransportsHash"],
        message: "DESIGN_TARGET_V3_ACTION_INPUT_HASH_MISMATCH: actionInputTransportsHash must bind the exact ordered transport contracts",
      });
    }
  });

const DesignGenerationTargetV3BaseSchema = z.object({
  targetId: GenerationTargetIdSchema,
  designSurfaceId: DesignSurfaceIdSchema,
  productSpecHash: Sha256Schema,
  routeRef: RouteIdSchema,
  surfaceRef: SurfaceIdSchema,
  containedSurfaceRefs: z.array(SurfaceIdSchema).max(1_000),
  requestScreenKey: z.string().min(1).max(500),
  expectedScreenTitle: z.string().min(1).max(500),
  directActionRefs: z.array(ActionIdSchema).max(2_000),
  dependencyActionRefs: z.array(ActionIdSchema).max(2_000),
  requiredActionRefs: z.array(ActionIdSchema).max(2_000),
  requiredActions: z.array(ProductActionV2Schema).max(2_000),
  requiredEvidencePredicates: z.array(
    ProductSpecV2Schema.shape.evidencePredicates.element,
  ).max(5_000),
  requiredControlPlacements: z.array(RequiredControlPlacementV3Schema).max(2_000),
  affectingActionRefs: z.array(ActionIdSchema).max(2_000),
  requiredObservableSelectors: z.array(RequiredObservableSelectorV3Schema).max(2_000),
  targetHash: Sha256Schema,
}).strict();

export type DesignGenerationTargetV3 = z.infer<
  typeof DesignGenerationTargetV3BaseSchema
>;

export type DesignGenerationTargetHashPayloadV3 = Omit<
  DesignGenerationTargetV3,
  "targetHash"
>;

export function hashDesignGenerationTargetV3(
  value: DesignGenerationTargetV3 | DesignGenerationTargetHashPayloadV3,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.targetHash;
  return hashCanonicalJson(payload);
}

export const DesignGenerationTargetV3Schema = DesignGenerationTargetV3BaseSchema
  .superRefine((value, context) => {
    if (value.containedSurfaceRefs.includes(value.surfaceRef)) {
      context.addIssue({
        code: "custom",
        path: ["containedSurfaceRefs"],
        message: "DESIGN_TARGET_V3_ROOT_CONTAINMENT_SELF_REFERENCE: Root surface cannot also be a contained surface",
      });
    }
    requireCanonicalIdentities(
      context,
      ["containedSurfaceRefs"],
      value.containedSurfaceRefs,
      "DESIGN_TARGET_V3_CONTAINED_SURFACE",
      "Contained surface refs",
    );
    requireCanonicalIdentities(
      context,
      ["directActionRefs"],
      value.directActionRefs,
      "DESIGN_TARGET_V3_DIRECT_ACTION",
      "Direct action refs",
    );
    requireCanonicalIdentities(
      context,
      ["dependencyActionRefs"],
      value.dependencyActionRefs,
      "DESIGN_TARGET_V3_DEPENDENCY_ACTION",
      "Dependency action refs",
    );
    requireCanonicalIdentities(
      context,
      ["requiredActionRefs"],
      value.requiredActionRefs,
      "DESIGN_TARGET_V3_REQUIRED_ACTION",
      "Required action refs",
    );
    const requiredActionIds = value.requiredActions.map((action) => action.id);
    requireCanonicalIdentities(
      context,
      ["requiredActions"],
      requiredActionIds,
      "DESIGN_TARGET_V3_REQUIRED_ACTION_PAYLOAD",
      "Required action payload IDs",
    );
    if (!sameStrings(requiredActionIds, value.requiredActionRefs)) {
      context.addIssue({
        code: "custom",
        path: ["requiredActions"],
        message: "DESIGN_TARGET_V3_REQUIRED_ACTION_PAYLOAD_MISMATCH: requiredActions must contain every and only requiredActionRefs",
      });
    }
    const requiredEvidenceIds = value.requiredEvidencePredicates.map((predicate) =>
      predicate.id);
    requireCanonicalIdentities(
      context,
      ["requiredEvidencePredicates"],
      requiredEvidenceIds,
      "DESIGN_TARGET_V3_REQUIRED_EVIDENCE",
      "Required evidence predicate IDs",
    );
    const expectedEvidenceIds = requiredEvidenceRefsForActionsV3(value.requiredActions);
    if (!sameStrings(requiredEvidenceIds, expectedEvidenceIds)) {
      context.addIssue({
        code: "custom",
        path: ["requiredEvidencePredicates"],
        message: "DESIGN_TARGET_V3_EVIDENCE_CLOSURE_MISMATCH: requiredEvidencePredicates must exactly cover all required action outcome and observable evidence refs",
      });
    }
    requireCanonicalIdentities(
      context,
      ["affectingActionRefs"],
      value.affectingActionRefs,
      "DESIGN_TARGET_V3_AFFECTING_ACTION",
      "Affecting action refs",
    );

    const targetSurfaceRefs = new Set([value.surfaceRef, ...value.containedSurfaceRefs]);
    const actionByRef = new Map(value.requiredActions.map((action) =>
      [action.id, action] as const));
    const expectedAffectingActionRefs = value.requiredActions
      .filter((action) => action.affectedSurfaceRefs.some((surfaceRef) =>
        targetSurfaceRefs.has(surfaceRef)))
      .map((action) => action.id)
      .sort(compareUtf16);
    if (!sameStrings(value.affectingActionRefs, expectedAffectingActionRefs)) {
      context.addIssue({
        code: "custom",
        path: ["affectingActionRefs"],
        message: "DESIGN_TARGET_V3_AFFECTING_ACTION_PAYLOAD_MISMATCH: affectingActionRefs must derive from the exact required action payloads",
      });
    }
    const controlSlotRefs = value.requiredControlPlacements.map((placement) =>
      placement.controlSlotRef);
    requireCanonicalIdentities(
      context,
      ["requiredControlPlacements"],
      controlSlotRefs,
      "DESIGN_TARGET_V3_CONTROL_SLOT",
      "Required control-slot refs",
    );
    const expectedControlSlotRefs = value.requiredActions.flatMap((action) =>
      action.controlPlacements
        .filter((placement) => targetSurfaceRefs.has(placement.surfaceRef))
        .map((placement) => placement.id))
      .sort(compareUtf16);
    if (!sameStrings(controlSlotRefs, expectedControlSlotRefs)) {
      context.addIssue({
        code: "custom",
        path: ["requiredControlPlacements"],
        message: "DESIGN_TARGET_V3_CONTROL_CLOSURE_MISMATCH: controls must exactly project required action placements on the target surfaces",
      });
    }
    value.requiredControlPlacements.forEach((placement, placementIndex) => {
      const action = actionByRef.get(placement.actionRef);
      const actionPlacement = action?.controlPlacements.find((candidate) =>
        candidate.id === placement.controlSlotRef);
      if (!targetSurfaceRefs.has(placement.surfaceRef)) {
        context.addIssue({
          code: "custom",
          path: ["requiredControlPlacements", placementIndex, "surfaceRef"],
          message: `DESIGN_TARGET_V3_CONTROL_SURFACE_OUTSIDE_TARGET: ${placement.surfaceRef}`,
        });
      }
      if (
        !action
        || !actionPlacement
        || actionPlacement.surfaceRef !== placement.surfaceRef
        || actionPlacement.controlHint !== placement.controlHint
      ) {
        context.addIssue({
          code: "custom",
          path: ["requiredControlPlacements", placementIndex],
          message: `DESIGN_TARGET_V3_CONTROL_ACTION_PAYLOAD_MISMATCH: ${placement.controlSlotRef} must equal its exact required action placement`,
        });
        return;
      }
      const expectedInputFields = [...action.input.fields]
        .sort((left, right) => compareUtf16(left.name, right.name));
      const observedInputFields = placement.actionInputTransports.map((transport) =>
        transport.fieldRef);
      if (!sameStrings(
        observedInputFields,
        expectedInputFields.map((field) => field.name),
      )) {
        context.addIssue({
          code: "custom",
          path: ["requiredControlPlacements", placementIndex, "actionInputTransports"],
          message: `DESIGN_TARGET_V3_ACTION_INPUT_CLOSURE_MISMATCH: ${placement.controlSlotRef} must carry every and only exact action input field`,
        });
      }
      placement.actionInputTransports.forEach((transport, transportIndex) => {
        const field = expectedInputFields.find((candidate) =>
          candidate.name === transport.fieldRef);
        if (
          !field
          || field.valueType !== transport.valueType
          || field.required !== transport.required
          || (field.entityFieldRef ?? null) !== transport.entityFieldRef
        ) {
          context.addIssue({
            code: "custom",
            path: ["requiredControlPlacements", placementIndex, "actionInputTransports", transportIndex],
            message: `DESIGN_TARGET_V3_ACTION_INPUT_PAYLOAD_MISMATCH: ${transport.actionInputRef} must equal its exact required action input field`,
          });
        }
      });
    });

    const observableRefs = value.requiredObservableSelectors.map((observable) =>
      observable.observableRef);
    requireCanonicalIdentities(
      context,
      ["requiredObservableSelectors"],
      observableRefs,
      "DESIGN_TARGET_V3_OBSERVABLE",
      "Required observable refs",
    );
    const expectedObservables = value.requiredActions.flatMap((action) =>
      action.observableEffects.flatMap((observable) => {
        const selector = observable.selector;
        if (selector.kind === "invocation_output") {
          context.addIssue({
            code: "custom",
            path: ["requiredActions"],
            message: `DESIGN_TARGET_V3_INVOCATION_OUTPUT_FORBIDDEN: ${observable.id}`,
          });
          return [];
        }
        const surfaceRef = selector.kind === "control"
          ? action.controlPlacements.find((placement) =>
              placement.id === selector.controlSlotRef)?.surfaceRef
          : selector.surfaceRef;
        return surfaceRef && targetSurfaceRefs.has(surfaceRef)
          ? [{
              observableRef: observable.id,
              actionRef: action.id,
              selector,
              assertions: observable.assertions,
              evidenceRef: observable.evidenceRef,
            }]
          : [];
      }))
      .sort((left, right) => compareUtf16(left.observableRef, right.observableRef));
    if (!sameCanonicalValue(value.requiredObservableSelectors, expectedObservables)) {
      context.addIssue({
        code: "custom",
        path: ["requiredObservableSelectors"],
        message: "DESIGN_TARGET_V3_OBSERVABLE_CLOSURE_MISMATCH: observables must exactly project required action selectors, assertions, and evidence",
      });
    }
    const placementBySlot = new Map(value.requiredControlPlacements.map((placement) =>
      [placement.controlSlotRef, placement] as const));
    value.requiredObservableSelectors.forEach((observable, observableIndex) => {
      if (observable.selector.kind === "control") {
        const placement = placementBySlot.get(observable.selector.controlSlotRef);
        if (!placement) {
          context.addIssue({
            code: "custom",
            path: ["requiredObservableSelectors", observableIndex, "selector", "controlSlotRef"],
            message: `DESIGN_TARGET_V3_OBSERVABLE_CONTROL_SLOT_UNRESOLVED: ${observable.selector.controlSlotRef}`,
          });
        } else if (placement.actionRef !== observable.actionRef) {
          context.addIssue({
            code: "custom",
            path: ["requiredObservableSelectors", observableIndex, "actionRef"],
            message: `DESIGN_TARGET_V3_OBSERVABLE_CONTROL_ACTION_MISMATCH: ${observable.selector.controlSlotRef} belongs to ${placement.actionRef}`,
          });
        }
        return;
      }
      if (!targetSurfaceRefs.has(observable.selector.surfaceRef)) {
        context.addIssue({
          code: "custom",
          path: ["requiredObservableSelectors", observableIndex, "selector", "surfaceRef"],
          message: `DESIGN_TARGET_V3_OBSERVABLE_SURFACE_OUTSIDE_TARGET: ${observable.selector.surfaceRef}`,
        });
      }
    });

    const expectedDirectActionRefs = uniqueSorted([
      ...value.affectingActionRefs,
      ...value.requiredControlPlacements.map((placement) => placement.actionRef),
      ...value.requiredObservableSelectors.map((observable) => observable.actionRef),
    ]);
    if (!sameStrings(value.directActionRefs, expectedDirectActionRefs)) {
      context.addIssue({
        code: "custom",
        path: ["directActionRefs"],
        message: "DESIGN_TARGET_V3_DIRECT_ACTION_CLOSURE_MISMATCH: directActionRefs must exactly equal control, affecting, and observable action ownership",
      });
    }
    const dependencyClosure = deriveActionDependencyClosureV3(
      value.requiredActions,
      value.directActionRefs,
    );
    if (dependencyClosure.unresolvedActionRefs.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["requiredActions"],
        message: `DESIGN_TARGET_V3_PREREQUISITE_ACTION_UNRESOLVED: ${dependencyClosure.unresolvedActionRefs.join(",")}`,
      });
    }
    if (dependencyClosure.cyclePaths.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["requiredActions"],
        message: `DESIGN_TARGET_V3_PREREQUISITE_CYCLE: ${dependencyClosure.cyclePaths.map((path) => path.join(" -> ")).join("; ")}`,
      });
    }
    if (!sameStrings(value.dependencyActionRefs, dependencyClosure.dependencyActionRefs)) {
      context.addIssue({
        code: "custom",
        path: ["dependencyActionRefs"],
        message: "DESIGN_TARGET_V3_DEPENDENCY_ACTION_CLOSURE_MISMATCH: dependencyActionRefs must exactly equal the transitive evidence prerequisite closure outside direct ownership",
      });
    }
    if (!sameStrings(value.requiredActionRefs, dependencyClosure.requiredActionRefs)) {
      context.addIssue({
        code: "custom",
        path: ["requiredActionRefs"],
        message: "DESIGN_TARGET_V3_REQUIRED_ACTION_UNION_MISMATCH: requiredActionRefs must exactly equal directActionRefs plus dependencyActionRefs",
      });
    }

    const transportHashByAction = new Map<string, string>();
    value.requiredControlPlacements.forEach((placement, placementIndex) => {
      const previous = transportHashByAction.get(placement.actionRef);
      if (previous !== undefined && previous !== placement.actionInputTransportsHash) {
        context.addIssue({
          code: "custom",
          path: ["requiredControlPlacements", placementIndex, "actionInputTransportsHash"],
          message: `DESIGN_TARGET_V3_ACTION_INPUT_SET_MISMATCH: controls for ${placement.actionRef} must carry one identical input-contract set`,
        });
      }
      transportHashByAction.set(placement.actionRef, placement.actionInputTransportsHash);
    });

    if (value.targetHash !== hashDesignGenerationTargetV3(value)) {
      context.addIssue({
        code: "custom",
        path: ["targetHash"],
        message: "DESIGN_TARGET_V3_TARGET_HASH_MISMATCH: targetHash must bind the exact canonical target payload",
      });
    }
  });

const DesignGenerationTargetsV3BaseSchema = z.object({
  schema: z.literal(DESIGN_GENERATION_TARGETS_ARTIFACT_TYPE_V3),
  productSpecHash: Sha256Schema,
  targets: z.array(DesignGenerationTargetV3Schema).min(1).max(1_000),
  targetsHash: Sha256Schema,
  payloadHash: Sha256Schema,
}).strict();

export type DesignGenerationTargetsV3 = z.infer<
  typeof DesignGenerationTargetsV3BaseSchema
>;

export type DesignGenerationTargetsHashPayloadV3 = Omit<
  DesignGenerationTargetsV3,
  "payloadHash"
>;

export function hashDesignGenerationTargetsV3(
  value: DesignGenerationTargetsV3 | DesignGenerationTargetsHashPayloadV3,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.payloadHash;
  return hashCanonicalJson(payload);
}

export const DesignGenerationTargetsV3Schema = DesignGenerationTargetsV3BaseSchema
  .superRefine((value, context) => {
    value.targets.forEach((target, targetIndex) => {
      if (target.productSpecHash !== value.productSpecHash) {
        context.addIssue({
          code: "custom",
          path: ["targets", targetIndex, "productSpecHash"],
          message: "DESIGN_TARGET_V3_PRODUCT_SPEC_HASH_MISMATCH: every target must bind the exact parent ProductSpec payload hash",
        });
      }
    });
    requireCanonicalIdentities(
      context,
      ["targets"],
      value.targets.map((target) => target.targetId),
      "DESIGN_TARGET_V3_TARGET",
      "Generation target IDs",
    );
    for (const [field, values] of [
      ["designSurfaceId", value.targets.map((target) => target.designSurfaceId)],
      ["routeRef", value.targets.map((target) => target.routeRef)],
      ["surfaceRef", value.targets.map((target) => target.surfaceRef)],
      ["requestScreenKey", value.targets.map((target) => target.requestScreenKey)],
    ] as const) {
      if (!hasUniqueStrings(values)) {
        context.addIssue({
          code: "custom",
          path: ["targets"],
          message: `DESIGN_TARGET_V3_TARGET_IDENTITY_DUPLICATE: Generation target ${field} values must be unique`,
        });
      }
    }

    const ownedSurfaceRefs = value.targets.flatMap((target) =>
      [target.surfaceRef, ...target.containedSurfaceRefs]);
    if (!hasUniqueStrings(ownedSurfaceRefs)) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "DESIGN_TARGET_V3_SURFACE_OWNERSHIP_DUPLICATE: A ProductSpec surface can belong to only one route-root target",
      });
    }
    const controlSlotRefs = value.targets.flatMap((target) =>
      target.requiredControlPlacements.map((placement) => placement.controlSlotRef));
    if (!hasUniqueStrings(controlSlotRefs)) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "DESIGN_TARGET_V3_CONTROL_SLOT_OWNERSHIP_DUPLICATE: A control slot can belong to only one generation target",
      });
    }
    const observableRefs = value.targets.flatMap((target) =>
      target.requiredObservableSelectors.map((observable) => observable.observableRef));
    if (!hasUniqueStrings(observableRefs)) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "DESIGN_TARGET_V3_OBSERVABLE_OWNERSHIP_DUPLICATE: An observable can belong to only one generation target",
      });
    }

    const transportHashByAction = new Map<string, string>();
    const actionPayloadHashByRef = new Map<string, string>();
    const evidencePayloadHashByRef = new Map<string, string>();
    value.targets.forEach((target, targetIndex) => {
      target.requiredActions.forEach((action, actionIndex) => {
        const actionHash = hashCanonicalJson(action);
        const previous = actionPayloadHashByRef.get(action.id);
        if (previous !== undefined && previous !== actionHash) {
          context.addIssue({
            code: "custom",
            path: ["targets", targetIndex, "requiredActions", actionIndex],
            message: `DESIGN_TARGET_V3_GLOBAL_ACTION_PAYLOAD_MISMATCH: ${action.id} must be identical across targets`,
          });
        }
        actionPayloadHashByRef.set(action.id, actionHash);
      });
      target.requiredEvidencePredicates.forEach((predicate, predicateIndex) => {
        const predicateHash = hashCanonicalJson(predicate);
        const previous = evidencePayloadHashByRef.get(predicate.id);
        if (previous !== undefined && previous !== predicateHash) {
          context.addIssue({
            code: "custom",
            path: ["targets", targetIndex, "requiredEvidencePredicates", predicateIndex],
            message: `DESIGN_TARGET_V3_GLOBAL_EVIDENCE_PAYLOAD_MISMATCH: ${predicate.id} must be identical across targets`,
          });
        }
        evidencePayloadHashByRef.set(predicate.id, predicateHash);
      });
      target.requiredControlPlacements.forEach((placement, placementIndex) => {
        const previous = transportHashByAction.get(placement.actionRef);
        if (previous !== undefined && previous !== placement.actionInputTransportsHash) {
          context.addIssue({
            code: "custom",
            path: ["targets", targetIndex, "requiredControlPlacements", placementIndex, "actionInputTransportsHash"],
            message: `DESIGN_TARGET_V3_GLOBAL_ACTION_INPUT_SET_MISMATCH: ${placement.actionRef} has inconsistent transport contracts across targets`,
          });
        }
        transportHashByAction.set(placement.actionRef, placement.actionInputTransportsHash);
      });
    });

    if (value.targetsHash !== hashCanonicalJson(value.targets)) {
      context.addIssue({
        code: "custom",
        path: ["targetsHash"],
        message: "DESIGN_TARGET_V3_TARGETS_HASH_MISMATCH: targetsHash must bind the exact ordered targets",
      });
    }
    if (value.payloadHash !== hashDesignGenerationTargetsV3(value)) {
      context.addIssue({
        code: "custom",
        path: ["payloadHash"],
        message: "DESIGN_TARGET_V3_PAYLOAD_HASH_MISMATCH: payloadHash must bind productSpecHash, targets, and targetsHash",
      });
    }
  });
