import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../bounded-canonical-json.js";
import { hashCanonicalJson } from "../canonical-json.js";
import {
  NormalizedRelativeLocatorSchema,
  OwnerIdSchema,
  PathBindingIdSchema,
  ProductIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  FILE_TREE_MANIFEST_CONTRACT_HASH_V2,
  FILE_TREE_MANIFEST_V2_SCHEMA,
  FILE_TREE_MANIFEST_VERSION_V2,
  FileTreePathEntryV2Schema,
  deriveFileTreePathRefV2,
  hashFileTreePathMembershipV2,
  type FileTreePathEntryV2,
} from "./file-tree-manifest-v2.js";
import {
  BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA,
  PRIVATE_STAGED_MATERIALIZER_VERSION_V2,
} from "./node-scaffold-private-materialization-v2.js";
import {
  NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2,
  NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2,
} from "./node-scaffold-toolchain-catalog-v2.js";
import {
  hashPortablePathCaseFoldIdentityV2,
  hashPortablePathIdentityV2,
  portablePathIssuesV2,
} from "./path-token-v2.js";

export const BUILD_TOPOLOGY_V2_SCHEMA = "setfarm.build-topology.v2" as const;
export const BUILD_TOPOLOGY_VERSION_V2 = "2.0.0" as const;
export const BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V2 = 4 * 1024 * 1024;
export const BUILD_TOPOLOGY_BOUNDED_WORK_LIMITS_V2 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 16,
  maxNodes: BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V2 + 30_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V2 * 8) + (2 * 1024 * 1024),
});

export const BUILD_TOPOLOGY_BLOCKER_CODES_V2 = Object.freeze([
  "BUILD_TOPOLOGY_V2_BUILD_EXECUTION_UNVERIFIED",
  "BUILD_TOPOLOGY_V2_CANDIDATE_MATERIALIZATION_UNVERIFIED",
  "BUILD_TOPOLOGY_V2_NODE_ENTRYPOINT_SOURCE_RECEIPT_UNVERIFIED",
  "BUILD_TOPOLOGY_V2_NODE_RULE_GENERATOR_TRANSITION_UNVERIFIED",
  "BUILD_TOPOLOGY_V2_RELEASE_ACTIVATION_UNVERIFIED",
  "BUILD_TOPOLOGY_V2_SEMANTIC_DECLARATIONS_UNVERIFIED",
  "BUILD_TOPOLOGY_V2_TEST_SOURCE_AUTHORITY_UNVERIFIED",
] as const);

export const BUILD_TOPOLOGY_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.build-topology-contract.v2" as const,
  contractVersion: BUILD_TOPOLOGY_VERSION_V2,
  stage: "dependencies_ready" as const,
  sourceAuthorities: Object.freeze([
    "verified_file_tree_manifest_v2",
    "fresh_node_execution_layout_v2",
    "fresh_node_execution_path_token_set_v2",
    "fresh_node_scaffold_resolution_v2",
    "authenticated_build_dependency_materialization_receipt_v2",
  ] as const),
  pathClasses: Object.freeze([
    "file_tree_projection",
    "raw_dependency_build_input",
    "readonly_dependency_runtime_capsule",
    "build_output",
    "candidate_module",
  ] as const),
  dependencyRoles: Object.freeze({
    rawNodeModules: "disposable_compile_only_input" as const,
    readonlyCapsule: "future_candidate_runtime_copy_source" as const,
    generatedNpmLinks: "raw_only_for_compiler_command" as const,
  }),
  identitySeparation: Object.freeze({
    retryAndSemanticIdentity: "logicalBuildHash" as const,
    executionEvidenceIdentity: "manifestHash" as const,
    excludedFromLogicalBuildHash: Object.freeze([
      "admissionScope",
      "dependencyIdentityHash",
      "dependencyReceiptHash",
      "environmentReceiptHash",
      "hostToolchainReceiptHash",
      "projectScopeHash",
      "scaffoldBaseReceiptHash",
      "stdoutHash",
      "stderrHash",
    ] as const),
  }),
  sourceLifecycle: Object.freeze({
    entrypointReceipt: "absent_blocking" as const,
    buildOutput: "physically_absent_before_build" as const,
    candidateModule: "not_materialized" as const,
    minimumTestCount: 1 as const,
  }),
  blockerCodes: BUILD_TOPOLOGY_BLOCKER_CODES_V2,
  hashDomains: Object.freeze({
    repositoryPathRef: "setfarm.file-tree-path-ref.v2" as const,
    nonRepositoryPathRef: "setfarm.build-topology-path-ref.v2" as const,
    pathAbsence: "setfarm.build-topology-path-absence.v2" as const,
    pathEntry: "setfarm.build-topology-path-entry-hash.v2" as const,
    pathMembership: "setfarm.build-topology-path-membership-hash.v2" as const,
    logicalPathMembership:
      "setfarm.build-topology-logical-path-membership-hash.v2" as const,
    logicalDependency: "setfarm.build-topology-logical-dependency-hash.v2" as const,
    commandContract: "setfarm.build-topology-command-contract-hash.v2" as const,
    runtimeContract: "setfarm.build-topology-runtime-contract-hash.v2" as const,
    entrypointContract: "setfarm.build-topology-entrypoint-contract-hash.v2" as const,
    logicalBuild: "setfarm.build-topology-logical-build-hash.v2" as const,
    manifest: "setfarm.build-topology-manifest-hash.v2" as const,
  }),
} as const);

