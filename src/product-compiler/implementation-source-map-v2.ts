import { z } from "zod";

import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
  type PreparedArtifactStoreBatchV1,
} from "./artifact-store-batch-plan.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import type { MaterializedNodeScaffoldPrivateStageV2 } from
  "./node-scaffold-private-materializer-v2.js";
import {
  verifyStoryPlanV3,
  verifyStoryPlanV3ForTest,
} from "./story-plan-v3.js";
import {
  BuildTopologyV3Schema,
  projectBuildTopologyCommandContractV3,
  type BuildTopologyV3,
} from "./schemas/build-topology-v3.js";
import {
  ImplementationSourceMapEnvelopeV2Schema,
  ImplementationSourceMapProducerV2Schema,
  ImplementationSourceMapStoryLeafEnvelopeV2Schema,
  ImplementationSourceMapStoryLeafV2Schema,
  ImplementationSourceMapStoryProofV2Schema,
  ImplementationSourceMapV2Schema,
  IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
  IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_ARTIFACT_TYPE_V2,
  IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_V2_SCHEMA,
  IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_MAX_CANONICAL_BYTES,
  IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_SCHEMA,
  IMPLEMENTATION_SOURCE_MAP_V2_BLOCKER_CODES,
  IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS,
  IMPLEMENTATION_SOURCE_MAP_V2_MAX_AGGREGATE_RETURN_CANONICAL_BYTES,
  IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES,
  IMPLEMENTATION_SOURCE_MAP_V2_SCHEMA,
  IMPLEMENTATION_SOURCE_MAP_V2_VERSION,
  hashImplementationSourceMapAuthorityV2,
  hashImplementationSourceMapEvidenceBindingV2,
  hashImplementationSourceMapManifestV2,
  hashImplementationSourceMapMerkleLeafV2,
  hashImplementationSourceMapMerklePairV2,
  hashImplementationSourceMapMerkleUnaryV2,
  hashImplementationSourceMapStoryIdSetV2,
  hashImplementationSourceMapStoryLeafV2,
  hashImplementationSourceMapStoryProofV2,
  implementationSourceMapMerkleRootV2,
  recursivelyFreezeImplementationSourceMapV2,
  type ImplementationSourceMapAuthorityHashPayloadV2,
  type ImplementationSourceMapEnvelopeV2,
  type ImplementationSourceMapEvidenceBindingV2,
  type ImplementationSourceMapLeafRefV2,
  type ImplementationSourceMapManifestHashPayloadV2,
  type ImplementationSourceMapProducerV2,
  type ImplementationSourceMapProofStepV2,
  type ImplementationSourceMapStoryLeafEnvelopeV2,
  type ImplementationSourceMapStoryLeafV2,
  type ImplementationSourceMapStoryProofV2,
  type ImplementationSourceMapV2,
} from "./schemas/implementation-source-map-v2.js";
import {
  NodeProductRuntimeSourceReceiptV2Schema,
  type NodeProductRuntimeSourceReceiptV2,
} from "./schemas/node-product-runtime-source-v2.js";
import {
  NodeProductTestSourceReceiptV2Schema,
  type NodeProductTestSourceReceiptV2,
} from "./schemas/node-product-test-source-v2.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";
import {
  SemanticRealizationPlanV2Schema,
  type SemanticRealizationPlanV2,
  type SemanticRealizationV2,
} from "./schemas/semantic-realization-plan-v2.js";
import {
  STORY_PLAN_CONTRACT_HASH_V3,
  STORY_PLAN_V3_SCHEMA,
  STORY_PLAN_V3_VERSION,
  StoryPlanV3Schema,
  type ProductStoryV3,
  type StoryPlanV3,
} from "./schemas/story-plan-v3.js";
import { Sha256Schema } from "./schemas/common-v1.js";

