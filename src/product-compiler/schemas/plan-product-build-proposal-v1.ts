import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  PlanSemanticKeyV2Schema,
  PlanSemanticProposalV2Schema,
} from "./plan-semantic-proposal-v2.js";
import {
  ProductRuntimeBehaviorPredicateV1Schema,
} from "./product-runtime-behavior-contract-v1.js";
import {
  ActionIdSchema,
  EntityFieldIdSchema,
  EntityIdSchema,
  EvidenceIdSchema,
  ObservableIdSchema,
  PersistenceIdSchema,
  Sha256Schema,
  StateIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";

export const PLAN_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1 =
  "setfarm.plan-runtime-behavior-proposal.v1" as const;
export const PLAN_PRODUCT_BUILD_PROPOSAL_SCHEMA_V1 =
  "setfarm.plan-product-build-proposal.v1" as const;
export const PLAN_PRODUCT_BUILD_AUTHORITY_SCHEMA_V1 =
  "setfarm.plan-product-build-authority.v1" as const;
export const PLAN_PRODUCT_BUILD_AUTHORITY_VERSION_V1 = "1.0.0" as const;

export const PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1 = Object.freeze([
  "PLAN_PRODUCT_BUILD_V1_DOWNSTREAM_HASH_INTEGRATION_UNVERIFIED",
  "PLAN_PRODUCT_BUILD_V1_EVAL_UNVERIFIED",
  "PLAN_PRODUCT_BUILD_V1_PLAN_OUTPUT_INTEGRATION_UNVERIFIED",
  "PLAN_PRODUCT_BUILD_V1_RELEASE_MANIFEST_UNVERIFIED",
  "PLAN_PRODUCT_BUILD_V1_STANDALONE_NODE_COMPILER_UNVERIFIED",
] as const);

const JsonPointerV1Schema = z.string().max(500).refine(
  (value) => /^(?:\/(?:[^~]|~[01])*)*$/u.test(value),
  "Expected an empty or RFC 6901 JSON Pointer",
);

export const PlanRuntimeBehaviorSubjectV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("state_path"),
    path: JsonPointerV1Schema,
  }).strict(),
  z.object({
    kind: z.literal("state_each"),
    collectionPath: JsonPointerV1Schema,
    itemPath: JsonPointerV1Schema,
  }).strict(),
]);

export type PlanRuntimeBehaviorSubjectV1 = z.infer<
  typeof PlanRuntimeBehaviorSubjectV1Schema
>;

export const PlanRuntimeBehaviorAssertionV1Schema = z.object({
  subject: PlanRuntimeBehaviorSubjectV1Schema,
  predicate: ProductRuntimeBehaviorPredicateV1Schema,
}).strict();

export const PlanRuntimeBehaviorSemanticCoverageRefV1Schema =
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("action_delta"),
      actionKey: PlanSemanticKeyV2Schema,
      stateDeltaKey: PlanSemanticKeyV2Schema,
    }).strict(),
    z.object({
      kind: z.literal("action_precondition"),
      actionKey: PlanSemanticKeyV2Schema,
      preconditionOrdinal: z.number().int().nonnegative().max(499),
    }).strict(),
    z.object({
      kind: z.literal("action_observable"),
      actionKey: PlanSemanticKeyV2Schema,
      observableKey: PlanSemanticKeyV2Schema,
    }).strict(),
    z.object({
      kind: z.literal("persistence_effect"),
      actionKey: PlanSemanticKeyV2Schema,
      persistenceIntentOrdinal: z.number().int().nonnegative().max(499),
    }).strict(),
  ]);

export type PlanRuntimeBehaviorSemanticCoverageRefV1 = z.infer<
  typeof PlanRuntimeBehaviorSemanticCoverageRefV1Schema
>;

export const PlanRuntimeBehaviorEvidenceRefV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("observable_outcome"),
    actionKey: PlanSemanticKeyV2Schema,
    observableKey: PlanSemanticKeyV2Schema,
  }).strict(),
  z.object({
    kind: z.literal("action_invocation"),
    actionKey: PlanSemanticKeyV2Schema,
  }).strict(),
  z.object({
    kind: z.literal("persistence_round_trip"),
    actionKey: PlanSemanticKeyV2Schema,
    policyKey: PlanSemanticKeyV2Schema,
  }).strict(),
]);