export const BUILD_TOPOLOGY_CONTRACT_HASH_V2 = hashCanonicalJson(
  BUILD_TOPOLOGY_CONTRACT_V2,
);

const BuildTopologyBlockerCodeV2Schema = z.enum(BUILD_TOPOLOGY_BLOCKER_CODES_V2);
const ProfileIdV2Schema = z.enum([
  "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
  "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
]);
const StackPackIdV2Schema = z.enum(["node-cli", "node-express-api"]);
const PhysicalSpaceV2Schema = z.enum([
  "candidate_runtime",
  "dependency_capsule",
  "repository",
]);

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) =>
      index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

export function deriveBuildTopologyPathRefV2(
  physicalSpace: "candidate_runtime" | "dependency_capsule" | "repository",
  normalizedLocator: string,
): string {
  if (physicalSpace === "repository") {
    return deriveFileTreePathRefV2("repository", normalizedLocator);
  }
  return `PATH_${hashCanonicalJson({
    schema: "setfarm.build-topology-path-ref.v2",
    physicalSpace,
    normalizedLocator,
  }).toUpperCase()}`;
}

export function hashBuildTopologyPathAbsenceV2(
  physicalSpace: "candidate_runtime" | "dependency_capsule" | "repository",
  normalizedLocator: string,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-path-absence.v2",
    physicalSpace,
    normalizedLocator,
  });
}

const FileTreeProjectionStateV2Schema = z.object({
  state: z.literal("file_tree_projection"),
  fileTreeEntryHash: Sha256Schema,
  projectedState: z.enum(["absent", "present_file"]),
}).strict();

const RawDependencyTreeStateV2Schema = z.object({
  state: z.literal("present_raw_dependency_tree"),
  fileCount: z.number().int().positive().max(100_000),
  directoryCount: z.number().int().positive().max(20_000),
  symbolicLinkCount: z.number().int().nonnegative().max(2_000),
  totalBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
  membershipHash: Sha256Schema,
  mutationPolicy: z.literal("private_disposable_install_output_v2"),
}).strict();

const DependencyCapsuleStateV2Schema = z.object({
  state: z.literal("present_readonly_dependency_capsule"),
  treeHash: Sha256Schema,
  payloadHash: Sha256Schema,
  rootMode: z.literal("0555"),
  fileCount: z.number().int().positive().max(100_000),
  directoryCount: z.number().int().nonnegative().max(20_000),
  totalBytes: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
}).strict();

const AbsentPathStateV2Schema = z.object({
  state: z.literal("absent"),
  absenceHash: Sha256Schema,
  evidence: z.literal("authenticated_dependency_stage_exact_project_inventory_v2"),
}).strict();

const PlannedPathStateV2Schema = z.object({
  state: z.literal("not_materialized"),
  disposition: z.literal("future_candidate_materialization_only"),
}).strict();

export const BuildTopologyPathStateV2Schema = z.discriminatedUnion("state", [
  FileTreeProjectionStateV2Schema,
  RawDependencyTreeStateV2Schema,
  DependencyCapsuleStateV2Schema,
  AbsentPathStateV2Schema,
  PlannedPathStateV2Schema,
]);

const FileTreePathAuthorityV2Schema = z.object({
  kind: z.literal("file_tree_path"),
  fileTreeManifestHash: Sha256Schema,
  fileTreeEntryHash: Sha256Schema,
}).strict();

const RawDependencyAuthorityV2Schema = z.object({
  kind: z.literal("raw_dependency_build_input"),
  dependencyReceiptHash: Sha256Schema,
  logicalDependencyHash: Sha256Schema,
  use: z.literal("disposable_compile_only_input"),
  generatedNpmLinks: z.literal("required_and_verified_for_compiler_command"),
}).strict();

const DependencyCapsuleAuthorityV2Schema = z.object({
  kind: z.literal("readonly_dependency_runtime_capsule"),
  dependencyReceiptHash: Sha256Schema,
  logicalDependencyHash: Sha256Schema,
  use: z.literal("future_candidate_runtime_copy_source"),
  generatedNpmLinks: z.literal("excluded"),
}).strict();

