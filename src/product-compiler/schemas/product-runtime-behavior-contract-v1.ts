import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  EntityFieldIdSchema,
  EntityIdSchema,
  EvidenceIdSchema,
  ObservableIdSchema,
  RequirementIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  StateIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";

export const PRODUCT_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1 =
  "setfarm.product-runtime-behavior-proposal.v1";
export const PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_SCHEMA_V1 =
  "setfarm.product-runtime-behavior-contract.v1";
export const PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_VERSION_V1 = "1.0.0";

export const PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1 = Object.freeze([
  "PRODUCT_RUNTIME_BEHAVIOR_V1_EVIDENCE_REGISTRY_UNVERIFIED",
  "PRODUCT_RUNTIME_BEHAVIOR_V1_PLAN_OUTPUT_INTEGRATION_UNVERIFIED",
  "PRODUCT_RUNTIME_BEHAVIOR_V1_RELEASE_MANIFEST_UNVERIFIED",
  "PRODUCT_RUNTIME_BEHAVIOR_V1_RUNTIME_GENERATOR_INTEGRATION_UNVERIFIED",
  "PRODUCT_RUNTIME_BEHAVIOR_V1_TEST_GENERATOR_INTEGRATION_UNVERIFIED",
] as const);

const JsonPointerSchema = z.string().max(500).refine(
  (value) => /^(?:\/(?:[^~]|~[01])*)*$/.test(value),
  "Expected an empty or RFC 6901 JSON Pointer",
);

const CanonicalStringSetSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.array(item).min(1).max(1_000).refine(
    (values) => hasUniqueStrings(values as readonly string[]),
    "References must be unique",
  );

export const ProductRuntimeBehaviorSubjectV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("state_path"),
    stateRef: StateIdSchema,
    path: JsonPointerSchema,
  }).strict(),
  z.object({
    kind: z.literal("state_each"),
    stateRef: StateIdSchema,
    collectionPath: JsonPointerSchema,
    itemPath: JsonPointerSchema,
  }).strict(),
]);

export type ProductRuntimeBehaviorSubjectV1 = z.infer<
  typeof ProductRuntimeBehaviorSubjectV1Schema
>;

const JsonTypeV1Schema = z.enum([
  "array",
  "boolean",
  "null",
  "number",
  "object",
  "string",
]);

export const ProductRuntimeBehaviorPredicateV1Schema = z.discriminatedUnion(
  "operator",
  [
    z.object({ operator: z.literal("equals"), expected: z.json() }).strict(),
    z.object({ operator: z.literal("not_equals"), expected: z.json() }).strict(),
    z.object({ operator: z.literal("exists") }).strict(),
    z.object({ operator: z.literal("not_exists") }).strict(),
    z.object({ operator: z.literal("truthy") }).strict(),
    z.object({ operator: z.literal("falsy") }).strict(),
    z.object({ operator: z.literal("type_is"), expected: JsonTypeV1Schema }).strict(),
    z.object({
      operator: z.literal("one_of"),
      expected: z.array(z.json()).min(1).max(100),
    }).strict().superRefine((value, context) => {
      const hashes = value.expected.map((item) => hashCanonicalJson(item));
      if (!hasUniqueStrings(hashes)) {
        context.addIssue({
          code: "custom",
          path: ["expected"],
          message: "one_of values must be canonically unique",
        });
      }
    }),
    z.object({
      operator: z.literal("min_length"),
      expected: z.number().int().nonnegative().max(1_000_000),
    }).strict(),
    z.object({
      operator: z.literal("max_length"),
      expected: z.number().int().nonnegative().max(1_000_000),
    }).strict(),
    z.object({
      operator: z.literal("minimum"),
      expected: z.number().finite(),
    }).strict(),
    z.object({
      operator: z.literal("maximum"),
      expected: z.number().finite(),
    }).strict(),
    z.object({
      operator: z.literal("min_items"),
      expected: z.number().int().nonnegative().max(100_000),
    }).strict(),
    z.object({
      operator: z.literal("max_items"),
      expected: z.number().int().nonnegative().max(100_000),
    }).strict(),
  ],
);

