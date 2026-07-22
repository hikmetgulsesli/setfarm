import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  ControlIdSchema,
  EntityFieldIdSchema,
  EntityIdSchema,
  EvidenceIdSchema,
  ObservableIdSchema,
  PathBindingIdSchema,
  PersistenceIdSchema,
  ProductIdSchema,
  RouteIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  StateIdSchema,
  StoryIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ControlSlotIdSchema } from "./common-v2.js";
import {
  BUILD_TOPOLOGY_CONTRACT_HASH_V3,
  BUILD_TOPOLOGY_V3_SCHEMA,
  BUILD_TOPOLOGY_VERSION_V3,
} from "./build-topology-v3.js";
import {
  FILE_TREE_MANIFEST_CONTRACT_HASH_V3,
  FILE_TREE_MANIFEST_V3_SCHEMA,
  FILE_TREE_MANIFEST_VERSION_V3,
} from "./file-tree-manifest-v3.js";
import {
  NodeProductRuntimeGeneratedMemberBindingV2Schema,
  hashNodeProductRuntimeGeneratedMemberMembershipV2,
  hashRuntimeBehaviorAssertionSourceMembershipV2,
  hashRuntimeBehaviorEntityFieldSourceMembershipV2,
} from "./node-product-runtime-source-v2.js";
import {
  NodeProductActionTestBindingV2Schema,
  NodeProductBehaviorAssertionTestBindingV2Schema,
  NodeProductEntityFieldTestBindingV2Schema,
  NodeProductTestCoverageMemberV2Schema,
  hashNodeProductActionTestMembershipV2,
  hashNodeProductBehaviorAssertionTestMembershipV2,
  hashNodeProductEntityFieldTestMembershipV2,
  hashNodeProductTestCoverageMemberMembershipV2,
} from "./node-product-test-source-v2.js";
import {
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
  SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2,
  SEMANTIC_REALIZATION_PLAN_V2_SCHEMA,
  SEMANTIC_REALIZATION_PLAN_V2_VERSION,
  hashSemanticRealizationMembershipV2,
} from "./semantic-realization-plan-v2.js";
import {
  hashSemanticStoryPartitionComponentV3,
} from "./semantic-source-intent-set-v1.js";
import {
  SemanticSourceResponsibilityV1Schema,
  SemanticSourceSubjectKindV1Schema,
} from "./stack-semantic-source-rules-v1.js";

export const STORY_PLAN_V3_SCHEMA = "setfarm.story-plan.v3" as const;
export const STORY_PLAN_V3_VERSION = "3.0.0" as const;
export const STORY_PLAN_V3_MAX_CANONICAL_BYTES = 4 * 1024 * 1024;
export const STORY_PLAN_V3_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 20,
  maxNodes: STORY_PLAN_V3_MAX_CANONICAL_BYTES + 80_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (STORY_PLAN_V3_MAX_CANONICAL_BYTES * 8) + (4 * 1024 * 1024),
});

export const STORY_PLAN_V3_BLOCKER_CODES = Object.freeze([
  "STORY_PLAN_V3_AUTHENTICATED_BUILD_TEST_EVIDENCE_UNVERIFIED",
  "STORY_PLAN_V3_EVIDENCE_REGISTRY_V2_UNVERIFIED",
  "STORY_PLAN_V3_IMPLEMENTATION_SOURCE_MAP_V2_UNVERIFIED",
  "STORY_PLAN_V3_PRODUCT_BUILD_PACKET_V4_UNVERIFIED",
  "STORY_PLAN_V3_RELEASE_MANIFEST_UNVERIFIED",
] as const);

export const STORY_PLAN_CONTRACT_V3 = Object.freeze({
  schema: "setfarm.story-plan-contract.v3" as const,
  contractVersion: STORY_PLAN_V3_VERSION,
  stage: "generated_sources_verified_before_source_map" as const,
  sourceAuthority: Object.freeze({
    storyPartition: "fresh_entity_aware_semantic_partition_v3" as const,
    realizations: "verified_semantic_realization_plan_v2" as const,
    runtimeSource: "fresh_verified_node_runtime_source_receipt_v2" as const,
    testSource: "fresh_verified_node_test_source_receipt_v2" as const,
    physicalTopology: "verified_file_tree_v3_and_build_topology_v3" as const,
    design: "no_design_only_first_node_slice" as const,
    modelAuthoredDeclarations:
      "explicit_not_applicable_selected_profiles_forbid_model_writes" as const,
  }),
  ownership: Object.freeze({
    generatedFiles: "code_owned_whole_file" as const,
    storyConsumption: "exact_receipt_members_not_file_ownership" as const,
    unscopedRealizations: "explicit_product_scope_closure" as const,
    physicalStoryGrants: "none_in_current_node_profiles" as const,
  }),
  closure: Object.freeze({
    upstreamJoins:
      "explicit_product_plan_topology_and_runtime_receipt_hash_equality" as const,
    realizations: "every_plan_realization_exactly_once" as const,
    runtimeMembers: "every_runtime_receipt_member_exactly_once" as const,
    testMembers: "every_test_receipt_member_exactly_once" as const,
    actionTests: "every_action_test_exactly_once" as const,
    runtimeAssertions: "every_runtime_assertion_exactly_once" as const,
    testAssertions: "every_test_assertion_exactly_once" as const,
    runtimeEntityFields: "every_runtime_entity_binding_exactly_once" as const,
    testEntityFields: "every_test_entity_binding_exactly_once" as const,
  }),
  forbiddenInputs: Object.freeze([
    "story_plan_v2",
    "caller_authored_story_prose",
    "model_inferred_source_ownership",
    "operational_receipt_hash_as_retry_identity",
    "unverified_source_text",
  ] as const),
  blockerCodes: STORY_PLAN_V3_BLOCKER_CODES,
} as const);