const COMPILER_INPUT_MAX_CANONICAL_BYTES_V2 = 48 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 = 56 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 36,
  maxNodes: COMPILER_INPUT_MAX_CANONICAL_BYTES_V2 + 240_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (COMPILER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (12 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V2,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 + 240_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (12 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV2Schema = z.object({
  producer: z.unknown(),
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  designGraph: z.null().optional(),
  runtimeBehaviorProposal: z.unknown(),
  runtimeBehaviorContract: z.unknown(),
  realizationPlan: z.unknown(),
  fileTree: z.unknown(),
  buildTopology: z.unknown(),
  runtimeSourceText: z.string().min(1),
  runtimeSourceReceipt: z.unknown(),
  testSourceText: z.string().min(1),
  testSourceReceipt: z.unknown(),
  storyPlan: z.unknown(),
}).strict();

const ProofVerifierInputV2Schema = CompilerInputV2Schema.extend({
  expectedRootEnvelopeHash: Sha256Schema,
  rootEnvelope: z.unknown(),
  proof: z.unknown(),
}).strict();

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_500)
    : "Unknown ImplementationSourceMapV2 failure";
}

function boundedSnapshot(
  input: unknown,
  maxBytes: number,
  workLimits: Omit<Parameters<typeof canonicalJsonBytesBounded>[1], "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, { maxBytes, ...workLimits });
  return JSON.parse(bytes.toString("utf8"));
}

export type ImplementationSourceMapDiagnosticCodeV2 =
  | "IMPLEMENTATION_SOURCE_MAP_V2_ARTIFACT_INVALID"
  | "IMPLEMENTATION_SOURCE_MAP_V2_INPUT_INVALID"
  | "IMPLEMENTATION_SOURCE_MAP_V2_OUTPUT_LIMIT_EXCEEDED"
  | "IMPLEMENTATION_SOURCE_MAP_V2_PUBLICATION_PREFLIGHT_REJECTED"
  | "IMPLEMENTATION_SOURCE_MAP_V2_STORY_PLAN_REJECTED"
  | "IMPLEMENTATION_SOURCE_MAP_V2_UPSTREAM_AUTHORITY_REJECTED";

export type ImplementationSourceMapDiagnosticV2 = Readonly<{
  code: ImplementationSourceMapDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type ImplementationSourceMapPublicationPreflightV2 = Readonly<{
  artifactType: string;
  envelopeHash: string;
  byteLength: number;
  durabilityTier: 0;
  preparedPublication: PreparedArtifactStoreBatchV1;
}>;

export type CompiledImplementationSourceMapLeafV2 = Readonly<{
  reference: Readonly<ImplementationSourceMapLeafRefV2>;
  value: Readonly<ImplementationSourceMapStoryLeafV2>;
  envelope: Readonly<ImplementationSourceMapStoryLeafEnvelopeV2>;
  envelopeHash: string;
  canonicalBytes: string;
  publicationPreflight: ImplementationSourceMapPublicationPreflightV2;
}>;

export type CompiledImplementationSourceMapRootV2 = Readonly<{
  value: Readonly<ImplementationSourceMapV2>;
  envelope: Readonly<ImplementationSourceMapEnvelopeV2>;
  envelopeHash: string;
  canonicalBytes: string;
  publicationPreflight: ImplementationSourceMapPublicationPreflightV2;
}>;

export type ImplementationSourceMapCompilationResultV2 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      root: CompiledImplementationSourceMapRootV2;
      leaves: readonly CompiledImplementationSourceMapLeafV2[];
      proofs: readonly Readonly<ImplementationSourceMapStoryProofV2>[];
      aggregateCanonicalByteLength: number;
      publicationDisposition:
        "envelopes_preflighted_individually_atomic_activation_blocked";
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ImplementationSourceMapDiagnosticV2[];
    }>;

function rejected(
  code: ImplementationSourceMapDiagnosticCodeV2,
  path: string,
  message: string,
): ImplementationSourceMapCompilationResultV2 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

type ParsedAuthorityV2 = Readonly<{
  producer: ImplementationSourceMapProducerV2;
  productSpec: ProductSpecV2;
  realizationPlan: SemanticRealizationPlanV2;
  buildTopology: BuildTopologyV3;
  runtimeReceipt: NodeProductRuntimeSourceReceiptV2;
  testReceipt: NodeProductTestSourceReceiptV2;
  storyPlan: StoryPlanV3;
}>;

function parseAuthorityV2(input: Readonly<{
  producer: unknown;
  productSpec: unknown;
  realizationPlan: unknown;
  buildTopology: unknown;
  runtimeSourceReceipt: unknown;
  testSourceReceipt: unknown;
  storyPlan: unknown;
}>): ParsedAuthorityV2 {
  return {
    producer: ImplementationSourceMapProducerV2Schema.parse(input.producer),
    productSpec: ProductSpecV2Schema.parse(input.productSpec),
    realizationPlan: SemanticRealizationPlanV2Schema.parse(
      input.realizationPlan,
    ),
    buildTopology: BuildTopologyV3Schema.parse(input.buildTopology),
    runtimeReceipt: NodeProductRuntimeSourceReceiptV2Schema.parse(
      input.runtimeSourceReceipt,
    ),
    testReceipt: NodeProductTestSourceReceiptV2Schema.parse(
      input.testSourceReceipt,
    ),
    storyPlan: StoryPlanV3Schema.parse(input.storyPlan),
  };
}

function sourceMapAuthorityV2(
  input: ParsedAuthorityV2,
): ImplementationSourceMapAuthorityHashPayloadV2 {
  const {
    productSpec,
    realizationPlan,
    buildTopology,
    runtimeReceipt,
    testReceipt,
    storyPlan,
  } = input;
  return {
    product: {
      productRef: productSpec.product.id,
      productSpecHash: hashCanonicalJson(productSpec),
    },
    delivery: {
      selectionHash: realizationPlan.authority.deliverySelectionHash,
      profileId: realizationPlan.authority.profileId,
      profileHash: realizationPlan.authority.deliveryProfileHash,
      stackPackId: realizationPlan.authority.stackPackId,
      stackPackVersion: realizationPlan.authority.stackPackVersion,
      stackPackContentHash: realizationPlan.authority.stackPackContentHash,
    },
    semanticIntentSet: {
      schema: realizationPlan.authority.semanticIntentSet.schema,
      intentSetHash: realizationPlan.authority.semanticIntentSet.intentSetHash,
      intentCount: realizationPlan.authority.semanticIntentSet.intentCount,
    },
    semanticRealizationPlan: {
      schema: realizationPlan.schema,
      version: realizationPlan.planVersion,
      planHash: realizationPlan.planHash,
      realizationCount: realizationPlan.realizationCount,
      realizationMembershipHash: realizationPlan.realizationMembershipHash,
    },
    fileTree: {
      schema: storyPlan.authority.fileTree.schema,
      manifestHash: storyPlan.authority.fileTree.manifestHash,
      pathMembershipHash: storyPlan.authority.fileTree.pathMembershipHash,
    },
    buildTopology: {
      schema: buildTopology.schema,
      logicalBuildHash: buildTopology.logicalBuildHash,
      compilationContractHash:
        buildTopology.authority.compilationContractHash,
      commandContractHash: buildTopology.authority.commandContractHash,
      runtimeContractHash: buildTopology.authority.runtimeContractHash,
    },
    runtimeSource: {
      schema: runtimeReceipt.schema,
      logicalReceiptHash: runtimeReceipt.logicalReceiptHash,
      sourceIdentityHash: runtimeReceipt.source.sourceIdentityHash,
      generatedMemberMembershipHash:
        runtimeReceipt.coverage.generatedMemberMembershipHash,
    },
    testSource: {
      schema: testReceipt.schema,
      logicalReceiptHash: testReceipt.logicalReceiptHash,
      sourceIdentityHash: testReceipt.source.sourceIdentityHash,
      actionTestMembershipHash:
        testReceipt.coverage.actionTestMembershipHash,
      generatedCoverageMembershipHash:
        testReceipt.coverage.generatedCoverageMembershipHash,
    },
    storyPlan: {
      schema: STORY_PLAN_V3_SCHEMA,
      version: STORY_PLAN_V3_VERSION,
      contractHash: STORY_PLAN_CONTRACT_HASH_V3,
      planHash: storyPlan.planHash,
      storyCount: storyPlan.storyCount,
      storyMembershipHash: storyPlan.storyMembershipHash,
      productScopeRealizationMembershipHash:
        storyPlan.productScope.realizationMembershipHash,
    },
    designSource: {
      kind: "none",
      designGraphHash: null,
      generatedDesignSourceReceiptHashes: [],
    },
    modelAuthoredDeclarations: {
      schema: "setfarm.semantic-source-declarations.v1",
      status: "not_applicable",
      declarationRefs: [],
    },
  };
}

function storyRealizationDefinitionsV2(
  plan: SemanticRealizationPlanV2,
  storyId: string,
): SemanticRealizationV2[] {
  return plan.realizations
    .filter((item) => item.sourceIntent.storyId === storyId)
    .sort((left, right) => compareUtf16(
      left.realizationRef,
      right.realizationRef,
    ));
}

function productScopeRealizationDefinitionsV2(
  plan: SemanticRealizationPlanV2,
): SemanticRealizationV2[] {
  return plan.realizations
    .filter((item) => item.sourceIntent.storyId === null)
    .sort((left, right) => compareUtf16(
      left.realizationRef,
      right.realizationRef,
    ));
}

function evidenceBindingsV2(
  story: ProductStoryV3,
  definitions: readonly SemanticRealizationV2[],
): ImplementationSourceMapEvidenceBindingV2[] {
  return story.evidenceRefs.map((evidenceRef) => {
    const realizations = definitions.filter((item) =>
      item.target.kind === "evidence_relation"
      && item.sourceIntent.subjectRef === evidenceRef
      && item.target.predicateBinding.evidenceRef === evidenceRef);
    if (realizations.length !== 1) {
      throw new Error(
        `Story ${story.storyId} evidence ${evidenceRef} requires one exact realization`,
      );
    }
    const realization = realizations[0]!;
    const members = story.testCoverageMembers.filter((item) =>
      item.coverageKind === "evidence_relation"
      && item.subjectRef === evidenceRef
      && item.realizationRef === realization.realizationRef
      && item.realizationHash === realization.realizationHash);
    if (members.length !== 1) {
      throw new Error(
        `Story ${story.storyId} evidence ${evidenceRef} requires one exact test member`,
      );
    }
    const identity = {
      evidenceRef,
      realizationRef: realization.realizationRef,
      realizationHash: realization.realizationHash,
      testCoverageMember: members[0]!,
    };
    return {
      ...identity,
      bindingHash: hashImplementationSourceMapEvidenceBindingV2(identity),
    };
  });
}

function storyLeafV2(
  input: ParsedAuthorityV2,
  authorityHash: string,
  story: ProductStoryV3,
): ImplementationSourceMapStoryLeafV2 {
  const definitions = storyRealizationDefinitionsV2(
    input.realizationPlan,
    story.storyId,
  );
  const productDefinitions = productScopeRealizationDefinitionsV2(
    input.realizationPlan,
  );
  const evidenceBindings = evidenceBindingsV2(story, definitions);
  const semanticSubjectCount = [
    story.routeRefs,
    story.surfaceRefs,
    story.controlSlotRefs,
    story.controlRefs,
    story.actionRefs,
    story.observableRefs,
    story.stateRefs,
    story.persistenceRefs,
    story.evidenceRefs,
    story.entityRefs,
  ].reduce((total, refs) => total + refs.length, 0);
  const identity = {
    schema: IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_V2_SCHEMA,
    leafVersion: IMPLEMENTATION_SOURCE_MAP_V2_VERSION,
    contractHash: IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
    authority: {
      sourceMapAuthorityHash: authorityHash,
      productSpecHash: hashCanonicalJson(input.productSpec),
      semanticRealizationPlanHash: input.realizationPlan.planHash,
      buildTopologyLogicalHash: input.buildTopology.logicalBuildHash,
      runtimeSourceLogicalReceiptHash:
        input.runtimeReceipt.logicalReceiptHash,
      testSourceLogicalReceiptHash: input.testReceipt.logicalReceiptHash,
      storyPlanHash: input.storyPlan.planHash,
      storyId: story.storyId,
      storyHash: story.storyHash,
    },
    story,
    realizationDefinitions: definitions,
    sharedProductScope: {
      storyPlanBinding: input.storyPlan.productScope,
      realizationDefinitions: productDefinitions,
      realizationDefinitionMembershipHash:
        input.storyPlan.productScope.realizationMembershipHash,
    },
    execution: {
      compilation: input.buildTopology.compilation,
      commands: projectBuildTopologyCommandContractV3(
        input.buildTopology.commands,
      ),
      runtimeTarget: input.buildTopology.runtimeTarget,
      compilationContractHash:
        input.buildTopology.authority.compilationContractHash,
      commandContractHash: input.buildTopology.authority.commandContractHash,
      runtimeContractHash: input.buildTopology.authority.runtimeContractHash,
    },
    evidenceBindings,
    designSource: {
      kind: "none" as const,
      generatedSourceBindings: [] as [],
    },
    modelAuthoredDeclarations: {
      status: "not_applicable" as const,
      declarationRefs: [] as [],
    },
    coverage: {
      semanticSubjectCount,
      storyRealizationCount: definitions.length,
      productScopeRealizationCount: productDefinitions.length,
      runtimeSourceMemberCount: story.runtimeSourceMembers.length,
      testCoverageMemberCount: story.testCoverageMembers.length,
      actionTestCount: story.actionTests.length,
      evidenceBindingCount: evidenceBindings.length,
      disposition:
        "one_exact_story_plus_required_shared_product_scope_and_execution_authority" as const,
    },
  };
  return ImplementationSourceMapStoryLeafV2Schema.parse({
    ...identity,
    leafHash: hashImplementationSourceMapStoryLeafV2(identity),
  });
}

function storyLeafEnvelopeV2(
  producer: ImplementationSourceMapProducerV2,
  leaf: ImplementationSourceMapStoryLeafV2,
): ImplementationSourceMapStoryLeafEnvelopeV2 {
  return ImplementationSourceMapStoryLeafEnvelopeV2Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: IMPLEMENTATION_SOURCE_MAP_STORY_LEAF_ARTIFACT_TYPE_V2,
    producer,
    payload: leaf,
  });
}