const BuildOutputAuthorityV2Schema = z.object({
  kind: z.literal("build_output_plan"),
  layoutHash: Sha256Schema,
  pathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_BUILD_OUTPUT_V2",
    "PATH_SLOT_NODE_API_BUILD_OUTPUT_V2",
  ]),
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  requiredReceiptSchema: z.literal("setfarm.canonical-build-receipt.v2"),
  receiptState: z.literal("absent"),
}).strict();

const CandidateModuleAuthorityV2Schema = z.object({
  kind: z.literal("candidate_module_plan"),
  layoutHash: Sha256Schema,
  pathSlotRef: z.enum([
    "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2",
    "PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2",
  ]),
  pathToken: Sha256Schema,
  tokenBindingHash: Sha256Schema,
  materializationState: z.literal("absent"),
}).strict();

export const BuildTopologyPathAuthorityV2Schema = z.discriminatedUnion("kind", [
  FileTreePathAuthorityV2Schema,
  RawDependencyAuthorityV2Schema,
  DependencyCapsuleAuthorityV2Schema,
  BuildOutputAuthorityV2Schema,
  CandidateModuleAuthorityV2Schema,
]);

const BuildTopologyPathEntryIdentityV2Schema = z.object({
  pathRef: PathBindingIdSchema,
  physicalSpace: PhysicalSpaceV2Schema,
  normalizedLocator: NormalizedRelativeLocatorSchema,
  pathIdentityHash: Sha256Schema,
  caseFoldPathIdentityHash: Sha256Schema,
  classification: z.enum([
    "build_output",
    "candidate_module",
    "compatibility_rejected",
    "config_absence",
    "config_readonly",
    "entrypoint_generated",
    "raw_dependency_build_input",
    "readonly_dependency_runtime_capsule",
    "source_writable",
  ]),
  ownerRef: OwnerIdSchema,
  writeGrantOwnerRefs: z.array(OwnerIdSchema).max(5_000),
  access: z.enum([
    "build_generated_future",
    "candidate_generated_future",
    "dependency_compile_input",
    "dependency_runtime_readonly",
    "forbidden",
    "generator_whole_file_future",
    "model_granted_writable",
    "model_owned_writable",
    "setup_readonly",
  ]),
  currentState: BuildTopologyPathStateV2Schema,
  authority: BuildTopologyPathAuthorityV2Schema,
}).strict();

export type BuildTopologyPathEntryHashPayloadV2 = z.infer<
  typeof BuildTopologyPathEntryIdentityV2Schema
>;

export function hashBuildTopologyPathEntryV2(
  value: BuildTopologyPathEntryHashPayloadV2 | BuildTopologyPathEntryV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.entryHash;
  return hashCanonicalJson({
    schema: "setfarm.build-topology-path-entry-hash.v2",
    entry: payload,
  });
}

export const BuildTopologyPathEntryV2Schema =
  BuildTopologyPathEntryIdentityV2Schema.extend({
    entryHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    for (const issue of portablePathIssuesV2(value.normalizedLocator, { allowEmpty: false })) {
      context.addIssue({ code: "custom", path: ["normalizedLocator"], message: issue });
    }
    if (
      value.pathRef
        !== deriveBuildTopologyPathRefV2(value.physicalSpace, value.normalizedLocator)
      || value.pathIdentityHash
        !== hashPortablePathIdentityV2(value.physicalSpace, value.normalizedLocator)
      || value.caseFoldPathIdentityHash
        !== hashPortablePathCaseFoldIdentityV2(
          value.physicalSpace,
          value.normalizedLocator,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["pathRef"],
        message: "Build-topology path identity must bind its exact physical space and locator",
      });
    }
    if (
      value.currentState.state === "absent"
      && value.currentState.absenceHash !== hashBuildTopologyPathAbsenceV2(
        value.physicalSpace,
        value.normalizedLocator,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["currentState", "absenceHash"],
        message: "Absent build-topology paths require their path-specific absence hash",
      });
    }
    if (!canonicalStrings(value.writeGrantOwnerRefs)) {
      context.addIssue({
        code: "custom",
        path: ["writeGrantOwnerRefs"],
        message: "Build-topology write grants must be unique and canonical",
      });
    }
    if (value.entryHash !== hashBuildTopologyPathEntryV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["entryHash"],
        message: "Build-topology path entry hash must bind the complete entry",
      });
    }
  });

export type BuildTopologyPathEntryV2 = z.infer<
  typeof BuildTopologyPathEntryV2Schema
>;

