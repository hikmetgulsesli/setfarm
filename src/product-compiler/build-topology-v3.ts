import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  FileTreeManifestVerificationErrorV3,
  verifyFileTreeManifestV3AtDependencyStage,
  verifyFileTreeManifestV3AtDependencyStageForTest,
} from "./file-tree-manifest-v3.js";
import {
  resolveNodeExecutionLayoutV2,
} from "./node-execution-layout-catalog-v2.js";
import {
  NodeScaffoldPrivateMaterializerErrorV2,
  inspectBuildDependencyMaterializationReceiptV2,
  inspectScaffoldBaseMaterializationReceiptV2,
  isProductionNodeScaffoldPrivateStageV2,
  revalidateNodeScaffoldDependenciesV2,
  type MaterializedNodeScaffoldPrivateStageV2,
} from "./node-scaffold-private-materializer-v2.js";
import {
  getCodeOwnedNodeScaffoldToolchainCatalogV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import {
  compileNodeExecutionPathTokenSetV2,
} from "./path-token-v2.js";
import {
  BUILD_TOPOLOGY_BLOCKER_CODES_V3,
  BUILD_TOPOLOGY_BOUNDED_WORK_LIMITS_V3,
  BUILD_TOPOLOGY_BUILD_REQUIRED_PRECONDITIONS_V3,
  BUILD_TOPOLOGY_CONTRACT_HASH_V3,
  BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V3,
  BUILD_TOPOLOGY_TEST_REQUIRED_PRECONDITIONS_V3,
  BUILD_TOPOLOGY_V3_SCHEMA,
  BUILD_TOPOLOGY_VERSION_V3,
  BuildTopologyPathEntryV3Schema,
  BuildTopologyV3Schema,
  NODE_PRODUCT_BUILD_RECEIPT_V3_SCHEMA,
  NODE_PRODUCT_TEST_EXECUTION_RECEIPT_V3_SCHEMA,
  deriveBuildTopologyPathRefV3,
  fileTreePathProjectionForBuildTopologyV3,
  hashBuildTopologyCommandContractV3,
  hashBuildTopologyCompilationContractV3,
  hashBuildTopologyLogicalBuildV3,
  hashBuildTopologyLogicalDependencyV3,
  hashBuildTopologyLogicalPathMembershipV3,
  hashBuildTopologyManifestV3,
  hashBuildTopologyPathAbsenceV3,
  hashBuildTopologyPathEntryV3,
  hashBuildTopologyPathMembershipV3,
  hashBuildTopologyRuntimeContractV3,
  recursivelyFreezeBuildTopologyV3,
  type BuildTopologyCommandsV3,
  type BuildTopologyCompilationV3,
  type BuildTopologyLogicalDependencyV3,
  type BuildTopologyLogicalIdentityV3,
  type BuildTopologyManifestHashPayloadV3,
  type BuildTopologyPathEntryHashPayloadV3,
  type BuildTopologyPathEntryV3,
  type BuildTopologyRuntimeTargetV3,
  type BuildTopologyV3,
  type TypeScriptCompilerTargetV3,
} from "./schemas/build-topology-v3.js";
import type {
  FileTreeManifestV3,
} from "./schemas/file-tree-manifest-v3.js";
import type {
  NodeExecutionLayoutV2,
} from "./schemas/node-execution-layout-catalog-v2.js";
import type {
  BuildDependencyMaterializationReceiptV2,
} from "./schemas/node-scaffold-private-materialization-v2.js";
import type {
  NodeScaffoldToolchainCatalogV2,
  NodeScaffoldToolchainEntryV2,
} from "./schemas/node-scaffold-toolchain-catalog-v2.js";
import {
  hashPortablePathCaseFoldIdentityV2,
  hashPortablePathIdentityV2,
  type NodeExecutionPathTokenSetV2,
  type PathTokenV2,
} from "./schemas/path-token-v2.js";
import {
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
  NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2,
  NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
  hashNodeProductRuntimeGeneratorProfileV2,
  hashNodeProductTestGeneratorProfileV2,
  type NodeProductRuntimeGeneratorProfileV2,
  type NodeProductTestGeneratorProfileV2,
} from "./schemas/semantic-realization-plan-v2.js";
import type {
  ScaffoldBaseMaterializationReceiptV2,
} from "./schemas/node-scaffold-private-materialization-v2.js";

const INPUT_MAX_CANONICAL_BYTES_V3 = 14 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3 = 18 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V3 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 20,
  maxNodes: INPUT_MAX_CANONICAL_BYTES_V3 + 90_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits: (INPUT_MAX_CANONICAL_BYTES_V3 * 8) + (4 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V3 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V3,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3 + 90_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3 * 8) + (4 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV3Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  runtimeBehaviorProposal: z.unknown(),
  runtimeBehaviorContract: z.unknown(),
  fileTree: z.unknown(),
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

export type BuildTopologyDiagnosticCodeV3 =
  | "BUILD_TOPOLOGY_V3_ARTIFACT_INVALID"
  | "BUILD_TOPOLOGY_V3_FILE_TREE_REJECTED"
  | "BUILD_TOPOLOGY_V3_INPUT_INVALID"
  | "BUILD_TOPOLOGY_V3_OUTPUT_LIMIT_EXCEEDED"
  | "BUILD_TOPOLOGY_V3_PRIVATE_STAGE_INVALID"
  | "BUILD_TOPOLOGY_V3_PRODUCTION_AUTHORITY_REQUIRED"
  | "BUILD_TOPOLOGY_V3_TEST_AUTHORITY_REQUIRED"
  | "BUILD_TOPOLOGY_V3_UPSTREAM_AUTHORITY_REJECTED";

export type BuildTopologyDiagnosticV3 = Readonly<{
  code: BuildTopologyDiagnosticCodeV3;
  path: string;
  message: string;
}>;

export type BuildTopologyCompilationResultV3 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      value: Readonly<BuildTopologyV3>;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly BuildTopologyDiagnosticV3[];
    }>;

function rejected(
  code: BuildTopologyDiagnosticCodeV3,
  path: string,
  message: string,
): BuildTopologyCompilationResultV3 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

class BuildTopologyAuthorityErrorV3 extends Error {
  constructor(message: string) {
    super(message.slice(0, 1_500));
    this.name = "BuildTopologyAuthorityErrorV3";
  }
}

function authorityFailure(message: string): never {
  throw new BuildTopologyAuthorityErrorV3(message);
}

type FreshAuthorityV3 = Readonly<{
  layout: Readonly<NodeExecutionLayoutV2>;
  pathSet: Readonly<NodeExecutionPathTokenSetV2>;
  scaffoldCatalog: Readonly<NodeScaffoldToolchainCatalogV2>;
  scaffoldEntry: Readonly<NodeScaffoldToolchainEntryV2>;
  runtimeGeneratorProfile: Readonly<NodeProductRuntimeGeneratorProfileV2>;
  testGeneratorProfile: Readonly<NodeProductTestGeneratorProfileV2>;
}>;

function reproduceFreshAuthorityV3(input: Readonly<{
  productSpec: unknown;
  deliverySelection: unknown;
}>): FreshAuthorityV3 {
  const layout = resolveNodeExecutionLayoutV2(input);
  if (layout.status !== "shadow_resolved") {
    authorityFailure(
      layout.diagnostics[0]?.message ?? "Node execution layout was rejected",
    );
  }
  const pathSet = compileNodeExecutionPathTokenSetV2(input);
  if (pathSet.status !== "shadow_compiled") {
    authorityFailure(
      pathSet.diagnostics[0]?.message ?? "Node path-token set was rejected",
    );
  }
  const scaffoldCatalog = getCodeOwnedNodeScaffoldToolchainCatalogV2();
  const scaffoldEntry = scaffoldCatalog.entries.find((entry) =>
    entry.profileBinding.profileId === layout.layout.profileBinding.profileId);
  const runtimeGeneratorProfile =
    NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_V2.profiles.find((profile) =>
      profile.profileId === layout.layout.profileBinding.profileId
      && profile.stackPackId === layout.layout.stackPackBinding.stackPackId);
  const testGeneratorProfile =
    NODE_PRODUCT_TEST_GENERATOR_CONTRACT_V2.profiles.find((profile) =>
      profile.profileId === layout.layout.profileBinding.profileId
      && profile.stackPackId === layout.layout.stackPackBinding.stackPackId);
  if (
    !scaffoldEntry
    || !runtimeGeneratorProfile
    || !testGeneratorProfile
    || pathSet.value.sourceAuthority.slotSetHash
      !== layout.layout.pathSlots.slotSetHash
    || scaffoldEntry.layoutBinding.layoutHash !== layout.layout.layoutHash
    || scaffoldEntry.layoutBinding.pathSlotSetHash
      !== layout.layout.pathSlots.slotSetHash
    || scaffoldEntry.profileBinding.profileHash
      !== layout.layout.profileBinding.profileHash
    || scaffoldEntry.profileBinding.stackPackId
      !== layout.layout.stackPackBinding.stackPackId
    || scaffoldEntry.profileBinding.stackPackVersion
      !== layout.layout.stackPackBinding.stackPackVersion
    || scaffoldEntry.profileBinding.stackPackContentHash
      !== layout.layout.stackPackBinding.stackPackContentHash
    || runtimeGeneratorProfile.sourcePathSlotRef
      !== layout.layout.pathSlots.sourceEntrypoint.slotRef
    || scaffoldEntry.toolchain.typescript.executableRef
      !== "TOOL_NODE_TYPESCRIPT_TSC_V2"
    || scaffoldEntry.toolchain.typescript.exactVersion !== "5.9.3"
  ) {
    authorityFailure(
      "Fresh layout, path, scaffold and generator authorities diverged",
    );
  }
  return Object.freeze({
    layout: layout.layout,
    pathSet: pathSet.value,
    scaffoldCatalog,
    scaffoldEntry,
    runtimeGeneratorProfile,
    testGeneratorProfile,
  });
}

function tokenBySlotV3(
  pathSet: Readonly<NodeExecutionPathTokenSetV2>,
  slotRef: string,
): Readonly<PathTokenV2> {
  const found = pathSet.tokens.filter((token) => token.origin.slotRef === slotRef);
  if (found.length !== 1) {
    authorityFailure(`Expected exactly one Node path token for ${slotRef}`);
  }
  return found[0]!;
}

function compilerTargetV3(
  receipt: Readonly<BuildDependencyMaterializationReceiptV2>,
): TypeScriptCompilerTargetV3 {
  const matches = receipt.installedBins.entries.filter((entry) =>
    entry.commandName === "tsc"
    && entry.packagePath === "node_modules/typescript"
    && entry.linkLocator === "node_modules/.bin/tsc"
    && entry.targetLocator === "node_modules/typescript/bin/tsc");
  if (matches.length !== 1) {
    authorityFailure("Dependency receipt lacks one exact TypeScript compiler target");
  }
  const compiler = matches[0]!;
  return {
    executableRef: "TOOL_NODE_TYPESCRIPT_TSC_V2",
    exactVersion: "5.9.3",
    commandName: "tsc",
    packagePath: "node_modules/typescript",
    linkLocator: "node_modules/.bin/tsc",
    targetLocator: "node_modules/typescript/bin/tsc",
    linkTargetHash: compiler.linkTargetHash,
    targetContentHash: compiler.targetContentHash,
    executionDisposition: "direct_target_via_authenticated_node_runtime",
  };
}

function buildLogicalDependencyV3(
  receipt: Readonly<BuildDependencyMaterializationReceiptV2>,
  compilerTarget: TypeScriptCompilerTargetV3,
): BuildTopologyLogicalDependencyV3 {
  return {
    catalogHash: receipt.catalogBinding.catalogHash,
    scaffoldEntryHash: receipt.catalogBinding.entryHash,
    dependencyGraphHash: receipt.catalogBinding.dependencyGraphHash,
    environmentContractHash: receipt.environmentBinding.environmentContractHash,
    effectiveConfigHash: receipt.environmentBinding.effectiveConfigHash,
    nodeIdentityHash: receipt.hostToolchain.nodeIdentityHash,
    npmClosureHash: receipt.hostToolchain.npmClosureHash,
    npmVersion: receipt.hostToolchain.npmVersion,
    installDirectArgvHash: receipt.installExecution.directArgvHash,
    graph: {
      lockRawHash: receipt.lockGraph.lockRawHash,
      nodeCount: receipt.lockGraph.expectedNodeCount,
      edgeCount: receipt.lockGraph.expectedEdgeCount,
      installedPackageMembershipHash:
        receipt.lockGraph.installedPackageMembershipHash,
      hiddenLockRawHash: receipt.lockGraph.hiddenLockRawHash,
      hiddenLockGraphHash: receipt.lockGraph.hiddenLockGraphHash,
    },
    lifecycleAndEnginePolicyHash: hashCanonicalJson({
      schema: "setfarm.build-topology-dependency-lifecycle-policy-hash.v3",
      policy: receipt.lifecycleAndEnginePolicy,
    }),
    installedBinsMembershipHash: receipt.installedBins.membershipHash,
    typescriptCompiler: compilerTarget,
    rawInstallTree: {
      fileCount: receipt.rawInstallTree.fileCount,
      directoryCount: receipt.rawInstallTree.directoryCount,
      symbolicLinkCount: receipt.rawInstallTree.symbolicLinkCount,
      totalBytes: receipt.rawInstallTree.totalBytes,
      membershipHash: receipt.rawInstallTree.membershipHash,
      mutationPolicy: receipt.rawInstallTree.mutationPolicy,
    },
    dependencyCapsule: {
      treeHash: receipt.dependencyCapsule.treeHash,
      payloadHash: receipt.dependencyCapsule.payloadHash,
      rootMode: receipt.dependencyCapsule.rootMode,
      fileCount: receipt.dependencyCapsule.fileCount,
      directoryCount: receipt.dependencyCapsule.directoryCount,
      totalBytes: receipt.dependencyCapsule.totalBytes,
    },
    dependencyCapsuleAuthorityHash: hashCanonicalJson({
      schema: "setfarm.build-topology-dependency-capsule-authority-hash.v3",
      authority: receipt.dependencyCapsuleAuthority,
    }),
  };
}

function pathEntryV3(
  physicalSpace: "candidate_runtime" | "dependency_capsule" | "repository",
  normalizedLocator: string,
  value: Omit<
    BuildTopologyPathEntryHashPayloadV3,
    | "pathRef"
    | "physicalSpace"
    | "normalizedLocator"
    | "pathIdentityHash"
    | "caseFoldPathIdentityHash"
  >,
): BuildTopologyPathEntryV3 {
  const identity: BuildTopologyPathEntryHashPayloadV3 = {
    pathRef: deriveBuildTopologyPathRefV3(physicalSpace, normalizedLocator),
    physicalSpace,
    normalizedLocator,
    pathIdentityHash: hashPortablePathIdentityV2(
      physicalSpace,
      normalizedLocator,
    ),
    caseFoldPathIdentityHash: hashPortablePathCaseFoldIdentityV2(
      physicalSpace,
      normalizedLocator,
    ),
    ...value,
  };
  return BuildTopologyPathEntryV3Schema.parse({
    ...identity,
    entryHash: hashBuildTopologyPathEntryV3(identity),
  });
}

function buildCommandsV3(
  dependency: Readonly<BuildDependencyMaterializationReceiptV2>,
  compilerTarget: TypeScriptCompilerTargetV3,
  testProfile: Readonly<NodeProductTestGeneratorProfileV2>,
): BuildTopologyCommandsV3 {
  const common = {
    commandRef: "CMD_NODE_PRODUCT_TEST_V3" as const,
    executableRef: "TOOL_NODE_RUNTIME_V2" as const,
    cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2" as const,
    shell: "forbidden" as const,
    runnerAbi: "NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2" as const,
    requiredPreconditions: BUILD_TOPOLOGY_TEST_REQUIRED_PRECONDITIONS_V3.map(
      (precondition) => ({ ...precondition }),
    ),
    canonicalReceiptSchema: NODE_PRODUCT_TEST_EXECUTION_RECEIPT_V3_SCHEMA,
    minimumTestCount: 1 as const,
    zeroTestReceipt: "forbidden" as const,
    networkPolicy: "forbidden" as const,
    executionStatus: "blocked_until_build_and_source_receipts" as const,
  };
  const test: BuildTopologyCommandsV3["test"] =
    testProfile.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      ? {
          ...common,
          profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
          directArgv: ["node", "--test", "dist/cli.setfarm.test.js"],
          subprocessPolicy: "exact_same_runtime_cli_module_only",
        }
      : {
          ...common,
          profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
          directArgv: ["node", "--test", "dist/app.setfarm.test.js"],
          subprocessPolicy: "forbidden",
        };
  return {
    environmentContractHash: dependency.environmentBinding.environmentContractHash,
    effectiveConfigHash: dependency.environmentBinding.effectiveConfigHash,
    nodeIdentityHash: dependency.hostToolchain.nodeIdentityHash,
    ambientEnvironment: "forbidden",
    install: {
      commandRef: dependency.installExecution.commandRef,
      executableRef: dependency.installExecution.executableRef,
      cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
      directArgv: [...dependency.installExecution.directArgv],
      executionStatus: "verified_exited_zero",
      dependencyReceiptHash: dependency.receiptHash,
    },
    build: {
      commandRef: "CMD_NODE_PRODUCT_BUILD_V3",
      executableRef: "TOOL_NODE_RUNTIME_V2",
      compilerExecutableRef: "TOOL_NODE_TYPESCRIPT_TSC_V2",
      compilerTarget,
      cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
      directArgv: [
        "node",
        "node_modules/typescript/bin/tsc",
        "-p",
        "tsconfig.json",
      ],
      shell: "forbidden",
      requiredPreconditions: BUILD_TOPOLOGY_BUILD_REQUIRED_PRECONDITIONS_V3.map(
        (precondition) => ({ ...precondition }),
      ),
      runtimeSourceReceiptState: "absent",
      testSourceReceiptState: "absent",
      buildReceiptSchema: NODE_PRODUCT_BUILD_RECEIPT_V3_SCHEMA,
      buildReceiptState: "absent",
      executionStatus: "blocked_until_runtime_and_test_source_receipts",
    },
    test,
  };
}

function buildRuntimeTargetV3(
  layout: Readonly<NodeExecutionLayoutV2>,
  candidateModulePathRef: string,
): BuildTopologyRuntimeTargetV3 {
  if (layout.runtimeTarget.kind === "cli") {
    return {
      kind: "cli",
      launcherRef: layout.profileBinding.launcherRef as "LAUNCH_NODE_CLI_V2",
      entrypointAbi: layout.runtimeTarget.entrypointAbi,
      argvOwnership: layout.runtimeTarget.argvOwnership,
      nodeOptionTokens: [],
      candidateModulePathRef,
      transportArguments: layout.runtimeTarget.transportArguments,
      executionStatus: "blocked_until_candidate_and_release_manifest",
    };
  }
  return {
    kind: "http_handler",
    launcherRef: layout.profileBinding.launcherRef as "LAUNCH_NODE_EXPRESS_API_V2",
    candidateModulePathRef,
    exportName: layout.runtimeTarget.exportName,
    handlerAbi: layout.runtimeTarget.handlerAbi,
    serverOwnership: layout.runtimeTarget.serverOwnership,
    listenerOwnership: layout.runtimeTarget.listenerOwnership,
    socketOwnership: layout.runtimeTarget.socketOwnership,
    candidateListen: layout.runtimeTarget.candidateListen,
    executionStatus: "blocked_until_candidate_and_release_manifest",
  };
}

function assertExactJoinsV3(input: Readonly<{
  fresh: FreshAuthorityV3;
  fileTree: Readonly<FileTreeManifestV3>;
  dependency: Readonly<BuildDependencyMaterializationReceiptV2>;
  inspectedDependency: Readonly<BuildDependencyMaterializationReceiptV2>;
  base: Readonly<ScaffoldBaseMaterializationReceiptV2>;
  compilerTarget: TypeScriptCompilerTargetV3;
}>): void {
  const { fresh, fileTree, dependency, base } = input;
  const runtimeSource = fileTree.paths.find((entry) =>
    entry.authority.kind === "generated_runtime_source_target");
  const testSource = fileTree.paths.find((entry) =>
    entry.authority.kind === "generated_test_source_target");
  if (
    dependency.receiptHash !== input.inspectedDependency.receiptHash
    || dependency.scaffoldBase.receiptHash !== base.receiptHash
    || dependency.scaffoldBase.semanticInputHash !== base.semanticInputHash
    || dependency.scaffoldBase.startBaseStateHash !== base.baseStateHash
    || dependency.scaffoldBase.endBaseFileMembershipHash
      !== base.baseState.fileMembershipHash
    || dependency.scaffoldBase.semanticInputHash
      !== fileTree.authority.scaffoldCompatibilityEvidence
        .scaffoldBaseSemanticInputHash
    || dependency.scaffoldBase.startBaseStateHash
      !== fileTree.authority.scaffoldCompatibilityEvidence.scaffoldBaseStateHash
    || dependency.catalogBinding.catalogHash
      !== fileTree.authority.scaffoldCompatibilityEvidence.catalogHash
    || dependency.catalogBinding.entryHash
      !== fileTree.authority.scaffoldCompatibilityEvidence.entryHash
    || dependency.catalogBinding.profileId !== fileTree.authority.profileId
    || dependency.catalogBinding.dependencyGraphHash
      !== fresh.scaffoldEntry.dependencyGraph.graphHash
    || fresh.scaffoldCatalog.catalogHash !== dependency.catalogBinding.catalogHash
    || fresh.scaffoldEntry.entryHash !== dependency.catalogBinding.entryHash
    || fileTree.authority.nodeExecutionLayout.layoutRef !== fresh.layout.layoutRef
    || fileTree.authority.nodeExecutionLayout.layoutHash !== fresh.layout.layoutHash
    || fileTree.authority.nodeExecutionLayout.pathSlotSetHash
      !== fresh.layout.pathSlots.slotSetHash
    || fileTree.authority.nodeExecutionLayout.pathTokenSetHash
      !== fresh.pathSet.tokenSetHash
    || fileTree.authority.deliveryProfileHash
      !== fresh.layout.profileBinding.profileHash
    || fileTree.authority.stackPackId !== fresh.layout.stackPackBinding.stackPackId
    || fileTree.authority.stackPackVersion
      !== fresh.layout.stackPackBinding.stackPackVersion
    || fileTree.authority.stackPackContentHash
      !== fresh.layout.stackPackBinding.stackPackContentHash
    || runtimeSource?.authority.kind !== "generated_runtime_source_target"
    || runtimeSource.authority.generatorProfileHash
      !== hashNodeProductRuntimeGeneratorProfileV2(fresh.runtimeGeneratorProfile)
    || testSource?.authority.kind !== "generated_test_source_target"
    || testSource.authority.generatorProfileHash
      !== hashNodeProductTestGeneratorProfileV2(fresh.testGeneratorProfile)
    || input.compilerTarget.targetContentHash.length !== 64
  ) {
    authorityFailure(
      "V3 FileTree, dependency receipt, compiler target and fresh Node authorities do not join",
    );
  }
}

function buildTopologyV3(input: Readonly<{
  fresh: FreshAuthorityV3;
  fileTree: Readonly<FileTreeManifestV3>;
  dependency: Readonly<BuildDependencyMaterializationReceiptV2>;
  compilerTarget: TypeScriptCompilerTargetV3;
}>): BuildTopologyV3 {
  const { fresh, fileTree, dependency, compilerTarget } = input;
  const logicalDependency = buildLogicalDependencyV3(dependency, compilerTarget);
  const logicalDependencyHash = hashBuildTopologyLogicalDependencyV3(
    logicalDependency,
  );
  const fileTreePaths = fileTree.paths.map((entry) => {
    const identity = fileTreePathProjectionForBuildTopologyV3(
      fileTree.manifestHash,
      entry,
    );
    return BuildTopologyPathEntryV3Schema.parse({
      ...identity,
      entryHash: hashBuildTopologyPathEntryV3(identity),
    });
  });
  const rawDependencies = pathEntryV3("repository", "node_modules", {
    classification: "raw_dependency_build_input",
    ownerRef: "OWNER_SETUP_V3",
    writeGrantOwnerRefs: [],
    access: "dependency_compile_input",
    currentState: {
      state: "present_raw_dependency_tree",
      ...logicalDependency.rawInstallTree,
    },
    authority: {
      kind: "raw_dependency_build_input",
      dependencyReceiptHash: dependency.receiptHash,
      logicalDependencyHash,
      use: "disposable_compile_only_input",
      generatedNpmLinks: "verified_not_execution_authority",
    },
  });
  const runtimeCapsule = pathEntryV3("dependency_capsule", "node_modules", {
    classification: "readonly_dependency_runtime_capsule",
    ownerRef: "OWNER_SETUP_V3",
    writeGrantOwnerRefs: [],
    access: "dependency_runtime_readonly",
    currentState: {
      state: "present_readonly_dependency_capsule",
      ...logicalDependency.dependencyCapsule,
    },
    authority: {
      kind: "readonly_dependency_runtime_capsule",
      dependencyReceiptHash: dependency.receiptHash,
      logicalDependencyHash,
      use: "future_candidate_runtime_copy_source",
      generatedNpmLinks: "excluded",
    },
  });
  const runtimeSource = fileTree.paths.find((entry) =>
    entry.authority.kind === "generated_runtime_source_target");
  const testSource = fileTree.paths.find((entry) =>
    entry.authority.kind === "generated_test_source_target");
  if (
    runtimeSource?.authority.kind !== "generated_runtime_source_target"
    || testSource?.authority.kind !== "generated_test_source_target"
  ) {
    authorityFailure("Verified V3 FileTree lacks exact runtime/test source targets");
  }
  const runtimeOutputToken = tokenBySlotV3(
    fresh.pathSet,
    fresh.layout.sourceToRuntime.buildOutputPathSlotRef,
  );
  const runtimeBuildOutput = pathEntryV3(
    "repository",
    runtimeOutputToken.normalizedLocator,
    {
      classification: "runtime_build_output",
      ownerRef: "OWNER_NODE_PRODUCT_BUILD_EXECUTOR_V3",
      writeGrantOwnerRefs: [],
      access: "build_generated_future",
      currentState: {
        state: "absent",
        absenceHash: hashBuildTopologyPathAbsenceV3(
          "repository",
          runtimeOutputToken.normalizedLocator,
        ),
        evidence: "authenticated_dependency_stage_exact_project_inventory_v2",
      },
      authority: {
        kind: "runtime_build_output_plan",
        layoutHash: fresh.layout.layoutHash,
        sourcePathRef: runtimeSource.pathRef,
        sourcePathSlotRef: fresh.runtimeGeneratorProfile.sourcePathSlotRef,
        outputPathSlotRef: fresh.layout.sourceToRuntime.buildOutputPathSlotRef,
        pathToken: runtimeOutputToken.pathToken,
        tokenBindingHash: runtimeOutputToken.bindingHash,
        requiredReceiptSchema: NODE_PRODUCT_BUILD_RECEIPT_V3_SCHEMA,
        receiptState: "absent",
      },
    },
  );
  const testProfile = fresh.testGeneratorProfile;
  const testBuildOutput = pathEntryV3(
    "repository",
    testProfile.compiledNormalizedLocator,
    {
      classification: "test_build_output",
      ownerRef: "OWNER_NODE_PRODUCT_BUILD_EXECUTOR_V3",
      writeGrantOwnerRefs: [],
      access: "build_generated_future",
      currentState: {
        state: "absent",
        absenceHash: hashBuildTopologyPathAbsenceV3(
          "repository",
          testProfile.compiledNormalizedLocator,
        ),
        evidence: "authenticated_dependency_stage_exact_project_inventory_v2",
      },
      authority: {
        kind: "test_build_output_plan",
        sourcePathRef: testSource.pathRef,
        generatorContractHash: NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
        generatorProfileHash: hashNodeProductTestGeneratorProfileV2(testProfile),
        profileSourcePathRef: testProfile.sourcePathRef,
        profileCompiledPathRef: testProfile.compiledPathRef,
        runtimeImportSpecifier: testProfile.runtimeImportSpecifier,
        requiredReceiptSchema: NODE_PRODUCT_BUILD_RECEIPT_V3_SCHEMA,
        receiptState: "absent",
      },
    },
  );
  const candidateToken = tokenBySlotV3(
    fresh.pathSet,
    fresh.layout.sourceToRuntime.candidateModulePathSlotRef,
  );
  const candidateModule = pathEntryV3(
    "candidate_runtime",
    candidateToken.normalizedLocator,
    {
      classification: "candidate_module",
      ownerRef: "OWNER_NODE_CANDIDATE_MATERIALIZER_V3",
      writeGrantOwnerRefs: [],
      access: "candidate_generated_future",
      currentState: {
        state: "not_materialized",
        disposition: "future_candidate_materialization_only",
      },
      authority: {
        kind: "candidate_module_plan",
        layoutHash: fresh.layout.layoutHash,
        runtimeBuildOutputPathRef: runtimeBuildOutput.pathRef,
        pathSlotRef: fresh.layout.sourceToRuntime.candidateModulePathSlotRef,
        pathToken: candidateToken.pathToken,
        tokenBindingHash: candidateToken.bindingHash,
        requiredReceiptSchema: NODE_PRODUCT_BUILD_RECEIPT_V3_SCHEMA,
        materializationState: "absent",
      },
    },
  );
  const paths = [
    ...fileTreePaths,
    rawDependencies,
    runtimeCapsule,
    runtimeBuildOutput,
    testBuildOutput,
    candidateModule,
  ].sort((left, right) => compareUtf16(
    `${left.physicalSpace}\0${left.normalizedLocator}`,
    `${right.physicalSpace}\0${right.normalizedLocator}`,
  ));
  const commands = buildCommandsV3(dependency, compilerTarget, testProfile);
  const compilation: BuildTopologyCompilationV3 = {
    profileId: fileTree.authority.profileId,
    layoutHash: fresh.layout.layoutHash,
    moduleSystem: "node_esm",
    runtime: {
      sourcePathRef: runtimeSource.pathRef,
      outputPathRef: runtimeBuildOutput.pathRef,
      sourceNormalizedLocator: runtimeSource.normalizedLocator as
        "src/cli.ts" | "src/app.ts",
      outputNormalizedLocator: runtimeOutputToken.normalizedLocator as
        "dist/cli.js" | "dist/app.js",
      sourceMediaType: "text/typescript",
      outputMediaType: "text/javascript",
      generatorContractHash: NODE_PRODUCT_RUNTIME_GENERATOR_CONTRACT_HASH_V2,
      generatorProfileHash:
        hashNodeProductRuntimeGeneratorProfileV2(fresh.runtimeGeneratorProfile),
      sourceReceipt: {
        schema: NODE_PRODUCT_RUNTIME_SOURCE_RECEIPT_V2_SCHEMA,
        state: "absent",
        missingDisposition: "typed_precondition_rejection",
      },
      realizationCount: fileTree.coverage.runtimeRealizationCount,
      realizationMembershipHash:
        fileTree.coverage.runtimeRealizationMembershipHash,
    },
    test: {
      sourcePathRef: testSource.pathRef,
      outputPathRef: testBuildOutput.pathRef,
      sourceNormalizedLocator: testProfile.sourceNormalizedLocator,
      outputNormalizedLocator: testProfile.compiledNormalizedLocator,
      profileSourcePathRef: testProfile.sourcePathRef,
      profileCompiledPathRef: testProfile.compiledPathRef,
      runtimeImportSpecifier: testProfile.runtimeImportSpecifier,
      runnerAbi: testProfile.execution.runnerAbi,
      generatorContractHash: NODE_PRODUCT_TEST_GENERATOR_CONTRACT_HASH_V2,
      generatorProfileHash: hashNodeProductTestGeneratorProfileV2(testProfile),
      sourceReceipt: {
        schema: NODE_PRODUCT_TEST_SOURCE_RECEIPT_V2_SCHEMA,
        state: "absent",
        missingDisposition: "typed_precondition_rejection",
      },
      coverageCount: fileTree.coverage.testCoverageCount,
      coverageMembershipHash: fileTree.coverage.testCoverageMembershipHash,
    },
    candidate: {
      runtimeBuildOutputPathRef: runtimeBuildOutput.pathRef,
      candidateModulePathRef: candidateModule.pathRef,
      requiredBuildReceiptSchema: NODE_PRODUCT_BUILD_RECEIPT_V3_SCHEMA,
      buildReceiptState: "absent",
      materializationState: "not_materialized",
    },
  };
  const runtimeTarget = buildRuntimeTargetV3(
    fresh.layout,
    candidateModule.pathRef,
  );
  const logicalIdentity: BuildTopologyLogicalIdentityV3 = {
    schema: BUILD_TOPOLOGY_V3_SCHEMA,
    topologyVersion: BUILD_TOPOLOGY_VERSION_V3,
    contractHash: BUILD_TOPOLOGY_CONTRACT_HASH_V3,
    stage: "realization_sources_planned_dependencies_ready",
    readiness: {
      status: "shadow_blocked",
      productionUse: "forbidden",
      blockerCodes: [...BUILD_TOPOLOGY_BLOCKER_CODES_V3],
    },
    authority: {
      productRef: fileTree.authority.productRef,
      productSpecHash: fileTree.authority.productSpecHash,
      deliverySelectionHash: fileTree.authority.deliverySelectionHash,
      profileId: fileTree.authority.profileId,
      deliveryProfileHash: fileTree.authority.deliveryProfileHash,
      stackPackId: fileTree.authority.stackPackId,
      stackPackVersion: fileTree.authority.stackPackVersion,
      stackPackContentHash: fileTree.authority.stackPackContentHash,
      fileTree: {
        schema: fileTree.schema,
        version: fileTree.manifestVersion,
        contractHash: fileTree.contractHash,
        manifestHash: fileTree.manifestHash,
        pathCount: fileTree.pathCount,
        pathMembershipHash: fileTree.pathMembershipHash,
        ownerMembershipHash: fileTree.ownerMembershipHash,
        semanticRealizationPlanHash:
          fileTree.authority.semanticRealizationPlan.planHash,
        runtimeBehaviorProposalHash:
          fileTree.authority.semanticRealizationPlan.runtimeBehaviorProposalHash,
        runtimeBehaviorContractHash:
          fileTree.authority.semanticRealizationPlan.runtimeBehaviorContractHash,
        runtimeRealizationMembershipHash:
          fileTree.coverage.runtimeRealizationMembershipHash,
        testCoverageMembershipHash: fileTree.coverage.testCoverageMembershipHash,
      },
      layoutRef: fresh.layout.layoutRef,
      layoutHash: fresh.layout.layoutHash,
      pathTokenSetHash: fresh.pathSet.tokenSetHash,
      scaffoldCatalogHash: fresh.scaffoldCatalog.catalogHash,
      scaffoldEntryHash: fresh.scaffoldEntry.entryHash,
      logicalDependencyHash,
      logicalPathMembershipHash: hashBuildTopologyLogicalPathMembershipV3(paths),
      commandContractHash: hashBuildTopologyCommandContractV3(commands),
      compilationContractHash:
        hashBuildTopologyCompilationContractV3(compilation),
      runtimeContractHash: hashBuildTopologyRuntimeContractV3(runtimeTarget),
    },
  };
  const identity: BuildTopologyManifestHashPayloadV3 = {
    ...logicalIdentity,
    operationalEvidence: {
      admissionScope: dependency.admissionScope,
      dependencyReceiptSchema: dependency.schema,
      dependencyReceiptVersion: dependency.receiptVersion,
      dependencyReceiptHash: dependency.receiptHash,
      dependencyIdentityHash: dependency.dependencyIdentityHash,
      scaffoldBaseReceiptHash: dependency.scaffoldBase.receiptHash,
      environmentReceiptHash: dependency.environmentBinding.receiptHash,
      hostToolchainReceiptHash: dependency.hostToolchain.receiptHash,
      projectScopeHash: dependency.installExecution.projectScopeHash,
      stdoutHash: dependency.installExecution.stdoutHash,
      stderrHash: dependency.installExecution.stderrHash,
      evidenceAuthority:
        "authenticated_private_dependency_stage_fresh_revalidation_v2",
    },
    dependency: {
      logical: logicalDependency,
      logicalDependencyHash,
      rawBuildInputPathRef: rawDependencies.pathRef,
      runtimeCapsulePathRef: runtimeCapsule.pathRef,
    },
    pathCount: 11,
    paths,
    pathMembershipHash: hashBuildTopologyPathMembershipV3(paths),
    compilation,
    commands,
    runtimeTarget,
    logicalBuildHash: hashBuildTopologyLogicalBuildV3(logicalIdentity),
  };
  return BuildTopologyV3Schema.parse({
    ...identity,
    manifestHash: hashBuildTopologyManifestV3(identity),
  });
}

async function compileInternalV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<BuildTopologyCompilationResultV3> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      INPUT_MAX_CANONICAL_BYTES_V3,
      INPUT_BOUNDED_WORK_LIMITS_V3,
    );
  } catch (error) {
    return rejected("BUILD_TOPOLOGY_V3_INPUT_INVALID", "/", errorMessage(error));
  }
  const parsed = CompilerInputV3Schema.safeParse(snapshot);
  if (!parsed.success) {
    return rejected(
      "BUILD_TOPOLOGY_V3_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "V3 build-topology input is invalid",
    );
  }
  try {
    const production = isProductionNodeScaffoldPrivateStageV2(handle);
    if (expectedScope === "production_host" && !production) {
      return rejected(
        "BUILD_TOPOLOGY_V3_PRODUCTION_AUTHORITY_REQUIRED",
        "/stage",
        "Production V3 topology requires production_host dependency authority",
      );
    }
    if (expectedScope === "test_fixture" && production) {
      return rejected(
        "BUILD_TOPOLOGY_V3_TEST_AUTHORITY_REQUIRED",
        "/stage",
        "Test V3 topology cannot consume or downgrade production authority",
      );
    }
    const verifiedFileTree = expectedScope === "production_host"
      ? await verifyFileTreeManifestV3AtDependencyStage(handle, {
          productSpec: parsed.data.productSpec,
          deliverySelection: parsed.data.deliverySelection,
          runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
          runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
          candidate: parsed.data.fileTree,
        })
      : await verifyFileTreeManifestV3AtDependencyStageForTest(handle, {
          productSpec: parsed.data.productSpec,
          deliverySelection: parsed.data.deliverySelection,
          runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
          runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
          candidate: parsed.data.fileTree,
        });
    const dependency = await revalidateNodeScaffoldDependenciesV2(handle);
    const inspectedDependency = inspectBuildDependencyMaterializationReceiptV2(handle);
    const base = inspectScaffoldBaseMaterializationReceiptV2(handle);
    const fresh = reproduceFreshAuthorityV3({
      productSpec: parsed.data.productSpec,
      deliverySelection: parsed.data.deliverySelection,
    });
    const compilerTarget = compilerTargetV3(dependency);
    assertExactJoinsV3({
      fresh,
      fileTree: verifiedFileTree.value,
      dependency,
      inspectedDependency,
      base,
      compilerTarget,
    });
    const value = recursivelyFreezeBuildTopologyV3(buildTopologyV3({
      fresh,
      fileTree: verifiedFileTree.value,
      dependency,
      compilerTarget,
    }));
    let canonicalBytes: Buffer;
    try {
      canonicalBytes = canonicalJsonBytesBounded(value, {
        maxBytes: BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V3,
        ...BUILD_TOPOLOGY_BOUNDED_WORK_LIMITS_V3,
      });
    } catch (error) {
      return rejected(
        "BUILD_TOPOLOGY_V3_OUTPUT_LIMIT_EXCEEDED",
        "/",
        errorMessage(error),
      );
    }
    return recursivelyFreezeBuildTopologyV3({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      value,
      canonicalBytes: canonicalBytes.toString("utf8"),
    });
  } catch (error) {
    return rejected(
      error instanceof FileTreeManifestVerificationErrorV3
        ? "BUILD_TOPOLOGY_V3_FILE_TREE_REJECTED"
        : error instanceof NodeScaffoldPrivateMaterializerErrorV2
          ? "BUILD_TOPOLOGY_V3_PRIVATE_STAGE_INVALID"
          : error instanceof BuildTopologyAuthorityErrorV3
            ? "BUILD_TOPOLOGY_V3_UPSTREAM_AUTHORITY_REJECTED"
            : "BUILD_TOPOLOGY_V3_ARTIFACT_INVALID",
      "/",
      errorMessage(error),
    );
  }
}

