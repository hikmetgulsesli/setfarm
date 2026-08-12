import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import type { MaterializedNodeScaffoldPrivateStageV2 } from
  "./node-scaffold-private-materializer-v2.js";
import {
  verifyNodeProductRuntimeSourceV2,
  verifyNodeProductRuntimeSourceV2ForTest,
} from "./node-product-runtime-generator-v2.js";
import {
  verifyNodeProductTestSourceV2,
  verifyNodeProductTestSourceV2ForTest,
} from "./node-product-test-generator-v2.js";
import {
  produceStoryDefinitionsV3,
  type ProductStoryDefinitionV3,
} from
  "./producers/story-definitions-v3.js";
import { verifySemanticRealizationPlanV2 } from
  "./semantic-realization-plan-v2.js";
import {
  BuildTopologyV3Schema,
} from "./schemas/build-topology-v3.js";
import {
  FileTreeManifestV3Schema,
} from "./schemas/file-tree-manifest-v3.js";
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
  STORY_PLAN_V3_BLOCKER_CODES,
  STORY_PLAN_V3_BOUNDED_WORK_LIMITS,
  STORY_PLAN_V3_MAX_CANONICAL_BYTES,
  STORY_PLAN_V3_SCHEMA,
  STORY_PLAN_V3_VERSION,
  ProductStoryV3Schema,
  StoryPlanV3Schema,
  hashProductStoryV3,
  hashStoryMembershipV3,
  hashStoryPlanV3,
  hashStoryRealizationMembershipV3,
  recursivelyFreezeStoryPlanV3,
  type ProductStoryV3,
  type StoryPlanV3,
  type StoryRealizationBindingV3,
} from "./schemas/story-plan-v3.js";

const INPUT_MAX_CANONICAL_BYTES_V3 = 32 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3 = 36 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V3 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 30,
  maxNodes: INPUT_MAX_CANONICAL_BYTES_V3 + 160_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (INPUT_MAX_CANONICAL_BYTES_V3 * 8) + (8 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V3 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V3,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3 + 160_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3 * 8) + (8 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV3Schema = z.object({
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
}).strict();

const VerifierInputV3Schema = CompilerInputV3Schema.extend({
  candidate: z.unknown(),
}).strict();

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1_500) : "Unknown error";
}

function boundedSnapshot(
  input: unknown,
  maxBytes: number,
  workLimits: Omit<Parameters<typeof canonicalJsonBytesBounded>[1], "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, { maxBytes, ...workLimits });
  return JSON.parse(bytes.toString("utf8"));
}

export type StoryPlanDiagnosticCodeV3 =
  | "STORY_PLAN_V3_ARTIFACT_INVALID"
  | "STORY_PLAN_V3_INPUT_INVALID"
  | "STORY_PLAN_V3_OUTPUT_LIMIT_EXCEEDED"
  | "STORY_PLAN_V3_PARTITION_REJECTED"
  | "STORY_PLAN_V3_SOURCE_AUTHORITY_REJECTED"
  | "STORY_PLAN_V3_UPSTREAM_AUTHORITY_REJECTED";

export type StoryPlanDiagnosticV3 = Readonly<{
  code: StoryPlanDiagnosticCodeV3;
  path: string;
  message: string;
}>;

export type StoryPlanCompilationResultV3 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      value: Readonly<StoryPlanV3>;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly StoryPlanDiagnosticV3[];
    }>;

function rejected(
  code: StoryPlanDiagnosticCodeV3,
  path: string,
  message: string,
): StoryPlanCompilationResultV3 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

function realizationBindingV3(
  realization: SemanticRealizationV2,
): StoryRealizationBindingV3 {
  return {
    realizationRef: realization.realizationRef,
    realizationHash: realization.realizationHash,
    intentRef: realization.sourceIntent.intentRef,
    intentHash: realization.sourceIntent.intentHash,
    targetKind: realization.target.kind,
    subjectKind: realization.sourceIntent.subjectKind,
    subjectRef: realization.sourceIntent.subjectRef,
    subjectHash: realization.sourceIntent.subjectHash,
    responsibility: realization.sourceIntent.responsibility,
    storyId: realization.sourceIntent.storyId,
  };
}

