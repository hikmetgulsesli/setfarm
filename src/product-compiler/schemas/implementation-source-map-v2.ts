import { z } from "zod";

import { SemanticArtifactEnvelopeV1Schema } from "../artifact-envelope.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  BuildTopologyCommandContractV3Schema,
  BuildTopologyCompilationV3Schema,
  BuildTopologyRuntimeTargetV3Schema,
  hashBuildTopologyCommandContractV3,
  hashBuildTopologyCompilationContractV3,
  hashBuildTopologyRuntimeContractV3,
} from "./build-topology-v3.js";
import {
  EvidenceIdSchema,
  GitCodeShaSchema,
  ProductIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  StoryIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  NodeProductTestCoverageMemberV2Schema,
} from "./node-product-test-source-v2.js";
import {
  SemanticRealizationV2Schema,
} from "./semantic-realization-plan-v2.js";
import {
  ProductScopeV3Schema,
  ProductStoryV3Schema,
  STORY_PLAN_CONTRACT_HASH_V3,
  STORY_PLAN_V3_SCHEMA,
  STORY_PLAN_V3_VERSION,
  hashStoryRealizationMembershipV3,
  type StoryRealizationBindingV3,
} from "./story-plan-v3.js";

export const IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2 =
  "setfarm.implementation-source-map.v2" as const;
export const IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_ARTIFACT_TYPE_V2 =
  "setfarm.implementation-source-map-story-leaf.v2" as const;
export const IMPLEMENTATION_SOURCE_MAP_V2_SCHEMA =
  "setfarm.implementation-source-map.v2" as const;
export const IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_V2_SCHEMA =
  "setfarm.implementation-source-map-story-leaf.v2" as const;
export const IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_SCHEMA =
  "setfarm.implementation-source-map-story-proof.v2" as const;
export const IMPLEMENTATION_SOURCE_MAP_V2_VERSION = "2.0.0" as const;
export const IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES = 4 * 1024 * 1024;
export const IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_MAX_CANONICAL_BYTES =
  5 * 1024 * 1024;
export const IMPLEMENTATION_SOURCE_MAP_V2_MAX_AGGREGATE_RETURN_CANONICAL_BYTES =
  128 * 1024 * 1024;
export const IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 24,
  maxNodes: IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES + 120_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES * 8)
    + (6 * 1024 * 1024),
});

export const IMPLEMENTATION_SOURCE_MAP_V2_BLOCKER_CODES = Object.freeze([
  "IMPLEMENTATION_SOURCE_MAP_V2_AUTHENTICATED_BUILD_TEST_EVIDENCE_UNVERIFIED",
  "IMPLEMENTATION_SOURCE_MAP_V2_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
  "IMPLEMENTATION_SOURCE_MAP_V2_EVIDENCE_REGISTRY_V2_UNVERIFIED",
  "IMPLEMENTATION_SOURCE_MAP_V2_PRODUCT_BUILD_PACKET_V4_UNVERIFIED",
  "IMPLEMENTATION_SOURCE_MAP_V2_RELEASE_MANIFEST_UNVERIFIED",
] as const);