function publicationPreflightV2(
  envelope: ImplementationSourceMapStoryLeafEnvelopeV2
    | ImplementationSourceMapEnvelopeV2,
  canonicalBytes: Buffer,
): ImplementationSourceMapPublicationPreflightV2 {
  const envelopeHash = hashCanonicalJson(envelope);
  const preparedPublication = prepareArtifactStoreBatchPlanV1({
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items: [{ durabilityTier: 0, envelope }],
  });
  const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(
    preparedPublication,
  );
  if (
    items.length !== 1
    || items[0]!.durabilityTier !== 0
    || items[0]!.identity.hash !== envelopeHash
    || items[0]!.identity.byteLength !== canonicalBytes.byteLength
    || !items[0]!.bytes.equals(canonicalBytes)
  ) {
    throw new Error("Artifact-store preflight changed source-map envelope identity");
  }
  return Object.freeze({
    artifactType: envelope.artifactType,
    envelopeHash,
    byteLength: canonicalBytes.byteLength,
    durabilityTier: 0 as const,
    preparedPublication,
  });
}

function leafRecordV2(
  producer: ImplementationSourceMapProducerV2,
  leaf: ImplementationSourceMapStoryLeafV2,
  index: number,
): CompiledImplementationSourceMapLeafV2 {
  const envelope = recursivelyFreezeImplementationSourceMapV2(
    storyLeafEnvelopeV2(producer, leaf),
  );
  const bytes = canonicalJsonBytesBounded(envelope, {
    maxBytes: IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES,
    ...IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS,
  });
  const envelopeHash = hashCanonicalJson(envelope);
  const reference = recursivelyFreezeImplementationSourceMapV2({
    index,
    storyId: leaf.story.storyId,
    storyHash: leaf.story.storyHash,
    leafEnvelopeHash: envelopeHash,
    byteLength: bytes.byteLength,
  });
  return Object.freeze({
    reference,
    value: leaf,
    envelope,
    envelopeHash,
    canonicalBytes: bytes.toString("utf8"),
    publicationPreflight: publicationPreflightV2(envelope, bytes),
  });
}