function runtimeDependencyV3(
  receipt: NodeProductRuntimeSourceReceiptV2,
  members: NodeProductRuntimeSourceReceiptV2["coverage"]["members"],
) {
  return {
    ownerRef: "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2" as const,
    pathRef: receipt.source.pathRef,
    logicalReceiptHash: receipt.logicalReceiptHash,
    sourceIdentityHash: receipt.source.sourceIdentityHash,
    generatedSymbolRefs: members.map((item) => item.generatedSymbolRef)
      .sort(compareUtf16),
    relation: "consumes_exact_generated_runtime_members" as const,
  };
}

function testDependencyV3(
  receipt: NodeProductTestSourceReceiptV2,
  members: NodeProductTestSourceReceiptV2["coverage"]["coverageMembers"],
) {
  return {
    ownerRef: "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2" as const,
    pathRef: receipt.source.pathRef,
    logicalReceiptHash: receipt.logicalReceiptHash,
    sourceIdentityHash: receipt.source.sourceIdentityHash,
    coverageSymbolRefs: members.map((item) => item.coverageSymbolRef)
      .sort(compareUtf16),
    relation: "consumes_exact_generated_test_members" as const,
  };
}

function storyV3(input: Readonly<{
  definition: ProductStoryDefinitionV3;
  realizationPlan: SemanticRealizationPlanV2;
  runtimeReceipt: NodeProductRuntimeSourceReceiptV2;
  testReceipt: NodeProductTestSourceReceiptV2;
}>): ProductStoryV3 {
  const { definition, realizationPlan, runtimeReceipt, testReceipt } = input;
  const realizations = realizationPlan.realizations
    .filter((item) => item.sourceIntent.storyId === definition.id)
    .map(realizationBindingV3);
  const runtimeSourceMembers = runtimeReceipt.coverage.members
    .filter((item) => item.storyId === definition.id);
  const testCoverageMembers = testReceipt.coverage.coverageMembers
    .filter((item) => item.storyId === definition.id);
  const actionTests = testReceipt.coverage.actionTests
    .filter((item) => definition.actionRefs.includes(item.actionRef));
  const runtimeAssertions = runtimeReceipt.coverage.runtimeBehavior.runtimeAssertions
    .filter((item) => definition.stateRefs.includes(item.stateRef));
  const runtimeAssertionRefs = new Set(runtimeAssertions.map((item) =>
    item.assertionRef));
  const testAssertions = testReceipt.coverage.behavior.assertionBindings
    .filter((item) => runtimeAssertionRefs.has(item.assertionRef));
  const runtimeEntityFields = runtimeReceipt.coverage.runtimeBehavior
    .entityFieldBindings.filter((item) =>
      definition.actionRefs.includes(item.actionRef));
  const runtimeEntityRefs = new Set(runtimeEntityFields.map((item) =>
    item.occurrenceRef));
  const testEntityFields = testReceipt.coverage.behavior.entityFieldBindings
    .filter((item) => runtimeEntityRefs.has(item.occurrenceRef));
  const identity = {
    storyId: definition.id,
    order: definition.order,
    componentHash: definition.componentHash,
    title: definition.title,
    description: definition.description,
    routeRefs: definition.routeRefs,
    surfaceRefs: definition.surfaceRefs,
    controlSlotRefs: definition.controlSlotRefs,
    controlRefs: definition.controlRefs,
    actionRefs: definition.actionRefs,
    observableRefs: definition.observableRefs,
    stateRefs: definition.stateRefs,
    persistenceRefs: definition.persistenceRefs,
    evidenceRefs: definition.evidenceRefs,
    entityRefs: definition.entityRefs,
    dependsOnStoryIds: [] as string[],
    physicalSharedGrantRefs: [] as [],
    realizationCount: realizations.length,
    realizations,
    realizationMembershipHash: hashStoryRealizationMembershipV3(realizations),
    runtimeSourceMembers,
    testCoverageMembers,
    actionTests,
    behaviorCoverage: {
      runtimeAssertions,
      testAssertions,
      runtimeEntityFields,
      testEntityFields,
    },
    sourceDependencies: {
      runtime: runtimeDependencyV3(runtimeReceipt, runtimeSourceMembers),
      test: testDependencyV3(testReceipt, testCoverageMembers),
    },
  };
  return ProductStoryV3Schema.parse({
    ...identity,
    storyHash: hashProductStoryV3(identity),
  });
}