export const IMPLEMENTATION_SOURCE_MAP_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.implementation-source-map-contract.v2" as const,
  contractVersion: IMPLEMENTATION_SOURCE_MAP_V2_VERSION,
  stage: "story_sources_verified_before_packet_v4" as const,
  root: Object.freeze({
    payload: "bounded_authority_and_leaf_commitment_manifest" as const,
    leafOrder: "canonical_utf16_story_id" as const,
    storyIdSet: "domain_separated_hash" as const,
    packetDirection: "packet_v4_binds_root_never_reverse" as const,
  }),
  leaf: Object.freeze({
    authority: "one_exact_story_plus_shared_product_scope" as const,
    semantics: "exact_story_plan_v3_story" as const,
    realizations: "exact_full_plan_definitions" as const,
    sources: "exact_runtime_and_test_receipt_members_with_spans" as const,
    execution:
      "exact_compilation_logical_command_contract_and_runtime" as const,
    evidence: "exact_predicate_realization_to_test_member_join" as const,
    design: "no_design_only_current_node_slice" as const,
    declarations: "not_applicable_current_node_profiles" as const,
  }),
  merkle: Object.freeze({
    leafDomain: "setfarm.implementation-source-map-merkle-leaf.v2" as const,
    pairDomain: "setfarm.implementation-source-map-merkle-pair.v2" as const,
    unaryDomain: "setfarm.implementation-source-map-merkle-unary.v2" as const,
    oddChild: "explicit_unary_never_duplicate_or_pad" as const,
    proofOrientation: "derived_only_from_leaf_index_and_count" as const,
  }),
  publication: Object.freeze({
    preflightDurabilityTier: 0 as const,
    preparation:
      "each_envelope_independently_passes_artifact_store_batch_plan_v1" as const,
    currentBatchCapacity: 9 as const,
    activation:
      "forbidden_until_packet_v4_and_atomic_artifact_set_transaction" as const,
    aggregateReturnMaxBytes:
      IMPLEMENTATION_SOURCE_MAP_V2_MAX_AGGREGATE_RETURN_CANONICAL_BYTES,
  }),
  retryIdentity: Object.freeze({
    semantic: "manifest_hash_and_story_leaf_hash" as const,
    operationalReceiptHashes: "excluded" as const,
  }),
  forbiddenInputs: Object.freeze([
    "implementation_source_map_v1",
    "story_plan_v2",
    "caller_authored_leaf",
    "caller_authored_merkle_root",
    "unverified_source_text",
    "operational_receipt_hash",
  ] as const),
  blockerCodes: IMPLEMENTATION_SOURCE_MAP_V2_BLOCKER_CODES,
} as const);

export const IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2 = hashCanonicalJson(
  IMPLEMENTATION_SOURCE_MAP_CONTRACT_V2,
);

const SourceMapBlockerCodeV2Schema = z.enum(
  IMPLEMENTATION_SOURCE_MAP_V2_BLOCKER_CODES,
);

export const ImplementationSourceMapProducerV2Schema = z.object({
  pass: z.literal("product-compiler-implementation-source-map-v2"),
  codeSha: GitCodeShaSchema,
  toolVersions: z.object({
    implementationSourceMap: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_VERSION),
    storyPlan: z.literal(STORY_PLAN_V3_VERSION),
  }).strict(),
}).strict();

export type ImplementationSourceMapProducerV2 = z.infer<
  typeof ImplementationSourceMapProducerV2Schema
>;

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) =>
      index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

const ProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const StackPackIdV2Schema = z.enum(["node-cli", "node-express-api"]);