function merkleProofPathV2(
  leaves: readonly ImplementationSourceMapLeafRefV2[],
  leafIndex: number,
): ImplementationSourceMapProofStepV2[] {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new RangeError("Merkle proof leaf index is outside the leaf set");
  }
  let level = leaves.map(hashImplementationSourceMapMerkleLeafV2);
  let index = leafIndex;
  const path: ImplementationSourceMapProofStepV2[] = [];
  while (level.length > 1) {
    if (level.length % 2 === 1 && index === level.length - 1) {
      path.push({ kind: "unary" });
    } else if (index % 2 === 0) {
      path.push({ kind: "right", siblingHash: level[index + 1]! });
    } else {
      path.push({ kind: "left", siblingHash: level[index - 1]! });
    }
    const next: string[] = [];
    for (let cursor = 0; cursor < level.length; cursor += 2) {
      const left = level[cursor]!;
      const right = level[cursor + 1];
      next.push(right === undefined
        ? hashImplementationSourceMapMerkleUnaryV2(left)
        : hashImplementationSourceMapMerklePairV2(left, right));
    }
    level = next;
    index = Math.floor(index / 2);
  }
  return path;
}

function proofV2(
  root: CompiledImplementationSourceMapRootV2,
  leaf: CompiledImplementationSourceMapLeafV2,
  leaves: readonly ImplementationSourceMapLeafRefV2[],
): ImplementationSourceMapStoryProofV2 {
  const identity = {
    schema: IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_SCHEMA,
    proofVersion: IMPLEMENTATION_SOURCE_MAP_V2_VERSION,
    contractHash: IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
    root: {
      artifactType: IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2,
      envelopeHash: root.envelopeHash,
      manifestHash: root.value.manifestHash,
      authorityHash: root.value.authorityHash,
      merkleRoot: root.value.merkleRoot,
      leafCount: root.value.leafCount,
      storyIdSetHash: root.value.storyIdSetHash,
    },
    leaf: {
      reference: leaf.reference,
      envelope: leaf.envelope,
    },
    auditPath: merkleProofPathV2(leaves, leaf.reference.index),
  };
  return ImplementationSourceMapStoryProofV2Schema.parse({
    ...identity,
    proofHash: hashImplementationSourceMapStoryProofV2(identity),
  });
}