function buildStoryPlanV3(input: Readonly<{
  productSpec: ProductSpecV2;
  realizationPlan: SemanticRealizationPlanV2;
  fileTree: z.infer<typeof FileTreeManifestV3Schema>;
  buildTopology: z.infer<typeof BuildTopologyV3Schema>;
  runtimeReceipt: NodeProductRuntimeSourceReceiptV2;
  testReceipt: NodeProductTestSourceReceiptV2;
  stories: readonly ProductStoryDefinitionV3[];
}>): StoryPlanV3 {
  const stories = input.stories.map((definition) => storyV3({
    definition,
    realizationPlan: input.realizationPlan,
    runtimeReceipt: input.runtimeReceipt,
    testReceipt: input.testReceipt,
  })).sort((left, right) => compareUtf16(left.storyId, right.storyId));
  const productScopeRealizations = input.realizationPlan.realizations
    .filter((item) => item.sourceIntent.storyId === null)
    .map(realizationBindingV3);
  const productScopeRuntimeMembers = input.runtimeReceipt.coverage.members
    .filter((item) => item.storyId === null);
  const productScope = {
    realizationCount: productScopeRealizations.length,
    realizations: productScopeRealizations,
    realizationMembershipHash:
      hashStoryRealizationMembershipV3(productScopeRealizations),
    runtimeSourceMembers: productScopeRuntimeMembers,
    runtimeSourceDependency: productScopeRuntimeMembers.length > 0
      ? runtimeDependencyV3(input.runtimeReceipt, productScopeRuntimeMembers)
      : null,
    testCoverageMembers: [] as [],
    disposition:
      "explicit_unscoped_realizations_and_generated_members_not_story_owned" as const,
  };
  const storyScopedRealizationCount = stories.reduce((total, story) =>
    total + story.realizations.length, 0);
  const runtimeMemberCount = stories.reduce((total, story) =>
    total + story.runtimeSourceMembers.length, productScopeRuntimeMembers.length);
  const testCoverageMemberCount = stories.reduce((total, story) =>
    total + story.testCoverageMembers.length, 0);
  const actionTestCount = stories.reduce((total, story) =>
    total + story.actionTests.length, 0);
  const runtimeAssertionCount = stories.reduce((total, story) =>
    total + story.behaviorCoverage.runtimeAssertions.length, 0);
  const testAssertionCount = stories.reduce((total, story) =>
    total + story.behaviorCoverage.testAssertions.length, 0);
  const runtimeEntityFieldCount = stories.reduce((total, story) =>
    total + story.behaviorCoverage.runtimeEntityFields.length, 0);
  const testEntityFieldCount = stories.reduce((total, story) =>
    total + story.behaviorCoverage.testEntityFields.length, 0);
  const identity = {
    schema: STORY_PLAN_V3_SCHEMA,
    planVersion: STORY_PLAN_V3_VERSION,
    contractHash: STORY_PLAN_CONTRACT_HASH_V3,
    stage: "generated_sources_verified_before_source_map" as const,
    readiness: {
      status: "shadow_blocked" as const,
      productionUse: "forbidden" as const,
      blockerCodes: [...STORY_PLAN_V3_BLOCKER_CODES],
    },
    authority: {
      productRef: input.productSpec.product.id,
      productSpecHash: hashCanonicalJson(input.productSpec),
      deliverySelectionHash: input.realizationPlan.authority.deliverySelectionHash,
      profileId: input.realizationPlan.authority.profileId,
      deliveryProfileHash: input.realizationPlan.authority.deliveryProfileHash,
      stackPackId: input.realizationPlan.authority.stackPackId,
      stackPackVersion: input.realizationPlan.authority.stackPackVersion,
      stackPackContentHash: input.realizationPlan.authority.stackPackContentHash,
      designSource: {
        kind: "none" as const,
        designGraphHash: null,
        closure: "product_delivery_design_not_required" as const,
      },
      modelAuthoredDeclarations: {
        schema: "setfarm.semantic-source-declarations.v1" as const,
        status: "not_applicable" as const,
        declarationCount: 0 as const,
        reason:
          "selected_node_profiles_forbid_model_write_authority" as const,
      },
      runtimeBehavior: {
        proposalHash: input.realizationPlan.authority.runtimeBehavior.proposalHash,
        contractHash: input.realizationPlan.authority.runtimeBehavior.contractHash,
      },
      semanticRealizationPlan: {
        schema: input.realizationPlan.schema,
        version: input.realizationPlan.planVersion,
        contractHash: input.realizationPlan.contractHash,
        planHash: input.realizationPlan.planHash,
        realizationCount: input.realizationPlan.realizationCount,
        realizationMembershipHash:
          input.realizationPlan.realizationMembershipHash,
      },
      fileTree: {
        schema: input.fileTree.schema,
        version: input.fileTree.manifestVersion,
        contractHash: input.fileTree.contractHash,
        manifestHash: input.fileTree.manifestHash,
        pathMembershipHash: input.fileTree.pathMembershipHash,
      },
      buildTopology: {
        schema: input.buildTopology.schema,
        version: input.buildTopology.topologyVersion,
        contractHash: input.buildTopology.contractHash,
        logicalBuildHash: input.buildTopology.logicalBuildHash,
        compilationContractHash:
          input.buildTopology.authority.compilationContractHash,
      },
      runtimeSource: {
        schema: input.runtimeReceipt.schema,
        logicalReceiptHash: input.runtimeReceipt.logicalReceiptHash,
        pathRef: input.runtimeReceipt.source.pathRef,
        sourceIdentityHash: input.runtimeReceipt.source.sourceIdentityHash,
        upstreamAuthority: {
          productSpecHash: input.runtimeReceipt.authority.productSpecHash,
          deliverySelectionHash:
            input.runtimeReceipt.authority.deliverySelectionHash,
          runtimeBehaviorContractHash:
            input.runtimeReceipt.authority.runtimeBehavior.contractHash,
          realizationPlanHash:
            input.runtimeReceipt.authority.semanticRealizationPlan.planHash,
          fileTreeManifestHash:
            input.runtimeReceipt.authority.fileTree.manifestHash,
          logicalBuildHash:
            input.runtimeReceipt.authority.buildTopology.logicalBuildHash,
        },
        generatedMemberMembershipHash:
          input.runtimeReceipt.coverage.generatedMemberMembershipHash,
        runtimeAssertionMembershipHash: input.runtimeReceipt.coverage
          .runtimeBehavior.runtimeAssertionMembershipHash,
        entityFieldBindingMembershipHash: input.runtimeReceipt.coverage
          .runtimeBehavior.entityFieldBindingMembershipHash,
      },
      testSource: {
        schema: input.testReceipt.schema,
        logicalReceiptHash: input.testReceipt.logicalReceiptHash,
        pathRef: input.testReceipt.source.pathRef,
        sourceIdentityHash: input.testReceipt.source.sourceIdentityHash,
        upstreamAuthority: {
          productSpecHash: input.testReceipt.authority.productSpecHash,
          deliverySelectionHash:
            input.testReceipt.authority.deliverySelectionHash,
          runtimeBehaviorContractHash:
            input.testReceipt.authority.runtimeBehavior.contractHash,
          realizationPlanHash:
            input.testReceipt.authority.semanticRealizationPlan.planHash,
          fileTreeManifestHash:
            input.testReceipt.authority.fileTree.manifestHash,
          logicalBuildHash:
            input.testReceipt.authority.buildTopology.logicalBuildHash,
          runtimeSourceLogicalReceiptHash:
            input.testReceipt.authority.runtimeSource.logicalReceiptHash,
        },
        actionTestMembershipHash:
          input.testReceipt.coverage.actionTestMembershipHash,
        generatedCoverageMembershipHash:
          input.testReceipt.coverage.generatedCoverageMembershipHash,
        assertionMembershipHash: input.testReceipt.coverage.behavior
          .assertionMembershipHash,
        entityFieldMembershipHash: input.testReceipt.coverage.behavior
          .entityFieldMembershipHash,
      },
    },
    storyCount: stories.length,
    stories,
    storyMembershipHash: hashStoryMembershipV3(stories),
    productScope,
    coverage: {
      storyScopedRealizationCount,
      productScopedRealizationCount: productScopeRealizations.length,
      runtimeMemberCount,
      testCoverageMemberCount,
      actionTestCount,
      runtimeAssertionCount,
      testAssertionCount,
      runtimeEntityFieldCount,
      testEntityFieldCount,
      physicalSharedGrantCount: 0 as const,
      disposition:
        "every_semantic_realization_and_generated_source_member_owned_exactly_once" as const,
    },
  };
  return StoryPlanV3Schema.parse({
    ...identity,
    planHash: hashStoryPlanV3(identity),
  });
}