export type PlanRuntimeBehaviorEvidenceRefV1 = z.infer<
  typeof PlanRuntimeBehaviorEvidenceRefV1Schema
>;

const PlanRuntimeAssertionsDispositionV1Schema = z.object({
  kind: z.literal("runtime_assertions"),
  assertions: z.array(PlanRuntimeBehaviorAssertionV1Schema).min(1).max(100),
}).strict();

const PlanRuntimeStructuredCoverageDispositionV1Schema = z.object({
  kind: z.literal("structured_semantic_coverage"),
  coverageRefs: z.array(PlanRuntimeBehaviorSemanticCoverageRefV1Schema)
    .min(1).max(100),
}).strict();

const PlanRuntimeNonRuntimeDispositionV1Schema = z.object({
  kind: z.literal("non_runtime_requirement"),
  evidenceRefs: z.array(PlanRuntimeBehaviorEvidenceRefV1Schema).min(1).max(1_000),
}).strict();

export const PlanRuntimeInvariantBindingV1Schema = z.object({
  stateKey: PlanSemanticKeyV2Schema,
  invariantOrdinal: z.number().int().nonnegative().max(199),
  disposition: z.discriminatedUnion("kind", [
    PlanRuntimeAssertionsDispositionV1Schema,
    PlanRuntimeStructuredCoverageDispositionV1Schema,
    PlanRuntimeNonRuntimeDispositionV1Schema,
  ]),
}).strict();

export const PlanRuntimeEntitySnapshotSelectionV1Schema =
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("singleton") }).strict(),
    z.object({
      kind: z.literal("match_input"),
      matchFieldKey: PlanSemanticKeyV2Schema,
      inputField: z.string().min(1).max(160).regex(/^[A-Za-z][A-Za-z0-9_]*$/u),
    }).strict(),
  ]);

export const PlanRuntimeEntityFieldBindingV1Schema = z.object({
  actionKey: PlanSemanticKeyV2Schema,
  stateDeltaKey: PlanSemanticKeyV2Schema,
  snapshot: z.object({
    stateKey: PlanSemanticKeyV2Schema,
    collectionPath: JsonPointerV1Schema,
    selection: PlanRuntimeEntitySnapshotSelectionV1Schema,
  }).strict(),
}).strict();

export const PlanRuntimeBehaviorProposalV1Schema = z.object({
  schema: z.literal(PLAN_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1),
  invariantBindings: z.array(PlanRuntimeInvariantBindingV1Schema).max(20_000),
  entityFieldBindings: z.array(PlanRuntimeEntityFieldBindingV1Schema).max(20_000),
}).strict().superRefine((value, context) => {
  const invariantKeys = value.invariantBindings.map((binding) =>
    `${binding.stateKey}\0${binding.invariantOrdinal}`);
  if (!hasUniqueStrings(invariantKeys)) {
    context.addIssue({
      code: "custom",
      path: ["invariantBindings"],
      message: "Plan runtime invariant occurrence keys must be unique",
    });
  }
  const entityKeys = value.entityFieldBindings.map((binding) =>
    `${binding.actionKey}\0${binding.stateDeltaKey}`);
  if (!hasUniqueStrings(entityKeys)) {
    context.addIssue({
      code: "custom",
      path: ["entityFieldBindings"],
      message: "Plan runtime entity-field occurrence keys must be unique",
    });
  }
});

export type PlanRuntimeBehaviorProposalV1 = z.infer<
  typeof PlanRuntimeBehaviorProposalV1Schema
>;

export const PlanProductBuildProposalV1Schema = z.object({
  schema: z.literal(PLAN_PRODUCT_BUILD_PROPOSAL_SCHEMA_V1),
  semantics: PlanSemanticProposalV2Schema,
  runtimeBehavior: PlanRuntimeBehaviorProposalV1Schema,
}).strict();

export type PlanProductBuildProposalV1 = z.infer<
  typeof PlanProductBuildProposalV1Schema
>;