export const STORY_PLAN_CONTRACT_HASH_V3 = hashCanonicalJson(
  STORY_PLAN_CONTRACT_V3,
);

const StoryPlanBlockerCodeV3Schema = z.enum(STORY_PLAN_V3_BLOCKER_CODES);
const ProfileIdV3Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const StackPackIdV3Schema = z.enum(["node-cli", "node-express-api"]);

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) =>
      index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

function canonicalReferenceArray<T extends z.ZodType<string>>(
  schema: T,
  maximum: number,
  label: string,
  minimum = 0,
) {
  return z.array(schema).min(minimum).max(maximum).superRefine(
    (values, context) => {
      if (canonicalStrings(values)) return;
      context.addIssue({
        code: "custom",
        message: `${label} must be unique and canonically UTF-16 sorted`,
      });
    },
  );
}

const RuntimeAssertionBindingV3Schema = z.object({
  invariantRef: StableReferenceSchema,
  assertionRef: StableReferenceSchema,
  assertionHash: Sha256Schema,
  stateRef: StateIdSchema,
}).strict();

const RuntimeEntityFieldBindingV3Schema = z.object({
  occurrenceRef: StableReferenceSchema,
  snapshotBindingHash: Sha256Schema,
  actionRef: ActionIdSchema,
  deltaOrdinal: z.number().int().nonnegative().max(499),
  entityRef: EntityIdSchema,
  fieldRef: EntityFieldIdSchema,
}).strict();

export const StoryRealizationBindingV3Schema = z.object({
  realizationRef: StableReferenceSchema,
  realizationHash: Sha256Schema,
  intentRef: StableReferenceSchema,
  intentHash: Sha256Schema,
  targetKind: z.enum([
    "node_product_runtime_generator_member",
    "platform_contract_binding",
    "typed_exemption",
    "evidence_relation",
  ]),
  subjectKind: SemanticSourceSubjectKindV1Schema,
  subjectRef: StableReferenceSchema,
  subjectHash: Sha256Schema,
  responsibility: SemanticSourceResponsibilityV1Schema,
  storyId: StoryIdSchema.nullable(),
}).strict();

export type StoryRealizationBindingV3 = z.infer<
  typeof StoryRealizationBindingV3Schema
>;

export function hashStoryRealizationMembershipV3(
  bindings: readonly StoryRealizationBindingV3[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.story-realization-membership-hash.v3",
    bindings,
  });
}

const RuntimeSourceDependencyV3Schema = z.object({
  ownerRef: z.literal("OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2"),
  pathRef: PathBindingIdSchema,
  logicalReceiptHash: Sha256Schema,
  sourceIdentityHash: Sha256Schema,
  generatedSymbolRefs: canonicalReferenceArray(
    StableReferenceSchema,
    20_000,
    "Runtime generated-symbol refs",
    1,
  ),
  relation: z.literal("consumes_exact_generated_runtime_members"),
}).strict();

const TestSourceDependencyV3Schema = z.object({
  ownerRef: z.literal("OWNER_NODE_PRODUCT_TEST_GENERATOR_V2"),
  pathRef: PathBindingIdSchema,
  logicalReceiptHash: Sha256Schema,
  sourceIdentityHash: Sha256Schema,
  coverageSymbolRefs: canonicalReferenceArray(
    StableReferenceSchema,
    20_000,
    "Test coverage-symbol refs",
    1,
  ),
  relation: z.literal("consumes_exact_generated_test_members"),
}).strict();