function logicalPathProjectionV2(entry: BuildTopologyPathEntryV2) {
  const authority = entry.authority.kind === "raw_dependency_build_input"
    ? {
        ...entry.authority,
        dependencyReceiptHash: undefined,
      }
    : entry.authority.kind === "readonly_dependency_runtime_capsule"
      ? {
          ...entry.authority,
          dependencyReceiptHash: undefined,
        }
      : entry.authority;
  const normalizedAuthority = { ...authority } as Record<string, unknown>;
  delete normalizedAuthority.dependencyReceiptHash;
  return {
    pathRef: entry.pathRef,
    physicalSpace: entry.physicalSpace,
    normalizedLocator: entry.normalizedLocator,
    classification: entry.classification,
    ownerRef: entry.ownerRef,
    writeGrantOwnerRefs: entry.writeGrantOwnerRefs,
    access: entry.access,
    currentState: entry.currentState,
    authority: normalizedAuthority,
  };
}

export function hashBuildTopologyPathMembershipV2(
  paths: readonly Pick<BuildTopologyPathEntryV2, "pathRef" | "entryHash">[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-path-membership-hash.v2",
    paths: paths.map((path) => ({ pathRef: path.pathRef, entryHash: path.entryHash })),
  });
}

export function hashBuildTopologyLogicalPathMembershipV2(
  paths: readonly BuildTopologyPathEntryV2[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-logical-path-membership-hash.v2",
    paths: paths.map(logicalPathProjectionV2),
  });
}

export const BuildTopologyLogicalDependencyV2Schema = z.object({
  catalogHash: Sha256Schema,
  scaffoldEntryHash: Sha256Schema,
  dependencyGraphHash: Sha256Schema,
  environmentContractHash: Sha256Schema,
  effectiveConfigHash: Sha256Schema,
  nodeIdentityHash: Sha256Schema,
  npmClosureHash: Sha256Schema,
  npmVersion: z.literal("10.9.8"),
  installDirectArgvHash: Sha256Schema,
  graph: z.object({
    lockRawHash: Sha256Schema,
    nodeCount: z.number().int().positive().max(1_000),
    edgeCount: z.number().int().positive().max(4_000),
    installedPackageMembershipHash: Sha256Schema,
    hiddenLockRawHash: Sha256Schema,
    hiddenLockGraphHash: Sha256Schema,
  }).strict(),
  lifecycleAndEnginePolicyHash: Sha256Schema,
  installedBinsMembershipHash: Sha256Schema,
  rawInstallTree: RawDependencyTreeStateV2Schema.omit({ state: true }),
  dependencyCapsule: DependencyCapsuleStateV2Schema.omit({ state: true }),
  dependencyCapsuleAuthorityHash: Sha256Schema,
}).strict();

export type BuildTopologyLogicalDependencyV2 = z.infer<
  typeof BuildTopologyLogicalDependencyV2Schema
>;

export function hashBuildTopologyLogicalDependencyV2(
  value: BuildTopologyLogicalDependencyV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-logical-dependency-hash.v2",
    dependency: value,
  });
}

const RequiredPreconditionV2Schema = z.object({
  authorityRef: StableReferenceSchema,
  receiptSchema: z.string().min(1).max(200),
  missingDisposition: z.literal("typed_precondition_rejection"),
}).strict();

export const BuildTopologyCommandsV2Schema = z.object({
  environmentContractHash: Sha256Schema,
  effectiveConfigHash: Sha256Schema,
  install: z.object({
    commandRef: z.literal("CMD_NODE_SCAFFOLD_INSTALL_V2"),
    executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
    directArgv: z.tuple([
      z.literal("npm"),
      z.literal("ci"),
      z.literal("--include=dev"),
      z.literal("--ignore-scripts"),
      z.literal("--no-audit"),
      z.literal("--no-fund"),
    ]),
    executionStatus: z.literal("verified_exited_zero"),
    dependencyReceiptHash: Sha256Schema,
  }).strict(),
  build: z.object({
    commandRef: z.literal("CMD_BUILD"),
    executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
    directArgv: z.tuple([
      z.literal("npm"),
      z.literal("run"),
      z.literal("build"),
    ]),
    requiredPreconditions: z.array(RequiredPreconditionV2Schema)
      .length(NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2.length),
    sourceReceiptState: z.literal("absent"),
    executionStatus: z.literal("blocked_until_source_declarations_and_receipt"),
  }).strict(),
  test: z.object({
    commandRef: z.literal("CMD_TEST"),
    executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    cwdRootRef: z.literal("PATH_ROOT_NODE_REPOSITORY_V2"),
    directArgv: z.tuple([z.literal("npm"), z.literal("test")]),
    requiredPreconditions: z.array(RequiredPreconditionV2Schema)
      .length(NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2.length),
    canonicalReceiptSchema: z.literal("setfarm.canonical-test-receipt.v2"),
    minimumTestCount: z.literal(1),
    zeroTestReceipt: z.literal("forbidden"),
    executionStatus: z.literal("blocked_until_build_and_test_source_receipts"),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (
    JSON.stringify(value.build.requiredPreconditions)
      !== JSON.stringify(NODE_SCAFFOLD_BUILD_REQUIRED_PRECONDITIONS_V2)
    || JSON.stringify(value.test.requiredPreconditions)
      !== JSON.stringify(NODE_SCAFFOLD_TEST_REQUIRED_PRECONDITIONS_V2)
  ) {
    context.addIssue({
      code: "custom",
      path: ["build", "requiredPreconditions"],
      message: "Build and test commands must preserve their exact code-owned preconditions",
    });
  }
});

export type BuildTopologyCommandsV2 = z.infer<typeof BuildTopologyCommandsV2Schema>;

function commandContractProjectionV2(value: BuildTopologyCommandsV2) {
  return {
    environmentContractHash: value.environmentContractHash,
    effectiveConfigHash: value.effectiveConfigHash,
    install: {
      commandRef: value.install.commandRef,
      executableRef: value.install.executableRef,
      cwdRootRef: value.install.cwdRootRef,
      directArgv: value.install.directArgv,
    },
    build: value.build,
    test: value.test,
  };
}

export function hashBuildTopologyCommandContractV2(
  value: BuildTopologyCommandsV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-command-contract-hash.v2",
    commands: commandContractProjectionV2(value),
  });
}