export function hashPlanProductBuildProposalV1(
  value: PlanProductBuildProposalV1,
): string {
  return hashCanonicalJson({
    schema: "setfarm.plan-product-build-proposal-hash.v1",
    proposal: value,
  });
}

const StateReferenceV1Schema = z.object({
  stateKey: PlanSemanticKeyV2Schema,
  stateRef: StateIdSchema,
  invariantCount: z.number().int().nonnegative().max(200),
}).strict();

const EntityReferenceV1Schema = z.object({
  entityKey: PlanSemanticKeyV2Schema,
  entityRef: EntityIdSchema,
  fields: z.array(z.object({
    fieldKey: PlanSemanticKeyV2Schema,
    fieldRef: EntityFieldIdSchema,
  }).strict()).min(1).max(500),
}).strict();

const ActionReferenceV1Schema = z.object({
  actionKey: PlanSemanticKeyV2Schema,
  actionRef: ActionIdSchema,
  invocationEvidenceRef: EvidenceIdSchema,
  preconditionCount: z.number().int().nonnegative().max(500),
  stateDeltas: z.array(z.object({
    stateDeltaKey: PlanSemanticKeyV2Schema,
    deltaOrdinal: z.number().int().nonnegative().max(499),
  }).strict()).max(500),
  observables: z.array(z.object({
    observableKey: PlanSemanticKeyV2Schema,
    observableRef: ObservableIdSchema,
    evidenceRef: EvidenceIdSchema,
  }).strict()).min(1).max(499),
  persistenceEffects: z.array(z.object({
    persistenceIntentOrdinal: z.number().int().nonnegative().max(499),
    policyKey: PlanSemanticKeyV2Schema,
    policyRef: PersistenceIdSchema,
    evidenceRef: EvidenceIdSchema,
  }).strict()).max(500),
}).strict();

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalBy<T>(
  values: readonly T[],
  identity: (value: T) => string,
): boolean {
  const identities = values.map(identity);
  return hasUniqueStrings(identities) && identities.every((identity, index) =>
    index === 0 || compareUtf16(identities[index - 1]!, identity) < 0);
}

export const PlanProductBuildReferenceMapV1Schema = z.object({
  schema: z.literal("setfarm.plan-product-build-reference-map.v1"),
  states: z.array(StateReferenceV1Schema).max(500),
  entities: z.array(EntityReferenceV1Schema).max(500),
  actions: z.array(ActionReferenceV1Schema).min(1).max(2_000),
}).strict().superRefine((value, context) => {
  if (!canonicalBy(value.states, (item) => item.stateKey)) {
    context.addIssue({ code: "custom", path: ["states"], message: "State map must be canonical" });
  }
  if (!canonicalBy(value.entities, (item) => item.entityKey)) {
    context.addIssue({ code: "custom", path: ["entities"], message: "Entity map must be canonical" });
  }
  if (!canonicalBy(value.actions, (item) => item.actionKey)) {
    context.addIssue({ code: "custom", path: ["actions"], message: "Action map must be canonical" });
  }
  value.entities.forEach((entity, entityIndex) => {
    if (canonicalBy(entity.fields, (item) => item.fieldKey)) return;
    context.addIssue({
      code: "custom",
      path: ["entities", entityIndex, "fields"],
      message: "Entity field map must be canonical",
    });
  });
  value.actions.forEach((action, actionIndex) => {
    if (!canonicalBy(action.stateDeltas, (item) => item.stateDeltaKey)) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "stateDeltas"],
        message: "State-delta map must be canonical",
      });
    }
    if (!canonicalBy(action.observables, (item) => item.observableKey)) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "observables"],
        message: "Observable map must be canonical",
      });
    }
    const ordinals = action.persistenceEffects.map((item) =>
      item.persistenceIntentOrdinal.toString().padStart(3, "0"));
    if (!canonicalBy(ordinals, (item) => item)) {
      context.addIssue({
        code: "custom",
        path: ["actions", actionIndex, "persistenceEffects"],
        message: "Persistence-effect map must be ordinal-canonical",
      });
    }
  });
});

export type PlanProductBuildReferenceMapV1 = z.infer<
  typeof PlanProductBuildReferenceMapV1Schema
>;