export type ProductRuntimeBehaviorPredicateV1 = z.infer<
  typeof ProductRuntimeBehaviorPredicateV1Schema
>;

export const ProductRuntimeBehaviorAssertionProposalV1Schema = z.object({
  subject: ProductRuntimeBehaviorSubjectV1Schema,
  predicate: ProductRuntimeBehaviorPredicateV1Schema,
}).strict();

export type ProductRuntimeBehaviorAssertionProposalV1 = z.infer<
  typeof ProductRuntimeBehaviorAssertionProposalV1Schema
>;

export const ProductRuntimeBehaviorSemanticCoverageRefV1Schema =
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("action_delta"),
      actionRef: ActionIdSchema,
      deltaOrdinal: z.number().int().nonnegative().max(499),
    }).strict(),
    z.object({
      kind: z.literal("action_precondition"),
      actionRef: ActionIdSchema,
      preconditionOrdinal: z.number().int().nonnegative().max(499),
    }).strict(),
    z.object({
      kind: z.literal("action_observable"),
      actionRef: ActionIdSchema,
      observableRef: ObservableIdSchema,
    }).strict(),
    z.object({
      kind: z.literal("persistence_effect"),
      actionRef: ActionIdSchema,
      effectOrdinal: z.number().int().nonnegative().max(499),
    }).strict(),
  ]);

export type ProductRuntimeBehaviorSemanticCoverageRefV1 = z.infer<
  typeof ProductRuntimeBehaviorSemanticCoverageRefV1Schema
>;

const RuntimeAssertionsDispositionProposalV1Schema = z.object({
  kind: z.literal("runtime_assertions"),
  assertions: z.array(ProductRuntimeBehaviorAssertionProposalV1Schema)
    .min(1).max(100),
}).strict();

const StructuredSemanticDispositionProposalV1Schema = z.object({
  kind: z.literal("structured_semantic_coverage"),
  coverageRefs: z.array(ProductRuntimeBehaviorSemanticCoverageRefV1Schema)
    .min(1).max(100),
}).strict();

const NonRuntimeDispositionProposalV1Schema = z.object({
  kind: z.literal("non_runtime_requirement"),
  evidenceRefs: CanonicalStringSetSchema(EvidenceIdSchema),
}).strict();

export const ProductRuntimeInvariantDispositionProposalV1Schema =
  z.discriminatedUnion("kind", [
    RuntimeAssertionsDispositionProposalV1Schema,
    StructuredSemanticDispositionProposalV1Schema,
    NonRuntimeDispositionProposalV1Schema,
  ]);

export const ProductRuntimeInvariantBindingProposalV1Schema = z.object({
  stateRef: StateIdSchema,
  invariantOrdinal: z.number().int().nonnegative().max(199),
  requirementRefs: CanonicalStringSetSchema(RequirementIdSchema),
  disposition: ProductRuntimeInvariantDispositionProposalV1Schema,
}).strict();

export const ProductRuntimeEntitySnapshotSelectionV1Schema =
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("singleton") }).strict(),
    z.object({
      kind: z.literal("match_input"),
      matchFieldRef: EntityFieldIdSchema,
      inputField: z.string().min(1).max(160).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    }).strict(),
  ]);

export type ProductRuntimeEntitySnapshotSelectionV1 = z.infer<
  typeof ProductRuntimeEntitySnapshotSelectionV1Schema
>;

export const ProductRuntimeEntitySnapshotV1Schema = z.object({
  stateRef: StateIdSchema,
  collectionPath: JsonPointerSchema,
  selection: ProductRuntimeEntitySnapshotSelectionV1Schema,
}).strict();

export type ProductRuntimeEntitySnapshotV1 = z.infer<
  typeof ProductRuntimeEntitySnapshotV1Schema
>;

export const ProductRuntimeEntityFieldBindingProposalV1Schema = z.object({
  actionRef: ActionIdSchema,
  deltaOrdinal: z.number().int().nonnegative().max(499),
  snapshot: ProductRuntimeEntitySnapshotV1Schema,
}).strict();