export const BuildTopologyRuntimeTargetV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cli"),
    launcherRef: z.literal("LAUNCH_NODE_CLI_V2"),
    entrypointAbi: z.literal("NODE_ESM_CLI_ENTRYPOINT_ABI_V2"),
    argvOwnership: z.literal("executable_invocation_transport_binding_v2"),
    nodeOptionTokens: z.tuple([]),
    candidateModulePathRef: PathBindingIdSchema,
    transportArguments: z.literal("append_after_module"),
    executionStatus: z.literal("blocked_until_candidate_materialization"),
  }).strict(),
  z.object({
    kind: z.literal("http_handler"),
    launcherRef: z.literal("LAUNCH_NODE_EXPRESS_API_V2"),
    candidateModulePathRef: PathBindingIdSchema,
    exportName: z.literal("setfarmHttpHandlerV2"),
    handlerAbi: z.literal("EXPRESS_REQUEST_HANDLER_ABI_V2"),
    serverOwnership: z.literal("platform_owned"),
    listenerOwnership: z.literal("platform_owned"),
    socketOwnership: z.literal("platform_owned"),
    candidateListen: z.literal("forbidden"),
    executionStatus: z.literal("blocked_until_candidate_materialization"),
  }).strict(),
]);

export type BuildTopologyRuntimeTargetV2 = z.infer<
  typeof BuildTopologyRuntimeTargetV2Schema
>;

export function hashBuildTopologyRuntimeContractV2(
  value: BuildTopologyRuntimeTargetV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-runtime-contract-hash.v2",
    runtime: value,
  });
}

export const BuildTopologyEntrypointV2Schema = z.object({
  kind: z.enum(["cli", "api"]),
  sourcePathRef: PathBindingIdSchema,
  buildOutputPathRef: PathBindingIdSchema,
  candidateModulePathRef: PathBindingIdSchema,
  sourceToRuntime: z.object({
    sourceMediaType: z.literal("text/typescript"),
    outputMediaType: z.literal("text/javascript"),
    moduleSystem: z.literal("node_esm"),
  }).strict(),
  sourceReceipt: z.object({
    schema: z.literal("setfarm.node-entrypoint-source-receipt.v2"),
    state: z.literal("absent"),
    missingDisposition: z.literal("typed_precondition_rejection"),
  }).strict(),
}).strict();

export type BuildTopologyEntrypointV2 = z.infer<
  typeof BuildTopologyEntrypointV2Schema
>;

export function hashBuildTopologyEntrypointContractV2(
  value: BuildTopologyEntrypointV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.build-topology-entrypoint-contract-hash.v2",
    entrypoint: value,
  });
}

