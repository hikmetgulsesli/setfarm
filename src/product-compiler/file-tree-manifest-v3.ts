import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import {
  resolveNodeExecutionLayoutV2,
} from "./node-execution-layout-catalog-v2.js";
import {
  compileNodeExecutionPathTokenSetV2,
} from "./path-token-v2.js";
import {
  NodeScaffoldPrivateMaterializerErrorV2,
  inspectBuildDependencyMaterializationReceiptV2,
  inspectScaffoldBaseMaterializationReceiptV2,
  isProductionNodeScaffoldPrivateStageV2,
  revalidateNodeScaffoldDependenciesV2,
  revalidateNodeScaffoldPrivateStageV2,
  type MaterializedNodeScaffoldPrivateStageV2,
} from "./node-scaffold-private-materializer-v2.js";
import {
  getCodeOwnedNodeScaffoldToolchainCatalogV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import {
  compileSemanticRealizationPlanV2,
} from "./semantic-realization-plan-v2.js";
import {
  FILE_TREE_MANIFEST_BLOCKER_CODES_V3,
  FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V3,
  FILE_TREE_MANIFEST_CONTRACT_HASH_V3,
  FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V3,
  FILE_TREE_MANIFEST_V3_SCHEMA,
  FILE_TREE_MANIFEST_VERSION_V3,
  FileTreeManifestV3Schema,
  FileTreePathEntryV3Schema,
  deriveFileTreePathRefV3,
  hashFileTreeManifestV3,
  hashFileTreeOwnerMembershipV3,
  hashFileTreePathAbsenceV3,
  hashFileTreePathEntryV3,
  hashFileTreePathMembershipV3,
  hashFileTreeRuntimeBindingMembershipV3,
  hashFileTreeTestCoverageMembershipV3,
  recursivelyFreezeFileTreeManifestV3,
  type FileTreeManifestHashPayloadV3,
  type FileTreeManifestV3,
  type FileTreeOwnerV3,
  type FileTreePathEntryHashPayloadV3,
  type FileTreePathEntryV3,
  type FileTreeRuntimeRealizationBindingV3,
  type FileTreeTestCoverageBindingV3,
} from "./schemas/file-tree-manifest-v3.js";
import type {
  ScaffoldBaseMaterializationReceiptV2,
} from "./schemas/node-scaffold-private-materialization-v2.js";
import type {
  NodeExecutionLayoutV2,
} from "./schemas/node-execution-layout-catalog-v2.js";
import {
  hashPortablePathCaseFoldIdentityV2,
  hashPortablePathIdentityV2,
  type NodeExecutionPathTokenSetV2,
} from "./schemas/path-token-v2.js";
import type {
  NodeScaffoldToolchainCatalogV2,
  NodeScaffoldToolchainEntryV2,
} from "./schemas/node-scaffold-toolchain-catalog-v2.js";
import {
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
  SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2,
  hashNodeProductRuntimeGeneratorProfileV2,
  hashNodeProductTestGeneratorProfileV2,
  type NodeProductRuntimeGeneratorProfileV2,
  type NodeProductTestGeneratorProfileV2,
  type SemanticRealizationPlanV2,
} from "./schemas/semantic-realization-plan-v2.js";

const INPUT_MAX_CANONICAL_BYTES_V3 = 10 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3 = 14 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V3 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 16,
  maxNodes: INPUT_MAX_CANONICAL_BYTES_V3 + 65_536,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits: (INPUT_MAX_CANONICAL_BYTES_V3 * 8) + (2 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V3 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V3,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3 + 65_536,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3 * 8) + (2 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV3Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  runtimeBehaviorProposal: z.unknown(),
  runtimeBehaviorContract: z.unknown(),
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

export type FileTreeManifestDiagnosticCodeV3 =
  | "FILE_TREE_V3_ARTIFACT_INVALID"
  | "FILE_TREE_V3_CODE_AUTHORITY_DRIFT"
  | "FILE_TREE_V3_INPUT_INVALID"
  | "FILE_TREE_V3_OUTPUT_LIMIT_EXCEEDED"
  | "FILE_TREE_V3_PRIVATE_STAGE_INVALID"
  | "FILE_TREE_V3_PRODUCTION_AUTHORITY_REQUIRED"
  | "FILE_TREE_V3_TEST_AUTHORITY_REQUIRED"
  | "FILE_TREE_V3_UPSTREAM_AUTHORITY_REJECTED";

export type FileTreeManifestDiagnosticV3 = Readonly<{
  code: FileTreeManifestDiagnosticCodeV3;
  path: string;
  message: string;
}>;

export type FileTreeManifestCompilationResultV3 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      value: Readonly<FileTreeManifestV3>;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly FileTreeManifestDiagnosticV3[];
    }>;

function rejected(
  code: FileTreeManifestDiagnosticCodeV3,
  path: string,
  message: string,
): FileTreeManifestCompilationResultV3 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

class FileTreeCodeAuthorityErrorV3 extends Error {
  constructor(message: string) {
    super(message.slice(0, 1_500));
    this.name = "FileTreeCodeAuthorityErrorV3";
  }
}

class FileTreeUpstreamAuthorityErrorV3 extends Error {
  constructor(message: string) {
    super(message.slice(0, 1_500));
    this.name = "FileTreeUpstreamAuthorityErrorV3";
  }
}

function authorityFailure(message: string): never {
  throw new FileTreeCodeAuthorityErrorV3(message);
}

function upstreamFailure(message: string): never {
  throw new FileTreeUpstreamAuthorityErrorV3(message);
}

type FreshAuthorityV3 = Readonly<{
  layout: Readonly<NodeExecutionLayoutV2>;
  nodePathSet: Readonly<NodeExecutionPathTokenSetV2>;
  realizationPlan: Readonly<SemanticRealizationPlanV2>;
  scaffoldCatalog: Readonly<NodeScaffoldToolchainCatalogV2>;
  scaffoldEntry: Readonly<NodeScaffoldToolchainEntryV2>;
  runtimeGeneratorProfile: Readonly<NodeProductRuntimeGeneratorProfileV2>;
  testGeneratorProfile: Readonly<NodeProductTestGeneratorProfileV2>;
}>;

function reproduceFreshAuthorityV3(input: Readonly<{
  productSpec: unknown;
  deliverySelection: unknown;
  runtimeBehaviorProposal: unknown;
  runtimeBehaviorContract: unknown;
}>): FreshAuthorityV3 {
  const productAuthority = {
    productSpec: input.productSpec,
    deliverySelection: input.deliverySelection,
  };
  const layout = resolveNodeExecutionLayoutV2(productAuthority);
  if (layout.status !== "shadow_resolved") {
    upstreamFailure(layout.diagnostics[0]?.message ?? "Node layout was rejected");
  }
  const nodePaths = compileNodeExecutionPathTokenSetV2(productAuthority);
  if (nodePaths.status !== "shadow_compiled") {
    upstreamFailure(
      nodePaths.diagnostics[0]?.message ?? "Node path tokens were rejected",
    );
  }
  const realization = compileSemanticRealizationPlanV2(input);
  if (realization.status !== "shadow_compiled") {
    upstreamFailure(
      realization.diagnostics[0]?.message
        ?? "Semantic realization planning was rejected",
    );
  }
  const plan = realization.value;
  const catalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
  const entry = catalog.entries.find((candidate) =>
    candidate.profileBinding.profileId === plan.authority.profileId);
  const runtimeGeneratorProfile =
    NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find((candidate) =>
      candidate.profileId === plan.authority.profileId
      && candidate.stackPackId === plan.authority.stackPackId);
  const testGeneratorProfile =
    NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find((candidate) =>
      candidate.profileId === plan.authority.profileId
      && candidate.stackPackId === plan.authority.stackPackId);
  if (
    !entry
    || !runtimeGeneratorProfile
    || !testGeneratorProfile
    || layout.layout.profileBinding.profileId !== plan.authority.profileId
    || layout.layout.profileBinding.profileHash !== plan.authority.deliveryProfileHash
    || layout.layout.stackPackBinding.stackPackId !== plan.authority.stackPackId
    || layout.layout.stackPackBinding.stackPackVersion
      !== plan.authority.stackPackVersion
    || layout.layout.stackPackBinding.stackPackContentHash
      !== plan.authority.stackPackContentHash
    || entry.profileBinding.profileId !== plan.authority.profileId
    || entry.profileBinding.profileHash !== plan.authority.deliveryProfileHash
    || entry.profileBinding.stackPackId !== plan.authority.stackPackId
    || entry.profileBinding.stackPackVersion !== plan.authority.stackPackVersion
    || entry.profileBinding.stackPackContentHash
      !== plan.authority.stackPackContentHash
    || entry.layoutBinding.layoutHash !== layout.layout.layoutHash
    || entry.layoutBinding.pathSlotSetHash !== layout.layout.pathSlots.slotSetHash
    || nodePaths.value.sourceAuthority.slotSetHash
      !== layout.layout.pathSlots.slotSetHash
    || runtimeGeneratorProfile.sourcePathSlotRef
      !== layout.layout.pathSlots.sourceEntrypoint.slotRef
    || runtimeGeneratorProfile.sourcePathSlotRef
      !== plan.authority.generatorProfile.sourcePathSlotRef
    || hashNodeProductRuntimeGeneratorProfileV2(runtimeGeneratorProfile)
      !== plan.authority.generatorProfile.generatorProfileHash
    || testGeneratorProfile.sourcePathRef
      !== plan.authority.testGeneratorProfile.sourcePathRef
    || testGeneratorProfile.compiledPathRef
      !== plan.authority.testGeneratorProfile.compiledPathRef
    || hashNodeProductTestGeneratorProfileV2(testGeneratorProfile)
      !== plan.authority.testGeneratorProfile.generatorProfileHash
  ) {
    authorityFailure(
      "Fresh realization, layout, scaffold and generator profiles diverged",
    );
  }
  return Object.freeze({
    layout: layout.layout,
    nodePathSet: nodePaths.value,
    realizationPlan: plan,
    scaffoldCatalog: catalog,
    scaffoldEntry: entry,
    runtimeGeneratorProfile,
    testGeneratorProfile,
  });
}

function assertBaseReceiptJoinsV3(
  fresh: FreshAuthorityV3,
  base: Readonly<ScaffoldBaseMaterializationReceiptV2>,
  admissionScope: "production_host" | "test_fixture",
): void {
  const entry = fresh.scaffoldEntry;
  if (
    base.admissionScope !== admissionScope
    || base.catalogBinding.catalogHash !== fresh.scaffoldCatalog.catalogHash
    || base.catalogBinding.entryRef !== entry.entryRef
    || base.catalogBinding.entryHash !== entry.entryHash
    || base.catalogBinding.profileId !== entry.profileBinding.profileId
    || base.catalogBinding.dependencyGraphHash !== entry.dependencyGraph.graphHash
    || base.baseState.projectNpmrc.state !== "absent"
    || base.baseState.dependencyInstallation.state !== "absent"
    || base.baseState.sourceEntrypoint.sourceDirectoryState !== "absent"
    || base.baseState.sourceEntrypoint.state !== "absent"
    || base.baseState.fileCount !== 3
  ) {
    authorityFailure(
      "Authenticated F4 base receipt does not join V3 scaffold byte authority",
    );
  }
  for (const file of entry.scaffold.files) {
    const asset = base.assets.find((candidate) => candidate.role === file.role);
    if (
      !asset
      || asset.normalizedLocator !== file.normalizedLocator
      || asset.rawHash !== file.rawHash
      || asset.rawByteLength !== file.rawByteLength
    ) {
      authorityFailure(`F4 scaffold asset ${file.role} diverged from code bytes`);
    }
  }
}

function absentStateV3(
  normalizedLocator: string,
  evidence:
    | "private_scaffold_base_exact_inventory_v2"
    | "private_scaffold_base_source_root_absence_v2",
) {
  return {
    state: "absent" as const,
    absenceHash: hashFileTreePathAbsenceV3("repository", normalizedLocator),
    evidence,
  };
}

function pathEntryV3(
  normalizedLocator: string,
  input: Omit<FileTreePathEntryHashPayloadV3,
  "pathRef" | "physicalSpace" | "normalizedLocator" | "pathIdentityHash"
  | "caseFoldPathIdentityHash">,
): FileTreePathEntryV3 {
  const identity: FileTreePathEntryHashPayloadV3 = {
    pathRef: deriveFileTreePathRefV3("repository", normalizedLocator),
    physicalSpace: "repository",
    normalizedLocator,
    pathIdentityHash: hashPortablePathIdentityV2("repository", normalizedLocator),
    caseFoldPathIdentityHash:
      hashPortablePathCaseFoldIdentityV2("repository", normalizedLocator),
    ...input,
  };
  return FileTreePathEntryV3Schema.parse({
    ...identity,
    entryHash: hashFileTreePathEntryV3(identity),
  });
}

function buildConfigEntriesV3(
  fresh: FreshAuthorityV3,
  base: Readonly<ScaffoldBaseMaterializationReceiptV2>,
): FileTreePathEntryV3[] {
  return fresh.scaffoldEntry.scaffold.files.map((file) => {
    const asset = base.assets.find((candidate) => candidate.role === file.role);
    if (!asset) authorityFailure(`Missing authenticated scaffold asset ${file.role}`);
    const tokens = fresh.nodePathSet.tokens.filter((candidate) =>
      candidate.origin.slotRef === file.pathSlotRef);
    const token = tokens[0];
    if (
      tokens.length !== 1
      || !token
      || token.normalizedLocator !== file.normalizedLocator
      || token.disposition !== "planned"
    ) {
      authorityFailure(`Scaffold path ${file.role} lacks exact Node path authority`);
    }
    return pathEntryV3(file.normalizedLocator, {
      classification: "config",
      ownerRef: "OWNER_SETUP_V3",
      writeGrantOwnerRefs: [],
      access: "setup_readonly",
      currentState: {
        state: "present_file",
        mode: "0444",
        contentHash: asset.rawHash,
        byteLength: asset.rawByteLength,
      },
      authority: {
        kind: "scaffold_asset",
        scaffoldBaseSemanticInputHash: base.semanticInputHash,
        scaffoldBaseStateHash: base.baseStateHash,
        assetRole: file.role,
        pathSlotRef: file.pathSlotRef,
        pathToken: token.pathToken,
        tokenBindingHash: token.bindingHash,
        deepVerificationReceiptHash: asset.verificationReceiptHash,
        consumerBindingHash: asset.consumerBindingHash,
        compatibilityDisposition: "f4_scaffold_bytes_only",
      },
    });
  });
}

function runtimeBindingsV3(
  plan: Readonly<SemanticRealizationPlanV2>,
): FileTreeRuntimeRealizationBindingV3[] {
  const bindings = plan.realizations.flatMap((realization) =>
    realization.target.kind === "node_product_runtime_generator_member"
      ? [{
          realizationRef: realization.realizationRef,
          realizationHash: realization.realizationHash,
          intentRef: realization.sourceIntent.intentRef,
          intentHash: realization.sourceIntent.intentHash,
          subjectKind: realization.sourceIntent.subjectKind,
          subjectRef: realization.sourceIntent.subjectRef,
          subjectHash: realization.sourceIntent.subjectHash,
          responsibility: realization.sourceIntent.responsibility,
          storyId: realization.sourceIntent.storyId,
          memberKind: realization.target.memberKind,
        }]
      : []);
  return bindings.sort((left, right) =>
    compareUtf16(left.realizationRef, right.realizationRef));
}

function testCoverageBindingsV3(
  plan: Readonly<SemanticRealizationPlanV2>,
): FileTreeTestCoverageBindingV3[] {
  const actionBindings = plan.realizations.flatMap((realization) =>
    realization.sourceIntent.subjectKind === "action"
      && realization.sourceIntent.responsibility === "action_handler"
      && realization.target.kind === "node_product_runtime_generator_member"
      ? [{
          coverageKind: "action" as const,
          realizationRef: realization.realizationRef,
          realizationHash: realization.realizationHash,
          intentRef: realization.sourceIntent.intentRef,
          intentHash: realization.sourceIntent.intentHash,
          subjectKind: "action" as const,
          subjectRef: realization.sourceIntent.subjectRef,
          subjectHash: realization.sourceIntent.subjectHash,
          storyId: realization.sourceIntent.storyId,
        }]
      : []);
  const evidenceBindings = plan.realizations.flatMap((realization) =>
    realization.target.kind === "evidence_relation"
      ? [{
          coverageKind: "evidence_relation" as const,
          realizationRef: realization.realizationRef,
          realizationHash: realization.realizationHash,
          intentRef: realization.sourceIntent.intentRef,
          intentHash: realization.sourceIntent.intentHash,
          subjectKind: "evidence_predicate" as const,
          subjectRef: realization.sourceIntent.subjectRef,
          subjectHash: realization.sourceIntent.subjectHash,
          storyId: realization.sourceIntent.storyId,
        }]
      : []);
  const actionRefs = actionBindings.map((binding) => binding.subjectRef);
  if (
    actionBindings.length < 1
    || new Set(actionRefs).size !== actionRefs.length
    || evidenceBindings.length !== plan.coverage.evidenceRelationCount
  ) {
    authorityFailure(
      "Generated test coverage does not equal every action and evidence relation",
    );
  }
  return [...actionBindings, ...evidenceBindings].sort((left, right) =>
    compareUtf16(
      `${left.coverageKind}\0${left.subjectRef}\0${left.realizationRef}`,
      `${right.coverageKind}\0${right.subjectRef}\0${right.realizationRef}`,
    ));
}

function buildManifestV3(
  fresh: FreshAuthorityV3,
  base: Readonly<ScaffoldBaseMaterializationReceiptV2>,
): FileTreeManifestV3 {
  assertBaseReceiptJoinsV3(fresh, base, base.admissionScope);
  const plan = fresh.realizationPlan;
  const runtimeBindings = runtimeBindingsV3(plan);
  const testCoverageBindings = testCoverageBindingsV3(plan);
  if (
    runtimeBindings.length !== plan.coverage.generatorMemberCount
    || testCoverageBindings.length < 1
  ) {
    authorityFailure("Realization coverage cannot be projected to V3 source targets");
  }
  const runtimePath = fresh.layout.pathSlots.sourceEntrypoint.locator;
  const testProfile = fresh.testGeneratorProfile;
  const runtimePathEntry = pathEntryV3(runtimePath, {
    classification: "generated_runtime_source",
    ownerRef: "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2",
    writeGrantOwnerRefs: [],
    access: "generator_whole_file_future",
    currentState: absentStateV3(
      runtimePath,
      "private_scaffold_base_source_root_absence_v2",
    ),
    authority: {
      kind: "generated_runtime_source_target",
      realizationPlanHash: plan.planHash,
      realizationMembershipHash: plan.realizationMembershipHash,
      generatorRef: "NODE_PRODUCT_RUNTIME_GENERATOR_V2",
      generatorContractHash: NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
      generatorProfileHash: plan.authority.generatorProfile.generatorProfileHash,
      sourcePathSlotRef: fresh.runtimeGeneratorProfile.sourcePathSlotRef,
      sourceReceiptSchema: NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
      sourceReceiptState: "absent",
      modelWriteAuthority: "forbidden",
      realizationBindingCount: runtimeBindings.length,
      realizationBindings: runtimeBindings,
      realizationBindingMembershipHash:
        hashFileTreeRuntimeBindingMembershipV3(runtimeBindings),
    },
  });
  const testPathEntry = pathEntryV3(testProfile.sourceNormalizedLocator, {
    classification: "generated_test_source",
    ownerRef: "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2",
    writeGrantOwnerRefs: [],
    access: "generator_whole_file_future",
    currentState: absentStateV3(
      testProfile.sourceNormalizedLocator,
      "private_scaffold_base_source_root_absence_v2",
    ),
    authority: {
      kind: "generated_test_source_target",
      realizationPlanHash: plan.planHash,
      realizationMembershipHash: plan.realizationMembershipHash,
      generatorRef: "NODE_PRODUCT_TEST_GENERATOR_V2",
      generatorContractHash: NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
      generatorProfileHash: plan.authority.testGeneratorProfile.generatorProfileHash,
      sourcePathRef: testProfile.sourcePathRef,
      compiledPathRef: testProfile.compiledPathRef,
      runtimeImportSpecifier: testProfile.runtimeImportSpecifier,
      runnerAbi: testProfile.execution.runnerAbi,
      sourceReceiptSchema: NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
      sourceReceiptState: "absent",
      modelWriteAuthority: "forbidden",
      coverageBindingCount: testCoverageBindings.length,
      coverageBindings: testCoverageBindings,
      coverageMembershipHash:
        hashFileTreeTestCoverageMembershipV3(testCoverageBindings),
    },
  });
  const npmrc = pathEntryV3(".npmrc", {
    classification: "config_absence",
    ownerRef: "OWNER_SETUP_V3",
    writeGrantOwnerRefs: [],
    access: "forbidden",
    currentState: absentStateV3(
      ".npmrc",
      "private_scaffold_base_exact_inventory_v2",
    ),
    authority: {
      kind: "project_npmrc_absence",
      scaffoldBaseSemanticInputHash: base.semanticInputHash,
      scaffoldBaseStateHash: base.baseStateHash,
    },
  });
  const paths = [
    ...buildConfigEntriesV3(fresh, base),
    npmrc,
    runtimePathEntry,
    testPathEntry,
  ].sort((left, right) =>
    compareUtf16(
      `${left.physicalSpace}\0${left.normalizedLocator}`,
      `${right.physicalSpace}\0${right.normalizedLocator}`,
    ));
  const owners: FileTreeOwnerV3[] = [
    {
      ownerRef: "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2",
      kind: "generator",
      generatorRef: "NODE_PRODUCT_RUNTIME_GENERATOR_V2",
    },
    {
      ownerRef: "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2",
      kind: "generator",
      generatorRef: "NODE_PRODUCT_TEST_GENERATOR_V2",
    },
    { ownerRef: "OWNER_SETUP_V3", kind: "setup" },
  ];
  const actionCount = testCoverageBindings.filter((binding) =>
    binding.coverageKind === "action").length;
  const evidenceRelationCount = testCoverageBindings.filter((binding) =>
    binding.coverageKind === "evidence_relation").length;
  const identity: FileTreeManifestHashPayloadV3 = {
    schema: FILE_TREE_MANIFEST_V3_SCHEMA,
    manifestVersion: FILE_TREE_MANIFEST_VERSION_V3,
    contractHash: FILE_TREE_MANIFEST_CONTRACT_HASH_V3,
    stage: "realization_targets_planned_on_verified_scaffold_base",
    readiness: {
      status: "shadow_blocked",
      productionUse: "forbidden",
      blockerCodes: [...FILE_TREE_MANIFEST_BLOCKER_CODES_V3],
    },
    authority: {
      productRef: plan.authority.productRef,
      productSpecHash: plan.authority.productSpecHash,
      deliverySelectionHash: plan.authority.deliverySelectionHash,
      profileId: plan.authority.profileId,
      deliveryProfileHash: plan.authority.deliveryProfileHash,
      stackPackId: plan.authority.stackPackId,
      stackPackVersion: plan.authority.stackPackVersion,
      stackPackContentHash: plan.authority.stackPackContentHash,
      semanticRealizationPlan: {
        schema: plan.schema,
        contractHash: SEMANTIC_REALIZATION_PLAN_CONTRACT_HASH_V2,
        planHash: plan.planHash,
        realizationMembershipHash: plan.realizationMembershipHash,
        realizationCount: plan.realizationCount,
        generatorMemberCount: plan.coverage.generatorMemberCount,
        evidenceRelationCount: plan.coverage.evidenceRelationCount,
        modelWriteGrantCount: 0,
        runtimeBehaviorProposalHash:
          plan.authority.runtimeBehavior.proposalHash,
        runtimeBehaviorContractHash:
          plan.authority.runtimeBehavior.contractHash,
      },
      runtimeGeneratorContractHash:
        NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
      testGeneratorContractHash: NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
      nodeExecutionLayout: {
        layoutRef: fresh.layout.layoutRef,
        layoutHash: fresh.layout.layoutHash,
        pathSlotSetHash: fresh.layout.pathSlots.slotSetHash,
        pathTokenSetHash: fresh.nodePathSet.tokenSetHash,
      },
      scaffoldCompatibilityEvidence: {
        catalogSchema: fresh.scaffoldCatalog.schema,
        catalogHash: fresh.scaffoldCatalog.catalogHash,
        entryRef: fresh.scaffoldEntry.entryRef,
        entryHash: fresh.scaffoldEntry.entryHash,
        scaffoldBaseSemanticInputHash: base.semanticInputHash,
        scaffoldBaseStateHash: base.baseStateHash,
        disposition: "authenticated_config_bytes_not_semantic_topology",
      },
      projectInventory: {
        memberNames: [
          "package-lock.json",
          "package.json",
          "tsconfig.json",
        ],
        npmrcState: "absent",
        nodeModulesState: "absent",
        sourceDirectoryState: "absent",
        evidenceAuthority: "authenticated_private_base_fresh_revalidation_v2",
      },
    },
    coverage: {
      runtimeRealizationCount: runtimeBindings.length,
      runtimeRealizationMembershipHash:
        hashFileTreeRuntimeBindingMembershipV3(runtimeBindings),
      actionCount,
      evidenceRelationCount,
      testCoverageCount: testCoverageBindings.length,
      testCoverageMembershipHash:
        hashFileTreeTestCoverageMembershipV3(testCoverageBindings),
      modelWriteGrantCount: 0,
      storyOwnerCount: 0,
      disposition:
        "every_generated_runtime_member_and_test_obligation_has_one_physical_target",
    },
    ownerCount: 3,
    owners,
    ownerMembershipHash: hashFileTreeOwnerMembershipV3(owners),
    pathCount: 6,
    paths,
    pathMembershipHash: hashFileTreePathMembershipV3(paths),
  };
  return FileTreeManifestV3Schema.parse({
    ...identity,
    manifestHash: hashFileTreeManifestV3(identity),
  });
}

async function compileInternalV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<FileTreeManifestCompilationResultV3> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      INPUT_MAX_CANONICAL_BYTES_V3,
      INPUT_BOUNDED_WORK_LIMITS_V3,
    );
  } catch (error) {
    return rejected("FILE_TREE_V3_INPUT_INVALID", "/", errorMessage(error));
  }
  const parsed = CompilerInputV3Schema.safeParse(snapshot);
  if (!parsed.success) {
    return rejected(
      "FILE_TREE_V3_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "V3 FileTree input is invalid",
    );
  }
  let production: boolean;
  try {
    production = isProductionNodeScaffoldPrivateStageV2(handle);
  } catch (error) {
    return rejected(
      "FILE_TREE_V3_PRIVATE_STAGE_INVALID",
      "/stage",
      errorMessage(error),
    );
  }
  if (expectedScope === "production_host" && !production) {
    return rejected(
      "FILE_TREE_V3_PRODUCTION_AUTHORITY_REQUIRED",
      "/stage",
      "Production V3 FileTree requires an authenticated production_host F4 stage",
    );
  }
  if (expectedScope === "test_fixture" && production) {
    return rejected(
      "FILE_TREE_V3_TEST_AUTHORITY_REQUIRED",
      "/stage",
      "Test V3 FileTree cannot consume or downgrade production authority",
    );
  }
  try {
    const base = await revalidateNodeScaffoldPrivateStageV2(handle);
    const inspectedBase = inspectScaffoldBaseMaterializationReceiptV2(handle);
    if (
      base.receiptHash !== inspectedBase.receiptHash
      || base.admissionScope !== expectedScope
    ) {
      authorityFailure("Authenticated F4 scope changed during V3 compilation");
    }
    const fresh = reproduceFreshAuthorityV3(parsed.data);
    assertBaseReceiptJoinsV3(fresh, base, expectedScope);
    const value = recursivelyFreezeFileTreeManifestV3(buildManifestV3(fresh, base));
    let canonicalBytes: Buffer;
    try {
      canonicalBytes = canonicalJsonBytesBounded(value, {
        maxBytes: FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V3,
        ...FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V3,
      });
    } catch (error) {
      return rejected(
        "FILE_TREE_V3_OUTPUT_LIMIT_EXCEEDED",
        "/",
        errorMessage(error),
      );
    }
    return recursivelyFreezeFileTreeManifestV3({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      value,
      canonicalBytes: canonicalBytes.toString("utf8"),
    });
  } catch (error) {
    return rejected(
      error instanceof FileTreeUpstreamAuthorityErrorV3
        ? "FILE_TREE_V3_UPSTREAM_AUTHORITY_REJECTED"
        : error instanceof FileTreeCodeAuthorityErrorV3
          ? "FILE_TREE_V3_CODE_AUTHORITY_DRIFT"
          : error instanceof NodeScaffoldPrivateMaterializerErrorV2
            ? "FILE_TREE_V3_PRIVATE_STAGE_INVALID"
            : "FILE_TREE_V3_ARTIFACT_INVALID",
      "/",
      errorMessage(error),
    );
  }
}