const SourceMapAuthorityIdentityV2Schema = z.object({
  product: z.object({
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
  }).strict(),
  delivery: z.object({
    selectionHash: Sha256Schema,
    profileId: ProfileIdV2Schema,
    profileHash: Sha256Schema,
    stackPackId: StackPackIdV2Schema,
    stackPackVersion: z.literal("1.6.0"),
    stackPackContentHash: Sha256Schema,
  }).strict(),
  semanticIntentSet: z.object({
    schema: z.literal("setfarm.semantic-source-intent-set.v1"),
    intentSetHash: Sha256Schema,
    intentCount: z.number().int().positive().max(20_000),
  }).strict(),
  semanticRealizationPlan: z.object({
    schema: z.literal("setfarm.semantic-realization-plan.v2"),
    version: z.literal("2.1.0"),
    planHash: Sha256Schema,
    realizationCount: z.number().int().positive().max(20_000),
    realizationMembershipHash: Sha256Schema,
  }).strict(),
  fileTree: z.object({
    schema: z.literal("setfarm.file-tree-manifest.v3"),
    manifestHash: Sha256Schema,
    pathMembershipHash: Sha256Schema,
  }).strict(),
  buildTopology: z.object({
    schema: z.literal("setfarm.build-topology.v3"),
    logicalBuildHash: Sha256Schema,
    compilationContractHash: Sha256Schema,
    commandContractHash: Sha256Schema,
    runtimeContractHash: Sha256Schema,
  }).strict(),
  runtimeSource: z.object({
    schema: z.literal("setfarm.node-product-runtime-source-receipt.v2"),
    logicalReceiptHash: Sha256Schema,
    sourceIdentityHash: Sha256Schema,
    generatedMemberMembershipHash: Sha256Schema,
  }).strict(),
  testSource: z.object({
    schema: z.literal("setfarm.node-product-test-source-receipt.v2"),
    logicalReceiptHash: Sha256Schema,
    sourceIdentityHash: Sha256Schema,
    actionTestMembershipHash: Sha256Schema,
    generatedCoverageMembershipHash: Sha256Schema,
  }).strict(),
  storyPlan: z.object({
    schema: z.literal(STORY_PLAN_V3_SCHEMA),
    version: z.literal(STORY_PLAN_V3_VERSION),
    contractHash: z.literal(STORY_PLAN_CONTRACT_HASH_V3),
    planHash: Sha256Schema,
    storyCount: z.number().int().positive().max(5_000),
    storyMembershipHash: Sha256Schema,
    productScopeRealizationMembershipHash: Sha256Schema,
  }).strict(),
  designSource: z.object({
    kind: z.literal("none"),
    designGraphHash: z.null(),
    generatedDesignSourceReceiptHashes: z.tuple([]),
  }).strict(),
  modelAuthoredDeclarations: z.object({
    schema: z.literal("setfarm.semantic-source-declarations.v1"),
    status: z.literal("not_applicable"),
    declarationRefs: z.tuple([]),
  }).strict(),
}).strict();

export type ImplementationSourceMapAuthorityHashPayloadV2 = z.infer<
  typeof SourceMapAuthorityIdentityV2Schema
>;

export function hashImplementationSourceMapAuthorityV2(
  value: ImplementationSourceMapAuthorityHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.implementation-source-map-authority-hash.v2",
    authority: value,
  });
}

export const ImplementationSourceMapEvidenceBindingV2Schema = z.object({
  evidenceRef: EvidenceIdSchema,
  realizationRef: StableReferenceSchema,
  realizationHash: Sha256Schema,
  testCoverageMember: NodeProductTestCoverageMemberV2Schema,
  bindingHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.testCoverageMember.coverageKind !== "evidence_relation"
    || value.testCoverageMember.subjectRef !== value.evidenceRef
    || value.testCoverageMember.realizationRef !== value.realizationRef
    || value.testCoverageMember.realizationHash !== value.realizationHash
    || value.bindingHash !== hashImplementationSourceMapEvidenceBindingV2(value)
  ) {
    context.addIssue({
      code: "custom",
      path: ["bindingHash"],
      message: "Evidence binding must join one exact realization and test member",
    });
  }
});

export type ImplementationSourceMapEvidenceBindingV2 = z.infer<
  typeof ImplementationSourceMapEvidenceBindingV2Schema
>;

export function hashImplementationSourceMapEvidenceBindingV2(
  value:
    | Omit<ImplementationSourceMapEvidenceBindingV2, "bindingHash">
    | ImplementationSourceMapEvidenceBindingV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-source-map-evidence-binding-hash.v2",
    binding: payload,
  });
}

const LeafExecutionV2Schema = z.object({
  compilation: BuildTopologyCompilationV3Schema,
  commands: BuildTopologyCommandContractV3Schema,
  runtimeTarget: BuildTopologyRuntimeTargetV3Schema,
  compilationContractHash: Sha256Schema,
  commandContractHash: Sha256Schema,
  runtimeContractHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.compilationContractHash
      !== hashBuildTopologyCompilationContractV3(value.compilation)
    || value.commandContractHash
      !== hashBuildTopologyCommandContractV3(value.commands)
    || value.runtimeContractHash
      !== hashBuildTopologyRuntimeContractV3(value.runtimeTarget)
  ) {
    context.addIssue({
      code: "custom",
      path: ["commandContractHash"],
      message: "Leaf execution hashes must bind exact compilation, commands and runtime",
    });
  }
});