const StoryBehaviorCoverageV3Schema = z.object({
  runtimeAssertions: z.array(RuntimeAssertionBindingV3Schema).max(20_000),
  testAssertions: z.array(NodeProductBehaviorAssertionTestBindingV2Schema)
    .max(20_000),
  runtimeEntityFields: z.array(RuntimeEntityFieldBindingV3Schema).max(20_000),
  testEntityFields: z.array(NodeProductEntityFieldTestBindingV2Schema)
    .max(20_000),
}).strict().superRefine((value, context) => {
  const collections = [
    ["runtimeAssertions", value.runtimeAssertions.map((item) => item.assertionRef)],
    ["testAssertions", value.testAssertions.map((item) => item.assertionRef)],
    ["runtimeEntityFields", value.runtimeEntityFields.map((item) => item.occurrenceRef)],
    ["testEntityFields", value.testEntityFields.map((item) => item.occurrenceRef)],
  ] as const;
  collections.forEach(([field, refs]) => {
    if (canonicalStrings(refs)) return;
    context.addIssue({
      code: "custom",
      path: [field],
      message: `${field} must be unique and canonically sorted`,
    });
  });
  const runtimeAssertionRefs = value.runtimeAssertions.map((item) =>
    item.assertionRef);
  const testAssertionRefs = value.testAssertions.map((item) => item.assertionRef);
  if (JSON.stringify(runtimeAssertionRefs) !== JSON.stringify(testAssertionRefs)) {
    context.addIssue({
      code: "custom",
      path: ["testAssertions"],
      message: "Runtime and test assertion coverage must have one exact assertion set",
    });
  }
  const runtimeEntityRefs = value.runtimeEntityFields.map((item) =>
    item.occurrenceRef);
  const testEntityRefs = value.testEntityFields.map((item) => item.occurrenceRef);
  if (JSON.stringify(runtimeEntityRefs) !== JSON.stringify(testEntityRefs)) {
    context.addIssue({
      code: "custom",
      path: ["testEntityFields"],
      message: "Runtime and test entity coverage must have one exact occurrence set",
    });
  }
});

const ProductStoryIdentityV3Schema = z.object({
  storyId: StoryIdSchema,
  order: z.number().int().positive().max(5_000),
  componentHash: Sha256Schema,
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(10_000),
  routeRefs: canonicalReferenceArray(RouteIdSchema, 500, "Story route refs", 1),
  surfaceRefs: canonicalReferenceArray(
    SurfaceIdSchema,
    500,
    "Story surface refs",
    1,
  ),
  controlSlotRefs: canonicalReferenceArray(
    ControlSlotIdSchema,
    1_000,
    "Story control-slot refs",
  ),
  controlRefs: canonicalReferenceArray(
    ControlIdSchema,
    1_000,
    "Story physical-control refs",
  ),
  actionRefs: canonicalReferenceArray(ActionIdSchema, 2_000, "Story action refs", 1),
  observableRefs: canonicalReferenceArray(
    ObservableIdSchema,
    2_000,
    "Story observable refs",
    1,
  ),
  stateRefs: canonicalReferenceArray(StateIdSchema, 500, "Story state refs"),
  persistenceRefs: canonicalReferenceArray(
    PersistenceIdSchema,
    500,
    "Story persistence refs",
  ),
  evidenceRefs: canonicalReferenceArray(
    EvidenceIdSchema,
    4_000,
    "Story evidence refs",
    1,
  ),
  entityRefs: canonicalReferenceArray(EntityIdSchema, 2_000, "Story entity refs"),
  dependsOnStoryIds: canonicalReferenceArray(
    StoryIdSchema,
    1_000,
    "Story dependency refs",
  ),
  physicalSharedGrantRefs: z.tuple([]),
  realizationCount: z.number().int().positive().max(20_000),
  realizations: z.array(StoryRealizationBindingV3Schema).min(1).max(20_000),
  realizationMembershipHash: Sha256Schema,
  runtimeSourceMembers: z.array(NodeProductRuntimeGeneratedMemberBindingV2Schema)
    .min(1).max(20_000),
  testCoverageMembers: z.array(NodeProductTestCoverageMemberV2Schema)
    .min(1).max(20_000),
  actionTests: z.array(NodeProductActionTestBindingV2Schema).min(1).max(2_000),
  behaviorCoverage: StoryBehaviorCoverageV3Schema,
  sourceDependencies: z.object({
    runtime: RuntimeSourceDependencyV3Schema,
    test: TestSourceDependencyV3Schema,
  }).strict(),
}).strict();

export type ProductStoryHashPayloadV3 = z.infer<
  typeof ProductStoryIdentityV3Schema
>;

export function hashProductStoryV3(
  value: ProductStoryHashPayloadV3 | ProductStoryV3,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.storyHash;
  return hashCanonicalJson({
    schema: "setfarm.product-story-hash.v3",
    story: payload,
  });
}