function rootRecordV2(
  producer: ImplementationSourceMapProducerV2,
  authority: ImplementationSourceMapAuthorityHashPayloadV2,
  leaves: readonly ImplementationSourceMapLeafRefV2[],
): CompiledImplementationSourceMapRootV2 {
  const authorityHash = hashImplementationSourceMapAuthorityV2(authority);
  const storyIds = leaves.map((leaf) => leaf.storyId);
  const identity: ImplementationSourceMapManifestHashPayloadV2 = {
    schema: IMPLEMENTATION_SOURCE_MAP_V2_SCHEMA,
    mapVersion: IMPLEMENTATION_SOURCE_MAP_V2_VERSION,
    contractHash: IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
    stage: "story_sources_verified_before_packet_v4" as const,
    readiness: {
      status: "shadow_blocked" as const,
      productionUse: "forbidden" as const,
      blockerCodes: [...IMPLEMENTATION_SOURCE_MAP_V2_BLOCKER_CODES],
    },
    authority,
    authorityHash,
    leafCount: leaves.length,
    storyIdSetHash: hashImplementationSourceMapStoryIdSetV2(storyIds),
    leaves: [...leaves],
    merkleRoot: implementationSourceMapMerkleRootV2(leaves),
  };
  const value = recursivelyFreezeImplementationSourceMapV2(
    ImplementationSourceMapV2Schema.parse({
      ...identity,
      manifestHash: hashImplementationSourceMapManifestV2(identity),
    }),
  );
  const envelope = recursivelyFreezeImplementationSourceMapV2(
    ImplementationSourceMapEnvelopeV2Schema.parse({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: IMPLEMENTATION_SOURCE_MAP_ARTIFACT_TYPE_V2,
      producer,
      payload: value,
    }),
  );
  const bytes = canonicalJsonBytesBounded(envelope, {
    maxBytes: IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES,
    ...IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS,
  });
  const envelopeHash = hashCanonicalJson(envelope);
  return Object.freeze({
    value,
    envelope,
    envelopeHash,
    canonicalBytes: bytes.toString("utf8"),
    publicationPreflight: publicationPreflightV2(envelope, bytes),
  });
}