const SharedProductScopeV2Schema = z.object({
  storyPlanBinding: ProductScopeV3Schema,
  realizationDefinitions: z.array(SemanticRealizationV2Schema).max(20_000),
  realizationDefinitionMembershipHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const definitions = value.realizationDefinitions;
  const definitionRefs = definitions.map((item) => item.realizationRef);
  const projected = definitions.map(realizationProjectionV2);
  if (
    !canonicalStrings(definitionRefs)
    || definitions.some((item) => item.sourceIntent.storyId !== null)
    || value.realizationDefinitionMembershipHash
      !== hashStoryRealizationMembershipV3(projected)
    || value.storyPlanBinding.realizationMembershipHash
      !== value.realizationDefinitionMembershipHash
    || JSON.stringify(value.storyPlanBinding.realizations)
      !== JSON.stringify(projected)
  ) {
    context.addIssue({
      code: "custom",
      path: ["realizationDefinitions"],
      message: "Shared product scope must equal exact unscoped realization definitions",
    });
  }
});

function realizationProjectionV2(
  value: z.infer<typeof SemanticRealizationV2Schema>,
): StoryRealizationBindingV3 {
  return {
    realizationRef: value.realizationRef,
    realizationHash: value.realizationHash,
    intentRef: value.sourceIntent.intentRef,
    intentHash: value.sourceIntent.intentHash,
    targetKind: value.target.kind,
    subjectKind: value.sourceIntent.subjectKind,
    subjectRef: value.sourceIntent.subjectRef,
    subjectHash: value.sourceIntent.subjectHash,
    responsibility: value.sourceIntent.responsibility,
    storyId: value.sourceIntent.storyId,
  };
}

const StoryLeafIdentityV2Schema = z.object({
  schema: z.literal(IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_V2_SCHEMA),
  leafVersion: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_VERSION),
  contractHash: z.literal(IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2),
  authority: z.object({
    sourceMapAuthorityHash: Sha256Schema,
    productSpecHash: Sha256Schema,
    semanticRealizationPlanHash: Sha256Schema,
    buildTopologyLogicalHash: Sha256Schema,
    runtimeSourceLogicalReceiptHash: Sha256Schema,
    testSourceLogicalReceiptHash: Sha256Schema,
    storyPlanHash: Sha256Schema,
    storyId: StoryIdSchema,
    storyHash: Sha256Schema,
  }).strict(),
  story: ProductStoryV3Schema,
  realizationDefinitions: z.array(SemanticRealizationV2Schema)
    .min(1).max(20_000),
  sharedProductScope: SharedProductScopeV2Schema,
  execution: LeafExecutionV2Schema,
  evidenceBindings: z.array(ImplementationSourceMapEvidenceBindingV2Schema)
    .min(1).max(20_000),
  designSource: z.object({
    kind: z.literal("none"),
    generatedSourceBindings: z.tuple([]),
  }).strict(),
  modelAuthoredDeclarations: z.object({
    status: z.literal("not_applicable"),
    declarationRefs: z.tuple([]),
  }).strict(),
  coverage: z.object({
    semanticSubjectCount: z.number().int().positive().max(100_000),
    storyRealizationCount: z.number().int().positive().max(20_000),
    productScopeRealizationCount: z.number().int().nonnegative().max(20_000),
    runtimeSourceMemberCount: z.number().int().positive().max(20_000),
    testCoverageMemberCount: z.number().int().positive().max(20_000),
    actionTestCount: z.number().int().positive().max(2_000),
    evidenceBindingCount: z.number().int().positive().max(20_000),
    disposition: z.literal(
      "one_exact_story_plus_required_shared_product_scope_and_execution_authority",
    ),
  }).strict(),
}).strict();