async function compileInternalV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<StoryPlanCompilationResultV3> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      INPUT_MAX_CANONICAL_BYTES_V3,
      INPUT_BOUNDED_WORK_LIMITS_V3,
    );
  } catch (error) {
    return rejected("STORY_PLAN_V3_INPUT_INVALID", "/", errorMessage(error));
  }
  const parsed = CompilerInputV3Schema.safeParse(snapshot);
  if (!parsed.success) {
    return rejected(
      "STORY_PLAN_V3_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "StoryPlanV3 input is invalid",
    );
  }
  const productSpec = ProductSpecV2Schema.safeParse(parsed.data.productSpec);
  const realizationPlan = SemanticRealizationPlanV2Schema.safeParse(
    parsed.data.realizationPlan,
  );
  const fileTree = FileTreeManifestV3Schema.safeParse(parsed.data.fileTree);
  const buildTopology = BuildTopologyV3Schema.safeParse(
    parsed.data.buildTopology,
  );
  const runtimeReceipt = NodeProductRuntimeSourceReceiptV2Schema.safeParse(
    parsed.data.runtimeSourceReceipt,
  );
  const testReceipt = NodeProductTestSourceReceiptV2Schema.safeParse(
    parsed.data.testSourceReceipt,
  );
  const invalid = [
    ["productSpec", productSpec],
    ["realizationPlan", realizationPlan],
    ["fileTree", fileTree],
    ["buildTopology", buildTopology],
    ["runtimeSourceReceipt", runtimeReceipt],
    ["testSourceReceipt", testReceipt],
  ].find((entry) => !(entry[1] as { success: boolean }).success);
  if (invalid) {
    return rejected(
      "STORY_PLAN_V3_UPSTREAM_AUTHORITY_REJECTED",
      `/${invalid[0] as string}`,
      `${invalid[0] as string} failed its exact upstream schema`,
    );
  }
  if (
    !productSpec.success
    || !realizationPlan.success
    || !fileTree.success
    || !buildTopology.success
    || !runtimeReceipt.success
    || !testReceipt.success
  ) {
    return rejected(
      "STORY_PLAN_V3_UPSTREAM_AUTHORITY_REJECTED",
      "/",
      "StoryPlanV3 upstream authority narrowing failed",
    );
  }
  try {
    verifySemanticRealizationPlanV2({
      productSpec: productSpec.data,
      deliverySelection: parsed.data.deliverySelection,
      runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
      runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
      candidate: realizationPlan.data,
    });
    const verifyRuntime = expectedScope === "production_host"
      ? verifyNodeProductRuntimeSourceV2
      : verifyNodeProductRuntimeSourceV2ForTest;
    const verifiedRuntime = await verifyRuntime(handle, {
      productSpec: productSpec.data,
      deliverySelection: parsed.data.deliverySelection,
      runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
      runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
      realizationPlan: realizationPlan.data,
      fileTree: fileTree.data,
      buildTopology: buildTopology.data,
      candidateSourceText: parsed.data.runtimeSourceText,
      candidateReceipt: runtimeReceipt.data,
    });
    const verifyTest = expectedScope === "production_host"
      ? verifyNodeProductTestSourceV2
      : verifyNodeProductTestSourceV2ForTest;
    const verifiedTest = await verifyTest(handle, {
      productSpec: productSpec.data,
      deliverySelection: parsed.data.deliverySelection,
      runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
      runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
      realizationPlan: realizationPlan.data,
      fileTree: fileTree.data,
      buildTopology: buildTopology.data,
      runtimeSourceText: verifiedRuntime.sourceText,
      runtimeSourceReceipt: verifiedRuntime.receipt,
      candidateSourceText: parsed.data.testSourceText,
      candidateReceipt: testReceipt.data,
    });
    const definitions = produceStoryDefinitionsV3({
      productSpec: productSpec.data,
      designGraph: null,
      runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
      runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
    });
    if (definitions.status === "rejected") {
      return rejected(
        "STORY_PLAN_V3_PARTITION_REJECTED",
        "/productSpec",
        definitions.diagnostics[0]?.message
          ?? "Fresh StoryPlanV3 semantic partition was rejected",
      );
    }
    let value: Readonly<StoryPlanV3>;
    try {
      value = recursivelyFreezeStoryPlanV3(buildStoryPlanV3({
        productSpec: productSpec.data,
        realizationPlan: realizationPlan.data,
        fileTree: fileTree.data,
        buildTopology: buildTopology.data,
        runtimeReceipt: verifiedRuntime.receipt,
        testReceipt: verifiedTest.receipt,
        stories: definitions.stories,
      }));
    } catch (error) {
      return rejected(
        "STORY_PLAN_V3_ARTIFACT_INVALID",
        "/",
        errorMessage(error),
      );
    }
    let canonicalBytes: Buffer;
    try {
      canonicalBytes = canonicalJsonBytesBounded(value, {
        maxBytes: STORY_PLAN_V3_MAX_CANONICAL_BYTES,
        ...STORY_PLAN_V3_BOUNDED_WORK_LIMITS,
      });
    } catch (error) {
      return rejected(
        "STORY_PLAN_V3_OUTPUT_LIMIT_EXCEEDED",
        "/",
        errorMessage(error),
      );
    }
    return recursivelyFreezeStoryPlanV3({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      value,
      canonicalBytes: canonicalBytes.toString("utf8"),
    });
  } catch (error) {
    return rejected(
      "STORY_PLAN_V3_SOURCE_AUTHORITY_REJECTED",
      "/",
      errorMessage(error),
    );
  }
}

