import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  FileTreeManifestVerificationErrorV2,
  verifyFileTreeManifestV2AtDependencyStage,
  verifyFileTreeManifestV2AtDependencyStageForTest,
} from "./file-tree-manifest-v2.js";
import { resolveNodeExecutionLayoutV2 } from
  "./node-execution-layout-catalog-v2.js";
import {
  NodeScaffoldPrivateMaterializerErrorV2,
  inspectBuildDependencyMaterializationReceiptV2,
  inspectScaffoldBaseMaterializationReceiptV2,
  isProductionNodeScaffoldPrivateStageV2,
  revalidateNodeScaffoldDependenciesV2,
  revalidateNodeScaffoldStageHostToolchainLogicalIdentityInternalV3,
  type MaterializedNodeScaffoldPrivateStageV2,
} from "./node-scaffold-private-materializer-v2.js";
import {
  getCodeOwnedNodeScaffoldToolchainEntryV2,
  resolveNodeScaffoldToolchainV2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import { compileNodeExecutionPathTokenSetV2 } from "./path-token-v2.js";
import {
  BUILD_TOPOLOGY_BLOCKER_CODES_V2,
  BUILD_TOPOLOGY_BOUNDED_WORK_LIMITS_V2,
  BUILD_TOPOLOGY_CONTRACT_HASH_V2,
  BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V2,
  BUILD_TOPOLOGY_V2_SCHEMA,
  BUILD_TOPOLOGY_VERSION_V2,
  BuildTopologyPathEntryV2Schema,
  BuildTopologyV2Schema,
  deriveBuildTopologyPathRefV2,
  fileTreePathProjectionForBuildTopologyV2,
  hashBuildTopologyCommandContractV2,
  hashBuildTopologyEntrypointContractV2,
  hashBuildTopologyLogicalBuildV2,
  hashBuildTopologyLogicalDependencyV2,
  hashBuildTopologyLogicalPathMembershipV2,
  hashBuildTopologyManifestV2,
  hashBuildTopologyPathAbsenceV2,
  hashBuildTopologyPathEntryV2,
  hashBuildTopologyPathMembershipV2,
  hashBuildTopologyRuntimeContractV2,
  recursivelyFreezeBuildTopologyV2,
  type BuildTopologyCommandsV2,
  type BuildTopologyEntrypointV2,
  type BuildTopologyLogicalDependencyV2,
  type BuildTopologyLogicalIdentityV2,
  type BuildTopologyManifestHashPayloadV2,
  type BuildTopologyPathEntryHashPayloadV2,
  type BuildTopologyPathEntryV2,
  type BuildTopologyRuntimeTargetV2,
  type BuildTopologyV2,
} from "./schemas/build-topology-v2.js";
import type { FileTreeManifestV2 } from
  "./schemas/file-tree-manifest-v2.js";
import type { NodeExecutionLayoutV2 } from
  "./schemas/node-execution-layout-catalog-v2.js";
import type { BuildDependencyMaterializationReceiptV2 } from
  "./schemas/node-scaffold-private-materialization-v2.js";
import type { HostNodeToolchainLogicalProjectionV3 } from
  "./schemas/host-node-toolchain-receipt-v2.js";
import type { NodeScaffoldToolchainEntryV2 } from
  "./schemas/node-scaffold-toolchain-catalog-v2.js";
import {
  hashPortablePathCaseFoldIdentityV2,
  hashPortablePathIdentityV2,
  type NodeExecutionPathTokenSetV2,
  type PathTokenV2,
} from "./schemas/path-token-v2.js";

const INPUT_MAX_CANONICAL_BYTES_V2 = 14 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 = 18 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 20,
  maxNodes: INPUT_MAX_CANONICAL_BYTES_V2 + 90_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits: (INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (4 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V2,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 + 90_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2 * 8) + (4 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  fileTree: z.unknown(),
}).strict();

const VerifierInputV2Schema = CompilerInputV2Schema.extend({
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

export type BuildTopologyDiagnosticCodeV2 =
  | "BUILD_TOPOLOGY_V2_ARTIFACT_INVALID"
  | "BUILD_TOPOLOGY_V2_FILE_TREE_REJECTED"
  | "BUILD_TOPOLOGY_V2_INPUT_INVALID"
  | "BUILD_TOPOLOGY_V2_OUTPUT_LIMIT_EXCEEDED"
  | "BUILD_TOPOLOGY_V2_PRIVATE_STAGE_INVALID"
  | "BUILD_TOPOLOGY_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "BUILD_TOPOLOGY_V2_TEST_AUTHORITY_REQUIRED"
  | "BUILD_TOPOLOGY_V2_UPSTREAM_AUTHORITY_REJECTED";

export type BuildTopologyDiagnosticV2 = Readonly<{
  code: BuildTopologyDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type BuildTopologyCompilationResultV2 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      value: Readonly<BuildTopologyV2>;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly BuildTopologyDiagnosticV2[];
    }>;

function rejected(
  code: BuildTopologyDiagnosticCodeV2,
  path: string,
  message: string,
): BuildTopologyCompilationResultV2 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

class BuildTopologyAuthorityErrorV2 extends Error {
  constructor(message: string) {
    super(message.slice(0, 1_500));
    this.name = "BuildTopologyAuthorityErrorV2";
  }
}

function authorityFailure(message: string): never {
  throw new BuildTopologyAuthorityErrorV2(message);
}

type FreshAuthorityV2 = Readonly<{
  layout: Readonly<NodeExecutionLayoutV2>;
  pathSet: Readonly<NodeExecutionPathTokenSetV2>;
  entry: Readonly<NodeScaffoldToolchainEntryV2>;
  scaffoldResolutionHash: string;
}>;

function reproduceFreshAuthorityV2(input: Readonly<{
  productSpec: unknown;
  deliverySelection: unknown;
}>): FreshAuthorityV2 {
  const layout = resolveNodeExecutionLayoutV2(input);
  const paths = compileNodeExecutionPathTokenSetV2(input);
  const scaffold = resolveNodeScaffoldToolchainV2(input);
  if (layout.status !== "shadow_resolved") {
    return authorityFailure(
      layout.diagnostics[0]?.message ?? "Node execution layout was rejected",
    );
  }
  if (paths.status !== "shadow_compiled") {
    return authorityFailure(
      paths.diagnostics[0]?.message ?? "Node execution path tokens were rejected",
    );
  }
  if (scaffold.status !== "shadow_resolved") {
    return authorityFailure(
      scaffold.diagnostics[0]?.message ?? "Node scaffold resolution was rejected",
    );
  }
  const entry = getCodeOwnedNodeScaffoldToolchainEntryV2(
    scaffold.resolution.sourceAuthority.profileId,
  );
  if (
    !entry
    || layout.layout.layoutHash !== scaffold.resolution.sourceAuthority.layoutHash
    || paths.value.tokenSetHash !== scaffold.resolution.sourceAuthority.pathTokenSetHash
    || entry.entryHash !== scaffold.resolution.catalogBinding.entryHash
    || entry.layoutBinding.layoutHash !== layout.layout.layoutHash
    || entry.layoutBinding.pathSlotSetHash !== layout.layout.pathSlots.slotSetHash
  ) {
    return authorityFailure(
      "Fresh layout, path-token, scaffold catalog and resolution authorities diverged",
    );
  }
  return Object.freeze({
    layout: layout.layout,
    pathSet: paths.value,
    entry,
    scaffoldResolutionHash: scaffold.resolution.resolutionHash,
  });
}

function tokenBySlotV2(
  pathSet: Readonly<NodeExecutionPathTokenSetV2>,
  slotRef: string,
): Readonly<PathTokenV2> {
  const found = pathSet.tokens.filter((token) => token.origin.slotRef === slotRef);
  if (found.length !== 1) {
    authorityFailure(`Expected exactly one Node path token for ${slotRef}`);
  }
  return found[0]!;
}

function buildLogicalDependencyV2(
  receipt: Readonly<BuildDependencyMaterializationReceiptV2>,
  hostToolchain: HostNodeToolchainLogicalProjectionV3,
): BuildTopologyLogicalDependencyV2 {
  return {
    catalogHash: receipt.catalogBinding.catalogHash,
    scaffoldEntryHash: receipt.catalogBinding.entryHash,
    dependencyGraphHash: receipt.catalogBinding.dependencyGraphHash,
    environmentContractHash: receipt.environmentBinding.environmentContractHash,
    effectiveConfigHash: receipt.environmentBinding.effectiveConfigHash,
    nodeRuntimeLogicalHash: hostToolchain.nodeRuntimeLogicalHash,
    npmClosureLogicalHash: hostToolchain.npmClosureLogicalHash,
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
      schema: "setfarm.build-topology-dependency-lifecycle-policy-hash.v2",
      policy: receipt.lifecycleAndEnginePolicy,
    }),
    installedBinsMembershipHash: receipt.installedBins.membershipHash,
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
      schema: "setfarm.build-topology-dependency-capsule-authority-hash.v2",
      authority: receipt.dependencyCapsuleAuthority,
    }),
  };
}