export const ProductStoryV3Schema = ProductStoryIdentityV3Schema.extend({
  storyHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const semantic = {
    routeRefs: value.routeRefs,
    surfaceRefs: value.surfaceRefs,
    controlSlotRefs: value.controlSlotRefs,
    controlRefs: value.controlRefs,
    actionRefs: value.actionRefs,
    observableRefs: value.observableRefs,
    stateRefs: value.stateRefs,
    persistenceRefs: value.persistenceRefs,
    evidenceRefs: value.evidenceRefs,
    entityRefs: value.entityRefs,
  };
  if (value.componentHash !== hashSemanticStoryPartitionComponentV3(semantic)) {
    context.addIssue({
      code: "custom",
      path: ["componentHash"],
      message: "Story component hash must bind exact entity-aware semantics",
    });
  }
  const realizationRefs = value.realizations.map((item) => item.realizationRef);
  if (
    value.realizationCount !== value.realizations.length
    || !canonicalStrings(realizationRefs)
    || value.realizationMembershipHash
      !== hashStoryRealizationMembershipV3(value.realizations)
    || value.realizations.some((item) => item.storyId !== value.storyId)
  ) {
    context.addIssue({
      code: "custom",
      path: ["realizations"],
      message: "Story realizations must be exact, canonical, hashed and story-scoped",
    });
  }
  const runtimeSymbolRefs = value.runtimeSourceMembers.map((item) =>
    item.generatedSymbolRef).sort(compareUtf16);
  const testSymbolRefs = value.testCoverageMembers.map((item) =>
    item.coverageSymbolRef).sort(compareUtf16);
  if (
    value.runtimeSourceMembers.some((item) => item.storyId !== value.storyId)
    || value.testCoverageMembers.some((item) => item.storyId !== value.storyId)
    || JSON.stringify(runtimeSymbolRefs)
      !== JSON.stringify(value.sourceDependencies.runtime.generatedSymbolRefs)
    || JSON.stringify(testSymbolRefs)
      !== JSON.stringify(value.sourceDependencies.test.coverageSymbolRefs)
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceDependencies"],
      message: "Story source dependencies must equal its exact receipt members",
    });
  }
  const actionRefs = value.actionTests.map((item) => item.actionRef);
  if (
    !canonicalStrings(actionRefs)
    || JSON.stringify(actionRefs) !== JSON.stringify(value.actionRefs)
  ) {
    context.addIssue({
      code: "custom",
      path: ["actionTests"],
      message: "Story action tests must equal its exact semantic action set",
    });
  }
  value.testCoverageMembers.forEach((member, index) => {
    const subjectOwned = member.coverageKind === "action"
      ? value.actionRefs.includes(member.subjectRef)
      : value.evidenceRefs.includes(member.subjectRef);
    if (subjectOwned && value.actionTests.some((item) =>
      item.testRef === member.testRef)) return;
    context.addIssue({
      code: "custom",
      path: ["testCoverageMembers", index],
      message: "Test coverage member must join an exact story action/evidence and test",
    });
  });
  if (
    value.behaviorCoverage.runtimeAssertions.some((item) =>
      !value.stateRefs.includes(item.stateRef))
    || value.behaviorCoverage.testAssertions.some((item) =>
      !value.actionTests.some((test) => test.testRef === item.testRef))
    || value.behaviorCoverage.runtimeEntityFields.some((item) =>
      !value.actionRefs.includes(item.actionRef))
    || value.behaviorCoverage.testEntityFields.some((item) =>
      !value.actionRefs.includes(item.actionRef)
      || !value.actionTests.some((test) => test.testRef === item.testRef))
  ) {
    context.addIssue({
      code: "custom",
      path: ["behaviorCoverage"],
      message: "Behavior coverage must remain inside its exact story semantic owner",
    });
  }
  if (value.storyHash !== hashProductStoryV3(value)) {
    context.addIssue({
      code: "custom",
      path: ["storyHash"],
      message: "Story hash must bind exact semantics, sources and dependencies",
    });
  }
});

export type ProductStoryV3 = z.infer<typeof ProductStoryV3Schema>;

export const ProductScopeV3Schema = z.object({
  realizationCount: z.number().int().nonnegative().max(20_000),
  realizations: z.array(StoryRealizationBindingV3Schema).max(20_000),
  realizationMembershipHash: Sha256Schema,
  runtimeSourceMembers: z.array(NodeProductRuntimeGeneratedMemberBindingV2Schema)
    .max(20_000),
  runtimeSourceDependency: RuntimeSourceDependencyV3Schema.nullable(),
  testCoverageMembers: z.tuple([]),
  disposition: z.literal(
    "explicit_unscoped_realizations_and_generated_members_not_story_owned",
  ),
}).strict().superRefine((value, context) => {
  const realizationRefs = value.realizations.map((item) => item.realizationRef);
  const generatedSymbolRefs = value.runtimeSourceMembers.map((item) =>
    item.generatedSymbolRef).sort(compareUtf16);
  if (
    value.realizationCount !== value.realizations.length
    || !canonicalStrings(realizationRefs)
    || value.realizations.some((item) => item.storyId !== null)
    || value.realizationMembershipHash
      !== hashStoryRealizationMembershipV3(value.realizations)
    || value.runtimeSourceMembers.some((item) => item.storyId !== null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["realizations"],
      message: "Product-scope realization closure must contain only exact unscoped members",
    });
  }
  if (
    (generatedSymbolRefs.length === 0)
      !== (value.runtimeSourceDependency === null)
    || (
      value.runtimeSourceDependency !== null
      && JSON.stringify(generatedSymbolRefs)
        !== JSON.stringify(value.runtimeSourceDependency.generatedSymbolRefs)
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtimeSourceDependency"],
      message: "Product-scope runtime dependency must equal exact unscoped members",
    });
  }
});