function storyPlanVerifierInputV2(
  input: z.infer<typeof CompilerInputV2Schema>,
) {
  return {
    productSpec: input.productSpec,
    deliverySelection: input.deliverySelection,
    ...(input.designGraph === null ? { designGraph: null } : {}),
    runtimeBehaviorProposal: input.runtimeBehaviorProposal,
    runtimeBehaviorContract: input.runtimeBehaviorContract,
    realizationPlan: input.realizationPlan,
    fileTree: input.fileTree,
    buildTopology: input.buildTopology,
    runtimeSourceText: input.runtimeSourceText,
    runtimeSourceReceipt: input.runtimeSourceReceipt,
    testSourceText: input.testSourceText,
    testSourceReceipt: input.testSourceReceipt,
    candidate: input.storyPlan,
  };
}

async function compileInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<ImplementationSourceMapCompilationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      COMPILER_INPUT_MAX_CANONICAL_BYTES_V2,
      INPUT_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return rejected(
      "IMPLEMENTATION_SOURCE_MAP_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const parsed = CompilerInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return rejected(
      "IMPLEMENTATION_SOURCE_MAP_V2_INPUT_INVALID",
      `/${issue?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      issue?.message ?? "ImplementationSourceMapV2 input is invalid",
    );
  }
  let authorityInput: ParsedAuthorityV2;
  try {
    authorityInput = parseAuthorityV2(parsed.data);
  } catch (error) {
    return rejected(
      "IMPLEMENTATION_SOURCE_MAP_V2_UPSTREAM_AUTHORITY_REJECTED",
      "/",
      errorMessage(error),
    );
  }
  try {
    const verifyPlan = expectedScope === "production_host"
      ? verifyStoryPlanV3
      : verifyStoryPlanV3ForTest;
    const verifiedPlan = await verifyPlan(
      handle,
      storyPlanVerifierInputV2(parsed.data),
    );
    authorityInput = {
      ...authorityInput,
      storyPlan: verifiedPlan.value,
    };
  } catch (error) {
    return rejected(
      "IMPLEMENTATION_SOURCE_MAP_V2_STORY_PLAN_REJECTED",
      "/storyPlan",
      errorMessage(error),
    );
  }
  try {
    const authority = sourceMapAuthorityV2(authorityInput);
    const authorityHash = hashImplementationSourceMapAuthorityV2(authority);
    const leaves: CompiledImplementationSourceMapLeafV2[] = [];
    let aggregateBytes = 0;
    for (const [index, story] of authorityInput.storyPlan.stories.entries()) {
      const leaf = recursivelyFreezeImplementationSourceMapV2(
        storyLeafV2(authorityInput, authorityHash, story),
      );
      const record = leafRecordV2(authorityInput.producer, leaf, index);
      aggregateBytes += Buffer.byteLength(record.canonicalBytes, "utf8");
      if (
        aggregateBytes
          > IMPLEMENTATION_SOURCE_MAP_V2_MAX_AGGREGATE_RETURN_CANONICAL_BYTES
      ) {
        return rejected(
          "IMPLEMENTATION_SOURCE_MAP_V2_OUTPUT_LIMIT_EXCEEDED",
          "/leaves",
          "Source-map leaf envelopes exceed the bounded aggregate return budget",
        );
      }
      leaves.push(record);
    }
    const references = leaves.map((leaf) => leaf.reference);
    const root = rootRecordV2(
      authorityInput.producer,
      authority,
      references,
    );
    aggregateBytes += Buffer.byteLength(root.canonicalBytes, "utf8");
    if (
      aggregateBytes
        > IMPLEMENTATION_SOURCE_MAP_V2_MAX_AGGREGATE_RETURN_CANONICAL_BYTES
    ) {
      return rejected(
        "IMPLEMENTATION_SOURCE_MAP_V2_OUTPUT_LIMIT_EXCEEDED",
        "/root",
        "Source-map root and leaves exceed the bounded aggregate return budget",
      );
    }
    const proofs: ImplementationSourceMapStoryProofV2[] = [];
    for (const leaf of leaves) {
      const proof = recursivelyFreezeImplementationSourceMapV2(
        proofV2(root, leaf, references),
      );
      const proofBytes = canonicalJsonBytesBounded(proof, {
        maxBytes:
          IMPLEMENTATION_SOURCE_MAP_STORY_PROOF_V2_MAX_CANONICAL_BYTES,
        ...IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS,
      });
      aggregateBytes += proofBytes.byteLength;
      if (
        aggregateBytes
          > IMPLEMENTATION_SOURCE_MAP_V2_MAX_AGGREGATE_RETURN_CANONICAL_BYTES
      ) {
        return rejected(
          "IMPLEMENTATION_SOURCE_MAP_V2_OUTPUT_LIMIT_EXCEEDED",
          "/proofs",
          "Source-map proofs exceed the bounded aggregate return budget",
        );
      }
      proofs.push(proof);
    }
    return Object.freeze({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      root,
      leaves: Object.freeze(leaves),
      proofs: Object.freeze(proofs),
      aggregateCanonicalByteLength: aggregateBytes,
      publicationDisposition:
        "envelopes_preflighted_individually_atomic_activation_blocked" as const,
    });
  } catch (error) {
    const message = errorMessage(error);
    const publicationFailure = /artifact|batch|publication|payload/iu.test(message);
    return rejected(
      publicationFailure
        ? "IMPLEMENTATION_SOURCE_MAP_V2_PUBLICATION_PREFLIGHT_REJECTED"
        : "IMPLEMENTATION_SOURCE_MAP_V2_ARTIFACT_INVALID",
      publicationFailure ? "/publication" : "/",
      message,
    );
  }
}

export function compileImplementationSourceMapV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationSourceMapCompilationResultV2> {
  return compileInternalV2(handle, input, "production_host");
}

export function compileImplementationSourceMapV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<ImplementationSourceMapCompilationResultV2> {
  return compileInternalV2(handle, input, "test_fixture");
}

export type ImplementationSourceMapStoryProofVerificationErrorCodeV2 =
  | "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_AUTHORITY_MISMATCH"
  | "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_CANDIDATE_INVALID"
  | "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_INPUT_INVALID"
  | "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_STORY_PLAN_REJECTED";

export class ImplementationSourceMapStoryProofVerificationErrorV2
  extends Error {
  readonly code: ImplementationSourceMapStoryProofVerificationErrorCodeV2;

  constructor(
    code: ImplementationSourceMapStoryProofVerificationErrorCodeV2,
    message: string,
  ) {
    super(message.slice(0, 1_500));
    this.name = "ImplementationSourceMapStoryProofVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedImplementationSourceMapStoryProofV2 = Readonly<{
  status: "verified_shadow";
  rootEnvelopeHash: string;
  manifestHash: string;
  authorityHash: string;
  storyIdSetHash: string;
  leafReference: Readonly<ImplementationSourceMapLeafRefV2>;
  leaf: Readonly<ImplementationSourceMapStoryLeafV2>;
  leafEnvelopeHash: string;
  proofHash: string;
}>;

function proofRootIdentityMatchesV2(
  rootEnvelopeHash: string,
  root: ImplementationSourceMapV2,
  proof: ImplementationSourceMapStoryProofV2,
): boolean {
  return proof.root.envelopeHash === rootEnvelopeHash
    && proof.root.manifestHash === root.manifestHash
    && proof.root.authorityHash === root.authorityHash
    && proof.root.merkleRoot === root.merkleRoot
    && proof.root.leafCount === root.leafCount
    && proof.root.storyIdSetHash === root.storyIdSetHash;
}

function exactRootStoryProjectionV2(
  root: ImplementationSourceMapV2,
  storyPlan: StoryPlanV3,
): boolean {
  if (root.leaves.length !== storyPlan.stories.length) return false;
  return root.leaves.every((leaf, index) => {
    const story = storyPlan.stories[index];
    return story !== undefined
      && leaf.index === index
      && leaf.storyId === story.storyId
      && leaf.storyHash === story.storyHash;
  });
}

async function verifyProofInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedImplementationSourceMapStoryProofV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    throw new ImplementationSourceMapStoryProofVerificationErrorV2(
      "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = ProofVerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new ImplementationSourceMapStoryProofVerificationErrorV2(
      "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_INPUT_INVALID",
      parsed.error.issues[0]?.message
        ?? "ImplementationSourceMapV2 proof verifier input is invalid",
    );
  }
  const rootEnvelope = ImplementationSourceMapEnvelopeV2Schema.safeParse(
    parsed.data.rootEnvelope,
  );
  const proof = ImplementationSourceMapStoryProofV2Schema.safeParse(
    parsed.data.proof,
  );
  if (!rootEnvelope.success || !proof.success) {
    throw new ImplementationSourceMapStoryProofVerificationErrorV2(
      "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_CANDIDATE_INVALID",
      rootEnvelope.success
        ? (!proof.success
            ? proof.error.issues[0]?.message ?? "Story proof is invalid"
            : "Story proof is invalid")
        : rootEnvelope.error.issues[0]?.message ?? "Source-map root is invalid",
    );
  }
  let authorityInput: ParsedAuthorityV2;
  try {
    authorityInput = parseAuthorityV2(parsed.data);
  } catch (error) {
    throw new ImplementationSourceMapStoryProofVerificationErrorV2(
      "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_INPUT_INVALID",
      errorMessage(error),
    );
  }
  try {
    const verifyPlan = expectedScope === "production_host"
      ? verifyStoryPlanV3
      : verifyStoryPlanV3ForTest;
    const verifiedPlan = await verifyPlan(
      handle,
      storyPlanVerifierInputV2(parsed.data),
    );
    authorityInput = { ...authorityInput, storyPlan: verifiedPlan.value };
  } catch (error) {
    throw new ImplementationSourceMapStoryProofVerificationErrorV2(
      "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_STORY_PLAN_REJECTED",
      errorMessage(error),
    );
  }
  const root = rootEnvelope.data.payload;
  const rootEnvelopeHash = hashCanonicalJson(rootEnvelope.data);
  const expectedAuthority = sourceMapAuthorityV2(authorityInput);
  const expectedAuthorityHash = hashImplementationSourceMapAuthorityV2(
    expectedAuthority,
  );
  const reference = proof.data.leaf.reference;
  const rootReference = root.leaves[reference.index];
  if (
    rootEnvelopeHash !== parsed.data.expectedRootEnvelopeHash
    || !proofRootIdentityMatchesV2(rootEnvelopeHash, root, proof.data)
    || canonicalJsonStringify(rootEnvelope.data.producer)
      !== canonicalJsonStringify(authorityInput.producer)
    || canonicalJsonStringify(root.authority)
      !== canonicalJsonStringify(expectedAuthority)
    || root.authorityHash !== expectedAuthorityHash
    || !exactRootStoryProjectionV2(root, authorityInput.storyPlan)
    || rootReference === undefined
    || canonicalJsonStringify(rootReference)
      !== canonicalJsonStringify(reference)
  ) {
    throw new ImplementationSourceMapStoryProofVerificationErrorV2(
      "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_AUTHORITY_MISMATCH",
      "Source-map root or proof differs from the trusted root hash and fresh upstream authority",
    );
  }
  const story = authorityInput.storyPlan.stories[reference.index];
  if (!story || story.storyId !== reference.storyId) {
    throw new ImplementationSourceMapStoryProofVerificationErrorV2(
      "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_AUTHORITY_MISMATCH",
      "Proof leaf index does not resolve to the exact fresh story",
    );
  }
  let reproducedLeaf: ImplementationSourceMapStoryLeafV2;
  let reproducedEnvelope: ImplementationSourceMapStoryLeafEnvelopeV2;
  try {
    reproducedLeaf = storyLeafV2(authorityInput, expectedAuthorityHash, story);
    reproducedEnvelope = storyLeafEnvelopeV2(
      authorityInput.producer,
      reproducedLeaf,
    );
  } catch (error) {
    throw new ImplementationSourceMapStoryProofVerificationErrorV2(
      "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_AUTHORITY_MISMATCH",
      errorMessage(error),
    );
  }
  const reproducedBytes = canonicalJsonBytesBounded(reproducedEnvelope, {
    maxBytes: IMPLEMENTATION_SOURCE_MAP_V2_MAX_CANONICAL_BYTES,
    ...IMPLEMENTATION_SOURCE_MAP_V2_BOUNDED_WORK_LIMITS,
  });
  const reproducedReference: ImplementationSourceMapLeafRefV2 = {
    index: reference.index,
    storyId: story.storyId,
    storyHash: story.storyHash,
    leafEnvelopeHash: hashCanonicalJson(reproducedEnvelope),
    byteLength: reproducedBytes.byteLength,
  };
  if (
    canonicalJsonStringify(proof.data.leaf.envelope)
      !== canonicalJsonStringify(reproducedEnvelope)
    || canonicalJsonStringify(reference)
      !== canonicalJsonStringify(reproducedReference)
  ) {
    throw new ImplementationSourceMapStoryProofVerificationErrorV2(
      "IMPLEMENTATION_SOURCE_MAP_V2_PROOF_AUTHORITY_MISMATCH",
      "Proof leaf differs from fresh story, realization, source and execution authority",
    );
  }
  return recursivelyFreezeImplementationSourceMapV2({
    status: "verified_shadow" as const,
    rootEnvelopeHash,
    manifestHash: root.manifestHash,
    authorityHash: root.authorityHash,
    storyIdSetHash: root.storyIdSetHash,
    leafReference: reproducedReference,
    leaf: reproducedLeaf,
    leafEnvelopeHash: reproducedReference.leafEnvelopeHash,
    proofHash: proof.data.proofHash,
  });
}

export function verifyImplementationSourceMapStoryProofV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedImplementationSourceMapStoryProofV2> {
  return verifyProofInternalV2(handle, input, "production_host");
}

export function verifyImplementationSourceMapStoryProofV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedImplementationSourceMapStoryProofV2> {
  return verifyProofInternalV2(handle, input, "test_fixture");
}