export type ImplementationSourceMapStoryLeafHashPayloadV2 = z.infer<
  typeof StoryLeafIdentityV2Schema
>;

export function hashImplementationSourceMapStoryLeafV2(
  value:
    | ImplementationSourceMapStoryLeafHashPayloadV2
    | ImplementationSourceMapStoryLeafV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.leafHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-source-map-story-leaf-hash.v2",
    leaf: payload,
  });
}

function leafClosureIssuesV2(
  value: ImplementationSourceMapStoryLeafHashPayloadV2 & { leafHash: string },
  context: z.RefinementCtx,
): void {
  const definitions = value.realizationDefinitions;
  const definitionRefs = definitions.map((item) => item.realizationRef);
  const projected = definitions.map(realizationProjectionV2);
  const evidenceRefs = value.evidenceBindings.map((item) => item.evidenceRef);
  if (
    value.authority.storyId !== value.story.storyId
    || value.authority.storyHash !== value.story.storyHash
    || value.story.sourceDependencies.runtime.logicalReceiptHash
      !== value.authority.runtimeSourceLogicalReceiptHash
    || value.story.sourceDependencies.test.logicalReceiptHash
      !== value.authority.testSourceLogicalReceiptHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority"],
      message: "Leaf authority must equal exact story and logical source receipts",
    });
  }
  if (
    !canonicalStrings(definitionRefs)
    || definitions.some((item) =>
      item.sourceIntent.storyId !== value.story.storyId)
    || JSON.stringify(value.story.realizations) !== JSON.stringify(projected)
  ) {
    context.addIssue({
      code: "custom",
      path: ["realizationDefinitions"],
      message: "Leaf realization definitions must equal exact StoryPlan bindings",
    });
  }
  if (
    !canonicalStrings(evidenceRefs)
    || JSON.stringify(evidenceRefs) !== JSON.stringify(value.story.evidenceRefs)
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidenceBindings"],
      message: "Leaf evidence bindings must equal every-and-only story predicate",
    });
  }
  value.evidenceBindings.forEach((binding, index) => {
    const realization = definitions.find((item) =>
      item.realizationRef === binding.realizationRef);
    const member = value.story.testCoverageMembers.find((item) =>
      item.coverageSymbolRef
        === binding.testCoverageMember.coverageSymbolRef);
    if (
      realization?.target.kind === "evidence_relation"
      && realization.sourceIntent.subjectRef === binding.evidenceRef
      && realization.realizationHash === binding.realizationHash
      && member !== undefined
      && JSON.stringify(member) === JSON.stringify(binding.testCoverageMember)
    ) return;
    context.addIssue({
      code: "custom",
      path: ["evidenceBindings", index],
      message: "Evidence binding must resolve exact plan relation and story test member",
    });
  });
  const semanticSubjectCount = [
    value.story.routeRefs,
    value.story.surfaceRefs,
    value.story.controlSlotRefs,
    value.story.controlRefs,
    value.story.actionRefs,
    value.story.observableRefs,
    value.story.stateRefs,
    value.story.persistenceRefs,
    value.story.evidenceRefs,
    value.story.entityRefs,
  ].reduce((total, refs) => total + refs.length, 0);
  const expectedCoverage = {
    semanticSubjectCount,
    storyRealizationCount: definitions.length,
    productScopeRealizationCount:
      value.sharedProductScope.realizationDefinitions.length,
    runtimeSourceMemberCount: value.story.runtimeSourceMembers.length,
    testCoverageMemberCount: value.story.testCoverageMembers.length,
    actionTestCount: value.story.actionTests.length,
    evidenceBindingCount: value.evidenceBindings.length,
    disposition:
      "one_exact_story_plus_required_shared_product_scope_and_execution_authority",
  };
  if (hashCanonicalJson(value.coverage) !== hashCanonicalJson(expectedCoverage)) {
    context.addIssue({
      code: "custom",
      path: ["coverage"],
      message: "Leaf coverage must equal exact semantic and source collections",
    });
  }
  if (value.leafHash !== hashImplementationSourceMapStoryLeafV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["leafHash"],
      message: "Source-map story leaf hash must bind the complete payload",
    });
  }
}