export type ProductScopeV3 = z.infer<typeof ProductScopeV3Schema>;

const PlanIdentityV3Schema = z.object({
  schema: z.literal(STORY_PLAN_V3_SCHEMA),
  planVersion: z.literal(STORY_PLAN_V3_VERSION),
  contractHash: z.literal(STORY_PLAN_CONTRACT_HASH_V3),
  stage: z.literal("generated_sources_verified_before_source_map"),
  readiness: z.object({
    status: z.literal("shadow_blocked"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(StoryPlanBlockerCodeV3Schema)
      .length(STORY_PLAN_V3_BLOCKER_CODES.length),
  }).strict(),
  authority: z.object({
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
    deliverySelectionHash: Sha256Schema,
    profileId: ProfileIdV3Schema,
    deliveryProfileHash: Sha256Schema,
    stackPackId: StackPackIdV3Schema,
    stackPackVersion: z.literal("1.6.0"),
    stackPackContentHash: Sha256Schema,
    designSource: z.object({
      kind: z.literal("none"),
      designGraphHash: z.null(),
      closure: z.literal("product_delivery_design_not_required"),
    }).strict(),
    modelAuthoredDeclarations: z.object({
      schema: z.literal("setfarm.semantic-source-declarations.v1"),
      status: z.literal("not_applicable"),
      declarationCount: z.literal(0),
      reason: z.literal(
        "selected_node_profiles_forbid_model_write_authority",
      ),
    }).strict(),
    runtimeBehavior: z.object({
      proposalHash: Sha256Schema,
      contractHash: Sha256Schema,
    }).strict(),
    semanticRealizationPlan: z.object({
      schema: z.literal(SEMANTIC_REALIZATION_PLAN_V2_SCHEMA),
      version: z.literal(SEMANTIC_REALIZATION_PLAN_V2_VERSION),
      contractHash: z.literal(SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2),
      planHash: Sha256Schema,
      realizationCount: z.number().int().positive().max(20_000),
      realizationMembershipHash: Sha256Schema,
    }).strict(),
    fileTree: z.object({
      schema: z.literal(FILE_TREE_MANIFEST_V3_SCHEMA),
      version: z.literal(FILE_TREE_MANIFEST_VERSION_V3),
      contractHash: z.literal(FILE_TREE_MANIFEST_CONTRACT_HASH_V3),
      manifestHash: Sha256Schema,
      pathMembershipHash: Sha256Schema,
    }).strict(),
    buildTopology: z.object({
      schema: z.literal(BUILD_TOPOLOGY_V3_SCHEMA),
      version: z.literal(BUILD_TOPOLOGY_VERSION_V3),
      contractHash: z.literal(BUILD_TOPOLOGY_CONTRACT_HASH_V3),
      logicalBuildHash: Sha256Schema,
      compilationContractHash: Sha256Schema,
    }).strict(),
    runtimeSource: z.object({
      schema: z.literal(NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA),
      logicalReceiptHash: Sha256Schema,
      pathRef: PathBindingIdSchema,
      sourceIdentityHash: Sha256Schema,
      upstreamAuthority: z.object({
        productSpecHash: Sha256Schema,
        deliverySelectionHash: Sha256Schema,
        runtimeBehaviorContractHash: Sha256Schema,
        realizationPlanHash: Sha256Schema,
        fileTreeManifestHash: Sha256Schema,
        logicalBuildHash: Sha256Schema,
      }).strict(),
      generatedMemberMembershipHash: Sha256Schema,
      runtimeAssertionMembershipHash: Sha256Schema,
      entityFieldBindingMembershipHash: Sha256Schema,
    }).strict(),
    testSource: z.object({
      schema: z.literal(NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA),
      logicalReceiptHash: Sha256Schema,
      pathRef: PathBindingIdSchema,
      sourceIdentityHash: Sha256Schema,
      upstreamAuthority: z.object({
        productSpecHash: Sha256Schema,
        deliverySelectionHash: Sha256Schema,
        runtimeBehaviorContractHash: Sha256Schema,
        realizationPlanHash: Sha256Schema,
        fileTreeManifestHash: Sha256Schema,
        logicalBuildHash: Sha256Schema,
        runtimeSourceLogicalReceiptHash: Sha256Schema,
      }).strict(),
      actionTestMembershipHash: Sha256Schema,
      generatedCoverageMembershipHash: Sha256Schema,
      assertionMembershipHash: Sha256Schema,
      entityFieldMembershipHash: Sha256Schema,
    }).strict(),
  }).strict(),
  storyCount: z.number().int().positive().max(5_000),
  stories: z.array(ProductStoryV3Schema).min(1).max(5_000),
  storyMembershipHash: Sha256Schema,
  productScope: ProductScopeV3Schema,
  coverage: z.object({
    storyScopedRealizationCount: z.number().int().positive().max(20_000),
    productScopedRealizationCount: z.number().int().nonnegative().max(20_000),
    runtimeMemberCount: z.number().int().positive().max(20_000),
    testCoverageMemberCount: z.number().int().positive().max(20_000),
    actionTestCount: z.number().int().positive().max(2_000),
    runtimeAssertionCount: z.number().int().nonnegative().max(2_000_000),
    testAssertionCount: z.number().int().nonnegative().max(2_000_000),
    runtimeEntityFieldCount: z.number().int().nonnegative().max(20_000),
    testEntityFieldCount: z.number().int().nonnegative().max(20_000),
    physicalSharedGrantCount: z.literal(0),
    disposition: z.literal(
      "every_semantic_realization_and_generated_source_member_owned_exactly_once",
    ),
  }).strict(),
}).strict();

export type StoryPlanHashPayloadV3 = z.infer<typeof PlanIdentityV3Schema>;

export function hashStoryMembershipV3(
  stories: readonly Pick<ProductStoryV3, "storyId" | "storyHash">[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.story-plan-membership-hash.v3",
    stories: stories.map((story) => ({
      storyId: story.storyId,
      storyHash: story.storyHash,
    })),
  });
}