const BuildTopologyLogicalIdentityV2Schema = z.object({
  schema: z.literal(BUILD_TOPOLOGY_V2_SCHEMA),
  topologyVersion: z.literal(BUILD_TOPOLOGY_VERSION_V2),
  contractHash: z.literal(BUILD_TOPOLOGY_CONTRACT_HASH_V2),
  stage: z.literal("dependencies_ready"),
  readiness: z.object({
    status: z.literal("shadow_blocked"),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(BuildTopologyBlockerCodeV2Schema)
      .length(BUILD_TOPOLOGY_BLOCKER_CODES_V2.length),
  }).strict(),
  authority: z.object({
    productRef: ProductIdSchema,
    productSpecHash: Sha256Schema,
    deliverySelectionHash: Sha256Schema,
    profileId: ProfileIdV2Schema,
    stackPackId: StackPackIdV2Schema,
    fileTree: z.object({
      schema: z.literal(FILE_TREE_MANIFEST_V2_SCHEMA),
      version: z.literal(FILE_TREE_MANIFEST_VERSION_V2),
      contractHash: z.literal(FILE_TREE_MANIFEST_CONTRACT_HASH_V2),
      manifestHash: Sha256Schema,
      pathCount: z.number().int().positive().max(25_000),
      pathMembershipHash: Sha256Schema,
      ownerMembershipHash: Sha256Schema,
    }).strict(),
    layoutHash: Sha256Schema,
    pathTokenSetHash: Sha256Schema,
    scaffoldResolutionHash: Sha256Schema,
    scaffoldEntryHash: Sha256Schema,
    logicalDependencyHash: Sha256Schema,
    logicalPathMembershipHash: Sha256Schema,
    commandContractHash: Sha256Schema,
    runtimeContractHash: Sha256Schema,
    entrypointContractHash: Sha256Schema,
  }).strict(),
}).strict();

export type BuildTopologyLogicalIdentityV2 = z.infer<
  typeof BuildTopologyLogicalIdentityV2Schema
>;

export function hashBuildTopologyLogicalBuildV2(
  value: BuildTopologyLogicalIdentityV2 | BuildTopologyV2,
): string {
  const logical = {
    schema: value.schema,
    topologyVersion: value.topologyVersion,
    contractHash: value.contractHash,
    stage: value.stage,
    readiness: value.readiness,
    authority: value.authority,
  };
  return hashCanonicalJson({
    schema: "setfarm.build-topology-logical-build-hash.v2",
    topology: logical,
  });
}

const BuildTopologyManifestIdentityV2Schema =
  BuildTopologyLogicalIdentityV2Schema.extend({
    operationalEvidence: z.object({
      admissionScope: z.enum(["production_host", "test_fixture"]),
      dependencyReceiptSchema: z.literal(
        BUILD_DEPENDENCY_MATERIALIZATION_RECEIPT_V2_SCHEMA,
      ),
      dependencyReceiptVersion: z.literal(PRIVATE_STAGED_MATERIALIZER_VERSION_V2),
      dependencyReceiptHash: Sha256Schema,
      dependencyIdentityHash: Sha256Schema,
      scaffoldBaseReceiptHash: Sha256Schema,
      environmentReceiptHash: Sha256Schema,
      hostToolchainReceiptHash: Sha256Schema,
      projectScopeHash: Sha256Schema,
      stdoutHash: Sha256Schema,
      stderrHash: Sha256Schema,
      evidenceAuthority: z.literal("authenticated_private_dependency_stage_fresh_revalidation_v2"),
    }).strict(),
    dependency: z.object({
      logical: BuildTopologyLogicalDependencyV2Schema,
      logicalDependencyHash: Sha256Schema,
      rawBuildInputPathRef: PathBindingIdSchema,
      runtimeCapsulePathRef: PathBindingIdSchema,
    }).strict(),
    pathCount: z.number().int().positive().max(25_004),
    paths: z.array(BuildTopologyPathEntryV2Schema).min(1).max(25_004),
    pathMembershipHash: Sha256Schema,
    entrypoint: BuildTopologyEntrypointV2Schema,
    commands: BuildTopologyCommandsV2Schema,
    runtimeTarget: BuildTopologyRuntimeTargetV2Schema,
    testSource: z.object({
      authorityState: z.literal("absent"),
      requiredMinimumTestCount: z.literal(1),
      zeroTestAcceptance: z.literal("forbidden"),
      blockerCode: z.literal("BUILD_TOPOLOGY_V2_TEST_SOURCE_AUTHORITY_UNVERIFIED"),
    }).strict(),
    logicalBuildHash: Sha256Schema,
  }).strict();

export type BuildTopologyManifestHashPayloadV2 = z.infer<
  typeof BuildTopologyManifestIdentityV2Schema
>;

export function hashBuildTopologyManifestV2(
  value: BuildTopologyManifestHashPayloadV2 | BuildTopologyV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.manifestHash;
  return hashCanonicalJson({
    schema: "setfarm.build-topology-manifest-hash.v2",
    topology: payload,
  });
}