export function compileStoryPlanV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<StoryPlanCompilationResultV3> {
  return compileInternalV3(handle, input, "production_host");
}

export function compileStoryPlanV3ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<StoryPlanCompilationResultV3> {
  return compileInternalV3(handle, input, "test_fixture");
}

export type StoryPlanVerificationErrorCodeV3 =
  | "STORY_PLAN_V3_VERIFICATION_AUTHORITY_MISMATCH"
  | "STORY_PLAN_V3_VERIFICATION_CANDIDATE_INVALID"
  | "STORY_PLAN_V3_VERIFICATION_INPUT_INVALID"
  | "STORY_PLAN_V3_VERIFICATION_REPRODUCTION_REJECTED";

export class StoryPlanVerificationErrorV3 extends Error {
  readonly code: StoryPlanVerificationErrorCodeV3;

  constructor(code: StoryPlanVerificationErrorCodeV3, message: string) {
    super(message.slice(0, 1_500));
    this.name = "StoryPlanVerificationErrorV3";
    this.code = code;
  }
}

export type VerifiedShadowStoryPlanV3 = Readonly<{
  status: "verified_shadow";
  value: Readonly<StoryPlanV3>;
  canonicalBytes: string;
}>;

async function verifyInternalV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowStoryPlanV3> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3,
      VERIFIER_BOUNDED_WORK_LIMITS_V3,
    );
  } catch (error) {
    throw new StoryPlanVerificationErrorV3(
      "STORY_PLAN_V3_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV3Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new StoryPlanVerificationErrorV3(
      "STORY_PLAN_V3_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "StoryPlanV3 verifier input is invalid",
    );
  }
  const candidate = StoryPlanV3Schema.safeParse(parsed.data.candidate);
  if (!candidate.success) {
    throw new StoryPlanVerificationErrorV3(
      "STORY_PLAN_V3_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "StoryPlanV3 candidate is invalid",
    );
  }
  const reproduced = await compileInternalV3(handle, {
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
    ...(parsed.data.designGraph === null ? { designGraph: null } : {}),
    runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
    runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
    realizationPlan: parsed.data.realizationPlan,
    fileTree: parsed.data.fileTree,
    buildTopology: parsed.data.buildTopology,
    runtimeSourceText: parsed.data.runtimeSourceText,
    runtimeSourceReceipt: parsed.data.runtimeSourceReceipt,
    testSourceText: parsed.data.testSourceText,
    testSourceReceipt: parsed.data.testSourceReceipt,
  }, expectedScope);
  if (reproduced.status !== "shadow_compiled") {
    throw new StoryPlanVerificationErrorV3(
      "STORY_PLAN_V3_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message
        ?? "Fresh StoryPlanV3 reproduction was rejected",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== reproduced.canonicalBytes) {
    throw new StoryPlanVerificationErrorV3(
      "STORY_PLAN_V3_VERIFICATION_AUTHORITY_MISMATCH",
      "StoryPlanV3 candidate differs from fresh semantic, source-receipt and topology authority",
    );
  }
  return recursivelyFreezeStoryPlanV3({
    status: "verified_shadow" as const,
    value: reproduced.value,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

export function verifyStoryPlanV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowStoryPlanV3> {
  return verifyInternalV3(handle, input, "production_host");
}

export function verifyStoryPlanV3ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowStoryPlanV3> {
  return verifyInternalV3(handle, input, "test_fixture");
}