const StoryLeafCandidateV2Schema = StoryLeafIdentityV2Schema.extend({
  leafHash: Sha256Schema,
}).strict().superRefine(leafClosureIssuesV2);

export const ImplementationSourceMapStoryLeafV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES,
        ...IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Source-map story leaf exceeds canonical byte or work bounds",
      });
    }
  }).pipe(StoryLeafCandidateV2Schema);

export type ImplementationSourceMapStoryLeafV2 = z.infer<
  typeof StoryLeafCandidateV2Schema
>;

export const ImplementationSourceMapStoryLeafEnvelopeV2Schema =
  SemanticArtifactEnvelopeV1Schema.extend({
    artifactType: z.literal(
      IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_ARTIFACT_TYPE_V2,
    ),
    producer: ImplementationSourceMapProducerV2Schema,
    payload: ImplementationSourceMapStoryLeafV2Schema,
  }).strict();

export type ImplementationSourceMapStoryLeafEnvelopeV2 = z.infer<
  typeof ImplementationSourceMapStoryLeafEnvelopeV2Schema
>;

export const ImplementationSourceMapLeafRefV2Schema = z.object({
  index: z.number().int().nonnegative().max(4_999),
  storyId: StoryIdSchema,
  storyHash: Sha256Schema,
  leafEnvelopeHash: Sha256Schema,
  byteLength: z.number().int().positive().max(
    IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES,
  ),
}).strict();

export type ImplementationSourceMapLeafRefV2 = z.infer<
  typeof ImplementationSourceMapLeafRefV2Schema
>;

export function hashImplementationSourceMapStoryIdSetV2(
  storyIds: readonly string[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.implementation-source-map-story-id-set-hash.v2",
    storyIds,
  });
}

export function hashImplementationSourceMapMerkleLeafV2(
  leaf: ImplementationSourceMapLeafRefV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.implementation-source-map-merkle-leaf.v2",
    leaf,
  });
}

export function hashImplementationSourceMapMerklePairV2(
  left: string,
  right: string,
): string {
  return hashCanonicalJson({
    schema: "setfarm.implementation-source-map-merkle-pair.v2",
    left,
    right,
  });
}

export function hashImplementationSourceMapMerkleUnaryV2(
  child: string,
): string {
  return hashCanonicalJson({
    schema: "setfarm.implementation-source-map-merkle-unary.v2",
    child,
  });
}

export function implementationSourceMapMerkleRootV2(
  leaves: readonly ImplementationSourceMapLeafRefV2[],
): string {
  if (leaves.length < 1) throw new RangeError("Merkle tree requires one leaf");
  let level = leaves.map(hashImplementationSourceMapMerkleLeafV2);
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index]!;
      const right = level[index + 1];
      next.push(right === undefined
        ? hashImplementationSourceMapMerkleUnaryV2(left)
        : hashImplementationSourceMapMerklePairV2(left, right));
    }
    level = next;
  }
  return level[0]!;
}

const RootManifestIdentityV2Schema = z.object({
  schema: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_SCHEMA),
  mapVersion: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_VERSION),
  contractHash: z.literal(IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2),
  stage: z.literal("story_sources_verified_before_packet_v4"),
  readiness: z.object({
    status: z.literal("shadow_blocked"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(SourceMapBlockerCodeV2Schema)
      .length(IMPLEMENTATION_SOURCE_MAP_V2_BLOCKER_CODES.length),
  }).strict(),
  authority: SourceMapAuthorityIdentityV2Schema,
  authorityHash: Sha256Schema,
  leafCount: z.number().int().positive().max(5_000),
  storyIdSetHash: Sha256Schema,
  leaves: z.array(ImplementationSourceMapLeafRefV2Schema).min(1).max(5_000),
  merkleRoot: Sha256Schema,
}).strict();