function pathEntryV2(
  physicalSpace: "candidate_runtime" | "dependency_capsule" | "repository",
  normalizedLocator: string,
  value: Omit<
    BuildTopologyPathEntryHashPayloadV2,
    | "pathRef"
    | "physicalSpace"
    | "normalizedLocator"
    | "pathIdentityHash"
    | "caseFoldPathIdentityHash"
  >,
): BuildTopologyPathEntryV2 {
  const identity: BuildTopologyPathEntryHashPayloadV2 = {
    pathRef: deriveBuildTopologyPathRefV2(physicalSpace, normalizedLocator),
    physicalSpace,
    normalizedLocator,
    pathIdentityHash: hashPortablePathIdentityV2(physicalSpace, normalizedLocator),
    caseFoldPathIdentityHash:
      hashPortablePathCaseFoldIdentityV2(physicalSpace, normalizedLocator),
    ...value,
  };
  return BuildTopologyPathEntryV2Schema.parse({
    ...identity,
    entryHash: hashBuildTopologyPathEntryV2(identity),
  });
}

function buildCommandsV2(
  entry: Readonly<NodeScaffoldToolchainEntryV2>,
  dependency: Readonly<BuildDependencyMaterializationReceiptV2>,
): BuildTopologyCommandsV2 {
  return {
    environmentContractHash: dependency.environmentBinding.environmentContractHash,
    effectiveConfigHash: dependency.environmentBinding.effectiveConfigHash,
    install: {
      commandRef: dependency.installExecution.commandRef,
      executableRef: dependency.installExecution.executableRef,
      cwdRootRef: entry.recipes.install.cwdRootRef,
      directArgv: [...dependency.installExecution.directArgv],
      executionStatus: "verified_exited_zero",
      dependencyReceiptHash: dependency.receiptHash,
    },
    build: {
      commandRef: entry.recipes.build.commandRef,
      executableRef: entry.recipes.build.executableRef,
      cwdRootRef: entry.recipes.build.cwdRootRef,
      directArgv: structuredClone(entry.recipes.build.directArgv),
      requiredPreconditions: structuredClone(
        entry.recipes.build.requiredPreconditions,
      ),
      sourceReceiptState: "absent",
      executionStatus: "blocked_until_source_declarations_and_receipt",
    },
    test: {
      commandRef: entry.recipes.test.commandRef,
      executableRef: entry.recipes.test.executableRef,
      cwdRootRef: entry.recipes.test.cwdRootRef,
      directArgv: structuredClone(entry.recipes.test.directArgv),
      requiredPreconditions: structuredClone(
        entry.recipes.test.requiredPreconditions,
      ),
      canonicalReceiptSchema: entry.recipes.test.canonicalReceiptSchema,
      minimumTestCount: entry.recipes.test.minimumTestCount,
      zeroTestReceipt: entry.recipes.test.zeroTestReceipt,
      executionStatus: "blocked_until_build_and_test_source_receipts",
    },
  };
}