export const ProductRuntimeBehaviorProposalV1Schema = z.object({
  schema: z.literal(PRODUCT_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1),
  productSpecHash: Sha256Schema,
  invariantBindings: z.array(ProductRuntimeInvariantBindingProposalV1Schema)
    .max(20_000),
  entityFieldBindings: z.array(ProductRuntimeEntityFieldBindingProposalV1Schema)
    .max(20_000),
}).strict();

export type ProductRuntimeBehaviorProposalV1 = z.infer<
  typeof ProductRuntimeBehaviorProposalV1Schema
>;

export function hashProductRuntimeBehaviorProposalV1(
  value: ProductRuntimeBehaviorProposalV1,
): string {
  return hashCanonicalJson({
    schema: "setfarm.product-runtime-behavior-proposal-hash.v1",
    proposal: value,
  });
}

export const PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_V1 =
  recursivelyFreezeProductRuntimeBehaviorV1({
    schema: "setfarm.product-runtime-behavior-evaluator-contract.v1" as const,
    contractVersion: PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_VERSION_V1,
    checkpoints: ["initial", "after_action", "after_rehydration"] as const,
    stateSnapshot: "exact_state_ref_to_canonical_json_value" as const,
    pointerGrammar: "rfc6901" as const,
    missingPointer: "typed_missing_value_not_undefined" as const,
    everyQuantifier: "all_items_vacuous_for_empty_array" as const,
    equality: "canonical_json_deep_equality" as const,
    predicates: Object.freeze({
      truthy: "false_for_null_false_zero_and_empty_string_only" as const,
      stringLength: "utf16_code_units" as const,
      numberComparison: "finite_ecmascript_number_order" as const,
      oneOf: "canonical_json_equality_against_unique_values" as const,
      arrayItems: "direct_array_length" as const,
    }),
    entitySnapshot: Object.freeze({
      source: "state_before_action" as const,
      actionInput: "exact_declared_type_and_enum_domain" as const,
      singleton: "exact_plain_object_required" as const,
      matchInput: "every_member_typed_then_exactly_one_canonical_equal_match_required" as const,
      missingOrAmbiguous: "typed_action_failure" as const,
    }),
    bounds: Object.freeze({
      maxAssertions: 20_000,
      maxCollectionItemsPerAssertion: 10_000,
      maxSubjectVisits: 100_000,
    }),
  });

export const PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_HASH_V1 =
  hashCanonicalJson(PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_V1);

export function deriveProductRuntimeInvariantRefV1(input: Readonly<{
  stateRef: string;
  invariantOrdinal: number;
  invariantTextHash: string;
}>): string {
  return `RINV_${hashCanonicalJson({
    schema: "setfarm.product-runtime-invariant-ref.v1",
    stateRef: input.stateRef,
    invariantOrdinal: input.invariantOrdinal,
    invariantTextHash: input.invariantTextHash,
  }).toUpperCase()}`;
}

export function hashProductRuntimeAssertionPayloadV1(input: Readonly<{
  invariantRef: string;
  subject: ProductRuntimeBehaviorSubjectV1;
  predicate: ProductRuntimeBehaviorPredicateV1;
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.product-runtime-assertion-hash.v1",
    ...input,
  });
}

export function deriveProductRuntimeAssertionRefV1(input: Readonly<{
  invariantRef: string;
  subject: ProductRuntimeBehaviorSubjectV1;
  predicate: ProductRuntimeBehaviorPredicateV1;
}>): string {
  return `RASSERT_${hashProductRuntimeAssertionPayloadV1(input).toUpperCase()}`;
}

export function deriveProductRuntimeEntityFieldOccurrenceRefV1(input: Readonly<{
  actionRef: string;
  deltaOrdinal: number;
  valueSourceHash: string;
}>): string {
  return `ENTITYSRC_${hashCanonicalJson({
    schema: "setfarm.product-runtime-entity-field-occurrence-ref.v1",
    actionRef: input.actionRef,
    deltaOrdinal: input.deltaOrdinal,
    valueSourceHash: input.valueSourceHash,
  }).toUpperCase()}`;
}

export function hashProductRuntimeEntitySnapshotBindingV1(input: Readonly<{
  occurrenceRef: string;
  snapshot: ProductRuntimeEntitySnapshotV1;
}>): string {
  return hashCanonicalJson({
    schema: "setfarm.product-runtime-entity-snapshot-binding-hash.v1",
    ...input,
  });
}