function addBuildTopologyClosureIssuesV2(
  value: BuildTopologyManifestHashPayloadV2 & { manifestHash: string },
  context: z.RefinementCtx,
): void {
  if (
    JSON.stringify(value.readiness.blockerCodes)
      !== JSON.stringify(BUILD_TOPOLOGY_BLOCKER_CODES_V2)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "Build-topology blockers must equal the exact code-owned dependency-ready set",
    });
  }
  const pathKeys = value.paths.map((entry) =>
    `${entry.physicalSpace}\0${entry.normalizedLocator}`);
  const foldedKeys = value.paths.map((entry) =>
    `${entry.physicalSpace}\0${entry.normalizedLocator.toLowerCase()}`);
  if (
    value.pathCount !== value.paths.length
    || !canonicalStrings(pathKeys)
    || !hasUniqueStrings(value.paths.map((entry) => entry.pathRef))
    || !hasUniqueStrings(foldedKeys)
    || value.pathMembershipHash !== hashBuildTopologyPathMembershipV2(value.paths)
    || value.authority.logicalPathMembershipHash
      !== hashBuildTopologyLogicalPathMembershipV2(value.paths)
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "Build-topology paths must be complete, canonical, collision-free and hash-bound",
    });
  }

  const fileTreePaths = value.paths.filter((entry) =>
    entry.authority.kind === "file_tree_path");
  const fileTreeMembership = fileTreePaths.map((entry) => ({
    pathRef: entry.pathRef,
    entryHash: entry.authority.kind === "file_tree_path"
      ? entry.authority.fileTreeEntryHash
      : "",
  }));
  if (
    fileTreePaths.length !== value.authority.fileTree.pathCount
    || hashFileTreePathMembershipV2(fileTreeMembership)
      !== value.authority.fileTree.pathMembershipHash
    || fileTreePaths.some((entry) =>
      entry.authority.kind !== "file_tree_path"
      || entry.authority.fileTreeManifestHash !== value.authority.fileTree.manifestHash
      || entry.currentState.state !== "file_tree_projection"
      || entry.currentState.fileTreeEntryHash !== entry.authority.fileTreeEntryHash)
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "Every-and-only FileTree path must survive as one exact topology projection",
    });
  }

  const raw = value.paths.filter((entry) =>
    entry.authority.kind === "raw_dependency_build_input");
  const capsule = value.paths.filter((entry) =>
    entry.authority.kind === "readonly_dependency_runtime_capsule");
  const output = value.paths.filter((entry) =>
    entry.authority.kind === "build_output_plan");
  const candidate = value.paths.filter((entry) =>
    entry.authority.kind === "candidate_module_plan");
  if (
    raw.length !== 1
    || capsule.length !== 1
    || output.length !== 1
    || candidate.length !== 1
    || raw[0]?.pathRef !== value.dependency.rawBuildInputPathRef
    || capsule[0]?.pathRef !== value.dependency.runtimeCapsulePathRef
    || raw[0]?.normalizedLocator !== "node_modules"
    || raw[0]?.physicalSpace !== "repository"
    || raw[0]?.classification !== "raw_dependency_build_input"
    || raw[0]?.access !== "dependency_compile_input"
    || raw[0]?.currentState.state !== "present_raw_dependency_tree"
    || capsule[0]?.normalizedLocator !== "node_modules"
    || capsule[0]?.physicalSpace !== "dependency_capsule"
    || capsule[0]?.classification !== "readonly_dependency_runtime_capsule"
    || capsule[0]?.access !== "dependency_runtime_readonly"
    || capsule[0]?.currentState.state !== "present_readonly_dependency_capsule"
    || output[0]?.physicalSpace !== "repository"
    || output[0]?.classification !== "build_output"
    || output[0]?.access !== "build_generated_future"
    || output[0]?.currentState.state !== "absent"
    || candidate[0]?.physicalSpace !== "candidate_runtime"
    || candidate[0]?.classification !== "candidate_module"
    || candidate[0]?.access !== "candidate_generated_future"
    || candidate[0]?.currentState.state !== "not_materialized"
  ) {
    context.addIssue({
      code: "custom",
      path: ["paths"],
      message: "Dependency, build-output and candidate path roles must each occur exactly once",
    });
  }

  const dependencyReceiptHash = value.operationalEvidence.dependencyReceiptHash;
  if (
    value.dependency.logicalDependencyHash
      !== hashBuildTopologyLogicalDependencyV2(value.dependency.logical)
    || value.dependency.logicalDependencyHash !== value.authority.logicalDependencyHash
    || raw.some((entry) =>
      entry.authority.kind !== "raw_dependency_build_input"
      || entry.authority.dependencyReceiptHash !== dependencyReceiptHash
      || entry.authority.logicalDependencyHash !== value.authority.logicalDependencyHash)
    || capsule.some((entry) =>
      entry.authority.kind !== "readonly_dependency_runtime_capsule"
      || entry.authority.dependencyReceiptHash !== dependencyReceiptHash
      || entry.authority.logicalDependencyHash !== value.authority.logicalDependencyHash)
    || value.commands.install.dependencyReceiptHash !== dependencyReceiptHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["dependency"],
      message: "Logical dependency identity and current operational receipt must remain separate and joined",
    });
  }

  if (
    value.authority.commandContractHash
      !== hashBuildTopologyCommandContractV2(value.commands)
    || value.authority.runtimeContractHash
      !== hashBuildTopologyRuntimeContractV2(value.runtimeTarget)
    || value.authority.entrypointContractHash
      !== hashBuildTopologyEntrypointContractV2(value.entrypoint)
    || value.runtimeTarget.candidateModulePathRef
      !== value.entrypoint.candidateModulePathRef
    || output[0]?.pathRef !== value.entrypoint.buildOutputPathRef
    || candidate[0]?.pathRef !== value.entrypoint.candidateModulePathRef
  ) {
    context.addIssue({
      code: "custom",
      path: ["entrypoint"],
      message: "Entrypoint, command, output and runtime contracts must join exactly",
    });
  }

  const source = value.paths.find((entry) =>
    entry.pathRef === value.entrypoint.sourcePathRef);
  const expected = value.authority.stackPackId === "node-cli"
    ? {
        profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
        source: "src/cli.ts",
        output: "dist/cli.js",
        candidate: "candidate-bundle/application/cli.js",
        entrypointKind: "cli",
        runtimeKind: "cli",
      }
    : {
        profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
        source: "src/app.ts",
        output: "dist/app.js",
        candidate: "candidate-bundle/application/app.js",
        entrypointKind: "api",
        runtimeKind: "http_handler",
      };
  if (
    value.authority.profileId !== expected.profileId
    || source?.normalizedLocator !== expected.source
    || source?.classification !== "entrypoint_generated"
    || output[0]?.normalizedLocator !== expected.output
    || candidate[0]?.normalizedLocator !== expected.candidate
    || value.entrypoint.kind !== expected.entrypointKind
    || value.runtimeTarget.kind !== expected.runtimeKind
  ) {
    context.addIssue({
      code: "custom",
      path: ["entrypoint"],
      message: "Profile, source, output, candidate and runtime ABI must form one exact chain",
    });
  }

  if (
    value.logicalBuildHash !== hashBuildTopologyLogicalBuildV2(value)
    || value.manifestHash !== hashBuildTopologyManifestV2(value)
  ) {
    context.addIssue({
      code: "custom",
      path: ["manifestHash"],
      message: "Build topology logical and operational identities must both self-verify",
    });
  }
}