function buildRuntimeTargetV2(
  layout: Readonly<NodeExecutionLayoutV2>,
  candidateModulePathRef: string,
): BuildTopologyRuntimeTargetV2 {
  if (layout.runtimeTarget.kind === "cli") {
    return {
      kind: "cli",
      launcherRef: layout.profileBinding.launcherRef as "LAUNCH_NODE_CLI_V2",
      entrypointAbi: layout.runtimeTarget.entrypointAbi,
      argvOwnership: layout.runtimeTarget.argvOwnership,
      nodeOptionTokens: [],
      candidateModulePathRef,
      transportArguments: layout.runtimeTarget.transportArguments,
      executionStatus: "blocked_until_candidate_materialization",
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
    executionStatus: "blocked_until_candidate_materialization",
  };
}

function assertExactJoinsV2(input: Readonly<{
  fresh: FreshAuthorityV2;
  fileTree: Readonly<FileTreeManifestV2>;
  dependency: Readonly<BuildDependencyMaterializationReceiptV2>;
  inspectedDependency: Readonly<BuildDependencyMaterializationReceiptV2>;
  baseReceiptHash: string;
  baseSemanticInputHash: string;
  baseStateHash: string;
}>): void {
  const { fresh, fileTree, dependency } = input;
  if (
    dependency.receiptHash !== input.inspectedDependency.receiptHash
    || dependency.scaffoldBase.receiptHash !== input.baseReceiptHash
    || dependency.scaffoldBase.semanticInputHash !== input.baseSemanticInputHash
    || dependency.scaffoldBase.startBaseStateHash !== input.baseStateHash
    || dependency.scaffoldBase.semanticInputHash
      !== fileTree.authority.scaffoldBaseSemanticInputHash
    || dependency.scaffoldBase.startBaseStateHash
      !== fileTree.authority.scaffoldBaseStateHash
    || dependency.catalogBinding.catalogHash !== fileTree.authority.scaffoldCatalogHash
    || dependency.catalogBinding.entryHash !== fileTree.authority.scaffoldEntryHash
    || dependency.catalogBinding.profileId !== fileTree.authority.profileId
    || dependency.catalogBinding.dependencyGraphHash
      !== fresh.entry.dependencyGraph.graphHash
    || fileTree.authority.nodeExecutionLayoutHash !== fresh.layout.layoutHash
    || fileTree.authority.nodePathTokenSetHash !== fresh.pathSet.tokenSetHash
    || fileTree.authority.scaffoldResolutionHash !== fresh.scaffoldResolutionHash
    || fileTree.authority.scaffoldEntryHash !== fresh.entry.entryHash
  ) {
    authorityFailure(
      "FileTree, dependency receipt, scaffold base and fresh Node authorities do not join",
    );
  }
}

function buildTopologyV2(input: Readonly<{
  fresh: FreshAuthorityV2;
  fileTree: Readonly<FileTreeManifestV2>;
  dependency: Readonly<BuildDependencyMaterializationReceiptV2>;
  hostToolchain: HostNodeToolchainLogicalProjectionV3;
}>): BuildTopologyV2 {
  const { fresh, fileTree, dependency, hostToolchain } = input;
  const logicalDependency = buildLogicalDependencyV2(
    dependency,
    hostToolchain,
  );
  const logicalDependencyHash = hashBuildTopologyLogicalDependencyV2(
    logicalDependency,
  );
  const fileTreePaths = fileTree.paths.map((entry) => {
    const identity = fileTreePathProjectionForBuildTopologyV2(
      fileTree.manifestHash,
      entry,
    );
    return BuildTopologyPathEntryV2Schema.parse({
      ...identity,
      entryHash: hashBuildTopologyPathEntryV2(identity),
    });
  });
  const rawDependencies = pathEntryV2("repository", "node_modules", {
    classification: "raw_dependency_build_input",
    ownerRef: "OWNER_SETUP_V2",
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
      generatedNpmLinks: "required_and_verified_for_compiler_command",
    },
  });
  const runtimeCapsule = pathEntryV2("dependency_capsule", "node_modules", {
    classification: "readonly_dependency_runtime_capsule",
    ownerRef: "OWNER_SETUP_V2",
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
  const outputToken = tokenBySlotV2(
    fresh.pathSet,
    fresh.layout.sourceToRuntime.buildOutputPathSlotRef,
  );
  const buildOutput = pathEntryV2("repository", outputToken.normalizedLocator, {
    classification: "build_output",
    ownerRef: "OWNER_SETUP_V2",
    writeGrantOwnerRefs: [],
    access: "build_generated_future",
    currentState: {
      state: "absent",
      absenceHash: hashBuildTopologyPathAbsenceV2(
        "repository",
        outputToken.normalizedLocator,
      ),
      evidence: "authenticated_dependency_stage_exact_project_inventory_v2",
    },
    authority: {
      kind: "build_output_plan",
      layoutHash: fresh.layout.layoutHash,
      pathSlotRef: fresh.layout.sourceToRuntime.buildOutputPathSlotRef,
      pathToken: outputToken.pathToken,
      tokenBindingHash: outputToken.bindingHash,
      requiredReceiptSchema: "setfarm.canonical-build-receipt.v2",
      receiptState: "absent",
    },
  });
  const candidateToken = tokenBySlotV2(
    fresh.pathSet,
    fresh.layout.sourceToRuntime.candidateModulePathSlotRef,
  );
  const candidateModule = pathEntryV2(
    "candidate_runtime",
    candidateToken.normalizedLocator,
    {
      classification: "candidate_module",
      ownerRef: "OWNER_SETUP_V2",
      writeGrantOwnerRefs: [],
      access: "candidate_generated_future",
      currentState: {
        state: "not_materialized",
        disposition: "future_candidate_materialization_only",
      },
      authority: {
        kind: "candidate_module_plan",
        layoutHash: fresh.layout.layoutHash,
        pathSlotRef: fresh.layout.sourceToRuntime.candidateModulePathSlotRef,
        pathToken: candidateToken.pathToken,
        tokenBindingHash: candidateToken.bindingHash,
        materializationState: "absent",
      },
    },
  );
  const paths = [
    ...fileTreePaths,
    rawDependencies,
    runtimeCapsule,
    buildOutput,
    candidateModule,
  ].sort((left, right) => compareUtf16(
    `${left.physicalSpace}\0${left.normalizedLocator}`,
    `${right.physicalSpace}\0${right.normalizedLocator}`,
  ));
  const sourcePath = fileTree.paths.find((entry) =>
    entry.authority.kind === "node_entrypoint_plan");
  if (!sourcePath) authorityFailure("Verified FileTree lacks its canonical entrypoint");
  const entrypoint: BuildTopologyEntrypointV2 = {
    kind: fresh.layout.kind === "cli" ? "cli" : "api",
    sourcePathRef: sourcePath.pathRef,
    buildOutputPathRef: buildOutput.pathRef,
    candidateModulePathRef: candidateModule.pathRef,
    sourceToRuntime: {
      sourceMediaType: fresh.layout.sourceToRuntime.sourceMediaType,
      outputMediaType: fresh.layout.sourceToRuntime.outputMediaType,
      moduleSystem: fresh.layout.sourceToRuntime.moduleSystem,
    },
    sourceReceipt: {
      schema: "setfarm.node-entrypoint-source-receipt.v2",
      state: "absent",
      missingDisposition: "typed_precondition_rejection",
    },
  };
  const commands = buildCommandsV2(fresh.entry, dependency);
  const runtimeTarget = buildRuntimeTargetV2(
    fresh.layout,
    candidateModule.pathRef,
  );
  const logicalIdentity: BuildTopologyLogicalIdentityV2 = {
    schema: BUILD_TOPOLOGY_V2_SCHEMA,
    topologyVersion: BUILD_TOPOLOGY_VERSION_V2,
    contractHash: BUILD_TOPOLOGY_CONTRACT_HASH_V2,
    stage: "dependencies_ready",
    readiness: {
      status: "shadow_blocked",
      productionUse: "forbidden",
      blockerCodes: [...BUILD_TOPOLOGY_BLOCKER_CODES_V2],
    },
    authority: {
      productRef: fileTree.authority.productRef,
      productSpecHash: fileTree.authority.productSpecHash,
      deliverySelectionHash: fileTree.authority.deliverySelectionHash,
      profileId: fileTree.authority.profileId,
      stackPackId: fileTree.authority.stackPackId,
      fileTree: {
        schema: fileTree.schema,
        version: fileTree.manifestVersion,
        contractHash: fileTree.contractHash,
        manifestHash: fileTree.manifestHash,
        pathCount: fileTree.pathCount,
        pathMembershipHash: fileTree.pathMembershipHash,
        ownerMembershipHash: fileTree.ownerMembershipHash,
      },
      layoutHash: fresh.layout.layoutHash,
      pathTokenSetHash: fresh.pathSet.tokenSetHash,
      scaffoldResolutionHash: fresh.scaffoldResolutionHash,
      scaffoldEntryHash: fresh.entry.entryHash,
      logicalDependencyHash,
      logicalPathMembershipHash: hashBuildTopologyLogicalPathMembershipV2(paths),
      commandContractHash: hashBuildTopologyCommandContractV2(commands),
      runtimeContractHash: hashBuildTopologyRuntimeContractV2(runtimeTarget),
      entrypointContractHash: hashBuildTopologyEntrypointContractV2(entrypoint),
    },
  };
  const identity: BuildTopologyManifestHashPayloadV2 = {
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
    pathCount: paths.length,
    paths,
    pathMembershipHash: hashBuildTopologyPathMembershipV2(paths),
    entrypoint,
    commands,
    runtimeTarget,
    testSource: {
      authorityState: "absent",
      requiredMinimumTestCount: 1,
      zeroTestAcceptance: "forbidden",
      blockerCode: "BUILD_TOPOLOGY_V2_TEST_SOURCE_AUTHORITY_UNVERIFIED",
    },
    logicalBuildHash: hashBuildTopologyLogicalBuildV2(logicalIdentity),
  };
  return BuildTopologyV2Schema.parse({
    ...identity,
    manifestHash: hashBuildTopologyManifestV2(identity),
  });
}

async function compileInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<BuildTopologyCompilationResultV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      INPUT_MAX_CANONICAL_BYTES_V2,
      INPUT_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    return rejected("BUILD_TOPOLOGY_V2_INPUT_INVALID", "/", errorMessage(error));
  }
  const parsed = CompilerInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return rejected(
      "BUILD_TOPOLOGY_V2_INPUT_INVALID",
      `/${parsed.error.issues[0]?.path.map(String).join("/") ?? ""}`
        .replace(/\/$/u, "") || "/",
      parsed.error.issues[0]?.message ?? "Build-topology compiler input is invalid",
    );
  }
  try {
    const production = isProductionNodeScaffoldPrivateStageV2(handle);
    if (expectedScope === "production_host" && !production) {
      return rejected(
        "BUILD_TOPOLOGY_V2_PRODUCTION_AUTHORITY_REQUIRED",
        "/stage",
        "Production BuildTopology compiler requires production_host authority",
      );
    }
    if (expectedScope === "test_fixture" && production) {
      return rejected(
        "BUILD_TOPOLOGY_V2_TEST_AUTHORITY_REQUIRED",
        "/stage",
        "Test BuildTopology compiler cannot consume or downgrade production authority",
      );
    }
    const verifiedFileTree = expectedScope === "production_host"
      ? await verifyFileTreeManifestV2AtDependencyStage(handle, {
          productSpec: parsed.data.productSpec,
          deliverySelection: parsed.data.deliverySelection,
          candidate: parsed.data.fileTree,
        })
      : await verifyFileTreeManifestV2AtDependencyStageForTest(handle, {
          productSpec: parsed.data.productSpec,
          deliverySelection: parsed.data.deliverySelection,
          candidate: parsed.data.fileTree,
        });
    const dependency = await revalidateNodeScaffoldDependenciesV2(handle);
    const hostToolchain =
      await revalidateNodeScaffoldStageHostToolchainLogicalIdentityInternalV3(
        handle,
      );
    const inspectedDependency = inspectBuildDependencyMaterializationReceiptV2(handle);
    const base = inspectScaffoldBaseMaterializationReceiptV2(handle);
    const fresh = reproduceFreshAuthorityV2({
      productSpec: parsed.data.productSpec,
      deliverySelection: parsed.data.deliverySelection,
    });
    assertExactJoinsV2({
      fresh,
      fileTree: verifiedFileTree.value,
      dependency,
      inspectedDependency,
      baseReceiptHash: base.receiptHash,
      baseSemanticInputHash: base.semanticInputHash,
      baseStateHash: base.baseStateHash,
    });
    const value = recursivelyFreezeBuildTopologyV2(buildTopologyV2({
      fresh,
      fileTree: verifiedFileTree.value,
      dependency,
      hostToolchain,
    }));
    let canonicalBytes: Buffer;
    try {
      canonicalBytes = canonicalJsonBytesBounded(value, {
        maxBytes: BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V2,
        ...BUILD_TOPOLOGY_BOUNDED_WORK_LIMITS_V2,
      });
    } catch (error) {
      return rejected(
        "BUILD_TOPOLOGY_V2_OUTPUT_LIMIT_EXCEEDED",
        "/",
        errorMessage(error),
      );
    }
    return recursivelyFreezeBuildTopologyV2({
      status: "shadow_compiled" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      value,
      canonicalBytes: canonicalBytes.toString("utf8"),
    });
  } catch (error) {
    return rejected(
      error instanceof FileTreeManifestVerificationErrorV2
        ? "BUILD_TOPOLOGY_V2_FILE_TREE_REJECTED"
        : error instanceof NodeScaffoldPrivateMaterializerErrorV2
          ? "BUILD_TOPOLOGY_V2_PRIVATE_STAGE_INVALID"
          : error instanceof BuildTopologyAuthorityErrorV2
            ? "BUILD_TOPOLOGY_V2_UPSTREAM_AUTHORITY_REJECTED"
            : "BUILD_TOPOLOGY_V2_ARTIFACT_INVALID",
      "/",
      errorMessage(error),
    );
  }
}