export function compileFileTreeManifestV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<FileTreeManifestCompilationResultV3> {
  return compileInternalV3(handle, input, "production_host");
}

export function compileFileTreeManifestV3ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<FileTreeManifestCompilationResultV3> {
  return compileInternalV3(handle, input, "test_fixture");
}

export type FileTreeManifestVerificationErrorCodeV3 =
  | "FILE_TREE_V3_VERIFICATION_AUTHORITY_MISMATCH"
  | "FILE_TREE_V3_VERIFICATION_CANDIDATE_INVALID"
  | "FILE_TREE_V3_VERIFICATION_INPUT_INVALID"
  | "FILE_TREE_V3_VERIFICATION_REPRODUCTION_REJECTED";

export class FileTreeManifestVerificationErrorV3 extends Error {
  readonly code: FileTreeManifestVerificationErrorCodeV3;

  constructor(code: FileTreeManifestVerificationErrorCodeV3, message: string) {
    super(message.slice(0, 1_500));
    this.name = "FileTreeManifestVerificationErrorV3";
    this.code = code;
  }
}

export type VerifiedShadowFileTreeManifestV3 = Readonly<{
  status: "verified_shadow";
  value: Readonly<FileTreeManifestV3>;
  canonicalBytes: string;
}>;

async function verifyInternalV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowFileTreeManifestV3> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3,
      VERIFIER_BOUNDED_WORK_LIMITS_V3,
    );
  } catch (error) {
    throw new FileTreeManifestVerificationErrorV3(
      "FILE_TREE_V3_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV3Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new FileTreeManifestVerificationErrorV3(
      "FILE_TREE_V3_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "V3 FileTree verifier input is invalid",
    );
  }
  const candidate = FileTreeManifestV3Schema.safeParse(parsed.data.candidate);
  if (!candidate.success) {
    throw new FileTreeManifestVerificationErrorV3(
      "FILE_TREE_V3_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "V3 FileTree candidate is invalid",
    );
  }
  const reproduced = await compileInternalV3(handle, {
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
    runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
    runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
  }, expectedScope);
  if (reproduced.status !== "shadow_compiled") {
    throw new FileTreeManifestVerificationErrorV3(
      "FILE_TREE_V3_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message
        ?? "Fresh V3 FileTree reproduction was rejected",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== reproduced.canonicalBytes) {
    throw new FileTreeManifestVerificationErrorV3(
      "FILE_TREE_V3_VERIFICATION_AUTHORITY_MISMATCH",
      "V3 FileTree candidate does not equal fresh realization and authenticated F4 authority",
    );
  }
  return recursivelyFreezeFileTreeManifestV3({
    status: "verified_shadow" as const,
    value: reproduced.value,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

async function verifyAtDependencyStageInternalV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowFileTreeManifestV3> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3,
      VERIFIER_BOUNDED_WORK_LIMITS_V3,
    );
  } catch (error) {
    throw new FileTreeManifestVerificationErrorV3(
      "FILE_TREE_V3_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV3Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new FileTreeManifestVerificationErrorV3(
      "FILE_TREE_V3_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "V3 FileTree verifier input is invalid",
    );
  }
  const candidate = FileTreeManifestV3Schema.safeParse(parsed.data.candidate);
  if (!candidate.success) {
    throw new FileTreeManifestVerificationErrorV3(
      "FILE_TREE_V3_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "V3 FileTree candidate is invalid",
    );
  }
  try {
    const production = isProductionNodeScaffoldPrivateStageV2(handle);
    if (
      (expectedScope === "production_host" && !production)
      || (expectedScope === "test_fixture" && production)
    ) {
      throw new FileTreeUpstreamAuthorityErrorV3(
        "Dependency-stage V3 verification cannot promote or downgrade authority",
      );
    }
    const dependency = await revalidateNodeScaffoldDependenciesV2(handle);
    const inspectedDependency = inspectBuildDependencyMaterializationReceiptV2(handle);
    const base = inspectScaffoldBaseMaterializationReceiptV2(handle);
    if (
      dependency.receiptHash !== inspectedDependency.receiptHash
      || dependency.admissionScope !== expectedScope
      || dependency.scaffoldBase.receiptHash !== base.receiptHash
      || dependency.scaffoldBase.semanticInputHash !== base.semanticInputHash
      || dependency.scaffoldBase.startBaseStateHash !== base.baseStateHash
      || dependency.scaffoldBase.endBaseFileMembershipHash
        !== base.baseState.fileMembershipHash
      || dependency.scaffoldBase.projectNpmrcState !== "absent"
    ) {
      throw new FileTreeUpstreamAuthorityErrorV3(
        "Dependency receipt does not preserve the authenticated F4 base",
      );
    }
    const fresh = reproduceFreshAuthorityV3({
      productSpec: parsed.data.productSpec,
      deliverySelection: parsed.data.deliverySelection,
      runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
      runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
    });
    assertBaseReceiptJoinsV3(fresh, base, expectedScope);
    const reproduced = recursivelyFreezeFileTreeManifestV3(
      buildManifestV3(fresh, base),
    );
    const canonicalBytes = canonicalJsonBytesBounded(reproduced, {
      maxBytes: FILE_TREE_MANIFEST_MAX_CANONICAL_BYTES_V3,
      ...FILE_TREE_MANIFEST_BOUNDED_WORK_LIMITS_V3,
    }).toString("utf8");
    if (canonicalJsonStringify(candidate.data) !== canonicalBytes) {
      throw new FileTreeManifestVerificationErrorV3(
        "FILE_TREE_V3_VERIFICATION_AUTHORITY_MISMATCH",
        "V3 FileTree candidate differs from dependency-stage fresh authority",
      );
    }
    return recursivelyFreezeFileTreeManifestV3({
      status: "verified_shadow" as const,
      value: reproduced,
      canonicalBytes,
    });
  } catch (error) {
    if (error instanceof FileTreeManifestVerificationErrorV3) throw error;
    throw new FileTreeManifestVerificationErrorV3(
      "FILE_TREE_V3_VERIFICATION_REPRODUCTION_REJECTED",
      errorMessage(error),
    );
  }
}

export function verifyFileTreeManifestV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowFileTreeManifestV3> {
  return verifyInternalV3(handle, input, "production_host");
}

export function verifyFileTreeManifestV3ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowFileTreeManifestV3> {
  return verifyInternalV3(handle, input, "test_fixture");
}

export function verifyFileTreeManifestV3AtDependencyStage(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowFileTreeManifestV3> {
  return verifyAtDependencyStageInternalV3(handle, input, "production_host");
}

export function verifyFileTreeManifestV3AtDependencyStageForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowFileTreeManifestV3> {
  return verifyAtDependencyStageInternalV3(handle, input, "test_fixture");
}