export const ProductRuntimeBehaviorAssertionV1Schema = z.object({
  assertionRef: StableReferenceSchema,
  assertionHash: Sha256Schema,
  subject: ProductRuntimeBehaviorSubjectV1Schema,
  predicate: ProductRuntimeBehaviorPredicateV1Schema,
}).strict();

export type ProductRuntimeBehaviorAssertionV1 = z.infer<
  typeof ProductRuntimeBehaviorAssertionV1Schema
>;

const RuntimeAssertionsDispositionV1Schema = z.object({
  kind: z.literal("runtime_assertions"),
  assertions: z.array(ProductRuntimeBehaviorAssertionV1Schema).min(1).max(100),
}).strict();

const StructuredSemanticDispositionV1Schema = z.object({
  kind: z.literal("structured_semantic_coverage"),
  coverageRefs: z.array(ProductRuntimeBehaviorSemanticCoverageRefV1Schema)
    .min(1).max(100),
}).strict();

const NonRuntimeDispositionV1Schema = z.object({
  kind: z.literal("non_runtime_requirement"),
  evidenceRefs: CanonicalStringSetSchema(EvidenceIdSchema),
}).strict();

export const ProductRuntimeInvariantDispositionV1Schema = z.discriminatedUnion(
  "kind",
  [
    RuntimeAssertionsDispositionV1Schema,
    StructuredSemanticDispositionV1Schema,
    NonRuntimeDispositionV1Schema,
  ],
);

export const ProductRuntimeInvariantBindingV1Schema = z.object({
  invariantRef: StableReferenceSchema,
  stateRef: StateIdSchema,
  invariantOrdinal: z.number().int().nonnegative().max(199),
  invariantTextHash: Sha256Schema,
  requirementRefs: CanonicalStringSetSchema(RequirementIdSchema),
  disposition: ProductRuntimeInvariantDispositionV1Schema,
}).strict();

export type ProductRuntimeInvariantBindingV1 = z.infer<
  typeof ProductRuntimeInvariantBindingV1Schema
>;

export const ProductRuntimeEntityFieldBindingV1Schema = z.object({
  occurrenceRef: StableReferenceSchema,
  actionRef: ActionIdSchema,
  deltaOrdinal: z.number().int().nonnegative().max(499),
  entityRef: EntityIdSchema,
  fieldRef: EntityFieldIdSchema,
  valueSourceHash: Sha256Schema,
  snapshot: ProductRuntimeEntitySnapshotV1Schema,
  snapshotBindingHash: Sha256Schema,
}).strict();

export type ProductRuntimeEntityFieldBindingV1 = z.infer<
  typeof ProductRuntimeEntityFieldBindingV1Schema
>;

const ProductRuntimeBehaviorReadinessV1Schema = z.object({
  status: z.literal("shadow"),
  productionConsumption: z.literal("forbidden"),
  blockerCodes: z.tuple([
    z.literal(PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1[0]),
    z.literal(PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1[1]),
    z.literal(PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1[2]),
    z.literal(PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1[3]),
    z.literal(PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1[4]),
  ]),
}).strict();

const ProductRuntimeBehaviorContractPayloadV1Schema = z.object({
  schema: z.literal(PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_SCHEMA_V1),
  contractVersion: z.literal(PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_VERSION_V1),
  readiness: ProductRuntimeBehaviorReadinessV1Schema,
  authority: z.object({
    productSpecSchema: z.literal("setfarm.product-spec.v2"),
    productSpecHash: Sha256Schema,
    sourceTaskHash: Sha256Schema,
    proposalSchema: z.literal(PRODUCT_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1),
    proposalHash: Sha256Schema,
    evaluatorContractHash: Sha256Schema,
  }).strict(),
  invariantBindings: z.array(ProductRuntimeInvariantBindingV1Schema).max(20_000),
  entityFieldBindings: z.array(ProductRuntimeEntityFieldBindingV1Schema).max(20_000),
  coverage: z.object({
    proseInvariantCount: z.number().int().nonnegative().max(20_000),
    invariantBindingCount: z.number().int().nonnegative().max(20_000),
    runtimeAssertionCount: z.number().int().nonnegative().max(2_000_000),
    structuredSemanticCoverageCount: z.number().int().nonnegative().max(2_000_000),
    nonRuntimeRequirementCount: z.number().int().nonnegative().max(20_000),
    entityFieldOccurrenceCount: z.number().int().nonnegative().max(20_000),
    entityFieldBindingCount: z.number().int().nonnegative().max(20_000),
    disposition: z.literal(
      "every_opaque_product_behavior_has_one_typed_execution_or_evidence_disposition",
    ),
  }).strict(),
}).strict();