export type ImplementationSourceMapManifestHashPayloadV2 = z.infer<
  typeof RootManifestIdentityV2Schema
>;

export function hashImplementationSourceMapManifestV2(
  value:
    | ImplementationSourceMapManifestHashPayloadV2
    | ImplementationSourceMapV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.manifestHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-source-map-manifest-hash.v2",
    sourceMap: payload,
  });
}

function rootClosureIssuesV2(
  value: ImplementationSourceMapManifestHashPayloadV2 & { manifestHash: string },
  context: z.RefinementCtx,
): void {
  const storyIds = value.leaves.map((leaf) => leaf.storyId);
  const storyHashes = value.leaves.map((leaf) => leaf.storyHash);
  const envelopeHashes = value.leaves.map((leaf) => leaf.leafEnvelopeHash);
  if (
    JSON.stringify(value.readiness.blockerCodes)
      !== JSON.stringify(IMPLEMENTATION_SOURCE_MAP_V2_BLOCKER_CODES)
    || value.authorityHash !== hashImplementationSourceMapAuthorityV2(value.authority)
    || value.leafCount !== value.leaves.length
    || value.leafCount !== value.authority.storyPlan.storyCount
    || !canonicalStrings(storyIds)
    || !hasUniqueStrings(storyHashes)
    || !hasUniqueStrings(envelopeHashes)
    || value.leaves.some((leaf, index) => leaf.index !== index)
    || value.storyIdSetHash !== hashImplementationSourceMapStoryIdSetV2(storyIds)
    || value.merkleRoot !== implementationSourceMapMerkleRootV2(value.leaves)
    || value.manifestHash !== hashImplementationSourceMapManifestV2(value)
  ) {
    context.addIssue({
      code: "custom",
      path: ["leaves"],
      message: "Source-map root must close exact authority, leaves and Merkle identity",
    });
  }
}

const RootManifestCandidateV2Schema = RootManifestIdentityV2Schema.extend({
  manifestHash: Sha256Schema,
}).strict().superRefine(rootClosureIssuesV2);

export const ImplementationSourceMapV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES,
        ...IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Source-map root exceeds canonical byte or work bounds",
      });
    }
  }).pipe(RootManifestCandidateV2Schema);

export type ImplementationSourceMapV2 = z.infer<
  typeof RootManifestCandidateV2Schema
>;

export const ImplementationSourceMapEnvelopeV2Schema =
  SemanticArtifactEnvelopeV1Schema.extend({
    artifactType: z.literal(IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2),
    producer: ImplementationSourceMapProducerV2Schema,
    payload: ImplementationSourceMapV2Schema,
  }).strict();

export type ImplementationSourceMapEnvelopeV2 = z.infer<
  typeof ImplementationSourceMapEnvelopeV2Schema
>;

export const ImplementationSourceMapProofStepV2Schema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("left"), siblingHash: Sha256Schema }).strict(),
    z.object({ kind: z.literal("right"), siblingHash: Sha256Schema }).strict(),
    z.object({ kind: z.literal("unary") }).strict(),
  ],
);

export type ImplementationSourceMapProofStepV2 = z.infer<
  typeof ImplementationSourceMapProofStepV2Schema
>;

const StoryProofIdentityV2Schema = z.object({
  schema: z.literal(IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_SCHEMA),
  proofVersion: z.literal(IMPLEMENTATION_SOURCE_MAP_V2_VERSION),
  contractHash: z.literal(IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2),
  root: z.object({
    artifactType: z.literal(IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2),
    envelopeHash: Sha256Schema,
    manifestHash: Sha256Schema,
    authorityHash: Sha256Schema,
    merkleRoot: Sha256Schema,
    leafCount: z.number().int().positive().max(5_000),
    storyIdSetHash: Sha256Schema,
  }).strict(),
  leaf: z.object({
    reference: ImplementationSourceMapLeafRefV2Schema,
    envelope: ImplementationSourceMapStoryLeafEnvelopeV2Schema,
  }).strict(),
  auditPath: z.array(ImplementationSourceMapProofStepV2Schema).max(14),
}).strict();