const BuildTopologyCandidateV2Schema = BuildTopologyManifestIdentityV2Schema.extend({
  manifestHash: Sha256Schema,
}).strict().superRefine(addBuildTopologyClosureIssuesV2);

export const BuildTopologyV2Schema = z.unknown().superRefine((value, context) => {
  try {
    canonicalJsonBytesBounded(value, {
      maxBytes: BUILD_TOPOLOGY_MAX_CANONICAL_BYTES_V2,
      ...BUILD_TOPOLOGY_BOUNDED_WORK_LIMITS_V2,
    });
  } catch {
    context.addIssue({
      code: "custom",
      message: "Build topology exceeds its canonical byte or work bound",
    });
  }
}).pipe(BuildTopologyCandidateV2Schema);

export type BuildTopologyV2 = z.infer<typeof BuildTopologyCandidateV2Schema>;

export function recursivelyFreezeBuildTopologyV2<T>(value: T): T {
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

export function fileTreePathProjectionForBuildTopologyV2(
  fileTreeManifestHash: string,
  entry: FileTreePathEntryV2,
): BuildTopologyPathEntryHashPayloadV2 {
  const classification = entry.classification === "config"
    ? "config_readonly" as const
    : entry.classification === "config_absence"
      ? "config_absence" as const
      : entry.classification === "source"
        ? "source_writable" as const
        : entry.classification;
  return {
    pathRef: deriveBuildTopologyPathRefV2("repository", entry.normalizedLocator),
    physicalSpace: "repository",
    normalizedLocator: entry.normalizedLocator,
    pathIdentityHash: hashPortablePathIdentityV2("repository", entry.normalizedLocator),
    caseFoldPathIdentityHash:
      hashPortablePathCaseFoldIdentityV2("repository", entry.normalizedLocator),
    classification,
    ownerRef: entry.ownerRef,
    writeGrantOwnerRefs: [...entry.writeGrantOwnerRefs],
    access: entry.access,
    currentState: {
      state: "file_tree_projection",
      fileTreeEntryHash: entry.entryHash,
      projectedState: entry.currentState.state,
    },
    authority: {
      kind: "file_tree_path",
      fileTreeManifestHash,
      fileTreeEntryHash: entry.entryHash,
    },
  };
}

export function parseFileTreePathEntryForBuildTopologyV2(
  value: unknown,
): FileTreePathEntryV2 {
  return FileTreePathEntryV2Schema.parse(value);
}