export function hashPlanProductBuildReferenceMapV1(
  value: PlanProductBuildReferenceMapV1,
): string {
  return hashCanonicalJson({
    schema: "setfarm.plan-product-build-reference-map-hash.v1",
    referenceMap: value,
  });
}

const PlanProductBuildAuthorityPayloadV1Schema = z.object({
  schema: z.literal(PLAN_PRODUCT_BUILD_AUTHORITY_SCHEMA_V1),
  contractVersion: z.literal(PLAN_PRODUCT_BUILD_AUTHORITY_VERSION_V1),
  readiness: z.object({
    status: z.literal("shadow"),
    productionConsumption: z.literal("forbidden"),
    blockerCodes: z.tuple([
      z.literal(PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1[0]),
      z.literal(PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1[1]),
      z.literal(PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1[2]),
      z.literal(PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1[3]),
      z.literal(PLAN_PRODUCT_BUILD_BLOCKER_CODES_V1[4]),
    ]),
  }).strict(),
  source: z.object({
    sourceTaskHash: Sha256Schema,
    envelopeHash: Sha256Schema,
    semanticProposalHash: Sha256Schema,
  }).strict(),
  outputs: z.object({
    productSpecHash: Sha256Schema,
    deliverySelectionHash: Sha256Schema,
    runtimeBehaviorProposalHash: Sha256Schema,
    runtimeBehaviorContractHash: Sha256Schema,
    referenceMapHash: Sha256Schema,
  }).strict(),
  referenceMap: PlanProductBuildReferenceMapV1Schema,
  coverage: z.object({
    stateCount: z.number().int().nonnegative().max(500),
    entityCount: z.number().int().nonnegative().max(500),
    entityFieldCount: z.number().int().nonnegative().max(250_000),
    actionCount: z.number().int().positive().max(2_000),
    stateDeltaCount: z.number().int().nonnegative().max(1_000_000),
    observableCount: z.number().int().positive().max(998_000),
    persistenceEffectCount: z.number().int().nonnegative().max(1_000_000),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.outputs.referenceMapHash !== hashPlanProductBuildReferenceMapV1(value.referenceMap)) {
    context.addIssue({
      code: "custom",
      path: ["outputs", "referenceMapHash"],
      message: "Plan product-build reference-map hash mismatch",
    });
  }
  const expectedCoverage = {
    stateCount: value.referenceMap.states.length,
    entityCount: value.referenceMap.entities.length,
    entityFieldCount: value.referenceMap.entities.reduce(
      (total, entity) => total + entity.fields.length,
      0,
    ),
    actionCount: value.referenceMap.actions.length,
    stateDeltaCount: value.referenceMap.actions.reduce(
      (total, action) => total + action.stateDeltas.length,
      0,
    ),
    observableCount: value.referenceMap.actions.reduce(
      (total, action) => total + action.observables.length,
      0,
    ),
    persistenceEffectCount: value.referenceMap.actions.reduce(
      (total, action) => total + action.persistenceEffects.length,
      0,
    ),
  };
  if (hashCanonicalJson(value.coverage) !== hashCanonicalJson(expectedCoverage)) {
    context.addIssue({
      code: "custom",
      path: ["coverage"],
      message: "Plan product-build coverage does not equal its exact reference map",
    });
  }
});

export type PlanProductBuildAuthorityHashPayloadV1 = z.infer<
  typeof PlanProductBuildAuthorityPayloadV1Schema
>;

export function hashPlanProductBuildAuthorityV1(
  value: PlanProductBuildAuthorityHashPayloadV1 | PlanProductBuildAuthorityV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.authorityHash;
  return hashCanonicalJson({
    schema: "setfarm.plan-product-build-authority-hash.v1",
    authority: payload,
  });
}

export const PlanProductBuildAuthorityV1Schema =
  PlanProductBuildAuthorityPayloadV1Schema.extend({
    authorityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.authorityHash === hashPlanProductBuildAuthorityV1(value)) return;
    context.addIssue({
      code: "custom",
      path: ["authorityHash"],
      message: "Plan product-build authority hash mismatch",
    });
  });

export type PlanProductBuildAuthorityV1 = z.infer<
  typeof PlanProductBuildAuthorityV1Schema
>;

export function recursivelyFreezePlanProductBuildV1<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}