export type ProductRuntimeBehaviorContractHashPayloadV1 = z.infer<
  typeof ProductRuntimeBehaviorContractPayloadV1Schema
>;

export function hashProductRuntimeBehaviorContractV1(
  value:
    | ProductRuntimeBehaviorContractHashPayloadV1
    | ProductRuntimeBehaviorContractV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.contractHash;
  return hashCanonicalJson({
    schema: "setfarm.product-runtime-behavior-contract-hash.v1",
    contract: payload,
  });
}

function isCanonicalBy<T>(
  values: readonly T[],
  identity: (value: T) => string,
): boolean {
  const refs = values.map(identity);
  return hasUniqueStrings(refs) && refs.every((value, index) =>
    index === 0 || refs[index - 1]! < value);
}

function addContractClosureIssuesV1(
  value: ProductRuntimeBehaviorContractHashPayloadV1 & { contractHash: string },
  context: z.RefinementCtx,
): void {
  if (
    canonicalJsonStringify(value.readiness.blockerCodes)
      !== canonicalJsonStringify(PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "Behavior-contract blockers must equal the code-owned canonical set",
    });
  }
  if (
    value.authority.evaluatorContractHash
      !== PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_HASH_V1
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority", "evaluatorContractHash"],
      message: "Behavior contract must bind the exact code-owned evaluator",
    });
  }
  if (!isCanonicalBy(value.invariantBindings, (binding) => binding.invariantRef)) {
    context.addIssue({
      code: "custom",
      path: ["invariantBindings"],
      message: "Invariant bindings must be unique and canonically ordered",
    });
  }
  value.invariantBindings.forEach((binding, bindingIndex) => {
    const expectedInvariantRef = deriveProductRuntimeInvariantRefV1(binding);
    if (binding.invariantRef !== expectedInvariantRef) {
      context.addIssue({
        code: "custom",
        path: ["invariantBindings", bindingIndex, "invariantRef"],
        message: "Invariant ref must bind state, ordinal and prose hash",
      });
    }
    if (binding.disposition.kind === "runtime_assertions") {
      if (!isCanonicalBy(
        binding.disposition.assertions,
        (assertion) => assertion.assertionRef,
      )) {
        context.addIssue({
          code: "custom",
          path: ["invariantBindings", bindingIndex, "disposition", "assertions"],
          message: "Runtime assertions must be unique and canonically ordered",
        });
      }
      binding.disposition.assertions.forEach((assertion, assertionIndex) => {
        const hashInput = {
          invariantRef: binding.invariantRef,
          subject: assertion.subject,
          predicate: assertion.predicate,
        };
        if (assertion.assertionHash !== hashProductRuntimeAssertionPayloadV1(hashInput)) {
          context.addIssue({
            code: "custom",
            path: ["invariantBindings", bindingIndex, "disposition", "assertions", assertionIndex, "assertionHash"],
            message: "Runtime assertion hash must bind invariant, subject and predicate",
          });
        }
        if (assertion.assertionRef !== deriveProductRuntimeAssertionRefV1(hashInput)) {
          context.addIssue({
            code: "custom",
            path: ["invariantBindings", bindingIndex, "disposition", "assertions", assertionIndex, "assertionRef"],
            message: "Runtime assertion ref must derive from its exact payload",
          });
        }
      });
    }
    if (
      binding.disposition.kind === "structured_semantic_coverage"
      && !isCanonicalBy(
        binding.disposition.coverageRefs,
        (reference) => canonicalJsonStringify(reference),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["invariantBindings", bindingIndex, "disposition", "coverageRefs"],
        message: "Structured semantic coverage refs must be unique and canonical",
      });
    }
    if (
      binding.disposition.kind === "non_runtime_requirement"
      && !isCanonicalBy(binding.disposition.evidenceRefs, (reference) => reference)
    ) {
      context.addIssue({
        code: "custom",
        path: ["invariantBindings", bindingIndex, "disposition", "evidenceRefs"],
        message: "Non-runtime evidence refs must be unique and canonical",
      });
    }
    if (!isCanonicalBy(binding.requirementRefs, (reference) => reference)) {
      context.addIssue({
        code: "custom",
        path: ["invariantBindings", bindingIndex, "requirementRefs"],
        message: "Invariant requirement refs must be unique and canonical",
      });
    }
  });
  if (!isCanonicalBy(value.entityFieldBindings, (binding) => binding.occurrenceRef)) {
    context.addIssue({
      code: "custom",
      path: ["entityFieldBindings"],
      message: "Entity-field bindings must be unique and canonically ordered",
    });
  }
  value.entityFieldBindings.forEach((binding, bindingIndex) => {
    if (binding.occurrenceRef !== deriveProductRuntimeEntityFieldOccurrenceRefV1(binding)) {
      context.addIssue({
        code: "custom",
        path: ["entityFieldBindings", bindingIndex, "occurrenceRef"],
        message: "Entity-field occurrence ref must bind action, ordinal and value source",
      });
    }
    if (
      binding.snapshotBindingHash
        !== hashProductRuntimeEntitySnapshotBindingV1({
          occurrenceRef: binding.occurrenceRef,
          snapshot: binding.snapshot,
        })
    ) {
      context.addIssue({
        code: "custom",
        path: ["entityFieldBindings", bindingIndex, "snapshotBindingHash"],
        message: "Entity snapshot hash must bind occurrence and exact selection",
      });
    }
  });

  const runtimeAssertionCount = value.invariantBindings.reduce(
    (total, binding) => total + (
      binding.disposition.kind === "runtime_assertions"
        ? binding.disposition.assertions.length
        : 0
    ),
    0,
  );
  const structuredSemanticCoverageCount = value.invariantBindings.reduce(
    (total, binding) => total + (
      binding.disposition.kind === "structured_semantic_coverage"
        ? binding.disposition.coverageRefs.length
        : 0
    ),
    0,
  );
  const nonRuntimeRequirementCount = value.invariantBindings.filter(
    (binding) => binding.disposition.kind === "non_runtime_requirement",
  ).length;
  const expectedCoverage = {
    proseInvariantCount: value.invariantBindings.length,
    invariantBindingCount: value.invariantBindings.length,
    runtimeAssertionCount,
    structuredSemanticCoverageCount,
    nonRuntimeRequirementCount,
    entityFieldOccurrenceCount: value.entityFieldBindings.length,
    entityFieldBindingCount: value.entityFieldBindings.length,
    disposition:
      "every_opaque_product_behavior_has_one_typed_execution_or_evidence_disposition",
  };
  if (canonicalJsonStringify(value.coverage) !== canonicalJsonStringify(expectedCoverage)) {
    context.addIssue({
      code: "custom",
      path: ["coverage"],
      message: "Behavior coverage must equal exact binding cardinalities",
    });
  }
  if (value.contractHash !== hashProductRuntimeBehaviorContractV1(value)) {
    context.addIssue({
      code: "custom",
      path: ["contractHash"],
      message: "Behavior contract hash must bind the complete payload",
    });
  }
}

const ProductRuntimeBehaviorContractCandidateV1Schema =
  ProductRuntimeBehaviorContractPayloadV1Schema.extend({
    contractHash: Sha256Schema,
  }).strict().superRefine(addContractClosureIssuesV1);

export const ProductRuntimeBehaviorContractV1Schema =
  ProductRuntimeBehaviorContractCandidateV1Schema;

export type ProductRuntimeBehaviorContractV1 = z.infer<
  typeof ProductRuntimeBehaviorContractV1Schema
>;

export function recursivelyFreezeProductRuntimeBehaviorV1<T>(value: T): T {
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