export function hashStoryPlanV3(
  value: StoryPlanHashPayloadV3 | StoryPlanV3,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.planHash;
  return hashCanonicalJson({
    schema: "setfarm.story-plan-hash.v3",
    storyPlan: payload,
  });
}

function flatten<T>(values: readonly (readonly T[])[]): T[] {
  return values.flatMap((value) => [...value]);
}

function closureIssuesV3(
  value: StoryPlanHashPayloadV3 & { planHash: string },
  context: z.RefinementCtx,
): void {
  if (
    JSON.stringify(value.readiness.blockerCodes)
      !== JSON.stringify(STORY_PLAN_V3_BLOCKER_CODES)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "StoryPlanV3 blockers must equal the exact code-owned set",
    });
  }
  const storyIds = value.stories.map((story) => story.storyId);
  const storyHashes = value.stories.map((story) => story.storyHash);
  if (
    value.storyCount !== value.stories.length
    || !canonicalStrings(storyIds)
    || !hasUniqueStrings(storyHashes)
    || value.storyMembershipHash !== hashStoryMembershipV3(value.stories)
  ) {
    context.addIssue({
      code: "custom",
      path: ["stories"],
      message: "Stories must be complete, canonical, unique and membership-hashed",
    });
  }
  const storyById = new Map(value.stories.map((story) =>
    [story.storyId, story] as const));
  value.stories.forEach((story, index) => {
    if (story.order !== index + 1) {
      context.addIssue({
        code: "custom",
        path: ["stories", index, "order"],
        message: "Story order must equal canonical array position",
      });
    }
    story.dependsOnStoryIds.forEach((dependency, dependencyIndex) => {
      const target = storyById.get(dependency);
      if (!target || target.order >= story.order) {
        context.addIssue({
          code: "custom",
          path: ["stories", index, "dependsOnStoryIds", dependencyIndex],
          message: "Story dependency must resolve to an earlier exact story",
        });
      }
    });
  });
  const semanticFields = [
    "routeRefs",
    "surfaceRefs",
    "controlSlotRefs",
    "controlRefs",
    "actionRefs",
    "observableRefs",
    "stateRefs",
    "persistenceRefs",
    "evidenceRefs",
    "entityRefs",
  ] as const;
  semanticFields.forEach((field) => {
    const refs = flatten(value.stories.map((story) => story[field]));
    if (hasUniqueStrings(refs)) return;
    context.addIssue({
      code: "custom",
      path: ["stories"],
      message: `${field} must have exactly one story owner`,
    });
  });
  const storyRealizations = flatten(value.stories.map((story) =>
    story.realizations));
  const allRealizations = [...storyRealizations, ...value.productScope.realizations];
  const runtimeMembers = [
    ...flatten(value.stories.map((story) => story.runtimeSourceMembers)),
    ...value.productScope.runtimeSourceMembers,
  ];
  const testMembers = flatten(value.stories.map((story) =>
    story.testCoverageMembers));
  const actionTests = flatten(value.stories.map((story) => story.actionTests));
  const runtimeAssertions = flatten(value.stories.map((story) =>
    story.behaviorCoverage.runtimeAssertions));
  const testAssertions = flatten(value.stories.map((story) =>
    story.behaviorCoverage.testAssertions));
  const runtimeEntities = flatten(value.stories.map((story) =>
    story.behaviorCoverage.runtimeEntityFields));
  const testEntities = flatten(value.stories.map((story) =>
    story.behaviorCoverage.testEntityFields));
  const canonicalRealizations = [...allRealizations].sort((left, right) =>
    compareUtf16(left.realizationRef, right.realizationRef));
  const canonicalRuntimeMembers = [...runtimeMembers].sort((left, right) =>
    compareUtf16(left.realizationRef, right.realizationRef));
  const canonicalTestMembers = [...testMembers].sort((left, right) =>
    compareUtf16(
      `${left.coverageKind}\0${left.subjectRef}\0${left.realizationRef}`,
      `${right.coverageKind}\0${right.subjectRef}\0${right.realizationRef}`,
    ));
  const canonicalActionTests = [...actionTests].sort((left, right) =>
    compareUtf16(left.actionRef, right.actionRef));
  const canonicalRuntimeAssertions = [...runtimeAssertions].sort((left, right) =>
    compareUtf16(left.assertionRef, right.assertionRef));
  const canonicalTestAssertions = [...testAssertions].sort((left, right) =>
    compareUtf16(left.assertionRef, right.assertionRef));
  const canonicalRuntimeEntities = [...runtimeEntities].sort((left, right) =>
    compareUtf16(left.occurrenceRef, right.occurrenceRef));
  const canonicalTestEntities = [...testEntities].sort((left, right) =>
    compareUtf16(left.occurrenceRef, right.occurrenceRef));
  const uniqueCollections = [
    allRealizations.map((item) => item.realizationRef),
    runtimeMembers.map((item) => item.generatedSymbolRef),
    testMembers.map((item) => item.coverageSymbolRef),
    actionTests.map((item) => item.testRef),
    runtimeAssertions.map((item) => item.assertionRef),
    testAssertions.map((item) => item.assertionRef),
    runtimeEntities.map((item) => item.occurrenceRef),
    testEntities.map((item) => item.occurrenceRef),
  ];
  if (uniqueCollections.some((refs) => !hasUniqueStrings(refs))) {
    context.addIssue({
      code: "custom",
      path: ["coverage"],
      message: "Every realization and source-evidence member must have one owner",
    });
  }
  if (
    value.authority.semanticRealizationPlan.realizationMembershipHash
      !== hashSemanticRealizationMembershipV2(canonicalRealizations)
    || value.authority.runtimeSource.generatedMemberMembershipHash
      !== hashNodeProductRuntimeGeneratedMemberMembershipV2(
        canonicalRuntimeMembers,
      )
    || value.authority.runtimeSource.runtimeAssertionMembershipHash
      !== hashRuntimeBehaviorAssertionSourceMembershipV2(
        canonicalRuntimeAssertions,
      )
    || value.authority.runtimeSource.entityFieldBindingMembershipHash
      !== hashRuntimeBehaviorEntityFieldSourceMembershipV2(
        canonicalRuntimeEntities,
      )
    || value.authority.testSource.actionTestMembershipHash
      !== hashNodeProductActionTestMembershipV2(canonicalActionTests)
    || value.authority.testSource.generatedCoverageMembershipHash
      !== hashNodeProductTestCoverageMemberMembershipV2(canonicalTestMembers)
    || value.authority.testSource.assertionMembershipHash
      !== hashNodeProductBehaviorAssertionTestMembershipV2(
        canonicalTestAssertions,
      )
    || value.authority.testSource.entityFieldMembershipHash
      !== hashNodeProductEntityFieldTestMembershipV2(canonicalTestEntities)
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority"],
      message: "Story ownership projections must equal exact upstream membership hashes",
    });
  }
  const expectedCoverage = {
    storyScopedRealizationCount: storyRealizations.length,
    productScopedRealizationCount: value.productScope.realizations.length,
    runtimeMemberCount: runtimeMembers.length,
    testCoverageMemberCount: testMembers.length,
    actionTestCount: actionTests.length,
    runtimeAssertionCount: runtimeAssertions.length,
    testAssertionCount: testAssertions.length,
    runtimeEntityFieldCount: runtimeEntities.length,
    testEntityFieldCount: testEntities.length,
    physicalSharedGrantCount: 0,
    disposition:
      "every_semantic_realization_and_generated_source_member_owned_exactly_once",
  };
  if (hashCanonicalJson(value.coverage) !== hashCanonicalJson(expectedCoverage)) {
    context.addIssue({
      code: "custom",
      path: ["coverage"],
      message: "StoryPlanV3 coverage must equal every closed ownership collection",
    });
  }
  if (
    allRealizations.length
      !== value.authority.semanticRealizationPlan.realizationCount
    || runtimeMembers.length !== value.coverage.runtimeMemberCount
    || testMembers.length !== value.coverage.testCoverageMemberCount
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority"],
      message: "Story ownership counts must close exact upstream authorities",
    });
  }
  const runtimeUpstream = value.authority.runtimeSource.upstreamAuthority;
  const testUpstream = value.authority.testSource.upstreamAuthority;
  if (
    runtimeUpstream.productSpecHash !== value.authority.productSpecHash
    || runtimeUpstream.deliverySelectionHash
      !== value.authority.deliverySelectionHash
    || runtimeUpstream.runtimeBehaviorContractHash
      !== value.authority.runtimeBehavior.contractHash
    || runtimeUpstream.realizationPlanHash
      !== value.authority.semanticRealizationPlan.planHash
    || runtimeUpstream.fileTreeManifestHash !== value.authority.fileTree.manifestHash
    || runtimeUpstream.logicalBuildHash
      !== value.authority.buildTopology.logicalBuildHash
    || testUpstream.productSpecHash !== value.authority.productSpecHash
    || testUpstream.deliverySelectionHash !== value.authority.deliverySelectionHash
    || testUpstream.runtimeBehaviorContractHash
      !== value.authority.runtimeBehavior.contractHash
    || testUpstream.realizationPlanHash
      !== value.authority.semanticRealizationPlan.planHash
    || testUpstream.fileTreeManifestHash !== value.authority.fileTree.manifestHash
    || testUpstream.logicalBuildHash
      !== value.authority.buildTopology.logicalBuildHash
    || testUpstream.runtimeSourceLogicalReceiptHash
      !== value.authority.runtimeSource.logicalReceiptHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority"],
      message: "Source receipts must explicitly join every exact upstream authority",
    });
  }
  value.stories.forEach((story, index) => {
    if (
      story.sourceDependencies.runtime.logicalReceiptHash
        !== value.authority.runtimeSource.logicalReceiptHash
      || story.sourceDependencies.runtime.sourceIdentityHash
        !== value.authority.runtimeSource.sourceIdentityHash
      || story.sourceDependencies.runtime.pathRef
        !== value.authority.runtimeSource.pathRef
      || story.sourceDependencies.test.logicalReceiptHash
        !== value.authority.testSource.logicalReceiptHash
      || story.sourceDependencies.test.sourceIdentityHash
        !== value.authority.testSource.sourceIdentityHash
      || story.sourceDependencies.test.pathRef !== value.authority.testSource.pathRef
    ) {
      context.addIssue({
        code: "custom",
        path: ["stories", index, "sourceDependencies"],
        message: "Story source dependencies must bind the exact plan receipt authorities",
      });
    }
  });
  if (
    value.productScope.runtimeSourceDependency !== null
    && (
      value.productScope.runtimeSourceDependency.logicalReceiptHash
        !== value.authority.runtimeSource.logicalReceiptHash
      || value.productScope.runtimeSourceDependency.sourceIdentityHash
        !== value.authority.runtimeSource.sourceIdentityHash
      || value.productScope.runtimeSourceDependency.pathRef
        !== value.authority.runtimeSource.pathRef
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["productScope", "runtimeSourceDependency"],
      message: "Product-scope source dependency must bind exact runtime authority",
    });
  }
  if (value.planHash !== hashStoryPlanV3(value)) {
    context.addIssue({
      code: "custom",
      path: ["planHash"],
      message: "StoryPlanV3 hash must bind the complete exact artifact",
    });
  }
}

const StoryPlanCandidateV3Schema = PlanIdentityV3Schema.extend({
  planHash: Sha256Schema,
}).strict().superRefine(closureIssuesV3);

export const StoryPlanV3Schema = z.unknown().superRefine((value, context) => {
  try {
    canonicalJsonBytesBounded(value, {
      maxBytes: STORY_PLAN_V3_MAX_CANONICAL_BYTES,
      ...STORY_PLAN_V3_BOUNDED_WORK_LIMITS,
    });
  } catch {
    context.addIssue({
      code: "custom",
      message: "StoryPlanV3 exceeds canonical byte or work bounds",
    });
  }
}).pipe(StoryPlanCandidateV3Schema);

export type StoryPlanV3 = z.infer<typeof StoryPlanCandidateV3Schema>;

export function recursivelyFreezeStoryPlanV3<T>(value: T): T {
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