export function compileBuildTopologyV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<BuildTopologyCompilationResultV2> {
  return compileInternalV2(handle, input, "production_host");
}

export function compileBuildTopologyV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<BuildTopologyCompilationResultV2> {
  return compileInternalV2(handle, input, "test_fixture");
}

export type BuildTopologyVerificationErrorCodeV2 =
  | "BUILD_TOPOLOGY_V2_VERIFICATION_AUTHORITY_MISMATCH"
  | "BUILD_TOPOLOGY_V2_VERIFICATION_CANDIDATE_INVALID"
  | "BUILD_TOPOLOGY_V2_VERIFICATION_INPUT_INVALID"
  | "BUILD_TOPOLOGY_V2_VERIFICATION_REPRODUCTION_REJECTED";

export class BuildTopologyVerificationErrorV2 extends Error {
  readonly code: BuildTopologyVerificationErrorCodeV2;

  constructor(code: BuildTopologyVerificationErrorCodeV2, message: string) {
    super(message.slice(0, 1_500));
    this.name = "BuildTopologyVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowBuildTopologyV2 = Readonly<{
  status: "verified_shadow";
  value: Readonly<BuildTopologyV2>;
  canonicalBytes: string;
}>;

async function verifyInternalV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<VerifiedShadowBuildTopologyV2> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V2,
      VERIFIER_BOUNDED_WORK_LIMITS_V2,
    );
  } catch (error) {
    throw new BuildTopologyVerificationErrorV2(
      "BUILD_TOPOLOGY_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new BuildTopologyVerificationErrorV2(
      "BUILD_TOPOLOGY_V2_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "Build-topology verifier input is invalid",
    );
  }
  const candidate = BuildTopologyV2Schema.safeParse(parsed.data.candidate);
  if (!candidate.success) {
    throw new BuildTopologyVerificationErrorV2(
      "BUILD_TOPOLOGY_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Build-topology candidate is invalid",
    );
  }
  const reproduced = await compileInternalV2(handle, {
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
    fileTree: parsed.data.fileTree,
  }, expectedScope);
  if (reproduced.status !== "shadow_compiled") {
    throw new BuildTopologyVerificationErrorV2(
      "BUILD_TOPOLOGY_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Fresh BuildTopology reproduction failed",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== reproduced.canonicalBytes) {
    throw new BuildTopologyVerificationErrorV2(
      "BUILD_TOPOLOGY_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "BuildTopology candidate does not equal fresh FileTree, layout and authenticated dependency authority",
    );
  }
  return recursivelyFreezeBuildTopologyV2({
    status: "verified_shadow" as const,
    value: reproduced.value,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

export function verifyBuildTopologyV2(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowBuildTopologyV2> {
  return verifyInternalV2(handle, input, "production_host");
}

export function verifyBuildTopologyV2ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<VerifiedShadowBuildTopologyV2> {
  return verifyInternalV2(handle, input, "test_fixture");
}