export function compileBuildTopologyV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<BuildTopologyCompilationResultV3> {
  return compileInternalV3(handle, input, "production_host");
}

export function compileBuildTopologyV3ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<BuildTopologyCompilationResultV3> {
  return compileInternalV3(handle, input, "test_fixture");
}

export type BuildTopologyVerificationErrorCodeV3 =
  | "BUILD_TOPOLOGY_V3_VERIFICATION_AUTHORITY_MISMATCH"
  | "BUILD_TOPOLOGY_V3_VERIFICATION_CANDIDATE_INVALID"
  | "BUILD_TOPOLOGY_V3_VERIFICATION_INPUT_INVALID"
  | "BUILD_TOPOLOGY_V3_VERIFICATION_REPRODUCTION_REJECTED";

export class BuildTopologyVerificationErrorV3 extends Error {
  readonly code: BuildTopologyVerificationErrorCodeV3;

  constructor(code: BuildTopologyVerificationErrorCodeV3, message: string) {
    super(message.slice(0, 1_500));
    this.name = "BuildTopologyVerificationErrorV3";
    this.code = code;
  }
}

export type VerifiedShadowBuildTopologyV3 = Readonly<{
  status: "verified_shadow";
  value: Readonly<BuildTopologyV3>;
  canonicalBytes: string;
}>;