export type ImplementationSourceMapStoryProofHashPayloadV2 = z.infer<
  typeof StoryProofIdentityV2Schema
>;

export function hashImplementationSourceMapStoryProofV2(
  value:
    | ImplementationSourceMapStoryProofHashPayloadV2
    | ImplementationSourceMapStoryProofV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.proofHash;
  return hashCanonicalJson({
    schema: "setfarm.implementation-source-map-story-proof-hash.v2",
    proof: payload,
  });
}

function proofClosureIssuesV2(
  value: ImplementationSourceMapStoryProofHashPayloadV2 & { proofHash: string },
  context: z.RefinementCtx,
): void {
  const reference = value.leaf.reference;
  let envelopeBytes: Buffer | undefined;
  try {
    envelopeBytes = canonicalJsonBytesBounded(value.leaf.envelope, {
      maxBytes: IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES,
      ...IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS,
    });
  } catch {
    context.addIssue({
      code: "custom",
      path: ["leaf", "envelope"],
      message: "Proof leaf envelope exceeds canonical limits",
    });
  }
  if (
    reference.index >= value.root.leafCount
    || reference.storyId !== value.leaf.envelope.payload.story.storyId
    || reference.storyHash !== value.leaf.envelope.payload.story.storyHash
    || envelopeBytes === undefined
    || reference.byteLength !== envelopeBytes.byteLength
    || reference.leafEnvelopeHash
      !== (envelopeBytes === undefined ? "" : hashCanonicalJson(value.leaf.envelope))
  ) {
    context.addIssue({
      code: "custom",
      path: ["leaf"],
      message: "Proof leaf reference must bind the exact story envelope",
    });
  }
  let current = hashImplementationSourceMapMerkleLeafV2(reference);
  let currentIndex = reference.index;
  let currentCount = value.root.leafCount;
  let validPath = true;
  for (const step of value.auditPath) {
    if (currentCount <= 1) {
      validPath = false;
      break;
    }
    const isOddTail = currentCount % 2 === 1
      && currentIndex === currentCount - 1;
    const expected = isOddTail
      ? "unary"
      : currentIndex % 2 === 0 ? "right" : "left";
    if (step.kind !== expected) {
      validPath = false;
      break;
    }
    current = step.kind === "unary"
      ? hashImplementationSourceMapMerkleUnaryV2(current)
      : step.kind === "right"
        ? hashImplementationSourceMapMerklePairV2(current, step.siblingHash)
        : hashImplementationSourceMapMerklePairV2(step.siblingHash, current);
    currentIndex = Math.floor(currentIndex / 2);
    currentCount = Math.ceil(currentCount / 2);
  }
  if (!validPath || currentCount !== 1 || current !== value.root.merkleRoot) {
    context.addIssue({
      code: "custom",
      path: ["auditPath"],
      message: "Proof path must have the only legal orientation, length and root",
    });
  }
  if (value.proofHash !== hashImplementationSourceMapStoryProofV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["proofHash"],
      message: "Story proof hash must bind exact root, leaf and audit path",
    });
  }
}

const StoryProofCandidateV2Schema = StoryProofIdentityV2Schema.extend({
  proofHash: Sha256Schema,
}).strict().superRefine(proofClosureIssuesV2);

export const ImplementationSourceMapStoryProofV2Schema = z.unknown()
  .superRefine((value, context) => {
    try {
      canonicalJsonBytesBounded(value, {
        maxBytes: IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_MAX_CANONICAL_BYTES,
        ...IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS,
      });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Source-map story proof exceeds canonical byte or work bounds",
      });
    }
  }).pipe(StoryProofCandidateV2Schema);

export type ImplementationSourceMapStoryProofV2 = z.infer<
  typeof StoryProofCandidateV2Schema
>;

export function recursivelyFreezeImplementationSourceMapV2<T>(value: T): T {
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