async function verifyInternalV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowBuildTopologyV3> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V3,
      VERIFIER_BOUNDED_WORK_LIMITS_V3,
    );
  } catch (error) {
    throw new BuildTopologyVerificationErrorV3(
      "BUILD_TOPOLOGY_V3_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV3Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new BuildTopologyVerificationErrorV3(
      "BUILD_TOPOLOGY_V3_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "V3 topology verifier input is invalid",
    );
  }
  const candidate = BuildTopologyV3Schema.safeParse(parsed.data.candidate);
  if (!candidate.success) {
    throw new BuildTopologyVerificationErrorV3(
      "BUILD_TOPOLOGY_V3_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "V3 topology candidate is invalid",
    );
  }
  const reproduced = await compileInternalV3(handle, {
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
    runtimeBehaviorProposal: parsed.data.runtimeBehaviorProposal,
    runtimeBehaviorContract: parsed.data.runtimeBehaviorContract,
    fileTree: parsed.data.fileTree,
  }, expectedScope);
  if (reproduced.status !== "shadow_compiled") {
    throw new BuildTopologyVerificationErrorV3(
      "BUILD_TOPOLOGY_V3_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message
        ?? "Fresh V3 build-topology reproduction failed",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== reproduced.canonicalBytes) {
    throw new BuildTopologyVerificationErrorV3(
      "BUILD_TOPOLOGY_V3_VERIFICATION_AUTHORITY_MISMATCH",
      "V3 topology candidate does not equal fresh FileTree, direct command and authenticated dependency authority",
    );
  }
  return recursivelyFreezeBuildTopologyV3({
    status: "verified_shadow" as const,
    value: reproduced.value,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

export function verifyBuildTopologyV3(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowBuildTopologyV3> {
  return verifyInternalV3(handle, input, "production_host");
}

export function verifyBuildTopologyV3ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowBuildTopologyV3> {
  return verifyInternalV3(handle, input, "test_fixture");
}
